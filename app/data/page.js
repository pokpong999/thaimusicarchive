'use client';
import { FeaturePage, useMe } from '../../components/Gate';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

// ชุดข้อมูลเปิด — ใครก็ดาวน์โหลดได้ (หอจดหมายเหตุ ควรเปิด)
const OPEN_SETS = [
  ['songs', 'รายการเพลง · Song list (300 เพลง)'],
  ['song_melody', 'โน้ตรายวรรค สองมือ · Melody per verse (20,924 rows)'],
];
// ★ ชุดข้อมูลวิเคราะห์ — เฉพาะสมาชิกที่ล็อกอิน (Pk ตัดสิน 1 ก.ย. 69)
//   เป็นงานวิเคราะห์ของหอจดหมายเหตุ ไม่ใช่ข้อมูลดิบ จึงไม่เปิดให้ดูดอัตโนมัติ
const MEMBER_SETS = [
  ['krasuan_catalog', 'กระสวนรายวรรค · Krasuan per verse (20,920 rows)'],
  ['luktok_catalog', 'คู่ลูกตกรายประโยค · Cadence pairs (10,373 rows)'],
  ['pattern_library', 'คลังกระสวน · Pattern library (1,494 rows)'],
];

export default function DataPage() {
  const [msg, setMsg] = useState('');
  const me = useMe();
  const signedIn = !!me.user;

  async function download(table, fmt) {
    setMsg(`⏳ กำลังดึง ${table}...`);
    let all = [], from = 0;
    while (true) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
      if (error) {
        // ฐานปฏิเสธ = ชุดนี้เปิดเฉพาะสมาชิก บอกให้รู้ ไม่ใช่เงียบแล้วได้ไฟล์เปล่า
        setMsg(`✗ ${/permission|denied|JWT|401/i.test(error.message ?? '')
          ? 'ชุดข้อมูลนี้เปิดเฉพาะสมาชิกที่เข้าสู่ระบบแล้ว' : error.message}`);
        return;
      }
      if (!data?.length) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
      setMsg(`⏳ ${table}: ${all.length} แถว...`);
    }
    if (!all.length) { setMsg('✗ ไม่มีข้อมูลให้ดาวน์โหลด'); return; }
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
        <div style={{fontWeight:600,marginBottom:'0.8rem'}}>ชุดข้อมูลเปิด · Open datasets</div>
        {OPEN_SETS.map(([t, label]) => (
          <div key={t} style={{display:'flex',gap:'8px',alignItems:'center',padding:'8px 0',
            borderBottom:'1px solid rgba(42,63,92,0.35)',flexWrap:'wrap'}}>
            <span style={{flex:1,fontSize:'0.85rem',minWidth:'220px'}}>{label}</span>
            <button className="btn btn-outline btn-sm" onClick={() => download(t, 'csv')}>CSV</button>
            <button className="btn btn-outline btn-sm" onClick={() => download(t, 'json')}>JSON</button>
          </div>
        ))}
        {msg && <div style={{marginTop:'0.7rem',fontSize:'0.8rem',
          color: msg.startsWith('✗') ? 'var(--rose,#E58B8B)' : 'var(--jade)'}}>{msg}</div>}
      </div>

      {/* ★ ชุดวิเคราะห์ — เฉพาะสมาชิก */}
      <div className="card">
        <div style={{fontWeight:600,marginBottom:'0.4rem'}}>
          🔒 ชุดข้อมูลวิเคราะห์ · Analysis datasets</div>
        <div style={{fontSize:'0.8rem',color:'var(--muted)',lineHeight:1.8,marginBottom:'0.8rem'}}>
          ส่วนนี้เป็น<b style={{color:'var(--cream)'}}>งานวิเคราะห์ของหอจดหมายเหตุ</b> ไม่ใช่ข้อมูลดิบ
          เปิดให้เฉพาะสมาชิกที่เข้าสู่ระบบแล้ว · ใช้เพื่อการศึกษาและวิจัยได้ โดยอ้างอิงที่มา
          หากต้องการนำไปใช้ในงานเผยแพร่ กรุณาติดต่อหอจดหมายเหตุก่อน
          <br/><span style={{fontSize:'0.75rem'}}>Analysis datasets — for signed-in members.
          Please contact the archive before redistributing.</span>
        </div>
        {MEMBER_SETS.map(([t, label]) => (
          <div key={t} style={{display:'flex',gap:'8px',alignItems:'center',padding:'8px 0',
            borderBottom:'1px solid rgba(42,63,92,0.35)',flexWrap:'wrap'}}>
            <span style={{flex:1,fontSize:'0.85rem',minWidth:'220px'}}>{label}</span>
            {signedIn ? (<>
              <button className="btn btn-outline btn-sm" onClick={() => download(t, 'csv')}>CSV</button>
              <button className="btn btn-outline btn-sm" onClick={() => download(t, 'json')}>JSON</button>
            </>) : (
              <a href="/login"><button className="btn btn-outline btn-sm">เข้าสู่ระบบเพื่อดาวน์โหลด</button></a>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{fontSize:'0.85rem',lineHeight:1.9}}>
        <div style={{fontWeight:600}}>สัญญาอนุญาต · License</div>
        <p><b>ชุดข้อมูลเปิด</b> (รายการเพลง · โน้ตรายวรรค) เผยแพร่ภายใต้ <b>CC BY 4.0</b>
        — ใช้ ดัดแปลง เผยแพร่ต่อได้เสรี โดยต้องอ้างอิง
        <br/><b>Open datasets</b> (song list, melody) are released under <b>CC BY 4.0</b>.</p>
        <p style={{color:'var(--gold2)'}}>★ <b>ชุดข้อมูลวิเคราะห์</b> (กระสวน · ลูกตก · คลังกระสวน)
        <b> ไม่ได้เผยแพร่ภายใต้ CC BY 4.0</b> — สงวนสิทธิ์ไว้กับหอจดหมายเหตุ
        เปิดให้สมาชิกใช้เพื่อการศึกษาและวิจัย โดยอ้างอิงที่มา
        การนำไปใช้ในงานเผยแพร่หรือทำซ้ำเป็นชุด กรุณาติดต่อขออนุญาตก่อน
        <br/><span style={{fontSize:'0.78rem'}}>Analysis datasets are <b>not</b> under CC BY 4.0.
        All rights reserved by the archive; available to members for study and research with
        attribution. Contact us before redistributing.</span></p>
        <p style={{fontSize:'0.78rem',color:'var(--muted)'}}>อ้างอิง · Cite as:</p>
        <div style={{fontFamily:'monospace',fontSize:'0.75rem',background:'var(--navy3)',padding:'0.7rem',borderRadius:'6px'}}>
          Khamprasert, P. (2026). Thai Music Archive Dataset. https://thaimusicarchive.com/data (CC BY 4.0)
        </div>
      </div>

      <div className="card" style={{fontSize:'0.82rem',lineHeight:1.9}}>
        <div style={{fontWeight:600}}>REST API (read-only)</div>
        <p><b>ชุดข้อมูลเปิด</b>เข้าถึงได้ผ่าน REST API · Open datasets via REST:</p>
        <pre style={{background:'var(--navy3)',padding:'0.8rem',borderRadius:'6px',fontSize:'0.68rem',overflowX:'auto'}}>{`GET https://zblllvxuqvggnffpgcpg.supabase.co/rest/v1/songs?select=id,name_th
Header: apikey: sb_publishable_9vCU3UdNKhuWwueo_tfKgg_Rd4qYzgE

# ตัวอย่าง · Examples
/rest/v1/songs?select=id,name_th,name_en
/rest/v1/song_melody?song_id=eq.KSY001&order=verse_no

# ชุดวิเคราะห์ (กระสวน · ลูกตก · คลังกระสวน) ต้องแนบโทเคนของสมาชิก
# Analysis datasets require a signed-in member token:
#   Authorization: Bearer <access_token>`}</pre>
        <p style={{fontSize:'0.72rem',color:'var(--muted)'}}>อ่านได้อย่างเดียว · ชุดวิเคราะห์เปิดเฉพาะสมาชิก · Read-only; analysis datasets require sign-in</p>
      </div>
    </main>
    </FeaturePage>
  );
}
