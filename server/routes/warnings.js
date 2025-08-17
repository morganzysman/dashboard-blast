import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Warning categories and motives definition
const WARNING_CATEGORIES = {
  'attendance': {
    name: 'Attendance Issues',
    motives: [
      'Late arrival to work',
      'Early departure without permission', 
      'Unexcused absence',
      'No-show without notice',
      'Excessive break time'
    ]
  },
  'conduct': {
    name: 'Professional Conduct',
    motives: [
      'Inappropriate language or behavior',
      'Lack of respect to colleagues/customers',
      'Unprofessional appearance/uniform violations',
      'Insubordination',
      'Failure to follow company policies'
    ]
  },
  'performance': {
    name: 'Work Performance', 
    motives: [
      'Poor food safety practices',
      'Inadequate hygiene standards',
      'Failure to complete assigned tasks',
      'Poor customer service',
      'Cash handling errors'
    ]
  },
  'teamwork': {
    name: 'Team Collaboration',
    motives: [
      'Disruptive behavior',
      'Failure to communicate effectively',
      'Not following chain of command',
      'Creating workplace conflicts'
    ]
  },
  'equipment': {
    name: 'Technology/Equipment',
    motives: [
      'Misuse of POS system',
      'Damage to equipment (if negligent)',
      'Improper use of company devices'
    ]
  }
};

// GET /api/warnings/categories - Get warning categories and motives
router.get('/categories', requireAuth, (req, res) => {
  try {
    res.json({
      success: true,
      categories: WARNING_CATEGORIES
    });
  } catch (error) {
    console.error('Error fetching warning categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch warning categories'
    });
  }
});

// GET /api/warnings - Get warnings (employees see their own, admins see all for company)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { db } = req.app.locals;
    const userId = req.user.userId;
    const userRole = req.user.userRole;
    const companyId = req.user.companyId;
    
    let query;
    let params;
    
    if (userRole === 'admin' || userRole === 'super_admin') {
      // Admins can see all warnings for their company
      const { employee_id } = req.query;
      
      if (employee_id) {
        // Get warnings for specific employee
        query = `
          SELECT 
            ew.*,
            emp.name as employee_name,
            emp.email as employee_email,
            admin.name as issued_by_name
          FROM employee_warnings ew
          JOIN users emp ON ew.employee_id = emp.id
          JOIN users admin ON ew.issued_by = admin.id
          WHERE ew.company_id = $1 AND ew.employee_id = $2
          ORDER BY ew.issued_at DESC
        `;
        params = [companyId, employee_id];
      } else {
        // Get all warnings for company
        query = `
          SELECT 
            ew.*,
            emp.name as employee_name,
            emp.email as employee_email,
            admin.name as issued_by_name
          FROM employee_warnings ew
          JOIN users emp ON ew.employee_id = emp.id
          JOIN users admin ON ew.issued_by = admin.id
          WHERE ew.company_id = $1
          ORDER BY ew.issued_at DESC
        `;
        params = [companyId];
      }
    } else {
      // Employees can only see their own warnings
      query = `
        SELECT 
          ew.*,
          admin.name as issued_by_name
        FROM employee_warnings ew
        JOIN users admin ON ew.issued_by = admin.id
        WHERE ew.employee_id = $1 AND ew.company_id = $2
        ORDER BY ew.issued_at DESC
      `;
      params = [userId, companyId];
    }
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      warnings: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching warnings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch warnings'
    });
  }
});

// POST /api/warnings - Create new warning (admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { db } = req.app.locals;
    const issuedBy = req.user.userId;
    const companyId = req.user.companyId;
    
    const {
      employee_id,
      warning_category,
      warning_motive,
      description,
      severity_level = 'low'
    } = req.body;
    
    // Validate required fields
    if (!employee_id || !warning_category || !warning_motive) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID, warning category, and motive are required'
      });
    }
    
    // Validate category exists
    if (!WARNING_CATEGORIES[warning_category]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid warning category'
      });
    }
    
    // Validate motive exists in category
    if (!WARNING_CATEGORIES[warning_category].motives.includes(warning_motive)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid warning motive for the selected category'
      });
    }
    
    // Validate severity level
    const validSeverityLevels = ['low', 'medium', 'high', 'critical'];
    if (!validSeverityLevels.includes(severity_level)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid severity level'
      });
    }
    
    // Verify employee exists and belongs to the same company
    const employeeCheck = await db.query(
      'SELECT id, name FROM users WHERE id = $1 AND company_id = $2',
      [employee_id, companyId]
    );
    
    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found or not in your company'
      });
    }
    
    // Insert the warning
    const insertQuery = `
      INSERT INTO employee_warnings (
        employee_id, issued_by, company_id, warning_category, 
        warning_motive, description, severity_level
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await db.query(insertQuery, [
      employee_id, issuedBy, companyId, warning_category,
      warning_motive, description, severity_level
    ]);
    
    const warning = result.rows[0];
    
    // Get full warning details for response
    const fullWarningQuery = `
      SELECT 
        ew.*,
        emp.name as employee_name,
        emp.email as employee_email,
        admin.name as issued_by_name
      FROM employee_warnings ew
      JOIN users emp ON ew.employee_id = emp.id
      JOIN users admin ON ew.issued_by = admin.id
      WHERE ew.id = $1
    `;
    
    const fullWarningResult = await db.query(fullWarningQuery, [warning.id]);
    
    res.status(201).json({
      success: true,
      warning: fullWarningResult.rows[0],
      message: 'Warning created successfully'
    });
    
  } catch (error) {
    console.error('Error creating warning:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create warning'
    });
  }
});

// PUT /api/warnings/:id/acknowledge - Employee acknowledges a warning
router.put('/:id/acknowledge', requireAuth, async (req, res) => {
  try {
    const { db } = req.app.locals;
    const warningId = req.params.id;
    const userId = req.user.userId;
    const companyId = req.user.companyId;
    
    // Verify the warning belongs to the current user
    const warningCheck = await db.query(
      'SELECT id, employee_id, acknowledged_at FROM employee_warnings WHERE id = $1 AND employee_id = $2 AND company_id = $3',
      [warningId, userId, companyId]
    );
    
    if (warningCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warning not found'
      });
    }
    
    const warning = warningCheck.rows[0];
    
    if (warning.acknowledged_at) {
      return res.status(400).json({
        success: false,
        error: 'Warning already acknowledged'
      });
    }
    
    // Update the warning with acknowledgment
    const updateQuery = `
      UPDATE employee_warnings 
      SET acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by = $1
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await db.query(updateQuery, [userId, warningId]);
    
    res.json({
      success: true,
      warning: result.rows[0],
      message: 'Warning acknowledged successfully'
    });
    
  } catch (error) {
    console.error('Error acknowledging warning:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge warning'
    });
  }
});

