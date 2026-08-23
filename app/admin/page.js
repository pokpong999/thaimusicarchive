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
  const [sampleFiles, setSampleFiles] = useState([]);
  const [sampleList, setSampleList] = useState([]);
  const [sampleMsg, setSampleMsg] = useState('');
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
    const { data: sl } = await supabase.storage.from('instrument-samples').list('gong');
    setSampleList((sl ?? []).map(x => x.name));
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

  const EXPECTED = ['m_low','f_low','s_low','l_low','t_low',
    'd_mid','r_mid','m_mid','f_mid','s_mid','l_mid','t_mid',
    'd_high','r_high','m_high','f_high'];

  async function uploadSamples() {
    if (!sampleFiles.length) { setSampleMsg('⚠ เลือกไฟล์ก่อน'); return; }
    setSampleMsg('กำลังอัปโหลด...');
    let ok = 0, skip = 0;
    for (const file of Array.from(sampleFiles)) {
      const name = file.name.replace(/\.(mp3|wav|m4a)$/i, '');
      if (!EXPECTED.includes(name)) { skip++; continue; }
      const { error } = await supabase.storage.from('instrument-samples')
        .upload(`gong/${name}.mp3`, file, { upsert: true });
      if (!error) ok++;
    }
    setSampleMsg(`✓ อัปโหลด ${ok} ไฟล์` + (skip ? ` · ข้าม ${skip} ไฟล์ (ชื่อไม่ตรงระบบ)` : ''));
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
        {[['archive','หอจดหมายเหตุ ('+pendingRecords.length+')'],['videos','วิดีโอเพลง ('+pendingVideos.length+')'],['tang','ทางเครื่อง ('+pendingTang.length+')'],['files','ไฟล์ PDF ('+pendingFiles.length+')'],['samples','🎵 เสียงเครื่อง'],['add','เพิ่มวิดีโอตรง']].map(([k,label]) => (
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

      {tab === 'samples' && (
        <div className="card" style={{borderColor:'rgba(76,154,132,0.3)'}}>
          <div style={{fontSize:'0.95rem',fontWeight:600,marginBottom:'0.4rem'}}>🎵 ไฟล์เสียงฆ้องวงใหญ่ (16 ลูก)</div>
          <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:'1rem',lineHeight:1.7}}>
            ตั้งชื่อไฟล์: <code style={{color:'var(--gold)'}}>ตัวโน้ต_ระดับ.mp3</code> เช่น d_mid.mp3, t_low.mp3, f_high.mp3<br/>
            (d=ด r=ร m=ม f=ฟ s=ซ l=ล t=ท · low=ต่ำฺ mid=กลาง high=สูงํ) · เลือกหลายไฟล์พร้อมกันได้ · อัปโหลดซ้ำ=แทนที่
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))',gap:'6px',marginBottom:'1rem'}}>
            {EXPECTED.map(k => {
              const have = sampleList.includes(k + '.mp3');
              return (
                <div key={k} style={{padding:'6px 8px',borderRadius:'5px',fontSize:'0.72rem',
                  fontFamily:'monospace',textAlign:'center',
                  background: have ? 'rgba(76,154,132,0.15)' : 'var(--navy3)',
                  border: have ? '1px solid rgba(76,154,132,0.4)' : '1px solid var(--border)',
                  color: have ? 'var(--jade)' : 'var(--muted)'}}>
                  {have ? '✓' : '·'} {k}
                </div>
              );
            })}
          </div>
          <div className="form-group">
            <input className="form-input" type="file" accept=".mp3,.wav,.m4a" multiple
              onChange={e => setSampleFiles(e.target.files)} />
          </div>
          <button className="btn btn-jade" onClick={uploadSamples}>⬆ อัปโหลดไฟล์เสียง</button>
          {sampleMsg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{sampleMsg}</div>}
        </div>
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
