/**
 * JSX Type Fixes
 *
 * This file provides fixes for React JSX element type issues.
 */

import * as React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Override the default React element definitions with more permissive ones
      input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> & {
        type?: string;
        min?: string | number;
        max?: string | number;
        step?: string | number;
      };

      select: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement> & {
        children?: React.ReactNode;
      };

      option: React.DetailedHTMLProps<React.OptionHTMLAttributes<HTMLOptionElement>, HTMLOptionElement> & {
        children?: React.ReactNode;
      };

      // Add other elements as needed
      div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
        children?: React.ReactNode;
      };

      span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement> & {
        children?: React.ReactNode;
      };

      label: React.DetailedHTMLProps<React.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement> & {
        children?: React.ReactNode;
      };

      button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & {
        children?: React.ReactNode;
      };

      li: React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement> & {
        children?: React.ReactNode;
      };
    }
  }
}

// Make sure this file is treated as a module
export {};
