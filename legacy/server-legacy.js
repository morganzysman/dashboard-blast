import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';
import cron from 'node-cron';
import webpush from 'web-push';

// Fix for web-push ES module compatibility
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Configure Web Push
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ'
};

// Contact email for VAPID (can be overridden with environment variable)
const vapidContact = process.env.VAPID_CONTACT_EMAIL || 'admin@olaclick.com';

webpush.setVapidDetails(
  `mailto:${vapidContact}`,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Log VAPID configuration (only show first/last 8 characters of keys for security)
console.log('🔐 VAPID Keys Configuration:');
console.log(`   Public Key: ${vapidKeys.publicKey.substring(0, 8)}...${vapidKeys.publicKey.substring(vapidKeys.publicKey.length - 8)}`);
console.log(`   Private Key: ${vapidKeys.privateKey.substring(0, 8)}...${vapidKeys.privateKey.substring(vapidKeys.privateKey.length - 8)}`);
console.log(`   Contact Email: ${vapidContact}`);
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

// Warn if using default keys
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn('⚠️  WARNING: Using default VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables for production!');
}

// In-memory storage for push subscriptions (use database in production)
const pushSubscriptions = new Map();

// In-memory storage for notification errors and debug info
const notificationErrors = new Map();
const notificationDebugLog = [];

// Helper function to log notification events
function logNotificationEvent(userId, event, details = {}) {
  const logEntry = {
    userId,
    userEmail: sessions.get(userId)?.userEmail || 'Unknown',
    event,
    details,
    timestamp: new Date().toISOString(),
    userAgent: details.userAgent || 'Unknown'
  };
  
  notificationDebugLog.push(logEntry);
  
  // Keep only last 100 entries
  if (notificationDebugLog.length > 100) {
    notificationDebugLog.shift();
  }
  
  console.log(`📱 Notification Event: ${event} for ${logEntry.userEmail}`, details);
}

// Helper function to store notification error
function storeNotificationError(userId, error, context = {}) {
  const errorEntry = {
    userId,
    userEmail: sessions.get(userId)?.userEmail || 'Unknown',
    error: error.message || error.toString(),
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  };
  
  notificationErrors.set(userId, errorEntry);
  logNotificationEvent(userId, 'error', { error: error.message, context });
}

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

// Path to the users configuration file
const USERS_FILE = path.join(__dirname, 'users.json');

// In-memory session storage (use Redis in production)
const sessions = new Map();

// Session expiry time (24 hours)
const SESSION_EXPIRY = 24 * 60 * 60 * 1000;

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

// Load users from file
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.log('👤 Users file not found, creating empty users file...');
    const defaultUsers = { users: [] };
    await saveUsers(defaultUsers);
    return defaultUsers;
  }
}

// Save users to file
async function saveUsers(usersData) {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
    console.log('👤 Users saved successfully');
  } catch (error) {
    console.error('❌ Error saving users:', error.message);
    throw error;
  }
}

// Hash password
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Verify password
async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Create session
function createSession(user) {
  const sessionId = uuidv4();
  const expiresAt = Date.now() + SESSION_EXPIRY;
  
  sessions.set(sessionId, {
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    userAccounts: user.accounts || [],
    userTimezone: user.timezone || 'America/Lima',
    userCurrency: user.currency || 'PEN',
    userCurrencySymbol: user.currencySymbol || 'S/',
    expiresAt
  });
  
  console.log(`🔑 Session created for user: ${user.email} (ID: ${sessionId.substring(0, 8)}...) - Expires: ${new Date(expiresAt).toLocaleString()}`);
  
  return sessionId;
}

// Verify session
function verifySession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  
  // Extend session expiry for active users (sliding window)
  // Only extend if session has less than 12 hours remaining
  const timeRemaining = session.expiresAt - Date.now();
  const twelveHours = 12 * 60 * 60 * 1000;
  
  if (timeRemaining < twelveHours) {
    session.expiresAt = Date.now() + SESSION_EXPIRY;
    console.log(`🔄 Session extended for user: ${session.userEmail}`);
  }
  
  return session;
}

