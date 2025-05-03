/**
 * Classification Service
 *
 * Service for managing enhanced material classification.
 */

import { supabase } from '../../config/supabase';
import {
  ClassificationSystem,
  ClassificationSystemCreateInput,
  ClassificationSystemUpdateInput,
  ClassificationCategory,
  ClassificationCategoryCreateInput,
  ClassificationCategoryUpdateInput,
  MaterialClassification,
  MaterialClassificationCreateInput,
  MaterialClassificationUpdateInput,
  ClassificationMapping,
  ClassificationMappingCreateInput,
  ClassificationMappingUpdateInput,
  ClassificationTreeNode,
  ClassificationSystemWithCategories,
  ClassificationSystemWithTree,
  MaterialWithClassifications,
  MappingType
} from '../../types/classification';

/**
 * Classification Service
 */
class ClassificationService {
  // Singleton instance
  private static instance: ClassificationService;

  /**
   * Get the singleton instance
   */
  public static getInstance(): ClassificationService {
    if (!ClassificationService.instance) {
      ClassificationService.instance = new ClassificationService();
    }
    return ClassificationService.instance;
  }

  /**
   * Get all classification systems
   *
   * @param activeOnly Only return active classification systems
   * @returns List of classification systems
   */
  public async getClassificationSystems(activeOnly: boolean = true): Promise<ClassificationSystem[]> {
    let query = supabase
      .from('classification_systems')
      .select('*');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('name');

    if (error) {
      throw new Error(`Failed to get classification systems: ${error.message}`);
    }

    return data.map(this.mapClassificationSystemFromDb);
  }

