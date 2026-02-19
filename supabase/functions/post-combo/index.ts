import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Init Supabase (Service Role)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Load Settings
    const { data: settings } = await supabase.from('bot_settings').select('*');
    const config = settings?.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});

    if (config.enabled !== 'true') {
      return new Response(JSON.stringify({ status: 'disabled' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!config.discord_webhook_url || !config.giphy_api_key) {
      throw new Error('Missing configuration');
    }

    // 3. Load Job State
    const { data: jobState } = await supabase.from('job_state').select('value').eq('key', 'rotation').single();
    let currentStyleIndex = jobState?.value?.last_style_index || 0;

    const styleTags = [
      "dark anime", "white anime", "protagonist anime", "anime aesthetic",
      "black and white anime", "cool anime", "cute anime", "anime profile", "anime header"
    ];

    // 4. Check Queue & Refill
    const { count: iconCount } = await supabase.from('media_queue').select('*', { count: 'exact', head: true }).eq('type', 'icon');
    const { count: bannerCount } = await supabase.from('media_queue').select('*', { count: 'exact', head: true }).eq('type', 'banner');

    const logs: string[] = [];

    // Refill Logic
    if ((iconCount || 0) < 20 || (bannerCount || 0) < 20) {
      const styleTag = styleTags[currentStyleIndex];
      logs.push(`Refilling for style: ${styleTag}`);

      // Helper to fetch GIPHY
      const fetchGiphy = async (type: 'icon' | 'banner') => {
        const query = type === 'icon' 
          ? `anime pfp gif ${styleTag} -meme -funny -reaction -cat -dog -real -irl`
          : `anime banner ${styleTag} -meme -funny -reaction -real -irl`;
        
        const offset = Math.floor(Math.random() * 50);
        const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${config.giphy_api_key}&q=${encodeURIComponent(query)}&limit=50&offset=${offset}&rating=pg-13&lang=en`);
        const data = await res.json();
        return data.data || [];
      };

      const [icons, banners] = await Promise.all([
        (iconCount || 0) < 20 ? fetchGiphy('icon') : Promise.resolve([]),
        (bannerCount || 0) < 20 ? fetchGiphy('banner') : Promise.resolve([])
      ]);

      // Filter & Insert
      const processItems = async (items: any[], type: 'icon' | 'banner') => {
        const validItems = [];
        for (const item of items) {
          // Filter
          const text = ((item.title||"") + (item.username||"") + (item.slug||"")).toLowerCase();
          const blocked = ["meme","reaction","funny","tiktok","instagram","youtube","movie","tv","real","irl","cat","dog"];
          const required = ["anime","manga","waifu","chibi","kawaii","otaku","anime girl","anime boy"];
          
          if (blocked.some(k => text.includes(k))) continue;
          if (!required.some(k => text.includes(k))) continue;

          const img = item.images?.original;
          if (!img?.width || !img?.height) continue;
          
          const ratio = parseInt(img.width) / parseInt(img.height);
          if (type === 'icon' && (ratio < 0.85 || ratio > 1.15)) continue;
          if (type === 'banner' && ratio < 1.7) continue;

          validItems.push({
            type,
            style_tag: styleTag,
            url: img.url,
            width: parseInt(img.width),
            height: parseInt(img.height)
          });
        }
        
        if (validItems.length > 0) {
          await supabase.from('media_queue').upsert(validItems, { onConflict: 'url', ignoreDuplicates: true });
        }
        return validItems.length;
      };

      const newIcons = await processItems(icons, 'icon');
      const newBanners = await processItems(banners, 'banner');
      logs.push(`Refilled: ${newIcons} icons, ${newBanners} banners`);

      // Rotate Style
      currentStyleIndex = (currentStyleIndex + 1) % styleTags.length;
      await supabase.from('job_state').upsert({ key: 'rotation', value: { last_style_index: currentStyleIndex } });
    }

    // 5. Pick Combo
    // Try to find matching style first
    const { data: icon } = await supabase.from('media_queue').select('*').eq('type', 'icon').limit(1).single();
    
    if (!icon) {
      return new Response(JSON.stringify({ status: 'empty_queue', logs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Try to find banner with same style
    let { data: banner } = await supabase.from('media_queue').select('*').eq('type', 'banner').eq('style_tag', icon.style_tag).limit(1).single();
    
    // Fallback to any banner
    if (!banner) {
       const { data: anyBanner } = await supabase.from('media_queue').select('*').eq('type', 'banner').limit(1).single();
       banner = anyBanner;
    }

    if (!banner) {
       // Discard icon if no banner available to maintain combo
       await supabase.from('media_queue').delete().eq('id', icon.id);
       return new Response(JSON.stringify({ status: 'missing_banner', logs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 6. Post to Discord
    const postWebhook = async (item: any) => {
      const payload = {
        embeds: [{
          image: { url: item.url },
          footer: { text: `${item.style_tag} • ${item.type.toUpperCase()} • Auto-Posted` },
          color: 0xFF69B4
        }]
      };
      
      const res = await fetch(config.discord_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        if (retryAfter) {
            await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
            await fetch(config.discord_webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
      }
    };

    await postWebhook(icon);
    await new Promise(r => setTimeout(r, 1500)); // Wait 1.5s
    await postWebhook(banner);

    // 7. Cleanup
    await supabase.from('used_urls').insert([{ url: icon.url }, { url: banner.url }]);
    await supabase.from('media_queue').delete().in('id', [icon.id, banner.id]);

    return new Response(JSON.stringify({ 
      status: 'posted', 
      combo: { icon: icon.url, banner: banner.url },
      logs 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