// Clean expired sessions
function cleanExpiredSessions() {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
      cleanedCount++;
      console.log(`🗑️  Cleaned expired session for user: ${session.userEmail}`);
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Session cleanup completed: ${cleanedCount} expired sessions removed, ${sessions.size} active sessions remaining`);
  }
}

// Authentication middleware
function requireAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!sessionId) {
    return res.status(401).json({ 
      success: false, 
      error: 'No session provided',
      requiresLogin: true 
    });
  }
  
  const session = verifySession(sessionId);
  if (!session) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired session',
      requiresLogin: true 
    });
  }
  
  req.user = session;
  next();
}

// Load users on startup
let USERS_DATA = await loadUsers();

// Clean expired sessions every hour
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

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

// Helper function to get timezone-aware date
function getTimezoneAwareDate(dateString, timezone = 'America/Lima') {
  // Ensure timezone is valid or use default
  const validTimezone = timezone && timezone !== 'undefined' ? timezone : 'America/Lima';
  
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
function getDateDaysAgoInTimezone(days, timezone = 'America/Lima') {
  // Ensure timezone is valid or use default
  const validTimezone = timezone && timezone !== 'undefined' ? timezone : 'America/Lima';
  
  // Get current date in the target timezone first
  const now = new Date();
  const todayInTargetTz = now.toLocaleDateString('en-CA', { timeZone: validTimezone });
  
  // Parse the date and subtract days
  const todayDate = new Date(todayInTargetTz + 'T12:00:00'); // Use noon to avoid timezone edge cases
  const targetDate = new Date(todayDate);
  targetDate.setDate(todayDate.getDate() - days);
  
  return targetDate.toLocaleDateString('en-CA');
}

// Helper function to make OlaClick API requests
async function fetchOlaClickData(account, queryParams = {}) {
  if (!account) {
    throw new Error('Account not found');
  }

  // Get timezone from parameters or default to Lima, ensure it's valid
  let timezone = queryParams['filter[timezone]'] || 'America/Lima';
  if (!timezone || timezone === 'undefined') {
    timezone = 'America/Lima';
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

  // Debug logging for API requests
  console.log(`🔍 API Request for ${account.company_token}:`);
  console.log(`   Timezone: ${timezone}`);
  console.log(`   Original Start Date: ${queryParams['filter[start_date]'] || 'default'}`);
  console.log(`   Original End Date: ${queryParams['filter[end_date]'] || 'default'}`);
  console.log(`   Today in ${timezone}: ${todayInTimezone}`);
  console.log(`   Processed Start Date: ${params['filter[start_date]']}`);
  console.log(`   Processed End Date: ${params['filter[end_date]']}`);
  console.log(`   Date processing status: ${params['filter[start_date]'] === queryParams['filter[start_date]'] ? 'UNCHANGED' : 'MODIFIED'}`);
  
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
    console.log(`📊 API Response for ${account.company_token}:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Raw Data: ${JSON.stringify(response.data)}`);

    // Normalize API response: map sum_total to sum for backward compatibility
    if (response.data && response.data.data && Array.isArray(response.data.data)) {
      response.data.data = response.data.data.map(method => ({
        ...method,
        sum: method.sum_total ?? method.sum ?? 0
      }));
    }

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
      accountKey: account.company_token
    };
  } catch (error) {
    console.error(`❌ Error fetching data for ${account.company_token}:`, error.message);
    if (error.response) {
      console.error(`   Response Status: ${error.response.status}`);
      console.error(`   Response Data: ${JSON.stringify(error.response.data)}`);
    }
    return {
      success: false,
      error: error.response?.data || error.message,
      account: account.name,
      accountKey: account.company_token
    };
  }
}

// API Routes

// ====== AUTHENTICATION ROUTES ======

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Find user by email
    const user = USERS_DATA.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.active);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.keys.hashedPassword);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    await saveUsers(USERS_DATA);
    
    // Create session
    const sessionId = createSession(user);
    
    console.log(`✅ User logged in: ${user.email} (${user.accounts?.length || 0} accounts)`);
    
    res.json({
      success: true,
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        timezone: user.timezone || 'America/Lima',
        currency: user.currency || 'PEN',
        currencySymbol: user.currencySymbol || 'S/',
        accountsCount: user.accounts?.length || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (sessionId) {
    sessions.delete(sessionId);
    console.log(`👋 User logged out: ${sessionId}`);
  }
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// Verify session endpoint
app.get('/api/auth/verify', (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!sessionId) {
    console.log('❌ Session verification failed: No session ID provided');
    return res.status(401).json({
      success: false,
      error: 'No session provided',
      requiresLogin: true
    });
  }
  
  const session = verifySession(sessionId);
  
  if (!session) {
    console.log(`❌ Session verification failed: Invalid or expired session (ID: ${sessionId.substring(0, 8)}...)`);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session',
      requiresLogin: true
    });
  }
  
  console.log(`✅ Session verified for user: ${session.userEmail} (ID: ${sessionId.substring(0, 8)}...) - Expires: ${new Date(session.expiresAt).toLocaleString()}`);
  
  res.json({
    success: true,
    user: {
      id: session.userId,
      name: session.userName,
      email: session.userEmail,
      role: session.userRole,
      timezone: session.userTimezone || 'America/Lima',
      currency: session.userCurrency || 'PEN',
      currencySymbol: session.userCurrencySymbol || 'S/',
      accountsCount: session.userAccounts?.length || 0
    }
  });
});

// ====== PROTECTED API ROUTES ======

// Get data from all user's accounts
app.get('/api/orders/all', requireAuth, async (req, res) => {
  try {
    console.log('🚀 Starting /api/orders/all request');
    const queryParams = req.query;
    console.log(`   Original query params: ${JSON.stringify(queryParams)}`);
    
    // Get user's accounts and timezone with safe fallbacks
    const userAccounts = req.user.userAccounts || [];
    let userTimezone = req.user.userTimezone || 'America/Lima';
    
    // Ensure timezone is valid
    if (!userTimezone || userTimezone === 'undefined' || userTimezone === 'null') {
      userTimezone = 'America/Lima';
    }
    
    console.log(`   User timezone: ${userTimezone}`);
    
    if (userAccounts.length === 0) {
      return res.json({
        success: true,
        accounts: [],
        aggregated: {
          paymentMethods: [],
          totalOrders: 0,
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
      let timezone = currentParams['filter[timezone]'] || 'America/Lima';
      if (!timezone || timezone === 'undefined') {
        timezone = 'America/Lima';
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
      
      // Calculate 7 days before in the same timezone
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(startDate.getDate() - 7);
      const prevEndDate = new Date(endDate);
      prevEndDate.setDate(endDate.getDate() - 7);
      
      // Format dates for the specific timezone
      previousParams['filter[start_date]'] = prevStartDate.toLocaleDateString('en-CA', { timeZone: timezone });
      previousParams['filter[end_date]'] = prevEndDate.toLocaleDateString('en-CA', { timeZone: timezone });
      
      console.log(`   Calculated previous start: ${previousParams['filter[start_date]']}`);
      console.log(`   Calculated previous end: ${previousParams['filter[end_date]']}`);
    } else {
      console.log('📅 Using default date ranges (today vs 7 days ago)');
      
      // Get timezone from parameters or default to Lima, ensure it's valid
      let timezone = currentParams['filter[timezone]'] || 'America/Lima';
      if (!timezone || timezone === 'undefined') {
        timezone = 'America/Lima';
      }
      
      // Use timezone-aware date calculation
      const todayInTimezone = getTimezoneAwareDate(null, timezone);
      const sevenDaysAgoInTimezone = getDateDaysAgoInTimezone(7, timezone);
      
      currentParams['filter[start_date]'] = todayInTimezone;
      currentParams['filter[end_date]'] = todayInTimezone;
      previousParams['filter[start_date]'] = sevenDaysAgoInTimezone;
      previousParams['filter[end_date]'] = sevenDaysAgoInTimezone;
      
      console.log(`   Using timezone: ${timezone}`);
      console.log(`   Today in ${timezone}: ${todayInTimezone}`);
      console.log(`   7 days ago in ${timezone}: ${sevenDaysAgoInTimezone}`);
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

// Debug endpoint to check timezone handling
app.get('/api/debug/timezone', (req, res) => {
  const timezone = req.query.timezone || 'America/Lima';
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

// Get data from a specific account (if user has access)
app.get('/api/orders/:companyToken', requireAuth, async (req, res) => {
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

// Serve dashboard HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve notifications debug page
app.get('/notifications-debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'notifications-debug.html'));
});

// ====== PUSH NOTIFICATION ROUTES ======

// Get VAPID public key
app.get('/api/notifications/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: vapidKeys.publicKey
  });
});

// Subscribe to push notifications
app.post('/api/notifications/subscribe', requireAuth, async (req, res) => {
  try {
    const subscription = req.body;
    const userId = req.user.userId;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    logNotificationEvent(userId, 'subscribe_attempt', { 
      userAgent,
      endpoint: subscription?.endpoint,
      hasKeys: !!(subscription?.keys),
      hasP256dh: !!(subscription?.keys?.p256dh),
      hasAuth: !!(subscription?.keys?.auth)
    });
    
    if (!subscription || !subscription.endpoint) {
      const error = new Error('Invalid subscription data');
      storeNotificationError(userId, error, { subscription, userAgent });
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription data',
        details: {
          hasSubscription: !!subscription,
          hasEndpoint: !!subscription?.endpoint,
          subscriptionKeys: subscription ? Object.keys(subscription) : []
        }
      });
    }
    
    // Validate required subscription properties
    if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      const error = new Error('Missing required subscription keys');
      storeNotificationError(userId, error, { subscription, userAgent });
      return res.status(400).json({
        success: false,
        error: 'Missing required subscription keys',
        details: {
          hasKeys: !!subscription.keys,
          hasP256dh: !!subscription.keys?.p256dh,
          hasAuth: !!subscription.keys?.auth
        }
      });
    }
    
    // Test the subscription by sending a test notification
    try {
      const testPayload = {
        title: '✅ Notifications Activated',
        body: 'You will now receive daily sales reports and updates.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'subscription-test',
        data: {
          type: 'subscription-test',
          timestamp: Date.now()
        }
      };
      
      await webpush.sendNotification(subscription, JSON.stringify(testPayload));
      logNotificationEvent(userId, 'test_notification_sent', { userAgent });
      
    } catch (testError) {
      storeNotificationError(userId, testError, { 
        context: 'test_notification', 
        subscription, 
        userAgent 
      });
      
      return res.status(400).json({
        success: false,
        error: 'Failed to send test notification',
        details: {
          error: testError.message,
          statusCode: testError.statusCode,
          headers: testError.headers
        }
      });
    }
    
    // Store subscription for this user
    pushSubscriptions.set(userId, {
      subscription,
      userEmail: req.user.userEmail,
      userName: req.user.userName,
      timezone: req.user.userTimezone || 'America/Lima',
      currency: req.user.userCurrency || 'PEN',
      currencySymbol: req.user.userCurrencySymbol || 'S/',
      subscribedAt: new Date().toISOString(),
      userAgent,
      endpoint: subscription.endpoint
    });
    
    // Clear any previous errors for this user
    notificationErrors.delete(userId);
    
    logNotificationEvent(userId, 'subscribe_success', { userAgent });
    
    console.log(`✅ Push subscription added for user: ${req.user.userEmail}`);
    
    res.json({
      success: true,
      message: 'Successfully subscribed to push notifications',
      testNotificationSent: true
    });
    
  } catch (error) {
    storeNotificationError(req.user.userId, error, { 
      context: 'subscription_process',
      userAgent: req.headers['user-agent']
    });
    
    console.error('❌ Error subscribing to push notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to push notifications',
      details: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

// Unsubscribe from push notifications
app.post('/api/notifications/unsubscribe', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (pushSubscriptions.has(userId)) {
      pushSubscriptions.delete(userId);
      console.log(`✅ Push subscription removed for user: ${req.user.userEmail}`);
    }
    
    res.json({
      success: true,
      message: 'Successfully unsubscribed from push notifications'
    });
    
  } catch (error) {
    console.error('❌ Error unsubscribing from push notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from push notifications'
    });
  }
});

// Send test notification
app.post('/api/notifications/test', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userSubscription = pushSubscriptions.get(userId);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    logNotificationEvent(userId, 'test_notification_request', { userAgent });
    
    if (!userSubscription) {
      const error = new Error('No push subscription found for this user');
      storeNotificationError(userId, error, { context: 'test_notification', userAgent });
      return res.status(404).json({
        success: false,
        error: 'No push subscription found for this user',
        details: {
          subscriptionExists: false,
          totalSubscriptions: pushSubscriptions.size
        }
      });
    }
    
    const notificationPayload = {
      title: '🧪 Test Notification',
      body: `Hello ${req.user.userName}! This is a test notification from OlaClick Analytics.`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'test-notification',
      data: {
        url: '/',
        type: 'test',
        timestamp: Date.now()
      },
      actions: [
        {
          action: 'view',
          title: 'View Dashboard'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };
    
    await webpush.sendNotification(
      userSubscription.subscription,
      JSON.stringify(notificationPayload)
    );
    
    logNotificationEvent(userId, 'test_notification_sent', { userAgent });
    
    console.log(`📨 Test notification sent to: ${req.user.userEmail}`);
    
    res.json({
      success: true,
      message: 'Test notification sent successfully'
    });
    
  } catch (error) {
    storeNotificationError(req.user.userId, error, { 
      context: 'test_notification',
      userAgent: req.headers['user-agent']
    });
    
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification',
      details: {
        message: error.message,
        statusCode: error.statusCode,
        headers: error.headers
      }
    });
  }
});

// Send daily report to all subscribers
async function sendDailyReports() {
  console.log('📊 Starting daily report generation...');
  
  try {
    const today = new Date();
    const users = USERS_DATA.users.filter(user => user.active);
    
    for (const user of users) {
      const userSubscription = pushSubscriptions.get(user.id);
      
      if (!userSubscription || !user.accounts || user.accounts.length === 0) {
        continue;
      }
      
      try {
        // Generate report for this user
        const report = await generateUserDailyReport(user, userSubscription);
        
        if (report) {
          // Send notification
          await webpush.sendNotification(
            userSubscription.subscription,
            JSON.stringify(report)
          );
          
          console.log(`📨 Daily report sent to: ${user.email}`);
        }
        
      } catch (error) {
        console.error(`❌ Error sending daily report to ${user.email}:`, error);
        
        // Remove invalid subscription
        if (error.statusCode === 410) {
          pushSubscriptions.delete(user.id);
          console.log(`🗑️ Removed invalid subscription for: ${user.email}`);
        }
      }
    }
    
    console.log('✅ Daily reports generation completed');
    
  } catch (error) {
    console.error('❌ Error in daily reports generation:', error);
  }
}

// Generate daily report for a specific user
async function generateUserDailyReport(user, userSubscription) {
  try {
    const timezone = userSubscription.timezone || 'America/Lima';
    const currencySymbol = userSubscription.currencySymbol || 'S/';
    
    // Get today's date in user's timezone
    const today = new Date();
    const todayInUserTz = today.toLocaleDateString('en-CA', { timeZone: timezone });
    
    // Prepare parameters for today's data
    const todayParams = {
      'filter[start_date]': todayInUserTz,
      'filter[end_date]': todayInUserTz,
      'filter[timezone]': timezone
    };
    
    // Fetch data for all user's accounts
    const promises = user.accounts.map(account => 
      fetchOlaClickData(account, todayParams)
    );
    
    const results = await Promise.all(promises);
    
    // Calculate totals
    let totalOrders = 0;
    let totalAmount = 0;
    let successfulAccounts = 0;
    
    results.forEach(result => {
      if (result.success && result.data && result.data.data) {
        successfulAccounts++;
        result.data.data.forEach(method => {
          totalOrders += method.count || 0;
          totalAmount += method.sum || 0;
        });
      }
    });
    
    // Format the notification based on whether there are sales or not
    let notificationPayload;
    
    if (totalOrders === 0) {
      // Send "no sales yet" notification
      console.log(`📊 No sales data for ${user.email} today - sending "no sales yet" notification`);
      
      const accountText = successfulAccounts === 1 ? 'account' : 'accounts';
      
      notificationPayload = {
        title: '📊 Daily Sales Report',
        body: `No sales yet today from ${successfulAccounts} ${accountText}. Keep an eye on your dashboard!`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'daily-report-no-sales',
        requireInteraction: false,
        data: {
          url: `/?view=today&date=${todayInUserTz}`,
          type: 'daily-report-no-sales',
          timestamp: Date.now(),
          reportData: {
            date: todayInUserTz,
            totalOrders: 0,
            totalAmount: 0,
            accountsCount: successfulAccounts,
            currency: currencySymbol,
            hasData: false
          }
        },
        actions: [
          {
            action: 'view',
            title: 'View Dashboard'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ]
      };
    } else {
      // Send regular sales notification
      const formattedAmount = `${currencySymbol} ${totalAmount.toFixed(2)}`;
      const accountText = successfulAccounts === 1 ? 'account' : 'accounts';
      
      notificationPayload = {
        title: '📊 Daily Sales Report',
        body: `Today's performance: ${totalOrders} orders, ${formattedAmount} from ${successfulAccounts} ${accountText}`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'daily-report',
        requireInteraction: true,
        data: {
          url: `/?view=today&date=${todayInUserTz}`,
          type: 'daily-report',
          timestamp: Date.now(),
          reportData: {
            date: todayInUserTz,
            totalOrders,
            totalAmount,
            accountsCount: successfulAccounts,
            currency: currencySymbol,
            hasData: true
          }
        },
        actions: [
          {
            action: 'view',
            title: 'View Dashboard'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ]
      };
    }
    
    return notificationPayload;
    
  } catch (error) {
    console.error(`❌ Error generating report for ${user.email}:`, error);
    return null;
  }
}

