import axios from 'axios';
import { config } from '../config/index.js';
import { resolveKitchenTargetMinutes } from './kitchenSlaService.js';

const KITCHEN_SERVICE_TYPES = ['TABLE', 'ONSITE', 'TAKEAWAY', 'DELIVERY'];

/** Normalize OlaClick order service channel for kitchen breakdowns */
export function getOrderServiceType(order) {
  const raw =
    order.service_type ??
    order.serviceType ??
    order.type ??
    order.order_type ??
    order.orderType;
  if (raw == null || raw === '') return 'OTHER';
  const u = String(raw).toUpperCase().trim();
  if (KITCHEN_SERVICE_TYPES.includes(u)) return u;
  return 'OTHER';
}

/**
 * When OlaClick auto-closes an order that was never explicitly marked prepared, both
 * `preparing_at` and `prepared_at` get stamped with the close time. That fakes a
 * 0-minute prep and poisons SLA averages. We treat any order whose `prepared_at` is
 * within 60s of `closed_at`, `finished_at`, or `completed_at` as missing-prep.
 *
 * @param {Record<string, any>} order
 */
export function isPrepStampLikelyMissing(order) {
  const preparedRaw = order?.prepared_at;
  if (!preparedRaw) return true;
  const prepared = new Date(preparedRaw).getTime();
  if (!Number.isFinite(prepared)) return true;
  const candidates = [order.closed_at, order.finished_at, order.completed_at];
  for (const raw of candidates) {
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (!Number.isFinite(t)) continue;
    if (Math.abs(prepared - t) < 60_000) return true; // within 60s -> auto-close artefact
  }
  return false;
}

function kitchenPrepMinutes(order) {
  if (!order.preparing_at || !order.prepared_at || order.status === 'CANCELLED') {
    return null;
  }
  if (isPrepStampLikelyMissing(order)) return null;
  const preparingTime = new Date(order.preparing_at);
  const preparedTime = new Date(order.prepared_at);
  if (Number.isNaN(preparingTime.getTime()) || Number.isNaN(preparedTime.getTime())) {
    return null;
  }
  return Math.max(0, (preparedTime - preparingTime) / (1000 * 60));
}

function formatDateInTimezone(isoString, timeZone) {
  if (!isoString) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toISOString().slice(0, 10);
  }
}

function normKitchenSource(v) {
  if (v == null || v === '') return '';
  return String(v).toUpperCase().trim();
}

/**
 * Stable channel key for SLA and kitchen breakdown (service + source/delivered_by).
 * Examples: DELIVERY:RAPPI_TURBO, DELIVERY:RAPPI, ONSITE:OUTBOUND
 */
export function getKitchenChannelKey(order) {
  const st = getOrderServiceType(order);
  const source = normKitchenSource(order.source ?? order.source_name);
  const deliveredBy = normKitchenSource(order.delivered_by ?? order.deliveredBy);

  if (st === 'DELIVERY') {
    if (source === 'RAPPI_TURBO' || deliveredBy === 'RAPPI_TURBO') return 'DELIVERY:RAPPI_TURBO';
    if (source === 'RAPPI' || deliveredBy === 'RAPPI') return 'DELIVERY:RAPPI';
    if (source) return `DELIVERY:${source}`;
    if (deliveredBy) return `DELIVERY:${deliveredBy}`;
    return 'DELIVERY:OTHER';
  }
  if (st === 'ONSITE') {
    const sub = source || deliveredBy || 'OUTBOUND';
    return `ONSITE:${sub}`;
  }
  if (st === 'TABLE' || st === 'TAKEAWAY') {
    const sub = source || deliveredBy || 'GENERAL';
    return `${st}:${sub}`;
  }
  const sub = source || deliveredBy || 'GENERAL';
  return `OTHER:${sub}`;
}

const SLA_BREACH_RETURN_LIMIT = 120;

/** Best-effort OlaClick order id for support / deep links */
export function getOrderId(order) {
  const id =
    order?.id ??
    order?.order_id ??
    order?.orderId ??
    order?.uuid ??
    order?.number ??
    order?.order_number;
  if (id == null || id === '') return '';
  return String(id);
}

/**
 * Best-effort short, human-friendly OlaClick order identifier (the one shown
 * to staff in the OlaClick UI — e.g. "BMR0042" / "00123"). We try the names
 * we've seen in the wild, falling back through `code`/`number` etc. so the
 * helper degrades gracefully if a particular tenant doesn't return the
 * canonical `public_id`. Empty string when nothing usable is present so the
 * UI can fall back to the long UUID for support lookups.
 */
