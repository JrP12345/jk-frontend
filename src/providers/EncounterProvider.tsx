"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { EncounterService } from "@/services/encounter.service";
import { SOAPService } from "@/services/soap.service";
import { OrdersService } from "@/services/orders.service";
import { NEWS2Service } from "@/services/news2.service";
import { EncounterEventBus, EncounterEvents } from "@/events/EncounterEventBus";

interface EncounterContextType {
  encounterId: string;
  patientId: string;
  clinicId: string;
  doctorId: string;

  loading: boolean;
  error: string | null;

  summaryReport: any;
  orders: any[];
  scores: any[];

  refreshEncounter: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshScores: () => Promise<void>;
}

const EncounterContext = createContext<EncounterContextType | undefined>(undefined);

export function EncounterProvider({
  encounterId,
  patientId,
  clinicId,
  doctorId,
  children,
}: {
  encounterId: string;
  patientId: string;
  clinicId: string;
  doctorId: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summaryReport, setSummaryReport] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);

  const refreshEncounter = useCallback(async () => {
    try {
      const data = await EncounterService.getSummaryReport(encounterId);
      setSummaryReport(data);
    } catch (err: any) {
      console.warn("Failed to load summary report", err);
    }
  }, [encounterId]);

  const refreshOrders = useCallback(async () => {
    try {
      const data = await OrdersService.getOrders(encounterId);
      setOrders(data);
    } catch {
      setOrders([]);
    }
  }, [encounterId]);

  const refreshScores = useCallback(async () => {
    try {
      const data = await NEWS2Service.getScores(encounterId);
      setScores(data);
    } catch {
      setScores([]);
    }
  }, [encounterId]);

  // Initial Coordinated Single Load Pipeline
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      refreshEncounter(),
      refreshOrders(),
      refreshScores(),
    ]).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [refreshEncounter, refreshOrders, refreshScores]);

  // EventBus Subscriptions for Reactive Non-imperative Updates
  useEffect(() => {
    const unsubSOAP = EncounterEventBus.subscribe(EncounterEvents.SOAP_NOTE_SIGNED, () => {
      refreshEncounter();
    });
    const unsubOrder = EncounterEventBus.subscribe(EncounterEvents.ORDER_COMPLETED, () => {
      refreshOrders();
      refreshEncounter();
    });
    const unsubNEWS2 = EncounterEventBus.subscribe(EncounterEvents.NEWS2_EVALUATED, () => {
      refreshScores();
    });

    return () => {
      unsubSOAP();
      unsubOrder();
      unsubNEWS2();
    };
  }, [refreshEncounter, refreshOrders, refreshScores]);

  return (
    <EncounterContext.Provider
      value={{
        encounterId,
        patientId,
        clinicId,
        doctorId,
        loading,
        error,
        summaryReport,
        orders,
        scores,
        refreshEncounter,
        refreshOrders,
        refreshScores,
      }}
    >
      {children}
    </EncounterContext.Provider>
  );
}

export function useEncounterContext() {
  const context = useContext(EncounterContext);
  if (!context) {
    throw new Error("useEncounterContext must be used within an EncounterProvider");
  }
  return context;
}
