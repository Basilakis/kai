# Prompt Management System

The KAI platform includes a comprehensive prompt management system that allows administrators to view, edit, and manage AI prompts used throughout the application. This document explains how to use the prompt management system and how it integrates with different parts of the application.

## Overview

The prompt management system provides a centralized way to manage all AI prompts used in the KAI platform, including:

- Material-specific prompts
- Agent system prompts
- RAG (Retrieval-Augmented Generation) prompts
- Generative enhancer prompts
- Hybrid retriever prompts

By centralizing prompt management, the system allows for:

1. **Consistent prompt updates**: Change prompts across the system without modifying code
2. **A/B testing**: Test different prompt variations to optimize performance
3. **Role-based access control**: Only administrators can modify prompts
4. **Version tracking**: Keep track of prompt changes over time
5. **Dynamic prompt loading**: Load prompts from the database at runtime

## Accessing the Prompt Management System

The prompt management system is available in the admin panel:

1. Log in to the admin panel
2. Navigate to "System Prompts" in the sidebar
3. The prompt management interface will be displayed

## Prompt Management Interface

The prompt management interface includes the following features:

### Viewing Prompts

The main view displays a table of all prompts in the system, with columns for:

- Name
- Type
- Description
- Location (file where the prompt is used)
- Status (Active/Inactive)
- Actions (Edit, Duplicate, Delete, Version History, Success Rate)

You can filter prompts by type using the tabs at the top of the page:

- All Prompts
- Material Specific
- Agent
- RAG

You can also search for prompts using the search box in the top-right corner.

### Creating Prompts

To create a new prompt:

1. Click the "Create Prompt" button
2. Fill in the prompt details:
   - Name: A unique identifier for the prompt
   - Description: A brief description of the prompt's purpose
   - Prompt Type: The category of prompt (Material Specific, Agent, RAG, etc.)
   - Location: The file path where the prompt is used
   - Variables: Comma-separated list of variables used in the prompt (e.g., {material_type}, {query})
   - Status: Active or Inactive
   - Content: The actual prompt text
3. Click "Create" to save the prompt

### Editing Prompts

To edit an existing prompt:

1. Click the Edit icon (pencil) next to the prompt in the table
2. Modify the prompt details as needed
3. Click "Save" to update the prompt

### Duplicating Prompts

To duplicate a prompt (useful for creating variations):

1. Click the Duplicate icon (copy) next to the prompt in the table
2. The system will create a copy with "(Copy)" appended to the name
3. Edit the duplicate as needed
4. Click "Create" to save the new prompt

### Deleting Prompts

To delete a prompt:

1. Click the Delete icon (trash) next to the prompt in the table
2. Confirm the deletion when prompted

**Note**: Deleting a prompt will cause the system to fall back to hardcoded defaults if available.

### Managing Prompt Versions

The system automatically creates a new version of a prompt whenever its content is changed. This allows you to track changes over time and revert to previous versions if needed.

To view version history:

1. Click the History icon (clock) next to the prompt in the table
2. The system will display a list of all versions of the prompt
3. Each version shows:
   - Version number
   - Creation date
   - Status (Active/Inactive)
   - Success rate
   - Revert button

To revert to a previous version:

1. Click the Revert button next to the version you want to revert to
2. Confirm the reversion when prompted
3. The system will create a new version with the content of the selected version

### Tracking Prompt Success Rates

The system tracks the success rate of prompts based on user feedback. This helps you identify which prompts are performing well and which need improvement.

To view success rate:

1. Click the Assessment icon (chart) next to the prompt in the table
2. The system will display the overall success rate for the prompt
3. You can also see success rates for individual versions in the version history

Success rates are calculated as the percentage of successful uses of the prompt out of the total number of uses.

## Prompt Types

The system supports several types of prompts:

### Material Specific Prompts

These prompts are used for material-specific responses in the RAG system. They include:

- Base system prompts for different material types (wood, tile, stone, etc.)
- Detail level instructions (brief, medium, detailed)
- Evaluation criteria for different material types

### Agent Prompts

These prompts are used by the agent system for different agent types:

- Default system messages for agents
- Agent-specific prompts for different agent roles
- Function calling prompts

### RAG Prompts

These prompts are used by the RAG (Retrieval-Augmented Generation) system:

- Explanation prompts for generating material explanations
- Similarity prompts for comparing materials
- Application prompts for recommending material applications

### Other Prompt Types

- Generative Enhancer: Used by the generative enhancer component
- Hybrid Retriever: Used by the hybrid retriever component
- Other: Miscellaneous prompts used elsewhere in the system

## Variables in Prompts

Prompts can include variables that are replaced at runtime. Variables are enclosed in curly braces, e.g., `{material_type}`.

