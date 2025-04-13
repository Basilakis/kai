/**
 * Formatting utilities for the application
 * 
 * This module provides standardized formatting functions for dates, numbers,
 * strings, and domain-specific data across the entire application.
 * 
 * IMPORTANT: To ensure consistent formatting throughout the application,
 * always import formatting functions from this module rather than implementing
 * custom formatting logic in individual components.
 */

// Add Node.js type references to fix require() error
/// <reference types="node" />

// Declare require in the global scope to ensure TypeScript recognizes it
// This handles the case when types field in tsconfig.json doesn't include "node"
declare global {
  const require: NodeRequire;
  interface NodeRequire {
    (id: string): any;
  }
}

// TypeScript type declarations for date-fns functions
type FormatFn = (date: Date | number, formatStr: string, options?: object) => string;
type FormatDistanceFn = (date: Date | number, baseDate: Date | number, options?: object) => string;
type FormatRelativeFn = (date: Date | number, baseDate: Date | number, options?: object) => string;

/**
 * Define a custom type for date-like inputs to handle various formats
 */
export type DateLike = Date | string | number;

/**
 * For TypeScript compatibility without external dependencies
 * We define the necessary date-fns interfaces here.
 * 
 * If date-fns is installed in the project, these will be ignored
 * in favor of the actual module.
 */
interface DateFnsModule {
  format: FormatFn;
  formatDistance: FormatDistanceFn;
  formatRelative: FormatRelativeFn;
}

// Add Node.js type reference to fix require() error
/// <reference types="node" />

// Create safely typed wrapper for date-fns functions to work in both browser and Node
let dateFns: DateFnsModule;

// Type guard to detect if we're in a Node.js environment
const isNodeEnvironment = typeof window === 'undefined';

// Initialize date-fns with proper typing
(() => {
  try {
    // Use dynamic import pattern that works in both Node.js and browser
    if (isNodeEnvironment) {
      // We're in Node.js environment
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const df = require('date-fns');
        dateFns = {
          format: df.format,
          formatDistance: df.formatDistance,
          formatRelative: df.formatRelative
        };
        return;
      } catch (e) {
        console.warn('date-fns not found in Node environment, using fallback');
      }
    } else {
      // We're in a browser environment - could use import() in real code
      // but for compatibility with various bundlers we'll use the fallback
    }
  } catch (e) {
    // Fallback will be used
  }

  // Fallback implementation if date-fns isn't available
  console.warn('Using fallback date formatting implementation');
  dateFns = {
    format: (date: Date | number, _formatStr: string) => {
      // Simple fallback implementation for date formatting
      const d = date instanceof Date ? date : new Date(date);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    },
    formatDistance: (date: Date | number, _baseDate: Date | number) => {
      // Simple fallback for relative time
      const d1 = date instanceof Date ? date : new Date(date);
      const d2 = _baseDate instanceof Date ? _baseDate : new Date(_baseDate);
      const diffMs = Math.abs(d1.getTime() - d2.getTime());
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return diffDays === 0 ? 'today' : `${diffDays} days`;
    },
    formatRelative: (date: Date | number, _baseDate: Date | number) => {
      // Simple fallback
      const d = date instanceof Date ? date : new Date(date);
      return d.toLocaleDateString();
    }
  };
})();

// Create properly typed function references
const format = dateFns.format;
const formatDistance = dateFns.formatDistance;
const formatRelative = dateFns.formatRelative;

// ============================
// Date Formatting
// ============================

/**
 * Format types that can be used to format dates in different ways
 */
export enum DateFormatType {
  /** Standard ISO format without milliseconds (e.g., "2025-04-12T12:00:00Z") */
  ISO = 'iso',
  /** Date only (e.g., "2025-04-12") */
  DATE = 'date',
  /** Date and time (e.g., "2025-04-12 12:00:00") */
  DATETIME = 'datetime',
  /** Localized date (e.g., "Apr 12, 2025") */
  LOCALIZED = 'localized',
  /** Localized date and time (e.g., "Apr 12, 2025, 12:00 PM") */
  LOCALIZED_DATETIME = 'localized_datetime',
  /** Relative time (e.g., "5 minutes ago") */
  RELATIVE = 'relative',
  /** Relative date (e.g., "yesterday", "last week") */
  RELATIVE_DATE = 'relative_date',
  /** Custom format using date-fns format string */
  CUSTOM = 'custom'
}

/**
 * Options for formatting dates
 */
export interface DateFormatOptions {
  /** The format type to use */
  type?: DateFormatType;
  /** The format string to use if type is CUSTOM */
  formatString?: string;
  /** The locale to use for localized formats (default: 'en-US') */
  locale?: string;
  /** Additional options for localized formats */
  options?: Intl.DateTimeFormatOptions;
  /** Base date for relative formats (default: now) */
  baseDate?: Date | number;
  /** Whether to remove milliseconds from ISO formatted dates */
  removeMilliseconds?: boolean;
}

