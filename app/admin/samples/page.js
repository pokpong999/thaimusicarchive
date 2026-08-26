'use client';
// app/admin/samples/page.js — คลังเสียงเครื่องดนตรี + ทะเบียนเครื่อง (ผู้ดูแลเท่านั้น)
//
//   สองส่วน
//   1) 🎵 เครื่องดำเนินทำนอง — ทะเบียนในตาราง instruments (ขิม ระนาด ฆ้อง จะเข้ …)
//      เพิ่มเครื่อง → อัปไฟล์เสียง → เครื่องนั้นโผล่ในตัวเลือก "เสียง" ของกระดานและเครื่องเล่นทันที
//      ไฟล์ตั้งชื่อได้ 2 แบบ: 01.mp3 ไล่จากเสียงต่ำสุด (index) หรือ d_mid.mp3 (note)
//      เสียงที่ยังไม่มีไฟล์ ระบบขยับระดับเสียงจากไฟล์ที่ใกล้ที่สุดให้เอง — อัปไม่ครบก็เล่นได้ทุกเสียง
//   2) 🥁 เครื่องกำกับจังหวะ — โฟลเดอร์ = เครื่อง · ชื่อไฟล์ = พยางค์ (ตะโพน กลองแขก ฉิ่ง …)
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useMe } from '../../../components/Gate';
import { INSTRUMENT_SLUG, TOKEN_SLUG, RECOMMENDED } from '../../../lib/samplebank';
import { loadInstruments, invalidateInstruments, fileChecklist, NOTES_TH, REG_NAME, noteLabel, stepOf } from '../../../lib/instruments';
import { invalidateMelodyBank, stepOfFile } from '../../../lib/melodybank';
import { SYSTEMS, SYSTEM_KEYS } from '../../../lib/notation-systems';
import { detectPitch, resampleBuffer, bufferToWav } from '../../../lib/pitch';
import { loadTunings, invalidateTunings, loadInstrumentNotes, invalidateInstrumentNotes,
         tuningBySlug, tuningTable, hzOf, hzText, octaveOf, BUILTIN_TUNINGS, DEFAULT_TUNING } from '../../../lib/tuning';

const BUCKET = 'instrument-samples';
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;
const THAI_OF_SLUG = Object.fromEntries(Object.entries(INSTRUMENT_SLUG).map(([th, sl]) => [sl, th]));
const THAI_OF_TOKEN = Object.fromEntries(Object.entries(TOKEN_SLUG).map(([th, sl]) => [sl, th]));
const REGS = [['-2', 'ต่ำมาก'], ['-1', 'ต่ำ'], ['0', 'กลาง'], ['1', 'สูง'], ['2', 'สูงมาก']];
const thS = { border: '1px solid var(--border)', padding: '4px 8px', textAlign: 'center', background: 'rgba(60,110,180,0.10)', whiteSpace: 'nowrap' };
const tdS = { border: '1px solid var(--border)', padding: '3px 8px', textAlign: 'center', whiteSpace: 'nowrap' };
// คอมโพเนนต์ย่อยอยู่นอกหน้าหลัก — ถ้านิยามไว้ข้างในทุกครั้งที่ setMsg จะถูกถอด/ประกอบใหม่
// แล้วสถานะภายใน (ตารางที่วัดไว้) หายหมด
const AdminCtx = createContext(null);
const blankInst = () => ({ slug: '', name_th: '', kind: 'melody', naming: 'index', low_note: 'ด', low_reg: 0, note_count: 21, transpose: 0, system: 'melody1', tuning: '', sort: 100, enabled: true, note: '' });

