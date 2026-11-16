import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { QuantityInput } from "@/components/ui";

function Editor({ initial = "1", min = 1, max = 10, disabled = false, enter = vi.fn() }) {
  const [value, setValue] = useState(initial);
  return <QuantityInput label="Quantity cotton" value={value} onValueChange={setValue} min={min} max={max} disabled={disabled} onKeyDown={event => { if (event.key === "Enter") enter(); }} />;
}
it("edits whole units and bounds both buttons and arrow keys", () => {
  render(<Editor max={2} />);
  expect(screen.getByRole("button", { name: "Decrease quantity cotton" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Increase quantity cotton" }));
  expect(screen.getByRole("spinbutton", { name: "Quantity cotton" })).toHaveValue(2);
  expect(screen.getByRole("button", { name: "Increase quantity cotton" })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "ArrowUp" });
  expect(screen.getByRole("spinbutton")).toHaveValue(2);
  fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "ArrowDown" });
  expect(screen.getByRole("spinbutton")).toHaveValue(1);
});
it("preserves a temporary empty draft and can restart at its minimum", () => {
  render(<Editor />);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
  expect(screen.getByRole("spinbutton")).toHaveValue(null);
  expect(screen.getByRole("button", { name: "Decrease quantity cotton" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Increase quantity cotton" }));
  expect(screen.getByRole("spinbutton")).toHaveValue(1);
});
it("keeps invalid pasted values available for correction instead of silently changing the bill", () => {
  render(<Editor />);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "1.5" } });
  expect(screen.getByRole("spinbutton")).toHaveValue(1.5);
  expect(screen.getByRole("button", { name: "Increase quantity cotton" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Decrease quantity cotton" })).toBeDisabled();
});
it("supports zero where allowed and prevents integer overflow", () => {
  const view = render(<Editor initial="0" min={0} />);
  fireEvent.click(screen.getByRole("button", { name: "Increase quantity cotton" }));
  expect(screen.getByRole("spinbutton")).toHaveValue(1);
  view.unmount(); render(<Editor initial={String(Number.MAX_SAFE_INTEGER)} max={Number.MAX_SAFE_INTEGER} />);
  expect(screen.getByRole("button", { name: "Increase quantity cotton" })).toBeDisabled();
});
it("disables the whole control and forwards Enter to the caller", () => {
  const enter = vi.fn(), view = render(<Editor disabled />);
  expect(screen.getByRole("spinbutton")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Increase quantity cotton" })).toBeDisabled();
  view.unmount(); render(<Editor enter={enter} />);
  fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "Enter" });
  expect(enter).toHaveBeenCalledOnce();
});
