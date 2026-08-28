'use client';
// app/songs/new/page.js — เพิ่มเพลงใหม่เข้าฐาน (ใช้กระดานโน้ตไทย)
//   ระบบร่าง (Pk 2026-08-26): เก็บร่างอัตโนมัติลงตาราง drafts ทุก ~2 วิ + ปุ่ม 💾 บันทึกร่าง
//   เปิดร่างเดิมมาแก้ต่อได้ด้วย ?draft=<id> (ลิงก์จากหน้า "จดหมายเหตุของฉัน") · ส่งสำเร็จ = ลบร่างทิ้ง
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import NotationInput from '../../../components/NotationInput';
import RankGate from '../../../components/RankGate';
import DraftBar from '../../../components/DraftBar';
import { versesToRows, versesToText, checkVerses, hasSound, rowsToVerses } from '../../../lib/notation-core';
import { listDrafts, getDraft, saveDraft, deleteDraft, makeAutoSaver } from '../../../lib/drafts';
import { useMe } from '../../../components/Gate';
import { listTeachers, sendHomework } from '../../../lib/homework';
import { myMemberships, myAssignments, dueText } from '../../../lib/classroom';
import SongTypeSelect from '../../../components/SongTypeSelect';

// ประเภทเพลงกับลักษณะการบรรเลงย้ายไปอยู่ในตาราง song_types แล้ว (sql/29 · Pk 27 ส.ค. 69)
//   ของเดิมฝังคำไว้ 3 คำตรงนี้ ซึ่งเป็น "ลักษณะการบรรเลง" แต่ถูกบันทึกลงช่อง "ประเภท"
//   เพลงอย่าง KBT004 จึงขึ้น 'แปรทำนอง' ปนอยู่ในคอลัมน์ที่เหลือเป็น 'เพลงสองชั้น'
const INSTS = ['ทำนองหลัก','ระนาดเอก','ระนาดทุ้ม','ฆ้องวงใหญ่','ฆ้องวงเล็ก','ปี่ใน','ขลุ่ยเพียงออ','ซอด้วง','ซออู้','ซอสามสาย','จะเข้','ขิม'];

