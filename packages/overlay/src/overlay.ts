/**
 * Highlight Reviews — preview overlay
 *
 * Inject this script into any preview site to let stakeholders highlight text
 * and create Tasks or Comments on the Contentful entry where that content lives.
 *
 * Config is supplied via window.HighlightReviewsConfig before this script loads:
 *
 *   window.HighlightReviewsConfig = {
 *     apiBase: 'https://your-api-worker.example.com',  // proxy that holds CMA token
 *     spaceId: 'abc123',
 *     environmentId: 'master',
 *     enableTasks: true,
 *     enableComments: true,
 *     reviewerName: 'Stakeholder',   // optional display name
 *   };
 */

declare global {
  interface Window {
    HighlightReviewsConfig?: HighlightReviewsConfig;
  }
}

export interface HighlightReviewsConfig {
  apiBase: string;
  spaceId: string;
  environmentId?: string;
  enableTasks?: boolean;
  enableComments?: boolean;
  showAssignee?: boolean;
  reviewerName?: string;
  defaultEntryId?: string;
  locale?: string;
}

interface AnnotationPayload {
  entryId: string;
  fieldId: string | null;
  quote: string;
  body: string;
  type: 'task' | 'comment';
  reviewerName: string;
  assignedToId?: string;
  locale?: string;
  range: { start: number; end: number } | null;
}

interface SpaceUser {
  id: string;
  name: string;
  email: string;
}

// ── Entry / field from Live Preview DOM (data-* on preview HTML) ─────────────

function entryIdFromSdkNode(node: Node): string | null {
  let el: Element | null = node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : (node as Text).parentElement;

  while (el) {
    const entryId =
      el.getAttribute('data-contentful-entry-id') ||
      el.getAttribute('data-entry-id');
    if (entryId) return entryId;
    el = el.parentElement;
  }
  return null;
}

function fieldIdFromSdkNode(node: Node): string | null {
  let el: Element | null = node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : (node as Text).parentElement;

  while (el) {
    const fieldId =
      el.getAttribute('data-contentful-field-id') ||
      el.getAttribute('data-field-id');
    if (fieldId) return fieldId;
    el = el.parentElement;
  }
  return null;
}

// ── URL-based fallback: look up entry by slug ─────────────────────────────────

async function entryIdFromUrl(config: HighlightReviewsConfig): Promise<string | null> {
  const slug = window.location.pathname.replace(/^\/|\/$/g, '') || 'homepage';
  const env = config.environmentId || 'master';
  const url =
    `https://cdn.contentful.com/spaces/${config.spaceId}/environments/${env}` +
    `/entries?fields.slug=${encodeURIComponent(slug)}&content_type&limit=1`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    return data.items?.[0]?.sys?.id ?? null;
  } catch {
    return null;
  }
}

// ── User fetching ─────────────────────────────────────────────────────────────

let cachedUsers: SpaceUser[] | null = null;

async function fetchUsers(config: HighlightReviewsConfig): Promise<SpaceUser[]> {
  if (cachedUsers) return cachedUsers;
  try {
    const r = await fetch(`${config.apiBase}/api/users`);
    if (!r.ok) return [];
    cachedUsers = await r.json();
    return cachedUsers!;
  } catch {
    return [];
  }
}

// ── Popover UI ────────────────────────────────────────────────────────────────

