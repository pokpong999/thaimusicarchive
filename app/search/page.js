'use client';
import { FeaturePage } from '../../components/Gate';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [songs, setSongs] = useState([]);
  const [records, setRecords] = useState([]);
  const [people, setPeople] = useState([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    const [s, r, p] = await Promise.all([
      supabase.from('songs').select('id, name_th, type').or(`name_th.ilike.%${term}%,id.ilike.%${term}%`).limit(30),
      supabase.from('archive_records').select('id, what_text, who_text, when_text, where_text')
        .eq('approved', true)
        .or(`what_text.ilike.%${term}%,who_text.ilike.%${term}%,where_text.ilike.%${term}%,when_text.ilike.%${term}%`).limit(30),
      supabase.from('profiles').select('id, display_name, points').ilike('display_name', `%${term}%`).limit(15),
    ]);
    setSongs(s.data ?? []); setRecords(r.data ?? []); setPeople(p.data ?? []);
    setSearched(true); setBusy(false);
  }

  const total = songs.length + records.length + people.length;

  return (
    <FeaturePage feature="page_search">
    <main className="container" style={{maxWidth:'760px'}}>
      <div className="section-title" style={{fontSize:'1.2rem'}}>🔍 ค้นหาทั้งเว็บ</div>
      <div style={{display:'flex',gap:'8px',margin:'1rem 0 1.5rem'}}>
        <input className="form-input" value={q} onChange={e => setQ(e.target.value)} autoFocus
          onKeyDown={e => e.key === 'Enter' && run()}
          placeholder="ชื่อเพลง · ชื่อครูดนตรี · เหตุการณ์ · สถานที่ · สมาชิก..." />
        <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? '⏳' : 'ค้นหา'}</button>
      </div>
      {searched && total === 0 && <div style={{color:'var(--muted)'}}>ไม่พบผลลัพธ์สำหรับ "{q}"</div>}
      {songs.length > 0 && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎼 เพลง ({songs.length})</div>
          {songs.map(s => (
            <Link key={s.id} href={`/songs/${s.id}`}>
              <div style={{padding:'7px 0',borderBottom:'1px solid rgba(42,63,92,0.35)',cursor:'pointer',fontSize:'0.88rem'}}>
                <span className="song-id" style={{marginRight:'10px'}}>{s.id}</span>{s.name_th}
                <span style={{color:'var(--muted)',fontSize:'0.75rem',marginLeft:'8px'}}>{s.type}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {records.length > 0 && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>📜 จดหมายเหตุ ({records.length})</div>
          {records.map(r => (
            <Link key={r.id} href={`/archive/${r.id}`}>
              <div style={{padding:'7px 0',borderBottom:'1px solid rgba(42,63,92,0.35)',cursor:'pointer',fontSize:'0.88rem'}}>
                {r.what_text}
                <div style={{color:'var(--muted)',fontSize:'0.74rem'}}>{r.who_text} · {r.when_text} · {r.where_text}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {people.length > 0 && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>👥 สมาชิก ({people.length})</div>
          {people.map(p => (
            <Link key={p.id} href={`/members/${p.id}`}>
              <div style={{padding:'7px 0',cursor:'pointer',fontSize:'0.88rem'}}>{p.display_name}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
    </FeaturePage>
  );
}
