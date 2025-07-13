# OlaClick Analytics Dashboard PWA

A Progressive Web App (PWA) for OlaClick restaurant analytics with push notifications and real-time data visualization.

## 🚀 Features

- **📊 Real-time Analytics** - Live sales data with 7-day comparison trends
- **📱 PWA Support** - Install as native app on mobile and desktop
- **🔔 Push Notifications** - Daily sales reports delivered to your device
- **🔐 Multi-user Authentication** - Secure session-based login system
- **🏢 Multi-account Management** - Access multiple restaurant accounts
- **📈 Trend Analysis** - Compare current vs previous week performance
- **🌐 Offline Support** - Cached data available without internet
- **📱 Responsive Design** - Works on all screen sizes

## 🔧 Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development server**
   ```bash
   npm start
   ```

3. **Access dashboard**
   - Open `http://localhost:3001` in your browser
   - Login with demo credentials: `demo@dashboard.com` / `admin123`

## 🔐 Production VAPID Keys

The app includes **secure production VAPID keys** for push notifications:

```
Public Key: BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM
Private Key: dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ
```

### Quick Production Start

```bash
# Use the production startup script
./start-production.sh
```

Or set environment variables manually:

```bash
export VAPID_PUBLIC_KEY="BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM"
export VAPID_PRIVATE_KEY="dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ"
export NODE_ENV="production"
npm start
```

## 📱 PWA Setup

### Install as App
1. Open the dashboard in Chrome/Edge
2. Look for "Install App" button in user menu
3. Click to install on your device

### Enable Push Notifications
1. Click the user menu (top-right)
2. Select "Enable Notifications"
3. Allow notifications in browser prompt
4. Receive daily sales reports at 9:00 AM

## 🔔 Push Notification Features

- **Daily Reports** - Automated sales summaries every morning
- **Test Notifications** - Development testing capability
- **User-specific** - Personalized with timezone and currency
- **Rich Content** - Include sales data and action buttons
- **Secure Delivery** - VAPID-authenticated push messages

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify session

### Analytics Data
- `GET /api/orders/all` - Get all user account data
- `GET /api/orders/:companyToken` - Get specific account data

### Push Notifications
- `GET /api/notifications/vapid-public-key` - Get VAPID public key
- `POST /api/notifications/subscribe` - Subscribe to notifications
- `POST /api/notifications/unsubscribe` - Unsubscribe from notifications
- `POST /api/notifications/test` - Send test notification
- `GET /api/notifications/status` - Get subscription status

## 🏗️ Architecture

### Frontend
- **Progressive Web App** with service worker
- **Responsive design** with modern CSS
- **Real-time data visualization** with trend analysis
- **Push notification handling** with rich UI

### Backend
- **Node.js/Express** server with RESTful API
- **Session-based authentication** with bcrypt
- **OlaClick API integration** with timezone awareness
- **Web Push implementation** with VAPID keys
- **Cron job scheduling** for daily reports

### PWA Components
- **Service Worker** (`sw.js`) - Offline caching and push handling
- **Web App Manifest** (`manifest.json`) - App metadata and icons
- **Push Notifications** - Web Push API with VAPID authentication

## 📁 Project Structure

```
dashboard/
├── server.js              # Main server application
├── index.html             # PWA frontend
├── manifest.json          # PWA manifest
├── sw.js                  # Service worker
├── package.json           # Dependencies
├── users.json             # User accounts (auto-generated)
├── start-production.sh    # Production startup script
├── PRODUCTION-SETUP.md    # Production deployment guide
└── PWA-SETUP.md          # PWA configuration guide
```

## 🔧 Configuration

### Environment Variables
- `VAPID_PUBLIC_KEY` - Web Push public key
- `VAPID_PRIVATE_KEY` - Web Push private key
- `VAPID_CONTACT_EMAIL` - Contact email for VAPID
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3001)

### Daily Reports
- **Schedule**: 9:00 AM Lima timezone
- **Content**: Sales summary with orders, revenue, and account count
- **Personalization**: User's timezone and currency settings
- **Delivery**: Push notification with dashboard link

## 🚀 Deployment

See `PRODUCTION-SETUP.md` for detailed deployment instructions including:
- Railway, Vercel, Heroku deployment options
- HTTPS configuration for push notifications
- PWA icon generation
- Security considerations

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm start

# Test push notifications
# Login → User Menu → Enable Notifications → Test Notification
```

### Generate New VAPID Keys
```bash
# Generate new keys if needed
npx web-push generate-vapid-keys
```

## 📋 Requirements

- **Node.js** 18.0.0 or higher
- **Modern browser** with PWA support
- **HTTPS** for push notifications in production

## 🔐 Security

- **Session-based authentication** with secure sessions
- **VAPID key authentication** for push notifications
- **Security headers** in production mode
- **Input validation** and error handling
- **Environment variable** configuration

## 📞 Support

For questions or issues:
- Check `PRODUCTION-SETUP.md` for deployment help
- Review `PWA-SETUP.md` for PWA configuration
- Test with demo account: `demo@dashboard.com` / `admin123`

---

**✨ Ready for production deployment with secure push notifications!** 