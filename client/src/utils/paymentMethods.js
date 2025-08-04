// Payment methods utility
import paymentMethodsData from '../data/payment-methods.json'

// Get all payment methods sorted by position
export function getAllPaymentMethods() {
  return paymentMethodsData.data.sort((a, b) => a.position - b.position)
}

// Get payment method by code
export function getPaymentMethodByCode(code) {
  return paymentMethodsData.data.find(pm => pm.code === code)
}

// Get payment methods for a specific country
export function getPaymentMethodsByCountry(countryCode = null) {
  return paymentMethodsData.data
    .filter(pm => pm.country_code === countryCode || pm.country_code === null)
    .sort((a, b) => a.position - b.position)
}

// Get common payment method codes for default costs
export function getCommonPaymentMethods() {
  return [
    { code: 'cash', name: 'Cash', defaultPercentage: 0.00, defaultFixed: 0.00 },
    { code: 'card', name: 'Card', defaultPercentage: 3.50, defaultFixed: 0.30 },
    { code: 'credit_card', name: 'Credit Card', defaultPercentage: 3.80, defaultFixed: 0.35 },
    { code: 'debit_card', name: 'Debit Card', defaultPercentage: 2.50, defaultFixed: 0.25 },
    { code: 'visa', name: 'Visa', defaultPercentage: 3.20, defaultFixed: 0.30 },
    { code: 'mastercard', name: 'Mastercard', defaultPercentage: 3.20, defaultFixed: 0.30 },
    { code: 'amex', name: 'American Express', defaultPercentage: 4.50, defaultFixed: 0.40 },
    { code: 'yape', name: 'Yape', defaultPercentage: 1.50, defaultFixed: 0.10 },
    { code: 'plin', name: 'Plin', defaultPercentage: 1.80, defaultFixed: 0.15 },
    { code: 'transfer', name: 'Bank Transfer', defaultPercentage: 0.50, defaultFixed: 0.05 },
    { code: 'bitcoin', name: 'Bitcoin', defaultPercentage: 8.00, defaultFixed: 1.00 },
    { code: 'paypal', name: 'PayPal', defaultPercentage: 4.20, defaultFixed: 0.30 },
    { code: 'mercado_pago', name: 'Mercado Pago', defaultPercentage: 6.40, defaultFixed: 0.50 },
    { code: 'other', name: 'Other', defaultPercentage: 2.00, defaultFixed: 0.20 }
  ]
}

// Format payment method name for display
export function formatPaymentMethodName(code) {
  const paymentMethod = getPaymentMethodByCode(code)
  if (paymentMethod && paymentMethod.provider) {
    return `${paymentMethod.provider.name} ${code.replace('_', ' ')}`
  }
  
  const common = getCommonPaymentMethods().find(pm => pm.code === code)
  if (common) {
    return common.name
  }
  
  // Fallback: format code as title case
  return code.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}