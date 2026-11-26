import { beforeEach, expect, it, vi } from "vitest";
import { COUNTER_SAVE_TIMEOUT_MS, issueCounter, type CounterIssueInput } from "@/lib/pharmacyCounter";

const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const input: CounterIssueInput = { locationId: "branch", invoiceDiscountPaise: 0, roundOffPaise: 0, expectedTotalPaise: 2000,
  lines: [{ lineId: "line-1", medicineId: "medicine", quantity: 1, expectedUnitVersion: 1, discountPaise: 0 }] };
const key = "original-sale-key";
const saved = { invoiceId: "invoice", dispenseId: "dispense", invoiceNumber: "BILL-001", totalPaise: 2000, status: "unpaid", requestKey: key };
const response = (data: unknown) => ({ data: { data } });
beforeEach(() => { api.post.mockReset(); api.get.mockReset(); });

it("uses a scoped commit deadline and retains the original command identity", async () => {
  api.post.mockResolvedValue(response(saved));
  await expect(issueCounter(input, key)).resolves.toMatchObject(saved);
  expect(api.post).toHaveBeenCalledWith("/pharmacy/sales", input, { headers: { "Idempotency-Key": key }, timeout: COUNTER_SAVE_TIMEOUT_MS });
  expect(api.get).not.toHaveBeenCalled();
});

it.each([
  { code: "ECONNABORTED" }, { code: "ETIMEDOUT" }, { code: "ERR_NETWORK" }, { response: { status: 504 } },
])("reads a committed sale after an ambiguous transport failure: %j", async failure => {
  api.post.mockRejectedValue(failure); api.get.mockResolvedValue(response(saved));
  await expect(issueCounter(input, key)).resolves.toMatchObject(saved);
  expect(api.post).toHaveBeenCalledOnce();
  expect(api.get).toHaveBeenCalledWith(`/pharmacy/sale-operations/${key}?locationId=branch`, { timeout: 15000 });
});

it("preserves the original timeout when the same operation is not confirmed", async () => {
  const failure = Object.assign(new Error("Save timed out"), { code: "ECONNABORTED" });
  api.post.mockRejectedValue(failure); api.get.mockRejectedValue({ response: { status: 404 } });
  await expect(issueCounter(input, key)).rejects.toBe(failure);
  expect(api.post).toHaveBeenCalledOnce(); expect(api.get).toHaveBeenCalledOnce();
});

it("does not recover a definitive validation conflict", async () => {
  const failure = { response: { status: 409, data: { details: { code: "COUNTER_TOTAL_CHANGED" } } } };
  api.post.mockRejectedValue(failure);
  await expect(issueCounter(input, key)).rejects.toBe(failure);
  expect(api.get).not.toHaveBeenCalled();
});

it("rejects a recovered total that differs from the authorized bill", async () => {
  api.post.mockRejectedValue({ code: "ECONNABORTED" }); api.get.mockResolvedValue(response({ ...saved, totalPaise: 3000 }));
  await expect(issueCounter(input, key)).rejects.toThrow("Saved total differs");
  expect(api.post).toHaveBeenCalledOnce();
});

it("does not accept an unpaid result as proof of a confirmed cash payment", async () => {
  api.post.mockRejectedValue({ code: "ECONNABORTED" }); api.get.mockResolvedValue(response(saved));
  const paidInput: CounterIssueInput = { ...input, payment: { locationId: "branch", expectedPaymentRevision: 0, expectedBalancePaise: 2000, manualConfirmed: true, cashTenderedPaise: 2000, entries: [{ componentId: "cash-1", amountPaise: 2000, paymentMethod: "cash" }] } };
  await expect(issueCounter(paidInput, key)).rejects.toThrow("Saved payment could not be confirmed");
  expect(api.post).toHaveBeenCalledOnce();
});

it("recovers an external prescription save through its original operation endpoint", async () => {
  api.post.mockRejectedValue({ response: { status: 504 } }); api.get.mockResolvedValue(response(saved));
  await expect(issueCounter({ ...input, externalPrescription: { id: "prescription", revision: 1 } }, key)).resolves.toMatchObject(saved);
  expect(api.post.mock.calls[0][0]).toBe("/pharmacy/external-prescriptions/supply");
  expect(api.get.mock.calls[0][0]).toBe(`/pharmacy/external-prescription-operations/${key}?locationId=branch`);
});
