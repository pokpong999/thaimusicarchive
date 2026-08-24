'use client';
import { useMe } from './Gate';

export default function FooterNav() {
  const { isAdmin } = useMe();
  const links = [
    ['/krasuan', 'ค้นกระสวน'], ['/people', 'ครูดนตรี'], ['/timeline', 'เส้นเวลา'],
    ['/compare', 'เปรียบเทียบเพลง'], ['/search', 'ค้นหา'], ['/about', 'เกี่ยวกับโครงการ'],
    ['/premium', '💎 สมาชิกอุปถัมภ์'],
    ...(isAdmin ? [['/spec', 'Krasuan Code'], ['/data', 'Open Data'], ['/glossary', 'อภิธานศัพท์'], ['/learn', 'เรียนรู้']] : []),
  ];
  return (
    <div style={{display:'flex',gap:'1.2rem',justifyContent:'center',flexWrap:'wrap',marginBottom:'0.6rem',fontSize:'0.8rem'}}>
      {links.map(([href, label]) => <a key={href} href={href} style={{color:'var(--gold2)'}}>{label}</a>)}
    </div>
  );
}
