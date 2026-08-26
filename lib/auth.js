// lib/auth.js — ตรรกะกลางของระบบสมาชิก (สมัคร / ยืนยันอีเมล / ตั้งรหัสผ่านใหม่)
//   Pk 2026-08-26: หน้าสมัครไม่มีการยืนยันรหัสผ่าน และลิงก์ในอีเมลไม่มีหน้ารับ
//   ไฟล์นี้ไม่แตะ DOM และไม่เรียก supabase — ทดสอบด้วย Node ได้ตรง ๆ (test/unit-auth.mjs)

/* ───────── ปลายทางที่ให้ลิงก์ในอีเมลเด้งกลับมา ─────────
   ใช้ origin ของหน้าที่กำลังเปิดอยู่ → ทำงานถูกทั้ง localhost, preview ของ Vercel และโดเมนจริง
   **ต้องเอา URL เหล่านี้ไปใส่ Supabase → Authentication → URL Configuration → Redirect URLs ด้วย**
     https://thaimusicarchive.com/auth/callback
     https://<preview>.vercel.app/auth/callback   (ถ้าใช้ preview)
     http://localhost:3000/auth/callback          (ถ้าพัฒนาในเครื่อง)                        */
export const CALLBACK_PATH = '/auth/callback';
export function siteOrigin(loc) {
  const l = loc || (typeof window !== 'undefined' ? window.location : null);
  return l ? l.origin : 'https://thaimusicarchive.com';
}
export function callbackUrl(next = null, loc = null) {
  const base = siteOrigin(loc) + CALLBACK_PATH;
  return next ? base + '?next=' + encodeURIComponent(next) : base;
}

/* ───────── อ่านผลลัพธ์ที่ Supabase ส่งกลับมาใน URL ─────────
   Supabase ส่งกลับได้ 4 แบบ แล้วแต่รุ่นของลิงก์/flow ที่ใช้ — รับให้ครบทั้งหมด
     1) #access_token=…&refresh_token=…&type=signup     (implicit — ค่าปริยายของ supabase-js v2)
     2) ?code=…                                          (PKCE)
     3) ?token_hash=…&type=recovery                      (ลิงก์รุ่นใหม่ ยังไม่มี session ต้อง verifyOtp เอง)
     4) ?error=…&error_description=… หรือใน hash          (ลิงก์หมดอายุ / ถูกใช้ไปแล้ว)
   คืน { kind, type, token_hash, code, error, next }
     kind: 'session' | 'code' | 'token' | 'error' | 'none'                                    */
export function parseAuthParams(href) {
  const s = String(href || '');
  const qi = s.indexOf('?'), hi = s.indexOf('#');
  const qs = qi >= 0 ? s.slice(qi + 1, hi > qi ? hi : undefined) : '';
  const hs = hi >= 0 ? s.slice(hi + 1) : '';
  const q = new URLSearchParams(qs), h = new URLSearchParams(hs);
  const get = k => h.get(k) ?? q.get(k);
  const out = {
    kind: 'none',
    type: get('type') || null,
    token_hash: get('token_hash') || get('token') || null,
    code: q.get('code') || null,
    error: get('error_description') || get('error') || null,
    next: q.get('next') || null,
  };
  if (out.error) out.kind = 'error';
  else if (h.get('access_token')) out.kind = 'session';
  else if (out.code) out.kind = 'code';
  else if (out.token_hash) out.kind = 'token';
  return out;
}

/* ───────── ตรวจรหัสผ่านตอนสมัคร ─────────
   Pk เคาะ 2026-08-26: เอาแค่ยืนยันสองรอบ ไม่บังคับตัวอักษร/ตัวเลข (กันคนสูงอายุถอดใจ)
   ขั้นต่ำ 6 ตัวตามค่าของ Supabase — ถ้าไปตั้งใน Dashboard สูงกว่านี้ ให้แก้ MIN_PASSWORD ตาม   */
