'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, extractYouTubeId } from '../../../lib/supabase';

export default function SongDetail() {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [videos, setVideos] = useState([]);
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    load();
  }, [id]);

  async function load() {
    const { data: s } = await supabase.from('songs').select('*').eq('id', id).single();
    setSong(s);
    const { data: v } = await supabase.from('song_videos')
      .select('*').eq('song_id', id).eq('approved', true).order('created_at');
    setVideos(v ?? []);
  }

  async function submitVideo() {
    const ytId = extractYouTubeId(url);
    if (!ytId) { setMsg('⚠ URL ไม่ถูกต้อง'); return; }
    const { error } = await supabase.from('song_videos').insert({
      song_id: id, youtube_url: url, youtube_id: ytId,
      title: title || null, submitted_by: user.id,
    });
    if (error) { setMsg('เกิดข้อผิดพลาด: ' + error.message); return; }
    setMsg('✓ ส่งวิดีโอแล้ว — รอ Admin อนุมัติ');
    setUrl(''); setTitle(''); setShowForm(false);
  }

  if (!song) return <main className="container">กำลังโหลด...</main>;

  return (
    <main className="container">
      <Link href="/"><span style={{color:'var(--muted)',fontSize:'0.8rem'}}>← กลับรายการ</span></Link>
      <div className="detail-hero" style={{marginTop:'1rem'}}>
        <div className="detail-id">{song.id}</div>
        <div className="detail-name">{song.name_th}</div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          {song.style && <span className="badge badge-variable">{song.style}</span>}
          {song.type && <span className="badge badge-mixed">{song.type}</span>}
          {song.notation && song.notation !== '-' && <span className="badge badge-fixed">{song.notation}</span>}
        </div>
        <div className="detail-meta">
          <div className="meta-pill"><span className="meta-label">วรรค</span>
            <span className="meta-value" style={{fontFamily:'monospace',color:'var(--jade)'}}>{song.total_verses}</span></div>
          <div className="meta-pill"><span className="meta-label">กระสวนไม่ซ้ำ</span>
            <span className="meta-value" style={{fontFamily:'monospace',color:'var(--jade)'}}>{song.unique_patterns}</span></div>
          {song.sections && <div className="meta-pill"><span className="meta-label">ท่อน</span>
            <span className="meta-value">{song.sections}</span></div>}
        </div>
        {song.notes && <div style={{marginTop:'1rem',fontSize:'0.8rem',color:'var(--muted)',lineHeight:1.6}}>{song.notes}</div>}
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div className="section-title" style={{fontSize:'1rem'}}>วิดีโอการแสดง</div>
          <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>ช่อง ทำนองหลักเพลงไทย</div>
        </div>
        {user && <button className="btn btn-outline btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'ยกเลิก' : '+ เพิ่มวิดีโอ'}</button>}
      </div>

      {showForm && (
        <div className="card" style={{marginTop:'1rem',borderColor:'rgba(201,168,76,0.3)'}}>
          <div className="form-group">
            <label className="form-label">YouTube URL *</label>
            <input className="form-input" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..." />
          </div>
          <div className="form-group">
            <label className="form-label">คำอธิบาย (ถ้ามี)</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="เช่น สามชั้น เที่ยวแรก" />
          </div>
          <button className="btn btn-jade" onClick={submitVideo}>ส่งเพื่อรอ Admin อนุมัติ</button>
        </div>
      )}
      {msg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{msg}</div>}

      {videos.length === 0 ? (
        <div className="lock-box" style={{marginTop:'1rem'}}>
          <div style={{fontSize:'0.85rem',color:'var(--muted)'}}>ยังไม่มีวิดีโอสำหรับเพลงนี้</div>
          {!user && <div style={{marginTop:'1rem'}}>
            <Link href="/login"><button className="btn btn-primary btn-sm">เข้าสู่ระบบเพื่อเพิ่มวิดีโอ</button></Link>
          </div>}
        </div>
      ) : (
        <div className="video-grid">
          {videos.map(v => (
            <div className="video-card" key={v.id}>
              <div className="video-embed">
                <iframe src={`https://www.youtube.com/embed/${v.youtube_id}`}
                  allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
              </div>
              <div className="video-body">
                <div className="video-title">{v.title || song.name_th}</div>
                <div className="video-meta"><span>▶ {v.channel_name}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
