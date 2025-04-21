#!/usr/bin/env python3
"""
Material-Specific Prompt Templates

This module provides specialized prompt templates optimized for different material types.
These templates enhance the RAG system by providing domain-specific knowledge and
terminology for each material category, resulting in more accurate and relevant responses.

Key features:
1. Material-specific system prompts with domain expertise
2. Specialized instruction sets for different material types
3. Material-specific evaluation criteria
4. Custom citation formats for different material domains
"""

import logging
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

# Base system prompt template that will be specialized for each material type
BASE_SYSTEM_PROMPT = """
You are a materials expert assistant specializing in {material_type} materials.
Use only the provided context to answer questions about materials.
When information is not in the context, acknowledge the limitations.
Always cite sources for specific facts.
"""

# Material-specific system prompts
MATERIAL_SYSTEM_PROMPTS = {
    # Texture-focused materials
    "wood": """
You are a wood materials expert with extensive knowledge of hardwoods, softwoods, and engineered wood products.
Use only the provided context to answer questions about wood materials.
Focus on grain patterns, species characteristics, hardness ratings, and finishing options.
Highlight sustainability aspects like FSC certification when relevant.
When discussing engineered wood, distinguish between plywood, MDF, particleboard, and veneers.
For flooring applications, emphasize durability metrics like Janka hardness ratings.
Always cite sources for specific facts using the format [Source: Name].
When information is not in the context, acknowledge the limitations.
""",

    # Structure-focused materials
    "tile": """
You are a tile materials expert with deep knowledge of ceramic, porcelain, and specialty tiles.
Use only the provided context to answer questions about tile materials.
Focus on technical specifications like PEI ratings, water absorption, and coefficient of friction.
Distinguish clearly between ceramic and porcelain properties when relevant.
For installation questions, emphasize substrate requirements and appropriate setting materials.
Discuss maintenance requirements based on finish type (glazed vs. unglazed, polished vs. matte).
Always cite sources for specific facts using the format [Source: Name].
When information is not in the context, acknowledge the limitations.
""",

    "stone": """
You are a natural stone expert with extensive knowledge of marble, granite, limestone, travertine, and other stone materials.
Use only the provided context to answer questions about stone materials.
Focus on geological composition, hardness, porosity, and appropriate sealing requirements.
Highlight the unique characteristics of each stone type, including veining patterns and color variations.
For countertop applications, discuss heat resistance, stain resistance, and etching potential.
Always cite sources for specific facts using the format [Source: Name].
When information is not in the context, acknowledge the limitations.
""",

    "metal": """
You are a metal materials expert with deep knowledge of architectural metals and finishes.
Use only the provided context to answer questions about metal materials.
Focus on corrosion resistance, gauge specifications, and appropriate applications.
Distinguish between different metal types (stainless steel, aluminum, copper, brass, bronze, etc.).
For exterior applications, emphasize weathering characteristics and maintenance requirements.
Always cite sources for specific facts using the format [Source: Name].
When information is not in the context, acknowledge the limitations.
""",

    # Color-focused materials
    "vinyl": """
You are a vinyl flooring expert with extensive knowledge of luxury vinyl tile (LVT), luxury vinyl plank (LVP), and sheet vinyl.
Use only the provided context to answer questions about vinyl materials.
Focus on wear layer thickness, overall thickness, installation methods, and waterproof properties.
Highlight performance metrics like indentation resistance and dimensional stability.
For commercial applications, emphasize commercial warranty periods and traffic ratings.
Always cite sources for specific facts using the format [Source: Name].
When information is not in the context, acknowledge the limitations.
""",

    "laminate": """
You are a laminate materials expert with deep knowledge of laminate flooring and countertop applications.
Use only the provided context to answer questions about laminate materials.
Focus on AC ratings, core board composition, and moisture resistance.
Distinguish between high-pressure laminates (HPL) and direct-pressure laminates (DPL).
For flooring applications, emphasize wear resistance and installation methods.
Always cite sources for specific facts using the format [Source: Name].
When information is not in the context, acknowledge the limitations.
""",

    # Soft materials
    "carpet": """
You are a carpet materials expert with extensive knowledge of residential and commercial carpet products.
Use only the provided context to answer questions about carpet materials.
Focus on fiber types, pile height, face weight, and density metrics.
Highlight performance ratings like texture retention and stain resistance.
For commercial applications, emphasize flammability ratings and static control properties.
Always cite sources for specific facts using the format [Source: Name].
When information is not in the context, acknowledge the limitations.
""",

    # Default for other materials
    "other": BASE_SYSTEM_PROMPT.format(material_type="construction")
}

# Material-specific detail level instructions
MATERIAL_DETAIL_INSTRUCTIONS = {
    "wood": {
        "brief": "Provide concise explanations focusing on wood species, hardness, and basic applications.",
        "medium": "Provide balanced explanations covering species, grain patterns, hardness, and common applications.",
        "detailed": "Provide comprehensive explanations covering species, grain patterns, hardness, finishing options, sustainability, and detailed application recommendations."
    },
    "tile": {
        "brief": "Provide concise explanations focusing on material composition, durability, and basic applications.",
        "medium": "Provide balanced explanations covering composition, technical ratings, durability, and common applications.",
        "detailed": "Provide comprehensive explanations covering composition, PEI ratings, water absorption, coefficient of friction, installation requirements, and detailed application recommendations."
    },
    "stone": {
        "brief": "Provide concise explanations focusing on stone type, hardness, and basic applications.",
        "medium": "Provide balanced explanations covering stone type, hardness, porosity, and common applications.",
        "detailed": "Provide comprehensive explanations covering geological composition, hardness, porosity, sealing requirements, maintenance needs, and detailed application recommendations."
    },
    # Default for other materials
    "other": {
        "brief": "Provide concise explanations focusing only on the most relevant aspects.",
        "medium": "Provide balanced explanations with moderate detail on important aspects.",
        "detailed": "Provide comprehensive explanations covering multiple aspects of each material."
    }
}

