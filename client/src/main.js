import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'

// Import global styles first
import './style.css'

// Import App after styles
import App from './App.vue'

// Import route components
import LoginView from './views/LoginView.vue'
import DashboardView from './views/DashboardView.vue'
import AdminView from './views/AdminView.vue'
import NotificationsView from './views/NotificationsView.vue'
import RentabilityView from './views/RentabilityView.vue'
import EmployeeClockView from './views/EmployeeClockView.vue'
import EmployeeTimesheetView from './views/EmployeeTimesheetView.vue'
import AdminPayrollView from './views/AdminPayrollView.vue'
import CompaniesView from './views/CompaniesView.vue'

// Import stores
import { useAuthStore } from './stores/auth'

// Create Pinia instance first
const pinia = createPinia()

// Define routes
const routes = [
  {
    path: '/clock',
    name: 'EmployeeClock',
    component: EmployeeClockView,
    meta: { }
  },
  {
    path: '/timesheet',
    name: 'EmployeeTimesheet',
    component: EmployeeTimesheetView,
    meta: { requiresAuth: true, requiresRole: ['employee'] }
  },
  {
    path: '/admin/payroll',
    name: 'AdminPayroll',
    component: AdminPayrollView,
    meta: { requiresAuth: true, requiresRole: ['admin', 'super-admin'] }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: DashboardView,
    meta: { requiresAuth: true, excludeRoles: ['super-admin'] }
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { guest: true }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: AdminView,
    meta: { requiresAuth: true, requiresRole: ['admin', 'super-admin'] }
  },
  {
    path: '/companies',
    name: 'Companies',
    component: CompaniesView,
    meta: { requiresAuth: true, requiresRole: ['super-admin'] }
  },
  {
    path: '/notifications',
    name: 'Notifications',
    component: NotificationsView,
    meta: { requiresAuth: true, excludeRoles: ['super-admin'] }
  },
  {
    path: '/rentability',
    name: 'Rentability',
    component: RentabilityView,
    meta: { requiresAuth: true, excludeRoles: ['super-admin'] }
  }
]

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes
})

// Helper function to get default route for user role
const getDefaultRouteForRole = (userRole) => {
  if (userRole === 'super-admin') {
    return { name: 'Admin' }
  } else {
    return { name: 'Dashboard' }
  }
}

// Router guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Check if user is authenticated
  if (!authStore.isAuthenticated && to.meta.requiresAuth) {
    // Try to restore session from localStorage
    const sessionId = localStorage.getItem('sessionId')
    if (sessionId) {
      try {
        await authStore.verifySession(sessionId)
        if (authStore.isAuthenticated) {
          // After successful authentication, check role-based access
          const userRole = authStore.user.role
          
          // Check if route requires specific role
          if (to.meta.requiresRole && !to.meta.requiresRole.includes(userRole)) {
            next(getDefaultRouteForRole(userRole))
            return
          }
          
          // Check if route excludes this role  
          if (to.meta.excludeRoles && to.meta.excludeRoles.includes(userRole)) {
            next(getDefaultRouteForRole(userRole))
            return
          }
          
          next()
          return
        }
      } catch (error) {
        console.error('Session verification failed:', error)
        localStorage.removeItem('sessionId')
        localStorage.removeItem('user')
      }
    }
    next({ name: 'Login' })
    return
  }
  
  // Redirect authenticated users away from login page to their default route
  if (authStore.isAuthenticated && to.meta.guest) {
    next(getDefaultRouteForRole(authStore.user.role))
    return
  }
  
  // Check role-based access for authenticated users
  if (authStore.isAuthenticated) {
    const userRole = authStore.user.role
    
    // Check if route requires specific role
    if (to.meta.requiresRole && !to.meta.requiresRole.includes(userRole)) {
      next(getDefaultRouteForRole(userRole))
      return
    }
    
    // Check if route excludes this role
    if (to.meta.excludeRoles && to.meta.excludeRoles.includes(userRole)) {
      next(getDefaultRouteForRole(userRole))
      return
    }
  }
  
  next()
})

// Create app
const app = createApp(App)

// Use plugins (Pinia first, then router)
app.use(pinia)
app.use(router)

// Initialize auth store to restore session from localStorage
const authStore = useAuthStore()
authStore.initialize()

// Mount app
app.mount('#app')

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration)
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError)
      })
  })
}

// Global error handler
app.config.errorHandler = (error, instance, info) => {
  console.error('Global error:', error)
  console.error('Component:', instance)
  console.error('Info:', info)
}

export default app 