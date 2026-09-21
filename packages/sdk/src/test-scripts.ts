const TEST_SCRIPT_IDS = {
  googleAnalytics: 'G-TESTCMP001',
  clarity: 'testcmp001',
  hotjar: '0000000',
  metaPixel: 'TESTCMP001',
  linkedInPartner: '0000000',
  crispWebsite: '00000000-0000-0000-0000-000000000000',
} as const;

/** Maps each optional consent category to the primary test script element id. */
export const CMP_TEST_SCRIPT_MARKERS = {
  preferences: 'cmp-test-preferences',
  functional: 'cmp-test-crisp',
  analytics: 'cmp-test-gtag',
  performance: 'cmp-test-web-vitals',
  marketing: 'cmp-test-meta-pixel',
  social_media: 'cmp-test-twitter',
  unclassified: 'cmp-test-unclassified',
} as const;

export type CmpTestScriptCategory = keyof typeof CMP_TEST_SCRIPT_MARKERS;

export function isTestScriptsEnabled(script: HTMLScriptElement | null) {
  return script?.getAttribute('data-test-scripts') === 'true';
}

function hasConsent(category: string) {
  const cmp = window.__CMP__;
  if (!cmp) return false;
  if (typeof cmp.hasConsent === 'function') return cmp.hasConsent(category);
  const consent = typeof cmp.getConsent === 'function' ? cmp.getConsent() : cmp.consent;
  return Boolean(consent?.[category]);
}

function appendScript(id: string, init: (script: HTMLScriptElement) => void) {
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  init(script);
  document.head.appendChild(script);
}

function loadPreferencesScripts() {
  appendScript('cmp-test-preferences', (script) => {
    script.src = 'https://cdn.jsdelivr.net/npm/js-cookie@3/dist/js.cookie.min.js';
  });
}

function loadAnalyticsScripts() {
  appendScript('cmp-test-gtag', (script) => {
    script.src = `https://www.googletagmanager.com/gtag/js?id=${TEST_SCRIPT_IDS.googleAnalytics}`;
  });
  appendScript('cmp-test-ga-init', (script) => {
    script.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${TEST_SCRIPT_IDS.googleAnalytics}');`;
  });
  appendScript('cmp-test-clarity', (script) => {
    script.textContent = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${TEST_SCRIPT_IDS.clarity}");`;
  });
  appendScript('cmp-test-hotjar', (script) => {
    script.textContent = `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${TEST_SCRIPT_IDS.hotjar},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`;
  });
}

function loadPerformanceScripts() {
  appendScript('cmp-test-web-vitals', (script) => {
    script.src =
      'https://cdn.jsdelivr.net/npm/web-vitals@3/dist/web-vitals.attribution.iife.js';
  });
}

function loadMarketingScripts() {
  appendScript('cmp-test-meta-pixel', (script) => {
    script.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${TEST_SCRIPT_IDS.metaPixel}');fbq('track','PageView');`;
  });
  appendScript('cmp-test-linkedin-init', (script) => {
    script.textContent = `_linkedin_partner_id="${TEST_SCRIPT_IDS.linkedInPartner}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);`;
  });
  appendScript('cmp-test-linkedin', (script) => {
    script.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
  });
}

function loadFunctionalScripts() {
  appendScript('cmp-test-crisp', (script) => {
    script.textContent = `window.$crisp=[];window.CRISP_WEBSITE_ID="${TEST_SCRIPT_IDS.crispWebsite}";(function(){d=document;s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`;
  });
}

function loadSocialScripts() {
  appendScript('cmp-test-twitter', (script) => {
    script.src = 'https://platform.twitter.com/widgets.js';
    script.charset = 'utf-8';
  });
}

function loadUnclassifiedScripts() {
  appendScript('cmp-test-unclassified', (script) => {
    script.textContent = 'window.__cmpTestUnclassifiedLoaded=true;';
  });
}

export function syncTestScripts() {
  if (hasConsent('preferences')) loadPreferencesScripts();
  if (hasConsent('functional')) loadFunctionalScripts();
  if (hasConsent('analytics')) loadAnalyticsScripts();
  if (hasConsent('performance')) loadPerformanceScripts();
  if (hasConsent('marketing')) loadMarketingScripts();
  if (hasConsent('social_media')) loadSocialScripts();
  if (hasConsent('unclassified')) loadUnclassifiedScripts();
}

export function mountTestScripts(
  cmpScript: HTMLScriptElement | null,
  cmpSdk: {
    onConsentReady: (listener: () => void) => void;
    onConsentChanged: (listener: () => void) => void;
  },
) {
  if (!isTestScriptsEnabled(cmpScript)) return;
  document.addEventListener('cmp:consent-update', syncTestScripts);
  cmpSdk.onConsentReady(() => syncTestScripts());
  cmpSdk.onConsentChanged(() => syncTestScripts());
}
