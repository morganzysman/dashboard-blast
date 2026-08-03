// Manual sales import for webhook-less delivery platforms (Rappi).
//
// WHY THIS EXISTS
// Most shops stream orders into the ledger from the OlaClick Public API (cron +
// webhooks). A few shops sell only through Rappi, whose provider exposes no
// webhook or API to us, so those accounts have no public_api_key and their
// order_facts / daily_gains rows sit empty. Their revenue is only available as a
// CSV order export ("Historique des commandes") downloaded from the Rappi
// dashboard every few days.
//
// WHAT IT WRITES
// The export is per-order, but we deliberately do NOT create one ledger row per
// Rappi order: the export carries no product names, so per-order rows would
// fabricate order-level analytics (burgers per order, service mix) we can't
// actually support. Instead each (account, local day) in the file collapses into
// ONE synthetic order whose id is `manual-rappi-<YYYY-MM-DD>`:
//
//   order_facts          1 row  — order_total = summed net payment for the day
//   order_payment_facts  1 row  — method 'rappi_pay', bill_amount = same total
//
// Product-unit columns (combo_units / burger_units) are left NULL on purpose.
// The burger analytics filter on `burger_units IS NOT NULL`, so imported days
// are excluded there rather than dragging burgers-per-order averages toward zero
// with invented data.
//
// IDEMPOTENCE
// The synthetic id is derived from the day, so re-uploading an overlapping
// export replaces that day's total instead of adding to it. Uploads may overlap
// freely and arrive on no fixed schedule. Days absent from the file are never
// touched, which keeps partial exports safe.
//
// SAFETY RAILS
//   • Accounts that have a public_api_key are refused — their Rappi orders
//     already arrive through the API, so importing would double-count.
//   • Rows whose Statut is cancelled are excluded from the day total, matching
//     how every dashboard read filters status <> 'CANCELLED'.
//   • Unrecognised restaurant names abort the import instead of silently
//     dropping revenue.

import { pool } from '../database.js'
import { computeAndStoreDailyGain } from './dailyGainService.js'

// Synthetic order id prefix. Also how `is_manual` rows are recognised by eye in
// the DB. Changing this orphans previously imported days.
const MANUAL_ORDER_PREFIX = 'manual-rappi-'

// Every imported day is booked against this payment method so the 32% Rappi
// commission configured in payment_method_costs applies. Must stay lowercase to
// match payment_method_costs.payment_method_code lookups.
const PAYMENT_METHOD = 'rappi_pay'

const ORDER_SOURCE = 'RAPPI'
const ORDER_STATUS = 'FINALIZED'
const SERVICE_TYPE = 'DELIVERY'

// Rappi localises its export headers. Each field is resolved by header name
// first (any locale below), falling back to the fixed column position the
// current export uses — index 17 is spreadsheet column R, "Paiement net".
const COLUMN_SPECS = {
  orderedAt: { aliases: ['fulfilled', 'date', 'fecha', 'data'], index: 0 },
  orderNumber: {
    aliases: ['n de commande', 'ndecommande', 'order id', 'orderid', 'n de pedido', 'numero de pedido', 'id du pedido'],
    index: 1
  },
  status: { aliases: ['statut', 'estado', 'status'], index: 5 },
  restaurant: { aliases: ['restaurant', 'restaurante', 'tienda', 'store', 'loja'], index: 8 },
  netAmount: {
    aliases: ['paiement net', 'pago neto', 'net payment', 'pagamento liquido', 'pago net'],
    index: 17
  }
}

// Cancelled markers across the locales Rappi exports in, compared after accents
// are stripped ("Annulée" -> "annulee").
const CANCELLED_STATUSES = new Set([
  'annulee', 'annule', 'cancelada', 'cancelado', 'cancelled', 'canceled', 'cancelacion'
])

