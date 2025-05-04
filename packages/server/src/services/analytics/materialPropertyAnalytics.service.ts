/**
 * Material Property Analytics Service
 * 
 * This service provides analytics and insights about material properties,
 * trends, and anomalies across the database.
 */

import { logger } from '../../utils/logger';
import { prisma } from '../prisma';
import { supabase } from '../supabase/supabaseClient';
import { handleSupabaseError } from '../../../../shared/src/utils/supabaseErrorHandler';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property Distribution Result
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
 * Property Trend Result
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
 * Property Correlation Result
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
 * Property Anomaly Result
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
      logger.info(`Getting distribution for property: ${property}${materialType ? ` (materialType: ${materialType})` : ''}`);
      
      // Build query
      const query: any = {};
      
      if (materialType) {
        query.materialType = materialType;
      }
      
      // Get materials
      const materials = await prisma.material.findMany({
        where: query,
        select: {
          id: true,
          name: true,
          materialType: true
        }
      });
      
      // Extract property values
      const propertyValues: (string | number)[] = [];
      
      for (const material of materials) {
        const value = this.getPropertyValue(material, property);
        
        if (value !== undefined) {
          propertyValues.push(value);
        }
      }
      
      // Calculate distribution
      const distribution = this.calculateDistribution(propertyValues);
      
      // Calculate statistics for numeric values
      let statistics;
      
      if (propertyValues.length > 0 && typeof propertyValues[0] === 'number') {
        statistics = this.calculateStatistics(propertyValues as number[]);
      }
      
      return {
        property,
        materialType,
        distribution,
        statistics
      };
    } catch (error) {
      logger.error(`Error getting property distribution: ${error}`);
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
      logger.info(`Getting trends for property: ${property}${materialType ? ` (materialType: ${materialType})` : ''}`);
      
      // Build query
      const query: any = {};
      
      if (materialType) {
        query.materialType = materialType;
      }
      
      // Get materials with creation date
      const materials = await prisma.material.findMany({
        where: query,
        select: {
          id: true,
          name: true,
          materialType: true,
          createdAt: true
        }
      });
      
      // Group by time unit
      const groupedByTime: Record<string, (string | number)[]> = {};
      
      for (const material of materials) {
        const value = this.getPropertyValue(material, property);
        
        if (value !== undefined && material.createdAt) {
          const timeKey = this.getTimeKey(material.createdAt, timeUnit);
          
          if (!groupedByTime[timeKey]) {
            groupedByTime[timeKey] = [];
          }
          
          groupedByTime[timeKey].push(value);
        }
      }
      
      // Calculate trends
      const trends = Object.entries(groupedByTime).map(([date, values]) => {
        // For numeric values, calculate average
        if (values.length > 0 && typeof values[0] === 'number') {
          const sum = (values as number[]).reduce((acc, val) => acc + val, 0);
          const avg = sum / values.length;
          
          return {
            date,
            value: avg,
            count: values.length
          };
        }
        
        // For string values, use most common value
        const valueCounts: Record<string, number> = {};
        
        for (const value of values) {
          const strValue = String(value);
          valueCounts[strValue] = (valueCounts[strValue] || 0) + 1;
        }
        
        const mostCommonValue = Object.entries(valueCounts)
          .sort((a, b) => b[1] - a[1])[0][0];
        
        return {
          date,
          value: mostCommonValue,
          count: values.length
        };
      });
      
      // Sort by date
      trends.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      return {
        property,
        materialType,
        timeUnit,
        trends
      };
    } catch (error) {
      logger.error(`Error getting property trends: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get property correlations
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
      logger.info(`Getting correlation between ${property1} and ${property2}${materialType ? ` (materialType: ${materialType})` : ''}`);
      
      // Build query
      const query: any = {};
      
      if (materialType) {
        query.materialType = materialType;
      }
      
      // Get materials
      const materials = await prisma.material.findMany({
        where: query,
        select: {
          id: true,
          name: true,
          materialType: true
        }
      });
      
      // Extract property values
      const dataPoints: { x: number | string; y: number | string }[] = [];
      
      for (const material of materials) {
        const value1 = this.getPropertyValue(material, property1);
        const value2 = this.getPropertyValue(material, property2);
        
        if (value1 !== undefined && value2 !== undefined) {
          dataPoints.push({
            x: value1,
            y: value2
          });
        }
      }
      
      // Calculate correlation coefficient for numeric values
      let correlationCoefficient = 0;
      
      if (
        dataPoints.length > 0 &&
        typeof dataPoints[0].x === 'number' &&
        typeof dataPoints[0].y === 'number'
      ) {
        correlationCoefficient = this.calculateCorrelation(
          dataPoints.map(p => p.x as number),
          dataPoints.map(p => p.y as number)
        );
      }
      
      return {
        property1,
        property2,
        materialType,
        correlationCoefficient,
        dataPoints
      };
    } catch (error) {
      logger.error(`Error getting property correlation: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get property anomalies
   * 
   * @param property Property name
   * @param materialType Optional material type filter
   * @param threshold Z-score threshold for anomalies (default: 2.5)
   * @returns Property anomalies
   */
  public async getPropertyAnomalies(
    property: string,
    materialType?: string,
    threshold: number = 2.5
  ): Promise<PropertyAnomalyResult> {
    try {
      logger.info(`Getting anomalies for property: ${property}${materialType ? ` (materialType: ${materialType})` : ''}`);
      
      // Build query
      const query: any = {};
      
      if (materialType) {
        query.materialType = materialType;
      }
      
      // Get materials
      const materials = await prisma.material.findMany({
        where: query,
        select: {
          id: true,
          name: true,
          materialType: true
        }
      });
      
      // Extract property values
      const materialValues: { materialId: string; materialName: string; value: number | string }[] = [];
      
      for (const material of materials) {
        const value = this.getPropertyValue(material, property);
        
        if (value !== undefined) {
          materialValues.push({
            materialId: material.id,
            materialName: material.name,
            value
          });
        }
      }
      
      // Only detect anomalies for numeric values
      if (materialValues.length === 0 || typeof materialValues[0].value !== 'number') {
        return {
          property,
          materialType,
          anomalies: [],
          threshold,
          statistics: {
            mean: 0,
            stdDev: 0,
            min: 0,
            max: 0,
            q1: 0,
            q3: 0
          }
        };
      }
      
      // Calculate statistics
      const values = materialValues.map(m => m.value as number);
      const statistics = this.calculateStatistics(values);
      
      if (!statistics) {
        throw new Error('Failed to calculate statistics');
      }
      
      // Calculate z-scores and identify anomalies
      const anomalies = materialValues.map(material => {
        const value = material.value as number;
        const zScore = (value - statistics.mean) / statistics.stdDev;
        
        return {
          materialId: material.materialId,
          materialName: material.materialName,
          value,
          zScore,
          isOutlier: Math.abs(zScore) > threshold
        };
      }).filter(a => a.isOutlier);
      
      // Sort by absolute z-score (descending)
      anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
      
      return {
        property,
        materialType,
        anomalies,
        threshold,
        statistics: {
          mean: statistics.mean,
          stdDev: statistics.stdDev,
          min: statistics.min,
          max: statistics.max,
          q1: statistics.q1,
          q3: statistics.q3
        }
      };
    } catch (error) {
      logger.error(`Error getting property anomalies: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get property value from a material
   * 
   * @param material Material object
   * @param property Property name (e.g., 'dimensions.width')
   * @returns Property value or undefined if not found
   */
  private getPropertyValue(material: any, property: string): any {
    try {
      const parts = property.split('.');
      let value = material;
      
      for (const part of parts) {
        if (value === null || value === undefined) {
          return undefined;
        }
        
        value = value[part];
      }
      
      return value;
    } catch (error) {
      return undefined;
    }
  }
  
  /**
   * Calculate distribution of values
   * 
   * @param values Array of values
   * @returns Distribution
   */
  private calculateDistribution(values: (string | number)[]): { value: string | number; count: number; percentage: number }[] {
    if (values.length === 0) {
      return [];
    }
    
    // Count occurrences of each value
    const counts: Record<string, number> = {};
    
    for (const value of values) {
      const key = String(value);
      counts[key] = (counts[key] || 0) + 1;
    }
    
    // Convert to distribution
    const distribution = Object.entries(counts).map(([key, count]) => {
      // Convert key back to original type if numeric
      const value = !isNaN(Number(key)) ? Number(key) : key;
      
      return {
        value,
        count,
        percentage: count / values.length
      };
    });
    
    // Sort by count (descending)
    distribution.sort((a, b) => b.count - a.count);
    
    return distribution;
  }
  
  /**
   * Calculate statistics for numeric values
   * 
   * @param values Array of numeric values
   * @returns Statistics
   */
  private calculateStatistics(values: number[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    mode: number;
    stdDev: number;
    q1: number;
    q3: number;
  } | undefined {
    if (values.length === 0) {
      return undefined;
    }
    
    // Sort values
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Calculate min and max
    const min = sortedValues[0];
    const max = sortedValues[sortedValues.length - 1];
    
    // Calculate mean
    const sum = sortedValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / sortedValues.length;
    
    // Calculate median
    const mid = Math.floor(sortedValues.length / 2);
    const median = sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
    
    // Calculate mode
    const counts: Record<number, number> = {};
    
    for (const value of sortedValues) {
      counts[value] = (counts[value] || 0) + 1;
    }
    
    let mode = sortedValues[0];
    let maxCount = 0;
    
    for (const [value, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        mode = Number(value);
      }
    }
    
    // Calculate standard deviation
    const squaredDiffs = sortedValues.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / sortedValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate quartiles
    const q1Index = Math.floor(sortedValues.length * 0.25);
    const q3Index = Math.floor(sortedValues.length * 0.75);
    
    const q1 = sortedValues[q1Index];
    const q3 = sortedValues[q3Index];
    
    return {
      min,
      max,
      mean,
      median,
      mode,
      stdDev,
      q1,
      q3
    };
  }
  
  /**
   * Calculate correlation coefficient between two arrays of values
   * 
   * @param xValues X values
   * @param yValues Y values
   * @returns Correlation coefficient
   */
  private calculateCorrelation(xValues: number[], yValues: number[]): number {
    if (xValues.length !== yValues.length || xValues.length === 0) {
      return 0;
    }
    
    // Calculate means
    const xMean = xValues.reduce((acc, val) => acc + val, 0) / xValues.length;
    const yMean = yValues.reduce((acc, val) => acc + val, 0) / yValues.length;
    
    // Calculate covariance and variances
    let covariance = 0;
    let xVariance = 0;
    let yVariance = 0;
    
    for (let i = 0; i < xValues.length; i++) {
      const xDiff = xValues[i] - xMean;
      const yDiff = yValues[i] - yMean;
      
      covariance += xDiff * yDiff;
      xVariance += xDiff * xDiff;
      yVariance += yDiff * yDiff;
    }
    
    // Calculate correlation coefficient
    if (xVariance === 0 || yVariance === 0) {
      return 0;
    }
    
    return covariance / (Math.sqrt(xVariance) * Math.sqrt(yVariance));
  }
  
  /**
   * Get time key for a date
   * 
   * @param date Date
   * @param timeUnit Time unit
   * @returns Time key
   */
  private getTimeKey(date: Date, timeUnit: 'day' | 'week' | 'month' | 'year'): string {
    const d = new Date(date);
    
    switch (timeUnit) {
      case 'day':
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
      case 'week':
        // Get the first day of the week (Sunday)
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day;
        const sunday = new Date(d.setUTCDate(diff));
        return sunday.toISOString().split('T')[0]; // YYYY-MM-DD of Sunday
      case 'month':
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      case 'year':
        return String(d.getUTCFullYear()); // YYYY
      default:
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
    }
  }
}

// Create a singleton instance
export const materialPropertyAnalyticsService = new MaterialPropertyAnalyticsService();
export default materialPropertyAnalyticsService;
