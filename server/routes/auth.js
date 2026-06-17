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
  logNotificationEvent,
  updateUserPassword,
  getUserPasswordHash
} from '../database.js';
import { getEnabledModules } from '../config/featureModules.js';

const router = Router();

// Resolve a tenant's country (companies.country) and the optional feature
// modules it unlocks. Returns sensible defaults when the user has no company.
async function getCompanyFeatureContext(companyId) {
  if (!companyId) return { country: null, enabledModules: [] };
  try {
    const { pool } = await import('../database.js');
    const q = await pool.query('SELECT country FROM companies WHERE id = $1', [companyId]);
    const country = q.rows[0]?.country || null;
    return { country, enabledModules: getEnabledModules(country) };
  } catch {
    return { country: null, enabledModules: [] };
  }
}

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
    console.log(`🔍 Debug login response - user.accounts:`, user.accounts);
    console.log(`🔍 Debug login response - typeof user.accounts:`, typeof user.accounts);
    
    // Derive accounts from company when present
    let userAccounts = []
    if (user.company_id) {
      const q = await req.app.get('dbPool')?.query?.('SELECT company_token, api_token, account_name FROM company_accounts WHERE company_id = $1', [user.company_id])
        .catch(() => null)
      if (!q) {
        try {
          const { pool } = await import('../database.js')
          const q2 = await pool.query('SELECT company_token, api_token, account_name FROM company_accounts WHERE company_id = $1', [user.company_id])
          userAccounts = q2.rows.map(r => ({ company_token: r.company_token, api_token: r.api_token, account_name: r.account_name }))
        } catch {}
      } else {
        userAccounts = q.rows.map(r => ({ company_token: r.company_token, api_token: r.api_token, account_name: r.account_name }))
      }
    }

    const { country, enabledModules } = await getCompanyFeatureContext(user.company_id);

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company_id: user.company_id || null,
      country,
      enabledModules,
      userAccounts
    };
    
    console.log(`🔍 Debug final userData being sent:`, JSON.stringify(userData, null, 2));
    
    res.json({
      success: true,
      sessionId,
      user: userData
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
    console.log(`🔍 Debug session verify - sessionData.user.accounts:`, sessionData.user.accounts);
    console.log(`🔍 Debug session verify - typeof sessionData.user.accounts:`, typeof sessionData.user.accounts);
    
    // Derive accounts from company when present
    let userAccounts = []
    if (sessionData.user.company_id) {
      try {
        const { pool } = await import('../database.js')
        const q = await pool.query('SELECT company_token, api_token, account_name FROM company_accounts WHERE company_id = $1', [sessionData.user.company_id])
        userAccounts = q.rows.map(r => ({ company_token: r.company_token, api_token: r.api_token, account_name: r.account_name }))
      } catch {}
    }

    const { country, enabledModules } = await getCompanyFeatureContext(sessionData.user.company_id);

    const userData = {
      id: sessionData.user.id,
      name: sessionData.user.name,
      email: sessionData.user.email,
      role: sessionData.user.role,
      company_id: sessionData.user.company_id || null,
      country,
      enabledModules,
      userAccounts
    };
    
    console.log(`🔍 Debug final userData being sent:`, JSON.stringify(userData, null, 2));
    
    res.json({
      success: true,
      user: userData
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

// Change password endpoint (for authenticated users)
router.put('/change-password', async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
    const { currentPassword, newPassword } = req.body;
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }
    
    // Verify session and get user
    const sessionData = await verifyUserSession(sessionToken);
    if (!sessionData) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session'
      });
    }
    
    const userId = sessionData.user.id;
    
    // Get current password hash
    const currentPasswordHash = await getUserPasswordHash(userId);
    if (!currentPasswordHash) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, currentPasswordHash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);
    
    // Update password in database
    const updatedUser = await updateUserPassword(userId, newPasswordHash);
    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update password'
      });
    }
    
    // Log password change event
    await logNotificationEvent(
      userId,
      'password_changed',
      'User changed their password',
      {},
      true,
      null,
      req.headers['user-agent'] || 'Unknown'
    );
    
    console.log(`✅ Password changed for user: ${updatedUser.email}`);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router; 