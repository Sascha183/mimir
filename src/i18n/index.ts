import en from './en.json';
import de from './de.json';
import type { CollectionEntry } from 'astro:content';

export const LOCALES = ['en', 'de'] as const;
export type Locale = typeof LOCALES[number];
export const DEFAULT_LOCALE: Locale = 'en';

const dictionaries: Record<Locale, unknown> = { en, de };

/**
 * Look up a UI string by dot-path key. Falls back to the English value if the
 * requested locale is missing the key, then to the key itself if neither is
 * found. Optional `vars` substitute `{name}` placeholders in the resolved string.
 */
export function t(
  key: string,
  locale: Locale,
  vars?: Record<string, string | number>,
): string {
  const value = lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key) ?? key;
  if (typeof value !== 'string') return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

function lookup(dict: unknown, key: string): unknown {
  let cur: unknown = dict;
  for (const segment of key.split('.')) {
    if (cur && typeof cur === 'object' && segment in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Derive locale from the current request URL. Anything under `/de/` is German; everything else is English. */
export function getLocaleFromUrl(url: URL): Locale {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'de') return 'de';
  return 'en';
}

/**
 * Lessons live in `src/content/lessons/<locale>/<slug>.mdx`, so Astro reports
 * each entry's slug as `<locale>/<slug>`. UI code wants the bare slug.
 */
export function stripLocaleSlug(entrySlug: string): string {
  for (const loc of LOCALES) {
    const prefix = `${loc}/`;
    if (entrySlug.startsWith(prefix)) return entrySlug.slice(prefix.length);
  }
  return entrySlug;
}

/** The locale prefix used in URLs. English is the default and gets no prefix. */
function localePrefix(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

export function localizedRootHref(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '/' : `/${locale}/`;
}

export function localizedAboutHref(locale: Locale): string {
  return `${localePrefix(locale)}/about`;
}

export function localizedTrackHref(track: string, locale: Locale): string {
  return `${localePrefix(locale)}/tracks/${track}`;
}

export function localizedLessonHref(rawSlug: string, locale: Locale): string {
  return `${localePrefix(locale)}/lessons/${rawSlug}`;
}

/**
 * Switch to the equivalent path in another locale. Strips/adds the `/de` prefix
 * but otherwise preserves the path. Used by the language switcher.
 */
export function switchLocalePath(currentPath: string, target: Locale): string {
  const stripped = currentPath.replace(/^\/de(?=\/|$)/, '') || '/';
  if (target === DEFAULT_LOCALE) return stripped;
  if (stripped === '/') return '/de/';
  return `/de${stripped}`;
}

/**
 * Filter the lessons collection to a single locale, returning entries whose
 * slug starts with `<locale>/`. Use everywhere instead of `getCollection('lessons')`.
 */
export function filterLessonsByLocale(
  entries: CollectionEntry<'lessons'>[],
  locale: Locale,
): CollectionEntry<'lessons'>[] {
  const prefix = `${locale}/`;
  return entries.filter((e) => e.slug.startsWith(prefix));
}