export const MIN_PASSWORD = 6;
export function passwordProblem(pw, pw2) {
  const a = String(pw ?? ''), b = String(pw2 ?? '');
  if (!a) return 'กรอกรหัสผ่าน';
  if (a.length < MIN_PASSWORD) return `รหัสผ่านต้องอย่างน้อย ${MIN_PASSWORD} ตัวอักษร (ตอนนี้ ${a.length} ตัว)`;
  if (!b) return 'กรอกรหัสผ่านอีกครั้งในช่องยืนยัน';
  if (a !== b) return 'รหัสผ่านสองช่องไม่ตรงกัน — พิมพ์ใหม่ให้เหมือนกันทั้งสองช่อง';
  return null;
}
// ความแข็งแรงไว้โชว์เป็นแถบ (ไม่ได้บังคับ) — 0 อ่อนมาก … 4 แข็งแรงมาก
export function passwordStrength(pw) {
  const s = String(pw ?? '');
  if (!s) return { score: 0, label: '' };
  let n = 0;
  if (s.length >= 6) n++;
  if (s.length >= 10) n++;
  if (/[a-zA-Z฀-๿]/.test(s) && /\d/.test(s)) n++;
  if (/[^a-zA-Z0-9฀-๿]/.test(s)) n++;
  return { score: n, label: ['อ่อนมาก', 'พอใช้', 'ดี', 'แข็งแรง', 'แข็งแรงมาก'][n] };
}

/* ───────── แปลข้อความผิดพลาดของ Supabase เป็นภาษาไทยที่บอกทางแก้ ───────── */
export function thaiAuthError(raw) {
  const m = String(raw || '');
  if (/Invalid login credentials/i.test(m))
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง — ถ้ายังไม่เคยสมัคร ให้กดปุ่ม "สมัครสมาชิกใหม่" ด้านบนก่อน';
  if (/Email not confirmed/i.test(m))
    return 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล — กดปุ่ม "ส่งอีเมลยืนยันใหม่" ด้านล่าง แล้วเปิดลิงก์ในอีเมล';
  if (/User already registered|already been registered/i.test(m))
    return 'อีเมลนี้มีบัญชีอยู่แล้ว — กดแท็บ "เข้าสู่ระบบ" ด้านบน';
  if (/Database error saving new user|Database error/i.test(m))
    return 'ฐานข้อมูลปฏิเสธการสร้างบัญชี — แจ้งผู้ดูแลพร้อมข้อความนี้ (รหัส: profiles trigger)';
  if (/Signups not allowed/i.test(m))
    return 'ขณะนี้ระบบปิดรับสมัครสมาชิก — แจ้งผู้ดูแล';
  if (/Password should be at least/i.test(m))
    return `รหัสผ่านสั้นเกินไป — ต้องอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`;
  if (/New password should be different/i.test(m))
    return 'รหัสผ่านใหม่ซ้ำกับรหัสเดิม — ตั้งรหัสที่ไม่เคยใช้';
  if (/same_password/i.test(m))
    return 'รหัสผ่านใหม่ซ้ำกับรหัสเดิม — ตั้งรหัสที่ไม่เคยใช้';
  if (/For security purposes|rate limit|too many requests|over_email_send_rate_limit/i.test(m))
    return 'ระบบส่งอีเมลถี่เกินไป — รอสัก 1 นาทีแล้วลองใหม่ (โควตาอีเมลของระบบจำกัดต่อชั่วโมง)';
  if (/Unable to validate email address|invalid format/i.test(m))
    return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (/expired|otp_expired/i.test(m))
    return 'ลิงก์ยืนยันหมดอายุหรือถูกใช้ไปแล้ว — กดขอลิงก์ใหม่ด้านล่าง';
  if (/Token has expired or is invalid|invalid_token|not found/i.test(m))
    return 'ลิงก์ไม่ถูกต้องหรือถูกใช้ไปแล้ว — กดขอลิงก์ใหม่ด้านล่าง';
  if (/redirect|not allowed for this/i.test(m))
    return 'ปลายทางของลิงก์ไม่ได้รับอนุญาต — ผู้ดูแลต้องใส่ URL นี้ใน Supabase → Authentication → Redirect URLs';
  if (/Auth session missing|session_not_found/i.test(m))
    return 'ลิงก์นี้ใช้ไม่ได้แล้ว (อาจเปิดคนละเบราว์เซอร์กับตอนขอ) — ขอลิงก์ใหม่แล้วเปิดในเบราว์เซอร์เดียวกัน';
  if (/fetch|network|Failed to fetch/i.test(m))
    return 'ต่ออินเทอร์เน็ตไม่ได้ — ลองใหม่อีกครั้ง';
  return m;
}

/* ───────── ข้อความหัวเรื่องของหน้ารับลิงก์ ตามชนิดของลิงก์ ───────── */
export function callbackTitle(type) {
  if (type === 'recovery') return 'ตั้งรหัสผ่านใหม่';
  if (type === 'email_change') return 'ยืนยันอีเมลใหม่';
  if (type === 'invite') return 'รับคำเชิญเข้าร่วม';
  return 'ยืนยันอีเมล';
}
