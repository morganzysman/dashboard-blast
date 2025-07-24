import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  fetchGeneralIndicators,
  fetchServiceMetrics
} from '../services/olaClickService.js';
import { config } from '../config/index.js';

const router = Router();

// Helper function to aggregate orders data
function aggregateOrdersData(accountsData) {
  console.log('📊 Aggregating orders data:');
  console.log(`   Input accounts count: ${accountsData.length}`);
  
  if (!accountsData || accountsData.length === 0) {
    return {
      totalOrders: 0,
      totalSales: 0,
      averageTicket: 0,
      accounts: []
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
      
      totalOrders += accountOrders;
      totalSales += accountSales;
      
      accounts.push({
        account: account.account,
        accountKey: account.accountKey,
        orders: accountOrders,
        sales: accountSales,
        averageTicket: accountAvgTicket
      });
      
      console.log(`     Orders: ${accountOrders}, Sales: ${accountSales}, Avg Ticket: ${accountAvgTicket}`);
    } else {
      console.log(`     No data or error: ${JSON.stringify(account.error || 'No error info')}`);
    }
  });
  
  const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
  
  console.log(`   Aggregation result: totalOrders=${totalOrders}, totalSales=${totalSales}, averageTicket=${averageTicket}`);
  
  return {
    totalOrders,
    totalSales,
    averageTicket,
    accounts
  };
}

// Helper function to calculate orders comparison
function calculateOrdersComparison(current, previous) {
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
          averageTicket: 0,
          accountsCount: 0
        },
        comparison: null,
        message: 'No accounts assigned to this user'
      });
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
    
    const currentPromises = userAccounts.map(account => {
      const params = { 
        timezone,
        startDate,
        endDate
      };
      console.log(`   🔍 Account ${account.company_token}: params=${JSON.stringify(params)}`);
      return fetchGeneralIndicators(account, params);
    });
    
    // Fetch previous period data (one week before the current period)
    console.log('🔄 Fetching previous period order data...');
    const previousPromises = userAccounts.map(account => {
      // Calculate previous period based on provided date range (one week before)
      const currentStartDate = new Date(startDate);
      const currentEndDate = new Date(endDate);
      const daysDiff = Math.ceil((currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24));
      
      const prevStartDate = new Date(currentStartDate);
      prevStartDate.setDate(currentStartDate.getDate() - 7);
      const prevEndDate = new Date(prevStartDate);
      prevEndDate.setDate(prevStartDate.getDate() + daysDiff);
      
      const params = {
        timezone,
        startDate: prevStartDate.toLocaleDateString('en-CA', { timeZone: timezone }),
        endDate: prevEndDate.toLocaleDateString('en-CA', { timeZone: timezone })
      };
      
      return fetchGeneralIndicators(account, params);
    });
    
    const [currentResults, previousResults] = await Promise.all([
      Promise.all(currentPromises),
      Promise.all(previousPromises)
    ]);
    
    // Debug logging
    console.log('📊 Order Results:');
    console.log(`   Current results count: ${currentResults.length}`);
    console.log(`   Previous results count: ${previousResults.length}`);
    currentResults.forEach((result, index) => {
      console.log(`   Current Account ${index} (${result.accountKey}): success=${result.success}`);
      if (result.success && result.data) {
        console.log(`     Services: ${Object.keys(result.data.data || {}).join(', ')}`);
      }
    });
    
    // Process and aggregate the data
    const currentAggregated = aggregateOrdersData(currentResults);
    const previousAggregated = aggregateOrdersData(previousResults);
    
    // Calculate comparison
    const comparison = calculateOrdersComparison(currentAggregated, previousAggregated);
    
    console.log('📈 Aggregated Order Data:');
    console.log(`   Current - Total Orders: ${currentAggregated.totalOrders}, Total Sales: ${currentAggregated.totalSales}`);
    console.log(`   Previous - Total Orders: ${previousAggregated.totalOrders}, Total Sales: ${previousAggregated.totalSales}`);
    console.log(`   Comparison: ${JSON.stringify(comparison)}`);
    
    res.json({
      success: true,
      accounts: currentAggregated.accounts,
      aggregated: {
        totalOrders: currentAggregated.totalOrders,
        totalSales: currentAggregated.totalSales,
        averageTicket: currentAggregated.averageTicket,
        accountsCount: currentAggregated.accounts.length
      },
      comparison,
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

// Get service metrics data (only available for "today")
router.get('/service-metrics', requireAuth, async (req, res) => {
  try {
    console.log(`📊 Service Metrics request received`);
    console.log(`   Query params: ${JSON.stringify(req.query)}`);
    
    // Get user's accounts
    const userAccounts = await getUserAccounts(req.user.id);
    
    if (!userAccounts || userAccounts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No accounts found for user'
      });
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

export default router; 