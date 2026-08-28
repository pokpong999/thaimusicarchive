// app/api/translate — ตัวแปลเนื้อหาที่สมาชิกเขียน  (Pk 28 ส.ค. 69)
//
//   "ทำยังไงเวลาสมาชิกอัพข้อมูลใหม่แล้วแปลอัตโนมัติเลย"
//
//   อยู่ในโปรเจ็คเว็บเอง ไม่ใช่ Supabase Edge Function
//   → พี่อัปโหลดผ่าน GitHub ได้ตามปกติ ไม่ต้องลง CLI ไม่ต้องตั้งอะไรใน Supabase
//
//   ต้องตั้งค่าที่ Vercel → Settings → Environment Variables
//     SUPABASE_SERVICE_ROLE_KEY   (จำเป็น · Supabase → Settings → API → service_role)
//     ANTHROPIC_API_KEY           (เลือกอย่างใดอย่างหนึ่ง — คุณภาพดีกว่า)
//     GOOGLE_TRANSLATE_API_KEY    (หรือใช้ตัวนี้ — ฟรี 500,000 ตัวอักษร/เดือน)
//     TRANSLATE_MODEL             (ไม่ใส่ก็ได้ · ค่าเริ่มต้น claude-haiku-4-5-20251001)
//     CRON_SECRET                 (ไม่ใส่ก็ได้ · ไว้ให้ตัวตั้งเวลาเรียก)
//
//   ★ ทำไมกุญแจอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น
//     ถ้าเอาไปไว้ในหน้าเว็บ ใครก็เปิดดูได้แล้วเอาไปใช้จนบิลบาน
//     ไฟล์นี้รันบนเซิร์ฟเวอร์ Vercel กุญแจไม่เคยถูกส่งไปถึงเบราว์เซอร์
import { JOBS, SYSTEM_PROMPT, buildBatch, buildUserMessage, parseAnswer, applyAnswer } from '../../../lib/trjobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTH = process.env.ANTHROPIC_API_KEY;
const GOOG = process.env.GOOGLE_TRANSLATE_API_KEY;
const MODEL = process.env.TRANSLATE_MODEL || 'claude-haiku-4-5-20251001';

const MAX_ROWS = 40;     // ต่อการเรียกหนึ่งครั้ง — กันไม่ให้คำสั่งยาวเกินและกันบิลพุ่ง
const TR_VER = '28 ส.ค. 69 · r1';

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

// ── คุยกับ Supabase ด้วย service_role (ข้าม RLS ได้ · จึงต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น) ──
async function rest(path, init = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SVC, authorization: `Bearer ${SVC}`,
      'content-type': 'application/json', ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}

// ผู้เรียกต้องเป็นสมาชิกที่ล็อกอินอยู่ หรือถือ CRON_SECRET
//   ★ ถึงเปิดให้สมาชิกทั่วไปเรียกได้ ก็ไม่บานปลาย เพราะ "งานค้าง" เกิดจากเนื้อหาที่มีคนโพสต์จริงเท่านั้น
//     คิวว่างเมื่อไหร่ เรียกซ้ำอีกกี่ครั้งก็ไม่เสียเงินเพิ่ม
async function whoIs(req) {
  const auth = req.headers.get('authorization') ?? '';
  const tok = auth.replace(/^Bearer\s+/i, '');
  if (!tok) return null;
  if (process.env.CRON_SECRET && tok === process.env.CRON_SECRET) return { cron: true };
  const r = await fetch(`${URL_}/auth/v1/user`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, authorization: `Bearer ${tok}` },
    cache: 'no-store' });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { uid: u.id } : null;
}

