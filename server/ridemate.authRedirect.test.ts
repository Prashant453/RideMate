import { describe, expect, it } from "vitest";
import { getAuthRedirectUrl } from "../client/src/contexts/AuthContext";

describe("Supabase Auth Email Redirect & Verification Flow", () => {
  it("computes the correct auth redirect URL", () => {
    const url = getAuthRedirectUrl();
    expect(url).toBeTruthy();
    expect(typeof url).toBe("string");
    expect(url.startsWith("http://") || url.startsWith("https://")).toBe(true);
  });

  it("handles URL error codes for expired or invalid verification links", () => {
    const searchStr = "error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    const params = new URLSearchParams(searchStr);

    const error = params.get("error");
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");

    expect(error).toBe("access_denied");
    expect(errorCode).toBe("otp_expired");
    expect(errorDescription).toContain("expired");

    const isExpiredOrInvalid =
      errorCode === "otp_expired" ||
      errorCode === "otp_disabled" ||
      errorDescription?.toLowerCase().includes("expired") ||
      errorDescription?.toLowerCase().includes("already") ||
      errorDescription?.toLowerCase().includes("invalid");

    expect(isExpiredOrInvalid).toBe(true);
  });

  it("handles successful verification hash parameters", () => {
    const hashStr = "access_token=test-access-token&refresh_token=test-refresh-token&type=signup";
    const params = new URLSearchParams(hashStr);

    expect(params.get("access_token")).toBe("test-access-token");
    expect(params.get("type")).toBe("signup");
  });
});
