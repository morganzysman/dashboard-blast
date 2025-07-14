# 🚂 Railway Deployment Guide

## ✅ **Project Status: READY FOR RAILWAY DEPLOYMENT**

Your OlaClick Analytics Dashboard is now **fully configured** for Railway deployment with the latest payment API refactoring.

## 🔧 **Pre-Deployment Checklist**

- ✅ Health check endpoints (`/health`, `/healthz`, `/ping`)
- ✅ `Procfile` for Railway process management
- ✅ `railway.json` configuration file
- ✅ PostgreSQL database integration
- ✅ Environment variable handling
- ✅ Payment API endpoints (updated from orders to payments)
- ✅ Node.js 18+ compatibility
- ✅ Production dependencies properly configured

## 🚀 **Quick Deploy Steps**

### Option 1: Railway CLI (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy from project root
railway up
```

### Option 2: GitHub Integration

1. Push your code to GitHub
2. Connect GitHub repository to Railway
3. Railway will auto-deploy

## 🌍 **Environment Variables**

Set these in your Railway project dashboard:

```bash
# Required
NODE_ENV=production
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here  
VAPID_CONTACT_EMAIL=admin@olaclick.com

# Optional (Railway provides DATABASE_URL automatically)
TIMEZONE=America/Lima
CURRENCY=PEN
CURRENCY_SYMBOL=S/
```

> **Note**: Railway automatically provides `DATABASE_URL` for PostgreSQL

## 📊 **API Endpoints (Updated)**

Your deployed app will have these endpoints:

### Core API
- `POST /api/auth/login` - User authentication
- `GET /api/auth/verify` - Session verification
- `GET /api/payments/all` - Payment data from all accounts ⚡ **UPDATED**
- `GET /api/payments/:token` - Payment data from specific account ⚡ **UPDATED**

### Admin API
- `GET /api/admin/users` - User management
- `POST /api/admin/users` - Create users
- `PUT /api/admin/users/:id/accounts` - Update user accounts

### Notifications API
- `GET /api/notifications/vapid-public-key` - VAPID key
- `POST /api/notifications/subscribe` - Subscribe to notifications
- `POST /api/notifications/test` - Test notifications

### Health Checks
- `GET /health` - Detailed health status
- `GET /healthz` - Simple health check
- `GET /ping` - Ping endpoint

## 🏥 **Health Check Configuration**

Railway will use `/health` endpoint to monitor your app:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-13T10:30:00.000Z",
  "uptime": 3600.5,
  "memory": { "rss": 76169216, "heapTotal": 23199744 },
  "env": "production",
  "version": "2.0.0",
  "database": { "connected": true }
}
```

## 🗄️ **Database Setup**

Railway will automatically:
1. Create a PostgreSQL database
2. Set `DATABASE_URL` environment variable
3. Your app will auto-migrate the database on startup

## 🔔 **Push Notifications**

After deployment:
1. Generate new VAPID keys for production
2. Update environment variables
3. Test notifications work on HTTPS

## 🧪 **Testing Deployment**

After deployment, test these URLs:

```bash
# Replace YOUR_RAILWAY_URL with your actual URL
curl https://YOUR_RAILWAY_URL/health
curl https://YOUR_RAILWAY_URL/api/payments/all
curl https://YOUR_RAILWAY_URL/api/notifications/vapid-public-key
```

## 🔍 **Troubleshooting**

### Common Issues:

1. **Health Check Failing**
   ```bash
   railway logs
   # Look for startup errors
   ```

2. **Database Connection Issues**
   ```bash
   # Check if DATABASE_URL is set
   railway variables
   ```

3. **API Endpoints Not Working**
   ```bash
   # Verify the payment API is responding
   curl https://YOUR_RAILWAY_URL/api/payments/all
   ```

4. **Push Notifications Not Working**
   - Ensure VAPID keys are set
   - Check HTTPS is enabled (Railway provides this)
   - Verify service worker registration

## 📱 **PWA Features**

Your deployed app includes:
- ✅ Offline support
- ✅ Push notifications
- ✅ App installation
- ✅ Service worker caching
- ✅ Mobile-responsive design

## 🔐 **Security**

Production deployment includes:
- ✅ HTTPS (automatically provided by Railway)
- ✅ Secure headers
- ✅ Environment variable protection
- ✅ Database connection security
- ✅ Session management

## 📈 **Monitoring**

Railway provides:
- 📊 Real-time logs
- 📈 Performance metrics
- 🏥 Health monitoring
- 🔄 Automatic restarts
- 📱 Mobile dashboard

## 🎯 **Post-Deployment**

1. **Test the PWA**: Install on mobile/desktop
2. **Configure notifications**: Test push notifications
3. **Set up monitoring**: Watch Railway dashboard
4. **Custom domain**: Add your domain in Railway
5. **Scale if needed**: Adjust resources as required

---

## 🚀 **Ready to Deploy!**

Your project is now **100% ready** for Railway deployment. The payment API refactoring is complete and all health checks are configured.

**Deploy command:**
```bash
railway up
```

🎉 **Your OlaClick Analytics Dashboard will be live in minutes!** 