function createPopover(
  config: HighlightReviewsConfig,
  quote: string,
  anchorRect: DOMRect,
  entryId: string,
  fieldId: string | null,
  users: SpaceUser[]
): void {
  removePopover();

  const both = config.enableTasks && config.enableComments;

  const pop = document.createElement('div');
  pop.id = 'hr-popover';
  pop.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    background: #fff;
    border: 1px solid #d6d9dc;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    padding: 16px;
    width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
  `;

  const POPOVER_HEIGHT = 280;
  const MARGIN = 8;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  const top = spaceBelow >= POPOVER_HEIGHT + MARGIN || spaceBelow >= spaceAbove
    ? Math.min(anchorRect.bottom + MARGIN, window.innerHeight - POPOVER_HEIGHT - MARGIN)
    : anchorRect.top - POPOVER_HEIGHT - MARGIN;
  const left = Math.min(anchorRect.left, window.innerWidth - 316);
  pop.style.top = `${Math.max(MARGIN, top)}px`;
  pop.style.left = `${Math.max(MARGIN, left)}px`;

  const assigneeOptions = users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');

  pop.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px;color:#1a1a2e;">Leave feedback</div>
    <div style="
      background:#f7f9fa;
      border-left:3px solid #1770e5;
      padding:6px 8px;
      border-radius:3px;
      color:#555;
      font-style:italic;
      margin-bottom:10px;
      font-size:12px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    ">"${quote.slice(0, 80)}${quote.length > 80 ? '…' : ''}"</div>
    <textarea id="hr-body" placeholder="Describe the change needed…" style="
      width:100%;
      box-sizing:border-box;
      border:1px solid #ccd0d5;
      border-radius:4px;
      padding:8px;
      font-size:13px;
      resize:vertical;
      min-height:72px;
      outline:none;
    "></textarea>
    <div id="hr-name-row" style="margin-top:8px;display:${config.reviewerName ? 'none' : 'block'}">
      <input id="hr-name" placeholder="Your name (optional)" style="
        width:100%;
        box-sizing:border-box;
        border:1px solid #ccd0d5;
        border-radius:4px;
        padding:6px 8px;
        font-size:12px;
        outline:none;
      " />
    </div>
    ${config.enableTasks && config.showAssignee !== false && users.length ? `
    <div id="hr-assignee-row" style="margin-top:8px;">
      <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">Assign to (for tasks)</label>
      <select id="hr-assignee" style="
        width:100%;
        box-sizing:border-box;
        border:1px solid #ccd0d5;
        border-radius:4px;
        padding:6px 8px;
        font-size:12px;
        outline:none;
        background:#fff;
      ">${assigneeOptions}</select>
    </div>` : ''}
    ${both ? `
    <div style="margin-top:10px;display:flex;gap:8px;">
      <button id="hr-btn-task" data-type="task" style="flex:1;padding:8px;background:#1770e5;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">
        Create Task
      </button>
      <button id="hr-btn-comment" data-type="comment" style="flex:1;padding:8px;background:#fff;color:#1770e5;border:1px solid #1770e5;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">
        Add Comment
      </button>
    </div>` : `
    <div style="margin-top:10px;">
      <button id="hr-btn-submit" data-type="${config.enableTasks ? 'task' : 'comment'}" style="width:100%;padding:8px;background:#1770e5;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">
        ${config.enableTasks ? 'Create Task' : 'Add Comment'}
      </button>
    </div>`}
    <div id="hr-status" style="margin-top:8px;font-size:12px;color:#555;text-align:center;min-height:16px;"></div>
  `;


  document.body.appendChild(pop);

  const submit = async (type: 'task' | 'comment') => {
    const body = (document.getElementById('hr-body') as HTMLTextAreaElement)?.value.trim();
    const nameInput = document.getElementById('hr-name') as HTMLInputElement | null;
    const name = config.reviewerName || nameInput?.value.trim() || 'Stakeholder';
    const status = document.getElementById('hr-status')!;

    if (!body) {
      status.style.color = '#c43b3b';
      status.textContent = 'Please add a description.';
      return;
    }

    status.style.color = '#555';
    status.textContent = 'Submitting…';

    const assigneeSelect = document.getElementById('hr-assignee') as HTMLSelectElement | null;
    const payload: AnnotationPayload = {
      entryId,
      fieldId,
      quote,
      body,
      type,
      reviewerName: name,
      assignedToId: type === 'task' && assigneeSelect?.value ? assigneeSelect.value : undefined,
      locale: config.locale,
      range: null,
    };

    try {
      const res = await fetch(`${config.apiBase}/api/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      status.style.color = '#2e7d32';
      status.textContent = type === 'task' ? 'Task created!' : 'Comment added!';
      setTimeout(removePopover, 1200);
    } catch (e: any) {
      status.style.color = '#c43b3b';
      status.textContent = `Error: ${e.message}`;
    }
  };

  pop.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-type]');
    if (btn) submit(btn.dataset.type as 'task' | 'comment');
  });

  setTimeout(() => {
    document.addEventListener('mousedown', outsideHandler, { once: true });
  }, 50);
}

function outsideHandler(e: MouseEvent) {
  const pop = document.getElementById('hr-popover');
  if (pop && !pop.contains(e.target as Node)) removePopover();
}

function removePopover() {
  document.getElementById('hr-popover')?.remove();
}

// ── Selection listener ────────────────────────────────────────────────────────

function init(config: HighlightReviewsConfig) {
  if (!config.enableTasks && !config.enableComments) return;

  // Pre-fetch users so the dropdown is ready when the popover opens
  let usersPromise: Promise<SpaceUser[]> = config.enableTasks && config.showAssignee !== false
    ? fetchUsers(config)
    : Promise.resolve([]);

  document.addEventListener('mouseup', async (e) => {
    const popover = document.getElementById('hr-popover');
    if (popover && popover.contains(e.target as Node)) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const quote = sel.toString().trim();
    if (quote.length < 3) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Always walk the DOM for data attributes — works with or without the SDK
    let entryId = entryIdFromSdkNode(range.startContainer);
    let fieldId = fieldIdFromSdkNode(range.startContainer);

    // Fall back to URL slug lookup
    if (!entryId) {
      entryId = await entryIdFromUrl(config);
    }

    // Last resort: use the configured default
    if (!entryId && config.defaultEntryId) {
      entryId = config.defaultEntryId;
    }

    if (!entryId) return;

    const users = await usersPromise;
    createPopover(config, quote, rect, entryId, fieldId, users);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export { init };

// ── Auto-bootstrap when used as a plain <script> tag ─────────────────────────

const cfg = window.HighlightReviewsConfig;
if (cfg) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(cfg));
  } else {
    init(cfg);
  }
}
