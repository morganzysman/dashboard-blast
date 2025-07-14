# PWA Setup Guide for OlaClick Analytics

## 📱 Progressive Web App Configuration

Your OlaClick Analytics dashboard is now PWA-ready with push notifications! Follow these steps to complete the setup.

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Create Icons Directory**
   ```bash
   mkdir icons screenshots
   ```

3. **Generate PWA Icons** (see section below)

4. **Start the Server**
   ```bash
   npm start
   ```

5. **Test PWA Features**
   - Open `http://localhost:3001` in Chrome/Edge
   - Look for the "Install App" prompt
   - Enable notifications when prompted

## 🎨 PWA Icons Generation

### Required Icon Sizes
Create the following icons in the `icons/` directory:

- `icon-16x16.png` - Favicon
- `icon-32x32.png` - Favicon
- `icon-72x72.png` - Badge icon
- `icon-96x96.png` - Standard icon
- `icon-128x128.png` - Small icon
- `icon-144x144.png` - Medium icon
- `icon-152x152.png` - Apple touch icon
- `icon-192x192.png` - Standard app icon
- `icon-384x384.png` - Large icon
- `icon-512x512.png` - Splash screen icon
- `apple-touch-icon.png` (180x180) - iOS icon
- `safari-pinned-tab.svg` - Safari pinned tab

### Icon Design Guidelines

**Design Specs:**
- Use a simple, recognizable design
- Ensure good contrast and visibility at small sizes
- Consider using the 🍔 emoji or OlaClick branding
- Background should be solid color (#3b82f6 recommended)
- Icon should be centered with appropriate padding

**Quick Icon Generation with Online Tools:**
1. **Favicon.io** - https://favicon.io/
   - Upload a 512x512 PNG
   - Download the generated package
   - Copy relevant files to `/icons/`

2. **RealFaviconGenerator** - https://realfavicongenerator.net/
   - Comprehensive PWA icon generator
   - Handles all required formats

3. **PWA Builder** - https://www.pwabuilder.com/
   - Microsoft's PWA tool
   - Generates icons and manifest

### Simple Text-Based Icons (Temporary)

If you need to test quickly, create simple colored squares with text:

```bash
# Create a simple 512x512 icon using ImageMagick (if installed)
convert -size 512x512 xc:"#3b82f6" -pointsize 200 -fill white -gravity center -annotate +0+0 "🍔" icon-512x512.png

# Then resize for other sizes
convert icon-512x512.png -resize 192x192 icon-192x192.png
convert icon-512x512.png -resize 96x96 icon-96x96.png
# ... etc for other sizes
```

## 🔔 Push Notifications Setup

### VAPID Keys (Production)

For production, generate your own VAPID keys:

```bash
# Install web-push CLI globally
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys
```

Set environment variables:
```bash
export VAPID_PUBLIC_KEY="your_public_key_here"
export VAPID_PRIVATE_KEY="your_private_key_here"
```

### Daily Reports Configuration

The system automatically sends daily sales reports at 9:00 AM (Lima timezone).

**To customize:**
1. Edit the cron schedule in `server.js`
2. Change timezone in the cron configuration
3. Modify report content in `generateUserDailyReport()`

**Manual Testing:**
- Use the "Test Notification" button in the user menu
- Call `/api/notifications/send-daily-reports` (admin only)

## 🌐 HTTPS Requirement

**Important:** Push notifications require HTTPS in production.

### Development (localhost)
- Works with HTTP on localhost
- No additional setup needed

### Production Deployment
- Use a reverse proxy (nginx) with SSL certificate
- Or deploy to platforms that provide HTTPS (Vercel, Netlify, Railway)

## 📊 Features Overview

### PWA Capabilities
- ✅ **Offline Support** - Cached content available offline
- ✅ **App Installation** - Install as native app
- ✅ **Push Notifications** - Daily sales reports
- ✅ **Background Sync** - Data syncs when online
- ✅ **Responsive Design** - Works on all devices

### Notification Features
- 🔔 **Daily Reports** - Automated sales summaries
- 🧪 **Test Notifications** - Development testing
- 👤 **User-Specific** - Personalized timezone & currency
- 📱 **Rich Notifications** - Actions and data payload
- ⚙️ **Management** - Easy enable/disable

## 🔧 Development Testing

### Test PWA Installation
1. Open Chrome DevTools → Application → Manifest
2. Click "Add to homescreen"
3. Verify icon and app details

### Test Push Notifications
1. Enable notifications in user menu
2. Use "Account Info" → "Test Notification"
3. Check browser's notification settings
4. Verify notification appearance and actions

### Test Service Worker
1. Open Chrome DevTools → Application → Service Workers
2. Verify registration and status
3. Test offline functionality
4. Check cached resources

## 🚀 Deployment Checklist

- [ ] Generate proper PWA icons
- [ ] Set production VAPID keys
- [ ] Configure HTTPS
- [ ] Test notification delivery
- [ ] Verify offline functionality
- [ ] Test app installation flow
- [ ] Configure cron schedule timezone
- [ ] Test daily report generation

## 📱 Browser Support

### Full PWA Support
- Chrome/Edge 67+
- Firefox 79+
- Safari 16.4+

### Push Notifications
- Chrome/Edge 50+
- Firefox 44+
- Safari 16.4+ (macOS/iOS)

### Installation
- Chrome/Edge (Android/Desktop)
- Safari (iOS/macOS)
- Firefox (limited)

## 🐛 Troubleshooting

### Common Issues

**PWA Install Prompt Not Showing:**
- Check HTTPS requirement
- Verify manifest.json is accessible
- Ensure Service Worker is registered
- Check browser compatibility

**Push Notifications Not Working:**
- Verify HTTPS in production
- Check notification permissions
- Verify VAPID key configuration
- Check service worker registration

**Icons Not Displaying:**
- Verify icon files exist in `/icons/`
- Check file sizes and formats
- Validate manifest.json syntax
- Clear browser cache

### Debug Commands

```bash
# Check if all dependencies are installed
npm list

# Test server startup
npm start

# Check PWA manifest
curl http://localhost:3001/manifest.json

# Test notification endpoints
curl -X GET http://localhost:3001/api/notifications/vapid-public-key
```

## 📚 Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Web Push Protocol](https://web.dev/push-notifications-overview/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://web.dev/add-manifest/)

---

**🎉 Your OlaClick Analytics PWA is ready!**

Users can now install the app on their devices and receive daily sales notifications. The app works offline and provides a native app experience. 