  /**
   * Get a classification system by ID
   *
   * @param id Classification system ID
   * @returns The classification system
   */
  public async getClassificationSystemById(id: string): Promise<ClassificationSystem> {
    const { data, error } = await supabase
      .from('classification_systems')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to get classification system: ${error.message}`);
    }

    return this.mapClassificationSystemFromDb(data);
  }

  /**
   * Get a classification system by code
   *
   * @param code Classification system code
   * @returns The classification system
   */
  public async getClassificationSystemByCode(code: string): Promise<ClassificationSystem> {
    const { data, error } = await supabase
      .from('classification_systems')
      .select('*')
      .eq('code', code)
      .single();

    if (error) {
      throw new Error(`Failed to get classification system: ${error.message}`);
    }

    return this.mapClassificationSystemFromDb(data);
  }

  /**
   * Create a new classification system
   *
   * @param input Classification system data
   * @returns The created classification system
   */
  public async createClassificationSystem(input: ClassificationSystemCreateInput): Promise<ClassificationSystem> {
    const { data, error } = await supabase
      .from('classification_systems')
      .insert({
        name: input.name,
        code: input.code,
        description: input.description,
        version: input.version,
        is_hierarchical: input.isHierarchical,
        is_active: input.isActive
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create classification system: ${error.message}`);
    }

    return this.mapClassificationSystemFromDb(data);
  }

  /**
   * Update a classification system
   *
   * @param input Update data
   * @returns The updated classification system
   */
  public async updateClassificationSystem(input: ClassificationSystemUpdateInput): Promise<ClassificationSystem> {
    const updateData: Record<string, any> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.version !== undefined) updateData.version = input.version;
    if (input.isHierarchical !== undefined) updateData.is_hierarchical = input.isHierarchical;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('classification_systems')
      .update(updateData)
      .eq('id', input.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update classification system: ${error.message}`);
    }

    return this.mapClassificationSystemFromDb(data);
  }

  /**
   * Get classification categories
   *
   * @param systemId Optional system ID filter
   * @param parentId Optional parent ID filter
   * @param activeOnly Only return active categories
   * @returns List of classification categories
   */
  public async getClassificationCategories(
    systemId?: string,
    parentId?: string,
    activeOnly: boolean = true
  ): Promise<ClassificationCategory[]> {
    let query = supabase
      .from('classification_categories')
      .select('*');

    if (systemId) {
      query = query.eq('system_id', systemId);
    }

    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else if (parentId === null) {
      // Explicitly query for root categories (null parent_id)
      query = query.is('parent_id', null);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('path');

    if (error) {
      throw new Error(`Failed to get classification categories: ${error.message}`);
    }

    return data.map(this.mapClassificationCategoryFromDb);
  }

  /**
   * Get a classification category by ID
   *
   * @param id Classification category ID
   * @returns The classification category
   */
  public async getClassificationCategoryById(id: string): Promise<ClassificationCategory> {
    const { data, error } = await supabase
      .from('classification_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to get classification category: ${error.message}`);
    }

    return this.mapClassificationCategoryFromDb(data);
  }

  /**
   * Get a classification category by system ID and code
   *
   * @param systemId Classification system ID
   * @param code Classification category code
   * @returns The classification category
   */
  public async getClassificationCategoryByCode(systemId: string, code: string): Promise<ClassificationCategory> {
    const { data, error } = await supabase
      .from('classification_categories')
      .select('*')
      .eq('system_id', systemId)
      .eq('code', code)
      .single();

    if (error) {
      throw new Error(`Failed to get classification category: ${error.message}`);
    }

    return this.mapClassificationCategoryFromDb(data);
  }

  /**
   * Create a new classification category
   *
   * @param input Classification category data
   * @returns The created classification category
   */
  public async createClassificationCategory(input: ClassificationCategoryCreateInput): Promise<ClassificationCategory> {
    try {
      // Get the system to check if it's hierarchical
      const system = await this.getClassificationSystemById(input.systemId);

      // Calculate level and path
      let level = 1;
      let path = input.code;

      if (input.parentId && system.isHierarchical) {
        const parent = await this.getClassificationCategoryById(input.parentId);
        level = parent.level + 1;
        path = `${parent.path}.${input.code}`;
      }

      const { data, error } = await supabase
        .from('classification_categories')
        .insert({
          system_id: input.systemId,
          parent_id: input.parentId,
          code: input.code,
          name: input.name,
          description: input.description,
          level: input.level || level,
          path: input.path || path,
          is_active: input.isActive,
          metadata: input.metadata
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create classification category: ${error.message}`);
      }

      return this.mapClassificationCategoryFromDb(data);
    } catch (error) {
      throw new Error(`Failed to create classification category: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update a classification category
   *
   * @param input Update data
   * @returns The updated classification category
   */
  public async updateClassificationCategory(input: ClassificationCategoryUpdateInput): Promise<ClassificationCategory> {
    try {
      // Get the current category
      const currentCategory = await this.getClassificationCategoryById(input.id);

      // Get the system to check if it's hierarchical
      const system = await this.getClassificationSystemById(currentCategory.systemId);

      const updateData: Record<string, any> = {};

      if (input.parentId !== undefined) updateData.parent_id = input.parentId;
      if (input.code !== undefined) updateData.code = input.code;
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      if (input.metadata !== undefined) updateData.metadata = input.metadata;

      // Recalculate level and path if parent changed or code changed
      if ((input.parentId !== undefined && input.parentId !== currentCategory.parentId) ||
          (input.code !== undefined && input.code !== currentCategory.code)) {

        let level = 1;
        let path = input.code || currentCategory.code;

        if (input.parentId && system.isHierarchical) {
          const parent = await this.getClassificationCategoryById(input.parentId);
          level = parent.level + 1;
          path = `${parent.path}.${input.code || currentCategory.code}`;
        }

        updateData.level = level;
        updateData.path = path;

        // Update paths of all children
        await this.updateChildrenPaths(currentCategory.id, currentCategory.path, path);
      }

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('classification_categories')
        .update(updateData)
        .eq('id', input.id)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update classification category: ${error.message}`);
      }

      return this.mapClassificationCategoryFromDb(data);
    } catch (error) {
      throw new Error(`Failed to update classification category: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update paths of all children when a parent category's path changes
   *
   * @param parentId Parent category ID
   * @param oldParentPath Old parent path
   * @param newParentPath New parent path
   */
  private async updateChildrenPaths(parentId: string, oldParentPath: string, newParentPath: string): Promise<void> {
    try {
      // Get all children of the parent
      const children = await this.getClassificationCategories(undefined, parentId);

      for (const child of children) {
        // Update the child's path
        const newPath = child.path.replace(oldParentPath, newParentPath);

        await supabase
          .from('classification_categories')
          .update({
            path: newPath,
            updated_at: new Date().toISOString()
          })
          .eq('id', child.id);

        // Recursively update the paths of the child's children
        await this.updateChildrenPaths(child.id, child.path, newPath);
      }
    } catch (error) {
      throw new Error(`Failed to update children paths: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get material classifications
   *
   * @param materialId Optional material ID filter
   * @param categoryId Optional category ID filter
   * @param isPrimary Optional primary classification filter
   * @returns List of material classifications
   */
  public async getMaterialClassifications(
    materialId?: string,
    categoryId?: string,
    isPrimary?: boolean
  ): Promise<MaterialClassification[]> {
    let query = supabase
      .from('material_classifications')
      .select(`
        *,
        category:category_id(*)
      `);

    if (materialId) {
      query = query.eq('material_id', materialId);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (isPrimary !== undefined) {
      query = query.eq('is_primary', isPrimary);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get material classifications: ${error.message}`);
    }

    return data.map(this.mapMaterialClassificationFromDb);
  }

  /**
   * Get a material classification by ID
   *
   * @param id Material classification ID
   * @returns The material classification
   */
  public async getMaterialClassificationById(id: string): Promise<MaterialClassification> {
    const { data, error } = await supabase
      .from('material_classifications')
      .select(`
        *,
        category:category_id(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to get material classification: ${error.message}`);
    }

    return this.mapMaterialClassificationFromDb(data);
  }

  /**
   * Create a new material classification
   *
   * @param input Material classification data
   * @returns The created material classification
   */
  public async createMaterialClassification(input: MaterialClassificationCreateInput): Promise<MaterialClassification> {
    try {
      // If this is a primary classification, set all other classifications for this material to non-primary
      if (input.isPrimary) {
        await supabase
          .from('material_classifications')
          .update({ is_primary: false, updated_at: new Date().toISOString() })
          .eq('material_id', input.materialId)
          .eq('is_primary', true);
      }

      const { data, error } = await supabase
        .from('material_classifications')
        .insert({
          material_id: input.materialId,
          category_id: input.categoryId,
          is_primary: input.isPrimary,
          confidence: input.confidence,
          source: input.source
        })
        .select(`
          *,
          category:category_id(*)
        `)
        .single();

      if (error) {
        throw new Error(`Failed to create material classification: ${error.message}`);
      }

      return this.mapMaterialClassificationFromDb(data);
    } catch (error) {
      throw new Error(`Failed to create material classification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update a material classification
   *
   * @param input Update data
   * @returns The updated material classification
   */
  public async updateMaterialClassification(input: MaterialClassificationUpdateInput): Promise<MaterialClassification> {
    try {
      // Get the current classification
      const currentClassification = await this.getMaterialClassificationById(input.id);

      // If this is being set as primary, set all other classifications for this material to non-primary
      if (input.isPrimary && !currentClassification.isPrimary) {
        await supabase
          .from('material_classifications')
          .update({ is_primary: false, updated_at: new Date().toISOString() })
          .eq('material_id', currentClassification.materialId)
          .eq('is_primary', true);
      }

      const updateData: Record<string, any> = {};

      if (input.isPrimary !== undefined) updateData.is_primary = input.isPrimary;
      if (input.confidence !== undefined) updateData.confidence = input.confidence;
      if (input.source !== undefined) updateData.source = input.source;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('material_classifications')
        .update(updateData)
        .eq('id', input.id)
        .select(`
          *,
          category:category_id(*)
        `)
        .single();

      if (error) {
        throw new Error(`Failed to update material classification: ${error.message}`);
      }

      return this.mapMaterialClassificationFromDb(data);
    } catch (error) {
      throw new Error(`Failed to update material classification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a material classification
   *
   * @param id Material classification ID
   * @returns True if successful
   */
  public async deleteMaterialClassification(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('material_classifications')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete material classification: ${error.message}`);
    }

    return true;
  }

  /**
   * Get classification mappings
   *
   * @param sourceCategoryId Optional source category ID filter
   * @param targetCategoryId Optional target category ID filter
   * @param mappingType Optional mapping type filter
   * @returns List of classification mappings
   */
  public async getClassificationMappings(
    sourceCategoryId?: string,
    targetCategoryId?: string,
    mappingType?: MappingType
  ): Promise<ClassificationMapping[]> {
    let query = supabase
      .from('classification_mappings')
      .select(`
        *,
        sourceCategory:source_category_id(*),
        targetCategory:target_category_id(*)
      `);

    if (sourceCategoryId) {
      query = query.eq('source_category_id', sourceCategoryId);
    }

    if (targetCategoryId) {
      query = query.eq('target_category_id', targetCategoryId);
    }

    if (mappingType) {
      query = query.eq('mapping_type', mappingType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get classification mappings: ${error.message}`);
    }

    return data.map(this.mapClassificationMappingFromDb);
  }

  /**
   * Get a classification mapping by ID
   *
   * @param id Classification mapping ID
   * @returns The classification mapping
   */
  public async getClassificationMappingById(id: string): Promise<ClassificationMapping> {
    const { data, error } = await supabase
      .from('classification_mappings')
      .select(`
        *,
        sourceCategory:source_category_id(*),
        targetCategory:target_category_id(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to get classification mapping: ${error.message}`);
    }

    return this.mapClassificationMappingFromDb(data);
  }

  /**
   * Create a new classification mapping
   *
   * @param input Classification mapping data
   * @returns The created classification mapping
   */
  public async createClassificationMapping(input: ClassificationMappingCreateInput): Promise<ClassificationMapping> {
    try {
      // Check if source and target categories exist and are from different systems
      const sourceCategory = await this.getClassificationCategoryById(input.sourceCategoryId);
      const targetCategory = await this.getClassificationCategoryById(input.targetCategoryId);

      if (sourceCategory.systemId === targetCategory.systemId) {
        throw new Error('Source and target categories must be from different classification systems');
      }

      const { data, error } = await supabase
        .from('classification_mappings')
        .insert({
          source_category_id: input.sourceCategoryId,
          target_category_id: input.targetCategoryId,
          mapping_type: input.mappingType,
          confidence: input.confidence,
          description: input.description
        })
        .select(`
          *,
          sourceCategory:source_category_id(*),
          targetCategory:target_category_id(*)
        `)
        .single();

      if (error) {
        throw new Error(`Failed to create classification mapping: ${error.message}`);
      }

      return this.mapClassificationMappingFromDb(data);
    } catch (error) {
      throw new Error(`Failed to create classification mapping: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update a classification mapping
   *
   * @param input Update data
   * @returns The updated classification mapping
   */
  public async updateClassificationMapping(input: ClassificationMappingUpdateInput): Promise<ClassificationMapping> {
    const updateData: Record<string, any> = {};

    if (input.mappingType !== undefined) updateData.mapping_type = input.mappingType;
    if (input.confidence !== undefined) updateData.confidence = input.confidence;
    if (input.description !== undefined) updateData.description = input.description;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('classification_mappings')
      .update(updateData)
      .eq('id', input.id)
      .select(`
        *,
        sourceCategory:source_category_id(*),
        targetCategory:target_category_id(*)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update classification mapping: ${error.message}`);
    }

    return this.mapClassificationMappingFromDb(data);
  }

  /**
   * Delete a classification mapping
   *
   * @param id Classification mapping ID
   * @returns True if successful
   */
  public async deleteClassificationMapping(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('classification_mappings')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete classification mapping: ${error.message}`);
    }

    return true;
  }

  /**
   * Get a classification system with all its categories
   *
   * @param systemId Classification system ID
   * @param activeOnly Only return active categories
   * @returns Classification system with categories
   */
  public async getClassificationSystemWithCategories(
    systemId: string,
    activeOnly: boolean = true
  ): Promise<ClassificationSystemWithCategories> {
    try {
      const system = await this.getClassificationSystemById(systemId);
      const categories = await this.getClassificationCategories(systemId, undefined, activeOnly);

      return {
        system,
        categories
      };
    } catch (error) {
      throw new Error(`Failed to get classification system with categories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a classification system with its categories as a tree
   *
   * @param systemId Classification system ID
   * @param activeOnly Only return active categories
   * @returns Classification system with tree
   */
  public async getClassificationSystemWithTree(
    systemId: string,
    activeOnly: boolean = true
  ): Promise<ClassificationSystemWithTree> {
    try {
      const system = await this.getClassificationSystemById(systemId);

      if (!system.isHierarchical) {
        throw new Error('Classification system is not hierarchical');
      }

      const categories = await this.getClassificationCategories(systemId, undefined, activeOnly);
      const tree = this.buildCategoryTree(categories);

      return {
        system,
        tree
      };
    } catch (error) {
      throw new Error(`Failed to get classification system with tree: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get material with all its classifications
   *
   * @param materialId Material ID
   * @returns Material with classifications
   */
  public async getMaterialWithClassifications(materialId: string): Promise<MaterialWithClassifications> {
    try {
      const classifications = await this.getMaterialClassifications(materialId);
      const primaryClassification = classifications.find(c => c.isPrimary);

      return {
        materialId,
        classifications,
        primaryClassification
      };
    } catch (error) {
      throw new Error(`Failed to get material with classifications: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Find equivalent categories in another classification system
   *
   * @param categoryId Source category ID
   * @param targetSystemId Target classification system ID
   * @returns List of equivalent categories
   */
  public async findEquivalentCategories(
    categoryId: string,
    targetSystemId: string
  ): Promise<ClassificationCategory[]> {
    try {
      // Get the source category
      const sourceCategory = await this.getClassificationCategoryById(categoryId);

      // Get mappings for the source category
      const mappings = await this.getClassificationMappings(categoryId);

      // Filter mappings to only include those to the target system
      const targetMappings = mappings.filter(mapping =>
        mapping.targetCategory && mapping.targetCategory.systemId === targetSystemId
      );

      // Extract the target categories
      const targetCategories = targetMappings.map(mapping => mapping.targetCategory!);

      return targetCategories;
    } catch (error) {
      throw new Error(`Failed to find equivalent categories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build a category tree from a flat list of categories
   *
   * @param categories Flat list of categories
   * @returns Tree of categories
   */
  private buildCategoryTree(categories: ClassificationCategory[]): ClassificationTreeNode[] {
    // Create a map of categories by ID
    const categoryMap = new Map<string, ClassificationTreeNode>();

    // Convert categories to tree nodes
    for (const category of categories) {
      categoryMap.set(category.id, {
        ...category,
        children: []
      });
    }

    // Build the tree
    const rootNodes: ClassificationTreeNode[] = [];

    for (const category of categories) {
      const node = categoryMap.get(category.id)!;

      if (category.parentId) {
        const parentNode = categoryMap.get(category.parentId);

        if (parentNode) {
          parentNode.children.push(node);
        } else {
          // If parent not found, add as root
          rootNodes.push(node);
        }
      } else {
        // Root node
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  /**
   * Map a database classification system to the TypeScript type
   *
   * @param data Database classification system
   * @returns Mapped classification system
   */
  private mapClassificationSystemFromDb(data: any): ClassificationSystem {
    return {
      id: data.id,
      name: data.name,
      code: data.code,
      description: data.description,
      version: data.version,
      isHierarchical: data.is_hierarchical,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
  }

  /**
   * Map a database classification category to the TypeScript type
   *
   * @param data Database classification category
   * @returns Mapped classification category
   */
  private mapClassificationCategoryFromDb(data: any): ClassificationCategory {
    return {
      id: data.id,
      systemId: data.system_id,
      parentId: data.parent_id,
      code: data.code,
      name: data.name,
      description: data.description,
      level: data.level,
      path: data.path,
      isActive: data.is_active,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by
    };
  }

  /**
   * Map a database material classification to the TypeScript type
   *
   * @param data Database material classification
   * @returns Mapped material classification
   */
  private mapMaterialClassificationFromDb(data: any): MaterialClassification {
    return {
      id: data.id,
      materialId: data.material_id,
      categoryId: data.category_id,
      isPrimary: data.is_primary,
      confidence: data.confidence,
      source: data.source,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      category: data.category ? this.mapClassificationCategoryFromDb(data.category) : undefined
    };
  }

  /**
   * Map a database classification mapping to the TypeScript type
   *
   * @param data Database classification mapping
   * @returns Mapped classification mapping
   */
  private mapClassificationMappingFromDb(data: any): ClassificationMapping {
    return {
      id: data.id,
      sourceCategoryId: data.source_category_id,
      targetCategoryId: data.target_category_id,
      mappingType: data.mapping_type as MappingType,
      confidence: data.confidence,
      description: data.description,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      sourceCategory: data.sourceCategory ? this.mapClassificationCategoryFromDb(data.sourceCategory) : undefined,
      targetCategory: data.targetCategory ? this.mapClassificationCategoryFromDb(data.targetCategory) : undefined
    };
  }
}

// Export the singleton instance
export const classificationService = ClassificationService.getInstance();