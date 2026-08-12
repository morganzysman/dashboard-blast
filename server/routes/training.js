// Training-evidence module (mounted at /api/training).
//
// Three audiences share this router:
//   * employees  — receive the clock-out prompt, submit evidence, read feedback
//   * managers   — own the catalogue and review submissions for their company
//   * admins     — same as managers, plus super-admins across companies
//
// Everything is company-scoped. A super-admin without a company_id sees all
// companies on reads and must name a company on writes.

import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { pool } from '../database.js'
import { decodeImagePayload } from '../utils/imagePayload.js'
import {
  REVIEWER_ROLES,
  getTrainingSettings,
  pickTemplate,
  getCheckpoints,
  notifyReviewersNewSubmission,
  notifyUserEvidenceReviewed,
  DEFAULT_PROMPT_PROBABILITY,
  DEFAULT_COOLDOWN_DAYS
} from '../services/trainingService.js'

const router = Router()

const requireReviewer = requireRole(REVIEWER_ROLES)

// Photos are already downscaled client-side; 2MB each is generous for a
// 1280px JPEG and keeps a 3-photo submission well inside the body limit.
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const MAX_PHOTOS = 3

// Resolve which company a reviewer request operates on. Managers and admins are
// pinned to their own company; a super-admin may target any (or all, on reads).
function resolveScope(req) {
  const isSuper = req.user.role === 'super-admin'
  const requested = req.query.company_id || req.body?.company_id || null
  if (isSuper) return { companyId: requested || null, isSuper }
  return { companyId: req.user.companyId || null, isSuper }
}

// Company filter for row-level statements, passed as a nullable uuid param
// (`$n::uuid IS NULL OR company_id = $n`). Only a super-admin may resolve to
// NULL, i.e. "all tenants"; for anyone else a missing company would silently
// widen the statement across companies, so that is rejected outright.
function scopeFilter(req, res) {
  const { companyId, isSuper } = resolveScope(req)
  if (!isSuper && !companyId) {
    badRequest(res, 'No company assigned to this user')
    return undefined
  }
  return companyId
}

function badRequest(res, error) {
  return res.status(400).json({ success: false, error })
}

// Normalise the checkpoint list coming from the catalogue editor.
function normaliseCheckpoints(input) {
  if (!Array.isArray(input)) return []
  return input
    .map((c, index) => ({
      label: String(c?.label ?? '').trim(),
      hint: c?.hint ? String(c.hint).trim() : null,
      sort_order: Number.isFinite(Number(c?.sort_order)) ? Number(c.sort_order) : index
    }))
    .filter(c => c.label.length > 0)
    .slice(0, 20)
}

