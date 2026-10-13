import { headers } from "next/headers";

/** Server-rendered branding must use a nonce stylesheet rather than style attributes. */
export default async function PublicBrandStyles({ color }: { color?: string | null }) {
  const safeColor = /^#[\da-f]{6}$/i.test(color || "") ? color : "#0F6F66";
  return <style nonce={(await headers()).get("x-nonce") || undefined}>{`.public-brand-border{border-top:4px solid ${safeColor}}.public-brand-action{background-color:${safeColor}}`}</style>;
}
