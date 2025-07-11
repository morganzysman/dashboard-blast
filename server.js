import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Add some basic security headers for production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Path to the accounts configuration file
const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');

// Default accounts configuration
const DEFAULT_ACCOUNTS = {
  'blast-smash-burgers': {
    company_token: 'blast-smash-burgers',
    tokens: [
      {
        company_token: 'blast-smash-burgers',
        auth_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL29sYWNsaWNrLW5sYi1kMzU3ZGFmOTUyNWJlMmUzLmVsYi51cy1lYXN0LTEuYW1hem9uYXdzLmNvbTo4MC9tcy1jb21wYW5pZXMvcHVibGljL2xvZ2luIiwiaWF0IjoxNzUwODkxMTY3LCJleHAiOjE3NTg2NjcxNjcsIm5iZiI6MTc1MDg5MTE2NywianRpIjoiQ0wzM2x3M3N1bTQ5T1dFNyIsInN1YiI6IjVjMWIzMWMwLTFlZTQtMTFlZi05NTdkLTg5OWVjOTZhYTU2NyIsInBydiI6IjIzYmQ1Yzg5NDlmNjAwYWRiMzllNzAxYzQwMDg3MmRiN2E1OTc2ZjciLCJjb21wYW55X2lkIjoiYzY4NjcxNjQtZjJkOC00YjA5LWFkNTgtMWVlZmZjMWNkYzc5IiwiY291bnRyeV9jb2RlIjoiUEUiLCJsYW5ndWFnZSI6ImVzIiwicm9sZSI6ImFkbWluIiwiY3VycmVuY3kiOiJQRU4iLCJ0aW1lem9uZSI6IkFtZXJpY2EvTGltYSIsInRva2VuIjoiYmxhc3Qtc21hc2gtYnVyZ2VycyIsInVzZXJfbmFtZSI6IkJsYXN0IFNtYXNoIEJ1cmdlciJ9.u7ad4B0zq8nGNTwB7QKgcUQNgF_M92pps8YRs-WtwAo'
      }
    ],
    additional_cookies: '', // For any additional cookie parameters
    name: 'Blast Barranco'
  },
  'blast-smash-burgers-miraflores': {
    company_token: 'blast-smash-burgers-miraflores',
    tokens: [
      {
        company_token: 'blast-smash-burgers-miraflores',
        auth_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL29sYWNsaWNrLW5sYi1kMzU3ZGFmOTUyNWJlMmUzLmVsYi51cy1lYXN0LTEuYW1hem9uYXdzLmNvbTo4MC9tcy1jb21wYW5pZXMvcHVibGljL2xvZ2luIiwiaWF0IjoxNzUyMTg3MzY0LCJleHAiOjE3NTk5NjMzNjQsIm5iZiI6MTc1MjE4NzM2NCwianRpIjoiRWZmRzBXdzE4RXU2cmkzdiIsInN1YiI6IjA5ZmY3NjYwLTVkMWEtMTFmMC1hMzA5LTNkMTczYWZmYWYzZiIsInBydiI6IjIzYmQ1Yzg5NDlmNjAwYWRiMzllNzAxYzQwMDg3MmRiN2E1OTc2ZjciLCJjb21wYW55X2lkIjoiMWEwMzJhMGEtNzE5MC00MGU0LWIwNmItOWExNjZjMWUxMTMwIiwiY291bnRyeV9jb2RlIjoiUEUiLCJsYW5ndWFnZSI6ImVzIiwicm9sZSI6ImFkbWluIiwiY3VycmVuY3kiOiJQRU4iLCJ0aW1lem9uZSI6IkFtZXJpY2EvTGltYSIsInRva2VuIjoiYmxhc3Qtc21hc2gtYnVyZ2Vycy1taXJhZmxvcmVzIiwidXNlcl9uYW1lIjoiQmxhc3QgU21hc2ggQnVyZ2VycyBNaXJhZmxvcmVzIn0.neCLt52eSNPsMcNUFrBzZQSGXGZY0y4CZnYCCkXNfVo'
      }
    ],
    additional_cookies: 'ajs_user_id=1a032a0a-7190-40e4-b06b-9a166c1e1130; ajs_anonymous_id=299d15b9-2fbe-4473-90db-530553283408; ajs_group_id=1a032a0a-7190-40e4-b06b-9a166c1e1130',
    name: 'Blast Miraflores'
  }
};

