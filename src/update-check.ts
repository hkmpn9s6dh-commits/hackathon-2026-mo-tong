/**
 * Zero-action updates: the page compares its own build stamp with the one on
 * the server and reloads itself once per new build. No cache instructions for
 * the player, ever.
 */
const STAMP = 'mo-tong-reloaded-for';

export function watchForUpdates(): void {
  const current = document.querySelector<HTMLMetaElement>('meta[name="app-version"]')?.content;
  if (!current) return;

  let busy = false;

  const check = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const res = await fetch(`index.html?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const html = await res.text();
      const latest = /name="app-version" content="([^"]+)"/.exec(html)?.[1];
      if (!latest || latest === current) return;
      // idempotent: one reload per target build, never a loop
      if (sessionStorage.getItem(STAMP) === latest) return;
      sessionStorage.setItem(STAMP, latest);
      location.replace(`${location.pathname}?v=${encodeURIComponent(latest)}`);
    } catch {
      /* offline or blocked: try again on the next tick */
    } finally {
      busy = false;
    }
  };

  setTimeout(check, 1500);
  setInterval(check, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void check();
  });
  window.addEventListener('focus', () => void check());
}
