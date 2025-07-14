# OlaClick Analytics with PostgreSQL

A complete PostgreSQL-backed implementation of the OlaClick Analytics Dashboard with persistent user management, sessions, and push notifications.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **PostgreSQL** 12.0 or higher
- **npm** or **yarn** package manager

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup PostgreSQL Database

#### Option A: Local PostgreSQL

1. **Install PostgreSQL** (if not already installed):
   ```bash
   # macOS with Homebrew
   brew install postgresql
   brew services start postgresql
   
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql
   
   # Windows - Download from https://www.postgresql.org/download/
   ```

2. **Create Database and User**:
   ```bash
   # Connect to PostgreSQL as superuser
   sudo -u postgres psql
   
   # Create database and user
   CREATE DATABASE olaclick_analytics;
   CREATE USER olaclick_user WITH ENCRYPTED PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE olaclick_analytics TO olaclick_user;
   \q
   ```

#### Option B: Cloud PostgreSQL

Use a managed PostgreSQL service:
- **Railway**: Automatically provides `DATABASE_URL`
- **Heroku**: Add PostgreSQL addon
- **DigitalOcean**: Managed Databases
- **AWS RDS**: PostgreSQL instance
- **Google Cloud SQL**: PostgreSQL

### 3. Configure Environment Variables

Create a `.env` file in the dashboard directory:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=olaclick_analytics
DB_USER=olaclick_user
DB_PASSWORD=your_secure_password
DB_SSL=false

# Push Notifications (generate new keys for production)
VAPID_PUBLIC_KEY=BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM
VAPID_PRIVATE_KEY=dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ
VAPID_CONTACT_EMAIL=admin@yourdomain.com

# Application Settings
PORT=3001
NODE_ENV=production
```

### 4. Initialize Database

Run the setup script to create tables and admin user:

```bash
node setup-postgres.js
```

This will:
- Test database connection
- Create all required tables
- Optionally create an admin user
- Set up indexes and constraints

### 5. Start the Server

```bash
npm start
```

The server will be available at `http://localhost:3001`

## 📊 Database Schema

### Tables Created

1. **`users`** - User accounts and authentication
   - UUID primary keys
   - Encrypted passwords with bcrypt
   - Role-based access control
   - User preferences (timezone, currency)
   - Account assignments (JSONB)

2. **`user_sessions`** - Session management
   - Sliding window expiry (24 hours)
   - User agent and IP tracking
   - Automatic cleanup of expired sessions

3. **`push_subscriptions`** - Push notification subscriptions
   - Web Push endpoint and keys
   - User-specific preferences
   - Error tracking and auto-deactivation
   - Notification statistics

4. **`notification_logs`** - Event logging and debugging
   - Comprehensive event tracking
   - Error logging with stack traces
   - Performance monitoring
   - Automatic cleanup (30 days)

### Key Features

- **UUID Primary Keys**: Secure, globally unique identifiers
- **JSONB Support**: Flexible account configuration storage
- **Automatic Timestamps**: Created/updated tracking
- **Constraints & Validation**: Data integrity enforcement
- **Indexes**: Optimized query performance
- **Views**: Simplified data access patterns

## 🔧 Configuration Options

### Environment Variables

#### Database
- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name (default: olaclick_analytics)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password (required)
- `DB_SSL` - Enable SSL connections (default: false)

#### Push Notifications
- `VAPID_PUBLIC_KEY` - Web Push public key
- `VAPID_PRIVATE_KEY` - Web Push private key
- `VAPID_CONTACT_EMAIL` - Contact email for VAPID

#### Application
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

### Generate VAPID Keys

For production, generate your own VAPID keys:

```bash
# Install web-push globally
npm install -g web-push

# Generate new VAPID keys
web-push generate-vapid-keys

# Example output:
# Public Key: BFxzW9...
# Private Key: 5J2K8H...
```

## 🚀 Deployment

### Railway Deployment

1. **Create Railway Project**:
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   ```

2. **Add PostgreSQL**:
   ```bash
   railway add postgresql
   ```

3. **Set Environment Variables**:
   ```bash
   railway variables set VAPID_PUBLIC_KEY="your_public_key"
   railway variables set VAPID_PRIVATE_KEY="your_private_key"
   railway variables set VAPID_CONTACT_EMAIL="admin@yourdomain.com"
   railway variables set NODE_ENV="production"
   ```

4. **Deploy**:
   ```bash
   railway up
   ```

5. **Initialize Database**:
   ```bash
   railway run node setup-postgres.js --schema-only
   ```

### Heroku Deployment

1. **Create Heroku App**:
   ```bash
   heroku create your-app-name
   ```

2. **Add PostgreSQL**:
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

3. **Set Environment Variables**:
   ```bash
   heroku config:set VAPID_PUBLIC_KEY="your_public_key"
   heroku config:set VAPID_PRIVATE_KEY="your_private_key"
   heroku config:set VAPID_CONTACT_EMAIL="admin@yourdomain.com"
   heroku config:set NODE_ENV="production"
   ```

4. **Deploy**:
   ```bash
   git push heroku main
   ```

5. **Initialize Database**:
   ```bash
   heroku run node setup-postgres.js --schema-only
   ```

### DigitalOcean App Platform

1. **Create App** in DigitalOcean control panel
2. **Add PostgreSQL** managed database
3. **Set Environment Variables** in app settings
4. **Deploy** from GitHub repository
5. **Run Migration** using console access

## 🛠️ Development

### Available Scripts

```bash
# Start server
npm start

