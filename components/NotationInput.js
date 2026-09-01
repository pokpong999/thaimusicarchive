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
// ref (useRef): getVerses() getState() toText() loadText(t) loadVerses(v) stop() clearDraft() openImport()
import { useEffect, useImperativeHandle, useRef, useState, forwardRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { NotationEngine } from '../lib/notation-engine';
import NotationImport from './NotationImport';
import NotationPad from './NotationPad';
import { textToVerses, versesToRows, hasSound } from '../lib/notation-core';
import { loadMelodyBank, playMelodyNote } from '../lib/melodybank';
import { loadInstruments } from '../lib/instruments';
import { loadTunings, loadInstrumentNotes, notesToHzMap } from '../lib/tuning';
import { parsePattern, playPercussion, playHit, loadSetBanks, loadDrumBank, loadNathabLibrary, nathabNames, findPattern, approvedRows, DRUMS, drumLabel } from '../lib/nathab';
import { usePermissions } from './Gate';
import { applyBoardGates } from '../lib/perms';

const StaffNotation = dynamic(() => import('./StaffNotation'), { ssr: false });

// เสียงเครื่องดนตรีจริงจาก Supabase Storage — เครื่องไหนก็ได้ตามทะเบียน instruments (2026-08-26)
//   เสียงที่ยังไม่มีไฟล์ ระบบขยับระดับเสียงจากตัวที่ใกล้ที่สุดให้เอง (lib/melodybank.js)
const AUDIO = {
  load: async (ctx, inst) => {
    let it = inst;
    if (!it || typeof it === 'string') {
      const list = await loadInstruments({ kind: 'melody' });
      it = list.find(x => x.slug === inst) || list[0] || null;
    }
    return it ? loadMelodyBank(ctx, it) : null;
  },
  play: (ctx, bank, ch, reg, t, gain, shift, inst, tune) => playMelodyNote(ctx, bank, ch, reg, t, gain, shift, inst?.transpose || 0, tune),
  // ความถี่จริงรายตำแหน่งที่ผู้ดูแลกรอกไว้ในตาราง instrument_notes
  notes: async slug => notesToHzMap(await loadInstrumentNotes(slug)),
};
// หน้าทับกลองจากคลังหน้าทับกลาง (/nathab) — ตาราง nathab_patterns เฉพาะแถวที่อนุมัติแล้ว
const PERC = {
  load: async (ctx, instrument) => {
    // โหลดเสียงจริงของกลองที่เลือกและฉิ่งไว้ล่วงหน้า (ไม่มีไฟล์ = ใช้เสียงสังเคราะห์)
    if (ctx) {
      try { await loadSetBanks(ctx, instrument, { ching: true }); } catch (e) {}
    }
    return approvedRows(await loadNathabLibrary());
  },
  // หาแถวที่ตรงเครื่อง/อัตราที่สุด (ตกลงมาที่ 'ทุกอัตรา' หรือเครื่องตระกูลเดียวกันได้)
  find: (rows, nathab, level, instrument) => findPattern(rows, nathab, level, instrument),
  parse: parsePattern, play: playPercussion,
  // เล่น hit ของชุดหลายบรรทัด (h.voice บอกว่าเป็นบรรทัดไหน → โฟลเดอร์เสียงของใบนั้น)
  playHit: (ctx, instrument, h, t, gain) => playHit(ctx, instrument, h, t, gain),
};

const DRAFT_PREFIX = 'thma-draft:';
function readDraft(key) { try { const s = localStorage.getItem(DRAFT_PREFIX + key); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function writeDraft(key, data) { try { localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify({ ...data, at: Date.now() })); } catch (e) {} }
function dropDraft(key) { try { localStorage.removeItem(DRAFT_PREFIX + key); } catch (e) {} }

const NotationInput = forwardRef(function NotationInput({ initialVerses, initialText, options = {}, onChange }, ref) {
  const { can, loading: permsLoading } = usePermissions();
  const rootRef = useRef(null);
  const engRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const draftKey = options.draftKey || null;
  const [draft, setDraft] = useState(null);
  const [showStaff, setShowStaff] = useState(false);
  const [showImport, setShowImport] = useState(false);   // 📥 นำเข้าไฟล์ / แปลงโน้ต (2026-08-25)
  const showStaffRef = useRef(false);
  const [staffRows, setStaffRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const versesRef = useRef([]);
  const rowIdxRef = useRef([]);   // ดัชนีวรรค → ดัชนีแถวใน staffRows (วรรคเงียบถูกข้าม = -1)
  const saveTimer = useRef(null);
  const pendingRef = useRef(null);      // ร่างที่ยังไม่ได้เขียนลง localStorage
  const initialRef = useRef(null);      // โน้ตตั้งต้นจากฐาน (ไว้ย้อนกลับถ้าไม่เอาร่าง)
  const hideRef = useRef(null);
  const flushDraft = () => {
    const d = pendingRef.current; if (!d || !draftKey) return;
    pendingRef.current = null;
    if (d.verses.some(hasSound)) writeDraft(draftKey, d); else dropDraft(draftKey);
  };
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
          // เก็บร่างเร็ว (250 ms) + flush ทันทีตอนปิด/รีเฟรชหน้า (pagehide) — เผลอกดรีเฟรชแล้วโน้ตไม่หาย
          pendingRef.current = d;
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => { flushDraft(); }, 250);
        }
        if (showStaffRef.current) setStaffRows(versesToRows(d.verses, { lines: d.lines, system: d.system }));
      },
    });
    engRef.current = eng;
    initialRef.current = verses || null;
    // เผลอรีเฟรช/ปิดแท็บ: เซฟร่างที่ค้างอยู่ทันที
    const onHide = () => flushDraft();
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    hideRef.current = onHide;
    // รายชื่อหน้าทับใน dropdown "กลอง" มาจากคลังกลาง (ไม่ใช่ค่าตายตัว)
    loadNathabLibrary({ force: true }).then(rows => { if (engRef.current === eng) eng.setNathabOptions(nathabNames(rows)); }).catch(() => {});
    eng.setDrumOptions(DRUMS.map(d => [d, drumLabel(d)]));
    // ตัวเลือก "เสียง" = เครื่องดำเนินทำนองทุกตัวในทะเบียน (เพิ่มเครื่องใหม่ในฐานแล้วโผล่ที่นี่ทันที)
    loadInstruments({ kind: 'melody', force: true })
      .then(list => { if (engRef.current === eng) eng.setSourceOptions(list.map(i => ({ slug: i.slug, name_th: i.name_th, transpose: i.transpose || 0, note_count: i.note_count, tuning: i.tuning || null })), { pick: options.instrument }); })
      .catch(() => {});
    // ตัวเลือก "เสียงตั้ง" = ชุดความถี่ในตาราง tunings (ตารางกรมศิลปากร 2 ชุดเป็นค่าตั้งต้น)
    loadTunings({ force: true })
      .then(list => { if (engRef.current === eng) eng.setTuningOptions(list, { pick: options.tuning }); })
      .catch(() => {});
    if (draftKey && !options.readOnly) {
      const d = readDraft(draftKey);
      if (d && d.verses && d.verses.some(hasSound)) {
        // กู้คืนร่างให้เลย (Pk 2026-08-25: เผลอรีเฟรชแล้วต้องได้โน้ตกลับมาเหมือนเดิม) — มีปุ่มกลับไปใช้ของเดิมจากฐานถ้าไม่ต้องการ
        // (S.base/S.lineHong เป็น getter — ต้องตั้งผ่าน ta/rap ไม่งั้น throw · บั๊กเดิมของปุ่ม "กู้คืนร่าง")
        const ta = d.ta || d.base || 4;
        Object.assign(eng.S, { ta, rap: d.rap != null ? d.rap : Math.max(0, (d.lineHong || 8) - ta), twoHands: !!d.twoHands,
          ensemble: d.ensemble || 'sai', level: d.level || 'สองชั้น' });
        eng.syncControls();
        eng.setVerses(d.verses); eng.emit();
        setDraft(d);
      }
    }
    return () => { clearTimeout(saveTimer.current); flushDraft(); window.removeEventListener('pagehide', onHide); window.removeEventListener('beforeunload', onHide); eng.destroy(); engRef.current = null; };
    // สร้างครั้งเดียวตอน mount — ข้อมูลเริ่มต้นเปลี่ยนทีหลังให้ใช้ ref.loadVerses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── สิทธิ์บนกระดาน: ซ่อนปุ่มที่บัญชีนี้ไม่มีสิทธิ์ใช้ (Pk 27 ส.ค. 69) ──
  //   กระดานเป็น HTML ที่เอนจินสร้างเอง จึงคุมด้วย selector ใน lib/perms.js
  //   ทำใหม่ทุกครั้งที่สิทธิ์เปลี่ยน เพราะตารางสิทธิ์เป็น realtime
  useEffect(() => {
    if (permsLoading || !rootRef.current) return;
    applyBoardGates(rootRef.current, can);
    // เอนจินวาดแถบเครื่องมือใหม่ได้ระหว่างใช้งาน — เฝ้าดูแล้วทากฎซ้ำ
    const mo = new MutationObserver(() => applyBoardGates(rootRef.current, can));
    mo.observe(rootRef.current, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [permsLoading, can]);

  useEffect(() => {
    showStaffRef.current = showStaff;
    if (showStaff && engRef.current) {
      const st = engRef.current.getState();
      setStaffRows(versesToRows(engRef.current.getVerses(), { lines: st.lines, system: st.system }));
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
    openImport: () => setShowImport(true),           // เปิดหน้าต่างนำเข้าไฟล์/แปลงโน้ต
  }), [draftKey]);

  // ไม่เอาร่าง → กลับไปใช้โน้ตตั้งต้นจากฐาน และลบร่างทิ้ง
  function discardDraft() {
    const eng = engRef.current;
    if (draftKey) dropDraft(draftKey);
    pendingRef.current = null;
    if (eng) { eng.setVerses(initialRef.current); eng.emit(); }
    // emit ข้างบนจะเขียนร่างใหม่จากโน้ตตั้งต้น — ลบทิ้งอีกรอบหลัง debounce
    setTimeout(() => { if (draftKey) dropDraft(draftKey); pendingRef.current = null; }, 400);
    setDraft(null);
  }

  // ── แป้นพิมพ์โน้ตสำหรับมือถือ (Pk 28 ส.ค. 69) ──
  //   เปิดเองเมื่อจอแคบและเป็นจอสัมผัส · ปิด/เปิดด้วยมือได้ตลอด
  const [padOn, setPadOn] = useState(false);
  const [padTick, setPadTick] = useState(0);
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (options.readOnly) return;
    let t = false;
    try { t = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 820; } catch (e) {}
    setTouch(t);
    setPadOn(t);
  }, [options.readOnly]);
  // กระดานขยับเมื่อไหร่ ให้แถบบอกตำแหน่งบนแป้นอัปเดตตาม
  useEffect(() => {
    if (!padOn || !rootRef.current) return;
    const bump = () => setPadTick(x => x + 1);
    const el = rootRef.current;
    el.addEventListener('click', bump);
    const mo = new MutationObserver(bump);
    mo.observe(el, { subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => { el.removeEventListener('click', bump); mo.disconnect(); };
  }, [padOn]);

  const staffOn = options.staff !== false;
  return (
    <div>
      {draft && (
        <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',padding:'0.5rem 0.9rem',
          marginBottom:'0.6rem',background:'rgba(76,154,132,0.12)',border:'1px solid rgba(76,154,132,0.5)',borderRadius:'8px',fontSize:'0.8rem'}}>
          <span>⟲ กู้คืนโน้ตที่พิมพ์ค้างไว้ให้แล้ว ({draft.verses.filter(hasSound).length} วรรค · บันทึกล่าสุด {new Date(draft.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.) — ยังไม่ได้ส่งเข้าฐาน</span>
          <button className="btn btn-outline btn-sm" type="button" onClick={discardDraft} title="ทิ้งร่างนี้ กลับไปใช้โน้ตตามที่อยู่ในฐานข้อมูล">ไม่เอาร่าง ใช้ของเดิมจากฐาน</button>
          <button className="btn btn-outline btn-sm" type="button" onClick={() => setDraft(null)} title="ซ่อนข้อความนี้ ร่างยังอยู่">ตกลง</button>
        </div>
      )}
      <div ref={rootRef} />

      {/* ปุ่มเรียกแป้นมือถือ — โผล่เมื่อเป็นจอสัมผัสหรือจอแคบ */}
      {!options.readOnly && touch && !padOn && (
        <button className="btn btn-primary btn-sm" type="button" data-padopen
          onClick={() => setPadOn(true)} style={{marginTop:'0.5rem'}}>
          ⌨ เปิดแป้นพิมพ์โน้ต
        </button>
      )}
      {!options.readOnly && padOn && (
        <NotationPad eng={engRef.current} open tick={padTick} onClose={() => setPadOn(false)} />
      )}
      {staffOn && (
        <div style={{marginTop:'0.6rem'}}>
          <button className="btn btn-outline btn-sm" type="button" onClick={() => setShowStaff(s => !s)}>
            {showStaff ? '▾ ซ่อนโน้ตสากล' : '▸ โน้ตสากล 5 เส้น'}
          </button>
          {!options.readOnly && can('board_import') && (
            <button className="btn btn-outline btn-sm" type="button" style={{marginLeft:8}} onClick={() => setShowImport(true)}
              title="นำเข้าจาก PDF / Word / Excel / รูปภาพ / MusicXML / MIDI · แปลงเป็นโน้ตสากล">📥 นำเข้าไฟล์ / 🔁 แปลงโน้ต</button>
          )}
          {showImport && (
            <NotationImport open onClose={() => setShowImport(false)}
              base={options.base || 4} lineHong={options.lineHong || 8}
              getVerses={() => engRef.current ? engRef.current.getVerses() : []}
              onImport={(vs, { mode }) => {
                const eng = engRef.current; if (!eng) return;
                eng.pushUndo();
                const cur = eng.getVerses().filter(hasSound);
                eng.setVerses(mode === 'append' && cur.length ? [...cur, ...vs] : vs);
                eng.emit();
              }} />
          )}
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