/** Strip diacritics and lowercase, so "Annulée" and "annulee" compare equal. */
function deaccent(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Collapse to bare alphanumerics for fuzzy name matching: "La Molina" -> "lamolina". */
function compact(value) {
  return deaccent(value).replace(/[^a-z0-9]/g, '')
}

/**
 * Split a CSV document into rows of string cells.
 *
 * Hand-rolled rather than pulled from npm because the format we accept is
 * narrow: the Rappi export is fully quoted, comma-separated UTF-8. We still
 * handle the RFC 4180 essentials — escaped quotes (""), separators and newlines
 * inside quotes, and CRLF — plus a delimiter sniff, because a spreadsheet
 * round-trip through a European locale turns the commas into semicolons.
 */
function parseCsv(text) {
  let content = String(text || '')
  // Strip a UTF-8 BOM, which would otherwise become part of the first header.
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
  if (!content.trim()) return []

  const delimiter = sniffDelimiter(content)
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      // Treat CRLF as one terminator.
      if (char === '\r' && content[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += char
    }
  }

  row.push(field)
  rows.push(row)

  // Drop trailing blank lines (a single empty cell is an empty line, not a row).
  return rows.filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '')
}

// Pick the delimiter by counting candidates on the header line only — the body
// is full of quoted commas that would skew a whole-document count.
function sniffDelimiter(content) {
  const header = content.split(/\r?\n/, 1)[0] || ''
  const counts = [',', ';', '\t'].map((d) => [d, header.split(d).length - 1])
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ','
}

/**
 * Map each logical field to a column index using the header row, falling back to
 * the documented fixed position when the header can't be recognised.
 */
function resolveColumns(headerRow) {
  const normalized = headerRow.map((h) => deaccent(h).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim())
  const resolved = {}

  for (const [field, spec] of Object.entries(COLUMN_SPECS)) {
    let index = -1
    for (const alias of spec.aliases) {
      const wanted = deaccent(alias).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
      index = normalized.findIndex((h) => h === wanted || h.replace(/ /g, '') === wanted.replace(/ /g, ''))
      if (index !== -1) break
    }
    resolved[field] = index === -1 ? spec.index : index
  }

  return resolved
}

/**
 * Parse a Rappi money cell into a Number.
 *
 * Rappi exports dot-decimal ("98.00"), but a spreadsheet round-trip can produce
 * "1.234,56" or "1,234.56". Whichever separator appears last is the decimal
 * point; a lone comma with more than two trailing digits is a thousands group.
 */
function parseAmount(raw) {
  let text = String(raw ?? '').replace(/[^\d,.\-]/g, '').trim()
  if (!text || text === '-') return 0

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const groupSep = decimalSep === ',' ? '.' : ','
    text = text.split(groupSep).join('').replace(decimalSep, '.')
  } else if (lastComma !== -1) {
    text = text.length - lastComma - 1 <= 2 ? text.replace(',', '.') : text.split(',').join('')
  }

  const value = Number(text)
  return Number.isFinite(value) ? value : 0
}

/**
 * Parse the export's timestamp into the local business day (YYYY-MM-DD).
 *
 * Rappi writes wall-clock time in the restaurant's own timezone, so the date
 * part is already the local day and needs no timezone conversion. Accepts
 * D/M/YYYY (the current export) and ISO YYYY-MM-DD.
 */
function parseLocalDay(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null

  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  return null
}

/**
 * Resolve a Rappi "Restaurant" value to one of the company's accounts.
 *
 * Rappi prefixes the shop with its own geography, e.g. "SA-PE-Lima-La Molina".
 * We compare the whole string and each dash-separated segment against every
 * account's name and token in compacted form, so "La Molina" matches both
 * "Blast La Molina" and "blast-la-molina". Ambiguous matches are reported rather
 * than guessed.
 */
function matchAccount(restaurantName, accounts) {
  const segments = String(restaurantName || '')
    .split('-')
    .map((s) => compact(s))
    .filter((s) => s.length >= 3)
  const candidates = [compact(restaurantName), ...segments].filter(Boolean)
  if (candidates.length === 0) return { account: null, reason: 'empty' }

  const hits = accounts.filter((acc) => {
    const haystacks = [compact(acc.account_name), compact(acc.company_token)].filter(Boolean)
    return candidates.some((cand) => haystacks.some((hay) => hay.includes(cand) || cand.includes(hay)))
  })

  if (hits.length === 1) return { account: hits[0], reason: 'matched' }
  if (hits.length > 1) {
    return { account: null, reason: 'ambiguous', matches: hits.map((h) => h.company_token) }
  }
  return { account: null, reason: 'unknown' }
}

