import { Router } from 'express';
import { notifyUserShiftUpdate, notifyUserPaid } from '../services/notificationService.js';
import { requireAuth, requireRole, hashPassword } from '../middleware/auth.js';
import { pool } from '../database.js';
import {
  getAllUsers,
  createUserWithAccounts,
  updateUserAccounts,
  updateUserRole,
  updateUserStatus,
  updateUserCompany,
  updateUserEmail,
  checkEmailExists,
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
      hired_at: user.hired_at || null,
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

// Update user hired_at date
router.put('/users/:userId/hired-at', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const { hired_at } = req.body

    // Validate date format if provided
    if (hired_at && isNaN(new Date(hired_at).getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date format for hired_at' })
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

    const upd = await pool.query(
      'UPDATE users SET hired_at = $2, updated_at = NOW() WHERE id = $1 RETURNING id, email, name, role, hired_at, company_id',
      [userId, hired_at || null]
    )
    if (upd.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
    res.json({ success: true, user: upd.rows[0] })
  } catch (e) {
    console.error('Error updating hired_at:', e)
    res.status(500).json({ success: false, error: 'Failed to update hired date' })
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

// Update user email (admin/super-admin)
router.put('/users/:userId/email', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const { email } = req.body || {}

    // Validate email format
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email is required' })
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Invalid email format' })
    }

    // Fetch target user to validate scope
    const q = await pool.query('SELECT id, email, role, company_id FROM users WHERE id = $1', [userId])
    if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
    const target = q.rows[0]

    // Admins cannot edit super-admin emails and can only edit within their company
    if (req.user.role === 'admin') {
      if (target.role === 'super-admin') {
        return res.status(403).json({ success: false, error: 'Admins cannot edit super-admin emails' })
      }
      const adminCompanyId = req.user.companyId || null
      if (!adminCompanyId || target.company_id !== adminCompanyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
      }
    }

    // Check if email already exists for another user in the same company
    const existingUser = await checkEmailExists(email.trim(), target.company_id, userId)
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Email already exists for another user' })
    }

    // Update email
    const updatedUser = await updateUserEmail(userId, email.trim(), target.company_id)
    if (!updatedUser) {
      return res.status(500).json({ success: false, error: 'Failed to update email' })
    }

    // Log email update action
    await logNotificationEvent(
      req.user.userId,
      'user_email_updated',
      `Email updated for user from ${target.email} to ${email.trim()}`,
      { 
        targetUserId: userId,
        oldEmail: target.email,
        newEmail: email.trim()
      },
      true,
      null,
      req.headers['user-agent']
    )

    console.log(`✅ Email updated for user ${userId}: ${target.email} → ${email.trim()}`)
    res.json({ success: true, user: updatedUser, message: 'Email updated successfully' })
  } catch (error) {
    console.error('❌ Error updating email:', error)
    res.status(500).json({ success: false, error: 'Failed to update email' })
  }
})

// Shifts management (admin/super-admin)
router.get('/users/:userId/shifts', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    // Admins restricted to own company: ensure the user belongs to same company
    if (req.user.role === 'admin') {
      const q = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId])
      const cid = q.rows[0]?.company_id || null
      if (!cid || cid !== req.user.companyId) return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const q2 = await pool.query(
      `SELECT id, user_id, company_token, weekday, start_time, end_time
       FROM employee_shifts WHERE user_id = $1 ORDER BY weekday, company_token`,
      [userId]
    )
    res.json({ success: true, data: q2.rows })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch shifts' })
  }
})

