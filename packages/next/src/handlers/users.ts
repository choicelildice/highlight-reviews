export interface UsersConfig {
  cmaToken: string;
  spaceId: string;
}

export async function handleUsers(
  config: UsersConfig
): Promise<{ status: number; body: unknown }> {
  try {
    const r = await fetch(
      `https://api.contentful.com/spaces/${config.spaceId}/users?limit=100`,
      { headers: { Authorization: `Bearer ${config.cmaToken}` } }
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || r.statusText);

    const users = (data.items || []).map((u: any) => ({
      id: u.sys.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      email: u.email,
    }));

    return { status: 200, body: users };
  } catch (e: any) {
    return { status: 502, body: { error: e.message } };
  }
}