// PUT /api/warnings/:id - Update warning (admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { db } = req.app.locals;
    const warningId = req.params.id;
    const companyId = req.user.companyId;
    
    const {
      warning_category,
      warning_motive,
      description,
      severity_level,
      status
    } = req.body;
    
    // Verify warning exists and belongs to company
    const warningCheck = await db.query(
      'SELECT id FROM employee_warnings WHERE id = $1 AND company_id = $2',
      [warningId, companyId]
    );
    
    if (warningCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warning not found'
      });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (warning_category !== undefined) {
      if (!WARNING_CATEGORIES[warning_category]) {
        return res.status(400).json({
          success: false,
          error: 'Invalid warning category'
        });
      }
      updates.push(`warning_category = $${paramCount++}`);
      values.push(warning_category);
    }
    
    if (warning_motive !== undefined) {
      updates.push(`warning_motive = $${paramCount++}`);
      values.push(warning_motive);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    
    if (severity_level !== undefined) {
      const validSeverityLevels = ['low', 'medium', 'high', 'critical'];
      if (!validSeverityLevels.includes(severity_level)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid severity level'
        });
      }
      updates.push(`severity_level = $${paramCount++}`);
      values.push(severity_level);
    }
    
    if (status !== undefined) {
      const validStatuses = ['active', 'resolved', 'disputed', 'expired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status'
        });
      }
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }
    
    values.push(warningId);
    
    const updateQuery = `
      UPDATE employee_warnings 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await db.query(updateQuery, values);
    
    res.json({
      success: true,
      warning: result.rows[0],
      message: 'Warning updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating warning:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update warning'
    });
  }
});

// DELETE /api/warnings/:id - Delete warning (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { db } = req.app.locals;
    const warningId = req.params.id;
    const companyId = req.user.companyId;
    
    // Verify warning exists and belongs to company
    const warningCheck = await db.query(
      'SELECT id FROM employee_warnings WHERE id = $1 AND company_id = $2',
      [warningId, companyId]
    );
    
    if (warningCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warning not found'
      });
    }
    
    // Delete the warning
    await db.query('DELETE FROM employee_warnings WHERE id = $1', [warningId]);
    
    res.json({
      success: true,
      message: 'Warning deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting warning:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete warning'
    });
  }
});

// GET /api/warnings/stats - Get warning statistics (admin only)
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { db } = req.app.locals;
    const companyId = req.user.companyId;
    
    // Get warning stats by category
    const categoryStatsQuery = `
      SELECT 
        warning_category,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
      FROM employee_warnings 
      WHERE company_id = $1 
      GROUP BY warning_category
      ORDER BY count DESC
    `;
    
    const categoryStats = await db.query(categoryStatsQuery, [companyId]);
    
    // Get warning stats by severity
    const severityStatsQuery = `
      SELECT 
        severity_level,
        COUNT(*) as count
      FROM employee_warnings 
      WHERE company_id = $1 AND status = 'active'
      GROUP BY severity_level
      ORDER BY 
        CASE severity_level 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END
    `;
    
    const severityStats = await db.query(severityStatsQuery, [companyId]);
    
    // Get recent warnings
    const recentWarningsQuery = `
      SELECT 
        ew.*,
        emp.name as employee_name,
        admin.name as issued_by_name
      FROM employee_warnings ew
      JOIN users emp ON ew.employee_id = emp.id
      JOIN users admin ON ew.issued_by = admin.id
      WHERE ew.company_id = $1
      ORDER BY ew.issued_at DESC
      LIMIT 10
    `;
    
    const recentWarnings = await db.query(recentWarningsQuery, [companyId]);
    
    res.json({
      success: true,
      stats: {
        by_category: categoryStats.rows,
        by_severity: severityStats.rows,
        recent_warnings: recentWarnings.rows
      }
    });
    
  } catch (error) {
    console.error('Error fetching warning stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch warning statistics'
    });
  }
});

export default router;
