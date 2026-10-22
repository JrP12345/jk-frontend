import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import api from "@/lib/api";

const originalAdapter = api.defaults.adapter;
function response(config: InternalAxiosRequestConfig): AxiosResponse {
  return { config, status: 200, statusText: "OK", headers: {}, data: { success: true } };
}
beforeEach(async () => {
  api.defaults.adapter = async config => response(config);
  await api.post("/auth/logout");
});
afterEach(() => { api.defaults.adapter = originalAdapter; });
describe("Payment transport replay", () => {
  it("does not refresh an operational session after an expired public business setup proof", async () => {
    const requests: string[] = [];
    api.defaults.adapter = async config => { requests.push(config.url!); throw new AxiosError("Setup proof expired", "ERR_BAD_REQUEST", config, undefined, { ...response(config), status: 401 }); };
    await expect(api.post("/pharmacy/onboarding/status", { requestId: "expired", setupToken: "expired" })).rejects.toThrow("Setup proof expired");
    expect(requests).toEqual(["/pharmacy/onboarding/status"]);
  });
  it("retains a clinical full-pay key across transport failure", async () => {
    const keys: unknown[] = [];
    api.defaults.adapter = async config => { keys.push(config.headers.get("Idempotency-Key")); if (keys.length === 1) throw new AxiosError("Connection lost", "ERR_NETWORK", config); return response(config); };
    await expect(api.put("/invoices/fixture/pay", { paymentMethod: "cash" })).rejects.toThrow("Connection lost");
    await api.put("/invoices/fixture/pay", { paymentMethod: "cash" });
    expect(keys[0]).toBeTruthy(); expect(keys[1]).toBe(keys[0]);
  });
  it("requires an explicit dispense key and preserves it across auth refresh", async () => {
    let sends = 0;
    const keys: unknown[] = [];
    api.defaults.adapter = async config => {
      if (config.url === "/auth/refresh") return response(config);
      sends++; keys.push(config.headers.get("Idempotency-Key"));
      if (sends === 1) throw new AxiosError("Expired", "ERR_BAD_REQUEST", config, undefined, { ...response(config), status: 401 });
      return response(config);
    };
    await expect(api.post("/pharmacy/dispense", { items: [] })).rejects.toThrow("stable dispense reference");
    expect(sends).toBe(0);
    await api.post("/pharmacy/dispense", { items: [] }, { headers: { "Idempotency-Key": "stable-dispense-reference" } });
    expect(keys).toEqual(["stable-dispense-reference", "stable-dispense-reference"]);
  });
  it("retains the operation key after a transport failure and starts a new operation after success", async () => {
    const keys: unknown[] = [];
    api.defaults.adapter = async config => {
      keys.push(config.headers.get("Idempotency-Key"));
      if (keys.length === 1) throw new AxiosError("Connection lost after submission", "ERR_NETWORK", config);
      return response(config);
    };
    const body = { amount: 25, paymentMethod: "cash" };
    await expect(api.post("/invoices/fixture/payments", body)).rejects.toThrow("Connection lost");
    await api.post("/invoices/fixture/payments", body);
    await api.post("/invoices/fixture/payments", body);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });
  it("preserves the key across token refresh and the automatic payment retry", async () => {
    const keys: unknown[] = [];
    let refreshes = 0;
    api.defaults.adapter = async config => {
      if (config.url === "/auth/refresh") { refreshes++; return response(config); }
      keys.push(config.headers.get("Idempotency-Key"));
      if (keys.length === 1) {
        throw new AxiosError("Expired access token", "ERR_BAD_REQUEST", config, undefined, { ...response(config), status: 401 });
      }
      return response(config);
    };
    await api.post("/billing/checkout/consolidate", { appointmentId: "fixture", amountPaid: 100 });
    expect(refreshes).toBe(1);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});
