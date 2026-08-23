'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LeafletMap from '../../components/LeafletMap';

const ERAS = { past: 'อดีต', present: 'ปัจจุบัน', future: 'อนาคต' };

export default function ArchivePage() {
  const [records, setRecords] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myId, setMyId] = useState(null);
  const [era, setEra] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState('map');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  useEffect(() => { load(); }, [era, q]);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setMyId(data.user.id);
      const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      setIsAdmin(p?.role === 'admin');
    });
  }, []);

  async function adminDeleteRecord(e, r) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`ลบบันทึก "${r.what_text}" ถาวร?`)) return;
    const { error } = await supabase.from('archive_records').delete().eq('id', r.id);
    if (error) { alert('ลบไม่สำเร็จ: ' + error.message); return; }
    load();
  }


  async function load() {
    setLoading(true);
    let query = supabase.from('archive_records').select('*, archive_media(id, media_type, storage_path)')
      .eq('approved', true).order('when_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (era) query = query.eq('era', era);
    if (q) query = query.or(`who_text.ilike.%${q}%,what_text.ilike.%${q}%,where_text.ilike.%${q}%`);
    const { data } = await query;
    setRecords(data ?? []);
    setLoading(false);
  }

  function thumbUrl(rec) {
    const img = (rec.archive_media ?? []).find(m => m.media_type === 'image');
    if (!img) return null;
    return supabase.storage.from('archive-images').getPublicUrl(img.storage_path).data.publicUrl;
  }

  const markers = records.filter(r => r.lat != null && r.lng != null).map(r => {
    const thumb = thumbUrl(r);
    return ({
    lat: r.lat, lng: r.lng,
    tooltipHtml: `
      <div style="font-family:'Noto Sans Thai',sans-serif;max-width:200px;text-align:center">
        ${thumb ? `<img src="${thumb}" style="width:180px;height:110px;object-fit:cover;border-radius:6px;display:block;margin-bottom:5px"/>` : ''}
        <div style="font-size:0.75rem;font-weight:600">${r.what_text}</div>
        <div style="font-size:0.65rem;color:#666">${r.when_text}</div>
      </div>`,
    popupHtml: `
      <div style="font-family:'Noto Sans Thai',sans-serif;min-width:200px">
        <div style="font-size:0.7rem;color:#8A6D1F">${ERAS[r.era] ?? r.era} · ${r.when_text}</div>
        <div style="font-weight:600;margin:4px 0 2px">${r.what_text}</div>
        <div style="font-size:0.78rem;color:#555">${r.who_text}<br/>${r.where_text}</div>
        <div style="margin-top:8px;display:flex;gap:10px">
          <a href="/archive/${r.id}" style="font-size:0.78rem;color:#3A7A67;font-weight:600">ดูรายละเอียด →</a>
          <a href="https://www.google.com/maps?q=${r.lat},${r.lng}" target="_blank" style="font-size:0.78rem;color:#4285F4">Google Maps ↗</a>
        </div>
      </div>`,
  });});

  return (
    <main className="container">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:'1rem'}}>
        <div>
          <div className="section-title">หอจดหมายเหตุดนตรีไทย</div>
          <div className="section-subtitle">บันทึกเหตุการณ์ อดีต ปัจจุบัน อนาคต · {records.length} รายการ</div>
        </div>
        {user
          ? <Link href="/archive/new"><button className="btn btn-primary">✚ บันทึกเหตุการณ์</button></Link>
          : <Link href="/login"><button className="btn btn-outline btn-sm">เข้าสู่ระบบเพื่อบันทึก</button></Link>}
      </div>

      <div className="search-bar" style={{marginTop:'1rem'}}>
        <input className="search-input" placeholder="ค้นหา ใคร / ทำอะไร / ที่ไหน..."
          value={q} onChange={e => setQ(e.target.value)} />
        <select className="filter-select" value={era} onChange={e => setEra(e.target.value)}>
          <option value="">ทุกยุค</option>
          <option value="past">อดีต</option>
          <option value="present">ปัจจุบัน</option>
          <option value="future">อนาคต</option>
        </select>
        <div style={{display:'flex',border:'1px solid var(--border)',borderRadius:'5px',overflow:'hidden'}}>
          <button onClick={() => setView('map')} className="btn btn-sm"
            style={{borderRadius:0,background:view==='map'?'var(--gold)':'transparent',color:view==='map'?'var(--navy)':'var(--muted)'}}>🗺 แผนที่</button>
          <button onClick={() => setView('list')} className="btn btn-sm"
            style={{borderRadius:0,background:view==='list'?'var(--gold)':'transparent',color:view==='list'?'var(--navy)':'var(--muted)'}}>☰ รายการ</button>
        </div>
      </div>

      {loading ? <div style={{color:'var(--muted)'}}>กำลังโหลด...</div>
      : view === 'map' ? (
        <>
          <LeafletMap markers={markers} height="520px" />
          {markers.length < records.length && (
            <div style={{fontSize:'0.72rem',color:'var(--muted)',marginTop:'6px'}}>
              * {records.length - markers.length} รายการไม่มีพิกัด — ดูได้ในมุมมองรายการ
            </div>
          )}
        </>
      ) : records.length === 0 ? (
        <div className="lock-box"><div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ยังไม่มีบันทึก — เป็นคนแรกที่บันทึกเลย!</div></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          {records.map(r => {
            const thumb = thumbUrl(r);
            return (
              <Link href={`/archive/${r.id}`} key={r.id}>
                <div className="card" style={{display:'flex',gap:'1.2rem',cursor:'pointer',marginBottom:0}}>
                  {thumb && <img src={thumb} alt="" style={{width:'110px',height:'110px',objectFit:'cover',borderRadius:'6px',flexShrink:0}} />}
                  <div style={{minWidth:0}}>
                    <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                      <span className="badge badge-fixed">{ERAS[r.era] ?? r.era}</span>
                      <span style={{fontSize:'0.75rem',color:'var(--muted)'}}>{r.when_text}</span>
                    </div>
                    <div style={{fontWeight:600,fontSize:'1rem',margin:'6px 0 2px'}}>{r.what_text}</div>
                    <div style={{fontSize:'0.82rem',color:'var(--muted)'}}>{r.who_text} · {r.where_text}</div>
                  </div>
                  {(isAdmin || r.submitted_by === myId) && <button className="btn btn-danger btn-sm"
                    style={{marginLeft:'auto',alignSelf:'flex-start',flexShrink:0}}
                    onClick={(e) => adminDeleteRecord(e, r)} title="ลบบันทึก">🗑</button>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
