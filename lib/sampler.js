// เครื่องเสียงฆ้องวงใหญ่ — โหลด sample จริงจาก Supabase Storage
// ไฟล์: instrument-samples/gong/{d|r|m|f|s|l|t}_{low|mid|high}.mp3
import { supabase } from './supabase';

export const NOTE_LATIN = { 'ด':'d','ร':'r','ม':'m','ฟ':'f','ซ':'s','ล':'l','ท':'t' };
export const REG_NAME = { '-1':'low', '0':'mid', '1':'high' };

// ลูกฆ้อง 16 ลูก: มฺ ฟฺ ซฺ ลฺ ทฺ | ด ร ม ฟ ซ ล ท | ดํ รํ มํ ฟํ
export const GONG_NOTES = [
  ['m',-1],['f',-1],['s',-1],['l',-1],['t',-1],
  ['d',0],['r',0],['m',0],['f',0],['s',0],['l',0],['t',0],
  ['d',1],['r',1],['m',1],['f',1],
];

const cache = { buffers: null, loading: null };

export function sampleKey(latin, reg) {
  return `${latin}_${REG_NAME[String(reg)]}`;
}

export async function loadGongSamples(ctx) {
  if (cache.buffers) return cache.buffers;
  if (cache.loading) return cache.loading;
  cache.loading = (async () => {
    const buffers = {};
    await Promise.all(GONG_NOTES.map(async ([latin, reg]) => {
      const key = sampleKey(latin, reg);
      const { data } = supabase.storage.from('instrument-samples')
        .getPublicUrl(`gong/${key}.mp3`);
      try {
        const res = await fetch(data.publicUrl);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        buffers[key] = await ctx.decodeAudioData(buf);
      } catch { /* ไฟล์นี้ยังไม่มี */ }
    }));
    cache.buffers = buffers;
    return buffers;
  })();
  return cache.loading;
}

// เลื่อนชื่อโน้ตไปกี่ขั้น (ตามลำดับ ด ร ม ฟ ซ ล ท) — ข้ามช่วงเสียงให้อัตโนมัติ
const LATIN_CYCLE = ['d','r','m','f','s','l','t'];
export function shiftLatin(latin, register, steps) {
  const i = LATIN_CYCLE.indexOf(latin);
  if (i < 0 || !steps) return [latin, register];
  const abs = i + steps;
  const idx = ((abs % 7) + 7) % 7;
  return [LATIN_CYCLE[idx], register + Math.floor(abs / 7)];
}

// เล่นโน้ต: ใช้ sample จริงถ้ามี → pitch-shift จาก sample ใกล้เคียง → สังเคราะห์
// shift = จำนวนขั้นเสียงที่เลื่อน (ระบบปี่พาทย์เทียบเครื่องสาย)
export function playSampleNote(ctx, buffers, ch, register, time, gain = 0.8, shift = 0) {
  let latin = NOTE_LATIN[ch];
  if (!latin) return false;
  if (shift) [latin, register] = shiftLatin(latin, register, shift);
  const exact = buffers?.[sampleKey(latin, register)];
  if (exact) {
    playBuffer(ctx, exact, time, 1, gain);
    return true;
  }
  // pitch-shift จาก register อื่นของโน้ตเดียวกัน (คูณ/หาร 2 ต่อ octave)
  for (const tryReg of [0, -1, 1]) {
    const b = buffers?.[sampleKey(latin, tryReg)];
    if (b) {
      const rate = Math.pow(2, register - tryReg);
      playBuffer(ctx, b, time, rate, gain);
      return true;
    }
  }
  return false; // ให้ caller ใช้เสียงสังเคราะห์แทน
}

function playBuffer(ctx, buffer, time, rate, gain) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g); g.connect(ctx.destination);
  src.start(time);
}

export function samplesAvailable(buffers) {
  return buffers && Object.keys(buffers).length > 0;
}

export function sampleChecklist(buffers) {
  return GONG_NOTES.map(([latin, reg]) => ({
    key: sampleKey(latin, reg),
    have: !!(buffers && buffers[sampleKey(latin, reg)]),
  }));
}
