/** Built-in phrase map for automatic translation suggestions (MVP — not machine translation). */
export const LOCALIZED_BANNER_DEFAULTS: Record<
  string,
  {
    title: string;
    description: string;
    acceptButton: string;
    rejectButton: string;
    preferencesButton: string;
    saveButton: string;
    closeButton: string;
    legalNotice: string;
    footerContent: string;
    privacyTriggerLabel: string;
  }
> = {
  en: {
    title: 'We value your privacy',
    description:
      'We use cookies to improve your experience, analyze site traffic, and personalize content. You can manage your preferences at any time.',
    acceptButton: 'Accept all',
    rejectButton: 'Reject all',
    preferencesButton: 'Manage preferences',
    saveButton: 'Save preferences',
    closeButton: 'Close',
    legalNotice: '',
    footerContent: '',
    privacyTriggerLabel: 'Privacy settings',
  },
  de: {
    title: 'Wir respektieren Ihre Privatsphäre',
    description:
      'Wir verwenden Cookies, um Ihre Erfahrung zu verbessern, den Websiteverkehr zu analysieren und Inhalte zu personalisieren. Sie können Ihre Einstellungen jederzeit verwalten.',
    acceptButton: 'Alle akzeptieren',
    rejectButton: 'Alle ablehnen',
    preferencesButton: 'Einstellungen verwalten',
    saveButton: 'Einstellungen speichern',
    closeButton: 'Schließen',
    legalNotice:
      'Sie können Ihre Einwilligung jederzeit in Ihrem Browser oder in unseren Datenschutzeinstellungen widerrufen.',
    footerContent: '',
    privacyTriggerLabel: 'Datenschutzeinstellungen',
  },
  fr: {
    title: 'Nous respectons votre vie privée',
    description:
      'Nous utilisons des cookies pour améliorer votre expérience, analyser le trafic et personnaliser le contenu. Vous pouvez gérer vos préférences à tout moment.',
    acceptButton: 'Tout accepter',
    rejectButton: 'Tout refuser',
    preferencesButton: 'Gérer les préférences',
    saveButton: 'Enregistrer les préférences',
    closeButton: 'Fermer',
    legalNotice:
      'Vous pouvez retirer votre consentement à tout moment depuis votre navigateur ou nos paramètres de confidentialité.',
    footerContent: '',
    privacyTriggerLabel: 'Paramètres de confidentialité',
  },
  es: {
    title: 'Valoramos su privacidad',
    description:
      'Usamos cookies para mejorar su experiencia, analizar el tráfico del sitio y personalizar el contenido. Puede gestionar sus preferencias en cualquier momento.',
    acceptButton: 'Aceptar todo',
    rejectButton: 'Rechazar todo',
    preferencesButton: 'Gestionar preferencias',
    saveButton: 'Guardar preferencias',
    closeButton: 'Cerrar',
    legalNotice:
      'Puede retirar su consentimiento en cualquier momento desde su navegador o nuestra configuración de privacidad.',
    footerContent: '',
    privacyTriggerLabel: 'Configuración de privacidad',
  },
  ar: {
    title: 'نحن نحترم خصوصيتك',
    description:
      'نستخدم ملفات تعريف الارتباط لتحسين تجربتك وتحليل حركة المرور وتخصيص المحتوى. يمكنك إدارة تفضيلاتك في أي وقت.',
    acceptButton: 'قبول الكل',
    rejectButton: 'رفض الكل',
    preferencesButton: 'إدارة التفضيلات',
    saveButton: 'حفظ التفضيلات',
    closeButton: 'إغلاق',
    legalNotice: 'يمكنك سحب الموافقة في أي وقت من متصفحك أو من إعدادات الخصوصية لدينا.',
    footerContent: '',
    privacyTriggerLabel: 'إعدادات الخصوصية',
  },
  he: {
    title: 'אנו מכבדים את פרטיותך',
    description:
      'אנו משתמשים בקובצי Cookie כדי לשפר את החוויה, לנתח תנועה באתר ולהתאים תוכן. תוכל לנהל את ההעדפות בכל עת.',
    acceptButton: 'קבל הכל',
    rejectButton: 'דחה הכל',
    preferencesButton: 'נהל העדפות',
    saveButton: 'שמור העדפות',
    closeButton: 'סגור',
    legalNotice: 'תוכל לבטל את ההסכמה בכל עת מהדפדפן או מהגדרות הפרטיות שלנו.',
    footerContent: '',
    privacyTriggerLabel: 'הגדרות פרטיות',
  },
  pt: {
    title: 'Valorizamos a sua privacidade',
    description:
      'Usamos cookies para melhorar a sua experiência, analisar o tráfego do site e personalizar conteúdo. Você pode gerenciar suas preferências a qualquer momento.',
    acceptButton: 'Aceitar tudo',
    rejectButton: 'Rejeitar tudo',
    preferencesButton: 'Gerenciar preferências',
    saveButton: 'Salvar preferências',
    closeButton: 'Fechar',
    legalNotice:
      'Você pode retirar o consentimento a qualquer momento no navegador ou nas configurações de privacidade.',
    footerContent: '',
    privacyTriggerLabel: 'Configurações de privacidade',
  },
  it: {
    title: 'Rispettiamo la tua privacy',
    description:
      'Utilizziamo i cookie per migliorare la tua esperienza, analizzare il traffico del sito e personalizzare i contenuti. Puoi gestire le preferenze in qualsiasi momento.',
    acceptButton: 'Accetta tutto',
    rejectButton: 'Rifiuta tutto',
    preferencesButton: 'Gestisci preferenze',
    saveButton: 'Salva preferenze',
    closeButton: 'Chiudi',
    legalNotice:
      'Puoi revocare il consenso in qualsiasi momento dal browser o dalle impostazioni privacy.',
    footerContent: '',
    privacyTriggerLabel: 'Impostazioni privacy',
  },
  ja: {
    title: 'プライバシーを尊重します',
    description:
      '当サイトではCookieを使用して体験の向上、サイトトラフィックの分析、コンテンツのパーソナライズを行います。設定はいつでも変更できます。',
    acceptButton: 'すべて同意',
    rejectButton: 'すべて拒否',
    preferencesButton: '設定を管理',
    saveButton: '設定を保存',
    closeButton: '閉じる',
    legalNotice: 'ブラウザまたはプライバシー設定からいつでも同意を撤回できます。',
    footerContent: '',
    privacyTriggerLabel: 'プライバシー設定',
  },
};

