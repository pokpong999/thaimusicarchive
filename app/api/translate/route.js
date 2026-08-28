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

// ★ ตัดช่องว่างและอัญประกาศที่ติดมาตอนคัดลอกวางเสมอ
//   Vercel เก็บค่าตามที่วางเป๊ะ ๆ — ขึ้นบรรทัดใหม่ตัวเดียวที่ติดมากับการกด Copy
//   ก็ทำให้ Supabase ตอบ "Invalid API key" แล้ว และมองด้วยตาไม่มีทางเห็น (Pk 28 ส.ค. 69)
const clean = v => String(v ?? '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');

const URL_ = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
const ANON = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// ★ กุญแจฝั่งเซิร์ฟเวอร์ที่ยอมรับได้ — เรียงตามลำดับที่จะลอง
//   ตัวเชื่อม Supabase↔Vercel ใส่ไว้ให้หลายตัว และชื่อไม่เหมือนกันในแต่ละยุค
//   ยุคเดิม: SUPABASE_SERVICE_ROLE_KEY (JWT) · ยุคใหม่: SUPABASE_SECRET_KEY (sb_secret_…)
//   ถ้าโปรเจ็คย้ายไปใช้กุญแจแบบใหม่แล้ว ตัว JWT เดิมจะถูกปฏิเสธเป็น "Invalid API key"
//   จึงต้องลองให้ครบ ไม่ใช่ยึดตัวเดียวแล้วยอมแพ้ (Pk 28 ส.ค. 69)
const KEY_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_KEY'];
const CANDIDATES = KEY_NAMES
  .map(n => ({ name: n, key: clean(process.env[n]) }))
  .filter(c => c.key);

// ตัวที่ใช้ได้จริง — หาเจอครั้งเดียวแล้วจำไว้
let RESOLVED = null;
const SVC = CANDIDATES[0]?.key ?? '';
const ANTH = clean(process.env.ANTHROPIC_API_KEY);
const GOOG = clean(process.env.GOOGLE_TRANSLATE_API_KEY);
const MODEL = process.env.TRANSLATE_MODEL || 'claude-haiku-4-5-20251001';

const MAX_ROWS = 40;     // ต่อการเรียกหนึ่งครั้ง — กันไม่ให้คำสั่งยาวเกินและกันบิลพุ่ง
const TR_VER = '28 ส.ค. 69 · r3 (ลองกุญแจหลายตัว)';

// ── ตรวจกุญแจโดยไม่เปิดเผยตัวกุญแจ ────────────────────────────────
//   กุญแจแบบเดิมของ Supabase เป็น JWT — ส่วนกลางถอดได้ ไม่ใช่ความลับ
//   ในนั้นบอก "role" กับ "ref" (รหัสโปรเจ็ค) ซึ่งพอจะชี้ได้เลยว่าวางผิดตัวหรือผิดโปรเจ็ค
function keyInfo(k) {
  if (!k) return { set: false };
  const out = { set: true, len: k.length, head: k.slice(0, 6) };
  if (/^sb_secret_/.test(k))      { out.kind = 'secret'; return out; }
  if (/^sb_publishable_/.test(k)) { out.kind = 'publishable'; return out; }
  const p = k.split('.');
  if (p.length !== 3) { out.kind = 'unknown'; return out; }
  out.kind = 'jwt';
  try {
    const b = p[1].replace(/-/g, '+').replace(/_/g, '/');
    const j = JSON.parse(Buffer.from(b + '='.repeat((4 - b.length % 4) % 4), 'base64').toString('utf8'));
    out.role = j.role ?? null;
    out.ref = j.ref ?? null;
    if (j.exp) out.expired = j.exp * 1000 < Date.now();
  } catch (e) { out.kind = 'jwt-unreadable'; }
  return out;
}

const refOfUrl = u => (String(u).match(/^https?:\/\/([a-z0-9-]+)\./) ?? [])[1] ?? null;

