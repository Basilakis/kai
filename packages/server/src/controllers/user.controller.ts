import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger'; // Import logger

// --- In-Memory Store Simulation ---
// NOTE: This is for demonstration ONLY. Data is not persistent.
// Replace with actual database service calls.
interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  query: any; // Assuming query can be an object or string
  createdAt: Date;
}
let savedSearchesStore: SavedSearch[] = [];
// Map<userId, Set<materialId>>
let userFavoritesStore: Map<string, Set<string>> = new Map();
// --- End In-Memory Store Simulation ---


// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req: Request, res: Response, _next: NextFunction): Promise<any> => {
  try {
    // In a real implementation, this would fetch from database
    // For demonstration, using a mock user from req.user (set by auth middleware)
    const user = req.user;

    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Simulate database fetch
    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name || 'User',
      avatar: user.avatar || 'default-avatar.jpg',
      preferences: {
        theme: 'light',
        notifications: true,
        dashboardLayout: 'grid'
      },
      role: user.role || 'user',
      lastLogin: new Date().toISOString(),
      createdAt: user.createdAt || new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      data: userProfile
    });
  } catch (error: unknown) {
    logger.error('Error fetching user profile:', error); // Use logger
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user profile',
      error: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req: Request, res: Response, _next: NextFunction): Promise<any> => {
  try {
    const user = req.user;

    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate required fields
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required fields'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // In a real implementation, this would update the database
    // For demonstration, we'll simulate a successful update
    const updatedProfile = {
      id: user.id,
      name,
      email,
      avatar: req.body.avatar || user.avatar || 'default-avatar.jpg',
      preferences: req.body.preferences || {
        theme: 'light',
        notifications: true,
        dashboardLayout: 'grid'
      },
      role: user.role || 'user', // Don't allow role change through this endpoint
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile
    });
  } catch (error: unknown) {
    logger.error('Error updating user profile:', error); // Use logger
    res.status(500).json({
      success: false,
      message: 'Server error while updating user profile',
      error: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
};

// @desc    Update password
// @route   PUT /api/users/password
// @access  Private
export const updatePassword = async (req: Request, res: Response, _next: NextFunction): Promise<any> => {
  try {
    const user = req.user;

    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate required fields
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and password confirmation are required'
      });
    }

    // Check if new password matches confirmation
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match'
      });
    }

    // Validate password strength (minimum 8 chars, at least 1 number, 1 uppercase, 1 lowercase)
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with at least 1 number, 1 uppercase, and 1 lowercase letter'
      });
    }

    // In a real implementation:
    // 1. Fetch the user's actual stored password hash from database
    // 2. Compare the provided currentPassword with the stored hash using bcrypt.compare
    // 3. If matches, hash the new password using bcrypt.hash with appropriate salt rounds
    // 4. Update the database with new password hash

    // For demonstration, we'll simulate verification of current password
    // and updating with new password
    const simulateVerifyCurrentPassword = () => {
      // In a real implementation, this would use bcrypt.compare
      // For demo, we'll just check if currentPassword is not empty
      return !!currentPassword;
    };

    // First verify current password
    const isCurrentPasswordValid = simulateVerifyCurrentPassword();
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Simulate saving the new password (in reality, we would save a hash)
    console.log(`Password updated for user ${user.id} - in production, this would save a bcrypt hash`);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error: unknown) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating password',
      error: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
};

// @desc    Get user preferences
// @route   GET /api/users/preferences
// @access  Private
export const getUserPreferences = async (req: Request, res: Response, _next: NextFunction): Promise<any> => {
  try {
    const user = req.user;

    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // In a real implementation, this would fetch from database
    // Simulate fetching user preferences
    const preferences = {
      theme: 'light',              // UI theme preference
      notifications: {
        email: true,               // Email notification preference
        push: true,                // Push notification preference
        activitySummary: 'daily'   // Frequency of activity summaries
      },
      displaySettings: {
        dashboardLayout: 'grid',   // Dashboard layout preference
        colorBlindMode: false,     // Accessibility setting
        fontSize: 'medium',        // Font size preference
        highContrast: false        // High contrast mode
      },
      contentPreferences: {
        defaultMaterialView: 'tiles',   // How materials are displayed
        materialCategories: [           // Preferred material categories
          'wood',
          'metal',
          'stone'
        ],
        savedFilters: [                 // User's saved search filters
          {
            id: 'recent-woods',
            name: 'Recent Woods',
            filter: { category: 'wood', sortBy: 'createdAt' }
          }
        ]
      },
      privacySettings: {
        shareUsageData: true,           // Analytics sharing preference
        showActivityFeed: true          // Show activity in public feeds
      },
      exportOptions: {                  // Export format preferences
        preferredFormat: 'glb',
        includeMetadata: true,
        compressionLevel: 'medium'
      },
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      data: preferences
    });
  } catch (error: unknown) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user preferences',
      error: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
};

