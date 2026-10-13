"use client";
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { hasAnyPermission } from '@/lib/permissions';
import { authScopeKey } from '@/lib/authScope';
import { useLatestRead } from '@/hooks/useLatestRead';
import { Alert, Button, Modal } from '@/components/ui';
interface Reply { id: string; text: string; type: string; contactHint: string; createdAt: string }
export function InquiryReplies({ inquiryId }: { inquiryId: string }) {
  const user = useAuthStore(state => state.user), [open, setOpen] = useState(false);
  if (!hasAnyPermission(user, 'COMMUNICATE_PATIENTS')) return null;
  return <><Button variant="outline" onClick={() => setOpen(true)}>Reviewed replies</Button>{open && <Replies key={`${authScopeKey(user)}:${inquiryId}`} inquiryId={inquiryId} onClose={() => setOpen(false)} />}</>;
}
function Replies({ inquiryId, onClose }: { inquiryId: string; onClose: () => void }) {
  const [items, setItems] = useState<Reply[]>([]), [cursor, setCursor] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), beginRead = useLatestRead();
  const load = useCallback(async (next?: string) => {
    const read = beginRead(); setLoading(true); setError('');
    try { const response = await api.get('/crm/communications/inbound', { params: { inquiryId, ...(next ? { cursor: next } : {}) }, signal: read.signal }); if (read.isCurrent()) { setItems(current => next ? [...new Map([...current, ...response.data.data.items].map((row: Reply) => [row.id, row])).values()] : response.data.data.items); setCursor(response.data.data.nextCursor); } }
    catch { if (read.isCurrent()) setError('Reviewed replies could not be loaded. Reload to try again.'); } finally { if (read.isCurrent()) setLoading(false); }
  }, [beginRead, inquiryId]);
  useEffect(() => { void load(); }, [load]);
  return <Modal open title="Reviewed inquiry replies" size="lg" onClose={onClose}><div className="space-y-3"><p>Replies explicitly routed by staff. An incoming message does not establish identity or grant consent. Replies expire after the communication retention period.</p>{error && <Alert variant="error">{error}</Alert>}<Button variant="outline" loading={loading} onClick={() => load()}>Reload reviewed replies</Button>{loading && <p role="status">Loading replies...</p>}{!loading && !items.length && <p>No retained replies linked to this inquiry.</p>}{items.map(row => <div key={row.id} className="border border-border rounded-lg p-3"><p>Contact ending {row.contactHint} · {new Date(row.createdAt).toLocaleString()}</p><p className="whitespace-pre-wrap break-words">{row.text || `${row.type} reply. Review through the authorized sender account.`}</p></div>)}{cursor && <Button variant="outline" disabled={loading} onClick={() => load(cursor)}>More reviewed replies</Button>}</div></Modal>;
}
