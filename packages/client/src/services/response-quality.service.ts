import axios from 'axios';

// Response quality service for client-side
class ResponseQualityService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/analytics/response-quality';
  }

  /**
   * Record feedback for a response
   * @param feedback Feedback data
   * @returns Promise with recorded feedback
   */
  async recordFeedback(feedback: {
    responseId: string;
    userId: string;
    modelId: string;
    feedbackType: string;
    rating?: number | null;
    isPositive?: boolean | null;
    errorCategory?: string;
    feedbackText?: string;
  }): Promise<any> {
    try {
      // Clean up null values
      const cleanFeedback = Object.fromEntries(
        Object.entries(feedback).filter(([_, v]) => v != null)
      );
      
      const response = await axios.post(`${this.baseUrl}/feedback`, cleanFeedback);
      return response.data;
    } catch (error) {
      console.error('Error recording response feedback:', error);
      throw error;
    }
  }

  /**
   * Record a model response with optional feedback
   * @param data Response data with optional feedback
   * @returns Promise with recorded response
   */
  async recordResponse(data: {
    userId: string;
    modelId: string;
    queryText: string;
    responseText: string;
    tokensUsed?: number;
    responseTimeMs?: number;
    contextUsed?: string[];
    feedback?: {
      feedbackType: string;
      rating?: number;
      isPositive?: boolean;
      errorCategory?: string;
      feedbackText?: string;
    };
    metadata?: any;
  }): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/response`, data);
      return response.data;
    } catch (error) {
      console.error('Error recording model response:', error);
      throw error;
    }
  }
}

export default new ResponseQualityService();
