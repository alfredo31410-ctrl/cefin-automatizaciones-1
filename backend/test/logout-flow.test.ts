import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/backend/[...path]/route.js";
import { apiClient } from "../../lib/api/client.js";
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
    expect(new Headers(forwardedInit?.headers).has("content-type")).toBe(false);
    expect(forwardedInit?.body).toBeUndefined();
    const setCookie = response.headers.getSetCookie().join("; ");
    expect(setCookie).toContain("cefin_session=");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("el cliente no agrega JSON a logout ni a otros POST sin body", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    await apiClient.logout();
    await apiClient.duplicateAutomation("automation-id");
    await apiClient.pauseAutomation("automation-id");
    await apiClient.resumeAutomation("automation-id");
    await apiClient.cancelAutomation("automation-id");

    expect(requests).toHaveLength(5);
    for (const request of requests) {
      expect(request.init?.method).toBe("POST");
      expect(request.init?.body).toBeUndefined();
      expect(new Headers(request.init?.headers).has("content-type")).toBe(false);
      expect(request.init?.credentials).toBe("include");
    }
  });

  it("conserva application/json cuando el POST sí contiene JSON", async () => {
    let forwardedInit: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      forwardedInit = init;
      return new Response(JSON.stringify({ user: {}, expiresAt: "2099-01-01T00:00:00.000Z" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    await apiClient.login("admin@example.com", "password");

    expect(new Headers(forwardedInit?.headers).get("content-type")).toBe("application/json");
    expect(forwardedInit?.body).toBe(JSON.stringify({ email: "admin@example.com", password: "password" }));
  });

  it("el BFF descarta content-type JSON cuando recibe un POST vacío", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    let forwardedInit: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      forwardedInit = init;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    const response = await POST(new Request("https://app.example.com/api/backend/api/v1/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "cefin_session=token" },
    }), { params: Promise.resolve({ path: ["api", "v1", "auth", "logout"] }) });

    expect(response.status).toBe(200);
    expect(new Headers(forwardedInit?.headers).has("content-type")).toBe(false);
    expect(forwardedInit?.body).toBeUndefined();
  });

  it("el BFF conserva content-type y contenido cuando recibe JSON real", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    let forwardedInit: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      forwardedInit = init;
      return new Response(JSON.stringify({ data: { id: "line-id" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }));
    const payload = JSON.stringify({ name: "Nueva línea" });

    const response = await POST(new Request("https://app.example.com/api/backend/api/v1/lines", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "cefin_session=token" },
      body: payload,
    }), { params: Promise.resolve({ path: ["api", "v1", "lines"] }) });

    expect(response.status).toBe(201);
    expect(new Headers(forwardedInit?.headers).get("content-type")).toBe("application/json");
    expect(new TextDecoder().decode(forwardedInit?.body as ArrayBuffer)).toBe(payload);
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
