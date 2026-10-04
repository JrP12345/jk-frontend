import { pathToFileURL } from "node:url";

/** @param {string | undefined} value */
export function validateProductionApiUrl(value, name = "NEXT_PUBLIC_API_URL") {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an absolute HTTPS URL`); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be an HTTPS URL without credentials, query parameters or fragments`);
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || hostname === "[::]"
    || hostname === "0.0.0.0" || hostname.startsWith("127.")) {
    throw new Error(`${name} cannot target a local machine in production`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    validateProductionApiUrl(process.env.NEXT_PUBLIC_API_URL);
    process.stdout.write("Production API URL validation passed.\n");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
