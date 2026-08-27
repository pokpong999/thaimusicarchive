// lib/tempo.js — จังหวะที่ไม่สม่ำเสมอ: เร่งขึ้นทั้งท่อน แล้วจบท่อนแบบ "ถอน" หรือ "ทอด"
//   (Pk เคาะ 27 ส.ค. 2569)
//
//   ถอน — เร่งขึ้นเรื่อย ๆ จนถึงเสียงสุดท้ายของท่อน ไม่ผ่อนเลย
//          แล้ว "ท่อนถัดไป" เริ่มที่ครึ่งหนึ่งของความเร็วท้ายท่อนที่เพิ่งจบ แล้วไต่ขึ้นใหม่
//          → ท่อนที่ถอนต้องเร่งเยอะพอ ไม่งั้นพอขึ้นท่อนใหม่จังหวะจะยืดยาดเกินไป
//   ทอด — เร่งขึ้นตามปกติ แต่ครึ่งหลังของจังหวะหน้าทับสุดท้าย ค่อย ๆ ผ่อนลงเหลือ 70%
//          ท่อนถัดไปกลับมาที่ความเร็วปกติ
//
//   ทุกแนวใช้ความเร็วเดียวกันหมด (ทำนอง ฉิ่ง กลอง) — โมดูลนี้คืน "ความยาวของแต่ละตำแหน่ง"
//   ให้ผู้เรียกเอาไปบวกสะสมเป็นเวลาจริง จึงไม่มีทางที่แนวใดแนวหนึ่งจะหลุดจากกัน

export const TEMPO_DEFAULTS = {
  on: false,          // ค่าเริ่มต้น = จังหวะสม่ำเสมอเหมือนเดิม
  accel: 0.15,        // ท่อนธรรมดา: ท้ายท่อนเร็วกว่าต้นท่อนกี่เท่า (0.15 = เร็วขึ้น 15%)
  accelThon: 1.0,     // ท่อนที่ถอน: เร่งมากกว่า (1.0 = ท้ายท่อนเร็วเป็นสองเท่าของต้นท่อน)
  thonRatio: 0.5,     // ขึ้นท่อนใหม่หลังถอน = กี่ส่วนของความเร็วท้ายท่อนก่อนหน้า
  thotRatio: 0.7,     // ทอด: ผ่อนลงเหลือกี่ส่วนของความเร็วขณะนั้น
};
export const MODES = ['', 'thon', 'thot'];
export const MODE_LABEL = { '': 'ปกติ', thon: 'ถอน', thot: 'ทอด' };

const lerp = (a, b, t) => a + (b - a) * t;
const clampRatio = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);

/* สร้างแผนความเร็วตาม "ลำดับที่เล่นจริง" (seq) ไม่ใช่ตามลำดับในโน้ต
   — เพราะการกลับต้นทำให้ท่อนเดิมถูกเล่นซ้ำ และการถอนของเที่ยวก่อนต้องส่งผลถึงเที่ยวถัดไปด้วย

   seq        : ตำแหน่ง (step) เรียงตามลำดับที่จะเล่น
   blockOf    : step → หมายเลขบล็อกท่อน (ท่อนชื่อซ้ำกันคนละที่ = คนละบล็อก)
   modeOf     : หมายเลขบล็อก → '' | 'thon' | 'thot'
   halfCycleOf: หมายเลขบล็อก → จำนวนตำแหน่งของ "ครึ่งจังหวะหน้าทับ" ของท่อนนั้น
   คืน { factors, durs } — factors[i] = ตัวคูณความเร็ว ณ ตำแหน่งที่ i ของ seq            */
export function tempoPlan({ seq, blockOf, modeOf, halfCycleOf, base = 120, opts = {} }) {
  const o = { ...TEMPO_DEFAULTS, ...opts };
  const n = seq.length;
  const factors = new Array(n).fill(1);
  if (!o.on || !n) return { factors, durs: factors.map(() => 60 / base / 2) };

  const accel = Math.max(0, o.accel), accelThon = Math.max(0, o.accelThon);
  const thonRatio = clampRatio(o.thonRatio, TEMPO_DEFAULTS.thonRatio);
  const thotRatio = clampRatio(o.thotRatio, TEMPO_DEFAULTS.thotRatio);

  // ตัดเป็น "รอบการเล่นของท่อน" ตามลำดับจริง — เข้าท่อนใหม่ หรือวนกลับมาท่อนเดิม = รอบใหม่
  const passes = [];
  let cur = null;
  for (let i = 0; i < n; i++) {
    const b = blockOf(seq[i]);
    if (!cur || b !== cur.block) { cur = { block: b, from: i, to: i }; passes.push(cur); }
    else cur.to = i;
  }

  let startFactor = 1;
  passes.forEach(p => {
    const mode = modeOf(p.block) || '';
    const len = p.to - p.from + 1;
    const endFactor = startFactor * (1 + (mode === 'thon' ? accelThon : accel));
    for (let i = 0; i < len; i++) {
      factors[p.from + i] = len === 1 ? endFactor : lerp(startFactor, endFactor, i / (len - 1));
    }
    if (mode === 'thot') {
      // ผ่อนลงเฉพาะครึ่งหลังของจังหวะหน้าทับสุดท้าย — ไล่ลงทีละน้อย ไม่กระชาก
      const span = Math.max(1, Math.min(len, Math.round(halfCycleOf(p.block) || 0) || Math.ceil(len / 4)));
      for (let k = 0; k < span; k++) {
        const idx = p.to - span + 1 + k;
        const w = span === 1 ? 1 : (k + 1) / span;            // 0→1 ตลอดช่วงผ่อน
        factors[idx] *= lerp(1, thotRatio, w);
      }
      startFactor = 1;                                        // ท่อนถัดไปกลับมาความเร็วปกติ
    } else if (mode === 'thon') {
      startFactor = endFactor * thonRatio;                    // ท่อนถัดไปเริ่มจากความเร็วท้ายท่อนนี้
    } else {
      startFactor = 1;
    }
  });

  return { factors, durs: factors.map(f => 60 / (base * f) / 2) };
}

// ความเร็วจริง (bpm) ของแต่ละตำแหน่ง — ไว้โชว์ให้ผู้ใช้เห็นว่าตั้งค่าแล้วได้เท่าไร
export const bpmAt = (base, factor) => Math.round(base * factor);

/* ครึ่งจังหวะหน้าทับ คิดเป็นจำนวนตำแหน่ง (1 ห้อง = 4 ตำแหน่ง)
   สามชั้น 8 ห้อง/จังหวะ → ครึ่ง = 16 · สองชั้น 4 ห้อง → 8 · ชั้นเดียว 2 ห้อง → 4      */
export const HALF_CYCLE_STEPS = { 'สามชั้น': 16, 'สองชั้น': 8, 'ชั้นเดียว': 4 };
export const halfCycleOfLevel = lv => HALF_CYCLE_STEPS[lv] ?? HALF_CYCLE_STEPS['สองชั้น'];
