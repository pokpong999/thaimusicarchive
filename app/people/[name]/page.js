'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

export default function PersonPage() {
  const { name } = useParams();
  const person = decodeURIComponent(name);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    supabase.from('archive_records').select('*').eq('approved', true)
      .ilike('who_text', `%${person}%`).order('when_date', { ascending: true, nullsFirst: false })
      .then(({ data }) => setRecords(data ?? []));
  }, [person]);

  return (
    <main className="container" style={{maxWidth:'720px'}}>
      <Link href="/people"><span style={{color:'var(--muted)',fontSize:'0.8rem'}}>← ทำเนียบบุคคล</span></Link>
      <div className="section-title" style={{fontSize:'1.35rem',marginTop:'0.8rem'}}>{person}</div>
      <div className="section-subtitle">{records.length} เหตุการณ์ในจดหมายเหตุ</div>
      <div style={{marginTop:'1.2rem',borderLeft:'2px solid var(--gold)',paddingLeft:'1.2rem'}}>
        {records.map(r => (
          <Link key={r.id} href={`/archive/${r.id}`}>
            <div className="card" style={{cursor:'pointer',position:'relative'}}>
              <div style={{position:'absolute',left:'-1.65rem',top:'1.3rem',width:'12px',height:'12px',
                borderRadius:'50%',background:'var(--gold)',border:'2px solid var(--navy)'}} />
              <div style={{color:'var(--gold)',fontSize:'0.78rem'}}>{r.when_text}</div>
              <div style={{fontWeight:600,margin:'4px 0'}}>{r.what_text}</div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>📍 {r.where_text}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
