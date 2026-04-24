import { formatDistanceToNowStrict } from 'date-fns';
import { de as deLocale, enUS as enLocale } from 'date-fns/locale';

// ---------------------------------------------------------------------------
// Relative-time formatter — Phase W (export history + re-run tooltips)
// ---------------------------------------------------------------------------
// Wraps date-fns `formatDistanceToNowStrict` with a locale pickup keyed off
// i18n. Returns strings like "3 days ago" / "vor 3 Tagen". Stringifying here
// keeps the caller (components) free of date-fns imports.
// ---------------------------------------------------------------------------

const pickLocale = (lang: string) => {
  if (lang.startsWith('de')) return deLocale;
  return enLocale;
};

export const formatRelativeTime = (
  iso: string,
  lang: string = 'en',
): string => {
  try {
    return formatDistanceToNowStrict(new Date(iso), {
      addSuffix: true,
      locale: pickLocale(lang),
    });
  } catch {
    return iso;
  }
};
