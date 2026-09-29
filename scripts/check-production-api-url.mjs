import { pathToFileURL } from "node:url";

export function validateProductionApiUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("NEXT_PUBLIC_API_URL must be an absolute HTTP(S) API URL"); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_API_URL must be an HTTP(S) URL without credentials");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || hostname === "[::]"
    || hostname === "0.0.0.0" || hostname.startsWith("127.")) {
    throw new Error("NEXT_PUBLIC_API_URL cannot target a local machine in a production image");
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
