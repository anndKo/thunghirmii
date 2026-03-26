import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import vi from '@/i18n/vi';
import en from '@/i18n/en';
import type { TranslationKeys } from '@/i18n/vi';

type Language = 'vi' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
  isFirstVisit: boolean;
  markVisited: () => void;
}

const translations: Record<Language, Record<string, string>> = { vi, en };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('app_language') as Language) || 'vi';
  });

  const [isFirstVisit, setIsFirstVisit] = useState(() => {
    return !localStorage.getItem('app_language_chosen');
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
    localStorage.setItem('app_language_chosen', 'true');
    setIsFirstVisit(false);
  };

  const markVisited = () => {
    localStorage.setItem('app_language_chosen', 'true');
    setIsFirstVisit(false);
  };

  const t = (key: TranslationKeys, params?: Record<string, string | number>): string => {
    let text = translations[language]?.[key] || translations['vi']?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isFirstVisit, markVisited }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
