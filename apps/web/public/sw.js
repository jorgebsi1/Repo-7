// Service worker mínimo del esqueleto: permite instalar la PWA. Sin caché offline todavía
// (el modo sin conexión de catálogo y carrito llega en los acabados).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