router.post('/users/:userId/shifts', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const { company_token, weekday, start_time, end_time } = req.body || {}
    if (!company_token || typeof weekday !== 'number' || !start_time || !end_time) {
      return res.status(400).json({ success: false, error: 'company_token, weekday, start_time, end_time required' })
    }
    if (weekday < 0 || weekday > 6) return res.status(400).json({ success: false, error: 'weekday must be 0..6' })
    // Admins restricted to own company
    if (req.user.role === 'admin') {
      const uq = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId])
      const cid = uq.rows[0]?.company_id || null
      if (!cid || cid !== req.user.companyId) return res.status(403).json({ success: false, error: 'Forbidden' })
      const aq = await pool.query('SELECT company_id FROM company_accounts WHERE company_token = $1', [company_token])
      if ((aq.rows[0]?.company_id || null) !== req.user.companyId) return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    
    // Check if a shift already exists for this user/weekday combination
    const existing = await pool.query(
      'SELECT id, company_token FROM employee_shifts WHERE user_id = $1 AND weekday = $2',
      [userId, weekday]
    )
    
    if (existing.rowCount > 0) {
      // Shift exists - prevent changing company_token
      const existingCompanyToken = existing.rows[0].company_token
      if (existingCompanyToken !== company_token) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cannot change company_token for existing shift. Delete the shift first if needed.' 
        })
      }
      
      // Update only time fields, keeping the same company_token
      const upd = await pool.query(
        `UPDATE employee_shifts 
         SET start_time = $3, end_time = $4, updated_at = NOW()
         WHERE user_id = $1 AND weekday = $2
         RETURNING *`,
        [userId, weekday, start_time, end_time]
      )
      res.json({ success: true, data: upd.rows[0] })
    } else {
      // No existing shift - create new one
      const ins = await pool.query(
        `INSERT INTO employee_shifts(user_id, company_token, weekday, start_time, end_time)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [userId, company_token, weekday, start_time, end_time]
      )
      res.json({ success: true, data: ins.rows[0] })
    }
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to upsert shift' })
  }
})

// Manually notify a user that their shifts were updated
router.post('/users/:userId/notify-shift', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    // Admins: scope to own company
    if (req.user.role === 'admin') {
      const uq = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId])
      const cid = uq.rows[0]?.company_id || null
      if (!cid || cid !== req.user.companyId) return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const details = await notifyUserShiftUpdate(userId)
    res.json({ success: true, ...details, notified: (details?.sentCount || 0) > 0 })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to send shift notification' })
  }
})

router.delete('/users/:userId/shifts/:shiftId', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId, shiftId } = req.params
    if (req.user.role === 'admin') {
      const uq = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId])
      const cid = uq.rows[0]?.company_id || null
      if (!cid || cid !== req.user.companyId) return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    await pool.query('DELETE FROM employee_shifts WHERE id = $1 AND user_id = $2', [shiftId, userId])
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to delete shift' })
  }
})

// Companies endpoints appended at end to avoid breaking existing imports
router.get('/companies', requireAuth, requireRole(['super-admin']), async (req, res) => {
  try {
    const companies = await pool.query(`SELECT id, name, timezone, currency, language, created_at, updated_at FROM companies ORDER BY name`)
    res.json({ success: true, data: companies.rows })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch companies' })
  }
})

router.post('/companies', requireAuth, requireRole(['super-admin']), async (req, res) => {
  try {
    const { name, timezone, currency, currency_symbol, language } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'name is required' })
    // Defaults: Lima timezone, PEN, and Portuguese
    const tz = timezone || 'America/Lima'
    const curr = currency || 'PEN'
    const currSym = currency_symbol || (curr === 'USD' ? '$' : curr === 'EUR' ? '€' : curr === 'GBP' ? '£' : curr === 'MXN' ? '$' : 'S/')
    const lang = language || 'pt'
    const q = await pool.query(
      `INSERT INTO companies(name, timezone, currency, currency_symbol, language) 
       VALUES($1,$2,$3,$4,$5) RETURNING id, name, timezone, currency, currency_symbol, language, created_at, updated_at`, 
       [name, tz, curr, currSym, lang]
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
      `SELECT id, name, timezone, currency, currency_symbol, language, created_at, updated_at
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

// Shifts calendar per account for a week (admin/super-admin)
router.get('/shifts', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const companyToken = (req.query.company_token || '').toString().trim()
    if (!companyToken) return res.status(400).json({ success: false, error: 'company_token is required' })

    // Resolve account and enforce scope for admin
    const acct = await pool.query('SELECT company_id, account_name, company_token FROM company_accounts WHERE company_token = $1', [companyToken])
    if (acct.rowCount === 0) return res.status(404).json({ success: false, error: 'Account not found' })
    const companyId = acct.rows[0].company_id
    if (req.user.role === 'admin') {
      if (!req.user.companyId || req.user.companyId !== companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
      }
    }

    // Determine start of week (Sunday) using optional week_start
    const TIMEZONE = 'America/Santiago'
    let startParam = (req.query.week_start || '').toString().slice(0, 10)
    let startTz
    if (/^\d{4}-\d{2}-\d{2}$/.test(startParam)) {
      startTz = new Date(new Date(startParam).toLocaleString('en-US', { timeZone: TIMEZONE }))
    } else {
      const nowTz = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }))
      startTz = new Date(nowTz)
      startTz.setDate(nowTz.getDate() - nowTz.getDay())
    }
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startTz)
      d.setDate(startTz.getDate() + i)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      days.push({ date: `${yyyy}-${mm}-${dd}`, weekday: d.getDay() })
    }

    // Fetch shifts for this account and users
    const q = await pool.query(
      `SELECT es.user_id, u.name, u.email, es.weekday, es.start_time, es.end_time
       FROM employee_shifts es
       JOIN users u ON u.id = es.user_id
       WHERE es.company_token = $1
       ORDER BY es.weekday, u.name`,
      [companyToken]
    )

    const byWeekday = new Map()
    for (const r of q.rows) {
      const wd = Number(r.weekday)
      if (!byWeekday.has(wd)) byWeekday.set(wd, [])
      byWeekday.get(wd).push({
        user_id: r.user_id,
        name: r.name,
        email: r.email,
        start_time: r.start_time,
        end_time: r.end_time
      })
    }

    const data = days.map(d => ({
      date: d.date,
      weekday: d.weekday,
      entries: byWeekday.get(d.weekday) || []
    }))
    res.json({ success: true, account: { company_token: acct.rows[0].company_token, account_name: acct.rows[0].account_name }, data })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch shifts calendar' })
  }
})

export default router;