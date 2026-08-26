// lib/melodybank.js — คลังเสียงเครื่องดำเนินทำนอง (ขิม ระนาด ฆ้อง จะเข้ …) (2026-08-26)
//
//   โหลดไฟล์เสียงทั้งโฟลเดอร์ของเครื่องหนึ่งจาก Supabase Storage (bucket instrument-samples/<slug>/)
//   จับคู่ไฟล์ → "ขั้นเสียงสัมบูรณ์" ตามทะเบียนเครื่อง (lib/instruments.js) แล้วเล่นด้วยเสียงจริง
//   เสียงที่ไม่มีไฟล์ → ขยับระดับเสียงจากไฟล์ที่ใกล้ที่สุด (บันไดไทย 7 เสียงเท่ากัน: 1 ขั้น = 2^(1/7))
//   จึงอัปไฟล์ไม่ครบทั้งเครื่องก็เล่นได้ทุกเสียง (ยิ่งครบยิ่งเหมือนจริง)
import { supabase } from './supabase';
import { stepOf, indexToStep, NAME_REG, LATIN_NOTE } from './instruments';

const BUCKET = 'instrument-samples';
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;
const banks = {};      // slug → { steps: {step: {buf, onset}}, count }
const loading = {};

function detectOnset(audio) {
  try {
    const d = audio.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
    if (peak < 0.001) return 0;
    const thr = peak * 0.03;
    let i = 0;
    while (i < d.length && Math.abs(d[i]) < thr) i++;
    return Math.max(0, i / audio.sampleRate - 0.002);
  } catch { return 0; }
}

// ชื่อไฟล์ (ไม่รวมนามสกุล) → ขั้นเสียงสัมบูรณ์ · คืน null ถ้าอ่านไม่ออก
export function stepOfFile(inst, base) {
  const b = String(base).trim().toLowerCase();
  // 1) เลขลำดับ: 01, 7, 021
  const mNum = b.match(/^0*(\d{1,3})$/);
  if (mNum) return indexToStep(inst, parseInt(mNum[1], 10));
  // 2) ชื่อโน้ต + ช่วงเสียง: d_mid, s_low, t_high (หรือ dmid / d-mid)
  const mN = b.match(/^([drmfslt])[\s_-]*(vlow|low|mid|high|vhigh)?$/);
  if (mN) return stepOf(LATIN_NOTE[mN[1]], NAME_REG[mN[2] || 'mid'] ?? 0);
  // 3) อักษรไทย: ด, ซฺ, มํ
  const mT = b.match(/^([ดรมฟซลท])(ํ{1,2}|ฺ{1,2})?$/);
  if (mT) {
    const mark = mT[2] || '';
    const reg = mark.startsWith('ํ') ? mark.length : mark.startsWith('ฺ') ? -mark.length : 0;
    return stepOf(mT[1], reg);
  }
  // 4) มีเลขปนท้าย เช่น khim01, ranad_03
  const mAny = b.match(/(\d{1,3})\s*$/);
  if (mAny) return indexToStep(inst, parseInt(mAny[1], 10));
  return null;
}

export function bankOf(slug) { return banks[slug] || null; }

export async function loadMelodyBank(ctx, inst) {
  const slug = typeof inst === 'string' ? inst : inst?.slug;
  if (!slug) return null;
  if (banks[slug]) return banks[slug];
  if (loading[slug]) return loading[slug];
  const meta = typeof inst === 'string' ? { slug, naming: 'index', low_note: 'ด', low_reg: 0 } : inst;
  loading[slug] = (async () => {
    const steps = {};
    try {
      const { data: files } = await supabase.storage.from(BUCKET).list(slug, { limit: 300 });
      const audio = (files ?? []).filter(f => AUDIO_EXT.test(f.name));
      await Promise.all(audio.map(async f => {
        const base = f.name.replace(AUDIO_EXT, '');
        const step = stepOfFile(meta, base);
        if (step == null) return;
        try {
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${slug}/${f.name}`);
          const res = await fetch(data.publicUrl);
          if (!res.ok) return;
          const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
          steps[step] = { buf: decoded, onset: detectOnset(decoded) };
        } catch { /* ไฟล์เสีย ข้ามไป */ }
      }));
    } catch { /* อ่านโฟลเดอร์ไม่ได้ */ }
    const bank = { slug, steps, count: Object.keys(steps).length };
    banks[slug] = bank;
    return bank;
  })();
  return loading[slug];
}
export function invalidateMelodyBank(slug) { if (slug) { delete banks[slug]; delete loading[slug]; } else { for (const k of Object.keys(banks)) { delete banks[k]; delete loading[k]; } } }

// หาไฟล์ที่ใกล้ขั้นเสียงเป้าหมายที่สุด (เสมอกัน → เลือกตัวต่ำกว่า เสียงขยับขึ้นฟังธรรมชาติกว่า)
export function nearestStep(bank, target) {
  const keys = Object.keys(bank?.steps || {});
  if (!keys.length) return null;
  let best = null, bestD = Infinity;
  for (const k of keys) {
    const st = +k, d = Math.abs(st - target);
    if (d < bestD || (d === bestD && st < best)) { best = st; bestD = d; }
  }
  return best;
}

// เล่นโน้ตหนึ่งตัว · คืน true ถ้าใช้เสียงจริงได้ (false = ให้ผู้เรียกสังเคราะห์แทน)
//   shift = ขั้นเสียงที่เลื่อนทั้งระบบ (ปี่พาทย์ +1) · transpose = ของเครื่องนั้นเอง
export function playMelodyNote(ctx, bank, ch, reg = 0, time = 0, gain = 0.8, shift = 0, transpose = 0) {
  if (!bank || !bank.count) return false;
  const target = stepOf(ch, reg) + (shift || 0) + (transpose || 0);
  const src = bank.steps[target] ? target : nearestStep(bank, target);
  if (src == null) return false;
  const item = bank.steps[src];
  try {
    const node = ctx.createBufferSource();
    node.buffer = item.buf;
    node.playbackRate.value = Math.pow(2, (target - src) / 7);   // 7 เสียงเท่ากันต่อคู่แปด
    const g = ctx.createGain();
    g.gain.value = gain;
    node.connect(g); g.connect(ctx.destination);
    node.start(time, item.onset);
    return true;
  } catch { return false; }
}

// สรุปสถานะไว้แสดงในหน้าผู้ดูแล / แถบเสียงของกระดาน
export function bankSummary(bank, inst) {
  const have = Object.keys(bank?.steps || {}).map(Number).sort((a, b) => a - b);
  const want = Math.max(1, inst?.note_count || 0);
  return { have: have.length, want, exact: have, shifted: Math.max(0, want - have.length) };
}
