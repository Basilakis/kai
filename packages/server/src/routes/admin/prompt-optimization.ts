import { Router } from 'express';
import { supabase } from '../../services/supabase';
import { isAdmin } from '../../middleware/auth';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validation';

const router = Router();

// Apply admin middleware to all routes
router.use(isAdmin);

// Schema for creating/updating optimization rules
const optimizationRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  ruleType: z.string().min(1).max(50),
  ruleParameters: z.record(z.any()).default({}),
  isActive: z.boolean().default(true)
});

// Get all optimization rules
router.get('/rules', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prompt_optimization_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching optimization rules:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get optimization rule by ID
router.get('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('prompt_optimization_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching optimization rule:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Create optimization rule
router.post('/rules', validateRequest(optimizationRuleSchema), async (req, res) => {
  try {
    const ruleData = req.body;

    const { data, error } = await supabase
      .from('prompt_optimization_rules')
      .insert({
        name: ruleData.name,
        description: ruleData.description,
        rule_type: ruleData.ruleType,
        rule_parameters: ruleData.ruleParameters,
        is_active: ruleData.isActive
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Error creating optimization rule:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update optimization rule
router.patch('/rules/:id', validateRequest(optimizationRuleSchema.partial()), async (req, res) => {
  try {
    const { id } = req.params;
    const ruleData = req.body;

    const updateData: any = {};
    if (ruleData.name !== undefined) updateData.name = ruleData.name;
    if (ruleData.description !== undefined) updateData.description = ruleData.description;
    if (ruleData.ruleType !== undefined) updateData.rule_type = ruleData.ruleType;
    if (ruleData.ruleParameters !== undefined) updateData.rule_parameters = ruleData.ruleParameters;
    if (ruleData.isActive !== undefined) updateData.is_active = ruleData.isActive;

    const { data, error } = await supabase
      .from('prompt_optimization_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating optimization rule:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Execute optimization rule
router.post('/rules/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the rule
    const { data: rule, error: ruleError } = await supabase
      .from('prompt_optimization_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (ruleError) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    if (!rule.is_active) {
      return res.status(400).json({ success: false, message: 'Cannot execute inactive rule' });
    }

    // Create a new action (this would normally trigger a background job for execution)
    const { data: newAction, error: newActionError } = await supabase
      .from('prompt_optimization_actions')
      .insert({
        rule_id: id,
        action_type: `execute_${rule.rule_type}`,
        action_parameters: rule.rule_parameters,
        status: 'pending'
      })
      .select()
      .single();

    if (newActionError) {
      return res.status(400).json({ success: false, message: newActionError.message });
    }

    // Update the rule's last_executed_at timestamp
    await supabase
      .from('prompt_optimization_rules')
      .update({ last_executed_at: new Date().toISOString() })
      .eq('id', id);

    // In a real implementation, you would trigger a background job here
    // For now, we'll just return success
    return res.json({ 
      success: true, 
      data: { 
        message: 'Rule execution started', 
        ruleId: id, 
        actionId: newAction.id
      } 
    });
  } catch (error) {
    console.error('Error executing optimization rule:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get rule actions
router.get('/rules/:id/actions', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('prompt_optimization_actions')
      .select('*')
      .eq('rule_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching rule actions:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get rule performance
router.get('/rules/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the rule
    const { data: rule, error: ruleError } = await supabase
      .from('prompt_optimization_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (ruleError) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    // Get all actions for this rule
    const { data: actions, error: actionsError } = await supabase
      .from('prompt_optimization_actions')
      .select('*')
      .eq('rule_id', id);

    if (actionsError) {
      return res.status(400).json({ success: false, message: actionsError.message });
    }

    // Calculate performance metrics
    const executionCount = actions.length;
    const successCount = actions.filter(a => a.status === 'completed').length;
    const failureCount = actions.filter(a => a.status === 'failed').length;
    
    // Calculate average execution time
    const executedActions = actions.filter(a => a.executed_at);
    let averageExecutionTime = null;
    if (executedActions.length > 0) {
      const executionTimes = executedActions.map(a => {
        const executedAt = new Date(a.executed_at);
        const createdAt = new Date(a.created_at);
        return (executedAt.getTime() - createdAt.getTime()) / 1000; // in seconds
      });
      averageExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executedActions.length;
    }

    // Get the last execution time
    const lastExecutedAt = rule.last_executed_at;

    // Count actions by status
    const actionsByStatus = actions.reduce((acc: Record<string, number>, action) => {
      acc[action.status] = (acc[action.status] || 0) + 1;
      return acc;
    }, {});

    // Generate execution history (mock data for now)
    const executionHistory = [];
    const today = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Generate random counts for demonstration
      const dailyExecutionCount = Math.floor(Math.random() * 5);
      const dailySuccessCount = Math.floor(Math.random() * dailyExecutionCount);
      const dailyFailureCount = dailyExecutionCount - dailySuccessCount;
      
      executionHistory.push({
        date: dateStr,
        executionCount: dailyExecutionCount,
        successCount: dailySuccessCount,
        failureCount: dailyFailureCount
      });
    }

    const performanceData = {
      executionCount,
      successCount,
      failureCount,
      averageExecutionTime,
      lastExecutionTime: lastExecutedAt,
      actionsByStatus,
      executionHistory
    };

    return res.json({ success: true, data: performanceData });
  } catch (error) {
    console.error('Error fetching rule performance:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all actions
router.get('/actions', async (req, res) => {
  try {
    const { ruleId, status } = req.query;

    let query = supabase
      .from('prompt_optimization_actions')
      .select('*');

    if (ruleId) {
      query = query.eq('rule_id', ruleId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching actions:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Execute action
router.post('/actions/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the action
    const { data: action, error: actionError } = await supabase
      .from('prompt_optimization_actions')
      .select('*')
      .eq('id', id)
      .single();

    if (actionError) {
      return res.status(404).json({ success: false, message: 'Action not found' });
    }

    if (action.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot execute action with status ${action.status}` });
    }

    // Update action status to executing
    await supabase
      .from('prompt_optimization_actions')
      .update({ status: 'executing' })
      .eq('id', id);

    // In a real implementation, you would trigger a background job here
    // For now, we'll just simulate execution and update the status to completed
    setTimeout(async () => {
      await supabase
        .from('prompt_optimization_actions')
        .update({ 
          status: 'completed', 
          executed_at: new Date().toISOString(),
          result: { message: 'Action executed successfully' }
        })
        .eq('id', id);
    }, 2000);

    return res.json({ 
      success: true, 
      data: { 
        message: 'Action execution started', 
        actionId: id
      } 
    });
  } catch (error) {
    console.error('Error executing action:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
