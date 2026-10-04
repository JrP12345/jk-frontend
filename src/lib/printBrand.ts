/** Copy the fixed print palette into standalone popup documents. Screen mode
 * never changes paper colors; the values come from the shared CSS tokens. */
export function getPrintBrandStyles(): string {
  const style = getComputedStyle(document.documentElement);
  const tokens = [
    "text", "secondary", "muted", "background", "surface", "surface-muted",
    "border", "input-border", "accent", "accent-strong", "success", "success-subtle",
  ];
  const declarations = tokens.map(token => {
    const name = `--print-${token}`;
    const value = style.getPropertyValue(name).trim();
    return /^#[\da-f]{6}$/i.test(value) ? `${name}:${value};` : "";
  }).join("");
  return `:root{${declarations}color-scheme:light;}`;
}

export class PrintPreparationError extends Error {
  constructor(public readonly reason: "unavailable" | "not-ready" | "assets") { super(reason); }
}

export function getPrintErrorMessage(error: unknown): string {
  if (error instanceof PrintPreparationError) {
    if (error.reason === "unavailable") return "Printing is not available in this browser. Open this page in your device’s browser and try again.";
    if (error.reason === "not-ready") return "The document is not ready yet. Please wait for it to load and try again.";
    if (error.reason === "assets") return "The document could not finish loading. Check your connection and try again.";
  }
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return "You don’t have access to print this document. Refresh the page or contact your clinic.";
  if (status === 404 || status === 410) return "This document is not available. Refresh the page and try again.";
  if (status === 422) return "This document is missing details required for printing. Ask your clinic to update it.";
  return "The print dialog could not be opened. Please try again.";
}

async function waitForPrintAssets(work: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new PrintPreparationError("assets")), 15_000); })]);
  } catch { throw new PrintPreparationError("assets"); }
  finally { clearTimeout(timer); }
}

/** Wait for the actual print assets instead of guessing a timeout. */
export async function printWhenReady(target: Window): Promise<void> {
  if (!target || target.closed || typeof target.print !== "function") throw new PrintPreparationError("unavailable");
  const doc = target.document;
  await waitForPrintAssets(Promise.all([
    ...Array.from(doc.images).map(image => image.decode?.()),
    doc.fonts?.ready,
  ]));
  target.focus();
  target.print();
}

function createPrintFrame(title: string) {
  const previousFocus = document.activeElement as HTMLElement | null;
  const frame = document.createElement("iframe");
  frame.dataset.printFrame = "true";
  frame.title = title;
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:1000px;border:0";
  document.body.appendChild(frame);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => { clearTimeout(timer); frame.remove(); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  frame.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
  return { frame, cleanup, retain: () => { timer = setTimeout(cleanup, 60_000); } };
}

/** Existing HTML templates use the same isolated print lifecycle as screen previews. */
export async function printHtml(html: string): Promise<void> {
  if (!html.trim()) throw new PrintPreparationError("not-ready");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script, iframe, object, embed, form, base, meta[http-equiv], link").forEach(node => node.remove());
  const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce || "";
  parsed.querySelectorAll("style").forEach(style => { style.nonce = nonce; });
  const defaults = parsed.createElement("style");
  defaults.nonce = nonce;
  defaults.textContent = `${getPrintBrandStyles()}@page { size: A4; margin: 10mm; } @media print { body { min-height: 0 !important; } button, .no-print { display: none !important; } }`;
  parsed.head.prepend(defaults);
  parsed.querySelectorAll("*").forEach(element => {
    Array.from(element.attributes).forEach(attribute => {
      if (/^on/i.test(attribute.name) || attribute.name === 'srcdoc' ||
        (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(attribute.name) && /^\s*(javascript|vbscript|data:text\/html):/i.test(attribute.value))) element.removeAttribute(attribute.name);
    });
  });
  const job = createPrintFrame(parsed.title || "Print document");
  try {
    const doc = job.frame.contentDocument!;
    const ready = new Promise<void>(resolve => { job.frame.onload = () => resolve(); });
    doc.open(); doc.write(`<!DOCTYPE html>${parsed.documentElement.outerHTML}`); doc.close();
    await waitForPrintAssets(ready);
    await printWhenReady(job.frame.contentWindow!);
    if (job.frame.isConnected) job.retain();
  } catch (error) { job.cleanup(); throw error; }
}

/** Print one document in isolation; dashboard navigation never reaches paper. */
export async function printElement(element: HTMLElement | null, options: { title?: string; paper?: "A4" | "80mm" | "58mm"; css?: string } = {}): Promise<void> {
  if (!element) throw new PrintPreparationError("not-ready");
  const job = createPrintFrame(options.title || "Print document");
  const { frame } = job;
  try {
    const doc = frame.contentDocument!;
    doc.title = frame.title;
    const styles = Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'));
    await waitForPrintAssets(Promise.all(styles.map(source => {
      const copy = source.cloneNode(true) as HTMLLinkElement | HTMLStyleElement;
      if (copy instanceof HTMLStyleElement) copy.nonce = source.nonce;
      const ready = copy instanceof HTMLLinkElement ? new Promise<void>((resolve, reject) => { copy.onload = () => resolve(); copy.onerror = () => reject(new PrintPreparationError("assets")); }) : Promise.resolve();
      doc.head.appendChild(copy);
      return ready;
    })));
    const style = doc.createElement("style");
    style.nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce || "";
    const paper = options.paper || "A4";
    style.textContent = `${getPrintBrandStyles()}
      :root { --text: var(--print-text); --text-secondary: var(--print-secondary); --text-muted: var(--print-muted); --surface: white; --surface-alt: var(--print-surface-muted); --background: white; color-scheme: light; }
      @page { size: ${paper === "A4" ? "A4" : `${paper} auto`}; margin: ${paper === "A4" ? "10mm" : "2mm"}; }
      html, body { position: static !important; height: auto !important; width: ${paper === "A4" ? "100%" : paper} !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: white !important; color: var(--print-text) !important; font-family: Arial, sans-serif; }
      body > * { width: 100% !important; max-width: none !important; border: 0 !important; box-shadow: none !important; margin: 0 !important; }
      button, .no-print { display: none !important; }
      img { max-width: 100%; } table { width: 100%; border-collapse: collapse; } tr, img { break-inside: avoid; }
      ${options.css || ""}`;
    doc.head.appendChild(style);
    doc.body.appendChild(element.cloneNode(true));
    await printWhenReady(frame.contentWindow!);
    // Some mobile print engines do not dispatch afterprint.
    if (frame.isConnected) job.retain();
  } catch (error) { job.cleanup(); throw error; }
}
