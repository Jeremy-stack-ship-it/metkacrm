// ── CONSTANT CONTACT INTEGRATION (v1.2 — Edge Function Proxy) ────────────────
// OAuth 2.0 Authorization Code flow.
// Token exchange is proxied through a Supabase Edge Function to avoid CC's
// "Browser requests must use PKCE" restriction (triggered by Origin header).
// The Edge Function does server-to-server Basic auth — no PKCE needed.
// Tokens stored in localStorage.

const CC_CLIENT_ID    = import.meta.env.VITE_CC_CLIENT_ID;
const CC_REDIRECT_URI = import.meta.env.VITE_CC_REDIRECT_URI || 'http://localhost:5173/cc-callback';
const CC_TOKEN_PROXY  = import.meta.env.VITE_CC_TOKEN_PROXY_URL; // Supabase Edge Function

const CC_AUTH_URL = 'https://authz.constantcontact.com/oauth2/default/v1/authorize';
const CC_API_BASE = 'https://api.cc.email/v3';

const LS_CC_TOKENS = 'metka-cc-tokens-v1';

// ── TOKEN STORAGE ────────────────────────────────────────────────────────────
export const ccSaveTokens = (tokens) => {
  try { localStorage.setItem(LS_CC_TOKENS, JSON.stringify(tokens)); } catch {}
};

export const ccLoadTokens = () => {
  try { return JSON.parse(localStorage.getItem(LS_CC_TOKENS) || 'null'); } catch { return null; }
};

export const ccClearTokens = () => {
  try { localStorage.removeItem(LS_CC_TOKENS); } catch {}
};

export const ccIsConnected = () => {
  const t = ccLoadTokens();
  return !!(t && t.access_token);
};

// ── STEP 1: Open CC OAuth (simple auth code — no PKCE) ───────────────────────
export const ccAuthorize = () => {
  const params = new URLSearchParams({
    client_id:     CC_CLIENT_ID,
    redirect_uri:  CC_REDIRECT_URI,
    response_type: 'code',
    scope:         'contact_data campaign_data',
    state:         Math.random().toString(36).slice(2),
  });
  window.location.href = `${CC_AUTH_URL}?${params}`;
};

// ── STEP 2: Exchange auth code via Edge Function proxy ────────────────────────
export const ccExchangeCode = async (code) => {
  if (!CC_TOKEN_PROXY) throw new Error('VITE_CC_TOKEN_PROXY_URL not configured');

  const res = await fetch(CC_TOKEN_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type:   'authorization_code',
      code,
      redirect_uri: CC_REDIRECT_URI,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`CC token exchange failed: ${JSON.stringify(data)}`);
  }

  const tokens = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    Date.now() + (data.expires_in || 7200) * 1000,
  };
  ccSaveTokens(tokens);
  return tokens;
};

// ── STEP 3: Get valid access token (auto-refresh via Edge Function) ───────────
export const ccGetToken = async () => {
  const tokens = ccLoadTokens();
  if (!tokens) throw new Error('Not connected to Constant Contact');

  if (Date.now() >= tokens.expires_at - 300_000) {
    if (!CC_TOKEN_PROXY) throw new Error('VITE_CC_TOKEN_PROXY_URL not configured');

    const res = await fetch(CC_TOKEN_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'refresh_token',
        refresh_token: tokens.refresh_token,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      ccClearTokens();
      throw new Error('CC token refresh failed — please reconnect');
    }

    const fresh = {
      access_token:  data.access_token,
      refresh_token: data.refresh_token || tokens.refresh_token,
      expires_at:    Date.now() + (data.expires_in || 7200) * 1000,
    };
    ccSaveTokens(fresh);
    return fresh.access_token;
  }

  return tokens.access_token;
};

// ── CC API HELPER ─────────────────────────────────────────────────────────────
const ccFetch = async (path, opts = {}) => {
  const token = await ccGetToken();
  const res = await fetch(`${CC_API_BASE}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`CC API ${path} failed (${res.status}): ${err}`);
  }
  return res.status === 204 ? null : res.json();
};

// ── GET CONTACT LISTS ─────────────────────────────────────────────────────────
export const ccGetLists = async () => {
  const data = await ccFetch('/contact_lists?include_count=true&status=ACTIVE');
  return (data?.lists || []).map(l => ({ id: l.list_id, name: l.name, count: l.membership_count }));
};

// ── SYNC LEADS TO CC LIST ─────────────────────────────────────────────────────
export const ccSyncLeads = async (leads, listId) => {
  if (!listId) throw new Error('No CC list selected');

  const contacts = leads
    .filter(l => l.phone || l.email)
    .map(l => {
      const contact = {
        first_name:       l.firstName || l.name?.split(' ')[0] || '',
        last_name:        l.lastName  || l.name?.split(' ').slice(1).join(' ') || '',
        list_memberships: [listId],
        phone_numbers:    [],
        street_addresses: [],
      };
      if (l.email) contact.email_address = { address: l.email, permission_to_send: 'implicit' };
      if (l.phone) contact.phone_numbers.push({ phone_number: l.phone.replace(/\D/g,''), kind: 'home' });
      if (l.state) contact.street_addresses.push({ state: l.state, kind: 'home' });
      if (l.city)  contact.street_addresses[0] = { ...contact.street_addresses[0], city: l.city };
      return contact;
    });

  if (!contacts.length) throw new Error('No contacts with phone or email to sync');

  const result = await ccFetch('/activities/contacts', {
    method: 'POST',
    body: JSON.stringify({
      import_data:  contacts,
      list_ids:     [listId],
      column_names: ['first_name','last_name','email','phone_number','state','city'],
    }),
  });

  return {
    activityId: result?.activity_id,
    status:     result?.state || 'submitted',
    count:      contacts.length,
  };
};
