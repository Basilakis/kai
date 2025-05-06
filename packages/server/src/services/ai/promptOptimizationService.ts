/**
 * Prompt Optimization Service
 *
 * Provides automated optimization capabilities for prompts based on A/B testing and ML predictions.
 */

import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';
import { PromptMLService } from './promptMLService';
import { PromptStatisticalService } from './promptStatisticalService';
import { promptService, PromptData } from './promptService';

/**
 * Optimization rule data
 */
export interface OptimizationRuleData {
  id: string;
  name: string;
  description?: string;
  ruleType: string;
  ruleParameters: Record<string, any>;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Optimization action data
 */
export interface OptimizationActionData {
  id: string;
  ruleId: string;
  actionType: string;
  promptId?: string;
  experimentId?: string;
  segmentId?: string;
  actionParameters: Record<string, any>;
  status: string;
  result?: Record<string, any>;
  createdAt: Date;
  executedAt?: Date;
}

/**
 * Rule types
 */
export enum RuleType {
  LOW_SUCCESS_RATE = 'low_success_rate',
  CHAMPION_CHALLENGER = 'champion_challenger',
  SEGMENT_SPECIFIC = 'segment_specific',
  ML_SUGGESTION = 'ml_suggestion',
  SCHEDULED_EXPERIMENT = 'scheduled_experiment'
}

/**
 * Action types
 */
export enum ActionType {
  CREATE_EXPERIMENT = 'create_experiment',
  END_EXPERIMENT = 'end_experiment',
  PROMOTE_VARIANT = 'promote_variant',
  APPLY_SUGGESTION = 'apply_suggestion',
  CREATE_VARIANT = 'create_variant'
}

/**
 * Action status
 */
export enum ActionStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Prompt Optimization Service class
 */
export class PromptOptimizationService {
  private mlService: PromptMLService;
  private statisticalService: PromptStatisticalService;

  /**
   * Constructor
   */
  constructor() {
    logger.info('Initializing Prompt Optimization Service');
    this.mlService = new PromptMLService();
    this.statisticalService = new PromptStatisticalService();
  }

  /**
   * Get optimization rules
   * @param isActive Filter by active status
   * @returns Array of optimization rules
   */
  async getOptimizationRules(isActive?: boolean): Promise<OptimizationRuleData[]> {
    try {
      let query = supabaseClient.getClient()
        .from('prompt_optimization_rules')
        .select('*');

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get optimization rules: ${error.message}`);
      }

      return (data || []).map(this.mapRuleFromDb);
    } catch (error) {
      logger.error(`Failed to get optimization rules: ${error}`);
      throw error;
    }
  }

  /**
   * Create optimization rule
   * @param rule Rule data
   * @returns Created rule ID
   */
  async createOptimizationRule(
    rule: Omit<OptimizationRuleData, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('prompt_optimization_rules')
        .insert({
          name: rule.name,
          description: rule.description,
          rule_type: rule.ruleType,
          rule_parameters: rule.ruleParameters,
          is_active: rule.isActive,
          created_by: rule.createdBy
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create optimization rule: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      logger.error(`Failed to create optimization rule: ${error}`);
      throw error;
    }
  }

  /**
   * Get optimization actions
   * @param status Filter by status
   * @returns Array of optimization actions
   */
  async getOptimizationActions(status?: string): Promise<OptimizationActionData[]> {
    try {
      let query = supabaseClient.getClient()
        .from('prompt_optimization_actions')
        .select('*');

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get optimization actions: ${error.message}`);
      }

