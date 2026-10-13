import api from './api';
import type { CrmLocation } from '@/types/crm';
export class CrmBranchScopeError extends Error {}

/** Bounded pages; never silently omit authorized branch choices. */
export async function getCrmLocations(signal: AbortSignal, endpoint = '/crm/locations') {
  const locations: CrmLocation[] = [];
  for (let page = 1; page <= 5; page++) {
    const response = await api.get(endpoint, { params: { page, limit: 200 }, signal });
    locations.push(...response.data.data);
    const totalPages = Number(response.headers?.['x-total-pages'] || 1);
    if (totalPages <= page) return locations;
  }
  throw new CrmBranchScopeError('This CRM branch selector supports up to 1,000 authorized branches. Ask an administrator to review a narrower branch workspace.');
}