export function getOrderPublicId(order) {
  const v =
    order?.public_id ??
    order?.publicId ??
    order?.code ??
    order?.order_code ??
    order?.daily_id ??
    order?.dailyId ??
    order?.display_id ??
    order?.displayId ??
    order?.reference ??
    order?.number ??
    order?.order_number;
  if (v == null || v === '') return '';
  return String(v);
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

/**
 * Kitchen prep stats from orders: overall average, per service_type, per channel, SLA scoring, per day.
 * @param {unknown[]} orders
 * @param {string} timeZone
 * @param {Record<string, number>|null} [slaCustomOverrides] When non-null, enables SLA / byKitchenChannel / per-day on-time.
 */
export function computeKitchenPerformanceFromOrders(orders, timeZone, slaCustomOverrides = null) {
  const ordersWithPrep = (orders || []).filter((o) => kitchenPrepMinutes(o) != null);
  let averagePreparationTime = 0;
  if (ordersWithPrep.length > 0) {
    averagePreparationTime =
      ordersWithPrep.reduce((sum, o) => sum + kitchenPrepMinutes(o), 0) / ordersWithPrep.length;
  }

  const scoreSla = slaCustomOverrides != null;

  const serviceBuckets = {};
  const channelBuckets = {};
  let slaOnTime = 0;

  for (const o of ordersWithPrep) {
    const mins = kitchenPrepMinutes(o);
    const st = getOrderServiceType(o);

    if (!serviceBuckets[st]) {
      serviceBuckets[st] = { totalMinutes: 0, count: 0 };
    }
    serviceBuckets[st].totalMinutes += mins;
    serviceBuckets[st].count += 1;

    const ch = getKitchenChannelKey(o);
    if (!channelBuckets[ch]) {
      channelBuckets[ch] = { totalMinutes: 0, count: 0, onTimeCount: 0 };
    }
    channelBuckets[ch].totalMinutes += mins;
    channelBuckets[ch].count += 1;

    if (scoreSla) {
      const target = resolveKitchenTargetMinutes(ch, slaCustomOverrides);
      if (mins <= target) {
        channelBuckets[ch].onTimeCount += 1;
        slaOnTime += 1;
      }
    }
  }

  const byServiceType = {};
  const serviceOrder = [...KITCHEN_SERVICE_TYPES, 'OTHER'];
  for (const st of serviceOrder) {
    const b = serviceBuckets[st];
    if (b && b.count > 0) {
      byServiceType[st] = {
        averagePreparationTime: b.totalMinutes / b.count,
        ordersWithPrepTime: b.count
      };
    }
  }

  const byKitchenChannel = {};
  for (const [ch, b] of Object.entries(channelBuckets)) {
    const onTimeRate = scoreSla && b.count > 0 ? b.onTimeCount / b.count : 0;
    const targetM = scoreSla ? resolveKitchenTargetMinutes(ch, slaCustomOverrides) : null;
    byKitchenChannel[ch] = {
      averagePreparationTime: b.totalMinutes / b.count,
      ordersWithPrepTime: b.count,
      ...(scoreSla
        ? {
            targetMinutes: targetM,
            onTimeCount: b.onTimeCount,
            onTimeRate,
            slaScore: Math.round(onTimeRate * 100)
          }
        : {})
    };
  }

  const dayBuckets = {};
  for (const o of ordersWithPrep) {
    const mins = kitchenPrepMinutes(o);
    const dk = formatDateInTimezone(o.prepared_at, timeZone);
    if (!dk) continue;
    if (!dayBuckets[dk]) {
      dayBuckets[dk] = { totalMinutes: 0, count: 0, onTimeCount: 0, scoredCount: 0 };
    }
    dayBuckets[dk].totalMinutes += mins;
    dayBuckets[dk].count += 1;

    if (scoreSla) {
      const ch = getKitchenChannelKey(o);
      const target = resolveKitchenTargetMinutes(ch, slaCustomOverrides);
      dayBuckets[dk].scoredCount += 1;
      if (mins <= target) dayBuckets[dk].onTimeCount += 1;
    }
  }
  const byDay = Object.keys(dayBuckets)
    .sort()
    .map((date) => {
      const d = dayBuckets[date];
      const row = {
        date,
        averagePreparationTime: d.totalMinutes / d.count,
        ordersWithPrepTime: d.count
      };
      if (scoreSla) {
        row.onTimeCount = d.onTimeCount;
        row.scoredOrders = d.scoredCount;
        row.onTimeRate = d.scoredCount > 0 ? d.onTimeCount / d.scoredCount : 0;
      }
      return row;
    });

  const nScored = scoreSla ? ordersWithPrep.length : 0;
  const overallOnTimeRate = scoreSla && nScored > 0 ? slaOnTime / nScored : 0;
  const channelRanking = scoreSla
    ? Object.entries(byKitchenChannel)
        .map(([channelKey, v]) => ({
          channelKey,
          ...v
        }))
        .filter((x) => x.ordersWithPrepTime > 0)
        .sort((a, b) => (a.onTimeRate ?? 0) - (b.onTimeRate ?? 0))
    : [];

  /** Orders that exceeded SLA — for ops follow-up in OlaClick */
  let slaBreaches = [];
  let slaBreachTotal = 0;
  if (scoreSla && ordersWithPrep.length > 0) {
    const raw = [];
    for (const o of ordersWithPrep) {
      const mins = kitchenPrepMinutes(o);
      const ch = getKitchenChannelKey(o);
      const target = resolveKitchenTargetMinutes(ch, slaCustomOverrides);
      if (mins > target) {
        raw.push({
          orderId: getOrderId(o),
          publicId: getOrderPublicId(o),
          channelKey: ch,
          prepMinutes: round1(mins),
          targetMinutes: target,
          delayOverTargetMinutes: round1(mins - target)
        });
      }
    }
    raw.sort((a, b) => b.delayOverTargetMinutes - a.delayOverTargetMinutes);
    slaBreachTotal = raw.length;
    slaBreaches = raw.slice(0, SLA_BREACH_RETURN_LIMIT);
  }

  return {
    averagePreparationTime,
    ordersWithPrepTime: ordersWithPrep.length,
    byServiceType,
    byKitchenChannel,
    byDay,
    sla: scoreSla
      ? {
          overallOnTimeRate,
          overallSlaScore: nScored > 0 ? Math.round(overallOnTimeRate * 100) : 0,
          onTimeOrders: slaOnTime,
          totalScoredOrders: nScored,
          channelRanking,
          slaBreaches,
          slaBreachTotal,
          slaBreachesTruncated: slaBreachTotal > slaBreaches.length
        }
      : null
  };
}

/**
 * Fetch raw OlaClick orders for an account & date range. Mirrors the pagination logic
 * used by `fetchGeneralIndicators` so callers that want the full list (e.g. per-employee
 * SLA attribution) don't have to reimplement it. Returns the array of order objects
 * exactly as OlaClick returned them.
 *
 * @param {{company_token:string, api_token:string, account_name?:string, name?:string, additional_cookies?:string}} account
 * @param {{startDate:string, endDate:string, timezone?:string}} params
 * @returns {Promise<any[]>}
 */
export async function fetchOrdersList(account, { startDate, endDate, timezone }) {
  if (!account) throw new Error('Account not found');
  if (!startDate || !endDate) throw new Error('startDate and endDate are required');

  const tz =
    timezone && timezone !== 'undefined' ? timezone : config.olaClick.defaultTimezone;

  const baseUrl = 'https://api.olaclick.app/ms-orders/auth/orders';
  const perPage = 100;
  const baseParams = {
    'filter[start_date]': startDate,
    'filter[end_date]': endDate,
    'filter[timezone]': tz,
    'filter[start_time]': '00:00:00',
    'filter[end_time]': '23:59:59',
    'filter[time_type]': 'pending_at',
    'filter[status]':
      'PENDING,PREPARING,READY,DRIVER_ON_THE_WAY_TO_DESTINATION,CHECK_REQUESTED,CHECK_PRINTED,DRIVER_ARRIVED_AT_DESTINATION,DELIVERED,FINALIZED,CANCELLED',
    'filter[max_order_limit]': 'true',
    per_page: perPage
  };

  const headers = {
    accept: 'application/json,multipart/form-data',
    'accept-language': 'en-US,en;q=0.8',
    'app-company-token': account.company_token,
    'content-type': 'application/json',
    cookie: constructCookieHeader(account),
    origin: 'https://orders.olaclick.app',
    referer: 'https://orders.olaclick.app/',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
  };

  let allOrders = [];
  let page = 1;
  const maxPages = 500;
  while (page <= maxPages) {
    const response = await axios.get(baseUrl, { params: { ...baseParams, page }, headers });
    const chunk = response.data?.data;
    const meta = response.data?.meta || {};
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    allOrders = allOrders.concat(chunk);
    const lastPage = Number(meta.last_page ?? meta.lastPage ?? page);
    const currentPage = Number(meta.current_page ?? meta.currentPage ?? page);
    if (Number.isFinite(lastPage) && Number.isFinite(currentPage) && currentPage >= lastPage) break;
    if (chunk.length < perPage) break;
    page += 1;
  }
  return allOrders;
}

/**
 * Compact, render-ready product-line shape for one OlaClick order. Tries the
 * common Laravel/REST keys (products, order_products, items, lines, details)
 * and degrades gracefully when none match. Returns at most `visibleCap` items
 * plus `productsTruncated`/`totalCount` so callers can render a "+N more" hint
 * without leaking raw OlaClick payloads to the dashboard.
 */
export function extractCompactProducts(order, { visibleCap = 8, scanCap = 30 } = {}) {
  if (!order || typeof order !== 'object') {
    return { products: [], totalCount: 0, productsTruncated: false };
  }
  const candidates =
    order.products ??
    order.order_products ??
    order.items ??
    order.lines ??
    order.details ??
    order.orderProducts ??
    order.line_items ??
    order.lineItems ??
    null;
  if (!Array.isArray(candidates)) {
    return { products: [], totalCount: 0, productsTruncated: false };
  }
  const totalCount = candidates.length;
  const scanned = candidates.slice(0, scanCap);
  const compact = scanned
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const rawName =
        p.name ??
        p.title ??
        p.product_name ??
        p.productName ??
        p.label ??
        p.description ??
        p.product?.name ??
        p.product?.title ??
        '';
      const rawQty = p.quantity ?? p.qty ?? p.count ?? p.units ?? p.amount ?? 1;
      const qty = Number(rawQty);
      return {
        name: typeof rawName === 'string' ? rawName.trim() : String(rawName || '').trim(),
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1
      };
    })
    .filter((p) => p && p.name);
  const visible = compact.slice(0, visibleCap);
  return {
    products: visible,
    totalCount,
    productsTruncated: totalCount > visible.length
  };
}

