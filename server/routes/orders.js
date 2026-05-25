import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  fetchGeneralIndicators,
  fetchServiceMetrics,
  fetchOrderProducts
} from '../services/olaClickService.js';
import {
  fetchKitchenSlaTargetsByTokens,
  upsertKitchenSlaTargets,
  KITCHEN_SLA_DEFAULT_MINUTES,
  buildResolvedPreset
} from '../services/kitchenSlaService.js';
import { config } from '../config/index.js';
import { pool } from '../database.js';

const router = Router();

/** Merge kitchen/SLA metrics across all accounts for company-wide view */
function buildCompanyKitchenAggregate(accountsPayload) {
  const list = (accountsPayload || []).filter((a) => a.kitchenPerformance?.ordersWithPrepTime > 0);
  if (list.length === 0) return null;

  let totalPrepMin = 0;
  let totalPrepCount = 0;
  let ordersAnalyzed = 0;
  let slaOnTime = 0;
  let slaScored = 0;
  /** @type {Record<string, { totalMinutes: number; count: number; onTimeCount: number; targetWeighted: number }>} */
  const chAgg = {};
  /** @type {Record<string, { totalMinutes: number; count: number; onTimeCount: number; scoredCount: number }>} */
  const dayMap = {};
  /** @type {Array<Record<string, unknown>>} */
  const breaches = [];

  for (const acc of list) {
    const kp = acc.kitchenPerformance;
    totalPrepMin += kp.averagePreparationTime * kp.ordersWithPrepTime;
    totalPrepCount += kp.ordersWithPrepTime;
    ordersAnalyzed += kp.ordersAnalyzed || 0;

    for (const [ch, row] of Object.entries(kp.byKitchenChannel || {})) {
      if (!chAgg[ch]) {
        chAgg[ch] = { totalMinutes: 0, count: 0, onTimeCount: 0, targetWeighted: 0 };
      }
      const c = row.ordersWithPrepTime;
      chAgg[ch].totalMinutes += row.averagePreparationTime * c;
      chAgg[ch].count += c;
      if (row.onTimeCount != null) chAgg[ch].onTimeCount += row.onTimeCount;
      if (row.targetMinutes != null) chAgg[ch].targetWeighted += row.targetMinutes * c;
    }

    for (const d of kp.byDay || []) {
      if (!dayMap[d.date]) {
        dayMap[d.date] = { totalMinutes: 0, count: 0, onTimeCount: 0, scoredCount: 0 };
      }
      const c = d.ordersWithPrepTime;
      dayMap[d.date].totalMinutes += d.averagePreparationTime * c;
      dayMap[d.date].count += c;
      if (d.onTimeCount != null) {
        dayMap[d.date].onTimeCount += d.onTimeCount;
        dayMap[d.date].scoredCount += d.scoredOrders || 0;
      }
    }

    if (kp.sla) {
      slaOnTime += kp.sla.onTimeOrders || 0;
      slaScored += kp.sla.totalScoredOrders || 0;
    }
    for (const b of kp.sla?.slaBreaches || []) {
      breaches.push({
        ...b,
        accountKey: acc.accountKey,
        accountName: acc.account
      });
    }
  }

  const byKitchenChannel = {};
  for (const [ch, b] of Object.entries(chAgg)) {
    const onTimeRate = b.count > 0 ? b.onTimeCount / b.count : 0;
    const targetM =
      b.targetWeighted > 0 && b.count > 0 ? Math.round((b.targetWeighted / b.count) * 10) / 10 : null;
    byKitchenChannel[ch] = {
      averagePreparationTime: b.totalMinutes / b.count,
      ordersWithPrepTime: b.count,
      targetMinutes: targetM,
      onTimeCount: b.onTimeCount,
      onTimeRate,
      slaScore: Math.round(onTimeRate * 100)
    };
  }

  const channelRanking = Object.entries(byKitchenChannel)
    .map(([channelKey, v]) => ({ channelKey, ...v }))
    .filter((x) => x.ordersWithPrepTime > 0)
    .sort((a, b) => (a.onTimeRate ?? 0) - (b.onTimeRate ?? 0));

  breaches.sort((a, b) => (b.delayOverTargetMinutes || 0) - (a.delayOverTargetMinutes || 0));
  const breachTotal = breaches.length;
  const MAX_CO = 200;
  const slaBreaches = breaches.slice(0, MAX_CO);

  const byDay = Object.keys(dayMap)
    .sort()
    .map((date) => {
      const d = dayMap[date];
      return {
        date,
        averagePreparationTime: d.totalMinutes / d.count,
        ordersWithPrepTime: d.count,
        onTimeCount: d.onTimeCount,
        scoredOrders: d.scoredCount,
        onTimeRate: d.scoredCount > 0 ? d.onTimeCount / d.scoredCount : 0
      };
    });

  const overallOnTimeRate = slaScored > 0 ? slaOnTime / slaScored : 0;

  return {
    averagePreparationTime: totalPrepCount > 0 ? totalPrepMin / totalPrepCount : 0,
    ordersWithPrepTime: totalPrepCount,
    byKitchenChannel,
    byDay,
    ordersAnalyzed,
    accountsInKitchenAgg: list.length,
    sla: {
      overallOnTimeRate,
      overallSlaScore: slaScored > 0 ? Math.round(overallOnTimeRate * 100) : 0,
      onTimeOrders: slaOnTime,
      totalScoredOrders: slaScored,
      channelRanking,
      slaBreaches,
      slaBreachTotal: breachTotal,
      slaBreachesTruncated: breachTotal > MAX_CO
    }
  };
}

