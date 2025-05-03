/**
 * Property Reference Service
 * 
 * This service handles operations related to property reference images,
 * which provide visual examples of different property values.
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase';
import { logger } from '../../utils/logger';
import { 
  PropertyReferenceImage, 
  PropertyReferenceImageCreateInput,
  PropertyReferenceImageUpdateInput,
  PropertyReferenceImageQueryParams
} from '../../types/property-reference';

/**
 * Property Reference Service class
 */
export class PropertyReferenceService {
  private storageBucket = 'property-references';

  /**
   * Create a new property reference image
   */
  public async createPropertyReferenceImage(
    input: PropertyReferenceImageCreateInput
  ): Promise<PropertyReferenceImage> {
    try {
      const id = uuidv4();
      const filename = input.file instanceof File ? input.file.name : `${id}.bin`;
      const storagePath = `${input.materialType}/${input.propertyName}/${input.propertyValue}/${filename}`;

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase
        .getClient()
        .storage
        .from(this.storageBucket)
        .upload(storagePath, input.file);

      if (uploadError) {
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase
        .getClient()
        .storage
        .from(this.storageBucket)
        .getPublicUrl(storagePath);

      // Create image record
      const now = new Date();
      const imageData = {
        id,
        property_name: input.propertyName,
        property_value: input.propertyValue,
        material_type: input.materialType,
        storage_path: storagePath,
        filename,
        file_size: input.file instanceof File ? input.file.size : undefined,
        description: input.description,
        is_primary: input.isPrimary,
        created_at: now,
        updated_at: now
      };

      const { data, error } = await supabase
        .getClient()
        .from('property_reference_images')
        .insert(imageData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create property reference image: ${error.message}`);
      }

      return this.mapDatabaseRecordToPropertyReferenceImage({
        ...data,
        url: urlData.publicUrl
      });
    } catch (error) {
      logger.error('Failed to create property reference image', { error });
      throw error;
    }
  }

  /**
   * Get property reference images by query parameters
   */
  public async getPropertyReferenceImages(
    params: PropertyReferenceImageQueryParams
  ): Promise<PropertyReferenceImage[]> {
    try {
      let query = supabase
        .getClient()
        .from('property_reference_images')
        .select('*');

      if (params.propertyName) {
        query = query.eq('property_name', params.propertyName);
      }

      if (params.propertyValue) {
        query = query.eq('property_value', params.propertyValue);
      }

      if (params.materialType) {
        query = query.eq('material_type', params.materialType);
      }

      if (params.isPrimary !== undefined) {
        query = query.eq('is_primary', params.isPrimary);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get property reference images: ${error.message}`);
      }

      return Promise.all(data.map(async (record) => {
        // Get public URL for each image
        const { data: urlData } = supabase
          .getClient()
          .storage
          .from(this.storageBucket)
          .getPublicUrl(record.storage_path);

        return this.mapDatabaseRecordToPropertyReferenceImage({
          ...record,
          url: urlData.publicUrl
        });
      }));
    } catch (error) {
      logger.error('Failed to get property reference images', { error });
      throw error;
    }
  }

  /**
   * Update a property reference image
   */
  public async updatePropertyReferenceImage(
    input: PropertyReferenceImageUpdateInput
  ): Promise<PropertyReferenceImage> {
    try {
      const updateData: Record<string, any> = {
        updated_at: new Date()
      };

      if (input.description !== undefined) {
        updateData.description = input.description;
      }

      if (input.isPrimary !== undefined) {
        updateData.is_primary = input.isPrimary;
      }

      const { data, error } = await supabase
        .getClient()
        .from('property_reference_images')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update property reference image: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase
        .getClient()
        .storage
        .from(this.storageBucket)
        .getPublicUrl(data.storage_path);

      return this.mapDatabaseRecordToPropertyReferenceImage({
        ...data,
        url: urlData.publicUrl
      });
    } catch (error) {
      logger.error('Failed to update property reference image', { error });
      throw error;
    }
  }

  /**
   * Delete a property reference image
   */
  public async deletePropertyReferenceImage(id: string): Promise<void> {
    try {
      // Get the image record first to get the storage path
      const { data: imageData, error: getError } = await supabase
        .getClient()
        .from('property_reference_images')
        .select('storage_path')
        .eq('id', id)
        .single();

      if (getError) {
        throw new Error(`Failed to get property reference image: ${getError.message}`);
      }

      // Delete the image from storage
      const { error: storageError } = await supabase
        .getClient()
        .storage
        .from(this.storageBucket)
        .remove([imageData.storage_path]);

      if (storageError) {
        logger.warn(`Failed to delete image from storage: ${storageError.message}`);
      }

      // Delete the image record
      const { error } = await supabase
        .getClient()
        .from('property_reference_images')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete property reference image: ${error.message}`);
      }
    } catch (error) {
      logger.error('Failed to delete property reference image', { error });
      throw error;
    }
  }

  /**
   * Map a database record to a PropertyReferenceImage object
   */
  private mapDatabaseRecordToPropertyReferenceImage(record: any): PropertyReferenceImage {
    return {
      id: record.id,
      propertyName: record.property_name,
      propertyValue: record.property_value,
      materialType: record.material_type,
      storagePath: record.storage_path,
      filename: record.filename,
      fileSize: record.file_size,
      width: record.width,
      height: record.height,
      format: record.format,
      description: record.description,
      isPrimary: record.is_primary,
      url: record.url,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
      createdBy: record.created_by
    };
  }
}

// Export a singleton instance
export const propertyReferenceService = new PropertyReferenceService();
