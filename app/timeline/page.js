'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

function extractYear(r) {
  if (r.when_date) return new Date(r.when_date).getFullYear() + 543;
  const m = (r.when_text ?? '').match(/(\d{4})/);
  if (m) { const y = parseInt(m[1]); return y < 2300 ? y + 543 : y; }
  return null;
}

export default function TimelinePage() {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    supabase.from('archive_records').select('*').eq('approved', true).limit(1000)
      .then(({ data }) => {
        const byYear = {};
        (data ?? []).forEach(r => {
          const y = extractYear(r) ?? 'ไม่ระบุปี';
          (byYear[y] = byYear[y] ?? []).push(r);
        });
        const years = Object.keys(byYear).sort((a, b) => {
          if (a === 'ไม่ระบุปี') return 1; if (b === 'ไม่ระบุปี') return -1;
          return parseInt(a) - parseInt(b);
        });
        setGroups(years.map(y => [y, byYear[y]]));
      });
  }, []);

  return (
    <main className="container" style={{maxWidth:'720px'}}>
      <div className="section-title" style={{fontSize:'1.2rem'}}>🕰 เส้นเวลาดนตรีไทย</div>
      <div className="section-subtitle">เหตุการณ์ในจดหมายเหตุ เรียงตามปี พ.ศ.</div>
      <div style={{marginTop:'1.5rem'}}>
        {groups.map(([year, recs]) => (
          <div key={year} style={{display:'flex',gap:'1.2rem',marginBottom:'0.4rem'}}>
            <div style={{width:'90px',flexShrink:0,textAlign:'right'}}>
              <div style={{fontSize:'1.15rem',fontWeight:700,color:'var(--gold)',fontFamily:'var(--font-serif)'}}>
                {year === 'ไม่ระบุปี' ? '—' : `พ.ศ. ${year}`}
              </div>
            </div>
            <div style={{borderLeft:'2px solid var(--border)',paddingLeft:'1.2rem',paddingBottom:'1.2rem',flex:1}}>
              {recs.map(r => (
                <Link key={r.id} href={`/archive/${r.id}`}>
                  <div className="card" style={{cursor:'pointer',padding:'0.8rem 1rem',marginBottom:'0.5rem'}}>
                    <div style={{fontWeight:600,fontSize:'0.9rem'}}>{r.what_text}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:'3px'}}>
                      {r.who_text} · {r.when_text} · 📍 {r.where_text}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
