import { describe, expect, it } from 'vitest';
import {
  applyBannerTranslation,
  isRtlLanguage,
  listMissingBannerTranslations,
  normalizeLanguageCode,
  resolveLanguagePriority,
  suggestBannerTranslations,
} from './language';

describe('normalizeLanguageCode', () => {
  it('normalizes locale codes', () => {
    expect(normalizeLanguageCode('en-US')).toBe('en');
    expect(normalizeLanguageCode('DE')).toBe('de');
  });
});

describe('resolveLanguagePriority', () => {
  it('prefers URL param over browser language', () => {
    expect(
      resolveLanguagePriority({
        urlParam: 'de',
        browserLanguage: 'fr',
        supportedLanguages: ['en', 'de', 'fr'],
        defaultLanguage: 'en',
      }),
    ).toBe('de');
  });

  it('falls back to default when unsupported', () => {
    expect(
      resolveLanguagePriority({
        urlParam: 'xx',
        browserLanguage: 'it',
        supportedLanguages: ['en', 'de'],
        defaultLanguage: 'en',
      }),
    ).toBe('en');
  });
});

describe('applyBannerTranslation', () => {
  it('merges translated fields and strips translations object', () => {
    const localized = applyBannerTranslation(
      {
        title: 'We value your privacy',
        description: 'English',
        acceptButton: 'Accept all',
        rejectButton: 'Reject all',
        preferencesButton: 'Manage',
        saveButton: 'Save',
        closeButton: 'Close',
        translations: {
          de: {
            title: 'German title',
            acceptButton: 'Alle akzeptieren',
          },
        },
      },
      'de',
      ['en', 'de'],
    );

    expect(localized.title).toBe('German title');
    expect(localized.acceptButton).toBe('Alle akzeptieren');
    expect(localized.description).toBe('English');
    expect('translations' in localized).toBe(false);
  });
});

describe('isRtlLanguage', () => {
  it('detects RTL languages', () => {
    expect(isRtlLanguage('ar')).toBe(true);
    expect(isRtlLanguage('en')).toBe(false);
  });
});

describe('listMissingBannerTranslations', () => {
  it('flags fields without translations', () => {
    expect(
      listMissingBannerTranslations(
        { title: 'Title', description: 'Desc', acceptButton: 'OK' },
        { title: 'Titel' },
      ),
    ).toEqual(['description', 'acceptButton']);
  });
});

describe('suggestBannerTranslations', () => {
  it('returns German defaults for standard English copy', () => {
    const suggestions = suggestBannerTranslations('de', {
      title: 'We value your privacy',
      description:
        'We use cookies to improve your experience, analyze site traffic, and personalize content. You can manage your preferences at any time.',
      acceptButton: 'Accept all',
      rejectButton: 'Reject all',
      preferencesButton: 'Manage preferences',
      saveButton: 'Save preferences',
      closeButton: 'Close',
      privacyTrigger: { label: 'Privacy settings' },
    });
    expect(suggestions.title).toContain('Privat');
    expect(suggestions.acceptButton).toBe('Alle akzeptieren');
  });
});
