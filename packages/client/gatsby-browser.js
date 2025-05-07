/**
 * Gatsby Browser APIs
 *
 * This file implements Gatsby browser APIs that customize the browser
 * rendering of the site, wrapping the entire app with our providers.
 */

import React from 'react';
import HeroUIProvider from './src/providers/HeroUIProvider';
import UserProvider from './src/providers/UserProvider';
import FavoritesProvider from './src/providers/FavoritesProvider';
import SearchFilterProvider from './src/providers/SearchFilterProvider';
import SharingProvider from './src/providers/SharingProvider';
import OfflineProvider from './src/providers/OfflineProvider';
import { LanguageProvider } from './src/hooks/useLanguage';
import { initializeServices } from './src/services';

/**
 * Initialize services before the browser renders
 */
export const onClientEntry = () => {
  // Initialize all unified services
  initializeServices();
};

/**
 * Wrap the app with all providers
 *
 * Providers are nested in a specific order to ensure proper dependency management:
 * 1. UserProvider - For user authentication and profile data
 * 2. OfflineProvider - For network status and offline capabilities
 * 3. FavoritesProvider - For bookmarking materials
 * 4. SearchFilterProvider - For advanced filtering and search
 * 5. SharingProvider - For social sharing functionality
 * 6. HeroUIProvider - For UI theming and components
 */
export const wrapRootElement = ({ element }) => {
  return (
    <UserProvider>
      <OfflineProvider>
        <FavoritesProvider>
          <SearchFilterProvider>
            <SharingProvider>
              <LanguageProvider>
                <HeroUIProvider>
                  {element}
                </HeroUIProvider>
              </LanguageProvider>
            </SharingProvider>
          </SearchFilterProvider>
        </FavoritesProvider>
      </OfflineProvider>
    </UserProvider>
  );
};