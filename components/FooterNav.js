'use client';
import { usePermissions } from './Gate';
import { EText } from './Editable';

export default function FooterNav() {
  const { can } = usePermissions();
  const links = [
    can('page_krasuan') && ['/krasuan', 'ค้นกระสวน'],
    can('page_people') && ['/people', 'ครูดนตรี'],
    can('page_timeline') && ['/timeline', 'เส้นเวลา'],
    can('page_compare') && ['/compare', 'เปรียบเทียบเพลง'],
    can('page_search') && ['/search', 'ค้นหา'],
    ['/about', 'เกี่ยวกับโครงการ'],
    ['/premium', '💎 สมาชิกอุปถัมภ์'],
    can('page_spec') && ['/spec', 'Krasuan Code'],
    can('page_data') && ['/data', 'Open Data'],
    can('page_glossary') && ['/glossary', 'อภิธานศัพท์'],
    can('page_learn') && ['/learn', 'เรียนรู้'],
  ].filter(Boolean);
  return (
    <div style={{display:'flex',gap:'1.2rem',justifyContent:'center',flexWrap:'wrap',marginBottom:'0.6rem',fontSize:'0.8rem'}}>
      {links.map(([href, label]) => <a key={href} href={href} style={{color:'var(--gold2)'}}>{label}</a>)}
    </div>
  );
}
