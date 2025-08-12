import { Router } from 'express';
import { requireAuth, requireRole, hashPassword } from '../middleware/auth.js';
import { pool } from '../database.js';
import {
  getAllUsers,
  createUserWithAccounts,
  updateUserAccounts,
  updateUserRole,
  updateUserStatus,
  updateUserCompany,
  logNotificationEvent
} from '../database.js';

const router = Router();

// Get all users (super-admin only)
router.get('/users', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const companyIdFilter = req.query.company_id || null
    // support roles param as comma-separated list (e.g., roles=employee or roles=admin,super-admin)
    const rolesParam = (req.query.roles || req.query.role || '').toString().trim()
    const rolesList = rolesParam ? rolesParam.split(',').map(r => r.trim()).filter(Boolean) : null

    // Super-admin flexible filtering; admins restricted to own company
    let users
    if (req.user.role === 'super-admin') {
      if (companyIdFilter || rolesList) {
        let idx = 2
        const params = [includeInactive]
        let where = `WHERE ($1::boolean OR u.is_active = TRUE)`
        if (companyIdFilter) { params.push(companyIdFilter); where += ` AND u.company_id = $${idx++}` }
        if (rolesList && rolesList.length) {
          // Build roles IN list safely
          const rolePlaceholders = rolesList.map((_, i) => `$${idx + i}`).join(', ')
          params.push(...rolesList)
          where += ` AND u.role IN (${rolePlaceholders})`
          idx += rolesList.length
        }
        const q = await pool.query(
          `SELECT u.*, c.name AS company_name
           FROM users u
           LEFT JOIN companies c ON c.id = u.company_id
           ${where}
           ORDER BY u.created_at DESC`,
          params
        )
        users = q.rows
      } else {
        // default: previous behavior (no employees)
        const q = await pool.query(
          `SELECT u.*, c.name AS company_name
           FROM users u
           LEFT JOIN companies c ON c.id = u.company_id
           WHERE ($1::boolean OR u.is_active = TRUE)
             AND u.role IN ('admin','super-admin')
           ORDER BY u.created_at DESC`,
          [includeInactive]
        )
        users = q.rows
      }
    } else {
      const q = await pool.query(
        `SELECT u.*, c.name AS company_name
         FROM users u
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE ($1::boolean OR u.is_active = TRUE)
           AND u.company_id = $2
           ${rolesList && rolesList.length ? `AND u.role IN (${rolesList.map((_,i)=>`$${i+3}`).join(', ')})` : ''}`,
        [includeInactive, req.user.companyId || null, ...(rolesList || [])]
      )
      users = q.rows
    }
    
    // Shape response (exclude deprecated fields, include company relation)
    const safeUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hourly_rate: user.hourly_rate != null ? Number(Number(user.hourly_rate).toFixed(2)) : null,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.last_login,
      company: user.company_id ? { id: user.company_id, name: user.company_name || null } : null
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
    const { email, name, role, password, company_id } = req.body;
    
    // Validate required fields
    if (!email || !name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email, name, and password are required'
      });
    }
    
    // Validate role
    // Admins cannot create super-admin users
    const validRoles = ['super-admin', 'admin', 'employee'];
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
      role: role || 'employee',
      hashedPassword
    };
    
    // If requester is admin, forbid creating super-admin explicitly
    if (req.user.role === 'admin' && (role === 'super-admin')) {
      return res.status(403).json({ success: false, error: 'Admins cannot create super-admin users' });
    }

    // Enforce company scoping: admin can only create within own company
    const assignedCompanyId = req.user.role === 'admin' ? (req.user.companyId || null) : (company_id || null)
    userData.companyId = assignedCompanyId
    const user = await createUserWithAccounts(userData, []);
    
    // Log user creation
    await logNotificationEvent(
      req.user.userId,
      'user_created',
      `User ${user.email} created by super-admin`,
      { createdUserId: user.id, createdUserRole: user.role },
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
        company_id: user.company_id,
        created_at: user.created_at
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

// Deprecated: user accounts are managed at company level now
router.put('/users/:userId/accounts', requireAuth, requireRole(['super-admin']), async (req, res) => {
  return res.status(410).json({ success: false, error: 'User accounts are deprecated. Manage accounts under company.' })
});

// Update user role (super-admin only)
router.put('/users/:userId/role', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    const validRoles = ['super-admin', 'admin', 'employee'];
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

// Update user company (super-admin only; admins can only assign within their own company)
router.put('/users/:userId/company', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const { company_id } = req.body

    if (!company_id) {
      return res.status(400).json({ success: false, error: 'company_id is required' })
    }

    // Admins can only assign users to their own company
    if (req.user.role === 'admin' && req.user.companyId !== company_id) {
      return res.status(403).json({ success: false, error: 'Admins can only assign users to their own company' })
    }

    const updatedUser = await updateUserCompany(userId, company_id)
    if (!updatedUser) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    await logNotificationEvent(
      req.user.userId,
      'user_company_updated',
      `User company updated to ${company_id}`,
      { targetUserId: userId, companyId: company_id },
      true,
      null,
      req.headers['user-agent']
    )

    res.json({ success: true, user: updatedUser })
  } catch (error) {
    console.error('❌ Error updating user company:', error)
    res.status(500).json({ success: false, error: 'Failed to update user company' })
  }
})

