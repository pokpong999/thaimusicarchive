'use client';
// app/songs/[id]/edit/page.js — แก้โน้ตของเพลงในเว็บ / เสนอทางเครื่องใหม่
//   /songs/KSY001/edit?inst=ทำนองหลัก        แก้ทางที่มีอยู่ (แอดมินทุกเพลง · สมาชิกเฉพาะทางที่ตัวเองส่ง)
//   /songs/KSY001/edit?inst=ระนาดเอก&new=1   เสนอทางใหม่ (สมาชิก → รอตรวจ · แอดมิน → ขึ้นเว็บทันที)
// กฎที่บังคับจริงอยู่ที่ RLS ใน Supabase (thma_edit_permissions.sql) — หน้านี้แค่ซ่อน/แสดงให้ตรงกัน
import { useEffect, useRef, useState } from 'react';
import { refreshSongStats } from '../../../../lib/songstats';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase';
import { useMe } from '../../../../components/Gate';
import NotationInput from '../../../../components/NotationInput';
import { rowsToVerses, versesToRows, versesToText, checkVerses, hasSound } from '../../../../lib/notation-core';
import { loadSongNathab, mainRule, saveSongDefaults } from '../../../../lib/nathab';

const INSTS = ['ระนาดเอก','ระนาดทุ้ม','ฆ้องวงใหญ่','ฆ้องวงเล็ก','ปี่ใน','ขลุ่ยเพียงออ','ซอด้วง','ซออู้','ซอสามสาย','จะเข้','ขิม','อื่น ๆ'];

