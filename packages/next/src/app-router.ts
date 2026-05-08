import { handleAnnotation, type AnnotationConfig } from './handlers/annotations';
import { handleUsers, type UsersConfig } from './handlers/users';

function getIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
  });
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export interface HighlightReviewsConfig extends AnnotationConfig, UsersConfig {
  allowedOrigin?: string;
}

/**
 * Creates App Router route handlers for Next.js 13+.
 *
 * Usage in app/api/highlight-reviews/[...route]/route.ts:
 *
 *   import { createAppRouterHandlers } from '@highlight-reviews/next/app-router';
 *   const { GET, POST, OPTIONS } = createAppRouterHandlers({
 *     cmaToken: process.env.CMA_TOKEN!,
 *     spaceId: process.env.CONTENTFUL_SPACE_ID!,
 *   });
 *   export { GET, POST, OPTIONS };
 */
export function createAppRouterHandlers(config: HighlightReviewsConfig) {
  const origin = config.allowedOrigin ?? '*';
  const headers = corsHeaders(origin);

  const OPTIONS = () => new Response(null, { status: 204, headers });

  const GET = async (request: Request, { params }: { params: { route: string[] } }) => {
    const route = params.route?.join('/');
    if (route === 'users') {
      const { status, body } = await handleUsers(config);
      return jsonResponse(body, { status, headers });
    }
    return jsonResponse({ error: 'Not found' }, { status: 404, headers });
  };

  const POST = async (request: Request, { params }: { params: { route: string[] } }) => {
    const route = params.route?.join('/');
    if (route === 'annotations') {
      const payload = await request.json();
      const { status, body } = await handleAnnotation(payload, getIp(request), config);
      return jsonResponse(body, { status, headers });
    }
    return jsonResponse({ error: 'Not found' }, { status: 404, headers });
  };

  return { GET, POST, OPTIONS };
}
