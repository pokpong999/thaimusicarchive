// lib/staff.js — แปลงโน้ตไทยเป็นโน้ตสากล (Pk 1 ก.ย. 69)
//
//   ★ แยกออกมาจาก components/StaffNotation.js เพื่อให้ "ตรวจด้วยเครื่องได้"
//     เดิมตรรกะการแปลงอยู่ปนกับการวาดภาพ จึงทดสอบไม่ได้เลย
//     ห้องที่ไม่ครบจังหวะจึงหลุดขึ้นเว็บโดยไม่มีอะไรจับ
//
//   หน่วยนับ: 1 ตำแหน่งในโน้ตไทย = 1 เขบ็ดหนึ่งชั้น
//             1 ห้อง = 4 ตำแหน่ง = 4 เขบ็ด = 2/4 พอดี
//
//   ข้อรับประกันของไฟล์นี้:
//     ทุกห้องที่คืนออกไป ผลรวมความยาวโน้ตต้องเท่ากับขนาดห้องเป๊ะ
//     ตรวจซ้ำด้วย assertFullBars() ได้ทุกเมื่อ

export const UNITS_PER_HONG = 4;

/* ── สะบัด หรือ คู่เสียง? ─────────────────────────────────────────
   โน้ตหลายตัวในช่องเดียวมีสองความหมายในโน้ตไทย
     สะบัด   = ไล่เสียงติดกันเร็ว ๆ (ซล · รม · ดรม) → ห่างกันไม่เกินคู่สาม ทุกคู่ที่ติดกัน และไม่ซ้ำเสียงเดิม
     คู่เสียง = ตีพร้อมกัน (ดดฺ คู่แปด · ซด คู่สี่ · ดซ คู่ห้า) → ห่างกันตั้งแต่คู่สี่ขึ้นไป หรือเสียงเดียวกันต่างระดับ
   (การเล่นเสียงในเครื่องเล่นยังใช้กติกาของ lib/notation-core เหมือนเดิม — ตรงนี้ใช้เฉพาะโน้ตสากล)       */
const STEP_OF = { 'ด': 0, 'ร': 1, 'ม': 2, 'ฟ': 3, 'ซ': 4, 'ล': 5, 'ท': 6 };
export const noteStep = n => (STEP_OF[n?.ch] ?? 0) + 7 * (n?.register ?? 0);
export function isSabatNotes(notes) {
  if (!notes || notes.length < 2) return false;
  for (let i = 1; i < notes.length; i++) {
    const d = Math.abs(noteStep(notes[i]) - noteStep(notes[i - 1]));
    if (d === 0 || d > 2) return false;      // เสียงซ้ำ (คู่แปด) หรือกระโดดเกินคู่สาม = คู่เสียง ไม่ใช่สะบัด
  }
  return true;
}

// ── ขีดในโน้ตไทย = "ไม่ตีใหม่" เสียงตัวก่อนยังลากอยู่ ─────────────
//    ดังนั้นขีดที่ตามหลังโน้ต = ยืดความยาวโน้ตตัวนั้น ไม่ใช่ตัวหยุด
//    ขีดที่ต้นเพลงโดยยังไม่มีโน้ตมาก่อน = ตัวหยุดจริง
export function buildRuns(positions) {
  const n = positions.length;
  const runs = [];
  let i = 0;
  while (i < n) {
    const notes = positions[i] ?? [];
    let span = 1;
    while (i + span < n && (positions[i + span] ?? []).length === 0) span++;
    runs.push({ start: i, units: span, notes: notes.length ? notes : null });
    i += span;
  }
  return runs;
}

/* ── ตัดช่วงยาวให้เป็นค่าโน้ตที่เขียนได้จริง ────────────────────────
   o = ตำแหน่งเริ่มในห้อง (0-3) · n = ยาวกี่ตำแหน่ง
   กติกาการเขียนโน้ตสากล: ห้ามเขียนค่าที่กลบจังหวะหลักของห้อง
     2/4 มีจังหวะที่ตำแหน่ง 0 กับ 2
     - ตัวขาว (4) เขียนได้เฉพาะเริ่มที่ 0
     - ตัวดำประจุด (3) เขียนได้เฉพาะเริ่มที่ 0
     - ตัวดำ (2) เริ่มที่ 0 หรือ 2 ได้ · เริ่มที่ 1 ได้เฉพาะกรณีขัดจังหวะ [1,3)
     - ที่เหลือเป็นเขบ็ดหนึ่งชั้น (1)
   ชิ้นที่ตัดออกมาต่อกันด้วยเส้นโยง (tie) ผลรวมเท่าเดิมเสมอ            */
