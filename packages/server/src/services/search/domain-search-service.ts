/**
 * Domain-Specific Search Service
 *
 * This service provides specialized search capabilities optimized for different domains,
 * with custom ontologies, ranking algorithms, and result presentation.
 */

import { logger } from '../../utils/logger';
import { supabase } from '../supabase/supabaseClient';
import { enhancedVectorService } from '../supabase/enhanced-vector-service';
import queryUnderstandingService from './query-understanding-service';
import mcpClientService, { MCPServiceKey } from '../mcp/mcpClientService';
import creditService from '../credit/creditService';

/**
 * Domain-specific search options
 */
export interface DomainSearchOptions {
  query: string;
  domain: DomainType;
  materialType?: string | string[];
  limit?: number;
  skip?: number;
  includeKnowledge?: boolean;
  includeRelationships?: boolean;
  filters?: Record<string, any>;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  userPreferences?: Record<string, any>;
}

/**
 * Domain-specific search result
 */
export interface DomainSearchResult {
  materials: any[];
  knowledgeEntries?: any[];
  relationships?: any[];
  domainSpecificData?: Record<string, any>;
  enhancedQuery: string;
  metadata: {
    domain: DomainType;
    processingTime: number;
    searchStrategy: string;
    appliedOntology: string;
    appliedRanking: string;
    confidence: number;
  };
}

/**
 * Supported domain types
 */
export type DomainType = 
  | 'architecture' 
  | 'interior_design' 
  | 'construction' 
  | 'manufacturing'
  | 'retail'
  | 'education'
  | 'general';

/**
 * Domain ontology interface
 */
interface DomainOntology {
  domain: DomainType;
  synonymMap: Record<string, string[]>;
  hierarchyMap: Record<string, string[]>;
  attributeImportance: Record<string, number>;
  domainSpecificFilters: Record<string, any>;
}

/**
 * Domain-Specific Search Service class
 */