/**
 * Turn raw CSV text into per-(account, day) totals.
 *
 * Pure: touches no database beyond the `accounts` list handed in, so the
 * preview and the commit run the exact same reduction and can't disagree.
 *
 * @param {string} csvText raw file contents
 * @param {Array<{company_id:string, company_token:string, account_name:string, public_api_key:string|null}>} accounts company's accounts
 * @returns {{days: Array, warnings: Array, errors: Array, stats: object, unmatchedRestaurants: Array}}
 */
function aggregateRappiCsv(csvText, accounts) {
  const rows = parseCsv(csvText)
  const errors = []
  const warnings = []

  if (rows.length < 2) {
    errors.push('The file has no data rows.')
    return { days: [], warnings, errors, stats: emptyStats(), unmatchedRestaurants: [] }
  }

  const columns = resolveColumns(rows[0])
  const dataRows = rows.slice(1)

  // key `${company_token}|${day}` -> accumulator
  const buckets = new Map()
  // Rappi occasionally repeats a line when an export is regenerated mid-write.
  const seenOrderNumbers = new Set()
  const restaurantResolution = new Map()
  const unmatched = new Map()

  const stats = emptyStats()
  stats.rowsTotal = dataRows.length

  for (const row of dataRows) {
    const restaurantRaw = (row[columns.restaurant] ?? '').trim()
    const statusRaw = (row[columns.status] ?? '').trim()
    const orderNumber = (row[columns.orderNumber] ?? '').trim()
    const day = parseLocalDay(row[columns.orderedAt])
    const amount = parseAmount(row[columns.netAmount])

    if (!day) {
      stats.rowsSkippedInvalid += 1
      continue
    }

    if (CANCELLED_STATUSES.has(deaccent(statusRaw))) {
      stats.rowsSkippedCancelled += 1
      stats.cancelledAmount += amount
      continue
    }

    if (orderNumber) {
      if (seenOrderNumbers.has(orderNumber)) {
        stats.rowsSkippedDuplicate += 1
        continue
      }
      seenOrderNumbers.add(orderNumber)
    }

    // Resolve each distinct restaurant string once.
    if (!restaurantResolution.has(restaurantRaw)) {
      restaurantResolution.set(restaurantRaw, matchAccount(restaurantRaw, accounts))
    }
    const resolution = restaurantResolution.get(restaurantRaw)

    if (!resolution.account) {
      const entry = unmatched.get(restaurantRaw) || { restaurant: restaurantRaw, reason: resolution.reason, matches: resolution.matches || [], rows: 0, amount: 0 }
      entry.rows += 1
      entry.amount += amount
      unmatched.set(restaurantRaw, entry)
      stats.rowsSkippedUnmatched += 1
      continue
    }

    const account = resolution.account
    const key = `${account.company_token}|${day}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        companyId: account.company_id,
        companyToken: account.company_token,
        accountName: account.account_name || account.company_token,
        restaurant: restaurantRaw,
        day,
        amount: 0,
        sourceOrders: 0
      }
      buckets.set(key, bucket)
    }
    bucket.amount += amount
    bucket.sourceOrders += 1

    stats.rowsCounted += 1
    stats.totalAmount += amount
  }

  for (const entry of unmatched.values()) {
    if (entry.reason === 'ambiguous') {
      errors.push(`Restaurant "${entry.restaurant}" matches several accounts (${entry.matches.join(', ')}). Rename the accounts so the match is unique.`)
    } else {
      errors.push(`Restaurant "${entry.restaurant}" doesn't match any account in this company (${entry.rows} row(s), ${entry.amount.toFixed(2)} skipped).`)
    }
  }

  // Refuse accounts already fed by the API — their Rappi orders are ingested
  // automatically and importing would book the same revenue twice.
  const apiFedTokens = new Set()
  for (const bucket of buckets.values()) {
    const account = accounts.find((a) => a.company_token === bucket.companyToken)
    if (account?.public_api_key) apiFedTokens.add(`${bucket.accountName} (${bucket.companyToken})`)
  }
  for (const label of apiFedTokens) {
    errors.push(`${label} is connected to the OlaClick API, so its Rappi orders are already imported automatically. Importing this file would double-count that revenue.`)
  }

  const days = [...buckets.values()].sort(
    (a, b) => a.day.localeCompare(b.day) || a.accountName.localeCompare(b.accountName)
  )

  // Round once, at the boundary, to keep the stored total equal to the sum of
  // the displayed per-day amounts.
  for (const d of days) d.amount = round2(d.amount)
  stats.totalAmount = round2(stats.totalAmount)
  stats.cancelledAmount = round2(stats.cancelledAmount)
  stats.daysAffected = days.length
  stats.firstDay = days[0]?.day || null
  stats.lastDay = days[days.length - 1]?.day || null

  if (stats.rowsSkippedCancelled > 0) {
    warnings.push(`${stats.rowsSkippedCancelled} cancelled order(s) excluded (${stats.cancelledAmount.toFixed(2)} not counted).`)
  }
  if (stats.rowsSkippedDuplicate > 0) {
    warnings.push(`${stats.rowsSkippedDuplicate} duplicate order number(s) ignored.`)
  }
  if (stats.rowsSkippedInvalid > 0) {
    warnings.push(`${stats.rowsSkippedInvalid} row(s) skipped: unreadable date.`)
  }

  return {
    days,
    warnings,
    errors,
    stats,
    unmatchedRestaurants: [...unmatched.values()],
    restaurantMap: [...restaurantResolution.entries()]
      .filter(([, r]) => r.account)
      .map(([restaurant, r]) => ({
        restaurant,
        company_token: r.account.company_token,
        account_name: r.account.account_name || r.account.company_token
      }))
  }
}

