export interface AnnotationPayload {
  entryId: string;
  fieldId: string | null;
  quote: string;
  body: string;
  type: 'task' | 'comment';
  reviewerName: string;
  assignedToId?: string;
  locale?: string;
}

interface RateLimitEntry { count: number; resetAt: number }
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

let tokenOwnerId: string | null = null;
async function getTokenOwnerId(cmaToken: string): Promise<string> {
  if (tokenOwnerId) return tokenOwnerId;
  const r = await fetch('https://api.contentful.com/users/me', {
    headers: { Authorization: `Bearer ${cmaToken}` },
  });
  const data = await r.json();
  tokenOwnerId = data.sys.id;
  return tokenOwnerId!;
}

async function cmaPost(
  base: string,
  cmaToken: string,
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>
) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cmaToken}`,
      'Content-Type': 'application/vnd.contentful.management.v1+json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`CMA ${path} → ${res.status}: ${text}`);
  return JSON.parse(text);
}

function buildBody(payload: AnnotationPayload): string {
  return `[Highlight Reviews] "${payload.quote.slice(0, 120)}"\n\n${payload.body}\n\n— ${payload.reviewerName}`;
}

export interface AnnotationConfig {
  cmaToken: string;
  spaceId: string;
  environmentId?: string;
}

export async function handleAnnotation(
  payload: AnnotationPayload,
  ip: string,
  config: AnnotationConfig
): Promise<{ status: number; body: unknown }> {
  if (isRateLimited(ip)) {
    return { status: 429, body: { error: 'Too many requests. Please slow down.' } };
  }

  const { entryId, body, type, reviewerName } = payload;
  if (!entryId || !body || !type || !reviewerName) {
    return { status: 400, body: { error: 'Missing required fields: entryId, body, type, reviewerName' } };
  }
  if (type !== 'task' && type !== 'comment') {
    return { status: 400, body: { error: 'type must be "task" or "comment"' } };
  }

  const env = config.environmentId || 'master';
  const base = `https://api.contentful.com/spaces/${config.spaceId}/environments/${env}`;
  const cmaBody = buildBody(payload);

  try {
    const result = type === 'task'
      ? await cmaPost(base, config.cmaToken, `/entries/${entryId}/tasks`, {
          body: cmaBody,
          status: 'active',
          assignedTo: {
            sys: {
              type: 'Link',
              linkType: 'User',
              id: payload.assignedToId || await getTokenOwnerId(config.cmaToken),
            },
          },
        })
      : await cmaPost(base, config.cmaToken, `/entries/${entryId}/comments`, { body: cmaBody },
          payload.fieldId
            ? { 'X-Contentful-Parent-Entity-Reference': `fields.${payload.fieldId}.${payload.locale || 'en-US'}` }
            : undefined);

    return { status: 201, body: { ok: true, id: result.sys.id } };
  } catch (e: any) {
    return { status: 502, body: { error: e.message } };
  }
}
