import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';

// In-memory cache: key → { data, timestamp }
const cache = new Map<string, { data: any; timestamp: number }>();

// Cache TTL in milliseconds per endpoint type
function getCacheTTL(endpoint: string, params: URLSearchParams): number {
  if (endpoint === 'odds/live') return 15_000;  // live odds: 15s (most time-sensitive)
  if (params.has('live')) return 20_000;         // live fixtures: 20s
  if (endpoint === 'odds') return 30_000;        // pre-match odds: 30s
  return 60_000;                                 // everything else: 60s
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const API_KEY = Deno.env.get('API_FOOTBALL_KEY');
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'API_FOOTBALL_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') || 'fixtures';
    const params = new URLSearchParams();

    // Forward all query params except 'endpoint'
    url.searchParams.forEach((value, key) => {
      if (key !== 'endpoint') params.set(key, value);
    });

    const apiUrl = `${API_FOOTBALL_BASE}/${endpoint}?${params.toString()}`;
    const cacheKey = apiUrl;
    const ttl = getCacheTTL(endpoint, params);

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < ttl) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(apiUrl, {
      headers: { 'x-apisports-key': API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      // If we have stale cache, serve it instead of erroring
      if (cached) {
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'STALE' },
        });
      }
      const errorText = await response.text();
      console.error(`API-Football error [${response.status}]: ${errorText}`);
      return new Response(JSON.stringify({ error: `API-Football returned ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    // Store in cache
    cache.set(cacheKey, { data, timestamp: Date.now() });

    // Evict old entries if cache grows too large (keep max 50)
    if (cache.size > 50) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < oldest.length - 50; i++) {
        cache.delete(oldest[i][0]);
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  } catch (error) {
    // On timeout or network error, try serving stale cache
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') || 'fixtures';
    const params = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (key !== 'endpoint') params.set(key, value);
    });
    const cacheKey = `${API_FOOTBALL_BASE}/${endpoint}?${params.toString()}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'STALE' },
      });
    }

    console.error('Edge function error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
