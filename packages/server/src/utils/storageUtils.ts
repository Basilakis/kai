import { supabase } from '@kai/shared/src/lib/supabase';
import fs from 'fs';
import path from 'path';

/**
 * Upload a file to storage
 * 
 * @param filePath Local path to the file
 * @param storagePath Path in storage where the file should be saved
 * @returns Public URL of the uploaded file
 */
export async function uploadToStorage(filePath: string, storagePath: string): Promise<string> {
  try {
    const fileContent = fs.readFileSync(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    
    // Determine content type based on file extension
    let contentType = 'application/octet-stream';
    if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (fileExtension === '.png') {
      contentType = 'image/png';
    } else if (fileExtension === '.gif') {
      contentType = 'image/gif';
    } else if (fileExtension === '.webp') {
      contentType = 'image/webp';
    } else if (fileExtension === '.svg') {
      contentType = 'image/svg+xml';
    }
    
    const { data, error } = await supabase.storage
      .from('visual-references')
      .upload(storagePath, fileContent, {
        contentType,
        upsert: true
      });
    
    if (error) {
      throw error;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('visual-references')
      .getPublicUrl(data.path);
    
    return urlData.publicUrl;
  } catch (error) {
    throw new Error(`Failed to upload file to storage: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete a file from storage
 * 
 * @param url Public URL of the file
 * @returns True if successful
 */
export async function deleteFromStorage(url: string): Promise<boolean> {
  try {
    // Extract the path from the URL
    const baseUrl = supabase.storage.from('visual-references').getPublicUrl('').data.publicUrl;
    const storagePath = url.replace(baseUrl, '');
    
    const { error } = await supabase.storage
      .from('visual-references')
      .remove([storagePath]);
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    throw new Error(`Failed to delete file from storage: ${error instanceof Error ? error.message : String(error)}`);
  }
}