# Development with file watching
npm run dev

# Production mode
npm run production

# Database migration
npm run db:migrate

# Setup database
node setup-postgres.js

# Schema only setup
node setup-postgres.js --schema-only
```

### Database Maintenance

#### Manual Migration
```bash
# Run schema migration
npm run db:migrate

# Or directly
node -e "import('./database.js').then(db => db.initializeDatabase())"
```

#### Cleanup Operations
```bash
# Connect to PostgreSQL
psql -h localhost -U olaclick_user -d olaclick_analytics

# Clean expired sessions
SELECT clean_expired_sessions();

# Clean old logs
SELECT clean_old_notification_logs();

# View statistics
-- View all active users with session information
SELECT * FROM active_users_with_sessions;

-- View push subscription statistics
SELECT * FROM push_subscription_stats;
```

### Debugging

#### Check Database Connection
```bash
node -e "
import('./database.js').then(async (db) => {
  const result = await db.testConnection();
  console.log('Connection:', result ? 'Success' : 'Failed');
  await db.closeDatabase();
});"
```

#### View Database Stats
```javascript
// In Node.js console or script
import { getDatabaseStats } from './database.js';

const stats = await getDatabaseStats();
console.log('Database Statistics:', stats);
```

## 🔐 Security Features

### Authentication
- **bcrypt Password Hashing**: Industry-standard password security
- **Session-based Auth**: Secure session management with database storage
- **Sliding Window Expiry**: Sessions auto-extend with activity
- **IP and User Agent Tracking**: Enhanced security monitoring

### Data Protection
- **SQL Injection Prevention**: Parameterized queries throughout
- **UUID Primary Keys**: Non-enumerable identifiers
- **Role-based Access Control**: Admin/user/viewer roles
- **Input Validation**: Database constraints and application validation

### Push Notifications
- **VAPID Authentication**: Secure push message delivery
- **Endpoint Validation**: Subscription verification before storage
- **Error Tracking**: Automatic cleanup of invalid subscriptions
- **Rate Limiting**: Prevent notification abuse

## 📊 Monitoring & Analytics

### Database Views

- **`active_users_with_sessions`**: User activity overview
- **`push_subscription_stats`**: Notification delivery statistics

### Health Checks

- **`/health`**: Comprehensive health status with database stats
- **`/healthz`**: Simple health check for load balancers
- **`/ping`**: Basic connectivity test

### Logging

All notification events are logged with:
- User identification
- Event types and outcomes
- Error messages and stack traces
- Browser and device information
- Timestamps and performance data

## 🆘 Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection manually
psql -h localhost -U olaclick_user -d olaclick_analytics

# Verify environment variables
echo $DB_HOST $DB_PORT $DB_NAME $DB_USER
```

#### VAPID Key Errors
```bash
# Generate new VAPID keys
npx web-push generate-vapid-keys

# Test VAPID configuration
node -e "
import('./server-postgres.js').then(() => {
  console.log('VAPID configuration loaded successfully');
});"
```

#### Migration Errors
```bash
# Check database permissions
psql -h localhost -U olaclick_user -d olaclick_analytics -c '\du'

# Run migration with debug
DEBUG=* node setup-postgres.js
```

### Performance Optimization

#### Database Indexes
All critical queries are indexed:
- User email lookups
- Session token verification
- Push subscription retrieval
- Event log queries

#### Connection Pooling
- Maximum 20 connections
- 30-second idle timeout
- 2-second connection timeout
- Automatic connection retry

#### Cleanup Jobs
- Expired sessions: Hourly
- Old notification logs: Daily
- Database statistics: Real-time

## 📞 Support

### Getting Help

1. **Check the logs**: Application logs provide detailed error information
2. **Database health**: Use `/health` endpoint for database status
3. **Test connection**: Run `node setup-postgres.js --help` for diagnostics
4. **Review configuration**: Verify environment variables are set correctly

### Migration from JSON Storage

If migrating from the previous JSON-based implementation:

1. **Export existing data** (if needed)
2. **Run PostgreSQL setup**: `node setup-postgres.js`
3. **Start new server**: Use `server-postgres.js` instead of `server.js`
4. **Re-configure users**: Add users and account assignments via admin panel

---

## 🎉 Features

✅ **PostgreSQL-backed persistence**
✅ **Session management with sliding expiry**  
✅ **Push notification storage and tracking**
✅ **Comprehensive event logging**
✅ **Role-based access control**
✅ **Automatic database cleanup**
✅ **Health monitoring and statistics**
✅ **Production-ready deployment**
✅ **Security best practices**
✅ **Performance optimization** 