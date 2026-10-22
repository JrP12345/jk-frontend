"use client";

export default function PublicBrandStyleSheet({ color, nonce }: { color: string; nonce?: string }) {
  // An RSC navigation has its own request nonce, but the browser still enforces
  // the original document's CSP. Read the bootstrap script's nonce property
  // (the attribute is intentionally hidden by browsers), never a new route nonce.
  const bootstrap = typeof document === "undefined" ? null : document.getElementById("ekavyu-theme-bootstrap");
  const documentNonce = bootstrap?.tagName === "SCRIPT" ? bootstrap.nonce : undefined;
  return <style nonce={documentNonce || nonce}>{`.public-brand-border{border-top:4px solid ${color}}.public-brand-action{background-color:${color}}`}</style>;
}
