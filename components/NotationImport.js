'use client';
// components/NotationImport.js — 📥 นำเข้าโน้ตจากไฟล์ / 🔁 แปลงข้ามระบบ (2026-08-25)
//   ไฟล์: PDF · DOCX · Excel/CSV · รูป jpg/png · MusicXML/.mxl · MIDI · .txt  → ตรวจในช่องข้อความ → ใส่ลงกระดาน
//   ระบบโน้ต: อักษรไทย · TH Notation (รหัสแป้น) · โน้ตสากล (ด = C ปริยาย เปลี่ยนได้ · จังหวะตกต้นห้อง/ท้ายห้อง)
//   ส่งออก: MusicXML (เปิดใน MuseScore/Sibelius/Finale) · MIDI · ข้อความไทย · TH Notation · ตารางสากล
//   รูป/สแกน → /api/import-image (Claude vision) — ผลเป็นข้อความให้คนตรวจก่อนเสมอ
//
//   <NotationImport open onClose getVerses={() => verses} onImport={(verses, {mode:'replace'|'append', meta}) => …} base={4} lineHong={8} />
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { TONICS, importText, parseMusicXML, parseMidi, versesToMusicXML, versesToMidi, versesToThaiText, versesToWesternGrid, detectFormat, midiToNoteName } from '../lib/notation-import';
import { readNotationFile, aiReadImages, downloadBlob, ACCEPT, kindOf, imageToBase64 } from '../lib/notation-files';
import { hasSound, hongOf } from '../lib/notation-core';

const SRC_LABEL = { 'pdf-text': 'PDF (ข้อความ)', 'pdf-scan': 'PDF (ภาพสแกน → AI)', docx: 'Word', sheet: 'Excel/CSV', image: 'รูปภาพ → AI', musicxml: 'MusicXML', mxl: 'MusicXML (.mxl)', midi: 'MIDI', text: 'ข้อความ', paste: 'วางข้อความ' };
const FMT_LABEL = { thai: 'อักษรไทย', thn: 'TH Notation (รหัสแป้น)', western: 'โน้ตสากล', unknown: 'ไม่ทราบ' };

