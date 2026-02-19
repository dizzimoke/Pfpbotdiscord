import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify Admin Password
    const adminPassword = req.headers.get('x-admin-password');
    if (adminPassword !== Deno.env.get('ADMIN_PASSWORD')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Admin Password' }), { status: 401, headers: corsHeaders });
    }

    // 2. Init Supabase (Service Role)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Update Settings
    const { discord_webhook_url, giphy_api_key, enabled, combo_interval_minutes } = await req.json();

    // Validate inputs
    if (!discord_webhook_url || !giphy_api_key) {
      throw new Error('Missing required fields');
    }

    const updates = [
      { key: 'discord_webhook_url', value: discord_webhook_url },
      { key: 'giphy_api_key', value: giphy_api_key },
      { key: 'enabled', value: String(enabled) },
      { key: 'combo_interval_minutes', value: String(combo_interval_minutes) }
    ];

    const { error } = await supabase.from('bot_settings').upsert(updates);

    if (error) throw error;

    return new Response(JSON.stringify({ status: 'updated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
