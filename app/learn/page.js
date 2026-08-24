'use client';
import { FeaturePage } from '../../components/Gate';
import { useState } from 'react';
import { thaiToKeys } from '../../lib/thnotation';
import { playPercussion } from '../../lib/nathab';

const DEMO = '- - - ซ | - ล ดํ รํ | - มํ - รํ | - ดํ - ล';

export default function LearnPage() {
  const [pat, setPat] = useState('---X-XXX-X-X-X-X'.split(''));

  function toggle(i) { setPat(p => p.map((v, j) => j === i ? (v === 'X' ? '-' : 'X') : v)); }

  async function hear() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ctx.currentTime + 0.1;
    pat.forEach((v, i) => { if (v === 'X') playPercussion(ctx, 'ฉับ', t0 + i * 0.22, 0.8); });
  }

  const code = [0,1,2,3].map(h => {
    const seg = pat.slice(h*4, h*4+4).join('');
    const M = {'----':'O','X---':'A','-X--':'B','--X-':'C','---X':'D','XX--':'E','X-X-':'F','X--X':'G',
      '-XX-':'H','-X-X':'I','--XX':'J','XXX-':'K','XX-X':'L','X-XX':'M','-XXX':'N','XXXX':'P'};
    return M[seg];
  }).join('');

  return (
    <FeaturePage feature="page_learn">
    <main className="container" style={{maxWidth:'720px',lineHeight:1.9}}>
      <div className="section-title" style={{fontSize:'1.3rem'}}>🎓 เรียนรู้ · Learn</div>

      <div className="card" style={{marginTop:'1rem'}}>
        <div style={{fontWeight:600,marginBottom:'0.5rem'}}>๑. อ่านโน้ตไทยเบื้องต้น · Reading Thai notation</div>
        <div style={{fontSize:'0.85rem'}}>
          โน้ตไทยใช้ 7 เสียง ด ร ม ฟ ซ ล ท · จุดบน = เสียงสูง · จุดล่าง = เสียงต่ำ · "-" = ไม่มีเสียง
          · 1 ห้องมี 4 ตำแหน่ง คั่นด้วยเส้น · ตัวอย่าง:
        </div>
        <div style={{background:'#fff',color:'#000',borderRadius:'6px',padding:'0.8rem 1rem',margin:'0.7rem 0',
          fontFamily:'THNotation',fontSize:'1.5rem',letterSpacing:'2px'}}>
          {thaiToKeys(DEMO)}
        </div>
        <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>
          อ่านว่า: (เงียบ 3) ซ | (เงียบ) ล ดํสูง รํสูง | ... — โน้ตแสดงด้วยฟอนต์ TH Notation
        </div>
      </div>

      <div className="card">
        <div style={{fontWeight:600,marginBottom:'0.5rem'}}>๒. กระสวนคืออะไร · What is a krasuan? — ลองเล่น!</div>
        <div style={{fontSize:'0.85rem',marginBottom:'0.8rem'}}>
          กดช่องเพื่อเปิด/ปิดเสียง (X = มีเสียง) แล้วกดฟังจังหวะ — รหัสกระสวนจะเปลี่ยนตามทันที
        </div>
        <div style={{display:'flex',gap:'3px',flexWrap:'wrap'}}>
          {pat.map((v, i) => (
            <span key={i}>
              {i > 0 && i % 4 === 0 && <span style={{color:'var(--border)',margin:'0 5px',fontSize:'1.4rem'}}>|</span>}
              <button onClick={() => toggle(i)} style={{width:'42px',height:'42px',borderRadius:'6px',
                border:'1px solid var(--border)',cursor:'pointer',fontSize:'1rem',fontWeight:700,
                background: v === 'X' ? 'var(--gold)' : 'var(--navy3)',
                color: v === 'X' ? 'var(--navy)' : 'var(--muted)'}}>{v}</button>
            </span>
          ))}
        </div>
        <div style={{display:'flex',gap:'12px',alignItems:'center',marginTop:'0.9rem',flexWrap:'wrap'}}>
          <button className="btn btn-jade btn-sm" onClick={hear}>▶ ฟังจังหวะ</button>
          <span style={{fontSize:'0.85rem'}}>รหัสกระสวน: </span>
          <b style={{fontFamily:'monospace',fontSize:'1.3rem',color:'var(--gold)'}}>{code}</b>
          <a href={`/krasuan`} style={{fontSize:'0.75rem',color:'var(--jade)'}}>→ ค้นว่ากระสวนนี้อยู่ในเพลงไหน</a>
        </div>
      </div>

      <div className="card" style={{fontSize:'0.85rem'}}>
        <div style={{fontWeight:600,marginBottom:'0.5rem'}}>๓. ไปต่อ · Next steps</div>
        <a href="/glossary" style={{color:'var(--gold2)'}}>📖 อภิธานศัพท์</a> ·{' '}
        <a href="/spec" style={{color:'var(--gold2)'}}>📐 มาตรฐาน Krasuan Code</a> ·{' '}
        <a href="/" style={{color:'var(--gold2)'}}>🎼 เปิดโน้ตเพลงจริง 300 เพลง</a>
      </div>
    </main>
    </FeaturePage>
  );
}