// Schedule daily reports (runs at 9 AM every day)
// Run every 5 minutes for testing
cron.schedule('*/5 * * * *', () => {
  console.log('⏰ [TEST] Daily report cron job triggered (every 5 minutes)');
  sendDailyReports();
}, {
  timezone: 'America/Lima' // Adjust this to your preferred timezone
});

// Manual trigger for daily reports (for testing)
app.post('/api/notifications/send-daily-reports', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    await sendDailyReports();
    
    res.json({
      success: true,
      message: 'Daily reports sent successfully'
    });
    
  } catch (error) {
    console.error('❌ Error sending daily reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send daily reports'
    });
  }
});

// Get notification status for current user
app.get('/api/notifications/status', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const userSubscription = pushSubscriptions.get(userId);
  const userError = notificationErrors.get(userId);
  
  res.json({
    success: true,
    isSubscribed: !!userSubscription,
    subscriptionCount: pushSubscriptions.size,
    subscribedAt: userSubscription?.subscribedAt || null,
    userAgent: userSubscription?.userAgent || null,
    endpoint: userSubscription?.endpoint || null,
    lastError: userError ? {
      message: userError.error,
      timestamp: userError.timestamp,
      context: userError.context
    } : null
  });
});

// New debugging endpoints

// Get notification debug info for current user
app.get('/api/notifications/debug', requireAuth, (req, res) => {
  const userId = req.user.userId;
  const userSubscription = pushSubscriptions.get(userId);
  const userError = notificationErrors.get(userId);
  
  // Get user's notification events
  const userEvents = notificationDebugLog.filter(log => log.userId === userId);
  
  res.json({
    success: true,
    user: {
      id: userId,
      email: req.user.userEmail,
      name: req.user.userName
    },
    subscription: userSubscription ? {
      subscribedAt: userSubscription.subscribedAt,
      userAgent: userSubscription.userAgent,
      endpoint: userSubscription.endpoint,
      hasValidKeys: !!(userSubscription.subscription?.keys?.p256dh && userSubscription.subscription?.keys?.auth)
    } : null,
    lastError: userError,
    events: userEvents.slice(-10), // Last 10 events
    browserInfo: {
      userAgent: req.headers['user-agent'],
      acceptLanguage: req.headers['accept-language'],
      acceptEncoding: req.headers['accept-encoding']
    }
  });
});

