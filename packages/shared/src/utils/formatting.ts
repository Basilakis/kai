/**
 * Formatting utilities for the application
 */

import { format, formatDistance, formatRelative } from 'date-fns';

/**
 * Formats a date as a string
 * @param date The date to format
 * @param formatString The format string to use
 * @returns The formatted date string
 */
export function formatDate(date: Date | number, formatString: string = 'yyyy-MM-dd'): string {
  return format(date, formatString);
}

/**
 * Formats a date as a relative time string (e.g., "5 minutes ago")
 * @param date The date to format
 * @param baseDate The base date to compare against (defaults to now)
 * @returns The formatted relative time string
 */
export function formatRelativeTime(date: Date | number, baseDate: Date | number = new Date()): string {
  return formatDistance(date, baseDate, { addSuffix: true });
}

/**
 * Formats a date relative to the current date (e.g., "yesterday", "last week")
 * @param date The date to format
 * @param baseDate The base date to compare against (defaults to now)
 * @returns The formatted relative date string
 */
export function formatRelativeDate(date: Date | number, baseDate: Date | number = new Date()): string {
  return formatRelative(date, baseDate);
}

/**
 * Formats a number as a file size string (e.g., "1.5 MB")
 * @param bytes The number of bytes
 * @param decimals The number of decimal places to include
 * @returns The formatted file size string
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Formats a number as a currency string
 * @param value The number to format
 * @param currency The currency code (e.g., "USD")
 * @param locale The locale to use for formatting
 * @returns The formatted currency string
 */
export function formatCurrency(value: number, currency: string = 'USD', locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(value);
}

/**
 * Formats a number as a percentage string
 * @param value The number to format (e.g., 0.75 for 75%)
 * @param decimals The number of decimal places to include
 * @returns The formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Truncates a string to a specified length and adds an ellipsis if needed
 * @param str The string to truncate
 * @param length The maximum length of the string
 * @param ellipsis The ellipsis to add if the string is truncated
 * @returns The truncated string
 */
export function truncateString(str: string, length: number, ellipsis: string = '...'): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + ellipsis;
}

/**
 * Converts a string to title case
 * @param str The string to convert
 * @returns The title case string
 */
export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  );
}

/**
 * Formats a material name for display
 * @param materialType The type of material
 * @param name The name of the material
 * @returns The formatted material name
 */
export function formatMaterialName(materialType: string, name: string): string {
  return `${toTitleCase(materialType)}: ${name}`;
}

/**
 * Formats dimensions for display
 * @param width The width
 * @param height The height
 * @param depth The depth (optional)
 * @param unit The unit of measurement
 * @returns The formatted dimensions string
 */
export function formatDimensions(width: number, height: number, depth?: number, unit: string = 'mm'): string {
  if (depth) {
    return `${width} × ${height} × ${depth} ${unit}`;
  }
  return `${width} × ${height} ${unit}`;
}

/**
 * Formats a color for display
 * @param colorName The name of the color
 * @param hex The hex code of the color (optional)
 * @returns The formatted color string
 */
export function formatColor(colorName: string, hex?: string): string {
  if (hex) {
    return `${toTitleCase(colorName)} (${hex})`;
  }
  return toTitleCase(colorName);
}

/**
 * Formats a confidence score as a percentage with a descriptive label
 * @param confidence The confidence score (0-1)
 * @returns The formatted confidence string
 */
export function formatConfidence(confidence: number): string {
  const percentage = formatPercentage(confidence, 1);
  
  if (confidence >= 0.9) return `Very High (${percentage})`;
  if (confidence >= 0.7) return `High (${percentage})`;
  if (confidence >= 0.5) return `Medium (${percentage})`;
  if (confidence >= 0.3) return `Low (${percentage})`;
  return `Very Low (${percentage})`;
}