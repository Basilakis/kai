/**
 * Material Property Analytics Service
 * 
 * This service provides client-side functionality for material property analytics.
 */

import { api } from '../utils/api';

/**
 * Property Distribution Result interface
 */
export interface PropertyDistributionResult {
  property: string;
  materialType?: string;
  distribution: {
    value: string | number;
    count: number;
    percentage: number;
  }[];
  statistics?: {
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    mode?: number | string;
    stdDev?: number;
  };
}

/**
 * Property Trend Result interface
 */
export interface PropertyTrendResult {
  property: string;
  materialType?: string;
  timeUnit: 'day' | 'week' | 'month' | 'year';
  trends: {
    date: string;
    value: number | string;
    count: number;
  }[];
}

/**
 * Property Correlation Result interface
 */
export interface PropertyCorrelationResult {
  property1: string;
  property2: string;
  materialType?: string;
  correlationCoefficient: number;
  dataPoints: {
    x: number | string;
    y: number | string;
  }[];
}

/**
 * Property Anomaly Result interface
 */
export interface PropertyAnomalyResult {
  property: string;
  materialType?: string;
  anomalies: {
    materialId: string;
    materialName: string;
    value: number | string;
    zScore: number;
    isOutlier: boolean;
  }[];
  threshold: number;
  statistics: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
  };
}

/**
 * Material Property Analytics Service
 */
class MaterialPropertyAnalyticsService {
  /**
   * Get property distribution
   * 
   * @param property Property name
   * @param materialType Optional material type filter
   * @returns Property distribution
   */
  public async getPropertyDistribution(
    property: string,
    materialType?: string
  ): Promise<PropertyDistributionResult> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('property', property);
      
      if (materialType) {
        queryParams.append('materialType', materialType);
      }
      
      const response = await api.get(`/api/analytics/material-properties/distribution?${queryParams.toString()}`);
      
      return response.data.distribution;
    } catch (error) {
      console.error('Error getting property distribution:', error);
      throw error;
    }
  }
  
  /**
   * Get property trends
   * 
   * @param property Property name
   * @param timeUnit Time unit for trends
   * @param materialType Optional material type filter
   * @returns Property trends
   */
  public async getPropertyTrends(
    property: string,
    timeUnit: 'day' | 'week' | 'month' | 'year',
    materialType?: string
  ): Promise<PropertyTrendResult> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('property', property);
      queryParams.append('timeUnit', timeUnit);
      
      if (materialType) {
        queryParams.append('materialType', materialType);
      }
      
      const response = await api.get(`/api/analytics/material-properties/trends?${queryParams.toString()}`);
      
      return response.data.trends;
    } catch (error) {
      console.error('Error getting property trends:', error);
      throw error;
    }
  }
  
  /**
   * Get property correlation
   * 
   * @param property1 First property name
   * @param property2 Second property name
   * @param materialType Optional material type filter
   * @returns Property correlation
   */
  public async getPropertyCorrelation(
    property1: string,
    property2: string,
    materialType?: string
  ): Promise<PropertyCorrelationResult> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('property1', property1);
      queryParams.append('property2', property2);
      
      if (materialType) {
        queryParams.append('materialType', materialType);
      }
      
      const response = await api.get(`/api/analytics/material-properties/correlation?${queryParams.toString()}`);
      
      return response.data.correlation;
    } catch (error) {
      console.error('Error getting property correlation:', error);
      throw error;
    }
  }
  
  /**
   * Get property anomalies
   * 
   * @param property Property name
   * @param materialType Optional material type filter
   * @param threshold Optional Z-score threshold for anomalies
   * @returns Property anomalies
   */
  public async getPropertyAnomalies(
    property: string,
    materialType?: string,
    threshold?: number
  ): Promise<PropertyAnomalyResult> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('property', property);
      
      if (materialType) {
        queryParams.append('materialType', materialType);
      }
      
      if (threshold !== undefined) {
        queryParams.append('threshold', threshold.toString());
      }
      
      const response = await api.get(`/api/analytics/material-properties/anomalies?${queryParams.toString()}`);
      
      return response.data.anomalies;
    } catch (error) {
      console.error('Error getting property anomalies:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const materialPropertyAnalyticsService = new MaterialPropertyAnalyticsService();
