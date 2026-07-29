// LLM-Guard Analytics Edge Function
// Computes daily/weekly/monthly request counts, block rate, detection rate,
// average response time, most attacked users, and most triggered rules for an org.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId');
    const range = url.searchParams.get('range') ?? 'daily'; // daily|weekly|monthly
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'organizationId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const days = range === 'monthly' ? 30 : range === 'weekly' ? 7 : 1;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: logs, error } = await supabase
      .from('prompt_logs')
      .select('user_id, prompt_status, triggered_rule, dlp_detected, response_time_ms, severity')
      .eq('organization_id', orgId)
      .gte('timestamp', since);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const total = logs?.length ?? 0;
    const blocked = logs?.filter((l) => l.prompt_status === 'blocked').length ?? 0;
    const allowed = logs?.filter((l) => l.prompt_status === 'allowed').length ?? 0;
    const dlp = logs?.filter((l) => l.dlp_detected).length ?? 0;
    const respTimes = logs?.filter((l) => l.response_time_ms != null).map((l) => l.response_time_ms as number) ?? [];
    const avgResp = respTimes.length ? respTimes.reduce((a, b) => a + b, 0) / respTimes.length : 0;

    const userCounts = new Map<string, number>();
    const ruleCounts = new Map<string, number>();
    for (const l of logs ?? []) {
      if (l.user_id) userCounts.set(l.user_id, (userCounts.get(l.user_id) ?? 0) + 1);
      if (l.triggered_rule) ruleCounts.set(l.triggered_rule, (ruleCounts.get(l.triggered_rule) ?? 0) + 1);
    }
    const topUsers = [...userCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topRules = [...ruleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    // resolve user emails
    const userIds = topUsers.map((u) => u[0]);
    let userMap = new Map<string, string>();
    if (userIds.length) {
      const { data: users } = await supabase.from('users').select('id, email').in('id', userIds);
      for (const u of users ?? []) userMap.set(u.id, u.email);
    }

    const stats = {
      range,
      totalRequests: total,
      blockedRequests: blocked,
      allowedRequests: allowed,
      dlpDetections: dlp,
      blockRate: total ? blocked / total : 0,
      detectionRate: total ? dlp / total : 0,
      averageResponseTimeMs: Math.round(avgResp * 100) / 100,
      mostAttackedUsers: topUsers.map(([id, count]) => ({ userId: id, email: userMap.get(id) ?? id, count })),
      mostTriggeredRules: topRules.map(([rule, count]) => ({ rule, count })),
    };

    return new Response(JSON.stringify(stats), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