// Get all notification debug info (admin only)
app.get('/api/notifications/debug/all', requireAuth, (req, res) => {
  // Check if user is admin
  if (req.user.userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  
  const allErrors = Array.from(notificationErrors.values());
  const allSubscriptions = Array.from(pushSubscriptions.entries()).map(([userId, data]) => ({
    userId,
    userEmail: data.userEmail,
    subscribedAt: data.subscribedAt,
    userAgent: data.userAgent,
    endpoint: data.endpoint
  }));
  
  res.json({
    success: true,
    statistics: {
      totalSubscriptions: pushSubscriptions.size,
      totalErrors: notificationErrors.size,
      totalEvents: notificationDebugLog.length
    },
    subscriptions: allSubscriptions,
    errors: allErrors,
    events: notificationDebugLog.slice(-50) // Last 50 events
  });
});

// Test notification capabilities
app.post('/api/notifications/test-capabilities', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    logNotificationEvent(userId, 'capabilities_test', { userAgent });
    
    // Test VAPID configuration
    const vapidTest = {
      publicKey: !!vapidKeys.publicKey,
      privateKey: !!vapidKeys.privateKey,
      contact: !!vapidContact
    };
    
    // Test user subscription
    const userSubscription = pushSubscriptions.get(userId);
    const subscriptionTest = {
      exists: !!userSubscription,
      hasEndpoint: !!userSubscription?.subscription?.endpoint,
      hasKeys: !!userSubscription?.subscription?.keys,
      hasP256dh: !!userSubscription?.subscription?.keys?.p256dh,
      hasAuth: !!userSubscription?.subscription?.keys?.auth
    };
    
    // Test environment
    const environmentTest = {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasVapidPublicKey: !!process.env.VAPID_PUBLIC_KEY,
      hasVapidPrivateKey: !!process.env.VAPID_PRIVATE_KEY,
      hasVapidContact: !!process.env.VAPID_CONTACT_EMAIL
    };
    
    res.json({
      success: true,
      tests: {
        vapid: vapidTest,
        subscription: subscriptionTest,
        environment: environmentTest
      },
      browserInfo: {
        userAgent,
        acceptLanguage: req.headers['accept-language'],
        acceptEncoding: req.headers['accept-encoding']
      }
    });
    
  } catch (error) {
    storeNotificationError(req.user.userId, error, { 
      context: 'capabilities_test',
      userAgent: req.headers['user-agent']
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to test notification capabilities',
      details: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

// Clear notification errors for current user
app.post('/api/notifications/clear-errors', requireAuth, (req, res) => {
  const userId = req.user.userId;
  
  notificationErrors.delete(userId);
  
  // Remove user's events from debug log
  const userEvents = notificationDebugLog.filter(log => log.userId !== userId);
  notificationDebugLog.length = 0;
  notificationDebugLog.push(...userEvents);
  
  logNotificationEvent(userId, 'errors_cleared', { 
    userAgent: req.headers['user-agent'] 
  });
  
  res.json({
    success: true,
    message: 'Notification errors cleared'
  });
});

// ====== HEALTH CHECK ENDPOINT ======

// Health check endpoint for Railway and other deployment platforms
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development',
    version: '2.0.0'
  });
});

