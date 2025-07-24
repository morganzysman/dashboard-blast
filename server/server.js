import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import configuration and services
import { config, checkConfiguration } from './config/index.js';
import { configureWebPush, scheduleDailyReports } from './services/notificationService.js';

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
app.use(express.json());

// Serve static files from client directory in development
// In production, this would typically serve from a dist/build directory
const clientPath = config.nodeEnv === 'production' 
  ? path.join(__dirname, '..', 'dist')
  : path.join(__dirname, '..', 'client');

console.log(`📁 Serving static files from: ${clientPath}`);

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
  console.log(`   ⏰ Frequency-based notifications (30min, 1h, 4h, 8h) - checked every 30 minutes`);
  console.log(`🌐 Server listening on all interfaces (0.0.0.0:${config.port})`);
  console.log(`📁 Modular Architecture:`);
  console.log(`   ├── server/config/ - Configuration management`);
  console.log(`   ├── server/middleware/ - Authentication & middleware`);
  console.log(`   ├── server/routes/ - API route handlers`);
  console.log(`   ├── server/services/ - Business logic & external APIs`);
  console.log(`   └── server/database.js - Database operations`);
}); 