// ลองกุญแจหนึ่งตัวกับฐานจริง — ไม่อ่านข้อมูลอะไรเลย
async function tryKey(key) {
  try {
    const r = await fetch(`${URL_}/rest/v1/songs?select=id&limit=1`, {
      headers: { apikey: key, authorization: `Bearer ${key}` }, cache: 'no-store' });
    if (r.ok) return { ok: true, status: r.status };
    return { ok: false, status: r.status, why: (await r.text()).slice(0, 200) };
  } catch (e) { return { ok: false, why: String(e.message ?? e) }; }
}

// ไล่ลองกุญแจที่มีจนกว่าจะเจอตัวที่ฐานรับ แล้วจำไว้ใช้ต่อ
async function resolveKey() {
  if (RESOLVED) return RESOLVED;
  if (!URL_ || CANDIDATES.length === 0) return null;
  const tried = [];
  for (const c of CANDIDATES) {
    const r = await tryKey(c.key);
    tried.push({ name: c.name, ok: r.ok, status: r.status ?? null });
    if (r.ok) { RESOLVED = { ...c, tried }; return RESOLVED; }
  }
  return { name: null, key: null, tried };
}

async function pingDb() {
  if (!URL_) return { ok: false, why: 'missing-url', tried: [] };
  if (CANDIDATES.length === 0) return { ok: false, why: 'missing-key', tried: [] };
  const r = await resolveKey();
  if (r?.key) return { ok: true, status: 200, used: r.name, tried: r.tried };
  const last = r?.tried?.[r.tried.length - 1];
  return { ok: false, status: last?.status ?? null, why: 'all-rejected', tried: r?.tried ?? [] };
}

// แปลผลให้เป็นภาษาคน พร้อมบอกว่าต้องไปแก้ตรงไหน
function diagnose(ping, ki, urlRef) {
  if (ping.ok) return null;
  if (!URL_) return 'ยังไม่ได้ตั้ง NEXT_PUBLIC_SUPABASE_URL';
  if (CANDIDATES.length === 0)
    return 'ยังไม่มีกุญแจฝั่งเซิร์ฟเวอร์เลย — ต้องมีตัวใดตัวหนึ่งใน ' + KEY_NAMES.join(' / ');
  // ★ มีหลายตัวแต่ฐานปฏิเสธหมด — บอกให้เห็นว่าลองอะไรไปแล้วบ้าง
  const badRef = CANDIDATES.map(c => keyInfo(c.key)).find(k => k.ref && urlRef && k.ref !== urlRef);
  if (badRef && ping.tried?.every(t => !t.ok))
    return `กุญแจที่วางไว้เป็นของคนละโปรเจ็ค — กุญแจเป็นของ ${badRef.ref} แต่เว็บชี้ไปที่ ${urlRef} `
         + '· ถ้าเชื่อมตัวเชื่อม Supabase↔Vercel ไว้ ให้ตรวจว่าเชื่อมกับโปรเจ็ค Supabase ตัวที่เว็บใช้อยู่จริง';
  if (!ki.set) return 'ยังไม่ได้วาง SUPABASE_SERVICE_ROLE_KEY ที่ Vercel → Environment Variables';
  if (ki.kind === 'publishable' || ki.role === 'anon')
    return 'วางผิดตัว — นี่คือกุญแจสาธารณะ (anon/publishable) ต้องใช้ service_role ที่กด Reveal ถึงจะเห็น';
  if (ki.expired) return 'กุญแจหมดอายุแล้ว — สร้างใหม่ที่ Supabase → Settings → API';
  if (ki.ref && urlRef && ki.ref !== urlRef)
    return `กุญแจเป็นของคนละโปรเจ็ค — กุญแจเป็นของ ${ki.ref} แต่เว็บชี้ไปที่ ${urlRef}`;
  if (ki.kind === 'unknown' || ki.kind === 'jwt-unreadable')
    return `ค่าที่วางไม่เหมือนกุญแจ Supabase (ยาว ${ki.len} ตัว ขึ้นต้นด้วย "${ki.head}") — คัดลอกไม่ครบหรือติดอะไรมาด้วยหรือเปล่า`;
  if (ping.status === 401)
    return 'ฐานปฏิเสธกุญแจนี้ — คัดลอก service_role ใหม่ทั้งก้อนจาก Supabase → Settings → API '
         + 'แล้ววางทับที่ Vercel · ถ้าโปรเจ็คปิดกุญแจแบบเดิมไปแล้ว ให้ใช้ตัวที่ขึ้นต้นด้วย sb_secret_ แทน '
         + '· วางเสร็จต้องกด Redeploy ทุกครั้ง';
  return `ฐานตอบ ${ping.status ?? '-'}: ${ping.why ?? ''}`;
}

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

