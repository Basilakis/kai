/**
 * Multilingual Dictionary Service
 * 
 * Service for managing multilingual property dictionaries.
 */

import { supabase } from '../../config/supabase';
import {
  LanguageCode,
  LanguageCodeCreateInput,
  LanguageCodeUpdateInput,
  PropertyNameTranslation,
  PropertyNameTranslationCreateInput,
  PropertyNameTranslationUpdateInput,
  PropertyValueTranslation,
  PropertyValueTranslationCreateInput,
  PropertyValueTranslationUpdateInput,
  MultilingualProperty,
  MultilingualPropertyValue,
  MultilingualMaterialProperties
} from '../../types/multilingual-dictionaries';

/**
 * Multilingual Dictionary Service
 */
class MultilingualDictionaryService {
  // Singleton instance
  private static instance: MultilingualDictionaryService;

  /**
   * Get the singleton instance
   */
  public static getInstance(): MultilingualDictionaryService {
    if (!MultilingualDictionaryService.instance) {
      MultilingualDictionaryService.instance = new MultilingualDictionaryService();
    }
    return MultilingualDictionaryService.instance;
  }

  /**
   * Get all language codes
   * 
   * @param activeOnly Only return active language codes
   * @returns List of language codes
   */
  public async getLanguageCodes(activeOnly: boolean = true): Promise<LanguageCode[]> {
    let query = supabase
      .from('language_codes')
      .select('*');
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query.order('name');
    
    if (error) {
      throw new Error(`Failed to get language codes: ${error.message}`);
    }
    
    return data.map(this.mapLanguageCodeFromDb);
  }

  /**
   * Get a language code by code
   * 
   * @param code Language code
   * @returns The language code
   */
  public async getLanguageCodeByCode(code: string): Promise<LanguageCode> {
    const { data, error } = await supabase
      .from('language_codes')
      .select('*')
      .eq('code', code)
      .single();
    
    if (error) {
      throw new Error(`Failed to get language code: ${error.message}`);
    }
    
    return this.mapLanguageCodeFromDb(data);
  }

