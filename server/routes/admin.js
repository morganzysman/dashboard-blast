import { Router } from 'express';
import { notifyUserShiftUpdate, notifyUserPaid } from '../services/notificationService.js';
import { requireAuth, requireRole, hashPassword } from '../middleware/auth.js';
import { pool } from '../database.js';
import { listCountries, getCountryConfig, DEFAULT_COUNTRY } from '../config/contractCountries.js';
import { validateContractData, buildContractDefinition } from '../services/contractService.js';
import { createPdf, createPdfBuffer } from '../services/pdfPrinter.js';
import {
  sha256Hex,
  contractStatusFor,
  employeeContractStatus,
  isExpiringSoon,
  decodeSignaturePng,
  renderSignedContractIfComplete,
  renderContractCurrentPdf,
} from '../services/contractSigning.js';
import { isModuleEnabled } from '../config/featureModules.js';
import {
  getAllUsers,
  createUserWithAccounts,
  updateUserAccounts,
  updateUserRole,
  updateUserStatus,
  updateUserCompany,
  updateUserEmail,
  updateUserProfile,
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
      job_type: user.job_type || null,
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

// Update user profile (name)
router.put('/users/:userId/profile', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const { name } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' })
    }
    // Admin scope check
    if (req.user.role === 'admin') {
      const target = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId])
      if (target.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
      if (target.rows[0].company_id !== req.user.companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
      }
    }
    const updated = await updateUserProfile(userId, { name: name.trim() })
    if (!updated) return res.status(404).json({ success: false, error: 'User not found' })
    res.json({ success: true, user: updated })
  } catch (error) {
    console.error('Error updating user profile:', error)
    res.status(500).json({ success: false, error: 'Failed to update user profile' })
  }
})

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

// Update user job_type (kitchen | waiter | null)
router.put('/users/:userId/job-type', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const { job_type } = req.body || {}

    const allowed = [null, 'kitchen', 'waiter']
    const normalised = job_type === '' || job_type == null ? null : String(job_type).toLowerCase()
    if (!allowed.includes(normalised)) {
      return res.status(400).json({
        success: false,
        error: 'job_type must be one of: kitchen, waiter, or null'
      })
    }

    if (req.user.role === 'admin') {
      const q = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId])
      if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
      const cid = q.rows[0].company_id || null
      if (!cid || cid !== req.user.companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
      }
    }

    const upd = await pool.query(
      'UPDATE users SET job_type = $2, updated_at = NOW() WHERE id = $1 RETURNING id, email, name, role, job_type, company_id',
      [userId, normalised]
    )
    if (upd.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
    res.json({ success: true, user: upd.rows[0] })
  } catch (e) {
    console.error('Error updating job_type:', e)
    res.status(500).json({ success: false, error: 'Failed to update job type' })
  }
})

// Update user status (activate/deactivate) (super-admin only)
router.put('/users/:userId/status', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'is_active must be a boolean'
      });
    }

    // Admins can only toggle users within their own company
    if (req.user.role === 'admin') {
      const target = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
      if (target.rowCount === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      if (target.rows[0].company_id !== req.user.companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
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
    // `id` is optional: when provided we update that specific shift row, otherwise
    // we create a new one. Multiple shifts per user/weekday are allowed (split shifts).
    const { id, company_token, weekday, start_time, end_time } = req.body || {}
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

    if (id) {
      // Update an existing shift row (verify it belongs to this user)
      const upd = await pool.query(
        `UPDATE employee_shifts
         SET company_token = $3, weekday = $4, start_time = $5, end_time = $6, updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [id, userId, company_token, weekday, start_time, end_time]
      )
      if (upd.rowCount === 0) return res.status(404).json({ success: false, error: 'Shift not found' })
      return res.json({ success: true, data: upd.rows[0] })
    }

    // No id provided - create a new shift block
    const ins = await pool.query(
      `INSERT INTO employee_shifts(user_id, company_token, weekday, start_time, end_time)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [userId, company_token, weekday, start_time, end_time]
    )
    res.json({ success: true, data: ins.rows[0] })
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
    const companies = await pool.query(`SELECT id, name, timezone, currency, language, country, created_at, updated_at FROM companies ORDER BY name`)
    res.json({ success: true, data: companies.rows })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch companies' })
  }
})

router.post('/companies', requireAuth, requireRole(['super-admin']), async (req, res) => {
  try {
    const { name, timezone, currency, currency_symbol, language, country } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'name is required' })
    // Defaults: Lima timezone, PEN, Portuguese, and Peru
    const tz = timezone || 'America/Lima'
    const curr = currency || 'PEN'
    const currSym = currency_symbol || (curr === 'USD' ? '$' : curr === 'EUR' ? '€' : curr === 'GBP' ? '£' : curr === 'MXN' ? '$' : 'S/')
    const lang = language || 'pt'
    const cc = (country || 'PE').toUpperCase()
    const q = await pool.query(
      `INSERT INTO companies(name, timezone, currency, currency_symbol, language, country) 
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id, name, timezone, currency, currency_symbol, language, country, created_at, updated_at`, 
       [name, tz, curr, currSym, lang, cc]
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
    const q = await pool.query(`SELECT company_id, company_token, account_name, api_token, country, contract_employer_info FROM company_accounts WHERE company_id = $1 ORDER BY account_name`, [companyId])
    res.json({ success: true, data: q.rows })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch accounts' })
  }
})