// ── ดึงแถวที่ยังไม่ได้แปล ────────────────────────────────────────
async function pending(limit) {
  const out = [];
  for (const [src, job] of Object.entries(JOBS)) {
    if (out.length >= limit) break;
    const cols = [job.key, 'tr_src', 'tr_hash', ...job.fields.map(f => f.th)].join(',');
    // PostgREST เทียบสองคอลัมน์กันเองไม่ได้ → ดึงแถวที่ยังไม่มีลายนิ้วมือ กับที่มีแล้ว มาแยกเองข้างล่าง
    const rows = await rest(
      `${src}?select=${cols}&order=${job.key}.desc&limit=${limit * 3}`);
    for (const row of rows) {
      if (row.tr_hash && row.tr_hash === row.tr_src) continue;      // แปลแล้วและต้นฉบับไม่เปลี่ยน
      const hasThai = job.fields.some(f => typeof row[f.th] === 'string' && /[฀-๿]/.test(row[f.th]));
      if (!hasThai) continue;                                        // ไม่มีอะไรให้แปล
      out.push({ src, row });
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ── เรียก Anthropic ─────────────────────────────────────────────
async function askClaude(items) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTH, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 8000, system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(items) }],
    }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${body.slice(0, 300)}`);
  const d = JSON.parse(body);
  return parseAnswer((d.content ?? []).map(c => c.text ?? '').join(''));
}

// ── เรียก Google Translate (ทางเลือกสำรอง · ไม่รู้จักศัพท์เฉพาะ) ──
async function askGoogle(items) {
  const answer = {};
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GOOG}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q: chunk.map(c => c.text), source: 'th', target: 'en', format: 'text' }),
    });
    const body = await r.text();
    if (!r.ok) throw new Error(`Google ${r.status}: ${body.slice(0, 300)}`);
    const tr = JSON.parse(body)?.data?.translations ?? [];
    chunk.forEach((c, k) => { if (tr[k]?.translatedText) answer[c.id] = tr[k].translatedText; });
  }
  return answer;
}

// ── เขียนคำแปลกลับ ──────────────────────────────────────────────
async function writeBack(patches) {
  let n = 0;
  for (const p of patches) {
    await rest(`${p.src}?${JOBS[p.src].key}=eq.${encodeURIComponent(p.key)}`, {
      method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify(p.patch) });
    if (!p.missing) n++;
  }
  return n;
}

async function runJob(limit) {
  const rows = await pending(limit);
  if (rows.length === 0) return { done: 0, rows: 0, note: 'ไม่มีงานค้าง', ver: TR_VER };
  const items = buildBatch(rows);
  if (items.length === 0) return { done: 0, rows: rows.length, note: 'ไม่มีข้อความไทยให้แปล', ver: TR_VER };
  const answer = ANTH ? await askClaude(items) : await askGoogle(items);
  const patches = applyAnswer(rows, items, answer);
  const done = await writeBack(patches);
  return { done, rows: rows.length, fields: items.length,
    by: ANTH ? 'anthropic' : 'google', model: ANTH ? MODEL : 'google-v2',
    incomplete: patches.filter(p => p.missing).length, ver: TR_VER };
}

export async function POST(req) {
  if (!URL_ || !SVC) return json({ error: 'ยังไม่ได้ตั้ง SUPABASE_SERVICE_ROLE_KEY ที่ Vercel', ver: TR_VER }, 503);
  if (!ANTH && !GOOG) return json({ error: 'ยังไม่ได้ตั้ง ANTHROPIC_API_KEY หรือ GOOGLE_TRANSLATE_API_KEY ที่ Vercel', ver: TR_VER }, 503);

  const me = await whoIs(req);
  if (!me) return json({ error: 'ต้องเข้าสู่ระบบก่อน' }, 401);

  let want = 8;
  try { const b = await req.json(); if (Number.isFinite(b?.limit)) want = b.limit; } catch (e) {}
  const limit = Math.max(1, Math.min(MAX_ROWS, want));

  try { return json(await runJob(limit)); }
  catch (e) { return json({ error: String(e.message ?? e), ver: TR_VER }, 500); }
}

// GET = ดูว่าตั้งค่าครบหรือยัง (ไม่เปิดเผยกุญแจ · ไม่เสียเงิน)
//   ยกเว้นเมื่อมากับ CRON_SECRET — นั่นคือตัวตั้งเวลาของ Vercel (vercel.json) เรียกให้ไล่แปลที่ค้าง
export async function GET(req) {
  const tok = (req?.headers?.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (process.env.CRON_SECRET && tok === process.env.CRON_SECRET) {
    if (!URL_ || !SVC || (!ANTH && !GOOG)) return json({ error: 'ยังตั้งค่าไม่ครบ', ver: TR_VER }, 503);
    try { return json({ cron: true, ...(await runJob(MAX_ROWS)) }); }
    catch (e) { return json({ cron: true, error: String(e.message ?? e), ver: TR_VER }, 500); }
  }
  return json({
    ver: TR_VER,
    supabase: !!URL_ && !!SVC,
    anthropic: !!ANTH, google: !!GOOG,
    model: ANTH ? MODEL : (GOOG ? 'google-v2' : null),
    ready: !!URL_ && !!SVC && (!!ANTH || !!GOOG),
  });
}
