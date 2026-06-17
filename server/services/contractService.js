// Contract generation service (orchestrator).
//
// Pure, side-effect-free logic (validation + template dispatch). The HTTP layer
// (routes/admin.js) handles auth, data loading and streaming. Keeping this layer
// pure makes the field mapping the easy place to audit — and the safe place to
// add country templates.
//
//   validateContractData ──► { ok, missing[] }   (blocks blank placeholders)
//   buildContractDefinition ──► pdfmake docDefinition (dispatch by template)
//
// A country may expose SEVERAL contract types (see contractCountries.js). The
// caller passes `contractType` (an id); when omitted we fall back to the first
// available type for the country. Per-type required parameters come from the
// contract type's `paramFields`, so validation and the UI form stay in sync.
//
// Adding a template:
//   1. Register the contract type in contractCountries.js (available:true).
//   2. Add a `case '<template>':` below pointing at a builder.

import { getCountryConfig, getContractType } from '../config/contractCountries.js'
import { formatMoney, formatSpanishDate, formatPortugueseDate, isBlank, resolveMonthlyReference } from './contractTemplates/shared.js'
import { buildPeruLocacion, buildPeruPlanilla } from './contractTemplates/peru.js'
import { buildColombiaPrestacion, buildColombiaLaboral } from './contractTemplates/colombia.js'
import { buildChileHonorarios, buildChileTrabajo } from './contractTemplates/chile.js'
import { buildArgentinaLocacion, buildArgentinaTrabajo } from './contractTemplates/argentina.js'
import { buildBrazilPrestacao, buildBrazilClt } from './contractTemplates/brazil.js'

// Re-export formatting helpers (kept as stable import points for callers/tests).
export { formatMoney, formatSpanishDate, formatPortugueseDate, resolveMonthlyReference }

const ISO = /^\d{4}-\d{2}-\d{2}$/

// ---- validation -----------------------------------------------------------

/**
 * Validate that all data required to render a contract is present, so we never
 * emit a document with blank placeholders. Required generation params are
 * derived from the resolved contract type's `paramFields`.
 *
 * @returns {{ ok: boolean, missing: string[], reason?: string }}
 *   `missing` items are stable keys ("employer.tax_id", "employee.address",
 *   "params.start_date", ...) the UI can map to localized labels.
 */
export function validateContractData({ country, contractType, employer = {}, employee = {}, params = {} }) {
  const config = getCountryConfig(country)
  if (!config) {
    return { ok: false, missing: [], reason: 'unknown_country' }
  }
  const type = getContractType(country, contractType)
  if (!type) {
    return { ok: false, missing: [], reason: 'unknown_contract_type' }
  }
  if (!type.available) {
    return { ok: false, missing: [], reason: 'template_unavailable' }
  }

  const missing = []

  for (const field of config.employerFields) {
    if (field.required && isBlank(employer[field.key])) {
      missing.push(`employer.${field.key}`)
    }
  }

  if (isBlank(employee.name)) missing.push('employee.name')
  if (isBlank(employee.document_type)) missing.push('employee.document_type')
  if (isBlank(employee.document_number)) missing.push('employee.document_number')
  if (isBlank(employee.address)) missing.push('employee.address')

  for (const field of type.paramFields) {
    if (!field.required) continue
    if (field.type === 'number') {
      const n = Number(params[field.key])
      if (!Number.isFinite(n) || n <= 0) missing.push(`params.${field.key}`)
    } else if (isBlank(params[field.key])) {
      missing.push(`params.${field.key}`)
    }
  }

  // Date sanity: only when both dates are present and well-formed.
  const start = String(params.start_date || '').slice(0, 10)
  const end = String(params.end_date || '').slice(0, 10)
  if (ISO.test(start) && ISO.test(end) && end < start) {
    return { ok: false, missing, reason: 'end_before_start' }
  }

  return { ok: missing.length === 0, missing }
}

// ---- dispatch -------------------------------------------------------------

const BUILDERS = {
  pe_locacion_v1: buildPeruLocacion,
  pe_planilla_v1: buildPeruPlanilla,
  co_prestacion_v1: buildColombiaPrestacion,
  co_laboral_v1: buildColombiaLaboral,
  cl_honorarios_v1: buildChileHonorarios,
  cl_trabajo_v1: buildChileTrabajo,
  ar_locacion_v1: buildArgentinaLocacion,
  ar_trabajo_v1: buildArgentinaTrabajo,
  br_prestacao_v1: buildBrazilPrestacao,
  br_clt_v1: buildBrazilClt,
}