export function splitSpan(o, n, { syncopate = true } = {}) {
  const out = [];
  let i = o;
  const end = o + n;
  while (i < end) {
    let take = 0;
    for (const size of [4, 3, 2, 1]) {
      if (i + size > end) continue;
      if (size === 4 && i !== 0) continue;
      if (size === 3 && i !== 0) continue;
      if (size === 2 && i % 2 !== 0 && !(syncopate && i === 1 && end === 3)) continue;   // ★ ตัวดำคร่อมจังหวะ (- x - y) เฉพาะเมื่อจบพอดีที่ 3 · ถ้าลากยาวกว่านั้นให้ เขบ็ด+ตัวดำ อ่านง่ายและคานได้
      take = size; break;
    }
    if (!take) take = 1;
    out.push({ at: i, units: take });
    i += take;
  }
  return out;
}

/* ★★ ต้นเหตุของ "โน้ตไม่ครบห้อง" ที่ Pk เจอ (1 ก.ย. 69)
   ของเดิมใช้ค่า 'q' แล้วไปติดจุดทีหลังด้วย Dot.buildAndAttach
   VexFlow "วาดจุดให้ แต่ไม่นับจุดเข้าในความยาว" — ตัวดำประจุดจึงยาวแค่ 2 ตำแหน่ง
   ห้องที่มีตัวประจุดจึงขาดไป 1 ตำแหน่งทุกห้อง
   วัดจริง: duration 'q' + ติดจุด = 4096 tick · duration 'qd' = 6144 tick (ถูก)
   ทางแก้: ใส่จุดไว้ใน "ชื่อค่าโน้ต" ตั้งแต่แรก อย่าไปติดทีหลัง            */
export const DUR_OF_UNITS = { 1: '8', 2: 'q', 3: 'qd', 4: 'h' };
export function durationOf(units) {
  const duration = DUR_OF_UNITS[units] ?? '8';
  return { duration, dots: duration.includes('d') ? 1 : 0 };
}

/* ── แปลงทั้งสายเป็นห้อง ────────────────────────────────────────
   positions : [[note,...] | []]  — [] คือขีด
   barUnits  : ขนาดห้าง (ปกติ 4)
   pickup    : ขนาดห้องยกหน้าแรก (0 = ไม่มี) — ใช้ตอนวางจังหวะตกไว้ต้นห้อง
   คืน [{ index, start, size, events:[...] }]
     event = { kind:'note'|'rest'|'sabat', keys/notes, units, duration, dots,
               tieFrom, tieTo, pos }                                          */
