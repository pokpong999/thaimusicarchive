// lib/samplebank.js — คลังเสียงเครื่องดนตรีจริง (ใช้ได้กับทุกเครื่อง ไม่ใช่แค่กลอง)
//
// แนวคิด: "โฟลเดอร์คือเครื่องดนตรี · ชื่อไฟล์คือเสียง"
//   instrument-samples/taphon/theng.mp3   → ตะโพน เสียง "เท่ง"
//   instrument-samples/klongkhaek/ting.mp3 → กลองแขก เสียง "ติง"
// เพิ่มเครื่องใหม่ = สร้างโฟลเดอร์แล้วอัปไฟล์ ไม่ต้องแก้โค้ด ไม่ต้องแก้ฐานข้อมูล
// ระบบอ่านรายชื่อไฟล์ในโฟลเดอร์เอง แล้วจับคู่กับพยางค์ที่เรียกใช้
//
// ถ้ายังไม่มีไฟล์เสียง → ระบบใช้เสียงสังเคราะห์เดิมโดยอัตโนมัติ ไม่มีอะไรพัง
import { supabase } from './supabase';

const BUCKET = 'instrument-samples';
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;

// ชื่อเครื่องดนตรีไทย → ชื่อโฟลเดอร์ (ต้องเป็นอักษรอังกฤษ ระบบไฟล์ถึงจะไม่มีปัญหา)
export const INSTRUMENT_SLUG = {
  'ตะโพน': 'taphon',
  'กลองแขก': 'klongkhaek',
  'กลองสองหน้า': 'klongsongna',
  'โทนรำมะนา': 'thonrammana',
  'ฉิ่ง': 'ching',
  'กลองทัด': 'klongthat',
  'ฆ้องวงใหญ่': 'gong',
  // ชุด 2 บรรทัด (2026-08-25): แยกโฟลเดอร์ต่อใบได้ ถ้ายังไม่มีโฟลเดอร์ ระบบตกไปใช้โฟลเดอร์รวมของชุด (klongkhaek / thonrammana)
  'กลองแขกตัวผู้': 'klongkhaek_m',
  'กลองแขกตัวเมีย': 'klongkhaek_f',
  'โทน': 'thon',
  'รำมะนา': 'rammana',
};

// พยางค์กลอง → ชื่อไฟล์ (ตามชุดเสียงที่ Pk อัดไว้ 2026-08-25)
export const TOKEN_SLUG = {
  'ติง': 'ting', 'ตุ๊บ': 'tup', 'เท่ง': 'theng', 'ถะ': 'tha',
  'ป๊ะ': 'pa', 'พลึง': 'phlueng', 'เพลิ่ง': 'phloeng',
  'โจ๊ะ': 'jo', 'จ๊ะ': 'ja', 'ทั่ง': 'thang',
  'ตูม': 'tum', 'ต้อม': 'tom',
  'ฉิ่ง': 'ching', 'ฉับ': 'chap', 'ฉะ': 'cha',
  // สะกดที่พบในตาราง nathab_patterns เดิม — ชี้ไปไฟล์เดียวกัน
  'ทิง': 'ting', 'ทั่ม': 'thang', 'พรึม': 'phlueng',
};

// รายการเสียงที่ "ควรมี" ของแต่ละเครื่อง — ใช้แสดงเช็กลิสต์ในหน้าผู้ดูแล
// (ระบบไม่ได้บังคับ อัปเกินหรือขาดก็ทำงานได้ ขาดตัวไหนใช้เสียงสังเคราะห์แทนตัวนั้น)
export const RECOMMENDED = {
  taphon:       ['ting', 'tup', 'theng', 'tha', 'pa', 'phlueng', 'phloeng'],
  klongsongna:  ['ting', 'tup', 'theng', 'tha', 'pa', 'phlueng', 'phloeng'],
  klongkhaek:   ['jo', 'ja', 'ting', 'thang'],
  thonrammana:  ['jo', 'ja', 'ting', 'thang'],
  klongthat:    ['tum', 'tom'],
  ching:        ['ching', 'chap'],
  klongkhaek_m: ['jo', 'ja', 'ting', 'thang'],
  klongkhaek_f: ['jo', 'ja', 'ting', 'thang'],
  thon:         ['jo', 'ja', 'ting', 'thang'],
  rammana:      ['jo', 'ja', 'ting', 'thang'],
};

const banks = {};      // slug → { token: { buf, onset } }
const loading = {};    // slug → Promise

// จุดเริ่มเสียงจริงในไฟล์ (ตัดความเงียบต้นไฟล์ ไม่งั้นกลองจะตกจังหวะ)
// ใช้กติกาเดียวกับ lib/sampler.js ของฆ้อง
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

export function bankOf(instrument) {
  return banks[INSTRUMENT_SLUG[instrument] ?? instrument] ?? null;
}

// โหลดเสียงทั้งโฟลเดอร์ของเครื่องหนึ่ง · เรียกซ้ำได้ โหลดจริงครั้งเดียว
export async function loadBank(ctx, instrument) {
  const slug = INSTRUMENT_SLUG[instrument] ?? instrument;
  if (!slug) return null;
  if (banks[slug]) return banks[slug];
  if (loading[slug]) return loading[slug];

  loading[slug] = (async () => {
    const bank = {};
    try {
      const { data: files } = await supabase.storage.from(BUCKET).list(slug, { limit: 200 });
      const audio = (files ?? []).filter(f => AUDIO_EXT.test(f.name));
      await Promise.all(audio.map(async f => {
        const token = f.name.replace(AUDIO_EXT, '').toLowerCase();
        try {
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${slug}/${f.name}`);
          const res = await fetch(data.publicUrl);
          if (!res.ok) return;
          const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
          bank[token] = { buf: decoded, onset: detectOnset(decoded) };
        } catch { /* ไฟล์นี้ใช้ไม่ได้ ข้ามไป ใช้เสียงสังเคราะห์แทน */ }
      }));
    } catch { /* อ่านโฟลเดอร์ไม่ได้ = ยังไม่มีเสียงจริง */ }
    banks[slug] = bank;
    return bank;
  })();
  return loading[slug];
}

// เล่นเสียงจากคลัง · คืน true ถ้าเล่นได้ (ผู้เรียกจะได้รู้ว่าต้องสังเคราะห์แทนหรือไม่)
export function playFromBank(ctx, instrument, token, time, gain = 1) {
  const slug = INSTRUMENT_SLUG[instrument] ?? instrument;
  const key = (TOKEN_SLUG[token] ?? token ?? '').toLowerCase();
  const item = banks[slug]?.[key];
  if (!item) return false;
  try {
    const src = ctx.createBufferSource();
    src.buffer = item.buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g); g.connect(ctx.destination);
    src.start(time, item.onset);      // ข้ามความเงียบต้นไฟล์ เสียงจึงลงตรงจังหวะ
    return true;
  } catch { return false; }
}

// สรุปสถานะไว้แสดงในหน้าผู้ดูแล
export function bankStatus(instrument) {
  const slug = INSTRUMENT_SLUG[instrument] ?? instrument;
  const bank = banks[slug];
  const want = RECOMMENDED[slug] ?? [];
  const have = bank ? Object.keys(bank) : [];
  return { slug, loaded: !!bank, have, missing: want.filter(t => !have.includes(t)) };
}
