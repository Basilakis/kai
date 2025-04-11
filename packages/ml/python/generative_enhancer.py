#!/usr/bin/env python3
"""
Generative Enhancement Layer for RAG

This module provides LLM-powered enhancement of retrieved content, using:
1. Structured prompts that incorporate knowledge base entries as factual grounding
2. Citation system that references knowledge sources
3. Material similarity explanations with supporting evidence
4. Application recommendations with reasoning based on material properties
5. Streaming interface for progressive result delivery

It works with the Context Assembly System to provide factually-grounded,
enhanced responses for the RAG (Retrieval Augmented Generation) system.
"""

import asyncio
import json
import logging
import re
import time
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional, Tuple, Union

# Set up logging
logger = logging.getLogger("generative_enhancer")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Type aliases
ContextData = Dict[str, Any]
GenerativeResponse = Dict[str, Any]
PromptTemplate = str
StreamCallback = Callable[[str], None]


class GenerativeEnhancer:
    """
    Generative Enhancement Layer for the RAG pipeline.
    
    This class enhances assembled context with generative content, ensuring
    factual accuracy through grounding in retrieved information.
    """
    
    def __init__(
        self,
        llm_client=None,
        config: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize the Generative Enhancer.
        
        Args:
            llm_client: Client for LLM interactions
            config: Configuration parameters
        """
        # Default configuration
        self.config = {
            # LLM configuration
            "model": "gpt-4-turbo",
            "temperature": 0.7,
            "max_tokens": 1000,
            "streaming_enabled": True,
            
            # Enhancement settings
            "enhancement_types": ["explanation", "similarity", "application", "citation"],
            "citation_style": "inline",  # Options: inline, footnote, endnote
            "detail_level": "medium",    # Options: brief, medium, detailed
            
            # Prompt templates
            "system_prompt_template": (
                "You are a materials expert assistant. Use only the provided context to answer "
                "questions about materials. When information is not in the context, acknowledge "
                "the limitations. Always cite sources for specific facts."
            ),
            
            # Response structure
            "include_source_properties": True,
            "include_confidence_scores": True,
            "structured_response": True,
            
            # Progressive enhancement
            "prioritize_speed": False,
            "max_parallel_requests": 2
        }
        
        # Update with provided configuration
        if config:
            self.config.update(config)
        
        # Initialize LLM client
        self.llm_client = llm_client
        if not self.llm_client:
            logger.warning("No LLM client provided, attempting to use built-in OpenAI client")
            try:
                import openai
                self.llm_client = openai
            except ImportError:
                logger.error("OpenAI package not available. Please provide an LLM client or install openai package")
        
        logger.info("Generative Enhancer initialized with configuration: %s", self.config)
    
    async def enhance(
        self,
        context: ContextData,
        query: str,
        enhancement_types: Optional[List[str]] = None,
        stream_handler: Optional[StreamCallback] = None
    ) -> GenerativeResponse:
        """
        Enhance the assembled context with generative content.
        
        Args:
            context: Assembled context data
            query: User query
            enhancement_types: Specific enhancements to apply
            stream_handler: Callback for streaming responses
            
        Returns:
            Enhanced response data
        """
        start_time = time.time()
        logger.info("Starting generative enhancement for query: %s", query)
        
        # Determine enhancement types to apply
        if enhancement_types:
            active_enhancements = [e for e in enhancement_types if e in self.config["enhancement_types"]]
            if not active_enhancements:
                active_enhancements = self.config["enhancement_types"]
        else:
            active_enhancements = self.config["enhancement_types"]
        
        # Prepare the initial response structure
        response = {
            "query": query,
            "materials": [],
            "enhancements": {},
            "metadata": {
                "enhancement_types": active_enhancements,
                "model": self.config["model"],
                "generation_time": 0,
                "timestamp": time.time()
            },
            "citations": []
        }
        
        # Copy material basics from context
        for material in context.get("materials", []):
            response["materials"].append({
                "id": material.get("id", ""),
                "name": material.get("name", ""),
                "material_type": material.get("material_type", ""),
                "similarity_score": material.get("similarity_score", 0)
            })
        
        # Apply each enhancement type
        try:
            if "explanation" in active_enhancements:
                explanations = await self._generate_explanations(context, query, stream_handler)
                response["enhancements"]["explanations"] = explanations
            
            if "similarity" in active_enhancements:
                similarities = await self._generate_similarity_analysis(context, query)
                response["enhancements"]["similarities"] = similarities
            
            if "application" in active_enhancements:
                applications = await self._generate_application_recommendations(context, query)
                response["enhancements"]["applications"] = applications
            
            # Always process citations if any other enhancement is active
            if active_enhancements:
                citations = self._extract_citations(response)
                response["citations"] = citations
            
            # Add timing information
            generation_time = time.time() - start_time
            response["metadata"]["generation_time"] = generation_time
            
            logger.info("Generative enhancement completed in %.2f seconds", generation_time)
            return response
            
        except Exception as e:
            logger.error(f"Error during generative enhancement: {str(e)}")
            # Return partial response with error information
            response["metadata"]["error"] = str(e)
            response["metadata"]["completion_status"] = "error"
            return response
    
    async def _generate_explanations(
        self,
        context: ContextData,
        query: str,
        stream_handler: Optional[StreamCallback] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate explanations for materials based on the context.
        
        Args:
            context: Assembled context data
            query: User query
            stream_handler: Optional callback for streaming responses
            
        Returns:
            List of material explanations
        """
        materials = context.get("materials", [])
        if not materials:
            return []
        
        # Determine if we should stream
        streaming = self.config["streaming_enabled"] and stream_handler is not None
        
        # Build the prompt for explanations
        prompt = self._build_explanation_prompt(context, query)
        
        # Generate content
        if streaming:
            explanations, citations = await self._stream_llm_response(prompt, stream_handler)
        else:
            explanations, citations = await self._get_llm_response(prompt)
        
        # Process explanations
        structured_explanations = self._process_explanations(explanations, materials, context)
        
        return structured_explanations
    
    def _build_explanation_prompt(
        self,
        context: ContextData,
        query: str
    ) -> Dict[str, Any]:
        """
        Build a prompt for generating material explanations.
        
        Args:
            context: Assembled context data
            query: User query
            
        Returns:
            Formatted prompt
        """
        # Get materials and knowledge facts
        materials = context.get("materials", [])
        knowledge_facts = context.get("knowledge_facts", [])
        
        # Format materials data
        materials_text = ""
        for i, material in enumerate(materials[:5]):  # Limit to top 5 materials
            material_text = f"""
Material {i+1}: {material.get('name', 'Unknown Material')} ({material.get('material_type', 'Unknown Type')})
"""
            
            if "description" in material:
                material_text += f"Description: {material['description']}\n"
            
            if material.get("properties"):
                props_text = "\n".join([
                    f"- {prop}: {value}" 
                    for prop, value in material["properties"].items()
                ])
                material_text += f"Properties:\n{props_text}\n"
            
            materials_text += material_text
        
        # Format knowledge facts
        facts_text = ""
        if knowledge_facts:
            facts_text = "Relevant Facts:\n"
            
            for i, fact in enumerate(knowledge_facts):
                material_name = fact.get("material_name", "")
                fact_content = fact.get("fact", "")
                source = fact.get("source", "")
                
                facts_text += f"{i+1}. [{material_name}] {fact_content}"
                if source:
                    facts_text += f" (Source: {source})"
                facts_text += "\n"
        
        # Create the context section
        context_text = f"""
User Query: {query}

Retrieved Materials:
{materials_text}

{facts_text}
"""

        # Build system prompt
        detail_level = self.config["detail_level"]
        detail_instructions = ""
        
        if detail_level == "brief":
            detail_instructions = "Provide concise explanations focusing only on the most relevant aspects."
        elif detail_level == "detailed":
            detail_instructions = "Provide comprehensive explanations covering multiple aspects of each material."
        else:  # medium
            detail_instructions = "Provide balanced explanations with moderate detail on important aspects."
        
        system_prompt = f"""
{self.config['system_prompt_template']}

{detail_instructions}

For each material:
1. Explain its key properties and characteristics relevant to the query
2. Describe what makes it suitable or unsuitable for the use case
3. Highlight any important considerations for working with this material

When citing facts, use the format [Source: Name] for proper attribution.
Only use information provided in the context. If information is missing, acknowledge the limitation.
"""

        # Build user prompt
        user_prompt = f"""
Based on the provided information, explain each material's suitability for: {query}

{context_text}
"""

        # Return formatted prompt
        return {
            "system": system_prompt,
            "user": user_prompt
        }
    
    def _process_explanations(
        self,
        explanations: str,
        materials: List[Dict[str, Any]],
        context: ContextData
    ) -> List[Dict[str, Any]]:
        """
        Process and structure the generated explanations.
        
        Args:
            explanations: Raw explanations text
            materials: Material data
            context: Full context data
            
        Returns:
            Structured explanations
        """
        structured_explanations = []
        
        # Simple approach: Split by material mentions
        material_names = [m.get("name", "") for m in materials if m.get("name")]
        material_sections = {}
        
        current_material = None
        current_text = []
        
        # Try to segment the explanations by material
        for line in explanations.split("\n"):
            # Check if this line starts a new material section
            matched_material = None
            for material_name in material_names:
                # Look for material name at the start of a line or with common prefixes
                patterns = [
                    f"^{re.escape(material_name)}:",
                    f"^{re.escape(material_name)} -",
                    f"^For {re.escape(material_name)}",
                    f"^{re.escape(material_name)}$",
                    f"^[0-9]+\\. {re.escape(material_name)}"
                ]
                
                for pattern in patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        matched_material = material_name
                        break
                
                if matched_material:
                    break
            
            if matched_material:
                # Save previous material section
                if current_material and current_text:
                    material_sections[current_material] = "\n".join(current_text).strip()
                
                # Start new section
                current_material = matched_material
                current_text = [line]
            elif current_material:
                # Continue current section
                current_text.append(line)
            else:
                # Introduction or uncategorized text
                pass
        
        # Save the last section
        if current_material and current_text:
            material_sections[current_material] = "\n".join(current_text).strip()
        
        # If we failed to segment properly, use the whole text for each material
        if not material_sections and materials:
            for material in materials:
                material_name = material.get("name", "")
                if material_name:
                    material_sections[material_name] = explanations
        
        # Create structured explanations
        for material in materials:
            material_name = material.get("name", "")
            if not material_name:
                continue
                
            explanation_text = material_sections.get(material_name, "")
            if not explanation_text:
                # Try partial matching
                for name, text in material_sections.items():
                    if material_name in name or name in material_name:
                        explanation_text = text
                        break
            
            # Create structured explanation
            structured_explanation = {
                "material_id": material.get("id", ""),
                "material_name": material_name,
                "explanation": explanation_text
            }
            
            # Extract any properties mentioned in the explanation
            properties = material.get("properties", {})
            if properties:
                mentioned_properties = {}
                for prop_name, prop_value in properties.items():
                    if prop_name.lower() in explanation_text.lower():
                        mentioned_properties[prop_name] = prop_value
                
                if mentioned_properties:
                    structured_explanation["referenced_properties"] = mentioned_properties
            
            structured_explanations.append(structured_explanation)
        
        return structured_explanations
    
    async def _generate_similarity_analysis(
        self,
        context: ContextData,
        query: str
    ) -> List[Dict[str, Any]]:
        """
        Generate similarity analysis between materials.
        
        Args:
            context: Assembled context data
            query: User query
            
        Returns:
            Similarity analysis data
        """
        materials = context.get("materials", [])
        relationships = context.get("relationships", [])
        
        if len(materials) < 2:
            return []  # Need at least 2 materials for comparison
        
        # Build the prompt for similarity analysis
        prompt = self._build_similarity_prompt(context, query)
        
        # Generate content
        similarity_text, _ = await self._get_llm_response(prompt)
        
        # Process similarity analysis
        structured_similarities = self._process_similarities(similarity_text, materials, relationships)
        
        return structured_similarities
    
    def _build_similarity_prompt(
        self,
        context: ContextData,
        query: str
    ) -> Dict[str, Any]:
        """
        Build a prompt for generating similarity analysis.
        
        Args:
            context: Assembled context data
            query: User query
            
        Returns:
            Formatted prompt
        """
        # Get materials and relationships
        materials = context.get("materials", [])
        relationships = context.get("relationships", [])
        
        # Format materials data
        materials_text = ""
        for i, material in enumerate(materials[:5]):  # Limit to top 5 materials
            material_text = f"""
Material {i+1}: {material.get('name', 'Unknown Material')} ({material.get('material_type', 'Unknown Type')})
"""
            
            if "description" in material:
                material_text += f"Description: {material['description']}\n"
            
            if material.get("properties"):
                props_text = "\n".join([
                    f"- {prop}: {value}" 
                    for prop, value in material["properties"].items()
                ])
                material_text += f"Properties:\n{props_text}\n"
            
            materials_text += material_text
        
        # Format relationships data
        relationships_text = ""
        if relationships:
            relationships_text = "Known Relationships:\n"
            
            for i, rel in enumerate(relationships):
                source = rel.get("source_name", "")
                target = rel.get("target_name", "")
                rel_type = rel.get("type", "related to")
                desc = rel.get("description", "")
                
                relationships_text += f"{i+1}. {source} is {rel_type} {target}"
                if desc:
                    relationships_text += f": {desc}"
                relationships_text += "\n"
        
        # Create context section
        context_text = f"""
User Query: {query}

Retrieved Materials:
{materials_text}

{relationships_text}
"""

        # Build system prompt
        system_prompt = f"""
{self.config['system_prompt_template']}

You are tasked with analyzing similarities and differences between materials that are relevant to the user's query.

For each pair of materials, identify:
1. Key shared properties or characteristics
2. Important differences that would affect their suitability
3. Specific scenarios where one might be preferred over the other

Focus on properties that are most relevant to the user's query.
Only use information provided in the context. If information is missing, acknowledge the limitation.
"""

        # Build user prompt
        user_prompt = f"""
Based on the provided information, analyze the similarities and differences between the retrieved materials in relation to: {query}

{context_text}

Provide a comparative analysis focusing on how these similarities and differences impact their suitability for the query.
"""

        # Return formatted prompt
        return {
            "system": system_prompt,
            "user": user_prompt
        }
    
    def _process_similarities(
        self,
        similarity_text: str,
        materials: List[Dict[str, Any]],
        relationships: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Process and structure the generated similarity analysis.
        
        Args:
            similarity_text: Raw similarity analysis text
            materials: Material data
            relationships: Relationship data
            
        Returns:
            Structured similarity analysis
        """
        # Create all possible material pairs
        material_pairs = []
        for i, mat1 in enumerate(materials):
            for mat2 in materials[i+1:]:
                pair = {
                    "material1": {
                        "id": mat1.get("id", ""),
                        "name": mat1.get("name", "")
                    },
                    "material2": {
                        "id": mat2.get("id", ""),
                        "name": mat2.get("name", "")
                    },
                    "comparison": "",
                    "shared_properties": [],
                    "differences": []
                }
                
                # Check if there's a known relationship
                for rel in relationships:
                    source_id = rel.get("source_id", "")
                    target_id = rel.get("target_id", "")
                    
                    if ((source_id == mat1.get("id", "") and target_id == mat2.get("id", "")) or
                        (source_id == mat2.get("id", "") and target_id == mat1.get("id", ""))):
                        pair["relationship"] = {
                            "type": rel.get("type", ""),
                            "description": rel.get("description", ""),
                            "strength": rel.get("strength", 0)
                        }
                        break
                
                material_pairs.append(pair)
        
        # Try to match comparison text to each pair
        for pair in material_pairs:
            mat1_name = pair["material1"]["name"]
            mat2_name = pair["material2"]["name"]
            
            # Look for sections that compare these materials
            comparison_pattern = re.compile(
                f"(.*{re.escape(mat1_name)}.*{re.escape(mat2_name)}.*|.*{re.escape(mat2_name)}.*{re.escape(mat1_name)}.*)",
                re.DOTALL | re.IGNORECASE
            )
            
            matches = comparison_pattern.findall(similarity_text)
            if matches:
                # Join all matching sections
                pair["comparison"] = "\n".join(matches)
                
                # Try to extract shared properties and differences
                shared_pattern = re.compile(
                    r"(similar|shared|both|common|alike).*?[:\.](.*?)(?=\n\n|\n[A-Z]|$)",
                    re.DOTALL | re.IGNORECASE
                )
                diff_pattern = re.compile(
                    r"(differences?|distinct|unique|contrast|unlike).*?[:\.](.*?)(?=\n\n|\n[A-Z]|$)",
                    re.DOTALL | re.IGNORECASE
                )
                
                shared_matches = shared_pattern.findall(pair["comparison"])
                diff_matches = diff_pattern.findall(pair["comparison"])
                
                if shared_matches:
                    # Extract shared properties
                    for _, shared_text in shared_matches:
                        # Split by bullet points or commas
                        for prop in re.split(r'•|\n-|,', shared_text):
                            prop = prop.strip()
                            if prop and len(prop) > 5:  # Minimum length to be meaningful
                                pair["shared_properties"].append(prop)
                
                if diff_matches:
                    # Extract differences
                    for _, diff_text in diff_matches:
                        # Split by bullet points or commas
                        for diff in re.split(r'•|\n-|,', diff_text):
                            diff = diff.strip()
                            if diff and len(diff) > 5:  # Minimum length to be meaningful
                                pair["differences"].append(diff)
        
        # For pairs without matches, use the whole text
        for pair in material_pairs:
            if not pair["comparison"]:
                pair["comparison"] = similarity_text
        
        return material_pairs
    
    async def _generate_application_recommendations(
        self,
        context: ContextData,
        query: str
    ) -> List[Dict[str, Any]]:
        """
        Generate application recommendations for materials.
        
        Args:
            context: Assembled context data
            query: User query
            
        Returns:
            Application recommendations data
        """
        materials = context.get("materials", [])
        if not materials:
            return []
        
        # Build the prompt for application recommendations
        prompt = self._build_application_prompt(context, query)
        
        # Generate content
        applications_text, _ = await self._get_llm_response(prompt)
        
        # Process application recommendations
        structured_applications = self._process_applications(applications_text, materials)
        
        return structured_applications
    
    def _build_application_prompt(
        self,
        context: ContextData,
        query: str
    ) -> Dict[str, Any]:
        """
        Build a prompt for generating application recommendations.
        
        Args:
            context: Assembled context data
            query: User query
            
        Returns:
            Formatted prompt
        """
        # Get materials and knowledge facts
        materials = context.get("materials", [])
        knowledge_facts = context.get("knowledge_facts", [])
        
        # Format materials data
        materials_text = ""
        for i, material in enumerate(materials[:5]):  # Limit to top 5 materials
            material_text = f"""
Material {i+1}: {material.get('name', 'Unknown Material')} ({material.get('material_type', 'Unknown Type')})
"""
            
            if "description" in material:
                material_text += f"Description: {material['description']}\n"
            
            if material.get("properties"):
                props_text = "\n".join([
                    f"- {prop}: {value}" 
                    for prop, value in material["properties"].items()
                ])
                material_text += f"Properties:\n{props_text}\n"
            
            materials_text += material_text
        
        # Format knowledge facts
        facts_text = ""
        if knowledge_facts:
            facts_text = "Relevant Facts:\n"
            
            for i, fact in enumerate(knowledge_facts):
                material_name = fact.get("material_name", "")
                fact_content = fact.get("fact", "")
                source = fact.get("source", "")
                
                facts_text += f"{i+1}. [{material_name}] {fact_content}"
                if source:
                    facts_text += f" (Source: {source})"
                facts_text += "\n"
        
        # Create context section
        context_text = f"""
User Query: {query}

Retrieved Materials:
{materials_text}

{facts_text}
"""

        # Build system prompt
        system_prompt = f"""
{self.config['system_prompt_template']}

You are tasked with recommending specific applications for each material based on their properties and the user's query.

For each material, provide:
1. Recommended applications or use cases relevant to the query
2. Explanation of why the material is suitable for these applications
3. Any considerations or limitations for these applications
4. Installation or maintenance requirements if relevant

Be specific and practical in your recommendations. Consider cost, durability, aesthetics, and performance.
Only use information provided in the context. If information is missing, acknowledge the limitation.
"""

        # Build user prompt
        user_prompt = f"""
Based on the provided information, recommend specific applications for each material in relation to: {query}

{context_text}

For each material, provide practical recommendations with reasoning based on its properties.
"""

        # Return formatted prompt
        return {
            "system": system_prompt,
            "user": user_prompt
        }
    
    def _process_applications(
        self,
        applications_text: str,
        materials: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Process and structure the generated application recommendations.
        
        Args:
            applications_text: Raw application recommendations text
            materials: Material data
            
        Returns:
            Structured application recommendations
        """
        # Simple approach: Split by material mentions
        material_names = [m.get("name", "") for m in materials if m.get("name")]
        material_sections = {}
        
        current_material = None
        current_text = []
        
        # Try to segment the recommendations by material
        for line in applications_text.split("\n"):
            # Check if this line starts a new material section
            matched_material = None
            for material_name in material_names:
                # Look for material name at the start of a line or with common prefixes
                patterns = [
                    f"^{re.escape(material_name)}:",
                    f"^{re.escape(material_name)} -",
                    f"^For {re.escape(material_name)}",
                    f"^{re.escape(material_name)}$",
                    f"^[0-9]+\\. {re.escape(material_name)}"
                ]
                
                for pattern in patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        matched_material = material_name
                        break
                
                if matched_material:
                    break
            
            if matched_material:
                # Save previous material section
                if current_material and current_text:
                    material_sections[current_material] = "\n".join(current_text).strip()
                
                # Start new section
                current_material = matched_material
                current_text = [line]
            elif current_material:
                # Continue current section
                current_text.append(line)
        
        # Save the last section
        if current_material and current_text:
            material_sections[current_material] = "\n".join(current_text).strip()
        
        # Create structured recommendations
        structured_applications = []
        
        for material in materials:
            material_name = material.get("name", "")
            if not material_name:
                continue
                
            # Get recommendation text
            recommendation_text = material_sections.get(material_name, "")
            if not recommendation_text:
                # Try partial matching
                for name, text in material_sections.items():
                    if material_name in name or name in material_name:
                        recommendation_text = text
                        break
            
            # Extract specific recommendations
            recommendations = []
            recommendation_pattern = re.compile(
                r"(?:^|\n)[-•*]?\s*([^.\n]+(?:[.!?]+|$))",
                re.MULTILINE
            )
            
            recommendation_matches = recommendation_pattern.findall(recommendation_text)
            if recommendation_matches:
                for rec in recommendation_matches:
                    rec = rec.strip()
                    # Filter out headers and short lines
                    if rec and len(rec) > 10 and ":" not in rec[:15]:
                        recommendations.append(rec)
            
            # Create structured recommendation
            structured_application = {
                "material_id": material.get("id", ""),
                "material_name": material_name,
                "recommendations_text": recommendation_text
            }
            
            if recommendations:
                structured_application["specific_recommendations"] = recommendations
            
            structured_applications.append(structured_application)
        
        return structured_applications
    
    def _extract_citations(
        self,
        response: GenerativeResponse
    ) -> List[Dict[str, Any]]:
        """
        Extract and format citations from the enhanced response.
        
        Args:
            response: Enhanced response data
            
        Returns:
            List of formatted citations
        """
        citations = []
        citation_style = self.config["citation_style"]
        citation_pattern = None
        
        # Define pattern based on citation style
        if citation_style == "inline":
            citation_pattern = r"\[Source:\s*([^\]]+)\]"
        elif citation_style == "footnote":
            citation_pattern = r"\[\^(\d+)\]"
        elif citation_style == "endnote":
            citation_pattern = r"\[(\d+)\]"
        else:
            # Default pattern
            citation_pattern = r"\[(?:Source|Ref|Citation):\s*([^\]]+)\]"
        
        # Extract citations from explanations
        explanations = response.get("enhancements", {}).get("explanations", [])
        for explanation in explanations:
            explanation_text = explanation.get("explanation", "")
            matches = re.findall(citation_pattern, explanation_text)
            
            # Add unique citations
            for match in matches:
                source = match.strip()
                citation_id = f"cit-{len(citations) + 1}"
                
                # Check if this citation already exists
                exists = False
                for citation in citations:
                    if citation["source"] == source:
                        exists = True
                        break
                
                if not exists:
                    citations.append({
                        "id": citation_id,
                        "source": source,
                        "material_id": explanation.get("material_id", ""),
                        "material_name": explanation.get("material_name", "")
                    })
        
        # Extract citations from similarities
        similarities = response.get("enhancements", {}).get("similarities", [])
        for similarity in similarities:
            comparison_text = similarity.get("comparison", "")
            matches = re.findall(citation_pattern, comparison_text)
            
            # Add unique citations
            for match in matches:
                source = match.strip()
                citation_id = f"cit-{len(citations) + 1}"
                
                # Check if this citation already exists
                exists = False
                for citation in citations:
                    if citation["source"] == source:
                        exists = True
                        break
                
                if not exists:
                    citations.append({
                        "id": citation_id,
                        "source": source,
                        "material1_id": similarity.get("material1", {}).get("id", ""),
                        "material2_id": similarity.get("material2", {}).get("id", "")
                    })
        
        # Extract citations from applications
        applications = response.get("enhancements", {}).get("applications", [])
        for application in applications:
            recommendations_text = application.get("recommendations_text", "")
            matches = re.findall(citation_pattern, recommendations_text)
            
            # Add unique citations
            for match in matches:
                source = match.strip()
                citation_id = f"cit-{len(citations) + 1}"
                
                # Check if this citation already exists
                exists = False
                for citation in citations:
                    if citation["source"] == source:
                        exists = True
                        break
                
                if not exists:
                    citations.append({
                        "id": citation_id,
                        "source": source,
                        "material_id": application.get("material_id", ""),
                        "material_name": application.get("material_name", "")
                    })
        
        return citations
    
    async def _get_llm_response(
        self,
        prompt: Dict[str, str]
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Get response from LLM for the given prompt.
        
        Args:
            prompt: Formatted prompt
            
        Returns:
            Tuple of (response text, extracted citations)
        """
        if not self.llm_client:
            raise ValueError("LLM client not available")
        
        try:
            # Call the LLM
            response = await self.llm_client.chat.completions.create(
                model=self.config["model"],
                messages=[
                    {"role": "system", "content": prompt["system"]},
                    {"role": "user", "content": prompt["user"]}
                ],
                temperature=self.config["temperature"],
                max_tokens=self.config["max_tokens"]
            )
            
            # Extract response text
            response_text = response.choices[0].message.content
            
            # Extract citations
            citations = []
            citation_pattern = r"\[(?:Source|Ref|Citation):\s*([^\]]+)\]"
            matches = re.findall(citation_pattern, response_text)
            
            for match in matches:
                source = match.strip()
                citation_id = f"cit-{len(citations) + 1}"
                
                # Check if this citation already exists
                exists = False
                for citation in citations:
                    if citation["source"] == source:
                        exists = True
                        break
                
                if not exists:
                    citations.append({
                        "id": citation_id,
                        "source": source
                    })
            
            return response_text, citations
            
        except Exception as e:
            logger.error(f"Error calling LLM: {str(e)}")
            raise
    
    async def _stream_llm_response(
        self,
        prompt: Dict[str, str],
        stream_handler: StreamCallback
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Stream response from LLM for the given prompt.
        
        Args:
            prompt: Formatted prompt
            stream_handler: Callback for streaming responses
            
        Returns:
            Tuple of (full response text, extracted citations)
        """
        if not self.llm_client:
            raise ValueError("LLM client not available")
        
        try:
            # Call the LLM with streaming
            stream = await self.llm_client.chat.completions.create(
                model=self.config["model"],
                messages=[
                    {"role": "system", "content": prompt["system"]},
                    {"role": "user", "content": prompt["user"]}
                ],
                temperature=self.config["temperature"],
                max_tokens=self.config["max_tokens"],
                stream=True
            )
            
            # Process the stream
            collected_response = ""
            
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    collected_response += content
                    
                    # Call the stream handler
                    if stream_handler:
                        stream_handler(content)
            
            # Extract citations
            citations = []
            citation_pattern = r"\[(?:Source|Ref|Citation):\s*([^\]]+)\]"
            matches = re.findall(citation_pattern, collected_response)
            
            for match in matches:
                source = match.strip()
                citation_id = f"cit-{len(citations) + 1}"
                
                # Check if this citation already exists
                exists = False
                for citation in citations:
                    if citation["source"] == source:
                        exists = True
                        break
                
                if not exists:
                    citations.append({
                        "id": citation_id,
                        "source": source
                    })
            
            return collected_response, citations
            
        except Exception as e:
            logger.error(f"Error streaming from LLM: {str(e)}")
            raise
    
    async def stream_enhanced_response(
        self,
        context: ContextData,
        query: str,
        stream_handler: StreamCallback
    ) -> AsyncGenerator[str, None]:
        """
        Stream an enhanced response in real-time.
        
        Args:
            context: Assembled context data
            query: User query
            stream_handler: Callback for handling streamed content
            
        Yields:
            Chunks of the enhanced response
        """
        if not self.config["streaming_enabled"]:
            raise ValueError("Streaming is not enabled in configuration")
        
        try:
            # Prepare the prompt
            prompt = self._build_explanation_prompt(context, query)
            
            # Stream response from LLM
            stream = await self.llm_client.chat.completions.create(
                model=self.config["model"],
                messages=[
                    {"role": "system", "content": prompt["system"]},
                    {"role": "user", "content": prompt["user"]}
                ],
                temperature=self.config["temperature"],
                max_tokens=self.config["max_tokens"],
                stream=True
            )
            
            # Process the stream
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    
                    # Call the stream handler
                    if stream_handler:
                        stream_handler(content)
                    
                    # Yield the content
                    yield content
                    
        except Exception as e:
            logger.error(f"Error streaming enhanced response: {str(e)}")
            yield f"Error generating response: {str(e)}"


# Factory function to create a generative enhancer
def create_generative_enhancer(
    llm_client=None,
    config: Optional[Dict[str, Any]] = None
) -> GenerativeEnhancer:
    """
    Create a GenerativeEnhancer with specified LLM client and configuration.
    
    Args:
        llm_client: Client for LLM interaction
        config: Configuration parameters
        
    Returns:
        Configured GenerativeEnhancer instance
    """
    return GenerativeEnhancer(
        llm_client=llm_client,
        config=config
    )


# Example usage
if __name__ == "__main__":
    import asyncio
    
    async def main():
        # Mock LLM client
        class MockLLMClient:
            class ChatCompletions:
                async def create(self, model, messages, temperature, max_tokens, stream=False):
                    class Response:
                        class Choice:
                            class Message:
                                content = """
Oak Hardwood:
This premium hardwood is well-suited for your modern flooring needs due to its excellent durability and timeless aesthetic. With a Janka hardness rating of 1290 [Source: Wood Industry Database], oak can withstand high-traffic areas in your home. Its pronounced grain pattern offers visual interest and its light brown color creates a warm, inviting atmosphere.

Oak hardwood does require acclimation before installation as it expands and contracts with seasonal humidity changes [Source: Flooring Installation Guide]. This natural property means proper installation is crucial for long-term performance.

For modern interiors, oak provides versatility in finishing options - it can be stained in various tones from light natural to darker shades, allowing it to complement different design aesthetics.

Maple Hardwood:
Maple hardwood offers exceptional wear resistance, making it an excellent choice for contemporary flooring. Its resistance to abrasion has made it a popular choice for basketball courts and dance floors [Source: Sports Flooring Manual], demonstrating its capability to withstand heavy use.

The fine, uniform grain pattern of maple creates a more consistent, clean appearance compared to oak, which may better suit minimalist modern designs. Its pale cream to light reddish-brown coloration offers a bright, airy feel that can make spaces appear larger.

Maple is slightly harder than oak on the Janka scale, providing superior dent resistance. However, it doesn't accept stain as evenly as oak, so it's best appreciated in its natural color or with clear finishes that highlight its subtle beauty.
"""
                            def __init__(self):
                                self.message = self.Message()
                                self.delta = self.Message()
                        def __init__(self):
                            self.choices = [self.Choice()]
                    return Response()
            def __init__(self):
                self.chat = self.ChatCompletions()
        
        # Example context data
        context = {
            "query": "modern wood flooring options",
            "materials": [
                {
                    "id": "mat001",
                    "name": "Oak Hardwood",
                    "material_type": "wood",
                    "description": "Premium oak hardwood with natural finish",
                    "similarity_score": 0.92,
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
                    "similarity_score": 0.85,
                    "properties": {
                        "density": "0.71 g/cm³",
                        "hardness": "Medium-high",
                        "color": "Pale cream to light reddish-brown",
                        "grain": "Fine, uniform grain"
                    }
                }
            ],
            "knowledge_facts": [
                {
                    "id": "k001",
                    "material_id": "mat001",
                    "material_name": "Oak Hardwood",
                    "fact": "Oak hardwood flooring typically has a Janka hardness rating of 1290, making it durable for high-traffic areas.",
                    "source": "Wood Industry Database"
                },
                {
                    "id": "k002",
                    "material_id": "mat001",
                    "material_name": "Oak Hardwood",
                    "fact": "Oak hardwood expands and contracts with seasonal humidity changes, requiring acclimation before installation.",
                    "source": "Flooring Installation Guide"
                },
                {
                    "id": "k003",
                    "material_id": "mat002",
                    "material_name": "Maple Hardwood",
                    "fact": "Maple hardwood is known for its resistance to wear and abrasion, making it popular for basketball courts and dance floors.",
                    "source": "Sports Flooring Manual"
                }
            ]
        }
        
        # Create and use generative enhancer
        enhancer = create_generative_enhancer(
            llm_client=MockLLMClient(),
            config={"citation_style": "inline"}
        )
        
        def stream_callback(content):
            print(content, end='', flush=True)
        
        response = await enhancer.enhance(
            context=context,
            query="modern wood flooring options",
            enhancement_types=["explanation", "citation"],
            stream_handler=stream_callback
        )
        
        # Print citations
        print("\n\nCitations:")
        for citation in response["citations"]:
            print(f"- {citation['source']}")
    
    asyncio.run(main())