export function toMeasures(positions, { barUnits = UNITS_PER_HONG, pickup = 0 } = {}) {
  const runs = buildRuns(positions);
  const total = positions.length;

  // ขอบห้อง
  const bounds = [];
  let at = 0;
  if (pickup > 0) { bounds.push({ start: 0, size: Math.min(pickup, total) }); at = Math.min(pickup, total); }
  while (at < total) { const size = Math.min(barUnits, total - at); bounds.push({ start: at, size }); at += size; }

  return bounds.map((b, bi) => {
    const events = [];
    const barEnd = b.start + b.size;
    for (const run of runs) {
      const from = Math.max(run.start, b.start);
      const to = Math.min(run.start + run.units, barEnd);
      if (to <= from) continue;                       // ไม่เกี่ยวกับห้องนี้
      const o = from - b.start;                       // ตำแหน่งในห้อง
      const n = to - from;
      const startsBefore = run.start < b.start;       // ลากมาจากห้องก่อน
      const endsAfter = run.start + run.units > barEnd;

      if (!run.notes) {
        // ตัวหยุดจริง (ไม่มีโน้ตมาก่อนเลย) — ไม่ต้องโยงเส้น
        splitSpan(o, n).forEach(p => {
          const { duration, dots } = durationOf(p.units);
          events.push({ kind: 'rest', units: p.units, duration, dots,
            pos: b.start + p.at, from: run.start, tieFrom: false, tieTo: false });
        });
        continue;
      }

      // สะบัด: โน้ตสองตัวในตำแหน่งเดียว → เขบ็ดสองชั้นสองตัวใน 1 ตำแหน่ง
      // ที่เหลือเป็นการลากเสียงของตัวหลัง
      // ★ คู่แปด/คู่สี่/คู่ห้าที่เขียนติดกันในช่องเดียว (ดดฺ · ซซฺ) ไม่ใช่สะบัด — ตีพร้อมกัน เขียนเป็นคู่เสียงบนก้านเดียว
      //   (Pk 2 ก.ย. 69 "บรรทัดเละ": ทำนองรวมของฆ้อง/ระนาดที่มีคู่แปดทุกตำแหน่งถูกวาดเป็นเขบ็ดสองชั้น+เส้นโยงเต็มบรรทัด)
      const sabatRun = run.notes.length >= 2 && isSabatNotes(run.notes);
      const isSabat = sabatRun && !startsBefore;      // ห้องที่ลากต่อมาจากสะบัดในห้องก่อน = ตัวหลังลากเสียงเฉย ๆ
      let restUnits = n, restOffset = o, first = true;
      if (isSabat) {
        events.push({ kind: 'sabat', notes: run.notes.slice(0, 2), units: 1,
          duration: '16', dots: 0, pos: b.start + o, from: run.start,
          tieFrom: false, tieTo: n > 1 || endsAfter });
        restUnits = n - 1; restOffset = o + 1; first = false;
      }
      if (restUnits > 0) {
        const pieces = splitSpan(restOffset, restUnits);
        pieces.forEach((p, pi) => {
          const { duration, dots } = durationOf(p.units);
          events.push({
            kind: 'note',
            // ★ สะบัดที่ลากข้ามห้อง: ห้องถัดไปต้องเป็นตัวหลังตัวเดียว (เดิมกลายเป็นคู่เสียง ซ+ล ค้างเสียง)
            notes: sabatRun ? [run.notes[run.notes.length - 1]] : run.notes,
            units: p.units, duration, dots, pos: b.start + p.at,
            from: run.start,   // ★ ตำแหน่งที่โน้ตตัวนี้ "เริ่มตี" จริง (ชิ้นลากเสียงข้ามห้องต้องดูมือที่ตำแหน่งนี้ ไม่ใช่ pos)
            tieFrom: startsBefore || !first || pi > 0,
            tieTo: pi < pieces.length - 1 || endsAfter,
          });
        });
      }
    }
    events.sort((a, b2) => a.pos - b2.pos);
    return { index: bi, start: b.start, size: b.size, events };
  });
}

// ── ผลรวมความยาวในห้องหนึ่ง (นับเป็นตำแหน่ง) ────────────────────
export function measureUnits(m) {
  return m.events.reduce((s, e) => s + (e.kind === 'sabat' ? 1 : e.units), 0);
}

/* ── ★ ตัวตรวจ: ทุกห้องต้องครบจังหวะเป๊ะ ─────────────────────────
   คืนรายการห้องที่ไม่ครบ (ว่าง = ถูกต้องทั้งหมด)
   ใช้ได้ทั้งในเทสต์และตอนวาดจริง — ห้องที่ไม่ครบจะไม่หลุดขึ้นเว็บเงียบ ๆ อีก */
export function checkBars(measures) {
  return measures
    .map(m => ({ index: m.index, expect: m.size, got: measureUnits(m) }))
    .filter(x => x.got !== x.expect);
}
export function assertFullBars(measures) {
  const bad = checkBars(measures);
  if (bad.length) {
    throw new Error('ห้องไม่ครบจังหวะ: ' +
      bad.slice(0, 4).map(b => `ห้องที่ ${b.index + 1} ได้ ${b.got}/${b.expect}`).join(' · '));
  }
  return measures;
}

/* ── จังหวะตกท้ายห้อง (ไทย) vs ตกต้นห้อง (สากล) ──────────────────
   โน้ตไทยจังหวะหนักอยู่ "ตำแหน่งสุดท้าย" ของห้อง (ลูกตก)
   โน้ตสากลจังหวะหนักอยู่ "ต้นห้อง"
   โหมด western จึงเลื่อนสายไป 3 ตำแหน่ง แล้วให้ 3 ตำแหน่งแรกเป็นห้องยก
   ผลคือลูกตกไปตกต้นห้องตามที่หูสากลคาด และห้องยังครบจังหวะทุกห้อง       */