Common variables include:

- `{material_type}`: The type of material (wood, tile, stone, etc.)
- `{query}`: The user's query
- `{context_text}`: The context text with retrieved materials and knowledge
- `{detail_instructions}`: Instructions for the detail level

When editing prompts, you can specify the variables used in the prompt in the "Variables" field.

## Integration with the Application

The prompt management system integrates with different parts of the application:

### Material-Specific Prompts

The `material_specific_prompts_db.py` file in the ML package fetches prompts from the database:

```python
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

    # If not found, fall back to default prompt
    # ...
```

### Agent System Prompts

The `llmInferenceHelperWithPrompts.ts` file in the Agents package fetches prompts from the database:

```typescript
/**
 * Get the system prompt for agents
 * @returns The system prompt
 */
export async function getSystemPrompt(): Promise<string> {
  try {
    const prompt = await fetchPromptFromService('DEFAULT_SYSTEM_MESSAGE', PromptType.AGENT);
    return prompt || FALLBACK_SYSTEM_MESSAGE;
  } catch (error) {
    logger.error(`Error getting system prompt: ${error}`);
    return FALLBACK_SYSTEM_MESSAGE;
  }
}
```

### Versioning Integration

The system automatically creates a new version whenever a prompt's content is changed:

```typescript
// If content has changed and createVersion is true, create a new version
if (contentChanged && createVersion) {
  // Get the current version number
  const { data: versionData, error: versionError } = await client
    .from('system_prompt_versions')
    .select('version_number')
    .eq('prompt_id', id)
    .order('version_number', { ascending: false })
    .limit(1);

  // Calculate the next version number
  const nextVersionNumber = versionData && versionData.length > 0
    ? versionData[0].version_number + 1
    : 1;

  // Create a new version with the current content
  const { error: createVersionError } = await client
    .from('system_prompt_versions')
    .insert([{
      prompt_id: id,
      version_number: nextVersionNumber,
      content: prompt.content,
      variables: prompt.variables || currentPrompt.variables,
      is_active: true,
      created_by: prompt.createdBy
    }]);
}
```

### Success Tracking Integration

The system tracks success rates for prompts through the `renderPrompt` and `updatePromptTrackingRecord` methods:

```typescript
// If tracking ID is provided, create a tracking record
if (options.trackingId && promptId) {
  // Create a tracking record with pending status
  await this.createPromptTrackingRecord({
    id: options.trackingId,
    promptId,
    promptVersionId,
    isSuccessful: false, // Will be updated later
    context: options.data
  });
}

// Later, update the tracking record with success/failure
const success = await promptService.updatePromptTrackingRecord(
  trackingId,
  isSuccessful,
  feedback
);
```

## Best Practices

When working with the prompt management system, follow these best practices:

1. **Use descriptive names**: Choose clear, descriptive names for prompts
2. **Document variables**: List all variables used in the prompt in the Variables field
3. **Include file locations**: Specify the file where the prompt is used
4. **Test changes**: After modifying prompts, test the affected functionality
5. **Use prompt types**: Categorize prompts correctly by type
6. **Keep prompts focused**: Each prompt should have a single, clear purpose
7. **Consider fallbacks**: The system includes fallbacks for when prompts are not found
8. **Review version history**: Before making changes, review the version history to understand previous changes
9. **Add comments**: When creating a new version, add a comment explaining the changes
10. **Monitor success rates**: Regularly review success rates to identify prompts that need improvement
11. **A/B test prompts**: Create multiple versions of a prompt to test different approaches
12. **Collect feedback**: Encourage users to provide feedback on prompt effectiveness

## Troubleshooting

If you encounter issues with the prompt management system:

1. **Prompt not found**: Check that the prompt name and type match what the code is looking for
2. **Changes not taking effect**: Clear the prompt cache by restarting the affected service
3. **Permission errors**: Ensure you have admin privileges to manage prompts
4. **Version history not showing**: Check that the prompt ID is being passed correctly to the version history API
5. **Success rates not updating**: Ensure that tracking IDs are being generated and passed correctly
6. **Revert not working**: Check that the version you're trying to revert to exists and is not already active

## Conclusion

The prompt management system provides a powerful way to manage AI prompts across the KAI platform. By centralizing prompt management, it enables consistent updates, testing, and optimization of AI interactions throughout the system.

The versioning system allows you to track changes over time and revert to previous versions if needed, providing a safety net for prompt experimentation. The success tracking system helps you identify which prompts are performing well and which need improvement, enabling data-driven prompt optimization.

Together, these features create a comprehensive prompt management system that supports continuous improvement of AI interactions across the platform.