// Helper function to aggregate orders data
function aggregateOrdersData(accountsData) {
  console.log('📊 Aggregating orders data:');
  console.log(`   Input accounts count: ${accountsData.length}`);
  
  if (!accountsData || accountsData.length === 0) {
    return {
      totalOrders: 0,
      totalSales: 0,
      averageTicket: 0,
      accounts: [],
      companyKitchen: null
    };
  }
  
  let totalOrders = 0;
  let totalSales = 0;
  const accounts = [];
  
  accountsData.forEach((account, index) => {
    console.log(`   Account ${index} (${account.accountKey}): success=${account.success}`);
    
    if (account.success && account.data) {
      const data = account.data;
      console.log(`     Raw data: ${JSON.stringify(data)}`);
      
      // Extract simple orders and sales data
      const accountOrders = data.orders || 0;
      const accountSales = data.sales || 0;
      const accountAvgTicket = data.averageTicket || 0;
      const kitchenPerformance = data.kitchenPerformance || {
        averagePreparationTime: 0,
        ordersWithPrepTime: 0,
        totalOrders: 0,
        byServiceType: {},
        byKitchenChannel: {},
        byDay: [],
        sla: null,
        ordersAnalyzed: 0
      };
      
      totalOrders += accountOrders;
      totalSales += accountSales;
      
      accounts.push({
        account: account.account,
        accountKey: account.accountKey,
        orders: accountOrders,
        sales: accountSales,
        averageTicket: accountAvgTicket,
        kitchenPerformance: kitchenPerformance
      });
      
      console.log(`     Orders: ${accountOrders}, Sales: ${accountSales}, Avg Ticket: ${accountAvgTicket}`);
    } else {
      console.log(`     No data or error: ${JSON.stringify(account.error || 'No error info')}`);
    }
  });
  
  const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
  
  console.log(`   Aggregation result: totalOrders=${totalOrders}, totalSales=${totalSales}, averageTicket=${averageTicket}`);
  
  const companyKitchen = buildCompanyKitchenAggregate(accounts);

  return {
    totalOrders,
    totalSales,
    averageTicket,
    accounts,
    companyKitchen
  };
}


