// Self-service profile endpoints for the logged-in user.
//
// Lets an employee view and complete their own contract identity data
// (document type/number + address) without admin involvement. Kept in its own
// router (mounted at /api/profile) so it stays decoupled from auth/session code.

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../database.js'
import { getCountryConfig, getContractType, DEFAULT_COUNTRY } from '../config/contractCountries.js'
import {
  contractStatusFor,
  isExpiringSoon,
  decodeSignaturePng,
  renderSignedContractIfComplete,
  renderContractCurrentPdf,
} from '../services/contractSigning.js'

const router = Router()

// Resolve the country that applies to this user for doc-type options. Uses the
// first account of the user's company; falls back to the default country.
async function resolveUserCountry(companyId) {
  if (!companyId) return DEFAULT_COUNTRY
  const q = await pool.query(
    `SELECT country FROM company_accounts WHERE company_id = $1 AND country IS NOT NULL ORDER BY account_name LIMIT 1`,
    [companyId]
  )
  return (q.rows[0]?.country || DEFAULT_COUNTRY).toUpperCase()
}

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4MB decoded

// Parse a data URL or raw base64 + mime into a validated Buffer.
function decodeImagePayload({ image_base64, mime }) {
  if (!image_base64 || typeof image_base64 !== 'string') {
    return { error: 'image_base64 is required' }
  }
  let resolvedMime = mime
  let b64 = image_base64
  const dataUrlMatch = image_base64.match(/^data:([^;]+);base64,(.*)$/s)
  if (dataUrlMatch) {
    resolvedMime = resolvedMime || dataUrlMatch[1]
    b64 = dataUrlMatch[2]
  }
  resolvedMime = (resolvedMime || '').toLowerCase()
  if (!ALLOWED_IMAGE_MIME.has(resolvedMime)) {
    return { error: 'Unsupported image type (use JPEG, PNG or WebP)' }
  }
  let buf
  try {
    buf = Buffer.from(b64, 'base64')
  } catch {
    return { error: 'Invalid base64 image data' }
  }
  if (!buf.length) return { error: 'Empty image' }
  if (buf.length > MAX_IMAGE_BYTES) return { error: 'Image too large (max 4MB)' }
  return { buffer: buf, mime: resolvedMime }
}

// GET own contract identity data + the doc-type options for the resolved country.
router.get('/contract-info', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId
    const q = await pool.query(
      `SELECT document_type, document_number, address, company_id,
              (id_document_image IS NOT NULL) AS has_id_document
       FROM users WHERE id = $1`,
      [userId]
    )
    if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
    const row = q.rows[0]
    const country = await resolveUserCountry(row.company_id)
    const config = getCountryConfig(country)

    const complete = !!(row.document_type && row.document_number && row.address && row.has_id_document)
    res.json({
      success: true,
      data: {
        document_type: row.document_type || '',
        document_number: row.document_number || '',
        address: row.address || '',
        has_id_document: row.has_id_document,
        country,
        employeeDocTypes: config?.employeeDocTypes || ['DNI', 'CE', 'Pasaporte'],
        complete,
      },
    })
  } catch (e) {
    console.error('Error fetching own contract info:', e)
    res.status(500).json({ success: false, error: 'Failed to fetch contract info' })
  }
})

// Upload/replace own ID document image.
router.post('/id-document', requireAuth, async (req, res) => {
  try {
    const { error, buffer, mime } = decodeImagePayload(req.body || {})
    if (error) return res.status(400).json({ success: false, error })
    await pool.query(
      `UPDATE users SET id_document_image = $2, id_document_mime = $3, updated_at = NOW() WHERE id = $1`,
      [req.user.userId, buffer, mime]
    )
    res.json({ success: true, data: { has_id_document: true } })
  } catch (e) {
    console.error('Error uploading ID document:', e)
    res.status(500).json({ success: false, error: 'Failed to upload ID document' })
  }
})

