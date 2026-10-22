import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { apiErrorKind, apiErrorMessage } from "@/lib/apiError";

const adapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = adapter; vi.restoreAllMocks(); });

function rejection(config: InternalAxiosRequestConfig, status: number) {
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, undefined, { status, statusText: "Error", headers: new AxiosHeaders(), config, data: {} });
}

describe("API failure recovery", () => {
  it.each([
    [401, "unauthenticated"], [403, "forbidden"], [429, "rate_limited"],
    [400, "validation"], [500, "server"], [502, "unavailable"], [503, "unavailable"], [504, "unavailable"],
  ])("classifies HTTP %i without treating availability as authentication", (status, kind) => {
    expect(apiErrorKind({ response: { status } })).toBe(kind);
  });

  it("keeps cancellation distinct and hides technical error responses", () => {
    expect(apiErrorKind({ code: "ERR_CANCELED" })).toBe("cancelled");
    expect(apiErrorMessage({ response: { status: 400, data: { message: "Invalid verification code" } } }, "Try again")).toBe("Invalid verification code");
    expect(apiErrorMessage({ response: { status: 500, data: { message: "<html>Backend stack trace</html>" } } }, "Try again")).not.toContain("html");
    expect(apiErrorMessage({ response: { status: 403, data: { message: "MongoServerError: patient record" } } }, "Access denied")).toBe("Access denied");
  });

  it.each([403, 429, 500, 502, 503, 504, "ECONNABORTED", "ERR_NETWORK"])("shares refresh failure %s across concurrent requests without expiry or replay", async (failure) => {
    const expired = vi.fn(), unavailable = vi.fn();
    window.addEventListener("auth-expired", expired);
    window.addEventListener("auth-unavailable", unavailable);
    let rejectRefresh!: (error: unknown) => void;
    const refresh = new Promise<never>((_, reject) => { rejectRefresh = reject; });
    let refreshConfig!: InternalAxiosRequestConfig;
    const calls: string[] = [];
    api.defaults.adapter = (async config => {
      calls.push(config.url!);
      if (config.url === "/auth/refresh") { refreshConfig = config; return refresh; }
      throw rejection(config, 401);
    }) satisfies AxiosAdapter;
    try {
      const requests = Promise.allSettled([api.get("/appointments"), api.get("/auth/me")]);
      await vi.waitFor(() => expect(calls).toContain("/auth/refresh"));
      rejectRefresh(typeof failure === "number" ? rejection(refreshConfig, failure) : new AxiosError("Connection interrupted", failure, refreshConfig));
      expect((await requests).every(result => result.status === "rejected")).toBe(true);
      expect(calls.filter(url => url === "/auth/refresh")).toHaveLength(1);
      expect(calls).toHaveLength(3);
      expect(expired).not.toHaveBeenCalled();
      expect(unavailable).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("auth-expired", expired);
      window.removeEventListener("auth-unavailable", unavailable);
    }
  });

  it("announces confirmed refresh rejection once and releases every waiting request", async () => {
    const expired = vi.fn();
    window.addEventListener("auth-expired", expired);
    let refreshCalls = 0;
    api.defaults.adapter = async config => {
      if (config.url === "/auth/refresh") refreshCalls++;
      throw rejection(config, 401);
    };
    try {
      const results = await Promise.allSettled([api.get("/appointments"), api.get("/auth/me")]);
      expect(results.every(result => result.status === "rejected")).toBe(true);
      expect(refreshCalls).toBe(1);
      expect(expired).toHaveBeenCalledOnce();
    } finally { window.removeEventListener("auth-expired", expired); }
  });

  it("preserves a payment operation key through a successful token refresh", async () => {
    const keys: unknown[] = [];
    api.defaults.adapter = async config => {
      if (config.url === "/auth/refresh") return { config, status: 200, statusText: "OK", headers: new AxiosHeaders(), data: {} };
      keys.push(config.headers.get("Idempotency-Key"));
      if (keys.length === 1) throw rejection(config, 401);
      return { config, status: 200, statusText: "OK", headers: new AxiosHeaders(), data: { success: true } };
    };
    await api.post("/invoices/synthetic-invoice/payments", { amount: 100 });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toEqual(expect.any(String));
    expect(keys[1]).toBe(keys[0]);
  });

  it.each(["ECONNABORTED", "ERR_NETWORK", 503])("never automatically repeats a mutation after transport failure %s", async (failure) => {
    const send = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw typeof failure === "number" ? rejection(config, failure) : new AxiosError("Connection interrupted", failure, config);
    });
    api.defaults.adapter = send;
    await expect(api.post("/appointments", { synthetic: true })).rejects.toBeDefined();
    expect(send).toHaveBeenCalledOnce();
  });
});
