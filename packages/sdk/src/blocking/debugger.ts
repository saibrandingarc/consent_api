import type { BlockingEventLog } from './event-log';

export function mountBlockingDebugger(log: BlockingEventLog, onOpenPreferences: () => void) {
  const root = document.createElement('div');
  root.id = 'cmp-blocking-debugger';
  root.setAttribute('data-cmp-managed', 'true');
  root.style.cssText =
    'position:fixed;bottom:1rem;left:1rem;z-index:2147483646;width:min(420px,calc(100vw - 2rem));max-height:50vh;background:#111827;color:#f9fafb;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.35);font:12px/1.4 system-ui,sans-serif;overflow:hidden';

  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;background:#1f2937;border-bottom:1px solid #374151';
  header.innerHTML = '<strong>CMP Blocking Debugger</strong>';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Hide';
  toggle.style.cssText =
    'border:0;background:#374151;color:#fff;border-radius:4px;padding:0.2rem 0.5rem;cursor:pointer';
  header.append(toggle);

  const body = document.createElement('div');
  body.style.cssText = 'padding:0.75rem;overflow:auto;max-height:40vh';

  const list = document.createElement('ul');
  list.style.cssText = 'margin:0;padding:0;list-style:none';
  body.append(list);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:0.5rem;padding:0.6rem 0.75rem;border-top:1px solid #374151';
  const prefs = document.createElement('button');
  prefs.type = 'button';
  prefs.textContent = 'Open preferences';
  prefs.style.cssText =
    'border:0;background:#2563eb;color:#fff;border-radius:6px;padding:0.35rem 0.6rem;cursor:pointer';
  prefs.addEventListener('click', () => onOpenPreferences());
  actions.append(prefs);

  root.append(header, body, actions);
  document.body.append(root);

  let hidden = false;
  toggle.addEventListener('click', () => {
    hidden = !hidden;
    body.style.display = hidden ? 'none' : 'block';
    actions.style.display = hidden ? 'none' : 'flex';
    toggle.textContent = hidden ? 'Show' : 'Hide';
  });

  function render() {
    const events = log.list().slice(-8).reverse();
    list.innerHTML = '';
    if (events.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = 'No blocked resources yet.';
      empty.style.color = '#9ca3af';
      list.append(empty);
      return;
    }
    for (const event of events) {
      const item = document.createElement('li');
      item.style.cssText = 'margin-bottom:0.6rem;padding-bottom:0.6rem;border-bottom:1px solid #374151';
      item.innerHTML = `
        <div><code>${event.resourceType}</code> · <strong>${event.category}</strong></div>
        <div style="color:#9ca3af;margin-top:0.2rem;word-break:break-all">${event.url}</div>
        <div style="color:#fbbf24;margin-top:0.2rem">Rule: ${event.rulePattern}</div>
        <div style="color:#93c5fd;margin-top:0.2rem">${event.remediation ?? ''}</div>
      `;
      list.append(item);
    }
  }

  render();
  const unsubscribe = log.subscribe(() => render());

  return () => {
    unsubscribe();
    root.remove();
  };
}