class DomainSearchService {
  private static instance: DomainSearchService;
  private domainOntologies: Map<DomainType, DomainOntology>;
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.domainOntologies = new Map<DomainType, DomainOntology>();
    this.initializeOntologies();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): DomainSearchService {
    if (!DomainSearchService.instance) {
      DomainSearchService.instance = new DomainSearchService();
    }
    return DomainSearchService.instance;
  }
  
  /**
   * Initialize domain ontologies
   */
  private initializeOntologies(): void {
    // Architecture domain ontology
    this.domainOntologies.set('architecture', {
      domain: 'architecture',
      synonymMap: {
        'floor': ['flooring', 'ground', 'surface'],
        'wall': ['partition', 'divider', 'barrier'],
        'ceiling': ['overhead', 'roof interior'],
        'facade': ['exterior', 'envelope', 'skin'],
        'column': ['pillar', 'post', 'support'],
        'beam': ['girder', 'joist', 'rafter'],
        'window': ['fenestration', 'opening', 'glazing'],
        'door': ['entry', 'portal', 'access'],
        'stair': ['steps', 'staircase', 'stairway'],
        'railing': ['balustrade', 'handrail', 'banister']
      },
      hierarchyMap: {
        'building': ['facade', 'roof', 'foundation', 'structure'],
        'room': ['wall', 'floor', 'ceiling', 'door', 'window'],
        'structure': ['column', 'beam', 'slab', 'foundation'],
        'circulation': ['stair', 'elevator', 'corridor', 'ramp']
      },
      attributeImportance: {
        'durability': 0.9,
        'fire_rating': 0.8,
        'acoustic_rating': 0.7,
        'thermal_performance': 0.8,
        'sustainability': 0.7,
        'cost': 0.6,
        'maintenance': 0.6,
        'appearance': 0.5
      },
      domainSpecificFilters: {
        'fire_rating_min': null,
        'acoustic_rating_min': null,
        'sustainability_certification': null,
        'exterior_use': true
      }
    });
    
    // Interior design domain ontology
    this.domainOntologies.set('interior_design', {
      domain: 'interior_design',
      synonymMap: {
        'floor': ['flooring', 'ground', 'surface'],
        'wall': ['partition', 'divider', 'barrier', 'surface'],
        'ceiling': ['overhead', 'roof interior'],
        'furniture': ['furnishing', 'piece', 'decor'],
        'lighting': ['lamp', 'fixture', 'illumination'],
        'textile': ['fabric', 'upholstery', 'drapery'],
        'color': ['hue', 'tone', 'shade', 'tint'],
        'pattern': ['motif', 'design', 'decoration'],
        'texture': ['finish', 'feel', 'surface quality'],
        'style': ['aesthetic', 'look', 'design language']
      },
      hierarchyMap: {
        'room': ['wall', 'floor', 'ceiling', 'furniture', 'lighting'],
        'furniture': ['seating', 'tables', 'storage', 'beds'],
        'finishes': ['paint', 'wallpaper', 'tile', 'wood', 'stone'],
        'decor': ['art', 'accessories', 'plants', 'mirrors']
      },
      attributeImportance: {
        'appearance': 0.9,
        'color': 0.9,
        'texture': 0.8,
        'pattern': 0.8,
        'durability': 0.7,
        'maintenance': 0.7,
        'cost': 0.6,
        'sustainability': 0.5
      },
      domainSpecificFilters: {
        'color_family': null,
        'pattern_type': null,
        'style_compatibility': null,
        'interior_use': true
      }
    });
    
    // Construction domain ontology
    this.domainOntologies.set('construction', {
      domain: 'construction',
      synonymMap: {
        'concrete': ['cement', 'masonry'],
        'steel': ['metal', 'iron', 'alloy'],
        'wood': ['timber', 'lumber'],
        'insulation': ['thermal barrier', 'soundproofing'],
        'waterproofing': ['moisture barrier', 'damp proofing'],
        'fastener': ['connector', 'joint', 'bracket'],
        'aggregate': ['gravel', 'crushed stone', 'sand'],
        'adhesive': ['glue', 'mortar', 'epoxy'],
        'sealant': ['caulk', 'gasket', 'weatherstripping'],
        'finish': ['coating', 'paint', 'stain']
      },
      hierarchyMap: {
        'structural': ['foundation', 'framing', 'roofing', 'sheathing'],
        'enclosure': ['cladding', 'glazing', 'roofing', 'insulation'],
        'mechanical': ['plumbing', 'hvac', 'electrical', 'fire protection'],
        'finishes': ['flooring', 'wall finishes', 'ceiling finishes', 'millwork']
      },
      attributeImportance: {
        'strength': 0.9,
        'durability': 0.9,
        'fire_rating': 0.8,
        'water_resistance': 0.8,
        'installation_ease': 0.7,
        'cost': 0.7,
        'warranty': 0.6,
        'sustainability': 0.5
      },
      domainSpecificFilters: {
        'strength_rating_min': null,
        'warranty_years_min': null,
        'installation_method': null,
        'code_compliance': null
      }
    });
    
    // Manufacturing domain ontology
    this.domainOntologies.set('manufacturing', {
      domain: 'manufacturing',
      synonymMap: {
        'plastic': ['polymer', 'resin', 'thermoplastic'],
        'metal': ['alloy', 'steel', 'aluminum', 'brass'],
        'composite': ['fiberglass', 'carbon fiber', 'reinforced'],
        'ceramic': ['porcelain', 'stoneware', 'earthenware'],
        'process': ['fabrication', 'production', 'manufacturing'],
        'tolerance': ['precision', 'allowance', 'deviation'],
        'finish': ['surface treatment', 'coating', 'texture'],
        'joint': ['connection', 'fastening', 'assembly'],
        'tooling': ['die', 'mold', 'fixture', 'jig'],
        'batch': ['lot', 'run', 'production quantity']
      },
      hierarchyMap: {
        'materials': ['metals', 'plastics', 'composites', 'ceramics', 'glass'],
        'processes': ['forming', 'machining', 'joining', 'finishing', 'assembly'],
        'equipment': ['tools', 'machines', 'automation', 'inspection'],
        'quality': ['testing', 'inspection', 'certification', 'standards']
      },
      attributeImportance: {
        'material_properties': 0.9,
        'processability': 0.8,
        'tolerance': 0.8,
        'finish_quality': 0.7,
        'cost': 0.7,
        'lead_time': 0.6,
        'minimum_order': 0.5,
        'certification': 0.6
      },
      domainSpecificFilters: {
        'material_grade': null,
        'process_compatibility': null,
        'tolerance_precision': null,
        'certification_required': null
      }
    });
    
    // Retail domain ontology
    this.domainOntologies.set('retail', {
      domain: 'retail',
      synonymMap: {
        'product': ['item', 'merchandise', 'good'],
        'display': ['showcase', 'presentation', 'exhibit'],
        'fixture': ['furniture', 'shelving', 'rack'],
        'signage': ['sign', 'banner', 'graphic'],
        'lighting': ['illumination', 'lamp', 'spotlight'],
        'flooring': ['floor', 'surface', 'ground'],
        'wall': ['partition', 'divider', 'surface'],
        'ceiling': ['overhead', 'canopy', 'roof interior'],
        'counter': ['checkout', 'desk', 'service area'],
        'storage': ['stockroom', 'backroom', 'inventory area']
      },
      hierarchyMap: {
        'store': ['sales floor', 'stockroom', 'checkout', 'entrance'],
        'fixtures': ['shelving', 'racks', 'tables', 'cases', 'mannequins'],
        'visual merchandising': ['displays', 'signage', 'lighting', 'props'],
        'customer journey': ['entrance', 'browsing', 'fitting', 'checkout']
      },
      attributeImportance: {
        'appearance': 0.9,
        'durability': 0.8,
        'maintenance': 0.8,
        'cost': 0.7,
        'installation_ease': 0.6,
        'customization': 0.7,
        'brand_compatibility': 0.8,
        'customer_experience': 0.9
      },
      domainSpecificFilters: {
        'foot_traffic_rating': null,
        'brand_aesthetic': null,
        'customer_demographic': null,
        'price_point': null
      }
    });
    
    // Education domain ontology
    this.domainOntologies.set('education', {
      domain: 'education',
      synonymMap: {
        'classroom': ['learning space', 'teaching area', 'instructional room'],
        'furniture': ['desk', 'chair', 'table', 'storage'],
        'technology': ['equipment', 'device', 'digital tool'],
        'board': ['whiteboard', 'blackboard', 'interactive display'],
        'flooring': ['floor', 'surface', 'ground'],
        'wall': ['partition', 'divider', 'surface'],
        'ceiling': ['overhead', 'acoustic ceiling', 'roof interior'],
        'lighting': ['illumination', 'lamp', 'fixture'],
        'acoustic': ['sound', 'noise control', 'audio'],
        'storage': ['cabinet', 'shelf', 'locker', 'container']
      },
      hierarchyMap: {
        'learning environment': ['classroom', 'laboratory', 'library', 'common area'],
        'furniture': ['seating', 'desks', 'storage', 'presentation'],
        'technology': ['displays', 'computers', 'audio', 'connectivity'],
        'infrastructure': ['flooring', 'walls', 'ceilings', 'lighting', 'acoustics']
      },
      attributeImportance: {
        'durability': 0.9,
        'safety': 0.9,
        'maintenance': 0.8,
        'acoustic_performance': 0.8,
        'flexibility': 0.7,
        'cost': 0.7,
        'sustainability': 0.6,
        'appearance': 0.5
      },
      domainSpecificFilters: {
        'age_group': null,
        'safety_certification': null,
        'acoustic_rating_min': null,
        'maintenance_level': null
      }
    });
    
    // General domain ontology (fallback)
    this.domainOntologies.set('general', {
      domain: 'general',
      synonymMap: {
        'material': ['substance', 'matter', 'medium'],
        'color': ['hue', 'tone', 'shade', 'tint'],
        'texture': ['finish', 'feel', 'surface quality'],
        'pattern': ['design', 'motif', 'decoration'],
        'size': ['dimension', 'measurement', 'proportion'],
        'shape': ['form', 'geometry', 'configuration'],
        'weight': ['mass', 'heaviness', 'density'],
        'price': ['cost', 'value', 'expense'],
        'quality': ['grade', 'caliber', 'standard'],
        'use': ['application', 'purpose', 'function']
      },
      hierarchyMap: {
        'materials': ['natural', 'synthetic', 'composite', 'recycled'],
        'properties': ['physical', 'mechanical', 'thermal', 'optical', 'acoustic'],
        'applications': ['residential', 'commercial', 'industrial', 'institutional'],
        'sustainability': ['recycled content', 'recyclability', 'embodied carbon', 'certifications']
      },
      attributeImportance: {
        'appearance': 0.7,
        'durability': 0.7,
        'cost': 0.7,
        'sustainability': 0.6,
        'maintenance': 0.6,
        'availability': 0.6,
        'versatility': 0.5,
        'popularity': 0.5
      },
      domainSpecificFilters: {
        'price_range': null,
        'availability': null,
        'popularity': null,
        'versatility': null
      }
    });
  }
  
  /**
   * Check if MCP is available for domain search
   */
  private async isMCPAvailable(): Promise<boolean> {
    try {
      return await mcpClientService.isMCPAvailable();
    } catch (error) {
      logger.error(`Error checking MCP availability: ${error}`);
      return false;
    }
  }
  
  /**
   * Perform domain-specific search
   * 
   * @param options Search options with query and domain
   * @param userId User ID for MCP integration
   * @returns Search results with materials and domain-specific data
   */
  public async search(
    options: DomainSearchOptions,
    userId?: string
  ): Promise<DomainSearchResult> {
    const startTime = Date.now();
    
    try {
      // Set default options
      const mergedOptions = {
        limit: 10,
        skip: 0,
        includeKnowledge: true,
        includeRelationships: true,
        domain: options.domain || 'general',
        ...options
      };
      
      // Get domain ontology
      const ontology = this.domainOntologies.get(mergedOptions.domain) || 
                      this.domainOntologies.get('general')!;
      
      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();
      
      if (mcpAvailable && userId) {
        try {
          // Estimate query complexity (2 units per domain search)
          const estimatedUnits = 2;
          
          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            userId,
            MCPServiceKey.DOMAIN_SEARCH,
            estimatedUnits
          );
          
          if (hasEnoughCredits) {
            // Use MCP for domain search
            const mcpResult = await this.performMCPDomainSearch(mergedOptions, userId);
            
            // Track credit usage
            await creditService.useServiceCredits(
              userId,
              MCPServiceKey.DOMAIN_SEARCH,
              estimatedUnits,
              `${MCPServiceKey.DOMAIN_SEARCH} API usage`,
              {
                domain: mergedOptions.domain,
                query: mergedOptions.query
              }
            );
            
            return {
              ...mcpResult,
              metadata: {
                ...mcpResult.metadata,
                processingTime: Date.now() - startTime
              }
            };
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          logger.warn(`MCP domain search failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }
      
      // Fall back to direct implementation if MCP is not available or failed
      return await this.performDirectDomainSearch(mergedOptions, ontology);
    } catch (error) {
      logger.error(`Error in domain search: ${error}`);
      throw error;
    }
  }
  
  /**
   * Perform domain-specific search using MCP
   */
  private async performMCPDomainSearch(
    options: DomainSearchOptions,
    userId: string
  ): Promise<DomainSearchResult> {
    // Call MCP for domain search
    const mcpResult = await mcpClientService.performDomainSearch(
      userId,
      {
        query: options.query,
        domain: options.domain,
        materialType: Array.isArray(options.materialType) 
          ? options.materialType[0] 
          : options.materialType,
        limit: options.limit,
        skip: options.skip,
        includeKnowledge: options.includeKnowledge,
        includeRelationships: options.includeRelationships,
        filters: options.filters,
        sortBy: options.sortBy,
        sortDirection: options.sortDirection,
        userPreferences: options.userPreferences
      }
    );
    
    return {
      materials: mcpResult.materials || [],
      knowledgeEntries: mcpResult.knowledgeEntries || [],
      relationships: mcpResult.relationships || [],
      domainSpecificData: mcpResult.domainSpecificData || {},
      enhancedQuery: mcpResult.enhancedQuery || options.query,
      metadata: {
        domain: options.domain,
        processingTime: 0, // Will be updated by the caller
        searchStrategy: 'mcp-domain',
        appliedOntology: mcpResult.metadata?.appliedOntology || options.domain,
        appliedRanking: mcpResult.metadata?.appliedRanking || 'domain-specific',
        confidence: mcpResult.metadata?.confidence || 0.5
      }
    };
  }
  
  /**
   * Perform domain-specific search using direct implementation
   */
  private async performDirectDomainSearch(
    options: DomainSearchOptions,
    ontology: DomainOntology
  ): Promise<DomainSearchResult> {
    const startTime = Date.now();
    
    // Enhance query with domain-specific knowledge
    const enhancedQueryResult = await this.enhanceQueryWithDomain(
      options.query,
      ontology
    );
    
    // Prepare domain-specific filters
    const domainFilters = this.prepareDomainFilters(
      options.filters || {},
      ontology
    );
    
    // Perform search with enhanced query and domain filters
    const searchResult = await enhancedVectorService.searchMaterialsWithKnowledge(
      enhancedQueryResult.enhancedQuery,
      Array.isArray(options.materialType) ? options.materialType[0] : options.materialType,
      domainFilters,
      options.limit,
      options.includeKnowledge,
      options.includeRelationships
    );
    
    // Apply domain-specific ranking
    const rankedMaterials = this.applyDomainRanking(
      searchResult.materials,
      ontology,
      options.query
    );
    
    // Extract domain-specific insights
    const domainSpecificData = this.extractDomainInsights(
      rankedMaterials,
      ontology
    );
    
    return {
      materials: rankedMaterials,
      knowledgeEntries: searchResult.knowledgeEntries,
      relationships: searchResult.relationships,
      domainSpecificData,
      enhancedQuery: enhancedQueryResult.enhancedQuery,
      metadata: {
        domain: options.domain,
        processingTime: Date.now() - startTime,
        searchStrategy: 'direct-domain',
        appliedOntology: ontology.domain,
        appliedRanking: 'attribute-weighted',
        confidence: enhancedQueryResult.confidence
      }
    };
  }
  
  /**
   * Enhance query with domain-specific knowledge
   */
  private async enhanceQueryWithDomain(
    query: string,
    ontology: DomainOntology
  ): Promise<{
    enhancedQuery: string;
    confidence: number;
  }> {
    // First, use the query understanding service for basic enhancement
    const baseEnhancement = await queryUnderstandingService.enhanceQuery(
      query,
      {
        expandSynonyms: true,
        includeRelatedTerms: true,
        domainContext: ontology.domain
      }
    );
    
    // Apply domain-specific synonym expansion
    let enhancedQuery = baseEnhancement.enhancedQuery;
    let termsAdded = false;
    
    // Extract key terms from the query
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    // Check each term against the domain synonym map
    for (const term of queryTerms) {
      if (ontology.synonymMap[term]) {
        // Add domain-specific synonyms
        const domainSynonyms = ontology.synonymMap[term]
          .filter(synonym => !enhancedQuery.toLowerCase().includes(synonym.toLowerCase()))
          .slice(0, 2); // Limit to 2 synonyms to avoid query explosion
        
        if (domainSynonyms.length > 0) {
          enhancedQuery += ` ${domainSynonyms.join(' ')}`;
          termsAdded = true;
        }
      }
      
      // Check if the term is in any hierarchy
      for (const [category, members] of Object.entries(ontology.hierarchyMap)) {
        if (term === category.toLowerCase()) {
          // Add some hierarchy members if they're not already in the query
          const relevantMembers = members
            .filter(member => !enhancedQuery.toLowerCase().includes(member.toLowerCase()))
            .slice(0, 3); // Limit to 3 members
          
          if (relevantMembers.length > 0) {
            enhancedQuery += ` ${relevantMembers.join(' ')}`;
            termsAdded = true;
          }
        }
      }
    }
    
    // Calculate confidence based on how much we enhanced the query
    const confidence = termsAdded ? 
      Math.min(0.9, baseEnhancement.confidence + 0.1) : 
      baseEnhancement.confidence;
    
    return {
      enhancedQuery,
      confidence
    };
  }
  
  /**
   * Prepare domain-specific filters
   */
  private prepareDomainFilters(
    baseFilters: Record<string, any>,
    ontology: DomainOntology
  ): Record<string, any> {
    // Start with base filters
    const filters = { ...baseFilters };
    
    // Add domain-specific filters if they have values
    for (const [key, value] of Object.entries(ontology.domainSpecificFilters)) {
      if (value !== null && !filters[key]) {
        filters[key] = value;
      }
    }
    
    return filters;
  }
  
  /**
   * Apply domain-specific ranking to search results
   */
  private applyDomainRanking(
    materials: any[],
    ontology: DomainOntology,
    query: string
  ): any[] {
    // Clone materials to avoid modifying the original
    const rankedMaterials = [...materials];
    
    // Calculate domain-specific scores
    for (const material of rankedMaterials) {
      let domainScore = 0;
      
      // Score based on attribute importance
      for (const [attribute, importance] of Object.entries(ontology.attributeImportance)) {
        // Convert attribute to snake_case for property lookup
        const snakeCaseAttr = attribute.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        if (material[snakeCaseAttr] || material.properties?.[snakeCaseAttr]) {
          const value = material[snakeCaseAttr] || material.properties?.[snakeCaseAttr];
          
          // Simple scoring - if the attribute exists, add its importance to the score
          if (value) {
            domainScore += importance;
          }
        }
      }
      
      // Normalize domain score (0-1)
      domainScore = domainScore / Object.keys(ontology.attributeImportance).length;
      
      // Combine with existing score (if any)
      material._domainScore = domainScore;
      material._combinedScore = (material._score || 0) * 0.7 + domainScore * 0.3;
    }
    
    // Sort by combined score
    rankedMaterials.sort((a, b) => b._combinedScore - a._combinedScore);
    
    return rankedMaterials;
  }
  
  /**
   * Extract domain-specific insights from search results
   */
  private extractDomainInsights(
    materials: any[],
    ontology: DomainOntology
  ): Record<string, any> {
    // Extract domain-specific insights
    const insights: Record<string, any> = {
      domainName: ontology.domain,
      keyAttributes: [],
      recommendations: [],
      alternatives: []
    };
    
    // Identify key attributes based on domain importance
    const importantAttributes = Object.entries(ontology.attributeImportance)
      .filter(([_, importance]) => importance >= 0.7)
      .map(([attribute, _]) => attribute);
    
    insights.keyAttributes = importantAttributes;
    
    // Generate recommendations based on top results
    if (materials.length > 0) {
      const topMaterial = materials[0];
      
      insights.recommendations.push({
        type: 'primary',
        materialId: topMaterial.id,
        materialName: topMaterial.name,
        reason: `Best match for ${ontology.domain} application based on ${importantAttributes.slice(0, 2).join(' and ')}`
      });
      
      // Find alternatives with different characteristics
      for (let i = 1; i < Math.min(materials.length, 3); i++) {
        const alternative = materials[i];
        
        insights.alternatives.push({
          materialId: alternative.id,
          materialName: alternative.name,
          differentiator: this.findDifferentiator(topMaterial, alternative, ontology)
        });
      }
    }
    
    return insights;
  }
  
  /**
   * Find key differentiator between two materials
   */
  private findDifferentiator(
    material1: any,
    material2: any,
    ontology: DomainOntology
  ): string {
    // Check important attributes first
    for (const [attribute, importance] of Object.entries(ontology.attributeImportance)) {
      if (importance >= 0.6) {
        // Convert attribute to snake_case for property lookup
        const snakeCaseAttr = attribute.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        const value1 = material1[snakeCaseAttr] || material1.properties?.[snakeCaseAttr];
        const value2 = material2[snakeCaseAttr] || material2.properties?.[snakeCaseAttr];
        
        if (value1 !== value2) {
          return `Different ${attribute.replace(/_/g, ' ')}`;
        }
      }
    }
    
    // Check basic properties
    for (const prop of ['color', 'finish', 'material_type', 'manufacturer']) {
      if (material1[prop] !== material2[prop]) {
        return `Different ${prop.replace(/_/g, ' ')}`;
      }
    }
    
    return 'Alternative option';
  }
  
  /**
   * Get available domains
   * 
   * @returns List of available domains
   */
  public getAvailableDomains(): DomainType[] {
    return Array.from(this.domainOntologies.keys());
  }
  
  /**
   * Get domain ontology
   * 
   * @param domain Domain type
   * @returns Domain ontology or undefined if not found
   */
  public getDomainOntology(domain: DomainType): DomainOntology | undefined {
    return this.domainOntologies.get(domain);
  }
}

export const domainSearchService = DomainSearchService.getInstance();
export default domainSearchService;
