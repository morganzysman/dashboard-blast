import axios from 'axios';

/**
 * Client for the OlaClick PUBLIC API (https://public-api.olaclick.app/v1).
 *
 * Auth is a per-restaurant API key (olk_live_...) passed as a Bearer token.
 * This is distinct from the scraped session token used by olaClickService.js
 * against the private api.olaclick.app endpoints. We use the public API here
 * because its single-order detail endpoint returns the `combos[]` line items
 * (with product_name), which is what the combo-name metric needs.
 */

const PUBLIC_API_BASE_URL = 'https://public-api.olaclick.app/v1';
// The list endpoint paginates via `page` + `per_page` (the bracketed
// `page[number]`/`page[size]` forms are silently ignored — they always return
// the first page). per_page is honored, so we request 100 to keep page counts
// low; `page` then walks the remainder for very busy days.
const DEFAULT_PER_PAGE = 100;
const MAX_PAGES = 200;
const MAX_RETRIES = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHeaders(publicApiKey) {
  return {
    Authorization: `Bearer ${publicApiKey}`,
    Accept: 'application/json'
  };
}

/**
 * Resolve how long to wait (ms) before retrying a 429/5xx, preferring the
 * server's guidance: `Retry-After` (seconds) then `ratelimit-reset` (seconds),
 * falling back to exponential backoff (0.5s, 1s, 2s, 4s, ...).
 *
 * @param {import('axios').AxiosResponse|undefined} response
 * @param {number} attempt zero-based retry attempt
 */
function resolveBackoffMs(response, attempt) {
  const headers = response?.headers || {};
  const retryAfter = Number(headers['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1000, 30_000);
  }
  const reset = Number(headers['ratelimit-reset']);
  if (Number.isFinite(reset) && reset >= 0) {
    return Math.min(reset * 1000 + 250, 30_000);
  }
  return Math.min(500 * 2 ** attempt, 30_000);
}

/**
 * GET a public API path with retry on 429 / 5xx. Throws on non-retryable
 * errors (4xx other than 429) or after MAX_RETRIES exhausted.
 *
 * @param {string} publicApiKey
 * @param {string} path e.g. `/orders`
 * @param {Record<string, any>} [params]
 */
async function publicApiGet(publicApiKey, path, params = {}) {
  if (!publicApiKey) throw new Error('public_api_key is required');
  const url = `${PUBLIC_API_BASE_URL}${path}`;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response;
    try {
      response = await axios.get(url, {
        params,
        headers: buildHeaders(publicApiKey),
        // Let us inspect 4xx/5xx instead of throwing, so we can decide to retry.
        validateStatus: (s) => s >= 200 && s < 600
      });
    } catch (err) {
      // Network-level error (no response) — retry with backoff.
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await sleep(resolveBackoffMs(undefined, attempt));
        continue;
      }
      throw err;
    }

    if (response.status >= 200 && response.status < 300) {
      return response.data;
    }

    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`OlaClick public API ${response.status} on ${path}`);
      if (attempt < MAX_RETRIES) {
        const waitMs = resolveBackoffMs(response, attempt);
        console.warn(
          `⏳ Public API ${response.status} on ${path} — retry ${attempt + 1}/${MAX_RETRIES} in ${waitMs}ms`
        );
        await sleep(waitMs);
        continue;
      }
    }

    // Non-retryable (4xx other than 429) or retries exhausted.
    const detail =
      response.data?.detail || response.data?.title || JSON.stringify(response.data);
    throw new Error(`OlaClick public API ${response.status} on ${path}: ${detail}`);
  }

  throw lastError || new Error(`OlaClick public API request failed on ${path}`);
}

/**
 * Fetch all orders for a date range as lightweight skeletons (the list endpoint
 * returns order-level fields only — no line items). A busy day can span many
 * pages, so we walk `page` + `per_page` until the API says there is nothing
 * more.
 *
 * Results are de-duplicated by order id: the endpoint can re-serve the same order
 * across pages (orders shift while paginating, and some ranges re-serve the tail
 * with `has_more:true`). Deduping keeps the caller from fetching the same order's
 * detail twice in one run and prevents the loop from spinning to MAX_PAGES.
 *
 * @param {string} publicApiKey
 * @param {{startDate:string, endDate:string, statuses?:string}} range dates as YYYY-MM-DD
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function fetchPublicOrdersList(publicApiKey, { startDate, endDate, statuses } = {}) {
  if (!startDate || !endDate) throw new Error('startDate and endDate are required');

  const byId = new Map(); // order id -> latest copy seen (dedupes across pages)
  const noId = [];        // orders missing an id are kept verbatim
  let pageNumber = 1;

  while (pageNumber <= MAX_PAGES) {
    const params = {
      'filter[start_date]': startDate,
      'filter[end_date]': endDate,
      page: pageNumber,
      per_page: DEFAULT_PER_PAGE
    };
    if (statuses) params['filter[status]'] = statuses;

    const body = await publicApiGet(publicApiKey, '/orders', params);
    const chunk = Array.isArray(body?.data) ? body.data : [];

    let newThisPage = 0;
    for (const o of chunk) {
      const id = o?.id ?? o?.order_id ?? o?.uuid;
      if (id == null || id === '') {
        noId.push(o);
        newThisPage += 1;
        continue;
      }
      if (!byId.has(id)) newThisPage += 1;
      byId.set(id, o); // always refresh with the latest copy
    }

    const pagination = body?.pagination || {};
    const hasMore = pagination.has_more === true;

    // Stop when the API says there's no more, the page was empty, or the page
    // added nothing new (guards the "tail re-served with has_more:true" quirk
    // that would otherwise loop all the way to MAX_PAGES).
    if (!hasMore || chunk.length === 0 || newThisPage === 0) break;

    // Hard ceiling: never collect more unique orders than the reported total.
    const total = Number(pagination.total);
    if (Number.isFinite(total) && byId.size + noId.length >= total) break;

    pageNumber += 1;
  }

  return [...byId.values(), ...noId];
}

/**
 * Fetch a single order's detail (including `combos[]` line items).
 *
 * @param {string} publicApiKey
 * @param {string} orderId
 * @returns {Promise<Record<string, any>|null>}
 */
