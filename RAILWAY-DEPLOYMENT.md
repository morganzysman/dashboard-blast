# Railway Deployment Guide

## 🚀 Fixing Health Check Issues

Your OlaClick Analytics PWA is now configured with proper health check endpoints for Railway deployment.

### ✅ Health Check Endpoints Added

The following endpoints are now available for Railway's health checks:

- **`/health`** - Detailed health status with system information
- **`/healthz`** - Simple "OK" response (Kubernetes-style)
- **`/ping`** - Simple "pong" response

### 🔧 Configuration Changes Made

1. **Health Check Endpoints** - Added multiple health check routes
2. **Server Binding** - Server now listens on `0.0.0.0` (all interfaces)
3. **Railway Config** - Added `railway.json` with proper health check path
4. **Dependencies** - Moved `web-push` to production dependencies
5. **Procfile** - Added for Railway deployment

## 🌐 Deployment Steps

### Step 1: Set Environment Variables in Railway

In your Railway project dashboard, set these environment variables:

```bash
VAPID_PUBLIC_KEY=BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM
VAPID_PRIVATE_KEY=dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ
VAPID_CONTACT_EMAIL=admin@olaclick.com
NODE_ENV=production
```

### Step 2: Deploy Using Railway CLI

```bash
# Install Railway CLI (if not already installed)
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy from current directory
railway up
```

### Step 3: Deploy Using GitHub Integration

1. Push your code to GitHub
2. Connect your GitHub repository to Railway
3. Railway will automatically deploy with the new health check configuration

## 🏥 Health Check Details

### Railway Configuration (`railway.json`)
```json
{
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Health Check Response Example
```json
{
  "status": "healthy",
  "timestamp": "2025-07-13T04:34:15.057Z",
  "uptime": 3.043028291,
  "memory": {
    "rss": 76169216,
    "heapTotal": 23199744,
    "heapUsed": 12822328,
    "external": 2268657,
    "arrayBuffers": 46671
  },
  "env": "production",
  "version": "2.0.0"
}
```

## 🔍 Troubleshooting

### Common Issues and Solutions

#### 1. Health Check Still Failing
- **Check logs**: `railway logs` to see startup errors
- **Verify port**: Railway sets PORT automatically
- **Check endpoints**: Test locally first

#### 2. Server Not Starting
- **Check dependencies**: Ensure all dependencies are installed
- **Check Node version**: Requires Node.js 18+
- **Check environment variables**: Verify all required vars are set

#### 3. Push Notifications Not Working
- **HTTPS required**: Railway provides HTTPS automatically
- **Check VAPID keys**: Verify environment variables are set
- **Check browser console**: Look for service worker errors

### Local Testing Commands

```bash
# Test health endpoints locally
curl http://localhost:3001/health
curl http://localhost:3001/healthz  
curl http://localhost:3001/ping

# Test with Railway CLI
railway run npm start
```

### Debug Railway Deployment

```bash
# View live logs
railway logs

# Check service status
railway status

# View environment variables
railway variables

# Connect to Railway shell
railway shell
```

## 📊 Monitoring

### Railway Dashboard
- **Health Status**: Green indicator when health checks pass
- **Logs**: Real-time application logs
- **Metrics**: CPU, memory, and request metrics
- **Deployments**: History of all deployments

### Application Logs
Look for these startup messages:
```
🚀 OlaClick Dashboard server running on port 3001
🌐 Server listening on all interfaces (0.0.0.0:3001)
GET /health - Health check endpoint
GET /healthz - Health check endpoint (alternative)
GET /ping - Ping endpoint
```

## 🎯 Next Steps After Deployment

1. **Test PWA Installation**: Visit your Railway URL and install the app
2. **Enable Push Notifications**: Test the notification system
3. **Monitor Health**: Check Railway dashboard for health status
4. **Set Up Custom Domain**: Configure your custom domain in Railway
5. **Scale if Needed**: Adjust resources in Railway dashboard

## 📞 Support

If health checks are still failing:

1. **Check Railway logs**: `railway logs`
2. **Test locally**: Verify endpoints work on localhost
3. **Check environment**: Ensure all variables are set
4. **Review configuration**: Verify `railway.json` and `package.json`

---

## ✅ Health Check Resolution

Your deployment should now pass Railway's health checks with these configurations:

- ✅ Multiple health check endpoints
- ✅ Server listening on all interfaces
- ✅ Proper Railway configuration
- ✅ Production-ready dependencies
- ✅ Environment variable setup

The health check failure issue should be resolved! 🎉 