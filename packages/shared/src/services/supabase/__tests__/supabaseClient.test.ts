/**
 * Tests for the Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import { supabase, initializeSupabase } from '../supabaseClient';

// Mock the createClient function
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

describe('supabaseClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the client
    (supabase as any).client = null;
  });

  it('should initialize the Supabase client with environment variables', () => {
    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';
    
    // Mock createClient to return a test client
    const mockClient = { from: jest.fn() };
    (createClient as jest.Mock).mockReturnValue(mockClient);
    
    // Initialize the client
    initializeSupabase();
    
    // Get the client
    const client = supabase.getClient();
    
    // Assertions
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-key',
      expect.any(Object)
    );
    expect(client).toBe(mockClient);
  });

  it('should throw an error if environment variables are missing', () => {
    // Mock missing environment variables
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
    
    // Expect initialization to throw
    expect(() => initializeSupabase()).toThrow('Supabase configuration is missing');
  });

  it('should reuse the existing client if already initialized', () => {
    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';
    
    // Mock createClient to return a test client
    const mockClient = { from: jest.fn() };
    (createClient as jest.Mock).mockReturnValue(mockClient);
    
    // Initialize the client
    initializeSupabase();
    
    // Get the client twice
    const client1 = supabase.getClient();
    const client2 = supabase.getClient();
    
    // Assertions
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(client1).toBe(client2);
  });

  it('should initialize with custom options', () => {
    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';
    
    // Mock createClient to return a test client
    const mockClient = { from: jest.fn() };
    (createClient as jest.Mock).mockReturnValue(mockClient);
    
    // Custom options
    const customOptions = {
      auth: {
        persistSession: false
      },
      global: {
        fetch: jest.fn()
      }
    };
    
    // Initialize the client with custom options
    initializeSupabase(customOptions);
    
    // Assertions
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-key',
      expect.objectContaining(customOptions)
    );
  });

  it('should throw an error if getClient is called before initialization', () => {
    // Expect getClient to throw if not initialized
    expect(() => supabase.getClient()).toThrow('Supabase client not initialized');
  });
});
