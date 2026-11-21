import { DurableObject } from "cloudflare:workers";

const PORT = 4000;
const PUBLIC_SITE = "https://emc-public-site.pages.dev";
const HR_SITE = "https://emc-talent-portal.pages.dev";

interface Env {
  API_CONTAINER: DurableObjectNamespace<ApiContainer>;
  [key: string]: unknown;
}

export class ApiContainer extends DurableObject<Env> {
  private starting: Promise<void> | undefined;

  async fetch(request: Request): Promise<Response> {
    this.starting ??= this.startAndWait().finally(() => {
      this.starting = undefined;
    });
    await this.starting;
    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    const forwarded = new Request(url, request);
    forwarded.headers.delete("host");
    return this.ctx.container!.getTcpPort(PORT).fetch(forwarded);
  }

  private async startAndWait(): Promise<void> {
    const container = this.ctx.container!;
    if (!container.running) {
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(this.env)) {
        if (typeof value === "string") env[key] = value;
      }
      env.NODE_ENV = "production";
      env.PORT = String(PORT);
      env.APP_URL = HR_SITE;
      env.CORS_ORIGINS = `${HR_SITE},${PUBLIC_SITE}`;
      env.CAREER_SITE_URL = `${PUBLIC_SITE}/careers.html`;
      env.TRACK_APPLICATION_URL = `${PUBLIC_SITE}/track-application.html`;
      env.PUBLIC_API_URL = env.API_URL || HR_SITE;
      container.start({
        image: container.images.base,
        instance: "lite",
        enableInternet: true,
        env,
      });
    }
    await container.setInactivityTimeout(10 * 60 * 1000);
    void container.monitor().catch((error: unknown) => console.error("Container exited:", error));
    const port = container.getTcpPort(PORT);
    for (let attempt = 0; attempt < 150; attempt++) {
      try {
        const response = await port.fetch("http://container/api/v1/health", {
          signal: AbortSignal.timeout(2000),
        });
        await response.body?.cancel();
        if (response.ok) return;
      } catch {
        // container still booting
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("Container did not become ready");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.API_CONTAINER.idFromName("emc-api");
    return env.API_CONTAINER.get(id).fetch(request);
  },
};
