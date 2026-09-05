// app/api/krasuan/route.js
// คลังกระสวนส่วนตัว — ประตูเดียวที่ข้อมูลออกจากเซิร์ฟเวอร์ได้
// KRASUAN_API_VER ใช้ตรวจว่าไฟล์นี้ถูกอัปขึ้นจริงหรือยัง
const KRASUAN_API_VER = 'kr1';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'krasuan-private';

// แคชในหน่วยความจำของ lambda — ลดการดึงซ้ำ ไม่ข้ามผู้ใช้เพราะเป็นข้อมูลชุดเดียว
const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

function bad(status, msg) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// ---------- ตรวจว่าใครเรียก ----------
// คืน uid เมื่อเป็นแอดมินจริงเท่านั้น นอกนั้นคืน null
async function verifyAdmin(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;

  const u = await fetch(URL_BASE + '/auth/v1/user', {
    headers: { apikey: SERVICE, authorization: 'Bearer ' + token },
    cache: 'no-store',
  });
  if (!u.ok) return null;
  const user = await u.json();
  if (!user || !user.id) return null;

  const pr = await fetch(
    URL_BASE + '/rest/v1/profiles?id=eq.' + user.id + '&select=role',
    { headers: { apikey: SERVICE, authorization: 'Bearer ' + SERVICE }, cache: 'no-store' }
  );
  if (!pr.ok) return null;
  const rows = await pr.json();
  if (!Array.isArray(rows) || !rows[0] || rows[0].role !== 'admin') return null;
  return user.id;
}

// ---------- ดึงไฟล์จากถังปิด ----------
async function readFile(name) {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const r = await fetch(
    URL_BASE + '/storage/v1/object/' + BUCKET + '/' + name,
    { headers: { apikey: SERVICE, authorization: 'Bearer ' + SERVICE }, cache: 'no-store' }
  );
  if (!r.ok) throw new Error('อ่านไฟล์ ' + name + ' ไม่ได้ (' + r.status + ')');
  const data = await r.json();
  cache.set(name, { at: Date.now(), data });
  return data;
}

// ---------- บันทึกการเข้าดู ----------
async function logAccess(req, uid, action, code) {
  try {
    await fetch(URL_BASE + '/rest/v1/krasuan_access_log', {
      method: 'POST',
      headers: {
        apikey: SERVICE,
        authorization: 'Bearer ' + SERVICE,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify({
        uid,
        action,
        code: code || null,
        ip: req.headers.get('x-forwarded-for') || null,
        ua: (req.headers.get('user-agent') || '').slice(0, 200),
      }),
    });
  } catch (e) {
    // บันทึกไม่ได้ก็ไม่ต้องทำให้คำขอล้ม
  }
}

export async function GET(req) {
  if (!URL_BASE || !SERVICE) {
    return bad(501, 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY ที่ Vercel');
  }

  const uid = await verifyAdmin(req);
  if (!uid) return bad(403, 'หน้านี้เปิดเฉพาะเจ้าของคลัง');

  const sp = new URL(req.url).searchParams;
  const code = sp.get('code');

  try {
    // --- ขอสารบัญ ---
    if (!code) {
      const idx = await readFile('index.json');
      await logAccess(req, uid, 'index', null);
      return new Response(JSON.stringify(idx), {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    // --- ขอกระสวนหนึ่งแบบ ---
    // ตรวจรูปแบบเข้ม ๆ กันการเดาชื่อไฟล์อื่นในถัง
    if (!/^[OABCDEFGHIJKLMNP]{4}$/.test(code)) return bad(400, 'รหัสกระสวนไม่ถูกต้อง');

    const D = { O: 0, A: 1, B: 1, C: 1, D: 1, E: 2, F: 2, G: 2, H: 2, I: 2, J: 2,
                K: 3, L: 3, M: 3, N: 3, P: 4 };
    let dens = 0;
    for (const ch of code) dens += D[ch];

    const chap = await readFile('d' + dens + '.json');
    const one = chap[code];
    if (!one) return bad(404, 'ไม่พบกระสวนนี้ในคลัง');

    await logAccess(req, uid, 'pattern', code);
    return new Response(JSON.stringify(one), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (e) {
    return bad(500, String(e.message || e));
  }
}
