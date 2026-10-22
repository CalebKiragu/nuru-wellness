import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "@/lib/http";
import { getPublicOrigin, publicRedirect } from "@/lib/url";

describe("public request URLs", () => {
  it("uses forwarded headers instead of Render's internal bind address", () => {
    const request = new Request("http://localhost:10000/api/demo/switch", {
      headers: {
        "x-forwarded-host": "nuru-wellness.onrender.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(getPublicOrigin(request)).toBe("https://nuru-wellness.onrender.com");
    expect(publicRedirect(request, "/").headers.get("location")).toBe("https://nuru-wellness.onrender.com/");
  });

  it("keeps a tenant hostname in local development", () => {
    const request = new Request("http://localhost:3000/dashboard", {
      headers: { host: "amani.localhost:3000" },
    });
    expect(getPublicOrigin(request)).toBe("http://amani.localhost:3000");
  });

  it("rejects protocol-relative redirect targets", () => {
    const request = new Request("http://localhost:10000/api/demo/switch", {
      headers: { "x-forwarded-host": "nuru-wellness.onrender.com", "x-forwarded-proto": "https" },
    });
    expect(publicRedirect(request, "//evil.example").headers.get("location")).toBe(
      "https://nuru-wellness.onrender.com/",
    );
  });

  it("accepts same-origin requests through a proxy", () => {
    const request = new Request("https://nuru-wellness.onrender.com/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://nuru-wellness.onrender.com",
        "x-forwarded-host": "nuru-wellness.onrender.com",
      },
    });
    expect(assertSameOrigin(request)).toBe(true);
  });

  it("rejects a foreign origin", () => {
    const request = new Request("https://nuru-wellness.onrender.com/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "x-forwarded-host": "nuru-wellness.onrender.com",
      },
    });
    expect(assertSameOrigin(request)).toBe(false);
  });
});
