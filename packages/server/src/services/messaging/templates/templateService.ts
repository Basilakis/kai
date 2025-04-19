/**
 * Template Service
 * 
 * Provides functionality for managing and rendering message templates.
 * Supports multiple template types and dynamic content substitution.
 */

// @ts-ignore - Suppress module not found error, assume handlebars is installed
import Handlebars from 'handlebars'; 
import { logger } from '../../../utils/logger';
import { supabaseClient } from '../../supabase/supabaseClient';

/**
 * Template types
 */
export enum TemplateType {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app'
}

/**
 * Template format
 */
export enum TemplateFormat {
  HTML = 'html',
  TEXT = 'text',
  MARKDOWN = 'markdown',
  JSON = 'json'
}

/**
 * Template data
 */
export interface TemplateData {
  id: string;
  name: string;
  description?: string;
  type: TemplateType;
  format: TemplateFormat;
  content: string;
  subject?: string;
  variables?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Template render options
 */
export interface TemplateRenderOptions {
  templateId?: string;
  templateName?: string;
  templateContent?: string;
  data: Record<string, any>;
  defaultData?: Record<string, any>;
}

/**
 * Template service class
 */
class TemplateService {
  // @ts-ignore - Suppress type not found error, assume @types/handlebars is installed
  private templateCache: Map<string, Handlebars.TemplateDelegate> = new Map(); 
  
  constructor() {
    // Register Handlebars helpers
    this.registerHelpers();
    
    logger.info('Template service initialized');
  }
  
  // Removed unused ensureTemplateDir method and templateDir property
  
  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    // Format date helper
    Handlebars.registerHelper('formatDate', function(date: Date, format: string) {
      if (!date) return '';
      
      const d = new Date(date);
      
      // Simple format implementation
      switch (format) {
        case 'short':
          return d.toLocaleDateString();
        case 'long':
          return d.toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        case 'time':
          return d.toLocaleTimeString();
        case 'datetime':
          return d.toLocaleString();
        default:
          return d.toISOString();
      }
    });
    
    // Conditional helper - Add explicit types
    Handlebars.registerHelper('ifCond', function(this: any, v1: any, operator: string, v2: any, options: Handlebars.HelperOptions) {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
          return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
          return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });
  }
  
  /**
   * Render a template
   * @param options Template render options
   * @returns Rendered content
   */
  async renderTemplate(options: TemplateRenderOptions): Promise<string> {
    try {
      let templateContent: string;
      
      // Get template content
      if (options.templateContent) {
        // Use provided template content
        templateContent = options.templateContent;
      } else if (options.templateId) {
        // Get template by ID from database
        templateContent = await this.getTemplateById(options.templateId);
      } else if (options.templateName) {
        // Get template by name from database
        templateContent = await this.getTemplateByName(options.templateName);
      } else {
        throw new Error('Template content, ID, or name must be provided');
      }
      
      // Compile template if not in cache
      let template = this.templateCache.get(templateContent);
      
      if (!template) {
        template = Handlebars.compile(templateContent);
        this.templateCache.set(templateContent, template);
      }
      
      // Merge default data with provided data
      const mergedData = { ...options.defaultData, ...options.data };
      
      // Render template with data
      return template(mergedData);
    } catch (error) {
      logger.error(`Failed to render template: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get template by ID from database
   * @param id Template ID
   * @returns Template content
   */
  private async getTemplateById(id: string): Promise<string> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('message_templates')
        .select('content')
        .eq('id', id)
        .single();
      
      if (error) {
        throw new Error(`Failed to get template: ${error.message}`);
      }
      
      if (!data) {
        throw new Error(`Template with ID ${id} not found`);
      }
      
      return data.content;
    } catch (error) {
      logger.error(`Failed to get template by ID: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get template by name from database
   * @param name Template name
   * @returns Template content
   */
  private async getTemplateByName(name: string): Promise<string> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('message_templates')
        .select('content')
        .eq('name', name)
        .single();
      
      if (error) {
        throw new Error(`Failed to get template: ${error.message}`);
      }
      
      if (!data) {
        throw new Error(`Template with name ${name} not found`);
      }
      
      return data.content;
    } catch (error) {
      logger.error(`Failed to get template by name: ${error}`);
      throw error;
    }
  }
  
  /**
   * Create a new template
   * @param template Template data
   * @returns Created template ID
   */
  async createTemplate(template: Omit<TemplateData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Validate template
      this.validateTemplate(template);
      
      // Create template in database
      const { data, error } = await supabaseClient.getClient()
        .from('message_templates')
        .insert([{
          ...template,
          createdAt: new Date(),
          updatedAt: new Date()
        }])
        .select('id')
        .single();
      
      if (error) {
        throw new Error(`Failed to create template: ${error.message}`);
      }
      
      return data.id;
    } catch (error) {
      logger.error(`Failed to create template: ${error}`);
      throw error;
    }
  }
  
  /**
   * Update an existing template
   * @param id Template ID
   * @param template Template data
   * @returns Success indicator
   */
  async updateTemplate(
    id: string, 
    template: Partial<Omit<TemplateData, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> {
    try {
      // Update template in database
      const { error } = await supabaseClient.getClient()
        .from('message_templates')
        .update({
          ...template,
          updatedAt: new Date()
        })
        .eq('id', id);
      
      if (error) {
        throw new Error(`Failed to update template: ${error.message}`);
      }
      
      // Clear cache for this template
      this.clearTemplateCache(id);
      
      return true;
    } catch (error) {
      logger.error(`Failed to update template: ${error}`);
      throw error;
    }
  }
  
  /**
   * Delete a template
   * @param id Template ID
   * @returns Success indicator
   */
  async deleteTemplate(id: string): Promise<boolean> {
    try {
      // Delete template from database
      const { error } = await supabaseClient.getClient()
        .from('message_templates')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new Error(`Failed to delete template: ${error.message}`);
      }
      
      // Clear cache for this template
      this.clearTemplateCache(id);
      
      return true;
    } catch (error) {
      logger.error(`Failed to delete template: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get all templates
   * @returns Array of templates
   */
  async getAllTemplates(): Promise<TemplateData[]> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('message_templates')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        throw new Error(`Failed to get templates: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      logger.error(`Failed to get all templates: ${error}`);
      throw error;
    }
  }
  
  /**
   * Clear template cache for a specific template
   * @param id Template ID
   */
  private async clearTemplateCache(id: string): Promise<void> {
    try {
      // Get template content
      const { data, error } = await supabaseClient.getClient()
        .from('message_templates')
        .select('content')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        return;
      }
      
      // Remove from cache
      this.templateCache.delete(data.content);
    } catch (error) {
      logger.warn(`Failed to clear template cache: ${error}`);
    }
  }
  
  /**
   * Validate a template
   * @param template Template to validate
   */
  private validateTemplate(template: Partial<TemplateData>): void {
    // Check required fields
    if (!template.name) {
      throw new Error('Template name is required');
    }
    
    if (!template.type) {
      throw new Error('Template type is required');
    }
    
    if (!template.format) {
      throw new Error('Template format is required');
    }
    
    if (!template.content) {
      throw new Error('Template content is required');
    }
    
    // Validate template syntax
    try {
      Handlebars.compile(template.content);
    } catch (error) {
      throw new Error(`Invalid template syntax: ${error}`);
    }
  }
}

// Create and export the template service instance
export const templateService = new TemplateService();
