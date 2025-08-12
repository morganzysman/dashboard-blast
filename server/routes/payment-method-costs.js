import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../database.js';

const router = Router();

// Helper function to validate cost data
function validatePaymentMethodCostData(data) {
  const errors = [];
  
  if (!data.company_token) {
    errors.push('company_token is required');
  }
  
  if (!data.payment_method_code) {
    errors.push('payment_method_code is required');
  }
  
  if (data.cost_percentage !== undefined) {
    const percentage = parseFloat(data.cost_percentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      errors.push('cost_percentage must be between 0 and 100');
    }
  }
  
  if (data.fixed_cost !== undefined) {
    const fixedCost = parseFloat(data.fixed_cost);
    if (isNaN(fixedCost) || fixedCost < 0) {
      errors.push('fixed_cost must be a positive number');
    }
  }
  
  return errors;
}

// Get payment method costs for all user's accounts
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('🚀 Getting payment method costs for user:', req.user.userId);
    
    const query = `
      SELECT 
        id,
        company_token,
        payment_method_code,
        cost_percentage,
        fixed_cost,
        created_at,
        updated_at
      FROM payment_method_costs 
      WHERE company_id = $1
      ORDER BY company_token, payment_method_code
    `;
    
    const result = await pool.query(query, [req.user.companyId]);
    
    console.log(`📊 Found ${result.rows.length} payment method cost records`);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Error getting payment method costs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get payment method costs for a specific account
router.get('/:companyToken', requireAuth, async (req, res) => {
  try {
    const { companyToken } = req.params;
    console.log(`🔍 Getting payment method costs for account: ${companyToken}`);
    
    const query = `
      SELECT 
        id,
        company_token,
        payment_method_code,
        cost_percentage,
        fixed_cost,
        created_at,
        updated_at
      FROM payment_method_costs 
      WHERE company_id = $1 AND company_token = $2
      ORDER BY payment_method_code
    `;
    
    const result = await pool.query(query, [req.user.companyId, companyToken]);
    
    console.log(`✅ Found ${result.rows.length} payment method costs for account: ${companyToken}`);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('❌ Error getting payment method costs for account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create or update payment method costs for an account
router.post('/', requireAuth, async (req, res) => {
  try {
    const { company_token, payment_method_code, cost_percentage, fixed_cost } = req.body;
    
    console.log(`💾 Creating/updating payment method cost: ${company_token} - ${payment_method_code}`);
    
    // Validate required fields and data
    const validationErrors = validatePaymentMethodCostData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }
    
    // Check if user has access to this account
    // Company-based access
    const q = await pool.query('SELECT company_id FROM company_accounts WHERE company_token = $1', [company_token])
    const companyId = q.rows[0]?.company_id || null
    const hasAccess = !!(req.user.companyId && companyId && req.user.companyId === companyId)
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this account'
      });
    }
    
    const query = `
      INSERT INTO payment_method_costs (
        company_id, company_token, payment_method_code, cost_percentage, fixed_cost
      ) VALUES (
        $1, $2, $3, $4, $5
      )
      ON CONFLICT (company_id, company_token, payment_method_code) 
      DO UPDATE SET 
        cost_percentage = $4,
        fixed_cost = $5,
        updated_at = CURRENT_TIMESTAMP
      RETURNING 
        id,
        company_token,
        payment_method_code,
        cost_percentage,
        fixed_cost,
        created_at,
        updated_at
    `;
    
    const queryParams = [
      req.user.companyId, 
      company_token, 
      payment_method_code, 
      cost_percentage || 0, 
      fixed_cost || 0
    ];
    
    const result = await pool.query(query, queryParams);
    
    console.log(`✅ Successfully saved payment method cost: ${company_token} - ${payment_method_code}`);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Payment method cost saved successfully'
    });
    
  } catch (error) {
    console.error('❌ Error saving payment method cost:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk update payment method costs for an account
router.post('/bulk/:companyToken', requireAuth, async (req, res) => {
  try {
    const { companyToken } = req.params;
    const { costs } = req.body; // Array of { payment_method_code, cost_percentage, fixed_cost }
    
    console.log(`💾 Bulk updating payment method costs for account: ${companyToken}`);
    
    if (!Array.isArray(costs)) {
      return res.status(400).json({
        success: false,
        error: 'costs must be an array'
      });
    }
    
    // Check if user has access to this account
    const q = await pool.query('SELECT company_id FROM company_accounts WHERE company_token = $1', [companyToken])
    const companyId = q.rows[0]?.company_id || null
    const hasAccess = !!(req.user.companyId && companyId && req.user.companyId === companyId)
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this account'
      });
    }
    
    // Validate all costs
    for (const cost of costs) {
      const validationErrors = validatePaymentMethodCostData({
        company_token: companyToken,
        ...cost
      });
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Validation failed for ${cost.payment_method_code}`,
          details: validationErrors
        });
      }
    }
    
    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const results = [];
      
      for (const cost of costs) {
        const query = `
          INSERT INTO payment_method_costs (
            company_id, company_token, payment_method_code, cost_percentage, fixed_cost
          ) VALUES (
            $1, $2, $3, $4, $5
          )
          ON CONFLICT (company_id, company_token, payment_method_code) 
          DO UPDATE SET 
            cost_percentage = $4,
            fixed_cost = $5,
            updated_at = CURRENT_TIMESTAMP
          RETURNING 
            id,
            company_token,
            payment_method_code,
            cost_percentage,
            fixed_cost,
            created_at,
            updated_at
        `;
        
        const queryParams = [
          req.user.companyId, 
          companyToken, 
          cost.payment_method_code, 
          cost.cost_percentage || 0, 
          cost.fixed_cost || 0
        ];
        
        const result = await client.query(query, queryParams);
        results.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      
      console.log(`✅ Successfully bulk updated ${results.length} payment method costs for account: ${companyToken}`);
      
      res.json({
        success: true,
        data: results,
        message: `Successfully updated ${results.length} payment method costs`
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Error bulk updating payment method costs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete payment method cost
router.delete('/:companyToken/:paymentMethodCode', requireAuth, async (req, res) => {
  try {
    const { companyToken, paymentMethodCode } = req.params;
    console.log(`🗑️ Deleting payment method cost: ${companyToken} - ${paymentMethodCode}`);
    
    const query = `
      DELETE FROM payment_method_costs 
      WHERE company_id = $1 AND company_token = $2 AND payment_method_code = $3
      RETURNING company_token, payment_method_code
    `;
    
    const result = await pool.query(query, [req.user.companyId, companyToken, paymentMethodCode]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment method cost not found'
      });
    }
    
    console.log(`✅ Successfully deleted payment method cost: ${companyToken} - ${paymentMethodCode}`);
    
    res.json({
      success: true,
      message: `Payment method cost deleted for ${paymentMethodCode}`,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error deleting payment method cost:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;