import { headers } from "next/headers";
import { serializeStructuredData } from "@/lib/publicSeo";

export default async function PublicStructuredData({ data }: { data: unknown }) {
  if (!data) return null;
  return <script type="application/ld+json" nonce={(await headers()).get("x-nonce") || undefined} dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }} />;
}
