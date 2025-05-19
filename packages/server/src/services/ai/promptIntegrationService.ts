/**
 * Prompt Integration Service
 *
 * Provides integration capabilities with external monitoring and analytics systems.
 */

import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';
import axios from 'axios';
// import * as fs from 'fs'; // Unused
// import * as path from 'path'; // Unused

/**
 * Integration data
 */
export interface IntegrationData {
  id: string;
  name: string;
  systemType: string;
  connectionParameters: Record<string, any>;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Export data
 */
export interface ExportData {
  id: string;
  integrationId: string;
  exportType: string;
  exportParameters: Record<string, any>;
  status: string;
  result?: Record<string, any>;
  createdAt: Date;
  executedAt?: Date;
}

/**
 * System types
 */
export enum SystemType {
  GRAFANA = 'grafana',
  PROMETHEUS = 'prometheus',
  DATADOG = 'datadog',
  ELASTICSEARCH = 'elasticsearch',
  CUSTOM_API = 'custom_api'
}

/**
 * Export types
 */
export enum ExportType {
  SUCCESS_METRICS = 'success_metrics',
  EXPERIMENT_RESULTS = 'experiment_results',
  SEGMENT_ANALYTICS = 'segment_analytics',
  ML_PREDICTIONS = 'ml_predictions',
  RAW_DATA = 'raw_data'
}

/**
 * Export status
 */
export enum ExportStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Prompt Integration Service class
 */
export class PromptIntegrationService {
  /**
   * Constructor
   */
  constructor() {
    logger.info('Initializing Prompt Integration Service');
  }

