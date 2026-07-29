// LLM-Guard Export Edge Function
// Exports filtered prompt_logs as CSV or JSON. PDF is generated client-side.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ExportFilters {
  organizationId: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  rule?: string;
  severity?: string;
  status?: string;
  format?: 'csv' | 'json';
}

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = (await req.json()) as ExportFilters;
    const format = body.format ?? 'json';
    if (!body.organizationId) {
      return new Response(JSON.stringify({ error: 'organizationId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let q = supabase
      .from('prompt_logs')
      .select('event_id,timestamp,user_id,organization_id,session_id,request_id,source_ip,prompt_hash,prompt_status,pipeline_stage,triggered_rule,ml_score,dlp_detected,severity,response_time_ms,backend_version')
      .eq('organization_id', body.organizationId)
      .order('timestamp', { ascending: false })
      .limit(5000);

    if (body.userId) q = q.eq('user_id', body.userId);
    if (body.startDate) q = q.gte('timestamp', body.startDate);
    if (body.endDate) q = q.lte('timestamp', body.endDate);
    if (body.rule) q = q.eq('triggered_rule', body.rule);
    if (body.severity) q = q.eq('severity', body.severity);
    if (body.status) q = q.eq('prompt_status', body.status);

    const { data, error } = await q;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (format === 'json') {
      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="prompt_logs.json"' },
      });
    }

    const cols = ['event_id','timestamp','user_id','source_ip','prompt_status','pipeline_stage','triggered_rule','ml_score','dlp_detected','severity','response_time_ms','backend_version'];
    const header = cols.join(',');
    const rows = (data ?? []).map((r: Record<string, unknown>) => cols.map((c) => csvEscape(r[c])).join(','));
    const csv = [header, ...rows].join('\n');
    return new Response(csv, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="prompt_logs.csv"' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
