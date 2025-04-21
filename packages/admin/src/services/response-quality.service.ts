import axios from 'axios';

// Response quality metrics interface
export interface ResponseQualityMetrics {
  overallSatisfaction: number; // percentage
  responseAccuracy: number; // percentage
  averageRating: number; // out of 5
  totalResponses: number;
  ratedResponses: number;
  feedbackRate: number; // percentage
  errorDistribution: {
    category: string;
    count: number;
    percentage: number;
  }[];
  modelComparison: {
    modelId: string;
    modelName: string;
    accuracy: number;
    satisfaction: number;
    averageRating: number;
    responseCount: number;
  }[];
  dailyTrends: {
    date: string;
    satisfaction: number;
    accuracy: number;
    rating: number;
    responses: number;
  }[];
}

// Problematic response interface
export interface ProblematicResponse {
  id: string;
  responseId: string;
  userId: string;
  modelId: string;
  modelName: string;
  feedbackType: string;
  rating?: number;
  isPositive?: boolean;
  errorCategory?: string;
  feedbackText?: string;
  query?: string;
  response?: string;
  createdAt: Date;
}

// Response Quality Service
class ResponseQualityService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/analytics/response-quality';
  }

  /**
   * Get response quality metrics
   * @param startDate Start date
   * @param endDate End date
   * @param modelId Optional model ID to filter by
   * @returns Promise with response quality metrics
   */
  async getQualityMetrics(
    startDate: Date,
    endDate: Date,
    modelId?: string
  ): Promise<ResponseQualityMetrics> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('startDate', startDate.toISOString());
      params.append('endDate', endDate.toISOString());
      
      if (modelId) {
        params.append('modelId', modelId);
      }
      
      const response = await axios.get(`${this.baseUrl}/metrics?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching response quality metrics:', error);
      throw error;
    }
  }

  /**
   * Get problematic responses
   * @param limit Number of responses to return
   * @param offset Offset for pagination
   * @param filters Optional filters
   * @returns Promise with problematic responses
   */
  async getProblematicResponses(
    limit: number = 10,
    offset: number = 0,
    filters: {
      modelId?: string;
      errorCategory?: string;
      minRating?: number;
      maxRating?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<ProblematicResponse[]> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      
      if (filters.modelId) {
        params.append('modelId', filters.modelId);
      }
      
      if (filters.errorCategory) {
        params.append('errorCategory', filters.errorCategory);
      }
      
      if (filters.minRating !== undefined) {
        params.append('minRating', filters.minRating.toString());
      }
      
      if (filters.maxRating !== undefined) {
        params.append('maxRating', filters.maxRating.toString());
      }
      
      if (filters.startDate) {
        params.append('startDate', filters.startDate.toISOString());
      }
      
      if (filters.endDate) {
        params.append('endDate', filters.endDate.toISOString());
      }
      
      const response = await axios.get(`${this.baseUrl}/problematic?${params.toString()}`);
      
      // Convert string dates to Date objects
      return response.data.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt)
      }));
    } catch (error) {
      console.error('Error fetching problematic responses:', error);
      throw error;
    }
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
    rating?: number;
    isPositive?: boolean;
    errorCategory?: string;
    feedbackText?: string;
  }): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/feedback`, feedback);
      return response.data;
    } catch (error) {
      console.error('Error recording response feedback:', error);
      throw error;
    }
  }
}

export default new ResponseQualityService();
