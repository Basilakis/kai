/**
 * Component Type Declarations
 * 
 * This file provides type definitions for React components,
 * styled components, and event handling in the client package.
 */

import React from 'react';
import { ReactNode, MouseEvent, FocusEvent, ChangeEvent, KeyboardEvent } from './react-declarations';

/**
 * Styled Component Props
 */
export interface StyledComponentProps {
  // Basic UI props
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  success?: boolean;
  warning?: boolean;
  
  // Size variants
  size?: 'small' | 'medium' | 'large';
  small?: boolean;
  large?: boolean;
  
  // Style variants
  primary?: boolean;
  secondary?: boolean;
  tertiary?: boolean;
  outline?: boolean;
  transparent?: boolean;
  
  // Layout props
  fullWidth?: boolean;
  centered?: boolean;
  hidden?: boolean;
  
  // Misc props
  onClick?: (e: MouseEvent<any>) => void;
  onFocus?: (e: FocusEvent<any>) => void;
  onBlur?: (e: FocusEvent<any>) => void;
  onMouseEnter?: (e: MouseEvent<any>) => void;
  onMouseLeave?: (e: MouseEvent<any>) => void;
}

/**
 * Button Props
 */
export interface ButtonProps extends StyledComponentProps {
  type?: 'button' | 'submit' | 'reset';
  icon?: ReactNode;
  label?: string;
  children?: ReactNode;
}

/**
 * Card Props
 */
export interface CardProps extends StyledComponentProps {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}

/**
 * Input Props
 */
export interface InputProps extends StyledComponentProps {
  name?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  maxLength?: number;
  required?: boolean;
  pattern?: string;
}

/**
 * Dropdown Props
 */
export interface DropzoneProps extends StyledComponentProps {
  active: boolean;
}

/**
 * Room Item Props
 */
export interface RoomItemProps extends StyledComponentProps {
  active: boolean;
}

/**
 * Tab Props
 */
export interface TabProps extends StyledComponentProps {
  active: boolean;
}

/**
 * Container Props
 */
export interface ContainerProps extends StyledComponentProps {
  children?: ReactNode;
}

/**
 * Helper type for making properties non-nullable
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Ensure that a value is defined, throwing an error otherwise
 */
export function ensureDefined<T>(value: T | undefined | null, errorMessage: string = 'Value is undefined'): T {
  if (value === undefined || value === null) {
    throw new Error(errorMessage);
  }
  return value;
}

/**
 * Safely access potentially undefined properties with a default value
 */
export function getValueSafely<T, D>(obj: T | undefined | null, getter: (obj: NonNullable<T>) => any, defaultValue: D): D {
  if (obj === undefined || obj === null) {
    return defaultValue;
  }
  try {
    const value = getter(obj as NonNullable<T>);
    return value === undefined || value === null ? defaultValue : value;
  } catch (e) {
    return defaultValue;
  }
}