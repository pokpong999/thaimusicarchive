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
      if (size === 2 && i % 2 !== 0 && !(syncopate && i === 1 && i + 2 === 3)) continue;
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
            pos: b.start + p.at, tieFrom: false, tieTo: false });
        });
        continue;
      }

      // สะบัด: โน้ตสองตัวในตำแหน่งเดียว → เขบ็ดสองชั้นสองตัวใน 1 ตำแหน่ง
      // ที่เหลือเป็นการลากเสียงของตัวหลัง
      const isSabat = run.notes.length >= 2 && !startsBefore;
      let restUnits = n, restOffset = o, first = true;
      if (isSabat) {
        events.push({ kind: 'sabat', notes: run.notes.slice(0, 2), units: 1,
          duration: '16', dots: 0, pos: b.start + o,
          tieFrom: false, tieTo: n > 1 || endsAfter });
        restUnits = n - 1; restOffset = o + 1; first = false;
      }
      if (restUnits > 0) {
        const pieces = splitSpan(restOffset, restUnits);
        pieces.forEach((p, pi) => {
          const { duration, dots } = durationOf(p.units);
          events.push({
            kind: 'note',
            notes: isSabat ? [run.notes[run.notes.length - 1]] : run.notes,
            units: p.units, duration, dots, pos: b.start + p.at,
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