// @desc    Update user preferences
// @route   PUT /api/users/preferences
// @access  Private
export const updateUserPreferences = async (req: Request, res: Response, _next: NextFunction): Promise<any> => {
  try {
    const user = req.user;

    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate preferences structure
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Valid preferences object is required'
      });
    }

    // Validate specific preferences if needed
    // Example: theme must be one of the allowed values
    if (preferences.theme && !['light', 'dark', 'system'].includes(preferences.theme)) {
      return res.status(400).json({
        success: false,
        message: 'Theme must be one of: light, dark, system'
      });
    }

    // In a real implementation, this would update the database
    // Simulate merging and updating user preferences

    // First, get current preferences (simulated)
    const currentPreferences = {
      theme: 'light',
      notifications: {
        email: true,
        push: true,
        activitySummary: 'daily'
      },
      displaySettings: {
        dashboardLayout: 'grid',
        colorBlindMode: false,
        fontSize: 'medium',
        highContrast: false
      },
      contentPreferences: {
        defaultMaterialView: 'tiles',
        materialCategories: ['wood', 'metal', 'stone'],
        savedFilters: []
      },
      privacySettings: {
        shareUsageData: true,
        showActivityFeed: true
      },
      exportOptions: {
        preferredFormat: 'glb',
        includeMetadata: true,
        compressionLevel: 'medium'
      }
    };

    // Merge preferences (this is a simplified deep merge)
    const updatedPreferences = {
      ...currentPreferences,
      ...preferences,
      // Handle nested objects properly
      notifications: {
        ...currentPreferences.notifications,
        ...(preferences.notifications || {})
      },
      displaySettings: {
        ...currentPreferences.displaySettings,
        ...(preferences.displaySettings || {})
      },
      contentPreferences: {
        ...currentPreferences.contentPreferences,
        ...(preferences.contentPreferences || {})
      },
      privacySettings: {
        ...currentPreferences.privacySettings,
        ...(preferences.privacySettings || {})
      },
      exportOptions: {
        ...currentPreferences.exportOptions,
        ...(preferences.exportOptions || {})
      },
      // Add updated timestamp
      updatedAt: new Date().toISOString()
    };

    // In a real implementation, save to database here
    console.log(`Updated preferences for user ${user.id}`);

    res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      data: updatedPreferences
    });
  } catch (error: unknown) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user preferences',
      error: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
};

// @desc    Get user saved searches
// @route   GET /api/users/saved-searches
// @access  Private
export const getSavedSearches = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  // In-memory simulation
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    console.log(`Simulating: Fetching saved searches for user ${user.id}`);
    const userSearches = savedSearchesStore.filter(s => s.userId === user.id);
    res.status(200).json({ success: true, data: userSearches });
  } catch (error) {
    next(error); // Pass error to error handling middleware
  }
};

