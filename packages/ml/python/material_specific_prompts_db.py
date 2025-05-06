#!/usr/bin/env python3
"""
Material-Specific Prompt Templates with Database Integration

This module provides specialized prompt templates optimized for different material types,
fetched from the database. This allows for dynamic updates to prompts without code changes.

Key features:
1. Material-specific system prompts with domain expertise
2. Specialized instruction sets for different material types
3. Material-specific evaluation criteria
4. Custom citation formats for different material domains
5. Database integration for dynamic prompt management
"""

import logging
import os
import json
import requests
from typing import Dict, Any, List, Optional

# Set up logging
logger = logging.getLogger(__name__)

# Material type groupings based on shared characteristics
TEXTURE_FOCUSED_MATERIALS = ['fabric', 'wood', 'leather', 'paper']
COLOR_FOCUSED_MATERIALS = ['paint', 'plastic', 'vinyl', 'laminate']
STRUCTURE_FOCUSED_MATERIALS = ['metal', 'stone', 'ceramic', 'glass', 'tile', 'porcelain', 'concrete']
SOFT_MATERIALS = ['carpet', 'fabric', 'leather']

# All supported material types
ALL_MATERIAL_TYPES = list(set(
    TEXTURE_FOCUSED_MATERIALS +
    COLOR_FOCUSED_MATERIALS +
    STRUCTURE_FOCUSED_MATERIALS +
    SOFT_MATERIALS +
    ['other']
))

# Fallback base system prompt template in case database is unavailable
FALLBACK_BASE_SYSTEM_PROMPT = """
You are a materials expert assistant specializing in {material_type} materials.
Use only the provided context to answer questions about materials.
When information is not in the context, acknowledge the limitations.
Always cite sources for specific facts.
"""

# Prompt cache to reduce database calls
prompt_cache = {}

def get_api_url():
    """Get the API URL from environment variables"""
    base_url = os.environ.get('API_URL', 'http://localhost:3000')
    return f"{base_url}/api/admin/prompts"

def get_api_key():
    """Get the API key from environment variables"""
    return os.environ.get('API_KEY', '')

def fetch_prompt_from_db(name: str, prompt_type: str = 'material_specific') -> Optional[str]:
    """
    Fetch a prompt from the database
    
    Args:
        name: Name of the prompt
        prompt_type: Type of prompt
        
    Returns:
        Prompt content or None if not found
    """
    # Check cache first
    cache_key = f"{prompt_type}:{name}"
    if cache_key in prompt_cache:
        return prompt_cache[cache_key]
    
    try:
        # Fetch from API
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {get_api_key()}'
        }
        
        response = requests.get(
            f"{get_api_url()}?type={prompt_type}",
            headers=headers
        )
        
        if response.status_code != 200:
            logger.warning(f"Failed to fetch prompts: {response.status_code} {response.text}")
            return None
        
        data = response.json()
        
        if not data.get('success'):
            logger.warning(f"API returned error: {data.get('message')}")
            return None
        
        prompts = data.get('data', [])
        
        # Find the prompt by name
        for prompt in prompts:
            if prompt['name'] == name and prompt['promptType'] == prompt_type and prompt['isActive']:
                # Cache the result
                prompt_cache[cache_key] = prompt['content']
                return prompt['content']
        
        logger.warning(f"Prompt not found: {name} ({prompt_type})")
        return None
    except Exception as e:
        logger.error(f"Error fetching prompt from database: {e}")
        return None

def get_material_system_prompt(material_type: str) -> str:
    """
    Get the system prompt for a specific material type
    
    Args:
        material_type: Type of material
        
    Returns:
        System prompt for the specified material type
    """
    material_type = material_type.lower()
    
    # Try to get material-specific prompt from database
    prompt_name = f"{material_type.upper()}_PROMPT"
    db_prompt = fetch_prompt_from_db(prompt_name, 'material_specific')
    
    if db_prompt:
        return db_prompt
    
    # If not found, try to get base prompt from database
    base_prompt = fetch_prompt_from_db('BASE_SYSTEM_PROMPT', 'material_specific')
    
    if base_prompt:
        # Try to find a category match
        if material_type in TEXTURE_FOCUSED_MATERIALS:
            return base_prompt.format(material_type="texture-focused")
        elif material_type in COLOR_FOCUSED_MATERIALS:
            return base_prompt.format(material_type="color-focused")
        elif material_type in STRUCTURE_FOCUSED_MATERIALS:
            return base_prompt.format(material_type="structure-focused")
        elif material_type in SOFT_MATERIALS:
            return base_prompt.format(material_type="soft")
        else:
            return base_prompt.format(material_type="construction")
    
    # Fallback to hardcoded prompt if database is unavailable
    logger.warning("Using fallback prompt template")
    if material_type in TEXTURE_FOCUSED_MATERIALS:
        return FALLBACK_BASE_SYSTEM_PROMPT.format(material_type="texture-focused")
    elif material_type in COLOR_FOCUSED_MATERIALS:
        return FALLBACK_BASE_SYSTEM_PROMPT.format(material_type="color-focused")
    elif material_type in STRUCTURE_FOCUSED_MATERIALS:
        return FALLBACK_BASE_SYSTEM_PROMPT.format(material_type="structure-focused")
    elif material_type in SOFT_MATERIALS:
        return FALLBACK_BASE_SYSTEM_PROMPT.format(material_type="soft")
    else:
        return FALLBACK_BASE_SYSTEM_PROMPT.format(material_type="construction")