export default function EditMelodyPage() {
  const { id } = useParams();
  const sp = useSearchParams();
  const isNew = sp.get('new') === '1';
  const [instrument, setInstrument] = useState(sp.get('inst') || (isNew ? 'ระนาดเอก' : 'ทำนองหลัก'));
  const me = useMe();
  const [song, setSong] = useState(null);
  const [rows, setRows] = useState(null);       // แถวเดิมจาก song_melody
  const [canEdit, setCanEdit] = useState(null); // null = ยังไม่รู้
  const [why, setWhy] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [summary, setSummary] = useState({ verses: 0, warn: 0 });
  // ค่าเริ่มต้นของเพลง (ฉิ่ง/กลอง/ความเร็ว) ที่บันทึกไว้ — ใส่กลับเข้ากระดาน แล้วบันทึกทับตอนกดบันทึกโน้ต
  const [defaults, setDefaults] = useState(null);
  const [saveDefaults, setSaveDefaults] = useState(true);
  const [subNote, setSubNote] = useState('');   // ที่มาโน้ต/หมายเหตุถึงผู้ดูแล — ฟอร์มเพลงใหม่มีช่องนี้ ฟอร์มนี้เดิมไม่มี
  const padRef = useRef(null);

  useEffect(() => {
    if (me.loading) return;
    (async () => {
      const { data: s } = await supabase.from('songs').select('id, name_th, contributed_by').eq('id', id).single();
      setSong(s || null);
      try {
        const m = mainRule(await loadSongNathab(id));
        setDefaults(m ? { nathab: m.nathab && m.nathab !== '-' ? m.nathab : 'none', drum: m.drum || undefined, ching: !!m.ching, bpm: m.bpm || undefined, level: m.level || undefined } : {});
      } catch (e) { setDefaults({}); }
      if (isNew) { setRows([]); setCanEdit(!!me.user); setWhy(me.user ? '' : 'ต้องเข้าสู่ระบบก่อน'); return; }
      const { data: r } = await supabase.from('song_melody').select('*')
        .eq('song_id', id).eq('instrument', instrument).order('verse_no');
      const list = r || [];
      setRows(list);
      if (!me.user) { setCanEdit(false); setWhy('ต้องเข้าสู่ระบบก่อน'); return; }
      if (me.isAdmin) { setCanEdit(true); return; }
      if (!list.length) { setCanEdit(false); setWhy('ยังไม่มีโน้ตทางนี้ — ใช้ "เสนอทางเครื่อง" แทน'); return; }
      const mine = list.every(x => x.submitted_by === me.user.id);
      setCanEdit(mine);
      if (!mine) setWhy('ทางนี้บันทึกโดยสมาชิกท่านอื่น — แก้ได้เฉพาะทางที่คุณส่งเอง (หรือเสนอทางของคุณเพิ่ม)');
    })();
  }, [id, instrument, isNew, me.loading, me.user, me.isAdmin]);

  useEffect(() => {
    const h = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  function onChange({ verses, base }) {
    setDirty(true);
    const ck = checkVerses(verses, { base });
    setSummary({ verses: verses.filter(hasSound).length, warn: ck.filter(c => c.kind === 'warn').length });
  }

  async function save() {
    const verses = padRef.current.getVerses();
    const st = padRef.current.getState();
    const newRows = versesToRows(verses, { lines: st.lines, system: st.system });
    if (!newRows.length) { setMsg('⚠ ยังไม่มีโน้ต'); return; }
    if (padRef.current.stop) padRef.current.stop();
    setBusy(true); setMsg('กำลังบันทึก…');

    // ── เสนอทางใหม่ (สมาชิก) → melody_submissions รอผู้ดูแล ──
    if (isNew && !me.isAdmin) {
      const { error } = await supabase.from('melody_submissions').insert({
        song_id: id, instrument, submitted_by: me.user.id,
        notation_text: versesToText(verses, { lines: st.lines }),
        note: subNote.trim() || null,
        notation_json: { rows: newRows, base: st.base, line_hong: st.lineHong, two_hands: st.twoHands, system: st.system, lines: st.lines, ensemble: st.ensemble,
                         tang: st.tangHome, notation_ensemble: st.notEns, level: st.level,
                         // ฉิ่ง/กลอง/ความเร็วที่ตั้งบนกระดาน — เดิมไม่ได้ส่งมา ทางที่อนุมัติแล้วจึงไม่มีค่าเริ่มต้น (Pk 27 ส.ค. 69)
                         ching: st.chingOn, nathab: st.nathab, drum: st.drum, bpm: st.bpm },
      });
      setBusy(false);
      if (error) { setMsg('⚠ ' + error.message); return; }
      setDirty(false); padRef.current.clearDraft(); setMsg('✓ ส่งทาง' + instrument + ' แล้ว (' + newRows.length + ' วรรค) — รอผู้ดูแลอนุมัติ (+10 ศักดินาเมื่อผ่าน)');
      return;
    }

    // ── แก้ตรง (แอดมิน หรือเจ้าของทาง) → song_melody ──
    const approved = me.isAdmin ? true : (rows.length ? rows.every(x => x.approved) : false);
    const base = { song_id: id, instrument, approved };
    const existing = new Map(rows.map(r => [r.verse_no, r]));
    const errs = [];
    for (const nr of newRows) {
      const payload = { ...base, verse_no: nr.verse_no, section: nr.section, line_no: nr.line_no,
        combined: nr.combined, right_hand: nr.right_hand, left_hand: nr.left_hand, third_hand: nr.third_hand ?? null,
        notation_system: nr.notation_system ?? null, krasuan: nr.krasuan, luktok: nr.luktok, level: nr.level ?? null, ching: nr.ching ?? null,
        marks: nr.marks ?? null,
        // ทาง/วง/ระบบเสียงที่ผู้ถอดโน้ตตั้งไว้ — เดิมไม่ถูกเก็บ เครื่องเล่นเลยต้องเดาเอง (sql/21)
        tang: st.tangHome ?? null, ensemble: st.notEns ?? st.ensemble ?? null, tuning: st.tuning ?? null };
      const old = existing.get(nr.verse_no);
      if (old) {
        const { error } = await supabase.from('song_melody').update(payload).eq('id', old.id);
        if (error) errs.push('ว.' + nr.verse_no + ': ' + error.message);
      } else {
        const { error } = await supabase.from('song_melody').insert({ ...payload, submitted_by: me.user.id });
        if (error) errs.push('ว.' + nr.verse_no + ': ' + error.message);
      }
    }
    const extra = rows.filter(r => r.verse_no > newRows.length).map(r => r.id);
    if (extra.length) {
      const { error } = await supabase.from('song_melody').delete().in('id', extra);
      if (error) errs.push('ลบวรรคเกิน: ' + error.message);
    }
    // ฉิ่ง/กลอง/ความเร็วที่ตั้งบนกระดาน → ค่าเริ่มต้นของเพลง (Pk 2026-08-26)
    let defMsg = '';
    if (saveDefaults) {
      const { error: eD, skipped } = await saveSongDefaults(id, { nathab: st.nathab, level: st.level, drum: st.drum, ching: st.chingOn, bpm: st.bpm });
      if (eD) defMsg = ' · ⚠ จำค่าฉิ่ง/กลองไม่สำเร็จ: ' + eD.message;
      else if (!skipped) defMsg = ' · จำฉิ่ง/กลอง/ความเร็วเป็นค่าเริ่มต้นของเพลงแล้ว';
    }
    setBusy(false);
    if (errs.length) { setMsg('⚠ บันทึกไม่ครบ — ' + errs.slice(0, 3).join(' · ') + (errs.length > 3 ? ' …' : '')); return; }
    // จำนวนวรรค/กระสวนไม่ซ้ำบนหน้าเพลง เดิมค้างค่าเก่าตลอดหลังแก้โน้ต (Pk 27 ส.ค. 69)
    await refreshSongStats(id, instrument);
    setDirty(false); padRef.current.clearDraft();
    setMsg('✓ บันทึกแล้ว ' + newRows.length + ' วรรค' + (approved ? '' : ' (รอผู้ดูแลอนุมัติ)') + defMsg);
    const { data: r2 } = await supabase.from('song_melody').select('*').eq('song_id', id).eq('instrument', instrument).order('verse_no');
    setRows(r2 || []);
  }

  const wait = <main className="container" style={{textAlign:'center',paddingTop:'4rem',color:'var(--muted)'}}>กำลังโหลด...</main>;
  if (me.loading || rows === null || !song || defaults === null) return wait;

  if (!canEdit) return (
    <main className="container" style={{maxWidth:'560px',textAlign:'center',paddingTop:'3rem'}}>
      <div style={{fontSize:'2.2rem'}}>🔒</div>
      <div className="section-title" style={{fontSize:'1.1rem',margin:'0.8rem 0'}}>แก้โน้ตทางนี้ไม่ได้</div>
      <div style={{color:'var(--muted)',fontSize:'0.88rem',lineHeight:1.9}}>{why}</div>
      <div style={{display:'flex',gap:'10px',justifyContent:'center',marginTop:'1.2rem',flexWrap:'wrap'}}>
        {me.user && <Link href={`/songs/${id}/edit?inst=${encodeURIComponent(instrument === 'ทำนองหลัก' ? 'ระนาดเอก' : instrument)}&new=1`}>
          <button className="btn btn-primary btn-sm">＋ เสนอทางของคุณ</button></Link>}
        {!me.user && <Link href="/login"><button className="btn btn-primary btn-sm">เข้าสู่ระบบ</button></Link>}
        <Link href={`/songs/${id}`}><button className="btn btn-outline btn-sm">← กลับหน้าเพลง</button></Link>
      </div>
    </main>
  );

  const initialVerses = rows.length ? rowsToVerses(rows) : null;
  const twoHands = rows.some(r => (r.right_hand || '').trim() || (r.left_hand || '').trim());
  const system = rows.find(r => r.notation_system)?.notation_system
    || (rows.some(r => (r.third_hand || '').trim()) ? 'khim3' : twoHands ? 'hands2' : 'melody1');

  return (
    <main className="container" style={{maxWidth:'1180px'}}>
      <Link href={`/songs/${id}`}><span style={{color:'var(--muted)',fontSize:'0.8rem'}}>← {song.name_th}</span></Link>
      <div className="card" style={{marginTop:'1rem'}}>
        <div style={{display:'flex',gap:'12px',alignItems:'center',flexWrap:'wrap',marginBottom:'0.9rem'}}>
          <div className="section-title" style={{fontSize:'1.1rem'}}>
            {isNew ? 'เสนอทางเครื่องดนตรี' : 'แก้โน้ต'} · {song.name_th}
          </div>
          {isNew ? (
            <select className="filter-select" value={instrument} onChange={e => setInstrument(e.target.value)}>
              {INSTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          ) : <span className="badge badge-fixed">ทาง {instrument}</span>}
          {me.isAdmin && <span className="badge badge-variable">ผู้ดูแล — บันทึกแล้วขึ้นเว็บทันที</span>}
          {!me.isAdmin && !isNew && <span className="badge badge-variable">ทางของคุณ — บันทึกแล้วขึ้นเว็บทันที (ระบบเก็บรุ่นก่อนแก้ไว้)</span>}
          {!me.isAdmin && isNew && <span className="badge badge-pending">ส่งแล้วรอผู้ดูแลตรวจ</span>}
        </div>

        <NotationInput ref={padRef} initialVerses={initialVerses} onChange={onChange}
          options={{ base: 4, lineHong: 8, twoHands, system, instrument,
                     nathab: defaults.nathab, drum: defaults.drum, ching: undefined,
                     chingOn: defaults.ching, bpm: defaults.bpm, level: defaults.level,
                     draftKey: `edit:${id}:${instrument}${isNew ? ':new' : ''}` }} />

        {isNew && !me.isAdmin && (
          <div style={{marginTop:'0.9rem'}}>
            <label style={{display:'block',fontSize:'0.8rem',color:'var(--muted)',marginBottom:'4px'}}>
              ที่มาของโน้ต / หมายเหตุถึงผู้ดูแล <span style={{opacity:.7}}>(ไม่บังคับ — ช่วยให้ผู้ตรวจเข้าใจที่มา อนุมัติเร็วขึ้น)</span>
            </label>
            <input className="form-input" style={{width:'100%'}} value={subNote} onChange={e => setSubNote(e.target.value)}
              placeholder="เช่น ถอดจากโน้ตครูสมพงษ์ พ.ศ. ๒๕๓๐ / บันทึกจากการบรรเลงของวง…" />
          </div>
        )}

        {!isNew && (
          <label style={{display:'flex',gap:'8px',alignItems:'center',marginTop:'0.9rem',fontSize:'0.8rem',cursor:'pointer'}}>
            <input type="checkbox" checked={saveDefaults} onChange={e => setSaveDefaults(e.target.checked)} style={{accentColor:'var(--gold)'}} />
            <span>จำ <b>ฉิ่ง–ฉับ · หน้าทับกลอง · ความเร็ว</b> ที่ตั้งไว้บนกระดาน เป็นค่าเริ่มต้นของเพลงนี้
              <span style={{color:'var(--muted)'}}> — ทุกคนกดเล่นในหน้าเพลงแล้วจะได้ยินตามนี้ทันที</span></span>
          </label>
        )}

        <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',marginTop:'1rem'}}>
          <button className="btn btn-jade" onClick={save} disabled={busy || (!dirty && !isNew)}>
            {isNew && !me.isAdmin ? '✓ ส่งทางนี้ — รอผู้ดูแล' : '✓ บันทึกโน้ต'}
          </button>
          <Link href={`/songs/${id}`}><button className="btn btn-outline">ยกเลิก</button></Link>
          <span style={{fontSize:'0.75rem',color:'var(--muted)'}}>
            {summary.verses || rows.length} วรรค{summary.warn ? ` · ⚑ ${summary.warn} จุดที่ระบบทักไว้` : ''}{dirty ? ' · ยังไม่ได้บันทึก' : ''}
          </span>
        </div>
        {msg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color: msg.startsWith('⚠') ? 'var(--danger)' : 'var(--jade)'}}>{msg}</div>}
      </div>
    </main>
  );
}
