'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import LeafletMap from '../../../components/LeafletMap';
import CommentSection from '../../../components/CommentSection';
import ShareBar from '../../../components/ShareBar';
import { useMe } from '../../../components/Gate';

const ERAS = { past: 'อดีต', present: 'ปัจจุบัน', future: 'อนาคต' };

export default function ArchiveDetailClient() {
  const { id } = useParams();
  const [rec, setRec] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const { isAdmin, user } = useMe();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

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
  const canEditMedia = isAdmin || (user && rec.created_by === user.id);

  async function addImages(files) {
    if (!files?.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { setMsg('⚠ ' + file.name + ' ใหญ่เกิน 5MB'); continue; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
      const path = `${id}/${Date.now()}_${Math.random().toString(36).slice(2,7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('archive-images').upload(path, file);
      if (upErr) { setMsg('⚠ อัปโหลดไม่สำเร็จ: ' + upErr.message); continue; }
      const { error: insErr } = await supabase.from('archive_media')
        .insert({ record_id: id, media_type: 'image', storage_path: path });
      if (insErr) setMsg('⚠ บันทึกไม่สำเร็จ: ' + insErr.message);
    }
    await load(); setBusy(false);
    setMsg(m => m || '✓ เพิ่มรูปแล้ว');
    setTimeout(() => setMsg(''), 3500);
  }

  async function delImage(m) {
    if (!confirm('ลบรูปนี้?')) return;
    setBusy(true);
    await supabase.storage.from('archive-images').remove([m.storage_path]);
    await supabase.from('archive_media').delete().eq('id', m.id);
    await load(); setBusy(false);
    setMsg('✓ ลบรูปแล้ว'); setTimeout(() => setMsg(''), 3000);
  }

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

      {(images.length > 0 || canEditMedia) && (
        <div style={{marginBottom:'1.4rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'0.7rem'}}>
            <div style={{fontWeight:600,fontSize:'0.9rem'}}>🖼 ภาพประกอบ ({images.length})</div>
            {canEditMedia && (
              <label className="btn btn-outline btn-sm" style={{cursor:'pointer',fontSize:'0.72rem'}}>
                {busy ? '⏳ กำลังอัปโหลด...' : '＋ เพิ่มรูป'}
                <input type="file" accept="image/*" multiple style={{display:'none'}} disabled={busy}
                  onChange={e => addImages(e.target.files)} />
              </label>
            )}
            {msg && <span style={{fontSize:'0.75rem',color:'var(--jade)'}}>{msg}</span>}
          </div>
          {images.length > 0 ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'1rem'}}>
              {images.map(m => {
                const url = supabase.storage.from('archive-images').getPublicUrl(m.storage_path).data.publicUrl;
                return (
                  <div key={m.id} style={{position:'relative'}}>
                    <a href={url} target="_blank">
                      <img src={url} alt={m.caption ?? ''}
                        style={{width:'100%',borderRadius:'8px',border:'1px solid var(--border)',display:'block'}} />
                    </a>
                    {canEditMedia && (
                      <button className="btn btn-sm" disabled={busy} onClick={() => delImage(m)}
                        style={{position:'absolute',right:'8px',top:'8px',background:'rgba(15,27,45,0.9)',
                          border:'1px solid #C0574B',color:'#E08878',fontSize:'0.7rem'}}>🗑</button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : canEditMedia && (
            <div style={{height:'120px',border:'1px dashed var(--gold)',borderRadius:'10px',
              display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',
              fontSize:'0.82rem',background:'var(--navy3)'}}>
              ยังไม่มีภาพประกอบ — กด "＋ เพิ่มรูป" เพื่ออัปโหลด (เลือกหลายรูปพร้อมกันได้)
            </div>
          )}
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