router.post('/companies/:companyId/accounts', requireAuth, requireRole(['super-admin', 'admin']), async (req, res) => {
  try {
    const { companyId } = req.params
    const { company_token, account_name, api_token, country, contract_employer_info } = req.body
    if (!company_token) return res.status(400).json({ success: false, error: 'company_token is required' })
    if (req.user.role === 'admin' && req.user.companyId !== companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    // Validate country (when provided) and sanitise the employer info blob to the
    // keys the country's registry actually defines, so we never persist garbage.
    let normalizedCountry = null
    let employerInfoJson = null
    if (country !== undefined || contract_employer_info !== undefined) {
      const code = (country || DEFAULT_COUNTRY).toUpperCase()
      const config = getCountryConfig(code)
      if (!config) return res.status(400).json({ success: false, error: `Unknown country: ${country}` })
      normalizedCountry = code
      const incoming = contract_employer_info && typeof contract_employer_info === 'object' ? contract_employer_info : {}
      const clean = {}
      for (const field of config.employerFields) {
        const v = incoming[field.key]
        if (v != null && String(v).trim() !== '') clean[field.key] = String(v).trim()
      }
      employerInfoJson = JSON.stringify(clean)
    }

    const q = await pool.query(
      `INSERT INTO company_accounts(company_id, company_token, account_name, api_token, country, contract_employer_info)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'PE'), COALESCE($6::jsonb, '{}'::jsonb))
       ON CONFLICT (company_id, company_token) DO UPDATE SET
         account_name = EXCLUDED.account_name,
         api_token = EXCLUDED.api_token,
         country = COALESCE($5, company_accounts.country),
         contract_employer_info = COALESCE($6::jsonb, company_accounts.contract_employer_info)
       RETURNING company_id, company_token, account_name, api_token, country, contract_employer_info`,
      [companyId, company_token, account_name || null, api_token || null, normalizedCountry, employerInfoJson]
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
      `SELECT id, name, timezone, currency, currency_symbol, language, country, created_at, updated_at
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

// ===== Self-service account settings (regular account admin) =================
// Lets a company's own admin manage the OlaClick API key for their accounts,
// instead of relying on the super-admin. Gated by the company country via the
// 'account-api-access' feature module (server/config/featureModules.js).

// Resolve the requesting user's company id + country, enforcing that the
// account-api-access module is enabled for that country. Returns null + sends
// the proper error response when not permitted.
async function resolveAccountApiContext(req, res) {
  const companyId = req.user.companyId
  if (!companyId) {
    res.status(403).json({ success: false, error: 'No company associated with this account' })
    return null
  }
  const c = await pool.query('SELECT country FROM companies WHERE id = $1', [companyId])
  if (c.rowCount === 0) {
    res.status(404).json({ success: false, error: 'Company not found' })
    return null
  }
  const country = c.rows[0].country
  if (!isModuleEnabled('account-api-access', country)) {
    res.status(403).json({ success: false, error: 'This feature is not available for your country' })
    return null
  }
  return { companyId, country }
}

// List this company's accounts including their API key (the admin owns it).
router.get('/account-settings', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const ctx = await resolveAccountApiContext(req, res)
    if (!ctx) return
    const q = await pool.query(
      `SELECT company_token, account_name, api_token
       FROM company_accounts WHERE company_id = $1 ORDER BY account_name`,
      [ctx.companyId]
    )
    res.json({ success: true, data: q.rows })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch account settings' })
  }
})

// Update the API key for one of this company's accounts.
router.put('/account-settings/:companyToken', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const ctx = await resolveAccountApiContext(req, res)
    if (!ctx) return
    const { companyToken } = req.params
    const { api_token } = req.body
    const q = await pool.query(
      `UPDATE company_accounts SET api_token = $3
       WHERE company_id = $1 AND company_token = $2
       RETURNING company_token, account_name, api_token`,
      [ctx.companyId, companyToken, api_token ?? null]
    )
    if (q.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Account not found for this company' })
    }
    res.json({ success: true, data: q.rows[0] })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update API key' })
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
    let startParam = (req.query.week_start || '').toString().slice(0, 10)
    let startTz
    if (/^\d{4}-\d{2}-\d{2}$/.test(startParam)) {
      // Parse as local date parts to avoid UTC-to-timezone off-by-one
      const [y, m, d] = startParam.split('-').map(Number)
      startTz = new Date(y, m - 1, d)
    } else {
      const now = new Date()
      startTz = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
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
       WHERE es.company_token = $1 AND u.is_active = TRUE
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

// ====== WORK CONTRACTS ======

// Country contract registry (drives frontend field rendering + labels)
router.get('/contract-config', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  res.json({ success: true, data: { countries: listCountries(), defaultCountry: DEFAULT_COUNTRY } })
})

// Get a single user's full detail (includes contract identity fields + the
// accounts of their company, with employer contract info, for the detail page).
router.get('/users/:userId/detail', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const uq = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.is_active, u.company_id,
              u.hourly_rate, u.hired_at, u.job_type,
              u.document_type, u.document_number, u.address,
              (u.id_document_image IS NOT NULL) AS has_id_document,
              c.name AS company_name
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1`,
      [userId]
    )
    if (uq.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
    const user = uq.rows[0]

    // Admin scope: only own company
    if (req.user.role === 'admin' && user.company_id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    let accounts = []
    if (user.company_id) {
      const aq = await pool.query(
        `SELECT company_token, COALESCE(account_name, company_token) AS account_name,
                country, contract_employer_info
         FROM company_accounts WHERE company_id = $1 ORDER BY account_name`,
        [user.company_id]
      )
      accounts = aq.rows
    }

    // Derived contract status for the prominent header badge.
    const csq = await pool.query(
      `SELECT status, end_date FROM contracts WHERE user_id = $1`,
      [userId]
    )
    const contractStatus = employeeContractStatus(csq.rows)

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          hourly_rate: user.hourly_rate != null ? Number(Number(user.hourly_rate).toFixed(2)) : null,
        },
        accounts,
        contractStatus,
      },
    })
  } catch (e) {
    console.error('Error fetching user detail:', e)
    res.status(500).json({ success: false, error: 'Failed to fetch user detail' })
  }
})

