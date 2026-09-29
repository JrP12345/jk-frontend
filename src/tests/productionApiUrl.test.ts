import { describe, expect, it } from "vitest";
import { validateProductionApiUrl } from "../../scripts/check-production-api-url.mjs";

describe("production frontend API URL", () => {
  it("accepts an explicit deployed API URL", () => {
    expect(() => validateProductionApiUrl("https://api.example.com/api")).not.toThrow();
  });
  it("rejects missing, malformed, credentialed and local API URLs", () => {
    for (const value of [undefined, "", "/api", "https://", "ftp://api.example.com", "http://user:secret@example.com",
      "http://localhost:5000/api", "http://LOCALHOST./api", "http://127.0.0.2/api", "http://[::1]/api", "http://0.0.0.0/api"]) {
      expect(() => validateProductionApiUrl(value)).toThrow();
    }
  });
});
