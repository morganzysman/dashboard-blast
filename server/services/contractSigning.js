// Contract signing + status helpers shared by the admin and worker (profile)
// routes. Keeps status derivation, signature validation, and the "both parties
// signed -> render immutable signed PDF" logic in one auditable place.

import { createHash } from 'crypto'
import { pool } from '../database.js'
import { buildSignedContractDefinition } from './contractService.js'
import { createPdfBuffer } from './pdfPrinter.js'

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024 // 2MB decoded

/** SHA-256 hex of a Buffer. */
export function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Decode a signature image payload (PNG only, as produced by the signature pad).
 * Accepts a data URL or raw base64.
 * @returns {{ buffer?: Buffer, error?: string }}
 */
export function decodeSignaturePng(input) {
  if (!input || typeof input !== 'string') return { error: 'signature image is required' }
  let b64 = input
  const m = input.match(/^data:image\/png;base64,(.*)$/s)
  if (m) b64 = m[1]
  else if (/^data:/.test(input)) return { error: 'signature must be a PNG image' }
  let buffer
  try {
    buffer = Buffer.from(b64, 'base64')
  } catch {
    return { error: 'invalid signature image data' }
  }
  if (!buffer.length) return { error: 'empty signature image' }
  if (buffer.length > MAX_SIGNATURE_BYTES) return { error: 'signature image too large' }
  // PNG magic number sanity check.
  if (buffer.length < 8 || buffer[0] !== 0x89 || buffer[1] !== 0x50) {
    return { error: 'signature must be a PNG image' }
  }
  return { buffer }
}

function isPastDate(dateValue) {
  if (!dateValue) return false
  const end = new Date(dateValue)
  if (Number.isNaN(end.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // end_date is inclusive; expired only once we're strictly past it.
  return end < today
}

/**
 * Read-time status for a single contract row. Stored status is the source of
 * truth for pending/active/cancelled; expiry is time-derived so we never need a
 * cron to flip active -> expired.
 * @returns {'pending'|'active'|'expired'|'cancelled'}
 */
export function contractStatusFor(contract) {
  if (!contract) return 'none'
  if (contract.status === 'cancelled') return 'cancelled'
  if (contract.status === 'pending') return 'pending'
  if (contract.status === 'active') {
    return isPastDate(contract.end_date) ? 'expired' : 'active'
  }
  return contract.status || 'pending'
}

/**
 * The employee's overall contract status for badges, picking the "best" of
 * their contracts. Priority: active > pending > expired > (none).
 * @param {Array} contracts rows with { status, end_date }
 * @returns {'none'|'pending'|'active'|'expired'}
 */
export function employeeContractStatus(contracts) {
  if (!Array.isArray(contracts) || contracts.length === 0) return 'none'
  const statuses = contracts.map(contractStatusFor)
  if (statuses.includes('active')) return 'active'
  if (statuses.includes('pending')) return 'pending'
  if (statuses.includes('expired')) return 'expired'
  return 'none'
}

/**
 * If both parties (employer + worker) have signed, render the immutable signed
 * PDF (base contract + signatures/audit page) and flip the contract to active.
 * Idempotent: if already complete or not yet complete, it's a safe no-op.
 *
 * @returns {Promise<{ status: string, completed: boolean }>}
 */
export async function renderSignedContractIfComplete(contractId) {
  const cq = await pool.query(`SELECT * FROM contracts WHERE id = $1`, [contractId])
  if (cq.rowCount === 0) return { status: 'none', completed: false }
  const contract = cq.rows[0]

  const sq = await pool.query(
    `SELECT signer_role, signer_name, signature_png, signed_at, ip, doc_sha256_at_signing
     FROM contract_signatures WHERE contract_id = $1`,
    [contractId]
  )
  const byRole = new Map(sq.rows.map((r) => [r.signer_role, r]))
  if (!byRole.has('employer') || !byRole.has('worker')) {
    return { status: contractStatusFor(contract), completed: false }
  }

  const employer = contract.employer_snapshot || {}
  const employee = contract.employee_snapshot || {}
  const docLabel = (type, number) => [type, number].filter(Boolean).join(' ')

  const signatures = ['employer', 'worker'].map((role) => {
    const row = byRole.get(role)
    const documentLabel = role === 'worker'
      ? docLabel(employee.document_type, employee.document_number)
      : docLabel(employer.rep_doc_type, employer.rep_doc_number)
    return {
      role,
      name: row.signer_name || (role === 'worker' ? employee.name : employer.rep_name),
      documentLabel,
      signedAt: row.signed_at,
      ip: row.ip,
      docHash: row.doc_sha256_at_signing,
      imageDataUrl: `data:image/png;base64,${Buffer.from(row.signature_png).toString('base64')}`,
    }
  })

  const def = buildSignedContractDefinition({
    country: contract.country,
    contractType: contract.contract_type,
    employer,
    employee,
    params: contract.params || {},
    signatures,
  })
  const pdf = await createPdfBuffer(def)
  const hash = sha256Hex(pdf)

  await pool.query(
    `UPDATE contracts SET signed_pdf = $2, signed_pdf_sha256 = $3, status = 'active', updated_at = NOW()
     WHERE id = $1`,
    [contractId, pdf, hash]
  )
  return { status: 'active', completed: true }
}
