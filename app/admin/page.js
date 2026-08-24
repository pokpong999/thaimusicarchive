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
  const [pendingSongs, setPendingSongs] = useState([]);
  const [songIdInput, setSongIdInput] = useState({});
  const [members, setMembers] = useState([]);
  const [nathabRows, setNathabRows] = useState([]);
  const [mgQ, setMgQ] = useState('');
  const [mgSongs, setMgSongs] = useState([]);
  const [mgRecords, setMgRecords] = useState([]);
  const [mgComments, setMgComments] = useState([]);
  const [mgMsg, setMgMsg] = useState('');
  const [mgVideos, setMgVideos] = useState([]);
  const [mgTangs, setMgTangs] = useState([]);
  const [mgFiles, setMgFiles] = useState([]);
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
    const { data: ps } = await supabase.from('song_submissions')
      .select('*').eq('approved', false).order('created_at');
    setPendingSongs(ps ?? []);
    const { data: mb } = await supabase.from('profiles')
      .select('*').order('points', { ascending: false });
    setMembers(mb ?? []);
    const { data: np } = await supabase.from('nathab_patterns').select('*').order('id');
    setNathabRows(np ?? []);
    const { data: mr } = await supabase.from('archive_records')
      .select('id, what_text, who_text, when_text, approved').order('created_at', { ascending: false }).limit(50);
    setMgRecords(mr ?? []);
    const { data: mc } = await supabase.from('comments')
      .select('*, profiles(display_name)').order('created_at', { ascending: false }).limit(50);
    setMgComments(mc ?? []);
    const { data: mv } = await supabase.from('song_videos')
      .select('id, song_id, title, youtube_url, songs(name_th)').eq('approved', true)
      .order('created_at', { ascending: false }).limit(50);
    setMgVideos(mv ?? []);
    const { data: mt } = await supabase.from('song_melody')
      .select('song_id, instrument, songs(name_th)').neq('instrument', 'ทำนองหลัก').limit(2000);
    const seen = {}; const tangList = [];
    (mt ?? []).forEach(r => {
      const k = r.song_id + '|' + r.instrument;
      if (!seen[k]) { seen[k] = true; tangList.push(r); }
    });
    setMgTangs(tangList);
    const { data: mf } = await supabase.from('song_files')
      .select('id, song_id, title, storage_path, songs(name_th)').eq('approved', true)
      .order('created_at', { ascending: false }).limit(50);
    setMgFiles(mf ?? []);
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

  // ── อนุมัติเพลงใหม่: สร้าง song + แตกโน้ต + ให้แต้ม ──
  async function approveSong(sub) {
    const sid = (songIdInput[sub.id] ?? '').trim().toUpperCase();
    if (!sid) { alert('ใส่ Song ID ก่อน เช่น USR001'); return; }
    const lines = sub.notation_text.split('\n').map(l => l.trim()).filter(l => l);
    const { error: e1 } = await supabase.from('songs').insert({
      id: sid, name_th: sub.name_th, type: sub.song_type,
      total_verses: lines.length, unique_patterns: 0, contributed_by: sub.submitted_by,
    });
    if (e1) { alert('สร้างเพลงไม่สำเร็จ: ' + e1.message); return; }
    const rows = lines.map((l, i) => ({
      song_id: sid, verse_no: i + 1, instrument: sub.instrument || 'ทำนองหลัก',
      combined: l, approved: true, submitted_by: sub.submitted_by,
    }));
    const { error: e2 } = await supabase.from('song_melody').insert(rows);
    if (e2) { alert('บันทึกโน้ตไม่สำเร็จ: ' + e2.message); return; }
    await supabase.from('song_submissions').update({
      approved: true, approved_by: user.id, approved_at: new Date().toISOString(), assigned_song_id: sid,
    }).eq('id', sub.id);
    await supabase.rpc('add_points', { uid: sub.submitted_by, pts: 10 });
    loadAll();
  }
  async function rejectSong(id) {
    if (!confirm('ปฏิเสธเพลงนี้?')) return;
    await supabase.from('song_submissions').delete().eq('id', id);
    loadAll();
  }

  // ── จัดการข้อมูล ──
  async function searchSongs() {
    let q = supabase.from('songs').select('id, name_th, type').order('name_th').limit(30);
    if (mgQ) q = q.or(`name_th.ilike.%${mgQ}%,id.ilike.%${mgQ}%`);
    const { data } = await q;
    setMgSongs(data ?? []);
  }
  async function saveSong(s) {
    const { error } = await supabase.from('songs').update({ name_th: s.name_th, type: s.type }).eq('id', s.id);
    setMgMsg(error ? '⚠ ' + error.message : '✓ บันทึก ' + s.id);
  }
  async function deleteSong(id) {
    if (!confirm(`ลบเพลง ${id} ถาวร? โน้ต/วิดีโอ/ไฟล์ของเพลงนี้จะถูกลบทั้งหมด`)) return;
    await supabase.from('songs').delete().eq('id', id);
    setMgMsg('✓ ลบ ' + id + ' แล้ว'); searchSongs();
  }
  async function deleteRecord(id) {
    if (!confirm('ลบบันทึกนี้ถาวร?')) return;
    await supabase.from('archive_records').delete().eq('id', id); loadAll();
  }
  async function toggleRecordApprove(r) {
    await supabase.from('archive_records').update({ approved: !r.approved }).eq('id', r.id); loadAll();
  }
  async function deleteComment(id) {
    await supabase.from('comments').delete().eq('id', id); loadAll();
  }
  async function deleteVideo(id) {
    if (!confirm('ลบวิดีโอนี้ถาวร?')) return;
    await supabase.from('song_videos').delete().eq('id', id); loadAll();
  }
  async function deleteTang(songId, instrument) {
    if (!confirm(`ลบทาง${instrument} ของเพลง ${songId} ทั้งหมด?`)) return;
    await supabase.from('song_melody').delete().eq('song_id', songId).eq('instrument', instrument);
    setMgMsg(`✓ ลบทาง${instrument} (${songId}) แล้ว`); loadAll();
  }
  async function deletePdf(f) {
    if (!confirm('ลบไฟล์ PDF นี้ถาวร?')) return;
    await supabase.storage.from('song-pdfs').remove([f.storage_path]);
    await supabase.from('song_files').delete().eq('id', f.id); loadAll();
  }

  async function setMemberRole(uid, newRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', uid); loadAll();
  }
  async function saveNathab(row) {
    const { error } = await supabase.from('nathab_patterns')
      .update({ pattern_text: row.pattern_text }).eq('id', row.id);
    setMgMsg(error ? '⚠ ' + error.message : `✓ บันทึกหน้าทับ ${row.nathab} ${row.level} ${row.instrument}`);
  }

  const [backupMsg, setBackupMsg] = useState('');
  async function backupAll() {
    setBackupMsg('⏳ กำลังดึงข้อมูล...');
    await new Promise((res) => {
      if (window.XLSX) return res();
      const js = document.createElement('script');
      js.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      js.onload = res; document.head.appendChild(js);
    });
    const tables = ['songs','song_melody','archive_records','song_videos','song_files',
      'comments','profiles','nathab_patterns','melody_submissions','song_submissions'];
    const wb = window.XLSX.utils.book_new();
    for (const t of tables) {
      setBackupMsg(`⏳ ${t}...`);
      let all = [], from = 0;
      while (true) {
        const { data, error } = await supabase.from(t).select('*').range(from, from + 999);
        if (error || !data?.length) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
      if (all.length) {
        const ws = window.XLSX.utils.json_to_sheet(all);
        window.XLSX.utils.book_append_sheet(wb, ws, t.slice(0, 31));
      }
    }
    const d = new Date().toISOString().slice(0, 10);
    window.XLSX.writeFile(wb, `THMA_backup_${d}.xlsx`);
    setBackupMsg('✓ ดาวน์โหลดไฟล์สำรองแล้ว — เก็บไว้ในที่ปลอดภัย');
  }

  async function exportMembers() {
    await new Promise((res) => {
      if (window.XLSX) return res();
      const js = document.createElement('script');
      js.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      js.onload = res; document.head.appendChild(js);
    });
    const rows = [['ชื่อ','อีเมล','เบอร์โทร','LINE','สำนัก/วง','จังหวัด','แต้ม','สถานะ','สมัครเมื่อ']];
    members.forEach(m => rows.push([
      m.display_name ?? '', m.email ?? '', m.phone ?? '', m.line_id ?? '',
      m.organization ?? '', m.province ?? '', m.points ?? 0, m.role ?? '',
      m.created_at ? new Date(m.created_at).toLocaleDateString('th-TH') : '',
    ]));
    const ws = window.XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map(() => ({ wch: 18 }));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'สมาชิก');
    window.XLSX.writeFile(wb, 'THMA_members.xlsx');
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
        {[['archive','หอจดหมายเหตุ ('+pendingRecords.length+')'],['videos','วิดีโอเพลง ('+pendingVideos.length+')'],['tang','ทางเครื่อง ('+pendingTang.length+')'],['files','PDF ('+pendingFiles.length+')'],['newsongs','เพลงใหม่ ('+pendingSongs.length+')'],['manage','จัดการข้อมูล'],['members','สมาชิก ('+members.length+')'],['nathab','หน้าทับ'],['samples','🎵 เสียง'],['add','➕วิดีโอ'],['backup','💾 สำรอง']].map(([k,label]) => (
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

      {tab === 'newsongs' && (
        pendingSongs.length === 0
          ? <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ไม่มีเพลงใหม่รอตรวจ</div>
          : pendingSongs.map(s => (
            <div className="card" key={s.id}>
              <div style={{fontWeight:600}}>{s.name_th}
                <span className="badge badge-fixed" style={{marginLeft:'8px'}}>{s.song_type}</span>
                <span className="badge badge-mixed" style={{marginLeft:'4px'}}>{s.instrument}</span></div>
              {s.note && <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:'4px'}}>📝 {s.note}</div>}
              <pre style={{fontSize:'0.8rem',background:'var(--navy3)',padding:'0.7rem',borderRadius:'5px',
                marginTop:'0.6rem',overflowX:'auto',whiteSpace:'pre-wrap',fontFamily:'monospace'}}>{s.notation_text}</pre>
              <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',marginTop:'0.6rem'}}>
                <input className="form-input" style={{width:'140px'}} placeholder="Song ID เช่น USR001"
                  value={songIdInput[s.id] ?? ''} onChange={e => setSongIdInput({...songIdInput, [s.id]: e.target.value})} />
                <button className="btn btn-jade btn-sm" onClick={() => approveSong(s)}>✓ อนุมัติ + สร้างเพลง</button>
                <button className="btn btn-danger btn-sm" onClick={() => rejectSong(s.id)}>✕ ปฏิเสธ</button>
              </div>
            </div>
          ))
      )}

      {tab === 'manage' && (
        <>
          {mgMsg && <div style={{fontSize:'0.8rem',color:'var(--jade)',marginBottom:'0.6rem'}}>{mgMsg}</div>}
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎼 เพลง — แก้ไข / ลบ</div>
            <div style={{display:'flex',gap:'8px',marginBottom:'0.8rem'}}>
              <input className="form-input" placeholder="ค้นหาชื่อเพลงหรือ ID..." value={mgQ}
                onChange={e => setMgQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchSongs()} />
              <button className="btn btn-outline btn-sm" onClick={searchSongs}>ค้นหา</button>
            </div>
            {mgSongs.map((s, i) => (
              <div key={s.id} style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'6px',flexWrap:'wrap'}}>
                <span className="song-id" style={{width:'70px'}}>{s.id}</span>
                <input className="form-input" style={{flex:1,minWidth:'160px'}} value={s.name_th}
                  onChange={e => setMgSongs(mgSongs.map((x,j) => j===i ? {...x, name_th: e.target.value} : x))} />
                <input className="form-input" style={{width:'130px'}} value={s.type ?? ''}
                  onChange={e => setMgSongs(mgSongs.map((x,j) => j===i ? {...x, type: e.target.value} : x))} />
                <button className="btn btn-jade btn-sm" onClick={() => saveSong(s)}>💾</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteSong(s.id)}>🗑</button>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>📜 จดหมายเหตุ (50 ล่าสุด) — ซ่อน / ลบ</div>
            {mgRecords.map(r => (
              <div key={r.id} style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px',flexWrap:'wrap'}}>
                <span style={{flex:1,fontSize:'0.82rem',minWidth:'200px'}}>
                  {r.approved ? '🟢' : '⚪'} {r.what_text} <span style={{color:'var(--muted)'}}>· {r.who_text} · {r.when_text}</span>
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => toggleRecordApprove(r)}>
                  {r.approved ? 'ซ่อน' : 'แสดง'}</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteRecord(r.id)}>🗑</button>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎬 วิดีโอเพลง (50 ล่าสุด) — ลบ</div>
            {mgVideos.map(v => (
              <div key={v.id} style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                <span style={{flex:1,fontSize:'0.8rem'}}>{v.songs?.name_th}
                  <span style={{color:'var(--muted)'}}> · {v.title ?? v.youtube_url}</span></span>
                <a href={v.youtube_url} target="_blank" style={{fontSize:'0.72rem',color:'var(--jade)'}}>ดู↗</a>
                <button className="btn btn-danger btn-sm" onClick={() => deleteVideo(v.id)}>🗑</button>
              </div>
            ))}
          </div>
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>🎹 ทางเครื่องดนตรี — ลบ</div>
            {mgTangs.length === 0
              ? <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>มีเฉพาะทำนองหลัก</div>
              : mgTangs.map((t, i) => (
                <div key={i} style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                  <span style={{flex:1,fontSize:'0.8rem'}}>{t.songs?.name_th}
                    <span className="badge badge-fixed" style={{marginLeft:'6px'}}>{t.instrument}</span></span>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteTang(t.song_id, t.instrument)}>🗑</button>
                </div>
              ))}
          </div>
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>📁 ไฟล์ PDF (50 ล่าสุด) — ลบ</div>
            {mgFiles.map(f => {
              const url = supabase.storage.from('song-pdfs').getPublicUrl(f.storage_path).data.publicUrl;
              return (
                <div key={f.id} style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                  <span style={{flex:1,fontSize:'0.8rem'}}>{f.songs?.name_th}
                    <span style={{color:'var(--muted)'}}> · {f.title}</span></span>
                  <a href={url} target="_blank" style={{fontSize:'0.72rem',color:'var(--jade)'}}>เปิด↗</a>
                  <button className="btn btn-danger btn-sm" onClick={() => deletePdf(f)}>🗑</button>
                </div>
              );
            })}
          </div>
          <div className="card">
            <div style={{fontWeight:600,marginBottom:'0.6rem'}}>💬 ความคิดเห็น (50 ล่าสุด)</div>
            {mgComments.map(c => (
              <div key={c.id} style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px'}}>
                <span style={{flex:1,fontSize:'0.8rem'}}>
                  <b>{c.profiles?.display_name ?? '?'}</b> ({c.target_type}/{c.target_id}): {(c.body ?? '(รูปภาพ)').slice(0, 80)}
                </span>
                <button className="btn btn-danger btn-sm" onClick={() => deleteComment(c.id)}>🗑</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'members' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.8rem'}}>
            <div style={{fontWeight:600}}>👥 สมาชิกทั้งหมด ({members.length})</div>
            <button className="btn btn-jade btn-sm" onClick={exportMembers}>📊 Export Excel</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ชื่อ</th><th>อีเมล</th><th>โทร</th><th>LINE</th><th>สำนัก</th><th>จังหวัด</th><th>แต้ม</th><th>สถานะ</th></tr></thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td>{m.display_name ?? '—'}</td>
                    <td style={{fontSize:'0.72rem'}}>{m.email ?? '—'}</td>
                    <td style={{fontSize:'0.72rem'}}>{m.phone ?? '—'}</td>
                    <td style={{fontSize:'0.72rem'}}>{m.line_id ?? '—'}</td>
                    <td style={{fontSize:'0.72rem'}}>{m.organization ?? '—'}</td>
                    <td style={{fontSize:'0.72rem'}}>{m.province ?? '—'}</td>
                    <td style={{fontFamily:'monospace',color:'var(--jade)'}}>{m.points ?? 0}</td>
                    <td>
                      <select className="filter-select" value={m.role ?? 'contributor'}
                        onChange={e => setMemberRole(m.id, e.target.value)} style={{fontSize:'0.72rem',padding:'2px 6px'}}>
                        <option value="contributor">สมาชิก</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'nathab' && (
        <div>
          <div style={{fontSize:'0.78rem',color:'var(--muted)',marginBottom:'0.8rem'}}>
            แก้ไขหน้าทับได้โดยตรง — รูปแบบ: พยางค์กลองต่อตำแหน่ง คั่นห้องด้วย | (เช่น - - - เท่ง | - - - พรึม)
            พยางค์ที่รองรับ: เท่ง ทิง ติง พรึม ตุ๊บ ทั่ม ป๊ะ จ๊ะ โจ๊ะ
          </div>
          {nathabRows.map((row, i) => (
            <div className="card" key={row.id} style={{padding:'0.8rem'}}>
              <div style={{fontSize:'0.8rem',fontWeight:600,marginBottom:'0.4rem'}}>
                {row.nathab} · {row.level} · {row.instrument}
              </div>
              <textarea className="form-input" rows="2" value={row.pattern_text}
                onChange={e => setNathabRows(nathabRows.map((x,j) => j===i ? {...x, pattern_text: e.target.value} : x))}
                style={{fontFamily:'monospace',fontSize:'0.8rem',resize:'vertical'}} />
              <button className="btn btn-jade btn-sm" style={{marginTop:'0.4rem'}} onClick={() => saveNathab(row)}>💾 บันทึก</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'backup' && (
        <div className="card">
          <div style={{fontWeight:600,marginBottom:'0.6rem'}}>💾 สำรองข้อมูลทั้งเว็บ</div>
          <div style={{fontSize:'0.8rem',color:'var(--muted)',lineHeight:1.8,marginBottom:'1rem'}}>
            ดาวน์โหลดข้อมูลทุกตาราง (เพลง โน้ต จดหมายเหตุ วิดีโอ สมาชิก คอมเมนต์ หน้าทับ ฯลฯ)
            เป็น Excel ไฟล์เดียว — แนะนำสำรองสม่ำเสมอ เดือนละครั้งเป็นอย่างน้อย
            และเก็บไฟล์ไว้หลายที่ (คอมพิวเตอร์ + Google Drive)
          </div>
          <button className="btn btn-jade" onClick={backupAll}>📦 ดาวน์โหลดไฟล์สำรองทั้งหมด</button>
          {backupMsg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{backupMsg}</div>}
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
