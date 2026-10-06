import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/backend/[...path]/route.js";
import { completeLogout } from "../../lib/auth/logout.js";
import { proxy } from "../../proxy.js";

function proxyRequest(url: string, session?: string): Parameters<typeof proxy>[0] {
  return {
    url,
    nextUrl: new URL(url),
    cookies: {
      get: (name: string) => name === "cefin_session" && session ? { value: session } : undefined,
    },
  } as unknown as Parameters<typeof proxy>[0];
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("logout through Next.js", () => {
  it("BFF reenvía la cookie y garantiza su eliminación first-party", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    const upstreamHeaders = new Headers({ "content-type": "application/json" });
    upstreamHeaders.append("set-cookie", "cefin_session=; Path=/; Max-Age=0");
    let forwardedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      void input;
      forwardedInit = init;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: upstreamHeaders,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("https://app.example.com/api/backend/api/v1/auth/logout", {
      method: "POST",
      headers: { cookie: "cefin_session=raw-session-token" },
    }), { params: Promise.resolve({ path: ["api", "v1", "auth", "logout"] }) });

    expect(response.status).toBe(200);
    expect(new Headers(forwardedInit?.headers).get("cookie")).toBe("cefin_session=raw-session-token");
    const setCookie = response.headers.getSetCookie().join("; ");
    expect(setCookie).toContain("cefin_session=");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("limpia estado y navega solo después de completar logout", async () => {
    const calls: string[] = [];
    await completeLogout({
      requestLogout: async () => { calls.push("logout"); },
      clearAuthentication: () => { calls.push("clear"); },
      replace: (path) => { calls.push(`replace:${path}`); },
    });
    expect(calls).toEqual(["logout", "clear", "replace:/login"]);
  });

  it("no redirige como si hubiera cerrado sesión cuando logout falla", async () => {
    const calls: string[] = [];
    await expect(completeLogout({
      requestLogout: async () => { calls.push("logout"); throw new Error("unavailable"); },
      clearAuthentication: () => { calls.push("clear"); },
      replace: () => { calls.push("replace"); },
    })).rejects.toThrow("unavailable");
    expect(calls).toEqual(["logout"]);
  });

  it.each(["/dashboard", "/automatizaciones", "/grupos", "/historial", "/lineas"])(
    "redirige la ruta protegida %s sin cookie a login",
    async (path) => {
      const response = await proxy(proxyRequest(`https://app.example.com${path}`));
      expect(response.headers.get("location")).toBe("https://app.example.com/login");
    },
  );

  it("un refresh después de logout permanece sin autenticar", async () => {
    const response = await proxy(proxyRequest("https://app.example.com/dashboard"));
    expect(response.headers.get("location")).toBe("https://app.example.com/login");
  });

  it("rechaza una cookie cuya sesión ya no es válida y también la elimina", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "SESSION_INVALID" } }), { status: 401 })));
    const request = proxyRequest("https://app.example.com/dashboard", "revoked-token");

    const response = await proxy(request);
    expect(response.headers.get("location")).toBe("https://app.example.com/login?reason=session");
    const setCookie = response.headers.getSetCookie().join("; ");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });
});
