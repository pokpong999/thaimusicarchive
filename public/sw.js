const CACHE = 'thma-v1';
const CORE = ['/', '/offline.html', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                 // ข้ามข้อมูลจาก Supabase/CDN
  if (url.pathname.startsWith('/api/')) return;

  // หน้าเว็บ: เอาของใหม่ก่อน ถ้าเน็ตหลุดใช้ของที่เคยเก็บไว้
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('/offline.html')))
    );
    return;
  }

  // ไฟล์ประกอบ (ฟอนต์/ไอคอน/สคริปต์): ใช้ของที่เก็บไว้ก่อนเพื่อความเร็ว
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/fonts/')
          || /\.(png|jpg|jpeg|webp|svg|woff2?|otf|css|js)$/.test(url.pathname))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