/**
 * Build the pdfmake document definition for a contract.
 * @throws if the country/contract type/template is not renderable (callers
 *   should call validateContractData first).
 */
export function buildContractDefinition({ country, contractType, employer, employee, params }) {
  const config = getCountryConfig(country)
  if (!config) throw new Error(`Unknown country: ${country}`)
  const type = getContractType(country, contractType)
  if (!type || !type.available) {
    throw new Error(`No contract template available for ${country}/${contractType || '(default)'}`)
  }
  const builder = BUILDERS[type.template]
  if (!builder) throw new Error(`No builder for template: ${type.template}`)
  return builder({ config, employer, employee, params })
}

// ---- signing --------------------------------------------------------------

const SIGN_LABELS = {
  es: {
    title: 'Firmas y constancia de aceptación',
    intro: 'Las partes firmaron electrónicamente este documento. A continuación se deja constancia de cada firma y sus datos de auditoría.',
    employer: 'El Empleador',
    worker: 'El Trabajador',
    signedAt: 'Firmado el',
    document: 'Documento',
    ip: 'IP',
    hash: 'Huella del documento (SHA-256)',
  },
  pt: {
    title: 'Assinaturas e comprovante de aceitação',
    intro: 'As partes assinaram este documento eletronicamente. Abaixo consta cada assinatura e seus dados de auditoria.',
    employer: 'O Empregador',
    worker: 'O Trabalhador',
    signedAt: 'Assinado em',
    document: 'Documento',
    ip: 'IP',
    hash: 'Impressão do documento (SHA-256)',
  },
}

function formatSignedAt(value, lang) {
  try {
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return String(value || '')
    const locale = lang === 'pt' ? 'pt-BR' : 'es-PE'
    return d.toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' })
  } catch {
    return String(value || '')
  }
}

/**
 * Build the fully-signed contract document: the base contract followed by a
 * dedicated signatures + audit page embedding each party's signature image and
 * audit metadata (signer, doc id, timestamp, IP, SHA-256 of what they signed).
 *
 * @param {object} args same as buildContractDefinition, plus:
 * @param {Array<{role:'employer'|'worker', name?:string, documentLabel?:string,
 *   signedAt?:string|Date, ip?:string, docHash?:string, imageDataUrl:string}>} args.signatures
 */
export function buildSignedContractDefinition({ country, contractType, employer, employee, params, signatures = [] }) {
  const config = getCountryConfig(country)
  const lang = config?.lang === 'pt' ? 'pt' : 'es'
  const L = SIGN_LABELS[lang]
  const def = buildContractDefinition({ country, contractType, employer, employee, params })
  const content = Array.isArray(def.content) ? [...def.content] : [def.content]

  content.push({ text: L.title, style: 'docTitle', pageBreak: 'before' })
  content.push({ text: L.intro, style: 'para', margin: [0, 0, 0, 16] })

  const order = { employer: 0, worker: 1 }
  const sorted = [...signatures].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))
  for (const s of sorted) {
    const roleLabel = s.role === 'worker' ? L.worker : L.employer
    const block = { stack: [], margin: [0, 0, 0, 24] }
    block.stack.push({ text: roleLabel, bold: true, fontSize: 11, margin: [0, 0, 0, 6] })
    if (s.imageDataUrl) {
      block.stack.push({ image: s.imageDataUrl, fit: [200, 90], margin: [0, 0, 0, 4] })
    }
    if (s.name) block.stack.push({ text: s.name, fontSize: 10 })
    if (s.documentLabel) block.stack.push({ text: `${L.document}: ${s.documentLabel}`, style: 'footer' })
    if (s.signedAt) block.stack.push({ text: `${L.signedAt}: ${formatSignedAt(s.signedAt, lang)}`, style: 'footer' })
    if (s.ip) block.stack.push({ text: `${L.ip}: ${s.ip}`, style: 'footer' })
    if (s.docHash) block.stack.push({ text: `${L.hash}: ${s.docHash}`, style: 'footer' })
    content.push(block)
  }

  return { ...def, content }
}
