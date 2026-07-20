import { pool } from '../database.js'
import { config } from '../config/index.js'
import { listWebhooks, createWebhook } from './publicOlaClickService.js'

// Path our receiver is mounted at (see routes/webhooks.js + server.js).
const WEBHOOK_PATH = '/api/webhooks/olaclick'

function normalizeBase(raw) {
  if (!raw) return ''
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withProto.replace(/\/+$/, '')
}

// Resolve this server's public base URL. Prefer an explicit APP_BASE_URL, else
// fall back to RAILWAY_PUBLIC_DOMAIN, which Railway injects automatically into
// any service that has a public domain — so webhook registration works on deploy
// with no manual env setup.
function resolvePublicBase() {
  return normalizeBase(
    config.appBaseUrl ||
    process.env.APP_BASE_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN
  )
}

// True when an existing webhook_url points at THIS server (same origin + our
// receiver path). Robust to trailing slashes / query strings.
function pointsToUs(existingUrl, ourUrl) {
  try {
    const a = new URL(existingUrl)
    const b = new URL(ourUrl)
    return a.origin === b.origin && a.pathname.replace(/\/+$/, '') === b.pathname.replace(/\/+$/, '')
  } catch {
    return typeof existingUrl === 'string' && existingUrl.startsWith(ourUrl)
  }
}

async function loadKeyedAccounts() {
  const res = await pool.query(
    `SELECT company_id, company_token, account_name, public_api_key
     FROM company_accounts
     WHERE public_api_key IS NOT NULL AND public_api_key <> ''
     ORDER BY account_name, company_token`
  )
  return res.rows
}

/**
 * Idempotent boot-time webhook registration.
 *
 * For every account that has a public_api_key: GET /v1/webhooks and check whether
 * at least one entry already points to this server. If none does, POST to create
 * one (merchant_id = company_token, plus the shared-secret header if configured).
 *
 * Safe to run on every container start — existing subscriptions are left as-is.
 * Never throws: a failure for one account is logged and skipped so it can't block
 * server startup.
 */
export async function ensureAccountWebhooks() {
  const base = resolvePublicBase()
  if (!base) {
    console.warn('🔔 [Webhooks] No public base URL (set APP_BASE_URL or a Railway public domain) — skipping auto-registration.')
    return
  }

  const webhookUrl = `${base}${WEBHOOK_PATH}`
  const secret = process.env.OLACLICK_WEBHOOK_SECRET || ''
  const secretHeader = (process.env.OLACLICK_WEBHOOK_SECRET_HEADER || 'x-webhook-secret').toLowerCase()
  const headers = secret ? { [secretHeader]: secret } : undefined

  if (!secret) {
    console.warn('🔔 [Webhooks] OLACLICK_WEBHOOK_SECRET is empty — deliveries will not be authenticated. Set it for production.')
  }

  let accounts = []
  try {
    accounts = await loadKeyedAccounts()
  } catch (err) {
    console.error('🔔 [Webhooks] Could not load accounts:', err.message)
    return
  }

  if (accounts.length === 0) {
    console.log('🔔 [Webhooks] No accounts with a public_api_key — nothing to register.')
    return
  }

  console.log(`🔔 [Webhooks] Ensuring webhook registration for ${accounts.length} account(s) → ${webhookUrl}`)

  let created = 0
  let existing = 0
  let failed = 0

  for (const acc of accounts) {
    const label = `${acc.account_name || acc.company_token} (${acc.company_token})`
    try {
      const current = await listWebhooks(acc.public_api_key)
      const already = current.some((w) => pointsToUs(w.webhook_url, webhookUrl))

      if (already) {
        existing += 1
        console.log(`   • ${label}: already registered`)
        continue
      }

      const res = await createWebhook(acc.public_api_key, {
        webhookUrl,
        merchantId: acc.company_token,
        webhookHeaders: headers
      })
      created += 1
      console.log(`   ✅ ${label}: created ${res?.webhook_id || res?.id || '(ok)'}`)
    } catch (err) {
      failed += 1
      console.error(`   ❌ ${label}: ${err.message}`)
    }
  }

  console.log(`🔔 [Webhooks] Done — created=${created} existing=${existing} failed=${failed}`)
}
