import type { BlockingDecision } from './engine-rules';
import type { BlockingEventLog } from './event-log';
import { remediationForCategory } from './event-log';
import { isCmpManagedElement } from './placeholder';

type ResourceType = 'script' | 'iframe' | 'pixel';

export interface DomInterceptorOptions {
  evaluate: (url: string, type: ResourceType) => BlockingDecision | null;
  log: BlockingEventLog;
  onViolation?: (payload: Record<string, unknown>) => void;
  onOpenPreferences: () => void;
}

const BLOCKED_ATTR = 'data-cmp-blocked';

export class DomInterceptor {
  private readonly originals: {
    createElement?: typeof document.createElement;
    appendChild?: typeof Node.prototype.appendChild;
    insertBefore?: typeof Node.prototype.insertBefore;
    write?: typeof document.write;
    writeln?: typeof document.writeln;
  } = {};

  constructor(private readonly options: DomInterceptorOptions) {
    this.install();
  }

  destroy() {
    if (this.originals.createElement) document.createElement = this.originals.createElement;
    if (this.originals.appendChild) Node.prototype.appendChild = this.originals.appendChild!;
    if (this.originals.insertBefore) Node.prototype.insertBefore = this.originals.insertBefore!;
    if (this.originals.write) document.write = this.originals.write!;
    if (this.originals.writeln) document.writeln = this.originals.writeln!;
  }

  private install() {
    const self = this;
    this.originals.createElement = document.createElement.bind(document);
    document.createElement = function (tagName: string, options?: ElementCreationOptions) {
      const element = self.originals.createElement!(tagName, options);
      if (tagName.toLowerCase() === 'script') self.hookScript(element as HTMLScriptElement);
      if (tagName.toLowerCase() === 'iframe') self.hookIframe(element as HTMLIFrameElement);
      if (tagName.toLowerCase() === 'img') self.hookImage(element as HTMLImageElement);
      return element;
    };

    this.originals.appendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function <T extends Node>(child: T): T {
      self.inspectNode(child);
      return self.originals.appendChild!.call(this, child);
    };

    this.originals.insertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
      self.inspectNode(newNode);
      return self.originals.insertBefore!.call(this, newNode, referenceNode);
    };

    this.originals.write = document.write;
    document.write = function (...args: string[]) {
      const html = args.join('');
      if (self.shouldBlockInline(html)) return;
      self.originals.write!.apply(document, args);
    };

    this.originals.writeln = document.writeln;
    document.writeln = function (...args: string[]) {
      const html = args.join('');
      if (self.shouldBlockInline(html)) return;
      self.originals.writeln!.apply(document, args);
    };
  }

  private inspectNode(node: Node) {
    if (node instanceof HTMLScriptElement) this.blockScriptIfNeeded(node);
    if (node instanceof HTMLIFrameElement) this.blockIframeIfNeeded(node);
    if (node instanceof HTMLImageElement) this.blockImageIfNeeded(node);
  }

  private hookScript(script: HTMLScriptElement) {
    const self = this;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (!descriptor?.set) return;
    Object.defineProperty(script, 'src', {
      configurable: true,
      get() {
        return script.getAttribute('src') ?? '';
      },
      set(value: string) {
        script.setAttribute('src', value);
        self.blockScriptIfNeeded(script);
      },
    });
  }

  private hookIframe(iframe: HTMLIFrameElement) {
    const self = this;
    Object.defineProperty(iframe, 'src', {
      configurable: true,
      get() {
        return iframe.getAttribute('src') ?? '';
      },
      set(value: string) {
        iframe.setAttribute('src', value);
        self.blockIframeIfNeeded(iframe);
      },
    });
  }

  private hookImage(img: HTMLImageElement) {
    const self = this;
    Object.defineProperty(img, 'src', {
      configurable: true,
      get() {
        return img.getAttribute('src') ?? '';
      },
      set(value: string) {
        img.setAttribute('src', value);
        self.blockImageIfNeeded(img);
      },
    });
  }

  private blockScriptIfNeeded(script: HTMLScriptElement) {
    if (isCmpManagedElement(script) || script.getAttribute(BLOCKED_ATTR) === 'true') return;
    const src = script.src || script.getAttribute('src') || '';
    const inline = script.textContent?.trim();
    const decision = src
      ? this.options.evaluate(src, 'script')
      : inline
        ? this.options.evaluate(inline.slice(0, 120), 'script')
        : null;
    if (!decision || decision.action === 'log') {
      if (decision?.action === 'log') this.record(decision, src || 'inline-script', 'script');
      return;
    }
    if (src) {
      script.setAttribute('data-cmp-src', src);
      script.removeAttribute('src');
    } else if (inline) {
      script.setAttribute('data-cmp-inline', inline);
      script.textContent = '';
    }
    script.type = 'text/plain';
    script.setAttribute(BLOCKED_ATTR, 'true');
    this.record(decision, src || 'inline-script', 'script');
  }

  private blockIframeIfNeeded(iframe: HTMLIFrameElement) {
    if (isCmpManagedElement(iframe)) return;
    const src = iframe.src || iframe.getAttribute('src') || '';
    if (!src) return;
    const decision = this.options.evaluate(src, 'iframe');
    if (!decision || decision.action !== 'block') return;
    iframe.setAttribute('data-cmp-src', src);
    iframe.removeAttribute('src');
    iframe.setAttribute(BLOCKED_ATTR, 'true');
    this.record(decision, src, 'iframe');
  }

  private blockImageIfNeeded(img: HTMLImageElement) {
    if (isCmpManagedElement(img)) return;
    const src = img.src || img.getAttribute('src') || '';
    if (!src || (img.width > 2 && img.height > 2)) return;
    const decision = this.options.evaluate(src, 'pixel');
    if (!decision || decision.action !== 'block') return;
    img.setAttribute('data-cmp-src', src);
    img.removeAttribute('src');
    img.setAttribute(BLOCKED_ATTR, 'true');
    this.record(decision, src, 'pixel');
  }

  private shouldBlockInline(html: string) {
    const decision = this.options.evaluate(html.slice(0, 200), 'script');
    if (decision?.action === 'block') {
      this.record(decision, 'document.write', 'script');
      return true;
    }
    return false;
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
