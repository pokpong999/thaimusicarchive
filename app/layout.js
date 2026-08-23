import './globals.css';
import Topbar from '../components/Topbar';

export const metadata = {
  title: 'Thai Music Archive — ฐานข้อมูลเพลงไทย',
  description: 'ฐานข้อมูลกระสวนและทำนองเพลงไทยคลาสสิก 300 เพลง · Thai Classical Music Pattern & Melody Archive',
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
          Thai Music Archive (THMA) · ฐานข้อมูลกระสวนและทำนองเพลงไทย · ข้อมูลและลิขสิทธิ์โดย Pk
        </footer>
      </body>
    </html>
  );
}
