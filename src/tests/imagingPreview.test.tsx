import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DICOMViewerModal, type ImagingStudyItem } from "@/components/clinical/DicomViewerModal";
import { externalServiceUrl } from "@/lib/externalServiceUrl";
const fixture = vi.hoisted(() => ({ get: vi.fn(), revoke: vi.fn(), create: vi.fn(() => "blob:preview") }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
const study: ImagingStudyItem = { id: "study", studyInstanceUid: "1.2.5", modality: "CT", patientId: { id: "patient" }, studyDescription: "Chest study", status: "completed", dicomWebUrl: "javascript:alert(1)" };
const manifest = { data: { data: { instances: [{ seriesUid: "1.2.3", instanceUid: "1.2.4", frames: 2, number: 1 }] } } };
beforeEach(() => {
  fixture.create.mockReturnValue("blob:preview");
  const NativeURL = URL;
  vi.stubGlobal("URL", class extends NativeURL { static createObjectURL = fixture.create; static revokeObjectURL = fixture.revoke; });
  fixture.get.mockImplementation(async (url: string) => url.includes("?") ? { data: new Blob(["PNG fixture"], { type: "image/png" }) } : manifest);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
it("fetches authenticated previews, navigates frames and applies actual display controls", async () => {
  const view = render(<DICOMViewerModal isOpen onClose={vi.fn()} study={study} />);
  const image = await screen.findByRole("img", { name: /frame 1/ });
  expect(screen.queryByRole("link", { name: "Open PACS" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  fireEvent.click(screen.getByRole("button", { name: "Rotate" }));
  fireEvent.click(screen.getByRole("button", { name: "Invert" }));
  expect(image.style.transform).toBe("rotate(90deg) scale(1.25)");
  expect(image.style.filter).toBe("invert(1)");
  fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
  await screen.findByRole("img", { name: /frame 2/ });
  expect(fixture.get).toHaveBeenCalledWith("/radiology/studies/study/preview?seriesUid=1.2.3&instanceUid=1.2.4&frame=2", expect.objectContaining({ responseType: "blob", signal: expect.any(AbortSignal) }));
  expect(fixture.revoke).toHaveBeenCalledWith("blob:preview");
  view.unmount(); expect(fixture.revoke).toHaveBeenCalledTimes(2);
});
it("recovers metadata and image failures without pretending images are present", async () => {
  fixture.get.mockRejectedValueOnce(new Error("unconfigured"));
  render(<DICOMViewerModal isOpen onClose={vi.fn()} study={study} />);
  expect(await screen.findByText("Study images unavailable")).toBeInTheDocument();
  fixture.get.mockResolvedValueOnce(manifest).mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "Retry images" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry frame" }));
  await screen.findByRole("img");
});
it("discards images from a previous study", async () => {
  let finish!: (response: unknown) => void;
  fixture.get.mockImplementation((url: string) => url.startsWith("/radiology/studies/study/preview?") ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(url.includes("?") ? { data: new Blob(["png"], { type: "image/png" }) } : manifest));
  const view = render(<DICOMViewerModal isOpen onClose={vi.fn()} study={study} />);
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  view.rerender(<DICOMViewerModal isOpen onClose={vi.fn()} study={{ ...study, id: "next-study" }} />);
  await screen.findByRole("img");
  const calls = fixture.create.mock.calls.length;
  await act(async () => finish({ data: new Blob(["old"], { type: "image/png" }) }));
  expect(fixture.create).toHaveBeenCalledTimes(calls);
});
it.each(["javascript:alert(1)", "/dashboard/teleconsultation?room=old", "https://user:secret@meet.example/room", "http://meet.example/room"])("rejects unsuitable service link %s", value => {
  expect(externalServiceUrl(value)).toBeNull();
});
