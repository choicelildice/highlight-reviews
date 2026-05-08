#!/usr/bin/env tsx
/**
 * Highlight Reviews — space setup script
 *
 * Creates content types and seed entries for the demo site.
 * Run: npx tsx scripts/setup.ts
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// ── Prompt helpers ──────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> =>
  new Promise((res) => rl.question(q, (a) => res(a.trim())));
const askSecret = (q: string): Promise<string> => ask(q);

// ── CMA thin client ─────────────────────────────────────────────────────────

async function cmaFetch(
  method: string,
  url: string,
  token: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.contentful.management.v1+json',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`CMA ${method} ${url} → ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ── Content type definitions ─────────────────────────────────────────────────

const CONTENT_TYPES = [
  {
    id: 'hrHero',
    name: 'HR – Hero',
    displayField: 'headline',
    fields: [
      { id: 'headline', name: 'Headline', type: 'Symbol', required: true },
      { id: 'subheadline', name: 'Subheadline', type: 'Symbol' },
    ],
  },
  {
    id: 'hrFeatureBlock',
    name: 'HR – Feature Block',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true },
      { id: 'description', name: 'Description', type: 'Text' },
      { id: 'icon', name: 'Icon (emoji)', type: 'Symbol' },
      { id: 'order', name: 'Order', type: 'Integer' },
    ],
  },
  {
    id: 'hrStep',
    name: 'HR – How It Works Step',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true },
      { id: 'description', name: 'Description', type: 'Text' },
      { id: 'order', name: 'Order', type: 'Integer' },
    ],
  },
  {
    id: 'hrFaq',
    name: 'HR – FAQ',
    displayField: 'question',
    fields: [
      { id: 'question', name: 'Question', type: 'Symbol', required: true },
      { id: 'answer', name: 'Answer', type: 'Text', required: true },
      { id: 'order', name: 'Order', type: 'Integer' },
    ],
  },
  {
    id: 'hrPage',
    name: 'HR – Page',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true },
      { id: 'slug', name: 'Slug', type: 'Symbol', required: true },
      { id: 'hero', name: 'Hero', type: 'Link', linkType: 'Entry' },
      { id: 'featuresHeading', name: 'Features Section Heading', type: 'Symbol' },
      { id: 'featuresDescription', name: 'Features Section Description', type: 'Symbol' },
      { id: 'featureBlocks', name: 'Feature Blocks', type: 'Array', items: { type: 'Link', linkType: 'Entry' } },
      { id: 'stepsHeading', name: 'Steps Section Heading', type: 'Symbol' },
      { id: 'stepsDescription', name: 'Steps Section Description', type: 'Symbol' },
      { id: 'steps', name: 'How It Works Steps', type: 'Array', items: { type: 'Link', linkType: 'Entry' } },
      { id: 'faqHeading', name: 'FAQ Section Heading', type: 'Symbol' },
      { id: 'faqs', name: 'FAQs', type: 'Array', items: { type: 'Link', linkType: 'Entry' } },
    ],
  },
];

// ── Seed data ────────────────────────────────────────────────────────────────

const SEED_ENTRIES = [
  {
    contentType: 'hrHero',
    fields: {
      headline: { 'en-US': 'Stakeholder feedback, right inside Contentful.' },
      subheadline: {
        'en-US':
          'Highlight Reviews lets anyone leave feedback on your preview site — no Contentful login required. Highlights become tasks or comments, right where your editors work.',
      },
    },
  },
  {
    contentType: 'hrFeatureBlock',
    fields: {
      title: { 'en-US': 'No login required' },
      description: {
        'en-US':
          'Stakeholders annotate your preview URL directly. No Contentful account needed — just a link.',
      },
      icon: { 'en-US': '🔓' },
      order: { 'en-US': 1 },
    },
  },
  {
    contentType: 'hrFeatureBlock',
    fields: {
      title: { 'en-US': 'Tasks and Comments' },
      description: {
        'en-US':
          'Configure whether stakeholders can create assignable Tasks, threaded Comments, or both — from the app config screen.',
      },
      icon: { 'en-US': '✅' },
      order: { 'en-US': 2 },
    },
  },
  {
    contentType: 'hrFeatureBlock',
    fields: {
      title: { 'en-US': 'Content Source Maps' },
      description: {
        'en-US':
          'When your preview site uses the Contentful Live Preview SDK, feedback is automatically linked to the exact entry and field — no guesswork.',
      },
      icon: { 'en-US': '🗺️' },
      order: { 'en-US': 3 },
    },
  },
  {
    contentType: 'hrFeatureBlock',
    fields: {
      title: { 'en-US': 'Works on any site' },
      description: {
        'en-US':
          'No SDK? No problem. Highlight Reviews falls back to URL-based entry lookup, so it works on static sites, Next.js, Gatsby, and more.',
      },
      icon: { 'en-US': '🌐' },
      order: { 'en-US': 4 },
    },
  },
  {
    contentType: 'hrStep',
    fields: {
      title: { 'en-US': 'Share the preview link' },
      description: {
        'en-US':
          'Send your stakeholder the preview URL. The Highlight Reviews overlay loads automatically — no install, no account.',
      },
      order: { 'en-US': 1 },
    },
  },
  {
    contentType: 'hrStep',
    fields: {
      title: { 'en-US': 'Highlight and annotate' },
      description: {
        'en-US':
          'They select any text on the page. A popover appears — they type their feedback and choose to create a Task or add a Comment.',
      },
      order: { 'en-US': 2 },
    },
  },
  {
    contentType: 'hrStep',
    fields: {
      title: { 'en-US': 'Resolve in Contentful' },
      description: {
        'en-US':
          'The feedback appears instantly in the Highlight Reviews sidebar on the relevant entry. Editors can review, respond, and resolve without leaving Contentful.',
      },
      order: { 'en-US': 3 },
    },
  },
  {
    contentType: 'hrFaq',
    fields: {
      question: { 'en-US': 'Do stakeholders need a Contentful account?' },
      answer: {
        'en-US':
          'No. Stakeholders only need access to the preview URL. All Contentful API calls are proxied through the app backend, which holds the credentials.',
      },
      order: { 'en-US': 1 },
    },
  },
  {
    contentType: 'hrFaq',
    fields: {
      question: { 'en-US': "What's the difference between Tasks and Comments?" },
      answer: {
        'en-US':
          'Tasks are assignable and resolvable — best for actionable copy changes. Comments are threaded discussion — best for questions or general notes. You can enable one or both from the app configuration screen.',
      },
      order: { 'en-US': 2 },
    },
  },
  {
    contentType: 'hrFaq',
    fields: {
      question: { 'en-US': 'Does this work without the Contentful Live Preview SDK?' },
      answer: {
        'en-US':
          'Yes. If the Live Preview SDK is not present, Highlight Reviews falls back to URL-based entry lookup using the Contentful Delivery API. Feedback is still linked to the correct entry.',
      },
      order: { 'en-US': 3 },
    },
  },
  {
    contentType: 'hrFaq',
    fields: {
      question: { 'en-US': 'Where do I find the overlay script?' },
      answer: {
        'en-US':
          "After installing the app, copy the snippet from the app's configuration screen and add it to your preview site's HTML. Set window.HighlightReviewsConfig before the script tag.",
      },
      order: { 'en-US': 4 },
    },
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│       Highlight Reviews — Setup         │');
  console.log('└─────────────────────────────────────────┘\n');

  const spaceId = await ask('Space ID: ');
  const cmaToken = await askSecret('CMA Token (Personal Access Token): ');
  const envId = (await ask('Environment ID [master]: ')) || 'master';
  const cdaToken = await ask('CDA Token (Delivery API, for demo site): ');
  const apiBase = (await ask('API base URL for overlay (leave blank to fill in later): ')) || 'http://localhost:3001';

  rl.close();

  const base = `https://api.contentful.com/spaces/${spaceId}/environments/${envId}`;

  console.log('\n▸ Creating content types…');
  for (const ct of CONTENT_TYPES) {
    try {
      const existing = await cmaFetch('GET', `${base}/content_types/${ct.id}`, cmaToken).catch(() => null);

      const fields = ct.fields.map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        required: f.required || false,
        ...(f.linkType ? { linkType: f.linkType } : {}),
        ...(f.items ? { items: f.items } : {}),
      }));

      await cmaFetch('PUT', `${base}/content_types/${ct.id}`, cmaToken, {
        name: ct.name,
        displayField: ct.displayField,
        fields,
      }, existing ? { 'X-Contentful-Version': String(existing.sys.version) } : undefined);

      if (existing) {
        console.log(`  ↳ ${ct.name} updated`);
      }

      // Publish the content type
      const draft = await cmaFetch('GET', `${base}/content_types/${ct.id}`, cmaToken);
      await cmaFetch(
        'PUT',
        `${base}/content_types/${ct.id}/published`,
        cmaToken,
        undefined,
        { 'X-Contentful-Version': String(draft.sys.version) }
      );

      console.log(`  ✓ ${ct.name}`);
    } catch (e: any) {
      console.error(`  ✗ ${ct.name}: ${e.message}`);
    }
  }

  console.log('\n▸ Creating seed entries…');
  const ids: Record<string, string[]> = {
    hrHero: [], hrFeatureBlock: [], hrStep: [], hrFaq: [],
  };

  // Check if entries already exist per content type and collect their IDs
  for (const ct of ['hrHero', 'hrFeatureBlock', 'hrStep', 'hrFaq']) {
    const existing = await cmaFetch('GET', `${base}/entries?content_type=${ct}&limit=50`, cmaToken).catch(() => null);
    if (existing?.items?.length) {
      ids[ct] = existing.items.map((e: any) => e.sys.id);
      console.log(`  ↳ ${ct} entries already exist (${ids[ct].length}), skipping`);
    }
  }

  const typesToSeed = ['hrHero', 'hrFeatureBlock', 'hrStep', 'hrFaq'].filter((ct) => ids[ct].length === 0);

  for (const entry of SEED_ENTRIES.filter((e) => typesToSeed.includes(e.contentType))) {
    try {
      const created = await cmaFetch('POST', `${base}/entries`, cmaToken, { fields: entry.fields }, {
        'X-Contentful-Content-Type': entry.contentType,
      });

      await cmaFetch(
        'PUT',
        `${base}/entries/${created.sys.id}/published`,
        cmaToken,
        undefined,
        { 'X-Contentful-Version': String(created.sys.version) }
      );

      const label = (entry.fields as any).headline?.['en-US'] ||
                    (entry.fields as any).title?.['en-US'] ||
                    (entry.fields as any).question?.['en-US'] || created.sys.id;

      console.log(`  ✓ ${label.slice(0, 60)}`);
      ids[entry.contentType]?.push(created.sys.id);
    } catch (e: any) {
      console.error(`  ✗ ${entry.contentType}: ${e.message}`);
    }
  }

  // Create the page entry composing everything (skip if already exists)
  console.log('\n▸ Creating page entry…');
  const existingPage = await cmaFetch('GET', `${base}/entries?content_type=hrPage&limit=1`, cmaToken).catch(() => null);
  if (existingPage?.items?.length) {
    ids['hrPage'] = [existingPage.items[0].sys.id];
    console.log(`  ↳ hrPage already exists (${ids['hrPage'][0]}), skipping`);
  }
  const link = (id: string) => ({ sys: { type: 'Link', linkType: 'Entry', id } });
  if (!ids['hrPage']?.length) try {
    const page = await cmaFetch('POST', `${base}/entries`, cmaToken, {
      fields: {
        title: { 'en-US': 'Highlight Reviews — Home' },
        slug: { 'en-US': '/' },
        hero: { 'en-US': ids.hrHero[0] ? link(ids.hrHero[0]) : undefined },
        featuresHeading: { 'en-US': 'Everything your stakeholders need' },
        featuresDescription: { 'en-US': 'Highlight Reviews bridges the gap between your preview environment and your Contentful editorial workflow — no logins, no screenshots, no email threads.' },
        featureBlocks: { 'en-US': ids.hrFeatureBlock.map(link) },
        stepsHeading: { 'en-US': 'From highlight to resolved — in seconds' },
        stepsDescription: { 'en-US': 'Three steps. No training required.' },
        steps: { 'en-US': ids.hrStep.map(link) },
        faqHeading: { 'en-US': 'Frequently asked questions' },
        faqs: { 'en-US': ids.hrFaq.map(link) },
      },
    }, { 'X-Contentful-Content-Type': 'hrPage' });

    await cmaFetch(
      'PUT',
      `${base}/entries/${page.sys.id}/published`,
      cmaToken,
      undefined,
      { 'X-Contentful-Version': String(page.sys.version) }
    );
    console.log(`  ✓ Highlight Reviews — Home (${page.sys.id})`);
    ids['hrPage'] = [page.sys.id];
  } catch (e: any) {
    console.error(`  ✗ hrPage: ${e.message}`);
  }

  // Write .env.demo so build:demo can patch the template without touching the source
  const envDemo = [
    `SPACE_ID=${spaceId}`,
    `ENV_ID=${envId}`,
    `CDA_TOKEN=${cdaToken}`,
    `API_BASE=${apiBase}`,
    `PAGE_ENTRY_ID=${ids['hrPage']?.[0] || ''}`,
  ].join('\n');
  const envPath = path.join(__dirname, '..', '.env.demo');
  fs.writeFileSync(envPath, envDemo);
  console.log('\n✓ .env.demo written');

  // Run the patch+copy now
  const { execSync } = await import('child_process');
  try {
    execSync('npm run build:demo', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  } catch {
    console.error('  build:demo failed — run `npm run build:demo` manually after setup');
  }

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│                Done!                    │');
  console.log('└─────────────────────────────────────────┘');
  console.log(`
Space:       ${spaceId}
Environment: ${envId}

Next steps:
  1. cd server && vercel --prod --yes   (redeploy with patched demo site)
`);
}

main().catch((e) => {
  console.error('\nFatal:', e.message);
  process.exit(1);
});