// Update user hourly rate
router.put('/users/:userId/hourly-rate', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const { hourly_rate } = req.body
    const rate = Number(hourly_rate)
    if (Number.isNaN(rate) || rate < 0) {
      return res.status(400).json({ success: false, error: 'hourly_rate must be a non-negative number' })
    }
    // Admins can only update within their company
    if (req.user.role === 'admin') {
      const q = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId])
      if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
      const cid = q.rows[0].company_id || null
      if (!cid || cid !== req.user.companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
      }
    }
    const upd = await pool.query('UPDATE users SET hourly_rate = $2, updated_at = NOW() WHERE id = $1 RETURNING id, email, name, role, hourly_rate, company_id', [userId, rate])
    if (upd.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
    res.json({ success: true, user: upd.rows[0] })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update hourly rate' })
  }
})

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

// Delete user (super-admin only)
router.delete('/users/:userId', requireAuth, requireRole(['super-admin']), async (req, res) => {
  try {
    const { userId } = req.params

    // Prevent deleting yourself
    if (req.user.userId === userId) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own user' })
    }

    const q = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email, name, role',
      [userId]
    )

    if (q.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Log deletion
    await logNotificationEvent(
      req.user.userId,
      'user_deleted',
      `User ${q.rows[0].email} deleted`,
      { targetUserId: userId },
      true,
      null,
      req.headers['user-agent']
    )

    res.json({ success: true })
  } catch (error) {
    console.error('❌ Error deleting user:', error)
    res.status(500).json({ success: false, error: 'Failed to delete user' })
  }
})

// Reset user password (admin/super-admin)
router.put('/users/:userId/password', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const { password } = req.body || {}

    if (typeof password !== 'string' || password.trim().length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
    }

    // Fetch target user to validate scope
    const q = await pool.query('SELECT id, email, role, company_id FROM users WHERE id = $1', [userId])
    if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
    const target = q.rows[0]

    // Admins cannot reset super-admin passwords and can only reset within their company
    if (req.user.role === 'admin') {
      if (target.role === 'super-admin') {
        return res.status(403).json({ success: false, error: 'Admins cannot reset super-admin passwords' })
      }
      const adminCompanyId = req.user.companyId || null
      if (!adminCompanyId || target.company_id !== adminCompanyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
      }
    }

    const hashed = await hashPassword(password.trim())
    const upd = await pool.query(
      'UPDATE users SET hashed_password = $2, updated_at = NOW() WHERE id = $1 RETURNING id, email, role, company_id',
      [userId, hashed]
    )

    // Log password reset action (without password)
    await logNotificationEvent(
      req.user.userId,
      'user_password_reset',
      `Password reset for ${target.email}`,
      { targetUserId: userId },
      true,
      null,
      req.headers['user-agent']
    )

    res.json({ success: true, user: upd.rows[0] })
  } catch (error) {
    console.error('❌ Error resetting password:', error)
    res.status(500).json({ success: false, error: 'Failed to reset password' })
  }
})

