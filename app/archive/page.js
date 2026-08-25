'use client';
import { EText, EImage } from '../../components/Editable';
import { usePermissions } from '../../components/Gate';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fmtDT } from '../../lib/fmtdate';
import { supabase } from '../../lib/supabase';
import LeafletMap from '../../components/LeafletMap';
import { esc } from '../../lib/htmlesc';

const ERAS = { past: 'อดีต', present: 'ปัจจุบัน', future: 'อนาคต' };

export default function ArchivePage() {
  const { can } = usePermissions();
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


// ── สีหมุดตามยุค: แดงเข้ม (โบราณ) → เขียวอ่อน (ปัจจุบัน) ──
function markerYear(r) {
  if (r.when_date) return new Date(r.when_date).getFullYear() + 543;
  const m = (r.when_text ?? '').match(/(\d{4})/);
  if (m) { const y = parseInt(m[1]); return y < 2300 ? y + 543 : y; }
  return null;
}
function eraColor(year, minY, maxY) {
  if (year == null) return '#C9A84C'; // ไม่ระบุปี = ทอง
  const t = Math.max(0, Math.min(1, (year - minY) / Math.max(1, maxY - minY)));
  const hue = t * 120;                    // 0 แดง → 120 เขียว
  const light = 32 + t * 26;              // เข้ม → อ่อน
  return `hsl(${Math.round(hue)}, 72%, ${Math.round(light)}%)`;
}

  const yrs = records.map(markerYear).filter(y => y != null);
  const minY = yrs.length ? Math.min(...yrs) : 2300;
  const maxY = yrs.length ? Math.max(...yrs) : 2569;

  const markers = records.filter(r => r.lat != null && r.lng != null).map(r => {
    const thumb = thumbUrl(r);
    return ({
    lat: r.lat, lng: r.lng,
    color: eraColor(markerYear(r), minY, maxY),
    tooltipHtml: `
      <div style="font-family:'Noto Sans Thai',sans-serif;max-width:200px;text-align:center">
        ${thumb ? `<img src="${esc(thumb)}" style="width:180px;height:110px;object-fit:cover;border-radius:6px;display:block;margin-bottom:5px"/>` : ''}
        <div style="font-size:0.75rem;font-weight:600">${esc(r.what_text)}</div>
        <div style="font-size:0.65rem;color:#666">${esc(r.when_text)}</div>
      </div>`,
    popupHtml: `
      <div style="font-family:'Noto Sans Thai',sans-serif;min-width:200px">
        <div style="font-size:0.7rem;color:#8A6D1F">${ERAS[r.era] ?? r.era} · ${esc(r.when_text)}</div>
        <div style="font-weight:600;margin:4px 0 2px">${esc(r.what_text)}</div>
        <div style="font-size:0.78rem;color:#555">${esc(r.who_text)}<br/>${esc(r.where_text)}</div>
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
          <EText k="archive.title" className="section-title">หอจดหมายเหตุดนตรีไทย</EText>
      <EImage k="archive.cover" height={200} style={{margin:'0.6rem 0'}} />
          <div className="section-subtitle">บันทึกเหตุการณ์ อดีต ปัจจุบัน อนาคต · {records.length} รายการ</div>
        </div>
        {user
          ? (can('archive_submit') ? <Link href="/archive/new"><button className="btn btn-primary">✚ บันทึกเหตุการณ์</button></Link> : null)
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
          <LeafletMap markers={markers} height="520px" legend={`
            <div style="background:rgba(15,27,45,0.92);border:1px solid #C9A84C;border-radius:8px;padding:7px 11px;font-family:'Noto Sans Thai',sans-serif;color:#F5F0E8;font-size:0.68rem;line-height:1.5">
              <div style="margin-bottom:3px">ยุคของเหตุการณ์</div>
              <div style="display:flex;align-items:center;gap:6px">
                <span>โบราณ</span>
                <span style="width:90px;height:9px;border-radius:5px;background:linear-gradient(to right, hsl(0,72%,32%), hsl(40,72%,41%), hsl(80,72%,49%), hsl(120,72%,58%))"></span>
                <span>ปัจจุบัน</span>
              </div>
              <div style="color:#8A9BB5;margin-top:3px">● ทอง = ไม่ระบุปี · ตัวเลข = กดเพื่อกางกลุ่มหมุด</div>
            </div>`} />
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
                    {r.created_at && <div style={{fontSize:'0.66rem',color:'var(--muted)',opacity:.8,marginTop:'3px'}}>🕒 บันทึกเมื่อ {fmtDT(r.created_at)}</div>}
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
