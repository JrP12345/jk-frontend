import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NEWS2Calculator } from "@/components/clinical/NEWS2Calculator";
import { ToastProvider } from "@/components/ui";
const fixture = vi.hoisted(() => ({ scores: vi.fn(), evaluate: vi.fn(), acknowledge: vi.fn(), canEvaluate: true }));
vi.mock("@/services/news2.service", () => ({ NEWS2Service: { getScores: fixture.scores, evaluateScore: fixture.evaluate, acknowledgeAlert: fixture.acknowledge } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { permissions: fixture.canEvaluate ? ["EVALUATE_NEWS2"] : ["VIEW_EHR"] } }) }));
beforeEach(() => { fixture.canEvaluate = true; fixture.scores.mockReset().mockResolvedValue([]); fixture.evaluate.mockReset(); fixture.acknowledge.mockReset().mockResolvedValue({}); });
afterEach(cleanup);
function mount() { return render(<ToastProvider><NEWS2Calculator encounterId="encounter" patientId="patient" /></ToastProvider>); }

it("shows only saved scores and observations, without fabricated vital inputs or table toolbars", async () => {
  mount(); expect(await screen.findByText("No evaluation recorded yet.")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /column/i })).not.toBeInTheDocument();
  expect(screen.queryByText("Low")).not.toBeInTheDocument();
  expect(fixture.scores).toHaveBeenCalledWith("encounter");
});

it("evaluates saved encounter observations and preserves a zero score and incomplete status", async () => {
  fixture.evaluate.mockResolvedValue({ score: { totalScore: 0, riskCategory: "Low", isComplete: false, missingParameters: ["Respiration Rate"], parameterBreakdown: [{ parameter: "Recorded parameter", rawValue: 0, subScore: 0 }] } });
  mount(); await screen.findByText("No evaluation recorded yet.");
  fireEvent.click(screen.getByRole("button", { name: "Evaluate score" }));
  expect(await screen.findByText("Incomplete")).toBeInTheDocument();
  expect(fixture.evaluate).toHaveBeenCalledWith("encounter", "NEWS2");
  expect(screen.getByText("Missing observations")).toBeInTheDocument();
  expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  expect(screen.getByText("Recorded parameter")).toBeInTheDocument();
});

it("distinguishes unavailable history from an empty history and supports recovery", async () => {
  fixture.scores.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
  mount(); expect(await screen.findByText("Score history unavailable")).toBeInTheDocument();
  expect(screen.queryByText("No scores recorded for this encounter.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No scores recorded for this encounter.")).toBeInTheDocument();
});

it("preserves the server alert's score and requires the existing evaluation permission", async () => {
  fixture.evaluate.mockResolvedValue({ score: { totalScore: 0, riskCategory: "Medium" }, alert: { id: "alert", score: 0, message: "Recorded clinical alert" } });
  const view = mount(); await screen.findByText("No evaluation recorded yet.");
  fireEvent.click(screen.getByRole("button", { name: "Evaluate score" }));
  expect(await screen.findByText("Score: 0")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
  await waitFor(() => expect(fixture.acknowledge).toHaveBeenCalledWith("alert"));
  fixture.canEvaluate = false; view.rerender(<ToastProvider><NEWS2Calculator encounterId="encounter" patientId="patient" /></ToastProvider>);
  expect(screen.queryByRole("button", { name: "Evaluate score" })).not.toBeInTheDocument();
});
