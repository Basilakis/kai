import { supabase } from '../../lib/supabase';
import {
  VisualReference,
  VisualReferenceImage,
  VisualReferenceAnnotation,
  VisualReferenceTag,
  VisualReferenceWithImages,
  VisualReferenceImageWithAnnotations,
  VisualReferenceCreateInput,
  VisualReferenceUpdateInput,
  VisualReferenceImageCreateInput,
  VisualReferenceImageUpdateInput,
  VisualReferenceAnnotationCreateInput,
  VisualReferenceAnnotationUpdateInput,
  VisualReferenceTagCreateInput,
  VisualReferenceSearchInput
} from '../../types/visualReference';

/**
 * Visual Reference Service
 * 
 * Service for managing visual references for material properties.
 */
class VisualReferenceService {
  private static instance: VisualReferenceService;

  private constructor() {}

  /**
   * Get the singleton instance of the VisualReferenceService
   * 
   * @returns The VisualReferenceService instance
   */
  public static getInstance(): VisualReferenceService {
    if (!VisualReferenceService.instance) {
      VisualReferenceService.instance = new VisualReferenceService();
    }
    return VisualReferenceService.instance;
  }

  /**
   * Get all visual references with optional filtering
   * 
   * @param propertyName Optional property name filter
   * @param propertyValue Optional property value filter
   * @param materialType Optional material type filter
   * @param activeOnly Only return active visual references
   * @returns Array of visual references
   */
  public async getVisualReferences(
    propertyName?: string,
    propertyValue?: string,
    materialType?: string,
    activeOnly: boolean = true
  ): Promise<VisualReference[]> {
    try {
      let query = supabase
        .from('visual_references')
        .select('*');
      
      if (propertyName) {
        query = query.eq('property_name', propertyName);
      }
      
      if (propertyValue) {
        query = query.eq('property_value', propertyValue);
      }
      
      if (materialType) {
        query = query.eq('material_type', materialType);
      }
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return data.map(this.mapVisualReferenceFromDb);
    } catch (error) {
      throw new Error(`Failed to get visual references: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a visual reference by ID
   * 
   * @param id Visual reference ID
   * @returns Visual reference
   */
  public async getVisualReferenceById(id: string): Promise<VisualReference> {
    try {
      const { data, error } = await supabase
        .from('visual_references')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapVisualReferenceFromDb(data);
    } catch (error) {
      throw new Error(`Failed to get visual reference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a visual reference with its images
   * 
   * @param id Visual reference ID
   * @returns Visual reference with images
   */
  public async getVisualReferenceWithImages(id: string): Promise<VisualReferenceWithImages> {
    try {
      const reference = await this.getVisualReferenceById(id);
      const images = await this.getVisualReferenceImages(id);
      
      return {
        ...reference,
        images
      };
    } catch (error) {
      throw new Error(`Failed to get visual reference with images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new visual reference
   * 
   * @param input Visual reference create input
   * @param userId User ID of the creator
   * @returns Created visual reference
   */
  public async createVisualReference(
    input: VisualReferenceCreateInput,
    userId: string
  ): Promise<VisualReference> {
    try {
      const { data, error } = await supabase
        .from('visual_references')
        .insert({
          title: input.title,
          description: input.description,
          property_name: input.propertyName,
          property_value: input.propertyValue,
          material_type: input.materialType,
          source: input.source,
          source_url: input.sourceUrl,
          is_active: true,
          created_by: userId
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // If tags were provided, create them
      if (input.tags && input.tags.length > 0) {
        const tagPromises = input.tags.map(tag => 
          this.createVisualReferenceTag({ referenceId: data.id, tag }, userId)
        );
        await Promise.all(tagPromises);
      }
      
      return this.mapVisualReferenceFromDb(data);
    } catch (error) {
      throw new Error(`Failed to create visual reference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update a visual reference
   * 
   * @param input Visual reference update input
   * @returns Updated visual reference
   */
  public async updateVisualReference(input: VisualReferenceUpdateInput): Promise<VisualReference> {
    try {
      const updateData: any = {};
      
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.propertyName !== undefined) updateData.property_name = input.propertyName;
      if (input.propertyValue !== undefined) updateData.property_value = input.propertyValue;
      if (input.materialType !== undefined) updateData.material_type = input.materialType;
      if (input.source !== undefined) updateData.source = input.source;
      if (input.sourceUrl !== undefined) updateData.source_url = input.sourceUrl;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      
      updateData.updated_at = new Date();
      
      const { data, error } = await supabase
        .from('visual_references')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapVisualReferenceFromDb(data);
    } catch (error) {
      throw new Error(`Failed to update visual reference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a visual reference
   * 
   * @param id Visual reference ID
   * @returns True if successful
   */
  public async deleteVisualReference(id: string): Promise<boolean> {
    try {
      // First, delete all related entities
      await this.deleteAllVisualReferenceImages(id);
      await this.deleteAllVisualReferenceTags(id);
      
      // Then delete the reference itself
      const { error } = await supabase
        .from('visual_references')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete visual reference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get images for a visual reference
   * 
   * @param referenceId Visual reference ID
   * @returns Array of visual reference images
   */
  public async getVisualReferenceImages(referenceId: string): Promise<VisualReferenceImage[]> {
    try {
      const { data, error } = await supabase
        .from('visual_reference_images')
        .select('*')
        .eq('reference_id', referenceId)
        .order('is_primary', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return data.map(this.mapVisualReferenceImageFromDb);
    } catch (error) {
      throw new Error(`Failed to get visual reference images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a visual reference image by ID
   * 
   * @param id Image ID
   * @returns Visual reference image
   */
  public async getVisualReferenceImageById(id: string): Promise<VisualReferenceImage> {
    try {
      const { data, error } = await supabase
        .from('visual_reference_images')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapVisualReferenceImageFromDb(data);
    } catch (error) {
      throw new Error(`Failed to get visual reference image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a visual reference image with its annotations
   * 
   * @param id Image ID
   * @returns Visual reference image with annotations
   */
  public async getVisualReferenceImageWithAnnotations(id: string): Promise<VisualReferenceImageWithAnnotations> {
    try {
      const image = await this.getVisualReferenceImageById(id);
      const annotations = await this.getVisualReferenceAnnotations(id);
      
      return {
        ...image,
        annotations
      };
    } catch (error) {
      throw new Error(`Failed to get visual reference image with annotations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new visual reference image
   * 
   * @param input Visual reference image create input
   * @param fileData File data including URL, dimensions, etc.
   * @param userId User ID of the creator
   * @returns Created visual reference image
   */
  public async createVisualReferenceImage(
    input: VisualReferenceImageCreateInput,
    fileData: {
      url: string;
      width: number;
      height: number;
      fileSize: number;
      fileType: string;
    },
    userId: string
  ): Promise<VisualReferenceImage> {
    try {
      // If this is a primary image, update all other images to non-primary
      if (input.isPrimary) {
        await supabase
          .from('visual_reference_images')
          .update({ is_primary: false })
          .eq('reference_id', input.referenceId);
      }
      
      const { data, error } = await supabase
        .from('visual_reference_images')
        .insert({
          reference_id: input.referenceId,
          url: fileData.url,
          caption: input.caption,
          is_primary: input.isPrimary,
          width: fileData.width,
          height: fileData.height,
          file_size: fileData.fileSize,
          file_type: fileData.fileType,
          created_by: userId
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapVisualReferenceImageFromDb(data);
    } catch (error) {
      throw new Error(`Failed to create visual reference image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update a visual reference image
   * 
   * @param input Visual reference image update input
   * @returns Updated visual reference image
   */
  public async updateVisualReferenceImage(input: VisualReferenceImageUpdateInput): Promise<VisualReferenceImage> {
    try {
      // Get the current image to get the reference ID
      const currentImage = await this.getVisualReferenceImageById(input.id);
      
      // If setting this as primary, update all other images to non-primary
      if (input.isPrimary) {
        await supabase
          .from('visual_reference_images')
          .update({ is_primary: false })
          .eq('reference_id', currentImage.referenceId);
      }
      
      const updateData: any = {};
      
      if (input.caption !== undefined) updateData.caption = input.caption;
      if (input.isPrimary !== undefined) updateData.is_primary = input.isPrimary;
      
      updateData.updated_at = new Date();
      
      const { data, error } = await supabase
        .from('visual_reference_images')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapVisualReferenceImageFromDb(data);
    } catch (error) {
      throw new Error(`Failed to update visual reference image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a visual reference image
   * 
   * @param id Image ID
   * @returns True if successful
   */
  public async deleteVisualReferenceImage(id: string): Promise<boolean> {
    try {
      // First, delete all annotations for this image
      await this.deleteAllVisualReferenceAnnotations(id);
      
      // Then delete the image itself
      const { error } = await supabase
        .from('visual_reference_images')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete visual reference image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete all images for a visual reference
   * 
   * @param referenceId Visual reference ID
   * @returns True if successful
   */
  private async deleteAllVisualReferenceImages(referenceId: string): Promise<boolean> {
    try {
      // Get all images for this reference
      const images = await this.getVisualReferenceImages(referenceId);
      
      // Delete each image (which will also delete annotations)
      for (const image of images) {
        await this.deleteVisualReferenceImage(image.id);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete all visual reference images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get annotations for a visual reference image
   * 
   * @param imageId Image ID
   * @returns Array of visual reference annotations
   */
  public async getVisualReferenceAnnotations(imageId: string): Promise<VisualReferenceAnnotation[]> {
    try {
      const { data, error } = await supabase
        .from('visual_reference_annotations')
        .select('*')
        .eq('image_id', imageId);
      
      if (error) {
        throw error;
      }
      
      return data.map(this.mapVisualReferenceAnnotationFromDb);
    } catch (error) {
      throw new Error(`Failed to get visual reference annotations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a visual reference annotation by ID
   * 
   * @param id Annotation ID
   * @returns Visual reference annotation
   */
  public async getVisualReferenceAnnotationById(id: string): Promise<VisualReferenceAnnotation> {
    try {
      const { data, error } = await supabase
        .from('visual_reference_annotations')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapVisualReferenceAnnotationFromDb(data);
    } catch (error) {
      throw new Error(`Failed to get visual reference annotation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new visual reference annotation
   * 
   * @param input Visual reference annotation create input
   * @param userId User ID of the creator
   * @returns Created visual reference annotation
   */
  public async createVisualReferenceAnnotation(
    input: VisualReferenceAnnotationCreateInput,
    userId: string
  ): Promise<VisualReferenceAnnotation> {
    try {
      const { data, error } = await supabase
        .from('visual_reference_annotations')
        .insert({
          image_id: input.imageId,
          x: input.x,
          y: input.y,
          width: input.width,
          height: input.height,
          text: input.text,
          type: input.type,
          color: input.color,
          created_by: userId
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapVisualReferenceAnnotationFromDb(data);
    } catch (error) {
      throw new Error(`Failed to create visual reference annotation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update a visual reference annotation
   * 
   * @param input Visual reference annotation update input
   * @returns Updated visual reference annotation
   */
  public async updateVisualReferenceAnnotation(input: VisualReferenceAnnotationUpdateInput): Promise<VisualReferenceAnnotation> {
    try {
      const updateData: any = {};
      
      if (input.x !== undefined) updateData.x = input.x;
      if (input.y !== undefined) updateData.y = input.y;
      if (input.width !== undefined) updateData.width = input.width;
      if (input.height !== undefined) updateData.height = input.height;
      if (input.text !== undefined) updateData.text = input.text;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.color !== undefined) updateData.color = input.color;
      
      updateData.updated_at = new Date();
      
      const { data, error } = await supabase
        .from('visual_reference_annotations')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapVisualReferenceAnnotationFromDb(data);
    } catch (error) {
      throw new Error(`Failed to update visual reference annotation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a visual reference annotation
   * 
   * @param id Annotation ID
   * @returns True if successful
   */
  public async deleteVisualReferenceAnnotation(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('visual_reference_annotations')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete visual reference annotation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete all annotations for a visual reference image
   * 
   * @param imageId Image ID
   * @returns True if successful
   */
  private async deleteAllVisualReferenceAnnotations(imageId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('visual_reference_annotations')
        .delete()
        .eq('image_id', imageId);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete all visual reference annotations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get tags for a visual reference
   * 
   * @param referenceId Visual reference ID
   * @returns Array of visual reference tags
   */
  public async getVisualReferenceTags(referenceId: string): Promise<VisualReferenceTag[]> {
    try {
      const { data, error } = await supabase
        .from('visual_reference_tags')
        .select('*')
        .eq('reference_id', referenceId);
      
      if (error) {
        throw error;
      }
      
      return data.map(this.mapVisualReferenceTagFromDb);
    } catch (error) {
      throw new Error(`Failed to get visual reference tags: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new visual reference tag
   * 
   * @param input Visual reference tag create input
   * @param userId User ID of the creator
   * @returns Created visual reference tag
   */
  public async createVisualReferenceTag(
    input: VisualReferenceTagCreateInput,
    userId: string
  ): Promise<VisualReferenceTag> {
    try {
      const { data, error } = await supabase
        .from('visual_reference_tags')
        .insert({
          reference_id: input.referenceId,
          tag: input.tag,
          created_by: userId
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return this.mapVisualReferenceTagFromDb(data);
    } catch (error) {
      throw new Error(`Failed to create visual reference tag: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a visual reference tag
   * 
   * @param id Tag ID
   * @returns True if successful
   */
  public async deleteVisualReferenceTag(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('visual_reference_tags')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete visual reference tag: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete all tags for a visual reference
   * 
   * @param referenceId Visual reference ID
   * @returns True if successful
   */
  private async deleteAllVisualReferenceTags(referenceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('visual_reference_tags')
        .delete()
        .eq('reference_id', referenceId);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete all visual reference tags: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search for visual references
   * 
   * @param input Search input
   * @returns Array of visual references
   */
  public async searchVisualReferences(input: VisualReferenceSearchInput): Promise<VisualReference[]> {
    try {
      let query = supabase
        .from('visual_references')
        .select('*');
      
      if (input.propertyName) {
        query = query.eq('property_name', input.propertyName);
      }
      
      if (input.propertyValue) {
        query = query.eq('property_value', input.propertyValue);
      }
      
      if (input.materialType) {
        query = query.eq('material_type', input.materialType);
      }
      
      if (input.query) {
        query = query.or(`title.ilike.%${input.query}%,description.ilike.%${input.query}%`);
      }
      
      // Handle tags separately if needed
      if (input.tags && input.tags.length > 0) {
        // This is a simplified approach - in a real implementation, you'd need a more sophisticated query
        // to handle tag filtering properly, possibly with a join or a subquery
        const taggedReferenceIds = await this.getVisualReferenceIdsByTags(input.tags);
        if (taggedReferenceIds.length > 0) {
          query = query.in('id', taggedReferenceIds);
        } else {
          // If no references match the tags, return empty array
          return [];
        }
      }
      
      // Add pagination
      query = query
        .limit(input.limit || 20)
        .offset(input.offset || 0)
        .order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      return data.map(this.mapVisualReferenceFromDb);
    } catch (error) {
      throw new Error(`Failed to search visual references: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get visual reference IDs by tags
   * 
   * @param tags Array of tags
   * @returns Array of visual reference IDs
   */
  private async getVisualReferenceIdsByTags(tags: string[]): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('visual_reference_tags')
        .select('reference_id')
        .in('tag', tags);
      
      if (error) {
        throw error;
      }
      
      // Extract unique reference IDs
      const referenceIds = [...new Set(data.map(item => item.reference_id))];
      return referenceIds;
    } catch (error) {
      throw new Error(`Failed to get visual reference IDs by tags: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Map a database visual reference to the TypeScript type
   * 
   * @param data Database visual reference
   * @returns Mapped visual reference
   */
  private mapVisualReferenceFromDb(data: any): VisualReference {
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      propertyName: data.property_name,
      propertyValue: data.property_value,
      materialType: data.material_type,
      source: data.source,
      sourceUrl: data.source_url,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
  }

  /**
   * Map a database visual reference image to the TypeScript type
   * 
   * @param data Database visual reference image
   * @returns Mapped visual reference image
   */
  private mapVisualReferenceImageFromDb(data: any): VisualReferenceImage {
    return {
      id: data.id,
      referenceId: data.reference_id,
      url: data.url,
      caption: data.caption,
      isPrimary: data.is_primary,
      width: data.width,
      height: data.height,
      fileSize: data.file_size,
      fileType: data.file_type,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
  }

  /**
   * Map a database visual reference annotation to the TypeScript type
   * 
   * @param data Database visual reference annotation
   * @returns Mapped visual reference annotation
   */
  private mapVisualReferenceAnnotationFromDb(data: any): VisualReferenceAnnotation {
    return {
      id: data.id,
      imageId: data.image_id,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      text: data.text,
      type: data.type,
      color: data.color,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
  }

  /**
   * Map a database visual reference tag to the TypeScript type
   * 
   * @param data Database visual reference tag
   * @returns Mapped visual reference tag
   */
  private mapVisualReferenceTagFromDb(data: any): VisualReferenceTag {
    return {
      id: data.id,
      referenceId: data.reference_id,
      tag: data.tag,
      createdAt: new Date(data.created_at),
      createdBy: data.created_by
    };
  }
}

// Export the singleton instance
export const visualReferenceService = VisualReferenceService.getInstance();
