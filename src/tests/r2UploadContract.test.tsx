import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useR2Upload } from "@/hooks/useR2Upload";

vi.mock("@/lib/api", () => ({ default: { post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

it("uploads through the canonical contract and returns a private object reference", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { objectKey: "tenants/tenant/verified/report.pdf", intentId: "intent" } } });
  const { result } = renderHook(() => useR2Upload());
  let uploaded;
  await act(async () => { uploaded = await result.current.uploadFile(new File(["report"], "report.pdf", { type: "application/pdf" }), { patientId: "patient", contentClass: "lab_report" }); });
  expect(api.post).toHaveBeenCalledWith("/uploads/base64", {
    originalFilename: "report.pdf", contentType: "application/pdf", base64Data: expect.stringMatching(/^data:application\/pdf;base64,/), patientId: "patient", contentClass: "lab_report",
  });
  expect(uploaded).toEqual({ objectKey: "tenants/tenant/verified/report.pdf", intentId: "intent" });
  expect(result.current.uploading).toBe(false);
  expect(result.current.progress).toBe(100);
});

it("rejects incomplete success responses instead of inventing a storage key", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { intentId: "intent" } } });
  const onSuccess = vi.fn();
  const { result } = renderHook(() => useR2Upload({ onSuccess }));
  await act(async () => { await expect(result.current.uploadFile(new File(["photo"], "photo.png", { type: "image/png" }))).rejects.toThrow("Upload response is incomplete"); });
  expect(onSuccess).not.toHaveBeenCalled();
  expect(result.current.error).toBe("Upload response is incomplete");
  expect(result.current.uploading).toBe(false);
});
