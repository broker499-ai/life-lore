import { ru, type TranslationKey } from '@/i18n/ru';

export function t(key: TranslationKey): string {
  return ru[key];
}