// Replace a template's checkpoints wholesale. The editor always sends the full
// list, and rewriting is simpler (and safer for ordering) than diffing.
async function replaceCheckpoints(client, templateId, checkpoints) {
  await client.query('DELETE FROM training_evidence_checkpoints WHERE template_id = $1', [templateId])
  for (const c of checkpoints) {
    await client.query(
      `INSERT INTO training_evidence_checkpoints(template_id, label, hint, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [templateId, c.label, c.hint, c.sort_order]
    )
  }
}

function parseTemplateBody(body) {
  const title = String(body?.title ?? '').trim()
  if (!title) return { error: 'title is required' }

  const rawJobType = body?.target_job_type
  const targetJobType = !rawJobType ? null : String(rawJobType).toLowerCase()
  if (targetJobType && !['kitchen', 'waiter'].includes(targetJobType)) {
    return { error: 'target_job_type must be kitchen, waiter, or empty' }
  }

  const requiresPhoto = body?.requires_photo !== false
  const minPhotos = Math.min(MAX_PHOTOS, Math.max(requiresPhoto ? 1 : 0, Number(body?.min_photos) || (requiresPhoto ? 1 : 0)))
  const weight = Math.min(10, Math.max(1, Number(body?.weight) || 1))

  return {
    title,
    description: body?.description ? String(body.description).trim() : null,
    targetJobType,
    requiresPhoto,
    minPhotos,
    weight,
    isActive: body?.is_active !== false,
    checkpoints: normaliseCheckpoints(body?.checkpoints)
  }
}

// ---------------------------------------------------------------------------
// Catalogue (managers + admins)
// ---------------------------------------------------------------------------

router.get('/templates', requireAuth, requireReviewer, async (req, res) => {
  try {
    const { companyId, isSuper } = resolveScope(req)
    if (!companyId && !isSuper) return badRequest(res, 'No company assigned to this user')

    const params = []
    let where = ''
    if (companyId) {
      params.push(companyId)
      where = 'WHERE t.company_id = $1'
    }

    const q = await pool.query(
      `SELECT t.id, t.company_id, t.title, t.description, t.target_job_type,
              t.requires_photo, t.min_photos, t.weight, t.is_active,
              t.created_at, t.updated_at,
              COALESCE(
                (SELECT json_agg(json_build_object('id', c.id, 'label', c.label, 'hint', c.hint, 'sort_order', c.sort_order)
                                 ORDER BY c.sort_order, c.created_at)
                   FROM training_evidence_checkpoints c WHERE c.template_id = t.id),
                '[]'::json
              ) AS checkpoints
         FROM training_evidence_templates t
         ${where}
         ORDER BY t.is_active DESC, t.title ASC`,
      params
    )
    res.json({ success: true, data: q.rows })
  } catch (e) {
    console.error('Error listing training templates:', e)
    res.status(500).json({ success: false, error: 'Failed to load templates' })
  }
})

router.post('/templates', requireAuth, requireReviewer, async (req, res) => {
  const parsed = parseTemplateBody(req.body)
  if (parsed.error) return badRequest(res, parsed.error)

  const { companyId } = resolveScope(req)
  if (!companyId) return badRequest(res, 'company_id is required')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const ins = await client.query(
      `INSERT INTO training_evidence_templates
         (company_id, title, description, target_job_type, requires_photo, min_photos, weight, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [companyId, parsed.title, parsed.description, parsed.targetJobType, parsed.requiresPhoto,
       parsed.minPhotos, parsed.weight, parsed.isActive, req.user.userId]
    )
    const templateId = ins.rows[0].id
    await replaceCheckpoints(client, templateId, parsed.checkpoints)
    await client.query('COMMIT')
    res.json({ success: true, data: { id: templateId } })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Error creating training template:', e)
    res.status(500).json({ success: false, error: 'Failed to create template' })
  } finally {
    client.release()
  }
})

router.put('/templates/:id', requireAuth, requireReviewer, async (req, res) => {
  const parsed = parseTemplateBody(req.body)
  if (parsed.error) return badRequest(res, parsed.error)

  const scope = scopeFilter(req, res)
  if (scope === undefined) return

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const upd = await client.query(
      `UPDATE training_evidence_templates
          SET title = $2, description = $3, target_job_type = $4, requires_photo = $5,
              min_photos = $6, weight = $7, is_active = $8, updated_at = NOW()
        WHERE id = $1 AND ($9::uuid IS NULL OR company_id = $9)
        RETURNING id`,
      [req.params.id, parsed.title, parsed.description, parsed.targetJobType, parsed.requiresPhoto,
       parsed.minPhotos, parsed.weight, parsed.isActive, scope]
    )
    if (upd.rowCount === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, error: 'Template not found' })
    }
    await replaceCheckpoints(client, req.params.id, parsed.checkpoints)
    await client.query('COMMIT')
    res.json({ success: true, data: { id: req.params.id } })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Error updating training template:', e)
    res.status(500).json({ success: false, error: 'Failed to update template' })
  } finally {
    client.release()
  }
})