// Helper function to construct cookie header from token structure
function constructCookieHeader(account) {
  // If account has legacy cookie format, use it directly
  if (account.cookie) {
    return account.cookie;
  }
  
  // Construct cookie from JSON token structure
  if (account.tokens && Array.isArray(account.tokens)) {
    const tokensJson = JSON.stringify(account.tokens);
    const encodedTokens = encodeURIComponent(tokensJson);
    let cookie = `tokens=${encodedTokens}`;
    
    // Add additional cookies if present
    if (account.additional_cookies) {
      cookie += `; ${account.additional_cookies}`;
    }
    
    return cookie;
  }
  
  throw new Error('Account must have either tokens array or legacy cookie format');
}

// Helper function to migrate legacy cookie format to new format
function migrateLegacyCookie(cookieString) {
  try {
    // Extract tokens parameter from cookie
    const tokensMatch = cookieString.match(/tokens=([^;]+)/);
    if (!tokensMatch) {
      throw new Error('No tokens parameter found in cookie');
    }
    
    const decodedTokens = decodeURIComponent(tokensMatch[1]);
    const tokens = JSON.parse(decodedTokens);
    
    // Extract additional cookies (everything except tokens)
    const additionalCookies = cookieString
      .split(';')
      .map(part => part.trim())
      .filter(part => !part.startsWith('tokens='))
      .join('; ');
    
    return {
      tokens: tokens,
      additional_cookies: additionalCookies
    };
  } catch (error) {
    throw new Error(`Failed to migrate cookie: ${error.message}`);
  }
}

// Load accounts from file
async function loadAccounts() {
  try {
    const data = await fs.readFile(ACCOUNTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.log('📁 Accounts file not found, creating with default accounts...');
    await saveAccounts(DEFAULT_ACCOUNTS);
    return DEFAULT_ACCOUNTS;
  }
}

// Save accounts to file
async function saveAccounts(accounts) {
  try {
    await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
    console.log('💾 Accounts saved successfully');
  } catch (error) {
    console.error('❌ Error saving accounts:', error.message);
    throw error;
  }
}

// Load accounts on startup
let ACCOUNTS = await loadAccounts();

// Helper function to aggregate data from multiple accounts
function aggregateAccountsData(accountsData) {
  console.log('📊 Aggregating accounts data:');
  console.log(`   Input accounts count: ${accountsData.length}`);
  
  const aggregated = {};
  let totalOrders = 0;
  let totalAmount = 0;
  
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
        totalOrders += count;
        totalAmount += sum;
      });
    } else {
      console.log(`     No data or error: ${JSON.stringify(account.error || 'No error info')}`);
    }
  });
  
  // Calculate percentages
  Object.values(aggregated).forEach(method => {
    method.percent = totalAmount > 0 ? (method.sum / totalAmount * 100) : 0;
  });
  
  const result = {
    paymentMethods: Object.values(aggregated),
    totalOrders,
    totalAmount,
    accountsCount: accountsData.filter(acc => acc.success).length
  };
  
  console.log(`   Aggregation result: totalOrders=${totalOrders}, totalAmount=${totalAmount}`);
  return result;
}

