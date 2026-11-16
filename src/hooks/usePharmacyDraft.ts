"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPharmacyDraftClient, type CounterDraft } from "@/lib/pharmacyDrafts";

export function usePharmacyDraft(scope: string, locationId: string, value: CounterDraft, restore: (draft: CounterDraft) => void) {
  const [client] = useState(() => createPharmacyDraftClient(scope, locationId));
  const [ready, setReady] = useState(false), [status, setStatus] = useState("Loading saved cart..."), [error, setError] = useState("");
  const alive = useRef(true), version = useRef(0);
  useEffect(() => { alive.current = true; let active = true;
    void client.load().then(result => { if (!active) return; if (result.value) restore(result.value); setStatus(result.durable ? "Draft saved on this device" : "Draft kept in this tab; device saving unavailable"); setReady(true); }).catch(failure => { if (active) { setError(failure instanceof Error ? failure.message : "Saved cart unavailable"); setReady(true); } });
    return () => { active = false; alive.current = false; };
  }, [client, restore]);
  const flush = useCallback(async (draft: CounterDraft) => {
    const current = ++version.current;
    try { const result = await client.save(draft); if (alive.current && current === version.current) { setError(""); setStatus(result.durable ? "Draft saved on this device" : "Draft kept in this tab; device saving unavailable"); } }
    catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Draft could not be saved"); throw failure; }
  }, [client]);
  const encoded = JSON.stringify(value);
  useEffect(() => { if (!ready || error) return; void Promise.resolve().then(() => flush(JSON.parse(encoded) as CounterDraft)).catch(() => {}); }, [encoded, ready, error, flush]);
  return { ready, status, error, flush };
}