export default function NotationImport({ open = true, onClose, getVerses, onImport, base = 4, lineHong = 8, embedded = false, title = '📥 นำเข้าโน้ต / 🔁 แปลงโน้ต' }) {
  const [tab, setTab] = useState('file');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [src, setSrc] = useState(null);         // ผลอ่านไฟล์ {kind, text, images, name, source, fontHint}
  const [raw, setRaw] = useState('');           // ข้อความที่แก้ได้ (ไทย/รหัสแป้น/ตารางสากล)
  const [format, setFormat] = useState(null);   // thai | thn | western
  const [tonic, setTonic] = useState('C');
  const [beat, setBeat] = useState('western');
  const [aiMode, setAiMode] = useState('auto');
  const [hint, setHint] = useState('');
  const [aiNotes, setAiNotes] = useState([]);
  const [pasteText, setPasteText] = useState('');
  const [bpm, setBpm] = useState(80);
  const [expTonic, setExpTonic] = useState('C');
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => { if (!open) { setErr(''); setBusy(''); } }, [open]);

  // อ่านข้อความ → verses (คำนวณใหม่ทุกครั้งที่แก้ข้อความ/ตัวเลือก)
  const parsed = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      const r = importText(raw, { format: format === 'unknown' ? null : format, tonic, beat, base, lineHong });
      return r;
    } catch (e) { return { verses: [], warnings: ['อ่านไม่ได้: ' + e.message], format }; }
  }, [raw, format, tonic, beat, base, lineHong]);
  const sounding = parsed ? parsed.verses.filter(hasSound) : [];
  const hongs = sounding.reduce((s, v) => s + hongOf(v), 0);
  const thaiPreview = parsed ? versesToThaiText(parsed.verses) : '';

  async function handleFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    setErr(''); setAiNotes([]); setSrc(null); setRaw(''); setFormat(null);
    try {
      // หลายรูป = หลายหน้าของโน้ตเดียวกัน · ไฟล์ชนิดอื่นอ่านไฟล์แรก
      const imgs = list.filter(f => kindOf(f) === 'image');
      let res;
      if (imgs.length > 1) {
        setBusy(`ย่อรูป ${imgs.length} รูป…`);
        const images = []; for (const f of imgs) images.push(await imageToBase64(f));
        res = { kind: 'images', images, name: imgs.map(f => f.name).join(', '), source: 'image' };
      } else {
        setBusy('กำลังอ่านไฟล์…');
        res = await readNotationFile(list[0], { onProgress: setBusy });
      }
      await applySource(res);
    } catch (e) { setErr('⚠ ' + (e.message || e)); }
    setBusy('');
  }
  async function applySource(res) {
    setSrc(res);
    if (res.kind === 'text') {
      const fmt = res.fontHint === 'thn' && detectFormat(res.text) !== 'thai' ? 'thn' : detectFormat(res.text);
      setFormat(fmt); setRaw(res.text); if (fmt === 'western') setBeat('western');
      setTab('review');
    } else if (res.kind === 'musicxml') {
      setBusy('อ่าน MusicXML…');
      const p = parseMusicXML(res.text);
      const grid = eventsToGrid(p.events, p.length);
      setFormat('western'); setBeat('western'); setRaw(grid);
      setSrc({ ...res, parts: p.parts });
      setTab('review');
    } else if (res.kind === 'midi') {
      setBusy('อ่าน MIDI…');
      const p = parseMidi(res.buffer);
      if (p.bpm) setBpm(Math.round(p.bpm));
      setFormat('western'); setBeat('western'); setRaw(eventsToGrid(p.events, p.length));
      setSrc({ ...res, tracks: p.tracks, bpm: p.bpm });
      setTab('review');
    } else if (res.kind === 'images') {
      await runAi(res);
    }
  }
  async function runAi(res) {
    setBusy(`ส่ง ${res.images.length} ภาพให้ AI อ่าน… (ราว 10–40 วินาที)`);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('ต้องเข้าสู่ระบบก่อนใช้การอ่านภาพ');
    const j = await aiReadImages(res.images, { mode: aiMode, hint, token: session.access_token });
    setAiNotes(j.notes || []);
    const fmt = j.format || detectFormat(j.text);
    setFormat(fmt === 'thn' ? 'thai' : fmt); setRaw(j.text); if (fmt === 'western') setBeat('western');
    setSrc({ ...res, usage: j.usage, model: j.model });
    setTab('review');
  }
  function usePaste() {
    if (!pasteText.trim()) { setErr('⚠ วางข้อความก่อน'); return; }
    setErr(''); setSrc({ kind: 'text', name: 'ข้อความที่วาง', source: 'paste' });
    const fmt = detectFormat(pasteText); setFormat(fmt); setRaw(pasteText); if (fmt === 'western') setBeat('western');
    setTab('review');
  }
  function doImport(mode) {
    if (!parsed || !sounding.length) { setErr('⚠ ยังไม่มีโน้ตที่อ่านได้'); return; }
    onImport?.(parsed.verses, { mode, meta: { source: src?.source, format, tonic, beat, bpm: src?.bpm ?? null } });
    if (!embedded) onClose?.();
  }

  // ── ส่งออก ──
  const curVerses = () => { const v = getVerses?.() ?? []; return v.length ? v : (parsed?.verses ?? []); };
  const stem = () => 'thma-notation';
  const exp = {
    musicxml: () => downloadBlob(stem() + '.musicxml', versesToMusicXML(curVerses(), { tonic: expTonic, bpm: +bpm || 80, beat: 'western', title: 'โน้ตจากหอจดหมายเหตุดนตรีไทย' }), 'application/vnd.recordare.musicxml+xml'),
    midi: () => downloadBlob(stem() + '.mid', versesToMidi(curVerses(), { tonic: expTonic, bpm: +bpm || 80, beat: 'western' }), 'audio/midi'),
    thai: () => downloadBlob(stem() + '-thai.txt', versesToThaiText(curVerses()), 'text/plain;charset=utf-8'),
    thn: () => downloadBlob(stem() + '-thnotation.txt', versesToThaiText(curVerses(), { keys: true }), 'text/plain;charset=utf-8'),
    grid: () => downloadBlob(stem() + '-western.txt', versesToWesternGrid(curVerses(), { tonic: expTonic }), 'text/plain;charset=utf-8'),
  };
  const expPreview = useMemo(() => { if (tab !== 'export') return ''; try { return versesToWesternGrid(curVerses(), { tonic: expTonic }).split('\n').slice(0, 4).join('\n'); } catch { return ''; } }, [tab, expTonic, raw]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const Tab = ({ id, label }) => <button type="button" className={`btn btn-sm ${tab === id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(id)}>{label}</button>;
  const body = (
    <div className="ni-body">
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <b style={{ fontSize: '0.92rem' }}>{title}</b>
        <span style={{ flex: 1 }} />
        <Tab id="file" label="📂 จากไฟล์" /><Tab id="paste" label="📋 วางข้อความ" />
        {raw && <Tab id="review" label="🔍 ตรวจก่อนใส่" />}
        <Tab id="export" label="⬇ ส่งออก/แปลง" />
        {!embedded && <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>✕</button>}
      </div>
      {busy && <div style={{ fontSize: '0.8rem', color: 'var(--gold)', marginBottom: 6 }}>⏳ {busy}</div>}
      {err && <div style={{ fontSize: '0.8rem', color: 'var(--gold)', marginBottom: 6 }}>{err}</div>}

      {tab === 'file' && (
        <div>
          <div className={`ni-drop${drag ? ' on' : ''}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}>
            <div style={{ fontSize: '1.6rem' }}>📥</div>
            <div style={{ fontWeight: 600 }}>ลากไฟล์มาวาง หรือคลิกเลือก</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: 4, lineHeight: 1.7 }}>
              PDF · Word (.docx) · Excel/CSV · รูปภาพ jpg/png (หลายรูป = หลายหน้า) · MusicXML/.mxl · MIDI · .txt<br />
              อ่านได้ทั้งอักษรไทย ดรมฟซลท · ฟอนต์ TH Notation · โน้ตสากลบรรทัด 5 เส้น
            </div>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: '0.78rem' }}>
            <span style={{ color: 'var(--muted)' }}>เมื่ออ่านจากภาพ/สแกน:</span>
            <label>ชนิดโน้ต <select className="filter-select" value={aiMode} onChange={e => setAiMode(e.target.value)}>
              <option value="auto">ให้ AI ดูเอง</option><option value="thai">โน้ตไทย / TH Notation</option><option value="western">โน้ตสากล 5 เส้น</option></select></label>
            <input className="form-input" placeholder="บอกใบ้ AI (ไม่บังคับ) เช่น เพลงลาวดวงเดือน สองชั้น 8 ห้องต่อบรรทัด" value={hint} onChange={e => setHint(e.target.value)} style={{ flex: 1, minWidth: 220, fontSize: '0.78rem' }} />
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.7 }}>
            ไฟล์ PDF/Word/Excel ที่เป็น "ข้อความ" อ่านได้ทันทีในเครื่องคุณ ไม่ส่งไปไหน · ภาพและ PDF สแกนจะส่งให้ AI ช่วยถอด (ต้องล็อกอิน) แล้วคุณตรวจก่อนใส่ลงกระดานเสมอ
          </div>
        </div>
      )}

      {tab === 'paste' && (
        <div>
          <textarea className="form-input" value={pasteText} onChange={e => setPasteText(e.target.value)} rows={7} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.84rem', lineHeight: 1.7 }}
            placeholder={'วางได้ 3 แบบ:\n  โน้ตไทย      - - - ด | - ร - มํ | - - ซ ล | - - - ทฺ\n  TH Notation  - - - a | - s - e | - - g h | - - - m\n  โน้ตสากล     C4 D4 E4 G4 | A4 G4 E4 D4   (โน้ต+อ็อกเทฟ · "-" ลากยาว · "r" หยุด · C4D4 สะบัด · C4+E4 พร้อมกัน)\nชื่อท่อน: # ท่อน 2 · สองมือ: R: … / L: …'} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>ระบบเดาชนิดให้: <b>{FMT_LABEL[detectFormat(pasteText)]}</b></span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-primary btn-sm" onClick={usePaste}>อ่านข้อความ →</button>
          </div>
        </div>
      )}

      {tab === 'review' && (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.78rem', marginBottom: 6 }}>
            <span>แหล่ง: <b>{src?.name}</b> <span style={{ color: 'var(--muted)' }}>· {SRC_LABEL[src?.source] ?? src?.source}{src?.pages ? ` · ${src.pages} หน้า` : ''}{src?.parts ? ` · ${src.parts.length} part (ใช้ที่มีโน้ตมากสุด)` : ''}{src?.bpm ? ` · ${Math.round(src.bpm)} bpm` : ''}</span></span>
            <label>อ่านเป็น <select className="filter-select" value={format ?? 'thai'} onChange={e => setFormat(e.target.value)}>
              <option value="thai">อักษรไทย</option><option value="thn">TH Notation (รหัสแป้น)</option><option value="western">โน้ตสากล (ตาราง C4 D4)</option></select></label>
            {format === 'western' && <>
              <label>ด = <select className="filter-select" value={tonic} onChange={e => setTonic(e.target.value)}>{TONICS.map(t => <option key={t}>{t}</option>)}</select></label>
              <label>จังหวะตก <select className="filter-select" value={beat} onChange={e => setBeat(e.target.value)} title="โน้ตสากลตกต้นห้อง → ย้ายให้ตกท้ายห้องแบบไทย (เลื่อน 3 ตำแหน่ง)">
                <option value="western">ต้นห้อง (สากล) → ย้ายมาท้ายห้อง</option><option value="thai">ตำแหน่งตรงตามที่อ่าน</option></select></label>
            </>}
          </div>
          {aiNotes.length > 0 && <div style={{ fontSize: '0.74rem', color: 'var(--gold)', marginBottom: 4 }}>🤖 {aiNotes.map(n => n.replace(/^%\s*/, '')).join(' · ')}</div>}
          <textarea className="form-input ni-raw" value={raw} onChange={e => setRaw(e.target.value)} rows={8} spellCheck={false}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.84rem', lineHeight: 1.7 }} title="แก้ข้อความได้เลย ระบบอ่านใหม่ให้ทันที" />
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 6 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: '0.76rem', marginBottom: 3 }}>
                อ่านได้ <b style={{ color: 'var(--gold)' }}>{sounding.length}</b> วรรค · <b style={{ color: 'var(--gold)' }}>{hongs}</b> ห้อง
                {parsed?.format && <span style={{ color: 'var(--muted)' }}> · {FMT_LABEL[parsed.format]}</span>}
                {parsed?.meta?.time && <span style={{ color: 'var(--muted)' }}> · {parsed.meta.time}{parsed.meta.key ? ' key ' + parsed.meta.key : ''}</span>}
              </div>
              <pre className="ni-prev" style={{ margin: 0, maxHeight: 180, overflow: 'auto', fontSize: '0.8rem', lineHeight: 1.7, background: 'var(--navy3)', padding: '6px 8px', borderRadius: 6, whiteSpace: 'pre-wrap' }}>{thaiPreview || '—'}</pre>
            </div>
            {parsed?.warnings?.length > 0 && (
              <div style={{ width: 260, fontSize: '0.72rem', color: 'var(--gold)', lineHeight: 1.6 }}>
                ⚠ {parsed.warnings.slice(0, 6).map((w, i) => <div key={i}>{w}</div>)}{parsed.warnings.length > 6 && <div>… อีก {parsed.warnings.length - 6}</div>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>ใส่แล้วยังแก้ต่อบนกระดานได้ (Ctrl+Z ย้อนได้)</span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-outline btn-sm" disabled={!sounding.length} onClick={() => doImport('append')}>＋ ต่อท้ายกระดาน</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!sounding.length} onClick={() => doImport('replace')}>✓ ใส่ลงกระดาน (แทนที่)</button>
          </div>
        </div>
      )}

      {tab === 'export' && (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.78rem', marginBottom: 8 }}>
            <span style={{ color: 'var(--muted)' }}>แปลงโน้ตบนกระดานเป็น:</span>
            <label>ด = <select className="filter-select" value={expTonic} onChange={e => setExpTonic(e.target.value)}>{TONICS.map(t => <option key={t}>{t}</option>)}</select></label>
            <label>bpm <input className="form-input" type="number" min="30" max="240" value={bpm} onChange={e => setBpm(e.target.value)} style={{ width: 70 }} /></label>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={exp.musicxml} title="เปิดใน MuseScore / Sibelius / Finale / Dorico">🎼 MusicXML</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={exp.midi}>🎹 MIDI</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={exp.thai}>🇹🇭 ข้อความไทย</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={exp.thn}>⌨ TH Notation</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={exp.grid}>🔤 ตารางสากล (C4 D4)</button>
          </div>
          <pre style={{ margin: '8px 0 0', fontSize: '0.78rem', lineHeight: 1.7, background: 'var(--navy3)', padding: '6px 8px', borderRadius: 6, whiteSpace: 'pre-wrap', color: 'var(--muted)' }}>{expPreview || 'กระดานยังว่าง'}</pre>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.7 }}>
            โน้ตสากล: 1 ตำแหน่ง = เขบ็ตหนึ่งชั้น · 1 ห้อง = 2/4 · ตำแหน่งท้ายห้องไทย = จังหวะตกต้นห้องสากล (เลื่อนให้อัตโนมัติ) · คู่สะบัด = เขบ็ตสองชั้น 2 ตัว · มือซ้าย+ขวา = คอร์ด · ตัวโน้ตลากเสียงถึงตัวถัดไป (สูงสุด 4 ตำแหน่ง)
            {!embedded && <> · <Link href="/convert" style={{ color: 'var(--gold2)' }}>หน้าแปลงโน้ตแบบเต็ม ↗</Link></>}
          </div>
        </div>
      )}
      <style>{`
        .ni-drop{border:2px dashed var(--border);border-radius:10px;padding:18px 12px;text-align:center;cursor:pointer;background:var(--navy3);transition:border-color .15s}
        .ni-drop.on,.ni-drop:hover{border-color:var(--gold)}
        .ni-modal{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding:30px 10px;overflow:auto}
        .ni-modal .ni-card{width:min(900px,100%);background:var(--navy2);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
      `}</style>
    </div>
  );
  if (embedded) return <div className="card">{body}</div>;
  return <div className="ni-modal" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}><div className="ni-card">{body}</div></div>;
}

// events (MusicXML/MIDI) → ตารางสากลข้อความ (แก้ได้ในช่องตรวจ) · 8 ห้องต่อบรรทัด
function eventsToGrid(events, length) {
  const n = Math.max(length, ...events.map(e => e.pos + 1), 0);
  const toks = Array.from({ length: n }, () => '-');
  events.forEach(e => {
    if (e.sabat != null) toks[e.pos] = midiToNoteName(e.notes[0]) + midiToNoteName(e.sabat);
    else toks[e.pos] = e.notes.map(m => midiToNoteName(m)).join('+');
  });
  const lines = [];
  for (let i = 0; i < n; i += 32) {
    const hongs = [];
    for (let h = i; h < Math.min(i + 32, n); h += 4) hongs.push(toks.slice(h, h + 4).join(' '));
    lines.push(hongs.join(' | '));
  }
  return lines.join('\n');
}
