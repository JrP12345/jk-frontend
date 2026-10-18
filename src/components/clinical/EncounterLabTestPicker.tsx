"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Alert, Button, Select } from "@/components/ui";

interface CatalogTest { id?: string; _id?: string; name: string; code?: string }

export function EncounterLabTestPicker({ locationId, value, onChange, disabled }: {
  locationId: string; value: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  const [tests, setTests] = useState<CatalogTest[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    const params = new URLSearchParams({ locationId, page: String(page), limit: "100" });
    void api.get(`/lab-tests?${params}`, { signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      const items: CatalogTest[] = Array.isArray(response.data?.data) ? response.data.data : [];
      setTests(previous => {
        const records = page === 1 ? items : [...previous, ...items];
        return [...new Map(records.filter(test => test.id || test._id).map(test => [test.id || test._id, test])).values()];
      });
      setMore(Number(response.headers?.["x-total-pages"]) > page);
    }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [locationId, page, retry]);

  return <div className="space-y-2">
    <Select label="Lab test *" searchable value={value} required disabled={disabled || !tests.length}
      placeholder={loading ? "Loading tests…" : "Choose a test"}
      onChange={event => onChange(event.target.value)}
      options={tests.map(test => ({ value: test.id || test._id!, label: test.name + (test.code ? ` (${test.code})` : "") }))} />
    {loading && <p role="status" className="text-xs text-text-muted">Loading test catalog…</p>}
    {error ? <Alert variant="error" title="Test catalog unavailable" action={<Button variant="outline" size="sm" onClick={() => setRetry(current => current + 1)}>Try again</Button>}>Retry to choose a test from this location.</Alert>
      : !loading && !tests.length ? <p className="text-xs text-text-muted">No tests are configured for this location. Ask an administrator to update the catalog.</p> : null}
    {more && !error && <Button variant="outline" size="sm" disabled={loading || disabled} onClick={() => setPage(current => current + 1)}>Load more tests</Button>}
  </div>;
}
