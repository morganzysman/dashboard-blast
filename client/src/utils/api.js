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
  })
}

export default api 