import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language, TranslationKeys } from '../i18n/translations';

interface LanguageContextType {
  lang: Language;
  setLanguage: (l: Language) => void;
  t: (key: TranslationKeys, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // Initialize from localStorage or default to 'pt'
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('app_lang') as Language) || 'pt';
  });

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
  }, [lang]);

  // The translation function with simple interpolation logic
  const t = (key: TranslationKeys, variables?: Record<string, string | number>) => {
    let text = translations[lang][key] || translations['en'][key];

    if (variables) {
      Object.entries(variables).forEach(([vKey, vVal]) => {
        text = text.replace(`{${vKey}}`, String(vVal));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLanguage: setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
};