def get_material_detail_instructions(material_type: str, detail_level: str) -> str:
    """
    Get detail level instructions for a specific material type
    
    Args:
        material_type: Type of material
        detail_level: Level of detail (brief, medium, detailed)
        
    Returns:
        Detail instructions for the specified material type and detail level
    """
    # Default to medium if not specified
    if detail_level not in ["brief", "medium", "detailed"]:
        detail_level = "medium"
    
    # Try to get from database
    prompt_name = f"{material_type.upper()}_DETAIL_{detail_level.upper()}"
    db_prompt = fetch_prompt_from_db(prompt_name, 'material_specific')
    
    if db_prompt:
        return db_prompt
    
    # Fallback to hardcoded values
    if detail_level == "brief":
        return "Provide concise explanations focusing only on the most relevant aspects."
    elif detail_level == "detailed":
        return "Provide comprehensive explanations covering multiple aspects of each material."
    else:  # medium
        return "Provide balanced explanations with moderate detail on important aspects."

def build_material_specific_prompt(
    material_type: str,
    query: str,
    context_text: str,
    detail_level: str = "medium",
    prompt_type: str = "explanation"
) -> Dict[str, str]:
    """
    Build a material-specific prompt for the given material type
    
    Args:
        material_type: Type of material
        query: User query
        context_text: Context text with retrieved materials and knowledge
        detail_level: Level of detail (brief, medium, detailed)
        prompt_type: Type of prompt (explanation, similarity, application)
        
    Returns:
        Dictionary with system and user prompts
    """
    # Get material-specific system prompt
    system_prompt = get_material_system_prompt(material_type)
    
    # Get detail level instructions
    detail_instructions = get_material_detail_instructions(material_type, detail_level)
    
    # Try to get prompt template from database
    template_name = f"{prompt_type.upper()}_TEMPLATE"
    template = fetch_prompt_from_db(template_name, 'material_specific')
    
    if template:
        # Replace variables in the template
        system_prompt_template = template.split("---USER_PROMPT---")[0]
        user_prompt_template = template.split("---USER_PROMPT---")[1]
        
        complete_system_prompt = system_prompt_template.format(
            system_prompt=system_prompt,
            detail_instructions=detail_instructions
        )
        
        user_prompt = user_prompt_template.format(
            query=query,
            context_text=context_text
        )
    else:
        # Fallback to hardcoded templates
        if prompt_type == "similarity":
            complete_system_prompt = f"""
{system_prompt}

{detail_instructions}

Compare the materials based on:
1. Shared properties and characteristics
2. Key differences that affect performance
3. Relative advantages and disadvantages for the specific use case

When citing facts, use the format [Source: Name] for proper attribution.
Only use information provided in the context. If information is missing, acknowledge the limitation.
"""
            user_prompt = f"""
Based on the provided information, compare and contrast the materials for: {query}
Highlight the key similarities and differences that would affect their performance.

{context_text}
"""
        elif prompt_type == "application":
            complete_system_prompt = f"""
{system_prompt}

{detail_instructions}

For each material, recommend specific applications based on:
1. The material's key properties and performance characteristics
2. Industry standards and best practices
3. Installation and maintenance considerations

When citing facts, use the format [Source: Name] for proper attribution.
Only use information provided in the context. If information is missing, acknowledge the limitation.
"""
            user_prompt = f"""
Based on the provided information, recommend specific applications for each material, considering: {query}

{context_text}
"""
        else:  # Default to explanation prompt
            complete_system_prompt = f"""
{system_prompt}

{detail_instructions}

For each material:
1. Explain its key properties and characteristics relevant to the query
2. Describe what makes it suitable or unsuitable for the use case
3. Highlight any important considerations for working with this material

When citing facts, use the format [Source: Name] for proper attribution.
Only use information provided in the context. If information is missing, acknowledge the limitation.
"""
            user_prompt = f"""
Based on the provided information, explain each material's suitability for: {query}

{context_text}
"""
    
    # Return formatted prompt
    return {
        "system": complete_system_prompt,
        "user": user_prompt
    }

# Clear the prompt cache
def clear_prompt_cache():
    """Clear the prompt cache"""
    prompt_cache.clear()
    logger.info("Prompt cache cleared")