// @desc    Create a saved search
// @route   POST /api/users/saved-searches
// @access  Private
export const createSavedSearch = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  // In-memory simulation
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    const { name, query } = req.body;
    if (!name || !query) {
      return res.status(400).json({ success: false, message: 'Search name and query are required' });
    }
    console.log(`Simulating: Creating saved search "${name}" for user ${user.id}`);
    const newSearch: SavedSearch = {
      id: `search_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      query,
      userId: user.id,
      createdAt: new Date()
    };
    savedSearchesStore.push(newSearch);
    res.status(201).json({ success: true, message: 'Saved search created (simulated)', data: newSearch });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a saved search
// @route   DELETE /api/users/saved-searches/:id
// @access  Private
export const deleteSavedSearch = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  // In-memory simulation
  try {
    const user = req.user;
    const searchId = req.params.id;
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    if (!searchId) {
      return res.status(400).json({ success: false, message: 'Search ID is required' });
    }
    console.log(`Simulating: Deleting saved search ${searchId} for user ${user.id}`);
    const initialLength = savedSearchesStore.length;
    savedSearchesStore = savedSearchesStore.filter(s => !(s.id === searchId && s.userId === user.id));

    if (savedSearchesStore.length === initialLength) {
       return res.status(404).json({ success: false, message: 'Saved search not found or not owned by user' });
    }

    res.status(200).json({ success: true, message: 'Saved search deleted (simulated)' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user favorite materials
// @route   GET /api/users/favorites
// @access  Private
export const getFavorites = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  // In-memory simulation
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    console.log(`Simulating: Fetching favorites for user ${user.id}`);
    const userFavs = userFavoritesStore.get(user.id) || new Set<string>();
    // In a real app, you might fetch material details based on these IDs
    res.status(200).json({ success: true, data: Array.from(userFavs) });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a material to favorites
// @route   POST /api/users/favorites/:materialId
// @access  Private
export const addFavorite = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  // In-memory simulation
  try {
    const user = req.user;
    const materialId = req.params.materialId;
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    if (!materialId) {
      return res.status(400).json({ success: false, message: 'Material ID is required' });
    }
    console.log(`Simulating: Adding material ${materialId} to favorites for user ${user.id}`);
    if (!userFavoritesStore.has(user.id)) {
      userFavoritesStore.set(user.id, new Set<string>());
    }
    userFavoritesStore.get(user.id)!.add(materialId);
    res.status(200).json({ success: true, message: 'Material added to favorites (simulated)' });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove a material from favorites
// @route   DELETE /api/users/favorites/:materialId
// @access  Private
export const removeFavorite = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  // In-memory simulation
  try {
    const user = req.user;
    const materialId = req.params.materialId;
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    if (!materialId) {
      return res.status(400).json({ success: false, message: 'Material ID is required' });
    }
    console.log(`Simulating: Removing material ${materialId} from favorites for user ${user.id}`);
    let removed = false;
    if (userFavoritesStore.has(user.id)) {
      removed = userFavoritesStore.get(user.id)!.delete(materialId);
    }

    if (!removed) {
       // Optionally return 404 if the favorite didn't exist, or just succeed silently
       console.log(`Simulating: Material ${materialId} was not in favorites for user ${user.id}`);
    }

    res.status(200).json({ success: true, message: 'Material removed from favorites (simulated)' });
  } catch (error) {
    next(error);
  }
};

// --- Admin User Management ---

// @desc    Get all users (admin only)
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response, _next: NextFunction): Promise<any> => {
  try {
    const user = req.user;

    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    // Extract query parameters for pagination and filtering
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100); // Max 100 per page
    const search = req.query.search as string;
    const role = req.query.role as string;
    const sortBy = req.query.sortBy as string || 'created_at';
    const sortOrder = req.query.sortOrder as string || 'desc';

    const offset = (page - 1) * limit;

    // In a real implementation, this would use Supabase to fetch users
    // For demonstration, we'll simulate a database query with pagination and filtering
    
    // Simulate user data structure that would come from Supabase
    const mockUsers = [
      {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        avatar: 'admin-avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_login: '2024-06-22T14:00:00Z',
        is_active: true
      },
      {
        id: '2',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
        avatar: 'user-avatar.jpg',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        last_login: '2024-06-21T10:30:00Z',
        is_active: true
      }
    ];

    // Apply filtering
    let filteredUsers = mockUsers;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(u =>
        u.name.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower)
      );
    }

    if (role) {
      filteredUsers = filteredUsers.filter(u => u.role === role);
    }

    // Apply sorting
    filteredUsers.sort((a, b) => {
      let aVal = a[sortBy as keyof typeof a];
      let bVal = b[sortBy as keyof typeof b];
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (sortOrder === 'desc') {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      } else {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
    });

    // Apply pagination
    const totalUsers = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice(offset, offset + limit);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalUsers / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: {
        users: paginatedUsers,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          limit,
          hasNextPage,
          hasPrevPage
        }
      }
    });

    // Real Supabase implementation would look like:
    /*
    const { data: users, error, count } = await supabase
      .from('users')
      .select('id, email, name, role, avatar, created_at, updated_at, last_login, is_active', { count: 'exact' })
      .ilike('name', search ? `%${search}%` : '%')
      .eq(role ? 'role' : 'role', role || 'user')
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }
    */

  } catch (error: unknown) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users',
      error: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
};

// @desc    Get user by ID (admin only)
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUserById = async (req: Request, res: Response, _next: NextFunction): Promise<any> => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    // Validate user ID parameter
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid user ID is required'
      });
    }

    // In a real implementation, this would use Supabase to fetch the user by ID
    // For demonstration, we'll simulate a database query
    
    // Simulate user data that would come from Supabase
    const mockUsers = [
      {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        avatar: 'admin-avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_login: '2024-06-22T14:00:00Z',
        is_active: true,
        profile: {
          bio: 'System administrator',
          location: 'New York, NY',
          website: 'https://example.com',
          phone: '+1-555-0123'
        },
        preferences: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
            activitySummary: 'weekly'
          },
          privacy: {
            showEmail: false,
            showProfile: true
          }
        }
      },
      {
        id: '2',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
        avatar: 'user-avatar.jpg',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        last_login: '2024-06-21T10:30:00Z',
        is_active: true,
        profile: {
          bio: 'Regular user of the platform',
          location: 'San Francisco, CA',
          website: null,
          phone: null
        },
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            push: true,
            activitySummary: 'daily'
          },
          privacy: {
            showEmail: true,
            showProfile: true
          }
        }
      }
    ];

    // Find user by ID
    const foundUser = mockUsers.find(u => u.id === id);

    if (!foundUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: foundUser
    });

    // Real Supabase implementation would look like:
    /*
    const { data: userData, error } = await supabase
      .from('users')
      .select(`
        id, email, name, role, avatar, created_at, updated_at, last_login, is_active,
        profiles (bio, location, website, phone),
        user_preferences (theme, notifications, privacy)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      throw error;
    }
    */

  } catch (error: unknown) {
    logger.error('Error fetching user by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user',
      error: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
};

// @desc    Update user (admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req: Request, res: Response, _next: NextFunction): Promise<any> => {
  try {
    const user = req.user;
    const { id } = req.params;
    const updateData = req.body;

    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    // Validate user ID parameter
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid user ID is required'
      });
    }

    // Validate update data
    if (!updateData || typeof updateData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Update data is required'
      });
    }

    // Define allowed fields for update
    const allowedFields = [
      'name', 'email', 'role', 'avatar', 'is_active',
      'profile', 'preferences'
    ];

    // Filter update data to only include allowed fields
    const filteredUpdateData: any = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdateData[key] = updateData[key];
      }
    });

    // Validate specific fields
    if (filteredUpdateData.email && typeof filteredUpdateData.email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email must be a valid string'
      });
    }

    if (filteredUpdateData.role && !['admin', 'user', 'moderator'].includes(filteredUpdateData.role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be one of: admin, user, moderator'
      });
    }

    if (filteredUpdateData.is_active !== undefined && typeof filteredUpdateData.is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_active must be a boolean value'
      });
    }

    // Prevent self-demotion from admin role
    if (user.id === id && filteredUpdateData.role && filteredUpdateData.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own admin role'
      });
    }

    // Prevent self-deactivation
    if (user.id === id && filteredUpdateData.is_active === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    // Check if there are any valid fields to update
    if (Object.keys(filteredUpdateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update'
      });
    }

    // Add updated timestamp
    filteredUpdateData.updated_at = new Date().toISOString();

    // In a real implementation, this would use Supabase to update the user
    // For demonstration, we'll simulate a database update
    
    // Simulate finding and updating the user
    const mockUsers = [
      {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        avatar: 'admin-avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_login: '2024-06-22T14:00:00Z',
        is_active: true,
        profile: {
          bio: 'System administrator',
          location: 'New York, NY',
          website: 'https://example.com',
          phone: '+1-555-0123'
        },
        preferences: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
            activitySummary: 'weekly'
          },
          privacy: {
            showEmail: false,
            showProfile: true
          }
        }
      },
      {
        id: '2',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
        avatar: 'user-avatar.jpg',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        last_login: '2024-06-21T10:30:00Z',
        is_active: true,
        profile: {
          bio: 'Regular user of the platform',
          location: 'San Francisco, CA',
          website: null,
          phone: null
        },
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            push: true,
            activitySummary: 'daily'
          },
          privacy: {
            showEmail: true,
            showProfile: true
          }
        }
      }
    ];

    // Find user by ID
    const existingUser = mockUsers.find(u => u.id === id);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Simulate updating the user
    const updatedUser = {
      ...existingUser,
      ...filteredUpdateData,
      // Merge nested objects properly
      profile: filteredUpdateData.profile ?
        { ...existingUser.profile, ...filteredUpdateData.profile } :
        existingUser.profile,
      preferences: filteredUpdateData.preferences ?
        { ...existingUser.preferences, ...filteredUpdateData.preferences } :
        existingUser.preferences
    };

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });

    // Real Supabase implementation would look like:
    /*
    // First check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      throw fetchError;
    }

    // Update user in main users table
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        name: filteredUpdateData.name,
        email: filteredUpdateData.email,
        role: filteredUpdateData.role,
        avatar: filteredUpdateData.avatar,
        is_active: filteredUpdateData.is_active,
        updated_at: filteredUpdateData.updated_at
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Update profile if provided
    if (filteredUpdateData.profile) {
      await supabase
        .from('profiles')
        .upsert({
          user_id: id,
          ...filteredUpdateData.profile,
          updated_at: filteredUpdateData.updated_at
        });
    }

    // Update preferences if provided
    if (filteredUpdateData.preferences) {
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: id,
          ...filteredUpdateData.preferences,
          updated_at: filteredUpdateData.updated_at
        });
    }
    */

  } catch (error: unknown) {
    logger.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user',
      error: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
};

