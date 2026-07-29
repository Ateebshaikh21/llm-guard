import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PromptLog } from './types';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportJSON(logs: PromptLog[], filename = 'prompt_logs.json') {
  download(new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' }), filename);
}

export function exportCSV(logs: PromptLog[], filename = 'prompt_logs.csv') {
  const cols = [
    'event_id', 'timestamp', 'user_id', 'source_ip', 'prompt_status',
    'pipeline_stage', 'triggered_rule', 'ml_score', 'dlp_detected',
    'severity', 'response_time_ms', 'backend_version',
  ] as const;
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(',');
  const rows = logs.map((l) => cols.map((c) => esc(l[c])).join(','));
  download(new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' }), filename);
}

export function exportPDF(logs: PromptLog[], filename = 'prompt_logs.pdf') {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text('LLM-Guard — Prompt Log Export', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toISOString()}  |  ${logs.length} records`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [['Event ID', 'Timestamp', 'Status', 'Severity', 'Triggered Rule', 'ML Score', 'DLP', 'Resp ms']],
    body: logs.map((l) => [
      l.event_id.slice(0, 12),
      new Date(l.timestamp).toLocaleString(),
      l.prompt_status,
      l.severity,
      l.triggered_rule ?? '—',
      l.ml_score != null ? (l.ml_score).toFixed(3) : '—',
      l.dlp_detected ? 'Yes' : 'No',
      l.response_time_ms ?? '—',
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [13, 20, 36], textColor: [0, 229, 255] },
    alternateRowStyles: { fillColor: [17, 26, 46] },
  });

  doc.save(filename);
}