// Helper function to calculate comparison between two periods
function calculateComparison(currentData, previousData) {
  console.log('🧮 Calculating Overall Comparison:');
  console.log(`   Current data length: ${currentData.length}`);
  console.log(`   Previous data length: ${previousData.length}`);
  
  const current = aggregateAccountsData(currentData);
  const previous = aggregateAccountsData(previousData);
  
  console.log(`   Current aggregated: ${JSON.stringify(current)}`);
  console.log(`   Previous aggregated: ${JSON.stringify(previous)}`);
  
  const ordersDiff = current.totalOrders - previous.totalOrders;
  const ordersPercent = previous.totalOrders > 0 ? ((ordersDiff / previous.totalOrders) * 100) : 0;
  
  const amountDiff = current.totalAmount - previous.totalAmount;
  const amountPercent = previous.totalAmount > 0 ? ((amountDiff / previous.totalAmount) * 100) : 0;
  
  const result = {
    orders: {
      current: current.totalOrders,
      previous: previous.totalOrders,
      difference: ordersDiff,
      percentChange: ordersPercent,
      trend: ordersDiff >= 0 ? 'up' : 'down'
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
function calculateAccountComparison(currentAccount, previousAccount) {
  let currentOrders = 0;
  let currentAmount = 0;
  let previousOrders = 0;
  let previousAmount = 0;
  
  // Calculate current totals
  if (currentAccount.success && currentAccount.data && currentAccount.data.data) {
    currentAccount.data.data.forEach(method => {
      currentOrders += method.count || 0;
      currentAmount += method.sum || 0;
    });
  }
  
  // Calculate previous totals
  if (previousAccount.success && previousAccount.data && previousAccount.data.data) {
    previousAccount.data.data.forEach(method => {
      previousOrders += method.count || 0;
      previousAmount += method.sum || 0;
    });
  }
  
  const ordersDiff = currentOrders - previousOrders;
  const ordersPercent = previousOrders > 0 ? ((ordersDiff / previousOrders) * 100) : 0;
  
  const amountDiff = currentAmount - previousAmount;
  const amountPercent = previousAmount > 0 ? ((amountDiff / previousAmount) * 100) : 0;
  
  return {
    orders: {
      current: currentOrders,
      previous: previousOrders,
      difference: ordersDiff,
      percentChange: ordersPercent,
      trend: ordersDiff >= 0 ? 'up' : 'down'
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

// Helper function to get date 7 days ago
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// Helper function to make OlaClick API requests
async function fetchOlaClickData(companyToken, queryParams = {}) {
  const account = ACCOUNTS[companyToken];
  if (!account) {
    throw new Error(`Account ${companyToken} not found`);
  }

  const defaultParams = {
    'filter[start_time]': '00:00:00',
    'filter[end_time]': '23:59:59',
    'filter[timezone]': 'America/Lima',
    'filter[start_date]': new Date().toISOString().split('T')[0],
    'filter[end_date]': new Date().toISOString().split('T')[0],
    'filter[time_type]': 'pending_at',
    'filter[status]': 'PENDING,PREPARING,READY,DRIVER_ON_THE_WAY_TO_DESTINATION,CHECK_REQUESTED,CHECK_PRINTED,DRIVER_ARRIVED_AT_DESTINATION,DELIVERED,FINALIZED',
    'filter[max_order_limit]': 'true'
  };

  const params = { ...defaultParams, ...queryParams };

  // Debug logging for API requests
  console.log(`🔍 API Request for ${companyToken}:`);
  console.log(`   Start Date: ${params['filter[start_date]']}`);
  console.log(`   End Date: ${params['filter[end_date]']}`);
  console.log(`   Timezone: ${params['filter[timezone]']}`);
  
  // Construct the URL for debugging
  const baseUrl = 'https://api.olaclick.app/ms-orders/auth/orders/by_payment_methods';
  const urlParams = new URLSearchParams(params);
  const fullUrl = `${baseUrl}?${urlParams.toString()}`;
  console.log(`   Full URL: ${fullUrl}`);

  try {
    const response = await axios.get(baseUrl, {
      params,
      headers: {
        'accept': 'application/json,multipart/form-data',
        'accept-language': 'en-US,en;q=0.8',
        'app-company-token': account.company_token,
        'content-type': 'application/json',
        'cookie': constructCookieHeader(account),
        'origin': 'https://orders.olaclick.app',
        'referer': 'https://orders.olaclick.app/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
      }
    });

    // Debug logging for API responses
    console.log(`📊 API Response for ${companyToken}:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Raw Data: ${JSON.stringify(response.data)}`);
    
    // Calculate totals for this response
    let totalOrders = 0;
    let totalAmount = 0;
    if (response.data && response.data.data && Array.isArray(response.data.data)) {
      response.data.data.forEach(method => {
        totalOrders += method.count || 0;
        totalAmount += method.sum || 0;
      });
      console.log(`   Calculated Total Orders: ${totalOrders}`);
      console.log(`   Calculated Total Amount: ${totalAmount}`);
      console.log(`   Data Array Length: ${response.data.data.length}`);
    } else {
      console.log(`   ⚠️  No data array found or data is not an array`);
      console.log(`   Response structure: ${JSON.stringify(response.data)}`);
    }

    return {
      success: true,
      data: response.data,
      account: account.name,
      accountKey: companyToken
    };
  } catch (error) {
    console.error(`❌ Error fetching data for ${companyToken}:`, error.message);
    if (error.response) {
      console.error(`   Response Status: ${error.response.status}`);
      console.error(`   Response Data: ${JSON.stringify(error.response.data)}`);
    }
    return {
      success: false,
      error: error.response?.data || error.message,
      account: account.name,
      accountKey: companyToken
    };
  }
}

// API Routes

// Get available accounts with full details
app.get('/api/accounts', (req, res) => {
  const accounts = Object.keys(ACCOUNTS).map(companyToken => {
    const account = ACCOUNTS[companyToken];
    let tokenDisplay = 'N/A';
    
    if (account.tokens && Array.isArray(account.tokens)) {
      tokenDisplay = `${account.tokens.length} token(s)`;
    } else if (account.cookie) {
      tokenDisplay = account.cookie.substring(0, 50) + '...';
    }
    
    return {
      company_token: companyToken,
      name: account.name,
      tokens: account.tokens,
      additional_cookies: account.additional_cookies,
      cookie: account.cookie, // Keep for legacy support
      token_display: tokenDisplay
    };
  });
  
  res.json({ success: true, accounts });
});

// Get full account details for editing
app.get('/api/accounts/:companyToken', (req, res) => {
  const { companyToken } = req.params;
  const account = ACCOUNTS[companyToken];
  
  if (!account) {
    return res.status(404).json({ 
      success: false, 
      error: 'Account not found' 
    });
  }
  
  res.json({ 
    success: true, 
    account: {
      company_token: companyToken,
      name: account.name,
      tokens: account.tokens,
      additional_cookies: account.additional_cookies,
      cookie: account.cookie // Keep for legacy support
    }
  });
});

// Get data from all accounts - THIS MUST COME BEFORE /api/orders/:account
app.get('/api/orders/all', async (req, res) => {
  try {
    console.log('🚀 Starting /api/orders/all request');
    const queryParams = req.query;
    console.log(`   Original query params: ${JSON.stringify(queryParams)}`);
    
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
    
    console.log(`   Base filter params: ${JSON.stringify(baseParams)}`);
    
    // Get current period parameters
    const currentParams = { ...baseParams };
    
    // Get previous period parameters (7 days ago)
    const previousParams = { ...baseParams };
    
    if (currentParams['filter[start_date]'] && currentParams['filter[end_date]']) {
      console.log('📅 Using provided date range');
      const startDate = new Date(currentParams['filter[start_date]']);
      const endDate = new Date(currentParams['filter[end_date]']);
      
      console.log(`   Provided start date: ${startDate.toISOString()}`);
      console.log(`   Provided end date: ${endDate.toISOString()}`);
      
      // Calculate 7 days before
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(startDate.getDate() - 7);
      const prevEndDate = new Date(endDate);
      prevEndDate.setDate(endDate.getDate() - 7);
      
      previousParams['filter[start_date]'] = prevStartDate.toISOString().split('T')[0];
      previousParams['filter[end_date]'] = prevEndDate.toISOString().split('T')[0];
      
      console.log(`   Calculated previous start: ${previousParams['filter[start_date]']}`);
      console.log(`   Calculated previous end: ${previousParams['filter[end_date]']}`);
    } else {
      console.log('📅 Using default date ranges (today vs 7 days ago)');
      // Default to today for current period and 7 days ago for previous period
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = getDateDaysAgo(7);
      
      currentParams['filter[start_date]'] = today;
      currentParams['filter[end_date]'] = today;
      previousParams['filter[start_date]'] = sevenDaysAgo;
      previousParams['filter[end_date]'] = sevenDaysAgo;
      
      console.log(`   Default current date: ${today}`);
      console.log(`   Default previous date: ${sevenDaysAgo}`);
    }
    
    console.log('📋 Final parameter sets:');
    console.log(`   Current params: ${JSON.stringify(currentParams)}`);
    console.log(`   Previous params: ${JSON.stringify(previousParams)}`);
    
    // Fetch current period data
    console.log('🔄 Fetching current period data...');
    const currentPromises = Object.keys(ACCOUNTS).map(companyToken => 
      fetchOlaClickData(companyToken, currentParams)
    );
    
    // Fetch previous period data
    console.log('🔄 Fetching previous period data...');
    const previousPromises = Object.keys(ACCOUNTS).map(companyToken => 
      fetchOlaClickData(companyToken, previousParams)
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
    console.log(`   Current orders: ${overallComparison.orders.current}`);
    console.log(`   Previous orders: ${overallComparison.orders.previous}`);
    console.log(`   Orders difference: ${overallComparison.orders.difference}`);
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
    console.error('❌ Error in /api/orders/all:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get data from a specific account
app.get('/api/orders/:companyToken', async (req, res) => {
  try {
    const { companyToken } = req.params;
    const queryParams = req.query;
    
    const result = await fetchOlaClickData(companyToken, queryParams);
    
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

// Update account configuration
app.post('/api/accounts/:companyToken', async (req, res) => {
  const { companyToken } = req.params;
  const { name, cookie, tokens, additional_cookies } = req.body;
  
  if (!name || !companyToken) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: name, company_token' 
    });
  }

  try {
    // Get existing account or create new one
    let account = ACCOUNTS[companyToken];
    const isNewAccount = !account;
    
    if (!account) {
      account = {
        company_token: companyToken,
        name,
        tokens: [],
        additional_cookies: ''
      };
    }

    if (cookie) {
      // Migrate legacy cookie format to new tokens format
      const migrated = migrateLegacyCookie(cookie);
      account.tokens = migrated.tokens;
      account.additional_cookies = migrated.additional_cookies;
      account.cookie = null; // Clear legacy cookie
    } else if (tokens && Array.isArray(tokens)) {
      account.tokens = tokens;
      account.additional_cookies = additional_cookies || '';
      account.cookie = null; // Clear legacy cookie
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Must provide either cookie string or tokens array' 
      });
    }

    account.name = name;
    account.company_token = companyToken;
    
    // Save the account
    ACCOUNTS[companyToken] = account;
    await saveAccounts(ACCOUNTS);
    
    res.json({ 
      success: true, 
      message: `Account ${companyToken} ${isNewAccount ? 'created' : 'updated'} successfully`,
      account: account
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save account: ' + error.message 
    });
  }
});

// Delete account
app.delete('/api/accounts/:companyToken', async (req, res) => {
  const { companyToken } = req.params;
  
  if (!ACCOUNTS[companyToken]) {
    return res.status(404).json({ 
      success: false, 
      error: 'Account not found' 
    });
  }
  
  try {
    delete ACCOUNTS[companyToken];
    await saveAccounts(ACCOUNTS);
    
    res.json({ 
      success: true, 
      message: `Account ${companyToken} deleted successfully` 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete account: ' + error.message 
    });
  }
});

// Serve dashboard HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 OlaClick Dashboard server running on port ${PORT}`);
  console.log(`📊 Dashboard available at: http://localhost:${PORT}`);
  console.log(`📁 Accounts file: ${ACCOUNTS_FILE}`);
  console.log(`🔧 API endpoints:`);
  console.log(`   GET /api/accounts - List all accounts`);
  console.log(`   GET /api/accounts/:companyToken - Get account details`);
  console.log(`   POST /api/accounts/:companyToken - Add or update account`);
  console.log(`   DELETE /api/accounts/:companyToken - Delete account`);
  console.log(`   GET /api/orders/all - Get orders from all accounts`);
  console.log(`   GET /api/orders/:companyToken - Get orders from specific account`);
  console.log(`✨ Features:`);
  console.log(`   📈 7-day comparison trends`);
  console.log(`   🔄 Automatic legacy cookie migration`);
  console.log(`   💾 File-based credential storage`);
  console.log(`   🎯 Company token as primary key`);
}); 