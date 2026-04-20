// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://kscw-website.pages.dev',
  i18n: {
    defaultLocale: 'de',
    locales: ['de', 'en'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  redirects: {
    '/de/volleyball/mixed-turnier': '/de/volleyball',
    '/en/volleyball/mixed-tournament': '/en/volleyball',
    '/en/volleyball/mixed-turnier': '/en/volleyball',
  },
});
