import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  fetchOlaClickData,
  fetchGeneralIndicators,
  fetchTipsData,
  fetchServiceMetrics,
  aggregateAccountsData,
  getTimezoneAwareDate
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
    console.log(`📊 Payments request received`);
    console.log(`   Query params: ${JSON.stringify(req.query)}`);
    
    // Get user's accounts
    const userAccounts = req.user.userAccounts || [];
    
    if (!userAccounts || userAccounts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No accounts found for user'
      });
    }
    
    console.log(`📊 Found ${userAccounts.length} accounts`);
    
    // Parse parameters (handle both nested and flat parameters)
    let currentParams = {};
    
    // Handle nested filter parameters (e.g., filter[start_date])
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('filter[') && key.endsWith(']')) {
        const paramName = key.slice(7, -1); // Remove 'filter[' and ']'
        currentParams[`filter[${paramName}]`] = req.query[key];
      } else {
        currentParams[key] = req.query[key];
      }
    });
    
    console.log(`📋 Parsed parameters: ${JSON.stringify(currentParams)}`);
    
    // Validate date parameters
    const startDate = currentParams['filter[start_date]'];
    const endDate = currentParams['filter[end_date]'];
    
    if (startDate && endDate) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD format.'
        });
      }
      
      // Validate date values
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date values.'
        });
      }
      
      console.log(`📅 Using provided date range: ${startDate} to ${endDate}`);
    } else {
      console.log('📅 Using default date ranges (today)');
      
      // Get timezone from parameters or default to Lima, ensure it's valid
      let timezone = currentParams['filter[timezone]'] || config.olaClick.defaultTimezone;
      if (!timezone || timezone === 'undefined') {
        timezone = config.olaClick.defaultTimezone;
      }
      
      // Use timezone-aware date calculation
      const todayInTimezone = getTimezoneAwareDate(null, timezone);
      
      currentParams['filter[start_date]'] = todayInTimezone;
      currentParams['filter[end_date]'] = todayInTimezone;
      
      console.log(`   Using timezone: ${timezone}`);
      console.log(`   Today in ${timezone}: ${todayInTimezone}`);
    }
    
    console.log('📋 Final parameter sets:');
    console.log(`   Current params: ${JSON.stringify(currentParams)}`);
    
    // Check if the date range corresponds to "today"
    const timezone = currentParams['filter[timezone]'] || config.olaClick.defaultTimezone;
    const todayInTimezone = getTimezoneAwareDate(null, timezone);
    const isToday = currentParams['filter[start_date]'] === todayInTimezone && 
                   currentParams['filter[end_date]'] === todayInTimezone;
    
    console.log(`📅 Date range check: isToday=${isToday}`);
    
    // Fetch current period data
    console.log('🔄 Fetching current period payment data...');
    const currentPromises = userAccounts.map(account => 
      fetchOlaClickData(account, currentParams)
    );
    
    // Fetch tips data for each account (current period only)
    console.log('🔄 Fetching tips data for each account...');
    const tipsPromises = userAccounts.map(account => 
      fetchTipsData(account, currentParams)
    );
    
    // Fetch service metrics data if today
    let serviceMetricsResults = null;
    if (isToday) {
      console.log('🔄 Fetching service metrics data for today...');
      const serviceMetricsPromises = userAccounts.map(account => 
        fetchServiceMetrics(account, { timezone })
      );
      serviceMetricsResults = await Promise.all(serviceMetricsPromises);
    }
    
    const [currentResults, tipsResults] = await Promise.all([
      Promise.all(currentPromises),
      Promise.all(tipsPromises)
    ]);
    
    // Attach tips data to accounts
    currentResults.forEach((account, index) => {
      if (tipsResults[index] && tipsResults[index].success) {
        account.tipsData = tipsResults[index];
      }
    });
    
    // Attach service metrics data to accounts if available
    if (serviceMetricsResults) {
      currentResults.forEach((account, index) => {
        if (serviceMetricsResults[index] && serviceMetricsResults[index].success) {
          account.serviceMetrics = serviceMetricsResults[index].data?.data || null;
        }
      });
    }
    
    // Aggregate current period data
    console.log('📊 Aggregating current period data...');
    const aggregated = aggregateAccountsData(currentResults);
    
    console.log('📈 Final aggregated data:');
    console.log(`   Total Payments: ${aggregated.totalPayments}`);
    console.log(`   Total Amount: ${aggregated.totalAmount}`);
    console.log(`   Total Tips: ${aggregated.totalTips}`);
    console.log(`   Payment Methods: ${Object.keys(aggregated.paymentMethods).length}`);
    
    res.json({
      success: true,
      aggregated,
      accounts: currentResults
    });
    
  } catch (error) {
    console.error(`❌ Payments error: ${error.message}`);
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