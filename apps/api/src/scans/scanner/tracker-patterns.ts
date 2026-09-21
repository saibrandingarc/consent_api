export interface TrackerPattern {
  name: string;
  type: 'script' | 'iframe' | 'pixel' | 'network';
  pattern: string;
  category: string;
}

export const TRACKER_PATTERNS: TrackerPattern[] = [
  { name: 'Google Tag Manager', type: 'script', pattern: 'googletagmanager.com', category: 'analytics' },
  { name: 'Google Analytics', type: 'script', pattern: 'google-analytics.com', category: 'analytics' },
  { name: 'Google Analytics (gtag)', type: 'script', pattern: '/gtag/js', category: 'analytics' },
  { name: 'Microsoft Clarity', type: 'script', pattern: 'clarity.ms', category: 'analytics' },
  { name: 'Hotjar', type: 'script', pattern: 'hotjar.com', category: 'analytics' },
  { name: 'CMP SDK', type: 'script', pattern: '/public/cmp/sdk.js', category: 'functional' },
  { name: 'Meta Pixel', type: 'script', pattern: 'connect.facebook.net', category: 'marketing' },
  { name: 'Meta Pixel', type: 'pixel', pattern: 'facebook.com/tr', category: 'marketing' },
  { name: 'LinkedIn Insight', type: 'script', pattern: 'snap.licdn.com', category: 'marketing' },
  { name: 'DoubleClick', type: 'network', pattern: 'doubleclick.net', category: 'marketing' },
  { name: 'Twitter Widgets', type: 'script', pattern: 'platform.twitter.com', category: 'social_media' },
  { name: 'YouTube Embed', type: 'iframe', pattern: 'youtube.com/embed', category: 'marketing' },
  { name: 'YouTube (nocookie)', type: 'iframe', pattern: 'youtube-nocookie.com', category: 'marketing' },
  { name: 'YouTube (nocookie)', type: 'script', pattern: 'youtube-nocookie.com', category: 'marketing' },
  { name: 'Vimeo Player', type: 'iframe', pattern: 'player.vimeo.com', category: 'social_media' },
  { name: 'Crisp Chat', type: 'script', pattern: 'client.crisp.chat', category: 'functional' },
  { name: 'Intercom', type: 'script', pattern: 'widget.intercom.io', category: 'functional' },
  { name: 'HubSpot', type: 'script', pattern: 'js.hs-scripts.com', category: 'marketing' },
];

export function matchTracker(url: string): TrackerPattern | null {
  const target = url.toLowerCase();
  for (const tracker of TRACKER_PATTERNS) {
    if (target.includes(tracker.pattern.toLowerCase())) return tracker;
  }
  return null;
}

export function isTrackingPixelUrl(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.includes('/tr?') ||
    lower.includes('/track') ||
    lower.includes('/pixel') ||
    lower.includes('doubleclick.net') ||
    lower.includes('facebook.com/tr')
  );
}