// Hard delete is safe: requests and submissions keep a title snapshot and their
// template_id is ON DELETE SET NULL, so past feedback stays readable.
router.delete('/templates/:id', requireAuth, requireReviewer, async (req, res) => {
  try {
    const scope = scopeFilter(req, res)
    if (scope === undefined) return

    const del = await pool.query(
      `DELETE FROM training_evidence_templates
        WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2)
        RETURNING id`,
      [req.params.id, scope]
    )
    if (del.rowCount === 0) return res.status(404).json({ success: false, error: 'Template not found' })
    res.json({ success: true })
  } catch (e) {
    console.error('Error deleting training template:', e)
    res.status(500).json({ success: false, error: 'Failed to delete template' })
  }
})

// ---------------------------------------------------------------------------
// Per-company prompt settings
// ---------------------------------------------------------------------------

router.get('/settings', requireAuth, requireReviewer, async (req, res) => {
  try {
    const { companyId } = resolveScope(req)
    if (!companyId) {
      return res.json({
        success: true,
        data: { prompt_probability: DEFAULT_PROMPT_PROBABILITY, cooldown_days: DEFAULT_COOLDOWN_DAYS }
      })
    }
    res.json({ success: true, data: await getTrainingSettings(companyId) })
  } catch (e) {
    console.error('Error loading training settings:', e)
    res.status(500).json({ success: false, error: 'Failed to load settings' })
  }
})

router.put('/settings', requireAuth, requireReviewer, async (req, res) => {
  try {
    const { companyId } = resolveScope(req)
    if (!companyId) return badRequest(res, 'company_id is required')

    const probability = Number(req.body?.prompt_probability)
    const cooldown = Number(req.body?.cooldown_days)
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      return badRequest(res, 'prompt_probability must be between 0 and 1')
    }
    if (!Number.isFinite(cooldown) || cooldown < 0 || cooldown > 90) {
      return badRequest(res, 'cooldown_days must be between 0 and 90')
    }

    const q = await pool.query(
      `INSERT INTO training_settings(company_id, prompt_probability, cooldown_days, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (company_id) DO UPDATE
         SET prompt_probability = EXCLUDED.prompt_probability,
             cooldown_days = EXCLUDED.cooldown_days,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()
       RETURNING prompt_probability, cooldown_days`,
      [companyId, probability.toFixed(3), Math.round(cooldown), req.user.userId]
    )
    const row = q.rows[0]
    res.json({
      success: true,
      data: { prompt_probability: Number(row.prompt_probability), cooldown_days: Number(row.cooldown_days) }
    })
  } catch (e) {
    console.error('Error saving training settings:', e)
    res.status(500).json({ success: false, error: 'Failed to save settings' })
  }
})

// ---------------------------------------------------------------------------
// Clock-out prompt (employees + managers on their own shift)
// ---------------------------------------------------------------------------

