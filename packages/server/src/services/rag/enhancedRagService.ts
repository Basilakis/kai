import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as path from 'path';

@Injectable()
export class EnhancedRagService implements OnModuleInit {
  private readonly logger = new Logger(EnhancedRagService.name);
  private pythonProcess: any;
  private initialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeEnhancedRag();
  }

  async initializeEnhancedRag() {
    try {
      const pythonPath = this.configService.get<string>('PYTHON_PATH', 'python3');
      const scriptPath = path.join(process.cwd(), 'packages/ml/python/update_mcp_server.py');
      const configPath = this.configService.get<string>('RAG_CONFIG_PATH', '');

      const args = ['--config', configPath].filter(Boolean);

      this.logger.log(`Initializing enhanced RAG system with script: ${scriptPath}`);
      
      this.pythonProcess = spawn(pythonPath, [scriptPath, ...args]);

      this.pythonProcess.stdout.on('data', (data) => {
        this.logger.log(`Enhanced RAG: ${data}`);
      });

      this.pythonProcess.stderr.on('data', (data) => {
        this.logger.error(`Enhanced RAG error: ${data}`);
      });

      this.pythonProcess.on('close', (code) => {
        if (code === 0) {
          this.logger.log('Enhanced RAG system initialized successfully');
          this.initialized = true;
        } else {
          this.logger.error(`Enhanced RAG initialization failed with code ${code}`);
          this.initialized = false;
        }
      });

      // Wait for initialization to complete
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.initialized) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
      });

      return this.initialized;
    } catch (error) {
      this.logger.error(`Error initializing enhanced RAG system: ${error.message}`);
      return false;
    }
  }

  async processQuery(textQuery: string, imageData?: string, options?: any) {
    try {
      if (!this.initialized) {
        await this.initializeEnhancedRag();
      }

      // Call Python bridge to process query
      const result = await this.callPythonBridge('query', {
        textQuery,
        imageData,
        options
      });

      return result;
    } catch (error) {
      this.logger.error(`Error processing query: ${error.message}`);
      throw error;
    }
  }

  async submitFeedback(query: string, response: any, feedback: any) {
    try {
      if (!this.initialized) {
        await this.initializeEnhancedRag();
      }

      // Call Python bridge to submit feedback
      const result = await this.callPythonBridge('feedback', {
        query,
        response,
        feedback
      });

      return result;
    } catch (error) {
      this.logger.error(`Error submitting feedback: ${error.message}`);
      throw error;
    }
  }

  async getSystemStats() {
    try {
      if (!this.initialized) {
        await this.initializeEnhancedRag();
      }

      // Call Python bridge to get system stats
      const result = await this.callPythonBridge('stats', {});

      return result;
    } catch (error) {
      this.logger.error(`Error getting system stats: ${error.message}`);
      throw error;
    }
  }

  private async callPythonBridge(requestType: string, data: any) {
    return new Promise((resolve, reject) => {
      const pythonPath = this.configService.get<string>('PYTHON_PATH', 'python3');
      const scriptPath = path.join(process.cwd(), 'packages/ml/python/mcp_bridge_client.py');

      // Prepare data for Python script
      const jsonData = JSON.stringify({
        requestType,
        data
      });

      const process = spawn(pythonPath, [scriptPath, jsonData]);

      let result = '';
      let error = '';

      process.stdout.on('data', (data) => {
        result += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const parsedResult = JSON.parse(result);
            resolve(parsedResult);
          } catch (e) {
            reject(new Error(`Failed to parse result: ${e.message}`));
          }
        } else {
          reject(new Error(`Process exited with code ${code}: ${error}`));
        }
      });
    });
  }
}