export async function fetchPublicOrderDetail(publicApiKey, orderId) {
  if (!orderId) throw new Error('orderId is required');
  const body = await publicApiGet(publicApiKey, `/orders/${encodeURIComponent(orderId)}`);
  return body?.data ?? null;
}

function isCanceledLine(line) {
  if (!line || typeof line !== 'object') return false;
  const c = line.canceled_at ?? line.cancelled_at ?? line.canceledAt ?? line.cancelledAt;
  return c != null && c !== '';
}

// Keywords that mark a line item as a "burger" — the unified sale unit we want
// to measure. Naming differs by shop (some label them "...Burger", others
// "...Smash"), and combos are burger combos, so all three match a burger.
// "combo" is tracked separately as the narrow subset.
const COMBO_KEYWORDS = ['combo'];
const BURGER_KEYWORDS = ['combo', 'burger', 'smash'];

function lineName(line) {
  const rawName =
    line.product_name ?? line.name ?? line.title ?? line.productName ?? line.product?.name ?? '';
  return String(rawName || '').toLowerCase();
}

function lineQty(line) {
  const rawQty = line.quantity ?? line.qty ?? line.count ?? line.units ?? 1;
  const qty = Number(rawQty);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

/**
 * Tally combo and burger line items in an order detail, summing quantities so
 * 2 combos count as 2. Line items live in `order.combos[]` (falling back to
 * products/items). Canceled lines are ignored.
 *
 *   - combo  = name contains "combo"
 *   - burger = name contains "combo", "burger", or "smash" (superset of combo)
 *
 * @param {Record<string, any>|null|undefined} order a single-order detail object
 * @returns {{ comboUnits:number, comboLines:number, hasCombo:boolean,
 *            burgerUnits:number, burgerLines:number, hasBurger:boolean }}
 */
export function countOrderUnits(order) {
  const empty = {
    comboUnits: 0, comboLines: 0, hasCombo: false,
    burgerUnits: 0, burgerLines: 0, hasBurger: false
  };
  const lines =
    order?.combos ??
    order?.products ??
    order?.items ??
    order?.order_products ??
    order?.line_items ??
    [];
  if (!Array.isArray(lines)) return empty;

  let comboUnits = 0, comboLines = 0, burgerUnits = 0, burgerLines = 0;
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue;
    if (isCanceledLine(line)) continue;
    const name = lineName(line);
    const qty = lineQty(line);
    if (BURGER_KEYWORDS.some((k) => name.includes(k))) {
      burgerUnits += qty;
      burgerLines += 1;
    }
    if (COMBO_KEYWORDS.some((k) => name.includes(k))) {
      comboUnits += qty;
      comboLines += 1;
    }
  }
  return {
    comboUnits, comboLines, hasCombo: comboUnits > 0,
    burgerUnits, burgerLines, hasBurger: burgerUnits > 0
  };
}

/**
 * @deprecated Use {@link countOrderUnits}. Kept for backward compatibility.
 * @param {Record<string, any>|null|undefined} order
 * @returns {{ comboUnits:number, comboLines:number, hasCombo:boolean }}
 */
export function countComboUnits(order) {
  const { comboUnits, comboLines, hasCombo } = countOrderUnits(order);
  return { comboUnits, comboLines, hasCombo };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extract order-level revenue fields shared by the list and detail shapes.
 * All of these are present on the cheap list endpoint, so the skeleton upsert
 * can persist them without a detail fetch.
 *
 * @param {Record<string, any>|null|undefined} order
 */
export function extractOrderFields(order) {
  if (!order || typeof order !== 'object') return {};
  return {
    orderTotal: num(order.total ?? order.total_paid),
    totalPaid: num(order.total_paid),
    tipsTotal: num(order.total_tips),
    discountsTotal: num(order.total_discounts),
    serviceFee: num(order.service_fee_price),
    serviceType: order.service_type ? String(order.service_type).toUpperCase().trim() : null,
    closedAt: order.closed_at || null,
    updatedAt: order.updated_at || null
  };
}

/**
 * Extract the per-payment rows from an order DETAIL (payments[]). Canceled
 * payments are skipped. `payment_method.code` is lowercased so revenue-by-method
 * sums line up with the private by_payment_methods naming (cash/card/yape/...).
 *
 * @param {Record<string, any>|null|undefined} order a single-order detail object
 * @returns {Array<{ method:string, billAmount:number|null, receivedAmount:number|null,
 *                   tipAmount:number|null, feeAmount:number|null }>}
 */
export function extractPayments(order) {
  const payments = Array.isArray(order?.payments) ? order.payments : [];
  const out = [];
  for (const p of payments) {
    if (!p || typeof p !== 'object') continue;
    const canceled = p.canceled_at ?? p.cancelled_at;
    if (canceled != null && canceled !== '') continue;
    const code = p.payment_method?.code ?? p.payment_method_code ?? p.method ?? 'other';
    out.push({
      method: String(code || 'other').toLowerCase().trim() || 'other',
      billAmount: num(p.bill_amount),
      receivedAmount: num(p.received_amount),
      tipAmount: num(p.tip_amount),
      feeAmount: num(p.fee_amount)
    });
  }
  return out;
}
