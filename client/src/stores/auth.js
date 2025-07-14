import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  const sessionId = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const isAuthenticated = computed(() => !!user.value && !!sessionId.value)
  const hasRole = computed(() => (roles) => {
    if (!user.value) return false
    return roles.includes(user.value.role)
  })
  const isSuperAdmin = computed(() => user.value?.role === 'super-admin')
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isUser = computed(() => user.value?.role === 'user')
  const isViewer = computed(() => user.value?.role === 'viewer')

  // Actions
  const login = async (email, password) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (data.success) {
        user.value = data.user
        sessionId.value = data.sessionId
        
        // Store in localStorage
        localStorage.setItem('sessionId', data.sessionId)
        localStorage.setItem('user', JSON.stringify(data.user))
        
        console.log('✅ Login successful:', data.user.email)
        return { success: true }
      } else {
        error.value = data.error || 'Login failed'
        return { success: false, error: error.value }
      }
    } catch (err) {
      error.value = 'Network error. Please try again.'
      console.error('Login error:', err)
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    isLoading.value = true

    try {
      if (sessionId.value) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'X-Session-ID': sessionId.value,
          },
        })
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      // Clear state regardless of API call success
      user.value = null
      sessionId.value = null
      error.value = null
      isLoading.value = false
      
      // Clear localStorage
      localStorage.removeItem('sessionId')
      localStorage.removeItem('user')
      
      console.log('👋 Logout successful')
    }
  }

  const verifySession = async (sessionToken) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'X-Session-ID': sessionToken,
        },
      })

      const data = await response.json()

      if (data.success) {
        user.value = data.user
        sessionId.value = sessionToken
        
        // Update localStorage
        localStorage.setItem('sessionId', sessionToken)
        localStorage.setItem('user', JSON.stringify(data.user))
        
        console.log('✅ Session verified:', data.user.email)
        return { success: true }
      } else {
        // Clear invalid session
        user.value = null
        sessionId.value = null
        localStorage.removeItem('sessionId')
        localStorage.removeItem('user')
        
        error.value = data.error || 'Session expired'
        return { success: false, error: error.value }
      }
    } catch (err) {
      error.value = 'Network error. Please try again.'
      console.error('Session verification error:', err)
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  const restoreSession = () => {
    const storedSessionId = localStorage.getItem('sessionId')
    const storedUser = localStorage.getItem('user')

    if (storedSessionId && storedUser) {
      try {
        sessionId.value = storedSessionId
        user.value = JSON.parse(storedUser)
        console.log('🔄 Session restored from localStorage')
        return true
      } catch (err) {
        console.error('Error restoring session:', err)
        localStorage.removeItem('sessionId')
        localStorage.removeItem('user')
        return false
      }
    }
    return false
  }

  const clearError = () => {
    error.value = null
  }

  const updateUser = (userData) => {
    if (user.value) {
      user.value = { ...user.value, ...userData }
      localStorage.setItem('user', JSON.stringify(user.value))
    }
  }

  // Initialize store
  const initialize = () => {
    restoreSession()
  }

  return {
    // State
    user,
    sessionId,
    isLoading,
    error,
    
    // Getters
    isAuthenticated,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isUser,
    isViewer,
    
    // Actions
    login,
    logout,
    verifySession,
    restoreSession,
    clearError,
    updateUser,
    initialize,
  }
}) 