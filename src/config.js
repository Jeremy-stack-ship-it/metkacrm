// ════════════════════════════════════════════════════════════════════════════
//  WHITE-LABEL CONFIG  —  edit THIS ONE FILE to brand the CRM for a new agent.
//  Every name, phone, link, and NPN in the app reads from BRAND below.
//  (Supabase keys are NOT here — they live in the .env file as
//   VITE_SUPABASE_URL / VITE_SUPABASE_KEY, one per agent's own project.)
// ════════════════════════════════════════════════════════════════════════════

export const BRAND = {
  name:         'Jeremy Metka',                 // full name (prospect-facing copy)
  first:        'Jeremy',                        // first name only
  title:        'Senior Field Underwriter',      // your title
  org:          'Ministry of Protection',        // INTERNAL team name (never prospect-facing)
  npn:          '21425108',                      // National Producer Number
  business:     'Metka Solutions',               // public business name (email signatures)
  email:        'Jeremy@metkasolutions.com',
  phoneDisplay: '(580) 263-5409',                // your Twilio number, display format
  phoneE164:    '+15802635409',
  calendly:     'https://calendly.com/metkasolutions/20min',
  card:         'https://hihello.me/p/6cc69b25-86ec-4c39-a45b-fd48bee85403',
};
