/**
 * Tests for the Supabase helpers
 */

import { uploadFile, downloadFile, createPaginatedQuery } from '../supabaseHelpers';

// Mock the Supabase client
jest.mock('../../services/supabase/supabaseClient', () => ({
  supabase: {
    getClient: jest.fn().mockReturnValue({
      storage: {
        from: jest.fn().mockReturnValue({
          upload: jest.fn(),
          download: jest.fn(),
          getPublicUrl: jest.fn()
        })
      }
    })
  }
}));

// Mock the fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  createReadStream: jest.fn(),
  existsSync: jest.fn()
}));

// Import mocks after mocking
import fs from 'fs';
import { supabase } from '../../services/supabase/supabaseClient';

describe('uploadFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should upload a file to Supabase storage', async () => {
    // Mock file existence check
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Mock file content
    const mockFileContent = Buffer.from('test file content');
    (fs.readFileSync as jest.Mock).mockReturnValue(mockFileContent);
    
    // Mock Supabase client
    const mockUpload = jest.fn().mockResolvedValue({
      data: { path: 'test/file.txt' },
      error: null
    });
    
    const mockGetPublicUrl = jest.fn().mockReturnValue({
      data: { publicUrl: 'https://example.com/test/file.txt' }
    });
    
    const mockFrom = jest.fn().mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl
    });
    
    (supabase.getClient().storage.from as jest.Mock).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl
    });
    
    // Call the function
    const result = await uploadFile(
      'local/path/file.txt',
      'bucket/test/file.txt',
      { contentType: 'text/plain', isPublic: true }
    );
    
    // Assertions
    expect(fs.existsSync).toHaveBeenCalledWith('local/path/file.txt');
    expect(fs.readFileSync).toHaveBeenCalledWith('local/path/file.txt');
    expect(mockUpload).toHaveBeenCalledWith(
      'test/file.txt',
      mockFileContent,
      {
        contentType: 'text/plain',
        upsert: true
      }
    );
    expect(mockGetPublicUrl).toHaveBeenCalledWith('test/file.txt');
    expect(result).toEqual({
      path: 'test/file.txt',
      url: 'https://example.com/test/file.txt'
    });
  });

  it('should throw an error if the file does not exist', async () => {
    // Mock file existence check
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    // Call the function and expect it to throw
    await expect(uploadFile(
      'nonexistent/file.txt',
      'bucket/test/file.txt'
    )).rejects.toThrow('File not found');
  });

  it('should handle upload errors', async () => {
    // Mock file existence check
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Mock file content
    const mockFileContent = Buffer.from('test file content');
    (fs.readFileSync as jest.Mock).mockReturnValue(mockFileContent);
    
    // Mock Supabase client with error
    const mockUpload = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Upload failed' }
    });
    
    (supabase.getClient().storage.from as jest.Mock).mockReturnValue({
      upload: mockUpload
    });
    
    // Call the function and expect it to throw
    await expect(uploadFile(
      'local/path/file.txt',
      'bucket/test/file.txt'
    )).rejects.toThrow('Upload failed');
  });
});

describe('downloadFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should download a file from Supabase storage', async () => {
    // Mock Supabase client
    const mockDownload = jest.fn().mockResolvedValue({
      data: Buffer.from('test file content'),
      error: null
    });
    
    (supabase.getClient().storage.from as jest.Mock).mockReturnValue({
      download: mockDownload
    });
    
    // Call the function
    const result = await downloadFile('bucket/test/file.txt');
    
    // Assertions
    expect(mockDownload).toHaveBeenCalledWith('test/file.txt');
    expect(result).toEqual(Buffer.from('test file content'));
  });

  it('should handle download errors', async () => {
    // Mock Supabase client with error
    const mockDownload = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Download failed' }
    });
    
    (supabase.getClient().storage.from as jest.Mock).mockReturnValue({
      download: mockDownload
    });
    
    // Call the function and expect it to throw
    await expect(downloadFile('bucket/test/file.txt'))
      .rejects.toThrow('Download failed');
  });
});

describe('createPaginatedQuery', () => {
  it('should create a paginated query with default options', () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis()
    };
    
    createPaginatedQuery(mockQuery, {});
    
    expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockQuery.range).toHaveBeenCalledWith(0, 9);
  });

  it('should create a paginated query with custom options', () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis()
    };
    
    createPaginatedQuery(mockQuery, {
      page: 2,
      pageSize: 20,
      orderBy: 'name',
      ascending: true
    });
    
    expect(mockQuery.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(mockQuery.range).toHaveBeenCalledWith(20, 39);
  });

  it('should handle custom select columns', () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis()
    };
    
    createPaginatedQuery(mockQuery, {
      select: 'id,name,email'
    });
    
    expect(mockQuery.select).toHaveBeenCalledWith('id,name,email');
  });
});
