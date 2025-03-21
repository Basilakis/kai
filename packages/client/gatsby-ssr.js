/**
 * Gatsby SSR APIs
 * 
 * This file implements Gatsby server-side rendering APIs to ensure
 * consistent rendering between client and server, wrapping the app with HeroUIProvider.
 */

import React from 'react';
import HeroUIProvider from './src/providers/HeroUIProvider';

// Wrap the app with HeroUI Provider for SSR
export const wrapRootElement = ({ element }) => {
  return <HeroUIProvider>{element}</HeroUIProvider>;
};