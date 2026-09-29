import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

/**
 * NFR-UX-06: every user-facing string lives in a catalogue. English only in the MVP; Hindi
 * (Later) adds a catalogue and picks it from expo-localization's device locale.
 */
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