// Helper function to validate date format and ensure it's a valid date
function isValidDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }
  
  // Check for YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }
  
  // Check if it's a valid date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return false;
  }
  
  // Additional validation: ensure the parsed date matches the input string
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  
  return formattedDate === dateStr;
}

// Get order data from all user's accounts
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('🚀 Starting /api/orders request');
    const queryParams = req.query;
    console.log(`   Original query params: ${JSON.stringify(queryParams)}`);
    
    // Resolve accessible accounts from company tenancy
    const requestedCompanyId = req.query.company_id || null;
    const requestedToken = req.query.company_token || null;
    let rows = [];
    if (req.user.role === 'super-admin') {
      if (requestedCompanyId) {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts WHERE company_id = $1 ORDER BY account_name`,
          [requestedCompanyId]
        );
        rows = q.rows;
      } else {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts ORDER BY account_name`
        );
        rows = q.rows;
      }
    } else {
      const companyId = req.user.companyId;
      if (requestedCompanyId && requestedCompanyId !== companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      if (companyId) {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts WHERE company_id = $1 ORDER BY account_name`,
          [companyId]
        );
        rows = q.rows;
      }
    }
    if (requestedToken) {
      rows = rows.filter(r => r.company_token === requestedToken);
    }
    const userAccounts = rows.map(r => ({
      company_id: r.company_id,
      company_token: r.company_token,
      account_name: r.account_name,
      api_token: r.api_token
    }));
    let userTimezone = req.user.userTimezone || config.olaClick.defaultTimezone;
    
    // Ensure timezone is valid
    if (!userTimezone || userTimezone === 'undefined' || userTimezone === 'null') {
      userTimezone = config.olaClick.defaultTimezone;
    }
    
    console.log(`   User timezone: ${userTimezone}`);
    
    if (userAccounts.length === 0) {
      return res.status(404).json({ success: false, error: 'No accounts found for user' });
    }
    
    // Extract and flatten filter parameters (same logic as other endpoints)
    let baseParams = {};
    if (queryParams.filter && typeof queryParams.filter === 'object') {
      // Frontend sent nested filter object
      Object.keys(queryParams.filter).forEach(key => {
        baseParams[`filter[${key}]`] = queryParams.filter[key];
      });
      console.log('📋 Extracted nested filter parameters');
    } else {
      // Frontend sent flat parameters
      Object.keys(queryParams).forEach(key => {
        if (key.startsWith('filter[')) {
          baseParams[key] = queryParams[key];
        }
      });
      console.log('📋 Using flat filter parameters');
    }
    
    // Extract parameters - always expect explicit dates
    const timezone = baseParams['filter[timezone]'] || userTimezone;
    const startDate = baseParams['filter[start_date]'];
    const endDate = baseParams['filter[end_date]'];
    
    // Debug: Log the extracted parameters
    console.log(`   Base filter params: ${JSON.stringify(baseParams)}`);
    console.log(`   Extracted timezone: ${timezone}`);
    console.log(`   Extracted startDate: ${startDate}`);
    console.log(`   Extracted endDate: ${endDate}`);
    
    // Validate required date parameters
    if (!startDate || !endDate) {
      console.log(`   ❌ Missing parameters - startDate: ${startDate}, endDate: ${endDate}`);
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required. Use filter[start_date] and filter[end_date] parameters.'
      });
    }
    
    // Validate date format and validity
    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      console.log(`   ❌ Invalid date format - startDate: ${startDate}, endDate: ${endDate}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Dates must be in YYYY-MM-DD format and valid.',
        details: {
          startDate: startDate,
          endDate: endDate,
          startDateValid: isValidDateString(startDate),
          endDateValid: isValidDateString(endDate)
        }
      });
    }
    
    console.log(`   Timezone: ${timezone}`);
    console.log(`   Start date: ${startDate}`);
    console.log(`   End date: ${endDate}`);
    
    // Fetch current period data
    console.log('🔄 Fetching current period order data...');
    console.log(`   📅 Date range: ${startDate} to ${endDate}`);
    console.log(`   📅 Days difference: ${Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))} days`);
    
    const tokens = userAccounts.map((a) => a.company_token);
    const slaByToken = await fetchKitchenSlaTargetsByTokens(tokens);

    const currentPromises = userAccounts.map(account => {
      const params = { 
        timezone,
        startDate,
        endDate
      };
      const slaOverrides = slaByToken.get(account.company_token) || {};
      console.log(`   🔍 Account ${account.company_token}: params=${JSON.stringify(params)}`);
      return fetchGeneralIndicators(account, params, slaOverrides);
    });
    
    const currentResults = await Promise.all(currentPromises);
    
    // Process and aggregate the data
    const currentAggregated = aggregateOrdersData(currentResults);
    
    console.log('📈 Aggregated Order Data:');
    console.log(`   Total Orders: ${currentAggregated.totalOrders}, Total Sales: ${currentAggregated.totalSales}`);
    
    res.json({
      success: true,
      accounts: currentAggregated.accounts,
      aggregated: {
        totalOrders: currentAggregated.totalOrders,
        totalSales: currentAggregated.totalSales,
        averageTicket: currentAggregated.averageTicket,
        accountsCount: currentAggregated.accounts.length,
        companyKitchen: currentAggregated.companyKitchen
      },
      timezone
    });
    
  } catch (error) {
    console.error('❌ Orders endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/** Load per-account kitchen SLA target overrides (defaults + saved targets). */
router.get('/kitchen-sla', requireAuth, async (req, res) => {
  try {
    const requestedCompanyId = req.query.company_id || null;
    const requestedToken = req.query.company_token || null;
    let rows = [];
    if (req.user.role === 'super-admin') {
      if (requestedCompanyId) {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts WHERE company_id = $1 ORDER BY account_name`,
          [requestedCompanyId]
        );
        rows = q.rows;
      } else {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts ORDER BY account_name`
        );
        rows = q.rows;
      }
    } else {
      const companyId = req.user.companyId;
      if (requestedCompanyId && requestedCompanyId !== companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      if (companyId) {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts WHERE company_id = $1 ORDER BY account_name`,
          [companyId]
        );
        rows = q.rows;
      }
    }
    if (requestedToken) {
      rows = rows.filter((r) => r.company_token === requestedToken);
    }
    const accounts = rows.map((r) => ({
      company_id: r.company_id,
      company_token: r.company_token,
      account_name: r.account_name,
      api_token: r.api_token
    }));

    if (accounts.length === 0) {
      return res.status(404).json({ success: false, error: 'No accounts found for user' });
    }

    const tokens = accounts.map((a) => a.company_token);
    const slaMap = await fetchKitchenSlaTargetsByTokens(tokens);
    const payload = accounts.map((a) => {
      const ov = slaMap.get(a.company_token) || {};
      return {
        company_token: a.company_token,
        account_name: a.account_name,
        overrides: ov,
        resolvedPreset: buildResolvedPreset(ov)
      };
    });

    res.json({
      success: true,
      defaults: KITCHEN_SLA_DEFAULT_MINUTES,
      accounts: payload
    });
  } catch (error) {
    console.error('❌ kitchen-sla GET error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Save per-account kitchen SLA minute overrides (partial map merged server-side is not done — send full map from client). */
router.put('/kitchen-sla', requireAuth, async (req, res) => {
  try {
    const company_token = req.body?.company_token;
    const targets = req.body?.targets;
    if (!company_token || typeof company_token !== 'string') {
      return res.status(400).json({ success: false, error: 'company_token is required' });
    }
    if (targets != null && typeof targets !== 'object') {
      return res.status(400).json({ success: false, error: 'targets must be an object' });
    }

    const requestedCompanyId = req.body?.company_id || req.query.company_id || null;
    const requestedToken = req.query.company_token || null;
    let rows = [];
    if (req.user.role === 'super-admin') {
      if (requestedCompanyId) {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts WHERE company_id = $1 ORDER BY account_name`,
          [requestedCompanyId]
        );
        rows = q.rows;
      } else {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts ORDER BY account_name`
        );
        rows = q.rows;
      }
    } else {
      const companyId = req.user.companyId;
      if (requestedCompanyId && requestedCompanyId !== companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      if (companyId) {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts WHERE company_id = $1 ORDER BY account_name`,
          [companyId]
        );
        rows = q.rows;
      }
    }
    if (requestedToken) {
      rows = rows.filter((r) => r.company_token === requestedToken);
    }
    const acc = rows.find((r) => r.company_token === company_token);
    if (!acc) {
      return res.status(403).json({ success: false, error: 'Unknown account or access denied' });
    }

    const cleaned = await upsertKitchenSlaTargets(company_token, acc.company_id, targets || {});
    res.json({
      success: true,
      company_token,
      targets: cleaned,
      resolvedPreset: buildResolvedPreset(cleaned)
    });
  } catch (error) {
    console.error('❌ kitchen-sla PUT error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get service metrics data (only available for "today")
router.get('/service-metrics', requireAuth, async (req, res) => {
  try {
    console.log(`📊 Service Metrics request received`);
    console.log(`   Query params: ${JSON.stringify(req.query)}`);
    
    // Resolve accessible accounts similar to /api/orders
    const requestedCompanyId = req.query.company_id || null;
    const requestedToken = req.query.company_token || null;
    let rows = [];
    if (req.user.role === 'super-admin') {
      if (requestedCompanyId) {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts WHERE company_id = $1 ORDER BY account_name`,
          [requestedCompanyId]
        );
        rows = q.rows;
      } else {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts ORDER BY account_name`
        );
        rows = q.rows;
      }
    } else {
      const companyId = req.user.companyId;
      if (requestedCompanyId && requestedCompanyId !== companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      if (companyId) {
        const q = await pool.query(
          `SELECT company_id, company_token, account_name, api_token FROM company_accounts WHERE company_id = $1 ORDER BY account_name`,
          [companyId]
        );
        rows = q.rows;
      }
    }
    if (requestedToken) {
      rows = rows.filter(r => r.company_token === requestedToken);
    }
    const userAccounts = rows.map(r => ({
      company_id: r.company_id,
      company_token: r.company_token,
      account_name: r.account_name,
      api_token: r.api_token
    }));

    if (!userAccounts || userAccounts.length === 0) {
      return res.status(404).json({ success: false, error: 'No accounts found for user' });
    }
    
    console.log(`📊 Service Metrics - Found ${userAccounts.length} accounts`);
    
    // Fetch service metrics for all accounts
    const serviceMetricsPromises = userAccounts.map(account => 
      fetchServiceMetrics(account, {
        timezone: req.query.timezone || config.olaClick.defaultTimezone
      })
    );
    
    const serviceMetricsResults = await Promise.all(serviceMetricsPromises);
    
    console.log(`📊 Service Metrics Results:`);
    console.log(`   Results count: ${serviceMetricsResults.length}`);
    
    serviceMetricsResults.forEach((result, index) => {
      console.log(`   Account ${index} (${result.account}): success=${result.success}`);
      if (result.success && result.data) {
        console.log(`     Data: ${JSON.stringify(result.data)}`);
      }
    });
    
    // Aggregate service metrics data
    const aggregatedData = aggregateServiceMetricsData(serviceMetricsResults);
    
    console.log(`📊 Aggregated Service Metrics Data:`, aggregatedData);
    
    res.json({
      success: true,
      data: aggregatedData
    });
    
  } catch (error) {
    console.error(`❌ Service Metrics error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to aggregate service metrics data
function aggregateServiceMetricsData(accountsData) {
  if (!accountsData || accountsData.length === 0) {
    return {
      TABLE: { orders: 0, sales: 0, average_ticket: 0 },
      ONSITE: { orders: 0, sales: 0, average_ticket: 0 },
      TAKEAWAY: { orders: 0, sales: 0, average_ticket: 0 },
      DELIVERY: { orders: 0, sales: 0, average_ticket: 0 }
    };
  }
  
  const aggregated = {
    TABLE: { orders: 0, sales: 0, average_ticket: 0 },
    ONSITE: { orders: 0, sales: 0, average_ticket: 0 },
    TAKEAWAY: { orders: 0, sales: 0, average_ticket: 0 },
    DELIVERY: { orders: 0, sales: 0, average_ticket: 0 }
  };
  
  let totalOrders = 0;
  let totalSales = 0;
  
  accountsData.forEach(account => {
    if (account.success && account.data && account.data.data) {
      const data = account.data.data;
      
      // Process each service type
      Object.keys(data).forEach(serviceType => {
        const serviceData = data[serviceType];
        if (serviceData && serviceData.orders && serviceData.sales) {
          const orders = serviceData.orders.current_period || 0;
          const sales = serviceData.sales.current_period || 0;
          const avgTicket = orders > 0 ? sales / orders : 0;
          
          aggregated[serviceType].orders += orders;
          aggregated[serviceType].sales += sales;
          aggregated[serviceType].average_ticket = avgTicket;
          
          totalOrders += orders;
          totalSales += sales;
        }
      });
    }
  });
  
  // Calculate overall average ticket
  const overallAvgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
  
  console.log(`📊 Service Metrics Aggregation:`);
  console.log(`   Total Orders: ${totalOrders}`);
  console.log(`   Total Sales: ${totalSales}`);
  console.log(`   Overall Avg Ticket: ${overallAvgTicket}`);
  
  return aggregated;
}

/**
 * Per-order product peek for the per-account SLA-breach drill-down. Lazy: we
 * only hit OlaClick when an operator expands a row, so the main dashboard
 * aggregation stays cheap. Scope is the same as other order routes — the
 * caller's company must own the requested company_token.
 */
router.get('/:companyToken/:orderId/products', requireAuth, async (req, res) => {
  try {
    const { companyToken, orderId } = req.params;
    if (!companyToken || !orderId) {
      return res
        .status(400)
        .json({ success: false, error: 'companyToken and orderId are required' });
    }

    let row = null;
    if (req.user.role === 'super-admin') {
      const q = await pool.query(
        `SELECT company_id, company_token, account_name, api_token
         FROM company_accounts WHERE company_token = $1 LIMIT 1`,
        [companyToken]
      );
      row = q.rows[0] || null;
    } else {
      const companyId = req.user.companyId;
      if (!companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      const q = await pool.query(
        `SELECT company_id, company_token, account_name, api_token
         FROM company_accounts WHERE company_token = $1 AND company_id = $2 LIMIT 1`,
        [companyToken, companyId]
      );
      row = q.rows[0] || null;
    }
    if (!row) {
      return res
        .status(404)
        .json({ success: false, error: 'Account not found or access denied' });
    }

    const account = {
      company_token: row.company_token,
      account_name: row.account_name,
      api_token: row.api_token
    };

    const detail = await fetchOrderProducts(account, orderId);
    return res.json({
      success: true,
      orderId,
      publicId: detail.publicId || null,
      products: detail.products,
      productsTruncated: !!detail.productsTruncated,
      totalCount: detail.totalCount || 0
    });
  } catch (error) {
    console.error('❌ Order products endpoint error:', error?.message || error);
    return res.status(502).json({
      success: false,
      error: 'Failed to fetch order products from OlaClick',
      detail: error?.message || String(error)
    });
  }
});

export default router; 