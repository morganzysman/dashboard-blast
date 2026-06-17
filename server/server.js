import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import configuration and services
import { config, checkConfiguration } from './config/index.js';
import { configureWebPush, scheduleDailyReports } from './services/notificationService.js';
import { scheduleDailyGainsCron, autoBackfillIfNeeded } from './services/dailyGainService.js';
import { scheduleEmployeeSlaCron, autoBackfillEmployeeSlaIfNeeded } from './services/employeeSlaService.js';
import { scheduleAchievementsCron, autoEvaluateAchievementsOnBoot } from './services/achievementService.js';

// Import database module
import {
  initializeDatabase,
  testConnection,
  cleanExpiredSessions,
  cleanupExpiredData,
  closeDatabase,
  healthCheck
} from './database.js';

// Import route modules
import authRoutes from './routes/auth.js';
import paymentsRoutes from './routes/payments.js';
import ordersRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';
import utilityCostsRoutes from './routes/utility-costs.js';
import paymentMethodCostsRoutes from './routes/payment-method-costs.js';
import analyticsRoutes from './routes/analytics.js';
import payrollRoutes from './routes/payroll.js';
import warningsRoutes from './routes/warnings.js';
import holidayRoutes from './routes/holidays.js';
import employeeSlaRoutes from './routes/employee-sla.js';
import profileRoutes from './routes/profile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Check configuration and setup
checkConfiguration();

// Configure Web Push notifications
configureWebPush();

// Add some basic security headers for production
if (config.nodeEnv === 'production') {
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    if (!req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    next();
  });
}

// Middleware
app.use(cors());
// 5mb accommodates base64-encoded, client-compressed ID document images.
app.use(express.json({ limit: '5mb' }));

// Resolve the static-asset root defensively. We *always* prefer the built
// `dist/` output when it exists on disk, regardless of NODE_ENV. This survives
// platforms (looking at you, Railway) where NODE_ENV isn't propagated to the
// runtime even though the build phase succeeded — the previous gate on
// `config.nodeEnv === 'production'` was silently falling back to the source
// `client/` tree, which serves an `index.html` whose `<script type="module"
// src="/src/main.js">` triggers `Failed to resolve module specifier "vue"` in
// the browser. We still fall back to `client/` for true local dev where no
// build has been produced yet.
const distPath = path.join(__dirname, '..', 'dist');
const clientSourcePath = path.join(__dirname, '..', 'client');
const distIndexExists = fs.existsSync(path.join(distPath, 'index.html'));
const clientPath = distIndexExists ? distPath : clientSourcePath;

if (distIndexExists) {
  console.log(`📁 Serving built bundle from: ${clientPath}`);
} else {
  console.warn(
    `⚠️  No dist/index.html found at ${distPath}. Falling back to source at ${clientPath}. ` +
    `Browsers will fail to load bare module imports — run "npm run build" before deploying.`
  );
}

