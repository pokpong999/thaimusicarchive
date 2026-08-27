'use client';
// สุ่มเหตุการณ์จากหอจดหมายเหตุมาโชว์หน้าแรก  (Pk 27 ส.ค. 69)
//   สุ่มจริงทุกครั้งที่เข้าหน้า และกด "สุ่มใหม่" ได้ — ให้คนได้เจอของเก่าที่ไม่เคยเห็น
//   ทำ 2 คำสั่ง: ดึงรายการ id ที่อนุมัติแล้ว → สุ่มเลือก → ค่อยดึงรายละเอียดเฉพาะที่เลือก
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const SHOW = 3;
const POOL = 2000;

export default function RandomEvents() {
  const [ids, setIds] = useState(null);      // null = ยังไม่รู้ว่ามีอะไรบ้าง
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);

  const pick = useCallback(async (pool) => {
    if (!pool || pool.length === 0) { setRecs([]); setLoading(false); return; }
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const chosen = shuffled.slice(0, SHOW);
    setLoading(true);
    const { data } = await supabase.from('archive_records')
      .select('id, what_text, who_text, when_text, where_text, description, archive_media(media_type, storage_path)')
      .in('id', chosen);
    // เรียงตามลำดับที่สุ่มได้ ไม่ใช่ตาม id — จะได้ไม่ซ้ำหน้าตาเดิมทุกครั้ง
    const byId = new Map((data ?? []).map(r => [String(r.id), r]));
    setRecs(chosen.map(id => byId.get(String(id))).filter(Boolean));
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.from('archive_records').select('id').eq('approved', true).limit(POOL)
      .then(({ data }) => {
        const pool = (data ?? []).map(r => r.id);
        setIds(pool);
        pick(pool);
      });
  }, [pick]);

  if (ids !== null && ids.length === 0) return null;

  const thumb = (r) => {
    const img = (r.archive_media ?? []).find(m => m.media_type === 'image');
    return img ? supabase.storage.from('archive-images').getPublicUrl(img.storage_path).data.publicUrl : null;
  };

  return (
    <section style={{margin:'0 0 1.6rem'}}>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'12px',flexWrap:'wrap',marginBottom:'0.7rem'}}>
        <div style={{flex:'1 1 200px',minWidth:0}}>
          <div className="section-title" style={{margin:0}}>สุ่มเหตุการณ์ดนตรีไทย</div>
          <div style={{fontSize:'0.74rem',color:'var(--muted)'}}>หยิบมาจากหอจดหมายเหตุแบบสุ่ม · เข้าหน้านี้ใหม่ก็ได้เรื่องใหม่</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => pick(ids)} disabled={loading || !ids}
          style={{whiteSpace:'nowrap',flex:'0 0 auto'}}>
          🎲 สุ่มใหม่
        </button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(230px, 1fr))',gap:'14px'}}>
        {(loading && recs.length === 0 ? Array.from({length:SHOW}) : recs).map((r, i) => r ? (
          <Link key={r.id} href={`/archive/${r.id}`} style={{textDecoration:'none'}}>
            <div className="card" style={{height:'100%',padding:0,overflow:'hidden',display:'flex',flexDirection:'column'}}>
              {thumb(r) && (
                <img src={thumb(r)} alt="" loading="lazy"
                  style={{width:'100%',height:'130px',objectFit:'cover',display:'block'}} />
              )}
              <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:'5px',flex:1}}>
                <div style={{fontWeight:600,color:'var(--cream)',fontSize:'0.88rem',lineHeight:1.4}}>{r.what_text}</div>
                <div style={{fontSize:'0.72rem',color:'var(--gold2)'}}>
                  {[r.who_text, r.when_text].filter(Boolean).join(' · ')}
                </div>
                {r.where_text && <div style={{fontSize:'0.7rem',color:'var(--muted)'}}>📍 {r.where_text}</div>}
                {r.description && (
                  <div style={{fontSize:'0.72rem',color:'var(--muted)',lineHeight:1.5,
                               display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                    {r.description}
                  </div>
                )}
                <div style={{marginTop:'auto',paddingTop:'6px',fontSize:'0.7rem',color:'var(--gold)'}}>อ่านต่อ →</div>
              </div>
            </div>
          </Link>
        ) : (
          <div key={`sk-${i}`} className="card" style={{height:'190px',opacity:0.4}} />
        ))}
      </div>
    </section>
  );
}
