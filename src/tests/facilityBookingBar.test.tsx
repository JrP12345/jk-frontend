import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import FacilityBookingBar from "@/app/browse/[slug]/FacilityBookingBar";
import { ToastProvider } from "@/components/ui";

afterEach(() => vi.unstubAllGlobals());

it("keeps the fixed booking action off a visible doctor card and restores it after the card leaves the viewport", () => {
  let notify!: IntersectionObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe = vi.fn();
    disconnect = disconnect;
  });
  const onBook = vi.fn();
  const view = render(<ToastProvider><article data-facility-doctor><button>Book in card</button></article><FacilityBookingBar fee="₹500" label="Book now" onBook={onBook} /></ToastProvider>);
  const card = document.querySelector("[data-facility-doctor]")!;
  const bounds = vi.spyOn(card, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 400, height: 300 } as DOMRect);
  act(() => notify([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(screen.queryByRole("region", { name: "Appointment booking" })).not.toBeInTheDocument();
  bounds.mockReturnValue({ top: 500, bottom: 800, height: 300 } as DOMRect);
  act(() => notify([{ isIntersecting: true, intersectionRatio: 0.4 } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(screen.queryByRole("region", { name: "Appointment booking" })).not.toBeInTheDocument();
  bounds.mockReturnValue({ top: -400, bottom: -100, height: 300 } as DOMRect);
  act(() => notify([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver));
  fireEvent.click(within(screen.getByRole("region", { name: "Appointment booking" })).getByRole("button", { name: "Book now" }));
  expect(onBook).toHaveBeenCalledOnce();
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