// Stream an employee's ID document image (admin/super-admin, own company scope)
router.get('/users/:userId/id-document', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const q = await pool.query(
      `SELECT company_id, id_document_image, id_document_mime FROM users WHERE id = $1`,
      [userId]
    )
    if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
    const row = q.rows[0]
    if (req.user.role === 'admin' && row.company_id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    if (!row.id_document_image) {
      return res.status(404).json({ success: false, error: 'No ID document on file' })
    }
    res.setHeader('Content-Type', row.id_document_mime || 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(row.id_document_image)
  } catch (e) {
    console.error('Error fetching ID document:', e)
    res.status(500).json({ success: false, error: 'Failed to fetch ID document' })
  }
})

// Update employee contract identity fields (document + address)
router.put('/users/:userId/contract-info', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const { document_type, document_number, address } = req.body || {}

    // Admin scope check
    const tq = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId])
    if (tq.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
    if (req.user.role === 'admin' && tq.rows[0].company_id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const norm = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim())
    const upd = await pool.query(
      `UPDATE users SET document_type = $2, document_number = $3, address = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, document_type, document_number, address`,
      [userId, norm(document_type), norm(document_number), norm(address)]
    )
    res.json({ success: true, user: upd.rows[0] })
  } catch (e) {
    console.error('Error updating contract info:', e)
    res.status(500).json({ success: false, error: 'Failed to update contract info' })
  }
})

