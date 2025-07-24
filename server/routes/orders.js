import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  fetchGeneralIndicators,
  aggregateGeneralIndicators,
  calculateServiceMetricsComparison
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
    const currentPromises = userAccounts.map(account => {
      const params = { 
        timezone,
        startDate,
        endDate
      };
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
    const currentAggregated = aggregateGeneralIndicators(currentResults);
    const previousAggregated = aggregateGeneralIndicators(previousResults);
    
    // Calculate comparison
    const comparison = calculateServiceMetricsComparison(currentAggregated, previousAggregated);
    
    console.log('📈 Aggregated Order Data:');
    console.log(`   Current - Total Orders: ${currentAggregated.totalOrders}, Total Sales: ${currentAggregated.totalSales}`);
    console.log(`   Previous - Total Orders: ${previousAggregated.totalOrders}, Total Sales: ${previousAggregated.totalSales}`);
    console.log(`   Comparison: ${JSON.stringify(comparison)}`);
    
    res.json({
      success: true,
      accounts: currentResults,
      aggregated: currentAggregated,
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

export default router; 