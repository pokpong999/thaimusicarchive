'use client';
import { EText, EImage } from '../../components/Editable';
import { FeaturePage } from '../../components/Gate';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

const LETTERS = 'OABCDEFGHIJKLMNP'.split('');
const CODE_MAP = {
  O:'----',A:'X---',B:'-X--',C:'--X-',D:'---X',E:'XX--',F:'X-X-',G:'X--X',
  H:'-XX-',I:'-X-X',J:'--XX',K:'XXX-',L:'XX-X',M:'X-XX',N:'-XXX',P:'XXXX',
};

export default function KrasuanPage() {
  const [code, setCode] = useState('');
  const [pattern, setPattern] = useState(null);
  const [songs, setSongs] = useState([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  function addLetter(l) { if (code.length < 4) setCode(code + l); }

  async function run() {
    const c = code.trim().toUpperCase();
    if (c.length !== 4) return;
    setBusy(true);
    const [{ data: pl }, { data: kc }] = await Promise.all([
      supabase.from('pattern_library').select('*').eq('code', c).limit(1),
      supabase.from('krasuan_catalog').select('song_id, section, verse_no').eq('code', c).limit(3000),
    ]);
    setPattern(pl?.[0] ?? null);
    // group by song
    const bySong = {};
    (kc ?? []).forEach(r => { (bySong[r.song_id] = bySong[r.song_id] ?? []).push(r); });
    const ids = Object.keys(bySong);
    let names = {};
    if (ids.length) {
      const { data: sn } = await supabase.from('songs').select('id, name_th').in('id', ids.slice(0, 200));
      (sn ?? []).forEach(s => names[s.id] = s.name_th);
    }
    setSongs(ids.map(id => ({ id, name: names[id] ?? id, verses: bySong[id] }))
      .sort((a, b) => b.verses.length - a.verses.length));
    setSearched(true); setBusy(false);
  }

  const visual = code.split('').map(l => CODE_MAP[l] ?? '????').join(' | ');

  return (
    <FeaturePage feature="page_krasuan">
    <main className="container" style={{maxWidth:'760px'}}>
      <EText k="krasuan.title" className="section-title" style={{fontSize:'1.2rem'}}>🥁 ค้นหากระสวน (Krasuan Code)</EText>
      <EText k="krasuan.sub" className="section-subtitle">เลือกรหัส 4 ตัว (1 ตัว = 1 ห้อง) แล้วดูว่ากระสวนนี้ปรากฏในเพลงใดบ้าง · ฐานข้อมูล 19,963 วรรค</EText>

      <div className="card" style={{marginTop:'1.2rem'}}>
        <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',marginBottom:'0.8rem'}}>
          <input className="form-input" style={{width:'140px',fontFamily:'monospace',fontSize:'1.2rem',
            textTransform:'uppercase',letterSpacing:'4px'}} maxLength={4} value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^OABCDEFGHIJKLMNP]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && run()} placeholder="NIII" />
          <button className="btn btn-outline btn-sm" onClick={() => setCode('')}>ล้าง</button>
          <button className="btn btn-primary" onClick={run} disabled={busy || code.length !== 4}>
            {busy ? '⏳' : 'ค้นหา'}</button>
        </div>
        {code.length > 0 && (
          <div style={{fontFamily:'monospace',fontSize:'1rem',color:'var(--gold)',marginBottom:'0.8rem'}}>
            {visual}
          </div>
        )}
        <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
          {LETTERS.map(l => (
            <button key={l} onClick={() => addLetter(l)} className="btn btn-sm"
              style={{background:'var(--navy3)',color:'var(--cream)',border:'1px solid var(--border)',
                flexDirection:'column',minWidth:'52px',padding:'6px 4px'}}>
              <span style={{fontWeight:700}}>{l}</span>
              <span style={{fontSize:'0.6rem',color:'var(--muted)',fontFamily:'monospace'}}>{CODE_MAP[l]}</span>
            </button>
          ))}
        </div>
      </div>

      {searched && (
        <>
          {pattern && (
            <div className="card" style={{borderColor:'rgba(201,168,76,0.4)'}}>
              <div style={{fontSize:'1.3rem',fontWeight:700,fontFamily:'monospace',color:'var(--gold)'}}>
                {pattern.code} <span style={{fontSize:'0.8rem',color:'var(--muted)'}}>({pattern.pattern_id})</span>
              </div>
              <div style={{fontFamily:'monospace',margin:'6px 0'}}>{pattern.pattern}</div>
              <div style={{fontSize:'0.8rem',color:'var(--jade)'}}>
                พบ {Number(pattern.frequency).toLocaleString()} ครั้ง · ความหนาแน่น {pattern.density}/16
              </div>
            </div>
          )}
          {!pattern && songs.length === 0 && (
            <div className="card" style={{textAlign:'center',color:'var(--muted)'}}>
              กระสวน {code} ยังไม่เคยพบในเพลงใด — นี่คือ "กระสวนว่าง" ที่รอนักประพันธ์นำไปใช้! ✨
            </div>
          )}
          {songs.length > 0 && (
            <div className="card">
              <div style={{fontWeight:600,marginBottom:'0.7rem'}}>พบใน {songs.length} เพลง</div>
              {songs.map(s => (
                <Link key={s.id} href={`/songs/${s.id}`}>
                  <div style={{padding:'7px 0',borderBottom:'1px solid rgba(42,63,92,0.35)',cursor:'pointer',
                    display:'flex',justifyContent:'space-between',fontSize:'0.88rem'}}>
                    <span><span className="song-id" style={{marginRight:'10px'}}>{s.id}</span>{s.name}</span>
                    <span style={{color:'var(--jade)',fontSize:'0.78rem'}}>{s.verses.length} วรรค</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
    </FeaturePage>
  );
}
