"use client";
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useLatestRead } from './useLatestRead';

export function useCrmDefaultHours(kind: 'inquiry' | 'task', enabled = true) {
  const [hours, setHours] = useState<number | null>(null), [error, setError] = useState('');
  const beginRead = useLatestRead();
  useEffect(() => {
    if (!enabled) return;
    const request = beginRead();
    void api.get('/crm/settings', { signal: request.signal }).then(response => {
      if (!request.isCurrent()) return;
      const value = response.data.data[kind === 'inquiry' ? 'defaultInquiryHours' : 'defaultTaskHours'] ?? (kind === 'inquiry' ? 1 : 24);
      if (!Number.isInteger(value) || value < 1 || value > 168) throw new Error('Invalid workflow default');
      setHours(value);
    }).catch(() => { if (request.isCurrent()) setError('The organization’s due-time default is unavailable. Verify the chosen due time before saving.'); });
  }, [beginRead, enabled, kind]);
  return { hours, error };
}
