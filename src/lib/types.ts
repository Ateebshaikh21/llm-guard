export type UserRole = 'admin' | 'soc_analyst' | 'employee';
export type PromptStatus = 'allowed' | 'blocked' | 'flagged';
export type PipelineStage = 'ingest' | 'inspection' | 'ml_scoring' | 'dlp' | 'policy' | 'response';
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type RuleType = 'injection' | 'jailbreak' | 'dlp' | 'prompt_leak' | 'toxicity' | 'custom';
export type RuleAction = 'block' | 'flag' | 'log' | 'allow';
export type AuditAction =
  | 'login' | 'logout' | 'rule_change' | 'admin_action'
  | 'red_team_exec' | 'rbac_change' | 'api_config_change';
export type AlertType =
  | 'jailbreak' | 'prompt_injection' | 'dlp_violation'
  | 'failed_logins' | 'firewall_disabled' | 'ml_high_confidence';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  organization_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface PromptLog {
  id: string;
  event_id: string;
  timestamp: string;
  user_id: string | null;
  organization_id: string;
  session_id: string | null;
  request_id: string | null;
  source_ip: string | null;
  prompt_hash: string | null;
  prompt_status: PromptStatus;
  pipeline_stage: PipelineStage;
  triggered_rule: string | null;
  ml_score: number | null;
  dlp_detected: boolean;
  severity: Severity;
  response_time_ms: number | null;
  backend_version: string | null;
  raw_payload: Record<string, unknown> | null;
}

export interface AuditLog {
  id: string;
  event_id: string;
  timestamp: string;
  actor_id: string | null;
  actor_role: UserRole | null;
  action: AuditAction;
  target_type: string | null;
  target_id: string | null;
  organization_id: string | null;
  ip_address: string | null;
  details: Record<string, unknown> | null;
}

export interface Alert {
  id: string;
  alert_id: string;
  timestamp: string;
  type: AlertType;
  severity: Severity;
  user_id: string | null;
  organization_id: string;
  prompt_log_id: string | null;
  message: string;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

export interface FirewallRule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  rule_type: RuleType;
  pattern: string | null;
  severity: Severity;
  action: RuleAction;
  is_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Statistics {
  id: string;
  organization_id: string;
  stat_date: string;
  total_prompts: number;
  blocked_prompts: number;
  allowed_prompts: number;
  dlp_detections: number;
  block_rate: number;
  detection_rate: number;
  avg_response_time_ms: number;
  rule_triggers: Record<string, number> | null;
}

export interface Session {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  source_ip: string | null;
  user_agent: string | null;
  started_at: string;
  ended_at: string | null;
}