// Asked by the clock screen right before it calls the payroll clock endpoint.
// Returns at most one prompt. A pending prompt is reused rather than re-rolled
// so nobody can reroll until they draw an easy station.
router.post('/clock-out-prompt', requireAuth, async (req, res) => {
  try {
    const companyToken = String(req.body?.company_token || '').trim()
    if (!companyToken) return badRequest(res, 'company_token is required')

    const userId = req.user.userId

    const pending = await pool.query(
      `SELECT id, template_id, template_title FROM training_evidence_requests
        WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    )
    if (pending.rowCount > 0) {
      const row = pending.rows[0]
      return res.json({
        success: true,
        data: {
          prompt: await hydratePrompt(row.id, row.template_id, row.template_title)
        }
      })
    }

    const acct = await pool.query(
      'SELECT company_id FROM company_accounts WHERE company_token = $1',
      [companyToken]
    )
    const companyId = acct.rows[0]?.company_id || null
    if (!companyId) return res.json({ success: true, data: { prompt: null } })
    if (req.user.companyId && req.user.companyId !== companyId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const me = await pool.query('SELECT job_type FROM users WHERE id = $1', [userId])
    const settings = await getTrainingSettings(companyId)
    const template = await pickTemplate({
      companyId,
      userId,
      jobType: me.rows[0]?.job_type || null,
      settings
    })
    if (!template) return res.json({ success: true, data: { prompt: null } })

    // Attach the prompt to the shift being closed so feedback can be traced
    // back to a concrete day without relying on timestamps alone.
    const openEntry = await pool.query(
      `SELECT id FROM time_entries
        WHERE user_id = $1 AND company_token = $2 AND clock_out_at IS NULL
        ORDER BY clock_in_at DESC LIMIT 1`,
      [userId, companyToken]
    )

    const created = await pool.query(
      `INSERT INTO training_evidence_requests
         (company_id, company_token, user_id, template_id, template_title, time_entry_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) WHERE status = 'pending' DO NOTHING
       RETURNING id`,
      [companyId, companyToken, userId, template.id, template.title, openEntry.rows[0]?.id || null]
    )
    if (created.rowCount === 0) return res.json({ success: true, data: { prompt: null } })

    res.json({
      success: true,
      data: { prompt: await hydratePrompt(created.rows[0].id, template.id, template.title) }
    })
  } catch (e) {
    console.error('Error building clock-out training prompt:', e)
    // A failure here must never stop someone from clocking out.
    res.json({ success: true, data: { prompt: null } })
  }
})

async function hydratePrompt(requestId, templateId, templateTitle) {
  const tpl = templateId
    ? (await pool.query(
        `SELECT description, requires_photo, min_photos
           FROM training_evidence_templates WHERE id = $1`,
        [templateId]
      )).rows[0]
    : null
  return {
    request_id: requestId,
    template_id: templateId,
    title: templateTitle,
    description: tpl?.description || null,
    requires_photo: tpl ? tpl.requires_photo : true,
    min_photos: tpl ? Number(tpl.min_photos) : 1,
    checkpoints: templateId ? await getCheckpoints(templateId) : []
  }
}

router.post('/requests/:id/skip', requireAuth, async (req, res) => {
  try {
    const upd = await pool.query(
      `UPDATE training_evidence_requests
          SET status = 'skipped', skip_reason = $3, resolved_at = NOW()
        WHERE id = $1 AND user_id = $2 AND status = 'pending'
        RETURNING id`,
      [req.params.id, req.user.userId, req.body?.reason ? String(req.body.reason).slice(0, 500) : null]
    )
    if (upd.rowCount === 0) return res.status(404).json({ success: false, error: 'Prompt not found' })
    res.json({ success: true })
  } catch (e) {
    console.error('Error skipping training prompt:', e)
    res.status(500).json({ success: false, error: 'Failed to skip prompt' })
  }
})

router.post('/requests/:id/submit', requireAuth, async (req, res) => {
  const userId = req.user.userId
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const reqRow = await client.query(
      `SELECT id, company_id, company_token, template_id, template_title, time_entry_id
         FROM training_evidence_requests
        WHERE id = $1 AND user_id = $2 AND status = 'pending'
        FOR UPDATE`,
      [req.params.id, userId]
    )
    if (reqRow.rowCount === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, error: 'Prompt not found or already resolved' })
    }
    const request = reqRow.rows[0]

    const photosInput = Array.isArray(req.body?.photos) ? req.body.photos.slice(0, MAX_PHOTOS) : []
    const decodedPhotos = []
    for (const p of photosInput) {
      const { error, buffer, mime } = decodeImagePayload(p || {}, { maxBytes: MAX_PHOTO_BYTES })
      if (error) {
        await client.query('ROLLBACK')
        return badRequest(res, error)
      }
      decodedPhotos.push({ buffer, mime })
    }

    // Enforce the template's photo minimum, but only when the template still
    // exists — a deleted template must not trap someone mid-submission.
    if (request.template_id) {
      const tpl = await client.query(
        'SELECT requires_photo, min_photos FROM training_evidence_templates WHERE id = $1',
        [request.template_id]
      )
      const minPhotos = tpl.rows[0]?.requires_photo ? Number(tpl.rows[0].min_photos) : 0
      if (decodedPhotos.length < minPhotos) {
        await client.query('ROLLBACK')
        return badRequest(res, `At least ${minPhotos} photo(s) required`)
      }
    }

    // Freeze the checkpoint wording alongside the answers: editing a template
    // later must not rewrite what someone was actually asked.
    const answers = new Map(
      (Array.isArray(req.body?.checkpoints) ? req.body.checkpoints : [])
        .map(c => [String(c?.checkpoint_id), c?.checked === true])
    )
    const checkpoints = request.template_id ? await getCheckpoints(request.template_id) : []
    const checkpointResults = checkpoints.map(c => ({
      checkpoint_id: c.id,
      label: c.label,
      hint: c.hint,
      checked: answers.get(String(c.id)) === true
    }))

    const sub = await client.query(
      `INSERT INTO training_evidence_submissions
         (request_id, company_id, company_token, user_id, template_id, template_title,
          time_entry_id, note, checkpoint_results)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING id`,
      [request.id, request.company_id, request.company_token, userId, request.template_id,
       request.template_title, request.time_entry_id,
       req.body?.note ? String(req.body.note).slice(0, 2000) : null,
       JSON.stringify(checkpointResults)]
    )
    const submissionId = sub.rows[0].id

    for (let i = 0; i < decodedPhotos.length; i++) {
      const photo = decodedPhotos[i]
      await client.query(
        `INSERT INTO training_evidence_photos(submission_id, image, mime, byte_size, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [submissionId, photo.buffer, photo.mime, photo.buffer.length, i]
      )
    }

    await client.query(
      `UPDATE training_evidence_requests SET status = 'submitted', resolved_at = NOW() WHERE id = $1`,
      [request.id]
    )
    await client.query('COMMIT')

    // Notifications are best-effort; a push failure must not fail the submission.
    try {
      const acct = await pool.query(
        'SELECT account_name FROM company_accounts WHERE company_token = $1 LIMIT 1',
        [request.company_token]
      )
      await notifyReviewersNewSubmission({
        companyId: request.company_id,
        userName: req.user.userName,
        templateTitle: request.template_title,
        accountName: acct.rows[0]?.account_name || null
      })
    } catch (notifyError) {
      console.error('Training submission notification failed:', notifyError)
    }

    res.json({ success: true, data: { submission_id: submissionId } })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Error submitting training evidence:', e)
    res.status(500).json({ success: false, error: 'Failed to submit evidence' })
  } finally {
    client.release()
  }
})

