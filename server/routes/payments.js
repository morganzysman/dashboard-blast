import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  fetchOlaClickData,
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
    
    const [currentResults, previousResults] = await Promise.all([
      Promise.all(currentPromises),
      Promise.all(previousPromises)
    ]);
    
    // Debug logging
    console.log('📊 Comparison Debug Info:');
    console.log(`   Current period: ${currentParams['filter[start_date]']} to ${currentParams['filter[end_date]']}`);
    console.log(`   Previous period: ${previousParams['filter[start_date]']} to ${previousParams['filter[end_date]']}`);
    console.log(`   Current results count: ${currentResults.length}`);
    console.log(`   Previous results count: ${previousResults.length}`);
    
    // Calculate aggregated data for current period
    const currentAggregated = aggregateAccountsData(currentResults);
    
    // Calculate overall comparison
    const overallComparison = calculateComparison(currentResults, previousResults);
    
    console.log('📈 Comparison Results:');
    console.log(`   Current payments: ${overallComparison.payments.current}`);
    console.log(`   Previous payments: ${overallComparison.payments.previous}`);
    console.log(`   Payments difference: ${overallComparison.payments.difference}`);
    console.log(`   Current amount: ${overallComparison.amount.current}`);
    console.log(`   Previous amount: ${overallComparison.amount.previous}`);
    console.log(`   Amount difference: ${overallComparison.amount.difference}`);
    
    // Calculate individual account comparisons
    const accountsWithComparison = currentResults.map((currentAccount, index) => {
      const previousAccount = previousResults[index];
      const comparison = calculateAccountComparison(currentAccount, previousAccount);
      
      return {
        ...currentAccount,
        comparison
      };
    });
    
    res.json({
      success: true,
      accounts: accountsWithComparison,
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