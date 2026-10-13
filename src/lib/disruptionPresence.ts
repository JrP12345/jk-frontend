export type DisruptionPresence = 'waiting' | 'remote' | 'unknown';
export function disruptionPresence(visit: { status: string; disruptionOriginalStatus?: string }): DisruptionPresence {
  if (visit.status === 'checked-in') return 'waiting';
  if (visit.status !== 'disruption_triage') return 'unknown';
  if (visit.disruptionOriginalStatus === 'checked-in') return 'waiting';
  if (['confirmed', 'pending', 'pending_payment'].includes(visit.disruptionOriginalStatus || '')) return 'remote';
  return 'unknown';
}
