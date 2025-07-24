import axios from 'axios';
import { config } from '../config/index.js';

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
export async function fetchGeneralIndicators(account, queryParams = {}) {
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
  const params = {
    'filter[start_date]': startDate,
    'filter[end_date]': endDate,
    'filter[timezone]': timezone,
    'filter[start_time]': '00:00:00',
    'filter[end_time]': '23:59:59',
    'filter[time_type]': 'pending_at',
    'filter[status]': 'PENDING,PREPARING,READY,DRIVER_ON_THE_WAY_TO_DESTINATION,CHECK_REQUESTED,CHECK_PRINTED,DRIVER_ARRIVED_AT_DESTINATION,DELIVERED,FINALIZED,CANCELLED',
    'filter[max_order_limit]': 'true',
    'per_page': 25,
    'page': 1
  };
  
  const urlParams = new URLSearchParams(params);
  const fullUrl = `${baseUrl}?${urlParams.toString()}`;

  // Debug logging for API requests
  console.log(`🔍 General Indicators API Request for ${account.company_token}:`);
  console.log(`   URL: ${fullUrl}`);
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
    const response = await axios.get(baseUrl, {
      params,
      headers
    });

    // Debug logging for API responses
    console.log(`📊 Orders API Response for ${account.company_token}:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Data: ${JSON.stringify(response.data)}`);

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

    // Process the actual orders data from the response
    if (response.data && response.data.data && Array.isArray(response.data.data)) {
      console.log(`🔍 Processing orders data: ${response.data.data.length} orders found`);
      
      // Extract orders data from the data array
      const orders = response.data.data;
      const meta = response.data.meta || {};
      
      let totalOrders = orders.length;
      let totalSales = meta.total_amount || 0;
      let avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
      
      // Simple aggregated data
      transformedData = {
        orders: totalOrders,
        sales: totalSales,
        averageTicket: avgTicket
      };
      
      console.log(`📊 Processed ${totalOrders} orders with ${totalSales} total sales`);
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