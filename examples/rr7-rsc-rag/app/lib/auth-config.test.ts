import { describe, expect, it } from "vitest";
import { resolveAuthBaseURL, resolveTrustedOrigins } from "./auth-config";

describe("resolveAuthBaseURL", () => {
  it("uses BETTER_AUTH_URL when set", () => {
    expect(resolveAuthBaseURL({ BETTER_AUTH_URL: "http://localhost:4000" })).toBe(
      "http://localhost:4000",
    );
  });

  it("defaults to Vite's usual local origin", () => {
    expect(resolveAuthBaseURL({})).toBe("http://localhost:5173");
  });
});

describe("resolveTrustedOrigins", () => {
  it("always trusts localhost and 127.0.0.1 on any port (dev DX)", () => {
    expect(resolveTrustedOrigins({})).toEqual([
      "http://localhost:5173",
      "http://localhost:*",
      "http://127.0.0.1:*",
    ]);
  });

  it("includes BETTER_AUTH_URL and comma-separated extras", () => {
    expect(
      resolveTrustedOrigins({
        BETTER_AUTH_URL: "http://localhost:4000",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://preview.example.com, http://192.168.1.10:5173",
      }),
    ).toEqual([
      "http://localhost:4000",
      "http://localhost:*",
      "http://127.0.0.1:*",
      "https://preview.example.com",
      "http://192.168.1.10:5173",
    ]);
  });
});
