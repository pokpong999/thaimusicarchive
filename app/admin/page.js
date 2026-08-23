'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, extractYouTubeId } from '../../lib/supabase';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [pending, setPending] = useState([]);
  const [songs, setSongs] = useState([]);
  const [selSong, setSelSong] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        setRole(p?.role);
        if (p?.role === 'admin') { loadPending(); loadSongs(); }
      }
      setLoading(false);
    });
  }, []);

  async function loadPending() {
    const { data } = await supabase.from('song_videos')
      .select('*, songs(name_th)').eq('approved', false).order('created_at');
    setPending(data ?? []);
  }

  async function loadSongs() {
    const { data } = await supabase.from('songs').select('id, name_th').order('id');
    setSongs(data ?? []);
  }

  async function approve(vid) {
    await supabase.from('song_videos').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', vid);
    loadPending();
  }

  async function reject(vid) {
    await supabase.from('song_videos').delete().eq('id', vid);
    loadPending();
  }

  async function addDirect() {
    const ytId = extractYouTubeId(url);
    if (!selSong) { setMsg('⚠ เลือกเพลงก่อน'); return; }
    if (!ytId) { setMsg('⚠ URL ไม่ถูกต้อง'); return; }
    const { error } = await supabase.from('song_videos').insert({
      song_id: selSong, youtube_url: url, youtube_id: ytId,
      title: title || null, submitted_by: user.id,
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    });
    if (error) { setMsg('⚠ ' + error.message); return; }
    setMsg('✓ เพิ่มวิดีโอเข้าเพลง ' + selSong + ' แล้ว');
    setUrl(''); setTitle('');
  }

  if (loading) return <main className="container">กำลังโหลด...</main>;
  if (!user || role !== 'admin') return (
    <main className="container">
      <div className="lock-box">
        <div style={{fontSize:'2rem',marginBottom:'0.8rem'}}>👑</div>
        <div style={{marginBottom:'1rem'}}>หน้านี้สำหรับ Admin เท่านั้น</div>
        <Link href="/login"><button className="btn btn-outline">เข้าสู่ระบบ</button></Link>
      </div>
    </main>
  );

  return (
    <main className="container">
      <div className="section-title">Admin Panel</div>
      <div className="section-subtitle">จัดการวิดีโอ · {pending.length} รายการรอตรวจ</div>

      <div className="card" style={{borderColor:'rgba(201,168,76,0.3)'}}>
        <div style={{fontSize:'0.95rem',marginBottom:'1rem'}}>➕ เพิ่มวิดีโอโดยตรง (อนุมัติทันที)</div>
        <div className="form-group">
          <label className="form-label">เลือกเพลง</label>
          <select className="form-input" value={selSong} onChange={e => setSelSong(e.target.value)}>
            <option value="">— เลือกเพลง —</option>
            {songs.map(s => <option key={s.id} value={s.id}>{s.id} · {s.name_th}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">YouTube URL</label>
          <input className="form-input" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..." />
        </div>
        <div className="form-group">
          <label className="form-label">คำอธิบาย (ถ้ามี)</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <button className="btn btn-jade" onClick={addDirect}>✓ เพิ่มและอนุมัติทันที</button>
        {msg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{msg}</div>}
      </div>

      <div className="section-title" style={{fontSize:'1rem',marginTop:'2rem'}}>รายการรอตรวจ</div>
      {pending.length === 0 ? (
        <div style={{color:'var(--muted)',fontSize:'0.85rem',marginTop:'0.8rem'}}>ไม่มีรายการรอตรวจ</div>
      ) : pending.map(v => (
        <div className="card" key={v.id}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'1rem',flexWrap:'wrap'}}>
            <div>
              <div style={{fontWeight:500}}>{v.songs?.name_th} <span className="song-id">({v.song_id})</span></div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:'4px'}}>{v.title || '(ไม่มีคำอธิบาย)'}</div>
              <a href={v.youtube_url} target="_blank" style={{fontSize:'0.75rem',color:'var(--jade)'}}>เปิดดูบน YouTube ↗</a>
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <button className="btn btn-jade btn-sm" onClick={() => approve(v.id)}>✓ Approve</button>
              <button className="btn btn-danger btn-sm" onClick={() => reject(v.id)}>✕ Reject</button>
            </div>
          </div>
        </div>
      ))}
    </main>
  );
}
