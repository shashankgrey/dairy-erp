// Deliberately minimal service worker. It exists so browsers treat the
// site as an installable app, and it does NOT cache anything: every
// request goes straight to the network. That's intentional -- this app
// ships updates often, and a caching service worker would keep serving
// a stale frontend after a deploy (the same stale-JavaScript problem
// we hit earlier). With no caching, the installed app picks up each new
// Vercel deploy the next time it's opened, with no reinstall needed.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // no-op: let the browser handle the request normally (network)
});
