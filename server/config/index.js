// Server configuration and environment variables
export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Session configuration
  sessionExpiry: 24 * 60 * 60 * 1000, // 24 hours
  
  // VAPID configuration for push notifications
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || 'BCGkRbD4Yd6whNST8Moo1DMtTV-XVfQzztx20Ax0XMKgw7Ps_IEMkNXKb2X0Gn4PWrTaecV_peaRhc2Re4wblAM',
    privateKey: process.env.VAPID_PRIVATE_KEY || 'dVpMJM8ZFeQj_OWS6nXEJsjYq41aA6czXlPs0cOizIQ',
    contact: process.env.VAPID_CONTACT_EMAIL || 'admin@olaclick.com'
  },
  
  // OlaClick API configuration
  olaClick: {
    baseUrl: 'https://api.olaclick.app/ms-orders/auth/orders/by_payment_methods',
    defaultTimezone: 'America/Lima',
    defaultCurrency: 'PEN',
    defaultCurrencySymbol: 'S/',
    // Supported timezones and currencies
    supportedTimezones: [
      { value: 'America/Lima', label: 'Peru (Lima)', flag: '🇵🇪' },
      { value: 'America/Mexico_City', label: 'Mexico (Mexico City)', flag: '🇲🇽' },
      { value: 'America/New_York', label: 'USA (New York)', flag: '🇺🇸' },
      { value: 'Europe/London', label: 'UK (London)', flag: '🇬🇧' },
      { value: 'Europe/Paris', label: 'France (Paris)', flag: '🇫🇷' }
    ],
    supportedCurrencies: [
      { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', flag: '🇵🇪' },
      { code: 'MXN', symbol: '$', name: 'Mexican Peso', flag: '🇲🇽' },
      { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
      { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
      { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' }
    ]
  }
};

// Check for production warnings
export function checkConfiguration() {
  console.log('🔐 VAPID Keys Configuration:');
  console.log(`   Public Key: ${config.vapid.publicKey.substring(0, 8)}...${config.vapid.publicKey.substring(config.vapid.publicKey.length - 8)}`);
  console.log(`   Private Key: ${config.vapid.privateKey.substring(0, 8)}...${config.vapid.privateKey.substring(config.vapid.privateKey.length - 8)}`);
  console.log(`   Contact Email: ${config.vapid.contact}`);
  console.log(`   Environment: ${config.nodeEnv}`);

  // Warn if using default keys
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('⚠️  WARNING: Using default VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables for production!');
  }
} 