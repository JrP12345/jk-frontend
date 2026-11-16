import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePharmacyDraft } from "@/hooks/usePharmacyDraft";
import { clearPharmacyDrafts, createPharmacyDraftClient, emptyCounterDraft, type CounterDraft } from "@/lib/pharmacyDrafts";
function DraftEditor() {
  const [value, setValue] = useState(emptyCounterDraft), restore = useCallback((draft: CounterDraft) => setValue(draft), [setValue]);
  const draft = usePharmacyDraft("owner", "branch", value, restore);
  return <><input aria-label="Draft discount" disabled={!draft.ready || Boolean(draft.error)} value={value.cart.discount} onChange={event => setValue(previous => ({ ...previous, cart: { ...previous.cart, discount: event.target.value } }))} /><p role="status">{draft.status}</p><p role="alert">{draft.error}</p></>;
}
beforeEach(async () => { vi.stubGlobal("indexedDB", undefined); sessionStorage.clear(); await clearPharmacyDrafts(); });
afterEach(() => { vi.unstubAllGlobals(); });
it("restores before enabling editing and saves changes across component navigation", async () => {
  const client = createPharmacyDraftClient("owner", "branch"), saved = emptyCounterDraft(); saved.cart.discount = "7.50";
  await client.load(); await client.save(saved);
  const view = render(<DraftEditor />);
  expect(screen.getByLabelText("Draft discount")).toBeDisabled();
  await waitFor(() => expect(screen.getByLabelText("Draft discount")).toHaveValue("7.50"));
  fireEvent.change(screen.getByLabelText("Draft discount"), { target: { value: "9" } });
  await waitFor(async () => expect((await createPharmacyDraftClient("owner", "branch").load()).value?.cart.discount).toBe("9"));
  view.unmount(); render(<DraftEditor />);
  await waitFor(() => expect(screen.getByLabelText("Draft discount")).toHaveValue("9"));
  expect(screen.getByRole("status")).toHaveTextContent(/device saving unavailable/);
});
it("blocks editing on a conflicting newer draft without replacing it", async () => {
  render(<DraftEditor />); await waitFor(() => expect(screen.getByLabelText("Draft discount")).toBeEnabled());
  await act(async () => {
    const other = createPharmacyDraftClient("owner", "branch"), value = emptyCounterDraft(); value.cart.discount = "20"; await other.load(); await other.save(value);
  });
  fireEvent.change(screen.getByLabelText("Draft discount"), { target: { value: "3" } });
  await waitFor(() => expect(screen.getByLabelText("Draft discount")).toBeDisabled());
  expect(screen.getByRole("alert")).toHaveTextContent(/another tab/);
  expect((await createPharmacyDraftClient("owner", "branch").load()).value?.cart.discount).toBe("20");
});