# Material-specific evaluation criteria
MATERIAL_EVALUATION_CRITERIA = {
    "wood": [
        "Species identification accuracy",
        "Hardness rating accuracy",
        "Grain pattern description",
        "Finishing recommendations appropriateness",
        "Sustainability information accuracy"
    ],
    "tile": [
        "Material classification accuracy",
        "Technical specification accuracy",
        "Installation recommendation appropriateness",
        "Maintenance guidance accuracy",
        "Application suitability assessment"
    ],
    "stone": [
        "Stone type identification accuracy",
        "Geological composition accuracy",
        "Maintenance requirement accuracy",
        "Application suitability assessment",
        "Sealing recommendation appropriateness"
    ],
    # Default for other materials
    "other": [
        "Material property accuracy",
        "Application recommendation appropriateness",
        "Technical specification accuracy",
        "Comparative analysis quality",
        "Citation and source attribution"
    ]
}

def get_material_system_prompt(material_type: str) -> str:
    """
    Get the system prompt for a specific material type

    Args:
        material_type: Type of material

    Returns:
        System prompt for the specified material type
    """
    material_type = material_type.lower()

    # Return specific prompt if available
    if material_type in MATERIAL_SYSTEM_PROMPTS:
        return MATERIAL_SYSTEM_PROMPTS[material_type]

    # Try to find a category match
    if material_type in TEXTURE_FOCUSED_MATERIALS:
        return BASE_SYSTEM_PROMPT.format(material_type="texture-focused")
    elif material_type in COLOR_FOCUSED_MATERIALS:
        return BASE_SYSTEM_PROMPT.format(material_type="color-focused")
    elif material_type in STRUCTURE_FOCUSED_MATERIALS:
        return BASE_SYSTEM_PROMPT.format(material_type="structure-focused")
    elif material_type in SOFT_MATERIALS:
        return BASE_SYSTEM_PROMPT.format(material_type="soft")

    # Default fallback
    return MATERIAL_SYSTEM_PROMPTS["other"]

def get_material_detail_instructions(material_type: str, detail_level: str) -> str:
    """
    Get detail level instructions for a specific material type

    Args:
        material_type: Type of material
        detail_level: Level of detail (brief, medium, detailed)

    Returns:
        Detail instructions for the specified material type and detail level
    """
    material_type = material_type.lower()

    # Default to medium if not specified
    if detail_level not in ["brief", "medium", "detailed"]:
        detail_level = "medium"

    # Return specific instructions if available
    if material_type in MATERIAL_DETAIL_INSTRUCTIONS:
        return MATERIAL_DETAIL_INSTRUCTIONS[material_type][detail_level]

    # Default fallback
    return MATERIAL_DETAIL_INSTRUCTIONS["other"][detail_level]

def get_material_evaluation_criteria(material_type: str) -> List[str]:
    """
    Get evaluation criteria for a specific material type

    Args:
        material_type: Type of material

    Returns:
        List of evaluation criteria for the specified material type
    """
    material_type = material_type.lower()

    # Return specific criteria if available
    if material_type in MATERIAL_EVALUATION_CRITERIA:
        return MATERIAL_EVALUATION_CRITERIA[material_type]

    # Default fallback
    return MATERIAL_EVALUATION_CRITERIA["other"]

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

    # Build the complete system prompt based on prompt type
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

        # Build user prompt for similarity
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

        # Build user prompt for application
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

        # Build user prompt for explanation
        user_prompt = f"""
Based on the provided information, explain each material's suitability for: {query}

{context_text}
"""

    # Return formatted prompt
    return {
        "system": complete_system_prompt,
        "user": user_prompt
    }

# Example usage
if __name__ == "__main__":
    # Test the material-specific prompt builder
    sample_context = """
Material 1: Red Oak Hardwood (wood)
Description: Natural hardwood flooring with medium grain pattern
Properties:
- Janka Hardness: 1290
- Color: Reddish brown
- Grain: Prominent, straight grain

Material 2: White Oak Hardwood (wood)
Description: Durable hardwood with distinctive grain pattern
Properties:
- Janka Hardness: 1360
- Color: Light brown to tan
- Grain: Tight, straight grain with longer rays than Red Oak

Relevant Facts:
1. [Red Oak] Red Oak has a Janka hardness rating of 1290, making it suitable for most residential applications. (Source: Wood Database)
2. [White Oak] White Oak is more resistant to moisture than Red Oak, making it suitable for bathrooms and kitchens. (Source: Flooring Association)
"""

    # Test for wood materials
    wood_prompt = build_material_specific_prompt(
        material_type="wood",
        query="What's the best option for kitchen flooring?",
        context_text=sample_context,
        detail_level="detailed"
    )

    print("=== Wood Material Prompt ===")
    print(wood_prompt["system"])
    print("\n=== User Prompt ===")
    print(wood_prompt["user"])

    # Test for tile materials
    tile_prompt = build_material_specific_prompt(
        material_type="tile",
        query="What's the best option for bathroom flooring?",
        context_text=sample_context,
        detail_level="medium"
    )

    print("\n\n=== Tile Material Prompt ===")
    print(tile_prompt["system"])
    print("\n=== User Prompt ===")
    print(tile_prompt["user"])
