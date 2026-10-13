import { afterEach, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { getCrmLocations } from '@/lib/crmLocations';
afterEach(() => vi.restoreAllMocks());
it('reads all bounded branch pages with the caller cancellation signal', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValueOnce({ data: { data: [{ id: 'a', name: 'A' }] }, headers: { 'x-total-pages': '2' } })
    .mockResolvedValueOnce({ data: { data: [{ id: 'b', name: 'B' }] }, headers: { 'x-total-pages': '2' } });
  const signal = new AbortController().signal;
  expect(await getCrmLocations(signal)).toEqual([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  expect(get.mock.calls.map(call => call[1])).toEqual([{ params: { page: 1, limit: 200 }, signal }, { params: { page: 2, limit: 200 }, signal }]);
});
it('fails closed rather than silently excluding branches above the selector bound', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [] }, headers: { 'x-total-pages': '6' } });
  await expect(getCrmLocations(new AbortController().signal)).rejects.toThrow('narrower branch workspace');
  expect(get).toHaveBeenCalledTimes(5);
});
