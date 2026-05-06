#!/usr/bin/env tsx
/**
 * Patches demo-site/index.html placeholders and writes server/public/index.html.
 * If .env.demo doesn't exist, prompts for the values and saves them.
 * Safe to run repeatedly — never modifies the source template.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.demo');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> =>
  new Promise((res) => rl.question(q, (a) => res(a.trim())));

async function loadOrPrompt(): Promise<Record<string, string>> {
  if (fs.existsSync(envPath)) {
    const env: Record<string, string> = {};
    fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
      const [k, ...rest] = line.split('=');
      if (k && rest.length) env[k.trim()] = rest.join('=').trim();
    });
    const required = ['SPACE_ID', 'ENV_ID', 'CDA_TOKEN', 'API_BASE'];
    const missing = required.filter((k) => !env[k]);
    if (!missing.length) return env;
    console.log(`Missing from .env.demo: ${missing.join(', ')} — please fill them in.\n`);
  }

  console.log('No .env.demo found. Enter the values for the demo site:\n');
  const env: Record<string, string> = {
    SPACE_ID:  await ask('Space ID: '),
    ENV_ID:    (await ask('Environment ID [master]: ')) || 'master',
    CDA_TOKEN: await ask('CDA Token (Delivery API): '),
    API_BASE:  await ask('API base URL (Vercel deployment URL): '),
  };
  rl.close();

  fs.writeFileSync(envPath, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n'));
  console.log('\n✓ Saved to .env.demo\n');
  return env;
}

async function main() {
  const env = await loadOrPrompt();
  rl.close();

  const src = path.join(root, 'demo-site', 'index.html');
  let html = fs.readFileSync(src, 'utf8');

  html = html
    .replace(/__SPACE_ID__/g, env.SPACE_ID)
    .replace(/__ENV_ID__/g, env.ENV_ID)
    .replace(/__CDA_TOKEN__/g, env.CDA_TOKEN)
    .replace(/__API_BASE__/g, env.API_BASE);

  const publicDir = path.join(root, 'server', 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'index.html'), html);

  console.log('✓ server/public/index.html patched and ready to deploy');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
