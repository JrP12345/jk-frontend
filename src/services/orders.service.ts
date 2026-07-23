import api from "@/lib/api";
import { EncounterEventBus, EncounterEvents } from "@/events/EncounterEventBus";

export class OrdersService {
  public static async placeOrder(encounterId: string, payload: { patientId: string; testId: string; priority?: string; clinicalReason?: string }) {
    const res = await api.post(`/encounters/${encounterId}/orders`, payload);
    const orderData = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.ORDER_CREATED, orderData);
    return orderData;
  }

  public static async getOrders(encounterId: string) {
    const res = await api.get(`/encounters/${encounterId}/orders`);
    const data = res.data?.data || res.data;
    return Array.isArray(data) ? data : [];
  }

  public static async collectSample(orderId: string) {
    const res = await api.put(`/orders/${orderId}/collect`);
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.ORDER_COLLECTED, data);
    return data;
  }

  public static async markProcessing(orderId: string) {
    const res = await api.put(`/orders/${orderId}/process`);
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.ORDER_PROCESSING, data);
    return data;
  }

  public static async recordResult(orderId: string, payload: { value: string; unit?: string; referenceRange?: string; interpretation?: string; isAbnormal?: boolean }) {
    const res = await api.put(`/orders/${orderId}/result`, payload);
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.ORDER_COMPLETED, data);
    return data;
  }

  public static async cancelOrder(orderId: string, cancellationReason: string) {
    const res = await api.put(`/orders/${orderId}/cancel`, { cancellationReason });
    const data = res.data?.data || res.data;
    EncounterEventBus.emit(EncounterEvents.ORDER_CANCELLED, data);
    return data;
  }
}
