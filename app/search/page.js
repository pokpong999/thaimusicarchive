'use client';
// app/search — ค้นทั้งเว็บ: เพลง · เหตุการณ์ · ครูดนตรี · สมาชิก  (Pk 28 ส.ค. 69)
//
//   "ช่องค้นหา หาเจอแต่เพลงครับตอนนี้ ค้นชื่อสมาชิก ค้นเหตุการณ์ ยังไม่มา"
//
//   หน้านี้ค้นครบอยู่แล้ว แต่ช่องค้นหาด้านบนชี้ไปที่ /songs (ฐานข้อมูลเพลง) อย่างเดียว
//   รอบนี้ให้ชี้มาที่นี่ และให้หน้านี้รับคำค้นจาก ?q= แล้วค้นเองทันที
import { FeaturePage } from '../../components/Gate';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../lib/i18n';
import { trText } from '../../lib/translate';

export const SEARCH_VERSION = '28 ส.ค. 69 · r2 (ค้นครบทุกอย่าง)';

// แยกชื่อคนออกจากช่อง "ใคร" — กติกาเดียวกับหน้าทำเนียบครูดนตรี
const splitNames = t => String(t ?? '').split(/[,\/]| และ | กับ /).map(x => x.trim()).filter(x => x.length > 1);

export default function SearchPage() {
  const { lang } = useLang();
  const [q, setQ] = useState('');
  const [songs, setSongs] = useState([]);
  const [records, setRecords] = useState([]);
  const [people, setPeople] = useState([]);
  const [masters, setMasters] = useState([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState('');
  // ★ กันคำตอบของคำค้นเก่ามาทับคำค้นใหม่ (บทเรียนจากช่องค้นหาหน้าฐานข้อมูลเพลง)
  const seq = useRef(0);

  const run = useCallback(async (term0) => {
    const term = String(term0 ?? '').trim();
    if (!term) return;
    const my = ++seq.current;
    setBusy(true); setWarn('');

    // ค้นคำแปลอังกฤษด้วย (sql/37) — ถ้าฐานยังไม่มีคอลัมน์ ค่อยถอยไปค้นเฉพาะไทย
    const esc = term.replace(/[%,()]/g, ' ');
    const trySearch = async (withEn) => {
      const songOr = withEn
        ? `name_th.ilike.%${esc}%,id.ilike.%${esc}%,name_en.ilike.%${esc}%`
        : `name_th.ilike.%${esc}%,id.ilike.%${esc}%`;
      const recOr = withEn
        ? `what_text.ilike.%${esc}%,who_text.ilike.%${esc}%,where_text.ilike.%${esc}%,when_text.ilike.%${esc}%,description.ilike.%${esc}%,what_text_en.ilike.%${esc}%,who_text_en.ilike.%${esc}%,description_en.ilike.%${esc}%`
        : `what_text.ilike.%${esc}%,who_text.ilike.%${esc}%,where_text.ilike.%${esc}%,when_text.ilike.%${esc}%,description.ilike.%${esc}%`;
      return Promise.all([
        supabase.from('songs').select('*').or(songOr).limit(30),
        supabase.from('archive_records').select('*').eq('approved', true).or(recOr).limit(30),
        supabase.from('profiles').select('id, display_name, points, avatar_url')
          .ilike('display_name', `%${esc}%`).limit(20),
      ]);
    };

    let [s, r, p] = await trySearch(true);
    if (s.error || r.error) {
      [s, r, p] = await trySearch(false);
      if (!s.error && !r.error) setWarn('ค้นเฉพาะภาษาไทย — ยังไม่ได้รัน sql/37 หรือยังไม่มีคำแปลในฐาน');
    }
    if (my !== seq.current) return;              // มีคำค้นใหม่กว่าแล้ว ทิ้งผลนี้

    const recs = r.data ?? [];
    setSongs(s.data ?? []);
    setRecords(recs);
    setPeople(p.data ?? []);

    // ครูดนตรี — ดึงจากช่อง "ใคร" ของเหตุการณ์ที่ค้นเจอ ไม่ต้องยิงคำสั่งเพิ่ม
    const hit = new Map();
    recs.forEach(x => splitNames(x.who_text).forEach(n => {
      if (n.toLowerCase().includes(term.toLowerCase())) hit.set(n, (hit.get(n) ?? 0) + 1);
    }));
    setMasters([...hit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12));

    setSearched(true); setBusy(false);
  }, []);

  // รับคำค้นจากช่องค้นหาด้านบน (/search?q=…) แล้วค้นให้เลย
  //   อ่านจาก URL ตรง ๆ ไม่ใช้ useSearchParams — Next 14 จะบังคับให้ห่อ Suspense ทั้งหน้า
  useEffect(() => {
    try {
      const s0 = new URLSearchParams(window.location.search).get('q');
      if (s0) { setQ(s0); run(s0); }
    } catch (e) {}
  }, [run]);

  const go = () => {
    run(q);
    try { window.history.replaceState(null, '', '/search?q=' + encodeURIComponent(q.trim())); } catch (e) {}
  };

  const total = songs.length + records.length + people.length;
  const card = { marginBottom: '1rem' };
  const row = { padding: '7px 0', borderBottom: '1px solid rgba(42,63,92,0.35)', cursor: 'pointer', fontSize: '0.88rem' };

  return (
    <FeaturePage feature="page_search">
    <main className="container" style={{maxWidth:'760px'}}>
      <div className="section-title" style={{fontSize:'1.2rem'}}>🔍 ค้นหาทั้งเว็บ</div>
      <div className="section-subtitle">เพลง · เหตุการณ์ในหอจดหมายเหตุ · ครูดนตรี · สมาชิก</div>

      <div style={{display:'flex',gap:'8px',margin:'1rem 0 1.2rem'}}>
        <input className="form-input" value={q} onChange={e => setQ(e.target.value)} autoFocus
          onKeyDown={e => e.key === 'Enter' && go()}
          placeholder="ชื่อเพลง · ชื่อครูดนตรี · เหตุการณ์ · สถานที่ · สมาชิก..." />
        <button className="btn btn-primary" onClick={go} disabled={busy}>{busy ? '⏳' : 'ค้นหา'}</button>
      </div>

      {warn && <div style={{fontSize:'0.76rem',color:'var(--gold2)',marginBottom:'0.8rem'}}>⚠ {warn}</div>}

      {searched && (
        <div data-searchsum style={{fontSize:'0.8rem',color:'var(--muted)',marginBottom:'0.9rem'}}>
          พบ {total} รายการ · เพลง {songs.length} · เหตุการณ์ {records.length} · สมาชิก {people.length}
          {masters.length > 0 && <> · ครูดนตรี {masters.length}</>}
        </div>
      )}

      {searched && total === 0 && (
        <div style={{color:'var(--muted)'}}>
          ไม่พบผลลัพธ์สำหรับ "{q}"
          <div style={{fontSize:'0.8rem',marginTop:'0.4rem'}}>
            ลองพิมพ์สั้นลง หรือค้นด้วยคำอื่น เช่น ชื่อครู ชื่อสถานที่ หรือ Song ID
          </div>
        </div>
      )}

      {songs.length > 0 && (
        <div className="card" style={card} data-res-songs>
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎼 เพลง ({songs.length})</div>
          {songs.map(s => (
            <Link key={s.id} href={`/songs/${s.id}`}>
              <div style={row}>
                <span className="song-id" style={{marginRight:'10px'}}>{s.id}</span>
                {trText(lang, s, 'name_th')}
                <span style={{color:'var(--muted)',fontSize:'0.75rem',marginLeft:'8px'}}>{s.type}</span>
                {s.parent_song_id && <span style={{color:'var(--muted)',fontSize:'0.7rem',marginLeft:'6px'}}
                  title={'เพลงย่อยใน ' + s.parent_song_id}>🧩</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {records.length > 0 && (
        <div className="card" style={card} data-res-archive>
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>📜 เหตุการณ์ในหอจดหมายเหตุ ({records.length})</div>
          {records.map(r => (
            <Link key={r.id} href={`/archive/${r.id}`}>
              <div style={row}>
                {trText(lang, r, 'what_text')}
                <div style={{color:'var(--muted)',fontSize:'0.74rem'}}>
                  {trText(lang, r, 'who_text')} · {trText(lang, r, 'when_text')} · {trText(lang, r, 'where_text')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {masters.length > 0 && (
        <div className="card" style={card} data-res-people>
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>👤 ครูดนตรี ({masters.length})</div>
          {masters.map(([name, n]) => (
            <Link key={name} href={`/people/${encodeURIComponent(name)}`}>
              <div style={row}>
                {name}
                <span style={{color:'var(--jade)',fontSize:'0.74rem',marginLeft:'8px'}}>{n} เหตุการณ์</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {people.length > 0 && (
        <div className="card" style={card} data-res-members>
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>👥 สมาชิก ({people.length})</div>
          {people.map(p => (
            <Link key={p.id} href={`/members/${p.id}`}>
              <div style={{...row, borderBottom:'none'}}>
                {p.display_name}
                <span style={{color:'var(--jade)',fontSize:'0.74rem',marginLeft:'8px',fontFamily:'monospace'}}>
                  {(p.points ?? 0).toLocaleString()} ศักดินา
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{fontSize:'0.66rem',color:'var(--muted)',marginTop:'0.6rem'}} data-searchver>
        หน้าค้นหารุ่น {SEARCH_VERSION}
      </div>
    </main>
    </FeaturePage>
  );
}
