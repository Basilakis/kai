#!/usr/bin/env python3
"""
Context Assembly System for RAG

This module organizes and structures retrieved data from multiple sources,
creating optimized contexts for downstream LLM processing. The system:

1. Pulls structured properties from the knowledge base
2. Enhances with relationship context from the knowledge graph
3. Combines with vector search results
4. Formats for optimal downstream processing
5. Builds adapter layers between search systems

It works with the Hybrid Retriever to provide well-structured,
informative contexts for the RAG (Retrieval Augmented Generation) system.
"""

import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple, Union

# Set up logging
logger = logging.getLogger("context_assembler")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Type aliases
MaterialData = Dict[str, Any]
MaterialList = List[MaterialData]
KnowledgeEntry = Dict[str, Any]
KnowledgeEntries = List[KnowledgeEntry]
RelationshipData = Dict[str, Any]
AssembledContext = Dict[str, Any]


class ContextAssembler:
    """
    Context Assembly System for the RAG pipeline.
    
    This system organizes retrieved data from multiple sources, enriches it with
    knowledge base information, and formats it for optimal downstream processing.
    """
    
    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None,
        knowledge_client=None,
        vector_client=None
    ):
        """
        Initialize the Context Assembler.
        
        Args:
            config: Configuration parameters for context assembly
            knowledge_client: Client for knowledge base interaction
            vector_client: Client for vector search interaction
        """
        # Default configuration
        self.config = {
            # Context structure
            "max_context_length": 8000,
            "max_materials_to_include": 5,
            "max_facts_per_material": 8,
            "max_relationships_per_material": 3,
            
            # Content prioritization
            "include_material_descriptions": True,
            "include_technical_properties": True,
            "prioritize_properties": ["composition", "density", "hardness", "color", "texture"],
            
            # Knowledge integration
            "include_knowledge_entries": True,
            "knowledge_entry_quality_threshold": 0.7,
            "max_knowledge_entries": 3,
            
            # Relationship graph
            "include_relationships": True,
            "relationship_types": ["similar_to", "complementary_with", "alternative_for"],
            
            # Formatting
            "format_type": "structured",  # Options: structured, natural, llm_optimized
            "include_citations": True,
            "include_metadata": True
        }
        
        # Update with provided configuration
        if config:
            self.config.update(config)
        
        # Set up clients
        self.knowledge_client = knowledge_client
        self.vector_client = vector_client
        
        logger.info("Context Assembler initialized with configuration: %s", self.config)
    
    async def assemble_context(
        self,
        retrieved_materials: MaterialList,
        query: str,
        user_context: Optional[Dict[str, Any]] = None
    ) -> AssembledContext:
        """
        Assemble context from retrieved materials and knowledge base.
        
        Args:
            retrieved_materials: List of retrieved material data
            query: Original user query
            user_context: Additional user context (preferences, history, etc.)
            
        Returns:
            Assembled context for downstream processing
        """
        start_time = time.time()
        logger.info("Starting context assembly for query: %s", query)
        
        # Limit the number of materials to include
        top_materials = retrieved_materials[:self.config["max_materials_to_include"]]
        
        # Collect material IDs for batch operations
        material_ids = [material.get("id") for material in top_materials if material.get("id")]
        
        # Step 1: Enhance materials with knowledge base entries and relationships
        if self.config["include_knowledge_entries"] or self.config["include_relationships"]:
            enhanced_materials = await self._enhance_materials_with_knowledge(
                materials=top_materials,
                material_ids=material_ids,
                query=query
            )
        else:
            enhanced_materials = top_materials
        
        # Step 2: Structure and organize the context
        assembled_context = self._structure_context(
            materials=enhanced_materials,
            query=query,
            user_context=user_context
        )
        
        # Step 3: Apply formatting based on configuration
        formatted_context = self._format_context(
            context=assembled_context,
            format_type=self.config["format_type"]
        )
        
        logger.info("Context assembly completed in %.2f seconds", time.time() - start_time)
        return formatted_context
    
    async def _enhance_materials_with_knowledge(
        self,
        materials: MaterialList,
        material_ids: List[str],
        query: str
    ) -> MaterialList:
        """
        Enhance materials with knowledge base entries and relationship data.
        
        Args:
            materials: List of material data
            material_ids: List of material IDs
            query: Original user query
            
        Returns:
            Enhanced material data
        """
        enhanced_materials = []
        
        # Step 1: Fetch knowledge entries in batch with semantic indexing
        knowledge_entries = {}
        if self.config["include_knowledge_entries"] and self.knowledge_client:
            try:
                batch_entries = await self.knowledge_client.get_entries_for_materials(
                    material_ids=material_ids,
                    quality_threshold=self.config["knowledge_entry_quality_threshold"],
                    max_entries_per_material=self.config["max_facts_per_material"],
                    query=query,
                    semantic_indexing=True  # Enable semantic indexing for better organization
                )
                
                if batch_entries:
                    # Organize by material ID
                    for entry in batch_entries:
                        material_id = entry.get("material_id")
                        if not material_id:
                            continue
                            
                        if material_id not in knowledge_entries:
                            knowledge_entries[material_id] = []
                            
                        knowledge_entries[material_id].append(entry)
            except Exception as e:
                logger.error(f"Error fetching knowledge entries: {str(e)}")
        
        # Step 2: Fetch relationship data in batch
        relationships = {}
        if self.config["include_relationships"] and self.knowledge_client:
            try:
                batch_relationships = await self.knowledge_client.get_material_relationships(
                    material_ids=material_ids,
                    relationship_types=self.config["relationship_types"],
                    max_relationships=self.config["max_relationships_per_material"]
                )
                
                if batch_relationships:
                    # Organize by material ID
                    for rel in batch_relationships:
                        source_id = rel.get("source_id")
                        if not source_id:
                            continue
                            
                        if source_id not in relationships:
                            relationships[source_id] = []
                            
                        relationships[source_id].append(rel)
            except Exception as e:
                logger.error(f"Error fetching relationships: {str(e)}")
        
        # Step 3: Enhance each material with knowledge and relationships
        for material in materials:
            material_id = material.get("id")
            if not material_id:
                enhanced_materials.append(material)
                continue
            
            enhanced_material = material.copy()
            
            # Add knowledge entries
            if material_id in knowledge_entries:
                enhanced_material["knowledge_entries"] = knowledge_entries[material_id]
            
            # Add relationships
            if material_id in relationships:
                enhanced_material["relationships"] = relationships[material_id]
            
            enhanced_materials.append(enhanced_material)
        
        return enhanced_materials
    
    def _structure_context(
        self,
        materials: MaterialList,
        query: str,
        user_context: Optional[Dict[str, Any]] = None
    ) -> AssembledContext:
        """
        Structure and organize the context from enhanced materials.
        
        Args:
            materials: List of enhanced material data
            query: Original user query
            user_context: Additional user context
            
        Returns:
            Structured context data
        """
        # Initialize the assembled context
        assembled_context = {
            "query": query,
            "materials": [],
            "relationships": [],
            "knowledge_facts": [],
            "metadata": {
                "material_count": len(materials),
                "user_context": user_context or {},
                "timestamp": time.time(),
                "assembly_config": {
                    key: value for key, value in self.config.items()
                    if key in ["max_materials_to_include", "include_material_descriptions", 
                              "include_technical_properties", "include_relationships"]
                }
            }
        }
        
        # Process each material
        processed_knowledge_ids = set()  # Track processed knowledge entries to avoid duplicates
        all_relationships = []  # Collect all relationships for network analysis
        
        for material in materials:
            material_id = material.get("id")
            if not material_id:
                continue
                
            # Create structured material entry
            structured_material = {
                "id": material_id,
                "name": material.get("name", ""),
                "material_type": material.get("material_type", ""),
                "similarity_score": material.get("similarity", 0),
                "matched_by": material.get("matched_by", ""),
                "properties": {}
            }
            
            # Add description if configured and available
            if self.config["include_material_descriptions"] and "description" in material:
                structured_material["description"] = material["description"]
            
            # Add technical properties if configured
            if self.config["include_technical_properties"]:
                properties = material.get("properties", {})
                
                # Prioritize specific properties if configured
                if self.config["prioritize_properties"] and properties:
                    for prop_name in self.config["prioritize_properties"]:
                        if prop_name in properties:
                            structured_material["properties"][prop_name] = properties[prop_name]
                    
                    # Add remaining properties
                    for prop_name, prop_value in properties.items():
                        if prop_name not in self.config["prioritize_properties"]:
                            structured_material["properties"][prop_name] = prop_value
                else:
                    structured_material["properties"] = properties
            
            # Add material to assembled context
            assembled_context["materials"].append(structured_material)
            
            # Process knowledge entries
            if "knowledge_entries" in material:
                for entry in material["knowledge_entries"]:
                    entry_id = entry.get("id")
                    if not entry_id or entry_id in processed_knowledge_ids:
                        continue
                        
            # Add to global knowledge facts list with enhanced metadata
                    knowledge_fact = {
                        "id": entry_id,
                        "material_id": material_id,
                        "material_name": material.get("name", ""),
                        "fact": entry.get("content", ""),
                        "confidence": entry.get("confidence", 1.0),
                        "source": entry.get("source", "knowledge_base"),
                        "relevance": entry.get("relevance", 1.0),
                        "category": entry.get("category", "general"),
                        "semantic_tags": entry.get("semantic_tags", []),
                        "linked_materials": entry.get("linked_materials", []),
                        "bidirectional_reference": True
                    }
                    
                    assembled_context["knowledge_facts"].append(knowledge_fact)
                    processed_knowledge_ids.add(entry_id)
            
            # Process relationships
            if "relationships" in material:
                for rel in material["relationships"]:
                    all_relationships.append(rel)
                    
                    # Add to global relationships list
                    relationship = {
                        "id": rel.get("id", f"{material_id}_{rel.get('target_id')}"),
                        "source_id": material_id,
                        "source_name": material.get("name", ""),
                        "target_id": rel.get("target_id", ""),
                        "target_name": rel.get("target_name", ""),
                        "type": rel.get("type", ""),
                        "strength": rel.get("strength", 0.0),
                        "description": rel.get("description", "")
                    }
                    
                    assembled_context["relationships"].append(relationship)
        
        # Add relationship network analysis if we have relationships
        if all_relationships:
            network_analysis = self._analyze_relationship_network(all_relationships)
            assembled_context["relationship_network"] = network_analysis
            
        # Add semantic organization of knowledge content
        if assembled_context["knowledge_facts"]:
            semantic_organization = self._create_semantic_knowledge_organization(
                assembled_context["knowledge_facts"],
                query
            )
            assembled_context["semantic_knowledge_organization"] = semantic_organization
        
        return assembled_context
    
    def _create_semantic_knowledge_organization(
        self,
        knowledge_facts: List[Dict[str, Any]],
        query: str
    ) -> Dict[str, Any]:
        """
        Create a semantic organization of knowledge content.
        
        Args:
            knowledge_facts: List of knowledge facts
            query: Original user query
            
        Returns:
            Semantic organization data
        """
        # Initialize categories
        categories = {
            "technical_specifications": [],
            "installation_guidance": [],
            "maintenance_tips": [],
            "sustainability": [],
            "design_considerations": [],
            "general_information": []
        }
        
        # Categorize facts based on their content and semantic tags
        for fact in knowledge_facts:
            # Default category
            assigned_category = "general_information"
            
            # Get content and semantic tags
            content = fact.get("fact", "").lower()
            semantic_tags = fact.get("semantic_tags", [])
            
            # Technical specifications category
            if any(term in content for term in ["specification", "density", "hardness", "strength", 
                                              "durability", "rating", "grade", "measurement"]):
                assigned_category = "technical_specifications"
            
            # Installation guidance category
            elif any(term in content for term in ["install", "installation", "mounting", "setup", 
                                               "preparation", "assemble", "assembly"]):
                assigned_category = "installation_guidance"
            
            # Maintenance tips category
            elif any(term in content for term in ["maintenance", "clean", "cleaning", "care", 
                                               "polish", "refinish", "restore", "preserve"]):
                assigned_category = "maintenance_tips"
            
            # Sustainability category
            elif any(term in content for term in ["sustainable", "eco", "environmental", "green", 
                                               "renewable", "recycle", "carbon", "footprint"]):
                assigned_category = "sustainability"
            
            # Design considerations category
            elif any(term in content for term in ["design", "aesthetic", "appearance", "style", 
                                               "visual", "decor", "trend", "pattern"]):
                assigned_category = "design_considerations"
            
            # Check semantic tags
            if semantic_tags:
                for tag in semantic_tags:
                    tag = tag.lower()
                    if tag in ["technical", "specification", "performance"]:
                        assigned_category = "technical_specifications"
                    elif tag in ["installation", "setup", "assembly"]:
                        assigned_category = "installation_guidance"
                    elif tag in ["maintenance", "cleaning", "care"]:
                        assigned_category = "maintenance_tips"
                    elif tag in ["sustainable", "eco-friendly", "environmental"]:
                        assigned_category = "sustainability"
                    elif tag in ["design", "aesthetic", "appearance"]:
                        assigned_category = "design_considerations"
            
            # Add to assigned category
            categories[assigned_category].append(fact.get("id"))
        
        # Create semantic organization
        semantic_organization = {
            "query_theme": self._extract_query_theme(query),
            "primary_categories": [],
            "category_distribution": {},
            "category_contents": categories
        }
        
        # Calculate category distribution and identify primary categories
        total_facts = len(knowledge_facts)
        category_counts = {}
        
        for category, facts in categories.items():
            fact_count = len(facts)
            if fact_count > 0:
                percentage = fact_count / total_facts
                category_counts[category] = {
                    "count": fact_count,
                    "percentage": percentage
                }
                
                if percentage >= 0.2:  # 20% or more
                    semantic_organization["primary_categories"].append(category)
        
        semantic_organization["category_distribution"] = category_counts
        
        # If no primary category, use the one with the most facts
        if not semantic_organization["primary_categories"] and category_counts:
            top_category = max(category_counts.items(), key=lambda x: x[1]["count"])[0]
            semantic_organization["primary_categories"].append(top_category)
        
        return semantic_organization
    
    def _extract_query_theme(self, query: str) -> str:
        """
        Extract the main theme from the query.
        
        Args:
            query: Original user query
            
        Returns:
            Main theme of the query
        """
        # Simplified theme extraction
        query_lower = query.lower()
        
        if any(term in query_lower for term in ["install", "installing", "setup", "mounting"]):
            return "installation"
        elif any(term in query_lower for term in ["technical", "specifications", "properties", "rating"]):
            return "technical_information"
        elif any(term in query_lower for term in ["clean", "cleaning", "maintain", "maintenance", "care"]):
            return "maintenance"
        elif any(term in query_lower for term in ["eco", "sustainable", "environmental", "green"]):
            return "sustainability"
        elif any(term in query_lower for term in ["design", "aesthetic", "appearance", "look", "style"]):
            return "design"
        elif any(term in query_lower for term in ["alternative", "similar", "comparison", "versus", "vs"]):
            return "comparison"
        else:
            return "general_information"
    
    def _analyze_relationship_network(
        self,
        relationships: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze the relationship network to identify important patterns.
        
        Args:
            relationships: List of relationship data
            
        Returns:
            Network analysis data
        """
        if not relationships:
            return {}
        
        # Count relationship types
        type_counts = {}
        for rel in relationships:
            rel_type = rel.get("type", "unknown")
            if rel_type not in type_counts:
                type_counts[rel_type] = 0
            type_counts[rel_type] += 1
        
        # Find central materials (with most relationships)
        material_connections = {}
        for rel in relationships:
            source_id = rel.get("source_id")
            target_id = rel.get("target_id")
            
            if source_id:
                if source_id not in material_connections:
                    material_connections[source_id] = 0
                material_connections[source_id] += 1
            
            if target_id:
                if target_id not in material_connections:
                    material_connections[target_id] = 0
                material_connections[target_id] += 1
        
        # Sort by connection count
        central_materials = sorted(
            material_connections.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]  # Top 3 most connected
        
        return {
            "relationship_type_distribution": type_counts,
            "central_materials": [
                {"id": material_id, "connection_count": count}
                for material_id, count in central_materials
            ],
            "total_relationships": len(relationships),
            "relationship_density": len(relationships) / max(len(material_connections), 1)
        }
    
    def _format_context(
        self,
        context: AssembledContext,
        format_type: str
    ) -> AssembledContext:
        """
        Format the assembled context based on the specified format type.
        
        Args:
            context: Assembled context data
            format_type: Type of formatting to apply
            
        Returns:
            Formatted context
        """
        if format_type == "structured":
            # Already structured, just ensure we're within size limits
            return self._trim_context_to_limits(context)
        
        elif format_type == "natural":
            # Convert to natural language text
            return self._format_as_natural_language(context)
        
        elif format_type == "llm_optimized":
            # Format specifically for LLM consumption
            return self._format_for_llm(context)
        
        else:
            logger.warning(f"Unknown format type: {format_type}, using structured format")
            return self._trim_context_to_limits(context)
    
    def _trim_context_to_limits(
        self,
        context: AssembledContext
    ) -> AssembledContext:
        """
        Trim context to stay within size limits.
        
        Args:
            context: Assembled context data
            
        Returns:
            Trimmed context
        """
        # JSON-encode to get approximate size
        context_json = json.dumps(context)
        current_size = len(context_json)
        
        # If within limits, return as is
        if current_size <= self.config["max_context_length"]:
            context["metadata"]["context_size"] = current_size
            return context
        
        # Need to trim - start with knowledge facts
        trimmed_context = context.copy()
        knowledge_facts = trimmed_context.get("knowledge_facts", []).copy()
        
        # Sort by relevance and keep most relevant
        if knowledge_facts:
            knowledge_facts.sort(key=lambda x: x.get("relevance", 0), reverse=True)
            trimmed_facts = knowledge_facts[:max(1, len(knowledge_facts) // 2)]
            trimmed_context["knowledge_facts"] = trimmed_facts
        
        # Recheck size
        context_json = json.dumps(trimmed_context)
        current_size = len(context_json)
        
        if current_size <= self.config["max_context_length"]:
            trimmed_context["metadata"]["context_size"] = current_size
            trimmed_context["metadata"]["trimmed"] = True
            return trimmed_context
        
        # Still too large - trim relationships
        relationships = trimmed_context.get("relationships", []).copy()
        if relationships:
            # Sort by strength and keep strongest
            relationships.sort(key=lambda x: x.get("strength", 0), reverse=True)
            trimmed_relationships = relationships[:max(1, len(relationships) // 2)]
            trimmed_context["relationships"] = trimmed_relationships
        
        # Recheck size
        context_json = json.dumps(trimmed_context)
        current_size = len(context_json)
        
        if current_size <= self.config["max_context_length"]:
            trimmed_context["metadata"]["context_size"] = current_size
            trimmed_context["metadata"]["trimmed"] = True
            return trimmed_context
        
        # Still too large - trim material descriptions
        materials = trimmed_context.get("materials", []).copy()
        for material in materials:
            if "description" in material:
                # Truncate description to 100 chars
                material["description"] = material["description"][:100] + "..."
            
            # Limit properties to 3 most important
            if self.config["prioritize_properties"] and "properties" in material:
                prioritized_props = {}
                for prop_name in self.config["prioritize_properties"][:3]:
                    if prop_name in material["properties"]:
                        prioritized_props[prop_name] = material["properties"][prop_name]
                
                material["properties"] = prioritized_props
        
        trimmed_context["materials"] = materials
        trimmed_context["metadata"]["context_size"] = len(json.dumps(trimmed_context))
        trimmed_context["metadata"]["severely_trimmed"] = True
        
        return trimmed_context
    
    def _format_as_natural_language(
        self,
        context: AssembledContext
    ) -> AssembledContext:
        """
        Format the context as natural language text.
        
        Args:
            context: Assembled context data
            
        Returns:
            Context with natural language text
        """
        # Start with a copy of the original
        formatted_context = context.copy()
        
        # Build natural language description
        materials = context.get("materials", [])
        knowledge_facts = context.get("knowledge_facts", [])
        relationships = context.get("relationships", [])
        
        text_sections = []
        
        # Introduction
        intro = f"Based on the query '{context.get('query', '')}', I found {len(materials)} relevant materials."
        text_sections.append(intro)
        
        # Materials section
        if materials:
            text_sections.append("\nRelevant Materials:")
            
            for idx, material in enumerate(materials):
                material_text = f"{idx+1}. {material.get('name', 'Unknown Material')} ({material.get('material_type', 'Unknown Type')})"
                
                if "description" in material:
                    material_text += f": {material['description']}"
                
                if material.get("properties"):
                    props_text = ", ".join([
                        f"{prop}: {value}" 
                        for prop, value in material["properties"].items()
                    ])
                    material_text += f" Properties: {props_text}."
                
                text_sections.append(material_text)
        
        # Knowledge facts section
        if knowledge_facts:
            text_sections.append("\nRelevant Facts:")
            
            for idx, fact in enumerate(knowledge_facts):
                fact_text = f"{idx+1}. {fact.get('fact', '')}"
                
                if self.config["include_citations"]:
                    source = fact.get("source", "")
                    if source:
                        fact_text += f" (Source: {source})"
                
                text_sections.append(fact_text)
        
        # Relationships section
        if relationships:
            text_sections.append("\nMaterial Relationships:")
            
            for idx, rel in enumerate(relationships):
                rel_text = f"{idx+1}. {rel.get('source_name', '')} is {rel.get('type', 'related to')} {rel.get('target_name', '')}"
                
                if "description" in rel and rel["description"]:
                    rel_text += f": {rel['description']}"
                
                text_sections.append(rel_text)
        
        # Add network insights if available
        if "relationship_network" in context:
            network = context["relationship_network"]
            if network:
                central_materials = network.get("central_materials", [])
                if central_materials:
                    central_text = "Central materials in this network: " + ", ".join([
                        f"{cm.get('id', '')}" for cm in central_materials
                    ])
                    text_sections.append(f"\n{central_text}")
        
        # Combine all sections
        natural_text = "\n".join(text_sections)
        
        # Add to context
        formatted_context["natural_language_context"] = natural_text
        
        return formatted_context
    
    def _format_for_llm(
        self,
        context: AssembledContext
    ) -> AssembledContext:
        """
        Format the context specifically for LLM consumption.
        
        Args:
            context: Assembled context data
            
        Returns:
            Context formatted for LLM
        """
        # Start with a copy of the original
        formatted_context = context.copy()
        
        # Create LLM-specific context with clear sections
        llm_context = {
            "query": context.get("query", ""),
            "context_sections": []
        }
        
        # Materials section
        materials = context.get("materials", [])
        if materials:
            materials_section = {
                "section_type": "materials",
                "items": []
            }
            
            for material in materials:
                material_item = {
                    "id": material.get("id", ""),
                    "name": material.get("name", ""),
                    "type": material.get("material_type", ""),
                    "relevance_score": material.get("similarity_score", 0)
                }
                
                if "description" in material:
                    material_item["description"] = material["description"]
                
                if material.get("properties"):
                    material_item["properties"] = material["properties"]
                
                materials_section["items"].append(material_item)
            
            llm_context["context_sections"].append(materials_section)
        
        # Knowledge facts section
        knowledge_facts = context.get("knowledge_facts", [])
        if knowledge_facts:
            facts_section = {
                "section_type": "knowledge_facts",
                "items": []
            }
            
            for fact in knowledge_facts:
                fact_item = {
                    "material_id": fact.get("material_id", ""),
                    "material_name": fact.get("material_name", ""),
                    "fact": fact.get("fact", ""),
                    "confidence": fact.get("confidence", 1.0)
                }
                
                if self.config["include_citations"] and "source" in fact:
                    fact_item["source"] = fact["source"]
                
                facts_section["items"].append(fact_item)
            
            llm_context["context_sections"].append(facts_section)
        
        # Relationships section
        relationships = context.get("relationships", [])
        if relationships:
            relationships_section = {
                "section_type": "relationships",
                "items": []
            }
            
            for rel in relationships:
                rel_item = {
                    "source_material": rel.get("source_name", ""),
                    "relationship_type": rel.get("type", ""),
                    "target_material": rel.get("target_name", ""),
                }
                
                if "description" in rel and rel["description"]:
                    rel_item["description"] = rel["description"]
                
                relationships_section["items"].append(rel_item)
            
            llm_context["context_sections"].append(relationships_section)
        
        # Add formatted LLM context to the result
        formatted_context["llm_formatted_context"] = llm_context
        
        return formatted_context
    
    async def get_related_knowledge(
        self,
        material_id: str,
        limit: int = 5,
        query: str = "",
        include_relationships: bool = True
    ) -> Dict[str, Any]:
        """
        Get related knowledge entries for a material.
        
        Args:
            material_id: ID of the material
            limit: Maximum number of entries to return
            
        Returns:
            List of knowledge entries
        """
        if not self.knowledge_client or not material_id:
            return {"entries": [], "relationships": []}
        
        try:
            # Get knowledge entries
            entries = await self.knowledge_client.get_entries_for_material(
                material_id=material_id,
                limit=limit,
                query=query,
                semantic_indexing=True
            )
            
            # Get material relationships if requested
            relationships = []
            if include_relationships and self.knowledge_client:
                relationships = await self.knowledge_client.get_material_relationships(
                    material_ids=[material_id],
                    relationship_types=self.config["relationship_types"],
                    max_relationships=self.config["max_relationships_per_material"]
                )
            
            # Create response with both entries and relationships
            return {
                "entries": entries,
                "relationships": relationships,
                "metadata": {
                    "material_id": material_id,
                    "query": query,
                    "entry_count": len(entries),
                    "relationship_count": len(relationships)
                }
            }
        except Exception as e:
            logger.error(f"Error fetching knowledge for material {material_id}: {str(e)}")
            return {"entries": [], "relationships": []}
    
    async def route_query(
        self,
        query: str,
        material_type: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        strategy: str = "hybrid"
    ) -> Dict[str, Any]:
        """
        Route a query between vector search and knowledge base based on the query type.
        
        Args:
            query: The user query
            material_type: Optional material type filter
            filters: Additional filters to apply
            strategy: Routing strategy (hybrid, vector_first, knowledge_first)
            
        Returns:
            Combined results from appropriate sources
        """
        if not self.vector_client or not self.knowledge_client:
            logger.error("Cannot route query: missing vector_client or knowledge_client")
            return {"results": [], "knowledge_entries": []}
            
        # Determine query type for intelligent routing
        query_type = self._determine_query_type(query)
        
        # Select routing strategy based on query type and specified strategy
        if strategy == "hybrid" or strategy == "auto":
            if query_type == "factual":
                # Knowledge-first for factual questions
                return await self._knowledge_first_search(query, material_type, filters)
            elif query_type == "comparative":
                # Balanced approach for comparative questions
                return await self._balanced_search(query, material_type, filters)
            else:
                # Vector-first for material discovery
                return await self._vector_first_search(query, material_type, filters)
        elif strategy == "vector_first":
            return await self._vector_first_search(query, material_type, filters)
        elif strategy == "knowledge_first":
            return await self._knowledge_first_search(query, material_type, filters)
        elif strategy == "balanced":
            return await self._balanced_search(query, material_type, filters)
        else:
            # Default to vector-first approach
            return await self._vector_first_search(query, material_type, filters)
    
    def _determine_query_type(self, query: str) -> str:
        """
        Determine the type of query for routing purposes.
        
        Args:
            query: The user query
            
        Returns:
            Query type: factual, comparative, or discovery
        """
        query_lower = query.lower()
        
        # Check for factual question patterns
        if any(term in query_lower for term in ["what is", "how to", "can you", "why is", "when"]):
            return "factual"
        
        # Check for comparative question patterns
        elif any(term in query_lower for term in ["compare", "versus", "vs", "difference", "better than", "similar to"]):
            return "comparative"
        
        # Check for material discovery patterns
        elif any(term in query_lower for term in ["find", "search", "looking for", "need a", "recommend", "suggest"]):
            return "discovery"
        
        # Default to discovery
        return "discovery"
    
    async def _vector_first_search(
        self,
        query: str,
        material_type: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Perform vector-first search with knowledge base enrichment.
        
        Args:
            query: The user query
            material_type: Optional material type filter
            filters: Additional filters to apply
            
        Returns:
            Search results with knowledge enrichment
        """
        try:
            # 1. First get vector search results
            vector_results = await self.vector_client.search(
                query=query,
                material_type=material_type,
                filters=filters,
                limit=self.config["max_materials_to_include"]
            )
            
            # Extract material IDs for knowledge lookup
            material_ids = [item.get("id") for item in vector_results if item.get("id")]
            
            # 2. Then enrich with knowledge base entries
            knowledge_entries = []
            if material_ids and self.knowledge_client:
                knowledge_entries = await self.knowledge_client.get_entries_for_materials(
                    material_ids=material_ids,
                    query=query,
                    semantic_indexing=True
                )
            
            # 3. Get material relationships
            relationships = []
            if material_ids and self.knowledge_client:
                relationships = await self.knowledge_client.get_material_relationships(
                    material_ids=material_ids,
                    relationship_types=self.config["relationship_types"]
                )
            
            return {
                "results": vector_results,
                "knowledge_entries": knowledge_entries,
                "relationships": relationships,
                "search_strategy": "vector_first",
                "query_type": self._determine_query_type(query)
            }
        except Exception as e:
            logger.error(f"Error in vector-first search: {str(e)}")
            return {"results": [], "knowledge_entries": [], "relationships": []}
    
    async def _knowledge_first_search(
        self,
        query: str,
        material_type: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Perform knowledge-first search with vector search backup.
        
        Args:
            query: The user query
            material_type: Optional material type filter
            filters: Additional filters to apply
            
        Returns:
            Search results with knowledge base prioritization
        """
        try:
            # 1. First search knowledge base directly
            knowledge_results = await self.knowledge_client.search_knowledge_base(
                query=query,
                material_type=material_type,
                limit=self.config["max_knowledge_entries"]
            )
            
            # Extract material IDs from knowledge results
            material_ids = []
            knowledge_entries = []
            
            for entry in knowledge_results:
                material_id = entry.get("material_id")
                if material_id and material_id not in material_ids:
                    material_ids.append(material_id)
                knowledge_entries.append(entry)
            
            # 2. Get material details for the found knowledge entries
            vector_results = []
            if material_ids and self.vector_client:
                vector_results = await self.vector_client.get_materials_by_ids(
                    material_ids=material_ids
                )
            
            # 3. If not enough materials, supplement with vector search
            if len(vector_results) < self.config["max_materials_to_include"] and self.vector_client:
                # Calculate how many more materials we need
                additional_needed = self.config["max_materials_to_include"] - len(vector_results)
                
                if additional_needed > 0:
                    # Get additional materials via vector search
                    additional_results = await self.vector_client.search(
                        query=query,
                        material_type=material_type,
                        filters=filters,
                        limit=additional_needed,
                        exclude_ids=material_ids  # Avoid duplicates
                    )
                    
                    # Merge results
                    for item in additional_results:
                        item_id = item.get("id")
                        if item_id and item_id not in material_ids:
                            vector_results.append(item)
                            material_ids.append(item_id)
            
            # 4. Get material relationships
            relationships = []
            if material_ids and self.knowledge_client:
                relationships = await self.knowledge_client.get_material_relationships(
                    material_ids=material_ids,
                    relationship_types=self.config["relationship_types"]
                )
            
            return {
                "results": vector_results,
                "knowledge_entries": knowledge_entries,
                "relationships": relationships,
                "search_strategy": "knowledge_first",
                "query_type": self._determine_query_type(query)
            }
        except Exception as e:
            logger.error(f"Error in knowledge-first search: {str(e)}")
            return {"results": [], "knowledge_entries": [], "relationships": []}
    
    async def _balanced_search(
        self,
        query: str,
        material_type: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Perform balanced search using both vector and knowledge base simultaneously.
        
        Args:
            query: The user query
            material_type: Optional material type filter
            filters: Additional filters to apply
            
        Returns:
            Balanced search results
        """
        try:
            # Execute both searches concurrently
            vector_task = self.vector_client.search(
                query=query,
                material_type=material_type,
                filters=filters,
                limit=self.config["max_materials_to_include"]
            ) if self.vector_client else None
            
            knowledge_task = self.knowledge_client.search_knowledge_base(
                query=query,
                material_type=material_type,
                limit=self.config["max_knowledge_entries"]
            ) if self.knowledge_client else None
            
            # Wait for both results
            vector_results = await vector_task if vector_task else []
            knowledge_results = await knowledge_task if knowledge_task else []
            
            # Process vector results
            material_ids_from_vector = [item.get("id") for item in vector_results if item.get("id")]
            
            # Process knowledge results
            material_ids_from_knowledge = []
            knowledge_entries = []
            
            for entry in knowledge_results:
                material_id = entry.get("material_id")
                if material_id and material_id not in material_ids_from_knowledge:
                    material_ids_from_knowledge.append(material_id)
                knowledge_entries.append(entry)
            
            # Combine unique material IDs
            all_material_ids = list(set(material_ids_from_vector + material_ids_from_knowledge))
            
            # Get full material details for materials found only in knowledge results
            if self.vector_client:
                knowledge_only_ids = [
                    material_id for material_id in material_ids_from_knowledge 
                    if material_id not in material_ids_from_vector
                ]
                
                if knowledge_only_ids:
                    additional_materials = await self.vector_client.get_materials_by_ids(
                        material_ids=knowledge_only_ids
                    )
                    
                    # Add to vector results
                    vector_results.extend(additional_materials)
            
            # Get relationships for all materials
            relationships = []
            if all_material_ids and self.knowledge_client:
                relationships = await self.knowledge_client.get_material_relationships(
                    material_ids=all_material_ids,
                    relationship_types=self.config["relationship_types"]
                )
            
            return {
                "results": vector_results,
                "knowledge_entries": knowledge_entries,
                "relationships": relationships,
                "search_strategy": "balanced",
                "query_type": self._determine_query_type(query)
            }
        except Exception as e:
            logger.error(f"Error in balanced search: {str(e)}")
            return {"results": [], "knowledge_entries": [], "relationships": []}


# Factory function to create a context assembler
def create_context_assembler(
    knowledge_client=None,
    vector_client=None,
    config: Optional[Dict[str, Any]] = None
) -> ContextAssembler:
    """
    Create a ContextAssembler with specified components and configuration.
    
    Args:
        knowledge_client: Client for knowledge base interaction
        vector_client: Client for vector store interaction
        config: Configuration parameters
        
    Returns:
        Configured ContextAssembler instance
    """
    return ContextAssembler(
        config=config,
        knowledge_client=knowledge_client,
        vector_client=vector_client
    )


# Example usage
if __name__ == "__main__":
    import asyncio
    
    async def main():
        # Example retrieved materials
        retrieved_materials = [
            {
                "id": "mat001",
                "name": "Oak Hardwood",
                "material_type": "wood",
                "description": "Premium oak hardwood with natural finish",
                "similarity": 0.92,
                "matched_by": "hybrid",
                "properties": {
                    "density": "0.75 g/cm³",
                    "hardness": "Medium-high",
                    "color": "Light brown",
                    "grain": "Pronounced grain pattern"
                }
            },
            {
                "id": "mat002",
                "name": "Maple Hardwood",
                "material_type": "wood",
                "description": "Smooth maple hardwood with consistent grain pattern",
                "similarity": 0.85,
                "matched_by": "dense",
                "properties": {
                    "density": "0.71 g/cm³",
                    "hardness": "Medium-high",
                    "color": "Pale cream to light reddish-brown",
                    "grain": "Fine, uniform grain"
                }
            }
        ]
        
        # Mock knowledge entries that would come from the knowledge client
        mock_knowledge = {
            "mat001": [
                {
                    "id": "k001",
                    "material_id": "mat001",
                    "content": "Oak hardwood flooring typically has a Janka hardness rating of 1290, making it durable for high-traffic areas.",
                    "confidence": 0.95,
                    "source": "Wood Industry Database",
                    "relevance": 0.9
                },
                {
                    "id": "k002",
                    "material_id": "mat001",
                    "content": "Oak hardwood expands and contracts with seasonal humidity changes, requiring acclimation before installation.",
                    "confidence": 0.92,
                    "source": "Flooring Installation Guide",
                    "relevance": 0.85
                }
            ],
            "mat002": [
                {
                    "id": "k003",
                    "material_id": "mat002",
                    "content": "Maple hardwood is known for its resistance to wear and abrasion, making it popular for basketball courts and dance floors.",
                    "confidence": 0.94,
                    "source": "Sports Flooring Manual",
                    "relevance": 0.88
                }
            ]
        }
        
        # Mock relationships
        mock_relationships = {
            "mat001": [
                {
                    "id": "r001",
                    "source_id": "mat001",
                    "source_name": "Oak Hardwood",
                    "target_id": "mat002",
                    "target_name": "Maple Hardwood",
                    "type": "similar_to",
                    "strength": 0.8,
                    "description": "Similar hardness and application, but different grain patterns"
                }
            ],
            "mat002": [
                {
                    "id": "r002",
                    "source_id": "mat002",
                    "source_name": "Maple Hardwood",
                    "target_id": "mat003",
                    "target_name": "Birch Hardwood",
                    "type": "similar_to",
                    "strength": 0.75,
                    "description": "Similar color and texture characteristics"
                }
            ]
        }
        
        # Create mock clients
        class MockKnowledgeClient:
            async def get_entries_for_materials(self, material_ids, **kwargs):
                entries = []
                for mat_id in material_ids:
                    if mat_id in mock_knowledge:
                        entries.extend(mock_knowledge[mat_id])
                return entries
            
            async def get_material_relationships(self, material_ids, **kwargs):
                rels = []
                for mat_id in material_ids:
                    if mat_id in mock_relationships:
                        rels.extend(mock_relationships[mat_id])
                return rels
        
        # Create and use context assembler
        assembler = create_context_assembler(
            knowledge_client=MockKnowledgeClient(),
            config={"format_type": "natural"}
        )
        
        context = await assembler.assemble_context(
            retrieved_materials=retrieved_materials,
            query="modern wood flooring options",
            user_context={"prefer_sustainable": True}
        )
        
        # Print natural language context
        print("Natural Language Context:")
        print(context.get("natural_language_context", ""))
    
    asyncio.run(main())