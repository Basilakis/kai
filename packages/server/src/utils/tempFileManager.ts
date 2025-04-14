import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { logger } from './logger';

/**
 * Creates a unique temporary directory, executes a callback with the directory path,
 * and ensures the directory is cleaned up afterwards.
 * 
 * @param callback - An async function that receives the temporary directory path.
 * @returns The result returned by the callback function.
 * @throws Any error thrown by the callback or during directory creation/cleanup.
 */
export async function withTempDir<T>(
  callback: (tempDirPath: string) => Promise<T>
): Promise<T> {
  let tempDirPath: string | null = null;
  try {
    // Generate a unique directory name
    const uniqueDirName = `kai-server-${uuidv4()}`;
    tempDirPath = path.join(os.tmpdir(), uniqueDirName);

    // Create the directory synchronously
    fs.mkdirSync(tempDirPath, { recursive: true });
    logger.debug(`Created temporary directory: ${tempDirPath}`);

    // Execute the callback with the path (now guaranteed to be a string)
    const result = await callback(tempDirPath);
    return result;

  } finally {
    // Ensure cleanup happens even if the callback throws an error
    if (tempDirPath && fs.existsSync(tempDirPath)) {
      try {
        fs.rmdirSync(tempDirPath, { recursive: true });
        logger.debug(`Cleaned up temporary directory: ${tempDirPath}`);
      } catch (cleanupError) {
        logger.error(`Failed to clean up temporary directory ${tempDirPath}:`, cleanupError);
        // Decide if this error should be swallowed or re-thrown. 
        // Swallowing might be okay for cleanup, but logging is important.
      }
    }
  }
}

/**
 * Helper to write data to a file within a specific directory.
 * Consider adding this if needed frequently, otherwise inline fs.writeFileSync might be fine.
 * 
 * async function writeFileToDir(dirPath: string, fileName: string, data: string | Buffer): Promise<string> {
 *   const filePath = path.join(dirPath, fileName);
 *   await fs.promises.writeFile(filePath, data);
 *   return filePath;
 * } 
 */