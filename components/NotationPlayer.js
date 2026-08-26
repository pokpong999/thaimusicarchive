'use client';
import { usePermissions } from './Gate';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { loadMelodyBank, playMelodyNote } from '../lib/melodybank';
import { loadInstruments } from '../lib/instruments';
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
import { buildVoices, SABAT_GAP_DEFAULT } from '../lib/notation-core';
import { linesOf, systemForLines, systemOf } from '../lib/notation-systems';
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
  const [ensemble, setEnsemble] = useState('khrueangsai'); // khrueangsai | piphat
  const [sabatGap, setSabatGap] = useState(SABAT_DEFAULT);
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
  // เพลงที่ตั้งหน้าทับไว้แล้ว → เปิดกลองให้อัตโนมัติ (ถ้าผู้ฟังยังไม่ได้เลือกเอง)
  useEffect(() => {
    if (!nathabRules?.length || nathabTouchedRef.current) return;
    if (can('player_perc')) setNathab('auto');
    const main = nathabRules.find(r => !r.section);
    if (main?.drum && DRUMS.includes(main.drum)) setDrumInst(main.drum);
  }, [nathabRules, can]);
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
    if (!can('player_perc') && nathab !== 'none') setNathab('none');
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
  // หยุดเสียงเมื่อสลับแท็บ/ย่อหน้าต่าง และเมื่อออกจากหน้านี้
  useEffect(() => {
    function onHide() {
      if (document.hidden && playStateRef.current !== 'stopped') stopRef.current?.();
    }
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      stopRef.current?.();          // ออกจากหน้าเพลง = หยุดเสียงเสมอ
    };
  }, []);

  const buffersRef = useRef(null);
  const rafRef = useRef(null);
  const playIdRef = useRef(0);

  // ── แปลงโน้ตทุกวรรคครั้งเดียว: ความยาวจริงต่อวรรค + offset สะสม ──
  const parsed = useMemo(() => {
    let offset = 0;
    return (verses ?? []).map(v => {
      const cb = parseVerse(v.combined);
      const rh = parseVerse(v.right_hand);
      const lh = parseVerse(v.left_hand);
      const xh = parseVerse(v.third_hand);
      const len = Math.max(cb.length, rh.length, lh.length, xh.length, 4);
      const item = {
        v, len, offset,
        cb: padTo(cb, len), rh: padTo(rh, len), lh: padTo(lh, len), xh: padTo(xh, len),
        useHands: !!(v.right_hand || v.left_hand || v.third_hand),
      };
      offset += len;
      return item;
    });
  }, [verses]);
  const totalSteps = parsed.length ? parsed[parsed.length-1].offset + parsed[parsed.length-1].len : 0;

  useEffect(() => () => {
    playIdRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) ctxRef.current.close().catch(() => {});
  }, []);

  async function startFrom(startStep) {
    const pitchShift = ensemble === 'piphat' ? 1 : 0;
    playIdRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); }
    ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = ctxRef.current;
    await ctx.resume();

    const instNow = insts.find(i => i.slug === sound) || (sound !== 'synth' ? insts[0] : null);
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
    function scheduleNote(n, noteTime, vel = 1) {
      let played = false;
      if (useReal) played = playMelodyNote(ctx, buffers, n.ch, n.register, noteTime, 0.85 * vel, pitchShift, instNow.transpose || 0);
      if (!played) {
        const f = noteFreq(n.ch, n.register);
        if (f) synthNote(ctx, f * Math.pow(2, pitchShift / 7), noteTime, stepDur * 2.2, 0.45 * vel);
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
    const scheduleMelodyAt = (s, t) => {
      for (let li = 0; li < 2; li++) {
        if (consumed[li][s]) continue;
        const run = runs.get(li * totalSteps + s);
        if (run) {
          // ตัวสุดท้ายลงตรงจังหวะ ตัวก่อนหน้าถอยหลังทีละ sabatGap · น้ำหนัก 0.6 → 0.8 → 1.0
          run.notes.forEach((n, ni) => {
            const back = run.notes.length - 1 - ni;
            const tt = t - back * sabatGap;
            const vel = back === 0 ? 1 : back === 1 ? 0.8 : 0.6;
            q(tt, () => scheduleNote(n, tt, vel));
          });
        } else {
          G[li][s].forEach(n => q(t, () => scheduleNote(n, t)));
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

    let schedLen = 0;
    const scheduleSteps = steps => {
      for (const s of steps) {
        const t = t0 + schedLen * stepDur;
        scheduleMelodyAt(s, t);
        schedulePercAt(s, schedLen, t);
        cursorTimeline.push({ time: t, verseIdx: stepInfo[s].vi, pos: stepInfo[s].pos });
        schedLen++;
      }
    };
    scheduleSteps(seq);

    let endTime = t0 + schedLen * stepDur;
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
      // วนกลับต้นไปเรื่อย ๆ: พอใกล้จบ นัดเที่ยวถัดไปต่อท้าย (นัดล่วงหน้าอย่างน้อย 8 วิ)
      while (repeat === 'loop' && totalSteps > 0 && endTime - now < 8) {
        scheduleSteps(wholeOnce());
        endTime = t0 + schedLen * stepDur;
      }
      pump(now);
      // ข้ามตำแหน่งที่เลยมาแล้ว อัปเดตเฉพาะตำแหน่งล่าสุดครั้งเดียวต่อเฟรม
      let last = null;
      while (idx < cursorTimeline.length && cursorTimeline[idx].time <= now) { last = cursorTimeline[idx]; idx++; }
      if (last) moveCursor({ verseIdx: last.verseIdx, pos: last.pos });
      if (now < endTime + 0.1) rafRef.current = requestAnimationFrame(tick);
      else { setPlayState('stopped'); moveCursor(null); }
    }
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
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    setPlayState('stopped'); moveCursor(null);
  }

  function seek(vi, p) {
    const hongStart = Math.floor(p / 4) * 4;
    startFrom(parsed[vi].offset + hongStart);
  }

  function renderCell(notes, vi, p) {
    const isSabat = notes.length > 1;
    return (
      <span onClick={() => seek(vi, p)} title="กดเพื่อเล่นจากห้องนี้" data-cell={`${vi}-${p}`} className="np-cell" style={{
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

  function segCells(positions, vi) {
    return positions.map((notes, p) => (
      <span key={p} style={{display:'flex'}}>
        {p > 0 && p % 4 === 0 && <span style={{color:'var(--border)',margin:'0 3px'}}>|</span>}
        {renderCell(notes, vi, p)}
      </span>
    ));
  }

  function renderMulti(segs, label) {
    return (
      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
        {label && <span style={{fontSize:'0.65rem',color:'var(--muted)',width:'26px',textAlign:'right',flexShrink:0}}>{label}</span>}
        <div style={{display:'flex',flexWrap:'nowrap'}}>
          {segs.map((s, si) => (
            <span key={si} style={{display:'flex'}}>
              {si > 0 && <span style={{color:'var(--border)',margin:'0 3px'}}>|</span>}
              {segCells(s.positions, s.vi)}
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

  // ── จัดกลุ่มวรรคลงบรรทัด ตามจำนวนห้องต่อบรรทัดที่เลือก ──
  const lineGroups = useMemo(() => {
    const groups = [];
    let cur = [], curHongs = 0;
    parsed.forEach((pv, vi) => {
      const h = pv.len / 4;
      if (cur.length > 0 && curHongs + h > hongsPerLine) { groups.push(cur); cur = []; curHongs = 0; }
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
        <select className="filter-select" value={ensemble} onChange={e => setEnsemble(e.target.value)} disabled={playState !== 'stopped'}>
          <option value="khrueangsai">🎻 ระบบเครื่องสาย</option>
          <option value="piphat">🥁 ระบบปี่พาทย์ (สูงขึ้น 1 เสียง)</option>
        </select>
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
        {can('player_perc') && <select className="filter-select" value={nathab} disabled={playState !== 'stopped'}
          onChange={e => { nathabTouchedRef.current = true; setNathab(e.target.value); }} title="หน้าทับจากคลังกลาง (/nathab)">
          <option value="none">🥁 ไม่มีกลอง</option>
          {nathabRules?.length > 0 && <option value="auto">🥁 ตามที่เพลงกำหนด ({nathabRules.find(r => !r.section)?.nathab ?? 'รายท่อน'})</option>}
          {(libNames.length ? libNames : ['ปรบไก่', 'สองไม้']).map(n => <option key={n} value={n}>หน้าทับ{n}</option>)}
        </select>}
        {nathab !== 'none' && (
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
        <span style={{fontSize:'0.68rem',color:'var(--muted)'}}>💡 กดที่ห้องใดก็ได้เพื่อเล่นจากตรงนั้น</span>
      </div>

      <style>{`.np-cell.np-on{background:rgba(201,168,76,0.4)}`}</style>
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
              <div style={{fontSize:'0.62rem',color:'var(--muted)',marginBottom:'3px'}}>
                {label}{first.section ? ` · ${first.section}` : ''}{luk ? ` · ลูกตก: ${luk}` : ''}
              </div>
              {mode === 'combined' && renderMulti(segs(pv => pv.cb), null)}
              {mode === 'hands' && <>
                {renderMulti(segs(pv => pv.rh), sysLines[0]?.tag || 'R')}
                {renderMulti(segs(pv => pv.lh), sysLines[1]?.tag || 'L')}
              </>}
              {mode === 'khim' && ['1','0','-1'].map((reg, li) =>
                <div key={reg}>{renderMulti(group.map(vi => ({ positions: khimRow(parsed[vi], reg), vi })), rec3 ? (sysLines[li]?.tag || REG_LABEL[reg]) : REG_LABEL[reg])}</div>
              )}
              {mode === 'vocal' && renderMulti(segs(pv => pv.cb), '♪')}
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
