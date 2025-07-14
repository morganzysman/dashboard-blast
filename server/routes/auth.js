import { Router } from 'express';
import {
  hashPassword,
  verifyPassword,
  createUserSession,
  verifyUserSession,
  logoutUser
} from '../middleware/auth.js';
import {
  getUserByEmail,
  updateUserLastLogin,
  logNotificationEvent
} from '../database.js';

const router = Router();

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Find user by email
    const user = await getUserByEmail(email.toLowerCase());
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.hashed_password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Update last login
    await updateUserLastLogin(user.id);
    
    // Create session
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const sessionId = await createUserSession(user, userAgent, ipAddress);
    
    // Log successful login
    await logNotificationEvent(
      user.id,
      'user_login',
      `User logged in successfully`,
      { userAgent, ipAddress },
      true,
      null,
      userAgent
    );
    
    console.log(`✅ User logged in: ${user.email} (${user.accounts?.length || 0} accounts)`);
    
    res.json({
      success: true,
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        timezone: user.timezone || 'America/Lima',
        currency: user.currency || 'PEN',
        currencySymbol: user.currency_symbol || 'S/',
        accountsCount: user.accounts?.length || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  const sessionToken = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  await logoutUser(sessionToken, userAgent);
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// Verify session endpoint
router.get('/verify', async (req, res) => {
  const sessionToken = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!sessionToken) {
    console.log('❌ Session verification failed: No session ID provided');
    return res.status(401).json({
      success: false,
      error: 'No session provided',
      requiresLogin: true
    });
  }
  
  try {
    const sessionData = await verifyUserSession(sessionToken);
    
    if (!sessionData) {
      console.log(`❌ Session verification failed: Invalid or expired session (ID: ${sessionToken.substring(0, 8)}...)`);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session',
        requiresLogin: true
      });
    }
    
    console.log(`✅ Session verified for user: ${sessionData.user.email} (ID: ${sessionToken.substring(0, 8)}...) - Expires: ${new Date(sessionData.expiresAt).toLocaleString()}`);
    
    res.json({
      success: true,
      user: {
        id: sessionData.user.id,
        name: sessionData.user.name,
        email: sessionData.user.email,
        role: sessionData.user.role,
        timezone: sessionData.user.timezone || 'America/Lima',
        currency: sessionData.user.currency || 'PEN',
        currencySymbol: sessionData.user.currencySymbol || 'S/',
        accountsCount: sessionData.user.accounts?.length || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Session verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Session verification error',
      requiresLogin: true
    });
  }
});

export default router; 