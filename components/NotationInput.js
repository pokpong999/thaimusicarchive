'use client';
// components/NotationInput.js — กระดานโน้ตไทย (React wrapper ของ lib/notation-engine.js)
//
// <NotationInput
//    initialVerses={verses}        // จาก rowsToVerses(rows) หรือ textToVerses(text) · ไม่ใส่ = กระดานว่าง
//    initialText={text}            // ทางเลือก: ข้อความโน้ตแบบเก่า
//    options={{ base: 4, lineHong: 8, twoHands: false, level: 'สองชั้น', ensemble: 'sai',
//               readOnly: false,   // หน้าอนุมัติ: ดู + ฟังได้ แก้ไม่ได้
//               draftKey: 'new',   // บันทึกร่างอัตโนมัติใน localStorage (ไม่ใส่ = ไม่บันทึก)
//               staff: true }}     // ปุ่มเปิดโน้ตสากลใต้กระดาน (ค่าปริยาย true)
//    onChange={({ verses, base, lineHong, twoHands, ensemble, level }) => …}
// />
// ref (useRef): getVerses() getState() toText() loadText(t) loadVerses(v) stop() clearDraft()
import { useEffect, useImperativeHandle, useRef, useState, forwardRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { NotationEngine } from '../lib/notation-engine';
import { textToVerses, versesToRows, hasSound } from '../lib/notation-core';
import { loadGongSamples, playSampleNote } from '../lib/sampler';
import { parsePattern, playPercussion, loadDrumBank, loadNathabLibrary, nathabNames, findPattern, approvedRows } from '../lib/nathab';

const StaffNotation = dynamic(() => import('./StaffNotation'), { ssr: false });

// เสียงฆ้องจริงจาก Supabase Storage (ตัวเดียวกับเครื่องเล่นหน้าเพลง)
const AUDIO = {
  load: ctx => loadGongSamples(ctx),
  play: (ctx, buf, ch, reg, t, gain, shift) => playSampleNote(ctx, buf, ch, reg, t, gain, shift),
};
// หน้าทับกลองจากคลังหน้าทับกลาง (/nathab) — ตาราง nathab_patterns เฉพาะแถวที่อนุมัติแล้ว
const PERC = {
  load: async (ctx, instrument) => {
    // โหลดเสียงจริงของกลองที่เลือกและฉิ่งไว้ล่วงหน้า (ไม่มีไฟล์ = ใช้เสียงสังเคราะห์)
    if (ctx) {
      try { await Promise.all([loadDrumBank(ctx, instrument), loadDrumBank(ctx, 'ฉิ่ง')]); } catch (e) {}
    }
    return approvedRows(await loadNathabLibrary());
  },
  // หาแถวที่ตรงเครื่อง/อัตราที่สุด (ตกลงมาที่ 'ทุกอัตรา' หรือเครื่องตระกูลเดียวกันได้)
  find: (rows, nathab, level, instrument) => findPattern(rows, nathab, level, instrument),
  parse: parsePattern, play: playPercussion,
};

const DRAFT_PREFIX = 'thma-draft:';
function readDraft(key) { try { const s = localStorage.getItem(DRAFT_PREFIX + key); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function writeDraft(key, data) { try { localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ ...data, at: Date.now() })); } catch (e) {} }
function dropDraft(key) { try { localStorage.removeItem(DRAFT_PREFIX + key); } catch (e) {} }