export function pickupFor(beat, len, barUnits = UNITS_PER_HONG) {
  if (beat !== 'western' || len <= 0) return 0;
  return Math.min(barUnits - 1, len);
}

/* ── ★ ทุกห้องครบตามเครื่องหมายจังหวะ 2/4 ไม่มีห้องยก ไม่มีห้องเศษ (Pk 1 ก.ย. 69 ข้อ 2) ──
   วิธีเดิม (pickupFor) ทำห้องแรกเป็นห้องยก 3 ตำแหน่ง และห้องท้ายเหลือ 1 ตำแหน่ง
   Pk: "โน้ตสากลยังแสดงผลไม่เป็นไปตามเงื่อนไข Time Signature" → ห้องต้องเต็ม 2/4 ทุกห้อง
   ทางแก้: แบบสากล (ลูกตกอยู่ต้นห้อง) = เติมตัวหยุด 1 ตำแหน่งหน้าสาย
     ลูกตก (ตำแหน่งที่ 4 ของห้องไทย) จึงไปอยู่ต้นห้องสากลพอดี และห้องแรกยังเต็ม 2/4
     ท้ายสายเติมตำแหน่งว่างจนครบห้อง — ว่างหลังโน้ต = ลากเสียงลูกตกตัวสุดท้ายจนจบห้อง (ไม่ใช่ตัวหยุด)
   แบบไทย (ลูกตกท้ายห้อง) = ไม่เลื่อน แค่เติมท้ายให้ครบห้อง (ปกติครบอยู่แล้ว)                   */
export function leadFor(beat) { return beat === 'western' ? 1 : 0; }
export function padStream(positions, { lead = 0, barUnits = UNITS_PER_HONG } = {}) {
  const out = [];
  for (let i = 0; i < lead; i++) out.push([]);
  (positions ?? []).forEach(p => out.push(p ?? []));
  while (out.length % barUnits) out.push([]);
  return out;
}

/* ── ★ ตัวแปลง event → VexFlow StaveNote ใช้ร่วมกันทุกทาง (หน้าเว็บ · วิดีโอ MP4 · PDF/PNG) ──
   Pk 2 ก.ย. 69: "export โน้ตสากลทั้ง PDF และ MP4 ยังมีปัญหามาก — ห้องไม่ครบจังหวะ · โน้ตเลยเส้นกั้นห้อง"
   ต้นเหตุ ๑: duration 'qd' ของ VexFlow 4 นับความยาวถูก (6144 tick) แต่ "ไม่วาดจุด" — จุดเป็น modifier
     ต้องติดต่างหากด้วย Dot.buildAndAttach (ติดแล้วไม่นับซ้ำ — วัดจริง tick ยังเท่าเดิม)
     ตัวประจุดที่จุดหายจึงดูเป็นตัวดำเฉย ๆ → ห้อง "ดูไม่ครบจังหวะ" ทั้งที่จังหวะจริงครบ
   ต้นเหตุ ๒: ความกว้างห้องเคยเท่ากันหมด ห้องที่โน้ตแน่น (สะบัด/เขบ็ดหลายตัว) จึงถูกบีบ
     จนหัวโน้ตเบียดทับเส้นกั้นห้อง ดูเหมือน "เลยไปอยู่ห้องอื่น" → measureWeight ให้ห้องแน่นกว้างขึ้น
   PDF (lib/sheetkit) เคยมีตัวแปลงของตัวเองรุ่นเก่า (ห้องยก 3 ตำแหน่ง · ไม่ตรวจจังหวะ · ไม่มีเส้นโยง)
     — ตอนนี้ทุกทางเรียกฟังก์ชันชุดนี้ชุดเดียว                                                     */
