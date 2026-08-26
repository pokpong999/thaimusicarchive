// app/api/import-image/route.js — อ่านโน้ตจากรูปภาพ/หน้า PDF ด้วย Claude (vision) (2026-08-25)
//   POST { images:[{data:<base64>, media_type:'image/jpeg'|'image/png'|'image/webp'}], mode:'auto'|'thai'|'western', hint }
//   → { text, format:'thai'|'western', model, usage }
//   ต้องล็อกอิน (ส่ง Authorization: Bearer <supabase access token>) และเป็น admin/moderator (Pk 2026-08-26) · ต้องตั้ง ANTHROPIC_API_KEY ใน Vercel (Settings → Environment Variables)
//   ตัวเลือก: ANTHROPIC_MODEL (ค่าปริยาย claude-sonnet-5) · IMPORT_MAX_IMAGES (ปริยาย 10)
//   ผลลัพธ์เป็น "ข้อความโน้ต" ตามไวยากรณ์ของกระดาน — ฝั่งเว็บอ่านต่อด้วย lib/notation-import.js แล้วให้คนตรวจก่อนบันทึกเสมอ

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL_DEFAULT = 'claude-sonnet-5';
const MAX_B64 = 6 * 1024 * 1024;          // ต่อรูป (~4.5 MB จริง)

import { systemPrompt, parseModelText } from '../../../lib/import-prompt';

async function verifyUser(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u?.id) return null;
    // สิทธิ์: เฉพาะ admin / moderator (Pk 2026-08-26) — อ่าน role จากโปรไฟล์ตัวเองผ่าน RLS
    const pr = await fetch(`${url}/rest/v1/profiles?id=eq.${u.id}&select=role`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const rows = pr.ok ? await pr.json() : [];
    u.role = rows?.[0]?.role ?? null;
    return u;
  } catch { return null; }
}

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: 'ยังไม่ได้ตั้ง ANTHROPIC_API_KEY บนเซิร์ฟเวอร์ — แอดมินตั้งใน Vercel → Settings → Environment Variables แล้ว Redeploy' }, { status: 501 });
  const user = await verifyUser(req);
  if (!user) return Response.json({ error: 'ต้องเข้าสู่ระบบก่อนใช้การอ่านภาพ' }, { status: 401 });
  if (!['admin', 'moderator'].includes(user.role)) return Response.json({ error: 'การอ่านโน้ตจากภาพเปิดให้เฉพาะแอดมินและผู้ดูแล (moderator) — ไฟล์ PDF/Word/Excel/MusicXML/MIDI ยังนำเข้าได้ตามปกติ' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 400 }); }
  const images = Array.isArray(body?.images) ? body.images : [];
  const maxImg = parseInt(process.env.IMPORT_MAX_IMAGES || '10');
  if (!images.length) return Response.json({ error: 'ไม่มีรูป' }, { status: 400 });
  if (images.length > maxImg) return Response.json({ error: `ส่งได้ครั้งละไม่เกิน ${maxImg} รูป/หน้า` }, { status: 400 });
  for (const im of images) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(im?.media_type || '') || typeof im?.data !== 'string') return Response.json({ error: 'ชนิดรูปไม่รองรับ (jpeg/png/webp)' }, { status: 400 });
    if (im.data.length > MAX_B64) return Response.json({ error: 'รูปใหญ่เกิน 4.5 MB — ย่อก่อนส่ง' }, { status: 413 });
  }
  const mode = ['thai', 'western'].includes(body?.mode) ? body.mode : 'auto';
  const hint = typeof body?.hint === 'string' ? body.hint.slice(0, 300) : '';

  const content = [];
  images.forEach((im, i) => {
    if (images.length > 1) content.push({ type: 'text', text: `[หน้า ${i + 1} จาก ${images.length}]` });
    content.push({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } });
  });
  content.push({ type: 'text', text: `ถอดโน้ตจากภาพ${images.length > 1 ? 'ทุกหน้าเรียงต่อกัน (คั่นหน้าด้วย "% page N")' : ''}${hint ? `\nข้อมูลเพิ่มเติมจากผู้ใช้: ${hint}` : ''}` });

  const model = process.env.ANTHROPIC_MODEL || MODEL_DEFAULT;
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: Math.min(16000, 3000 * images.length), temperature: 0, system: systemPrompt(mode), messages: [{ role: 'user', content }] }),
    });
  } catch (e) {
    return Response.json({ error: 'ติดต่อบริการอ่านภาพไม่ได้: ' + e.message }, { status: 502 });
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return Response.json({ error: 'บริการอ่านภาพตอบผิดพลาด: ' + (data?.error?.message || r.status) }, { status: 502 });
  const raw = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  const parsed = parseModelText(raw);
  return Response.json({ text: parsed.text, format: parsed.format || (mode === 'auto' ? null : mode), notes: parsed.notes, model, usage: data.usage ?? null });
}
