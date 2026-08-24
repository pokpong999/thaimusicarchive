export default function manifest() {
  return {
    name: 'หอจดหมายเหตุดนตรีไทย · Thai Music Archive',
    short_name: 'ดนตรีไทย',
    description: 'คลังโน้ตเพลงไทย 300 เพลง เล่นเสียงฆ้องจริง พร้อมจดหมายเหตุประวัติศาสตร์ดนตรีไทย',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0F1B2D',
    theme_color: '#0F1B2D',
    lang: 'th',
    categories: ['music', 'education', 'books'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'ค้นหาเพลง', url: '/search' },
      { name: 'หอจดหมายเหตุ', url: '/archive' },
      { name: 'ค้นกระสวน', url: '/krasuan' },
    ],
  };
}
