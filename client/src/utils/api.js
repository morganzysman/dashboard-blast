// API utility with automatic session handling and error intercepting
import { useAuthStore } from '../stores/auth'

class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
    this.name = 'ApiError'
  }
}

// Global API wrapper that handles authentication and errors
export async function apiRequest(url, options = {}) {
  const authStore = useAuthStore()
  
  // Prepare default options
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  }
  
  // Add session ID if user is authenticated
  if (authStore.sessionId) {
    defaultOptions.headers['X-Session-ID'] = authStore.sessionId
  }
  
  try {
    console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`)
    
    const response = await fetch(url, defaultOptions)
    const data = await response.json().catch(() => ({}))
    
    // Handle different response statuses
    if (response.ok) {
      return data
    }
    
    // Handle authentication errors (401)
    if (response.status === 401) {
      console.log('🔒 Session expired, redirecting to login...')
      
      // Show user-friendly notification
      window.showNotification?.({
        type: 'warning',
        title: 'Session Expired',
        message: 'Please log in again to continue',
        duration: 4000
      })
      
      // Handle session expiration (don't make logout API call)
      await authStore.handleSessionExpired()
      
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      
      throw new ApiError('Session expired', 401, data)
    }
    
    // Handle forbidden errors (403)
    if (response.status === 403) {
      console.log('🚫 Access forbidden')
      
      window.showNotification?.({
        type: 'error',
        title: 'Access Denied',
        message: 'You do not have permission to perform this action',
        duration: 4000
      })
      
      throw new ApiError('Access forbidden', 403, data)
    }
    
    // Handle other client errors (400-499)
    if (response.status >= 400 && response.status < 500) {
      const errorMessage = data.error || data.message || `Request failed (${response.status})`
      
      console.log(`❌ Client error: ${errorMessage}`)
      
      throw new ApiError(errorMessage, response.status, data)
    }
    
    // Handle server errors (500+)
    if (response.status >= 500) {
      console.log(`🔥 Server error: ${response.status} ${response.statusText}`)
      
      window.showNotification?.({
        type: 'error',
        title: 'Server Error',
        message: 'Something went wrong on our end. Please try again later.',
        duration: 5000
      })
      
      throw new ApiError('Server error', response.status, data)
    }
    
    // Fallback for other status codes
    throw new ApiError(`Request failed with status ${response.status}`, response.status, data)
    
  } catch (error) {
    // Network errors or other fetch failures
    if (!(error instanceof ApiError)) {
      console.log(`🌐 Network error: ${error.message}`)
      
      window.showNotification?.({
        type: 'error',
        title: 'Network Error',
        message: 'Please check your internet connection and try again',
        duration: 5000
      })
      
      throw new ApiError('Network error', 0, { originalError: error.message })
    }
    
    // Re-throw API errors as-is
    throw error
  }
}

// Convenience methods for common HTTP verbs
export const api = {
  get: (url, options = {}) => apiRequest(url, { method: 'GET', ...options }),
  
  post: (url, data = null, options = {}) => apiRequest(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
    ...options
  }),
  
  put: (url, data = null, options = {}) => apiRequest(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
    ...options
  }),
  
  delete: (url, options = {}) => apiRequest(url, { method: 'DELETE', ...options }),
  
  // Special method for form data (file uploads)
  postForm: (url, formData, options = {}) => apiRequest(url, {
    method: 'POST',
    headers: {
      // Don't set Content-Type for FormData - browser will set it with boundary
      ...options.headers,
      'Content-Type': undefined
    },
    body: formData,
    ...options
  }),
  
  // Utility costs methods
  getUtilityCosts: (companyToken = null) => {
    const url = companyToken ? `/api/utility-costs/${companyToken}` : '/api/utility-costs'
    return apiRequest(url, { method: 'GET' })
  },
  // Payroll endpoints
  getMyEntries: (start = null, end = null) => {
    const params = new URLSearchParams()
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    const qs = params.toString()
    return apiRequest(`/api/payroll/me/entries${qs ? `?${qs}` : ''}`, { method: 'GET' })
  },
  getAdminEntries: (companyToken) => apiRequest(`/api/payroll/admin/${companyToken}/entries`, { method: 'GET' }),
  clock: (companyToken, qrSecret) => apiRequest('/api/payroll/clock', { method: 'POST', body: JSON.stringify({ company_token: companyToken, qr_secret: qrSecret }) }),
  markPaid: (companyToken) => apiRequest(`/api/payroll/admin/${companyToken}/pay`, { method: 'POST' }),
  notifyPaid: (companyToken) => apiRequest(`/api/payroll/admin/${companyToken}/notify-paid`, { method: 'POST' }),
  updateEntry: (id, payload) => apiRequest(`/api/payroll/admin/entries/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  createEntry: (payload) => apiRequest(`/api/payroll/admin/entries`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteEntry: (id) => apiRequest(`/api/payroll/admin/entries/${id}`, { method: 'DELETE' }),
  
  // Payment method costs methods
  getPaymentMethodCosts: (companyToken = null) => {
    const url = companyToken ? `/api/payment-method-costs/${companyToken}` : '/api/payment-method-costs'
    return apiRequest(url, { method: 'GET' })
  },
  
  savePaymentMethodCost: (data) => {
    return apiRequest('/api/payment-method-costs', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    })
  },
  
  bulkUpdatePaymentMethodCosts: (companyToken, costs) => {
    return apiRequest(`/api/payment-method-costs/bulk/${companyToken}`, {
      method: 'POST',
      body: JSON.stringify({ costs })
    })
  },
  
  deletePaymentMethodCost: (companyToken, paymentMethodCode) => {
    return apiRequest(`/api/payment-method-costs/${companyToken}/${paymentMethodCode}`, {
      method: 'DELETE'
    })
  },

  // Analytics endpoints
  getProfitability: (startDate, endDate, timezone) => {
    const params = new URLSearchParams({
      'filter[start_date]': startDate,
      'filter[end_date]': endDate,
      'filter[timezone]': timezone
    })
    return apiRequest(`/api/analytics/profitability?${params.toString()}`, { method: 'GET' })
  }
  ,
  // Companies (admin)
  listCompanies: () => apiRequest('/api/admin/companies', { method: 'GET' }),
  createCompany: (name, timezone, currency, currency_symbol) => apiRequest('/api/admin/companies', { method: 'POST', body: JSON.stringify({ name, timezone, currency, currency_symbol }) }),
  listCompanyAccounts: (companyId) => apiRequest(`/api/admin/companies/${companyId}/accounts`, { method: 'GET' }),
  upsertCompanyAccount: (companyId, payload) => apiRequest(`/api/admin/companies/${companyId}/accounts`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteCompanyAccount: (companyId, companyToken) => apiRequest(`/api/admin/companies/${companyId}/accounts/${companyToken}`, { method: 'DELETE' }),

  // Users (admin)
  resetUserPassword: (userId, newPassword) => apiRequest(`/api/admin/users/${userId}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password: newPassword })
  }),
  updateUserEmail: (userId, email) => apiRequest(`/api/admin/users/${userId}/email`, {
    method: 'PUT',
    body: JSON.stringify({ email })
  }),
  notifyUserShift: (userId) => apiRequest(`/api/admin/users/${userId}/notify-shift`, { method: 'POST' }),

  // Shifts (admin)
  getUserShifts: (userId) => apiRequest(`/api/admin/users/${userId}/shifts`, { method: 'GET' }),
  upsertUserShift: (userId, payload) => apiRequest(`/api/admin/users/${userId}/shifts`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteUserShift: (userId, shiftId) => apiRequest(`/api/admin/users/${userId}/shifts/${shiftId}`, { method: 'DELETE' }),

  // Employee shifts (self)
  getMyShifts: (weekStart = null) => {
    const params = new URLSearchParams()
    if (weekStart) params.set('week_start', weekStart)
    const qs = params.toString()
    return apiRequest(`/api/payroll/me/shifts${qs ? `?${qs}` : ''}`, { method: 'GET' })
  }
}

export default api 