/**
 * Tests for the Supabase error handler
 */

import { handleSupabaseError, safeSupabaseOperation, retrySupabaseOperation } from '../supabaseErrorHandler';

describe('handleSupabaseError', () => {
  it('should handle PostgreSQL errors', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint'
    };

    const result = handleSupabaseError(error, 'testOperation');
    
    expect(result.message).toContain('duplicate key');
    expect(result.type).toBe('conflict');
    expect(result.operation).toBe('testOperation');
  });

  it('should handle authentication errors', () => {
    const error = {
      message: 'Invalid login credentials',
      status: 401
    };

    const result = handleSupabaseError(error, 'login');
    
    expect(result.message).toContain('Invalid login credentials');
    expect(result.type).toBe('auth');
    expect(result.operation).toBe('login');
  });

  it('should handle not found errors', () => {
    const error = {
      code: 'PGRST116',
      message: 'No results found'
    };

    const result = handleSupabaseError(error, 'getUser');
    
    expect(result.message).toContain('No results found');
    expect(result.type).toBe('not_found');
    expect(result.operation).toBe('getUser');
  });

  it('should handle rate limit errors', () => {
    const error = {
      code: '429',
      message: 'Too many requests'
    };

    const result = handleSupabaseError(error, 'query');
    
    expect(result.message).toContain('Too many requests');
    expect(result.type).toBe('rate_limit');
    expect(result.operation).toBe('query');
  });

  it('should handle network errors', () => {
    const error = new Error('Failed to fetch');
    
    const result = handleSupabaseError(error, 'fetchData');
    
    expect(result.message).toContain('Failed to fetch');
    expect(result.type).toBe('network');
    expect(result.operation).toBe('fetchData');
  });

  it('should include context in the error', () => {
    const error = new Error('Database error');
    const context = { userId: '123', action: 'update' };
    
    const result = handleSupabaseError(error, 'updateUser', context);
    
    expect(result.context).toEqual(context);
  });
});

describe('safeSupabaseOperation', () => {
  it('should return data when operation succeeds', async () => {
    const mockOperation = jest.fn().mockResolvedValue({
      data: { id: '123', name: 'Test' },
      error: null
    });

    const result = await safeSupabaseOperation(mockOperation, 'testOperation');
    
    expect(result).toEqual({ id: '123', name: 'Test' });
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should throw enhanced error when operation fails', async () => {
    const mockError = { message: 'Database error', code: '42P01' };
    const mockOperation = jest.fn().mockResolvedValue({
      data: null,
      error: mockError
    });

    await expect(safeSupabaseOperation(mockOperation, 'testOperation'))
      .rejects
      .toHaveProperty('operation', 'testOperation');
    
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should return default value when operation fails and defaultValue is provided', async () => {
    const mockError = { message: 'Database error', code: '42P01' };
    const mockOperation = jest.fn().mockResolvedValue({
      data: null,
      error: mockError
    });
    const defaultValue = { id: 'default', name: 'Default' };

    const result = await safeSupabaseOperation(
      mockOperation, 
      'testOperation', 
      defaultValue
    );
    
    expect(result).toEqual(defaultValue);
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });
});

describe('retrySupabaseOperation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return data when operation succeeds on first try', async () => {
    const mockOperation = jest.fn().mockResolvedValue({
      data: { id: '123', name: 'Test' },
      error: null
    });

    const resultPromise = retrySupabaseOperation(
      mockOperation, 
      'testOperation'
    );
    
    // Fast-forward all timers
    jest.runAllTimers();
    
    const result = await resultPromise;
    expect(result).toEqual({ id: '123', name: 'Test' });
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should retry when operation fails with retryable error', async () => {
    const mockError = { message: 'Connection error', code: 'ECONNRESET' };
    const mockOperation = jest.fn()
      .mockResolvedValueOnce({
        data: null,
        error: mockError
      })
      .mockResolvedValueOnce({
        data: { id: '123', name: 'Test' },
        error: null
      });

    const resultPromise = retrySupabaseOperation(
      mockOperation, 
      'testOperation',
      { maxRetries: 3, initialDelayMs: 100 }
    );
    
    // Fast-forward all timers
    jest.runAllTimers();
    
    const result = await resultPromise;
    expect(result).toEqual({ id: '123', name: 'Test' });
    expect(mockOperation).toHaveBeenCalledTimes(2);
  });

  it('should throw enhanced error after max retries', async () => {
    const mockError = { message: 'Connection error', code: 'ECONNRESET' };
    const mockOperation = jest.fn().mockResolvedValue({
      data: null,
      error: mockError
    });

    const resultPromise = retrySupabaseOperation(
      mockOperation, 
      'testOperation',
      { maxRetries: 2, initialDelayMs: 100 }
    );
    
    // Fast-forward all timers
    jest.runAllTimers();
    
    await expect(resultPromise)
      .rejects
      .toHaveProperty('operation', 'testOperation');
    
    expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should not retry for non-retryable errors', async () => {
    const mockError = { message: 'Permission denied', code: '42501' };
    const mockOperation = jest.fn().mockResolvedValue({
      data: null,
      error: mockError
    });

    const resultPromise = retrySupabaseOperation(
      mockOperation, 
      'testOperation',
      { maxRetries: 3, initialDelayMs: 100 }
    );
    
    // Fast-forward all timers
    jest.runAllTimers();
    
    await expect(resultPromise)
      .rejects
      .toHaveProperty('operation', 'testOperation');
    
    expect(mockOperation).toHaveBeenCalledTimes(1); // No retries
  });
});
