/**
 * Enhanced Cron Parser
 *
 * This module provides a comprehensive cron parser for scheduling tasks.
 * It supports the full cron syntax including step values, ranges, and lists.
 */

import { createLogger } from './unified-logger';

const logger = createLogger('CronParser');

/**
 * Timezone information
 */
export interface TimezoneInfo {
  /** Timezone name */
  name: string;
  /** Timezone offset in minutes */
  offsetMinutes: number;
}

/**
 * Jitter options
 */
export interface JitterOptions {
  /** Whether to enable jitter */
  enabled: boolean;
  /** Maximum jitter as a percentage of the interval (0-1) */
  maxPercent: number;
}

/**
 * Cron expression
 *
 * Format: * * * * *
 * |  |  |  |  |
 * |  |  |  |  +----- Day of week (0 - 6) (Sunday = 0)
 * |  |  |  +-------- Month (1 - 12)
 * |  |  +----------- Day of month (1 - 31)
 * |  +-------------- Hour (0 - 23)
 * +----------------- Minute (0 - 59)
 *
 * Special expressions:
 * - @yearly, @annually: Run once a year at midnight on January 1st (0 0 1 1 *)
 * - @monthly: Run once a month at midnight on the first day (0 0 1 * *)
 * - @weekly: Run once a week at midnight on Sunday (0 0 * * 0)
 * - @daily, @midnight: Run once a day at midnight (0 0 * * *)
 * - @hourly: Run once an hour at the beginning of the hour (0 * * * *)
 * - @every_minute: Run once a minute (* * * * *)
 * - @every_5_minutes: Run every 5 minutes (*/5 * * * *)
 * - @every_10_minutes: Run every 10 minutes (*/10 * * * *)
 * - @every_15_minutes: Run every 15 minutes (*/15 * * * *)
 * - @every_30_minutes: Run every 30 minutes (*/30 * * * *)
 */

/**
 * Parse a cron expression into a millisecond interval
 * @param expression Cron expression
 * @param jitter Jitter options
 * @returns Millisecond interval
 */
export function parseCronToMs(expression: string, jitter?: JitterOptions): number {
  // Handle special expressions
  switch (expression.toLowerCase()) {
    case '@yearly':
    case '@annually':
      return applyJitter(365 * 24 * 60 * 60 * 1000, jitter); // 1 year
    case '@monthly':
      return applyJitter(30 * 24 * 60 * 60 * 1000, jitter); // 30 days
    case '@weekly':
      return applyJitter(7 * 24 * 60 * 60 * 1000, jitter); // 7 days
    case '@daily':
    case '@midnight':
      return applyJitter(24 * 60 * 60 * 1000, jitter); // 24 hours
    case '@hourly':
      return applyJitter(60 * 60 * 1000, jitter); // 60 minutes
    case '@every_minute':
      return applyJitter(60 * 1000, jitter); // 1 minute
    case '@every_5_minutes':
      return applyJitter(5 * 60 * 1000, jitter); // 5 minutes
    case '@every_10_minutes':
      return applyJitter(10 * 60 * 1000, jitter); // 10 minutes
    case '@every_15_minutes':
      return applyJitter(15 * 60 * 1000, jitter); // 15 minutes
    case '@every_30_minutes':
      return applyJitter(30 * 60 * 1000, jitter); // 30 minutes
  }

  // Parse standard cron expression
  const parts = expression.split(' ');

  if (parts.length !== 5 && parts.length !== 6) {
    logger.warn(`Invalid cron expression: ${expression}, falling back to hourly`);
    return applyJitter(60 * 60 * 1000, jitter); // 1 hour
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Handle step values in minute field (*/n)
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.substring(2), 10);
    if (!isNaN(interval) && interval > 0 && interval <= 59) {
      return applyJitter(interval * 60 * 1000, jitter);
    }
  }

  // Handle ranges in minute field (n-m)
  if (minute.includes('-')) {
    const [start, end] = minute.split('-').map(p => parseInt(p, 10));
    if (!isNaN(start) && !isNaN(end) && start >= 0 && end <= 59 && start < end) {
      // For ranges, we'll use the smallest interval
      return applyJitter(60 * 1000, jitter); // 1 minute
    }
  }

  // Handle lists in minute field (n,m,o)
  if (minute.includes(',')) {
    const values = minute.split(',').map(p => parseInt(p, 10));
    if (values.every(v => !isNaN(v) && v >= 0 && v <= 59)) {
      // For lists, we'll use the smallest interval
      return applyJitter(60 * 1000, jitter); // 1 minute
    }
  }

  // Handle step values in hour field (*/n)
  if (hour.startsWith('*/')) {
    const interval = parseInt(hour.substring(2), 10);
    if (!isNaN(interval) && interval > 0 && interval <= 23) {
      return applyJitter(interval * 60 * 60 * 1000, jitter);
    }
  }

  // For more complex expressions, we'll use a more sophisticated approach
  // to determine the appropriate interval

  // Calculate the minimum interval based on the cron expression
  let interval = calculateMinimumInterval(minute, hour, dayOfMonth, month, dayOfWeek);

  // Apply jitter if specified
  return applyJitter(interval, jitter);
}

