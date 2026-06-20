// Guarded service-worker registration: only registers in production
// on the real published origin. Skips Lovable preview, iframes, and dev.
export async function registerSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const host = url.hostname;
  const isPreviewHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const killSwitch = url.searchParams.get("sw") === "off";
  const refuse = !import.meta.env.PROD || inIframe || isPreviewHost || killSwitch;

  if (refuse) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()),
      );
    } catch { /* ignore */ }
    return;
  }

  try {
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox("/sw.js", { scope: "/" });
    wb.register();
  } catch { /* ignore */ }
}
