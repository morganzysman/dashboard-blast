// Training-evidence module: prompt selection + review notifications.
//
// The module exists to spread station standards across locations by coaching,
// so every decision here favours "ask occasionally, never block work" over
// "audit everything". Clock-out is never gated on a submission.

import webpush from 'web-push'
import {
  pool,
  getPushSubscriptions,
  trackNotificationSent,
  trackNotificationError,
  removeSpecificPushSubscription,
  logNotificationEvent
} from '../database.js'

export const DEFAULT_PROMPT_PROBABILITY = 0.5
export const DEFAULT_COOLDOWN_DAYS = 7

// Roles that can configure the catalogue and review submissions.
export const REVIEWER_ROLES = ['manager', 'admin', 'super-admin']

export function isReviewer(role) {
  return REVIEWER_ROLES.includes(role)
}

// Read the company knobs, falling back to defaults when no row exists yet so
// the feature works the moment a manager adds their first template.
export async function getTrainingSettings(companyId) {
  const q = await pool.query(
    `SELECT prompt_probability, cooldown_days FROM training_settings WHERE company_id = $1`,
    [companyId]
  )
  const row = q.rows[0]
  return {
    prompt_probability: row ? Number(row.prompt_probability) : DEFAULT_PROMPT_PROBABILITY,
    cooldown_days: row ? Number(row.cooldown_days) : DEFAULT_COOLDOWN_DAYS
  }
}

// Weighted pick over the candidate templates.
function weightedPick(rows) {
  const total = rows.reduce((sum, r) => sum + Math.max(1, Number(r.weight) || 1), 0)
  let ticket = Math.random() * total
  for (const row of rows) {
    ticket -= Math.max(1, Number(row.weight) || 1)
    if (ticket <= 0) return row
  }
  return rows[rows.length - 1]
}

/**
 * Decide whether this clock-out should show a prompt, and for which template.
 *
 * Candidate templates are the company's active ones whose target_job_type is
 * either unset or matches the user. Anything the user was already asked within
 * the cooldown window is set aside; if that leaves nothing we fall back to the
 * full list rather than silently skipping people with a small catalogue.
 *
 * Returns the chosen template row, or null when no prompt should be shown.
 */
export async function pickTemplate({ companyId, userId, jobType, settings }) {
  const { prompt_probability: probability, cooldown_days: cooldownDays } = settings

  if (probability <= 0) return null

  const candidates = await pool.query(
    `SELECT id, title, description, requires_photo, min_photos, weight
       FROM training_evidence_templates
      WHERE company_id = $1
        AND is_active = TRUE
        AND (target_job_type IS NULL OR target_job_type = $2)`,
    [companyId, jobType || null]
  )
  if (candidates.rowCount === 0) return null

  // Roll the dice only once we know there is something to ask about, so an
  // empty catalogue never burns a "no prompt" outcome.
  if (Math.random() > probability) return null

  const eligible = await applyCooldown(candidates.rows, { cooldownDays, userId })
  return weightedPick(eligible)
}

// Drop templates the user saw recently; keep the full list if all are on
// cooldown so the pick never returns empty.
async function applyCooldown(rows, { cooldownDays, userId }) {
  if (!cooldownDays || !userId || rows.length < 2) return rows
  const recent = await pool.query(
    `SELECT DISTINCT template_id
       FROM training_evidence_requests
      WHERE user_id = $1
        AND template_id IS NOT NULL
        AND created_at > NOW() - ($2 || ' days')::interval`,
    [userId, String(cooldownDays)]
  )
  const seen = new Set(recent.rows.map(r => r.template_id))
  const fresh = rows.filter(r => !seen.has(r.id))
  return fresh.length > 0 ? fresh : rows
}

export async function getCheckpoints(templateId) {
  const q = await pool.query(
    `SELECT id, label, hint, sort_order
       FROM training_evidence_checkpoints
      WHERE template_id = $1
      ORDER BY sort_order ASC, created_at ASC`,
    [templateId]
  )
  return q.rows
}

// Shared push helper: send one payload to every device of one user.
async function pushToUser(userId, payload, eventType) {
  try {
    const subs = await getPushSubscriptions(userId)
    if (!subs || subs.length === 0) {
      await logNotificationEvent(userId, eventType, 'No active push subscriptions for user', { reason: 'no_active_subscriptions' }, true)
      return { sent: 0, devices: 0 }
    }
    let sent = 0
    for (const s of subs) {
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify(payload))
        sent++
      } catch (err) {
        await trackNotificationError(userId, err.message)
        if (err.statusCode === 410) await removeSpecificPushSubscription(s.endpoint)
      }
    }
    if (sent > 0) await trackNotificationSent(userId)
    await logNotificationEvent(userId, eventType, sent > 0 ? 'Notification sent' : 'Notification not sent', { devices: subs.length, sent }, sent > 0)
    return { sent, devices: subs.length }
  } catch (e) {
    await logNotificationEvent(userId, `${eventType}_error`, 'Failed to send notification', { error: e.message }, false, e.message)
    return { sent: 0, devices: 0 }
  }
}

// Tell the company's managers/admins that something is waiting for review.
export async function notifyReviewersNewSubmission({ companyId, userName, templateTitle, accountName }) {
  const reviewers = await pool.query(
    `SELECT id FROM users
      WHERE is_active = TRUE
        AND (role = 'super-admin' OR (role IN ('manager', 'admin') AND company_id = $1))`,
    [companyId]
  )
  const payload = {
    title: '📸 New training evidence',
    body: `${userName || 'Employee'} submitted "${templateTitle}"${accountName ? ` • ${accountName}` : ''}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-badge-96x96.png',
    tag: 'training-evidence-new',
    data: { url: '/training/review', type: 'training-evidence-submitted', timestamp: Date.now() }
  }
  let sent = 0
  for (const r of reviewers.rows) {
    const result = await pushToUser(r.id, payload, 'training_evidence_submitted')
    sent += result.sent
  }
  return { sent, reviewers: reviewers.rowCount }
}

// Tell the employee their evidence was reviewed. The wording stays encouraging
// on purpose — a "needs improvement" push should read as coaching, not a strike.
export async function notifyUserEvidenceReviewed({ userId, templateTitle, rating }) {
  const good = rating === 'good'
  const payload = {
    title: good ? '✅ Nice work!' : '💡 Feedback on your evidence',
    body: good
      ? `Your "${templateTitle}" evidence looks good`
      : `Your manager left tips on "${templateTitle}"`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-badge-96x96.png',
    tag: 'training-evidence-reviewed',
    data: { url: '/training', type: 'training-evidence-reviewed', timestamp: Date.now() }
  }
  return pushToUser(userId, payload, 'training_evidence_reviewed')
}
