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
