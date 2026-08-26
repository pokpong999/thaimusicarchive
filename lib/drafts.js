// lib/drafts.js — ฉบับร่างของสมาชิก (เพลง / เหตุการณ์จดหมายเหตุ) · Pk 2026-08-26
//
//   ร่างอยู่ที่ตาราง `drafts` บน Supabase (sql/18) — เจ้าของเห็นคนเดียว (RLS)
//   ทำไมไม่เก็บแค่ในเครื่อง: ร่างของกระดานโน้ตเก็บใน localStorage อยู่แล้ว (NotationInput draftKey)
//   แต่ Pk อยากได้ "ฉบับร่าง" ที่ข้ามเครื่องได้และเห็นในหน้าจดหมายเหตุของฉัน → ต้องอยู่บนฐาน
//
//   kind = 'song' | 'archive' · payload = ทุกอย่างที่กรอกในฟอร์ม (jsonb)
//   วงจร: พิมพ์ → เก็บอัตโนมัติทุก ~2 วิ (หรือกด 💾) → กลับมาแก้ต่อจาก /dashboard หรือ ?draft=<id>
//         → กด "ส่ง" สำเร็จ ร่างถูกลบทิ้ง แล้วเข้าคิวอนุมัติตามปกติ
import { supabase } from './supabase';

export const DRAFT_KINDS = { song: 'เพลง', archive: 'เหตุการณ์' };

export async function listDrafts(kind = null) {
  let q = supabase.from('drafts').select('*').order('updated_at', { ascending: false });
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  return { drafts: data ?? [], error: error ?? null };
}
export async function getDraft(id) {
  const { data, error } = await supabase.from('drafts').select('*').eq('id', id).single();
  return { draft: data ?? null, error: error ?? null };
}
// id ว่าง = สร้างใหม่ · คืน id เพื่อให้ผู้เรียกเก็บไว้เขียนทับรอบต่อไป
export async function saveDraft({ id = null, kind, title, payload }) {
  const row = { kind, title: (title || '').slice(0, 200) || null, payload: payload ?? {} };
  if (id) {
    const { error } = await supabase.from('drafts').update(row).eq('id', id);
    return { id, error: error ?? null };
  }
  const { data, error } = await supabase.from('drafts').insert(row).select().single();
  return { id: data?.id ?? null, error: error ?? null };
}
export async function deleteDraft(id) {
  if (!id) return { error: null };
  const { error } = await supabase.from('drafts').delete().eq('id', id);
  return { error: error ?? null };
}

// ── ตัวช่วยเก็บร่างอัตโนมัติ ──
// เรียก push(payload) ได้บ่อยเท่าไรก็ได้ — เขียนจริงอย่างมากทุก wait มิลลิวินาที
// คืน { push, flush, cancel } · onSaved(id, at) แจ้งกลับให้หน้าจอโชว์ "บันทึกร่างแล้ว ..."
export function makeAutoSaver({ kind, wait = 2000, getId, setId, onSaved, onError }) {
  let timer = null, pending = null, busy = false;
  async function write() {
    if (busy || !pending) return;
    const job = pending; pending = null; busy = true;
    try {
      const { id, error } = await saveDraft({ id: getId(), kind, title: job.title, payload: job.payload });
      if (error) onError?.(error);
      else { if (id && id !== getId()) setId(id); onSaved?.(id, new Date()); }
    } catch (e) { onError?.(e); }
    busy = false;
    if (pending) write();
  }
  return {
    push(payload, title) { pending = { payload, title }; clearTimeout(timer); timer = setTimeout(write, wait); },
    flush() { clearTimeout(timer); return write(); },
    cancel() { clearTimeout(timer); pending = null; },
  };
}

// สรุปย่อของร่างไว้โชว์ในรายการ (ไม่ต้องเปิดก็พอเดาออกว่าร่างอะไร)
export function draftSummary(d) {
  const p = d?.payload ?? {};
  if (d?.kind === 'song') {
    const n = Array.isArray(p.rows) ? p.rows.length : (p.verses ?? 0);
    return [p.instrument, n ? `${n} วรรค` : 'ยังไม่มีโน้ต'].filter(Boolean).join(' · ');
  }
  return [p.who, p.whenText, p.where].filter(Boolean).join(' · ') || 'ยังไม่ได้กรอกรายละเอียด';
}
