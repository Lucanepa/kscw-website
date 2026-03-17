import de from '../i18n/de.json';
import en from '../i18n/en.json';

const translations: Record<string, Record<string, string>> = { de, en };
export type Locale = 'de' | 'en';

export function t(locale: Locale, key: string): string {
  return translations[locale]?.[key] ?? translations.de[key] ?? key;
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, locale] = url.pathname.split('/');
  return locale === 'en' ? 'en' : 'de';
}

/** Get the path in the other locale */
export function getAlternateUrl(url: URL): string {
  const currentLocale = getLocaleFromUrl(url);
  const otherLocale = currentLocale === 'de' ? 'en' : 'de';
  return url.pathname.replace(`/${currentLocale}/`, `/${otherLocale}/`);
}
