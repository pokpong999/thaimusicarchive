// lib/pitch.js — วัดความถี่จริงของไฟล์เสียงที่อัดไว้ (2026-08-26)
//
//   ใช้จูนเสียงเครื่องดนตรีที่อัดไว้เดิม ให้ตรงกับตารางความถี่ที่ตั้งไว้ (lib/tuning.js)
//   วิธี: YIN (cumulative mean normalized difference) — ทนเสียงกระทบแบบฆ้อง/ระนาดที่มีฮาร์มอนิกเพี้ยน
//   กันหลงคู่แปด: ถ้ารู้ความถี่ที่ "ควรจะเป็น" อยู่แล้ว จะค้นหาเฉพาะรอบ ๆ ค่านั้น
//
//   ไม่ต้องแก้ไฟล์ต้นฉบับ — เก็บความถี่ที่วัดได้ลง instrument_notes.hz
//   แล้วตอนเล่น ระบบจะปรับอัตราให้ตรงตารางเองอัตโนมัติ (lib/melodybank.js)

const CENTS = (a, b) => 1200 * Math.log2(a / b);

// ── หาคาบเสียงบนหนึ่งเฟรม ───────────────────────────────────────
//   ใช้ 2 ขั้น
//     1) CMND (แบบ YIN) เลือก "คาบไหน" — เก่งเรื่องไม่หลงคู่แปด
//     2) NCCF (สหสัมพันธ์แบบหารด้วยพลังงาน) เกลาตำแหน่งให้ละเอียด
//        — จำเป็นเพราะเสียงเครื่องตีเบาลงเรื่อย ๆ ถ้าใช้ผลต่างดิบจะวัดสูงกว่าจริงเสมอ (~3-4 เซนต์)
//   คืน { hz, quality } · quality 0–1 · null = จับไม่ได้
function periodFrame(buf, rate, minHz, maxHz, thresh = 0.15) {
  const N = buf.length;
  const tauMin = Math.max(2, Math.floor(rate / maxHz));
  const tauMax = Math.min(Math.floor(N / 2), Math.ceil(rate / minHz));
  if (tauMax <= tauMin + 2) return null;

  // ตัดไฟตรง (DC) ออกก่อน
  let mean = 0; for (let i = 0; i < N; i++) mean += buf[i]; mean /= N;
  const x = new Float32Array(N);
  for (let i = 0; i < N; i++) x[i] = buf[i] - mean;

  const W = N - tauMax;                       // ความยาวหน้าต่างเปรียบเทียบ (คงที่ทุก tau)
  if (W < tauMin * 2) return null;
  let e0 = 0; for (let i = 0; i < W; i++) e0 += x[i] * x[i];
  if (e0 <= 0) return null;

  const nccf = new Float32Array(tauMax + 1);
  const d = new Float32Array(tauMax + 1);
  for (let tau = tauMin; tau <= tauMax; tau++) {
    let dot = 0, e1 = 0, diff = 0;
    for (let i = 0; i < W; i++) {
      const a = x[i], b = x[i + tau];
      dot += a * b; e1 += b * b; const t = a - b; diff += t * t;
    }
    nccf[tau] = e1 > 0 ? dot / Math.sqrt(e0 * e1) : 0;
    d[tau] = diff;
  }

  // 1) เลือกคาบด้วย CMND
  const cmnd = new Float32Array(tauMax + 1).fill(1);
  let run = 0;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    run += d[tau];
    cmnd[tau] = run === 0 ? 1 : d[tau] * (tau - tauMin + 1) / run;
  }
  let best = -1;
  for (let tau = tauMin + 1; tau < tauMax; tau++) {
    if (cmnd[tau] < thresh) {
      while (tau + 1 < tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      best = tau; break;
    }
  }
  if (best < 0) { let lo = Infinity; for (let tau = tauMin + 1; tau < tauMax; tau++) if (cmnd[tau] < lo) { lo = cmnd[tau]; best = tau; } }
  if (best < tauMin + 1 || best >= tauMax) return null;

  // 2) เกลาตำแหน่งบนยอด NCCF ที่ใกล้ที่สุด (ไม่ลำเอียงตามความดังที่ลดลง)
  let t = best;
  for (let k = 0; k < 3; k++) {
    if (t + 1 < tauMax && nccf[t + 1] > nccf[t]) t++;
    else if (t - 1 > tauMin && nccf[t - 1] > nccf[t]) t--;
    else break;
  }
  const y0 = nccf[t - 1] ?? nccf[t], y1 = nccf[t], y2 = nccf[t + 1] ?? nccf[t];
  const denom = 2 * (2 * y1 - y0 - y2);
  const shift = denom !== 0 ? (y2 - y0) / denom : 0;
  const period = t + (Math.abs(shift) < 1 ? shift : 0);
  if (!(period > 0)) return null;
  return { hz: rate / period, quality: Math.max(0, Math.min(1, nccf[t])) };
}

// ── หา "จุดเริ่มเสียง" แล้วเก็บช่วงที่เสียงนิ่ง ───────────────────
function onsetOf(data, rate) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; }
  if (peak < 1e-4) return 0;
  const thr = peak * 0.05;
  let i = 0; while (i < data.length && Math.abs(data[i]) < thr) i++;
  return i / rate;
}