/**
 * Calculate the minimum interval based on the cron expression
 * @param minute Minute field
 * @param hour Hour field
 * @param dayOfMonth Day of month field
 * @param month Month field
 * @param dayOfWeek Day of week field
 * @returns Minimum interval in milliseconds
 */
function calculateMinimumInterval(
  minute: string,
  hour: string,
  dayOfMonth: string,
  month: string,
  dayOfWeek: string
): number {
  // Check if minute field has specific values
  if (minute !== '*') {
    // Parse minute field to get all possible values
    const minuteValues = parseField(minute, 0, 59);

    if (minuteValues.length > 1) {
      // Find the minimum interval between consecutive minutes
      let minInterval = 60; // Default to 60 minutes

      // Sort the values
      minuteValues.sort((a, b) => a - b);

      // Calculate the minimum interval
      for (let i = 1; i < minuteValues.length; i++) {
        const interval = minuteValues[i] - minuteValues[i - 1];
        if (interval < minInterval) {
          minInterval = interval;
        }
      }

      // Also check the interval between the last and first values (for the next hour)
      const lastToFirstInterval = 60 - minuteValues[minuteValues.length - 1] + minuteValues[0];
      if (lastToFirstInterval < minInterval) {
        minInterval = lastToFirstInterval;
      }

      return minInterval * 60 * 1000; // Convert to milliseconds
    }

    // If there's only one specific minute, check the hour field
    if (hour !== '*') {
      // If hour is also specific, run daily
      return 24 * 60 * 60 * 1000; // 24 hours
    }

    // If hour is *, run hourly
    return 60 * 60 * 1000; // 1 hour
  }

  // If minute is *, check the hour field
  if (hour !== '*') {
    // Parse hour field to get all possible values
    const hourValues = parseField(hour, 0, 23);

    if (hourValues.length > 1) {
      // Find the minimum interval between consecutive hours
      let minInterval = 24; // Default to 24 hours

      // Sort the values
      hourValues.sort((a, b) => a - b);

      // Calculate the minimum interval
      for (let i = 1; i < hourValues.length; i++) {
        const interval = hourValues[i] - hourValues[i - 1];
        if (interval < minInterval) {
          minInterval = interval;
        }
      }

      // Also check the interval between the last and first values (for the next day)
      const lastToFirstInterval = 24 - hourValues[hourValues.length - 1] + hourValues[0];
      if (lastToFirstInterval < minInterval) {
        minInterval = lastToFirstInterval;
      }

      return minInterval * 60 * 60 * 1000; // Convert to milliseconds
    }

    // If there's only one specific hour, check the day fields
    if (dayOfMonth !== '*' || dayOfWeek !== '*') {
      // If day is also specific, run monthly or weekly
      if (dayOfMonth !== '*' && dayOfWeek === '*') {
        return 30 * 24 * 60 * 60 * 1000; // 30 days
      }

      if (dayOfMonth === '*' && dayOfWeek !== '*') {
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      }

      // If both day fields are specific, use the smaller interval
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    // If day fields are *, run daily
    return 24 * 60 * 60 * 1000; // 24 hours
  }

  // If both minute and hour are *, check the day fields
  if (dayOfMonth !== '*' || dayOfWeek !== '*') {
    // If day of month is specific, run monthly
    if (dayOfMonth !== '*' && dayOfWeek === '*') {
      return 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    // If day of week is specific, run weekly
    if (dayOfMonth === '*' && dayOfWeek !== '*') {
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    // If both day fields are specific, use the smaller interval
    return 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  // If minute, hour, and day fields are all *, check the month field
  if (month !== '*') {
    // If month is specific, run yearly
    return 365 * 24 * 60 * 60 * 1000; // 365 days
  }

  // If all fields are *, run every minute
  return 60 * 1000; // 1 minute
}

/**
 * Parse a cron field to get all possible values
 * @param field Field to parse
 * @param min Minimum value
 * @param max Maximum value
 * @returns Array of possible values
 */
function parseField(field: string, min: number, max: number): number[] {
  // Handle wildcard
  if (field === '*') {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  // Handle step values (*/n)
  if (field.startsWith('*/')) {
    const step = parseInt(field.substring(2), 10);
    if (!isNaN(step) && step > 0) {
      const values: number[] = [];
      for (let i = min; i <= max; i += step) {
        values.push(i);
      }
      return values;
    }
  }

  // Handle ranges (n-m)
  if (field.includes('-')) {
    const parts = field.split('-');
    if (parts.length === 2) {
      const start = parseInt(parts[0], 10);
      let end = parseInt(parts[1], 10);

      // Handle ranges with step (n-m/s)
      let step = 1;
      if (parts[1].includes('/')) {
        const stepParts = parts[1].split('/');
        end = parseInt(stepParts[0], 10);
        step = parseInt(stepParts[1], 10);
      }

      if (!isNaN(start) && !isNaN(end) && !isNaN(step) && step > 0 && start >= min && end <= max && start <= end) {
        const values: number[] = [];
        for (let i = start; i <= end; i += step) {
          values.push(i);
        }
        return values;
      }
    }
  }

  // Handle lists (n,m,o)
  if (field.includes(',')) {
    const values = field.split(',').map(p => parseInt(p, 10));
    if (values.every(v => !isNaN(v) && v >= min && v <= max)) {
      return values;
    }
  }

  // Handle single value
  const value = parseInt(field, 10);
  if (!isNaN(value) && value >= min && value <= max) {
    return [value];
  }

  // Default to all values
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/**
 * Apply jitter to an interval
 * @param interval Interval in milliseconds
 * @param jitter Jitter options
 * @returns Interval with jitter applied
 */
function applyJitter(interval: number, jitter?: JitterOptions): number {
  if (!jitter || !jitter.enabled || jitter.maxPercent <= 0) {
    return interval;
  }

  // Ensure maxPercent is between 0 and 1
  const maxPercent = Math.min(Math.max(jitter.maxPercent, 0), 1);

  // Calculate jitter amount
  const jitterAmount = interval * maxPercent * Math.random();

  // Apply jitter (always subtract to ensure we don't exceed the interval)
  return interval - jitterAmount;
}

/**
 * Get the next execution time for a cron expression
 * @param expression Cron expression
 * @param baseTime Base time (defaults to now)
 * @param timezone Timezone information
 * @param jitter Jitter options
 * @returns Next execution time in milliseconds since epoch
 */
export function getNextExecutionTime(
  expression: string,
  baseTime: Date = new Date(),
  timezone?: TimezoneInfo,
  jitter?: JitterOptions
): Date {
  // Handle special expressions
  if (expression.startsWith('@')) {
    // For special expressions, we'll just add the interval to the base time
    const interval = parseCronToMs(expression, jitter);
    return new Date(baseTime.getTime() + interval);
  }

  // Parse standard cron expression
  const parts = expression.split(' ');

  if (parts.length !== 5 && parts.length !== 6) {
    logger.warn(`Invalid cron expression: ${expression}, falling back to hourly`);
    const interval = parseCronToMs('@hourly', jitter);
    return new Date(baseTime.getTime() + interval);
  }

  const [minuteExpr, hourExpr, dayOfMonthExpr, monthExpr, dayOfWeekExpr] = parts;

  // Apply timezone if specified
  let adjustedBaseTime = new Date(baseTime);
  if (timezone) {
    // Get the local timezone offset in minutes
    const localOffset = adjustedBaseTime.getTimezoneOffset();

    // Calculate the difference between the local timezone and the specified timezone
    const offsetDiff = localOffset + timezone.offsetMinutes;

    // Adjust the base time
    adjustedBaseTime = new Date(adjustedBaseTime.getTime() + offsetDiff * 60 * 1000);
  }

  // Get the current date components
  const currentMinute = adjustedBaseTime.getMinutes();
  const currentHour = adjustedBaseTime.getHours();
  const currentDay = adjustedBaseTime.getDate();
  const currentMonth = adjustedBaseTime.getMonth() + 1; // 1-12
  const currentDayOfWeek = adjustedBaseTime.getDay(); // 0-6

  // Parse the cron expression fields
  const minutes = parseField(minuteExpr, 0, 59);
  const hours = parseField(hourExpr, 0, 23);
  const daysOfMonth = parseField(dayOfMonthExpr, 1, 31);
  const months = parseField(monthExpr, 1, 12);
  const daysOfWeek = parseField(dayOfWeekExpr, 0, 6);

  // Find the next execution time
  let nextTime = new Date(adjustedBaseTime);

  // Start with the current time and increment until we find a match
  let found = false;
  let iterations = 0;
  const maxIterations = 1000; // Prevent infinite loops

  while (!found && iterations < maxIterations) {
    iterations++;

    // Check if the current time matches the cron expression
    if (
      minutes.includes(nextTime.getMinutes()) &&
      hours.includes(nextTime.getHours()) &&
      (daysOfMonth.includes(nextTime.getDate()) || dayOfMonthExpr === '*') &&
      months.includes(nextTime.getMonth() + 1) &&
      (daysOfWeek.includes(nextTime.getDay()) || dayOfWeekExpr === '*')
    ) {
      // If the day of month and day of week are both specified, either can match
      if (dayOfMonthExpr !== '*' && dayOfWeekExpr !== '*') {
        if (daysOfMonth.includes(nextTime.getDate()) || daysOfWeek.includes(nextTime.getDay())) {
          found = true;
        }
      } else {
        found = true;
      }
    }

    // If not found, increment the time
    if (!found) {
      // Increment by 1 minute
      nextTime.setMinutes(nextTime.getMinutes() + 1);
      nextTime.setSeconds(0);
      nextTime.setMilliseconds(0);
    }
  }

  if (iterations >= maxIterations) {
    logger.warn(`Could not find next execution time for cron expression: ${expression}, falling back to interval-based calculation`);
    const interval = parseCronToMs(expression, jitter);
    return new Date(baseTime.getTime() + interval);
  }

  // Apply jitter if specified
  if (jitter && jitter.enabled && jitter.maxPercent > 0) {
    // Calculate the interval to the next execution
    const interval = nextTime.getTime() - baseTime.getTime();

    // Apply jitter
    const jitteredInterval = applyJitter(interval, jitter);

    // Calculate the jittered execution time
    return new Date(baseTime.getTime() + jitteredInterval);
  }

  return nextTime;
}

/**
 * Check if a cron expression is valid
 * @param expression Cron expression
 * @returns Whether the expression is valid
 */
export function isValidCronExpression(expression: string): boolean {
  // Handle special expressions
  const specialExpressions = [
    '@yearly', '@annually', '@monthly', '@weekly', '@daily',
    '@midnight', '@hourly', '@every_minute', '@every_5_minutes',
    '@every_10_minutes', '@every_15_minutes', '@every_30_minutes'
  ];

  if (specialExpressions.includes(expression.toLowerCase())) {
    return true;
  }

  // Parse standard cron expression
  const parts = expression.split(' ');

  // Allow 5 or 6 parts (6th part is for seconds, which we ignore)
  if (parts.length !== 5 && parts.length !== 6) {
    return false;
  }

  // Simple validation for each part
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Check minute (0-59)
  if (!isValidCronPart(minute, 0, 59)) {
    return false;
  }

  // Check hour (0-23)
  if (!isValidCronPart(hour, 0, 23)) {
    return false;
  }

  // Check day of month (1-31)
  if (!isValidCronPart(dayOfMonth, 1, 31)) {
    return false;
  }

  // Check month (1-12)
  if (!isValidCronPart(month, 1, 12)) {
    return false;
  }

  // Check day of week (0-6)
  if (!isValidCronPart(dayOfWeek, 0, 6)) {
    return false;
  }

  return true;
}

/**
 * Check if a cron part is valid
 * @param part Cron part
 * @param min Minimum value
 * @param max Maximum value
 * @returns Whether the part is valid
 */
function isValidCronPart(part: string, min: number, max: number): boolean {
  // Wildcard
  if (part === '*') {
    return true;
  }

  // Interval (*/n)
  if (part.startsWith('*/')) {
    const interval = parseInt(part.substring(2), 10);
    return !isNaN(interval) && interval > 0 && interval <= max;
  }

  // Range (n-m)
  if (part.includes('-')) {
    // Handle ranges with step (n-m/s)
    if (part.includes('/')) {
      const [range, step] = part.split('/');
      const [start, end] = range.split('-').map(p => parseInt(p, 10));
      const stepValue = parseInt(step, 10);

      return (
        !isNaN(start) && !isNaN(end) && !isNaN(stepValue) &&
        start >= min && end <= max && start <= end &&
        stepValue > 0 && stepValue <= max
      );
    }

    const [start, end] = part.split('-').map(p => parseInt(p, 10));
    return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end;
  }

  // List (n,m,o)
  if (part.includes(',')) {
    const values = part.split(',');

    // Check each value in the list
    for (const value of values) {
      // Recursively check each value
      if (!isValidCronPart(value, min, max)) {
        return false;
      }
    }

    return true;
  }

  // Single value
  const value = parseInt(part, 10);
  return !isNaN(value) && value >= min && value <= max;
}
