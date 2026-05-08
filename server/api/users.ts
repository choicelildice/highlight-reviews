import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUsers } from '../../packages/next/src/handlers/users';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.CMA_TOKEN || !process.env.SPACE_ID) {
    return res.status(500).json({ error: 'Server is not configured' });
  }

  const { status, body } = await handleUsers({
    cmaToken: process.env.CMA_TOKEN,
    spaceId: process.env.SPACE_ID,
  });

  return res.status(status).json(body);
}