export default function SamplesAdmin() {
  const me = useMe();
  const [files, setFiles] = useState({});      // slug → [{name, metadata}]
  const [percFolders, setPercFolders] = useState([]);
  const [insts, setInsts] = useState([]);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);      // ทะเบียนที่กำลังแก้ {..inst}
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const [tunes, setTunes] = useState(BUILTIN_TUNINGS);

  const load = useCallback(async () => {
    const list = await loadInstruments({ force: true });
    setInsts(list);
    const { data: top, error } = await supabase.storage.from(BUCKET).list('', { limit: 300 });
    if (error) { setMsg('⚠ อ่านคลังไม่ได้: ' + error.message); return; }
    const slugs = (top ?? []).filter(x => !x.metadata).map(x => x.name);
    const percKnown = Object.values(INSTRUMENT_SLUG);
    const melodySlugs = new Set(list.map(i => i.slug));
    const all = [...new Set([...percKnown, ...slugs, ...list.map(i => i.slug)])];
    const map = {};
    await Promise.all(all.map(async slug => {
      const { data } = await supabase.storage.from(BUCKET).list(slug, { limit: 300 });
      map[slug] = (data ?? []).filter(f => AUDIO_EXT.test(f.name));
    }));
    setFiles(map);
    setPercFolders(all.filter(s => !melodySlugs.has(s)));
  }, []);
  useEffect(() => { if (me.isAdmin) load(); }, [me.isAdmin, load]);
  const loadTunes = useCallback(async () => { invalidateTunings(); setTunes(await loadTunings({ force: true })); }, []);
  useEffect(() => { if (me.isAdmin) loadTunes(); }, [me.isAdmin, loadTunes]);

  async function saveTune(f, isNew, done) {
    if (!f.slug || !f.name_th) { setMsg('⚠ ต้องมีรหัสและชื่อชุด'); return; }
    setBusy(true);
    const row = { slug: f.slug, name_th: f.name_th, ensemble: f.ensemble || null,
      ref_note: f.ref_note, ref_reg: +f.ref_reg || 0, ref_hz: +f.ref_hz || 377.8,
      edo: +f.edo || 7, mid_octave: Number.isFinite(+f.mid_octave) ? +f.mid_octave : 5, sort: +f.sort || 100,
      enabled: f.enabled !== false, is_default: !!f.is_default, note: f.note || null };
    const { error } = isNew
      ? await supabase.from('tunings').insert(row)
      : await supabase.from('tunings').update(row).eq('slug', f.slug);
    setBusy(false);
    if (error) { setMsg('⚠ ' + error.message); return; }
    setMsg('✓ บันทึกชุดความถี่แล้ว');
    setTimeout(() => setMsg(''), 4000);
    if (done) done();
  }
  async function delTune(slug, done) {
    if (!confirm(`ลบชุดความถี่ ${slug} ?`)) return;
    setBusy(true);
    const { error } = await supabase.from('tunings').delete().eq('slug', slug);
    setBusy(false);
    if (error) { setMsg('⚠ ' + error.message); return; }
    setMsg('✓ ลบแล้ว'); if (done) done();
  }

  async function upload(slug, fileList) {
    const picked = Array.from(fileList ?? []);
    if (!picked.length) return;
    setBusy(true);
    for (const f of picked) {
      const ext = (f.name.split('.').pop() || 'mp3').toLowerCase();
      const base = f.name.replace(AUDIO_EXT, '').trim().toLowerCase().replace(/[^a-z0-9_ก-๙ํฺ-]/g, '');
      if (!base) { setMsg('⚠ ชื่อไฟล์ใช้ไม่ได้: ' + f.name); continue; }
      setMsg(`⏳ กำลังอัป ${base}.${ext} ...`);
      const { error } = await supabase.storage.from(BUCKET)
        .upload(`${slug}/${base}.${ext}`, f, { upsert: true, contentType: f.type || 'audio/mpeg' });
      if (error) { setMsg('⚠ ' + f.name + ': ' + error.message); setBusy(false); return; }
    }
    invalidateMelodyBank(slug);
    await load(); setBusy(false); setMsg('✓ อัปโหลดแล้ว — เว็บใช้เสียงใหม่ทันที');
    setTimeout(() => setMsg(''), 4000);
  }
  async function removeFile(slug, name) {
    if (!confirm(`ลบ ${slug}/${name} ?`)) return;
    setBusy(true);
    const { error } = await supabase.storage.from(BUCKET).remove([`${slug}/${name}`]);
    setBusy(false);
    if (error) { setMsg('⚠ ลบไม่สำเร็จ: ' + error.message); return; }
    invalidateMelodyBank(slug);
    await load();
  }
  // ── จูนไฟล์เสียงที่อัดไว้เดิม ────────────────────────────────
  //   ไม่แตะไฟล์ต้นฉบับ — วัดความถี่จริงเก็บไว้ แล้วให้ระบบปรับตอนเล่น
  const actxRef = { current: null };
  function actx() {
    if (!actxRef.current) actxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (actxRef.current.state === 'suspended') actxRef.current.resume();
    return actxRef.current;
  }
  const bufCache = {};
  async function fetchBuffer(slug, name) {
    const key = slug + '/' + name;
    if (bufCache[key]) return bufCache[key];
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    const res = await fetch(data.publicUrl);
    if (!res.ok) throw new Error('โหลดไฟล์ไม่ได้');
    bufCache[key] = await actx().decodeAudioData(await res.arrayBuffer());
    return bufCache[key];
  }
  // เล่นไฟล์ · rate = อัตราที่จูนแล้ว (1 = เสียงเดิม)
  async function playBuf(slug, name, rate = 1) {
    const ctx = actx(), buf = await fetchBuffer(slug, name);
    const n = ctx.createBufferSource(); n.buffer = buf; n.playbackRate.value = rate;
    n.connect(ctx.destination); n.start();
  }
  function preview(slug, name) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${slug}/${name}`);
    new Audio(data.publicUrl).play().catch(() => setMsg('⚠ เล่นไม่ได้ — บัคเก็ตอาจยังไม่เป็นสาธารณะ'));
  }
  async function saveInst(row, isNew) {
    if (!row.slug || !row.name_th) { setMsg('⚠ ใส่ชื่อเครื่องและชื่อโฟลเดอร์ให้ครบ'); return; }
    setBusy(true);
    const payload = { ...row, low_reg: +row.low_reg, note_count: +row.note_count, transpose: +row.transpose, sort: +row.sort, tuning: row.tuning || null };
    delete payload.created_at; delete payload.updated_at;
    const { error } = isNew
      ? await supabase.from('instruments').insert(payload)
      : await supabase.from('instruments').update(payload).eq('slug', row.slug);
    setBusy(false);
    if (error) { setMsg('⚠ บันทึกไม่สำเร็จ: ' + (error.message.includes('does not exist') ? 'ยังไม่ได้รัน sql/15_instruments.sql' : error.message)); return; }
    invalidateInstruments(); invalidateMelodyBank(row.slug);
    setEdit(null); setAdding(false); setMsg('✓ บันทึกทะเบียนแล้ว'); await load();
    setTimeout(() => setMsg(''), 4000);
  }
  async function delInst(slug) {
    if (!confirm(`เอา ${slug} ออกจากทะเบียน? (ไฟล์เสียงยังอยู่ในคลัง)`)) return;
    const { error } = await supabase.from('instruments').delete().eq('slug', slug);
    if (error) { setMsg('⚠ ' + error.message); return; }
    invalidateInstruments(); await load();
  }

  if (me.loading) return <main className="container" style={{ paddingTop: '3rem', color: 'var(--muted)' }}>กำลังโหลด...</main>;
  if (!me.isAdmin) return (
    <main className="container" style={{ maxWidth: '520px', textAlign: 'center', paddingTop: '4rem' }}>
      <div style={{ fontSize: '2rem' }}>🔒</div>
      <div style={{ margin: '0.8rem 0' }}>หน้านี้สำหรับผู้ดูแลเท่านั้น</div>
      <Link href="/"><button className="btn btn-outline btn-sm">← หน้าแรก</button></Link>
    </main>
  );

  /* ───────── 🎚 ระบบเสียง (ชุดความถี่) ───────── */
  const blankTune = () => ({ slug: '', name_th: '', ensemble: '', ref_note: 'ล', ref_reg: 0, ref_hz: 377.8,
                             edo: 7, mid_octave: 5, sort: 100, enabled: true, is_default: false, note: '' });

  const ctx = { tunes, busy, setBusy, setMsg, loadTunes, saveTune, delTune, saveInst, delInst,
                setEdit, setAdding, actx, fetchBuffer, playBuf, edit, adding };
  return (
    <AdminCtx.Provider value={ctx}>
    <main className="container" style={{ maxWidth: '900px' }}>
      <div className="section-title" style={{ fontSize: '1.2rem' }}>🎼 คลังเสียงเครื่องดนตรี</div>
      <div className="section-subtitle">
        เพิ่มเครื่อง → อัปไฟล์เสียง → เลือกใช้ในกระดานโน้ตและเครื่องเล่นได้ทันที (ไม่ต้องแก้โค้ด)
      </div>
      {msg && <div style={{ margin: '0.7rem 0', fontSize: '0.82rem', color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)' }}>{msg}</div>}

      <div className="card" style={{ fontSize: '0.8rem', lineHeight: 1.9 }}>
        <b>เสียงไม่ครบก็ใช้ได้</b> — เสียงไหนยังไม่มีไฟล์ ระบบจะขยับระดับเสียงจากไฟล์ที่ใกล้ที่สุดให้อัตโนมัติ
        (บันไดเสียงไทย 7 เสียงเท่ากัน) ยิ่งอัปครบยิ่งเหมือนเครื่องจริง · ไฟล์ที่รับ: mp3 wav ogg m4a
      </div>

      <TuningSection />

      <div className="section-title" style={{ fontSize: '1rem', marginTop: '1.2rem' }}>🎵 เครื่องดำเนินทำนอง</div>
      {!insts.length && <div className="card" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
        ยังไม่มีทะเบียนเครื่อง — ถ้าเพิ่งติดตั้ง ให้รัน <span style={{ fontFamily: 'monospace' }}>sql/15_instruments.sql</span> ใน Supabase ก่อน
      </div>}
      {insts.filter(i => (i.kind || 'melody') === 'melody').map(inst => {
        const list = files[inst.slug] ?? [];
        const mapped = list.map(f => stepOfFile(inst, f.name.replace(AUDIO_EXT, ''))).filter(x => x != null);
        const want = inst.note_count || 0;
        const chk = fileChecklist(inst);
        const haveSteps = new Set(mapped);
        return (
          <div key={inst.slug} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}
              onClick={() => setOpen(open === inst.slug ? null : inst.slug)}>
              <div>
                <b style={{ fontSize: '0.95rem' }}>{inst.name_th}</b>
                <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontFamily: 'monospace', marginLeft: 8 }}>{inst.slug}/</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.7rem', marginLeft: 8 }}>{SYSTEMS[inst.system]?.short ?? inst.system}</span>
                {inst.enabled === false && <span className="badge" style={{ marginLeft: 6 }}>ปิดอยู่</span>}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.76rem' }}>
                <span style={{ color: mapped.length ? 'var(--jade)' : 'var(--muted)' }}>{mapped.length}/{want} เสียง</span>
                {mapped.length > 0 && mapped.length < want && <span style={{ color: 'var(--gold)' }}>ที่ขาดขยับจากตัวใกล้สุด</span>}
                <span style={{ color: 'var(--muted)' }}>{open === inst.slug ? '▾' : '▸'}</span>
              </div>
            </div>
            {open === inst.slug && (
              <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
                <div style={{ fontSize: '0.74rem', lineHeight: 2, marginBottom: '0.6rem' }}>
                  <span style={{ color: 'var(--muted)' }}>ไฟล์ที่ควรมี ({inst.naming === 'note' ? 'ชื่อโน้ต' : 'เลขลำดับ'}): </span>
                  {chk.map(c => (
                    <span key={c.index} style={{ marginRight: 9, color: haveSteps.has(c.step) ? 'var(--jade)' : 'var(--muted)' }}>
                      {haveSteps.has(c.step) ? '✓' : '○'} <span style={{ fontFamily: 'monospace' }}>{c.name}</span>={c.note}
                    </span>
                  ))}
                </div>
                {list.map(f => {
                  const st = stepOfFile(inst, f.name.replace(AUDIO_EXT, ''));
                  return (
                    <div key={f.name} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(42,63,92,0.3)', fontSize: '0.8rem' }}>
                      <span style={{ flex: 1, fontFamily: 'monospace' }}>{f.name}</span>
                      <span style={{ color: st == null ? 'var(--gold)' : 'var(--jade)', fontSize: '0.75rem' }}>
                        {st == null ? '⚠ อ่านชื่อไม่ออก' : '= ' + noteLabel(NOTES_TH[((st % 7) + 7) % 7], Math.floor(st / 7))}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{Math.round((f.metadata?.size ?? 0) / 1024)} KB</span>
                      <button className="btn btn-outline btn-sm" onClick={() => preview(inst.slug, f.name)}>▶</button>
                      <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => removeFile(inst.slug, f.name)}>🗑</button>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 8, marginTop: '0.8rem', flexWrap: 'wrap' }}>
                  <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                    ＋ อัปไฟล์เสียงเข้า {inst.slug}/
                    <input type="file" accept="audio/*" multiple hidden disabled={busy} onChange={e => { upload(inst.slug, e.target.files); e.target.value = ''; }} />
                  </label>
                  <button className="btn btn-outline btn-sm" onClick={() => setEdit(edit?.slug === inst.slug ? null : { ...inst })}>⚙ แก้ทะเบียน</button>
                </div>
                {edit?.slug === inst.slug && <InstForm row={edit} isNew={false} />}
                <NoteTable inst={inst} files={list} />
              </div>
            )}
          </div>
        );
      })}

      <div className="card">
        {!adding
          ? <button className="btn btn-primary btn-sm" onClick={() => { setAdding(true); setEdit(null); }}>＋ เพิ่มเครื่องดนตรีใหม่</button>
          : <InstForm row={blankInst()} isNew />}
      </div>

      <div className="section-title" style={{ fontSize: '1rem', marginTop: '1.4rem' }}>🥁 เครื่องกำกับจังหวะ (ชื่อไฟล์ = พยางค์)</div>
      {percFolders.map(slug => {
        const list = files[slug] ?? [];
        const have = list.map(f => f.name.replace(AUDIO_EXT, '').toLowerCase());
        const want = RECOMMENDED[slug] ?? [];
        const missing = want.filter(t => !have.includes(t));
        return (
          <div key={slug} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}
              onClick={() => setOpen(open === slug ? null : slug)}>
              <div>
                <b style={{ fontSize: '0.95rem' }}>{THAI_OF_SLUG[slug] ?? slug}</b>
                <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontFamily: 'monospace', marginLeft: 8 }}>{slug}/</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.76rem' }}>
                <span style={{ color: list.length ? 'var(--jade)' : 'var(--muted)' }}>{list.length} ไฟล์</span>
                {want.length > 0 && <span style={{ color: missing.length ? 'var(--gold)' : 'var(--jade)' }}>{missing.length ? `ขาด ${missing.length}` : '✓ ครบชุดแนะนำ'}</span>}
                <span style={{ color: 'var(--muted)' }}>{open === slug ? '▾' : '▸'}</span>
              </div>
            </div>
            {open === slug && (
              <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
                {want.length > 0 && (
                  <div style={{ fontSize: '0.76rem', marginBottom: '0.7rem', lineHeight: 1.9 }}>
                    <span style={{ color: 'var(--muted)' }}>ชุดแนะนำ: </span>
                    {want.map(t => (
                      <span key={t} style={{ marginRight: 8, color: have.includes(t) ? 'var(--jade)' : 'var(--gold)' }}>
                        {have.includes(t) ? '✓' : '○'} {t}<span style={{ color: 'var(--muted)', fontSize: '0.9em' }}> ({THAI_OF_TOKEN[t] ?? t})</span>
                      </span>
                    ))}
                  </div>
                )}
                {list.map(f => (
                  <div key={f.name} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(42,63,92,0.3)', fontSize: '0.8rem' }}>
                    <span style={{ flex: 1, fontFamily: 'monospace' }}>{f.name}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{Math.round((f.metadata?.size ?? 0) / 1024)} KB</span>
                    <button className="btn btn-outline btn-sm" onClick={() => preview(slug, f.name)}>▶ ฟัง</button>
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => removeFile(slug, f.name)}>🗑</button>
                  </div>
                ))}
                <label className="btn btn-primary btn-sm" style={{ marginTop: '0.8rem', cursor: 'pointer', display: 'inline-block' }}>
                  ＋ อัปไฟล์เสียงเข้า {slug}/
                  <input type="file" accept="audio/*" multiple hidden disabled={busy} onChange={e => { upload(slug, e.target.files); e.target.value = ''; }} />
                </label>
              </div>
            )}
          </div>
        );
      })}
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.5rem' }}>เพิ่มโฟลเดอร์เครื่องกำกับจังหวะ</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="form-input" style={{ width: 220 }} value={newFolder}
            onChange={e => setNewFolder(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="ชื่อโฟลเดอร์ (อังกฤษ)" />
          <button className="btn btn-outline btn-sm" disabled={!newFolder}
            onClick={() => { if (!percFolders.includes(newFolder)) setPercFolders([...percFolders, newFolder]); setOpen(newFolder); setNewFolder(''); }}>เพิ่มในรายการ</button>
        </div>
      </div>

      <Link href="/admin"><button className="btn btn-outline btn-sm">← กลับหน้าผู้ดูแล</button></Link>
    </main>
    </AdminCtx.Provider>
  );
}

function TuningSection() {
  const C = useContext(AdminCtx);
  const { tunes, loadTunes } = C;
  const [openT, setOpenT] = useState(null);
  const [editT, setEditT] = useState(null);
  const [addT, setAddT] = useState(false);
  return (
    <>
      <div className="section-title" style={{ fontSize: '1rem', marginTop: '1.2rem' }}>🎚 ระบบเสียง (ความถี่จริงของโน้ต)</div>
      <div className="card" style={{ fontSize: '0.78rem', lineHeight: 1.9, color: 'var(--muted)' }}>
        ชุดความถี่บอกว่า <b style={{ color: 'var(--ink)' }}>ด ร ม ฟ ซ ล ท</b> ในแต่ละช่วงเสียง มีความถี่กี่เฮิรตซ์ —
        ทั้งเสียงสังเคราะห์และเสียงเครื่องจริงจะถูกปรับให้ตรงชุดที่เลือก<br />
        ค่าตั้งต้นคือ <b style={{ color: 'var(--ink)' }}>ตารางความถี่เสียงดนตรีไทย กรมศิลปากร</b> (เครื่องสาย/มโหรี และ ปี่พาทย์)
        · ช่วงเสียง 5 ในตาราง = ช่วงเสียงกลางของเว็บ
      </div>
      {tunes.map(t => {
        const rows = tuningTable(t, Math.max(0, (t.mid_octave ?? 5) - 3), (t.mid_octave ?? 5) + 3);
        return (
          <div key={t.slug} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}
              onClick={() => setOpenT(openT === t.slug ? null : t.slug)}>
              <div>
                <b style={{ fontSize: '0.92rem' }}>{t.name_th}</b>
                <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontFamily: 'monospace', marginLeft: 8 }}>{t.slug}</span>
                {t.is_default && <span className="badge" style={{ marginLeft: 6 }}>ชุดปริยาย</span>}
                {t.enabled === false && <span className="badge" style={{ marginLeft: 6 }}>ปิดอยู่</span>}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                {t.ref_note}{(t.ref_reg ?? 0) === 0 ? ' กลาง' : (t.ref_reg > 0 ? ' สูง' : ' ต่ำ')} = {hzText(+t.ref_hz)} Hz
                <span style={{ marginLeft: 10 }}>{openT === t.slug ? '▾' : '▸'}</span>
              </div>
            </div>
            {openT === t.slug && (
              <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: '0.74rem', minWidth: 520 }}>
                    <thead><tr>
                      <th style={thS}>ช่วงเสียง</th>
                      {NOTES_TH.map(n => <th key={n} style={thS}>{n}</th>)}
                    </tr></thead>
                    <tbody>{rows.map(r => (
                      <tr key={r.octave} style={r.reg === 0 ? { background: 'rgba(60,110,180,0.16)' } : null}>
                        <td style={{ ...tdS, fontWeight: 600 }}>{r.octave}{r.reg === 0 ? ' (กลาง)' : ''}</td>
                        {r.cells.map(c => <td key={c.ch} style={tdS}>{hzText(c.hz)}</td>)}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {t.note && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 8 }}>{t.note}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditT(editT?.slug === t.slug ? null : { ...t })}>⚙ แก้ชุดนี้</button>
                </div>
                {editT?.slug === t.slug && <TuneForm row={editT} isNew={false} done={() => { setEditT(null); loadTunes(); }} />}
              </div>
            )}
          </div>
        );
      })}
      <div className="card">
        {!addT
          ? <button className="btn btn-primary btn-sm" onClick={() => { setAddT(true); setEditT(null); }}>＋ เพิ่มชุดความถี่ใหม่</button>
          : <TuneForm row={blankTune()} isNew done={() => { setAddT(false); loadTunes(); }} />}
      </div>
    </>
  );
}

function TuneForm({ row, isNew, done }) {
  const C = useContext(AdminCtx);
  const { busy, saveTune, delTune } = C;
  const [f, setF] = useState(row);
  const set = p => setF(x => ({ ...x, ...p }));
  const preview = useMemo(() => NOTES_TH.map(ch => ({ ch, hz: hzOf(f, ch, 0) })), [f]);
  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.7rem', paddingTop: '0.7rem' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem' }}>
        <label>ชื่อชุด <input className="form-input" style={{ width: 220 }} value={f.name_th} onChange={e => set({ name_th: e.target.value })} placeholder="เช่น วงบ้านครูX" /></label>
        <label>รหัส <input className="form-input" style={{ width: 140, fontFamily: 'monospace' }} value={f.slug} disabled={!isNew}
          onChange={e => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} placeholder="my_tuning" /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem', marginTop: 6 }}>
        <label>เสียงอ้างอิง <select className="filter-select" value={f.ref_note} onChange={e => set({ ref_note: e.target.value })}>
          {NOTES_TH.map(n => <option key={n}>{n}</option>)}</select></label>
        <select className="filter-select" value={String(f.ref_reg)} onChange={e => set({ ref_reg: +e.target.value })}>
          {REGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <label>= <input type="number" step="0.1" className="form-input" style={{ width: 90 }} value={f.ref_hz} onChange={e => set({ ref_hz: e.target.value })} /> Hz</label>
        <label title="แบ่งคู่แปดเท่ากันกี่เสียง — ดนตรีไทย = 7">แบ่งคู่แปด <input type="number" className="form-input" style={{ width: 60 }} min={2} max={53} value={f.edo} onChange={e => set({ edo: e.target.value })} /> เสียง</label>
        <label title="ช่วงเสียงเลขอะไรในตาราง ถือเป็นเสียงกลางของเว็บ">ช่วงเสียงกลาง <input type="number" className="form-input" style={{ width: 55 }} min={0} max={10} value={f.mid_octave} onChange={e => set({ mid_octave: e.target.value })} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem', marginTop: 6 }}>
        <label title="ให้ปุ่มเดิมของกระดาน (เครื่องสาย / ปี่พาทย์) เลือกชุดนี้">กลุ่มวง <select className="filter-select" value={f.ensemble ?? ''} onChange={e => set({ ensemble: e.target.value })}>
          <option value="">— ไม่ผูก —</option><option value="sai">เครื่องสาย / มโหรี</option><option value="piphat">ปี่พาทย์</option></select></label>
        <label>ลำดับ <input type="number" className="form-input" style={{ width: 60 }} value={f.sort} onChange={e => set({ sort: e.target.value })} /></label>
        <label><input type="checkbox" checked={f.enabled !== false} onChange={e => set({ enabled: e.target.checked })} /> เปิดใช้</label>
        <label><input type="checkbox" checked={!!f.is_default} onChange={e => set({ is_default: e.target.checked })} /> ใช้เป็นชุดปริยาย</label>
      </div>
      <input className="form-input" style={{ width: '100%', marginTop: 6, fontSize: '0.78rem' }} placeholder="ที่มา / หมายเหตุ" value={f.note ?? ''} onChange={e => set({ note: e.target.value })} />
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 8, lineHeight: 1.9 }}>
        ช่วงเสียงกลางจะได้: {preview.map(x => `${x.ch} ${hzText(x.hz)}`).join(' · ')} Hz
        {f.table_hz && <div style={{ color: 'var(--gold)' }}>⚠ ชุดนี้มีตารางความถี่กำหนดเองอยู่ — ค่าที่กรอกด้านบนใช้เฉพาะเสียงที่ตารางไม่ได้ระบุ</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveTune(f, isNew, done)}>💾 บันทึกชุดความถี่</button>
        <button className="btn btn-outline btn-sm" onClick={done}>ยกเลิก</button>
        {!isNew && !f.is_default && <button className="btn btn-danger btn-sm" onClick={() => delTune(f.slug, done)}>🗑 ลบชุดนี้</button>}
      </div>
    </div>
  );
}

/* ───────── ตารางเสียงรายตำแหน่งของเครื่องหนึ่ง ───────── */
function NoteTable({ inst, files: fl }) {
  const C = useContext(AdminCtx);
  const { tunes, busy, setBusy, setMsg, actx, fetchBuffer, playBuf } = C;
  const [rows, setRows] = useState(null);
  const [openN, setOpenN] = useState(false);
  const [meta, setMeta] = useState({});     // idx → ผลการวัด {q, cents, frames, fn}
  const tuneOf = useMemo(() => tuningBySlug(tunes, inst.tuning || (tunes.find(t => t.is_default) || tunes[0])?.slug), [inst.tuning]);
  useEffect(() => { if (openN) loadInstrumentNotes(inst.slug, { force: true }).then(setRows).catch(() => setRows([])); }, [openN, inst.slug]);
  const set = (idx, p) => setRows(rs => rs.map(r => r.idx === idx ? { ...r, ...p } : r));
  const names = (fl ?? []).map(f => f.name);

  async function fill() {
    // เติมตำแหน่ง 1..note_count ตามโน้ตต่ำสุดของเครื่อง (ไม่ทับแถวที่มีอยู่)
    const chk = fileChecklist(inst);
    const have = new Set((rows ?? []).map(r => r.idx));
    const add = chk.filter(c => !have.has(c.index)).map(c => ({
      instrument: inst.slug, idx: c.index,
      note: NOTES_TH[((c.step % 7) + 7) % 7], reg: Math.floor(c.step / 7), hz: null, file: null,
    }));
    if (!add.length) { setMsg('ตารางครบแล้ว'); return; }
    setBusy(true);
    const { error } = await supabase.from('instrument_notes').insert(add);
    setBusy(false);
    if (error) { setMsg('⚠ ' + error.message); return; }
    invalidateInstrumentNotes(inst.slug);
    setRows(await loadInstrumentNotes(inst.slug, { force: true }));
    setMsg(`✓ เติม ${add.length} ตำแหน่ง`);
  }
  // ชื่อไฟล์ของแถวนี้ (กรอกเองได้ · ว่าง = เดาตามวิธีตั้งชื่อของเครื่อง)
  function fileOf(r) {
    if (r.file) { const hit = names.find(n => n.replace(AUDIO_EXT, '') === r.file || n === r.file); return hit || null; }
    const guess = inst.naming === 'note' ? null : String(r.idx).padStart(2, '0');
    if (guess) { const hit = names.find(n => n.replace(AUDIO_EXT, '') === guess || n.replace(AUDIO_EXT, '') === String(r.idx)); if (hit) return hit; }
    // เดาจากชื่อโน้ตในไฟล์ (แบบ d_mid.mp3) ผ่านตัวอ่านชื่อไฟล์ของคลังเสียง
    const st = stepOf(r.note, +r.reg || 0);
    return names.find(n => stepOfFile(inst, n.replace(AUDIO_EXT, '')) === st) || null;
  }

  // วัดความถี่จริงของไฟล์หนึ่งไฟล์
  async function measureOne(r, quiet) {
    const fn = fileOf(r);
    if (!fn) { if (!quiet) setMsg(`⚠ ตำแหน่ง ${r.idx}: ยังไม่มีไฟล์เสียง`); return null; }
    const nominal = hzOf(tuneOf, r.note, +r.reg || 0);
    try {
      const buf = await fetchBuffer(inst.slug, fn);
      const got = detectPitch(buf, { expectHz: nominal, window: 5 });
      if (!got) { if (!quiet) setMsg(`⚠ ${fn}: วัดไม่ได้ (เสียงเบาหรือไม่มีระดับเสียงชัด)`); return null; }
      set(r.idx, { hz: +got.hz.toFixed(2), file: r.file || fn.replace(AUDIO_EXT, '') });
      setMeta(m => ({ ...m, [r.idx]: { q: got.quality, cents: got.cents, frames: got.frames, fn } }));
      return got;
    } catch (e) { if (!quiet) setMsg('⚠ ' + fn + ': ' + e.message); return null; }
  }

  async function measureAll() {
    setBusy(true);
    let ok = 0, miss = 0, warn = 0;
    for (const r of rows) {
      setMsg(`🎧 กำลังวัดตำแหน่ง ${r.idx}/${rows.length} …`);
      const got = await measureOne(r, true);
      if (!got) { miss++; continue; }
      ok++;
      if (got.quality < 0.6 || Math.abs(got.cents ?? 0) > 50) warn++;
    }
    setBusy(false);
    setMsg(`✓ วัดได้ ${ok} ตำแหน่ง${miss ? ` · ไม่มีไฟล์/วัดไม่ได้ ${miss}` : ''}${warn ? ` · ควรตรวจซ้ำ ${warn}` : ''} — กด 💾 บันทึกเพื่อใช้จริง`);
  }

  // ดาวน์โหลดไฟล์ที่จูนแล้วเก็บไว้ (ไฟล์ต้นฉบับบนเซิร์ฟเวอร์ไม่ถูกแตะ)
  async function exportTuned() {
    setBusy(true);
    let n = 0;
    for (const r of rows) {
      const fn = fileOf(r); if (!fn) continue;
      const target = hzOf(tuneOf, r.note, +r.reg || 0);
      const srcHz = +r.hz > 0 ? +r.hz : target;
      try {
        const buf = await fetchBuffer(inst.slug, fn);
        const out = resampleBuffer(actx(), buf, target / srcHz);
        const url = URL.createObjectURL(bufferToWav(out));
        const a = document.createElement('a');
        a.href = url; a.download = `${inst.slug}-${String(r.idx).padStart(2, '0')}-${r.note}${(+r.reg || 0) > 0 ? 'สูง' : (+r.reg || 0) < 0 ? 'ต่ำ' : 'กลาง'}-${Math.round(target)}Hz.wav`;
        document.body.appendChild(a); a.click(); a.remove();
        // เก็บชื่อไฟล์ที่ส่งออกล่าสุดไว้ตรวจสอบจากคอนโซล (สูงสุด 50 ชื่อ)
        if (typeof window !== "undefined") window.__dlNames = (window.__dlNames || []).slice(-49).concat(a.download);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        n++;
        setMsg(`⬇ กำลังส่งออก ${n} ไฟล์ …`);
        await new Promise(res => setTimeout(res, 250));
      } catch (e) { fail.push(`${fn}: ${e.message}`); }
    }
    setBusy(false);
    setMsg(n ? `✓ ดาวน์โหลดไฟล์ที่จูนแล้ว ${n} ไฟล์ (ไฟล์บนเว็บยังเป็นต้นฉบับเดิม)`
      : `⚠ ส่งออกไม่ได้${fail.length ? ' — ' + fail[0] : ' — ยังไม่มีไฟล์เสียงที่จับคู่กับตำแหน่งได้'}`);
  }

  async function saveAll() {
    setBusy(true);
    const payload = (rows ?? []).map(r => ({
      instrument: inst.slug, idx: +r.idx, note: r.note, reg: +r.reg || 0,
      hz: r.hz === '' || r.hz == null ? null : +r.hz, file: r.file || null,
    }));
    const { error } = await supabase.from('instrument_notes').upsert(payload, { onConflict: 'instrument,idx' });
    setBusy(false);
    if (error) { setMsg('⚠ บันทึกไม่ได้: ' + error.message); return; }
    invalidateInstrumentNotes(inst.slug); invalidateMelodyBank(inst.slug);
    setMsg('✓ บันทึกตารางเสียงแล้ว — เครื่องเล่นใช้ค่าใหม่ทันที');
    setTimeout(() => setMsg(''), 4000);
  }

  return (
    <div style={{ marginTop: '0.9rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
      <div style={{ cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => setOpenN(v => !v)}>
        <b>🎯 ตารางเสียงรายตำแหน่ง</b>
        <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 8 }}>
          ตำแหน่งที่เท่าไหร่ = โน้ตอะไร ความถี่เท่าไหร่ ไฟล์ไหน (แก้ได้อิสระ)
        </span>
        <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{openN ? '▾' : '▸'}</span>
      </div>
      {openN && (rows == null
        ? <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 8 }}>⏳ กำลังโหลด…</div>
        : <>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '8px 0', lineHeight: 1.8 }}>
            ช่อง <b>ความถี่</b> ว่างไว้ = ถือว่าไฟล์นั้นตรงตามระบบเสียง{' '}
            <b style={{ color: 'var(--ink)' }}>{tuneOf?.name_th}</b> อยู่แล้ว<br />
            กด <b style={{ color: 'var(--ink)' }}>🎧 วัดความถี่ทุกไฟล์ให้อัตโนมัติ</b> แล้วระบบจะฟังไฟล์ที่อัดไว้
            แล้วกรอกความถี่จริงให้เอง → กด 💾 บันทึก → เสียงที่ได้ยินจะตรงตารางทันที
            (ไฟล์ต้นฉบับไม่ถูกแก้ · เลข % คือความมั่นใจ ต่ำกว่า 60% ควรฟังตรวจซ้ำ)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: 560 }}>
              <thead><tr>
                <th style={thS}>ตำแหน่ง</th><th style={thS}>โน้ต</th><th style={thS}>ช่วงเสียง</th>
                <th style={thS}>ความถี่จริง (Hz)</th><th style={thS}>ตามระบบเสียง</th><th style={thS}>ไฟล์</th>
                <th style={thS}>วัด / ฟัง</th>
              </tr></thead>
              <tbody>{rows.map(r => {
                const nominal = hzOf(tuneOf, r.note, +r.reg || 0);
                const off = +r.hz > 0 ? (1200 * Math.log2(+r.hz / nominal)) : null;
                return (
                  <tr key={r.idx}>
                    <td style={tdS}>{r.idx}</td>
                    <td style={tdS}><select className="filter-select" style={{ padding: '2px 4px' }} value={r.note} onChange={e => set(r.idx, { note: e.target.value })}>
                      {NOTES_TH.map(n => <option key={n}>{n}</option>)}</select></td>
                    <td style={tdS}><select className="filter-select" style={{ padding: '2px 4px' }} value={String(r.reg)} onChange={e => set(r.idx, { reg: e.target.value })}>
                      {REGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                      <span style={{ color: 'var(--muted)', marginLeft: 4 }}>({octaveOf(tuneOf, +r.reg || 0)})</span></td>
                    <td style={tdS}><input type="number" step="0.1" className="form-input" style={{ width: 84, padding: '2px 5px' }}
                      value={r.hz ?? ''} placeholder={hzText(nominal)} onChange={e => set(r.idx, { hz: e.target.value })} /></td>
                    <td style={{ ...tdS, color: 'var(--muted)' }}>{hzText(nominal)}
                      {off != null && Math.abs(off) >= 1 && <span style={{ color: Math.abs(off) > 25 ? 'var(--gold)' : 'var(--muted)', marginLeft: 5 }}>
                        {off > 0 ? '+' : ''}{off.toFixed(0)}¢</span>}</td>
                    <td style={tdS}><input className="form-input" style={{ width: 110, padding: '2px 5px', fontFamily: 'monospace' }}
                      value={r.file ?? ''} placeholder={inst.naming === 'note' ? '—' : String(r.idx).padStart(2, '0')}
                      onChange={e => set(r.idx, { file: e.target.value })} list={`fl-${inst.slug}`} /></td>
                    <td style={tdS}>
                      <button className="btn btn-outline btn-sm" style={{ padding: '1px 6px' }} disabled={busy}
                        title="วัดความถี่จริงจากไฟล์เสียง" onClick={() => measureOne(r)}>🎧</button>
                      <button className="btn btn-outline btn-sm" style={{ padding: '1px 6px', marginLeft: 4 }}
                        title="ฟังเสียงเดิม (ยังไม่จูน)" onClick={() => { const f = fileOf(r); if (f) playBuf(inst.slug, f, 1); else setMsg('⚠ ยังไม่มีไฟล์'); }}>▶</button>
                      <button className="btn btn-primary btn-sm" style={{ padding: '1px 6px', marginLeft: 4 }}
                        title="ฟังเสียงที่จูนแล้ว" onClick={() => { const f = fileOf(r); if (f) playBuf(inst.slug, f, nominal / (+r.hz > 0 ? +r.hz : nominal)); else setMsg('⚠ ยังไม่มีไฟล์'); }}>▶ จูน</button>
                      {meta[r.idx] && <span style={{ marginLeft: 6, fontSize: '0.68rem',
                        color: meta[r.idx].q < 0.6 || Math.abs(meta[r.idx].cents ?? 0) > 50 ? 'var(--gold)' : 'var(--jade)' }}
                        title={`วัดจาก ${meta[r.idx].frames} เฟรม · ไฟล์ ${meta[r.idx].fn}`}>
                        {meta[r.idx].q < 0.6 ? '⚠ ' : '✓ '}{(meta[r.idx].q * 100).toFixed(0)}%
                      </span>}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
            <datalist id={`fl-${inst.slug}`}>{names.map(n => <option key={n} value={n.replace(AUDIO_EXT, '')} />)}</datalist>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" disabled={busy || !rows.length} onClick={saveAll}>💾 บันทึกตารางเสียง</button>
            <button className="btn btn-outline btn-sm" disabled={busy || !rows.length} onClick={measureAll}>🎧 วัดความถี่ทุกไฟล์ให้อัตโนมัติ</button>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={fill}>✨ เติมตำแหน่งที่ยังไม่มี ({inst.note_count} ตำแหน่ง)</button>
            <button className="btn btn-outline btn-sm" disabled={busy || !rows.length} onClick={exportTuned}>⬇ ดาวน์โหลดไฟล์ที่จูนแล้ว (WAV)</button>
          </div>
        </>)}
    </div>
  );
}

function InstForm({ row, isNew }) {
  const C = useContext(AdminCtx);
  const { tunes, busy, saveInst, delInst, setEdit, setAdding } = C;
  const [f, setF] = useState(row);
  const set = p => setF(x => ({ ...x, ...p }));
  const chk = useMemo(() => fileChecklist(f), [f]);
  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.7rem', paddingTop: '0.7rem' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem' }}>
        <label>ชื่อเครื่อง <input className="form-input" style={{ width: 150 }} value={f.name_th} onChange={e => set({ name_th: e.target.value })} /></label>
        <label>โฟลเดอร์ <input className="form-input" style={{ width: 130, fontFamily: 'monospace' }} value={f.slug} disabled={!isNew}
          onChange={e => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} placeholder="khim" /></label>
        <label>ชนิด <select className="filter-select" value={f.kind} onChange={e => set({ kind: e.target.value })}>
          <option value="melody">ดำเนินทำนอง</option><option value="perc">กำกับจังหวะ</option></select></label>
      </div>
      {f.kind === 'melody' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem', marginTop: 6 }}>
            <label>ชื่อไฟล์ <select className="filter-select" value={f.naming} onChange={e => set({ naming: e.target.value })}>
              <option value="index">01.mp3 ไล่จากต่ำสุด</option><option value="note">d_mid.mp3 (ชื่อโน้ต)</option></select></label>
            <label>ไฟล์ 01 = <select className="filter-select" value={f.low_note} onChange={e => set({ low_note: e.target.value })}>
              {NOTES_TH.map(n => <option key={n}>{n}</option>)}</select></label>
            <select className="filter-select" value={String(f.low_reg)} onChange={e => set({ low_reg: e.target.value })}>
              {REGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <label>จำนวนเสียง <input type="number" className="form-input" style={{ width: 70 }} min={1} max={60} value={f.note_count} onChange={e => set({ note_count: e.target.value })} /></label>
            <label title="เลื่อนระดับเสียงทั้งเครื่องกี่ขั้น เวลาเล่นเทียบกับโน้ตที่เขียน">เทียบเสียง <input type="number" className="form-input" style={{ width: 60 }} min={-14} max={14} value={f.transpose} onChange={e => set({ transpose: e.target.value })} /> ขั้น</label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem', marginTop: 6 }}>
            <label>ระบบบันทึกที่แนะนำ <select className="filter-select" value={f.system} onChange={e => set({ system: e.target.value })}>
              {SYSTEM_KEYS.map(k => <option key={k} value={k}>{SYSTEMS[k].short}</option>)}</select></label>
            <label title="ไฟล์เสียงของเครื่องนี้อัดมาโดยตั้งเสียงตามระบบไหน — ว่าง = ถือว่าตรงกับระบบที่ผู้ฟังเลือก">เสียงตั้งของไฟล์
              <select className="filter-select" value={f.tuning ?? ''} onChange={e => set({ tuning: e.target.value })}>
                <option value="">— ตรงกับระบบที่เลือก —</option>
                {tunes.map(t => <option key={t.slug} value={t.slug}>{t.name_th}</option>)}</select></label>
            <label>ลำดับ <input type="number" className="form-input" style={{ width: 60 }} value={f.sort} onChange={e => set({ sort: e.target.value })} /></label>
            <label><input type="checkbox" checked={f.enabled !== false} onChange={e => set({ enabled: e.target.checked })} /> เปิดใช้</label>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.8 }}>
            ไฟล์ที่ควรมี: {chk.slice(0, 6).map(c => `${c.name} = ${c.note}`).join(' · ')}
            {chk.length > 6 && <> … ถึง {chk[chk.length - 1].name} = {chk[chk.length - 1].note}</>}
          </div>
        </>
      )}
      <input className="form-input" style={{ width: '100%', marginTop: 6, fontSize: '0.78rem' }} placeholder="หมายเหตุ (ไม่บังคับ)" value={f.note ?? ''} onChange={e => set({ note: e.target.value })} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveInst(f, isNew)}>💾 บันทึกทะเบียน</button>
        <button className="btn btn-outline btn-sm" onClick={() => { setEdit(null); setAdding(false); }}>ยกเลิก</button>
        {!isNew && <button className="btn btn-danger btn-sm" onClick={() => delInst(f.slug)}>🗑 เอาออกจากทะเบียน</button>}
      </div>
    </div>
  );
}
