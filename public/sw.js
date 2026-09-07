self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
// Never cache customer details, staff pages, booking availability or payment flows.
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            '<!doctype html><html lang="en-GB"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline | Symmetry</title><style>body{margin:0;background:#efebe3;color:#161616;padding:clamp(24px,8vw,80px);font:18px/1.6 Arial,sans-serif}main{max-width:580px;margin:8vh auto}.brand{letter-spacing:.2em;font:24px Georgia,serif}h1{font:normal clamp(54px,12vw,84px)/1.1 Georgia,serif;margin:60px 0 24px}p{color:#625d58}a{display:inline-block;margin-top:24px;background:#161616;color:#fff;text-decoration:none;padding:14px 24px}a:focus-visible{outline:3px solid #4a2026;outline-offset:4px}</style></head><body><main><div class="brand">SYMMETRY</div><h1>Back soon.</h1><p>You’re offline. Reconnect to view your trims or make a booking.</p><p>If you were saving your card, check your bookings once you’re back online.</p><a href="/bookings">Your bookings</a></main></body></html>',
            { headers: { "Content-Type": "text/html" } },
          ),
      ),
    );
});
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch {}
  event.waitUntil(
    self.registration.showNotification("Symmetry", {
      body: data.body || "There’s an update to your trim.",
      icon: "/apple-touch-icon.png",
      data: { url: data.url || "/bookings" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.url, self.location.origin);
  if (url.origin === self.location.origin)
    event.waitUntil(self.clients.openWindow(url.href));
});