function emptyStats() {
  return {
    rowsTotal: 0,
    rowsCounted: 0,
    rowsSkippedCancelled: 0,
    rowsSkippedUnmatched: 0,
    rowsSkippedDuplicate: 0,
    rowsSkippedInvalid: 0,
    totalAmount: 0,
    cancelledAmount: 0,
    daysAffected: 0,
    firstDay: null,
    lastDay: null
  }
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

/** Accounts of one company, with the fields the importer needs to match and guard. */
async function loadImportableAccounts(companyId) {
  const res = await pool.query(
    `SELECT ca.company_id, ca.company_token, ca.account_name, ca.api_token, ca.public_api_key
     FROM company_accounts ca
     WHERE ca.company_id = $1
     ORDER BY ca.account_name NULLS LAST, ca.company_token`,
    [companyId]
  )
  return res.rows
}

/**
 * Look up what the ledger currently holds for the (account, day) pairs a file
 * covers, so the preview can show "current -> new" and the commit can report
 * created vs updated.
 *
 * Manual and OlaClick totals are split apart deliberately. Only the manual part
 * is what this import replaces, so it's the only honest thing to compare the new
 * amount against — lumping in real orders would render the per-day delta as a
 * large fake drop on any day that has both.
 *
 * @returns {Promise<Map<string, {manualAmount:number, otherAmount:number, hasManual:boolean}>>} keyed `${token}|${day}`
 */
async function loadExistingDayTotals(days) {
  if (days.length === 0) return new Map()

  const tokens = [...new Set(days.map((d) => d.companyToken))]
  const dayList = [...new Set(days.map((d) => d.day))]

  const res = await pool.query(
    `SELECT company_token,
            to_char(day_local, 'YYYY-MM-DD') AS day,
            COALESCE(SUM(order_total) FILTER (WHERE is_manual), 0) AS manual_amount,
            COALESCE(SUM(order_total) FILTER (WHERE NOT is_manual), 0) AS other_amount,
            BOOL_OR(is_manual) AS has_manual
     FROM order_facts
     WHERE company_token = ANY($1::varchar[])
       AND day_local = ANY($2::date[])
       AND status <> 'CANCELLED'
       AND deleted_at IS NULL
     GROUP BY company_token, day_local`,
    [tokens, dayList]
  )

  const map = new Map()
  for (const row of res.rows) {
    map.set(`${row.company_token}|${row.day}`, {
      manualAmount: Number(row.manual_amount) || 0,
      otherAmount: Number(row.other_amount) || 0,
      hasManual: row.has_manual === true
    })
  }
  return map
}

/**
 * Dry run: parse + aggregate + annotate each day with what the ledger already
 * holds. Writes nothing.
 */
export async function previewRappiImport(csvText, companyId) {
  const accounts = await loadImportableAccounts(companyId)
  const result = aggregateRappiCsv(csvText, accounts)
  const existing = await loadExistingDayTotals(result.days)

  const days = result.days.map((d) => {
    const prior = existing.get(`${d.companyToken}|${d.day}`)
    return {
      ...d,
      // The amount this import replaces (null when there's nothing to replace).
      existing_amount: prior?.hasManual ? round2(prior.manualAmount) : null,
      // Real OlaClick orders on the same day. Untouched by the import, but shown
      // so a day's dashboard total isn't a surprise.
      existing_other_amount: prior ? round2(prior.otherAmount) : 0,
      action: prior?.hasManual ? 'update' : 'create'
    }
  })

  const warnings = [...result.warnings]
  const mixed = days.filter((d) => d.existing_other_amount > 0)
  if (mixed.length > 0) {
    warnings.push(`${mixed.length} day(s) also hold OlaClick orders. The imported total is added alongside those, not instead of them.`)
  }

  return {
    days,
    warnings,
    errors: result.errors,
    stats: {
      ...result.stats,
      daysToCreate: days.filter((d) => d.action === 'create').length,
      daysToUpdate: days.filter((d) => d.action === 'update').length
    },
    restaurantMap: result.restaurantMap,
    unmatchedRestaurants: result.unmatchedRestaurants
  }
}

/**
 * Write one synthetic order (+ its single rappi_pay payment) for an
 * (account, day). Atomic so the order and its payment can never drift apart.
 */
async function upsertManualDay({ companyId, companyToken, day, amount }) {
  const orderId = `${MANUAL_ORDER_PREFIX}${day}`
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // combo_units / burger_units stay NULL: the export has no product names, and
    // burger analytics filter on `burger_units IS NOT NULL` so these days are
    // excluded there instead of being counted as zero-burger orders.
    await client.query(
      `INSERT INTO order_facts
         (company_id, company_token, order_id, day_local, status, source,
          order_total, total_paid, tips_total, discounts_total, service_fee, service_type,
          payment_count, order_updated_at, fetched_at, is_manual)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 0, 0, 0, $8, 1, NOW(), NOW(), TRUE)
       ON CONFLICT (company_token, order_id) DO UPDATE SET
         day_local = EXCLUDED.day_local,
         status = EXCLUDED.status,
         source = EXCLUDED.source,
         order_total = EXCLUDED.order_total,
         total_paid = EXCLUDED.total_paid,
         service_type = EXCLUDED.service_type,
         payment_count = EXCLUDED.payment_count,
         order_updated_at = NOW(),
         fetched_at = NOW(),
         is_manual = TRUE,
         deleted_at = NULL`,
      [companyId, companyToken, orderId, day, ORDER_STATUS, ORDER_SOURCE, amount, SERVICE_TYPE]
    )

    await client.query(
      `INSERT INTO order_payment_facts
         (company_id, company_token, order_id, seq, day_local, method,
          bill_amount, received_amount, tip_amount, fee_amount)
       VALUES ($1, $2, $3, 0, $4, $5, $6, $6, 0, 0)
       ON CONFLICT (company_token, order_id, seq) DO UPDATE SET
         day_local = EXCLUDED.day_local,
         method = EXCLUDED.method,
         bill_amount = EXCLUDED.bill_amount,
         received_amount = EXCLUDED.received_amount`,
      [companyId, companyToken, orderId, day, PAYMENT_METHOD, amount]
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Commit an import: upsert one synthetic order per (account, day), then
 * recompute daily_gains for every day touched so the gain calendar, profit
 * figures and the "record to beat" pick the revenue up immediately (their
 * scheduled recompute only covers the last 3 days).
 *
 * @param {string} csvText raw file contents
 * @param {string} companyId
 * @param {{fileName?:string, userId?:string}} meta
 */
export async function commitRappiImport(csvText, companyId, meta = {}) {
  const preview = await previewRappiImport(csvText, companyId)

  if (preview.errors.length > 0) {
    const error = new Error(preview.errors[0])
    error.details = preview
    throw error
  }
  if (preview.days.length === 0) {
    const error = new Error('Nothing to import: the file contains no countable sales.')
    error.details = preview
    throw error
  }

  const companyRes = await pool.query('SELECT timezone FROM companies WHERE id = $1', [companyId])
  const timezone = companyRes.rows[0]?.timezone || 'America/Lima'
  const accounts = await loadImportableAccounts(companyId)
  const apiTokenByToken = new Map(accounts.map((a) => [a.company_token, a.api_token]))

  const written = []
  const failures = []

  for (const day of preview.days) {
    try {
      await upsertManualDay({
        companyId,
        companyToken: day.companyToken,
        day: day.day,
        amount: day.amount
      })
      written.push(day)
    } catch (err) {
      console.error(`❌ Manual import write failed for ${day.companyToken} ${day.day}: ${err.message}`)
      failures.push({ company_token: day.companyToken, day: day.day, error: err.message })
    }
  }

  // Gains are derived from the ledger we just wrote, so recompute after all the
  // rows land. One call per (account, day) actually written — DB-only work, no
  // OlaClick calls, so no throttling needed.
  const gainFailures = []
  for (const day of written) {
    try {
      await computeAndStoreDailyGain(
        companyId,
        day.companyToken,
        apiTokenByToken.get(day.companyToken) || null,
        day.day,
        timezone
      )
    } catch (err) {
      console.error(`❌ Manual import gain recompute failed for ${day.companyToken} ${day.day}: ${err.message}`)
      gainFailures.push({ company_token: day.companyToken, day: day.day, error: err.message })
    }
  }

  const daysCreated = written.filter((d) => d.action === 'create').length
  const daysUpdated = written.filter((d) => d.action === 'update').length
  const totalAmount = round2(written.reduce((s, d) => s + d.amount, 0))

  const summary = {
    days: written.map((d) => ({
      company_token: d.companyToken,
      account_name: d.accountName,
      day: d.day,
      amount: d.amount,
      previous_amount: d.existing_amount,
      source_orders: d.sourceOrders,
      action: d.action
    })),
    restaurant_map: preview.restaurantMap,
    warnings: preview.warnings,
    write_failures: failures,
    gain_failures: gainFailures
  }

  const inserted = await pool.query(
    `INSERT INTO manual_sales_imports
       (company_id, uploaded_by, provider, file_name, rows_total, rows_counted, rows_skipped,
        days_created, days_updated, total_amount, first_day, last_day, summary)
     VALUES ($1, $2, 'RAPPI', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     RETURNING id, created_at`,
    [
      companyId,
      meta.userId || null,
      meta.fileName || null,
      preview.stats.rowsTotal,
      preview.stats.rowsCounted,
      preview.stats.rowsSkippedCancelled + preview.stats.rowsSkippedUnmatched +
        preview.stats.rowsSkippedDuplicate + preview.stats.rowsSkippedInvalid,
      daysCreated,
      daysUpdated,
      totalAmount,
      written[0]?.day || null,
      written[written.length - 1]?.day || null,
      JSON.stringify(summary)
    ]
  )

  console.log(
    `📥 Rappi import committed: ${written.length} day(s) (${daysCreated} new, ${daysUpdated} updated), total ${totalAmount}` +
    (failures.length ? `, ${failures.length} write failure(s)` : '')
  )

  return {
    importId: inserted.rows[0].id,
    createdAt: inserted.rows[0].created_at,
    days: written,
    daysCreated,
    daysUpdated,
    totalAmount,
    stats: preview.stats,
    warnings: preview.warnings,
    failures,
    gainFailures,
    restaurantMap: preview.restaurantMap
  }
}

/** Most recent imports for a company, newest first (history panel). */
export async function listRappiImports(companyId, limit = 20) {
  const res = await pool.query(
    `SELECT i.id, i.provider, i.file_name, i.rows_total, i.rows_counted, i.rows_skipped,
            i.days_created, i.days_updated, i.total_amount,
            to_char(i.first_day, 'YYYY-MM-DD') AS first_day,
            to_char(i.last_day, 'YYYY-MM-DD') AS last_day,
            i.summary, i.created_at, u.name AS uploaded_by_name
     FROM manual_sales_imports i
     LEFT JOIN users u ON u.id = i.uploaded_by
     WHERE i.company_id = $1
     ORDER BY i.created_at DESC
     LIMIT $2`,
    [companyId, Math.min(Number(limit) || 20, 100)]
  )
  return res.rows.map((r) => ({
    ...r,
    total_amount: Number(r.total_amount) || 0
  }))
}
