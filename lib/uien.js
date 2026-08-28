'use client';
// lib/uien.js — ชั้นแปลหน้าเว็บเป็นอังกฤษทั้งเว็บ  (Pk 28 ส.ค. 69)
//
//   "แสดงผลภาษาอังกฤษให้ครบ แปลทุกส่วนเป็นอังกฤษด้วย"
//
//   ทำไมทำแบบนี้ ไม่ไล่แก้ทีละหน้า
//   ─ เว็บมี 50 กว่าหน้า ถ้าไล่ใส่ t('…') ทีละหน้า Pk ต้องอัพไฟล์ 50 ไฟล์ผ่าน GitHub
//     พลาดไฟล์เดียว = build ล่ม แล้วของเก่ายังเสิร์ฟอยู่ (เคยเจอมาแล้ว)
//   ─ แบบนี้อัพไฟล์เดียว แล้วเติมคำแปลเพิ่มได้เรื่อย ๆ โดยไม่ต้องแตะหน้าอื่นเลย
//
//   ★ กติกาความปลอดภัย ที่ทำให้วิธีนี้ใช้ได้จริง
//   1. เทียบ "ทั้งข้อความ" เท่านั้น ไม่เดาแปลทีละคำ
//      → ชื่อเพลง ชื่อครู เนื้อหาที่สมาชิกเขียน จะไม่ถูกแตะ เพราะไม่ตรงกับคำในบัญชี
//   2. แก้แค่ nodeValue ของ text node เดิม — ไม่เพิ่ม ไม่ลบ node
//      → React ไม่พัง (การลบ node ทิ้งคือสิ่งที่ทำให้ Google Translate ทำเว็บ React ล่ม)
//   3. คำที่ยังไม่มีในบัญชี = คงภาษาไทยไว้ ไม่ขึ้นเป็นรหัสหรือช่องว่าง
//   4. ตัวเลขในข้อความถูกแทนด้วย {n} ตอนเทียบ แล้วใส่กลับตามลำดับ
//      → "อีก 200 ศักดินา" ใช้คำแปลเดียวกับ "อีก 5 ศักดินา"
import { EN } from './uiwords';

const NUM = /[0-9๐-๙]+(?:[.,][0-9]+)*/g;
const TH  = /[฀-๿]/;
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);

// ค่าเดิมภาษาไทย เก็บไว้กับตัว node เพื่อสลับกลับได้ และไม่แปลซ้ำซ้อน
const ORIG = new WeakMap();

function lookup(text) {
  const raw = text.trim();
  if (!raw || !TH.test(raw)) return null;
  let hit = EN[raw];
  if (hit != null) return hit;
  // ลองแบบแทนตัวเลขด้วย {n}
  const nums = raw.match(NUM);
  if (!nums) return null;
  const key = raw.replace(NUM, '{n}');
  hit = EN[key];
  if (hit == null) return null;
  let i = 0;
  return hit.replace(/\{n\}/g, () => nums[i++] ?? '');
}

// คงช่องว่างหน้า-หลังเดิมไว้ ไม่งั้นคำติดกัน
function swap(text, out) {
  const a = text.match(/^\s*/)[0], b = text.match(/\s*$/)[0];
  return a + out + b;
}

function doNode(node, on) {
  const had = ORIG.has(node);
  const base = had ? ORIG.get(node) : node.nodeValue;
  if (!on) { if (had) { node.nodeValue = base; ORIG.delete(node); } return; }
  // React เขียนทับ node เดิมได้ → ถ้าค่าปัจจุบันไม่ใช่คำแปลของเรา ให้ถือว่าเป็นต้นฉบับใหม่
  const out = lookup(node.nodeValue);
  if (out == null) { if (had) ORIG.delete(node); return; }
  if (node.nodeValue === swap(node.nodeValue, out)) return;
  ORIG.set(node, node.nodeValue);
  node.nodeValue = swap(node.nodeValue, out);
}

const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
const AORIG = new WeakMap();

function doAttrs(el, on) {
  let m = AORIG.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    if (!on) {
      if (m && m[a] != null) { el.setAttribute(a, m[a]); delete m[a]; }
      continue;
    }
    if (m && m[a] != null && el.getAttribute(a) !== m[a] + '') { /* React เปลี่ยนค่า → เริ่มใหม่ */ delete m[a]; }
    const cur = el.getAttribute(a);
    const out = lookup(cur);
    if (out == null) continue;
    if (!m) { m = {}; AORIG.set(el, m); }
    if (m[a] == null) m[a] = cur;
    if (el.getAttribute(a) !== out) el.setAttribute(a, out);
  }
  // ปุ่ม <input type=submit value="บันทึก">
  if (el.tagName === 'INPUT' && /submit|button|reset/i.test(el.type || '')) {
    const out = on ? lookup(el.value) : null;
    if (out && el.value !== out) el.value = out;
  }
}

function walk(root, on) {
  if (!root) return;
  if (root.nodeType === 3) { doNode(root, on); return; }
  if (root.nodeType !== 1) return;
  if (SKIP.has(root.tagName)) return;
  if (root.closest && root.closest('[data-nolang]')) return;
  doAttrs(root, on);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n.nodeType === 1) return SKIP.has(n.tagName) || n.hasAttribute('data-nolang')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n;
  while ((n = it.nextNode())) {
    if (n.nodeType === 3) doNode(n, on);
    else doAttrs(n, on);
  }
}

const OPT = { childList: true, subtree: true, characterData: true,
  attributes: true, attributeFilter: ATTRS };
let obs = null, want = false, queued = false;

// ปิดตาระหว่างที่เราแก้เอง ไม่งั้น observer จะปลุกตัวเองไม่จบ
function flush() {
  queued = false;
  if (!obs) return;
  obs.disconnect();
  try { walk(document.body, want); } finally { obs.observe(document.body, OPT); }
}

// เปิด/ปิดชั้นแปล — LangProvider เรียกให้ตอนสลับภาษา
export function applyEN(on) {
  if (typeof document === 'undefined' || !document.body) return;
  want = !!on;
  if (want) {
    if (!obs) {
      obs = new MutationObserver(() => {
        if (!queued) { queued = true; requestAnimationFrame(flush); }
      });
      obs.observe(document.body, OPT);
    }
    flush();
  } else {
    if (obs) { obs.disconnect(); obs = null; }
    walk(document.body, false);
  }
}

export { EN };
