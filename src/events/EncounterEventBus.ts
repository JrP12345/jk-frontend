export const EncounterEvents = {
  // SOAP Domain Events
  SOAP_NOTE_CREATED: "SOAP_NOTE_CREATED",
  SOAP_NOTE_SIGNED: "SOAP_NOTE_SIGNED",
  SOAP_NOTE_AMENDED: "SOAP_NOTE_AMENDED",

  // NEWS2 Deterioration & Alerts Events
  NEWS2_EVALUATED: "NEWS2_EVALUATED",
  NEWS2_ALERT_TRIGGERED: "NEWS2_ALERT_TRIGGERED",
  NEWS2_ALERT_ACKNOWLEDGED: "NEWS2_ALERT_ACKNOWLEDGED",

  // Diagnostic Orders Events
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_COLLECTED: "ORDER_COLLECTED",
  ORDER_PROCESSING: "ORDER_PROCESSING",
  ORDER_COMPLETED: "ORDER_COMPLETED",
  ORDER_CANCELLED: "ORDER_CANCELLED",

  // Medication Administration Record (MAR) Events
  MAR_SCHEDULED: "MAR_SCHEDULED",
  MAR_ADMINISTERED: "MAR_ADMINISTERED",
  MAR_REFUSED: "MAR_REFUSED",
  MAR_HELD: "MAR_HELD",
  MAR_MISSED: "MAR_MISSED",

  // Discharge Summary Events
  DISCHARGE_COMPILED: "DISCHARGE_COMPILED",
  DISCHARGE_FINALIZED: "DISCHARGE_FINALIZED",
  DISCHARGE_COUNTERSIGNED: "DISCHARGE_COUNTERSIGNED",

  // System & Security Events
  AUTH_EXPIRED: "AUTH_EXPIRED",
  PERMISSIONS_UPDATED: "PERMISSIONS_UPDATED",
  ENCOUNTER_CLOSED: "ENCOUNTER_CLOSED",
} as const;

export type EncounterEventType = typeof EncounterEvents[keyof typeof EncounterEvents];

type ListenerCallback = (data?: any) => void;

class EventBus {
  private listeners: Map<string, Set<ListenerCallback>> = new Map();

  public subscribe(event: string, callback: ListenerCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  public emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[EncounterEventBus] Exception in subscriber for event ${event}:`, err);
        }
      });
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const EncounterEventBus = new EventBus();
