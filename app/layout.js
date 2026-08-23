import './globals.css';
import Topbar from '../components/Topbar';

export const metadata = {
  title: 'หอจดหมายเหตุดนตรีไทย — Thai Music Archive',
  description: 'หอจดหมายเหตุดนตรีไทย · ฐานข้อมูลกระสวนและทำนองเพลงไทยคลาสสิก 300 เพลง พร้อมบันทึกเหตุการณ์ดนตรีไทย อดีต ปัจจุบัน อนาคต · Thai Classical Music Archive',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@400;600;700&family=Noto+Sans+Thai:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Topbar />
        {children}
        <footer className="footer">
          หอจดหมายเหตุดนตรีไทย · Thai Music Archive (THMA) · ข้อมูลและลิขสิทธิ์โดย Pk
        </footer>
      </body>
    </html>
  );
}