/** Per-phrase fallback when source text matches known English strings. */
export const PHRASE_TRANSLATIONS: Record<string, Record<string, string>> = {
  'Accept all': { de: 'Alle akzeptieren', fr: 'Tout accepter', es: 'Aceptar todo', ar: 'قبول الكل' },
  'Reject all': { de: 'Alle ablehnen', fr: 'Tout refuser', es: 'Rechazar todo', ar: 'رفض الكل' },
  'Reject non-essential': {
    de: 'Nicht essenzielle ablehnen',
    fr: 'Refuser les non essentiels',
    es: 'Rechazar no esenciales',
    ar: 'رفض غير الضروري',
  },
  'Manage preferences': {
    de: 'Einstellungen verwalten',
    fr: 'Gérer les préférences',
    es: 'Gestionar preferencias',
    ar: 'إدارة التفضيلات',
  },
  'Save preferences': {
    de: 'Einstellungen speichern',
    fr: 'Enregistrer les préférences',
    es: 'Guardar preferencias',
    ar: 'حفظ التفضيلات',
  },
  Close: { de: 'Schließen', fr: 'Fermer', es: 'Cerrar', ar: 'إغلاق' },
  'Privacy settings': {
    de: 'Datenschutzeinstellungen',
    fr: 'Paramètres de confidentialité',
    es: 'Configuración de privacidad',
    ar: 'إعدادات الخصوصية',
  },
  'We value your privacy': {
    de: 'Wir respektieren Ihre Privatsphäre',
    fr: 'Nous respectons votre vie privée',
    es: 'Valoramos su privacidad',
    ar: 'نحن نحترم خصوصيتك',
  },
};
