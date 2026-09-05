'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// boxed: หน้าแรก r6 แสดงเป็นกล่องมุมมน ไม่ใช่แถบเต็มจอ (Pk 5 ก.ย. 69)
export default function AnniversaryBanner({ boxed = false } = {}) {
  const [events, setEvents] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const now = new Date();
    supabase.rpc('get_anniversaries', { m: now.getMonth() + 1, d: now.getDate() })
      .then(({ data }) => setEvents(data ?? []));
  }, []);

  useEffect(() => {
    if (events.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % events.length), 6000);
    return () => clearInterval(t);
  }, [events]);

  if (events.length === 0) return null;
  const ev = events[idx];
  const yearsAgo = ev.when_date ? new Date().getFullYear() - new Date(ev.when_date).getFullYear() : null;

  return (
    <Link href={`/archive/${ev.id}`}>
      <div style={{
        background: 'linear-gradient(90deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05), rgba(201,168,76,0.15))',
        border: boxed ? '1px solid rgba(201,168,76,0.3)' : 'none',
        borderBottom: '1px solid rgba(201,168,76,0.35)',
        borderRadius: boxed ? 10 : 0, marginBottom: boxed ? '1.2rem' : 0,
        padding: boxed ? '10px 1rem' : '10px 2rem',
        display: 'flex', alignItems: 'center', gap: '14px',
        cursor: 'pointer', overflow: 'hidden',
      }}>
        <div style={{
          fontFamily: "'Noto Serif Thai', serif", fontWeight: 700,
          color: 'var(--gold)', fontSize: '0.9rem', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{fontSize:'1.05rem'}}>🕰</span> ดุริยกาล
        </div>
        <div style={{width:'1px',height:'20px',background:'rgba(201,168,76,0.4)',flexShrink:0}} />
        <div style={{fontSize:'0.83rem', color:'var(--cream)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
          {yearsAgo > 0 && <span style={{color:'var(--gold2)',fontWeight:600}}>ครบรอบ {yearsAgo} ปี — </span>}
          {ev.what_text}
          <span style={{color:'var(--muted)'}}> · {ev.who_text} · {ev.when_text}</span>
        </div>
        {events.length > 1 && (
          <div style={{marginLeft:'auto',fontSize:'0.7rem',color:'var(--muted)',fontFamily:'monospace',flexShrink:0}}>
            {idx + 1}/{events.length}
          </div>
        )}
      </div>
    </Link>
  );
}