const NotationInput = forwardRef(function NotationInput({ initialVerses, initialText, options = {}, onChange }, ref) {
  const rootRef = useRef(null);
  const engRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const draftKey = options.draftKey || null;
  const [draft, setDraft] = useState(null);
  const [showStaff, setShowStaff] = useState(false);
  const showStaffRef = useRef(false);
  const [staffRows, setStaffRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const versesRef = useRef([]);
  const rowIdxRef = useRef([]);   // ดัชนีวรรค → ดัชนีแถวใน staffRows (วรรคเงียบถูกข้าม = -1)
  const saveTimer = useRef(null);
  const setVersesRef = vs => {
    versesRef.current = vs; let k = 0;
    rowIdxRef.current = vs.map(v => hasSound(v) ? k++ : -1);
  };

  // step ของเอนจิน → {verseIdx, pos} สำหรับ StaffNotation
  const stepToCursor = useCallback(step => {
    if (step < 0) return null;
    let off = 0;
    for (let i = 0; i < versesRef.current.length; i++) {
      const len = versesRef.current[i].cells.length;
      if (step < off + len) { const ri = rowIdxRef.current[i]; return ri >= 0 ? { verseIdx: ri, pos: step - off } : null; }
      off += len;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!rootRef.current) return;
    const verses = initialVerses && initialVerses.length ? initialVerses
      : initialText ? textToVerses(initialText, { base: options.base || 4 }) : null;
    setVersesRef(verses || []);
    const eng = new NotationEngine(rootRef.current, {
      ...options, verses,
      audio: AUDIO,
      percussion: PERC,
      onPlayStep: step => setCursor(stepToCursor(step)),
      onChange: d => {
        setVersesRef(d.verses);
        if (onChangeRef.current) onChangeRef.current(d);
        if (draftKey && !options.readOnly) {
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            if (d.verses.some(hasSound)) writeDraft(draftKey, d); else dropDraft(draftKey);
          }, 600);
        }
        if (showStaffRef.current) setStaffRows(versesToRows(d.verses, { twoHands: d.twoHands }));
      },
    });
    engRef.current = eng;
    // รายชื่อหน้าทับใน dropdown "กลอง" มาจากคลังกลาง (ไม่ใช่ค่าตายตัว)
    loadNathabLibrary().then(rows => { if (engRef.current === eng) eng.setNathabOptions(nathabNames(rows)); }).catch(() => {});
    if (draftKey && !options.readOnly) {
      const d = readDraft(draftKey);
      if (d && d.verses && d.verses.some(hasSound)) setDraft(d);
    }
    return () => { clearTimeout(saveTimer.current); eng.destroy(); engRef.current = null; };
    // สร้างครั้งเดียวตอน mount — ข้อมูลเริ่มต้นเปลี่ยนทีหลังให้ใช้ ref.loadVerses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    showStaffRef.current = showStaff;
    if (showStaff && engRef.current) {
      const st = engRef.current.getState();
      setStaffRows(versesToRows(engRef.current.getVerses(), { twoHands: st.twoHands }));
    }
  }, [showStaff]);

  useImperativeHandle(ref, () => ({
    getVerses: () => engRef.current ? engRef.current.getVerses() : [],
    getState:  () => engRef.current ? engRef.current.getState() : {},
    toText:    () => engRef.current ? engRef.current.toText() : '',
    loadText:  t  => engRef.current ? engRef.current.loadText(t) : 0,
    loadVerses: v => { if (engRef.current) { engRef.current.setVerses(v); engRef.current.emit(); } },
    stop:      () => engRef.current && engRef.current.stopPlay(),
    clearDraft: () => { if (draftKey) dropDraft(draftKey); },
  }), [draftKey]);

  function restoreDraft() {
    const eng = engRef.current; if (!eng || !draft) return;
    Object.assign(eng.S, { base: draft.base || 4, lineHong: draft.lineHong || 8, twoHands: !!draft.twoHands,
      ensemble: draft.ensemble || 'sai', level: draft.level || 'สองชั้น' });
    eng.setVerses(draft.verses); eng.emit();
    setDraft(null);
  }
  function discardDraft() { if (draftKey) dropDraft(draftKey); setDraft(null); }

  const staffOn = options.staff !== false;
  return (
    <div>
      {draft && (
        <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',padding:'0.6rem 0.9rem',
          marginBottom:'0.6rem',background:'rgba(201,168,76,0.12)',border:'1px solid rgba(201,168,76,0.5)',borderRadius:'8px',fontSize:'0.82rem'}}>
          <span>📝 พบร่างที่ยังไม่ได้ส่ง ({draft.verses.filter(hasSound).length} วรรค · {new Date(draft.at).toLocaleString('th-TH')})</span>
          <button className="btn btn-primary btn-sm" type="button" onClick={restoreDraft}>กู้คืนร่าง</button>
          <button className="btn btn-outline btn-sm" type="button" onClick={discardDraft}>ทิ้งร่าง</button>
        </div>
      )}
      <div ref={rootRef} />
      {staffOn && (
        <div style={{marginTop:'0.6rem'}}>
          <button className="btn btn-outline btn-sm" type="button" onClick={() => setShowStaff(s => !s)}>
            {showStaff ? '▾ ซ่อนโน้ตสากล' : '▸ โน้ตสากล 5 เส้น'}
          </button>
          {showStaff && (
            <div style={{marginTop:'0.6rem'}}>
              {staffRows.length
                ? <StaffNotation verses={staffRows} cursor={cursor} />
                : <div style={{fontSize:'0.8rem',color:'var(--muted)'}}>ยังไม่มีโน้ต</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default NotationInput;
