# Supabase Edge Function Setup

## One-time setup (do this once)

### 1. Install Supabase CLI (if not already installed)
```
npm install -g supabase
```

### 2. Link your project
From inside the metka-crm folder:
```
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```
(Find your project ref in Supabase dashboard URL: supabase.com/dashboard/project/YOUR_PROJECT_REF)

### 3. Set Twilio secrets
```
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token_here
supabase secrets set TWILIO_FROM_NUMBER=+14055551234
```

### 4. Set Apps Script URL secret (after you deploy the Apps Script)
```
supabase secrets set APPS_SCRIPT_EMAIL_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

### 5. Deploy the Edge Functions
```
supabase functions deploy send-sms
supabase functions deploy process-sequence
```

### 6. Enable the daily cron (process-sequence)
In Supabase dashboard → Database → Extensions → enable `pg_cron`
Then in SQL editor run:
```sql
select cron.schedule(
  'daily-sequence-processor',
  '0 8 * * *',  -- 8:00 AM UTC daily
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-sequence',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```
Replace YOUR_PROJECT_REF and YOUR_ANON_KEY (find anon key in Supabase dashboard → Settings → API).
