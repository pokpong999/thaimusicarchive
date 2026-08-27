'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, extractYouTubeId } from '../../../lib/supabase';
import NotationPlayer from '../../../components/NotationPlayer';
import ExportBar from '../../../components/ExportBar';
import CommentSection from '../../../components/CommentSection';
import { usePermissions } from '../../../components/Gate';
import { EText, EImage } from '../../../components/Editable';
import StatBadge from '../../../components/StatBadge';
import ShareBar from '../../../components/ShareBar';
import SongNathab from '../../../components/SongNathab';
import { fmtDT } from '../../../lib/fmtdate';
import { fetchMelody, listParts } from '../../../lib/songparts';
import SongPartsBar from '../../../components/SongPartsBar';

export default function SongDetailClient() {
  const { can } = usePermissions();
  const { id } = useParams();
  const [song, setSong] = useState(null);
  const [melody, setMelody] = useState([]);
  const [nathabRules, setNathabRules] = useState([]);   // หน้าทับที่เพลงนี้ผูกไว้ (song_nathab)
  const [instruments, setInstruments] = useState(['ทำนองหลัก']);
  const [contributors, setContributors] = useState({});
  const [instOwners, setInstOwners] = useState({});
  const [parts, setParts] = useState([]);      // เพลงย่อย (ถ้าเพลงนี้เป็นเพลงเรื่อง)
  const [melodyWhy, setMelodyWhy] = useState('');   // เหตุผลตอนโน้ตไม่ขึ้น
  const [songOwner, setSongOwner] = useState(null);
  const [instAt, setInstAt] = useState({});   // ทาง → created_at
  const [instrument, setInstrumentState] = useState(() => {
    if (typeof window === 'undefined') return 'ทำนองหลัก';
    return new URLSearchParams(window.location.search).get('inst') || 'ทำนองหลัก';
  });
  const setInstrument = v => {
    setInstrumentState(v);
    try { const u = new URL(window.location.href); if (v === 'ทำนองหลัก') u.searchParams.delete('inst'); else u.searchParams.set('inst', v); window.history.replaceState(null, '', u.toString()); } catch (e) {}
  };
  const [pdfs, setPdfs] = useState([]);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfMsg, setPdfMsg] = useState('');
  const [showPdfForm, setShowPdfForm] = useState(false);
  const [videos, setVideos] = useState([]);
  const [videoNames, setVideoNames] = useState({});
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // แท็บจำไว้ใน #hash (รีเฟรชแล้วกลับมาแท็บเดิม — Pk 2026-08-25) · ทางเครื่องใน ?inst= · ตำแหน่งเลื่อนใน sessionStorage
  // กดชื่อเพลงแล้วต้องเจอ "โน้ตเพลง" เป็นหน้าแรกทันที (Pk 2026-08-26) — ประวัติเพลงย้ายไปแท็บถัดไป
  const TAB_KEYS = ['notation', 'history', 'analysis', 'audio', 'videos'];
  const [tab, setTabState] = useState(() => {
    if (typeof window === 'undefined') return 'notation';
    const h = window.location.hash.replace('#', '');
    return TAB_KEYS.includes(h) ? h : 'notation';
  });
  const setTab = k => { setTabState(k); try { window.history.replaceState(null, '', window.location.pathname + window.location.search + '#' + k); } catch (e) {} };
  const scrollKey = typeof window !== 'undefined' ? 'thma-scroll:' + window.location.pathname : '';
  const restoredRef = useRef(false);
  useEffect(() => {
    // จำตำแหน่งเลื่อนหน้า
    let t = null;
    const onScroll = () => { clearTimeout(t); t = setTimeout(() => { try { sessionStorage.setItem(scrollKey, String(window.scrollY)); } catch (e) {} }, 150); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(t); };
  }, [scrollKey]);
  const [krasuan, setKrasuan] = useState(null);
  const [audios, setAudios] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [audioMeta, setAudioMeta] = useState({ title:'', performer:'', year:'', license:'' });
  const [audioMsg, setAudioMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [luktok, setLuktok] = useState(null);
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
        setIsAdmin(p?.role === 'admin' || p?.role === 'moderator');   // moderator แก้โน้ต/ประวัติได้เท่าแอดมิน
      }
    });
    load();
  }, [id]);

  async function load() {
    const { data: s } = await supabase.from('songs').select('*').eq('id', id).single();
    setSong(s);
    setHistoryDraft(s?.history ?? '');
    setLyricsDraft(s?.lyrics ?? '');
    const { data: au } = await supabase.from('song_audio').select('*')
      .eq('song_id', id).eq('approved', true).order('created_at');
    setAudios(au ?? []);
    // เพลงย่อยของเพลงเรื่องกรองด้วย part_song_id — โน้ตอยู่ที่เพลงเรื่อง ไม่ได้คัดลอกมา (sql/30)
    const isPart = !!s?.parent_song_id;
    setParts(isPart ? [] : await listParts(id));
    const { data: inst } = await supabase.from('song_melody')
      .select('instrument, submitted_by, created_at')
      .eq(isPart ? 'part_song_id' : 'song_id', id).eq('approved', true);
    // วัน-เวลาที่บันทึกโน้ตแต่ละทาง (แถวแรกสุดของทางนั้น)
    const at = {};
    (inst ?? []).forEach(r => { const k = r.instrument ?? 'ทำนองหลัก'; if (r.created_at && (!at[k] || r.created_at < at[k])) at[k] = r.created_at; });
    setInstAt(at);
    const uniq = [...new Set((inst ?? []).map(r => r.instrument ?? 'ทำนองหลัก'))];
    setInstruments(uniq.length ? uniq : ['ทำนองหลัก']);
    // ทางที่จำไว้ใน URL ไม่มีในเพลงนี้ → กลับไปทางแรก
    if (uniq.length && !uniq.includes(instrument)) setInstrument(uniq[0]);
    // เครดิตผู้เพิ่มข้อมูล
    const byInst = {};
    (inst ?? []).forEach(r => { if (r.submitted_by && !byInst[r.instrument]) byInst[r.instrument] = r.submitted_by; });
    // เจ้าของทาง = ทุกวรรคของทางนั้นส่งโดยคนเดียวกัน (ใช้ตัดสินปุ่ม "แก้โน้ต")
    const owners = {};
    (inst ?? []).forEach(r => {
      const k = r.instrument ?? 'ทำนองหลัก';
      if (!(k in owners)) owners[k] = r.submitted_by ?? null;
      else if (owners[k] !== r.submitted_by) owners[k] = false;
    });
    setInstOwners(owners);
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
    // ชื่อคนส่งวิดีโอ — ดึงแยกรอบ (submitted_by ชี้ไป auth.users จะ embed profiles ตรง ๆ ไม่ได้)
    const vids = [...new Set((v ?? []).map(x => x.submitted_by).filter(Boolean))];
    if (vids.length) {
      const { data: vp } = await supabase.from('profiles').select('id, display_name').in('id', vids);
      const m = {}; (vp ?? []).forEach(pr => m[pr.id] = pr.display_name); setVideoNames(m);
    }
    const { data: pf } = await supabase.from('song_files')
      .select('*').eq('song_id', id).eq('approved', true).order('created_at');
    setPdfs(pf ?? []);
  }

  useEffect(() => {
    // fetchMelody รู้เองว่า id นี้เป็นเพลงเรื่องหรือเพลงย่อย และนับเลขวรรคใหม่ให้
    fetchMelody(id, { instrument, approvedOnly: true })
      .then(({ rows, error, ref, unapproved }) => {
        setMelody(rows ?? []);
        // ★ โน้ตไม่ขึ้นต้องบอกสาเหตุ ไม่ใช่โชว์หน้าว่างเปล่าให้เดาเอง (Pk เจอตอนแยกเพลงย่อย)
        setMelodyWhy(
          error ? 'อ่านโน้ตไม่ได้: ' + error.message
                  + (/part_song_id|schema cache|column/i.test(error.message)
                     ? ' — ยังไม่ได้รัน sql/30-31 หรือ Supabase ยังไม่รีเฟรชคอลัมน์ใหม่' : '')
          : ref && !ref.ready ? 'ยังไม่ได้รัน sql/30 — ระบบเพลงย่อยยังไม่พร้อม'
          : unapproved ? 'โน้ตชุดนี้ยังไม่ได้อนุมัติ — แสดงให้ดูไว้ก่อน กดอนุมัติที่หน้าผู้ดูแลเพื่อให้ทุกคนเห็น'
          : (rows ?? []).length === 0 && ref?.isPart
              ? `ยังไม่มีวรรคไหนถูกผูกกับเพลงย่อยนี้ — ลองแยกใหม่จากหน้าผู้ดูแล (เพลงเรื่อง ${ref.parentId})`
          : '');
        // โน้ตโหลดแล้วค่อยเลื่อนกลับตำแหน่งเดิม (ครั้งแรกครั้งเดียว)
        if (!restoredRef.current) {
          restoredRef.current = true;
          try { const y = +sessionStorage.getItem(scrollKey); if (y > 0) setTimeout(() => window.scrollTo(0, y), 80); } catch (e) {}
        }
      });
  }, [id, instrument]);

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
    setPdfMsg('✓ อัปโหลดแล้ว — รอ Admin อนุมัติ (+10 ศักดินาเมื่อผ่าน)');
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

  useEffect(() => {
    if (tab !== 'analysis' || krasuan !== null) return;
    supabase.from('krasuan_catalog').select('section, verse_no, code, pattern')
      .eq('song_id', id).order('verse_no').limit(2000)   // เพลงเรื่องยาวถึง 895 วรรค (Pk 27 ส.ค. 69)
      .then(({ data }) => setKrasuan(data ?? []));
    supabase.from('luktok_catalog').select('section, sentence_no, luktok_id, pair')
      .eq('song_id', id).order('sentence_no').limit(2000)
      .then(({ data }) => setLuktok(data ?? []));
  }, [tab]);

  if (!song) return <main className="container">กำลังโหลด...</main>;

  async function uploadAudio() {
    if (!audioFile) { setAudioMsg('⚠ เลือกไฟล์เสียงก่อน'); return; }
    if (audioFile.size > 25 * 1024 * 1024) { setAudioMsg('⚠ ไฟล์ใหญ่เกิน 25MB'); return; }
    setAudioMsg('⏳ กำลังอัปโหลด...');
    const ext = audioFile.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
    const pathName = `${id}/${Date.now()}.${ext}`;
    const { error: e1 } = await supabase.storage.from('song-audio').upload(pathName, audioFile);
    if (e1) { setAudioMsg('⚠ ' + e1.message); return; }
    const { error: e2 } = await supabase.from('song_audio').insert({
      song_id: id, title: audioMeta.title || null, performer: audioMeta.performer || null,
      year_recorded: audioMeta.year || null, license: audioMeta.license || null,
      storage_path: pathName, submitted_by: user.id,
    });
    setAudioMsg(e2 ? '⚠ ' + e2.message : '✓ ส่งแล้ว รอ Admin ตรวจสอบ (+10 ศักดินาเมื่อผ่าน)');
    setAudioFile(null);
  }

  function copyCitation() {
    const y = new Date().getFullYear() + 543;
    const cite = `ปกป้อง ขำประเสริฐ. (${y}). ${song?.name_th} [โน้ตเพลง]. หอจดหมายเหตุดนตรีไทย. https://thaimusicarchive.com/songs/${id}`;
    navigator.clipboard.writeText(cite);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const TABS_ALL = [
    ['notation', '♪ โน้ตเพลง'],
    ['history', '📜 ประวัติเพลง'],
    ['videos', `🎬 วิดีโอ (${videos.length})`],
    ['analysis', '📊 วิเคราะห์'],
    ['audio', `🔊 เสียง (${audios.length})`],
  ];
  const TABS = TABS_ALL.filter(([k]) =>
    (k !== 'analysis' || can('tab_analysis')) &&
    (k !== 'videos' || can('tab_videos')) &&
    (k !== 'audio' || can('tab_audio')));


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
        <SongPartsBar song={song} parts={parts} />
        {melodyWhy && <div data-melodywhy style={{marginTop:'0.6rem',padding:'0.6rem 0.8rem',borderRadius:'8px',
          background:'rgba(212,122,143,0.10)',border:'1px solid var(--danger)',fontSize:'0.8rem',color:'var(--danger)'}}>
          ⚠ {melodyWhy}</div>}
        {songOwner && <div style={{fontSize:'0.72rem',color:'var(--jade)',marginTop:'6px'}}>
          ✍️ เพิ่มข้อมูลโดย: {songOwner}{song.created_at && <span style={{color:'var(--muted)'}}> · {fmtDT(song.created_at)}</span>}</div>}
        <div style={{marginTop:'0.8rem',display:'flex',gap:'10px',flexWrap:'wrap',alignItems:'center'}}>
          <ShareBar statType="song" statId={id} title={song.name_th + ' — หอจดหมายเหตุดนตรีไทย'} />
          {can('cite') && <button className="btn btn-outline btn-sm" style={{fontSize:'0.7rem'}} onClick={copyCitation}>
            {copied ? '✓ คัดลอกแล้ว' : '📚 คัดลอกการอ้างอิง'}</button>}
        </div>
        <EImage k={`song.cover.${id}`} height={220} style={{margin:'1rem 0 0.4rem'}} />
        <div style={{margin:'0.5rem 0'}}><StatBadge type="song" id={id} /></div>
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
            <EText k="song.history.label" style={{fontWeight:600}}>ประวัติเพลง</EText>
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
          ) : (song.history || song.lyrics) ? (
            <>
              {song.history
                ? <div style={{fontSize:'0.9rem',lineHeight:1.9,whiteSpace:'pre-wrap'}}>{song.history}</div>
                : <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ยังไม่มีประวัติเพลงนี้</div>}
              {song.lyrics && (
                <div style={{marginTop:'1.6rem',paddingTop:'1.2rem',borderTop:'1px solid var(--border)'}}>
                  <div style={{fontWeight:600,color:'var(--gold)',marginBottom:'0.7rem',
                    fontFamily:"'Noto Serif Thai',serif"}}>✒️ บทร้อง</div>
                  <div style={{fontSize:'0.9rem',lineHeight:2.05,whiteSpace:'pre-wrap',
                    fontFamily:"'Noto Serif Thai',serif"}}>{song.lyrics}</div>
                </div>
              )}
            </>
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
            {user && (isAdmin || (instOwners[instrument] && instOwners[instrument] === user.id)) && (
              <Link href={`/songs/${id}/edit?inst=${encodeURIComponent(instrument)}`}>
                <button className="btn btn-primary btn-sm">✎ แก้โน้ตทางนี้</button></Link>)}
            {user && <Link href={`/songs/${id}/edit?inst=${encodeURIComponent(instrument === 'ทำนองหลัก' ? 'ระนาดเอก' : instrument)}&new=1`}>
              <button className="btn btn-outline btn-sm">＋ เสนอทางเครื่องอื่น</button></Link>}
            {contributors[instrument] && (
              <span style={{fontSize:'0.7rem',color:'var(--jade)'}}>✍️ ทางนี้บันทึกโดย: {contributors[instrument]}{instAt[instrument] && <span style={{color:'var(--muted)'}}> · {fmtDT(instAt[instrument])}</span>}</span>
            )}
          </div>

          <div style={{marginBottom:'0.8rem'}}>
            <ExportBar song={song} instrument={instrument} verses={melody} targetId="notation-export-area" />
          </div>
          <SongNathab song={song} verses={melody} onRules={setNathabRules} />
          <div id="notation-export-area">
            <NotationPlayer verses={melody} lyrics={song.lyrics} nathabRules={nathabRules} />
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
                        <div style={{fontSize:'0.7rem',color:'var(--muted)'}}>เปิด / ดาวน์โหลด ↗{pf.created_at && ` · 🕒 ${fmtDT(pf.created_at)}`}</div>
                      </div>
                    </div>
                  </a>
                );
              })}
          </div>
        </>
      )}

      {/* ── วิดีโอ ── */}
      {tab === 'analysis' && (
        <div>
          {krasuan === null ? <div style={{color:'var(--muted)'}}>กำลังโหลด...</div> : (
            <>
              {krasuan.length === 0 && (luktok ?? []).length === 0 && (
                <div className="card" style={{textAlign:'center',color:'var(--muted)'}}>
                  ยังไม่มีข้อมูลวิเคราะห์สำหรับเพลงนี้</div>
              )}
              {krasuan.length > 0 && (
                <div className="card">
                  <div style={{fontWeight:600,marginBottom:'0.7rem'}}>🥁 กระสวนรายวรรค ({krasuan.length} วรรค)</div>
                  <div className="table-wrap" style={{maxHeight:'400px',overflowY:'auto'}}>
                    <table>
                      <thead><tr><th>วรรค</th><th>ท่อน</th><th>รหัส</th><th>กระสวน</th></tr></thead>
                      <tbody>
                        {krasuan.map((k, i) => (
                          <tr key={i}>
                            <td style={{fontFamily:'monospace'}}>{k.verse_no}</td>
                            <td style={{fontSize:'0.75rem',color:'var(--muted)'}}>{k.section}</td>
                            <td style={{fontFamily:'monospace',color:'var(--gold)',fontWeight:700}}>{k.code}</td>
                            <td style={{fontFamily:'monospace',fontSize:'0.78rem',whiteSpace:'nowrap'}}>{k.pattern}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {(luktok ?? []).length > 0 && (
                <div className="card">
                  <div style={{fontWeight:600,marginBottom:'0.7rem'}}>🎯 คู่ลูกตกรายประโยค ({luktok.length} ประโยค)</div>
                  <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                    {luktok.map((l, i) => (
                      <div key={i} title={`${l.section} ประโยค ${l.sentence_no}`}
                        style={{background:'var(--navy3)',border:'1px solid var(--border)',borderRadius:'6px',
                          padding:'4px 10px',fontSize:'0.8rem',fontFamily:'monospace'}}>
                        <span style={{color:'var(--muted)',fontSize:'0.66rem'}}>{l.sentence_no}·</span>
                        <span style={{color:'var(--jade)',fontWeight:700}}> {l.pair}</span>
                        <span style={{color:'var(--muted)',fontSize:'0.66rem'}}> {l.luktok_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'audio' && (
        <div>
          {audios.length === 0 && <div className="card" style={{color:'var(--muted)',textAlign:'center'}}>
            ยังไม่มีบันทึกเสียงของเพลงนี้ — ร่วมเป็นผู้อนุรักษ์ อัปโหลดเสียงบรรเลงด้านล่าง</div>}
          {audios.map(a => {
            const url = supabase.storage.from('song-audio').getPublicUrl(a.storage_path).data.publicUrl;
            return (
              <div key={a.id} className="card" style={{padding:'0.9rem 1.1rem'}}>
                <div style={{fontWeight:600,fontSize:'0.9rem'}}>{a.title ?? song.name_th}</div>
                <div style={{fontSize:'0.74rem',color:'var(--muted)',margin:'3px 0 8px'}}>
                  {[a.performer && `บรรเลงโดย ${a.performer}`, a.year_recorded && `บันทึกปี ${a.year_recorded}`, a.license, a.created_at && `🕒 อัปโหลด ${fmtDT(a.created_at)}`]
                    .filter(Boolean).join(' · ')}
                </div>
                <audio controls preload="none" src={url} style={{width:'100%'}} />
              </div>
            );
          })}
          {user && (
            <div className="card">
              <div style={{fontWeight:600,marginBottom:'0.7rem'}}>🎙 อัปโหลดบันทึกเสียง (MP3/M4A ≤25MB)</div>
              <input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files[0])}
                style={{fontSize:'0.78rem',marginBottom:'0.6rem',color:'var(--muted)'}} />
              <div className="m1col" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.6rem'}}>
                <input className="form-input" placeholder="ชื่อชุด/รายการ" value={audioMeta.title}
                  onChange={e => setAudioMeta({...audioMeta, title: e.target.value})} />
                <input className="form-input" placeholder="ผู้บรรเลง/วง" value={audioMeta.performer}
                  onChange={e => setAudioMeta({...audioMeta, performer: e.target.value})} />
                <input className="form-input" placeholder="ปีที่บันทึก" value={audioMeta.year}
                  onChange={e => setAudioMeta({...audioMeta, year: e.target.value})} />
              </div>
              <select className="form-input" style={{marginTop:'0.6rem',width:'100%'}} value={audioMeta.license}
                onChange={e => setAudioMeta({...audioMeta, license: e.target.value})}>
                <option value="">— สิทธิ์เผยแพร่ (ไม่บังคับ) —</option>
                <option value="บันทึกเอง เผยแพร่ได้">บันทึกเอง เผยแพร่ได้</option>
                <option value="ได้รับอนุญาตจากเจ้าของ">ได้รับอนุญาตจากเจ้าของ</option>
                <option value="เผยแพร่เพื่อการศึกษา">เผยแพร่เพื่อการศึกษาเท่านั้น</option>
                <option value="สาธารณสมบัติ">สาธารณสมบัติ (หมดอายุลิขสิทธิ์)</option>
              </select>
              <div style={{fontSize:'0.68rem',color:'var(--muted)',margin:'0.5rem 0'}}>
                ⚠ อัปโหลดเฉพาะเสียงที่คุณมีสิทธิ์เผยแพร่ (บันทึกเอง หรือได้รับอนุญาตจากเจ้าของ)</div>
              <button className="btn btn-jade btn-sm" onClick={uploadAudio}>✓ ส่งไฟล์เสียง</button>
              {audioMsg && <div style={{marginTop:'0.5rem',fontSize:'0.78rem',color:'var(--jade)'}}>{audioMsg}</div>}
            </div>
          )}
        </div>
      )}

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
                    <div className="video-meta" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      {/* เดิมโชว์ v.channel_name ซึ่งไม่เคยถูกบันทึกลงฐานเลย การ์ดทุกใบจึงขึ้น "▶ " ว่าง (แก้ 27 ส.ค. 69) */}
                      <span>▶ {videoNames[v.submitted_by] ? 'ส่งโดย ' + videoNames[v.submitted_by] : song.name_th}{v.created_at && <span style={{color:'var(--muted)',fontSize:'0.66rem'}}> · 🕒 {fmtDT(v.created_at)}</span>}</span>
                      {user && v.submitted_by === user.id && (
                        <button className="btn btn-danger btn-sm" onClick={async () => {
                          if (!confirm('ลบวิดีโอนี้?')) return;
                          await supabase.from('song_videos').delete().eq('id', v.id);
                          load();
                        }}>🗑 ลบ</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {/* อ่านความคิดเห็นได้ทุกคน · เขียนได้ตามสิทธิ์ can('comments') */}
      <CommentSection targetType="song" targetId={id} canPost={can('comments')} />
    </main>
  );
}
