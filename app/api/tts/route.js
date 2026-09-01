// app/api/tts/route.js — เสียงพูดนำหน้าไฟล์เพลง (Pk 1 ก.ย. 69)
//
//   "เพลง <ชื่อเพลง> ฐานข้อมูลเพลงไทย หอจดหมายเหตุดนตรีไทย
//    โดย อาจารย์ ดร.ปกป้อง ขำประเสริฐ"
//
//   ★ ทำครั้งเดียวต่อเพลง แล้วเก็บไฟล์ไว้ใน Supabase Storage
//     เพลงเดิมกดกี่ครั้งก็ดึงไฟล์เดิม ไม่เรียก Google ซ้ำ ไม่เสียเงินซ้ำ
//
//   ค่าใช้จ่าย: Google Cloud TTS เสียง Standard/WaveNet ฟรี 4 ล้านตัวอักษร/เดือน
//   ประโยคนี้ยาวราว 100 ตัวอักษร · 300 เพลง = 30,000 ตัวอักษร ครั้งเดียวตลอดกาล
//   = 0.75% ของโควตาฟรีเดือนเดียว  →  ไม่มีค่าใช้จ่ายจริง
//
//   ตัวแปรที่ต้องตั้งที่ Vercel:
//     GOOGLE_TTS_API_KEY  (หรือใช้ GOOGLE_TRANSLATE_API_KEY ตัวเดิมก็ได้
//                          ถ้าเปิด Cloud Text-to-Speech API ในโครงการเดียวกัน)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VER = '1 ก.ย. 69 · r1';
const clean = v => String(v ?? '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
const URL_ = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const ANON = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const SVC  = clean(process.env.THMA_SUPABASE_KEY) || clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const KEY  = clean(process.env.GOOGLE_TTS_API_KEY) || clean(process.env.GOOGLE_TRANSLATE_API_KEY);

const BUCKET = 'song-intro';
const isJwt = k => String(k).split('.').length === 3;
const authHeaders = k => (isJwt(k) ? { apikey: k, authorization: `Bearer ${k}` } : { apikey: k });
const json = (b, s = 200) => new Response(JSON.stringify(b),
  { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

// ── ข้อความที่จะให้อ่าน ─────────────────────────────────────────
const TAIL = 'ฐานข้อมูลเพลงไทย หอจดหมายเหตุดนตรีไทย โดย อาจารย์ ดอกเตอร์ปกป้อง ขำประเสริฐ';
export function introText(songName) {
  const n = String(songName ?? '').trim();
  return n ? `เพลง ${n} ${TAIL}` : TAIL;
}

// ชื่อไฟล์ในคลัง — ผูกกับข้อความ ถ้าชื่อเพลงเปลี่ยน ไฟล์ใหม่ถูกสร้างเอง
export function introKey(songName) {
  const t = introText(songName);
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  const slug = String(songName ?? 'เพลง').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${slug || 'song'}-${h.toString(36)}.mp3`;
}

// ── ต้องเป็นแอดมิน (Pk ตัดสิน: เปิดให้แอดมินก่อน) ───────────────
async function isAdmin(req) {
  const tok = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!tok || !URL_) return false;
  const u = await fetch(`${URL_}/auth/v1/user`,
    { headers: { apikey: ANON, authorization: `Bearer ${tok}` }, cache: 'no-store' });
  if (!u.ok) return false;
  const me = await u.json();
  if (!me?.id) return false;
  const r = await fetch(`${URL_}/rest/v1/profiles?id=eq.${me.id}&select=role`,
    { headers: authHeaders(SVC), cache: 'no-store' });
  if (!r.ok) return false;
  const rows = await r.json();
  return ['admin', 'moderator'].includes(rows?.[0]?.role);
}

// ── คลังไฟล์ ────────────────────────────────────────────────────
async function cached(name) {
  const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`,
    { headers: authHeaders(SVC), cache: 'no-store' });
  return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
}
async function store(name, bytes) {
  await fetch(`${URL_}/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { ...authHeaders(SVC), 'content-type': 'audio/mpeg', 'x-upsert': 'true' },
    body: bytes,
  }).catch(() => {});
}

// ── เลือกเสียงไทยที่ดีที่สุดที่มีอยู่จริง (ไม่เดาชื่อเสียงตายตัว) ──
let voiceCache = null;
export function pickThaiVoice(voices) {
  const th = (voices ?? []).filter(v => (v.languageCodes ?? []).some(c => String(c).startsWith('th')));
  if (!th.length) return null;
  const rank = v => {
    const n = String(v.name ?? '');
    if (/Chirp/i.test(n)) return 4;
    if (/Neural2/i.test(n)) return 3;
    if (/Wavenet/i.test(n)) return 2;
    return 1;
  };
  const fem = v => (v.ssmlGender === 'FEMALE' ? 0 : 1);
  const sorted = [...th].sort((a, b) => rank(b) - rank(a) || fem(a) - fem(b)
    || String(a.name).localeCompare(String(b.name)));
  return sorted[0]?.name ?? null;
}
async function thaiVoice() {
  if (voiceCache) return voiceCache;
  try {
    const r = await fetch(`https://texttospeech.googleapis.com/v1/voices?languageCode=th-TH&key=${KEY}`,
      { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      voiceCache = pickThaiVoice(d?.voices) || 'th-TH-Standard-A';
      return voiceCache;
    }
  } catch (e) {}
  return (voiceCache = 'th-TH-Standard-A');
}

async function speak(text) {
  const voice = await thaiVoice();
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'th-TH', name: voice },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.96, pitch: 0 },
    }),
  });
  const body = await r.text();
  if (!r.ok) {
    let msg = body.slice(0, 200);
    try { msg = JSON.parse(body)?.error?.message ?? msg; } catch (e) {}
    if (/has not been used|is disabled|SERVICE_DISABLED/i.test(msg))
      throw new Error('ยังไม่ได้เปิด Cloud Text-to-Speech API ในโครงการ Google — เปิดที่ console.cloud.google.com แล้วลองใหม่');
    if (/API key not valid|API_KEY|PERMISSION_DENIED/i.test(msg))
      throw new Error('กุญแจ Google ใช้ไม่ได้กับบริการเสียง — ตรวจ GOOGLE_TTS_API_KEY ที่ Vercel');
    throw new Error('Google ตอบ ' + r.status + ': ' + msg);
  }
  const b64 = JSON.parse(body)?.audioContent;
  if (!b64) throw new Error('Google ไม่ได้ส่งเสียงกลับมา');
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