      return (data || []).map(this.mapActionFromDb);
    } catch (error) {
      logger.error(`Failed to get optimization actions: ${error}`);
      throw error;
    }
  }

  /**
   * Execute optimization rules
   * @returns Number of actions created
   */
  async executeOptimizationRules(): Promise<number> {
    try {
      // Get active rules
      const rules = await this.getOptimizationRules(true);

      let actionsCreated = 0;

      // Execute each rule
      for (const rule of rules) {
        try {
          const actions = await this.executeRule(rule);
          actionsCreated += actions.length;
        } catch (ruleError) {
          logger.error(`Failed to execute rule ${rule.id}: ${ruleError}`);
        }
      }

      return actionsCreated;
    } catch (error) {
      logger.error(`Failed to execute optimization rules: ${error}`);
      throw error;
    }
  }

  /**
   * Execute pending actions
   * @returns Number of actions executed
   */
  async executePendingActions(): Promise<number> {
    try {
      // Get pending actions
      const actions = await this.getOptimizationActions(ActionStatus.PENDING);

      let actionsExecuted = 0;

      // Execute each action
      for (const action of actions) {
        try {
          await this.executeAction(action);
          actionsExecuted++;
        } catch (actionError) {
          logger.error(`Failed to execute action ${action.id}: ${actionError}`);
        }
      }

      return actionsExecuted;
    } catch (error) {
      logger.error(`Failed to execute pending actions: ${error}`);
      throw error;
    }
  }

  /**
   * Execute rule
   * @param rule Rule to execute
   * @returns Created actions
   */
  private async executeRule(rule: OptimizationRuleData): Promise<OptimizationActionData[]> {
    const actions: OptimizationActionData[] = [];

    switch (rule.ruleType) {
      case RuleType.LOW_SUCCESS_RATE:
        actions.push(...await this.executeLowSuccessRateRule(rule));
        break;

      case RuleType.CHAMPION_CHALLENGER:
        actions.push(...await this.executeChampionChallengerRule(rule));
        break;

      case RuleType.SEGMENT_SPECIFIC:
        actions.push(...await this.executeSegmentSpecificRule(rule));
        break;

      case RuleType.ML_SUGGESTION:
        actions.push(...await this.executeMLSuggestionRule(rule));
        break;

      case RuleType.SCHEDULED_EXPERIMENT:
        actions.push(...await this.executeScheduledExperimentRule(rule));
        break;

      default:
        logger.warn(`Unknown rule type: ${rule.ruleType}`);
    }

    return actions;
  }

  /**
   * Execute low success rate rule
   * @param rule Rule to execute
   * @returns Created actions
   */
  private async executeLowSuccessRateRule(rule: OptimizationRuleData): Promise<OptimizationActionData[]> {
    const actions: OptimizationActionData[] = [];
    const threshold = rule.ruleParameters.threshold || 50;
    const lookbackDays = rule.ruleParameters.lookbackDays || 7;

    // Get prompts with low success rate
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);
    const endDate = new Date();

    // Query analytics for prompts with low success rate
    const { data, error } = await supabaseClient.getClient().rpc('get_low_success_rate_prompts', {
      threshold_param: threshold,
      start_date_param: startDate.toISOString().split('T')[0],
      end_date_param: endDate.toISOString().split('T')[0]
    });

    if (error) {
      throw new Error(`Failed to get low success rate prompts: ${error.message}`);
    }

    // Create actions for each prompt
    for (const prompt of data) {
      // Check if there's already an active experiment for this prompt
      const { data: experimentData, error: experimentError } = await supabaseClient.getClient()
        .from('prompt_ab_experiments')
        .select('id')
        .eq('is_active', true)
        .eq('prompt_ab_variants.prompt_id', prompt.prompt_id)
        .not('end_date', 'is', null);

      if (experimentError) {
        logger.error(`Failed to check for active experiments: ${experimentError.message}`);
        continue;
      }

      if (experimentData && experimentData.length > 0) {
        logger.info(`Skipping prompt ${prompt.prompt_id} as it already has an active experiment`);
        continue;
      }

      // Create an action to create an experiment
      const actionId = await this.createAction({
        ruleId: rule.id,
        actionType: ActionType.CREATE_EXPERIMENT,
        promptId: prompt.prompt_id,
        actionParameters: {
          experimentName: `Auto-Improvement for ${prompt.prompt_name || prompt.prompt_id}`,
          description: `Automatically created experiment for prompt with success rate ${prompt.success_rate}% (below threshold of ${threshold}%)`,
          trafficAllocation: 50,
          variants: [
            {
              promptId: prompt.prompt_id,
              variantName: 'Control',
              isControl: true,
              weight: 1
            }
          ]
        },
        status: ActionStatus.PENDING
      });

      // Get the action
      const { data: actionData, error: actionError } = await supabaseClient.getClient()
        .from('prompt_optimization_actions')
        .select('*')
        .eq('id', actionId)
        .single();

      if (actionError) {
        logger.error(`Failed to get created action: ${actionError.message}`);
        continue;
      }

      actions.push(this.mapActionFromDb(actionData));
    }

    return actions;
  }

  /**
   * Execute champion challenger rule
   * @param rule Rule to execute
   * @returns Created actions
   */
  private async executeChampionChallengerRule(rule: OptimizationRuleData): Promise<OptimizationActionData[]> {
    const actions: OptimizationActionData[] = [];
    const minDays = rule.ruleParameters.minDays || 7;
    const minSampleSize = rule.ruleParameters.minSampleSize || 100;
    const significanceLevel = rule.ruleParameters.significanceLevel || 0.05;

    // Get active experiments
    const { data: experimentsData, error: experimentsError } = await supabaseClient.getClient()
      .from('prompt_ab_experiments')
      .select('*')
      .eq('is_active', true)
      .is('end_date', null);

    if (experimentsError) {
      throw new Error(`Failed to get active experiments: ${experimentsError.message}`);
    }

    // Check each experiment
    for (const experiment of experimentsData) {
      // Check if experiment has run long enough
      const startDate = new Date(experiment.start_date);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff < minDays) {
        logger.info(`Skipping experiment ${experiment.id} as it has not run for ${minDays} days yet`);
        continue;
      }

      // Get statistical analysis for this experiment
      const analyses = await this.statisticalService.getStatisticalAnalyses(experiment.id);

      // Find the most recent z-test analysis
      const zTestAnalyses = analyses.filter(a => a.analysisType === 'z_test');

      if (zTestAnalyses.length === 0) {
        // No analysis yet, create one
        await this.statisticalService.analyzeExperiment(experiment.id, startDate, now);
        continue;
      }

      // Get the most recent analysis
      const latestAnalysis = zTestAnalyses.sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
      )[0];

      // Check if sample size is large enough
      if (latestAnalysis.sampleSize < minSampleSize) {
        logger.info(`Skipping experiment ${experiment.id} as sample size ${latestAnalysis.sampleSize} is below threshold ${minSampleSize}`);
        continue;
      }

      // Check if result is significant
      if (!latestAnalysis.isSignificant) {
        logger.info(`Skipping experiment ${experiment.id} as result is not statistically significant`);
        continue;
      }

      // Get the variant IDs
      const controlVariantId = latestAnalysis.analysisParameters.controlVariantId;
      const testVariantId = latestAnalysis.analysisParameters.testVariantId;

      // Check which variant performed better
      const controlProportion = latestAnalysis.result.controlProportion;
      const testProportion = latestAnalysis.result.testProportion;

      if (testProportion > controlProportion) {
        // Test variant is better, promote it
        const actionId = await this.createAction({
          ruleId: rule.id,
          actionType: ActionType.PROMOTE_VARIANT,
          experimentId: experiment.id,
          actionParameters: {
            variantId: testVariantId,
            analysis: latestAnalysis
          },
          status: ActionStatus.PENDING
        });

        // Get the action
        const { data: actionData, error: actionError } = await supabaseClient.getClient()
          .from('prompt_optimization_actions')
          .select('*')
          .eq('id', actionId)
          .single();

        if (actionError) {
          logger.error(`Failed to get created action: ${actionError.message}`);
          continue;
        }

        actions.push(this.mapActionFromDb(actionData));
      } else {
        // Control variant is better or equal, end the experiment
        const actionId = await this.createAction({
          ruleId: rule.id,
          actionType: ActionType.END_EXPERIMENT,
          experimentId: experiment.id,
          actionParameters: {
            analysis: latestAnalysis
          },
          status: ActionStatus.PENDING
        });

        // Get the action
        const { data: actionData, error: actionError } = await supabaseClient.getClient()
          .from('prompt_optimization_actions')
          .select('*')
          .eq('id', actionId)
          .single();

        if (actionError) {
          logger.error(`Failed to get created action: ${actionError.message}`);
          continue;
        }

        actions.push(this.mapActionFromDb(actionData));
      }
    }

    return actions;
  }

  /**
   * Execute segment specific rule
   * @param rule Rule to execute
   * @returns Created actions
   */
  private async executeSegmentSpecificRule(rule: OptimizationRuleData): Promise<OptimizationActionData[]> {
    // Implementation will be added in the next part
    return [];
  }

  /**
   * Execute ML suggestion rule
   * @param rule Rule to execute
   * @returns Created actions
   */
  private async executeMLSuggestionRule(rule: OptimizationRuleData): Promise<OptimizationActionData[]> {
    // Implementation will be added in the next part
    return [];
  }

  /**
   * Execute scheduled experiment rule
   * @param rule Rule to execute
   * @returns Created actions
   */
  private async executeScheduledExperimentRule(rule: OptimizationRuleData): Promise<OptimizationActionData[]> {
    // Implementation will be added in the next part
    return [];
  }

  /**
   * Execute action
   * @param action Action to execute
   * @returns Execution result
   */
  private async executeAction(action: OptimizationActionData): Promise<Record<string, any>> {
    // Update action status to executing
    await this.updateActionStatus(action.id, ActionStatus.EXECUTING);

    try {
      let result: Record<string, any>;

      switch (action.actionType) {
        case ActionType.CREATE_EXPERIMENT:
          result = await this.executeCreateExperiment(action);
          break;

        case ActionType.END_EXPERIMENT:
          result = await this.executeEndExperiment(action);
          break;

        case ActionType.PROMOTE_VARIANT:
          result = await this.executePromoteVariant(action);
          break;

        case ActionType.APPLY_SUGGESTION:
          result = await this.executeApplySuggestion(action);
          break;

        case ActionType.CREATE_VARIANT:
          result = await this.executeCreateVariant(action);
          break;

        default:
          throw new Error(`Unknown action type: ${action.actionType}`);
      }

      // Update action status to completed
      await this.updateActionStatus(action.id, ActionStatus.COMPLETED, result);

      return result;
    } catch (error) {
      // Update action status to failed
      await this.updateActionStatus(action.id, ActionStatus.FAILED, { error: String(error) });
      throw error;
    }
  }

  /**
   * Execute create experiment action
   * @param action Action to execute
   * @returns Execution result
   */
  private async executeCreateExperiment(action: OptimizationActionData): Promise<Record<string, any>> {
    if (!action.promptId) {
      throw new Error('Prompt ID is required');
    }

    // Get the prompt
    const prompt = await promptService.getPromptById(action.promptId);

    // Get ML suggestions for the prompt
    const suggestions = await this.mlService.generateImprovementSuggestions(
      prompt.id,
      prompt.content,
      prompt.promptType
    );

    // Create variants based on suggestions
    const variants = action.actionParameters.variants || [];

    // Add variants based on suggestions
    for (let i = 0; i < Math.min(suggestions.length, 2); i++) {
      const suggestion = suggestions[i];

      // Apply the suggestion to create a new variant
      const updatedContent = await this.mlService.applySuggestion(suggestion.id);

      // Create a new prompt for the variant
      const variantPromptId = await promptService.createPrompt({
        name: `${prompt.name} - Variant ${i + 1}`,
        description: `Auto-generated variant based on suggestion: ${suggestion.suggestion}`,
        promptType: prompt.promptType,
        content: updatedContent,
        isActive: true,
        isSystem: true
      });

      // Add the variant to the experiment
      variants.push({
        promptId: variantPromptId,
        variantName: `Variant ${i + 1}`,
        isControl: false,
        weight: 1
      });
    }

    // Create the experiment
    const experimentId = await promptService.createABExperiment({
      name: action.actionParameters.experimentName || `Auto-Improvement for ${prompt.name}`,
      description: action.actionParameters.description || 'Automatically created experiment',
      startDate: new Date(),
      isActive: true,
      trafficAllocation: action.actionParameters.trafficAllocation || 50,
      variants
    });

    return {
      experimentId,
      variantCount: variants.length
    };
  }

  /**
   * Execute end experiment action
   * @param action Action to execute
   * @returns Execution result
   */
  private async executeEndExperiment(action: OptimizationActionData): Promise<Record<string, any>> {
    if (!action.experimentId) {
      throw new Error('Experiment ID is required');
    }

    // End the experiment
    const success = await promptService.updateABExperiment(action.experimentId, {
      isActive: false,
      endDate: new Date()
    });

    return {
      success,
      experimentId: action.experimentId
    };
  }

  /**
   * Execute promote variant action
   * @param action Action to execute
   * @returns Execution result
   */
  private async executePromoteVariant(action: OptimizationActionData): Promise<Record<string, any>> {
    if (!action.experimentId) {
      throw new Error('Experiment ID is required');
    }

    const variantId = action.actionParameters.variantId;
    if (!variantId) {
      throw new Error('Variant ID is required');
    }

    // Get the experiment
    const experiment = await promptService.getABExperimentById(action.experimentId);

    // Find the variant
    const variant = experiment.variants?.find(v => v.id === variantId);
    if (!variant) {
      throw new Error(`Variant ${variantId} not found in experiment ${action.experimentId}`);
    }

    // Find the control variant
    const controlVariant = experiment.variants?.find(v => v.isControl);
    if (!controlVariant) {
      throw new Error(`Control variant not found in experiment ${action.experimentId}`);
    }

    // Get the prompts
    const variantPrompt = await promptService.getPromptById(variant.promptId);
    const controlPrompt = await promptService.getPromptById(controlVariant.promptId);

    // Update the control prompt with the variant content
    const { error } = await supabaseClient.getClient()
      .from('system_prompts')
      .update({
        content: variantPrompt.content,
        updated_at: new Date()
      })
      .eq('id', controlPrompt.id);

    if (error) {
      throw new Error(`Failed to update control prompt: ${error.message}`);
    }

    // End the experiment
    const success = await promptService.updateABExperiment(action.experimentId, {
      isActive: false,
      endDate: new Date()
    });

    return {
      success,
      experimentId: action.experimentId,
      variantId,
      controlPromptId: controlPrompt.id
    };
  }

  /**
   * Execute apply suggestion action
   * @param action Action to execute
   * @returns Execution result
   */
  private async executeApplySuggestion(action: OptimizationActionData): Promise<Record<string, any>> {
    const suggestionId = action.actionParameters.suggestionId;
    if (!suggestionId) {
      throw new Error('Suggestion ID is required');
    }

    // Apply the suggestion
    const updatedContent = await this.mlService.applyImprovementSuggestion(suggestionId);

    return {
      success: true,
      suggestionId,
      updatedContent
    };
  }

  /**
   * Execute create variant action
   * @param action Action to execute
   * @returns Execution result
   */
  private async executeCreateVariant(action: OptimizationActionData): Promise<Record<string, any>> {
    if (!action.promptId) {
      throw new Error('Prompt ID is required');
    }

    // Get the prompt
    const prompt = await promptService.getPromptById(action.promptId);

    // Create a new prompt for the variant
    const variantContent = action.actionParameters.content || prompt.content;
    const variantPromptId = await promptService.createPrompt({
      name: action.actionParameters.name || `${prompt.name} - Variant`,
      description: action.actionParameters.description || 'Auto-generated variant',
      promptType: prompt.promptType,
      content: variantContent,
      isActive: true,
      isSystem: true
    });

    return {
      success: true,
      promptId: action.promptId,
      variantPromptId
    };
  }

  /**
   * Create action
   * @param action Action data
   * @returns Created action ID
   */
  private async createAction(
    action: Omit<OptimizationActionData, 'id' | 'createdAt' | 'executedAt'>
  ): Promise<string> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('prompt_optimization_actions')
        .insert({
          rule_id: action.ruleId,
          action_type: action.actionType,
          prompt_id: action.promptId,
          experiment_id: action.experimentId,
          segment_id: action.segmentId,
          action_parameters: action.actionParameters,
          status: action.status
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create action: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      logger.error(`Failed to create action: ${error}`);
      throw error;
    }
  }

  /**
   * Update action status
   * @param actionId Action ID
   * @param status New status
   * @param result Optional result
   * @returns Success indicator
   */
  private async updateActionStatus(
    actionId: string,
    status: string,
    result?: Record<string, any>
  ): Promise<boolean> {
    try {
      const updateData: Record<string, any> = { status };

      if (result) {
        updateData.result = result;
      }

      if (status === ActionStatus.COMPLETED || status === ActionStatus.FAILED) {
        updateData.executed_at = new Date();
      }

      const { error } = await supabaseClient.getClient()
        .from('prompt_optimization_actions')
        .update(updateData)
        .eq('id', actionId);

      if (error) {
        throw new Error(`Failed to update action status: ${error.message}`);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to update action status: ${error}`);
      throw error;
    }
  }

  /**
   * Map database rule to OptimizationRuleData
   * @param dbRule Database rule
   * @returns Mapped rule data
   */
  private mapRuleFromDb(dbRule: any): OptimizationRuleData {
    return {
      id: dbRule.id,
      name: dbRule.name,
      description: dbRule.description,
      ruleType: dbRule.rule_type,
      ruleParameters: dbRule.rule_parameters,
      isActive: dbRule.is_active,
      createdBy: dbRule.created_by,
      createdAt: new Date(dbRule.created_at),
      updatedAt: new Date(dbRule.updated_at)
    };
  }

  /**
   * Map database action to OptimizationActionData
   * @param dbAction Database action
   * @returns Mapped action data
   */
  private mapActionFromDb(dbAction: any): OptimizationActionData {
    return {
      id: dbAction.id,
      ruleId: dbAction.rule_id,
      actionType: dbAction.action_type,
      promptId: dbAction.prompt_id,
      experimentId: dbAction.experiment_id,
      segmentId: dbAction.segment_id,
      actionParameters: dbAction.action_parameters,
      status: dbAction.status,
      result: dbAction.result,
      createdAt: new Date(dbAction.created_at),
      executedAt: dbAction.executed_at ? new Date(dbAction.executed_at) : undefined
    };
  }
}
