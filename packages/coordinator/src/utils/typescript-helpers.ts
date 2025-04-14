/**
 * Utility to mark variables as intentionally unused
 * This helps TypeScript understand that we're aware these variables aren't used
 * @param _args Any number of arguments to mark as intentionally unused
 */
export function markUnused(..._args: any[]): void {
  // This function does nothing, it's just to silence TypeScript warnings
}

/**
 * Filter undefined values from an array and assert the result is a string array
 * @param arr Array that might contain undefined values
 * @returns Array with undefined values filtered out
 */
export function filterUndefined<T>(arr: (T | undefined)[]): T[] {
  return arr.filter((item): item is T => item !== undefined);
}