/**
 * Fetch one OlaClick order detail and return a compact product list. Used by
 * the dashboard's per-account SLA-breach drill-down so we only pay the detail
 * round-trip when an operator actually expands a row. Tries `/orders/{id}` first
 * and a `/orders/{id}/products` subroute as fallback — different OlaClick
 * tenants have used slightly different shapes historically.
 *
 * Returns `{ products, productsTruncated, totalCount, publicId, source }`.
 * Throws if both candidates fail; the route handler maps that to a 502 so the
 * client can show an inline error.
 *
 * @param {{company_token:string, api_token:string, additional_cookies?:string}} account
 * @param {string} orderId
 */
export async function fetchOrderProducts(account, orderId) {
  if (!account) throw new Error('Account not found');
  if (!orderId) throw new Error('orderId is required');

  const headers = {
    accept: 'application/json,multipart/form-data',
    'accept-language': 'en-US,en;q=0.8',
    'app-company-token': account.company_token,
    'content-type': 'application/json',
    cookie: constructCookieHeader(account),
    origin: 'https://orders.olaclick.app',
    referer: 'https://orders.olaclick.app/',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
  };

  const candidates = [
    `https://api.olaclick.app/ms-orders/auth/orders/${encodeURIComponent(orderId)}`,
    `https://api.olaclick.app/ms-orders/auth/orders/${encodeURIComponent(orderId)}/products`
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      const response = await axios.get(url, {
        headers,
        validateStatus: (s) => s < 500
      });
      if (response.status >= 200 && response.status < 300) {
        const raw = response.data?.data ?? response.data ?? null;
        const order = Array.isArray(raw) ? raw[0] : raw;
        const compact = extractCompactProducts(order);
        return {
          ...compact,
          publicId: getOrderPublicId(order || {}),
          source: url
        };
      }
      lastError = new Error(`OlaClick ${response.status} from ${url}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('OlaClick detail fetch failed');
}

// Helper function to construct cookie header from token structure
export function constructCookieHeader(account) {
  // Create the tokens array structure that matches the working cURL
  const tokenObject = {
    company_token: account.company_token,
    auth_token: account.api_token
  };
  
  const tokensArray = [tokenObject];
  const tokensJson = JSON.stringify(tokensArray);
  const encodedTokens = encodeURIComponent(tokensJson);
  let cookie = `tokens=${encodedTokens}`;
  
  // Add required analytics cookies
  const analyticsCookies = [
    'ajs_user_id=c6867164-f2d8-4b09-ad58-1eeffc1cdc79',
    'ajs_group_id=c6867164-f2d8-4b09-ad58-1eeffc1cdc79',
    'ajs_anonymous_id=3478c56c-b55b-4bc7-a3bc-3a501362b113'
  ].join('; ');
  
  cookie += `; ${analyticsCookies}`;
  
  // Add additional cookies if present
  if (account.additional_cookies) {
    cookie += `; ${account.additional_cookies}`;
  }
  
  return cookie;
}

// Helper function to get timezone-aware date
export function getTimezoneAwareDate(dateString, timezone = config.olaClick.defaultTimezone) {
  // Ensure timezone is valid or use default
  const validTimezone = timezone && timezone !== 'undefined' ? timezone : config.olaClick.defaultTimezone;
  
  if (!dateString) {
    // Return today's date in the specified timezone
    const now = new Date();
    return now.toLocaleDateString('en-CA', { timeZone: validTimezone }); // en-CA gives YYYY-MM-DD format
  }
  
  // If date string is provided, treat it as already being in the target timezone
  // Don't add T00:00:00 which causes UTC interpretation and timezone shifting
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    // Input is already in YYYY-MM-DD format, return as-is
    return dateString;
  }
  
  // For other date formats, try to parse and format
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    // If parsing fails, return today's date
    const now = new Date();
    return now.toLocaleDateString('en-CA', { timeZone: validTimezone });
  }
  
  return date.toLocaleDateString('en-CA', { timeZone: validTimezone });
}

// Helper function to get date N days ago in specific timezone
export function getDateDaysAgoInTimezone(days, timezone = config.olaClick.defaultTimezone) {
  // Ensure timezone is valid or use default
  const validTimezone = timezone && timezone !== 'undefined' ? timezone : config.olaClick.defaultTimezone;
  
  // Get current date in the target timezone first
  const now = new Date();
  const todayInTargetTz = now.toLocaleDateString('en-CA', { timeZone: validTimezone });
  
  // Parse the date and subtract days
  const todayDate = new Date(todayInTargetTz + 'T12:00:00'); // Use noon to avoid timezone edge cases
  const targetDate = new Date(todayDate);
  targetDate.setDate(todayDate.getDate() - days);
  
  return targetDate.toLocaleDateString('en-CA');
}

// Helper function to aggregate data from multiple accounts
export function aggregateAccountsData(accountsData) {
  console.log('📊 Aggregating accounts data:');
  console.log(`   Input accounts count: ${accountsData.length}`);
  
  const aggregated = {};
  let totalPayments = 0;
  let totalAmount = 0;
  let totalTips = 0;
  
  // Process each account's data
  accountsData.forEach((account, index) => {
    console.log(`   Account ${index} (${account.accountKey}): success=${account.success}`);
    
    if (account.success && account.data && account.data.data) {
      console.log(`     Data array length: ${account.data.data.length}`);
      console.log(`     Raw data: ${JSON.stringify(account.data.data)}`);
      
      account.data.data.forEach(paymentMethod => {
        const methodName = paymentMethod.name;
        const count = paymentMethod.count || 0;
        const sum = paymentMethod.sum || 0;
        
        console.log(`     Payment method ${methodName}: count=${count}, sum=${sum}`);
        
        if (!aggregated[methodName]) {
          aggregated[methodName] = {
            name: methodName,
            count: 0,
            sum: 0
          };
        }
        
        aggregated[methodName].count += count;
        aggregated[methodName].sum += sum;
        totalPayments += count;
        totalAmount += sum;
      });
    } else {
      console.log(`     No data or error: ${JSON.stringify(account.error || 'No error info')}`);
    }

    // Process tips data
    if (account.tipsData && account.tipsData.success && account.tipsData.data && account.tipsData.data.data) {
      console.log(`     Tips data array length: ${account.tipsData.data.data.length}`);
      
      account.tipsData.data.data.forEach(tip => {
        const tipAmount = tip.sum || 0;
        totalTips += tipAmount;
        console.log(`     Tip amount: ${tipAmount}`);
      });
    } else {
      console.log(`     No tips data or error: ${JSON.stringify(account.tipsData?.error || 'No tips info')}`);
    }
  });
  
  // Calculate percentages
  Object.values(aggregated).forEach(method => {
    method.percent = totalAmount > 0 ? (method.sum / totalAmount * 100) : 0;
  });
  
  // Sort payment methods by usage (count) in descending order
  const sortedPaymentMethods = Object.values(aggregated).sort((a, b) => b.count - a.count);
  
  const result = {
    paymentMethods: sortedPaymentMethods,
    totalPayments,
    totalAmount,
    totalTips,
    accountsCount: accountsData.filter(acc => acc.success).length
  };
  
  console.log(`   Aggregation result: totalPayments=${totalPayments}, totalAmount=${totalAmount}, totalTips=${totalTips}`);
  return result;
}

// Helper function to calculate comparison between two periods
export function calculateComparison(currentData, previousData) {
  console.log('🧮 Calculating Overall Comparison:');
  console.log(`   Current data length: ${currentData.length}`);
  console.log(`   Previous data length: ${previousData.length}`);
  
  const current = aggregateAccountsData(currentData);
  const previous = aggregateAccountsData(previousData);
  
  console.log(`   Current aggregated: ${JSON.stringify(current)}`);
  console.log(`   Previous aggregated: ${JSON.stringify(previous)}`);
  
  const paymentsDiff = current.totalPayments - previous.totalPayments;
  const paymentsPercent = previous.totalPayments > 0 ? ((paymentsDiff / previous.totalPayments) * 100) : 0;
  
  const amountDiff = current.totalAmount - previous.totalAmount;
  const amountPercent = previous.totalAmount > 0 ? ((amountDiff / previous.totalAmount) * 100) : 0;
  
  const result = {
    payments: {
      current: current.totalPayments,
      previous: previous.totalPayments,
      difference: paymentsDiff,
      percentChange: paymentsPercent,
      trend: paymentsDiff >= 0 ? 'up' : 'down'
    },
    amount: {
      current: current.totalAmount,
      previous: previous.totalAmount,
      difference: amountDiff,
      percentChange: amountPercent,
      trend: amountDiff >= 0 ? 'up' : 'down'
    }
  };
  
  console.log(`   Final comparison result: ${JSON.stringify(result)}`);
  return result;
}

// Helper function to calculate account-specific comparison
export function calculateAccountComparison(currentAccount, previousAccount) {
  let currentPayments = 0;
  let currentAmount = 0;
  let previousPayments = 0;
  let previousAmount = 0;
  
  // Calculate current totals
  if (currentAccount.success && currentAccount.data && currentAccount.data.data) {
    currentAccount.data.data.forEach(method => {
      currentPayments += method.count || 0;
      currentAmount += method.sum || 0;
    });
  }
  
  // Calculate previous totals
  if (previousAccount.success && previousAccount.data && previousAccount.data.data) {
    previousAccount.data.data.forEach(method => {
      previousPayments += method.count || 0;
      previousAmount += method.sum || 0;
    });
  }
  
  const paymentsDiff = currentPayments - previousPayments;
  const paymentsPercent = previousPayments > 0 ? ((paymentsDiff / previousPayments) * 100) : 0;
  
  const amountDiff = currentAmount - previousAmount;
  const amountPercent = previousAmount > 0 ? ((amountDiff / previousAmount) * 100) : 0;
  
  return {
    payments: {
      current: currentPayments,
      previous: previousPayments,
      difference: paymentsDiff,
      percentChange: paymentsPercent,
      trend: paymentsDiff >= 0 ? 'up' : 'down'
    },
    amount: {
      current: currentAmount,
      previous: previousAmount,
      difference: amountDiff,
      percentChange: amountPercent,
      trend: amountDiff >= 0 ? 'up' : 'down'
    }
  };
}

// Helper function to make OlaClick API requests
export async function fetchOlaClickData(account, queryParams = {}) {
  if (!account) {
    throw new Error('Account not found');
  }

  // Get timezone from parameters or default to Lima, ensure it's valid
  let timezone = queryParams['filter[timezone]'] || config.olaClick.defaultTimezone;
  if (!timezone || timezone === 'undefined') {
    timezone = config.olaClick.defaultTimezone;
  }
  
  // Create timezone-aware defaults
  const todayInTimezone = getTimezoneAwareDate(null, timezone);
  
  const defaultParams = {
    'filter[start_time]': '00:00:00',
    'filter[end_time]': '23:59:59',
    'filter[timezone]': timezone,
    'filter[start_date]': todayInTimezone,
    'filter[end_date]': todayInTimezone,
    'filter[time_type]': 'pending_at',
    'filter[status]': 'PENDING,PREPARING,READY,DRIVER_ON_THE_WAY_TO_DESTINATION,CHECK_REQUESTED,CHECK_PRINTED,DRIVER_ARRIVED_AT_DESTINATION,DELIVERED,FINALIZED',
    'filter[max_order_limit]': 'true'
  };

  const params = { ...defaultParams, ...queryParams };

  // Ensure dates are properly formatted for the specified timezone
  if (params['filter[start_date]']) {
    params['filter[start_date]'] = getTimezoneAwareDate(params['filter[start_date]'], timezone);
  }
  if (params['filter[end_date]']) {
    params['filter[end_date]'] = getTimezoneAwareDate(params['filter[end_date]'], timezone);
  }

  // Construct the URL for the request
  const baseUrl = config.olaClick.baseUrl;
  const urlParams = new URLSearchParams(params);
  const fullUrl = `${baseUrl}?${urlParams.toString()}`;

  // Debug logging for API requests
  console.log(`🔍 API Request for ${account.company_token}:`);
  console.log(`   URL: ${fullUrl}`);
  console.log(`   Company Token: ${account.company_token}`);
  console.log(`   API Token: ${account.api_token ? account.api_token.substring(0, 20) + '...' : 'N/A'}`);

  // Construct cookie header
  let cookieHeader;
  try {
    cookieHeader = constructCookieHeader(account);
  } catch (cookieError) {
    console.log(`   ❌ Cookie construction failed: ${cookieError.message}`);
    throw cookieError;
  }

  // Prepare headers
  const headers = {
    'accept': 'application/json,multipart/form-data',
    'accept-language': 'en-US,en;q=0.8',
    'app-company-token': account.company_token,
    'content-type': 'application/json',
    'cookie': cookieHeader,
    'origin': 'https://orders.olaclick.app',
    'referer': 'https://orders.olaclick.app/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
  };

  console.log(`   Cookie: ${cookieHeader.substring(0, 100)}...`);
  console.log(`   Making request...`);

  try {
    const response = await axios.get(baseUrl, {
      params,
      headers
    });

    // Debug logging for API responses
    console.log(`📊 API Response for ${account.company_token}:`);
    console.log(`   Status: ${response.status}`);

    // Normalize API response: map sum_total to sum for backward compatibility
    if (response.data && response.data.data && Array.isArray(response.data.data)) {
      response.data.data = response.data.data.map(method => ({
        ...method,
        sum: method.sum_total ?? method.sum ?? 0
      }));
    }

    // Calculate totals for this response
    let totalPayments = 0;
    let totalAmount = 0;
    if (response.data && response.data.data && Array.isArray(response.data.data)) {
      response.data.data.forEach(method => {
        totalPayments += method.count || 0;
        totalAmount += method.sum || 0;
      });
      console.log(`   Payments: ${totalPayments}, Amount: ${totalAmount}`);
    } else {
      console.log(`   ⚠️  No data in response`);
    }

    console.log(`✅ Request successful for ${account.company_token}`);

    return {
      success: true,
      data: response.data,
      account: account.account_name || account.name || account.company_token,
      accountKey: account.company_token
    };
  } catch (error) {
    console.log(`❌ Request failed for ${account.company_token}: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status} - ${error.response.statusText}`);
      console.log(`   Response: ${JSON.stringify(error.response.data)}`);
      
      // For 401 errors, show auth debugging
      if (error.response.status === 401) {
        console.log(`   🔍 Auth issue - check company_token and api_token`);
      }
    } else if (error.request) {
      console.log(`   Network error - no response received`);
    }

    return {
      success: false,
      error: error.response?.data || error.message,
      account: account.account_name || account.name || account.company_token,
      accountKey: account.company_token
    };
  }
}

// Helper function to fetch general indicators data from OlaClick API
export async function fetchGeneralIndicators(account, queryParams = {}, slaCustomOverrides = {}) {
  if (!account) {
    throw new Error('Account not found');
  }

  // Get timezone from parameters or default to Lima, ensure it's valid
  let timezone = queryParams.timezone || config.olaClick.defaultTimezone;
  if (!timezone || timezone === 'undefined') {
    timezone = config.olaClick.defaultTimezone;
  }
  
  // Always expect explicit dates (no more period-based logic)
  const startDate = queryParams.startDate;
  const endDate = queryParams.endDate;
  
  // Validate required parameters
  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required for general indicators');
  }
  
  // Construct the URL for the request
  // Use the correct orders endpoint with proper parameters
  const baseUrl = 'https://api.olaclick.app/ms-orders/auth/orders';
  const perPage = 100;
  const baseParams = {
    'filter[start_date]': startDate,
    'filter[end_date]': endDate,
    'filter[timezone]': timezone,
    'filter[start_time]': '00:00:00',
    'filter[end_time]': '23:59:59',
    'filter[time_type]': 'pending_at',
    'filter[status]': 'PENDING,PREPARING,READY,DRIVER_ON_THE_WAY_TO_DESTINATION,CHECK_REQUESTED,CHECK_PRINTED,DRIVER_ARRIVED_AT_DESTINATION,DELIVERED,FINALIZED,CANCELLED',
    'filter[max_order_limit]': 'true',
    per_page: perPage
  };

  // Debug logging for API requests
  console.log(`🔍 General Indicators API Request for ${account.company_token}:`);
  console.log(`   URL: ${baseUrl}`);
  console.log(`   Company Token: ${account.company_token}`);
  console.log(`   Start Date: ${startDate}`);
  console.log(`   End Date: ${endDate}`);
  console.log(`   Timezone: ${timezone}`);
  console.log(`   📊 Date range: ${startDate} to ${endDate} (${Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))} days)`);

  // Construct cookie header
  let cookieHeader;
  try {
    cookieHeader = constructCookieHeader(account);
  } catch (cookieError) {
    console.log(`   ❌ Cookie construction failed: ${cookieError.message}`);
    throw cookieError;
  }

  // Prepare headers
  const headers = {
    'accept': 'application/json,multipart/form-data',
    'accept-language': 'en-US,en;q=0.8',
    'app-company-token': account.company_token,
    'content-type': 'application/json',
    'cookie': cookieHeader,
    'origin': 'https://orders.olaclick.app',
    'referer': 'https://orders.olaclick.app/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
  };

  console.log(`   Cookie: ${cookieHeader.substring(0, 100)}...`);
  console.log(`   Making request...`);

  try {
    let allOrders = [];
    let meta = {};
    let page = 1;
    const maxPages = 500;

    while (page <= maxPages) {
      const response = await axios.get(baseUrl, {
        params: { ...baseParams, page },
        headers
      });

      if (page === 1) {
        console.log(`📊 Orders API Response for ${account.company_token}: status ${response.status}`);
      }

      const chunk = response.data?.data;
      meta = response.data?.meta || meta;

      if (!Array.isArray(chunk) || chunk.length === 0) {
        break;
      }

      allOrders = allOrders.concat(chunk);

      const lastPage = Number(meta.last_page ?? meta.lastPage ?? page);
      const currentPage = Number(meta.current_page ?? meta.currentPage ?? page);
      if (Number.isFinite(lastPage) && Number.isFinite(currentPage) && currentPage >= lastPage) {
        break;
      }
      if (chunk.length < perPage) {
        break;
      }
      page += 1;
    }

    console.log(
      `📦 Fetched ${allOrders.length} order rows for kitchen metrics (meta.total=${meta.total ?? 'n'}, pages=${page})`
    );

    // Transform the response to match the expected format for orders
    // Try to process the actual response data
    let transformedData = {
      data: {
        TABLE: { orders: { current_period: 0 }, sales: { current_period: 0 }, average_ticket: { current_period: 0 } },
        ONSITE: { orders: { current_period: 0 }, sales: { current_period: 0 }, average_ticket: { current_period: 0 } },
        TAKEAWAY: { orders: { current_period: 0 }, sales: { current_period: 0 }, average_ticket: { current_period: 0 } },
        DELIVERY: { orders: { current_period: 0 }, sales: { current_period: 0 }, average_ticket: { current_period: 0 } }
      }
    };

    if (allOrders.length > 0 || (meta && (meta.total != null || meta.total_amount != null))) {
      const totalOrders = meta.total ?? allOrders.length;
      const totalSales = meta.total_amount || 0;
      const avgTicket = totalOrders > 0 ? totalSales/totalOrders : 0;

      const kitchenStats = computeKitchenPerformanceFromOrders(allOrders, timezone, slaCustomOverrides);

      console.log(
        `📊 Kitchen Performance: ${kitchenStats.ordersWithPrepTime} orders with prep time, avg: ${kitchenStats.averagePreparationTime.toFixed(1)} min (by service: ${Object.keys(kitchenStats.byServiceType).join(', ') || '—'}; channels: ${Object.keys(kitchenStats.byKitchenChannel || {}).join(', ') || '—'})`
      );

      transformedData = {
        orders: totalOrders,
        sales: totalSales,
        averageTicket: avgTicket,
        kitchenPerformance: {
          averagePreparationTime: kitchenStats.averagePreparationTime,
          ordersWithPrepTime: kitchenStats.ordersWithPrepTime,
          totalOrders,
          byServiceType: kitchenStats.byServiceType,
          byKitchenChannel: kitchenStats.byKitchenChannel,
          byDay: kitchenStats.byDay,
          sla: kitchenStats.sla,
          ordersAnalyzed: allOrders.length
        }
      };

      console.log(
        `📊 Processed ${totalOrders} orders with ${totalSales} total sales, avg prep time: ${kitchenStats.averagePreparationTime.toFixed(1)} min`
      );
    } else {
      console.log(`⚠️  No orders data found in response`);
    }

    console.log(`✅ Orders request successful for ${account.company_token}`);

    return {
      success: true,
      data: transformedData,
      account: account.account_name || account.name || account.company_token,
      accountKey: account.company_token
    };
  } catch (error) {
    console.log(`❌ General Indicators request failed for ${account.company_token}: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status} - ${error.response.statusText}`);
      console.log(`   Response: ${JSON.stringify(error.response.data)}`);
      
      // For 401 errors, show auth debugging
      if (error.response.status === 401) {
        console.log(`   🔍 Auth issue - check company_token and api_token`);
      }
    } else if (error.request) {
      console.log(`   Network error - no response received`);
    }

    return {
      success: false,
      error: error.response?.data || error.message,
      account: account.account_name || account.name || account.company_token,
      accountKey: account.company_token
    };
  }
}

// Helper function to fetch service metrics (only works for "today")
export async function fetchServiceMetrics(account, queryParams = {}) {
  if (!account) {
    throw new Error('Account not found');
  }

  // Get timezone from parameters or default to Lima
  let timezone = queryParams.timezone || config.olaClick.defaultTimezone;
  if (!timezone || timezone === 'undefined') {
    timezone = config.olaClick.defaultTimezone;
  }
  
  // This endpoint only works for "today" period
  const baseUrl = 'https://api.olaclick.app/ms-reports/auth/dashboard/general_indicators';
  const params = {
    period: 'today',
    timezone: timezone
  };
  
  const urlParams = new URLSearchParams(params);
  const fullUrl = `${baseUrl}?${urlParams.toString()}`;

  // Debug logging for API requests
  console.log(`🔍 Service Metrics API Request for ${account.company_token}:`);
  console.log(`   URL: ${fullUrl}`);
  console.log(`   Company Token: ${account.company_token}`);
  console.log(`   Period: today`);
  console.log(`   Timezone: ${timezone}`);

  // Construct cookie header
  let cookieHeader;
  try {
    cookieHeader = constructCookieHeader(account);
  } catch (cookieError) {
    console.log(`   ❌ Cookie construction failed: ${cookieError.message}`);
    throw cookieError;
  }

  // Prepare headers
  const headers = {
    'accept': 'application/json,multipart/form-data',
    'accept-language': 'en-US,en;q=0.8',
    'app-company-token': account.company_token,
    'content-type': 'application/json',
    'cookie': cookieHeader,
    'origin': 'https://orders.olaclick.app',
    'referer': 'https://orders.olaclick.app/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
  };

  console.log(`   Cookie: ${cookieHeader.substring(0, 100)}...`);
  console.log(`   Making request...`);

  try {
    const response = await axios.get(baseUrl, {
      params,
      headers
    });

    // Debug logging for API responses
    console.log(`📊 Service Metrics API Response for ${account.company_token}:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Data: ${JSON.stringify(response.data)}`);

    console.log(`✅ Service Metrics request successful for ${account.company_token}`);

    return {
      success: true,
      data: response.data,
      account: account.account_name || account.name || account.company_token,
      accountKey: account.company_token
    };
  } catch (error) {
    console.log(`❌ Service Metrics request failed for ${account.company_token}: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status} - ${error.response.statusText}`);
      console.log(`   Response: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.log(`   Network error - no response received`);
    }

    return {
      success: false,
      error: error.response?.data || error.message,
      account: account.account_name || account.name || account.company_token,
      accountKey: account.company_token
    };
  }
}