export default router; 

// Companies endpoints appended at end to avoid breaking existing imports
router.get('/companies', requireAuth, requireRole(['super-admin']), async (req, res) => {
  try {
    const companies = await pool.query(`SELECT id, name, created_at, updated_at FROM companies ORDER BY name`)
    res.json({ success: true, data: companies.rows })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch companies' })
  }
})

router.post('/companies', requireAuth, requireRole(['super-admin']), async (req, res) => {
  try {
    const { name, timezone, currency, currency_symbol } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'name is required' })
    // Defaults: Lima timezone and PEN
    const tz = timezone || 'America/Lima'
    const curr = currency || 'PEN'
    const currSym = currency_symbol || (curr === 'USD' ? '$' : curr === 'EUR' ? '€' : curr === 'GBP' ? '£' : curr === 'MXN' ? '$' : 'S/')
    const q = await pool.query(
      `INSERT INTO companies(name, timezone, currency, currency_symbol) 
       VALUES($1,$2,$3,$4) RETURNING id, name, timezone, currency, currency_symbol, created_at, updated_at`, 
       [name, tz, curr, currSym]
    )
    res.json({ success: true, data: q.rows[0] })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to create company' })
  }
})

router.get('/companies/:companyId/accounts', requireAuth, requireRole(['super-admin', 'admin']), async (req, res) => {
  try {
    const { companyId } = req.params
    if (req.user.role === 'admin' && req.user.companyId !== companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const q = await pool.query(`SELECT company_id, company_token, account_name FROM company_accounts WHERE company_id = $1 ORDER BY account_name`, [companyId])
    res.json({ success: true, data: q.rows })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch accounts' })
  }
})

router.post('/companies/:companyId/accounts', requireAuth, requireRole(['super-admin', 'admin']), async (req, res) => {
  try {
    const { companyId } = req.params
    const { company_token, account_name, api_token } = req.body
    if (!company_token) return res.status(400).json({ success: false, error: 'company_token is required' })
    if (req.user.role === 'admin' && req.user.companyId !== companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const q = await pool.query(
      `INSERT INTO company_accounts(company_id, company_token, account_name, api_token) VALUES ($1, $2, $3, $4)
       ON CONFLICT (company_id, company_token) DO UPDATE SET account_name = EXCLUDED.account_name, api_token = EXCLUDED.api_token
       RETURNING company_id, company_token, account_name, api_token`,
      [companyId, company_token, account_name || null, api_token || null]
    )
    res.json({ success: true, data: q.rows[0] })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to upsert account' })
  }
})

router.delete('/companies/:companyId/accounts/:companyToken', requireAuth, requireRole(['super-admin', 'admin']), async (req, res) => {
  try {
    const { companyId, companyToken } = req.params
    if (req.user.role === 'admin' && req.user.companyId !== companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    await pool.query(`DELETE FROM company_accounts WHERE company_id = $1 AND company_token = $2`, [companyId, companyToken])
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to delete account' })
  }
})

// Get single company details
router.get('/companies/:companyId', requireAuth, requireRole(['super-admin', 'admin', 'employee']), async (req, res) => {
  try {
    const { companyId } = req.params
    // Non super-admins can only access their own company
    if (req.user.role !== 'super-admin') {
      if (!req.user.companyId || req.user.companyId !== companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
      }
    }
    const q = await pool.query(
      `SELECT id, name, timezone, currency, currency_symbol, created_at, updated_at
       FROM companies WHERE id = $1`,
      [companyId]
    )
    if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'Company not found' })
    res.json({ success: true, data: q.rows[0] })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch company' })
  }
})

// Delete company (super-admin only)
router.delete('/companies/:companyId', requireAuth, requireRole(['super-admin']), async (req, res) => {
  try {
    const { companyId } = req.params
    await pool.query('DELETE FROM companies WHERE id = $1', [companyId])
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to delete company' })
  }
})