// Update an account's country + employer legal data (does not touch name/api_token)
router.put('/companies/:companyId/accounts/:companyToken/contract-info', requireAuth, requireRole(['super-admin', 'admin']), async (req, res) => {
  try {
    const { companyId, companyToken } = req.params
    const { country, contract_employer_info } = req.body || {}
    if (req.user.role === 'admin' && req.user.companyId !== companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const code = (country || DEFAULT_COUNTRY).toUpperCase()
    const config = getCountryConfig(code)
    if (!config) return res.status(400).json({ success: false, error: `Unknown country: ${country}` })

    const incoming = contract_employer_info && typeof contract_employer_info === 'object' ? contract_employer_info : {}
    const clean = {}
    for (const field of config.employerFields) {
      const v = incoming[field.key]
      if (v != null && String(v).trim() !== '') clean[field.key] = String(v).trim()
    }

    const upd = await pool.query(
      `UPDATE company_accounts
       SET country = $3, contract_employer_info = $4::jsonb
       WHERE company_id = $1 AND company_token = $2
       RETURNING company_id, company_token, account_name, country, contract_employer_info`,
      [companyId, companyToken, code, JSON.stringify(clean)]
    )
    if (upd.rowCount === 0) return res.status(404).json({ success: false, error: 'Account not found' })
    res.json({ success: true, data: upd.rows[0] })
  } catch (e) {
    console.error('Error updating account contract info:', e)
    res.status(500).json({ success: false, error: 'Failed to update account contract info' })
  }
})

// Generate a work contract PDF for an employee under a given account.
// `preview: true` (or ?preview=1) streams the PDF inline (Content-Disposition:
// inline) so the client can render it in a viewer before downloading.
router.post('/users/:userId/contract', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const {
      company_token, contract_type,
      start_date, end_date, hourly_rate, monthly_reference, area_servicio,
      position, monthly_salary, weekly_hours,
      preview,
    } = req.body || {}
    const isPreview = preview === true || preview === 'true' || req.query.preview === '1'

    if (!company_token) return res.status(400).json({ success: false, error: 'company_token is required' })

    // Load employee
    const uq = await pool.query(
      `SELECT id, name, company_id, document_type, document_number, address
       FROM users WHERE id = $1`,
      [userId]
    )
    if (uq.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
    const employee = uq.rows[0]

    // Admin scope: own company only
    if (req.user.role === 'admin' && employee.company_id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    // Load account (legal entity) and ensure it belongs to the employee's company
    const aq = await pool.query(
      `SELECT company_id, company_token, country, contract_employer_info
       FROM company_accounts WHERE company_token = $1`,
      [company_token]
    )
    if (aq.rowCount === 0) return res.status(404).json({ success: false, error: 'Account not found' })
    const account = aq.rows[0]
    if (!employee.company_id || account.company_id !== employee.company_id) {
      return res.status(400).json({ success: false, error: 'Account does not belong to the employee\'s company' })
    }
    if (req.user.role === 'admin' && account.company_id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const country = account.country || DEFAULT_COUNTRY
    const employer = account.contract_employer_info || {}
    const params = {
      start_date, end_date, hourly_rate, monthly_reference, area_servicio,
      position, monthly_salary, weekly_hours,
    }

    const validation = validateContractData({ country, contractType: contract_type, employer, employee, params })
    if (!validation.ok) {
      const status = (validation.reason === 'template_unavailable' || validation.reason === 'unknown_contract_type') ? 422 : 400
      return res.status(status).json({
        success: false,
        error: validation.reason || 'incomplete_contract_data',
        missing: validation.missing,
      })
    }

    const def = buildContractDefinition({ country, contractType: contract_type, employer, employee, params })

    // Preview: stream inline, persist nothing.
    if (isPreview) {
      const pdf = createPdf(def)
      const safe = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'contrato'
      const typeSlug = contract_type ? `${safe(contract_type)}-` : ''
      const filename = `contrato-${typeSlug}${safe(employee.name)}-${safe(company_token)}-${String(start_date).slice(0, 10)}.pdf`
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
      pdf.on('error', (err) => {
        console.error('PDF stream error:', err)
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Failed to render PDF' })
        else res.end()
      })
      pdf.pipe(res)
      pdf.end()
      return
    }

    // Persist: render the unsigned PDF to a buffer, snapshot employer/employee
    // data, and create a pending contract awaiting both signatures.
    const unsignedPdf = await createPdfBuffer(def)
    const unsignedHash = sha256Hex(unsignedPdf)
    const employeeSnapshot = {
      name: employee.name,
      document_type: employee.document_type,
      document_number: employee.document_number,
      address: employee.address,
    }
    const ins = await pool.query(
      `INSERT INTO contracts
         (user_id, company_id, company_token, country, contract_type, params,
          start_date, end_date, employer_snapshot, employee_snapshot,
          status, unsigned_pdf, unsigned_pdf_sha256, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10::jsonb,
               'pending', $11, $12, $13)
       RETURNING id, status, contract_type, start_date, end_date, created_at`,
      [
        userId, employee.company_id, company_token, country, contract_type || null,
        JSON.stringify(params),
        start_date || null, end_date || null,
        JSON.stringify(employer), JSON.stringify(employeeSnapshot),
        unsignedPdf, unsignedHash, req.user.userId,
      ]
    )
    res.json({ success: true, data: { ...ins.rows[0], status: contractStatusFor(ins.rows[0]) } })
  } catch (e) {
    console.error('Error generating contract:', e)
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Failed to generate contract' })
  }
})

// ====== CONTRACT RECORDS + SIGNING (admin) ======

// List an employee's contracts (no PDF bytes) with read-time status + which
// parties have signed.
router.get('/users/:userId/contracts', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const uq = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId])
    if (uq.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
    if (req.user.role === 'admin' && uq.rows[0].company_id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const cq = await pool.query(
      `SELECT c.id, c.company_token, c.country, c.contract_type, c.params,
              c.start_date, c.end_date, c.status, c.created_at,
              (c.signed_pdf IS NOT NULL) AS has_signed_pdf,
              COALESCE(json_agg(json_build_object('role', s.signer_role, 'signed_at', s.signed_at)
                       ) FILTER (WHERE s.id IS NOT NULL), '[]') AS signatures
       FROM contracts c
       LEFT JOIN contract_signatures s ON s.contract_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [userId]
    )
    const data = cq.rows.map((r) => {
      const sigRoles = (r.signatures || []).map((s) => s.role)
      const status = contractStatusFor(r, sigRoles)
      return {
        ...r,
        status,
        employer_signed: sigRoles.includes('employer'),
        worker_signed: sigRoles.includes('worker'),
        // Worker can only sign once the employer has (sequential signing).
        awaiting_worker: status === 'awaiting_worker',
        expiring_soon: status === 'active' && isExpiringSoon(r.end_date),
      }
    })
    res.json({ success: true, data, contractStatus: employeeContractStatus(cq.rows) })
  } catch (e) {
    console.error('Error listing contracts:', e)
    res.status(500).json({ success: false, error: 'Failed to list contracts' })
  }
})

// Stream a contract PDF. which=unsigned -> the original blank draft;
// otherwise the immutable signed PDF when complete, else the current signing
// state (base + signatures collected so far, e.g. the employer's).
router.get('/contracts/:id/pdf', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { id } = req.params
    const which = req.query.which === 'unsigned' ? 'unsigned' : 'signed'
    const q = await pool.query(
      `SELECT c.company_id, c.unsigned_pdf, c.signed_pdf FROM contracts c WHERE c.id = $1`,
      [id]
    )
    if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'Contract not found' })
    const row = q.rows[0]
    if (req.user.role === 'admin' && row.company_id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    let buf
    if (which === 'unsigned') buf = row.unsigned_pdf
    else buf = row.signed_pdf || await renderContractCurrentPdf(id)
    if (!buf) return res.status(404).json({ success: false, error: 'No PDF available' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="contrato-${id}.pdf"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(Buffer.from(buf))
  } catch (e) {
    console.error('Error streaming contract pdf:', e)
    res.status(500).json({ success: false, error: 'Failed to load contract PDF' })
  }
})

// Employer representative signs (admin / super-admin).
router.post('/contracts/:id/sign-employer', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { id } = req.params
    const { signature_png, signer_name } = req.body || {}
    const { buffer, error } = decodeSignaturePng(signature_png)
    if (error) return res.status(400).json({ success: false, error })

    const q = await pool.query(
      `SELECT company_id, status, unsigned_pdf_sha256, employer_snapshot FROM contracts WHERE id = $1`,
      [id]
    )
    if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'Contract not found' })
    const c = q.rows[0]
    if (req.user.role === 'admin' && c.company_id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    if (c.status === 'cancelled') return res.status(400).json({ success: false, error: 'Contract is cancelled' })

    const name = (signer_name && String(signer_name).trim()) || c.employer_snapshot?.rep_name || req.user.userName || null
    await pool.query(
      `INSERT INTO contract_signatures
         (contract_id, signer_role, signer_user_id, signer_name, signature_png, ip, user_agent, doc_sha256_at_signing)
       VALUES ($1, 'employer', $2, $3, $4, $5, $6, $7)
       ON CONFLICT (contract_id, signer_role) DO UPDATE SET
         signer_user_id = EXCLUDED.signer_user_id, signer_name = EXCLUDED.signer_name,
         signature_png = EXCLUDED.signature_png, signed_at = NOW(),
         ip = EXCLUDED.ip, user_agent = EXCLUDED.user_agent,
         doc_sha256_at_signing = EXCLUDED.doc_sha256_at_signing`,
      [id, req.user.userId, name, buffer, req.ip, req.get('user-agent') || null, c.unsigned_pdf_sha256]
    )
    const result = await renderSignedContractIfComplete(id)
    res.json({ success: true, data: { status: result.status, fully_signed: result.completed } })
  } catch (e) {
    console.error('Error signing contract (employer):', e)
    res.status(500).json({ success: false, error: 'Failed to sign contract' })
  }
})

// Cancel a contract.
router.post('/contracts/:id/cancel', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { id } = req.params
    const q = await pool.query('SELECT company_id FROM contracts WHERE id = $1', [id])
    if (q.rowCount === 0) return res.status(404).json({ success: false, error: 'Contract not found' })
    if (req.user.role === 'admin' && q.rows[0].company_id !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    await pool.query(`UPDATE contracts SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id])
    res.json({ success: true })
  } catch (e) {
    console.error('Error cancelling contract:', e)
    res.status(500).json({ success: false, error: 'Failed to cancel contract' })
  }
})

