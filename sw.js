// CRM André Vitor — Service Worker
const scheduled = new Map();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Notificação recebida do servidor (Web Push real — funciona com app fechado)
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || '🔔 Lembrete', {
      body: data.body || '',
      tag: 'push-' + Date.now(),
      vibrate: [200, 100, 200],
      requireInteraction: false
    })
  );
});

// Clique na notificação — abre o app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(cs => {
    const c = cs.find(c => c.url.includes('mobile.html'));
    if(c) { c.focus(); return; }
    clients.openWindow('/mobile.html');
  }));
});

// Backup local: notificações agendadas enquanto o app está aberto
self.addEventListener('message', e => {
  if(!e.data) return;
  const {type, id, title, body, delay} = e.data;
  if(type === 'SCHEDULE') {
    if(scheduled.has(id)) clearTimeout(scheduled.get(id));
    const t = setTimeout(() => {
      self.registration.showNotification(title, {
        body: body || '',
        tag: id,
        vibrate: [200, 100, 200],
        requireInteraction: false
      });
      scheduled.delete(id);
    }, Math.max(0, delay));
    scheduled.set(id, t);
  }
  if(type === 'CANCEL') {
    if(scheduled.has(id)) { clearTimeout(scheduled.get(id)); scheduled.delete(id); }
  }
});
