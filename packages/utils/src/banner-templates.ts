export interface BannerTextTemplate {
  id: string;
  label: string;
  title: string;
  description: string;
  acceptButton: string;
  rejectButton: string;
  preferencesButton: string;
  saveButton: string;
  legalNotice: string;
  footerContent: string;
}

export const BANNER_TEXT_TEMPLATES: BannerTextTemplate[] = [
  {
    id: 'default',
    label: 'Standard privacy notice',
    title: 'We value your privacy',
    description:
      'We use cookies to improve your experience, analyze site traffic, and personalize content. You can manage your preferences at any time.',
    acceptButton: 'Accept all',
    rejectButton: 'Reject all',
    preferencesButton: 'Manage preferences',
    saveButton: 'Save preferences',
    legalNotice: '',
    footerContent: '',
  },
  {
    id: 'gdpr',
    label: 'GDPR-focused',
    title: 'Your privacy choices',
    description:
      'We use cookies and similar technologies. Strictly necessary cookies are always active. You can accept all, reject non-essential cookies, or customize your choices.',
    acceptButton: 'Accept all',
    rejectButton: 'Reject non-essential',
    preferencesButton: 'Customize',
    saveButton: 'Save my choices',
    legalNotice: 'You can withdraw consent at any time from your browser or our privacy settings.',
    footerContent: '',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    title: 'Cookie notice',
    description: 'This site uses cookies. Choose how we use them.',
    acceptButton: 'Accept',
    rejectButton: 'Decline',
    preferencesButton: 'Settings',
    saveButton: 'Save',
    legalNotice: '',
    footerContent: '',
  },
  {
    id: 'us_state_laws',
    label: 'US state privacy',
    title: 'Your privacy choices',
    description:
      'We and our partners use cookies and similar technologies for analytics, advertising, and site functionality. California residents can opt out of the sale or sharing of personal information.',
    acceptButton: 'Accept',
    rejectButton: 'Do Not Sell or Share',
    preferencesButton: 'Privacy choices',
    saveButton: 'Save preferences',
    legalNotice:
      'You can change your mind anytime. Look for “Do Not Sell or Share My Personal Information”.',
    footerContent: '',
  },
  {
    id: 'gdpr_and_us',
    label: 'GDPR & US state laws',
    title: 'We value your privacy',
    description:
      'Depending on your location, we ask for consent or offer opt-out controls for cookies and similar technologies used for analytics and advertising.',
    acceptButton: 'Accept all',
    rejectButton: 'Reject / Do Not Sell',
    preferencesButton: 'Manage preferences',
    saveButton: 'Save preferences',
    legalNotice: 'You can withdraw consent or update your choices at any time.',
    footerContent: '',
  },
];
