import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAnnotation } from '../../packages/next/src/handlers/annotations';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.CMA_TOKEN || !process.env.SPACE_ID) {
    return res.status(500).json({ error: 'Server is not configured' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || 'unknown';
  const { status, body } = await handleAnnotation(req.body, ip, {
    cmaToken: process.env.CMA_TOKEN,
    spaceId: process.env.SPACE_ID,
    environmentId: process.env.ENVIRONMENT_ID,
  });

  return res.status(status).json(body);
}
