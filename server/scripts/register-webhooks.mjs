#!/usr/bin/env node
/**
 * CLI: register (or update) the OlaClick order webhook for every account that has
 * a public_api_key. Idempotent — safe to re-run: it lists the account's existing
 * webhooks and PATCHes the one already pointing at our URL, otherwise creates it.
 *
 * merchant_id is set to the account's company_token so the receiver can map a
 * delivery back to the account. A shared secret (OLACLICK_WEBHOOK_SECRET) is sent
 * as a custom header on every delivery and re-checked by the receiver.
 *
 * Usage:
 *   OLACLICK_WEBHOOK_SECRET=... APP_BASE_URL=https://your-app node server/scripts/register-webhooks.mjs
 *   node server/scripts/register-webhooks.mjs --url https://your-app.up.railway.app
 *   node server/scripts/register-webhooks.mjs --token blast-smash-burgers
 *   node server/scripts/register-webhooks.mjs --list          # just print current webhooks
 *   node server/scripts/register-webhooks.mjs --delete        # remove OUR webhook from each account
 *
 * Flags:
 *   --url <base>     public base URL (defaults to APP_BASE_URL env)
 *   --company <uuid> only this company's accounts
 *   --token <token>  only this company_token
 *   --list           list existing webhooks and exit (no changes)
 *   --delete         delete the webhook that matches our URL and exit
 *
 * DB connection comes from the app config (DATABASE_URL or DB_* env vars).
 */

import { pool } from '../database.js'
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook
} from '../services/publicOlaClickService.js'

const WEBHOOK_PATH = '/api/webhooks/olaclick'

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--list') args.list = true
    else if (a === '--delete') args.delete = true
    else if (a === '--url') args.url = argv[++i]
    else if (a === '--company') args.company = argv[++i]
    else if (a === '--token') args.token = argv[++i]
    else if (a === '--help' || a === '-h') args.help = true
    else console.warn(`⚠️  Ignoring unknown arg: ${a}`)
  }
  return args
}

function normalizeBase(raw) {
  if (!raw) return ''
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withProto.replace(/\/+$/, '')
}

async function loadAccounts({ company, token }) {
  const params = []
  let where = 'ca.public_api_key IS NOT NULL'
  if (company) { params.push(company); where += ` AND ca.company_id = $${params.length}` }
  if (token) { params.push(token); where += ` AND ca.company_token = $${params.length}` }
  const res = await pool.query(
    `SELECT ca.company_id, ca.company_token, ca.account_name, ca.public_api_key
     FROM company_accounts ca
     WHERE ${where}
     ORDER BY ca.account_name, ca.company_token`,
    params
  )
  return res.rows
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    console.log('See header of this file for usage.')
    await pool.end(); return
  }

  const base = normalizeBase(args.url || process.env.APP_BASE_URL)
  const webhookUrl = `${base}${WEBHOOK_PATH}`
  const secret = process.env.OLACLICK_WEBHOOK_SECRET || ''
  const secretHeader = (process.env.OLACLICK_WEBHOOK_SECRET_HEADER || 'x-webhook-secret').toLowerCase()

  if (!args.list && !base) {
    console.error('❌ No base URL. Pass --url or set APP_BASE_URL.')
    await pool.end(); process.exit(1)
  }
  if (!args.list && !args.delete && !secret) {
    console.warn('⚠️  OLACLICK_WEBHOOK_SECRET is empty — deliveries will not be authenticated. Set it for production.')
  }

  const accounts = await loadAccounts(args)
  if (accounts.length === 0) {
    console.log('No accounts with a public_api_key matched.')
    await pool.end(); return
  }

  console.log(`🔔 ${args.list ? 'Listing' : args.delete ? 'Deleting' : 'Registering'} webhooks for ${accounts.length} account(s)`)
  if (!args.list) console.log(`   URL: ${webhookUrl}`)

  for (const acc of accounts) {
    const label = `${acc.account_name || acc.company_token} (${acc.company_token})`
    try {
      const existing = await listWebhooks(acc.public_api_key)
      const ours = existing.find((w) => w.webhook_url === webhookUrl)

      if (args.list) {
        console.log(`\n• ${label}: ${existing.length} webhook(s)`)
        for (const w of existing) {
          console.log(`    - ${w.webhook_id || w.id} ${w.webhook_url} active=${w.is_active} merchant=${w.merchant_id}`)
        }
        continue
      }

      if (args.delete) {
        if (ours) {
          await deleteWebhook(acc.public_api_key, ours.webhook_id || ours.id)
          console.log(`🗑️  ${label}: deleted ${ours.webhook_id || ours.id}`)
        } else {
          console.log(`•  ${label}: nothing to delete`)
        }
        continue
      }

      const headers = secret ? { [secretHeader]: secret } : undefined
      if (ours) {
        await updateWebhook(acc.public_api_key, ours.webhook_id || ours.id, {
          webhook_url: webhookUrl,
          merchant_id: acc.company_token,
          ...(headers ? { webhook_headers: headers } : {}),
          is_active: true
        })
        console.log(`♻️  ${label}: updated ${ours.webhook_id || ours.id}`)
      } else {
        const created = await createWebhook(acc.public_api_key, {
          webhookUrl,
          merchantId: acc.company_token,
          webhookHeaders: headers
        })
        console.log(`✅ ${label}: created ${created?.webhook_id || created?.id || '(ok)'}`)
      }
    } catch (err) {
      console.error(`❌ ${label}: ${err.message}`)
    }
  }

  await pool.end()
}

main().catch(async (err) => {
  console.error('Fatal:', err)
  try { await pool.end() } catch {}
  process.exit(1)
})
