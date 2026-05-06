import type { VercelRequest, VercelResponse } from '@vercel/node';

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

  try {
    const r = await fetch(
      `https://api.contentful.com/spaces/${process.env.SPACE_ID}/users?limit=100`,
      { headers: { Authorization: `Bearer ${process.env.CMA_TOKEN}` } }
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || r.statusText);

    const users = (data.items || []).map((u: any) => ({
      id: u.sys.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      email: u.email,
    }));

    return res.status(200).json(users);
  } catch (e: any) {
    console.error('Users fetch error:', e.message);
    return res.status(502).json({ error: e.message });
  }
}