export const VEX_KEY_OF = { 'ด': 'c', 'ร': 'd', 'ม': 'e', 'ฟ': 'f', 'ซ': 'g', 'ล': 'a', 'ท': 'b' };
const VEX_ORDER = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
export const vexKey = n => `${VEX_KEY_OF[n?.ch] ?? 'c'}/${4 + (n?.register ?? 0)}`;
export const vexKeyPitch = k => { const [b, o] = k.split('/'); return (+o) * 7 + (VEX_ORDER[b] ?? 0); };
export function vexMergeHands(rhNotes, lhNotes) {
  const keys = [...new Set([...(lhNotes ?? []), ...(rhNotes ?? [])].map(vexKey))];
  keys.sort((a, b) => vexKeyPitch(a) - vexKeyPitch(b));
  return keys;
}

// แปลง event ทั้งห้องเป็นโน้ต VexFlow
//   คืน { vexNotes: ทุกตัวเรียงตามเวลา (รวมตัวหยุด — ใส่ลง Voice),
//         sounding: [{note, tieTo}] เฉพาะตัวโน้ต (สะสมทั้งบรรทัดไว้ลากเส้นโยงข้ามห้อง) }
export function vexBarNotes(VF, events, handStream) {
  const vexNotes = [], sounding = [];
  const mk = (keys, duration) => {
    const n = new VF.StaveNote({ keys, duration });
    // ★ จุดต้องติดเป็น modifier ถึงจะวาด — ความยาวมาจาก 'd' ในชื่อค่าโน้ตอยู่แล้ว ไม่นับซ้ำ
    if (duration.includes('d')) VF.Dot.buildAndAttach([n], { all: true });
    return n;
  };
  (events ?? []).forEach(ev => {
    // ชิ้นที่ลากเสียงข้ามห้องต้องดูมือที่ตำแหน่ง "เริ่มตี" (ev.from) ไม่ใช่ตำแหน่งของชิ้น
    const hp = handStream ? handStream[ev.from ?? ev.pos] : null;
    if (ev.kind === 'rest') { vexNotes.push(mk(['b/4'], ev.duration + 'r')); return; }
    if (ev.kind === 'sabat') {
      const pair = ev.notes.slice(0, 2).map(n2 => new VF.StaveNote({ keys: [vexKey(n2)], duration: '16' }));
      vexNotes.push(...pair);
      sounding.push({ note: pair[0], tieTo: false }, { note: pair[1], tieTo: !!ev.tieTo });
      return;
    }
    const keys = (hp && hp.rh.length <= 1 && hp.lh.length <= 1)
      ? vexMergeHands(hp.rh, hp.lh)
      : [...new Set(ev.notes.map(vexKey))].sort((a, b) => vexKeyPitch(a) - vexKeyPitch(b));
    const n = mk(keys.length ? keys : ['c/4'], ev.duration);
    vexNotes.push(n);
    sounding.push({ note: n, tieTo: !!ev.tieTo });
  });
  return { vexNotes, sounding };
}

// น้ำหนักความกว้างห้อง — ห้องที่โน้ตแน่นต้องกว้างขึ้น ไม่งั้นหัวโน้ตเบียดทับเส้นกั้นห้อง
export function measureWeight(m) {
  const glyphs = (m.events ?? []).reduce((s, e) => s + (e.kind === 'sabat' ? 2 : 1) + (e.dots ? 0.4 : 0), 0);
  const base = m.size >= 4 ? 1 : m.size === 3 ? 0.8 : m.size === 2 ? 0.6 : 0.42;
  return Math.min(1.9, Math.max(base, 0.34 + 0.165 * glyphs));
}

// ลากเส้นโยงเสียงของทั้งบรรทัด (sounding สะสมข้ามห้องแล้ว — ปลายทางคือตัวโน้ตตัวถัดไปเสมอ)
export function drawRowTies(VF, ctx, sounding) {
  (sounding ?? []).forEach((sn, i) => {
    if (!sn.tieTo) return;
    const to = sounding[i + 1];
    if (!to) return;                                   // ลากต่อไปบรรทัดถัดไป — ไม่มีปลายทางในบรรทัดนี้
    try {
      new VF.StaveTie({ first_note: sn.note, last_note: to.note,
        first_indices: [0], last_indices: [0] }).setContext(ctx).draw();
    } catch (e) { /* ปลายทางวาดไม่ได้ ข้าม */ }
  });
}


