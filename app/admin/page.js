'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, extractYouTubeId } from '../../lib/supabase';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [tab, setTab] = useState('archive');
  const [pendingVideos, setPendingVideos] = useState([]);
  const [pendingRecords, setPendingRecords] = useState([]);
  const [pendingTang, setPendingTang] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
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
        if (p?.role === 'admin') { loadAll(); }
      }
      setLoading(false);
    });
  }, []);

  async function loadAll() {
    const { data: v } = await supabase.from('song_videos')
      .select('*, songs(name_th)').eq('approved', false).order('created_at');
    setPendingVideos(v ?? []);
    const { data: r } = await supabase.from('archive_records')
      .select('*, archive_media(*)').eq('approved', false).order('created_at');
    setPendingRecords(r ?? []);
    const { data: s } = await supabase.from('songs').select('id, name_th').order('name_th');
    setSongs(s ?? []);
    const { data: t } = await supabase.from('melody_submissions')
      .select('*, songs(name_th)').eq('approved', false).order('created_at');
    setPendingTang(t ?? []);
    const { data: f } = await supabase.from('song_files')
      .select('*, songs(name_th)').eq('approved', false).order('created_at');
    setPendingFiles(f ?? []);
  }

  async function approveVideo(id) {
    await supabase.from('song_videos').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', id);
    loadAll();
  }
  async function rejectVideo(id) {
    await supabase.from('song_videos').delete().eq('id', id);
    loadAll();
  }
  async function approveRecord(id) {
    await supabase.from('archive_records').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', id);
    loadAll();
  }
  async function rejectRecord(id) {
    await supabase.from('archive_records').delete().eq('id', id);
    loadAll();
  }

  async function approveTang(id) {
    await supabase.from('melody_submissions').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', id);
    loadAll();
  }
  async function rejectTang(id) {
    await supabase.from('melody_submissions').delete().eq('id', id);
    loadAll();
  }

  async function approveFile(id) {
    await supabase.from('song_files').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq('id', id);
    loadAll();
  }
  async function rejectFile(id) {
    await supabase.from('song_files').delete().eq('id', id);
    loadAll();
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
      <div className="section-subtitle">
        หอจดหมายเหตุรอตรวจ {pendingRecords.length} · วิดีโอเพลงรอตรวจ {pendingVideos.length}
      </div>

      <div style={{display:'flex',gap:'0',borderBottom:'1px solid var(--border)',marginBottom:'1.2rem'}}>
        {[['archive','หอจดหมายเหตุ ('+pendingRecords.length+')'],['videos','วิดีโอเพลง ('+pendingVideos.length+')'],['tang','ทางเครื่อง ('+pendingTang.length+')'],['files','ไฟล์ PDF ('+pendingFiles.length+')'],['add','เพิ่มวิดีโอตรง']].map(([k,label]) => (
          <div key={k} onClick={() => setTab(k)}
            style={{padding:'8px 16px',fontSize:'0.85rem',cursor:'pointer',
              color: tab===k ? 'var(--gold)' : 'var(--muted)',
              borderBottom: tab===k ? '2px solid var(--gold)' : '2px solid transparent'}}>
            {label}
          </div>
        ))}
      </div>

      {tab === 'archive' && (
        pendingRecords.length === 0
          ? <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ไม่มีบันทึกรอตรวจ</div>
          : pendingRecords.map(r => (
            <div className="card" key={r.id}>
              <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                    <span className="badge badge-fixed">{r.era}</span>
                    <span style={{fontSize:'0.75rem',color:'var(--muted)'}}>{r.when_text}</span>
                  </div>
                  <div style={{fontWeight:600,margin:'6px 0 2px'}}>{r.what_text}</div>
                  <div style={{fontSize:'0.8rem',color:'var(--muted)'}}>{r.who_text} · {r.where_text}</div>
                  {r.description && <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:'6px'}}>{r.description}</div>}
                  <div style={{fontSize:'0.72rem',color:'var(--jade)',marginTop:'6px'}}>
                    แนบ: รูป {(r.archive_media??[]).filter(m=>m.media_type==='image').length} · วิดีโอ {(r.archive_media??[]).filter(m=>m.media_type==='youtube').length}
                  </div>
                </div>
                <div style={{display:'flex',gap:'8px',alignItems:'flex-start'}}>
                  <button className="btn btn-jade btn-sm" onClick={() => approveRecord(r.id)}>✓ Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => rejectRecord(r.id)}>✕ Reject</button>
                </div>
              </div>
            </div>
          ))
      )}

      {tab === 'videos' && (
        pendingVideos.length === 0
          ? <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ไม่มีวิดีโอรอตรวจ</div>
          : pendingVideos.map(v => (
            <div className="card" key={v.id}>
              <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
                <div>
                  <div style={{fontWeight:500}}>{v.songs?.name_th} <span className="song-id">({v.song_id})</span></div>
                  <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:'4px'}}>{v.title || '(ไม่มีคำอธิบาย)'}</div>
                  <a href={v.youtube_url} target="_blank" style={{fontSize:'0.75rem',color:'var(--jade)'}}>เปิดดูบน YouTube ↗</a>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button className="btn btn-jade btn-sm" onClick={() => approveVideo(v.id)}>✓ Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => rejectVideo(v.id)}>✕ Reject</button>
                </div>
              </div>
            </div>
          ))
      )}

      {tab === 'tang' && (
        pendingTang.length === 0
          ? <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ไม่มีทางเครื่องรอตรวจ</div>
          : pendingTang.map(t => (
            <div className="card" key={t.id}>
              <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontWeight:600}}>{t.songs?.name_th} <span className="song-id">({t.song_id})</span>
                    <span className="badge badge-fixed" style={{marginLeft:'8px'}}>{t.instrument}</span></div>
                  <pre style={{fontSize:'0.78rem',color:'var(--cream)',background:'var(--navy3)',
                    padding:'0.7rem',borderRadius:'5px',marginTop:'0.6rem',overflowX:'auto',
                    whiteSpace:'pre-wrap',fontFamily:'monospace'}}>{t.notation_text}</pre>
                  <div style={{fontSize:'0.7rem',color:'var(--muted)'}}>
                    {t.notation_text.split('\n').filter(l => l.trim()).length} วรรค
                  </div>
                </div>
                <div style={{display:'flex',gap:'8px',alignItems:'flex-start'}}>
                  <button className="btn btn-jade btn-sm" onClick={() => approveTang(t.id)}>✓ Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => rejectTang(t.id)}>✕ Reject</button>
                </div>
              </div>
            </div>
          ))
      )}

      {tab === 'files' && (
        pendingFiles.length === 0
          ? <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ไม่มีไฟล์รอตรวจ</div>
          : pendingFiles.map(f => {
            const url = supabase.storage.from('song-pdfs').getPublicUrl(f.storage_path).data.publicUrl;
            return (
              <div className="card" key={f.id}>
                <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontWeight:600}}>{f.songs?.name_th} <span className="song-id">({f.song_id})</span></div>
                    <div style={{fontSize:'0.8rem',color:'var(--muted)',marginTop:'4px'}}>{f.title}</div>
                    <a href={url} target="_blank" style={{fontSize:'0.75rem',color:'var(--jade)'}}>เปิดดู PDF ↗</a>
                  </div>
                  <div style={{display:'flex',gap:'8px',alignItems:'flex-start'}}>
                    <button className="btn btn-jade btn-sm" onClick={() => approveFile(f.id)}>✓ Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={() => rejectFile(f.id)}>✕ Reject</button>
                  </div>
                </div>
              </div>
            );
          })
      )}

      {tab === 'add' && (
        <div className="card" style={{borderColor:'rgba(201,168,76,0.3)'}}>
          <div style={{fontSize:'0.95rem',marginBottom:'1rem'}}>➕ เพิ่มวิดีโอเพลงโดยตรง (อนุมัติทันที)</div>
          <div className="form-group">
            <label className="form-label">เลือกเพลง</label>
            <select className="form-input" value={selSong} onChange={e => setSelSong(e.target.value)}>
              <option value="">— เลือกเพลง —</option>
              {songs.map(s => <option key={s.id} value={s.id}>{s.name_th} ({s.id})</option>)}
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
      )}
    </main>
  );
}
