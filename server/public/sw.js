/* Git1 service worker — shows push notifications even when the dashboard
   tab is closed or the phone is locked. Required for Web Push.            */
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data && event.data.text() }; }
  const title = payload.title || 'Git1';
  const body  = payload.body  || '';
  const data  = payload.data  || {};
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data,
      tag: data.kind || 'git1',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { c.focus(); return; } }
    if (self.clients.openWindow) await self.clients.openWindow('/');
  })());
});