/* ─────────────────────────────────────────────────────────────
   วัดความถี่ของไฟล์เสียงหนึ่งไฟล์
     buffer   AudioBuffer (หรือ {getChannelData, sampleRate, duration})
     expectHz ความถี่ที่ควรจะเป็น (ว่างได้) — ใช้จำกัดช่วงค้นหา กันหลงคู่แปด
     window   ค้นหาในช่วงกี่ "ขั้นเสียงไทย" รอบ ๆ expectHz (ปริยาย 3 ขั้น ≈ ±35%)
   คืน { hz, cents, quality, frames } · null = จับไม่ได้
   ───────────────────────────────────────────────────────────── */
export function detectPitch(buffer, { expectHz = null, window: win = 3, minHz = 50, maxHz = 4000 } = {}) {
  if (!buffer) return null;
  const rate = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  let lo = minHz, hi = maxHz;
  if (expectHz > 0) {
    const span = Math.pow(2, win / 7);          // ± กี่ขั้นเสียงไทย
    lo = Math.max(minHz, expectHz / span);
    hi = Math.min(maxHz, expectHz * span);
  }

  // เก็บหลายเฟรมหลังจุดเริ่มเสียง แล้วเอาค่ากลาง — ตัดช่วงหัวที่ยังไม่นิ่งและหางที่จมเสียงรบกวน
  const start = Math.floor(onsetOf(data, rate) * rate) + Math.floor(rate * 0.03);
  const frameLen = Math.min(data.length, Math.max(2048, Math.ceil(rate / lo) * 4));
  const hop = Math.floor(frameLen / 2);
  const picks = [];
  for (let s = start; s + frameLen <= data.length && picks.length < 24; s += hop) {
    const frame = data.subarray(s, s + frameLen);
    let rms = 0; for (let i = 0; i < frame.length; i++) rms += frame[i] * frame[i];
    rms = Math.sqrt(rms / frame.length);
    if (rms < 0.004) continue;                  // เงียบเกินไป ข้าม
    const r = periodFrame(frame, rate, lo, hi);
    if (r && r.hz >= lo && r.hz <= hi) picks.push(r);
  }
  if (!picks.length) return null;

  // ทิ้งเฟรมคุณภาพต่ำถ้ายังเหลือพอ — เสียงรบกวนช่วงหัวไม่ให้ดึงค่ากลางเพี้ยน
  const top = picks.slice().sort((a, b) => b.quality - a.quality);
  const keep = top.filter(p => p.quality >= top[0].quality * 0.85);
  const use = keep.length >= 3 ? keep : picks;

  // ค่ากลางของความถี่ (median) — ทนตัวหลุดดีกว่าค่าเฉลี่ย
  const sorted = use.map(p => p.hz).sort((a, b) => a - b);
  const hz = sorted.length % 2 ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  // ความมั่นใจ = คุณภาพเฉลี่ย × ความนิ่งของค่าที่วัดได้
  const spread = sorted.length > 2 ? Math.abs(CENTS(sorted[sorted.length - 1], sorted[0])) : 0;
  const q = use.reduce((a, p) => a + p.quality, 0) / use.length;
  const stable = spread <= 0 ? 1 : Math.max(0, 1 - spread / 120);
  return {
    hz,
    cents: expectHz > 0 ? CENTS(hz, expectHz) : null,
    quality: Math.max(0, Math.min(1, q * 0.5 + stable * 0.5)),
    frames: use.length,
  };
}

/* ─────────────────────────────────────────────────────────────
   สร้าง AudioBuffer ที่ "จูนแล้ว" — ยืด/หดให้ได้ความถี่เป้าหมาย
   (ไฟล์ต้นฉบับไม่ถูกแตะ · ใช้ตอนอยากดาวน์โหลดไฟล์ที่จูนแล้วเก็บไว้)
   ───────────────────────────────────────────────────────────── */
export function resampleBuffer(ctx, buffer, rate) {
  if (!buffer || !(rate > 0)) return buffer;
  const ch = buffer.numberOfChannels;
  const outLen = Math.max(1, Math.round(buffer.length / rate));
  const out = ctx.createBuffer(ch, outLen, buffer.sampleRate);
  for (let c = 0; c < ch; c++) {
    const src = buffer.getChannelData(c), dst = out.getChannelData(c);
    for (let i = 0; i < outLen; i++) {
      const pos = i * rate, i0 = Math.floor(pos), f = pos - i0;
      const a = src[i0] ?? 0, b = src[i0 + 1] ?? a;
      dst[i] = a + (b - a) * f;                  // เชิงเส้น พอสำหรับการขยับเล็กน้อย
    }
  }
  return out;
}

// AudioBuffer → ไฟล์ WAV 16 บิต (ดาวน์โหลดเก็บได้เลย)
export function bufferToWav(buffer) {
  const ch = buffer.numberOfChannels, len = buffer.length, rate = buffer.sampleRate;
  const bytes = 44 + len * ch * 2;
  const ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, len * ch * 2, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}
