/** Shared appearance only; each control retains its own validation and events. */
export const controlMotion = "transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--motion-fast)] ease-smooth";
export const fieldLabel = "text-sm font-medium leading-snug text-text";
export const fieldBase = `min-w-0 text-text font-normal ${controlMotion} placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-alt`;
export const fieldError = "aria-invalid:border-danger aria-invalid:focus-visible:border-danger aria-invalid:focus-visible:ring-2 aria-invalid:focus-visible:ring-danger data-[invalid=true]:border-danger data-[invalid=true]:focus-within:border-danger data-[invalid=true]:focus-within:ring-danger";

const borderedField = "border border-input-border bg-surface hover:border-border-focus focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-focus-ring";
export const fieldVariants = {
  default: `rounded-control ${borderedField}`,
  filled: "rounded-control border border-input-border bg-surface-alt hover:bg-surface-hover focus-visible:bg-surface focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-focus-ring",
  flush: "rounded-none border-0 bg-transparent shadow-none focus-visible:ring-2 focus-visible:ring-focus-ring",
  pill: `rounded-full ${borderedField}`,
  inset: `rounded-control ${borderedField}`,
} as const;