// Helper function to make tips API requests
export async function fetchTipsData(account, queryParams = {}) {
  if (!account) {
    throw new Error('Account not found');
  }

  // Get timezone from parameters or default to Lima, ensure it's valid
  let timezone = queryParams['filter[timezone]'] || config.olaClick.defaultTimezone;
  if (!timezone || timezone === 'undefined') {
    timezone = config.olaClick.defaultTimezone;
  }
  
  // Create timezone-aware defaults
  const todayInTimezone = getTimezoneAwareDate(null, timezone);
  
  const defaultParams = {
    'filter[start_time]': '00:00:00',
    'filter[end_time]': '23:59:59',
    'filter[timezone]': timezone,
    'filter[start_date]': todayInTimezone,
    'filter[end_date]': todayInTimezone,
    'filter[time_type]': 'pending_at',
    'filter[status]': 'PENDING,PREPARING,READY,DRIVER_ON_THE_WAY_TO_DESTINATION,CHECK_REQUESTED,CHECK_PRINTED,DRIVER_ARRIVED_AT_DESTINATION,DELIVERED,FINALIZED',
    'filter[max_order_limit]': 'true'
  };

  const params = { ...defaultParams, ...queryParams };

  // Ensure dates are properly formatted for the specified timezone
  if (params['filter[start_date]']) {
    params['filter[start_date]'] = getTimezoneAwareDate(params['filter[start_date]'], timezone);
  }
  if (params['filter[end_date]']) {
    params['filter[end_date]'] = getTimezoneAwareDate(params['filter[end_date]'], timezone);
  }

  // Construct the URL for the tips request
  const baseUrl = 'https://api.olaclick.app/ms-orders/auth/orders/by_tips';
  const urlParams = new URLSearchParams(params);
  const fullUrl = `${baseUrl}?${urlParams.toString()}`;

  // Debug logging for API requests
  console.log(`🎯 Tips API Request for ${account.company_token}:`);
  console.log(`   URL: ${fullUrl}`);
  console.log(`   Company Token: ${account.company_token}`);
  console.log(`   API Token: ${account.api_token ? account.api_token.substring(0, 20) + '...' : 'N/A'}`);

  // Construct cookie header
  let cookieHeader;
  try {
    cookieHeader = constructCookieHeader(account);
  } catch (cookieError) {
    console.log(`   ❌ Cookie construction failed: ${cookieError.message}`);
    throw cookieError;
  }

  // Prepare headers
  const headers = {
    'accept': 'application/json,multipart/form-data',
    'accept-language': 'en-US,en;q=0.8',
    'app-company-token': account.company_token,
    'content-type': 'application/json',
    'cookie': cookieHeader,
    'origin': 'https://orders.olaclick.app',
    'referer': 'https://orders.olaclick.app/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
  };

  console.log(`   Cookie: ${cookieHeader.substring(0, 100)}...`);
  console.log(`   Making tips request...`);

  try {
    const response = await axios.get(baseUrl, {
      params,
      headers
    });

    // Debug logging for API responses
    console.log(`🎯 Tips API Response for ${account.company_token}:`);
    console.log(`   Status: ${response.status}`);
    
    // Calculate total tips for this response
    let totalTips = 0;
    if (response.data && response.data.data && Array.isArray(response.data.data)) {
      response.data.data.forEach(tip => {
        totalTips += tip.sum || 0;
      });
      console.log(`   Total Tips: ${totalTips}`);
    } else {
      console.log(`   ⚠️  No tips data in response`);
    }

    console.log(`✅ Tips request successful for ${account.company_token}`);

    return {
      success: true,
      data: response.data,
      account: account.account_name || account.name || account.company_token,
      accountKey: account.company_token
    };
  } catch (error) {
    console.log(`❌ Tips request failed for ${account.company_token}: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status} - ${error.response.statusText}`);
      console.log(`   Response: ${JSON.stringify(error.response.data)}`);
      
      // For 401 errors, show auth debugging
      if (error.response.status === 401) {
        console.log(`   🔍 Auth issue - check company_token and api_token`);
      }
    } else if (error.request) {
      console.log(`   Network error - no response received`);
    }

    return {
      success: false,
      error: error.response?.data || error.message,
      account: account.account_name || account.name || account.company_token,
      accountKey: account.company_token
    };
  }
} 