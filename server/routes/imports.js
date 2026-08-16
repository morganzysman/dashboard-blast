// Manual sales imports for accounts with no OlaClick integration.
//
// The CSV arrives as a JSON string field rather than multipart/form-data, which
// keeps the whole app on a single body parser (see the 5mb express.json limit in
// server.js) — the same approach the ID-document upload uses. A Rappi export of
// a few thousand orders is well under that.
//
// Flow is deliberately two-step: /preview parses and reports what would change
// (per account, per day, current total -> new total) without writing, then
// /commit re-parses the same text and writes. Uploads overwrite whole days, so
// the operator gets to see a total drop before it happens.

import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  previewRappiImport,
  commitRappiImport,
  listRappiImports
} from '../services/rappiSalesImportService.js'

const router = Router()

// Guards against a pasted binary (.xlsx) or a runaway payload reaching the
// parser. Comfortably inside the 25mb body limit server.js grants these routes,
// and worth roughly a decade of Rappi exports.
const MAX_CSV_CHARS = 15 * 1024 * 1024

function readCsvBody(req) {
  const csv = req.body?.csv
  if (typeof csv !== 'string' || csv.trim() === '') {
    return { error: 'No file contents received. Choose a CSV export and try again.' }
  }
  if (csv.length > MAX_CSV_CHARS) {
    return { error: 'That file is too large. Export a shorter date range and upload it in parts.' }
  }
  // An .xlsx is a zip; its "PK" signature never starts a CSV.
  if (csv.startsWith('PK')) {
    return { error: 'That looks like an Excel workbook. Save it as CSV first, then upload it.' }
  }
  return { csv }
}

// POST /api/imports/rappi-sales/preview  { csv, file_name? }
// Dry run — reports per-day changes and any blocking errors. Writes nothing.
router.post('/rappi-sales/preview', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { csv, error } = readCsvBody(req)
    if (error) return res.status(400).json({ success: false, error })

    if (!req.user.companyId) {
      return res.status(400).json({ success: false, error: 'Your user is not linked to a company.' })
    }

    const preview = await previewRappiImport(csv, req.user.companyId)
    return res.json({ success: true, ...preview })
  } catch (err) {
    console.error('❌ Rappi import preview error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/imports/rappi-sales/commit  { csv, file_name? }
// Upserts one synthetic order per (account, day, platform) and recomputes daily gains.
router.post('/rappi-sales/commit', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { csv, error } = readCsvBody(req)
    if (error) return res.status(400).json({ success: false, error })

    if (!req.user.companyId) {
      return res.status(400).json({ success: false, error: 'Your user is not linked to a company.' })
    }

    const result = await commitRappiImport(csv, req.user.companyId, {
      fileName: typeof req.body?.file_name === 'string' ? req.body.file_name.slice(0, 255) : null,
      userId: req.user.userId
    })
    return res.json({ success: true, ...result })
  } catch (err) {
    console.error('❌ Rappi import commit error:', err.message)
    // A validation failure (unmapped restaurant, API-fed account, empty file)
    // carries the preview it was derived from, so the UI can show the detail.
    if (err.details) {
      return res.status(400).json({ success: false, error: err.message, details: err.details })
    }
    return res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/imports/rappi-sales/history?limit=20
router.get('/rappi-sales/history', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    if (!req.user.companyId) return res.json({ success: true, data: [] })
    const data = await listRappiImports(req.user.companyId, req.query.limit)
    return res.json({ success: true, data })
  } catch (err) {
    console.error('❌ Rappi import history error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
