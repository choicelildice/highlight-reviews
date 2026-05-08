import type { VercelRequest, VercelResponse } from '@vercel/node';

interface AnnotationPayload {
  entryId: string;
  fieldId: string | null;
  quote: string;
  body: string;
  type: 'task' | 'comment';
  reviewerName: string;
  assignedToId?: string;
  locale?: string;
}

const CMA_BASE = `https://api.contentful.com/spaces/${process.env.SPACE_ID}/environments/${process.env.ENVIRONMENT_ID || 'master'}`;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
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
async function getTokenOwnerId(): Promise<string> {
  if (tokenOwnerId) return tokenOwnerId;
  const r = await fetch('https://api.contentful.com/users/me', {
    headers: { Authorization: `Bearer ${process.env.CMA_TOKEN}` },
  });
  const data = await r.json();
  tokenOwnerId = data.sys.id;
  return tokenOwnerId!;
}

async function cmaPost(path: string, body: unknown, extraHeaders?: Record<string, string>) {
  const res = await fetch(`${CMA_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CMA_TOKEN}`,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Please slow down.' });

  const payload = req.body as AnnotationPayload;
  const { entryId, body, type, reviewerName } = payload || {};

  if (!entryId || !body || !type || !reviewerName) {
    return res.status(400).json({ error: 'Missing required fields: entryId, body, type, reviewerName' });
  }
  if (type !== 'task' && type !== 'comment') {
    return res.status(400).json({ error: 'type must be "task" or "comment"' });
  }
  if (!process.env.CMA_TOKEN || !process.env.SPACE_ID) {
    return res.status(500).json({ error: 'Server is not configured' });
  }

  try {
    const cmaBody = buildBody(payload);
    const result = type === 'task'
      ? await cmaPost(`/entries/${entryId}/tasks`, {
          body: cmaBody,
          status: 'active',
          assignedTo: { sys: { type: 'Link', linkType: 'User', id: payload.assignedToId || await getTokenOwnerId() } },
        })
      : await cmaPost(`/entries/${entryId}/comments`, { body: cmaBody },
          payload.fieldId
            ? { 'X-Contentful-Parent-Entity-Reference': `fields.${payload.fieldId}.${payload.locale || 'en-US'}` }
            : undefined);

    return res.status(201).json({ ok: true, id: result.sys.id });
  } catch (e: any) {
    console.error('CMA error:', e.message);
    return res.status(502).json({ error: e.message });
  }
}
