/**
 * Joins class names, filters falsy values, and collapses whitespace.
 * Prevents hydration mismatches caused by multi-line template literals.
 */
export function cn(...classes: unknown[]): string {
  return classes.filter((c): c is string => typeof c === "string" && c.trim().length > 0).join(" ").replace(/\s+/g, " ").trim();
}