// Alternative health check endpoints (common patterns)
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OlaClick Dashboard server running on port ${PORT}`);
  console.log(`📊 Dashboard available at: http://localhost:${PORT}`);
  console.log(`🔔 Notifications Debug available at: http://localhost:${PORT}/notifications-debug`);
  console.log(`👤 Users file: ${USERS_FILE}`);
  console.log(`🔧 API endpoints:`);
  console.log(`   POST /api/auth/login - User login`);
  console.log(`   POST /api/auth/logout - User logout`);
  console.log(`   GET /api/auth/verify - Verify session`);
  console.log(`   GET /api/orders/all - Get orders from all user accounts`);
  console.log(`   GET /api/orders/:companyToken - Get orders from specific account`);
  console.log(`   GET /api/notifications/vapid-public-key - Get VAPID public key`);
  console.log(`   POST /api/notifications/subscribe - Subscribe to push notifications`);
  console.log(`   POST /api/notifications/unsubscribe - Unsubscribe from push notifications`);
  console.log(`   POST /api/notifications/test - Send test notification`);
  console.log(`   POST /api/notifications/send-daily-reports - Send daily reports (admin)`);
  console.log(`   GET /api/notifications/status - Get notification status`);
  console.log(`   GET /api/notifications/debug - Get notification debug info for current user`);
  console.log(`   GET /api/notifications/debug/all - Get all notification debug info (admin)`);
  console.log(`   POST /api/notifications/test-capabilities - Test notification capabilities`);
  console.log(`   POST /api/notifications/clear-errors - Clear notification errors for current user`);
  console.log(`   GET /health - Health check endpoint`);
  console.log(`   GET /healthz - Health check endpoint (alternative)`);
  console.log(`   GET /ping - Ping endpoint`);
  console.log(`🔔 Debugging features:`);
  console.log(`   📱 Mobile-friendly notifications debug page`);
  console.log(`   🔍 Detailed error logging and event tracking`);
  console.log(`   📊 Browser compatibility and capability testing`);
  console.log(`   💾 Debug information download and export`);
  console.log(`✨ Features:`);
  console.log(`   📈 7-day comparison trends`);
  console.log(`   👥 User-based account access`);
  console.log(`   🔐 Session-based authentication`);
  console.log(`   🎯 Per-user account management`);
  console.log(`   📱 PWA with offline support`);
  console.log(`   🔔 Push notifications & daily reports`);
  console.log(`   ⏰ Daily reports scheduled every 5 minutes for testing`);
  console.log(`🌐 Server listening on all interfaces (0.0.0.0:${PORT})`);
}); 