export async function POST(req) {
  if (!URL_ || !SVC) return json({ error: 'ยังไม่ได้ตั้งค่าฐานข้อมูลที่ Vercel', ver: VER }, 503);
  if (!KEY) return json({ error: 'ยังไม่ได้ตั้ง GOOGLE_TTS_API_KEY ที่ Vercel — ดูวิธีในไฟล์ อ่านก่อน.txt', ver: VER }, 503);
  if (!(await isAdmin(req))) return json({ error: 'เฉพาะผู้ดูแลเท่านั้น' }, 403);

  let songName = '';
  try { songName = String((await req.json())?.songName ?? '').slice(0, 120); } catch (e) {}

  const name = introKey(songName);
  const audio = (mp3, from) => new Response(mp3, { status: 200, headers: {
    'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=86400', 'x-thma-intro': from } });

  try {
    const hit = await cached(name);
    if (hit && hit.length > 500) return audio(hit, 'cache');
  } catch (e) {}

  try {
    const mp3 = await speak(introText(songName));
    store(name, mp3);                       // เก็บไว้ใช้ครั้งหน้า (ไม่ต้องรอ)
    return audio(mp3, 'google');
  } catch (e) {
    return json({ error: String(e.message ?? e), ver: VER }, 502);
  }
}

// GET = ดูว่าตั้งค่าครบหรือยัง (ไม่เปิดเผยกุญแจ ไม่เสียเงิน)
export async function GET(req) {
  if (!(await isAdmin(req))) return json({ error: 'เฉพาะผู้ดูแลเท่านั้น' }, 403);
  return json({ ver: VER, hasKey: !!KEY, hasDb: !!URL_ && !!SVC, bucket: BUCKET,
    example: introText('กราวนอก'), file: introKey('กราวนอก') });
}
