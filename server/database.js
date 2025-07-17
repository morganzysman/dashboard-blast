// PostgreSQL Database Module
// Handles all database operations for users, sessions, and push subscriptions

import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
let dbConfig;

if (process.env.DATABASE_URL) {
  // Railway and other platforms provide DATABASE_URL
  console.log('🔗 Using DATABASE_URL connection string');
  console.log(`   Connection: ${process.env.DATABASE_URL.replace(/:[^:@]*@/, ':****@')}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
} else {
  // Development and custom setups use individual variables
  console.log('🔧 Using individual DB_* environment variables');
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Port: ${process.env.DB_PORT || 5432}`);
  console.log(`   Database: ${process.env.DB_NAME || 'olaclick_analytics'}`);
  console.log(`   User: ${process.env.DB_USER || 'postgres'}`);
  console.log(`   SSL: ${process.env.DB_SSL === 'true' ? 'enabled' : 'disabled'}`);
  
  dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'olaclick_analytics',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
}

// Create connection pool
const pool = new Pool(dbConfig);

// Database connection event handlers
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err);
});

// Run database migrations
export async function runMigrations() {
  console.log('🔧 Running database migrations...');
  
  try {
    // Read migration files from migrations directory
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const migrationFiles = await fs.readdir(migrationsDir);
    const sortedMigrations = migrationFiles
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`📂 Found ${sortedMigrations.length} migration files`);
    
    // Create migrations table first if it doesn't exist
    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_migrations_filename ON migrations(filename);
    `;
    
    await pool.query(createMigrationsTable);
    
    // Get already applied migrations
    const appliedResult = await pool.query('SELECT filename FROM migrations ORDER BY filename');
    const appliedMigrations = new Set(appliedResult.rows.map(row => row.filename));
    
    console.log(`📊 Already applied: ${appliedMigrations.size} migrations`);
    
    // Run pending migrations
    let appliedCount = 0;
    
    for (const filename of sortedMigrations) {
      if (appliedMigrations.has(filename)) {
        console.log(`⏭️  Skipping ${filename} (already applied)`);
        continue;
      }
      
      console.log(`🚀 Applying migration: ${filename}`);
      
      try {
        // Read migration file
        const migrationPath = path.join(migrationsDir, filename);
        const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
        
        // Run migration in a transaction
        await pool.query('BEGIN');
        
        // Execute migration SQL
        await pool.query(migrationSQL);
        
        // Record migration as applied
        await pool.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [filename]
        );
        
        await pool.query('COMMIT');
        
        console.log(`✅ Applied migration: ${filename}`);
        appliedCount++;
        
      } catch (migrationError) {
        await pool.query('ROLLBACK');
        console.error(`❌ Error applying migration ${filename}:`, migrationError);
        throw new Error(`Migration ${filename} failed: ${migrationError.message}`);
      }
    }
    
    if (appliedCount > 0) {
      console.log(`✅ Successfully applied ${appliedCount} new migrations`);
    } else {
      console.log('✅ All migrations are up to date');
    }
    
    // Log migration completion
    await logNotificationEvent(
      '00000000-0000-0000-0000-000000000000',
      'database_migrations',
      `Database migrations completed: ${appliedCount} new migrations applied`,
      { 
        totalMigrations: sortedMigrations.length,
        appliedMigrations: appliedMigrations.size,
        newMigrations: appliedCount
      },
      true
    );
    
    return true;
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    
    // Try to log error if basic connection works
    try {
      await logNotificationEvent(
        '00000000-0000-0000-0000-000000000000',
        'database_migrations_error',
        'Database migrations failed',
        { error: error.message },
        false
      );
    } catch (logError) {
      console.error('❌ Could not log migration error:', logError);
    }
    
    throw error;
  }
}

// Initialize database (run migrations)
export async function initializeDatabase() {
  console.log('🔧 Initializing database...');
  
  try {
    await runMigrations();
    console.log('✅ Database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Get migration status
export async function getMigrationStatus() {
  try {
    // Read migration files from migrations directory
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const migrationFiles = await fs.readdir(migrationsDir);
    const sortedMigrations = migrationFiles
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Get applied migrations
    const appliedResult = await pool.query(
      'SELECT filename, applied_at FROM migrations ORDER BY filename'
    );
    const appliedMigrations = new Map(
      appliedResult.rows.map(row => [row.filename, row.applied_at])
    );
    
    // Build status report
    const migrationStatus = sortedMigrations.map(filename => ({
      filename,
      applied: appliedMigrations.has(filename),
      appliedAt: appliedMigrations.get(filename) || null
    }));
    
    return {
      totalMigrations: sortedMigrations.length,
      appliedCount: appliedMigrations.size,
      pendingCount: sortedMigrations.length - appliedMigrations.size,
      migrations: migrationStatus
    };
  } catch (error) {
    console.error('❌ Error getting migration status:', error);
    throw error;
  }
}

// Test database connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    client.release();
    
    console.log('✅ Database connection test successful');
    console.log(`   Time: ${result.rows[0].current_time}`);
    console.log(`   Version: ${result.rows[0].db_version.split(' ').slice(0, 2).join(' ')}`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}

// ====== USER MANAGEMENT ======

// Create a new user
export async function createUser(userData) {
  const query = `
    INSERT INTO users (email, name, role, hashed_password, accounts, timezone, currency, currency_symbol)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, email, name, role, timezone, currency, currency_symbol, created_at
  `;
  
  const values = [
    userData.email,
    userData.name,
    userData.role || 'user',
    userData.hashedPassword,
    JSON.stringify(userData.accounts || []),
    userData.timezone || 'America/Lima',
    userData.currency || 'PEN',
    userData.currencySymbol || 'S/'
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Create user with accounts (for super-admin interface)
export async function createUserWithAccounts(userData, accounts = []) {
  const query = `
    INSERT INTO users (email, name, role, hashed_password, accounts, timezone, currency, currency_symbol)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, email, name, role, timezone, currency, currency_symbol, created_at, accounts
  `;
  
  const values = [
    userData.email,
    userData.name,
    userData.role || 'user',
    userData.hashedPassword,
    JSON.stringify(accounts),
    userData.timezone || 'America/Lima',
    userData.currency || 'PEN',
    userData.currencySymbol || 'S/'
  ];
  
  const result = await pool.query(query, values);
  const user = result.rows[0];
  return {
    ...user,
    accounts: user.accounts || []
  };
}

// Get all users (for super-admin interface)
export async function getAllUsers(includeInactive = false) {
  const whereClause = includeInactive ? '' : 'WHERE is_active = TRUE';
  const query = `
    SELECT id, email, name, role, accounts, timezone, currency, currency_symbol, 
           is_active, created_at, updated_at, last_login
    FROM users 
    ${whereClause}
    ORDER BY created_at DESC
  `;
  
  const result = await pool.query(query);
  
  return result.rows.map(user => ({
    ...user,
    accounts: user.accounts || []
  }));
}

// Update user role (for super-admin)
export async function updateUserRole(userId, newRole) {
  const query = `
    UPDATE users 
    SET role = $2, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $1
    RETURNING id, email, name, role, updated_at
  `;
  
  const result = await pool.query(query, [userId, newRole]);
  return result.rows[0];
}

// Update user status (activate/deactivate)
export async function updateUserStatus(userId, isActive) {
  const query = `
    UPDATE users 
    SET is_active = $2, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $1
    RETURNING id, email, name, is_active, updated_at
  `;
  
  const result = await pool.query(query, [userId, isActive]);
  return result.rows[0];
}

// Update user profile (name, timezone, currency)
export async function updateUserProfile(userId, profileData) {
  const query = `
    UPDATE users 
    SET name = $2, timezone = $3, currency = $4, currency_symbol = $5, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $1
    RETURNING id, email, name, timezone, currency, currency_symbol, updated_at
  `;
  
  const values = [
    userId,
    profileData.name,
    profileData.timezone || 'America/Lima',
    profileData.currency || 'PEN',
    profileData.currencySymbol || 'S/'
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Get user by email
export async function getUserByEmail(email) {
  const query = `
    SELECT id, email, name, role, hashed_password, accounts, timezone, currency, currency_symbol, 
           is_active, created_at, updated_at, last_login
    FROM users 
    WHERE email = $1 AND is_active = TRUE
  `;
  
  const result = await pool.query(query, [email]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const user = result.rows[0];
  return {
    ...user,
    accounts: user.accounts || []
  };
}

// Get user by ID
export async function getUserById(userId) {
  const query = `
    SELECT id, email, name, role, accounts, timezone, currency, currency_symbol, 
           is_active, created_at, updated_at, last_login
    FROM users 
    WHERE id = $1 AND is_active = TRUE
  `;
  
  const result = await pool.query(query, [userId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const user = result.rows[0];
  return {
    ...user,
    accounts: user.accounts || []
  };
}

// Update user last login
export async function updateUserLastLogin(userId) {
  const query = `
    UPDATE users 
    SET last_login = CURRENT_TIMESTAMP 
    WHERE id = $1
  `;
  
  await pool.query(query, [userId]);
}

// Get all active users
export async function getAllActiveUsers() {
  const query = `
    SELECT id, email, name, role, accounts, timezone, currency, currency_symbol, 
           is_active, created_at, updated_at, last_login
    FROM users 
    WHERE is_active = TRUE
    ORDER BY created_at DESC
  `;
  
  const result = await pool.query(query);
  
  return result.rows.map(user => ({
    ...user,
    accounts: user.accounts || []
  }));
}

// Update user accounts
export async function updateUserAccounts(userId, accounts) {
  const query = `
    UPDATE users 
    SET accounts = $2, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $1
    RETURNING id, email, name, accounts, updated_at
  `;
  
  const result = await pool.query(query, [userId, JSON.stringify(accounts)]);
  const user = result.rows[0];
  return {
    ...user,
    accounts: user.accounts || []
  };
}

// ====== SESSION MANAGEMENT ======

// Create session
export async function createSession(userId, sessionToken, expiresAt, userAgent = null, ipAddress = null) {
  const query = `
    INSERT INTO user_sessions (user_id, session_token, expires_at, user_agent, ip_address)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, session_token, expires_at, created_at
  `;
  
  const values = [userId, sessionToken, expiresAt, userAgent, ipAddress];
  const result = await pool.query(query, values);
  
  return result.rows[0];
}

// Get session with user data
export async function getSessionWithUser(sessionToken) {
  const query = `
    SELECT 
      s.id as session_id,
      s.session_token,
      s.expires_at,
      s.last_accessed,
      s.is_active as session_active,
      u.id as user_id,
      u.email,
      u.name,
      u.role,
      u.accounts,
      u.timezone,
      u.currency,
      u.currency_symbol,
      u.is_active as user_active
    FROM user_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.session_token = $1 
      AND s.is_active = TRUE 
      AND s.expires_at > CURRENT_TIMESTAMP
      AND u.is_active = TRUE
  `;
  
  const result = await pool.query(query, [sessionToken]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    sessionId: row.session_id,
    sessionToken: row.session_token,
    expiresAt: row.expires_at,
    lastAccessed: row.last_accessed,
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name,
      role: row.role,
      accounts: row.accounts || [],
      timezone: row.timezone,
      currency: row.currency,
      currencySymbol: row.currency_symbol
    }
  };
}

// Update session last accessed and extend expiry
export async function updateSessionAccess(sessionToken, newExpiresAt) {
  const query = `
    UPDATE user_sessions 
    SET last_accessed = CURRENT_TIMESTAMP, expires_at = $2
    WHERE session_token = $1 AND is_active = TRUE
  `;
  
  await pool.query(query, [sessionToken, newExpiresAt]);
}

// Delete session
export async function deleteSession(sessionToken) {
  const query = `
    UPDATE user_sessions 
    SET is_active = FALSE 
    WHERE session_token = $1
  `;
  
  await pool.query(query, [sessionToken]);
}

// Clean expired sessions
export async function cleanExpiredSessions() {
  const query = `SELECT clean_expired_sessions() as deleted_count`;
  const result = await pool.query(query);
  
  return result.rows[0].deleted_count;
}

// Get user session count
export async function getUserSessionCount(userId) {
  const query = `
    SELECT COUNT(*) as session_count
    FROM user_sessions
    WHERE user_id = $1 AND is_active = TRUE AND expires_at > CURRENT_TIMESTAMP
  `;
  
  const result = await pool.query(query, [userId]);
  return parseInt(result.rows[0].session_count);
}

// ====== PUSH SUBSCRIPTION MANAGEMENT ======

// Store push subscription
export async function storePushSubscription(userId, subscriptionData) {
  const query = `
    INSERT INTO push_subscriptions (
      user_id, endpoint, p256dh_key, auth_key, timezone, currency, currency_symbol, user_agent, notification_frequency
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_id) DO UPDATE SET
      endpoint = EXCLUDED.endpoint,
      p256dh_key = EXCLUDED.p256dh_key,
      auth_key = EXCLUDED.auth_key,
      timezone = EXCLUDED.timezone,
      currency = EXCLUDED.currency,
      currency_symbol = EXCLUDED.currency_symbol,
      user_agent = EXCLUDED.user_agent,
      notification_frequency = EXCLUDED.notification_frequency,
      subscribed_at = CURRENT_TIMESTAMP,
      is_active = TRUE,
      error_count = 0,
      last_error = NULL
    RETURNING id, subscribed_at
  `;
  
  const values = [
    userId,
    subscriptionData.subscription.endpoint,
    subscriptionData.subscription.keys.p256dh,
    subscriptionData.subscription.keys.auth,
    subscriptionData.timezone,
    subscriptionData.currency,
    subscriptionData.currencySymbol,
    subscriptionData.userAgent,
    subscriptionData.notificationFrequency || 30 // Default to 30 minutes
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Get push subscription by user ID
export async function getPushSubscription(userId) {
  const query = `
    SELECT ps.*, u.email, u.name
    FROM push_subscriptions ps
    JOIN users u ON ps.user_id = u.id
    WHERE ps.user_id = $1 AND ps.is_active = TRUE
  `;
  
  const result = await pool.query(query, [userId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    subscription: {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh_key,
        auth: row.auth_key
      }
    },
    userEmail: row.email,
    userName: row.name,
    timezone: row.timezone,
    currency: row.currency,
    currencySymbol: row.currency_symbol,
    subscribedAt: row.subscribed_at,
    userAgent: row.user_agent,
    endpoint: row.endpoint,
    notificationFrequency: row.notification_frequency,
    lastNotificationTime: row.last_notification_time
  };
}

// Get all active push subscriptions
export async function getAllActivePushSubscriptions() {
  const query = `
    SELECT ps.user_id, ps.endpoint, ps.p256dh_key, ps.auth_key, ps.timezone, ps.currency, 
           ps.currency_symbol, ps.subscribed_at, ps.user_agent, ps.notification_frequency,
           ps.last_notification_time, u.email, u.name, u.accounts
    FROM push_subscriptions ps
    JOIN users u ON ps.user_id = u.id
    WHERE ps.is_active = TRUE AND u.is_active = TRUE
  `;
  
  const result = await pool.query(query);
  
  return result.rows.map(row => ({
    userId: row.user_id,
    user: {
      email: row.email,
      name: row.name,
      accounts: row.accounts || []
    },
    subscription: {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh_key,
        auth: row.auth_key
      }
    },
    userEmail: row.email,
    userName: row.name,
    timezone: row.timezone,
    currency: row.currency,
    currencySymbol: row.currency_symbol,
    subscribedAt: row.subscribed_at,
    userAgent: row.user_agent,
    endpoint: row.endpoint,
    notificationFrequency: row.notification_frequency,
    lastNotificationTime: row.last_notification_time
  }));
}

// Update notification frequency for a user
export async function updateNotificationFrequency(userId, frequency) {
  const query = `
    UPDATE push_subscriptions 
    SET notification_frequency = $2, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND is_active = TRUE
    RETURNING notification_frequency
  `;
  
  const result = await pool.query(query, [userId, frequency]);
  return result.rows[0];
}

// Remove push subscription
export async function removePushSubscription(userId) {
  const query = `
    UPDATE push_subscriptions 
    SET is_active = FALSE 
    WHERE user_id = $1
  `;
  
  await pool.query(query, [userId]);
}

// Track notification sent (updated to include frequency tracking)
export async function trackNotificationSent(userId) {
  const query = `
    UPDATE push_subscriptions 
    SET 
      last_notification_sent = CURRENT_TIMESTAMP,
      last_notification_time = CURRENT_TIMESTAMP,
      notification_count = notification_count + 1,
      error_count = 0,
      last_error = NULL,
      last_error_at = NULL
    WHERE user_id = $1
  `;
  
  await pool.query(query, [userId]);
}

// Track notification error
export async function trackNotificationError(userId, error) {
  const query = `
    UPDATE push_subscriptions 
    SET 
      error_count = error_count + 1,
      last_error = $2,
      last_error_at = CURRENT_TIMESTAMP,
      is_active = CASE 
        WHEN error_count + 1 >= 5 THEN FALSE 
        ELSE is_active 
      END
    WHERE user_id = $1
    RETURNING error_count, is_active
  `;
  
  const result = await pool.query(query, [userId, error]);
  
  if (result.rows.length > 0) {
    const { error_count, is_active } = result.rows[0];
    
    // Log if subscription was deactivated
    if (!is_active) {
      await logNotificationEvent(
        userId,
        'subscription_deactivated',
        `Subscription deactivated after ${error_count} errors`,
        { lastError: error },
        false
      );
    }
    
    return { errorCount: error_count, isActive: is_active };
  }
  
  return null;
}

// Get push subscription statistics
export async function getPushSubscriptionStats() {
  const query = `
    SELECT 
      COUNT(*) as total_subscriptions,
      COUNT(*) FILTER (WHERE is_active = TRUE) as active_subscriptions,
      COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_subscriptions,
      AVG(notification_count) as avg_notifications_per_user,
      MAX(notification_count) as max_notifications,
      COUNT(*) FILTER (WHERE error_count > 0) as subscriptions_with_errors
    FROM push_subscriptions
  `;
  
  const result = await pool.query(query);
  return result.rows[0];
}

// ====== NOTIFICATION LOGGING ======

// Log notification event
export async function logNotificationEvent(userId, eventType, message, payload = {}, success = true, errorMessage = null, userAgent = null) {
  const query = `
    INSERT INTO notification_logs (user_id, event_type, message, payload, success, error_message, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at
  `;
  
  // Use NULL for system events (dummy UUID for system events)
  const systemUserId = '00000000-0000-0000-0000-000000000000';
  const actualUserId = userId === systemUserId ? null : userId;
  
  const values = [
    actualUserId,
    eventType,
    message,
    JSON.stringify(payload),
    success,
    errorMessage,
    userAgent
  ];
  
  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error logging notification event:', error);
    return null;
  }
}

// Get notification logs for user
export async function getNotificationLogs(userId, limit = 50) {
  const query = `
    SELECT event_type, message, payload, success, error_message, user_agent, created_at
    FROM notification_logs
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
  
  const result = await pool.query(query, [userId, limit]);
  
  return result.rows.map(row => ({
    ...row,
    payload: row.payload || {}
  }));
}

// Clean old notification logs
export async function cleanOldNotificationLogs() {
  const query = `SELECT clean_old_notification_logs() as deleted_count`;
  const result = await pool.query(query);
  
  return result.rows[0].deleted_count;
}

// ====== UTILITY FUNCTIONS ======

// Get database statistics
export async function getDatabaseStats() {
  const query = `
    SELECT 
      (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as active_users,
      (SELECT COUNT(*) FROM user_sessions WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP) as active_sessions,
      (SELECT COUNT(*) FROM push_subscriptions WHERE is_active = TRUE) as active_push_subscriptions,
      (SELECT COUNT(*) FROM notification_logs WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as logs_last_24h,
      (SELECT COUNT(*) FROM notification_logs WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '7 days') as logs_last_7d
  `;
  
  const result = await pool.query(query);
  return result.rows[0];
}

// Cleanup all expired data
export async function cleanupExpiredData() {
  console.log('🧹 Starting database cleanup...');
  
  try {
    const sessionsCleaned = await cleanExpiredSessions();
    const logsCleaned = await cleanOldNotificationLogs();
    
    await logNotificationEvent(
      '00000000-0000-0000-0000-000000000000',
      'database_cleanup',
      `Cleanup completed: ${sessionsCleaned} sessions, ${logsCleaned} logs`,
      { sessionsCleaned, logsCleaned },
      true
    );
    
    console.log(`✅ Database cleanup completed: ${sessionsCleaned} sessions, ${logsCleaned} logs removed`);
    
    return { sessionsCleaned, logsCleaned };
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    
    await logNotificationEvent(
      '00000000-0000-0000-0000-000000000000',
      'database_cleanup_error',
      'Database cleanup failed',
      { error: error.message },
      false
    );
    
    throw error;
  }
}

// Close database connection
export async function closeDatabase() {
  console.log('🔌 Closing database connection...');
  await pool.end();
  console.log('✅ Database connection closed');
}

// Export pool for direct queries if needed
export { pool };

// Health check with comprehensive database information
export async function healthCheck() {
  try {
    const startTime = Date.now();
    const client = await pool.connect();
    
    // Test basic connectivity and get database info
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    const connectionTime = Date.now() - startTime;
    
    // Get basic database statistics
    const statsResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as active_users,
        (SELECT COUNT(*) FROM user_sessions WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP) as active_sessions,
        (SELECT COUNT(*) FROM push_subscriptions WHERE is_active = TRUE) as active_push_subscriptions
    `);
    
    client.release();
    
    return {
      connected: true,
      responseTime: connectionTime,
      currentTime: result.rows[0].current_time,
      version: result.rows[0].db_version.split(' ').slice(0, 2).join(' '),
      connectionString: process.env.DATABASE_URL ? 'DATABASE_URL' : 'Individual Variables',
      ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true',
      stats: {
        activeUsers: parseInt(statsResult.rows[0].active_users),
        activeSessions: parseInt(statsResult.rows[0].active_sessions),
        activePushSubscriptions: parseInt(statsResult.rows[0].active_push_subscriptions)
      }
    };
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return {
      connected: false,
      error: error.message,
      connectionString: process.env.DATABASE_URL ? 'DATABASE_URL' : 'Individual Variables',
      ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
    };
  }
}

export default {
  runMigrations,
  getMigrationStatus,
  initializeDatabase,
  testConnection,
  createUser,
  createUserWithAccounts,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  updateUserProfile,
  getUserByEmail,
  getUserById,
  updateUserLastLogin,
  getAllActiveUsers,
  updateUserAccounts,
  createSession,
  getSessionWithUser,
  updateSessionAccess,
  deleteSession,
  cleanExpiredSessions,
  getUserSessionCount,
  storePushSubscription,
  getPushSubscription,
  getAllActivePushSubscriptions,
  updateNotificationFrequency,
  removePushSubscription,
  trackNotificationSent,
  trackNotificationError,
  getPushSubscriptionStats,
  logNotificationEvent,
  getNotificationLogs,
  cleanOldNotificationLogs,
  getDatabaseStats,
  cleanupExpiredData,
  closeDatabase,
  healthCheck,
  pool
}; 