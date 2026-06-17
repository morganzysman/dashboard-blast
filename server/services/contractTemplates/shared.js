// Shared helpers for contract PDF templates.
//
// Pure, side-effect-free formatting + pdfmake building blocks reused by every
// country/contract-type builder. Keeping the legal text in per-country modules
// and the plumbing here makes each template easy to audit in isolation.

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const PORTUGUESE_MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** Format a number as "S/ 1,664.00" style money. */
export function formatMoney(amount, symbol = 'S/') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${symbol} 0.00`
  const fixed = n.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${symbol} ${withThousands}.${decPart}`
}

function parseIsoDateParts(iso) {
  if (typeof iso !== 'string') return null
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

/**
 * Format an ISO date (YYYY-MM-DD) as a Spanish long date: "1 de julio de 2026".
 * Parses date parts directly (no Date()) to avoid timezone off-by-one.
 */
export function formatSpanishDate(iso) {
  const p = parseIsoDateParts(iso)
  if (!p) return typeof iso === 'string' ? iso : ''
  return `${p.day} de ${SPANISH_MONTHS[p.month - 1]} de ${p.year}`
}

/** Format an ISO date as a Portuguese long date: "1 de julho de 2026". */
export function formatPortugueseDate(iso) {
  const p = parseIsoDateParts(iso)
  if (!p) return typeof iso === 'string' ? iso : ''
  return `${p.day} de ${PORTUGUESE_MONTHS[p.month - 1]} de ${p.year}`
}

export function formatLongDate(iso, lang = 'es') {
  return lang === 'pt' ? formatPortugueseDate(iso) : formatSpanishDate(iso)
}

export const isBlank = (v) => v == null || String(v).trim() === ''

/**
 * Resolve the monthly reference amount for service contracts: explicit override
 * if provided and positive, otherwise hourly_rate × country.referenceHours.
 */
export function resolveMonthlyReference({ hourly_rate, monthly_reference }, config) {
  const explicit = Number(monthly_reference)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  return Number(hourly_rate) * config.referenceHours
}

/**
 * Numbered/sectioned clause helper for consistent styling.
 * `body` may be a string, an array of strings, inline-text arrays, or
 * `{ ul: [...] }` bullet lists.
 */
export function clause(title, body) {
  const content = [{ text: title, style: 'clauseTitle' }]
  const paragraphs = Array.isArray(body) ? body : [body]
  for (const p of paragraphs) {
    if (p && typeof p === 'object' && p.ul) {
      content.push({ ul: p.ul, style: 'para', margin: [10, 2, 0, 4] })
    } else {
      content.push({ text: p, style: 'para' })
    }
  }
  return content
}

/** Two-column signature block. Each side: { heading, lines[] }. */
export function signatureBlock(left, right, signLabel = 'Firma') {
  const side = (s) => ({
    width: '*',
    stack: [
      { text: s.heading, bold: true },
      ...s.lines.filter(Boolean).map((text) => ({ text })),
      { text: `\n${signLabel}: ______________________________`, margin: [0, 16, 0, 0] },
    ],
  })
  return {
    style: 'signatures',
    margin: [0, 48, 0, 0],
    columns: [side(left), side(right)],
  }
}

export const DEFAULT_STYLES = {
  docTitle: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 16] },
  clauseTitle: { fontSize: 11, bold: true, margin: [0, 10, 0, 4] },
  para: { fontSize: 10, alignment: 'justify', lineHeight: 1.25, margin: [0, 0, 0, 4] },
  signatures: { fontSize: 10 },
  footer: { fontSize: 8, color: '#888888' },
}

/**
 * Assemble a full pdfmake document definition with the standard page setup,
 * footer (page n / total) and styles, given a content array.
 */
export function buildDoc({ title, author, content }) {
  return {
    pageSize: 'A4',
    pageMargins: [56, 56, 56, 64],
    info: { title, author },
    footer: (currentPage, pageCount) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: 'center',
      style: 'footer',
    }),
    content,
    styles: DEFAULT_STYLES,
  }
}
