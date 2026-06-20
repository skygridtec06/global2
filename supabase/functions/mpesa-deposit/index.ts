import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PayHero configuration (same as BetNexa)
const PAYHERO_API_KEY = '6CUxNcfi9jRpr4eWicAn';
const PAYHERO_API_SECRET = 'j6zP2XpAlXn9UhtHOj9PbYQVAdlQnkeyrEWuFOAH';
const PAYHERO_CHANNEL_ID = 3398;
const PAYHERO_ENDPOINT = 'https://backend.payhero.co.ke/api/v2/payments';

function generateBasicAuth(): string {
  const encoded = btoa(`${PAYHERO_API_KEY}:${PAYHERO_API_SECRET}`);
  return `Basic ${encoded}`;
}

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s\-\(\)]/g, '');
  if (/^0[1679]/.test(normalized)) {
    normalized = '254' + normalized.substring(1);
  } else if (!/^254/.test(normalized)) {
    normalized = '254' + normalized;
  }
  return normalized;
}

// In-memory payment tracking (per edge function instance)
const paymentStore = new Map<string, { status: string; amount: number; userId: string; createdAt: number }>();

// Clean old entries (older than 15 minutes)
function cleanOldPayments() {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [key, val] of paymentStore) {
    if (val.createdAt < cutoff) paymentStore.delete(key);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop() || '';

  try {
    // POST - Initiate STK Push
    if (req.method === 'POST' && (path === 'mpesa-deposit' || path === 'initiate' || path === '')) {
      const body = await req.json();
      const { amount, phoneNumber, userId } = body;

      if (!amount || !phoneNumber || !userId) {
        return new Response(JSON.stringify({ success: false, message: 'Missing amount, phoneNumber, or userId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const numAmount = parseFloat(amount);
      if (numAmount < 1) {
        return new Response(JSON.stringify({ success: false, message: 'Amount must be at least KES 1' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const normalizedPhone = normalizePhone(phoneNumber);
      const externalReference = `GB-DEP-${Date.now()}-${userId}`;
      const callbackUrl = `https://server-tau-puce.vercel.app/api/callbacks/payhero`;

      const payload = {
        amount: numAmount,
        phone_number: normalizedPhone,
        channel_id: PAYHERO_CHANNEL_ID,
        provider: 'm-pesa',
        external_reference: externalReference,
        callback_url: callbackUrl,
      };

      console.log('📡 Sending STK Push:', { phone: normalizedPhone, amount: numAmount, ref: externalReference });

      const response = await fetch(PAYHERO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': generateBasicAuth(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ PayHero Error:', response.status, data);
        return new Response(JSON.stringify({
          success: false,
          message: data.error || data.message || `PayHero error: ${response.status}`,
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('✅ STK Push sent:', data);

      // Store payment for status tracking
      cleanOldPayments();
      paymentStore.set(externalReference, {
        status: 'PENDING',
        amount: numAmount,
        userId,
        createdAt: Date.now(),
      });

      return new Response(JSON.stringify({
        success: true,
        externalReference,
        data,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET - Check payment status
    if (req.method === 'GET') {
      const ref = url.searchParams.get('ref');
      if (!ref) {
        return new Response(JSON.stringify({ success: false, message: 'Missing ref parameter' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check the BetNexa backend for status (it stores callbacks from PayHero)
      try {
        const statusResponse = await fetch(
          `https://server-tau-puce.vercel.app/api/payments/status/${encodeURIComponent(ref)}`
        );
        const statusData = await statusResponse.json();

        if (statusData.success && statusData.payment) {
          const paymentStatus = statusData.payment.status;
          return new Response(JSON.stringify({
            success: true,
            status: paymentStatus === 'Success' ? 'completed' : paymentStatus === 'Failed' ? 'failed' : 'pending',
            payment: statusData.payment,
          }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (err) {
        console.warn('⚠️ Backend status check failed:', err);
      }

      // Fallback to local store
      const local = paymentStore.get(ref);
      return new Response(JSON.stringify({
        success: true,
        status: local?.status === 'SUCCESS' ? 'completed' : 'pending',
        payment: local || null,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
