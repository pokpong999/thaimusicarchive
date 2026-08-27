'use client';
// components/SongPartsBar.js — ป้ายบอกความสัมพันธ์ เพลงเรื่อง ⇄ เพลงย่อย  (Pk 27 ส.ค. 69)
//
//   เปิดหน้าเพลงย่อย  → บอกว่ามาจากเรื่องไหน กดกลับไปดูทั้งเรื่องได้
//   เปิดหน้าเพลงเรื่อง → ลิสต์เพลงย่อยให้กดข้ามไปได้เลย
//   และบอกตรง ๆ ว่าโน้ตเป็นชุดเดียวกัน แก้ที่ไหนก็เปลี่ยนทั้งสองที่
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function SongPartsBar({ song, parts = [] }) {
  const [parent, setParent] = useState(null);
  const pid = song?.parent_song_id ?? null;

  useEffect(() => {
    if (!pid) { setParent(null); return; }
    supabase.from('songs').select('id, name_th, total_verses').eq('id', pid).maybeSingle()
      .then(({ data }) => setParent(data ?? null));
  }, [pid]);

  if (!pid && !parts.length) return null;

  const box = {
    marginTop:'0.7rem', padding:'0.6rem 0.8rem', borderRadius:'8px',
    background:'rgba(201,168,76,0.08)', border:'1px solid rgba(201,168,76,0.28)',
    fontSize:'0.8rem', lineHeight:1.8,
  };

  if (pid) {
    return (
      <div style={box} data-partsbar="child">
        🧩 เพลงย่อยใน{' '}
        <Link href={`/songs/${pid}`}><b style={{color:'var(--gold2)'}}>{parent?.name_th ?? pid}</b></Link>
        {song.part_no != null && <span style={{color:'var(--muted)'}}> · ลำดับที่ {song.part_no}</span>}
        <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>
          โน้ตชุดเดียวกันกับในเรื่อง — แก้ที่นี่หรือที่หน้าเรื่องก็เปลี่ยนทั้งสองที่
        </div>
      </div>
    );
  }

  return (
    <div style={box} data-partsbar="suite">
      🧩 เรื่องนี้แยกเป็น {parts.length} เพลงย่อย
      <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'6px'}}>
        {parts.map(p => (
          <Link key={p.id} href={`/songs/${p.id}`}>
            <span className="btn btn-outline btn-sm" style={{fontSize:'0.76rem'}}>
              {p.name_th}<span style={{color:'var(--muted)'}}> · {p.total_verses}</span>
            </span>
          </Link>
        ))}
      </div>
      <div style={{fontSize:'0.72rem',color:'var(--muted)',marginTop:'4px'}}>
        โน้ตชุดเดียวกัน — แก้ที่เพลงย่อยหรือที่นี่ก็เปลี่ยนทั้งสองที่
      </div>
    </div>
  );
}
