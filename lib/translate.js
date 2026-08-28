'use client';
// lib/translate.js — ฝั่งหน้าเว็บ: สั่งแปล / นับงานค้าง / เลือกภาษาที่จะแสดง
//   (Pk 28 ส.ค. 69)
import { supabase } from './supabase';

// สั่งให้ตัวแปลทำงาน — เรียกหลังสมาชิกส่งเนื้อหา และหลังผู้ดูแลกดอนุมัติ
//   ★ ไม่ await ผลลัพธ์ในเส้นทางที่ผู้ใช้ต้องรอ — แปลช้าไม่ควรทำให้กดส่งแล้วค้าง
export async function kickTranslate(limit = 8) {
  try {
    const { data } = await supabase.auth.getSession();
    const tok = data?.session?.access_token;
    if (!tok) return { error: 'ยังไม่ได้เข้าสู่ระบบ' };
    const r = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
      body: JSON.stringify({ limit }),
    });
    return await r.json();
  } catch (e) {
    return { error: String(e.message ?? e) };
  }
}

// เรียกแบบ "ยิงแล้วลืม" — ใช้หลังกดส่ง/กดอนุมัติ ไม่ให้ผู้ใช้ต้องรอ
export function kickTranslateSoon(limit = 8) {
  setTimeout(() => { kickTranslate(limit); }, 300);
}

export async function trStats() {
  const { data, error } = await supabase.rpc('thma_tr_stats');
  if (error) return { rows: null, error };
  const rows = data ?? [];
  const total = rows.reduce((a, r) => a + Number(r.pending ?? 0), 0);
  return { rows, pending: total, error: null };
}

export async function trReset(src) {
  const { data, error } = await supabase.rpc('thma_tr_reset', { p_src: src ?? null });
  return { n: data ?? 0, error };
}

export async function trHealth() {
  try { return await (await fetch('/api/translate')).json(); }
  catch (e) { return { ready: false, error: String(e.message ?? e) }; }
}

// ── เลือกข้อความตามภาษา ────────────────────────────────────────
//   ยังไม่มีคำแปล → ใช้ไทยไปก่อน ไม่ใช่ช่องว่าง
//   ★ กติกา: อังกฤษใช้ได้ต่อเมื่อ "แปลครบและต้นฉบับไม่เปลี่ยน" (tr_hash = tr_src)
//     ไม่งั้นคนอ่านจะเห็นคำแปลเก่าคู่กับข้อความไทยที่แก้ไปแล้ว
export const trOK = row => !!row && !!row.tr_hash && row.tr_hash === row.tr_src;

//   ★ ชื่อช่องอังกฤษไม่ได้เป็น <ช่องไทย>_en เสมอไป
//     songs.name_th คู่กับ songs.name_en (ไม่ใช่ name_th_en) — จึงต้องระบุได้เอง
const EN_FIELD = { name_th: 'name_en' };
export function trText(lang, row, field, enField) {
  const th = row?.[field];
  if (lang !== 'en') return th;
  const en = row?.[enField ?? EN_FIELD[field] ?? (field + '_en')];
  return (trOK(row) && typeof en === 'string' && en.trim()) ? en : th;
}

// คอลัมน์ที่ต้อง select เพิ่มเวลาดึงข้อมูล เพื่อให้ trText ทำงานได้
export const TR_COLS = 'tr_hash, tr_src';
