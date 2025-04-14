import { spawn } from 'child_process';
import { ApiError } from '../middleware/error.middleware';
import { logger } from './logger';

interface MlScriptOptions {
  scriptPath: string; // Path relative to project root, e.g., 'packages/ml/python/script.py'
  args: string[];
  timeout?: number; // Optional timeout in milliseconds
}

/**
 * Executes a Python ML script as a child process and returns the parsed JSON output.
 * 
 * @param options - Configuration for running the script.
 * @returns A promise that resolves with the parsed JSON output or rejects with an ApiError.
 */
export function runMlScript<T>(options: MlScriptOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const { scriptPath, args, timeout = 600000 } = options; // Default 10 min timeout

    logger.info(`Spawning ML script: ${scriptPath} with args: ${args.join(' ')}`);

    // Use '-m' if scriptPath is a module path, otherwise treat as file path
    const spawnArgs = scriptPath.includes('/')
      ? [scriptPath, ...args]
      : ['-m', scriptPath.replace('.py', ''), ...args]; // Assume module if no slash

    // Remove timeout from spawn options, it's handled manually below
    const pythonProcess = spawn('python', spawnArgs); 

    let resultJson = '';
    let errorOutput = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      pythonProcess.kill('SIGTERM'); // Attempt graceful termination first
      logger.error(`ML script ${scriptPath} timed out after ${timeout}ms.`);
      reject(new ApiError(504, `ML script execution timed out after ${timeout / 1000} seconds.`));
    }, timeout);

    pythonProcess.stdout.on('data', (data: Buffer) => {
      resultJson += data.toString();
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
      logger.warn(`ML script ${scriptPath} stderr: ${data.toString()}`);
    });

    pythonProcess.on('error', (err) => {
      clearTimeout(timer);
      if (timedOut) return; // Already handled by timeout
      logger.error(`Failed to start ML script ${scriptPath}: ${err.message}`);
      reject(new ApiError(500, `Failed to start ML script: ${err.message}`));
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return; // Already handled by timeout

      logger.info(`ML script ${scriptPath} finished with code ${code}.`);

      if (code !== 0) {
        logger.error(`ML script ${scriptPath} failed with code ${code}. Error output: ${errorOutput}`);
        // ApiError constructor doesn't take details object, errorOutput is logged above
        reject(new ApiError(500, `ML script execution failed with code ${code}.`)); 
        return;
      }

      try {
        // Attempt to parse the accumulated stdout as JSON
        const parsedResult = JSON.parse(resultJson);
        resolve(parsedResult as T);
      } catch (parseError) {
        logger.error(`Failed to parse JSON output from ML script ${scriptPath}. Output: ${resultJson}`, parseError);
        // ApiError constructor doesn't take details object, output and error are logged above
        reject(new ApiError(500, 'Failed to parse ML script output.')); 
      }
    });
  });
}