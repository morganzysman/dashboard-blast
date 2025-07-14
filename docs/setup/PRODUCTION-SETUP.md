# OlaClick Analytics - Production Setup Guide

## 🔐 Production VAPID Keys

Your application now has secure VAPID keys generated for production use:

### Generated Keys (Keep Secure!)
```
Public Key: BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM
Private Key: dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ
```

⚠️ **IMPORTANT**: Keep these keys secure and never commit them to version control!

## 🚀 Environment Variables Setup

### Method 1: Create .env file (Local Development)
Create a `.env` file in your project root:

```env
# OlaClick Analytics PWA - Production Environment Variables

# VAPID Keys for Push Notifications
VAPID_PUBLIC_KEY=BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM
VAPID_PRIVATE_KEY=dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ

# Optional: Override default contact email for VAPID
VAPID_CONTACT_EMAIL=admin@olaclick.com

# Application Settings
NODE_ENV=production
PORT=3001
```

### Method 2: System Environment Variables (Production)
Set these in your production environment:

```bash
export VAPID_PUBLIC_KEY="BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM"
export VAPID_PRIVATE_KEY="dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ"
export VAPID_CONTACT_EMAIL="admin@olaclick.com"
export NODE_ENV="production"
export PORT="3001"
```

## 🌐 Production Deployment Options

### Option 1: Railway (Recommended)
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Deploy: `railway up`
4. Set environment variables in Railway dashboard

### Option 2: Vercel
1. Install Vercel CLI: `npm install -g vercel`
2. Deploy: `vercel --prod`
3. Set environment variables in Vercel dashboard

### Option 3: Heroku
1. Install Heroku CLI
2. Create app: `heroku create your-app-name`
3. Set environment variables:
   ```bash
   heroku config:set VAPID_PUBLIC_KEY="BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM"
   heroku config:set VAPID_PRIVATE_KEY="dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ"
   heroku config:set NODE_ENV="production"
   ```
4. Deploy: `git push heroku main`

### Option 4: VPS with PM2
1. Upload your app to your VPS
2. Install PM2: `npm install -g pm2`
3. Create ecosystem file: `pm2 ecosystem`
4. Configure environment variables in `ecosystem.config.js`
5. Start: `pm2 start ecosystem.config.js --env production`

## 📱 PWA Icons Setup

### Required Icons
Before production deployment, create these icons in the `icons/` directory:

- `icon-16x16.png` (16×16)
- `icon-32x32.png` (32×32)
- `icon-72x72.png` (72×72)
- `icon-96x96.png` (96×96)
- `icon-128x128.png` (128×128)
- `icon-144x144.png` (144×144)
- `icon-152x152.png` (152×152)
- `icon-192x192.png` (192×192)
- `icon-384x384.png` (384×384)
- `icon-512x512.png` (512×512)
- `apple-touch-icon.png` (180×180)
- `safari-pinned-tab.svg` (SVG)

### Icon Generation Tools
1. **Favicon.io**: https://favicon.io/favicon-generator/
2. **RealFaviconGenerator**: https://realfavicongenerator.net/
3. **PWA Builder**: https://www.pwabuilder.com/

## 🔒 Security Checklist

### HTTPS Requirement
- ✅ **HTTPS is required** for push notifications in production
- ✅ Service workers only work over HTTPS (except localhost)
- ✅ PWA installation requires HTTPS

### Security Headers
The application includes these security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

### Additional Security (Recommended)
1. **Set up a reverse proxy** (nginx) with SSL termination
2. **Use strong session secrets** (not currently implemented)
3. **Set up rate limiting** for API endpoints
4. **Enable CORS** only for trusted domains
5. **Use a proper database** instead of in-memory storage

## 📊 Monitoring & Analytics

### Application Monitoring
1. **Check VAPID key loading** in server logs
2. **Monitor push notification delivery** rates
3. **Track PWA installation** events
4. **Monitor service worker** registration

### Push Notification Monitoring
```javascript
// Check notification status
GET /api/notifications/status

// Test notifications
POST /api/notifications/test

// Manual daily reports (admin only)
POST /api/notifications/send-daily-reports
```

## 🔧 Production Configuration

### Daily Reports Schedule
Current schedule: **9:00 AM Lima timezone**

To change the schedule, modify `server.js`:
```javascript
// Current: 9 AM Lima time
cron.schedule('0 9 * * *', () => {
  sendDailyReports();
}, {
  timezone: 'America/Lima'
});

// Example: 8 AM New York time
cron.schedule('0 8 * * *', () => {
  sendDailyReports();
}, {
  timezone: 'America/New_York'
});
```

### Database Migration (Recommended)
For production, replace in-memory storage with proper database:

1. **Sessions**: Use Redis or PostgreSQL
2. **Push Subscriptions**: Use PostgreSQL or MongoDB
3. **User Data**: Already using JSON file (consider PostgreSQL)

## 🧪 Testing in Production

### Test Push Notifications
1. Deploy the application
2. Enable notifications in user menu
3. Use "Test Notification" feature
4. Verify daily reports are sent

### Test PWA Installation
1. Open app in Chrome/Edge
2. Look for install prompt
3. Install and test offline functionality
4. Verify app icon and metadata

## 📝 Deployment Checklist

- [ ] Create production `.env` file or set environment variables
- [ ] Generate all required PWA icons
- [ ] Deploy to HTTPS-enabled platform
- [ ] Test push notification functionality
- [ ] Verify PWA installation works
- [ ] Test offline functionality
- [ ] Configure daily report schedule
- [ ] Set up monitoring and logging
- [ ] Test with real user accounts
- [ ] Document any custom configurations

## 🆘 Troubleshooting

### Common Production Issues

**Push Notifications Not Working:**
```bash
# Check VAPID keys are loaded
curl https://your-app.com/api/notifications/vapid-public-key

# Verify HTTPS is enabled
curl -I https://your-app.com
```

**PWA Not Installing:**
- Ensure HTTPS is properly configured
- Check that all required icons exist
- Verify `manifest.json` is accessible
- Check browser console for errors

**Service Worker Issues:**
- Clear browser cache and storage
- Check service worker registration in DevTools
- Verify HTTPS configuration

### Debug Commands
```bash
# Check environment variables
echo $VAPID_PUBLIC_KEY

# Test server startup
NODE_ENV=production npm start

# Check PWA manifest
curl https://your-app.com/manifest.json

# Test notification endpoints
curl https://your-app.com/api/notifications/status
```

---

## 🎉 Your Production PWA is Ready!

With these VAPID keys and configuration, your OlaClick Analytics PWA is ready for production deployment with secure push notifications and full PWA capabilities. 