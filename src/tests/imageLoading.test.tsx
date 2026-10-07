import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LoadingImage from "@/components/ui/LoadingImage";
import Avatar from "@/components/ui/Avatar";
import BrowseDetailClient from "@/app/browse/[slug]/BrowseDetailClient";
import BrowseDetailLoading from "@/app/browse/[slug]/loading";
import { useAuthStore } from "@/store/authStore";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/MarketplaceNavbar", () => ({ default: () => null }));
vi.mock("@/components/ui", async original => ({ ...await original<typeof import("@/components/ui")>(), useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ default: { get: () => new Promise(() => {}) } }));
afterEach(() => vi.restoreAllMocks());

describe("Shared image loading", () => {
  it("reserves its image box and shows fallback content only after an error", () => {
    const onLoad = vi.fn();
    const { rerender } = render(<LoadingImage src="/logo.png" alt="Clinic" width={48} height={48} fallback={<span>Unavailable</span>} onLoad={onLoad} />);
    const image = screen.getByRole("img", { name: "Clinic" });
    expect(image).toHaveClass("skeleton-shimmer");
    expect(image).toHaveAttribute("width", "48");
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
    fireEvent.load(image);
    expect(image).not.toHaveClass("skeleton-shimmer");
    expect(onLoad).toHaveBeenCalledOnce();
    rerender(<LoadingImage src="/broken.png" alt="Clinic" width={48} height={48} fallback={<span>Unavailable</span>} />);
    const replacement = screen.getByRole("img", { name: "Clinic" });
    expect(replacement).toHaveClass("skeleton-shimmer");
    fireEvent.error(replacement);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Clinic" })).toHaveStyle({ width: "48px", height: "48px" });
    expect(screen.getByRole("img", { name: "Clinic" })).not.toHaveClass("skeleton-shimmer");
  });

  it("handles images that finished loading before hydration", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(48);
    render(<LoadingImage src="/cached.png" alt="Cached logo" />);
    expect(screen.getByRole("img", { name: "Cached logo" })).not.toHaveClass("skeleton-shimmer");
  });

  it("ends the skeleton for cached failures and missing sources", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    const { rerender, container } = render(<LoadingImage src="/cached-error.png" alt="Logo" fallback="LC" />);
    expect(screen.getByText("LC")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    rerender(<LoadingImage src="" alt="Missing" />);
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("recovers an avatar after changing a failed source and preserves viewer styles", () => {
    const { rerender } = render(<Avatar src="/broken-avatar.png" name="Test Patient" />);
    fireEvent.error(screen.getByRole("img", { name: "Test Patient" }));
    expect(screen.getByText("TP")).toBeInTheDocument();
    rerender(<Avatar src="/new-avatar.png" name="Test Patient" />);
    expect(screen.getByRole("img", { name: "Test Patient" })).toHaveAttribute("src", "/new-avatar.png");
    rerender(<LoadingImage src="blob:frame" alt="Frame" style={{ transform: "rotate(90deg) scale(2)", filter: "invert(1)" }} />);
    const frame = screen.getByRole("img", { name: "Frame" });
    fireEvent.load(frame);
    expect(frame).toHaveStyle({ transform: "rotate(90deg) scale(2)", filter: "invert(1)" });
  });
});

it("uses identical clinic loading markup for route navigation and the client request", () => {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  const { container, rerender } = render(<BrowseDetailLoading />);
  const routeSkeleton = container.innerHTML;
  rerender(<BrowseDetailClient slug="pending-clinic" />);
  expect(container.innerHTML).toBe(routeSkeleton);
  expect(screen.getAllByRole("status", { name: "Loading location and doctor details" })).toHaveLength(1);
});