  /**
   * Get integrations
   * @param systemType Optional system type
   * @param isActive Filter by active status
   * @returns Array of integrations
   */
  async getIntegrations(systemType?: string, isActive?: boolean): Promise<IntegrationData[]> {
    try {
      let query = supabaseClient.getClient()
        .from('external_system_integrations')
        .select('*');

      if (systemType) {
        query = query.eq('system_type', systemType);
      }

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get integrations: ${error.message}`);
      }

      return (data || []).map(this.mapIntegrationFromDb);
    } catch (error) {
      logger.error(`Failed to get integrations: ${error}`);
      throw error;
    }
  }

  /**
   * Create integration
   * @param integration Integration data
   * @returns Created integration ID
   */
  async createIntegration(
    integration: Omit<IntegrationData, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('external_system_integrations')
        .insert({
          name: integration.name,
          system_type: integration.systemType,
          connection_parameters: integration.connectionParameters,
          is_active: integration.isActive,
          created_by: integration.createdBy
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create integration: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      logger.error(`Failed to create integration: ${error}`);
      throw error;
    }
  }

  /**
   * Test integration connection
   * @param integrationId Integration ID
   * @returns Connection test result
   */
  async testIntegrationConnection(integrationId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get the integration
      const integration = await this.getIntegrationById(integrationId);

      // Test connection based on system type
      switch (integration.systemType) {
        case SystemType.GRAFANA:
          return await this.testGrafanaConnection(integration.connectionParameters);

        case SystemType.PROMETHEUS:
          return await this.testPrometheusConnection(integration.connectionParameters);

        case SystemType.DATADOG:
          return await this.testDatadogConnection(integration.connectionParameters);

        case SystemType.ELASTICSEARCH:
          return await this.testElasticsearchConnection(integration.connectionParameters);

        case SystemType.CUSTOM_API:
          return await this.testCustomApiConnection(integration.connectionParameters);

        default:
          throw new Error(`Unknown system type: ${integration.systemType}`);
      }
    } catch (error) {
      logger.error(`Failed to test integration connection: ${error}`);
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Create data export
   * @param exportData Export data
   * @returns Created export ID
   */
  async createDataExport(
    exportData: Omit<ExportData, 'id' | 'createdAt' | 'executedAt' | 'status' | 'result'>
  ): Promise<string> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('prompt_data_exports')
        .insert({
          integration_id: exportData.integrationId,
          export_type: exportData.exportType,
          export_parameters: exportData.exportParameters,
          status: ExportStatus.PENDING
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create data export: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      logger.error(`Failed to create data export: ${error}`);
      throw error;
    }
  }

  /**
   * Execute pending exports
   * @returns Number of exports executed
   */
  async executePendingExports(): Promise<number> {
    try {
      // Get pending exports
      const { data: exportsData, error: exportsError } = await supabaseClient.getClient()
        .from('prompt_data_exports')
        .select('*')
        .eq('status', ExportStatus.PENDING);

      if (exportsError) {
        throw new Error(`Failed to get pending exports: ${exportsError.message}`);
      }

      let exportsExecuted = 0;

      // Execute each export
      for (const exportItem of exportsData) {
        try {
          await this.executeExport(this.mapExportFromDb(exportItem));
          exportsExecuted++;
        } catch (exportError) {
          logger.error(`Failed to execute export ${exportItem.id}: ${exportError}`);
        }
      }

      return exportsExecuted;
    } catch (error) {
      logger.error(`Failed to execute pending exports: ${error}`);
      throw error;
    }
  }

  /**
   * Execute export
   * @param exportData Export to execute
   * @returns Execution result
   */
  private async executeExport(exportData: ExportData): Promise<Record<string, any>> {
    // Update export status to executing
    await this.updateExportStatus(exportData.id, ExportStatus.EXECUTING);

    try {
      // Get the integration
      const integration = await this.getIntegrationById(exportData.integrationId);

      // Execute export based on type and system
      let result: Record<string, any>;

      switch (exportData.exportType) {
        case ExportType.SUCCESS_METRICS:
          result = await this.exportSuccessMetrics(integration, exportData.exportParameters);
          break;

        case ExportType.EXPERIMENT_RESULTS:
          result = await this.exportExperimentResults(integration, exportData.exportParameters);
          break;

        case ExportType.SEGMENT_ANALYTICS:
          result = await this.exportSegmentAnalytics(integration, exportData.exportParameters);
          break;

        case ExportType.ML_PREDICTIONS:
          result = await this.exportMLPredictions(integration, exportData.exportParameters);
          break;

        case ExportType.RAW_DATA:
          result = await this.exportRawData(integration, exportData.exportParameters);
          break;

        default:
          throw new Error(`Unknown export type: ${exportData.exportType}`);
      }

      // Update export status to completed
      await this.updateExportStatus(exportData.id, ExportStatus.COMPLETED, result);

      return result;
    } catch (error) {
      // Update export status to failed
      await this.updateExportStatus(exportData.id, ExportStatus.FAILED, { error: String(error) });
      throw error;
    }
  }

  /**
   * Get integration by ID
   * @param integrationId Integration ID
   * @returns Integration data
   */
  private async getIntegrationById(integrationId: string): Promise<IntegrationData> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('external_system_integrations')
        .select('*')
        .eq('id', integrationId)
        .single();

      if (error) {
        throw new Error(`Failed to get integration: ${error.message}`);
      }

      return this.mapIntegrationFromDb(data);
    } catch (error) {
      logger.error(`Failed to get integration by ID: ${error}`);
      throw error;
    }
  }

  /**
   * Update export status
   * @param exportId Export ID
   * @param status New status
   * @param result Optional result
   * @returns Success indicator
   */
  private async updateExportStatus(
    exportId: string,
    status: string,
    result?: Record<string, any>
  ): Promise<boolean> {
    try {
      const updateData: Record<string, any> = { status };

      if (result) {
        updateData.result = result;
      }

      if (status === ExportStatus.COMPLETED || status === ExportStatus.FAILED) {
        updateData.executed_at = new Date();
      }

      const { error } = await supabaseClient.getClient()
        .from('prompt_data_exports')
        .update(updateData)
        .eq('id', exportId);

      if (error) {
        throw new Error(`Failed to update export status: ${error.message}`);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to update export status: ${error}`);
      throw error;
    }
  }

