'use client';
import { FeaturePage } from '../../components/Gate';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

const SETS = [
  ['krasuan_catalog', 'กระสวนรายวรรค · Krasuan per verse (19,963 rows)'],
  ['luktok_catalog', 'คู่ลูกตกรายประโยค · Cadence pairs (9,895 rows)'],
  ['pattern_library', 'คลังกระสวน · Pattern library (1,451 rows)'],
  ['songs', 'รายการเพลง · Song list'],
];

export default function DataPage() {
  const [msg, setMsg] = useState('');

  async function download(table, fmt) {
    setMsg(`⏳ กำลังดึง ${table}...`);
    let all = [], from = 0;
    while (true) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
      if (error || !data?.length) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
      setMsg(`⏳ ${table}: ${all.length} แถว...`);
    }
    let blob, name;
    if (fmt === 'json') {
      blob = new Blob([JSON.stringify(all, null, 1)], { type: 'application/json' });
      name = `thma_${table}.json`;
    } else {
      const cols = Object.keys(all[0] ?? {});
      const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [cols.join(','), ...all.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
      blob = new Blob(['\ufeff' + csv], { type: 'text/csv' });
      name = `thma_${table}.csv`;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setMsg(`✓ ดาวน์โหลด ${name} (${all.length} แถว)`);
  }

  return (
    <FeaturePage feature="page_data">
    <main className="container" style={{maxWidth:'760px'}}>
      <div className="section-title" style={{fontSize:'1.3rem'}}>📦 ข้อมูลเปิด · Open Data & API</div>
      <div className="section-subtitle">ดาวน์โหลดชุดข้อมูลเพื่อการวิจัย · Download research datasets</div>

      <div className="card" style={{marginTop:'1.2rem'}}>
        <div style={{fontWeight:600,marginBottom:'0.8rem'}}>ชุดข้อมูล · Datasets</div>
        {SETS.map(([t, label]) => (
          <div key={t} style={{display:'flex',gap:'8px',alignItems:'center',padding:'8px 0',
            borderBottom:'1px solid rgba(42,63,92,0.35)',flexWrap:'wrap'}}>
            <span style={{flex:1,fontSize:'0.85rem',minWidth:'220px'}}>{label}</span>
            <button className="btn btn-outline btn-sm" onClick={() => download(t, 'csv')}>CSV</button>
            <button className="btn btn-outline btn-sm" onClick={() => download(t, 'json')}>JSON</button>
          </div>
        ))}
        {msg && <div style={{marginTop:'0.7rem',fontSize:'0.8rem',color:'var(--jade)'}}>{msg}</div>}
      </div>

      <div className="card" style={{fontSize:'0.85rem',lineHeight:1.9}}>
        <div style={{fontWeight:600}}>สัญญาอนุญาต · License</div>
        <p>ชุดข้อมูลเผยแพร่ภายใต้ <b>CC BY 4.0</b> — ใช้ ดัดแปลง เผยแพร่ต่อได้เสรี โดยต้องอ้างอิง:
        <br/>Datasets are released under <b>CC BY 4.0</b> — free to use, adapt and share with attribution:</p>
        <div style={{fontFamily:'monospace',fontSize:'0.75rem',background:'var(--navy3)',padding:'0.7rem',borderRadius:'6px'}}>
          Khamprasert, P. (2026). Thai Music Archive Dataset. https://thaimusicarchive.com/data (CC BY 4.0)
        </div>
      </div>

      <div className="card" style={{fontSize:'0.82rem',lineHeight:1.9}}>
        <div style={{fontWeight:600}}>REST API (read-only)</div>
        <p>ข้อมูลทั้งหมดเข้าถึงได้ผ่าน REST API · All data is accessible via REST:</p>
        <pre style={{background:'var(--navy3)',padding:'0.8rem',borderRadius:'6px',fontSize:'0.68rem',overflowX:'auto'}}>{`GET https://zblllvxuqvggnffpgcpg.supabase.co/rest/v1/pattern_library?code=eq.NIII
Header: apikey: sb_publishable_9vCU3UdNKhuWwueo_tfKgg_Rd4qYzgE

# ตัวอย่าง · Examples
/rest/v1/songs?select=id,name_th,name_en
/rest/v1/krasuan_catalog?song_id=eq.KSY001
/rest/v1/luktok_catalog?song_id=eq.KSY001&order=sentence_no`}</pre>
        <p style={{fontSize:'0.72rem',color:'var(--muted)'}}>อ่านได้อย่างเดียว ปลอดภัยด้วย Row Level Security · Read-only, protected by RLS</p>
      </div>
    </main>
    </FeaturePage>
  );
}
