import { describe, expect, it } from 'vitest';
import { applyBannerTranslation, isRtlLanguage, resolveLanguagePriority } from './language';

describe('sdk language', () => {
  it('resolves language from URL param', () => {
    expect(
      resolveLanguagePriority({
        urlParam: 'de',
        browserLanguage: 'fr',
        supportedLanguages: ['en', 'de'],
        defaultLanguage: 'en',
      }),
    ).toBe('de');
  });

  it('applies banner translation', () => {
    const localized = applyBannerTranslation(
      {
        title: 'English',
        description: 'Desc',
        acceptButton: 'Accept',
        rejectButton: 'Reject',
        preferencesButton: 'Prefs',
        translations: { de: { title: 'Deutsch' } },
      },
      'de',
    );
    expect(localized.title).toBe('Deutsch');
    expect('translations' in localized).toBe(false);
  });

  it('detects rtl', () => {
    expect(isRtlLanguage('ar')).toBe(true);
    expect(isRtlLanguage('en')).toBe(false);
  });
});
