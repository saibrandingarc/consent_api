import { suggestBannerTranslations, type BannerSourceForTranslation } from '@cmp/utils';

export class TranslationService {
  suggest(targetLanguage: string, source: BannerSourceForTranslation) {
    const suggestions = suggestBannerTranslations(targetLanguage, source);
    return {
      targetLanguage,
      suggestions,
      disclaimer:
        'Suggestions use built-in phrase maps. Review translations before publishing — they may not match your exact copy.',
    };
  }
}
