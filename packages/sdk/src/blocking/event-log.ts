export interface BlockingEvent {
  id: string;
  timestamp: number;
  url: string;
  resourceType: string;
  category: string;
  vendor?: string;
  rulePattern: string;
  action: 'block' | 'log';
  pageUrl: string;
  remediation?: string;
}

export class BlockingEventLog {
  private readonly events: BlockingEvent[] = [];
  private readonly maxEvents = 200;
  private readonly listeners = new Set<(event: BlockingEvent) => void>();

  record(event: Omit<BlockingEvent, 'id' | 'timestamp'>) {
    const entry: BlockingEvent = {
      ...event,
      id: `cmp-block-${Math.random().toString(36).slice(2, 10)}`,
      timestamp: Date.now(),
    };
    this.events.push(entry);
    if (this.events.length > this.maxEvents) this.events.shift();
    this.listeners.forEach((listener) => listener(entry));
    return entry;
  }

  list() {
    return [...this.events];
  }

  subscribe(listener: (event: BlockingEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  violationCount() {
    return this.events.filter((event) => event.action === 'block').length;
  }
}

export function remediationForCategory(category: string) {
  switch (category) {
    case 'analytics':
      return 'Grant analytics consent or remove the tag until consent is collected.';
    case 'marketing':
      return 'Grant marketing consent or load advertising tags only after consent.';
    case 'social_media':
      return 'Grant social media consent or defer embed scripts until consent.';
    case 'functional':
      return 'Grant functional consent or load chat/widgets after preferences are saved.';
    default:
      return 'Update script mappings or grant the required consent category.';
  }
}
