/**
 * CSV Parser Service
 * 
 * This service handles parsing and processing CSV files for dataset creation.
 * It supports column mapping, validation, and transformation of CSV data
 * into properly structured datasets.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { Dataset, DatasetClass, DatasetImage } from '../supabase/supabase-dataset-service';
import supabaseDatasetService from '../supabase/supabase-dataset-service';
import { supabaseClient } from '../supabase/supabaseClient';
import * as path from 'path';
import * as fs from 'fs';
import * as axios from 'axios';

// Default CSV structure
export interface CsvRow {
  image_path: string;
  class_name: string;
  material_id?: string;
  color?: string;
  finish?: string;
  size?: string;
  manufacturer?: string;
  additional_metadata?: string; // JSON string
  [key: string]: any; // Allow additional fields
}

export interface ColumnMapping {
  source: string;
  target: string;
  transform?: (value: string) => any;
  defaultValue?: any;
}

export interface CsvParseOptions {
  mapping: ColumnMapping[];
  hasHeaderRow?: boolean;
  delimiter?: string;
  skipEmptyLines?: boolean;
}

export interface CsvProcessingResult {
  success: boolean;
  dataset: Dataset | null;
  classCount: number;
  imageCount: number;
  errors: string[];
  warnings: string[];
}

export class CsvParserService {
  private static instance: CsvParserService;

  private constructor() {
    logger.info('CSV Parser Service initialized');
  }

  /**
   * Get the singleton instance
   * @returns The CsvParserService instance
   */
  public static getInstance(): CsvParserService {
    if (!CsvParserService.instance) {
      CsvParserService.instance = new CsvParserService();
    }
    return CsvParserService.instance;
  }

  /**
   * Process a CSV file into a dataset
   * @param csvFilePath Path to the CSV file
   * @param datasetName Name for the dataset
   * @param description Optional description
   * @param options CSV parsing options
   * @param userId User ID of creator
   * @returns Processing result
   */
  public async processCsvFile(
    csvFilePath: string,
    datasetName: string,
    description?: string,
    options?: CsvParseOptions,
    userId?: string
  ): Promise<CsvProcessingResult> {
    // Initialize result
    const result: CsvProcessingResult = {
      success: false,
      dataset: null,
      classCount: 0,
      imageCount: 0,
      errors: [],
      warnings: []
    };

    try {
      // Read CSV file
      const csvContent = fs.readFileSync(csvFilePath, 'utf8');

      // Parse CSV content
      const rows = this.parseCsvContent(csvContent, options);

      if (rows.length === 0) {
        result.errors.push('CSV file contains no valid data rows.');
        return result;
      }

      // Create the dataset
      const dataset = await supabaseDatasetService.createDataset({
        name: datasetName,
        description,
        createdBy: userId,
        status: 'processing'
      });

      result.dataset = dataset;

      // Process each row
      const classesMap = new Map<string, DatasetClass>();

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];

          // Ensure row has required fields
          if (!row || !row.image_path || !row.class_name) {
            result.warnings.push(`Row ${i + 1}: Missing required fields. Skipping.`);
            continue;
          }

          // Get or create class
          let datasetClass: DatasetClass;
          if (classesMap.has(row.class_name)) {
            const existingClass = classesMap.get(row.class_name);
            if (!existingClass) {
              throw new Error(`Class mapping error for ${row.class_name}`);
            }
            datasetClass = existingClass;
          } else {
            // Create new class
            datasetClass = await supabaseDatasetService.createDatasetClass({
              datasetId: dataset.id,
              name: row.class_name
            });
            classesMap.set(row.class_name, datasetClass);
            result.classCount++;
          }

          // Process image
          const imageData = await this.processImageFromCsvRow(row, datasetClass, dataset.id);
          if (imageData) {
            result.imageCount++;
          } else {
            result.warnings.push(`Row ${i + 1}: Failed to process image. Skipping.`);
          }
        } catch (rowErr) {
          result.warnings.push(`Row ${i + 1}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`);
        }
      }

      // Update dataset status to 'ready'
      await supabaseDatasetService.updateDataset(dataset.id, {
        status: 'ready'
      });

      result.success = true;
    } catch (err) {
      logger.error(`Failed to process CSV file: ${err}`);
      result.errors.push(`Failed to process CSV file: ${err instanceof Error ? err.message : String(err)}`);

      // If dataset was created, mark it as error
      if (result.dataset) {
        await supabaseDatasetService.updateDataset(result.dataset.id, {
          status: 'error'
        });
      }
    }

    return result;
  }

  /**
   * Handle specific CSV parsing errors
   * @param error Error object
   * @param rowIndex Row index where error occurred
   * @param result Processing result object
   */
  private handleCsvParsingError(error: Error, rowIndex: number, result: CsvProcessingResult): void {
    if (error.message.includes('Invalid file format')) {
      result.errors.push(`Row ${rowIndex + 1}: Invalid file format. Please check the file and try again.`);
    } else if (error.message.includes('Missing required fields')) {
      result.warnings.push(`Row ${rowIndex + 1}: Missing required fields. Skipping.`);
    } else if (error.message.includes('Failed to download image')) {
      result.warnings.push(`Row ${rowIndex + 1}: Failed to download image. Skipping.`);
    } else {
      result.warnings.push(`Row ${rowIndex + 1}: ${error.message}`);
    }
  }

  /**
   * Parse CSV content into structured rows
   * @param content CSV file content
   * @param options Parsing options
   * @returns Array of parsed rows
   */
  private parseCsvContent(content: string | Buffer, options?: CsvParseOptions): CsvRow[] {
    const delimiter = options?.delimiter || ',';
    const hasHeaderRow = options?.hasHeaderRow ?? true;
    const skipEmptyLines = options?.skipEmptyLines ?? true;
    
    // Convert Buffer to string if needed
    const contentStr = typeof content === 'string' ? content : content.toString('utf8');
    
    // Split content into lines
    const lines = contentStr.split(/\r?\n/);
    
    // Remove empty lines if configured
    const nonEmptyLines = skipEmptyLines 
      ? lines.filter(line => line.trim().length > 0)
      : lines;
    
    if (nonEmptyLines.length === 0) {
      return [];
    }
    
    // Get header row or use default mapping
    const headerRow = (hasHeaderRow && nonEmptyLines.length > 0 && nonEmptyLines[0])
      ? this.splitCsvLine(nonEmptyLines[0], delimiter)
      : this.getDefaultHeaders();
    
    // Process data rows
    const dataRows: CsvRow[] = [];
    const startIndex = hasHeaderRow ? 1 : 0;
    
    for (let i = startIndex; i < nonEmptyLines.length; i++) {
      const line = nonEmptyLines[i];
      if (!line) continue;
      
      const values = this.splitCsvLine(line, delimiter);
      
      // Create row object with mapped values
      const row: CsvRow = { image_path: '', class_name: '' };
      
      // Apply column mapping if provided
      if (options?.mapping) {
        options.mapping.forEach(mapping => {
          const sourceIndex = headerRow.indexOf(mapping.source);
          if (sourceIndex >= 0 && sourceIndex < values.length) {
            let value = values[sourceIndex];
            
            // Apply transformation if provided
            if (mapping.transform && typeof mapping.transform === 'function' && value !== undefined) {
              value = mapping.transform(value);
            }
            
            row[mapping.target] = value;
          } else if (mapping.defaultValue !== undefined) {
            // Use default value if source column not found
            row[mapping.target] = mapping.defaultValue;
          }
        });
      } else {
        // Direct mapping based on header names
        for (let j = 0; j < headerRow.length && j < values.length; j++) {
          const header = headerRow[j];
          if (header) {
            row[header] = values[j];
          }
        }
      }
      
      // Ensure required fields
      if (row.image_path && row.class_name) {
        dataRows.push(row);
      }
    }
    
    return dataRows;
  }

  /**
   * Split a CSV line into values, handling quoted values
   * @param line CSV line
   * @param delimiter Delimiter character
   * @returns Array of values
   */
  private splitCsvLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote inside quotes
          currentValue += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // End of value
        values.push(currentValue);
        currentValue = '';
      } else {
        // Add character to current value
        currentValue += char;
      }
    }
    
    // Add last value
    values.push(currentValue);
    
    return values;
  }

  /**
   * Get default CSV headers
   * @returns Array of default headers
   */
  private getDefaultHeaders(): string[] {
    return [
      'image_path',
      'class_name',
      'material_id',
      'color',
      'finish',
      'size',
      'manufacturer',
      'additional_metadata'
    ];
  }

  /**
   * Process an image from a CSV row
   * @param row CSV row data
   * @param datasetClass Dataset class
   * @param datasetId Dataset ID
   * @returns Created image or null if failed
   */
  private async processImageFromCsvRow(
    row: CsvRow,
    datasetClass: DatasetClass,
    datasetId: string
  ): Promise<DatasetImage | null> {
    try {
      const imagePath = row.image_path;
      const filename = this.getFilenameFromPath(imagePath);
      
      // Process image data based on format
      // Use any as temporary workaround for Buffer type
      let fileBuffer: any | null = null;
      
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        // Remote URL
        fileBuffer = await this.downloadImage(imagePath);
      } else if (imagePath.startsWith('base64:')) {
        // Base64 data
        fileBuffer = this.parseBase64Image(imagePath);
      } else {
        // Local file path
        fileBuffer = this.readLocalFile(imagePath);
      }
      
      if (!fileBuffer) {
        logger.warn(`Failed to get image data from ${imagePath}`);
        return null;
      }
      
      // Determine storage path: datasets/{datasetId}/{classId}/{filename}
      const storagePath = `${datasetId}/${datasetClass.id}/${filename}`;
      
      // Upload file to Supabase storage
      const { error } = await supabaseClient
        .getClient()
        .storage
        .from('datasets')
        .upload(storagePath, fileBuffer, {
          contentType: this.getContentType(path.extname(filename))
        });
      
      if (error) {
        logger.error(`Failed to upload image ${filename}: ${error}`);
        return null;
      }
      
      // Parse metadata if available
      let metadata: Record<string, any> | undefined;
      if (row.additional_metadata) {
        try {
          metadata = JSON.parse(row.additional_metadata);
        } catch (err) {
          logger.warn(`Failed to parse metadata for ${filename}: ${err}`);
        }
      }
      
      // Create image entry in the database
      const datasetImage = await supabaseDatasetService.createDatasetImage({
        datasetId,
        classId: datasetClass.id,
        storagePath,
        filename,
        metadata
      });
      
      return datasetImage;
    } catch (err) {
      logger.error(`Failed to process image: ${err}`);
      return null;
    }
  }

  /**
   * Extract filename from path
   * @param imagePath Image path
   * @returns Filename
   */
  private getFilenameFromPath(imagePath: string): string {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // Extract filename from URL
      const url = new URL(imagePath);
      const pathname = url.pathname;
      return path.basename(pathname) || `image-${uuidv4()}.jpg`;
    } else if (imagePath.startsWith('base64:')) {
      // Generate filename for base64 data
      return `image-${uuidv4()}.jpg`;
    } else {
      // Local file path
      return path.basename(imagePath);
    }
  }

  /**
   * Download image from URL
   * @param url Image URL
   * @returns Image buffer or null if failed
   */
  private async downloadImage(url: string): Promise<any | null> {
    try {
      const response = await axios.default.get(url, {
        responseType: 'arraybuffer'
      });
      
      // Use any as temporary workaround for Buffer type
      return Buffer ? Buffer.from(response.data) : response.data;
    } catch (err) {
      logger.error(`Failed to download image from ${url}: ${err}`);
      return null;
    }
  }

  /**
   * Parse base64 image data
   * @param base64Data Base64 image data
   * @returns Image buffer or null if failed
   */
  private parseBase64Image(base64Data: string): any | null {
    try {
      // Extract base64 content
      const matches = base64Data.match(/^base64:(?:data:image\/\w+;base64,)?([\s\S]+)$/);
      
      if (!matches || !matches[1]) {
        return null;
      }
      
      // Convert to buffer
      // Use any as temporary workaround for Buffer type
      return Buffer ? Buffer.from(matches[1], 'base64') : null;
    } catch (err) {
      logger.error(`Failed to parse base64 image data: ${err}`);
      return null;
    }
  }

  /**
   * Read image from local file
   * @param filePath Local file path
   * @returns Image buffer or null if failed
   */
  private readLocalFile(filePath: string): any | null {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        logger.warn(`Local file not found: ${filePath}`);
        return null;
      }
      
      // Read file content
      return fs.readFileSync(filePath);
    } catch (err) {
      logger.error(`Failed to read local file ${filePath}: ${err}`);
      return null;
    }
  }

  /**
   * Get content type for file extension
   * @param extension File extension
   * @returns Content type
   */
  private getContentType(extension: string): string {
    extension = extension.toLowerCase();
    
    switch (extension) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Generate standard CSV template
   * @returns CSV template content
   */
  public generateCsvTemplate(): string {
    const headers = this.getDefaultHeaders();
    const headerRow = headers.join(',');
    
    // Create a few example rows
    const exampleRows = [
      'https://example.com/images/tile1.jpg,marble,marble-white-001,white,polished,12x24,TileWorks,"{\\"hardness\\": 4, \\"waterResistant\\": true}"',
      'local:image2.jpg,granite,granite-black-002,black,honed,24x24,StoneWorks,"{\\"hardness\\": 5, \\"waterResistant\\": true}"',
      'base64:data:image/jpeg;base64...,tile,ceramic-beige-003,beige,matte,6x6,CeramicPro,"{\\"hardness\\": 3, \\"waterResistant\\": true}"'
    ];
    
    return [headerRow, ...exampleRows].join('\n');
  }
}

// Export singleton instance
export const csvParserService = CsvParserService.getInstance();
export default csvParserService;