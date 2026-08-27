'use client';
import { usePermissions } from './Gate';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { loadMelodyBank, playMelodyNote } from '../lib/melodybank';
import { loadInstruments } from '../lib/instruments';
import { loadTunings, loadInstrumentNotes, notesToHzMap, tuningBySlug, tuningForEnsemble, hzOf, DEFAULT_TUNING } from '../lib/tuning';
import { CHING_PATTERNS, DRUMS, drumLabel, parsePattern, playPercussion, playHit, loadSetBanks, loadDrumBank,
         loadNathabLibrary, nathabNames, findPattern, planSongNathab } from '../lib/nathab';
const TH_COLS = ['ด','ร','ม','ฟ','ซ','ล','ท'];
const TH_ROWS = { '-1': 'zxcvbnm', '0': 'asdfghj', '1': 'qwertyu' };
const noteKey = n => TH_ROWS[String(n.register ?? 0)]?.[TH_COLS.indexOf(n.ch)] ?? n.ch;
const StaffNotation = dynamic(() => import('./StaffNotation'), { ssr: false });

const NOTE_STEP = { 'ด':0, 'ร':1, 'ม':2, 'ฟ':3, 'ซ':4, 'ล':5, 'ท':6 };
const BASE_FREQ = 261.63;
const LOW_MARK = '\u0E3A';
const HIGH_MARK = '\u0E4D';
import { buildVoices, SABAT_GAP_DEFAULT, kroSpans, kroStrikes, KRO_GAP_DEFAULT, DAMP_DUR_DEFAULT, CHAR_MARK,
  HAND_BIT, DAMP_ALL, pairLead } from '../lib/notation-core';
import { tempoPlan, TEMPO_DEFAULTS, MODE_LABEL, halfCycleOfLevel, bpmAt, isContinuousSection, CONTINUOUS_WHY } from '../lib/tempo';
import { linesOf, systemForLines, systemOf } from '../lib/notation-systems';
import { TANGS, tangOf, pentaText, shiftBetween, bestShift, ensembleOffset, guessTang } from '../lib/tang';
import { stepOf, noteOfStep } from '../lib/instruments';
const SABAT_DEFAULT = SABAT_GAP_DEFAULT; // 80 ms — ค่าเดียวกับกระดานโน้ต (Pk เคาะ 2026-08-24)

function noteFreq(ch, register) {
  const step = NOTE_STEP[ch];
  if (step == null) return null;
  return BASE_FREQ * Math.pow(2, (step + register * 7) / 7);
}

function parseToken(token) {
  const notes = [];
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (NOTE_STEP[ch] != null) {
      let register = 0;
      if (token[i+1] === LOW_MARK) { register = -1; i++; }
      else if (token[i+1] === HIGH_MARK) { register = 1; i++; }
      notes.push({ ch, register });
    }
  }
  return notes;
}

// วรรคยาวตามจริง — ไม่บังคับ 4 ห้อง (รองรับ 1-2 ห้อง เช่นเพลงชั้นเดียว)
export function parseVerse(str) {
  if (!str) return [];
  const positions = [];
  const hongs = str.split('|');
  for (const hong of hongs) {
    const tokens = hong.trim().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) continue;
    const cells = tokens.map(t => t === '-' ? [] : parseToken(t));
    while (cells.length < 4) cells.push([]);
    positions.push(...cells.slice(0, 4));
  }
  return positions;
}

function padTo(arr, len) {
  const out = arr.slice();
  while (out.length < len) out.push([]);
  return out;
}

function synthNote(ctx, freq, time, dur, gain = 0.45) {
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine'; osc.frequency.value = freq;
  osc2.type = 'sine'; osc2.frequency.value = freq * 3.02;
  const g2 = ctx.createGain(); g2.gain.value = 0.18;
  osc.connect(g); osc2.connect(g2); g2.connect(g);
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.start(time); osc.stop(time + dur + 0.05);
  osc2.start(time); osc2.stop(time + dur + 0.05);
}

const REG_LABEL = { '-1': 'ต่ำ', '0': 'กลาง', '1': 'สูง' };

