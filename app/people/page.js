'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function PeoplePage() {
  const [people, setPeople] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    supabase.from('archive_records').select('who_text').eq('approved', true).limit(2000)
      .then(({ data }) => {
        const count = {};
        (data ?? []).forEach(r => {
          (r.who_text ?? '').split(/[,\/]| และ | กับ /).map(x => x.trim()).filter(x => x.length > 1)
            .forEach(name => { count[name] = (count[name] ?? 0) + 1; });
        });
        setPeople(Object.entries(count).sort((a, b) => b[1] - a[1]));
      });
  }, []);

  const shown = q ? people.filter(([n]) => n.includes(q)) : people;

  return (
    <main className="container" style={{maxWidth:'760px'}}>
      <div className="section-title" style={{fontSize:'1.2rem'}}>👥 ทำเนียบบุคคลในจดหมายเหตุ</div>
      <div className="section-subtitle">ครูดนตรี ศิลปิน และบุคคลในประวัติศาสตร์ดนตรีไทย · รวบรวมอัตโนมัติจากบันทึกจดหมายเหตุ</div>
      <input className="form-input" style={{margin:'1rem 0'}} value={q} onChange={e => setQ(e.target.value)}
        placeholder="ค้นหาชื่อ..." />
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'0.7rem'}}>
        {shown.map(([name, n]) => (
          <Link key={name} href={`/people/${encodeURIComponent(name)}`}>
            <div className="card" style={{padding:'0.9rem',cursor:'pointer',marginBottom:0}}>
              <div style={{fontWeight:600,fontSize:'0.9rem'}}>{name}</div>
              <div style={{fontSize:'0.72rem',color:'var(--jade)',marginTop:'3px'}}>{n} เหตุการณ์</div>
            </div>
          </Link>
        ))}
      </div>
      {people.length === 0 && <div style={{color:'var(--muted)',marginTop:'1rem'}}>ยังไม่มีข้อมูล</div>}
    </main>
  );
}
