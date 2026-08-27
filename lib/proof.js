'use client';
// lib/proof.js — สถานะการตรวจทานโน้ต  (Pk 27 ส.ค. 69)
//
//   "โน้ตผิดหลายเพลงเลย ผมจะให้แอดมินช่วยกันตรวจทาน … จะได้ไม่ต้องตรวจซ้ำ"
//
//   หัวใจไม่ใช่ตัวติ๊ก แต่คือ "ใครตรวจ" กับ "ตรวจเมื่อไหร่"
//   ฐานประทับให้เองใน thma_set_proof (sql/33) หน้าเว็บส่งมาเองไม่ได้
import { supabase } from './supabase';

export const PROOF = [
  { v: 'none',  label: 'ยังไม่ตรวจ',   icon: '⬜', color: 'var(--muted)'  },
  { v: 'doing', label: 'กำลังตรวจ',    icon: '🔍', color: 'var(--gold2)'  },
  { v: 'ok',    label: 'ตรวจแล้วถูก',  icon: '✅', color: 'var(--jade)'   },
  { v: 'bad',   label: 'พบที่ผิด',     icon: '⚠️', color: 'var(--danger)' },
];
export const proofOf = v => PROOF.find(p => p.v === v) ?? PROOF[0];
export const PROOF_ORDER = PROOF.map(p => p.v);

export async function setProof(songId, status, note) {
  const { data, error } = await supabase.rpc('thma_set_proof', {
    p_song: songId, p_status: status, p_note: note ?? null,
  });
  if (error) return { error };
  return { error: null, row: Array.isArray(data) ? data[0] : data };
}

export async function proofProgress() {
  const { data, error } = await supabase.rpc('thma_proof_progress');
  if (error) return { counts: null, error };
  const counts = { none: 0, doing: 0, ok: 0, bad: 0 };
  (data ?? []).forEach(r => { counts[r.status] = Number(r.n); });
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, error: null };
}

// ข้อความ "ตรวจโดยใคร เมื่อไหร่" — ให้คนถัดไปรู้ว่าไม่ต้องตรวจซ้ำ
export function proofWho(song, names = {}) {
  if (!song?.proof_at) return '';
  const who = names[song.proof_by] ?? 'ผู้ดูแล';
  const d = new Date(song.proof_at);
  const when = isNaN(d) ? '' : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  return `${who}${when ? ' · ' + when : ''}`;
}

export function proofError(m = '') {
  if (/function .*thma_set_proof|schema cache|does not exist|proof_status/i.test(m)) return 'ยังไม่ได้รัน sql/33 · ' + m;
  if (/ต้องเป็นผู้ดูแล/.test(m)) return m;
  return m;
}