// ── คุยกับ Supabase ด้วย service_role (ข้าม RLS ได้ · จึงต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น) ──
async function rest(path, init = {}) {
  const rk = await resolveKey();
  const key = rk?.key || SVC;
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`,
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
  catch (e) {
    const m = String(e.message ?? e);
    // ฐานปฏิเสธกุญแจ → บอกทางแก้ไปเลย ไม่ใช่โยน error ดิบ ๆ ให้คนอ่านเอง
    if (/Supabase 40[13]|Invalid API key/i.test(m)) {
      const d = diagnose({ ok: false, status: 401, why: m }, keyInfo(SVC), refOfUrl(URL_));
      return json({ error: (d ?? m) + ' · (ฐานตอบ: ' + m.slice(0, 120) + ')', ver: TR_VER }, 500);
    }
    return json({ error: m, ver: TR_VER }, 500);
  }
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
  // ★ เดิมบอกว่า "ต่อฐานข้อมูลได้" ทั้งที่ตรวจแค่ว่ามีตัวแปรอยู่ — ไม่เคยลองต่อจริง
  //   Pk จึงเห็นเครื่องหมายถูกสีเขียว แล้วกดแปลไม่ได้ ไม่รู้ว่าผิดตรงไหน (Pk 28 ส.ค. 69)
  const ki = keyInfo(SVC);
  const urlRef = refOfUrl(URL_);
  const ping = await pingDb();
  // รูปพรรณของกุญแจทุกตัวที่มี — ไม่มีตัวกุญแจจริงอยู่ในนี้
  const keys = CANDIDATES.map(c => {
    const k = keyInfo(c.key);
    const t = ping.tried?.find(x => x.name === c.name);
    return { name: c.name, kind: k.kind ?? null, role: k.role ?? null, ref: k.ref ?? null,
             len: k.len ?? 0, head: k.head ?? null, expired: k.expired ?? null,
             ok: t ? t.ok : null, status: t?.status ?? null };
  });
  return json({
    ver: TR_VER,
    supabase: ping.ok,                       // ต่อได้จริงเท่านั้นถึงเป็น true
    anthropic: !!ANTH, google: !!GOOG,
    model: ANTH ? MODEL : (GOOG ? 'google-v2' : null),
    ready: ping.ok && (!!ANTH || !!GOOG),
    // ข้อมูลวินิจฉัย — ไม่มีตัวกุญแจอยู่ในนี้เลย มีแต่รูปพรรณ
    diag: {
      url_ref: urlRef,
      key_kind: ki.kind ?? null, key_role: ki.role ?? null, key_ref: ki.ref ?? null,
      key_len: ki.len ?? 0, key_head: ki.head ?? null, key_expired: ki.expired ?? null,
      anon_role: keyInfo(ANON).role ?? null,
      db_status: ping.status ?? null,
      used_key: ping.used ?? null,
      keys,
      problem: diagnose(ping, ki, urlRef),
    },
  });
}
