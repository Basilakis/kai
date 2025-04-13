# MoodBoard Feature

This document provides detailed information about the MoodBoard feature in the Kai application, which allows users to collect, organize, and share materials in customizable boards.

## Overview

The MoodBoard feature enables users to:
- Create collections of materials they're interested in
- Organize materials into themed boards
- Toggle between grid and list views
- Set board visibility (public or private)
- Access boards through dedicated pages

## User Interface Components

### Material Selection Modal

When browsing materials, users can add them to a MoodBoard by clicking the "Add to Board" button. This opens a side modal with the following features:
- Material details display
- Dropdown to select an existing board
- Option to create a new board
- Success/error feedback

### MoodBoard Management

Users can manage their MoodBoards from their profile page:
- Create new boards with custom names and descriptions
- Set board visibility (public/private)
- View all existing boards in a grid layout
- Delete boards they no longer need

### Board View Page

Each MoodBoard has a dedicated page at `/board/:boardId` or `/:username/board/:boardId` with:
- Board header with name, description, and visibility status
- Toggle between grid and list views
- Material display in the selected view
- Options to remove materials (for board owners)

## Data Structure

The MoodBoard feature is built on two main data models:

### MoodBoard

```typescript
interface MoodBoard {
  id: string;
  name: string;
  description?: string;
  userId: string;
  isPublic: boolean;
  viewPreference: 'grid' | 'list';
  createdAt: string;
  updatedAt: string;
}
```

### MoodBoardItem

```typescript
interface MoodBoardItem {
  id: string;
  boardId: string;
  materialId: string;
  notes?: string;
  position: number;
  addedAt: string;
}
```

## Implementation Details

### Database Schema

The MoodBoard feature uses Supabase for data storage with the following tables:
- `moodboards` - Stores board metadata
- `moodboard_items` - Stores the materials added to boards

Row-level security policies ensure that:
- Users can only view their own boards or public boards
- Users can only modify their own boards
- Users can only add/remove items from their own boards

### API Endpoints

The following API endpoints are available for MoodBoard functionality:

#### Board Management
- `GET /api/boards` - Get all boards for the current user
- `GET /api/boards/:boardId` - Get a specific board
- `POST /api/boards` - Create a new board
- `PUT /api/boards/:boardId` - Update board details
- `DELETE /api/boards/:boardId` - Delete a board

#### Board Items Management
- `GET /api/boards/:boardId/items` - Get all items in a board
- `POST /api/boards/:boardId/items` - Add an item to a board
- `PUT /api/boards/:boardId/items/:itemId` - Update item details
- `DELETE /api/boards/:boardId/items/:itemId` - Remove an item from a board

### Client-Side Components

The feature is implemented using the following React components:
- `MaterialSideModal` - Side modal for adding materials to boards
- `MaterialCard` - Card component with "Add to Board" button
- Profile page with MoodBoards section
- `BoardPage` - Dedicated page for viewing a specific board

## Usage Examples

### Adding a Material to a Board

```typescript
// When a user clicks "Add to Board" on a material
const handleAddToBoard = async (material) => {
  // Open the side modal
  setSelectedMaterial(material);
  setIsSideModalOpen(true);
};

// Inside the modal, when adding to an existing board
const addToExistingBoard = async (boardId, materialId) => {
  await addMoodBoardItem({
    boardId,
    materialId
  });
};

// Creating a new board and adding the material
const createBoardAndAddMaterial = async (boardName, materialId) => {
  // Create new board
  const newBoard = await createMoodBoard({
    name: boardName,
    isPublic: false
  });
  
  // Add material to the new board
  await addMoodBoardItem({
    boardId: newBoard.id,
    materialId
  });
};
```

### Viewing a Board in Different Layouts

```typescript
// Toggle between grid and list views
const handleViewModeToggle = async (mode) => {
  setViewMode(mode);
  
  // Update user preference if they own the board
  if (isOwner) {
    await updateMoodBoard(boardId, {
      viewPreference: mode
    });
  }
};
```

## Related Documentation

- [Client HeroUI Integration](./client-heroui-integration.md) - UI component system used for MoodBoard
- [Supabase Setup Guide](./supabase-setup-guide.md) - Database setup for MoodBoard data
- [API Reference](./api-reference.md) - API endpoints for MoodBoard functionality
