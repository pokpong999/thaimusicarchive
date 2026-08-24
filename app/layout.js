import './globals.css';
import Topbar from '../components/Topbar';
import { LangProvider } from '../lib/i18n';

export const metadata = {
  metadataBase: new URL('https://thaimusicarchive.com'),
  title: 'หอจดหมายเหตุดนตรีไทย — Thai Music Archive',
  description: 'ฐานข้อมูลเพลงไทย 300 เพลง โน้ตเล่นเสียงจริงระบบ 7 เสียงไทย หน้าทับกลอง-ฉิ่ง บันทึกเหตุการณ์ดนตรีไทยบนแผนที่ อดีต ปัจจุบัน อนาคต',
  openGraph: {
    title: 'หอจดหมายเหตุดนตรีไทย · Thai Music Archive',
    description: 'ฐานข้อมูลเพลงไทย โน้ตเล่นเสียงได้จริง และหอจดหมายเหตุเหตุการณ์ดนตรีไทยบนแผนที่',
    url: 'https://thaimusicarchive.com',
    siteName: 'หอจดหมายเหตุดนตรีไทย',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
    locale: 'th_TH',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@400;600;700&family=Noto+Sans+Thai:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <LangProvider>
        <Topbar />
        {children}
        <footer className="footer" style={{lineHeight:2}}>
          <div style={{display:'flex',gap:'1.2rem',justifyContent:'center',flexWrap:'wrap',marginBottom:'0.6rem',fontSize:'0.8rem'}}>
            <a href="/krasuan" style={{color:'var(--gold2)'}}>ค้นกระสวน</a>
            <a href="/people" style={{color:'var(--gold2)'}}>ครูดนตรี</a>
            <a href="/timeline" style={{color:'var(--gold2)'}}>เส้นเวลา</a>
            <a href="/compare" style={{color:'var(--gold2)'}}>เปรียบเทียบเพลง</a>
            <a href="/search" style={{color:'var(--gold2)'}}>ค้นหา</a>
            <a href="/about" style={{color:'var(--gold2)'}}>เกี่ยวกับโครงการ</a>
            <a href="/spec" style={{color:'var(--gold2)'}}>Krasuan Code</a>
            <a href="/data" style={{color:'var(--gold2)'}}>Open Data</a>
            <a href="/glossary" style={{color:'var(--gold2)'}}>อภิธานศัพท์</a>
            <a href="/learn" style={{color:'var(--gold2)'}}>เรียนรู้</a>
          </div>
          <div style={{fontWeight:600,color:'var(--cream)'}}>หอจดหมายเหตุดนตรีไทย · Thai Music Archive (THMA)</div>
          <div>ข้อมูลและลิขสิทธิ์ © ปกป้อง ขำประเสริฐ (Pokpong Khamprasert) — ผลงานที่สมาชิกเพิ่มแสดงเครดิตผู้เพิ่มกำกับไว้</div>
          <div style={{fontSize:'0.78rem'}}>
            ติดต่อผู้ดูแล: ✉️ <a href="mailto:tasanastudio@gmail.com" style={{color:'var(--gold2)'}}>tasanastudio@gmail.com</a>
            {' '}· 💬 LINE: p.khamprasert · ☎️ 097-220-5864
          </div>
        </footer>
        </LangProvider>
      </body>
    </html>
  );
}
