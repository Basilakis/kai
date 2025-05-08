# Prompt Library

The Prompt Library is a feature that allows users to save, organize, share, and discover AI prompts. Users can create their own prompts, categorize them, and optionally make them public for others to use.

## Features

### Core Functionality

- **Save Prompts**: Users can save prompts they create while using the AI agents
- **Organize Prompts**: Categorize prompts by usage type and custom categories
- **Public/Private Settings**: Control visibility of prompts to other users
- **Import Functionality**: Copy public prompts to your personal library
- **Dedicated Pages**: Access prompts at `/prompt-library` and individual prompts at `/prompt-library/[id]`

### Enhanced Features

- **Advanced Filtering**: Filter prompts by multiple criteria including:
  - Text search
  - Categories
  - Usage types
  - Tags
  - Minimum rating
  - Date ranges
  
- **Sorting Options**:
  - Newest first
  - Oldest first
  - Most viewed
  - Most imported
  - Most forked
  - Highest rated

- **Rating System**:
  - Rate prompts on a 5-star scale
  - Add optional comments to ratings
  - View average ratings and rating counts
  - Update your ratings

- **Fork/Clone System**:
  - Fork public prompts to create your own version
  - Track relationships between original prompts and forks
  - View fork history and statistics
  - Navigate between original prompts and their forks

- **Tagging System**:
  - Add multiple tags to prompts for better organization
  - Filter prompts by tags
  - Discover related prompts through common tags

## Database Schema

The Prompt Library uses the following database tables:

- `prompt_categories`: Stores categories for organizing prompts
- `user_prompts`: Stores user-created prompts
- `prompt_ratings`: Stores user ratings for prompts

### Views and Functions

- `prompt_stats`: A view that provides aggregated statistics for prompts
- `increment_prompt_view_count`: Function to increment the view count
- `increment_prompt_fork_count`: Function to increment the fork count
- `get_prompt_rating`: Function to get rating statistics for a prompt

## Components

### Main Components

- `PromptCard`: Displays a prompt in a card format
- `PromptForm`: Form for creating and editing prompts
- `PromptRating`: Component for rating prompts
- `TagsInput`: Component for adding and managing tags
- `StarRating`: Visual component for displaying ratings

### Pages

- `/prompt-library`: Main page with tabs for personal and public prompts
- `/prompt-library/[id]`: Public prompt detail page
- `/prompt-library/my-prompts/[id]`: Personal prompt detail page

## Usage

### Saving Prompts

When using an AI agent, a "Save Prompt" button appears in the chat interface. Clicking this button opens a modal where you can:

1. Enter a title for the prompt
2. Add an optional description
3. Select a category
4. Add tags
5. Choose whether to make it public or private

### Managing Prompts

From the Prompt Library page, you can:

1. View all your saved prompts
2. Edit or delete your prompts
3. Change visibility settings
4. View usage statistics

### Discovering Prompts

The "Public Prompts" tab allows you to:

1. Browse prompts shared by other users
2. Filter by various criteria
3. Sort by different metrics
4. Import or fork prompts you find useful

### Rating Prompts

On any public prompt detail page, you can:

1. Rate the prompt on a 5-star scale
2. Add an optional comment
3. Update your rating if you change your mind

### Forking Prompts

When viewing a public prompt, you can:

1. Import it (creates a copy without tracking the relationship)
2. Fork it (creates a copy that tracks the relationship to the original)

## Integration Points

- **User Profile**: The Prompt Library is accessible from the user profile page
- **Agent Interface**: Save button in the agent chat interface
- **Authentication**: Integrated with the existing authentication system
- **Database**: Uses Supabase for storage and RLS policies for security

## Security

- Row Level Security (RLS) policies ensure users can only access their own prompts or public prompts
- Rating system is protected to prevent multiple ratings from the same user
- Fork tracking maintains proper attribution of original content

## Future Enhancements

Potential future enhancements could include:

- Collaborative prompt editing
- Version history for prompts
- AI-powered prompt recommendations
- Advanced analytics on prompt performance
- Community features like comments and collections
