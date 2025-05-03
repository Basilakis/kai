/**
 * Tests for Property Template Manager Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';
import PropertyTemplateManager from '../PropertyTemplateManager';
import apiClient from '../../../services/apiClient';
import { AuthProvider } from '../../../hooks/useAuth';

// Mock dependencies
jest.mock('../../../services/apiClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
}));

jest.mock('../../../hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user-id' }
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    <AuthProvider>
      <SnackbarProvider>
        {children}
      </SnackbarProvider>
    </AuthProvider>
  </MemoryRouter>
);

describe('PropertyTemplateManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock API responses
    (apiClient.get as jest.Mock).mockImplementation((url) => {
      if (url === '/api/property-templates') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'template-1',
                name: 'Tile Template',
                materialType: 'tile',
                isActive: true,
                priority: 10,
                properties: {
                  finish: 'matte',
                  waterAbsorption: 0.5
                },
                overrideRules: [],
                createdBy: 'test-user-id',
                createdAt: new Date(),
                updatedAt: new Date()
              },
              {
                id: 'template-2',
                name: 'Stone Template',
                materialType: 'stone',
                isActive: true,
                priority: 20,
                properties: {
                  finish: 'polished',
                  density: 2.7
                },
                overrideRules: [],
                createdBy: 'test-user-id',
                createdAt: new Date(),
                updatedAt: new Date()
              }
            ]
          }
        });
      } else if (url === '/api/categories') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'category-1',
                name: 'Floor Tiles',
                description: 'Tiles for floors',
                parentId: null,
                path: ['category-1'],
                level: 0
              },
              {
                id: 'category-2',
                name: 'Wall Tiles',
                description: 'Tiles for walls',
                parentId: null,
                path: ['category-2'],
                level: 0
              }
            ]
          }
        });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  it('should render the component and fetch templates', async () => {
    // Render the component
    render(
      <TestWrapper>
        <PropertyTemplateManager />
      </TestWrapper>
    );

    // Check loading state
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Tile Template')).toBeInTheDocument();
      expect(screen.getByText('Stone Template')).toBeInTheDocument();
    });

    // Check API calls
    expect(apiClient.get).toHaveBeenCalledWith('/api/property-templates');
    expect(apiClient.get).toHaveBeenCalledWith('/api/categories');
  });

  it('should open the create template form', async () => {
    // Render the component
    render(
      <TestWrapper>
        <PropertyTemplateManager />
      </TestWrapper>
    );

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Tile Template')).toBeInTheDocument();
    });

    // Click the create template button
    fireEvent.click(screen.getByText('Create Template'));

    // Check if form is open
    expect(screen.getByText('Create Property Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Material Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
  });

  it('should create a new template', async () => {
    // Mock API response for creating a template
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'template-3',
          name: 'New Template',
          materialType: 'porcelain',
          isActive: true,
          priority: 30,
          properties: {
            finish: 'textured'
          },
          overrideRules: [],
          createdBy: 'test-user-id',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    });

    // Render the component
    render(
      <TestWrapper>
        <PropertyTemplateManager />
      </TestWrapper>
    );

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Tile Template')).toBeInTheDocument();
    });

    // Click the create template button
    fireEvent.click(screen.getByText('Create Template'));

    // Fill the form
    fireEvent.change(screen.getByLabelText('Template Name'), {
      target: { value: 'New Template' }
    });
    
    // Select material type
    fireEvent.mouseDown(screen.getByLabelText('Material Type'));
    fireEvent.click(screen.getByText('Porcelain'));
    
    // Set priority
    fireEvent.change(screen.getByLabelText('Priority'), {
      target: { value: '30' }
    });
    
    // Add a property
    fireEvent.click(screen.getByText('Properties'));
    fireEvent.change(screen.getByLabelText('Property Key'), {
      target: { value: 'finish' }
    });
    fireEvent.change(screen.getByLabelText('Property Value'), {
      target: { value: 'textured' }
    });
    fireEvent.click(screen.getByText('Add'));
    
    // Submit the form
    fireEvent.click(screen.getByText('Create'));
    
    // Check API call
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/property-templates', {
        name: 'New Template',
        materialType: 'porcelain',
        priority: 30,
        isActive: true,
        properties: {
          finish: 'textured'
        },
        overrideRules: []
      });
    });
    
    // Check if templates are refreshed
    expect(apiClient.get).toHaveBeenCalledWith('/api/property-templates');
  });

  it('should edit an existing template', async () => {
    // Mock API response for updating a template
    (apiClient.put as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'template-1',
          name: 'Updated Tile Template',
          materialType: 'tile',
          isActive: true,
          priority: 15,
          properties: {
            finish: 'polished'
          },
          overrideRules: [],
          createdBy: 'test-user-id',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    });

    // Render the component
    render(
      <TestWrapper>
        <PropertyTemplateManager />
      </TestWrapper>
    );

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Tile Template')).toBeInTheDocument();
    });

    // Click the edit button
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);

    // Check if form is open with existing data
    expect(screen.getByText('Edit Property Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Name')).toHaveValue('Tile Template');
    
    // Update the form
    fireEvent.change(screen.getByLabelText('Template Name'), {
      target: { value: 'Updated Tile Template' }
    });
    
    fireEvent.change(screen.getByLabelText('Priority'), {
      target: { value: '15' }
    });
    
    // Update properties
    fireEvent.click(screen.getByText('Properties'));
    
    // Submit the form
    fireEvent.click(screen.getByText('Update'));
    
    // Check API call
    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith('/api/property-templates/template-1', expect.any(Object));
    });
    
    // Check if templates are refreshed
    expect(apiClient.get).toHaveBeenCalledWith('/api/property-templates');
  });

  it('should delete a template', async () => {
    // Mock API response for deleting a template
    (apiClient.delete as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'template-1',
          name: 'Tile Template',
          materialType: 'tile',
          isActive: true,
          priority: 10,
          properties: {
            finish: 'matte',
            waterAbsorption: 0.5
          },
          overrideRules: [],
          createdBy: 'test-user-id',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    });

    // Render the component
    render(
      <TestWrapper>
        <PropertyTemplateManager />
      </TestWrapper>
    );

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Tile Template')).toBeInTheDocument();
    });

    // Click the delete button
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    // Check if confirmation dialog is open
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    
    // Confirm deletion
    fireEvent.click(screen.getByText('Delete'));
    
    // Check API call
    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/api/property-templates/template-1');
    });
    
    // Check if templates are refreshed
    expect(apiClient.get).toHaveBeenCalledWith('/api/property-templates');
  });
});