// @desc    Delete user (admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response, _next: NextFunction): Promise<any> => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    // Validate user ID parameter
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid user ID is required'
      });
    }

    // Prevent self-deletion
    if (user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // In a real implementation, this would use Supabase to delete the user
    // For demonstration, we'll simulate a database deletion
    
    // Simulate finding the user first
    const mockUsers = [
      {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        is_active: true
      },
      {
        id: '2',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
        is_active: true
      },
      {
        id: '3',
        email: 'moderator@example.com',
        name: 'Moderator User',
        role: 'moderator',
        is_active: true
      }
    ];

    // Find user by ID
    const userToDelete = mockUsers.find(u => u.id === id);

    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Additional safety check: prevent deletion of other admin users
    // This is a common business rule to prevent accidental admin lockout
    if (userToDelete.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin users. Please change their role first.'
      });
    }

    // Simulate successful deletion
    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: {
        deletedUser: {
          id: userToDelete.id,
          email: userToDelete.email,
          name: userToDelete.name,
          role: userToDelete.role
        },
        deletedAt: new Date().toISOString()
      }
    });

    // Real Supabase implementation would look like:
    /*
    // First check if user exists and get their role
    const { data: userToDelete, error: fetchError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      throw fetchError;
    }

    // Additional safety check for admin users
    if (userToDelete.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin users. Please change their role first.'
      });
    }

    // Delete related data first (cascade delete or manual cleanup)
    // Delete user preferences
    await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', id);

    // Delete user profile
    await supabase
      .from('profiles')
      .delete()
      .eq('user_id', id);

    // Delete user sessions/tokens if stored in database
    await supabase
      .from('user_sessions')
      .delete()
      .eq('user_id', id);

    // Finally delete the main user record
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // Optionally, revoke the user's auth session in Supabase Auth
    // This would require admin privileges in Supabase Auth
    // await supabase.auth.admin.deleteUser(id);
    */

  } catch (error: unknown) {
    logger.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user',
      error: process.env.NODE_ENV === 'development' ?
        (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
};