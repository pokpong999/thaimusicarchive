'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, extractYouTubeId } from '../../../lib/supabase';
import NotationPlayer from '../../../components/NotationPlayer';
import ExportBar from '../../../components/ExportBar';
import CommentSection from '../../../components/CommentSection';
import ShareBar from '../../../components/ShareBar';

export default function SongDetailClient() {
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [melody, setMelody] = useState([]);
  const [instruments, setInstruments] = useState(['ทำนองหลัก']);
  const [contributors, setContributors] = useState({});
  const [songOwner, setSongOwner] = useState(null);
  const [instrument, setInstrument] = useState('ทำนองหลัก');
  const [showTangForm, setShowTangForm] = useState(false);
  const [tangInstrument, setTangInstrument] = useState('ระนาดเอก');
  const [tangText, setTangText] = useState('');
  const [tangMsg, setTangMsg] = useState('');
  const [pdfs, setPdfs] = useState([]);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfMsg, setPdfMsg] = useState('');
  const [showPdfForm, setShowPdfForm] = useState(false);
  const [videos, setVideos] = useState([]);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState('history');
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [msg, setMsg] = useState('');
  // admin edit
  const [editHistory, setEditHistory] = useState(false);
  const [historyDraft, setHistoryDraft] = useState('');
  const [lyricsDraft, setLyricsDraft] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        setIsAdmin(p?.role === 'admin');
      }
    });
    load();
  }, [id]);

  async function load() {
    const { data: s } = await supabase.from('songs').select('*').eq('id', id).single();
    setSong(s);
    setHistoryDraft(s?.history ?? '');
    setLyricsDraft(s?.lyrics ?? '');
    const { data: inst } = await supabase.from('song_melody')
      .select('instrument, submitted_by').eq('song_id', id).eq('approved', true);
    const uniq = [...new Set((inst ?? []).map(r => r.instrument ?? 'ทำนองหลัก'))];
    setInstruments(uniq.length ? uniq : ['ทำนองหลัก']);
    // เครดิตผู้เพิ่มข้อมูล
    const byInst = {};
    (inst ?? []).forEach(r => { if (r.submitted_by && !byInst[r.instrument]) byInst[r.instrument] = r.submitted_by; });
    const uids = [...new Set([...Object.values(byInst), s?.contributed_by].filter(Boolean))];
    if (uids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', uids);
      const nameOf = {}; (profs ?? []).forEach(pr => nameOf[pr.id] = pr.display_name);
      const cmap = {}; Object.entries(byInst).forEach(([k, uid]) => cmap[k] = nameOf[uid]);
      setContributors(cmap);
      if (s?.contributed_by) setSongOwner(nameOf[s.contributed_by]);
    }
    const { data: v } = await supabase.from('song_videos')
      .select('*').eq('song_id', id).eq('approved', true).order('created_at');
    setVideos(v ?? []);
    const { data: pf } = await supabase.from('song_files')
      .select('*').eq('song_id', id).eq('approved', true).order('created_at');
    setPdfs(pf ?? []);
  }

  useEffect(() => {
    supabase.from('song_melody')
      .select('*').eq('song_id', id).eq('instrument', instrument).eq('approved', true)
      .order('verse_no')
      .then(({ data }) => setMelody(data ?? []));
  }, [id, instrument]);

  async function submitTang() {
    const lines = tangText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) { setTangMsg('⚠ กรอกโน้ตอย่างน้อย 1 วรรค'); return; }
    const { error } = await supabase.from('melody_submissions').insert({
      song_id: id, instrument: tangInstrument, notation_text: tangText,
      submitted_by: user.id,
    });
    if (error) { setTangMsg('⚠ ' + error.message); return; }
    setTangMsg('✓ ส่งทาง' + tangInstrument + ' แล้ว (' + lines.length + ' วรรค) — รอ Admin อนุมัติ');
    setTangText(''); setShowTangForm(false);
  }

  async function uploadPdf() {
    if (!pdfFile) { setPdfMsg('⚠ เลือกไฟล์ PDF ก่อน'); return; }
    if (pdfFile.size > 20 * 1024 * 1024) { setPdfMsg('⚠ ไฟล์ใหญ่เกิน 20MB'); return; }
    setPdfMsg('กำลังอัปโหลด...');
    const path = `${id}/${Date.now()}_${pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: upErr } = await supabase.storage.from('song-pdfs').upload(path, pdfFile);
    if (upErr) { setPdfMsg('⚠ ' + upErr.message); return; }
    const { error } = await supabase.from('song_files').insert({
      song_id: id, storage_path: path, title: pdfTitle || pdfFile.name,
      submitted_by: user.id,
    });
    if (error) { setPdfMsg('⚠ ' + error.message); return; }
    setPdfMsg('✓ อัปโหลดแล้ว — รอ Admin อนุมัติ (+10 แต้มเมื่อผ่าน)');
    setPdfFile(null); setPdfTitle(''); setShowPdfForm(false);
  }

  async function saveHistory() {
    const { error } = await supabase.from('songs')
      .update({ history: historyDraft || null, lyrics: lyricsDraft || null }).eq('id', id);
    if (error) { setMsg('⚠ ' + error.message); return; }
    setMsg('✓ บันทึกแล้ว');
    setEditHistory(false);
    load();
  }

  async function submitVideo() {
    const ytId = extractYouTubeId(url);
    if (!ytId) { setMsg('⚠ URL ไม่ถูกต้อง'); return; }
    const { error } = await supabase.from('song_videos').insert({
      song_id: id, youtube_url: url, youtube_id: ytId,
      title: title || null, submitted_by: user.id,
    });
    if (error) { setMsg('⚠ ' + error.message); return; }
    setMsg('✓ ส่งวิดีโอแล้ว — รอ Admin อนุมัติ');
    setUrl(''); setTitle(''); setShowForm(false);
  }

  if (!song) return <main className="container">กำลังโหลด...</main>;

  const TABS = [
    ['history', '📜 ประวัติเพลง'],
    ['notation', '♪ โน้ตเพลง'],
    ['videos', `🎬 วิดีโอ (${videos.length})`],
  ];

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
        {songOwner && <div style={{fontSize:'0.72rem',color:'var(--jade)',marginTop:'6px'}}>
          ✍️ เพิ่มข้อมูลโดย: {songOwner}</div>}
        <div style={{marginTop:'0.8rem'}}><ShareBar title={song.name_th + ' — หอจดหมายเหตุดนตรีไทย'} /></div>
        <div className="detail-meta">
          <div className="meta-pill"><span className="meta-label">วรรค</span>
            <span className="meta-value" style={{fontFamily:'monospace',color:'var(--jade)'}}>{song.total_verses}</span></div>
          <div className="meta-pill"><span className="meta-label">กระสวนไม่ซ้ำ</span>
            <span className="meta-value" style={{fontFamily:'monospace',color:'var(--jade)'}}>{song.unique_patterns}</span></div>
        </div>
      </div>

      <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:'1.2rem'}}>
        {TABS.map(([k, label]) => (
          <div key={k} onClick={() => setTab(k)}
            style={{padding:'8px 16px',fontSize:'0.85rem',cursor:'pointer',
              color: tab===k ? 'var(--gold)' : 'var(--muted)',
              borderBottom: tab===k ? '2px solid var(--gold)' : '2px solid transparent'}}>
            {label}
          </div>
        ))}
      </div>

      {/* ── ประวัติเพลง ── */}
      {tab === 'history' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.8rem'}}>
            <div style={{fontWeight:600}}>ประวัติเพลง</div>
            {isAdmin && !editHistory &&
              <button className="btn btn-outline btn-sm" onClick={() => setEditHistory(true)}>✏️ แก้ไข</button>}
          </div>
          {editHistory ? (
            <>
              <div className="form-group">
                <label className="form-label">ประวัติเพลง</label>
                <textarea className="form-input" rows="8" value={historyDraft}
                  onChange={e => setHistoryDraft(e.target.value)}
                  placeholder="ประวัติความเป็นมา ผู้ประพันธ์ ยุคสมัย การใช้งาน..." style={{resize:'vertical'}} />
              </div>
              <div className="form-group">
                <label className="form-label">เนื้อร้อง (แสดงในโหมดโน้ตขับร้อง)</label>
                <textarea className="form-input" rows="6" value={lyricsDraft}
                  onChange={e => setLyricsDraft(e.target.value)} style={{resize:'vertical'}} />
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button className="btn btn-jade" onClick={saveHistory}>✓ บันทึก</button>
                <button className="btn btn-outline" onClick={() => setEditHistory(false)}>ยกเลิก</button>
              </div>
            </>
          ) : song.history ? (
            <div style={{fontSize:'0.9rem',lineHeight:1.9,whiteSpace:'pre-wrap'}}>{song.history}</div>
          ) : (
            <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ยังไม่มีประวัติเพลงนี้</div>
          )}
          {msg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{msg}</div>}
        </div>
      )}

      {/* ── โน้ตเพลง ── */}
      {tab === 'notation' && (
        <>
          <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',marginBottom:'1rem'}}>
            <span style={{fontSize:'0.78rem',color:'var(--muted)'}}>ทาง / เครื่องดนตรี:</span>
            <select className="filter-select" value={instrument} onChange={e => setInstrument(e.target.value)}>
              {instruments.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            {user && <button className="btn btn-outline btn-sm" onClick={() => setShowTangForm(!showTangForm)}>
              {showTangForm ? 'ยกเลิก' : '＋ เสนอทางเครื่องอื่น'}</button>}
            {contributors[instrument] && (
              <span style={{fontSize:'0.7rem',color:'var(--jade)'}}>✍️ ทางนี้บันทึกโดย: {contributors[instrument]}</span>
            )}
          </div>

          {showTangForm && (
            <div className="card" style={{borderColor:'rgba(201,168,76,0.3)'}}>
              <div style={{fontSize:'0.9rem',fontWeight:600,marginBottom:'0.8rem'}}>เสนอทางเครื่องดนตรี</div>
              <div className="form-group">
                <label className="form-label">เครื่องดนตรี</label>
                <select className="form-input" value={tangInstrument} onChange={e => setTangInstrument(e.target.value)}>
                  {['ระนาดเอก','ระนาดทุ้ม','ฆ้องวงเล็ก','ปี่ใน','ขลุ่ยเพียงออ','ซอด้วง','ซออู้','ซอสามสาย','จะเข้','ขิม','อื่น ๆ'].map(i =>
                    <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">โน้ต — 1 บรรทัด = 1 วรรค (รูปแบบ: - - - ล | - - ด รม | - ซ - ล | - ท - ซ)</label>
                <textarea className="form-input" rows="8" value={tangText}
                  onChange={e => setTangText(e.target.value)}
                  placeholder={'- - - ล | - - - ร | - - - ทฺ | - - - ม\n- ลฺ - ทฺ | - - ด รม | - ซ ซ ซ | - ล - ซ'}
                  style={{resize:'vertical',fontFamily:'monospace',fontSize:'0.85rem'}} />
                <div style={{fontSize:'0.7rem',color:'var(--muted)',marginTop:'4px'}}>
                  เสียงต่ำใช้จุดล่าง (ทฺ) เสียงสูงใช้วงกลมบน (ซํ) · สะบัดเขียนติดกัน (รม)
                </div>
              </div>
              <button className="btn btn-jade" onClick={submitTang}>✓ ส่ง — รอ Admin อนุมัติ (+10 แต้มเมื่อผ่าน)</button>
              {tangMsg && <div style={{marginTop:'0.6rem',fontSize:'0.8rem',color:'var(--jade)'}}>{tangMsg}</div>}
            </div>
          )}

          <div style={{marginBottom:'0.8rem'}}>
            <ExportBar song={song} instrument={instrument} verses={melody} targetId="notation-export-area" />
          </div>
          <div id="notation-export-area">
            <NotationPlayer verses={melody} lyrics={song.lyrics} />
          </div>

          <div style={{marginTop:'1.4rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.6rem'}}>
              <div style={{fontSize:'0.9rem',fontWeight:600}}>📁 โน้ตต้นฉบับ (PDF)</div>
              {user && <button className="btn btn-outline btn-sm" onClick={() => setShowPdfForm(!showPdfForm)}>
                {showPdfForm ? 'ยกเลิก' : '＋ แนบ PDF ต้นฉบับ'}</button>}
            </div>
            {showPdfForm && (
              <div className="card" style={{borderColor:'rgba(201,168,76,0.3)'}}>
                <div className="form-group">
                  <label className="form-label">ไฟล์ PDF (ไม่เกิน 20MB)</label>
                  <input className="form-input" type="file" accept="application/pdf"
                    onChange={e => setPdfFile(e.target.files[0])} />
                </div>
                <div className="form-group">
                  <label className="form-label">คำอธิบาย (เช่น สำนัก/ที่มา/ปี)</label>
                  <input className="form-input" value={pdfTitle} onChange={e => setPdfTitle(e.target.value)}
                    placeholder="เช่น โน้ตลายมือครูสำนักบ้านบาตร พ.ศ. 2495" />
                </div>
                <button className="btn btn-jade" onClick={uploadPdf}>✓ อัปโหลด — รอ Admin อนุมัติ</button>
                {pdfMsg && <div style={{marginTop:'0.6rem',fontSize:'0.8rem',color:'var(--jade)'}}>{pdfMsg}</div>}
              </div>
            )}
            {pdfs.length === 0
              ? <div style={{fontSize:'0.8rem',color:'var(--muted)'}}>ยังไม่มีไฟล์ต้นฉบับ</div>
              : pdfs.map(pf => {
                const url = supabase.storage.from('song-pdfs').getPublicUrl(pf.storage_path).data.publicUrl;
                return (
                  <a href={url} target="_blank" key={pf.id}>
                    <div className="card" style={{display:'flex',alignItems:'center',gap:'12px',padding:'0.8rem 1rem',cursor:'pointer',marginBottom:'0.6rem'}}>
                      <span style={{fontSize:'1.4rem'}}>📄</span>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:'0.86rem'}}>{pf.title}</div>
                        <div style={{fontSize:'0.7rem',color:'var(--muted)'}}>เปิด / ดาวน์โหลด ↗</div>
                      </div>
                    </div>
                  </a>
                );
              })}
          </div>
        </>
      )}

      {/* ── วิดีโอ ── */}
      {tab === 'videos' && (
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'0.8rem'}}>
            {user && <button className="btn btn-outline btn-sm" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'ยกเลิก' : '+ เพิ่มวิดีโอ'}</button>}
          </div>
          {showForm && (
            <div className="card" style={{borderColor:'rgba(201,168,76,0.3)'}}>
              <div className="form-group">
                <label className="form-label">YouTube URL *</label>
                <input className="form-input" value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..." />
              </div>
              <div className="form-group">
                <label className="form-label">คำอธิบาย (ถ้ามี)</label>
                <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <button className="btn btn-jade" onClick={submitVideo}>ส่งเพื่อรอ Admin อนุมัติ</button>
              {msg && <div style={{marginTop:'0.6rem',fontSize:'0.8rem',color:'var(--jade)'}}>{msg}</div>}
            </div>
          )}
          {videos.length === 0 ? (
            <div className="lock-box">
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
        </>
      )}
      <CommentSection targetType="song" targetId={id} />
    </main>
  );
}
