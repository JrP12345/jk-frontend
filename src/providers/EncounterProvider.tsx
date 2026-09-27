"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { OrdersService } from "@/services/orders.service";
import { EncounterEventBus, EncounterEvents } from "@/events/EncounterEventBus";

interface EncounterContextType {
  encounterId: string;
  patientId: string;
  clinicId: string;
  doctorId: string;
  loading: boolean;
  error: string | null;
  orders: any[];
  refreshOrders: () => Promise<void>;
}
const EncounterContext = createContext<EncounterContextType | undefined>(undefined);

export function EncounterProvider({ encounterId, patientId, clinicId, doctorId, children }: {
  encounterId: string; patientId: string; clinicId: string; doctorId: string; children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const generation = useRef(0);
  const refreshOrders = useCallback(async () => {
    const current = ++generation.current;
    try {
      const data = await OrdersService.getOrders(encounterId);
      if (current === generation.current) { setOrders(data); setError(null); }
    } catch {
      if (current === generation.current) setError("Unable to load diagnostic orders. Please retry.");
    }
  }, [encounterId]);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setOrders([]);
    setError(null);
    void refreshOrders().finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; generation.current++; };
  }, [refreshOrders]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void refreshOrders(); };
    const unsubscribe = [EncounterEvents.ORDER_CREATED, EncounterEvents.ORDER_COLLECTED,
      EncounterEvents.ORDER_PROCESSING, EncounterEvents.ORDER_COMPLETED, EncounterEvents.ORDER_CANCELLED]
      .map(event => EncounterEventBus.subscribe(event, data => {
        const id = data?.encounterId?._id ?? data?.encounterId;
        if (String(id) === encounterId) refresh();
      }));
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      unsubscribe.forEach(stop => stop());
    };
  }, [encounterId, refreshOrders]);
  return <EncounterContext.Provider value={{ encounterId, patientId, clinicId, doctorId, loading, error, orders, refreshOrders }}>{children}</EncounterContext.Provider>;
}
export function useEncounterContext() {
  const context = useContext(EncounterContext);
  if (!context) throw new Error("useEncounterContext must be used within an EncounterProvider");
  return context;
}