/* ── ★ ประโยค (Pk 2 ก.ย. 69 ดึก): ป้ายบอกตำแหน่งทุกที่เลิกใช้ "วรรค" — ใช้ "ประโยคที่ N" เท่านั้น
   ๒ วรรคติดกันในท่อนเดียวกัน = ๑ ประโยค · นับใหม่ทุกท่อน (ยืนยันกับ Pk แล้ว — ตรงคลังลูกตกรายประโยค)
   ท่อนที่มีวรรคคี่: วรรคท้ายเป็นประโยคเดี่ยว (จังหวะพิเศษ) — ก็ได้เลขประโยคของตัวเอง                  */
export function sentenceMap(verses) {
  // คืน Map: ดัชนีวรรค (0-based) → { no: เลขประโยคในท่อน, half: 0=วรรคหน้า 1=วรรคหลัง, sec }
  const m = new Map(); let lastSec, idx = 0;
  (verses ?? []).forEach((v, vi) => {
    const sec = v?.section ?? null;
    if (vi === 0 || sec !== lastSec) { idx = 0; lastSec = sec; }
    m.set(vi, { no: Math.floor(idx / 2) + 1, half: idx % 2, sec });
    idx++;
  });
  return m;
}
// ป้ายช่วงประโยคของหนึ่งบรรทัด — entries = [{no, sec}] ของวรรคในบรรทัด (ท่อนเดียวกัน)
export function sentenceRangeLabel(entries, { cont = false, showSec = true } = {}) {
  const es = (entries ?? []).filter(Boolean);
  if (!es.length) return '';
  const nos = [...new Set(es.map(e => e.no))].sort((a, b) => a - b);
  const sec = es[0].sec;
  return 'ประโยคที่ ' + (nos.length > 1 ? `${nos[0]}–${nos[nos.length - 1]}` : nos[0])
    + (showSec && sec ? ` (${sec})` : '') + (cont ? ' (ต่อ)' : '');
}

/* ── ★ แบ่งบรรทัดตาม "จำนวนห้องจริง" + จัดโน้ตกึ่งกลางห้อง (Pk 2 ก.ย. 69 ค่ำ) ──
   Pk: "บรรทัดโน้ตสากลยังเละ — แนวตั้งให้บรรทัดละ 4 ห้อง แนวนอนบรรทัดละ 6 ห้อง
        และจัดโน้ตให้อยู่ตรงกลางห้อง อย่าให้ชิดเส้นกั้นห้องด้านใดด้านหนึ่ง"
   ของเดิมแบ่งบรรทัดเป็น "2 วรรค" เสมอ → 9 ห้องสากลต่อบรรทัด ห้องเล็กและแน่น
   ตอนนี้: ต่อทั้งท่อนเป็นสายเดียว → toMeasures ครั้งเดียว → ตัดเป็นบรรทัดละ N ห้องพอดี
   (วรรคจึงข้ามบรรทัดได้ — ลูกตกที่ตกต้นห้องถัดไปจะขึ้นบรรทัดใหม่แบบโน้ตสากลจริง)          */

// จำนวนห้องต่อบรรทัด: จอ/กระดาษแนวตั้ง (แคบ) = 4 · แนวนอน (กว้าง) = 6
export function barsPerLineFor(kind) { return kind === 'portrait' ? 4 : 6; }

