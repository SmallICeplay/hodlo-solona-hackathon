import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import en from './locales/en.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhTW },
      'en':    { translation: en },
      'ja':    { translation: ja },
      'ko':    { translation: ko },
    },
    fallbackLng: 'en',
    supportedLngs: ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'],
    load: 'currentOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18n_lng',
    },
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added',
    },
  })

export default i18n
