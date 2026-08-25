// หน้าทับกลอง + ฉิ่ง — เสียงจริงจากคลังตัวอย่าง ถ้ายังไม่มีไฟล์ใช้เสียงสังเคราะห์แทน
// pattern มาจากตาราง nathab_patterns (Admin แก้ได้)
import { playFromBank, loadBank } from './samplebank';

export { loadBank as loadDrumBank };

// ฉิ่ง: ตำแหน่งตายตัวตามอัตราชั้น (1 ห้อง = 4 ตำแหน่ง)
export const CHING_PATTERNS = {
  'สามชั้น':  { hongs: 8, hits: { 16: 'ฉิ่ง', 32: 'ฉับ' } },
  'สองชั้น':  { hongs: 4, hits: { 8: 'ฉิ่ง', 16: 'ฉับ' } },
  'ชั้นเดียว': { hongs: 1, hits: { 2: 'ฉิ่ง', 4: 'ฉับ' } },   // ฉิ่งขีดที่ 2 ฉับขีดที่ 4 (Pk เคาะ 2026-08-24)
};

// ประเภทเสียงต่อพยางค์กลอง
const STROKE_TYPE = {
  'ติง':'mid', 'ทิง':'mid', 'เท่ง':'mid',
  'ตุ๊บ':'low', 'พลึง':'low', 'พรึม':'low', 'เพลิ่ง':'low', 'ทั่ง':'low', 'ทั่ม':'low', 'จ๊ะทั่ม':'low',
  'ถะ':'slap', 'ป๊ะ':'slap', 'จ๊ะ':'slap', 'โจ๊ะ':'slap', 'ฉะ':'slap',
  'ตูม':'boom', 'ต้อม':'boom',                     // กลองทัด เสียงใหญ่ ทุ้มลึก
  'ฉิ่ง':'ching', 'ฉับ':'chap',
};

// แปลง pattern text "- - - เท่ง | ..." → array ของ {pos(1-based), syll}
export function parsePattern(text) {
  const hits = [];
  let pos = 0;
  for (const hong of (text || '').split('|')) {
    const tokens = hong.trim().split(/\s+/).filter(t => t.length > 0);
    for (const t of tokens) {
      pos++;
      if (t !== '-') hits.push({ pos, syll: t });
    }
  }
  return { hits, len: pos };
}

// instrument = ชื่อเครื่องไทย เช่น 'ตะโพน' · ถ้ามีไฟล์เสียงจริงในคลังจะใช้ไฟล์ก่อนเสมอ
export function playPercussion(ctx, syll, time, gain = 0.8, instrument = null) {
  // ฉิ่ง/ฉับ อยู่คนละเครื่องกับกลอง จึงหาในโฟลเดอร์ ching เสมอ
  const from = (syll === 'ฉิ่ง' || syll === 'ฉับ') ? 'ฉิ่ง' : instrument;
  if (from && playFromBank(ctx, from, syll, time, gain)) return true;   // ใช้เสียงจริงแล้ว
  const type = STROKE_TYPE[syll] || 'mid';
  if (type === 'boom') membrane(ctx, 62, 34, 0.85, time, gain);
  else if (type === 'low') membrane(ctx, 85, 50, 0.35, time, gain);
  else if (type === 'mid') membrane(ctx, 190, 120, 0.22, time, gain * 0.9);
  else if (type === 'slap') slap(ctx, time, gain * 0.7);
  else if (type === 'ching') ching(ctx, time, gain * 0.5, 1.1);
  else if (type === 'chap') ching(ctx, time, gain * 0.5, 0.09);
  return false;                                                        // ใช้เสียงสังเคราะห์
}

function membrane(ctx, f1, f2, dur, time, gain) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f1, time);
  osc.frequency.exponentialRampToValueAtTime(f2, time + dur * 0.7);
  osc.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.start(time); osc.stop(time + dur + 0.05);
}

function slap(ctx, time, gain) {
  const len = 0.09;
  const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.2;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(bp); bp.connect(g); g.connect(ctx.destination);
  src.start(time);
}

function ching(ctx, time, gain, dur) {
  [2900, 4350, 6100].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = f;
    osc.connect(g); g.connect(ctx.destination);
    const amp = gain * [1, 0.5, 0.25][i];
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(amp, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.start(time); osc.stop(time + dur + 0.05);
  });
}
