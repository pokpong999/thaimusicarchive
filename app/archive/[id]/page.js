'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import LeafletMap from '../../../components/LeafletMap';
import CommentSection from '../../../components/CommentSection';
import ShareBar from '../../../components/ShareBar';

const ERAS = { past: 'อดีต', present: 'ปัจจุบัน', future: 'อนาคต' };

export default function ArchiveDetail() {
  const { id } = useParams();
  const [rec, setRec] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    const { data } = await supabase.from('archive_records')
      .select('*, archive_media(*)').eq('id', id).single();
    if (!data) { setNotFound(true); return; }
    setRec(data);
  }

  if (notFound) return <main className="container">ไม่พบบันทึกนี้</main>;
  if (!rec) return <main className="container">กำลังโหลด...</main>;

  const images = (rec.archive_media ?? []).filter(m => m.media_type === 'image');
  const videos = (rec.archive_media ?? []).filter(m => m.media_type === 'youtube');
  const hasPos = rec.lat != null && rec.lng != null;

  return (
    <main className="container" style={{maxWidth:'760px'}}>
      <Link href="/archive"><span style={{color:'var(--muted)',fontSize:'0.8rem'}}>← กลับหอจดหมายเหตุ</span></Link>
      <div className="detail-hero" style={{marginTop:'1rem'}}>
        <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
          <span className="badge badge-fixed">{ERAS[rec.era] ?? rec.era}</span>
          <span style={{fontSize:'0.8rem',color:'var(--muted)'}}>{rec.when_text}</span>
        </div>
        <div className="detail-name" style={{fontSize:'1.4rem'}}>{rec.what_text}</div>
        <div className="detail-meta">
          <div className="meta-pill"><span className="meta-label">ใคร</span><span className="meta-value">{rec.who_text}</span></div>
          <div className="meta-pill"><span className="meta-label">ที่ไหน</span><span className="meta-value">{rec.where_text}</span></div>
        </div>
        <div style={{marginTop:'0.8rem'}}><ShareBar title={rec.what_text + ' — หอจดหมายเหตุดนตรีไทย'} /></div>
        {rec.description && (
          <div style={{marginTop:'1.2rem',fontSize:'0.88rem',lineHeight:1.8,whiteSpace:'pre-wrap'}}>{rec.description}</div>
        )}
      </div>

      {hasPos && (
        <div style={{marginBottom:'1.4rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.6rem'}}>
            <div style={{fontSize:'0.9rem',fontWeight:600}}>📍 ตำแหน่งเหตุการณ์</div>
            <a href={`https://www.google.com/maps?q=${rec.lat},${rec.lng}`} target="_blank">
              <button className="btn btn-outline btn-sm">เปิดใน Google Maps ↗</button>
            </a>
          </div>
          <LeafletMap height="300px"
            markers={[{ lat: rec.lat, lng: rec.lng, popupHtml: `<b>${rec.what_text}</b><br/>${rec.where_text}` }]}
            center={[rec.lat, rec.lng]} zoom={13} />
        </div>
      )}

      {images.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'1rem',marginBottom:'1.4rem'}}>
          {images.map(m => {
            const url = supabase.storage.from('archive-images').getPublicUrl(m.storage_path).data.publicUrl;
            return <a href={url} target="_blank" key={m.id}>
              <img src={url} alt={m.caption ?? ''} style={{width:'100%',borderRadius:'8px',border:'1px solid var(--border)'}} />
            </a>;
          })}
        </div>
      )}

      {videos.map(m => (
        <div className="video-card" key={m.id} style={{marginBottom:'1rem'}}>
          <div className="video-embed">
            <iframe src={`https://www.youtube.com/embed/${m.youtube_id}`} allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          </div>
        </div>
      ))}
      <CommentSection targetType="archive" targetId={id} />
    </main>
  );
}
