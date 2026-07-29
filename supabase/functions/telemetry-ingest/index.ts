// LLM-Guard Telemetry Ingestion Edge Function
// Receives structured JSON security events from the pipeline, stores them in
// prompt_logs, evaluates alert conditions, and fires alerts + notifications.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface IngestEvent {
  eventId: string;
  timestamp?: string;
  userId?: string;
  organizationId: string;
  sessionId?: string;
  requestId?: string;
  sourceIP?: string;
  promptHash?: string;
  promptStatus: 'allowed' | 'blocked' | 'flagged';
  pipelineStage: 'ingest' | 'inspection' | 'ml_scoring' | 'dlp' | 'policy' | 'response';
  triggeredRule?: string;
  MLScore?: number;
  DLPDetected?: boolean;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  responseTime?: number;
  backendVersion?: string;
  rawPayload?: Record<string, unknown>;
}

function genId(prefix: string) {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return prefix + '-' + Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as IngestEvent | IngestEvent[];
    const events = Array.isArray(body) ? body : [body];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const inserted: string[] = [];
    const generatedAlerts: string[] = [];

    for (const ev of events) {
      const eventId = ev.eventId || genId('evt');
      const row = {
        event_id: eventId,
        timestamp: ev.timestamp ? new Date(ev.timestamp).toISOString() : new Date().toISOString(),
        user_id: ev.userId ?? null,
        organization_id: ev.organizationId,
        session_id: ev.sessionId ?? null,
        request_id: ev.requestId ?? null,
        source_ip: ev.sourceIP ?? null,
        prompt_hash: ev.promptHash ?? null,
        prompt_status: ev.promptStatus,
        pipeline_stage: ev.pipelineStage,
        triggered_rule: ev.triggeredRule ?? null,
        ml_score: ev.MLScore ?? null,
        dlp_detected: ev.DLPDetected ?? false,
        severity: ev.severity,
        response_time_ms: ev.responseTime ?? null,
        backend_version: ev.backendVersion ?? '1.0.0',
        raw_payload: ev.rawPayload ?? null,
      };

      const { data, error } = await supabase
        .from('prompt_logs')
        .insert(row)
        .select('id, event_id, organization_id, prompt_status, triggered_rule, ml_score, dlp_detected, severity')
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      inserted.push(eventId);

      // --- Alert evaluation ---
      const alertsToInsert: Record<string, unknown>[] = [];
      const isJailbreak = ev.triggeredRule?.toLowerCase().includes('jailbreak') || ev.triggeredRule?.toLowerCase().includes('dan');
      const isInjection = ev.triggeredRule?.toLowerCase().includes('injection') || ev.triggeredRule?.toLowerCase().includes('ignore previous');
      const isDLP = !!ev.DLPDetected;
      const isHighML = typeof ev.MLScore === 'number' && ev.MLScore > 0.95;

      const make = (type: string, severity: string, message: string) => ({
        alert_id: genId('alr'),
        timestamp: new Date().toISOString(),
        type,
        severity,
        user_id: ev.userId ?? null,
        organization_id: ev.organizationId,
        prompt_log_id: data.id,
        message,
      });

      if (isJailbreak) alertsToInsert.push(make('jailbreak', 'critical', `Jailbreak attempt blocked: ${ev.triggeredRule}`));
      if (isInjection) alertsToInsert.push(make('prompt_injection', 'high', `Prompt injection detected: ${ev.triggeredRule}`));
      if (isDLP) alertsToInsert.push(make('dlp_violation', 'high', `DLP violation: sensitive data detected in prompt`));
      if (isHighML) alertsToInsert.push(make('ml_high_confidence', 'medium', `ML model confidence ${(ev.MLScore! * 100).toFixed(1)}% on threat`));

      if (alertsToInsert.length > 0) {
        const { data: alertRows } = await supabase.from('alerts').insert(alertsToInsert).select('alert_id');
        if (alertRows) for (const a of alertRows) generatedAlerts.push(a.alert_id);
      }
    }

    return new Response(
      JSON.stringify({ ingested: inserted.length, eventIds: inserted, alerts: generatedAlerts }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