  /**
   * Create a new language code
   * 
   * @param input Language code data
   * @returns The created language code
   */
  public async createLanguageCode(input: LanguageCodeCreateInput): Promise<LanguageCode> {
    const { data, error } = await supabase
      .from('language_codes')
      .insert({
        code: input.code,
        name: input.name,
        native_name: input.nativeName,
        is_active: input.isActive
      })
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to create language code: ${error.message}`);
    }
    
    return this.mapLanguageCodeFromDb(data);
  }

  /**
   * Update a language code
   * 
   * @param input Update data
   * @returns The updated language code
   */
  public async updateLanguageCode(input: LanguageCodeUpdateInput): Promise<LanguageCode> {
    const updateData: Record<string, any> = {};
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.nativeName !== undefined) updateData.native_name = input.nativeName;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;
    
    updateData.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('language_codes')
      .update(updateData)
      .eq('code', input.code)
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to update language code: ${error.message}`);
    }
    
    return this.mapLanguageCodeFromDb(data);
  }

  /**
   * Get property name translations
   * 
   * @param propertyName Optional property name filter
   * @param languageCode Optional language code filter
   * @returns List of property name translations
   */
  public async getPropertyNameTranslations(
    propertyName?: string,
    languageCode?: string
  ): Promise<PropertyNameTranslation[]> {
    let query = supabase
      .from('property_name_translations')
      .select('*');
    
    if (propertyName) {
      query = query.eq('property_name', propertyName);
    }
    
    if (languageCode) {
      query = query.eq('language_code', languageCode);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get property name translations: ${error.message}`);
    }
    
    return data.map(this.mapPropertyNameTranslationFromDb);
  }

  /**
   * Get a property name translation by ID
   * 
   * @param id Translation ID
   * @returns The property name translation
   */
  public async getPropertyNameTranslationById(id: string): Promise<PropertyNameTranslation> {
    const { data, error } = await supabase
      .from('property_name_translations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(`Failed to get property name translation: ${error.message}`);
    }
    
    return this.mapPropertyNameTranslationFromDb(data);
  }

  /**
   * Create a new property name translation
   * 
   * @param input Property name translation data
   * @returns The created property name translation
   */
  public async createPropertyNameTranslation(
    input: PropertyNameTranslationCreateInput
  ): Promise<PropertyNameTranslation> {
    const { data, error } = await supabase
      .from('property_name_translations')
      .insert({
        property_name: input.propertyName,
        language_code: input.languageCode,
        translation: input.translation,
        description: input.description
      })
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to create property name translation: ${error.message}`);
    }
    
    return this.mapPropertyNameTranslationFromDb(data);
  }

  /**
   * Update a property name translation
   * 
   * @param input Update data
   * @returns The updated property name translation
   */
  public async updatePropertyNameTranslation(
    input: PropertyNameTranslationUpdateInput
  ): Promise<PropertyNameTranslation> {
    const updateData: Record<string, any> = {};
    
    if (input.translation !== undefined) updateData.translation = input.translation;
    if (input.description !== undefined) updateData.description = input.description;
    
    updateData.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('property_name_translations')
      .update(updateData)
      .eq('id', input.id)
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to update property name translation: ${error.message}`);
    }
    
    return this.mapPropertyNameTranslationFromDb(data);
  }

  /**
   * Delete a property name translation
   * 
   * @param id Translation ID
   * @returns True if successful
   */
  public async deletePropertyNameTranslation(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('property_name_translations')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to delete property name translation: ${error.message}`);
    }
    
    return true;
  }

  /**
   * Get property value translations
   * 
   * @param propertyName Optional property name filter
   * @param propertyValue Optional property value filter
   * @param languageCode Optional language code filter
   * @returns List of property value translations
   */
  public async getPropertyValueTranslations(
    propertyName?: string,
    propertyValue?: string,
    languageCode?: string
  ): Promise<PropertyValueTranslation[]> {
    let query = supabase
      .from('property_value_translations')
      .select('*');
    
    if (propertyName) {
      query = query.eq('property_name', propertyName);
    }
    
    if (propertyValue) {
      query = query.eq('property_value', propertyValue);
    }
    
    if (languageCode) {
      query = query.eq('language_code', languageCode);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get property value translations: ${error.message}`);
    }
    
    return data.map(this.mapPropertyValueTranslationFromDb);
  }

  /**
   * Get a property value translation by ID
   * 
   * @param id Translation ID
   * @returns The property value translation
   */
  public async getPropertyValueTranslationById(id: string): Promise<PropertyValueTranslation> {
    const { data, error } = await supabase
      .from('property_value_translations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(`Failed to get property value translation: ${error.message}`);
    }
    
    return this.mapPropertyValueTranslationFromDb(data);
  }

  /**
   * Create a new property value translation
   * 
   * @param input Property value translation data
   * @returns The created property value translation
   */
  public async createPropertyValueTranslation(
    input: PropertyValueTranslationCreateInput
  ): Promise<PropertyValueTranslation> {
    const { data, error } = await supabase
      .from('property_value_translations')
      .insert({
        property_name: input.propertyName,
        property_value: input.propertyValue,
        language_code: input.languageCode,
        translation: input.translation,
        description: input.description
      })
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to create property value translation: ${error.message}`);
    }
    
    return this.mapPropertyValueTranslationFromDb(data);
  }

  /**
   * Update a property value translation
   * 
   * @param input Update data
   * @returns The updated property value translation
   */
  public async updatePropertyValueTranslation(
    input: PropertyValueTranslationUpdateInput
  ): Promise<PropertyValueTranslation> {
    const updateData: Record<string, any> = {};
    
    if (input.translation !== undefined) updateData.translation = input.translation;
    if (input.description !== undefined) updateData.description = input.description;
    
    updateData.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('property_value_translations')
      .update(updateData)
      .eq('id', input.id)
      .select('*')
      .single();
    
    if (error) {
      throw new Error(`Failed to update property value translation: ${error.message}`);
    }
    
    return this.mapPropertyValueTranslationFromDb(data);
  }

  /**
   * Delete a property value translation
   * 
   * @param id Translation ID
   * @returns True if successful
   */
  public async deletePropertyValueTranslation(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('property_value_translations')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to delete property value translation: ${error.message}`);
    }
    
    return true;
  }

  /**
   * Get multilingual property names
   * 
   * @param languageCodes Language codes to include
   * @returns List of multilingual properties
   */
  public async getMultilingualProperties(
    languageCodes: string[] = ['en']
  ): Promise<MultilingualProperty[]> {
    try {
      // Get all property name translations for the requested languages
      const translations = await this.getPropertyNameTranslations(undefined, undefined);
      
      // Group translations by property name
      const translationsByProperty: Record<string, Record<string, string>> = {};
      
      for (const translation of translations) {
        if (!translationsByProperty[translation.propertyName]) {
          translationsByProperty[translation.propertyName] = {};
        }
        
        translationsByProperty[translation.propertyName][translation.languageCode] = translation.translation;
      }
      
      // Convert to multilingual properties
      const multilingualProperties: MultilingualProperty[] = [];
      
      for (const [propertyName, translations] of Object.entries(translationsByProperty)) {
        // Filter translations to only include requested languages
        const filteredTranslations: Record<string, string> = {};
        
        for (const languageCode of languageCodes) {
          if (translations[languageCode]) {
            filteredTranslations[languageCode] = translations[languageCode];
          }
        }
        
        // Add English as fallback if not already included
        if (!filteredTranslations['en'] && translations['en']) {
          filteredTranslations['en'] = translations['en'];
        }
        
        multilingualProperties.push({
          name: propertyName,
          translations: filteredTranslations
        });
      }
      
      return multilingualProperties;
    } catch (error) {
      throw new Error(`Failed to get multilingual properties: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get multilingual property values
   * 
   * @param propertyName Property name
   * @param languageCodes Language codes to include
   * @returns List of multilingual property values
   */
  public async getMultilingualPropertyValues(
    propertyName: string,
    languageCodes: string[] = ['en']
  ): Promise<MultilingualPropertyValue[]> {
    try {
      // Get all property value translations for the requested property
      const translations = await this.getPropertyValueTranslations(propertyName, undefined, undefined);
      
      // Group translations by property value
      const translationsByValue: Record<string, Record<string, string>> = {};
      
      for (const translation of translations) {
        if (!translationsByValue[translation.propertyValue]) {
          translationsByValue[translation.propertyValue] = {};
        }
        
        translationsByValue[translation.propertyValue][translation.languageCode] = translation.translation;
      }
      
      // Convert to multilingual property values
      const multilingualValues: MultilingualPropertyValue[] = [];
      
      for (const [propertyValue, translations] of Object.entries(translationsByValue)) {
        // Filter translations to only include requested languages
        const filteredTranslations: Record<string, string> = {};
        
        for (const languageCode of languageCodes) {
          if (translations[languageCode]) {
            filteredTranslations[languageCode] = translations[languageCode];
          }
        }
        
        // Add English as fallback if not already included
        if (!filteredTranslations['en'] && translations['en']) {
          filteredTranslations['en'] = translations['en'];
        }
        
        multilingualValues.push({
          propertyName,
          value: propertyValue,
          translations: filteredTranslations
        });
      }
      
      return multilingualValues;
    } catch (error) {
      throw new Error(`Failed to get multilingual property values: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get multilingual material properties
   * 
   * @param materialId Material ID
   * @param properties Material properties
   * @param languageCodes Language codes to include
   * @returns Multilingual material properties
   */
  public async getMultilingualMaterialProperties(
    materialId: string,
    properties: Record<string, string>,
    languageCodes: string[] = ['en']
  ): Promise<MultilingualMaterialProperties> {
    try {
      // Initialize translations object
      const translations: Record<string, Record<string, string>> = {};
      
      // Process each property
      for (const [propertyName, propertyValue] of Object.entries(properties)) {
        // Skip empty values
        if (!propertyValue) continue;
        
        // Get translations for this property name
        const nameTranslations = await this.getPropertyNameTranslations(propertyName, undefined);
        
        // Get translations for this property value
        const valueTranslations = await this.getPropertyValueTranslations(propertyName, propertyValue, undefined);
        
        // Add property name translations
        for (const translation of nameTranslations) {
          if (languageCodes.includes(translation.languageCode) || translation.languageCode === 'en') {
            if (!translations[translation.languageCode]) {
              translations[translation.languageCode] = {};
            }
            
            translations[translation.languageCode][`${propertyName}_name`] = translation.translation;
          }
        }
        
        // Add property value translations
        for (const translation of valueTranslations) {
          if (languageCodes.includes(translation.languageCode) || translation.languageCode === 'en') {
            if (!translations[translation.languageCode]) {
              translations[translation.languageCode] = {};
            }
            
            translations[translation.languageCode][propertyName] = translation.translation;
          }
        }
      }
      
      return {
        materialId,
        properties,
        translations
      };
    } catch (error) {
      throw new Error(`Failed to get multilingual material properties: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Translate a property name
   * 
   * @param propertyName Property name
   * @param sourceLanguage Source language code
   * @param targetLanguage Target language code
   * @returns Translated property name
   */
  public async translatePropertyName(
    propertyName: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      // Get translation for target language
      const targetTranslations = await this.getPropertyNameTranslations(propertyName, targetLanguage);
      
      if (targetTranslations.length > 0) {
        return targetTranslations[0].translation;
      }
      
      // If no translation found, return original property name
      return propertyName;
    } catch (error) {
      throw new Error(`Failed to translate property name: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Translate a property value
   * 
   * @param propertyName Property name
   * @param propertyValue Property value
   * @param sourceLanguage Source language code
   * @param targetLanguage Target language code
   * @returns Translated property value
   */
  public async translatePropertyValue(
    propertyName: string,
    propertyValue: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      // Get translation for target language
      const targetTranslations = await this.getPropertyValueTranslations(
        propertyName,
        propertyValue,
        targetLanguage
      );
      
      if (targetTranslations.length > 0) {
        return targetTranslations[0].translation;
      }
      
      // If no translation found, return original property value
      return propertyValue;
    } catch (error) {
      throw new Error(`Failed to translate property value: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Map a database language code to the TypeScript type
   * 
   * @param data Database language code
   * @returns Mapped language code
   */
  private mapLanguageCodeFromDb(data: any): LanguageCode {
    return {
      code: data.code,
      name: data.name,
      nativeName: data.native_name,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map a database property name translation to the TypeScript type
   * 
   * @param data Database property name translation
   * @returns Mapped property name translation
   */
  private mapPropertyNameTranslationFromDb(data: any): PropertyNameTranslation {
    return {
      id: data.id,
      propertyName: data.property_name,
      languageCode: data.language_code,
      translation: data.translation,
      description: data.description,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
  }

  /**
   * Map a database property value translation to the TypeScript type
   * 
   * @param data Database property value translation
   * @returns Mapped property value translation
   */
  private mapPropertyValueTranslationFromDb(data: any): PropertyValueTranslation {
    return {
      id: data.id,
      propertyName: data.property_name,
      propertyValue: data.property_value,
      languageCode: data.language_code,
      translation: data.translation,
      description: data.description,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
  }
}

// Export the singleton instance
export const multilingualDictionaryService = MultilingualDictionaryService.getInstance();