  /**
   * Test Grafana connection
   * @param connectionParameters Connection parameters
   * @returns Connection test result
   */
  private async testGrafanaConnection(
    connectionParameters: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { url, apiKey } = connectionParameters;

      if (!url) {
        throw new Error('Grafana URL is required');
      }

      if (!apiKey) {
        throw new Error('Grafana API key is required');
      }

      // Test connection to Grafana API
      const response = await axios.get(`${url}/api/health`, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });

      if (response.status === 200 && response.data.database === 'ok') {
        return {
          success: true,
          message: 'Successfully connected to Grafana'
        };
      } else {
        return {
          success: false,
          message: `Grafana health check failed: ${JSON.stringify(response.data)}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Grafana: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Test Prometheus connection
   * @param connectionParameters Connection parameters
   * @returns Connection test result
   */
  private async testPrometheusConnection(
    connectionParameters: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { url, username, password } = connectionParameters;

      if (!url) {
        throw new Error('Prometheus URL is required');
      }

      // Test connection to Prometheus API
      const headers: Record<string, string> = {};
      if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        headers.Authorization = `Basic ${auth}`;
      }

      const response = await axios.get(`${url}/api/v1/status/config`, { headers });

      if (response.status === 200 && response.data.status === 'success') {
        return {
          success: true,
          message: 'Successfully connected to Prometheus'
        };
      } else {
        return {
          success: false,
          message: `Prometheus status check failed: ${JSON.stringify(response.data)}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Prometheus: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Test Datadog connection
   * @param connectionParameters Connection parameters
   * @returns Connection test result
   */
  private async testDatadogConnection(
    connectionParameters: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { apiKey, appKey } = connectionParameters;

      if (!apiKey) {
        throw new Error('Datadog API key is required');
      }

      if (!appKey) {
        throw new Error('Datadog application key is required');
      }

      // Test connection to Datadog API
      const response = await axios.get('https://api.datadoghq.com/api/v1/validate', {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': appKey
        }
      });

      if (response.status === 200) {
        return {
          success: true,
          message: 'Successfully connected to Datadog'
        };
      } else {
        return {
          success: false,
          message: `Datadog validation failed: ${JSON.stringify(response.data)}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Datadog: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Test Elasticsearch connection
   * @param connectionParameters Connection parameters
   * @returns Connection test result
   */
  private async testElasticsearchConnection(
    connectionParameters: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { url, username, password, apiKey } = connectionParameters;

      if (!url) {
        throw new Error('Elasticsearch URL is required');
      }

      // Test connection to Elasticsearch API
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers.Authorization = `ApiKey ${apiKey}`;
      } else if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        headers.Authorization = `Basic ${auth}`;
      }

      const response = await axios.get(`${url}/_cluster/health`, { headers });

      if (response.status === 200 && response.data.status) {
        return {
          success: true,
          message: `Successfully connected to Elasticsearch (cluster status: ${response.data.status})`
        };
      } else {
        return {
          success: false,
          message: `Elasticsearch health check failed: ${JSON.stringify(response.data)}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Elasticsearch: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Test Custom API connection
   * @param connectionParameters Connection parameters
   * @returns Connection test result
   */
  private async testCustomApiConnection(
    connectionParameters: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { url, method, headers, body } = connectionParameters;

      if (!url) {
        throw new Error('API URL is required');
      }

      // Test connection to custom API
      const response = await axios({
        method: method || 'GET',
        url,
        headers: headers || {},
        data: body
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          message: `Successfully connected to API (status: ${response.status})`
        };
      } else {
        return {
          success: false,
          message: `API request failed with status ${response.status}: ${JSON.stringify(response.data)}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to API: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Export success metrics
   * @param integration Integration data
   * @param exportParameters Export parameters
   * @returns Export result
   */
  private async exportSuccessMetrics(
    integration: IntegrationData,
    exportParameters: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      const { startDate, endDate, promptIds, segmentIds } = exportParameters;

      // Query success metrics
      const { data, error } = await supabaseClient.getClient().rpc('get_success_metrics', {
        start_date_param: startDate,
        end_date_param: endDate,
        prompt_ids_param: promptIds,
        segment_ids_param: segmentIds
      });

      if (error) {
        throw new Error(`Failed to get success metrics: ${error.message}`);
      }

      // Export based on system type
      switch (integration.systemType) {
        case SystemType.GRAFANA:
          return await this.exportToGrafana(integration, 'success_metrics', data);

        case SystemType.PROMETHEUS:
          return await this.exportToPrometheus(integration, 'success_metrics', data);

        case SystemType.DATADOG:
          return await this.exportToDatadog(integration, 'success_metrics', data);

        case SystemType.ELASTICSEARCH:
          return await this.exportToElasticsearch(integration, 'success_metrics', data);

        case SystemType.CUSTOM_API:
          return await this.exportToCustomApi(integration, 'success_metrics', data);

        default:
          throw new Error(`Unknown system type: ${integration.systemType}`);
      }
    } catch (error) {
      logger.error(`Failed to export success metrics: ${error}`);
      throw error;
    }
  }

  /**
   * Export experiment results
   * @param integration Integration data
   * @param exportParameters Export parameters
   * @returns Export result
   */
  private async exportExperimentResults(
    integration: IntegrationData,
    exportParameters: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      const { experimentId, startDate, endDate } = exportParameters;

      if (!experimentId) {
        throw new Error('Experiment ID is required');
      }

      // Query experiment results
      const { data, error } = await supabaseClient.getClient().rpc('get_experiment_results', {
        experiment_id_param: experimentId,
        start_date_param: startDate,
        end_date_param: endDate
      });

      if (error) {
        throw new Error(`Failed to get experiment results: ${error.message}`);
      }

      // Export based on system type
      switch (integration.systemType) {
        case SystemType.GRAFANA:
          return await this.exportToGrafana(integration, 'experiment_results', data);

        case SystemType.PROMETHEUS:
          return await this.exportToPrometheus(integration, 'experiment_results', data);

        case SystemType.DATADOG:
          return await this.exportToDatadog(integration, 'experiment_results', data);

        case SystemType.ELASTICSEARCH:
          return await this.exportToElasticsearch(integration, 'experiment_results', data);

        case SystemType.CUSTOM_API:
          return await this.exportToCustomApi(integration, 'experiment_results', data);

        default:
          throw new Error(`Unknown system type: ${integration.systemType}`);
      }
    } catch (error) {
      logger.error(`Failed to export experiment results: ${error}`);
      throw error;
    }
  }

  /**
   * Export segment analytics
   * @param integration Integration data
   * @param exportParameters Export parameters
   * @returns Export result
   */
  private async exportSegmentAnalytics(
    integration: IntegrationData,
    exportParameters: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      const { segmentIds, startDate, endDate, promptIds } = exportParameters;

      if (!segmentIds || !Array.isArray(segmentIds) || segmentIds.length === 0) {
        throw new Error('At least one segment ID is required');
      }

      // Query segment analytics
      const { data, error } = await supabaseClient.getClient().rpc('get_segment_analytics', {
        segment_ids_param: segmentIds,
        start_date_param: startDate,
        end_date_param: endDate,
        prompt_ids_param: promptIds
      });

      if (error) {
        throw new Error(`Failed to get segment analytics: ${error.message}`);
      }

      // Export based on system type
      switch (integration.systemType) {
        case SystemType.GRAFANA:
          return await this.exportToGrafana(integration, 'segment_analytics', data);

        case SystemType.PROMETHEUS:
          return await this.exportToPrometheus(integration, 'segment_analytics', data);

        case SystemType.DATADOG:
          return await this.exportToDatadog(integration, 'segment_analytics', data);

        case SystemType.ELASTICSEARCH:
          return await this.exportToElasticsearch(integration, 'segment_analytics', data);

        case SystemType.CUSTOM_API:
          return await this.exportToCustomApi(integration, 'segment_analytics', data);

        default:
          throw new Error(`Unknown system type: ${integration.systemType}`);
      }
    } catch (error) {
      logger.error(`Failed to export segment analytics: ${error}`);
      throw error;
    }
  }

  /**
   * Export ML predictions
   * @param integration Integration data
   * @param exportParameters Export parameters
   * @returns Export result
   */
  private async exportMLPredictions(
    integration: IntegrationData,
    exportParameters: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      const { promptIds, modelIds, startDate, endDate } = exportParameters;

      // Query ML predictions
      const { data, error } = await supabaseClient.getClient().rpc('get_ml_predictions', {
        prompt_ids_param: promptIds,
        model_ids_param: modelIds,
        start_date_param: startDate,
        end_date_param: endDate
      });

      if (error) {
        throw new Error(`Failed to get ML predictions: ${error.message}`);
      }

      // Export based on system type
      switch (integration.systemType) {
        case SystemType.GRAFANA:
          return await this.exportToGrafana(integration, 'ml_predictions', data);

        case SystemType.PROMETHEUS:
          return await this.exportToPrometheus(integration, 'ml_predictions', data);

        case SystemType.DATADOG:
          return await this.exportToDatadog(integration, 'ml_predictions', data);

        case SystemType.ELASTICSEARCH:
          return await this.exportToElasticsearch(integration, 'ml_predictions', data);

        case SystemType.CUSTOM_API:
          return await this.exportToCustomApi(integration, 'ml_predictions', data);

        default:
          throw new Error(`Unknown system type: ${integration.systemType}`);
      }
    } catch (error) {
      logger.error(`Failed to export ML predictions: ${error}`);
      throw error;
    }
  }

  /**
   * Export raw data
   * @param integration Integration data
   * @param exportParameters Export parameters
   * @returns Export result
   */
  private async exportRawData(
    integration: IntegrationData,
    exportParameters: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      const { query, format } = exportParameters;

      if (!query) {
        throw new Error('Query is required');
      }

      // Execute the query
      const { data, error } = await supabaseClient.getClient().rpc('execute_query', {
        query_text: query
      });

      if (error) {
        throw new Error(`Failed to execute query: ${error.message}`);
      }

      // Format the data if needed
      let formattedData = data;
      if (format === 'csv') {
        formattedData = this.convertToCsv(data);
      } else if (format === 'json') {
        formattedData = JSON.stringify(data, null, 2);
      }

      // Export based on system type
      switch (integration.systemType) {
        case SystemType.GRAFANA:
          return await this.exportToGrafana(integration, 'raw_data', formattedData);

        case SystemType.PROMETHEUS:
          return await this.exportToPrometheus(integration, 'raw_data', formattedData);

        case SystemType.DATADOG:
          return await this.exportToDatadog(integration, 'raw_data', formattedData);

        case SystemType.ELASTICSEARCH:
          return await this.exportToElasticsearch(integration, 'raw_data', formattedData);

        case SystemType.CUSTOM_API:
          return await this.exportToCustomApi(integration, 'raw_data', formattedData);

        default:
          throw new Error(`Unknown system type: ${integration.systemType}`);
      }
    } catch (error) {
      logger.error(`Failed to export raw data: ${error}`);
      throw error;
    }
  }

  /**
   * Export to Grafana
   * @param integration Integration data
   * @param exportType Export type
   * @param data Data to export
   * @returns Export result
   */
  private async exportToGrafana(
    integration: IntegrationData,
    exportType: string,
    data: any
  ): Promise<Record<string, any>> {
    try {
      const { url, apiKey, dashboardUid } = integration.connectionParameters;

      if (!url) {
        throw new Error('Grafana URL is required');
      }

      if (!apiKey) {
        throw new Error('Grafana API key is required');
      }

      // For Grafana, we'll create annotations
      const annotations = this.convertToGrafanaAnnotations(data, exportType);

      // Send annotations to Grafana
      const response = await axios.post(`${url}/api/annotations`, annotations, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        message: `Successfully exported ${annotations.length} annotations to Grafana`,
        annotationIds: response.data
      };
    } catch (error) {
      logger.error(`Failed to export to Grafana: ${error}`);
      throw error;
    }
  }

  /**
   * Export to Prometheus
   * @param integration Integration data
   * @param exportType Export type
   * @param data Data to export
   * @returns Export result
   */
  private async exportToPrometheus(
    integration: IntegrationData,
    exportType: string,
    data: any
  ): Promise<Record<string, any>> {
    // For Prometheus, we typically use Pushgateway
    try {
      const { url, username, password } = integration.connectionParameters;

      if (!url) {
        throw new Error('Prometheus Pushgateway URL is required');
      }

      // Convert data to Prometheus format
      const metrics = this.convertToPrometheusMetrics(data, exportType);

      // Send metrics to Pushgateway
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain'
      };

      if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        headers.Authorization = `Basic ${auth}`;
      }

      await axios.post(url, metrics, { headers });

      return {
        success: true,
        message: `Successfully exported metrics to Prometheus Pushgateway`,
        metricsCount: metrics.split('\n').filter(line => line.trim() !== '').length
      };
    } catch (error) {
      logger.error(`Failed to export to Prometheus: ${error}`);
      throw error;
    }
  }

  /**
   * Export to Datadog
   * @param integration Integration data
   * @param exportType Export type
   * @param data Data to export
   * @returns Export result
   */
  private async exportToDatadog(
    integration: IntegrationData,
    exportType: string,
    data: any
  ): Promise<Record<string, any>> {
    try {
      const { apiKey, appKey } = integration.connectionParameters;

      if (!apiKey) {
        throw new Error('Datadog API key is required');
      }

      // Convert data to Datadog format
      const metrics = this.convertToDatadogMetrics(data, exportType);

      // Send metrics to Datadog
      const response = await axios.post('https://api.datadoghq.com/api/v1/series', {
        series: metrics
      }, {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': appKey,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        message: `Successfully exported ${metrics.length} metrics to Datadog`,
        response: response.data
      };
    } catch (error) {
      logger.error(`Failed to export to Datadog: ${error}`);
      throw error;
    }
  }

  /**
   * Export to Elasticsearch
   * @param integration Integration data
   * @param exportType Export type
   * @param data Data to export
   * @returns Export result
   */
  private async exportToElasticsearch(
    integration: IntegrationData,
    exportType: string,
    data: any
  ): Promise<Record<string, any>> {
    try {
      const { url, username, password, apiKey, indexName } = integration.connectionParameters;

      if (!url) {
        throw new Error('Elasticsearch URL is required');
      }

      if (!indexName) {
        throw new Error('Elasticsearch index name is required');
      }

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (apiKey) {
        headers.Authorization = `ApiKey ${apiKey}`;
      } else if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        headers.Authorization = `Basic ${auth}`;
      }

      // Convert data to Elasticsearch documents
      const documents = this.convertToElasticsearchDocuments(data, exportType);

      // Use bulk API to insert documents
      let bulkBody = '';
      documents.forEach(doc => {
        bulkBody += JSON.stringify({ index: { _index: indexName } }) + '\n';
        bulkBody += JSON.stringify(doc) + '\n';
      });

      const response = await axios.post(`${url}/_bulk`, bulkBody, { headers });

      return {
        success: true,
        message: `Successfully exported ${documents.length} documents to Elasticsearch`,
        response: response.data
      };
    } catch (error) {
      logger.error(`Failed to export to Elasticsearch: ${error}`);
      throw error;
    }
  }

  /**
   * Export to Custom API
   * @param integration Integration data
   * @param exportType Export type
   * @param data Data to export
   * @returns Export result
   */
  private async exportToCustomApi(
    integration: IntegrationData,
    exportType: string,
    data: any
  ): Promise<Record<string, any>> {
    try {
      const { url, method, headers, bodyTemplate } = integration.connectionParameters;

      if (!url) {
        throw new Error('API URL is required');
      }

      // Prepare request body
      let body = data;
      if (bodyTemplate) {
        body = {
          ...JSON.parse(bodyTemplate),
          data,
          exportType,
          timestamp: new Date().toISOString()
        };
      }

      // Send data to API
      const response = await axios({
        method: method || 'POST',
        url,
        headers: headers || {},
        data: body
      });

      return {
        success: true,
        message: `Successfully exported data to custom API`,
        status: response.status,
        response: response.data
      };
    } catch (error) {
      logger.error(`Failed to export to custom API: ${error}`);
      throw error;
    }
  }

  /**
   * Convert data to CSV format
   * @param data Data to convert
   * @returns CSV string
   */
  private convertToCsv(data: any[]): string {
    if (!data || data.length === 0) {
      return '';
    }

    // Get headers
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) {
            return '';
          } else if (typeof value === 'object') {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          } else {
            return `"${String(value).replace(/"/g, '""')}"`;
          }
        }).join(',')
      )
    ].join('\n');