// ---------------------------------------------------------------------------
// Reading submissions
// ---------------------------------------------------------------------------

const SUBMISSION_COLUMNS = `
  s.id, s.template_title, s.note, s.checkpoint_results, s.status,
  s.review_rating, s.review_comment, s.reviewed_at, s.created_at,
  s.company_token, s.user_id,
  COALESCE(
    (SELECT json_agg(json_build_object('id', p.id, 'mime', p.mime) ORDER BY p.sort_order)
       FROM training_evidence_photos p WHERE p.submission_id = s.id),
    '[]'::json
  ) AS photos`

// An employee's own training history, with whatever feedback has landed.
router.get('/me/submissions', requireAuth, async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT ${SUBMISSION_COLUMNS},
              reviewer.name AS reviewer_name
         FROM training_evidence_submissions s
         LEFT JOIN users reviewer ON reviewer.id = s.reviewed_by
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT 100`,
      [req.user.userId]
    )
    res.json({ success: true, data: q.rows })
  } catch (e) {
    console.error('Error loading own training submissions:', e)
    res.status(500).json({ success: false, error: 'Failed to load submissions' })
  }
})

// Review queue / history for managers and admins.
router.get('/submissions', requireAuth, requireReviewer, async (req, res) => {
  try {
    const { companyId, isSuper } = resolveScope(req)
    if (!companyId && !isSuper) return badRequest(res, 'No company assigned to this user')

    const params = []
    const where = []
    if (companyId) {
      params.push(companyId)
      where.push(`s.company_id = $${params.length}`)
    }
    const status = req.query.status
    if (status === 'pending_review' || status === 'reviewed') {
      params.push(status)
      where.push(`s.status = $${params.length}`)
    }
    if (req.query.user_id) {
      params.push(req.query.user_id)
      where.push(`s.user_id = $${params.length}`)
    }

    const q = await pool.query(
      `SELECT ${SUBMISSION_COLUMNS},
              u.name AS user_name, u.job_type,
              reviewer.name AS reviewer_name,
              (SELECT a.account_name FROM company_accounts a
                WHERE a.company_token = s.company_token LIMIT 1) AS account_name
         FROM training_evidence_submissions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN users reviewer ON reviewer.id = s.reviewed_by
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY s.status = 'pending_review' DESC, s.created_at DESC
        LIMIT 200`,
      params
    )
    res.json({ success: true, data: q.rows })
  } catch (e) {
    console.error('Error loading training submissions:', e)
    res.status(500).json({ success: false, error: 'Failed to load submissions' })
  }
})

// Photo bytes. Readable by the author and by reviewers of the same company.
router.get('/photos/:photoId', requireAuth, async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT p.image, p.mime, s.user_id, s.company_id
         FROM training_evidence_photos p
         JOIN training_evidence_submissions s ON s.id = p.submission_id
        WHERE p.id = $1`,
      [req.params.photoId]
    )
    if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'Photo not found' })

    const row = q.rows[0]
    const isOwner = row.user_id === req.user.userId
    const isSuper = req.user.role === 'super-admin'
    const canReview = REVIEWER_ROLES.includes(req.user.role) &&
      (isSuper || (req.user.companyId && req.user.companyId === row.company_id))
    if (!isOwner && !canReview) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    res.setHeader('Content-Type', row.mime)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    return res.send(row.image)
  } catch (e) {
    console.error('Error streaming training photo:', e)
    res.status(500).json({ success: false, error: 'Failed to load photo' })
  }
})

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

