import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  fetchOlaClickData,
  fetchGeneralIndicators,
  fetchTipsData,
  aggregateAccountsData,
  calculateComparison,
  calculateAccountComparison,
  getTimezoneAwareDate,
  getDateDaysAgoInTimezone
} from '../services/olaClickService.js';
import { config } from '../config/index.js';

const router = Router();

// Helper function to get user's accounts as a map
function getUserAccountsMap(userAccounts) {
  const accountsMap = {};
  if (userAccounts && Array.isArray(userAccounts)) {
    userAccounts.forEach(account => {
      accountsMap[account.company_token] = account;
    });
  }
  return accountsMap;
}

// Get payment data from all user's accounts
router.get('/all', requireAuth, async (req, res) => {
  try {
    console.log('🚀 Starting /api/payments/all request');
    const queryParams = req.query;
    console.log(`   Original query params: ${JSON.stringify(queryParams)}`);
    
    // Get user's accounts and timezone with safe fallbacks
    const userAccounts = req.user.userAccounts || [];
    let userTimezone = req.user.userTimezone || config.olaClick.defaultTimezone;
    
    // Ensure timezone is valid
    if (!userTimezone || userTimezone === 'undefined' || userTimezone === 'null') {
      userTimezone = config.olaClick.defaultTimezone;
    }
    
    console.log(`   User timezone: ${userTimezone}`);
    
    if (userAccounts.length === 0) {
      return res.json({
        success: true,
        accounts: [],
        aggregated: {
          paymentMethods: [],
          totalPayments: 0,
          totalAmount: 0,
          accountsCount: 0
        },
        comparison: null,
        message: 'No accounts assigned to this user'
      });
    }
    
    // Extract and flatten filter parameters
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
    
    // Use user's timezone if not specified, ensure it's valid
    if (!baseParams['filter[timezone]'] || baseParams['filter[timezone]'] === 'undefined') {
      baseParams['filter[timezone]'] = userTimezone;
    }
    
    console.log(`   Base filter params: ${JSON.stringify(baseParams)}`);
    
    // Get current period parameters
    const currentParams = { ...baseParams };
    
    // Get previous period parameters (7 days ago)
    const previousParams = { ...baseParams };
    
    if (currentParams['filter[start_date]'] && currentParams['filter[end_date]']) {
      console.log('📅 Using provided date range');
      
      // Get timezone from parameters, ensure it's valid
      let timezone = currentParams['filter[timezone]'] || config.olaClick.defaultTimezone;
      if (!timezone || timezone === 'undefined') {
        timezone = config.olaClick.defaultTimezone;
      }
      
      // Use timezone-aware date processing
      const startDateStr = currentParams['filter[start_date]'];
      const endDateStr = currentParams['filter[end_date]'];
      
      console.log(`   Provided start date: ${startDateStr}`);
      console.log(`   Provided end date: ${endDateStr}`);
      console.log(`   Using timezone: ${timezone}`);
      
      // Create timezone-aware dates
      const startDate = new Date(startDateStr + 'T00:00:00');
      const endDate = new Date(endDateStr + 'T00:00:00');
      
      // Calculate the number of days in the current period
      const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
      // For comparison, we want to go back exactly one week from the START of the period
      // This ensures consistent comparison baseline
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(startDate.getDate() - 7);
      
      // The previous period should have the same duration as current period
      const prevEndDate = new Date(prevStartDate);
      prevEndDate.setDate(prevStartDate.getDate() + periodDays - 1);
      
      // Format dates for the specific timezone
      previousParams['filter[start_date]'] = prevStartDate.toLocaleDateString('en-CA', { timeZone: timezone });
      previousParams['filter[end_date]'] = prevEndDate.toLocaleDateString('en-CA', { timeZone: timezone });
      
      console.log(`   Period duration: ${periodDays} days`);
      console.log(`   Calculated previous start: ${previousParams['filter[start_date]']}`);
      console.log(`   Calculated previous end: ${previousParams['filter[end_date]']}`);
      console.log(`   📅 Comparison: ${startDateStr} to ${endDateStr} vs ${previousParams['filter[start_date]']} to ${previousParams['filter[end_date]']}`);
    } else {
      console.log('📅 Using default date ranges (today vs same day last week)');
      
      // Get timezone from parameters or default to Lima, ensure it's valid
      let timezone = currentParams['filter[timezone]'] || config.olaClick.defaultTimezone;
      if (!timezone || timezone === 'undefined') {
        timezone = config.olaClick.defaultTimezone;
      }
      
      // Use timezone-aware date calculation
      const todayInTimezone = getTimezoneAwareDate(null, timezone);
      const sameDayLastWeekInTimezone = getDateDaysAgoInTimezone(7, timezone);
      
      currentParams['filter[start_date]'] = todayInTimezone;
      currentParams['filter[end_date]'] = todayInTimezone;
      previousParams['filter[start_date]'] = sameDayLastWeekInTimezone;
      previousParams['filter[end_date]'] = sameDayLastWeekInTimezone;
      
      console.log(`   Using timezone: ${timezone}`);
      console.log(`   Today in ${timezone}: ${todayInTimezone}`);
      console.log(`   Same day last week in ${timezone}: ${sameDayLastWeekInTimezone}`);
      console.log(`   📅 Comparison: Today vs Same Day Last Week`);
    }
    
    console.log('📋 Final parameter sets:');
    console.log(`   Current params: ${JSON.stringify(currentParams)}`);
    console.log(`   Previous params: ${JSON.stringify(previousParams)}`);
    
    // Fetch current period data
    console.log('🔄 Fetching current period data...');
    const currentPromises = userAccounts.map(account => 
      fetchOlaClickData(account, currentParams)
    );
    
    // Fetch previous period data
    console.log('🔄 Fetching previous period data...');
    const previousPromises = userAccounts.map(account => 
      fetchOlaClickData(account, previousParams)
    );
    
    // Fetch service metrics for each account (current period only)
    console.log('🔄 Fetching service metrics for each account...');
    const serviceMetricsPromises = userAccounts.map(account => {
      const serviceMetricsParams = { timezone: baseParams['filter[timezone]'] };
      
      if (currentParams['filter[start_date]'] && currentParams['filter[end_date]']) {
        // Always use custom dates when provided - let the API handle them directly
        const startDate = currentParams['filter[start_date]'];
        const endDate = currentParams['filter[end_date]'];
        
        serviceMetricsParams.startDate = startDate;
        serviceMetricsParams.endDate = endDate;
        
        console.log(`   Using custom date range: ${startDate} to ${endDate}`);
      } else {
        // Fallback to 'today' for when no dates are specified
        serviceMetricsParams.period = 'today';
        console.log(`   Using default period: today`);
      }
      
      return fetchGeneralIndicators(account, serviceMetricsParams);
    });

    // Fetch tips data for each account (current period only)
    console.log('🔄 Fetching tips data for each account...');
    const tipsPromises = userAccounts.map(account => 
      fetchTipsData(account, currentParams)
    );
    
    const [currentResults, previousResults, serviceMetricsResults, tipsResults] = await Promise.all([
      Promise.all(currentPromises),
      Promise.all(previousPromises),
      Promise.all(serviceMetricsPromises),
      Promise.all(tipsPromises)
    ]);
    
    // Attach service metrics and tips data to each account
    const accountsWithServiceMetrics = currentResults.map((account, idx) => {
      const serviceMetrics = serviceMetricsResults[idx]?.data?.data || null;
      const tipsData = tipsResults[idx];
      
      console.log(`📊 Account ${account.accountKey}: Service metrics available = ${!!serviceMetrics}`);
      if (serviceMetrics) {
        console.log(`   Service metrics keys: ${Object.keys(serviceMetrics).join(', ')}`);
      }
      
      console.log(`🎯 Account ${account.accountKey}: Tips data available = ${!!tipsData?.success}`);
      if (tipsData?.success && tipsData.data?.data) {
        const totalTips = tipsData.data.data.reduce((sum, tip) => sum + (tip.sum || 0), 0);
        console.log(`   Total tips: ${totalTips}`);
      }
      
      return {
        ...account,
        serviceMetrics,
        tipsData
      };
    });
    
    // Debug logging
    console.log('📊 Comparison Debug Info:');
    console.log(`   Current period: ${currentParams['filter[start_date]']} to ${currentParams['filter[end_date]']}`);
    console.log(`   Previous period: ${previousParams['filter[start_date]']} to ${previousParams['filter[end_date]']}`);
    console.log(`   Current results count: ${currentResults.length}`);
    console.log(`   Previous results count: ${previousResults.length}`);
    
    // Calculate aggregated data for current period
    const currentAggregated = aggregateAccountsData(accountsWithServiceMetrics);
    
    // Calculate overall comparison
    const overallComparison = calculateComparison(currentResults, previousResults);
    
    console.log('📈 Comparison Results:');
    console.log(`   Current payments: ${overallComparison.payments.current}`);
    console.log(`   Previous payments: ${overallComparison.payments.previous}`);
    console.log(`   Payments difference: ${overallComparison.payments.difference}`);
    console.log(`   Current amount: ${overallComparison.amount.current}`);
    console.log(`   Previous amount: ${overallComparison.amount.previous}`);
    console.log(`   Amount difference: ${overallComparison.amount.difference}`);
    
    // Calculate individual account comparisons and attach to accounts with service metrics
    const accountsWithServiceMetricsAndComparison = accountsWithServiceMetrics.map((account, index) => {
      const previousAccount = previousResults[index];
      const comparison = calculateAccountComparison(account, previousAccount);
      
      return {
        ...account,
        comparison
      };
    });
    
    res.json({
      success: true,
      accounts: accountsWithServiceMetricsAndComparison,
      aggregated: currentAggregated,
      comparison: overallComparison,
      timestamp: new Date().toISOString(),
      periods: {
        current: {
          start: currentParams['filter[start_date]'] || new Date().toISOString().split('T')[0],
          end: currentParams['filter[end_date]'] || new Date().toISOString().split('T')[0]
        },
        previous: {
          start: previousParams['filter[start_date]'],
          end: previousParams['filter[end_date]']
        }
      }
    });
  } catch (error) {
    console.error('❌ Error in /api/payments/all:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get general indicators data from all user's accounts
router.get('/general-indicators', requireAuth, async (req, res) => {
  try {
    console.log('🚀 Starting /api/payments/general-indicators request');
    const queryParams = req.query;
    console.log(`   Original query params: ${JSON.stringify(queryParams)}`);
    
    // Get user's accounts and timezone with safe fallbacks
    const userAccounts = req.user.userAccounts || [];
    let userTimezone = req.user.userTimezone || config.olaClick.defaultTimezone;
    
    // Ensure timezone is valid
    if (!userTimezone || userTimezone === 'undefined' || userTimezone === 'null') {
      userTimezone = config.olaClick.defaultTimezone;
    }
    
    console.log(`   User timezone: ${userTimezone}`);
    
    if (userAccounts.length === 0) {
      return res.json({
        success: true,
        accounts: [],
        aggregated: {
          services: [],
          totalOrders: 0,
          totalSales: 0,
          averageTicket: 0
        },
        comparison: null,
        message: 'No accounts assigned to this user'
      });
    }
    
    // Extract parameters
    const period = queryParams.period || 'today';
    const timezone = queryParams.timezone || userTimezone;
    
    // Check if custom date range is provided
    const hasCustomDateRange = queryParams['filter[start_date]'] && queryParams['filter[end_date]'];
    
    console.log(`   Period: ${period}`);
    console.log(`   Timezone: ${timezone}`);
    console.log(`   Custom date range: ${hasCustomDateRange ? 'Yes' : 'No'}`);
    if (hasCustomDateRange) {
      console.log(`   Start date: ${queryParams['filter[start_date]']}`);
      console.log(`   End date: ${queryParams['filter[end_date]']}`);
    }
    
    // Fetch current period data
    console.log('🔄 Fetching current period general indicators data...');
    const currentPromises = userAccounts.map(account => {
      const params = { period, timezone };
      if (hasCustomDateRange) {
        params.startDate = queryParams['filter[start_date]'];
        params.endDate = queryParams['filter[end_date]'];
      }
      return fetchGeneralIndicators(account, params);
    });
    
    // Fetch previous period data (same day last week)
    console.log('🔄 Fetching previous period general indicators data...');
    const previousPeriod = getPreviousPeriod(period);
    const previousPromises = userAccounts.map(account => {
      const params = { period: previousPeriod, timezone };
      if (hasCustomDateRange) {
        // Calculate previous period based on custom date range
        const startDate = new Date(queryParams['filter[start_date]']);
        const endDate = new Date(queryParams['filter[end_date]']);
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(startDate.getDate() - 7);
        const prevEndDate = new Date(prevStartDate);
        prevEndDate.setDate(prevStartDate.getDate() + daysDiff - 1);
        
        params.startDate = prevStartDate.toLocaleDateString('en-CA', { timeZone: timezone });
        params.endDate = prevEndDate.toLocaleDateString('en-CA', { timeZone: timezone });
      }
      return fetchGeneralIndicators(account, params);
    });
    
    const [currentResults, previousResults] = await Promise.all([
      Promise.all(currentPromises),
      Promise.all(previousPromises)
    ]);
    
    // Debug logging
    console.log('📊 General Indicators Results:');
    console.log(`   Current results count: ${currentResults.length}`);
    console.log(`   Previous results count: ${previousResults.length}`);
    currentResults.forEach((result, index) => {
      console.log(`   Current Account ${index} (${result.accountKey}): success=${result.success}`);
      if (result.success && result.data) {
        console.log(`     Services: ${Object.keys(result.data.data || {}).join(', ')}`);
      }
    });
    
    // Process and aggregate the data
    const currentAggregated = aggregateGeneralIndicators(currentResults);
    const previousAggregated = aggregateGeneralIndicators(previousResults);
    
    // Calculate comparison
    const comparison = calculateServiceMetricsComparison(currentAggregated, previousAggregated);
    
    console.log('📈 Aggregated General Indicators:');
    console.log(`   Current - Total Orders: ${currentAggregated.totalOrders}, Total Sales: ${currentAggregated.totalSales}`);
    console.log(`   Previous - Total Orders: ${previousAggregated.totalOrders}, Total Sales: ${previousAggregated.totalSales}`);
    console.log(`   Comparison: ${JSON.stringify(comparison)}`);
    
    res.json({
      success: true,
      accounts: currentResults,
      aggregated: currentAggregated,
      comparison,
      period,
      timezone
    });
    
  } catch (error) {
    console.error('❌ General indicators error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to aggregate general indicators data
function aggregateGeneralIndicators(accountsData) {
  console.log('📊 Aggregating general indicators data:');
  console.log(`   Input accounts count: ${accountsData.length}`);
  
  const serviceTypes = ['TABLE', 'ONSITE', 'TAKEAWAY', 'DELIVERY'];
  const aggregated = {
    services: [],
    totalOrders: 0,
    totalSales: 0,
    averageTicket: 0
  };
  
  // Initialize service data
  serviceTypes.forEach(serviceType => {
    aggregated.services.push({
      type: serviceType,
      orders: 0,
      sales: 0,
      averageTicket: 0
    });
  });
  
  // Process each account's data
  accountsData.forEach((account, index) => {
    console.log(`   Account ${index} (${account.accountKey}): success=${account.success}`);
    
    if (account.success && account.data && account.data.data) {
      console.log(`     Raw data: ${JSON.stringify(account.data.data)}`);
      
      // Process each service type
      serviceTypes.forEach(serviceType => {
        const serviceData = account.data.data[serviceType];
        if (serviceData) {
          const serviceIndex = aggregated.services.findIndex(s => s.type === serviceType);
          if (serviceIndex !== -1) {
            const orders = serviceData.orders?.current_period || 0;
            const sales = parseFloat(serviceData.sales?.current_period || 0);
            const avgTicket = parseFloat(serviceData.average_ticket?.current_period || 0);
            
            aggregated.services[serviceIndex].orders += orders;
            aggregated.services[serviceIndex].sales += sales;
            
            // Calculate weighted average for average ticket
            if (orders > 0) {
              const currentAvg = aggregated.services[serviceIndex].averageTicket;
              const currentOrders = aggregated.services[serviceIndex].orders - orders;
              if (currentOrders > 0) {
                aggregated.services[serviceIndex].averageTicket = 
                  ((currentAvg * currentOrders) + (avgTicket * orders)) / aggregated.services[serviceIndex].orders;
              } else {
                aggregated.services[serviceIndex].averageTicket = avgTicket;
              }
            }
            
            console.log(`     ${serviceType}: orders=${orders}, sales=${sales}, avgTicket=${avgTicket}`);
          }
        }
      });
    } else {
      console.log(`     No data or error: ${JSON.stringify(account.error || 'No error info')}`);
    }
  });
  
  // Calculate totals
  aggregated.totalOrders = aggregated.services.reduce((sum, service) => sum + service.orders, 0);
  aggregated.totalSales = aggregated.services.reduce((sum, service) => sum + service.sales, 0);
  aggregated.averageTicket = aggregated.totalOrders > 0 ? aggregated.totalSales / aggregated.totalOrders : 0;
  
  console.log(`   Aggregation result: totalOrders=${aggregated.totalOrders}, totalSales=${aggregated.totalSales}, averageTicket=${aggregated.averageTicket}`);
  return aggregated;
}

// Helper function to get previous period
function getPreviousPeriod(currentPeriod) {
  switch (currentPeriod) {
    case 'today':
      return 'yesterday';
    case 'yesterday':
      return '2daysago';
    case 'thisweek':
      return 'lastweek';
    case 'lastweek':
      return '2weeksago';
    case 'thismonth':
      return 'lastmonth';
    case 'lastmonth':
      return '2monthsago';
    default:
      return 'yesterday';
  }
}

// Helper function to calculate service metrics comparison
function calculateServiceMetricsComparison(current, previous) {
  const ordersDiff = current.totalOrders - previous.totalOrders;
  const ordersPercent = previous.totalOrders > 0 ? ((ordersDiff / previous.totalOrders) * 100) : 0;
  
  const salesDiff = current.totalSales - previous.totalSales;
  const salesPercent = previous.totalSales > 0 ? ((salesDiff / previous.totalSales) * 100) : 0;
  
  const avgTicketDiff = current.averageTicket - previous.averageTicket;
  const avgTicketPercent = previous.averageTicket > 0 ? ((avgTicketDiff / previous.averageTicket) * 100) : 0;
  
  return {
    orders: {
      current: current.totalOrders,
      previous: previous.totalOrders,
      difference: ordersDiff,
      percentChange: ordersPercent,
      trend: ordersDiff >= 0 ? 'up' : 'down'
    },
    sales: {
      current: current.totalSales,
      previous: previous.totalSales,
      difference: salesDiff,
      percentChange: salesPercent,
      trend: salesDiff >= 0 ? 'up' : 'down'
    },
    averageTicket: {
      current: current.averageTicket,
      previous: previous.averageTicket,
      difference: avgTicketDiff,
      percentChange: avgTicketPercent,
      trend: avgTicketDiff >= 0 ? 'up' : 'down'
    }
  };
}

// Debug endpoint to check timezone handling
router.get('/debug/timezone', (req, res) => {
  const timezone = req.query.timezone || config.olaClick.defaultTimezone;
  const inputDate = req.query.date;
  
  const now = new Date();
  const serverTime = now.toISOString();
  const timezoneTime = now.toLocaleString('en-US', { timeZone: timezone });
  const todayInTimezone = getTimezoneAwareDate(null, timezone);
  const sevenDaysAgo = getDateDaysAgoInTimezone(7, timezone);
  
  let processedInputDate = null;
  if (inputDate) {
    processedInputDate = getTimezoneAwareDate(inputDate, timezone);
  }
  
  res.json({
    success: true,
    debug: {
      serverTime,
      timezone,
      timezoneTime,
      todayInTimezone,
      sevenDaysAgo,
      inputDate,
      processedInputDate,
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  });
});

// Get payment data from a specific account (if user has access)
router.get('/:companyToken', requireAuth, async (req, res) => {
  try {
    const { companyToken } = req.params;
    const queryParams = req.query;
    
    // Find the account in user's accounts
    const userAccounts = req.user.userAccounts || [];
    const account = userAccounts.find(acc => acc.company_token === companyToken);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or access denied'
      });
    }
    
    const result = await fetchOlaClickData(account, queryParams);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      account: req.params.companyToken 
    });
  }
});

export default router; 