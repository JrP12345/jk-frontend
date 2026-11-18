import { PHARMACY_CALCULATION_ENGINE_SHA256 } from "./generated/pharmacyCalculation";
import { PHARMACY_OFFLINE_DOCUMENT_SHA256 } from "./generated/pharmacyOfflineDocument";

export const PHARMACY_OFFLINE_CACHE = "ekavyu-cache-v25";
/** Static public resources only. This list is also consumed by the build script
 * and checked against the service worker; no authenticated page/API is allowed.
 */
export const PHARMACY_OFFLINE_FILES = [
  "/pharmacy-offline.html", "/pharmacy-offline.css", "/pharmacy-offline/entry.js", "/pharmacy-offline/pharmacyFinal.js",
  "/pharmacy-offline/pharmacyDrafts.js", "/pharmacy-offline/pharmacyCatalogue.js", "/pharmacy-offline/pharmacyBranchCatalogue.js", "/pharmacy-offline/pharmacyBackgroundWork.js", "/pharmacy-offline/authScope.js",
  "/pharmacy-offline/pharmacyOfflineLedger.js", "/pharmacy-offline/pharmacyOfflineCrypto.js", "/pharmacy-offline/pharmacyOfflineGrant.js", "/pharmacy-offline/pharmacyOfflineSession.js", "/pharmacy-offline/pharmacyOfflineIdentity.js",
  "/pharmacy-offline/pharmacyInvoice.js", "/pharmacy-offline/pharmacyInvoiceNumberFormat.js", "/pharmacy-offline/pharmacyOfflinePricing.js", "/pharmacy-offline/pharmacyOfflinePrint.js",
  "/pharmacy-offline/pharmacyPrintPreferences.js",
  "/pharmacy-offline/pharmacyCalculation.js", "/pharmacy-offline/pharmacyOfflineDocument.js",
] as const;

export async function installPharmacyOfflineAssets(signal?: AbortSignal) {
  if (!("serviceWorker" in navigator) || !("caches" in globalThis)) throw new Error("This browser cannot install the public offline counter.");
  const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  await registration.update();
  const response = await fetch("/pharmacy-offline/manifest.json", { cache: "no-store", signal });
  if (!response.ok || response.redirected) throw new Error("Offline counter assets could not be verified. Keep this preparation and retry online.");
  const manifest = await response.json() as { version: number; calculation: string; document: string; files: Array<{ path: string; sha256: string }> };
  if (manifest.version !== 1 || manifest.calculation !== PHARMACY_CALCULATION_ENGINE_SHA256 || manifest.document !== PHARMACY_OFFLINE_DOCUMENT_SHA256 ||
      !Array.isArray(manifest.files) || manifest.files.length !== PHARMACY_OFFLINE_FILES.length || new Set(manifest.files.map(file => file.path)).size !== PHARMACY_OFFLINE_FILES.length ||
      manifest.files.some(file => !PHARMACY_OFFLINE_FILES.includes(file.path as typeof PHARMACY_OFFLINE_FILES[number]) || !/^[a-f0-9]{64}$/.test(file.sha256))) throw new Error("This browser's offline counter differs from the current prepared billing policy. Refresh online before activation.");
  const cache = await caches.open(PHARMACY_OFFLINE_CACHE);
  for (const file of manifest.files) {
    const response = await fetch(file.path, { cache: "no-store", signal });
    if (!response.ok || response.redirected || /private|no-store/i.test(response.headers.get("cache-control") || "") || new URL(response.url).pathname !== file.path) throw new Error("A public offline asset was unavailable or private. Checkout was not activated.");
    const body = await response.clone().arrayBuffer();
    if (body.byteLength > 1024 * 1024) throw new Error("Offline counter resource exceeds its supported bound.");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", body))).map(byte => byte.toString(16).padStart(2, "0")).join("");
    if (hash !== file.sha256) throw new Error("Offline asset content changed during preparation. Retry the original setup.");
    await cache.put(file.path, response);
  }
}