// prepared = [{vi, v, positions, handPos}] เรียงตามเพลง
// คืน [{sec, secStart, label, measures (พิกัดภายในบรรทัด เริ่ม 0), handStream (ภายในบรรทัด),
//       verses: [{verseIdx, offset, posStart, len}], weights}]
//   วรรคที่ข้ามบรรทัด: posStart = ตำแหน่งแรกของวรรคที่อยู่ในบรรทัดนี้ (0 = ต้นวรรค)
export function layoutStaffLines(prepared, { beat = 'western', barsPerLine = 6, barUnits = UNITS_PER_HONG } = {}) {
  const lines = [];
  let group = [], lastSec;
  const flush = () => { if (group.length) buildGroup(group); group = []; };
  (prepared ?? []).forEach(pv => {
    const sec = pv.v?.section ?? null;
    if (group.length && sec !== lastSec) flush();
    group.push(pv); lastSec = sec;
  });
  flush();

  function buildGroup(gvs) {
    const lead = leadFor(beat);
    const raw = [], handRaw = [], vinfo = [];
    gvs.forEach((pv, gi) => {
      // ประโยคนับใหม่ทุกท่อน: วรรคที่ gi ในท่อน → ประโยคที่ floor(gi/2)+1 · half 0=วรรคหน้า 1=วรรคหลัง
      vinfo.push({ verseIdx: pv.vi, gStart: lead + raw.length, len: pv.positions.length, v: pv.v,
        sno: Math.floor(gi / 2) + 1, half: gi % 2 });
      raw.push(...pv.positions);
      pv.positions.forEach((_, i) => handRaw.push(pv.handPos ? pv.handPos[i] : null));
    });
    const stream = padStream(raw, { lead, barUnits });
    const handStream = stream.map((_, i) => (i >= lead && i - lead < handRaw.length) ? handRaw[i - lead] : null);
    const measures = toMeasures(stream, { barUnits });
    const per = Math.max(1, barsPerLine | 0);
    for (let b = 0; b < measures.length; b += per) {
      const ms = measures.slice(b, b + per);
      const startUnit = ms[0].start;
      const endUnit = ms[ms.length - 1].start + ms[ms.length - 1].size;
      // เลื่อนพิกัดให้เริ่มที่ 0 — rects/เคอร์เซอร์ใช้พิกัดภายในบรรทัดเหมือนเดิม
      // (ev.from ของชิ้นที่ลากมาจากบรรทัดก่อนจะติดลบ → หา "มือ" ไม่เจอ → ใช้ ev.notes ซึ่งมีครบทั้งสองมืออยู่แล้ว)
      const local = ms.map(m => ({ ...m, start: m.start - startUnit,
        events: m.events.map(e => ({ ...e, pos: e.pos - startUnit,
          from: e.from != null ? e.from - startUnit : undefined })) }));
      const vlist = [], ents = [];
      vinfo.forEach(vi2 => {
        const a = Math.max(vi2.gStart, startUnit), z = Math.min(vi2.gStart + vi2.len, endUnit);
        if (z <= a) return;
        vlist.push({ verseIdx: vi2.verseIdx, offset: a - startUnit, posStart: a - vi2.gStart, len: z - a, v: vi2.v });
        ents.push({ no: vi2.sno, half: vi2.half, sec: vi2.v?.section ?? null, posStart: a - vi2.gStart });
      });
      /* ★ ป้ายบอกตำแหน่งเป็น "ประโยคที่ N" (Pk 2 ก.ย. 69 ดึก — เลิกระบุเป็นวรรคทุกที่)
         (ต่อ) = บรรทัดเริ่มกลางประโยค (เริ่มกลางวรรค หรือเริ่มที่วรรคหลังของประโยค) */
      const label = sentenceRangeLabel(ents,
        { cont: ents.length > 0 && (ents[0].posStart > 0 || ents[0].half === 1) });
      lines.push({ sec: gvs[0].v?.section ?? null, secStart: b === 0, label,
        measures: local, handStream: handStream.slice(startUnit, endUnit),
        verses: vlist.map(({ v, ...rest }) => rest), weights: local.map(measureWeight) });
    }
  }
  return lines;
}

// หาเคอร์เซอร์ในบรรทัด (รองรับวรรคข้ามบรรทัด): คืน {vm, gpos} หรือ null
export function findCursorInLine(lineVerses, cur) {
  const vm = (lineVerses ?? []).find(v => v.verseIdx === cur.verseIdx
    && cur.pos >= (v.posStart ?? 0) && cur.pos < (v.posStart ?? 0) + v.len);
  if (!vm) return null;
  return { vm, gpos: vm.offset + cur.pos - (vm.posStart ?? 0) };
}

// จัดกลุ่มโน้ตให้อยู่ "กลางห้อง" — เว้นขอบซ้าย-ขวาพอ ๆ กัน ไม่ชิดเส้นกั้นห้อง
//   innerW = ความกว้างห้อง (ไม่รวมกุญแจ) · VexFlow จัดชิดซ้ายโดยปริยาย (ช่องว่างไปกองขวาหมด)
export function formatCentered(VF, voice, stave, innerW) {
  const pad = Math.max(10, Math.min(30, innerW * 0.15));
  stave.setNoteStartX(stave.getNoteStartX() + pad);
  new VF.Formatter().joinVoices([voice]).format([voice], Math.max(20, innerW - pad * 2 - 8));
}