/**
 * Formats a date according to the specified options
 * 
 * This is the main date formatting function that centralizes all date formatting
 * across the application.
 * 
 * @param date The date to format
 * @param options The formatting options
 * @returns The formatted date string
 * 
 * @example
 * // Format as ISO string
 * formatDateWithOptions(new Date(), { type: DateFormatType.ISO })
 * 
 * @example
 * // Format as localized date and time
 * formatDateWithOptions(new Date(), { 
 *   type: DateFormatType.LOCALIZED_DATETIME,
 *   locale: 'en-US'
 * })
 * 
 * @example
 * // Format with custom format string
 * formatDateWithOptions(new Date(), {
 *   type: DateFormatType.CUSTOM,
 *   formatString: 'yyyy-MM-dd HH:mm:ss'
 * })
 */
export function formatDateWithOptions(date: Date | number | string, options: DateFormatOptions = {}): string {
  // Default options
  const {
    type = DateFormatType.DATE,
    formatString = 'yyyy-MM-dd',
    locale = 'en-US',
    options: dateTimeOptions = {},
    baseDate = new Date(),
    removeMilliseconds = true
  } = options;

  // Convert string dates to Date objects
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  switch (type) {
    case DateFormatType.ISO:
      const isoString = new Date(dateObj).toISOString();
      return removeMilliseconds ? isoString.replace(/\.\d{3}Z$/, 'Z') : isoString;

    case DateFormatType.DATE:
      return format(dateObj, 'yyyy-MM-dd');

    case DateFormatType.DATETIME:
      return format(dateObj, 'yyyy-MM-dd HH:mm:ss');

    case DateFormatType.LOCALIZED:
      return new Date(dateObj).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...dateTimeOptions
      });

    case DateFormatType.LOCALIZED_DATETIME:
      return new Date(dateObj).toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...dateTimeOptions
      });

    case DateFormatType.RELATIVE:
      return formatDistance(dateObj, baseDate, { addSuffix: true });

    case DateFormatType.RELATIVE_DATE:
      return formatRelative(dateObj, baseDate);

    case DateFormatType.CUSTOM:
      return format(dateObj, formatString);

    default:
      return format(dateObj, formatString);
  }
}

/**
 * Formats a date as a string using a date-fns format string
 * 
 * This is a simpler wrapper for the more flexible formatDateWithOptions
 * 
 * @param date The date to format
 * @param formatString The format string to use
 * @returns The formatted date string
 */
export function formatDate(date: Date | number | string, formatString: string = 'yyyy-MM-dd'): string {
  return formatDateWithOptions(date, {
    type: DateFormatType.CUSTOM,
    formatString
  });
}

/**
 * Formats a date as a localized string (e.g., "Apr 12, 2025")
 * 
 * @param date The date to format
 * @param locale The locale to use (default: 'en-US')
 * @param options Additional options for the localized format
 * @returns The formatted date string
 */
export function formatLocalizedDate(
  date: Date | number | string,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = {}
): string {
  return formatDateWithOptions(date, {
    type: DateFormatType.LOCALIZED,
    locale,
    options
  });
}

/**
 * Formats a date as a localized date and time string (e.g., "Apr 12, 2025, 12:00 PM")
 * 
 * @param date The date to format
 * @param locale The locale to use (default: 'en-US')
 * @param options Additional options for the localized format
 * @returns The formatted date and time string
 */
export function formatLocalizedDateTime(
  date: Date | number | string,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = {}
): string {
  return formatDateWithOptions(date, {
    type: DateFormatType.LOCALIZED_DATETIME,
    locale,
    options
  });
}

/**
 * Formats a date as an ISO string without milliseconds (e.g., "2025-04-12T12:00:00Z")
 * 
 * @param date The date to format (default: now)
 * @returns The formatted ISO string
 */
export function formatISODate(date: Date | number | string = new Date()): string {
  return formatDateWithOptions(date, {
    type: DateFormatType.ISO
  });
}

/**
 * Formats a date as a relative time string (e.g., "5 minutes ago")
 * 
 * @param date The date to format
 * @param baseDate The base date to compare against (defaults to now)
 * @returns The formatted relative time string
 */
export function formatRelativeTime(
  date: Date | number | string,
  _baseDate: Date | number = new Date()
): string {
  return formatDateWithOptions(date, {
    type: DateFormatType.RELATIVE,
    baseDate: _baseDate
  });
}

/**
 * Formats a date relative to the current date (e.g., "yesterday", "last week")
 * 
 * @param date The date to format
 * @param baseDate The base date to compare against (defaults to now)
 * @returns The formatted relative date string
 */
export function formatRelativeDate(
  date: Date | number | string,
  _baseDate: Date | number = new Date()
): string {
  return formatDateWithOptions(date, {
    type: DateFormatType.RELATIVE_DATE,
    baseDate: _baseDate
  });
}

/**
 * Formats a timestamp with date-fns, providing a standardized way
 * to format dates across components
 * 
 * @param date The date to format
 * @param formatString The format string to use
 * @returns The formatted timestamp
 */
export function formatTimestamp(
  date: Date | number | string,
  formatString: string = 'PPpp'
): string {
  return formatDateWithOptions(date, {
    type: DateFormatType.CUSTOM,
    formatString
  });
}

