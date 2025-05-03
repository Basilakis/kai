import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LanguageCode } from '@kai/shared/src/types/multilingual-dictionaries';

interface LanguageContextType {
  language: string;
  setLanguage: (language: string) => void;
  availableLanguages: LanguageCode[];
  loading: boolean;
  error: string | null;
  translatePropertyName: (propertyName: string) => string;
  translatePropertyValue: (propertyName: string, propertyValue: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<string>('en');
  const [availableLanguages, setAvailableLanguages] = useState<LanguageCode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<{
    propertyNames: Record<string, string>;
    propertyValues: Record<string, Record<string, string>>;
  }>({
    propertyNames: {},
    propertyValues: {}
  });

  // Load available languages
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/multilingual/languages');
        
        if (!response.ok) {
          throw new Error('Failed to fetch languages');
        }
        
        const data = await response.json();
        
        if (data.success && data.languages) {
          setAvailableLanguages(data.languages);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        // Set default languages if fetch fails
        setAvailableLanguages([
          { code: 'en', name: 'English', nativeName: 'English', isActive: true, createdAt: new Date(), updatedAt: new Date() }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();
  }, []);

  // Load translations when language changes
  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch property name translations
        const propertyNamesResponse = await fetch(`/api/multilingual/property-names?languageCode=${language}`);
        
        if (!propertyNamesResponse.ok) {
          throw new Error('Failed to fetch property name translations');
        }
        
        const propertyNamesData = await propertyNamesResponse.json();
        
        // Process property name translations
        const propertyNameTranslations: Record<string, string> = {};
        
        if (propertyNamesData.success && propertyNamesData.translations) {
          for (const translation of propertyNamesData.translations) {
            propertyNameTranslations[translation.propertyName] = translation.translation;
          }
        }

        // Fetch property value translations
        const propertyValuesResponse = await fetch(`/api/multilingual/property-values?languageCode=${language}`);
        
        if (!propertyValuesResponse.ok) {
          throw new Error('Failed to fetch property value translations');
        }
        
        const propertyValuesData = await propertyValuesResponse.json();
        
        // Process property value translations
        const propertyValueTranslations: Record<string, Record<string, string>> = {};
        
        if (propertyValuesData.success && propertyValuesData.translations) {
          for (const translation of propertyValuesData.translations) {
            if (!propertyValueTranslations[translation.propertyName]) {
              propertyValueTranslations[translation.propertyName] = {};
            }
            
            propertyValueTranslations[translation.propertyName][translation.propertyValue] = translation.translation;
          }
        }

        // Update translations
        setTranslations({
          propertyNames: propertyNameTranslations,
          propertyValues: propertyValueTranslations
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Only fetch translations if language is not English
    if (language !== 'en') {
      fetchTranslations();
    } else {
      // Reset translations for English
      setTranslations({
        propertyNames: {},
        propertyValues: {}
      });
      setLoading(false);
    }
  }, [language]);

  // Set language with localStorage persistence
  const setLanguage = (newLanguage: string) => {
    localStorage.setItem('preferredLanguage', newLanguage);
    setLanguageState(newLanguage);
  };

  // Initialize language from localStorage
  useEffect(() => {
    const storedLanguage = localStorage.getItem('preferredLanguage');
    if (storedLanguage) {
      setLanguageState(storedLanguage);
    } else {
      // Try to detect browser language
      const browserLanguage = navigator.language.split('-')[0];
      if (browserLanguage && browserLanguage !== 'en') {
        setLanguageState(browserLanguage);
      }
    }
  }, []);

  // Translate a property name
  const translatePropertyName = (propertyName: string): string => {
    if (language === 'en' || !translations.propertyNames[propertyName]) {
      return propertyName;
    }
    
    return translations.propertyNames[propertyName];
  };

  // Translate a property value
  const translatePropertyValue = (propertyName: string, propertyValue: string): string => {
    if (
      language === 'en' || 
      !translations.propertyValues[propertyName] || 
      !translations.propertyValues[propertyName][propertyValue]
    ) {
      return propertyValue;
    }
    
    return translations.propertyValues[propertyName][propertyValue];
  };

  const value = {
    language,
    setLanguage,
    availableLanguages,
    loading,
    error,
    translatePropertyName,
    translatePropertyValue
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageProvider;