export default function NewSongPage() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [songType, setSongType] = useState(null);      // ประเภทเพลง (เพลงสองชั้น · เพลงเถา …)
  const [songStyle, setSongStyle] = useState(null);    // ลักษณะการบรรเลง (แปรทำนอง · บังคับทาง …)
  const [instrument, setInstrument] = useState('ทำนองหลัก');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState({ verses: 0, warn: 0 });
  const padRef = useRef(null);

  // ── นักเรียน: งานไม่ขึ้นสาธารณะ ส่งเป็น "การบ้าน" ให้ครูที่เลือกแทน (Pk 27 ส.ค. 69) ──
  const me = useMe();
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState('');
  const [teacherErr, setTeacherErr] = useState('');
  // ห้องเรียน (sql/26) — ส่งเข้า "งานที่ครูสั่ง" ได้ หรือจะส่งตรงถึงครูแบบไม่ผูกห้องก็ได้
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');        // '' = ส่งตรงถึงครู ไม่ผูกห้อง
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState('');

  useEffect(() => {
    if (!me.isStudent) return;
    listTeachers().then(({ teachers: t, error }) => {
      setTeachers(t);
      if (error) setTeacherErr('โหลดรายชื่อครูไม่สำเร็จ — ผู้ดูแลอาจยังไม่ได้รัน sql/25');
      else if (!t.length) setTeacherErr('ยังไม่มีครูในระบบ — บอกผู้ดูแลให้ตั้งสถานะครูให้อาจารย์ของคุณก่อน');
      else setTeacherId(t[0].id);
    });
  }, [me.isStudent]);

  useEffect(() => {
    if (!me.isStudent || !me.user) return;
    myMemberships(me.user.id).then(({ rows }) => {
      const ok = (rows ?? []).filter(r => r.status === 'approved');
      setClasses(ok);
      if (ok.length) setClassId(String(ok[0].class_id));
    });
  }, [me.isStudent, me.user]);

  // เลือกห้องแล้วโหลดงานที่ครูสั่งในห้องนั้น
  useEffect(() => {
    if (!classId || !me.user) { setAssignments([]); setAssignmentId(''); return; }
    myAssignments(Number(classId), me.user.id).then(({ rows }) => {
      const open = (rows ?? []).filter(a => !a.closed);
      setAssignments(open);
      setAssignmentId(prev => (open.some(a => String(a.id) === String(prev)) ? prev : (open[0] ? String(open[0].id) : '')));
    });
  }, [classId, me.user]);

  // เปิดจากหน้าห้องเรียนด้วย ?assignment=<id> → เลือกงานชิ้นนั้นให้เลย
  useEffect(() => {
    if (!classes.length) return;
    let want = null;
    try { want = new URL(window.location.href).searchParams.get('assignment'); } catch (e) {}
    if (!want) return;
    (async () => {
      for (const c of classes) {
        const { rows } = await myAssignments(c.class_id, me.user.id);
        if ((rows ?? []).some(a => String(a.id) === String(want))) {
          setClassId(String(c.class_id)); setAssignmentId(String(want));
          const a = rows.find(x => String(x.id) === String(want));
          setName(n => n || a?.title || '');
          return;
        }
      }
    })();
  }, [classes, me.user]);

  // ── ร่าง ──
  const draftIdRef = useRef(null);
  const [draftId, setDraftId] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [draftErr, setDraftErr] = useState('');
  const [others, setOthers] = useState([]);
  const [ready, setReady] = useState(false);          // โหลดร่างเดิมเสร็จแล้วค่อยเริ่มเก็บร่าง
  const formRef = useRef({ name: '', songType: null, songStyle: null, instrument: 'ทำนองหลัก', note: '' });
  formRef.current = { name, songType, songStyle, instrument, note };

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user)); }, []);
  // ?mode=import → เปิดหน้าต่างนำเข้าไฟล์ทันที (ลิงก์จาก /convert และปุ่มเลือกวิธีด้านบน)
  const [wantImport, setWantImport] = useState(false);
  useEffect(() => { if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'import') setWantImport(true); }, []);
  useEffect(() => {   // กระดานโผล่หลัง RankGate โหลดศักดินาเสร็จ → รอจนมี ref แล้วค่อยเปิด (ไม่เกิน 5 วิ)
    if (!wantImport || !user) return;
    let n = 0; const t = setInterval(() => { if (padRef.current?.openImport) { padRef.current.openImport(); setWantImport(false); clearInterval(t); } else if (++n > 25) clearInterval(t); }, 200);
    return () => clearInterval(t);
  }, [wantImport, user]);

  const applyDraft = useCallback(d => {
    const p = d?.payload ?? {};
    draftIdRef.current = d?.id ?? null; setDraftId(d?.id ?? null);
    setName(p.name ?? ''); setSongType(p.songType ?? null); setSongStyle(p.songStyle ?? null);
    setInstrument(p.instrument ?? 'ทำนองหลัก'); setNote(p.note ?? '');
    setSavedAt(d?.updated_at ?? null);
    // โน้ตกลับเข้ากระดาน (รอกระดานพร้อมก่อน)
    if (Array.isArray(p.rows) && p.rows.length) {
      let n = 0;
      const t = setInterval(() => {
        if (padRef.current?.loadVerses) { padRef.current.loadVerses(rowsToVerses(p.rows)); clearInterval(t); }
        else if (++n > 25) clearInterval(t);
      }, 200);
    }
    try { const u = new URL(window.location.href); if (d?.id) u.searchParams.set('draft', d.id); else u.searchParams.delete('draft'); window.history.replaceState(null, '', u.toString()); } catch (e) {}
  }, []);

  // โหลดร่าง: ?draft=<id> เปิดร่างนั้น · ไม่มีก็แค่ดึงรายการร่างค้างมาโชว์
  useEffect(() => {
    if (!user) return;
    (async () => {
      const wanted = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('draft') : null;
      const { drafts } = await listDrafts('song');
      if (wanted) {
        const { draft } = await getDraft(wanted);
        if (draft) applyDraft(draft);
      }
      setOthers(drafts.filter(d => String(d.id) !== String(wanted)));
      setReady(true);
    })();
  }, [user, applyDraft]);

  const payloadNow = useCallback(() => {
    const f = formRef.current;
    const verses = padRef.current?.getVerses?.() ?? [];
    const st = padRef.current?.getState?.() ?? {};
    const rows = verses.length ? versesToRows(verses, { lines: st.lines, system: st.system }) : [];
    return { ...f, rows, base: st.base, line_hong: st.lineHong, two_hands: st.twoHands, system: st.system, lines: st.lines,
             tang: st.tangHome, notation_ensemble: st.notEns, ensemble: st.ensemble, level: st.level,
             ching: st.chingOn, nathab: st.nathab, drum: st.drum, bpm: st.bpm };
  }, []);

  const saverRef = useRef(null);
  if (!saverRef.current) saverRef.current = makeAutoSaver({
    kind: 'song',
    getId: () => draftIdRef.current,
    setId: id => { draftIdRef.current = id; setDraftId(id); try { const u = new URL(window.location.href); u.searchParams.set('draft', id); window.history.replaceState(null, '', u.toString()); } catch (e) {} },
    onSaved: (id, at) => { setSaving(false); setSavedAt(at); setDraftErr(''); },
    onError: e => { setSaving(false); setDraftErr(e?.message ?? String(e)); },
  });

  const touch = useCallback(() => {
    if (!ready || !user) return;
    const p = payloadNow();
    if (!p.name && !p.rows.length && !p.note) return;    // ยังไม่มีอะไรเลย ไม่ต้องสร้างร่างเปล่า
    setSaving(true);
    saverRef.current.push(p, p.name || '(ยังไม่ตั้งชื่อเพลง)');
  }, [ready, user, payloadNow]);

  useEffect(() => { touch(); }, [name, songType, songStyle, instrument, note, touch]);
  // ปิดแท็บ/รีเฟรช → รีบเขียนร่างที่ค้าง
  useEffect(() => {
    const h = () => saverRef.current?.flush();
    window.addEventListener('pagehide', h);
    return () => { window.removeEventListener('pagehide', h); };
  }, []);

  async function saveNow() {
    if (!user) return;
    setSaving(true); setDraftErr('');
    const p = payloadNow();
    const { id, error } = await saveDraft({ id: draftIdRef.current, kind: 'song', title: p.name || '(ยังไม่ตั้งชื่อเพลง)', payload: p });
    setSaving(false);
    if (error) { setDraftErr(error.message); return; }
    if (id && id !== draftIdRef.current) { draftIdRef.current = id; setDraftId(id); }
    setSavedAt(new Date());
    setMsg('📝 บันทึกร่างแล้ว — กลับมาแก้ต่อได้จากหน้า "จดหมายเหตุของฉัน"');
  }
  async function discardDraft() {
    if (!draftIdRef.current) return;
    if (!confirm('ทิ้งร่างนี้? (โน้ตที่พิมพ์ไว้ยังอยู่บนกระดาน แต่จะไม่ถูกเก็บเป็นร่างอีก)')) return;
    saverRef.current.cancel();
    await deleteDraft(draftIdRef.current);
    draftIdRef.current = null; setDraftId(null); setSavedAt(null);
    try { const u = new URL(window.location.href); u.searchParams.delete('draft'); window.history.replaceState(null, '', u.toString()); } catch (e) {}
    setMsg('ทิ้งร่างแล้ว');
  }

  function onChange({ verses, base }) {
    const ck = checkVerses(verses, { base });
    setSummary({ verses: verses.filter(hasSound).length, warn: ck.filter(c => c.kind === 'warn').length });
    touch();
  }

  // นักเรียนกดส่งการบ้าน — ไม่แตะคิวสาธารณะเลย
  async function submitHomework() {
    if (!name.trim()) { setMsg('⚠ ตั้งชื่องานก่อน (เช่น ชื่อเพลง หรือ "แขกบรเทศ ท่อน 1")'); return; }
    if (!classId && !teacherId) { setMsg('⚠ เลือกครูที่จะส่งงานให้ก่อน'); return; }
    const verses = padRef.current.getVerses();
    const st = padRef.current.getState();
    if (!verses.filter(hasSound).length) { setMsg('⚠ กรอกโน้ตอย่างน้อย 1 วรรค'); return; }
    if (padRef.current.stop) padRef.current.stop();
    setBusy(true); setMsg('กำลังส่งการบ้าน…');
    saverRef.current.cancel();
    const rows = versesToRows(verses, { lines: st.lines, system: st.system });
    const { error, resent } = await sendHomework({
      studentId: user.id, teacherId: classId ? null : teacherId,
      classId: classId ? Number(classId) : null,
      assignmentId: assignmentId ? Number(assignmentId) : null,
      title: name.trim(), instrument, songType, songStyle,
      notationText: versesToText(verses, { lines: st.lines }),
      notationJson: { rows, base: st.base, line_hong: st.lineHong, two_hands: st.twoHands,
                      system: st.system, lines: st.lines, tang: st.tangHome, notation_ensemble: st.notEns,
                      ensemble: st.ensemble, level: st.level,
                      ching: st.chingOn, nathab: st.nathab, drum: st.drum, bpm: st.bpm },
      note,
    });
    setBusy(false);
    if (error) { setMsg('⚠ ' + error.message); return; }
    await deleteDraft(draftIdRef.current);
    draftIdRef.current = null; setDraftId(null); setSavedAt(null);
    const cls = classes.find(c => String(c.class_id) === String(classId));
    const who = classId
      ? `${cls?.teacher?.display_name ?? 'ครู'} · ห้อง ${cls?.classroom?.name ?? ''}`
      : (teachers.find(t => t.id === teacherId)?.display_name ?? 'ครู');
    setMsg(`✓ ${resent ? 'ส่งงานที่แก้แล้ว' : 'ส่งการบ้าน'} "${name}" (${rows.length} วรรค) ให้ ${who} แล้ว — ดูสถานะได้ที่หน้า "การบ้าน"`);
    padRef.current.clearDraft();
    setName(''); setNote('');
  }

  async function submit() {
    if (!name.trim()) { setMsg('⚠ ใส่ชื่อเพลง'); return; }
    const verses = padRef.current.getVerses();
    const st = padRef.current.getState();
    if (!verses.filter(hasSound).length) { setMsg('⚠ กรอกโน้ตอย่างน้อย 1 วรรค'); return; }
    if (padRef.current.stop) padRef.current.stop();
    setBusy(true); setMsg('กำลังส่ง…');
    saverRef.current.cancel();
    const rows = versesToRows(verses, { lines: st.lines, system: st.system });
    const { error } = await supabase.from('song_submissions').insert({
      name_th: name.trim(), song_type: songType, song_style: songStyle, instrument,
      notation_text: versesToText(verses, { lines: st.lines }),   // อ่านได้ด้วยตา + ระบบเก่ายังอ่านออก
      notation_json: { rows, base: st.base, line_hong: st.lineHong, two_hands: st.twoHands, system: st.system, lines: st.lines,
                       tang: st.tangHome, notation_ensemble: st.notEns,
                       ensemble: st.ensemble, level: st.level,
                       // ฉิ่ง/กลอง/ความเร็วที่ตั้งบนกระดาน → ผู้ดูแลอนุมัติแล้วกลายเป็นค่าเริ่มต้นของเพลง
                       ching: st.chingOn, nathab: st.nathab, drum: st.drum, bpm: st.bpm },
      note: note || null, submitted_by: user.id,
    });
    setBusy(false);
    if (error) { setMsg(error.message.includes('row-level security')
      ? '⚠ บัญชีของคุณยังไม่ถึงบรรดาศักดิ์ ขุน (300 ศักดินา) จึงยังใช้ระบบบันทึกโน้ตไม่ได้ — ร่วมบันทึกเหตุการณ์จดหมายเหตุเพื่อสะสมศักดินาก่อน'
      : '⚠ ' + error.message); return; }
    // ส่งสำเร็จ → ร่างหมดหน้าที่
    await deleteDraft(draftIdRef.current);
    draftIdRef.current = null; setDraftId(null); setSavedAt(null);
    try { const u = new URL(window.location.href); u.searchParams.delete('draft'); window.history.replaceState(null, '', u.toString()); } catch (e) {}
    setMsg(`✓ ส่งเพลง "${name}" (${rows.length} วรรค) แล้ว — รอผู้ดูแลตรวจสอบและอนุมัติ (+10 ศักดินาเมื่อผ่าน)`);
    padRef.current.clearDraft();
    setName(''); setNote('');
  }

  if (!user) return (
    <main className="container" style={{maxWidth:'500px'}}>
      <div className="lock-box">
        <div style={{marginBottom:'1rem'}}>เข้าสู่ระบบเพื่อเพิ่มเพลงใหม่</div>
        <Link href="/login"><button className="btn btn-primary">เข้าสู่ระบบ / สมัคร</button></Link>
      </div>
    </main>
  );

  // ช่วงเปิดตัว: ระบบบันทึกโน้ตเปิดให้ระดับ ขุน (300 ศักดินา) ขึ้นไป
  return (
    <RankGate minPoints={300}>
    <main className="container" style={{maxWidth:'1180px'}}>
      <Link href="/songs"><span style={{color:'var(--muted)',fontSize:'0.8rem'}}>← กลับรายการเพลง</span></Link>
      <div className="card" style={{marginTop:'1rem'}}>
        <div className="section-title" style={{fontSize:'1.1rem'}}>TH Notation+ <span style={{fontWeight:400,color:'var(--muted)',fontSize:'0.9rem'}}>· {me.isStudent ? 'เขียนโน้ตส่งการบ้าน' : 'เพิ่มเพลงใหม่เข้าฐานข้อมูล'}</span></div>
        <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:'1.1rem'}}>
          พิมพ์โน้ตด้วยแป้น TH Notation (a s d f g h j = ด ร ม ฟ ซ ล ท) ·{' '}
          {me.isStudent
            ? 'งานของคุณส่งถึงครูโดยตรง ไม่ขึ้นคลังสาธารณะ'
            : 'ผู้ดูแลตรวจสอบก่อนเผยแพร่ · เครดิตชื่อผู้เพิ่มแสดงในหน้าเพลง'}
        </div>

        <DraftBar kind="song" draftId={draftId} savedAt={savedAt} saving={saving} error={draftErr} others={others}
          onSave={saveNow} onDiscard={discardDraft}
          onOpen={d => { applyDraft(d); setOthers(o => o.filter(x => x.id !== d.id)); setMsg('เปิดร่าง "' + (d.title ?? '') + '" มาแก้ต่อแล้ว'); }} />

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:'0.8rem'}}>
          <div className="form-group">
            <label className="form-label">ชื่อเพลง *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น จีนล่องหน่าย สองชั้น" />
          </div>
          <div className="form-group">
            <label className="form-label">ประเภทเพลง</label>
            <SongTypeSelect kind="type" value={songType} onChange={setSongType} />
          </div>
          <div className="form-group">
            <label className="form-label">ลักษณะการบรรเลง</label>
            <SongTypeSelect kind="style" value={songStyle} onChange={setSongStyle} />
          </div>
          <div className="form-group">
            <label className="form-label">ทาง / เครื่องดนตรี</label>
            <select className="form-input" value={instrument} onChange={e => setInstrument(e.target.value)}>
              {INSTS.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
        </div>

        {/* เลือกวิธีใส่โน้ต (2026-08-25): เขียนเอง หรือ นำเข้า/แปลงจากไฟล์ */}
        {summary.verses === 0 && (
          <div className="new-song-ways" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:'10px',margin:'0.6rem 0'}}>
            <button type="button" className="card" style={{textAlign:'left',cursor:'pointer',padding:'0.7rem 0.9rem',borderColor:'rgba(201,168,76,0.35)'}}
              onClick={() => document.querySelector('.thn')?.scrollIntoView({behavior:'smooth',block:'start'})}>
              <div style={{fontWeight:600}}>✍️ เขียนโน้ตเอง</div>
              <div style={{fontSize:'0.74rem',color:'var(--muted)',marginTop:2}}>พิมพ์บนกระดานด้านล่างด้วยแป้น a s d f g h j · สองมือ R/L · ฟังได้ทันที</div>
            </button>
            <button type="button" className="card" style={{textAlign:'left',cursor:'pointer',padding:'0.7rem 0.9rem',borderColor:'rgba(201,168,76,0.35)'}}
              onClick={() => padRef.current?.openImport?.()}>
              <div style={{fontWeight:600}}>📥 นำเข้า / แปลงจากไฟล์</div>
              <div style={{fontSize:'0.74rem',color:'var(--muted)',marginTop:2}}>PDF · Word · Excel · รูปถ่ายโน้ต · MusicXML · MIDI — อักษรไทย / TH Notation / โน้ตสากล → ตรวจแล้วใส่ลงกระดาน</div>
            </button>
          </div>
        )}
        <NotationInput ref={padRef} onChange={onChange} options={{ base: 4, lineHong: 8, instrument, draftKey: 'new' }} />

        <div className="form-group" style={{marginTop:'1rem'}}>
          <label className="form-label">{me.isStudent ? 'หมายเหตุถึงครู' : 'ที่มาโน้ต / หมายเหตุถึงผู้ดูแล'}</label>
          <input className="form-input" value={note} onChange={e => setNote(e.target.value)}
            placeholder={me.isStudent ? 'เช่น ท่อน 2 ยังไม่แน่ใจลูกตกครับ' : 'เช่น ถอดจากโน้ตครูสำนัก…'} />
        </div>

        {/* นักเรียน: เลือกครูที่จะส่งงานให้ */}
        {me.isStudent && (
          <div className="card" style={{borderColor:'rgba(201,168,76,0.45)',marginBottom:'0.9rem'}}>
            <div style={{fontWeight:600,fontSize:'0.9rem',marginBottom:'0.5rem'}}>📮 ส่งการบ้าน</div>
            {classes.length > 0 && (
              <div className="form-group" style={{marginBottom:'0.5rem'}}>
                <label className="form-label">ส่งเข้าห้องเรียน</label>
                <select className="form-input" value={classId} onChange={e => setClassId(e.target.value)}>
                  {classes.map(c => (
                    <option key={c.class_id} value={c.class_id}>
                      {c.classroom?.name ?? 'ห้องเรียน'} · ครู{c.teacher?.display_name ?? ''}
                    </option>
                  ))}
                  <option value="">— ไม่เข้าห้อง ส่งตรงถึงครู —</option>
                </select>
              </div>
            )}

            {classId ? (
              <div className="form-group" style={{marginBottom:'0.5rem'}}>
                <label className="form-label">งานที่ครูสั่ง</label>
                <select className="form-input" value={assignmentId} onChange={e => setAssignmentId(e.target.value)}>
                  {assignments.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.title}{a.due_at ? ` · ${dueText(a.due_at)}` : ''}{a.mine ? ' · ส่งไปแล้ว (ส่งใหม่ = แก้ของเดิม)' : ''}
                    </option>
                  ))}
                  <option value="">— ไม่ผูกกับงานที่สั่ง —</option>
                </select>
                {!assignments.length && (
                  <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:'4px'}}>
                    ครูยังไม่ได้สั่งงานในห้องนี้ — ส่งเข้าห้องเฉย ๆ ได้
                  </div>
                )}
              </div>
            ) : (
              <div className="form-group" style={{marginBottom:'0.5rem'}}>
                <label className="form-label">ส่งให้ครู</label>
                <select className="form-input" value={teacherId} onChange={e => setTeacherId(e.target.value)}>
                  {!teachers.length && <option value="">— ยังไม่มีครูให้เลือก —</option>}
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.display_name ?? 'ครู'}{t.organization ? ` · ${t.organization}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {teacherErr && <div style={{fontSize:'0.76rem',color:'var(--danger)'}}>{teacherErr}</div>}
            <div style={{fontSize:'0.75rem',color:'var(--muted)',lineHeight:1.8}}>
              งานของนักเรียนเป็นงานส่วนตัวระหว่างคุณกับครู — ไม่ขึ้นในคลังเพลงสาธารณะ
              และคนอื่นมองไม่เห็น · ถ้าครูเห็นว่างานดีมาก ครูจะส่งเข้าคลังจริงให้เองโดยเครดิตยังเป็นของคุณ
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'}}>
          {me.isStudent ? (
            <>
              <button className="btn btn-jade" onClick={submitHomework} disabled={busy || (!teacherId && !classId)}>
                📮 ส่งการบ้านให้ครู
              </button>
              <Link href="/homework"><button className="btn btn-outline" type="button">📚 การบ้านของฉัน</button></Link>
              <Link href="/classroom"><button className="btn btn-outline" type="button">🎓 ห้องเรียน</button></Link>
            </>
          ) : (
          <button className="btn btn-jade" onClick={submit} disabled={busy}>✓ ส่งเพลง — รอผู้ดูแลตรวจสอบ</button>
          )}
          <button className="btn btn-outline" type="button" onClick={saveNow} disabled={saving}>💾 เก็บเป็นร่างไว้ก่อน</button>
          <span style={{fontSize:'0.75rem',color:'var(--muted)'}}>
            {summary.verses} วรรค{summary.warn ? ` · ⚑ มี ${summary.warn} จุดที่ระบบทักไว้ (ส่งได้ ผู้ดูแลจะเห็นธง)` : ''}
          </span>
        </div>
        {msg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{msg}</div>}
      </div>
    </main>
    </RankGate>
  );
}
