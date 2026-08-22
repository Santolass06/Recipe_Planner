// Minimal hand-rolled W3C WebDriver HTTP client — just the handful of
// endpoints this server needs (session, execute, url, screenshot, delete).
// tauri-driver/WebKitWebDriver already speak the real protocol; no
// webdriverio/selenium-webdriver dependency needed for this small a surface.

export class WebDriverError extends Error {}

export class WebDriverClient {
  sessionId: string | null = null;

  constructor(private readonly baseUrl: string) {}

  private async request<T = unknown>(method: string, path: string, body?: unknown, timeoutMs = 30_000): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    }).catch((e) => {
      if (e?.name === "TimeoutError") {
        throw new WebDriverError(
          `${method} ${path} did not respond within ${timeoutMs}ms — tauri-driver may be wedged by a session ` +
          `an earlier crashed run never closed. native_start retries once against a fresh driver process for ` +
          `exactly this case; if it still fails, run \`pkill -9 -f tauri-driver -f WebKitWebDriver\` by hand.`,
        );
      }
      throw e;
    });
    const json = (await res.json().catch(() => ({}))) as { value?: T; message?: string };
    if (!res.ok) {
      throw new WebDriverError(json.message ?? `WebDriver request failed: ${method} ${path} -> ${res.status}`);
    }
    return json.value as T;
  }

  /** Starts a session against the given Tauri application binary. */
  async newSession(applicationPath: string): Promise<{ sessionId: string; capabilities: unknown }> {
    const result = await this.request<{ sessionId: string; capabilities: unknown }>(
      "POST",
      "/session",
      { capabilities: { alwaysMatch: { "tauri:options": { application: applicationPath } } } },
      15_000,
    );
    this.sessionId = result.sessionId;
    return result;
  }

  private requireSession(): string {
    if (!this.sessionId) throw new WebDriverError("no active session — call native_start first");
    return this.sessionId;
  }

  /**
   * Runs `script` in the webview and returns its value. The script is
   * wrapped in an async IIFE and always driven through WebDriver's
   * execute/async endpoint, so callers can write plain synchronous
   * expressions ("return 1+1") or use await freely ("await fetch(...)")
   * without needing to know which endpoint that requires — matching how
   * Playwright's evaluate() already works elsewhere in this project's
   * testing workflow.
   */
  async evaluate<T = unknown>(script: string): Promise<T> {
    const sid = this.requireSession();
    const wrapped = `
      const __done = arguments[arguments.length - 1];
      (async () => { ${script} })()
        .then((r) => __done({ ok: true, value: r === undefined ? null : r }))
        .catch((e) => __done({ ok: false, error: String(e && e.stack ? e.stack : e) }));
    `;
    const result = await this.request<{ ok: boolean; value?: T; error?: string }>(
      "POST",
      `/session/${sid}/execute/async`,
      { script: wrapped, args: [] },
    );
    if (!result.ok) throw new WebDriverError(result.error ?? "evaluate() failed in the webview");
    return result.value as T;
  }

  async navigate(url: string): Promise<void> {
    const sid = this.requireSession();
    await this.request("POST", `/session/${sid}/url`, { url });
  }

  /** Returns a PNG screenshot as base64. */
  async screenshot(): Promise<string> {
    const sid = this.requireSession();
    return this.request<string>("GET", `/session/${sid}/screenshot`);
  }

  async close(): Promise<void> {
    if (!this.sessionId) return;
    const sid = this.sessionId;
    this.sessionId = null;
    await this.request("DELETE", `/session/${sid}`).catch(() => {});
  }
}
