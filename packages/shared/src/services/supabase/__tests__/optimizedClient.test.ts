/**
 * Tests for the optimized Supabase client
 */

import { executeQuery, select, selectSingle, insert, update, remove, upsert } from '../optimizedClient';
import { connectionPool } from '../connectionPool';
import { queryCache } from '../queryCache';

// Mock the connectionPool
jest.mock('../connectionPool', () => ({
  connectionPool: {
    acquire: jest.fn(),
    release: jest.fn()
  },
  withConnection: jest.fn()
}));

// Mock the queryCache
jest.mock('../queryCache', () => ({
  queryCache: {
    get: jest.fn(),
    set: jest.fn(),
    generateKey: jest.fn(),
    invalidateTable: jest.fn()
  },
  withCache: jest.fn()
}));

// Mock the supabaseClient
jest.mock('../supabaseClient', () => ({
  supabase: {
    getClient: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis()
    })
  }
}));

// Mock the error handler
jest.mock('../../../utils/supabaseErrorHandler', () => ({
  handleSupabaseError: jest.fn(error => error)
}));

describe('optimizedClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeQuery', () => {
    it('should execute a query with connection pooling and caching', async () => {
      // Mock withCache to execute the function
      (queryCache.generateKey as jest.Mock).mockReturnValue('test:select:{}');
      (queryCache.get as jest.Mock).mockReturnValue(null);
      (withCache as jest.Mock).mockImplementation((table, operation, params, fn) => fn());
      
      // Mock withConnection to execute the function
      (withConnection as jest.Mock).mockImplementation(fn => fn({ from: jest.fn().mockReturnThis() }));
      
      // Mock the query function
      const mockQueryFn = jest.fn().mockResolvedValue({
        data: [{ id: '123', name: 'Test' }],
        error: null
      });
      
      // Execute the query
      const result = await executeQuery(
        'test_table',
        'select',
        {},
        mockQueryFn
      );
      
      // Assertions
      expect(withCache).toHaveBeenCalled();
      expect(withConnection).toHaveBeenCalled();
      expect(mockQueryFn).toHaveBeenCalled();
      expect(result).toEqual([{ id: '123', name: 'Test' }]);
    });

    it('should handle errors properly', async () => {
      // Mock withCache to execute the function
      (withCache as jest.Mock).mockImplementation((table, operation, params, fn) => fn());
      
      // Mock withConnection to execute the function
      (withConnection as jest.Mock).mockImplementation(fn => fn({ from: jest.fn().mockReturnThis() }));
      
      // Mock the query function with an error
      const mockError = { message: 'Database error' };
      const mockQueryFn = jest.fn().mockResolvedValue({
        data: null,
        error: mockError
      });
      
      // Execute the query and expect it to throw
      await expect(executeQuery(
        'test_table',
        'select',
        {},
        mockQueryFn
      )).rejects.toEqual(mockError);
      
      // Assertions
      expect(withCache).toHaveBeenCalled();
      expect(withConnection).toHaveBeenCalled();
      expect(mockQueryFn).toHaveBeenCalled();
    });
  });

  describe('select', () => {
    it('should execute a select query with filters', async () => {
      // Mock executeQuery to return test data
      const mockExecuteQuery = jest.fn().mockResolvedValue([
        { id: '123', name: 'Test' }
      ]);
      
      // Replace the real executeQuery with our mock
      const originalExecuteQuery = require('../optimizedClient').executeQuery;
      require('../optimizedClient').executeQuery = mockExecuteQuery;
      
      // Execute the select query
      const result = await select(
        'test_table',
        {
          columns: 'id,name',
          filters: { status: 'active' },
          limit: 10,
          offset: 0,
          orderBy: 'name',
          orderDirection: 'asc'
        }
      );
      
      // Assertions
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        'test_table',
        'select',
        {
          columns: 'id,name',
          filters: { status: 'active' },
          limit: 10,
          offset: 0,
          orderBy: 'name',
          orderDirection: 'asc'
        },
        expect.any(Function),
        {}
      );
      expect(result).toEqual([{ id: '123', name: 'Test' }]);
      
      // Restore the original executeQuery
      require('../optimizedClient').executeQuery = originalExecuteQuery;
    });
  });

  describe('insert', () => {
    it('should execute an insert query', async () => {
      // Mock executeQuery to return test data
      const mockExecuteQuery = jest.fn().mockResolvedValue(
        { id: '123', name: 'Test' }
      );
      
      // Replace the real executeQuery with our mock
      const originalExecuteQuery = require('../optimizedClient').executeQuery;
      require('../optimizedClient').executeQuery = mockExecuteQuery;
      
      // Execute the insert query
      const result = await insert(
        'test_table',
        { name: 'Test' },
        { returning: 'id,name' }
      );
      
      // Assertions
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        'test_table',
        'insert',
        { data: { name: 'Test' } },
        expect.any(Function),
        {
          returning: 'id,name',
          cacheEnabled: false
        }
      );
      expect(result).toEqual({ id: '123', name: 'Test' });
      
      // Restore the original executeQuery
      require('../optimizedClient').executeQuery = originalExecuteQuery;
    });
  });
});
