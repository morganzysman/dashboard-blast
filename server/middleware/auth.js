import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import {
  createSession,
  getSessionWithUser,
  updateSessionAccess,
  deleteSession,
  logNotificationEvent
} from '../database.js';

// Hash password
export async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Verify password
export async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Create session with database storage
export async function createUserSession(user, userAgent = null, ipAddress = null) {
  const sessionToken = uuidv4();
  const expiresAt = new Date(Date.now() + config.sessionExpiry);
  
  try {
    await createSession(user.id, sessionToken, expiresAt, userAgent, ipAddress);
    
    console.log(`🔑 Session created for user: ${user.email} (ID: ${sessionToken.substring(0, 8)}...) - Expires: ${expiresAt.toLocaleString()}`);
    
    return sessionToken;
  } catch (error) {
    console.error('❌ Error creating session:', error);
    throw new Error('Failed to create session');
  }
}

// Verify session with database
export async function verifyUserSession(sessionToken) {
  try {
    const sessionData = await getSessionWithUser(sessionToken);
    
    if (!sessionData) {
      return null;
    }
    
    // Check if session needs extension (sliding window)
    const timeRemaining = new Date(sessionData.expiresAt).getTime() - Date.now();
    const twelveHours = 12 * 60 * 60 * 1000;
    
    if (timeRemaining < twelveHours) {
      const newExpiresAt = new Date(Date.now() + config.sessionExpiry);
      await updateSessionAccess(sessionToken, newExpiresAt);
      console.log(`🔄 Session extended for user: ${sessionData.user.email}`);
    }
    
    return sessionData;
  } catch (error) {
    console.error('❌ Error verifying session:', error);
    return null;
  }
}

// Authentication middleware
export function requireAuth(req, res, next) {
  const sessionToken = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return res.status(401).json({ 
      success: false, 
      error: 'No session provided',
      requiresLogin: true 
    });
  }
  
  verifyUserSession(sessionToken)
    .then(sessionData => {
      if (!sessionData) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid or expired session',
          requiresLogin: true 
        });
      }
      
      // Attach user data to request
      req.user = {
        userId: sessionData.user.id,
        userEmail: sessionData.user.email,
        userName: sessionData.user.name,
        role: sessionData.user.role,
        userRole: sessionData.user.role,
        userAccounts: sessionData.user.accounts || [],
        userTimezone: sessionData.user.timezone || config.olaClick.defaultTimezone,
        userCurrency: sessionData.user.currency || config.olaClick.defaultCurrency,
        userCurrencySymbol: sessionData.user.currencySymbol || config.olaClick.defaultCurrencySymbol,
        companyId: sessionData.user.company_id || null
      };
      
      next();
    })
    .catch(error => {
      console.error('❌ Authentication error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Authentication error',
        requiresLogin: true 
      });
    });
}

// Role-based authentication middleware
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        requiresLogin: true
      });
    }
    
    if (!allowedRoles.includes(req.user.userRole)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }
    
    next();
  };
}

// Logout user session
export async function logoutUser(sessionToken, userAgent = null) {
  if (sessionToken) {
    try {
      // Get session data before deletion for logging
      const sessionData = await getSessionWithUser(sessionToken);
      
      await deleteSession(sessionToken);
      
      // Log logout if user info is available
      if (sessionData) {
        await logNotificationEvent(
          sessionData.user.id,
          'user_logout',
          'User logged out',
          {},
          true,
          null,
          userAgent
        );
      }
      
      console.log(`👋 User logged out: ${sessionToken.substring(0, 8)}...`);
      return true;
    } catch (error) {
      console.error('❌ Error during logout:', error);
      return false;
    }
  }
  return true;
} 