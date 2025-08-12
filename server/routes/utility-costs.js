import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../database.js';

const router = Router();

// Helper function to validate cost data
function validateCostData(costs) {
  const allowedFields = [
    'rent_monthly', 'electricity_monthly', 'water_monthly', 'internet_monthly',
    'gas_monthly', 'insurance_monthly', 'maintenance_monthly', 'staff_monthly',
    'marketing_monthly', 'other_monthly'
  ];
  
  const errors = [];
  
  // Check for unknown fields
  const providedFields = Object.keys(costs);
  const unknownFields = providedFields.filter(field => !allowedFields.includes(field));
  if (unknownFields.length > 0) {
    errors.push(`Unknown fields: ${unknownFields.join(', ')}`);
  }
  
  // Validate numeric values
  for (const field of allowedFields) {
    if (costs[field] !== undefined) {
      const value = parseFloat(costs[field]);
      if (isNaN(value) || value < 0) {
        errors.push(`${field} must be a positive number`);
      }
    }
  }
  
  return errors;
}

// Get utility costs for all user's accounts
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('🚀 Getting utility costs for user:', req.user.userId);
    
    const query = `
      SELECT 
        id,
        company_token,
        account_name,
        rent_monthly,
        electricity_monthly,
        water_monthly,
        internet_monthly,
        gas_monthly,
        insurance_monthly,
        maintenance_monthly,
        staff_monthly,
        marketing_monthly,
        other_monthly,
        total_monthly,
        total_daily,
        created_at,
        updated_at
      FROM utility_costs 
      WHERE company_id = $1
      ORDER BY account_name
    `;
    
    const result = await pool.query(query, [req.user.companyId]);
    
    console.log(`📊 Found ${result.rows.length} utility cost records`);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Error getting utility costs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get utility costs for a specific account
router.get('/:companyToken', requireAuth, async (req, res) => {
  try {
    const { companyToken } = req.params;
    console.log(`🔍 Getting utility costs for account: ${companyToken}`);
    
    const query = `
      SELECT 
        id,
        company_token,
        account_name,
        rent_monthly,
        electricity_monthly,
        water_monthly,
        internet_monthly,
        gas_monthly,
        insurance_monthly,
        maintenance_monthly,
        staff_monthly,
        marketing_monthly,
        other_monthly,
        total_monthly,
        total_daily,
        created_at,
        updated_at
      FROM utility_costs 
      WHERE company_id = $1 AND company_token = $2
    `;
    
    const result = await pool.query(query, [req.user.companyId, companyToken]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utility costs not found for this account'
      });
    }
    
    console.log(`✅ Found utility costs for account: ${companyToken}`);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error getting utility costs for account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create or update utility costs for an account
router.post('/', requireAuth, async (req, res) => {
  try {
    const { company_token, account_name, ...costs } = req.body;
    
    console.log(`💾 Creating/updating utility costs for account: ${company_token}`);
    
    // Validate required fields
    if (!company_token || !account_name) {
      return res.status(400).json({
        success: false,
        error: 'company_token and account_name are required'
      });
    }
    
    // Validate cost data
    const validationErrors = validateCostData(costs);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }
    
    // Check if company_token belongs to user's company
    const q = await pool.query('SELECT company_id FROM company_accounts WHERE company_token = $1', [company_token])
    const companyId = q.rows[0]?.company_id || null
    const hasAccess = !!(req.user.companyId && companyId && req.user.companyId === companyId)
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this account'
      });
    }
    
    // Prepare the upsert query (company-level)
    const fields = Object.keys(costs);
    const values = Object.values(costs);
    const placeholders = values.map((_, index) => `$${index + 4}`).join(', ');
    const updateClauses = fields.map((field, index) => `${field} = $${index + 4}`).join(', ');
    
    const query = `
      INSERT INTO utility_costs (
        company_id, company_token, account_name, ${fields.join(', ')}
      ) VALUES (
        $1, $2, $3, ${placeholders}
      )
      ON CONFLICT (company_id, company_token) 
      DO UPDATE SET 
        account_name = $3,
        ${updateClauses},
        updated_at = CURRENT_TIMESTAMP
      RETURNING 
        id,
        company_token,
        account_name,
        rent_monthly,
        electricity_monthly,
        water_monthly,
        internet_monthly,
        gas_monthly,
        insurance_monthly,
        maintenance_monthly,
        staff_monthly,
        marketing_monthly,
        other_monthly,
        total_monthly,
        total_daily,
        created_at,
        updated_at
    `;
    
    const queryParams = [req.user.companyId, company_token, account_name, ...values];
    const result = await pool.query(query, queryParams);
    
    console.log(`✅ Successfully saved utility costs for account: ${company_token}`);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Utility costs saved successfully'
    });
    
  } catch (error) {
    console.error('❌ Error saving utility costs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete utility costs for an account
router.delete('/:companyToken', requireAuth, async (req, res) => {
  try {
    const { companyToken } = req.params;
    console.log(`🗑️ Deleting utility costs for account: ${companyToken}`);
    
    const query = `
      DELETE FROM utility_costs 
      WHERE company_id = $1 AND company_token = $2
      RETURNING company_token, account_name
    `;
    
    const result = await pool.query(query, [req.user.companyId, companyToken]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Utility costs not found for this account'
      });
    }
    
    console.log(`✅ Successfully deleted utility costs for account: ${companyToken}`);
    
    res.json({
      success: true,
      message: `Utility costs deleted for ${result.rows[0].account_name}`,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error deleting utility costs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;