/** Integration tests can set the shared picker's form value without navigating months. */
export function datePickerInput(trigger: HTMLElement): HTMLInputElement {
  const input = document.getElementById(trigger.id.replace(/-trigger$/, ""));
  if (!(input instanceof HTMLInputElement)) throw new Error("DatePicker form input not found");
  return input;
}
