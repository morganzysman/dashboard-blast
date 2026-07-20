import { Router } from 'express';
import { pool } from '../database.js';
import { markOrderDeleted, syncSingleOrder } from '../services/comboStatsService.js';

const router = Router();

// Resolve an account (for its API key + timezone) from the merchant_id we
// registered, which is the company_token.
async function loadAccountByToken(companyToken) {
  if (!companyToken) return null;
  const res = await pool.query(
    `SELECT ca.company_id, ca.company_token, ca.public_api_key, c.timezone
     FROM company_accounts ca
     JOIN companies c ON c.id = ca.company_id
     WHERE ca.company_token = $1
     LIMIT 1`,
    [companyToken]
  );
  return res.rows[0] || null;
}

// Fetch the order's detail and upsert it into the ledger, then stamp the webhook
// event as processed (or record the error). Runs AFTER we've already acked, so a
// failure here is healed by the reconciliation poll rather than an HTTP retry.
async function ingestOrderAsync(eventId, account, orderId) {
  try {
    if (!account?.public_api_key) throw new Error(`no public_api_key for ${account?.company_token}`);
    const { action } = await syncSingleOrder(
      account.company_id, account.company_token, account.public_api_key, orderId, account.timezone
    );
    console.log(`🔄 Webhook ingest ${account.company_token} ${orderId} → ${action}`);
    await pool.query(`UPDATE order_webhook_events SET processed_at = NOW(), error = NULL WHERE event_id = $1`, [eventId]);
  } catch (err) {
    console.error(`❌ Webhook ingest failed (${eventId} ${orderId}):`, err.message);
    await pool.query(`UPDATE order_webhook_events SET error = $2 WHERE event_id = $1`, [eventId, err.message]).catch(() => {});
  }
}

// Shared secret we register in each webhook's custom headers (see
// register-webhooks.mjs) and re-check on every delivery. Optional but strongly
// recommended in production so nobody can forge deletions against our ledger.
const WEBHOOK_SECRET = process.env.OLACLICK_WEBHOOK_SECRET || '';
const WEBHOOK_SECRET_HEADER = (process.env.OLACLICK_WEBHOOK_SECRET_HEADER || 'x-webhook-secret').toLowerCase();

/**
 * Receiver for OlaClick order webhooks.
 *
 * Registered URL: `${APP_BASE_URL}/api/webhooks/olaclick` (merchant_id =
 * company_token). Handles ORDER_DELETED (hard delete in OlaClick → soft-delete
 * in the ledger). ORDER_CREATED / ORDER_UPDATED are logged and acked; the
 * 5-minute poll already keeps those in sync, so we don't act on them here.
 *
 * Contract (per OlaClick docs): verify the `source: OlaClick` header, dedupe by
 * `event_id`, respond with 2xx to acknowledge. We always ack duplicates/ignored
 * events with 200 so OlaClick doesn't retry them.
 */
router.post('/olaclick', async (req, res) => {
  // 1. Authenticity checks.
  if (req.headers['source'] !== 'OlaClick') {
    return res.status(401).json({ error: 'unknown source' });
  }
  if (WEBHOOK_SECRET && req.headers[WEBHOOK_SECRET_HEADER] !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'invalid secret' });
  }

  const body = req.body || {};
  const eventType = body.event_type;
  const eventId = body.event_id;
  const merchantId = body.merchant_id;
  const data = body.data || {};
  const orderId = data.order_id ?? data.id ?? null;

  if (!eventId || !eventType) {
    return res.status(400).json({ error: 'missing event_id or event_type' });
  }

  // merchant_id is the company_token we registered with.
  const companyToken = merchantId || null;

  // 2. Persist the raw delivery (also our dedupe key). ON CONFLICT DO NOTHING
  //    means a retried/duplicate delivery is a no-op we still ack with 200.
  let isNew = true;
  try {
    const ins = await pool.query(
      `INSERT INTO order_webhook_events
         (event_id, event_type, merchant_id, company_token, order_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventType, merchantId, companyToken, orderId, body]
    );
    isNew = ins.rowCount > 0;
  } catch (err) {
    console.error(`❌ Webhook persist failed (${eventType} ${eventId}):`, err.message);
    // Ask OlaClick to retry — we couldn't even record it.
    return res.status(500).json({ error: 'persist failed' });
  }

  if (!isNew) {
    return res.status(200).json({ status: 'duplicate' });
  }

  // 3. Process by type.
  //    - ORDER_DELETED: fast DB update, done inline before we ack.
  //    - ORDER_CREATED / ORDER_UPDATED: needs a detail fetch, so we ack first
  //      and ingest asynchronously (the poll is the backstop if it fails).
  try {
    if (eventType === 'ORDER_DELETED') {
      if (companyToken && orderId) {
        const affected = await markOrderDeleted(companyToken, orderId);
        const handled = affected > 0 ? 'deleted' : 'delete-noop';
        console.log(`🗑️  Webhook ORDER_DELETED ${companyToken} ${orderId} → ${handled}`);
        await pool.query(`UPDATE order_webhook_events SET processed_at = NOW() WHERE event_id = $1`, [eventId]);
        return res.status(200).json({ status: handled });
      }
      console.warn(`⚠️  ORDER_DELETED without merchant_id/order_id: ${eventId}`);
      await pool.query(`UPDATE order_webhook_events SET processed_at = NOW(), error = $2 WHERE event_id = $1`, [eventId, 'missing merchant_id/order_id']);
      return res.status(200).json({ status: 'delete-missing-ids' });
    }

    if ((eventType === 'ORDER_CREATED' || eventType === 'ORDER_UPDATED') && companyToken && orderId) {
      const account = await loadAccountByToken(companyToken);
      // Ack now; ingest in the background so we never hold the delivery open on
      // a slow detail fetch (which could trip OlaClick's timeout → retries).
      res.status(202).json({ status: 'accepted' });
      ingestOrderAsync(eventId, account, orderId);
      return;
    }

    // Unknown / non-order event, or missing ids: record and ack so it isn't retried.
    await pool.query(`UPDATE order_webhook_events SET processed_at = NOW() WHERE event_id = $1`, [eventId]);
    return res.status(200).json({ status: 'ignored' });
  } catch (err) {
    console.error(`❌ Webhook processing failed (${eventType} ${eventId}):`, err.message);
    await pool.query(
      `UPDATE order_webhook_events SET error = $2 WHERE event_id = $1`,
      [eventId, err.message]
    ).catch(() => {});
    if (!res.headersSent) return res.status(500).json({ error: 'processing failed' });
  }
});

export default router;