// Per-employee derived contract status for the user list badges/filter.
// Returns a map keyed by user_id; users absent from the map have no contract.
router.get('/contract-statuses', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const companyId = req.user.role === 'admin' ? req.user.companyId : (req.query.company_id || null)
    const params = []
    let scope = ''
    if (companyId) { params.push(companyId); scope = `AND u.company_id = $1` }
    // One row per contract with its signer roles; status (including the
    // pending -> awaiting_employer/awaiting_worker refinement and time-derived
    // expiry) is computed in JS via the shared helpers so every surface agrees.
    const q = await pool.query(
      `SELECT c.user_id, c.status, c.end_date,
              COALESCE(json_agg(s.signer_role) FILTER (WHERE s.id IS NOT NULL), '[]') AS signer_roles
       FROM users u
       JOIN contracts c ON c.user_id = u.id
       LEFT JOIN contract_signatures s ON s.contract_id = c.id
       WHERE u.role = 'employee' ${scope}
       GROUP BY c.id`,
      params
    )
    const byUser = new Map()
    for (const r of q.rows) {
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, [])
      byUser.get(r.user_id).push(r)
    }
    const map = {}
    for (const [userId, rows] of byUser) {
      map[userId] = employeeContractStatus(rows)
    }
    res.json({ success: true, data: map })
  } catch (e) {
    console.error('Error building contract statuses:', e)
    res.status(500).json({ success: false, error: 'Failed to build contract statuses' })
  }
})

// Count of this company's active employees without a valid (active) contract.
router.get('/contracts-summary', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const companyId = req.user.role === 'admin' ? req.user.companyId : (req.query.company_id || null)
    if (req.user.role === 'admin' && !companyId) {
      return res.status(403).json({ success: false, error: 'No company associated with this account' })
    }
    const params = []
    let scope = ''
    if (companyId) { params.push(companyId); scope = `AND u.company_id = $1` }
    const q = await pool.query(
      `SELECT u.id,
              COALESCE(bool_or(c.status = 'active' AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)), false) AS has_active
       FROM users u
       LEFT JOIN contracts c ON c.user_id = u.id
       WHERE u.role = 'employee' AND u.is_active = TRUE ${scope}
       GROUP BY u.id`,
      params
    )
    const total = q.rowCount
    const withoutActive = q.rows.filter((r) => !r.has_active).length
    res.json({ success: true, data: { totalEmployees: total, withoutActiveContract: withoutActive } })
  } catch (e) {
    console.error('Error building contracts summary:', e)
    res.status(500).json({ success: false, error: 'Failed to build contracts summary' })
  }
})

export default router;