export interface CategoryScriptMappings {
  scripts?: string[];
  iframes?: string[];
  pixels?: string[];
  cookies?: string[];
}

export interface BlockingRule {
  category: string;
  type: 'script' | 'iframe' | 'pixel' | 'fetch' | 'xhr' | 'beacon' | 'image';
  pattern: string;
  vendor?: string;
  action?: 'block' | 'allow' | 'log';
  regions?: string[];
}

export interface VendorPattern {
  vendor: string;
  category: string;
  patterns: string[];
  resourceTypes?: BlockingRule['type'][];
}

export interface EmbedPlaceholderConfig {
  title?: string;
  description?: string;
  allowLabel?: string;
}

export const DEFAULT_EMBED_PLACEHOLDER: EmbedPlaceholderConfig = {
  title: 'Content blocked until consent',
  description: 'This embedded content requires your permission before it can load.',
  allowLabel: 'Allow this content',
};

export const KNOWN_TRACKER_PATTERNS: Array<{ category: string; type: BlockingRule['type']; pattern: string }> = [
  { category: 'analytics', type: 'script', pattern: 'googletagmanager.com' },
  { category: 'analytics', type: 'script', pattern: 'google-analytics.com' },
  { category: 'analytics', type: 'script', pattern: 'clarity.ms' },
  { category: 'analytics', type: 'script', pattern: 'hotjar.com' },
  { category: 'marketing', type: 'script', pattern: 'connect.facebook.net' },
  { category: 'marketing', type: 'script', pattern: 'facebook.com/tr' },
  { category: 'marketing', type: 'script', pattern: 'snap.licdn.com' },
  { category: 'marketing', type: 'pixel', pattern: 'facebook.com/tr' },
  { category: 'marketing', type: 'pixel', pattern: 'doubleclick.net' },
  { category: 'marketing', type: 'fetch', pattern: 'doubleclick.net' },
  { category: 'marketing', type: 'xhr', pattern: 'doubleclick.net' },
  { category: 'analytics', type: 'fetch', pattern: 'google-analytics.com' },
  { category: 'analytics', type: 'beacon', pattern: 'google-analytics.com' },
  { category: 'social_media', type: 'script', pattern: 'platform.twitter.com' },
  { category: 'social_media', type: 'iframe', pattern: 'youtube.com/embed' },
  { category: 'social_media', type: 'iframe', pattern: 'youtube-nocookie.com/embed' },
  { category: 'social_media', type: 'iframe', pattern: 'player.vimeo.com' },
  { category: 'functional', type: 'script', pattern: 'client.crisp.chat' },
];
