'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

function SongCol({ side, songs, sel, setSel }) {
  const [verses, setVerses] = useState([]);
  useEffect(() => {
    if (!sel) { setVerses([]); return; }
    supabase.from('song_melody').select('verse_no, combined').eq('song_id', sel)
      .eq('approved', true).or('instrument.eq.ทำนองหลัก,instrument.is.null')
      .order('verse_no').limit(400)
      .then(({ data }) => setVerses(data ?? []));
  }, [sel]);
  return (
    <div style={{flex:1,minWidth:0}}>
      <select className="form-input" value={sel} onChange={e => setSel(e.target.value)}>
        <option value="">— เลือกเพลง {side} —</option>
        {songs.map(s => <option key={s.id} value={s.id}>{s.name_th}</option>)}
      </select>
      <div style={{marginTop:'0.8rem',maxHeight:'70vh',overflowY:'auto'}}>
        {verses.map(v => (
          <div key={v.verse_no} style={{display:'flex',gap:'8px',padding:'5px 0',
            borderBottom:'1px solid rgba(42,63,92,0.3)'}}>
            <span style={{color:'var(--muted)',fontSize:'0.7rem',width:'28px',flexShrink:0,textAlign:'right'}}>{v.verse_no}</span>
            <span style={{fontFamily:'var(--font-notation, monospace)',fontSize:'0.85rem',whiteSpace:'nowrap',overflow:'auto'}}>{v.combined}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [songs, setSongs] = useState([]);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  useEffect(() => {
    supabase.from('songs').select('id, name_th').order('name_th').limit(500)
      .then(({ data }) => setSongs(data ?? []));
  }, []);
  return (
    <main className="container" style={{maxWidth:'1100px'}}>
      <div className="section-title" style={{fontSize:'1.2rem'}}>⚖️ เปรียบเทียบเพลง</div>
      <div className="section-subtitle">เปิดโน้ต 2 เพลงคู่กัน — เหมาะสำหรับเทียบอัตราจังหวะของเพลงเถา หรือทางต่างสำนัก</div>
      <div style={{display:'flex',gap:'1.5rem',marginTop:'1.2rem',flexWrap:'wrap'}}>
        <SongCol side="ก" songs={songs} sel={a} setSel={setA} />
        <div style={{width:'1px',background:'var(--border)'}} />
        <SongCol side="ข" songs={songs} sel={b} setSel={setB} />
      </div>
    </main>
  );
}