// ============================
// Number Formatting
// ============================

/**
 * File size units
 */
export enum FileSizeUnit {
  /** Bytes */
  BYTES = 'Bytes',
  /** Kilobytes (1024 bytes) */
  KB = 'KB',
  /** Megabytes (1024 KB) */
  MB = 'MB',
  /** Gigabytes (1024 MB) */
  GB = 'GB',
  /** Terabytes (1024 GB) */
  TB = 'TB'
}

/**
 * Options for formatting file sizes
 */
export interface FileSizeFormatOptions {
  /** The number of decimal places to include */
  decimals?: number;
  /** The unit to use (if specified, will format to this unit rather than automatically determining the best unit) */
  unit?: FileSizeUnit;
  /** The base for calculation (1024 for binary, 1000 for decimal) */
  base?: 1024 | 1000;
}

/**
 * Formats a number as a file size string (e.g., "1.5 MB")
 * 
 * @param bytes The number of bytes
 * @param options Formatting options
 * @returns The formatted file size string
 */
export function formatFileSize(
  bytes: number,
  options: FileSizeFormatOptions = {}
): string {
  if (bytes === 0) return '0 Bytes';

  const { decimals = 2, base = 1024, unit } = options;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = [
    FileSizeUnit.BYTES,
    FileSizeUnit.KB,
    FileSizeUnit.MB,
    FileSizeUnit.GB,
    FileSizeUnit.TB,
    'PB',
    'EB',
    'ZB',
    'YB'
  ];

  // If unit is specified, convert to that unit
  if (unit) {
    const unitIndex = sizes.indexOf(unit);
    if (unitIndex === -1) {
      // Invalid unit, fall back to automatic detection
      const i = Math.floor(Math.log(bytes) / Math.log(base));
      return `${parseFloat((bytes / Math.pow(base, i)).toFixed(dm))} ${sizes[i]}`;
    }
    
    return `${parseFloat((bytes / Math.pow(base, unitIndex)).toFixed(dm))} ${unit}`;
  }

  // Automatically determine the best unit
  const i = Math.floor(Math.log(bytes) / Math.log(base));
  return `${parseFloat((bytes / Math.pow(base, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Formats a number as a currency string
 * 
 * @param value The number to format
 * @param currency The currency code (e.g., "USD")
 * @param locale The locale to use for formatting
 * @returns The formatted currency string
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(value);
}

/**
 * Formats a number as a percentage string
 * 
 * @param value The number to format (e.g., 0.75 for 75%)
 * @param decimals The number of decimal places to include
 * @returns The formatted percentage string
 */
export function formatPercentage(
  value: number,
  decimals: number = 0
): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Formats a number with separators for thousands
 * 
 * @param value The number to format
 * @param locale The locale to use for formatting
 * @param options Additional options for the number format
 * @returns The formatted number string
 */
export function formatNumber(
  value: number,
  locale: string = 'en-US',
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

// ============================
// String Formatting
// ============================

/**
 * Truncates a string to a specified length and adds an ellipsis if needed
 * 
 * @param str The string to truncate
 * @param length The maximum length of the string
 * @param ellipsis The ellipsis to add if the string is truncated
 * @returns The truncated string
 */
export function truncateString(
  str: string,
  length: number,
  ellipsis: string = '...'
): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + ellipsis;
}

/**
 * Converts a string to title case
 * 
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
 * Formats a multi-line string for display by trimming
 * and normalizing whitespace, while preserving paragraph breaks
 * 
 * @param text The text to format
 * @returns The formatted text
 */
export function formatText(text: string): string {
  if (!text) return '';
  
  // Split by double line breaks to preserve paragraphs
  return text
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim().replace(/\s+/g, ' '))
    .filter(paragraph => paragraph.length > 0)
    .join('\n\n');
}

// ============================
// Domain-Specific Formatting
// ============================

/**
 * Formats a material name for display
 * 
 * @param materialType The type of material
 * @param name The name of the material
 * @returns The formatted material name
 */
export function formatMaterialName(materialType: string, name: string): string {
  return `${toTitleCase(materialType)}: ${name}`;
}

/**
 * Formats dimensions for display
 * 
 * @param width The width
 * @param height The height
 * @param depth The depth (optional)
 * @param unit The unit of measurement
 * @returns The formatted dimensions string
 */
export function formatDimensions(
  width: number,
  height: number,
  depth?: number,
  unit: string = 'mm'
): string {
  if (depth) {
    return `${width} × ${height} × ${depth} ${unit}`;
  }
  return `${width} × ${height} ${unit}`;
}

/**
 * Formats a color for display
 * 
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
 * 
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

// ============================
// Backward Compatibility Exports
// ============================

// Export for backward compatibility
export default {
  formatDate,
  formatLocalizedDate,
  formatLocalizedDateTime,
  formatISODate,
  formatTimestamp,
  formatRelativeTime,
  formatRelativeDate,
  formatFileSize,
  formatCurrency,
  formatPercentage,
  formatNumber,
  truncateString,
  toTitleCase,
  formatText,
  formatMaterialName,
  formatDimensions,
  formatColor,
  formatConfidence
};