// Stream own ID document image.
router.get('/id-document', requireAuth, async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT id_document_image, id_document_mime FROM users WHERE id = $1`,
      [req.user.userId]
    )
    const row = q.rows[0]
    if (!row || !row.id_document_image) {
      return res.status(404).json({ success: false, error: 'No ID document on file' })
    }
    res.setHeader('Content-Type', row.id_document_mime || 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(row.id_document_image)
  } catch (e) {
    console.error('Error fetching ID document:', e)
    res.status(500).json({ success: false, error: 'Failed to fetch ID document' })
  }
})

// Update own contract identity data.
router.put('/contract-info', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId
    const { document_type, document_number, address } = req.body || {}

    const norm = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim())
    const dt = norm(document_type)
    const dn = norm(document_number)
    const addr = norm(address)

    if (!dt || !dn || !addr) {
      return res.status(400).json({ success: false, error: 'document_type, document_number and address are required' })
    }

    const upd = await pool.query(
      `UPDATE users SET document_type = $2, document_number = $3, address = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING document_type, document_number, address`,
      [userId, dt, dn, addr]
    )
    res.json({ success: true, data: { ...upd.rows[0], complete: true } })
  } catch (e) {
    console.error('Error updating own contract info:', e)
    res.status(500).json({ success: false, error: 'Failed to update contract info' })
  }
})

// ====== OWN CONTRACTS + SIGNING (worker self-service) ======

// List own contracts (no PDF bytes). `awaiting_signature` flags contracts the
// worker still needs to sign (drives the login sign prompt).
router.get('/contracts', requireAuth, async (req, res) => {
  try {
    const cq = await pool.query(
      `SELECT c.id, c.company_token, c.country, c.contract_type, c.params,
              c.start_date, c.end_date, c.status, c.created_at,
              (c.signed_pdf IS NOT NULL) AS has_signed_pdf,
              COALESCE(json_agg(s.signer_role) FILTER (WHERE s.id IS NOT NULL), '[]') AS signer_roles
       FROM contracts c
       LEFT JOIN contract_signatures s ON s.contract_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [req.user.userId]
    )
    const data = cq.rows
      .map((r) => {
        const roles = r.signer_roles || []
        const status = contractStatusFor(r, roles)
        const type = getContractType(r.country, r.contract_type)
        return {
          id: r.id,
          company_token: r.company_token,
          country: r.country,
          contract_type: r.contract_type,
          // i18n suffix under `contract.types.` so the worker UI can localize
          // the contract type without the admin-only contract-config endpoint.
          type_label_key: type?.labelKey || null,
          params: r.params,
          start_date: r.start_date,
          end_date: r.end_date,
          status,
          has_signed_pdf: r.has_signed_pdf,
          worker_signed: roles.includes('worker'),
          employer_signed: roles.includes('employer'),
          expiring_soon: status === 'active' && isExpiringSoon(r.end_date),
          // Worker action needed only once the employer has signed (sequential
          // signing) and the worker hasn't signed yet.
          awaiting_signature: status === 'awaiting_worker',
        }
      })
      // Hide contracts still awaiting the employer's signature — they only
      // become visible to the worker after the employer signs.
      .filter((c) => c.status !== 'awaiting_employer')
    res.json({ success: true, data, awaitingCount: data.filter((c) => c.awaiting_signature).length })
  } catch (e) {
    console.error('Error listing own contracts:', e)
    res.status(500).json({ success: false, error: 'Failed to list contracts' })
  }
})

// Stream own contract PDF (signed when available, else unsigned draft).
router.get('/contracts/:id/pdf', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const which = req.query.which === 'unsigned' ? 'unsigned' : 'signed'
    const q = await pool.query(
      `SELECT user_id, unsigned_pdf, signed_pdf FROM contracts WHERE id = $1`,
      [id]
    )
    if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'Contract not found' })
    const row = q.rows[0]
    if (row.user_id !== req.user.userId) return res.status(403).json({ success: false, error: 'Forbidden' })
    // which=unsigned -> blank draft; otherwise signed PDF when complete, else the
    // current signing state so the worker sees the employer's signature.
    let buf
    if (which === 'unsigned') buf = row.unsigned_pdf
    else buf = row.signed_pdf || await renderContractCurrentPdf(id)
    if (!buf) return res.status(404).json({ success: false, error: 'No PDF available' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="contrato-${id}.pdf"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(Buffer.from(buf))
  } catch (e) {
    console.error('Error streaming own contract pdf:', e)
    res.status(500).json({ success: false, error: 'Failed to load contract PDF' })
  }
})

// Worker signs own contract.
router.post('/contracts/:id/sign', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { signature_png } = req.body || {}
    const { buffer, error } = decodeSignaturePng(signature_png)
    if (error) return res.status(400).json({ success: false, error })

    const q = await pool.query(
      `SELECT user_id, status, unsigned_pdf_sha256, employee_snapshot FROM contracts WHERE id = $1`,
      [id]
    )
    if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'Contract not found' })
    const c = q.rows[0]
    if (c.user_id !== req.user.userId) return res.status(403).json({ success: false, error: 'Forbidden' })
    if (c.status === 'cancelled') return res.status(400).json({ success: false, error: 'Contract is cancelled' })

    // Sequential signing: the worker may only sign after the employer has.
    const empSig = await pool.query(
      `SELECT 1 FROM contract_signatures WHERE contract_id = $1 AND signer_role = 'employer' LIMIT 1`,
      [id]
    )
    if (empSig.rowCount === 0) {
      return res.status(409).json({ success: false, error: 'awaiting_employer' })
    }

    const name = c.employee_snapshot?.name || req.user.userName || null
    await pool.query(
      `INSERT INTO contract_signatures
         (contract_id, signer_role, signer_user_id, signer_name, signature_png, ip, user_agent, doc_sha256_at_signing)
       VALUES ($1, 'worker', $2, $3, $4, $5, $6, $7)
       ON CONFLICT (contract_id, signer_role) DO UPDATE SET
         signer_user_id = EXCLUDED.signer_user_id, signer_name = EXCLUDED.signer_name,
         signature_png = EXCLUDED.signature_png, signed_at = NOW(),
         ip = EXCLUDED.ip, user_agent = EXCLUDED.user_agent,
         doc_sha256_at_signing = EXCLUDED.doc_sha256_at_signing`,
      [id, req.user.userId, name, buffer, req.ip, req.get('user-agent') || null, c.unsigned_pdf_sha256]
    )
    const result = await renderSignedContractIfComplete(id)
    res.json({ success: true, data: { status: result.status, fully_signed: result.completed } })
  } catch (e) {
    console.error('Error signing own contract:', e)
    res.status(500).json({ success: false, error: 'Failed to sign contract' })
  }
})

export default router