// nathabRules = แถว song_nathab ของเพลงนี้ (หน้าทับหลัก + ข้อยกเว้นต่อท่อน) — ถ้ามี เครื่องเล่นเลือกโหมด "ตามที่เพลงกำหนด" ให้เอง
export default function NotationPlayer({ verses, lyrics, nathabRules = [] }) {
  const { can } = usePermissions();
  const [mode, setMode] = useState('combined');
  const [hand, setHand] = useState('both');
  const [sound, setSound] = useState('real');          // 'synth' หรือ slug เครื่องดนตรี ('real' = ยังไม่รู้ → ใช้เครื่องแรกในทะเบียน)
  const [insts, setInsts] = useState([]);              // ทะเบียนเครื่องดำเนินทำนอง (โหลดสดจากฐาน)
  const [tang, setTang] = useState(null);              // ทางที่ผู้ฟังเลือก (null = ตามที่เพลงบันทึก)
  const [tangView, setTangView] = useState('fix');     // fix = ตรึงโน้ต · real = ย้ายโน้ตจริง
  // จังหวะไม่สม่ำเสมอ: เร่งขึ้นทั้งท่อน + จบท่อนแบบถอน/ทอด (Pk 27 ส.ค. 69)
  //   ค่าเริ่มต้นปิดไว้ = จังหวะสม่ำเสมอเหมือนเดิมทุกประการ
  const [tempoOn, setTempoOn] = useState(false);
  const [tempoOpts, setTempoOpts] = useState({ accel: TEMPO_DEFAULTS.accel, accelThon: TEMPO_DEFAULTS.accelThon,
                                               thonRatio: TEMPO_DEFAULTS.thonRatio, thotRatio: TEMPO_DEFAULTS.thotRatio });
  const [secModes, setSecModes] = useState({});        // หมายเลขบล็อกท่อน → '' | 'thon' | 'thot'
  const [tunes, setTunes] = useState([]);              // ชุดความถี่ในตาราง tunings
  const [tuning, setTuning] = useState(DEFAULT_TUNING); // slug ของชุดที่เลือก
  const [sabatGap, setSabatGap] = useState(SABAT_DEFAULT);
  const [kroGap, setKroGap] = useState(KRO_GAP_DEFAULT);   // ความถี่การกรอ (วินาทีต่อไม้)
  const [bpm, setBpm] = useState(120);
  const [hongsPerLine, setHongsPerLine] = useState(8);
  const [nathab, setNathab] = useState('none');       // none | auto (ตามที่เพลงกำหนด) | ชื่อหน้าทับในคลัง
  const [libNames, setLibNames] = useState([]);       // ชื่อหน้าทับทั้งหมดในคลังกลาง (/nathab)
  const nathabTouchedRef = useRef(false);
  useEffect(() => { loadNathabLibrary({ force: true }).then(rows => setLibNames(nathabNames(rows))).catch(() => {}); }, []);
  // เครื่องดำเนินทำนองทั้งหมดในทะเบียน — เพิ่มเครื่อง/อัปเสียงใหม่แล้วเลือกได้ทันที
  useEffect(() => { loadInstruments({ kind: 'melody', force: true }).then(list => {
    setInsts(list);
    setSound(cur => (cur === 'real' && list.length) ? list[0].slug : cur);
  }).catch(() => {}); }, []);   // โหลดสดทุกครั้งที่เปิดเครื่องเล่น → หน้าทับที่เพิ่งสร้างเลือกได้ทันที
  // ระบบเสียง (ความถี่จริง) — เพิ่มชุดใหม่ในฐานแล้วเลือกได้ที่นี่ทันที
  useEffect(() => { loadTunings({ force: true }).then(list => {
    setTunes(list);
    // ถ้าโน้ตชุดนี้ระบุระบบเสียงไว้เอง ใช้ของเพลงก่อน (sql/21 · Pk 27 ส.ค. 69)
    const declared = (verses ?? []).find(v => v.tuning)?.tuning;
    setTuning(cur => (declared && list.some(t => t.slug === declared)) ? declared
      : (list.some(t => t.slug === cur) ? cur : (list.find(t => t.is_default) || list[0])?.slug || DEFAULT_TUNING));
  }).catch(() => {}); }, [verses]);
  // ── ค่าเริ่มต้นของเพลง (Pk 2026-08-26) ──
  // เพลงที่บันทึกฉิ่ง/กลอง/ความเร็วไว้แล้ว → กดเล่นแล้วต้องได้ยินตามนั้นทันที "กับผู้ฟังทุกคน"
  // (หน้าทับที่เพลงกำหนดไว้ไม่ติดสิทธิ์ player_perc — สิทธิ์คุมแค่การ "เลือกหน้าทับเอง")
  const songDefaultsRef = useRef(false);
  useEffect(() => {
    if (!nathabRules?.length || songDefaultsRef.current) return;
    songDefaultsRef.current = true;
    const main = nathabRules.find(r => !r.section);
    if (!nathabTouchedRef.current && (main?.nathab && main.nathab !== '-' || nathabRules.some(r => r.section))) setNathab('auto');
    if (main?.drum && DRUMS.includes(main.drum)) setDrumInst(main.drum);
    if (main?.level) setLevel(main.level);
    if (main?.ching) setChingOn(true);
    if (main?.bpm) setBpm(main.bpm);
  }, [nathabRules]);
  const [drumInst, setDrumInst] = useState('ตะโพน');
  const [level, setLevel] = useState('สองชั้น');
  const [chingOn, setChingOn] = useState(false);
  // การกลับต้น: none = เที่ยวเดียว · section = กลับต้นทุกท่อน (ท่อนละ 2 เที่ยว)
  //             piece = กลับต้นเที่ยวใหญ่ (ทั้งเพลง 2 เที่ยว) · loop = วนไปเรื่อย ๆ
  const [repeat, setRepeat] = useState('none');
  const playStateRef = useRef('stopped');
  const playRef = useRef(null);
  const togglePauseRef = useRef(null);
  useEffect(() => {
    function onKey(e) {
      if (e.code !== 'Space' || e.repeat) return;
      const t = e.target;
      if (t && ['INPUT','SELECT','TEXTAREA','BUTTON'].includes(t.tagName)) return;
      e.preventDefault();
      if (playStateRef.current === 'stopped') playRef.current?.();
      else togglePauseRef.current?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const defaultedRef = useRef(false);
  useEffect(() => {
    if (defaultedRef.current || !verses?.length) return;
    defaultedRef.current = true;
    const has3 = verses.some(v => (v.third_hand ?? '').trim());
    const hasHands = verses.some(v => (v.right_hand ?? '').trim() || (v.left_hand ?? '').trim());
    if (has3 && can('player_khim')) setMode('khim');
    else if (hasHands && can('player_hands')) setMode('hands');
  }, [verses, can]);

  useEffect(() => {
    if (!can('player_staff') && mode === 'staff') setMode('combined');
    if (!can('player_hands') && mode === 'hands') setMode('combined');
    if (!can('player_khim') && mode === 'khim') setMode('combined');
    if (!can('player_vocal') && mode === 'vocal') setMode('combined');
    if (!can('player_real') && sound === 'real') setSound('synth');
    // 'auto' = หน้าทับที่เจ้าของเพลงบันทึกไว้ — เล่นให้ทุกคน · สิทธิ์คุมเฉพาะการเลือกหน้าทับเอง
    if (!can('player_perc') && nathab !== 'none' && nathab !== 'auto') setNathab('none');
    if (nathab === 'auto' && !nathabRules?.length) setNathab('none');
  }, [can, mode, sound, nathab, nathabRules]);

  const [playState, setPlayState] = useState('stopped');
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [sampleCount, setSampleCount] = useState(null);
  // เคอร์เซอร์: อัปเดต DOM ตรง ๆ (ไม่ผ่าน React state) — เพลงยาวหลายพันช่อง re-render ทุกจังหวะทำให้กระตุก/ค้าง
  // React state ใช้เฉพาะโหมดโน้ตสากล (StaffNotation ต้องการ prop)
  const [cursor, setCursor] = useState(null);
  const gridRef = useRef(null);
  const modeRef = useRef(mode); modeRef.current = mode;
  const cursorElsRef = useRef([]);
  const cursorLineRef = useRef(null);
  const moveCursor = c => {
    cursorElsRef.current.forEach(el => el.classList.remove('np-on'));
    cursorElsRef.current = [];
    if (modeRef.current === 'staff') { setCursor(c); return; }
    if (!c) { cursorLineRef.current = null; return; }
    const root = gridRef.current; if (!root) return;
    const els = root.querySelectorAll(`[data-cell="${c.verseIdx}-${c.pos}"]`);
    els.forEach(el => el.classList.add('np-on'));
    cursorElsRef.current = Array.from(els);
    // เลื่อนหน้าให้เห็นบรรทัดที่กำลังเล่น (เฉพาะเมื่อเปลี่ยนบรรทัดและบรรทัดนั้นอยู่นอกจอ)
    const line = els[0]?.closest('[data-line]') ?? null;
    if (line && line !== cursorLineRef.current) {
      cursorLineRef.current = line;
      const r = line.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) line.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };
  const ctxRef = useRef(null);
  const stopRef = useRef(null);
  // สลับแท็บ/พับหน้าจอ = เล่นต่อ (Pk 27 ส.ค. 69) — เดิมสั่งหยุดทันทีที่ document.hidden
  //   ปิดหน้าต่าง/ออกจากหน้าเพลงยังหยุดเหมือนเดิม
  useEffect(() => {
    function onLeave() { stopRef.current?.(); }
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      stopRef.current?.();          // ออกจากหน้าเพลง = หยุดเสียงเสมอ
    };
  }, []);

  const buffersRef = useRef(null);
  const rafRef = useRef(null);
  const driverRef = useRef(null);      // ตัวขับเสียง (setInterval) — ทำงานต่อแม้แท็บถูกพับ
  const playIdRef = useRef(0);

  // ── แปลงโน้ตทุกวรรคครั้งเดียว: ความยาวจริงต่อวรรค + offset สะสม ──
  // ── แปลงโน้ตทุกวรรคครั้งเดียว: ความยาวจริงต่อวรรค + offset สะสม ──
  //   แยกเป็นสองชั้น: baseParsed = โน้ตตามที่บันทึก (แพงที่สุด ทำครั้งเดียว)
  //   แล้วค่อยเลื่อนทางทีหลัง — ห้าม parse ซ้ำ ไม่งั้นเพลงยาวเฟรมค้าง
  const baseParsed = useMemo(() => {
    let offset = 0;
    return (verses ?? []).map(v => {
      const cb = parseVerse(v.combined);
      const rh = parseVerse(v.right_hand);
      const lh = parseVerse(v.left_hand);
      const xh = parseVerse(v.third_hand);
      const len = Math.max(cb.length, rh.length, lh.length, xh.length, 4);
      // เครื่องหมายวิธีบรรเลง (song_melody.marks · sql/19+20)
      //   marks[i] = 'kro' กรอ (รายตำแหน่ง) · damp[i] = เลขบิตของแนวที่ประคบ (r1 l2 x4 · 'ป' เดิม = ทุกแนว)
      const marks = new Array(len).fill('');
      const damp = new Array(len).fill(0);
      if (v.marks) [...String(v.marks)].forEach((c, i) => {
        if (i >= len) return;
        if (c === 'ก') marks[i] = 'kro';
        else if (c === 'ป') damp[i] = DAMP_ALL;
        else if (c >= '1' && c <= '7') damp[i] = +c;
      });
      const item = {
        v, len, offset, marks, damp,
        cb: padTo(cb, len), rh: padTo(rh, len), lh: padTo(lh, len), xh: padTo(xh, len),
        useHands: !!(v.right_hand || v.left_hand || v.third_hand),
      };
      offset += len;
      return item;
    });
  }, [verses]);

  // ── ทาง: หา "ทางบ้าน" ของโน้ตชุดนี้ แล้วคิดว่าต้องเลื่อนกี่ขั้น ──
  const ensNow = useMemo(() => {
    const declared = (verses ?? []).find(v => v.ensemble)?.ensemble;
    if (declared === 'piphat' || declared === 'khrueangsai') return declared;
    const t = tunes.find(x => x.slug === tuning);
    return (t?.ensemble === 'piphat') ? 'piphat' : 'khrueangsai';
  }, [verses, tunes, tuning]);
  const allSteps = useMemo(() => {
    const out = [];
    baseParsed.forEach(p => ['cb', 'rh', 'lh', 'xh'].forEach(k =>
      p[k].forEach(cell => cell.forEach(n => out.push(stepOf(n.ch, n.register || 0))))));
    return out;
  }, [baseParsed]);
  // ทางที่ผู้ถอดโน้ตระบุไว้มาก่อนการเดาเสมอ — เดาผิดทีเสียงเพี้ยนทั้งเพลง (Pk 27 ส.ค. 69)
  const declaredTang = useMemo(() => {
    const v = (verses ?? []).find(x => x.tang != null && +x.tang >= 1 && +x.tang <= 7);
    return v ? +v.tang : null;
  }, [verses]);
  const homeTang = useMemo(() => declaredTang
    ?? (allSteps.length ? (guessTang(allSteps, { ens: ensNow })[0]?.no ?? 2) : 2), [declaredTang, allSteps, ensNow]);
  //   ตรึงโน้ต → โน้ตไม่ขยับ เลื่อนแค่เสียง · ย้ายโน้ตจริง → ขยับตัวอักษร (เลือกทิศให้อยู่ช่วงเดิม) เสียงตามไปเอง
  const tangShift = tang == null ? 0 : shiftBetween(homeTang, tang);
  const viewShift = (tangView === 'real' && tangShift) ? bestShift(allSteps, tangShift) : 0;
  const soundShift = tangView === 'real' ? 0 : tangShift;

  const parsed = useMemo(() => {
    if (!viewShift) return baseParsed;
    const mv = cells => cells.map(c => c.map(n => {
      const o = noteOfStep(stepOf(n.ch, n.register || 0) + viewShift);
      return { ...n, ch: o.ch, register: o.reg };
    }));
    return baseParsed.map(p => ({ ...p, cb: mv(p.cb), rh: mv(p.rh), lh: mv(p.lh), xh: mv(p.xh) }));
  }, [baseParsed, viewShift]);

  const totalSteps = parsed.length ? parsed[parsed.length-1].offset + parsed[parsed.length-1].len : 0;

  // เครื่องหมายวิธีบรรเลงสำหรับวาดบนตาราง (Pk 27 ส.ค.):
  //   ประคบ = ตัวหนา แยกอิสระรายมือ · กรอ = คลื่นเหนือ "โน้ตตัวที่กรอ" ตัวเดียว ไม่ลากไปหาเสียงถัดไป
  //   (ตอนเล่นยังกรอยาวถึงเสียงถัดไปเหมือนเดิม — เปลี่ยนแค่การแสดงผล)
  const marksView = useMemo(() => {
    const markOf = st => { const pv = parsed.find(p => st >= p.offset && st < p.offset + p.len); return pv ? (pv.marks?.[st - pv.offset] || '') : ''; };
    const dampOf = st => { const pv = parsed.find(p => st >= p.offset && st < p.offset + p.len); return pv ? (pv.damp?.[st - pv.offset] || 0) : 0; };
    const notesOf = st => {
      const pv = parsed.find(p => st >= p.offset && st < p.offset + p.len);
      if (!pv) return [];
      const i = st - pv.offset;
      return ['cb', 'rh', 'lh', 'xh'].flatMap(k => (pv[k][i] || []).map(n => ({ ch: n.ch, reg: n.register || 0 })));
    };
    const cover = new Set();
    kroSpans({ total: totalSteps, markOf, notesOf }).forEach(sp => cover.add(sp.start));
    return { markOf, dampOf, cover };
  }, [parsed, totalSteps]);

  useEffect(() => () => {
    playIdRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) ctxRef.current.close().catch(() => {});
  }, []);

  async function startFrom(startStep) {
    const tuneNow = tuningBySlug(tunes, tuning);
    playIdRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); }
    ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = ctxRef.current;
    await ctx.resume();

    const instNow = insts.find(i => i.slug === sound) || (sound !== 'synth' ? insts[0] : null);
    // ไฟล์เสียงของเครื่องนี้ตั้งไว้ตามระบบไหน + ความถี่จริงรายตำแหน่งที่ผู้ดูแลกรอกไว้
    const tuneOpts = { tuning: tuneNow,
      srcTuning: instNow?.tuning ? tuningBySlug(tunes, instNow.tuning) : null,
      hzMap: instNow ? notesToHzMap(await loadInstrumentNotes(instNow.slug)) : null };
    let buffers = buffersRef.current;
    if (instNow && !buffers) {
      setLoadingSamples(true);
      buffers = await loadMelodyBank(ctx, instNow);
      buffersRef.current = buffers;
      setSampleCount(buffers?.count ?? 0);
      setLoadingSamples(false);
    }
    const useReal = !!instNow && !!buffers?.count;

    const myId = ++playIdRef.current;
    setPlayState('playing');

    const stepDur = 60 / bpm / 2;
    // เผื่อเวลาเปิดเพลง 0.25 วิ — ตัวนำของสะบัดในตำแหน่งแรกต้องนัดก่อน t0 ได้ (เพลงยาวใช้เวลานัดหลายสิบ ms)
    const t0 = ctx.currentTime + 0.25;
    const cursorTimeline = [];
    // คิวเสียง: ทยอยนัดล่วงหน้าเป็นช่วงๆ แทนการนัดทั้งเพลงทีเดียว (เพลงยาวหมื่นโน้ตจะพัง)
    const soundEvents = [];
    const q = (t, fn) => { if (Number.isFinite(t)) soundEvents.push({ t, fn }); };

    // vel = น้ำหนักมือ (สะบัดตัวนำเบากว่าตัวลง)
    function scheduleNote(n, noteTime, vel = 1, damp = false) {
      let played = false;
      if (useReal) played = playMelodyNote(ctx, buffers, n.ch, n.register, noteTime, 0.85 * vel, soundShift, instNow.transpose || 0,
        { ...tuneOpts, damp, dampDur: DAMP_DUR_DEFAULT });
      if (!played) {
        const o = noteOfStep(stepOf(n.ch, n.register || 0) + soundShift);
        const f = hzOf(tuneNow, o.ch, o.reg);   // ความถี่จริงตามระบบเสียง + ทางที่เลือก
        if (f) synthNote(ctx, f, noteTime, damp ? DAMP_DUR_DEFAULT : stepDur * 2.2, 0.45 * vel);
      }
    }

    // ── เรียงโน้ตทุกวรรคเป็นแถวเดียวยาวตลอดเพลง (2 แถว = 2 มือ) ──
    // ทำให้สะบัดที่อยู่ตำแหน่งแรกของวรรค ดึงตัวนำจากตำแหน่งสุดท้ายของวรรคก่อนได้
    // และสะบัดตรงจุดที่กดเล่น (seek) ยังได้ตัวนำจากห้องก่อนหน้า แม้ห้องนั้นไม่ถูกเล่น
    const has3 = parsed.some(pv => pv.xh.some(c => c.length));
    const G = has3 ? [[], [], []] : [[], []];
    parsed.forEach((pv, vi) => {
      const ls = !pv.useHands ? [pv.cb, null, null]
        : hand === 'R' ? [pv.rh, null, null] : hand === 'L' ? [pv.lh, null, null]
        : hand === 'X' ? [pv.xh, null, null] : [pv.rh, pv.lh, pv.xh];
      for (let p = 0; p < pv.len; p++) G.forEach((g, gi) => g.push(ls[gi] ? (ls[gi][p] || []) : []));
    });

    // ── สะบัด + สองมือ: กฎอยู่ที่ lib/notation-core.js (ที่เดียวกับกระดานโน้ต) ──
    const { runs, consumed } = buildVoices(G);

    /* กรอ / ประคบ (Pk 2026-08-26) — เครื่องหมายอยู่ที่ตำแหน่ง ไม่ใช่ที่มือ
       กรอ: ตีสลับสองมือถี่ ๆ ตั้งแต่ช่องที่ติดเครื่องหมายไปจนถึงเสียงถัดไป เริ่มต่ำจบสูง
       เสียงที่ใช้มาจากทุกแนวที่ตำแหน่งนั้น (ไม่เดาคู่ให้) · มีเสียงเดียว = กรอเสียงเดียว     */
    const markOfStep = st => { const pv = parsed.find(p => st >= p.offset && st < p.offset + p.len); return pv ? (pv.marks?.[st - pv.offset] || '') : ''; };
    const notesOfStep = st => G.reduce((acc, g) => acc.concat((g[st] || []).map(n => ({ ch: n.ch, reg: n.register || 0 }))), []);
    const spans = kroSpans({ total: totalSteps, markOf: markOfStep, notesOf: notesOfStep });
    const kroAt = new Map(spans.map(sp => [sp.start, sp]));

    const scheduleMelodyAt = (s, tBase, stepNow = stepDur) => {
      const t = tBase;
      const sp = kroAt.get(s);
      if (sp) {
        kroStrikes({ dur: (sp.end - sp.start) * stepNow, gap: kroGap, low: sp.low, high: sp.high })
          .forEach(k => { const tt = t + k.t; q(tt, () => scheduleNote({ ch: k.note.ch, register: k.note.reg }, tt, 0.95 * k.vel)); });
        return;
      }
      const dampMaskAt = st => { const pv = parsed.find(p => st >= p.offset && st < p.offset + p.len); return pv ? (pv.damp?.[st - pv.offset] || 0) : 0; };
      const mask = dampMaskAt(s);
      const HKp = ['r', 'l', 'x'];
      // คู่สอง/คู่สาม (Pk 27 ส.ค.): แนวที่เสียงต่ำกว่าลงก่อนนิดหนึ่ง แม้เขียนไว้ตำแหน่งเดียวกัน
      const lead = consumed.length > 1
        ? pairLead(Array.from({ length: consumed.length }, (_, li) => (G[li][s] || []).map(n => ({ ch: n.ch, reg: n.register || 0 }))))
        : [];
      for (let li = 0; li < consumed.length; li++) {   // ทุกบรรทัดตามระบบบันทึก (ขิม/จะเข้ = 3)
        if (consumed[li][s]) continue;
        // ประคบแยกรายมือ · เลือกฟังมือเดียวอยู่ (hand !== 'both') เสียงถูกยกมาไว้แนว 0 แล้ว จึงดูทั้งก้อน
        const damp = consumed.length > 1 && hand === 'both' ? !!(mask & HAND_BIT[HKp[li]]) : !!mask;
        const tl = tBase - (lead[li] || 0);
        const run = runs.get(li * totalSteps + s);
        if (run) {
          // ตัวสุดท้ายลงตรงจังหวะ ตัวก่อนหน้าถอยหลังทีละ sabatGap · น้ำหนัก 0.6 → 0.8 → 1.0
          run.notes.forEach((n, ni) => {
            const back = run.notes.length - 1 - ni;
            const tt = tl - back * sabatGap;
            const vel = back === 0 ? 1 : back === 1 ? 0.8 : 0.6;
            q(tt, () => scheduleNote(n, tt, vel, damp));
          });
        } else {
          G[li][s].forEach(n => q(tl, () => scheduleNote(n, tl, 1, damp)));
        }
      }
    };

    // ── หน้าทับกลอง + ฉิ่ง ──
    // drumPlan[vi] = หน้าทับที่ใช้ตีวรรคนั้น {hits, len, key} · null = ไม่ตี
    //   โหมด auto  → ตามตาราง song_nathab (หน้าทับหลัก + ข้อยกเว้นต่อท่อน · อัตราตามที่ตั้งไว้)
    //   โหมดชื่อ   → ใช้หน้าทับนั้นทั้งเพลง อัตราตาม song_melody.level หรือที่เลือกใน dropdown
    //   โน้ตอ่านจากคลังกลาง (/nathab) เลือกแถวที่ตรงเครื่อง/อัตราที่สุด (findPattern)
    let drumPlan = null;
    let marks = null;
    const levelOf = vi => drumPlan?.[vi]?.level || parsed[vi].v.level || level;
    if (nathab !== 'none' || chingOn) {
      // โหลดเสียงจริงของเครื่องที่เลือก (ถ้ายังไม่มีไฟล์ ระบบใช้เสียงสังเคราะห์ต่อไป)
      await Promise.all([
        nathab !== 'none' ? loadSetBanks(ctx, drumInst) : null,   // ทุกบรรทัดของชุด (ตะโพน+กลองทัด ฯลฯ)
        chingOn ? loadDrumBank(ctx, 'ฉิ่ง') : null,
      ].filter(Boolean));
      if (nathab !== 'none') {
        let rows = [];
        try { rows = await loadNathabLibrary(); } catch (e) { rows = []; }
        const plan = nathab === 'auto'
          ? planSongNathab(parsed.map(pv => pv.v), nathabRules, { level })
          : parsed.map(pv => ({ nathab, level: pv.v.level || level }));
        drumPlan = plan.map(p => {
          if (!p) return null;
          const row = findPattern(rows, p.nathab, p.level, drumInst);
          if (!row) return null;
          const pp = parsePattern(row.pattern_text);
          if (!pp.len) return null;
          return { hits: pp.hits, len: pp.len, level: p.level, key: `${p.nathab}|${p.level}|${row.id}` };
        });
      }
      // ฉิ่งตามอัตราของท่อน (หน้าทับที่ตั้งไว้ > คอลัมน์ level ของ song_melody > dropdown)
      // + ฉิ่งกำหนดเองของเพลงจังหวะพิเศษ (คอลัมน์ ching: '-'/'ฉ'/'บ' ต่อตำแหน่ง)
      // จังหวะฉิ่งนับใหม่ทุกต้นท่อน
      marks = new Array(totalSteps).fill('');
      {
        let lastSec = null, rel = 0, cyc = (CHING_PATTERNS[level]?.hongs ?? 4) * 4;
        parsed.forEach((pv, vi) => {
          const v = pv.v;
          if ((v.section ?? null) !== lastSec) {
            lastSec = v.section ?? null; rel = 0;
            cyc = (CHING_PATTERNS[levelOf(vi)]?.hongs ?? CHING_PATTERNS[level]?.hongs ?? 4) * 4;
          }
          const custom = v.ching ? [...v.ching] : null;
          for (let i = 0; i < pv.len; i++, rel++) {
            if (custom) marks[pv.offset + i] = custom[i] === 'ฉ' ? 'ฉิ่ง' : custom[i] === 'บ' ? 'ฉับ' : '';
            else { const pp = (rel % cyc) + 1; marks[pv.offset + i] = pp === cyc / 2 ? 'ฉิ่ง' : pp === cyc ? 'ฉับ' : ''; }
          }
        });
      }
    }
    // กลองนับตามลำดับที่เล่นจริง — กลับต้นแล้วหน้าทับเดินต่อเนื่องไม่สะดุด
    // นับใหม่เฉพาะเมื่อเปลี่ยนหน้าทับ/อัตรา (เข้าท่อนที่ตั้งข้อยกเว้นไว้)
    let percKey = null, percRel = 0;
    const schedulePercAt = (s, i, t) => {
      const d = drumPlan?.[stepInfo[s].vi] ?? null;
      if (d) {
        if (d.key !== percKey) { percKey = d.key; percRel = 0; }
        const pp = (percRel % d.len) + 1; percRel++;
        d.hits.forEach(h => { if (h.pos === pp) q(t, () => playHit(ctx, drumInst, h, t, 0.75)); });   // h.voice = บรรทัดของชุด
      } else { percKey = null; percRel = 0; }
      if (chingOn && marks && marks[s]) { const syll = marks[s]; q(t, () => playPercussion(ctx, syll, t, 0.7, 'ฉิ่ง')); }
    };

    // ── ลำดับการเล่น (การกลับต้น) ──
    const stepInfo = [];
    parsed.forEach((pv, vi) => { for (let p = 0; p < pv.len; p++) stepInfo.push({ vi, pos: p }); });

    const wholeOnce = () => Array.from({ length: totalSteps }, (_, s) => s);
    function buildSeq() {
      if (repeat === 'section') {
        // กลับต้นทุกท่อน: ท่อน = วรรคติดกันที่ section เดียวกัน เล่นท่อนละ 2 เที่ยว
        // เพลงที่ไม่ระบุท่อน = ทั้งเพลงนับเป็นท่อนเดียว (เท่ากับกลับต้นเที่ยวใหญ่)
        const seq = []; let g0 = 0;
        for (let i = 0; i < parsed.length; i++) {
          const cur = parsed[i].v.section ?? null;
          const next = i + 1 < parsed.length ? (parsed[i + 1].v.section ?? null) : undefined;
          if (i + 1 >= parsed.length || next !== cur) {
            const s0 = parsed[g0].offset, s1 = parsed[i].offset + parsed[i].len;
            for (let r = 0; r < 2; r++) for (let s = s0; s < s1; s++) seq.push(s);
            g0 = i + 1;
          }
        }
        return seq;
      }
      const one = wholeOnce();
      return repeat === 'piece' ? one.concat(one) : one;   // loop เริ่มหนึ่งเที่ยว แล้วต่อท้ายเองระหว่างเล่น
    }
    let seq = buildSeq();
    // กดเล่นจากกลางเพลง: เริ่มที่ตำแหน่งนั้นครั้งแรกที่พบ แล้วเล่นตามผังกลับต้นต่อ
    if (startStep > 0) { const k = seq.indexOf(startStep); if (k > 0) seq = seq.slice(k); }

    // ── จังหวะไม่สม่ำเสมอ (Pk 27 ส.ค. 69) ──
    //   คิดจาก "ลำดับที่เล่นจริง" เพราะการกลับต้นทำให้ท่อนเดิมถูกเล่นซ้ำ
    //   และการถอนของเที่ยวก่อนต้องส่งผลถึงเที่ยวถัดไป
    const planFor = steps => tempoPlan({
      seq: steps,
      blockOf: st => blockOfStep[st] ?? 0,
      modeOf: b => secModes[b] || '',
      halfCycleOf: b => halfCycleOfLevel(levelOf(secBlocks[b]?.viFrom ?? 0)),
      // ข้อยกเว้น: ชั้นเดียว/ลูกหมด ไม่ถอนไม่ทอด เดินต่อเนื่อง (Pk 27 ส.ค. 69)
      continuousOf: b => isContinuousSection({ level: levelOf(secBlocks[b]?.viFrom ?? 0), name: secBlocks[b]?.name }),
      base: bpm,
      opts: { on: tempoOn, ...tempoOpts },
    });

    let schedLen = 0, tCur = t0;
    const scheduleSteps = steps => {
      const { durs } = planFor(steps);
      steps.forEach((s, i) => {
        const t = tCur, d = durs[i] ?? stepDur;
        scheduleMelodyAt(s, t, d);
        schedulePercAt(s, schedLen, t);
        cursorTimeline.push({ time: t, verseIdx: stepInfo[s].vi, pos: stepInfo[s].pos });
        tCur += d; schedLen++;
      });
    };
    scheduleSteps(seq);

    let endTime = tCur;
    soundEvents.sort((a, b) => a.t - b.t);
    let evIdx = 0;
    const LOOKAHEAD = 5; // วินาที
    function pump(now) {
      while (evIdx < soundEvents.length && soundEvents[evIdx].t < now + LOOKAHEAD) {
        try { soundEvents[evIdx].fn(); } catch (e) {}
        evIdx++;
      }
      // ทิ้งคิวที่เล่นไปแล้ว (โหมดวนเรื่อย ๆ ไม่ให้หน่วยความจำโตไม่หยุด)
      if (evIdx > 4000) { soundEvents.splice(0, evIdx); evIdx = 0; }
      if (idx > 4000) { cursorTimeline.splice(0, idx); idx = 0; }
    }
    let idx = 0;
    pump(ctx.currentTime); // นัดช่วงเปิดเพลงทันที
    function tick() {
      if (playIdRef.current !== myId) return;
      const now = ctx.currentTime;
      // ข้ามตำแหน่งที่เลยมาแล้ว อัปเดตเฉพาะตำแหน่งล่าสุดครั้งเดียวต่อเฟรม
      let last = null;
      while (idx < cursorTimeline.length && cursorTimeline[idx].time <= now) { last = cursorTimeline[idx]; idx++; }
      if (last) moveCursor({ verseIdx: last.verseIdx, pos: last.pos });
      if (now < endTime + 0.1) rafRef.current = requestAnimationFrame(tick);
    }

    /* ตัวขับเสียง — ใช้ "ตั้งเวลา" ไม่ใช่ requestAnimationFrame (Pk 27 ส.ค. 69)
       พอสลับแท็บหรือพับหน้าจอ เบราว์เซอร์หยุดเรียก rAF ทั้งหมด ถ้าฝากการนัดเสียงไว้กับ rAF
       เพลงจะเงียบทันทีที่คิวที่นัดไว้ล่วงหน้า (LOOKAHEAD) หมด
       setInterval ยังเดินอยู่แม้แท็บถูกพับ (ถูกหรี่เหลือ ~1 ครั้ง/วินาที ซึ่งยังทันคิว 5 วินาที) */
    const drive = () => {
      if (playIdRef.current !== myId) { clearInterval(driverRef.current); return; }
      const now = ctx.currentTime;
      // วนกลับต้นไปเรื่อย ๆ: พอใกล้จบ นัดเที่ยวถัดไปต่อท้าย (นัดล่วงหน้าอย่างน้อย 8 วิ)
      while (repeat === 'loop' && totalSteps > 0 && endTime - now < 8) {
        scheduleSteps(wholeOnce());
        endTime = tCur;
      }
      pump(now);
      if (now >= endTime + 0.1) {
        clearInterval(driverRef.current); driverRef.current = null;
        setPlayState('stopped'); moveCursor(null);
      }
    };
    clearInterval(driverRef.current);
    driverRef.current = setInterval(drive, 300);
    rafRef.current = requestAnimationFrame(tick);
  }

  async function togglePause() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (playState === 'playing') { await ctx.suspend(); setPlayState('paused'); }
    else if (playState === 'paused') { await ctx.resume(); setPlayState('playing'); }
  }

  function stop() {
    playIdRef.current++;
    if (driverRef.current) { clearInterval(driverRef.current); driverRef.current = null; }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    setPlayState('stopped'); moveCursor(null);
  }

  function seek(vi, p) {
    const hongStart = Math.floor(p / 4) * 4;
    startFrom(parsed[vi].offset + hongStart);
  }

  // hk = แนวที่กำลังวาด ('r' บน · 'l' ล่าง · 'x' ที่สาม · null = แนวรวม ให้ถือว่าประคบทั้งก้อน)
  function renderCell(notes, vi, p, hk) {
    const isSabat = notes.length > 1;
    const step = (parsed[vi]?.offset ?? 0) + p;
    const mk = marksView.markOf(step);
    const mask = marksView.dampOf(step);
    const dp = hk ? !!(mask & HAND_BIT[hk]) : !!mask;      // ประคบแยกอิสระรายมือ (Pk 27 ส.ค.)
    const kro = mk === 'kro' && (!hk || hk === 'r');       // เครื่องหมายกรออยู่แนวบน (มือขวา) แนวเดียว ตามที่ Pk เคาะ
    const cls = 'np-cell'
      + (dp ? ' np-damp' : '')
      + (kro ? ' np-kro np-krocover' : '');
    return (
      <span onClick={() => seek(vi, p)} title={kro ? 'กรอ — ตีสลับสองมือถึงเสียงถัดไป' : dp ? 'ประคบ — กดให้เสียงสั้น' : 'กดเพื่อเล่นจากห้องนี้'}
        data-cell={`${vi}-${p}`} data-mark={kro ? 'kro' : dp ? 'damp' : undefined} className={cls} style={{
        display:'inline-block', minWidth:'26px', textAlign:'center',
        padding:'2px 1px', borderRadius:'3px', fontSize:'1.05rem',
        fontFamily:'THNotation', lineHeight:1.6,
        cursor:'pointer', position:'relative',
        color: notes.length ? 'var(--cream)' : 'var(--border)',
      }}>
        {isSabat && <span style={{
          position:'absolute', top:'-4px', left:'3px', right:'3px', height:'6px',
          borderTop:'1.5px solid var(--gold2)',
          borderRadius:'50% 50% 0 0',
          pointerEvents:'none',
        }} />}
        {notes.length ? notes.map(noteKey).join('') : '-'}
      </span>
    );
  }

  function segCells(positions, vi, hk) {
    return positions.map((notes, p) => (
      <span key={p} style={{display:'flex'}}>
        {p > 0 && p % 4 === 0 && <span style={{color:'var(--border)',margin:'0 3px'}}>|</span>}
        {renderCell(notes, vi, p, hk)}
      </span>
    ));
  }

  function renderMulti(segs, label, hk = null) {
    return (
      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
        {label && <span style={{fontSize:'0.65rem',color:'var(--muted)',width:'26px',textAlign:'right',flexShrink:0}}>{label}</span>}
        <div style={{display:'flex',flexWrap:'nowrap'}}>
          {segs.map((s, si) => (
            <span key={si} style={{display:'flex'}}>
              {si > 0 && <span style={{color:'var(--border)',margin:'0 3px'}}>|</span>}
              {segCells(s.positions, s.vi, hk)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // สามบรรทัดแบบขิม: ถ้าโน้ตบันทึกมา 3 บรรทัดจริง (third_hand) ใช้ของจริง
  //   บน = สูง (หย่องซ้าย) = right_hand · กลาง = left_hand · ล่าง = ต่ำ (หย่องขวา) = third_hand
  //   ถ้าไม่ได้บันทึกแยก ใช้วิธีเดิม: แยกทำนองรวมตามช่วงเสียง
  const rec3 = useMemo(() => parsed.some(pv => pv.xh.some(c => c.length)), [parsed]);
  // ชื่อบรรทัดตามระบบบันทึกที่เพลงนี้ใช้ (ขิม = สูง/กลาง/ต่ำ · จะเข้ = สายเอก/ทุ้ม/ลวด · ระนาด = มือขวา/มือซ้าย)
  const sysKey = useMemo(() => {
    const hint = (verses ?? []).find(v => v.notation_system)?.notation_system;
    const n = rec3 ? 3 : (verses ?? []).some(v => (v.left_hand ?? '').trim()) ? 2 : 1;
    return systemForLines(n, hint);
  }, [verses, rec3]);
  const sysLines = useMemo(() => linesOf(sysKey), [sysKey]);
  const lineName = i => sysLines[i]?.label || sysLines[i]?.tag || ['บน', 'กลาง', 'ล่าง'][i];
  function khimRow(pv, reg) {
    if (rec3) return reg === '1' ? pv.rh : reg === '0' ? pv.lh : pv.xh;
    return pv.cb.map(notes => notes.filter(n => String(n.register) === reg));
  }

  // ── บล็อกท่อน: วรรคติดกันที่ section เดียวกัน (ท่อนชื่อซ้ำคนละที่ในเพลง = คนละบล็อก) ──
  const secBlocks = useMemo(() => {
    const out = [];
    parsed.forEach((pv, vi) => {
      const name = pv.v.section ?? null;
      const last = out[out.length - 1];
      if (last && last.name === name && last.viTo === vi - 1) { last.viTo = vi; last.to = pv.offset + pv.len; }
      else out.push({ i: out.length, name, viFrom: vi, viTo: vi, from: pv.offset, to: pv.offset + pv.len });
    });
    return out;
  }, [parsed]);
  const levelHint = vi => parsed[vi]?.v?.level || level;
  // เส้นความเร็วของทั้งเพลง (เที่ยวเดียว) ไว้โชว์ตัวเลขข้างแต่ละท่อน — ต้องคิดทั้งเพลงเพราะท่อนต่อเนื่องรับช่วงจากท่อนก่อน
  const blockOfStep = useMemo(() => {
    const arr = new Array(totalSteps).fill(0);
    secBlocks.forEach(b => { for (let s = b.from; s < b.to && s < totalSteps; s++) arr[s] = b.i; });
    return arr;
  }, [secBlocks, totalSteps]);

  // รายละเอียดประจำท่อน ไว้ขึ้นหัวท่อนบนตารางโน้ต — ชื่อท่อน (เพลงเรื่องมักใส่ชื่อเพลงไว้ตรงนี้)
  //   + อัตรา · หน้าทับของท่อนนั้น · ทาง · จำนวนวรรค/ห้อง · ลูกตกท้ายท่อน
  const secInfo = useMemo(() => {
    const plan = (nathabRules?.length && parsed.length)
      ? planSongNathab(parsed.map(pv => pv.v), nathabRules, { level }) : null;
    return secBlocks.map(b => {
      const lv = levelHint(b.viFrom);
      const nb = plan?.[b.viFrom]?.nathab || null;
      const tg = parsed[b.viFrom]?.v?.tang;
      const lastVerse = parsed[b.viTo]?.v;
      return {
        ...b, level: lv, nathab: nb,
        tang: (tg != null && +tg >= 1 && +tg <= 7) ? tangOf(+tg).short : null,
        verses: b.viTo - b.viFrom + 1,
        hongs: Math.round((b.to - b.from) / 4),
        luktok: lastVerse?.luktok || null,
      };
    });
  }, [secBlocks, parsed, nathabRules, level]);
  const secStartAt = useMemo(() => {
    const m = {}; secInfo.forEach(b => { m[b.viFrom] = b; }); return m;
  }, [secInfo]);

  const previewFactors = useMemo(() => {
    if (!tempoOn || !totalSteps) return new Array(totalSteps).fill(1);
    return tempoPlan({
      seq: Array.from({ length: totalSteps }, (_, i) => i),
      blockOf: st => blockOfStep[st] ?? 0,
      modeOf: b => secModes[b] || '',
      halfCycleOf: b => halfCycleOfLevel(levelHint(secBlocks[b]?.viFrom ?? 0)),
      continuousOf: b => isContinuousSection({ level: levelHint(secBlocks[b]?.viFrom ?? 0), name: secBlocks[b]?.name }),
      base: bpm, opts: { on: true, ...tempoOpts },
    }).factors;
  }, [tempoOn, totalSteps, blockOfStep, secBlocks, secModes, tempoOpts, bpm, parsed, level]);

  // ── จัดกลุ่มวรรคลงบรรทัด ตามจำนวนห้องต่อบรรทัดที่เลือก ──
  const lineGroups = useMemo(() => {
    const groups = [];
    let cur = [], curHongs = 0;
    parsed.forEach((pv, vi) => {
      const h = pv.len / 4;
      // ขึ้นท่อนใหม่ = ขึ้นบรรทัดใหม่เสมอ ไม่งั้นหัวท่อนจะไปโผล่กลางบรรทัดไม่ได้ (Pk 27 ส.ค. 69)
      const newSec = vi > 0 && (pv.v.section ?? null) !== (parsed[vi - 1].v.section ?? null);
      if (cur.length > 0 && (newSec || curHongs + h > hongsPerLine)) { groups.push(cur); cur = []; curHongs = 0; }
      cur.push(vi); curHongs += h;
    });
    if (cur.length) groups.push(cur);
    return groups;
  }, [parsed, hongsPerLine]);

  if (!verses || verses.length === 0) {
    return <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ยังไม่มีข้อมูลโน้ตสำหรับเพลงนี้</div>;
  }

  playStateRef.current = playState;
  playRef.current = () => startFrom(0);
  stopRef.current = stop;
  togglePauseRef.current = togglePause;

  return (
    <div>
      <div style={{display:'flex',gap:'10px',flexWrap:'wrap',alignItems:'center',marginBottom:'1rem'}}>
        {playState === 'stopped' && (
          <button className="btn btn-jade" onClick={() => startFrom(0)} disabled={loadingSamples}>
            {loadingSamples ? '⏳ โหลดเสียง...' : '▶ เล่นโน้ต'}
          </button>
        )}
        {playState !== 'stopped' && (
          <>
            <button className="btn btn-jade" onClick={togglePause}>
              {playState === 'playing' ? '⏸ พัก' : '▶ เล่นต่อ'}
            </button>
            <button className="btn btn-outline" onClick={stop}>■ หยุด</button>
          </>
        )}
        <select className="filter-select" value={sound} onChange={e => { setSound(e.target.value); buffersRef.current = null; setSampleCount(null); }}
          disabled={playState !== 'stopped'} title="เสียงเครื่องดนตรี — เพิ่มเครื่องใหม่ได้ที่ ผู้ดูแล → คลังเสียงเครื่องดนตรี">
          {can('player_real') && insts.map(i => <option key={i.slug} value={i.slug}>🎵 {i.name_th}</option>)}
          <option value="synth">〰 เสียงสังเคราะห์</option>
        </select>
        {/* ค่า option ต้องเท่ากับ String(ตัวเลข) เป๊ะ ("0.06" ไม่ใช่ "0.060") ไม่งั้น dropdown แสดงค่าผิด */}
        <select className="filter-select" value={String(sabatGap)} onChange={e => setSabatGap(parseFloat(e.target.value))}
          disabled={playState !== 'stopped'} title="ช่องไฟระหว่างเสียงสะบัด (วินาที)">
          <option value="0.04">สะบัดรัวเร็ว (40 ms)</option>
          <option value="0.06">สะบัดค่อนข้างเร็ว (60 ms)</option>
          <option value="0.08">สะบัดปกติ (80 ms)</option>
          <option value="0.1">สะบัดหนืด (100 ms)</option>
          <option value="0.12">สะบัดช้า (120 ms)</option>
        </select>
        {marksView.cover.size > 0 && (
          <select className="filter-select" value={String(kroGap)} onChange={e => setKroGap(parseFloat(e.target.value))}
            disabled={playState !== 'stopped'} title="ความถี่ของการกรอ (วินาทีต่อไม้) — ยิ่งน้อยยิ่งตีถี่">
            <option value="0.045">〰 กรอถี่มาก (45 ms)</option>
            <option value="0.055">〰 กรอถี่ (55 ms)</option>
            <option value="0.07">〰 กรอปกติ (70 ms)</option>
            <option value="0.09">〰 กรอห่าง (90 ms)</option>
            <option value="0.12">〰 กรอห่างมาก (120 ms)</option>
          </select>
        )}
        <select className="filter-select" value={tuning} onChange={e => setTuning(e.target.value)} disabled={playState !== 'stopped'}
          title="ระบบเสียง: ความถี่จริงของโน้ตแต่ละเสียง (ตารางความถี่เสียงดนตรีไทย กรมศิลปากร)">
          {(tunes.length ? tunes : [{ slug: DEFAULT_TUNING, name_th: 'กรมศิลปากร — เครื่องสาย / มโหรี' }])
            .map(t => <option key={t.slug} value={t.slug}>🎚 {t.name_th}</option>)}
        </select>
        <select className="filter-select" value={tang ?? ''} onChange={e => setTang(e.target.value === '' ? null : +e.target.value)}
          disabled={playState !== 'stopped'} title="ทาง (บันไดเสียง) ที่อยากฟัง">
          <option value="">🎼 ทางตามโน้ต ({tangOf(homeTang).short}{declaredTang ? '' : ' · ระบบเดาให้'})</option>
          {TANGS.map(t => <option key={t.no} value={t.no}>🎼 {t.name}</option>)}
        </select>
        {tang != null && tang !== homeTang &&
          <select className="filter-select" value={tangView} onChange={e => setTangView(e.target.value)}
            title="เปลี่ยนทางแล้วโน้ตบนจอขยับตามหรือไม่">
            <option value="fix">ตรึงโน้ต (เสียงเปลี่ยน)</option>
            <option value="real">ย้ายโน้ตจริง</option>
          </select>}
        <select className="filter-select" value={mode} onChange={e => setMode(e.target.value)}>
          <option value="combined">บรรทัดเดียว (ทำนองรวม)</option>
          {can('player_hands') && <option value="hands">สองบรรทัด (แยกมือ R/L)</option>}
          {can('player_khim') && <option value="khim">{rec3 ? `สามบรรทัด (${systemOf(sysKey).short})` : 'สามบรรทัด (แบบขิม)'}</option>}
          {can('player_vocal') && <option value="vocal">โน้ตขับร้อง (มีเนื้อ)</option>}
          {can('player_staff') && <option value="staff">โน้ตสากล 5 เส้น</option>}
        </select>
        <select className="filter-select" value={hand} onChange={e => setHand(e.target.value)} disabled={playState !== 'stopped'}
          title={rec3 ? 'เลือกแนวที่จะให้ดัง (โน้ตนี้บันทึก 3 บรรทัด)' : 'เลือกมือที่จะให้ดัง'}>
          <option value="both">🔊 {rec3 ? 'ทุกบรรทัด' : 'ทั้งสองมือ'}</option>
          <option value="R">🔊 {lineName(0)}</option>
          <option value="L">🔊 {lineName(1)}</option>
          {rec3 && <option value="X">🔊 {lineName(2)}</option>}
        </select>
        {/* เพลงที่กำหนดหน้าทับไว้ ทุกคนได้ยิน (และปิดเองได้) · เลือกหน้าทับอื่นเองต้องมีสิทธิ์ player_perc */}
        {(can('player_perc') || nathabRules?.length > 0) && <select className="filter-select" value={nathab} disabled={playState !== 'stopped'}
          onChange={e => { nathabTouchedRef.current = true; setNathab(e.target.value); }} title="หน้าทับจากคลังกลาง (/nathab)">
          <option value="none">🥁 ไม่มีกลอง</option>
          {nathabRules?.length > 0 && <option value="auto">🥁 ตามที่เพลงกำหนด ({nathabRules.find(r => !r.section)?.nathab ?? 'รายท่อน'})</option>}
          {can('player_perc') && (libNames.length ? libNames : ['ปรบไก่', 'สองไม้']).map(n => <option key={n} value={n}>หน้าทับ{n}</option>)}
        </select>}
        {nathab !== 'none' && can('player_perc') && (
          <select className="filter-select" value={drumInst} onChange={e => setDrumInst(e.target.value)} disabled={playState !== 'stopped'}>
            {DRUMS.map(d => <option key={d} value={d}>{drumLabel(d)}</option>)}
          </select>
        )}
        <select className="filter-select" value={level} onChange={e => setLevel(e.target.value)} disabled={playState !== 'stopped'}>
          <option value="สามชั้น">สามชั้น</option>
          <option value="สองชั้น">สองชั้น</option>
          <option value="ชั้นเดียว">ชั้นเดียว</option>
        </select>
        <select className="filter-select" value={repeat} onChange={e => setRepeat(e.target.value)}
          disabled={playState !== 'stopped'} title="การกลับต้น">
          <option value="none">▶ เที่ยวเดียวจบ</option>
          <option value="section">🔁 กลับต้นทุกท่อน (ท่อนละ 2 เที่ยว)</option>
          <option value="piece">🔁 กลับต้นเที่ยวใหญ่ (ทั้งเพลง 2 เที่ยว)</option>
          <option value="loop">♾ วนกลับต้นไปเรื่อย ๆ</option>
        </select>
        <label style={{display:'flex',alignItems:'center',gap:'4px',fontSize:'0.78rem',color:'var(--muted)',cursor:'pointer'}}>
          <input type="checkbox" checked={chingOn} onChange={e => setChingOn(e.target.checked)}
            disabled={playState !== 'stopped'} style={{accentColor:'var(--gold)'}} />
          ฉิ่ง
        </label>
        <select className="filter-select" value={hongsPerLine} onChange={e => setHongsPerLine(+e.target.value)}>
          <option value="2">2 ห้อง/บรรทัด</option>
          <option value="4">4 ห้อง/บรรทัด</option>
          <option value="8">8 ห้อง/บรรทัด</option>
          <option value="16">16 ห้อง/บรรทัด</option>
        </select>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'0.75rem',color:'var(--muted)'}}>
          ช้า <input type="range" min="50" max="220" value={bpm} onChange={e => setBpm(+e.target.value)}
            style={{accentColor:'var(--gold)'}} disabled={playState !== 'stopped'} /> เร็ว
          <span style={{fontFamily:'monospace'}}>{bpm}</span>
        </div>
        {sampleCount != null && sound !== 'synth' && (() => {
          const it = insts.find(i => i.slug === sound) || insts[0];
          const want = it?.note_count || 16;
          return (
            <span style={{fontSize:'0.68rem',color: sampleCount > 0 ? 'var(--jade)' : 'var(--danger)'}}>
              {sampleCount <= 0 ? '⚠ ยังไม่มีไฟล์เสียง ใช้สังเคราะห์แทน'
                : sampleCount >= want ? `♪ เสียงจริงครบ ${sampleCount} เสียง`
                : `♪ เสียงจริง ${sampleCount}/${want} เสียง · ที่ขาดขยับจากตัวใกล้สุด`}
            </span>
          );
        })()}
        {nathabRules?.length > 0 && (
          <span style={{fontSize:'0.68rem',color:'var(--jade)'}} title="ฉิ่ง–ฉับ · หน้าทับกลอง · ความเร็ว ที่เจ้าของเพลงบันทึกไว้ ตั้งให้อัตโนมัติแล้ว">
            🥁 ตั้งจังหวะตามที่เพลงบันทึกไว้ให้แล้ว — กดเล่นได้เลย
          </span>
        )}
        <span style={{fontSize:'0.68rem',color:'var(--muted)'}}>💡 กดที่ห้องใดก็ได้เพื่อเล่นจากตรงนั้น</span>
      </div>

      {/* ── จังหวะท้ายท่อน: ถอน / ทอด (Pk 27 ส.ค. 69) ── */}
      <div className="card" style={{marginBottom:'1rem',borderColor: tempoOn ? 'rgba(201,168,76,0.45)' : 'var(--border)'}}>
        <label style={{display:'flex',gap:'8px',alignItems:'center',cursor:'pointer',fontSize:'0.86rem',fontWeight:600}}>
          <input type="checkbox" checked={tempoOn} onChange={e => setTempoOn(e.target.checked)}
            disabled={playState !== 'stopped'} style={{accentColor:'var(--gold)',width:'18px',height:'18px'}} />
          🎚 จังหวะไม่สม่ำเสมอ — เร่งขึ้นทั้งท่อน แล้วจบท่อนแบบ <b>ถอน</b> หรือ <b>ทอด</b>
        </label>
        {!tempoOn && <div style={{fontSize:'0.74rem',color:'var(--muted)',marginTop:'6px'}}>
          ปิดอยู่ = เดินจังหวะสม่ำเสมอตลอดเพลงเหมือนเดิม</div>}
        {tempoOn && (
          <div style={{marginTop:'0.8rem'}}>
            <div style={{fontSize:'0.74rem',color:'var(--muted)',lineHeight:1.9,marginBottom:'0.7rem'}}>
              <b style={{color:'var(--gold2)'}}>ถอน</b> = เร่งเต็มจนถึงเสียงสุดท้ายของท่อน แล้วท่อนถัดไปเริ่มที่ครึ่งหนึ่งของความเร็วท้ายท่อนนั้น ·
              <b style={{color:'var(--gold2)'}}> ทอด</b> = ครึ่งหลังของจังหวะหน้าทับสุดท้ายค่อย ๆ ผ่อนลง แล้วท่อนถัดไปกลับมาความเร็วปกติ ·
              ทำนอง ฉิ่ง กลอง ขยับไปพร้อมกันทั้งหมด
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'0.9rem'}}>
              {secBlocks.map(b => {
                const cont = isContinuousSection({ level: levelHint(b.viFrom), name: b.name });
                const why = CONTINUOUS_WHY({ level: levelHint(b.viFrom), name: b.name });
                const mode = cont ? '' : (secModes[b.i] || '');
                const hongs = Math.round((b.to - b.from) / 4);
                return (
                  <div key={b.i} style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',
                    padding:'6px 0',borderBottom:'1px solid rgba(42,63,92,0.35)'}}>
                    <span style={{flex:1,minWidth:'150px',fontSize:'0.84rem'}}>
                      {b.name ?? 'ทั้งเพลง'}
                      <span style={{color:'var(--muted)',fontSize:'0.72rem'}}> · {hongs} ห้อง</span>
                    </span>
                    {cont
                      ? <span style={{fontSize:'0.74rem',color:'var(--gold2)'}}
                          title={why === 'ลูกหมด'
                            ? 'ลูกหมดไม่มีทอดไม่มีถอน — เร่งขึ้นตั้งแต่ต้นลูกหมดจนถึงเสียงสุดท้าย'
                            : 'ชั้นเดียวไม่ทอดไม่ถอนชัดเจน จังหวะเร็วต่อเนื่องกันไป'}>
                          ⤳ {why} — เร่งต่อเนื่อง ไม่ถอนไม่ทอด</span>
                      : ['', 'thon', 'thot'].map(m => (
                        <button key={m} type="button" className={'btn btn-sm ' + (mode === m ? 'btn-jade' : 'btn-outline')}
                          disabled={playState !== 'stopped'}
                          onClick={() => setSecModes({ ...secModes, [b.i]: m })}>{MODE_LABEL[m]}</button>
                      ))}
                    <span style={{fontSize:'0.7rem',color:'var(--muted)',fontFamily:'monospace',minWidth:'96px',textAlign:'right'}}>
                      {`${bpmAt(bpm, previewFactors[b.from] ?? 1)} → ${bpmAt(bpm, previewFactors[b.to - 1] ?? 1)}`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:'10px',fontSize:'0.74rem',color:'var(--muted)'}}>
              <label>เร่งขึ้นต่อท่อน (ท่อนธรรมดา) <b style={{color:'var(--gold2)'}}>{Math.round(tempoOpts.accel * 100)}%</b>
                <input type="range" min="0" max="80" value={Math.round(tempoOpts.accel * 100)} disabled={playState !== 'stopped'}
                  onChange={e => setTempoOpts({ ...tempoOpts, accel: +e.target.value / 100 })}
                  style={{width:'100%',accentColor:'var(--gold)'}} /></label>
              <label>เร่งขึ้นของท่อนที่ <b>ถอน</b> <b style={{color:'var(--gold2)'}}>{Math.round(tempoOpts.accelThon * 100)}%</b>
                <input type="range" min="20" max="200" value={Math.round(tempoOpts.accelThon * 100)} disabled={playState !== 'stopped'}
                  onChange={e => setTempoOpts({ ...tempoOpts, accelThon: +e.target.value / 100 })}
                  style={{width:'100%',accentColor:'var(--gold)'}} /></label>
              <label>ขึ้นท่อนใหม่หลังถอน เหลือ <b style={{color:'var(--gold2)'}}>{Math.round(tempoOpts.thonRatio * 100)}%</b>
                <input type="range" min="30" max="90" value={Math.round(tempoOpts.thonRatio * 100)} disabled={playState !== 'stopped'}
                  onChange={e => setTempoOpts({ ...tempoOpts, thonRatio: +e.target.value / 100 })}
                  style={{width:'100%',accentColor:'var(--gold)'}} /></label>
              <label>ทอดแล้วผ่อนลงเหลือ <b style={{color:'var(--gold2)'}}>{Math.round(tempoOpts.thotRatio * 100)}%</b>
                <input type="range" min="40" max="95" value={Math.round(tempoOpts.thotRatio * 100)} disabled={playState !== 'stopped'}
                  onChange={e => setTempoOpts({ ...tempoOpts, thotRatio: +e.target.value / 100 })}
                  style={{width:'100%',accentColor:'var(--gold)'}} /></label>
            </div>
            <div style={{fontSize:'0.72rem',color:'var(--muted)',marginTop:'0.7rem',lineHeight:1.8}}>
              ⤳ <b>ชั้นเดียว</b> กับ <b>ลูกหมด</b> ไม่มีถอนไม่มีทอด — จังหวะเร่งต่อเนื่องรับช่วงจากท่อนก่อนไปจนจบ ·
              💡 ท่อนที่ถอนต้องเร่งให้มากพอ ไม่งั้นพอขึ้นท่อนใหม่จังหวะจะยืดยาดเกินไป —
              ถ้าตั้ง "เร่งของท่อนถอน" ไว้ ๑๐๐% และ "เหลือ" ๕๐% ท่อนใหม่จะกลับมาที่ความเร็วตั้งต้นพอดี
              (ตัวเลขท้ายแต่ละท่อนคือความเร็วต้นท่อน → ท้ายท่อน)
            </div>
          </div>
        )}
      </div>

      <style>{`.np-cell.np-on{background:rgba(201,168,76,0.4)}
        .np-damp{font-weight:900}
        .np-krocover{background-image:url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='7'%3E%3Cpath d='M0 5 q 3.5 -4.5 7 0 t 7 0' fill='none' stroke='%23e8c96a' stroke-width='1.4'/%3E%3C/svg%3E");
          background-repeat:repeat-x;background-position:left top;padding-top:7px !important}
        .np-kro{color:var(--gold2)}`}</style>
      {mode === 'staff' ? <StaffNotation verses={verses} cursor={cursor} /> :
      <div ref={gridRef} style={{background:'var(--navy3)',border:'1px solid var(--border)',borderRadius:'8px',
        padding:'1rem',overflowX:'auto',display:'flex',flexDirection:'column',gap:'0.7rem'}}>
        {lineGroups.map((group, gi) => {
          const first = parsed[group[0]].v;
          const last = parsed[group[group.length-1]].v;
          const label = group.length > 1
            ? `วรรค ${first.verse_no}–${last.verse_no}` : `วรรค ${first.verse_no}`;
          const luk = group.map(vi => parsed[vi].v.luktok).filter(Boolean).join(' / ');
          const segs = f => group.map(vi => ({ positions: f(parsed[vi]), vi }));
          return (
            <div key={gi} data-line={gi} style={{paddingBottom:'0.5rem',
              borderBottom: gi < lineGroups.length-1 ? '1px dashed rgba(42,63,92,0.6)' : 'none'}}>
              {/* หัวท่อน — ขึ้นเมื่อเริ่มท่อนใหม่ ชิดซ้ายเหนือโน้ต (Pk 27 ส.ค. 69) */}
              {secStartAt[group[0]] && (() => {
                const b = secStartAt[group[0]];
                const mode = secModes[b.i] || '';
                const contWhy = CONTINUOUS_WHY({ level: b.level, name: b.name });
                const bits = [
                  b.level, b.nathab && `🥁 หน้าทับ${b.nathab}`, b.tang && `ทาง${b.tang}`,
                  `${b.verses} วรรค · ${b.hongs} ห้อง`, b.luktok && `ลูกตก ${b.luktok}`,
                  tempoOn && (contWhy ? '⤳ เร่งต่อเนื่อง' : mode === 'thon' ? '⤳ ถอน' : mode === 'thot' ? '⤳ ทอด' : ''),
                ].filter(Boolean);
                return (
                  <div data-sec={b.i} style={{margin: gi === 0 ? '0 0 .5rem' : '.6rem 0 .5rem',
                    borderLeft:'3px solid var(--gold)', paddingLeft:'9px'}}>
                    <div style={{fontSize:'1rem',fontWeight:700,color:'var(--gold2)',lineHeight:1.4}}>
                      {b.name ?? 'ทั้งเพลง'}
                    </div>
                    {bits.length > 0 && (
                      <div style={{fontSize:'0.72rem',color:'var(--muted)',lineHeight:1.7}}>{bits.join(' · ')}</div>
                    )}
                  </div>
                );
              })()}
              <div style={{fontSize:'0.66rem',color:'var(--muted)',marginBottom:'3px'}}>
                {label}{luk ? ` · ลูกตก: ${luk}` : ''}
              </div>
              {mode === 'combined' && renderMulti(segs(pv => pv.cb), null, null)}
              {mode === 'hands' && <>
                {renderMulti(segs(pv => pv.rh), sysLines[0]?.tag || 'R', 'r')}
                {renderMulti(segs(pv => pv.lh), sysLines[1]?.tag || 'L', 'l')}
              </>}
              {mode === 'khim' && ['1','0','-1'].map((reg, li) =>
                <div key={reg}>{renderMulti(group.map(vi => ({ positions: khimRow(parsed[vi], reg), vi })), rec3 ? (sysLines[li]?.tag || REG_LABEL[reg]) : REG_LABEL[reg], rec3 ? ['r', 'l', 'x'][li] : null)}</div>
              )}
              {mode === 'vocal' && renderMulti(segs(pv => pv.cb), '♪', null)}
            </div>
          );
        })}
        {mode === 'vocal' && (
          <div style={{marginTop:'0.5rem',padding:'0.8rem',background:'var(--navy2)',borderRadius:'6px'}}>
            <div style={{fontSize:'0.68rem',color:'var(--muted)',marginBottom:'4px'}}>เนื้อร้อง</div>
            <div style={{fontSize:'0.9rem',lineHeight:2,whiteSpace:'pre-wrap'}}>
              {lyrics || <span style={{color:'var(--muted)'}}>ยังไม่มีเนื้อร้อง</span>}
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}