router.post('/submissions/:id/review', requireAuth, requireReviewer, async (req, res) => {
  try {
    const rating = String(req.body?.rating || '').toLowerCase()
    if (!['good', 'needs_improvement'].includes(rating)) {
      return badRequest(res, 'rating must be good or needs_improvement')
    }
    const comment = req.body?.comment ? String(req.body.comment).trim().slice(0, 2000) : ''
    // Coaching is the whole point of the module: "needs improvement" without
    // saying what to improve gives the employee nothing to act on.
    if (rating === 'needs_improvement' && !comment) {
      return badRequest(res, 'A comment is required when asking for improvement')
    }

    const scope = scopeFilter(req, res)
    if (scope === undefined) return

    const upd = await pool.query(
      `UPDATE training_evidence_submissions
          SET status = 'reviewed', review_rating = $2, review_comment = $3,
              reviewed_by = $4, reviewed_at = NOW()
        WHERE id = $1 AND ($5::uuid IS NULL OR company_id = $5)
        RETURNING user_id, template_title`,
      [req.params.id, rating, comment || null, req.user.userId, scope]
    )
    if (upd.rowCount === 0) return res.status(404).json({ success: false, error: 'Submission not found' })

    try {
      await notifyUserEvidenceReviewed({
        userId: upd.rows[0].user_id,
        templateTitle: upd.rows[0].template_title,
        rating
      })
    } catch (notifyError) {
      console.error('Training review notification failed:', notifyError)
    }

    res.json({ success: true })
  } catch (e) {
    console.error('Error reviewing training submission:', e)
    res.status(500).json({ success: false, error: 'Failed to save review' })
  }
})

export default router
