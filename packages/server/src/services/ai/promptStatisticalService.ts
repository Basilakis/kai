/**
 * Prompt Statistical Service
 * 
 * Provides statistical analysis capabilities for prompt A/B testing and optimization.
 */

import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';
import { jStat } from 'jstat';

/**
 * Statistical analysis data
 */
export interface StatisticalAnalysisData {
  id: string;
  experimentId?: string;
  segmentId?: string;
  promptId?: string;
  analysisType: string;
  analysisParameters: Record<string, any>;
  result: Record<string, any>;
  pValue?: number;
  confidenceIntervalLower?: number;
  confidenceIntervalUpper?: number;
  isSignificant?: boolean;
  sampleSize: number;
  createdAt: Date;
}

/**
 * Analysis result
 */
export interface AnalysisResult {
  analysisType: string;
  result: Record<string, any>;
  pValue?: number;
  confidenceIntervalLower?: number;
  confidenceIntervalUpper?: number;
  isSignificant?: boolean;
  sampleSize: number;
}

/**
 * Prompt Statistical Service class
 */
export class PromptStatisticalService {
  /**
   * Constructor
   */
  constructor() {
    logger.info('Initializing Prompt Statistical Service');
  }
  
  /**
   * Get statistical analyses
   * @param experimentId Optional experiment ID
   * @param segmentId Optional segment ID
   * @param promptId Optional prompt ID
   * @returns Array of statistical analyses
   */
  async getStatisticalAnalyses(
    experimentId?: string,
    segmentId?: string,
    promptId?: string
  ): Promise<StatisticalAnalysisData[]> {
    try {
      let query = supabaseClient.getClient()
        .from('prompt_statistical_analysis')
        .select('*');
      
      if (experimentId) {
        query = query.eq('experiment_id', experimentId);
      }
      
      if (segmentId) {
        query = query.eq('segment_id', segmentId);
      }
      
      if (promptId) {
        query = query.eq('prompt_id', promptId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Failed to get statistical analyses: ${error.message}`);
      }
      
      return (data || []).map(this.mapAnalysisFromDb);
    } catch (error) {
      logger.error(`Failed to get statistical analyses: ${error}`);
      throw error;
    }
  }
  
  /**
   * Analyze A/B test experiment
   * @param experimentId Experiment ID
   * @param startDate Start date
   * @param endDate End date
   * @returns Analysis results
   */
  async analyzeExperiment(
    experimentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AnalysisResult[]> {
    try {
      // Get the experiment
      const { data: experimentData, error: experimentError } = await supabaseClient.getClient()
        .from('prompt_ab_experiments')
        .select(`
          *,
          prompt_ab_variants (
            id,
            prompt_id,
            variant_name,
            is_control
          )
        `)
        .eq('id', experimentId)
        .single();
      
      if (experimentError) {
        throw new Error(`Failed to get experiment: ${experimentError.message}`);
      }
      
      // Get success data for each variant
      const variants = experimentData.prompt_ab_variants;
      const variantData: Record<string, { successes: number[]; failures: number[] }> = {};
      
      for (const variant of variants) {
        // Get analytics for this variant
        const { data: analyticsData, error: analyticsError } = await supabaseClient.getClient()
          .from('prompt_usage_analytics')
          .select('successful_uses, failed_uses')
          .eq('experiment_id', experimentId)
          .eq('variant_id', variant.id)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);
        
        if (analyticsError) {
          throw new Error(`Failed to get analytics for variant ${variant.id}: ${analyticsError.message}`);
        }
        
        // Extract success/failure data
        const successes = analyticsData.map(a => a.successful_uses);
        const failures = analyticsData.map(a => a.failed_uses);
        
        variantData[variant.id] = { successes, failures };
      }
      
      // Perform statistical analyses
      const results: AnalysisResult[] = [];
      
      // Find control variant
      const controlVariant = variants.find(v => v.is_control);
      if (!controlVariant) {
        throw new Error('No control variant found');
      }
      
      // Compare each test variant to control
      for (const variant of variants) {
        if (variant.id === controlVariant.id) continue;
        
        // Perform z-test for proportions
        const zTestResult = this.performZTest(
          variantData[controlVariant.id],
          variantData[variant.id]
        );
        
        // Save the analysis
        const analysisId = await this.saveAnalysis({
          experimentId,
          analysisType: 'z_test',
          analysisParameters: {
            controlVariantId: controlVariant.id,
            testVariantId: variant.id,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          },
          result: zTestResult.result,
          pValue: zTestResult.pValue,
          confidenceIntervalLower: zTestResult.confidenceIntervalLower,
          confidenceIntervalUpper: zTestResult.confidenceIntervalUpper,
          isSignificant: zTestResult.isSignificant,
          sampleSize: zTestResult.sampleSize
        });
        
        results.push(zTestResult);
        
        // Perform chi-square test
        const chiSquareResult = this.performChiSquareTest(
          variantData[controlVariant.id],
          variantData[variant.id]
        );
        
        // Save the analysis
        await this.saveAnalysis({
          experimentId,
          analysisType: 'chi_square_test',
          analysisParameters: {
            controlVariantId: controlVariant.id,
            testVariantId: variant.id,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          },
          result: chiSquareResult.result,
          pValue: chiSquareResult.pValue,
          isSignificant: chiSquareResult.isSignificant,
          sampleSize: chiSquareResult.sampleSize
        });
        
        results.push(chiSquareResult);
      }
      
      return results;
    } catch (error) {
      logger.error(`Failed to analyze experiment: ${error}`);
      throw error;
    }
  }
  
  /**
   * Compare segments
   * @param segmentIds Segment IDs
   * @param promptId Prompt ID
   * @param startDate Start date
   * @param endDate End date
   * @returns Analysis results
   */
  async compareSegments(
    segmentIds: string[],
    promptId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AnalysisResult[]> {
    try {
      if (segmentIds.length < 2) {
        throw new Error('At least two segment IDs are required');
      }
      
      // Get success data for each segment
      const segmentData: Record<string, { successes: number[]; failures: number[] }> = {};
      
      for (const segmentId of segmentIds) {
        // Get analytics for this segment
        const { data: analyticsData, error: analyticsError } = await supabaseClient.getClient()
          .from('prompt_usage_analytics')
          .select('successful_uses, failed_uses')
          .eq('prompt_id', promptId)
          .eq('segment_id', segmentId)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);
        
        if (analyticsError) {
          throw new Error(`Failed to get analytics for segment ${segmentId}: ${analyticsError.message}`);
        }
        
        // Extract success/failure data
        const successes = analyticsData.map(a => a.successful_uses);
        const failures = analyticsData.map(a => a.failed_uses);
        
        segmentData[segmentId] = { successes, failures };
      }
      
      // Perform statistical analyses
      const results: AnalysisResult[] = [];
      
      // Use first segment as reference
      const referenceSegmentId = segmentIds[0];
      
      // Compare each segment to reference
      for (let i = 1; i < segmentIds.length; i++) {
        const segmentId = segmentIds[i];
        
        // Perform z-test for proportions
        const zTestResult = this.performZTest(
          segmentData[referenceSegmentId],
          segmentData[segmentId]
        );
        
        // Save the analysis
        await this.saveAnalysis({
          promptId,
          segmentId,
          analysisType: 'z_test',
          analysisParameters: {
            referenceSegmentId,
            comparisonSegmentId: segmentId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          },
          result: zTestResult.result,
          pValue: zTestResult.pValue,
          confidenceIntervalLower: zTestResult.confidenceIntervalLower,
          confidenceIntervalUpper: zTestResult.confidenceIntervalUpper,
          isSignificant: zTestResult.isSignificant,
          sampleSize: zTestResult.sampleSize
        });
        
        results.push(zTestResult);
      }
      
      return results;
    } catch (error) {
      logger.error(`Failed to compare segments: ${error}`);
      throw error;
    }
  }
  
  /**
   * Save analysis
   * @param analysis Analysis data
   * @returns Analysis ID
   */
  private async saveAnalysis(
    analysis: {
      experimentId?: string;
      segmentId?: string;
      promptId?: string;
      analysisType: string;
      analysisParameters: Record<string, any>;
      result: Record<string, any>;
      pValue?: number;
      confidenceIntervalLower?: number;
      confidenceIntervalUpper?: number;
      isSignificant?: boolean;
      sampleSize: number;
    }
  ): Promise<string> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('prompt_statistical_analysis')
        .insert({
          experiment_id: analysis.experimentId,
          segment_id: analysis.segmentId,
          prompt_id: analysis.promptId,
          analysis_type: analysis.analysisType,
          analysis_parameters: analysis.analysisParameters,
          result: analysis.result,
          p_value: analysis.pValue,
          confidence_interval_lower: analysis.confidenceIntervalLower,
          confidence_interval_upper: analysis.confidenceIntervalUpper,
          is_significant: analysis.isSignificant,
          sample_size: analysis.sampleSize
        })
        .select('id')
        .single();
      
      if (error) {
        throw new Error(`Failed to save analysis: ${error.message}`);
      }
      
      return data.id;
    } catch (error) {
      logger.error(`Failed to save analysis: ${error}`);
      throw error;
    }
  }
  
  /**
   * Perform z-test for proportions
   * @param control Control data
   * @param test Test data
   * @returns Z-test result
   */
  private performZTest(
    control: { successes: number[]; failures: number[] },
    test: { successes: number[]; failures: number[] }
  ): AnalysisResult {
    // Calculate totals
    const controlSuccesses = control.successes.reduce((sum, val) => sum + val, 0);
    const controlFailures = control.failures.reduce((sum, val) => sum + val, 0);
    const controlTotal = controlSuccesses + controlFailures;
    const controlProportion = controlTotal > 0 ? controlSuccesses / controlTotal : 0;
    
    const testSuccesses = test.successes.reduce((sum, val) => sum + val, 0);
    const testFailures = test.failures.reduce((sum, val) => sum + val, 0);
    const testTotal = testSuccesses + testFailures;
    const testProportion = testTotal > 0 ? testSuccesses / testTotal : 0;
    
    // Calculate pooled proportion
    const totalSuccesses = controlSuccesses + testSuccesses;
    const totalSample = controlTotal + testTotal;
    const pooledProportion = totalSample > 0 ? totalSuccesses / totalSample : 0;
    
    // Calculate standard error
    const standardError = Math.sqrt(
      pooledProportion * (1 - pooledProportion) * (1/controlTotal + 1/testTotal)
    );
    
    // Calculate z-score
    const zScore = (testProportion - controlProportion) / standardError;
    
    // Calculate p-value (two-tailed)
    const pValue = 2 * (1 - jStat.normal.cdf(Math.abs(zScore), 0, 1));
    
    // Calculate confidence interval (95%)
    const proportionDifference = testProportion - controlProportion;
    const criticalValue = 1.96; // 95% confidence
    const marginOfError = criticalValue * standardError;
    const confidenceIntervalLower = proportionDifference - marginOfError;
    const confidenceIntervalUpper = proportionDifference + marginOfError;
    
    // Determine significance
    const isSignificant = pValue < 0.05;
    
    return {
      analysisType: 'z_test',
      result: {
        controlProportion,
        testProportion,
        proportionDifference,
        zScore,
        standardError,
        controlSuccesses,
        controlFailures,
        controlTotal,
        testSuccesses,
        testFailures,
        testTotal
      },
      pValue,
      confidenceIntervalLower,
      confidenceIntervalUpper,
      isSignificant,
      sampleSize: totalSample
    };
  }
  
  /**
   * Perform chi-square test
   * @param control Control data
   * @param test Test data
   * @returns Chi-square test result
   */
  private performChiSquareTest(
    control: { successes: number[]; failures: number[] },
    test: { successes: number[]; failures: number[] }
  ): AnalysisResult {
    // Calculate totals
    const controlSuccesses = control.successes.reduce((sum, val) => sum + val, 0);
    const controlFailures = control.failures.reduce((sum, val) => sum + val, 0);
    const controlTotal = controlSuccesses + controlFailures;
    
    const testSuccesses = test.successes.reduce((sum, val) => sum + val, 0);
    const testFailures = test.failures.reduce((sum, val) => sum + val, 0);
    const testTotal = testSuccesses + testFailures;
    
    const totalSuccesses = controlSuccesses + testSuccesses;
    const totalFailures = controlFailures + testFailures;
    const totalSample = controlTotal + testTotal;
    
    // Calculate expected values
    const expectedControlSuccesses = controlTotal * (totalSuccesses / totalSample);
    const expectedControlFailures = controlTotal * (totalFailures / totalSample);
    const expectedTestSuccesses = testTotal * (totalSuccesses / totalSample);
    const expectedTestFailures = testTotal * (totalFailures / totalSample);
    
    // Calculate chi-square statistic
    const chiSquare = 
      Math.pow(controlSuccesses - expectedControlSuccesses, 2) / expectedControlSuccesses +
      Math.pow(controlFailures - expectedControlFailures, 2) / expectedControlFailures +
      Math.pow(testSuccesses - expectedTestSuccesses, 2) / expectedTestSuccesses +
      Math.pow(testFailures - expectedTestFailures, 2) / expectedTestFailures;
    
    // Calculate p-value (df = 1)
    const pValue = 1 - jStat.chisquare.cdf(chiSquare, 1);
    
    // Determine significance
    const isSignificant = pValue < 0.05;
    
    return {
      analysisType: 'chi_square_test',
      result: {
        chiSquare,
        controlSuccesses,
        controlFailures,
        controlTotal,
        testSuccesses,
        testFailures,
        testTotal,
        expectedControlSuccesses,
        expectedControlFailures,
        expectedTestSuccesses,
        expectedTestFailures
      },
      pValue,
      isSignificant,
      sampleSize: totalSample
    };
  }
  
  /**
   * Map database analysis to StatisticalAnalysisData
   * @param dbAnalysis Database analysis
   * @returns Mapped analysis data
   */
  private mapAnalysisFromDb(dbAnalysis: any): StatisticalAnalysisData {
    return {
      id: dbAnalysis.id,
      experimentId: dbAnalysis.experiment_id,
      segmentId: dbAnalysis.segment_id,
      promptId: dbAnalysis.prompt_id,
      analysisType: dbAnalysis.analysis_type,
      analysisParameters: dbAnalysis.analysis_parameters,
      result: dbAnalysis.result,
      pValue: dbAnalysis.p_value,
      confidenceIntervalLower: dbAnalysis.confidence_interval_lower,
      confidenceIntervalUpper: dbAnalysis.confidence_interval_upper,
      isSignificant: dbAnalysis.is_significant,
      sampleSize: dbAnalysis.sample_size,
      createdAt: new Date(dbAnalysis.created_at)
    };
  }
}