// Disable caching for all static assets to prevent cache issues after deployment
app.use((req, res, next) => {
  // Only set for static assets (not API)
  if (!req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

app.use(express.static(clientPath));

// Initialize database on startup
console.log('🚀 Starting OlaClick Analytics Dashboard with PostgreSQL...');

try {
  // Test database connection first
  const connectionTest = await testConnection();
  if (!connectionTest) {
    throw new Error('Database connection test failed');
  }
  
  // Initialize database schema
  await initializeDatabase();
  
  // Clean expired sessions every hour
  setInterval(async () => {
    try {
      const cleaned = await cleanExpiredSessions();
      if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired sessions`);
      }
    } catch (error) {
      console.error('❌ Error cleaning expired sessions:', error);
    }
  }, 60 * 60 * 1000);
  
} catch (error) {
  console.error('❌ Failed to initialize database:', error);
  console.error('❌ Server cannot start without database connection');
  process.exit(1);
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/utility-costs', utilityCostsRoutes);
app.use('/api/payment-method-costs', paymentMethodCostsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/warnings', warningsRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/employee-sla', employeeSlaRoutes);
app.use('/api/profile', profileRoutes);

// Serve notifications debug page
app.get('/notifications-debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'notifications-debug.html'));
});

// ====== HEALTH CHECK ENDPOINTS ======

// Health check endpoint for Railway and other deployment platforms
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await healthCheck();
    
    const healthStatus = {
      status: dbHealth.connected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: config.nodeEnv,
      version: '2.0.0',
      database: dbHealth
    };
    
    const statusCode = dbHealth.connected ? 200 : 503;
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error.message
      }
    });
  }
});

// Alternative health check endpoints (common patterns)
app.get('/healthz', async (req, res) => {
  try {
    const dbHealth = await healthCheck();
    if (dbHealth.connected) {
      res.status(200).send('OK');
    } else {
      res.status(503).send('Database Unavailable');
    }
  } catch (error) {
    res.status(503).send('Error');
  }
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Schedule daily reports
scheduleDailyReports();

// Schedule daily gain computation cron jobs and auto-backfill if needed
try {
  scheduleDailyGainsCron();
} catch (err) {
  console.error('❌ Failed to schedule daily gains cron:', err.message);
}
autoBackfillIfNeeded().catch(err => {
  console.error('❌ Auto-backfill startup error:', err.message);
});

// Per-employee kitchen SLA — cron + opportunistic backfill on boot
try {
  scheduleEmployeeSlaCron();
} catch (err) {
  console.error('❌ Failed to schedule employee-SLA cron:', err.message);
}
autoBackfillEmployeeSlaIfNeeded().catch(err => {
  console.error('❌ Employee-SLA auto-backfill startup error:', err.message);
});

// Achievements trophy case — daily cron + opportunistic backfill from history
try {
  scheduleAchievementsCron();
} catch (err) {
  console.error('❌ Failed to schedule achievements cron:', err.message);
}
autoEvaluateAchievementsOnBoot().catch(err => {
  console.error('❌ Achievements boot evaluation error:', err.message);
});

// Cleanup database daily
setInterval(async () => {
  try {
    await cleanupExpiredData();
  } catch (error) {
    console.error('❌ Error during scheduled cleanup:', error);
  }
}, 24 * 60 * 60 * 1000); // Every 24 hours

// ====== SPA CATCH-ALL ROUTE ======
// This must be the last route defined
// Serves index.html for all non-API routes to enable Vue.js client-side routing
app.get('*', (req, res) => {
  // Don't serve index.html for API routes - they should 404 if not found
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      success: false, 
      error: 'API endpoint not found' 
    });
  }
  
  // Serve index.html for all other routes (SPA routing)
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Graceful shutdown initiated...');
  
  try {
    await closeDatabase();
    console.log('✅ Server shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  
  try {
    await closeDatabase();
    console.log('✅ Server shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server
app.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 OlaClick Dashboard server with PostgreSQL running on port ${config.port}`);
  console.log(`📊 Dashboard available at: http://localhost:${config.port}`);
  console.log(`🔔 Notifications Debug available at: http://localhost:${config.port}/notifications-debug`);
  console.log(`🗄️  Database: PostgreSQL`);
  console.log(`🔧 API endpoints:`);
  console.log(`   POST /api/auth/login - User login`);
  console.log(`   POST /api/auth/logout - User logout`);
  console.log(`   GET /api/auth/verify - Verify session`);
  console.log(`   GET /api/payments/all - Get payments from all user accounts`);
  console.log(`   GET /api/payments/:companyToken - Get payments from specific account`);
  console.log(`   GET /api/admin/users - Get all users (super-admin only)`);
  console.log(`   POST /api/admin/users - Create new user (super-admin only)`);
  console.log(`   PUT /api/admin/users/:userId/accounts - Update user accounts (super-admin only)`);
  console.log(`   PUT /api/admin/users/:userId/role - Update user role (super-admin only)`);
  console.log(`   PUT /api/admin/users/:userId/status - Update user status (super-admin only)`);
  console.log(`   DELETE /api/admin/users/:userId - Delete a user (super-admin only)`);
  console.log(`   GET /api/notifications/vapid-public-key - Get VAPID public key`);
  console.log(`   POST /api/notifications/subscribe - Subscribe to push notifications`);
  console.log(`   POST /api/notifications/unsubscribe - Unsubscribe from push notifications`);
  console.log(`   POST /api/notifications/test - Send test notification`);
  console.log(`   POST /api/notifications/send-daily-reports - Send daily reports (admin)`);
  console.log(`   GET /api/notifications/status - Get notification status`);
  console.log(`   GET /api/notifications/debug - Get notification debug info for current user`);
  console.log(`   POST /api/notifications/test-capabilities - Test notification capabilities`);
  console.log(`   POST /api/notifications/clear-errors - Clear notification errors for current user`);
  console.log(`   GET /health - Health check endpoint`);
  console.log(`   GET /healthz - Health check endpoint (alternative)`);
  console.log(`   GET /ping - Ping endpoint`);
  console.log(`🔔 Features:`);
  console.log(`   📱 PostgreSQL-backed user management with migrations`);
  console.log(`   👑 Super-admin user management interface`);
  console.log(`   🔐 Role-based access control (super-admin, admin, user, viewer)`);
  console.log(`   🔐 Database-stored sessions with sliding expiry`);
  console.log(`   📨 PostgreSQL-backed push notifications`);
  console.log(`   📊 Comprehensive notification logging`);
  console.log(`   🧹 Automated database cleanup`);
  console.log(`   📈 7-day comparison trends`);
  console.log(`   📱 PWA with offline support`);
  console.log(`   🔔 Push notifications & daily reports`);
  console.log(`   ⏰ Frequency-based notifications (5min, 30min, 1h, 4h, 8h) - checked every 5 minutes`);
  console.log(`🌐 Server listening on all interfaces (0.0.0.0:${config.port})`);
  console.log(`📁 Modular Architecture:`);
  console.log(`   ├── server/config/ - Configuration management`);
  console.log(`   ├── server/middleware/ - Authentication & middleware`);
  console.log(`   ├── server/routes/ - API route handlers`);
  console.log(`   ├── server/services/ - Business logic & external APIs`);
  console.log(`   └── server/database.js - Database operations`);
}); 