    return csvContent;
  }

  /**
   * Convert data to Grafana annotations
   * @param data Data to convert
   * @param exportType Export type
   * @returns Grafana annotations
   */
  private convertToGrafanaAnnotations(data: any[], exportType: string): any[] {
    return data.map(item => {
      const timestamp = item.timestamp || item.date || item.created_at || new Date().toISOString();

      return {
        time: new Date(timestamp).getTime(),
        timeEnd: new Date(timestamp).getTime() + 1000, // 1 second duration
        tags: [exportType, 'prompt-monitoring'],
        text: `${exportType}: ${JSON.stringify(item)}`,
        dashboardUID: item.dashboardUID
      };
    });
  }

  /**
   * Convert data to Prometheus metrics
   * @param data Data to convert
   * @param exportType Export type
   * @returns Prometheus metrics
   */
  private convertToPrometheusMetrics(data: any[], exportType: string): string {
    let metrics = '';

    switch (exportType) {
      case ExportType.SUCCESS_METRICS:
        data.forEach(item => {
          const labels = `prompt_id="${item.prompt_id}",prompt_name="${item.prompt_name || ''}"`;
          metrics += `prompt_success_rate{${labels}} ${item.success_rate}\n`;
          metrics += `prompt_total_uses{${labels}} ${item.total_uses}\n`;
          metrics += `prompt_successful_uses{${labels}} ${item.successful_uses}\n`;
          metrics += `prompt_failed_uses{${labels}} ${item.failed_uses}\n`;
        });
        break;

      case ExportType.EXPERIMENT_RESULTS:
        data.forEach(item => {
          const labels = `experiment_id="${item.experiment_id}",variant_id="${item.variant_id}",variant_name="${item.variant_name || ''}"`;
          metrics += `experiment_success_rate{${labels}} ${item.success_rate}\n`;
          metrics += `experiment_total_uses{${labels}} ${item.total_uses}\n`;
        });
        break;

      case ExportType.SEGMENT_ANALYTICS:
        data.forEach(item => {
          const labels = `segment_id="${item.segment_id}",segment_name="${item.segment_name || ''}"`;
          metrics += `segment_success_rate{${labels}} ${item.success_rate}\n`;
          metrics += `segment_total_uses{${labels}} ${item.total_uses}\n`;
        });
        break;

      case ExportType.ML_PREDICTIONS:
        data.forEach(item => {
          const labels = `prompt_id="${item.prompt_id}",model_id="${item.model_id}"`;
          metrics += `ml_predicted_success_rate{${labels}} ${item.predicted_success_rate}\n`;
          metrics += `ml_confidence{${labels}} ${item.confidence}\n`;
        });
        break;
    }

    return metrics;
  }

  /**
   * Convert data to Datadog metrics
   * @param data Data to convert
   * @param exportType Export type
   * @returns Datadog metrics
   */
  private convertToDatadogMetrics(data: any[], exportType: string): any[] {
    const now = Math.floor(Date.now() / 1000);
    const metrics: any[] = [];

    switch (exportType) {
      case ExportType.SUCCESS_METRICS:
        data.forEach(item => {
          const tags = [`prompt_id:${item.prompt_id}`, `prompt_name:${item.prompt_name || ''}`];

          metrics.push({
            metric: 'prompt.success_rate',
            points: [[now, item.success_rate]],
            type: 'gauge',
            tags
          });

          metrics.push({
            metric: 'prompt.total_uses',
            points: [[now, item.total_uses]],
            type: 'gauge',
            tags
          });
        });
        break;

      case ExportType.EXPERIMENT_RESULTS:
        data.forEach(item => {
          const tags = [
            `experiment_id:${item.experiment_id}`,
            `variant_id:${item.variant_id}`,
            `variant_name:${item.variant_name || ''}`
          ];

          metrics.push({
            metric: 'experiment.success_rate',
            points: [[now, item.success_rate]],
            type: 'gauge',
            tags
          });
        });
        break;

      case ExportType.SEGMENT_ANALYTICS:
        data.forEach(item => {
          const tags = [`segment_id:${item.segment_id}`, `segment_name:${item.segment_name || ''}`];

          metrics.push({
            metric: 'segment.success_rate',
            points: [[now, item.success_rate]],
            type: 'gauge',
            tags
          });
        });
        break;

      case ExportType.ML_PREDICTIONS:
        data.forEach(item => {
          const tags = [`prompt_id:${item.prompt_id}`, `model_id:${item.model_id}`];

          metrics.push({
            metric: 'ml.predicted_success_rate',
            points: [[now, item.predicted_success_rate]],
            type: 'gauge',
            tags
          });
        });
        break;
    }

    return metrics;
  }

  /**
   * Convert data to Elasticsearch documents
   * @param data Data to convert
   * @param exportType Export type
   * @returns Elasticsearch documents
   */
  private convertToElasticsearchDocuments(data: any[], exportType: string): any[] {
    return data.map(item => ({
      ...item,
      export_type: exportType,
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Map database integration to IntegrationData
   * @param dbIntegration Database integration
   * @returns Mapped integration data
   */
  private mapIntegrationFromDb(dbIntegration: any): IntegrationData {
    return {
      id: dbIntegration.id,
      name: dbIntegration.name,
      systemType: dbIntegration.system_type,
      connectionParameters: dbIntegration.connection_parameters,
      isActive: dbIntegration.is_active,
      createdBy: dbIntegration.created_by,
      createdAt: new Date(dbIntegration.created_at),
      updatedAt: new Date(dbIntegration.updated_at)
    };
  }

  /**
   * Map database export to ExportData
   * @param dbExport Database export
   * @returns Mapped export data
   */
  private mapExportFromDb(dbExport: any): ExportData {
    return {
      id: dbExport.id,
      integrationId: dbExport.integration_id,
      exportType: dbExport.export_type,
      exportParameters: dbExport.export_parameters,
      status: dbExport.status,
      result: dbExport.result,
      createdAt: new Date(dbExport.created_at),
      executedAt: dbExport.executed_at ? new Date(dbExport.executed_at) : undefined
    };
  }
}
