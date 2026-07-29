// LLM-Guard SIEM Webhook Edge Function
// Forwards an alert payload to a configured Wazuh / SIEM webhook URL.
// The webhook URL is read from the SIEM_WEBHOOK_URL secret (if set); otherwise
// the caller may pass webhookUrl in the body.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = (await req.json()) as { alert: Record<string, unknown>; webhookUrl?: string };
    const url = body.webhookUrl ?? Deno.env.get('SIEM_WEBHOOK_URL');
    if (!url) {
      return new Response(JSON.stringify({ error: 'No SIEM webhook URL configured. Set SIEM_WEBHOOK_URL secret or pass webhookUrl.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = {
      source: 'llm-guard',
      timestamp: new Date().toISOString(),
      ...body.alert,
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return new Response(JSON.stringify({ forwarded: true, status: resp.status }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
