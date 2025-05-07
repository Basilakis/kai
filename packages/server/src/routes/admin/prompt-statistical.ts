import { Router } from 'express';
import { supabase } from '../../services/supabase';
import { isAdmin } from '../../middleware/auth';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validation';

const router = Router();

// Apply admin middleware to all routes
router.use(isAdmin);

// Schema for analyzing experiments
const experimentAnalysisSchema = z.object({
  experimentId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
});

// Schema for comparing segments
const segmentComparisonSchema = z.object({
  segmentIds: z.array(z.string()),
  promptId: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
});

// Get all experiments
router.get('/experiments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prompt_statistical_experiments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching experiments:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get experiment by ID
router.get('/experiments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('prompt_statistical_experiments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ success: false, message: 'Experiment not found' });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching experiment:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Analyze experiment
router.post('/experiments/:experimentId/analyze', validateRequest(experimentAnalysisSchema), async (req, res) => {
  try {
    const { experimentId, startDate, endDate } = req.body;

    // Get the experiment
    const { data: experiment, error: experimentError } = await supabase
      .from('prompt_statistical_experiments')
      .select('*')
      .eq('id', experimentId)
      .single();

    if (experimentError) {
      return res.status(404).json({ success: false, message: 'Experiment not found' });
    }

    // In a real implementation, you would analyze the experiment data
    // For now, we'll just return mock analysis results
    const mockResults = [
      {
        analysisType: 'z_test',
        result: {
          controlSuccessRate: 0.75,
          variantSuccessRate: 0.82,
          controlSampleSize: 500,
          variantSampleSize: 520
        },
        pValue: 0.032,
        confidenceIntervalLower: 0.02,
        confidenceIntervalUpper: 0.12,
        isSignificant: true,
        sampleSize: 1020
      },
      {
        analysisType: 'chi_square',
        result: {
          controlSuccesses: 375,
          controlFailures: 125,
          variantSuccesses: 426,
          variantFailures: 94
        },
        pValue: 0.028,
        isSignificant: true,
        sampleSize: 1020
      }
    ];

    return res.json({ success: true, data: mockResults });
  } catch (error) {
    console.error('Error analyzing experiment:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all segments
router.get('/segments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prompt_statistical_segments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching segments:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Compare segments
router.post('/segments/compare', validateRequest(segmentComparisonSchema), async (req, res) => {
  try {
    const { segmentIds, promptId, startDate, endDate } = req.body;

    if (segmentIds.length < 2) {
      return res.status(400).json({ success: false, message: 'At least two segments are required for comparison' });
    }

    // In a real implementation, you would compare the segments
    // For now, we'll just return mock comparison results
    const mockResults = [
      {
        analysisType: 'segment_comparison',
        result: {
          segment1Id: segmentIds[0],
          segment1Name: 'Mobile Users',
          segment1SuccessRate: 0.68,
          segment2Id: segmentIds[1],
          segment2Name: 'Desktop Users',
          segment2SuccessRate: 0.82,
          difference: 0.14
        },
        pValue: 0.008,
        confidenceIntervalLower: 0.05,
        confidenceIntervalUpper: 0.23,
        isSignificant: true,
        sampleSize: 1500
      }
    ];

    // If there are more than 2 segments, add pairwise comparisons
    if (segmentIds.length > 2) {
      for (let i = 0; i < segmentIds.length - 1; i++) {
        for (let j = i + 1; j < segmentIds.length; j++) {
          if (i === 0 && j === 1) continue; // Skip the first comparison as it's already added

          mockResults.push({
            analysisType: 'segment_comparison',
            result: {
              segment1Id: segmentIds[i],
              segment1Name: `Segment ${i + 1}`,
              segment1SuccessRate: 0.7 + Math.random() * 0.2,
              segment2Id: segmentIds[j],
              segment2Name: `Segment ${j + 1}`,
              segment2SuccessRate: 0.7 + Math.random() * 0.2,
              difference: Math.random() * 0.2
            },
            pValue: Math.random() * 0.1,
            confidenceIntervalLower: Math.random() * 0.1,
            confidenceIntervalUpper: Math.random() * 0.2 + 0.1,
            isSignificant: Math.random() > 0.5,
            sampleSize: 1000 + Math.floor(Math.random() * 1000)
          });
        }
      }
    }

    return res.json({ success: true, data: mockResults });
  } catch (error) {
    console.error('Error comparing segments:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Analyze correlations
router.get('/correlations', async (req, res) => {
  try {
    const { promptId, startDate, endDate } = req.query;

    if (!promptId) {
      return res.status(400).json({ success: false, message: 'Prompt ID is required' });
    }

    // In a real implementation, you would analyze correlations in the data
    // For now, we'll just return mock correlation results
    const mockCorrelations = [
      {
        factor1: 'prompt_length',
        factor2: 'success_rate',
        correlationCoefficient: 0.72,
        pValue: 0.003,
        isSignificant: true
      },
      {
        factor1: 'example_count',
        factor2: 'success_rate',
        correlationCoefficient: 0.65,
        pValue: 0.008,
        isSignificant: true
      },
      {
        factor1: 'question_count',
        factor2: 'success_rate',
        correlationCoefficient: -0.12,
        pValue: 0.34,
        isSignificant: false
      },
      {
        factor1: 'instruction_clarity',
        factor2: 'success_rate',
        correlationCoefficient: 0.81,
        pValue: 0.001,
        isSignificant: true
      },
      {
        factor1: 'context_richness',
        factor2: 'success_rate',
        correlationCoefficient: 0.58,
        pValue: 0.02,
        isSignificant: true
      },
      {
        factor1: 'command_count',
        factor2: 'success_rate',
        correlationCoefficient: 0.32,
        pValue: 0.09,
        isSignificant: false
      },
      {
        factor1: 'readability_score',
        factor2: 'success_rate',
        correlationCoefficient: 0.45,
        pValue: 0.04,
        isSignificant: true
      }
    ];

    return res.json({ success: true, data: mockCorrelations });
  } catch (error) {
    console.error('Error analyzing correlations:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Analyze trends
router.get('/trends', async (req, res) => {
  try {
    const { promptId, startDate, endDate } = req.query;

    if (!promptId) {
      return res.status(400).json({ success: false, message: 'Prompt ID is required' });
    }

    // In a real implementation, you would analyze trends in the data
    // For now, we'll just return mock trend results
    const mockTrends = [];
    const today = new Date();
    let baseValue = 65; // Starting success rate
    let trend = 0.2; // Slight upward trend

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Add some randomness to the value
      const randomFactor = Math.random() * 10 - 5; // Random value between -5 and 5
      const value = Math.min(100, Math.max(0, baseValue + randomFactor));
      
      // Calculate trend line
      const trendValue = baseValue + trend * (30 - i);
      
      // Add confidence bounds
      const lowerBound = Math.max(0, trendValue - 5 - i * 0.2);
      const upperBound = Math.min(100, trendValue + 5 + i * 0.2);
      
      mockTrends.push({
        date: dateStr,
        value,
        trend: trendValue,
        lowerBound,
        upperBound
      });
      
      // Increment base value for next iteration
      baseValue += trend;
    }

    return res.json({ success: true, data: mockTrends });
  } catch (error) {
    console.error('Error analyzing trends:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Calculate power analysis
router.get('/power-analysis', async (req, res) => {
  try {
    const { effectSize, power, significance } = req.query;

    const effectSizeValue = parseFloat(effectSize as string) || 0.1;
    const powerValue = parseFloat(power as string) || 0.8;
    const significanceValue = parseFloat(significance as string) || 0.05;

    // In a real implementation, you would calculate the required sample size
    // For now, we'll just use a simple formula
    const requiredSampleSize = Math.ceil(16 / (effectSizeValue * effectSizeValue) * (powerValue / (1 - powerValue)) * (significanceValue / (1 - significanceValue)));

    return res.json({ 
      success: true, 
      data: { 
        requiredSampleSize,
        effectSize: effectSizeValue,
        power: powerValue,
        significance: significanceValue
      } 
    });
  } catch (error) {
    console.error('Error calculating power analysis:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
