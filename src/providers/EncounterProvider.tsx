"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { EncounterService } from "@/services/encounter.service";
import { SOAPService } from "@/services/soap.service";
import { OrdersService } from "@/services/orders.service";
import { MARService } from "@/services/mar.service";
import { NEWS2Service } from "@/services/news2.service";
import { DischargeService } from "@/services/discharge.service";
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
  marItems: any[];
  scores: any[];
  dischargeSummary: any;

  refreshEncounter: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshMAR: () => Promise<void>;
  refreshScores: () => Promise<void>;
  refreshDischarge: () => Promise<void>;
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
  const [marItems, setMarItems] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [dischargeSummary, setDischargeSummary] = useState<any>(null);

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

  const refreshMAR = useCallback(async () => {
    try {
      const data = await MARService.getMAR(encounterId);
      setMarItems(data);
    } catch {
      setMarItems([]);
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

  const refreshDischarge = useCallback(async () => {
    try {
      const data = await DischargeService.getSummaryByEncounter(encounterId);
      setDischargeSummary(data);
    } catch {
      setDischargeSummary(null);
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
      refreshMAR(),
      refreshScores(),
      refreshDischarge(),
    ]).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [refreshEncounter, refreshOrders, refreshMAR, refreshScores, refreshDischarge]);

  // EventBus Subscriptions for Reactive Non-imperative Updates
  useEffect(() => {
    const unsubSOAP = EncounterEventBus.subscribe(EncounterEvents.SOAP_NOTE_SIGNED, () => {
      refreshEncounter();
    });
    const unsubOrder = EncounterEventBus.subscribe(EncounterEvents.ORDER_COMPLETED, () => {
      refreshOrders();
      refreshEncounter();
    });
    const unsubMAR = EncounterEventBus.subscribe(EncounterEvents.MAR_ADMINISTERED, () => {
      refreshMAR();
    });
    const unsubNEWS2 = EncounterEventBus.subscribe(EncounterEvents.NEWS2_EVALUATED, () => {
      refreshScores();
    });
    const unsubDischarge = EncounterEventBus.subscribe(EncounterEvents.DISCHARGE_FINALIZED, () => {
      refreshDischarge();
      refreshEncounter();
    });

    return () => {
      unsubSOAP();
      unsubOrder();
      unsubMAR();
      unsubNEWS2();
      unsubDischarge();
    };
  }, [refreshEncounter, refreshOrders, refreshMAR, refreshScores, refreshDischarge]);

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
        marItems,
        scores,
        dischargeSummary,
        refreshEncounter,
        refreshOrders,
        refreshMAR,
        refreshScores,
        refreshDischarge,
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
