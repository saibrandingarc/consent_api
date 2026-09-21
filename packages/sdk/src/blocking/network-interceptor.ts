import type { BlockingDecision } from './engine-rules';
import type { BlockingEventLog } from './event-log';
import { remediationForCategory } from './event-log';

type ResourceType = 'script' | 'iframe' | 'pixel' | 'fetch' | 'xhr' | 'beacon' | 'image';

export interface NetworkInterceptorOptions {
  evaluate: (url: string, type: ResourceType) => BlockingDecision | null;
  log: BlockingEventLog;
  onViolation?: (payload: Record<string, unknown>) => void;
}

export class NetworkInterceptor {
  private readonly originalFetch = window.fetch.bind(window);
  private readonly originalSendBeacon = navigator.sendBeacon?.bind(navigator);
  private restored = false;

  constructor(private readonly options: NetworkInterceptorOptions) {
    this.install();
  }

  destroy() {
    if (this.restored) return;
    window.fetch = this.originalFetch;
    if (this.originalSendBeacon) {
      navigator.sendBeacon = this.originalSendBeacon;
    }
    this.restored = true;
  }

  private install() {
    const self = this;

    window.fetch = function cmpFetch(input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const decision = self.options.evaluate(url, 'fetch');
      if (decision?.action === 'block') {
        self.record(decision, url, 'fetch');
        return Promise.resolve(new Response(null, { status: 204, statusText: 'CMP Blocked' }));
      }
      if (decision?.action === 'log') self.record(decision, url, 'fetch');
      return self.originalFetch(input, init);
    };

    const xhrOpen = XMLHttpRequest.prototype.open;
    const xhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      (this as XMLHttpRequest & { __cmpUrl?: string }).__cmpUrl = String(url);
      return xhrOpen.call(this, method, url, async ?? true, username, password);
    };
    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const url = (this as XMLHttpRequest & { __cmpUrl?: string }).__cmpUrl ?? '';
      const decision = self.options.evaluate(url, 'xhr');
      if (decision?.action === 'block') {
        self.record(decision, url, 'xhr');
        return;
      }
      if (decision?.action === 'log') self.record(decision, url, 'xhr');
      return xhrSend.call(this, body);
    };

    if (this.originalSendBeacon) {
      navigator.sendBeacon = function (url: string | URL, data?: BodyInit | null) {
        const target = String(url);
        const decision = self.options.evaluate(target, 'beacon');
        if (decision?.action === 'block') {
          self.record(decision, target, 'beacon');
          return false;
        }
        if (decision?.action === 'log') self.record(decision, target, 'beacon');
        return self.originalSendBeacon!(url, data);
      };
    }
  }

  private record(decision: BlockingDecision, url: string, resourceType: ResourceType) {
    const event = this.options.log.record({
      url,
      resourceType,
      category: decision.rule.category,
      vendor: decision.rule.vendor,
      rulePattern: decision.rule.pattern,
      action: decision.action,
      pageUrl: location.href,
      remediation: remediationForCategory(decision.rule.category),
    });
    this.options.onViolation?.({
      url: event.url,
      resourceType: event.resourceType,
      category: event.category,
      vendor: event.vendor,
      rulePattern: event.rulePattern,
      pageUrl: event.pageUrl,
    });
  }
}
