// Service worker do MrFut.
//
// De propósito NÃO faz cache agressivo de páginas/dados — esse é um app que
// muda o tempo todo (placar ao vivo, lances, etc.), cache de conteúdo geraria
// mais bug do que benefício. O papel dele aqui é só:
// 1) tornar o app instalável de verdade (exigência técnica do navegador)
// 2) receber e mostrar notificações push, mesmo com o app fechado

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "MrFut", body: event.data.text() };
  }

  const title = payload.title || "MrFut";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "https://zizvdvekktiaqiqcacty.supabase.co/storage/v1/object/public/branding/pwa-icon",
    badge: "https://zizvdvekktiaqiqcacty.supabase.co/storage/v1/object/public/branding/favicon",
    data: { link: payload.link || "/" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Ao clicar na notificação, abre o app já na tela certa (ou foca se já estiver aberto)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});
