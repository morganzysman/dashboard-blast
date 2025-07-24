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

// Get payment data from all user's accounts (refactored version of /all)
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('🚀 Starting /api/payments request');
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
          totalTips: 0,
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
      
      // Validate date format and validity
      if (!isValidDateString(startDateStr) || !isValidDateString(endDateStr)) {
        console.log(`   ❌ Invalid date format - startDate: ${startDateStr}, endDate: ${endDateStr}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Dates must be in YYYY-MM-DD format and valid.',
          details: {
            startDate: startDateStr,
            endDate: endDateStr,
            startDateValid: isValidDateString(startDateStr),
            endDateValid: isValidDateString(endDateStr)
          }
        });
      }
      
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
    console.log('🔄 Fetching current period payment data...');
    const currentPromises = userAccounts.map(account => 
      fetchOlaClickData(account, currentParams)
    );
    
    // Fetch previous period data
    console.log('🔄 Fetching previous period payment data...');
    const previousPromises = userAccounts.map(account => 
      fetchOlaClickData(account, previousParams)
    );
    
    // Fetch tips data for each account (current period only)
    console.log('🔄 Fetching tips data for each account...');
    const tipsPromises = userAccounts.map(account => 
      fetchTipsData(account, currentParams)
    );
    
    const [currentResults, previousResults, tipsResults] = await Promise.all([
      Promise.all(currentPromises),
      Promise.all(previousPromises),
      Promise.all(tipsPromises)
    ]);
    
    // Attach tips data to accounts
    currentResults.forEach((account, index) => {
      if (tipsResults[index] && tipsResults[index].success) {
        account.tipsData = tipsResults[index];
      }
    });
    
    // Aggregate current period data
    console.log('📊 Aggregating current period data...');
    const aggregated = aggregateAccountsData(currentResults);
    
    // Aggregate previous period data for comparison
    console.log('📊 Aggregating previous period data...');
    const previousAggregated = aggregateAccountsData(previousResults);
    
    // Calculate comparison
    console.log('📈 Calculating comparison...');
    const comparison = calculateComparison(currentResults, previousResults);
    
    console.log('📈 Final aggregated data:');
    console.log(`   Total Payments: ${aggregated.totalPayments}`);
    console.log(`   Total Amount: ${aggregated.totalAmount}`);
    console.log(`   Total Tips: ${aggregated.totalTips}`);
    console.log(`   Payment Methods: ${aggregated.paymentMethods.length}`);
    console.log(`   Accounts: ${aggregated.accountsCount}`);
    
    res.json({
      success: true,
      accounts: currentResults,
      aggregated,
      comparison,
      timezone: currentParams['filter[timezone]']
    });
    
  } catch (error) {
    console.error('❌ Payments endpoint error:', error);
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

// Helper function removed - no longer needed since we always use explicit dates

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