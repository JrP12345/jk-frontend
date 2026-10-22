import { headers } from "next/headers";
import PublicBrandStyleSheet from "./PublicBrandStyleSheet";

/** Server-rendered branding must use a nonce stylesheet rather than style attributes. */
export default async function PublicBrandStyles({ color }: { color?: string | null }) {
  const safeColor = typeof color === "string" && /^#[\da-f]{6}$/i.test(color) ? color : "#0F6F66";
  return <PublicBrandStyleSheet color={safeColor} nonce={(await headers()).get("x-nonce") || undefined} />;
}
