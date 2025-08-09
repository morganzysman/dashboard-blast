import { Router } from 'express';
import { requireAuth, requireRole, hashPassword } from '../middleware/auth.js';
import { pool } from '../database.js';
import {
  getAllUsers,
  createUserWithAccounts,
  updateUserAccounts,
  updateUserRole,
  updateUserStatus,
  logNotificationEvent
} from '../database.js';

const router = Router();

// Get all users (super-admin only)
router.get('/users', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    // Super-admin sees all, admin sees only users in their company
    let users
    if (req.user.role === 'super-admin') {
      users = await getAllUsers(includeInactive)
    } else {
      const q = await pool.query(
        `SELECT u.* FROM users u
         WHERE ($1::boolean OR u.is_active = TRUE)
           AND u.company_id = $2`,
        [includeInactive, req.user.companyId || null]
      )
      users = q.rows
    }
    
    // Remove sensitive data
    const safeUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accounts: user.accounts,
      timezone: user.timezone,
      currency: user.currency,
      currency_symbol: user.currency_symbol,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.last_login,
      accountsCount: user.accounts?.length || 0
    }));
    
    res.json({
      success: true,
      users: safeUsers
    });
    
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// Create new user with accounts (super-admin only)
router.post('/users', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { email, name, role, password, accounts, timezone, currency, company_id } = req.body;
    
    // Validate required fields
    if (!email || !name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email, name, and password are required'
      });
    }
    
    // Validate role
    // Admins cannot create super-admin users
    const validRoles = ['admin', 'user', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user data
    const userData = {
      email: email.toLowerCase(),
      name,
      role: role || 'user',
      hashedPassword,
      timezone: timezone || 'America/Lima',
      currency: currency || 'PEN',
      currencySymbol: currency === 'USD' ? '$' : 
                     currency === 'EUR' ? '€' : 
                     currency === 'MXN' ? '$' :
                     currency === 'GBP' ? '£' : 'S/'
    };
    
    // If requester is admin, forbid creating super-admin explicitly
    if (req.user.role === 'admin' && (role === 'super-admin')) {
      return res.status(403).json({ success: false, error: 'Admins cannot create super-admin users' });
    }

    // Enforce company scoping: admin can only create within own company
    const assignedCompanyId = req.user.role === 'admin' ? (req.user.companyId || null) : (company_id || null)
    userData.companyId = assignedCompanyId
    const user = await createUserWithAccounts(userData, accounts || []);
    
    // Log user creation
    await logNotificationEvent(
      req.user.userId,
      'user_created',
      `User ${user.email} created by super-admin`,
      { 
        createdUserId: user.id,
        createdUserRole: user.role,
        accountsAssigned: accounts?.length || 0
      },
      true,
      null,
      req.headers['user-agent']
    );
    
    console.log(`✅ User created by ${req.user.userEmail}: ${user.email} (${user.role})`);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        accounts: user.accounts,
        timezone: user.timezone,
        currency: user.currency,
        currency_symbol: user.currency_symbol,
        created_at: user.created_at,
        accountsCount: user.accounts?.length || 0
      }
    });
    
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }
    
    console.error('❌ Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

// Update user accounts (super-admin only)
router.put('/users/:userId/accounts', requireAuth, requireRole(['super-admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { accounts } = req.body;
    
    if (!Array.isArray(accounts)) {
      return res.status(400).json({
        success: false,
        error: 'Accounts must be an array'
      });
    }
    
    const updatedUser = await updateUserAccounts(userId, accounts);
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Log account update
    await logNotificationEvent(
      req.user.userId,
      'user_accounts_updated',
      `User accounts updated for ${updatedUser.email}`,
      { 
        targetUserId: userId,
        accountsCount: accounts.length,
        accounts: accounts.map(acc => acc.company_token)
      },
      true,
      null,
      req.headers['user-agent']
    );
    
    console.log(`✅ Accounts updated for user ${updatedUser.email} by ${req.user.userEmail}`);
    
    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        accounts: updatedUser.accounts,
        updated_at: updatedUser.updated_at,
        accountsCount: updatedUser.accounts?.length || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating user accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user accounts'
    });
  }
});

// Update user role (super-admin only)
router.put('/users/:userId/role', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    const validRoles = ['admin', 'user', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }
    
    // Admins cannot set super-admin on anyone
    if (req.user.role === 'admin' && role === 'super-admin') {
      return res.status(403).json({ success: false, error: 'Admins cannot assign super-admin role' })
    }

    const updatedUser = await updateUserRole(userId, role);
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Log role update
    await logNotificationEvent(
      req.user.userId,
      'user_role_updated',
      `User role updated for ${updatedUser.email} to ${role}`,
      { 
        targetUserId: userId,
        newRole: role
      },
      true,
      null,
      req.headers['user-agent']
    );
    
    console.log(`✅ Role updated for user ${updatedUser.email} to ${role} by ${req.user.userEmail}`);
    
    res.json({
      success: true,
      user: updatedUser
    });
    
  } catch (error) {
    console.error('❌ Error updating user role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role'
    });
  }
});

// Update user status (activate/deactivate) (super-admin only)
router.put('/users/:userId/status', requireAuth, requireRole(['super-admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;
    
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'is_active must be a boolean'
      });
    }
    
    const updatedUser = await updateUserStatus(userId, is_active);
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Log status update
    await logNotificationEvent(
      req.user.userId,
      'user_status_updated',
      `User ${updatedUser.email} ${is_active ? 'activated' : 'deactivated'}`,
      { 
        targetUserId: userId,
        newStatus: is_active
      },
      true,
      null,
      req.headers['user-agent']
    );
    
    console.log(`✅ User ${updatedUser.email} ${is_active ? 'activated' : 'deactivated'} by ${req.user.userEmail}`);
    
    res.json({
      success: true,
      user: updatedUser
    });
    
  } catch (error) {
    console.error('❌ Error updating user status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user status'
    });
  }
});

export default router; 