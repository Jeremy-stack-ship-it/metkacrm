// ── CC TOKEN EXCHANGE EDGE FUNCTION ─────────────────────────────────────────
// Proxies the Constant Contact OAuth token exchange server-to-server.
// CC blocks browser-origin token requests ("must use PKCE") but allows
// server-to-server requests using the client_secret directly.
// Deploy: supabase functions deploy cc-token
// Secrets: supabase secrets set CC_CLIENT_ID=... CC_CLIENT_SECRET=...

const CC_TOKEN_URL = 'https://identity.constantcontact.com/oauth2/aus1lm3ry9mF7x2Ja0h8/v1/token';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS });
  }

  const clientId     = Deno.env.get('CC_CLIENT_ID');
  const clientSecret = Deno.env.get('CC_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'CC credentials not configured in Edge Function secrets' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body: { grant_type: string; code?: string; redirect_uri?: string; refresh_token?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Build CC token request body
  const params = new URLSearchParams({ grant_type: body.grant_type });
  if (body.grant_type === 'authorization_code') {
    if (!body.code || !body.redirect_uri) {
      return new Response(JSON.stringify({ error: 'code and redirect_uri required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    params.set('code', body.code);
    params.set('redirect_uri', body.redirect_uri);
  } else if (body.grant_type === 'refresh_token') {
    if (!body.refresh_token) {
      return new Response(JSON.stringify({ error: 'refresh_token required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    params.set('refresh_token', body.refresh_token);
  } else {
    return new Response(JSON.stringify({ error: 'Unsupported grant_type' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const ccRes = await fetch(CC_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: params,
  });

  const data = await ccRes.json();
  return new Response(JSON.stringify(data), {
    status: ccRes.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
