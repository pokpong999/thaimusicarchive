// lib/classroom.js — ห้องเรียน: ครูสร้างห้อง แจกรหัส สั่งงาน ติดตามว่าใครส่งแล้ว
//   Pk 27 ส.ค. 69 · ต้องรัน sql/25 แล้ว sql/26
//
//   นักเรียนกรอกรหัส → เป็นคำขอ (pending) → ครูกดอนุมัติจึงเข้าห้องได้
//   นักเรียนเห็นเฉพาะแถวของตัวเอง ไม่เห็นรายชื่อหรือคะแนนของเพื่อนร่วมห้อง
import { supabase } from './supabase';

export const MEMBER_STATUS = {
  pending:  { label: 'รออนุมัติ',  icon: '⏳', color: 'var(--gold)' },
  approved: { label: 'อยู่ในห้อง', icon: '✓',  color: 'var(--jade)' },
  rejected: { label: 'ไม่อนุมัติ', icon: '✕',  color: 'var(--danger)' },
};
// สถานะของงานหนึ่งช่องในตารางติดตาม
export const CELL = {
  missing:  { label: 'ยังไม่ส่ง',  icon: '—',  color: 'var(--muted)' },
  sent:     { label: 'ส่งแล้ว',    icon: '📮', color: 'var(--gold)' },
  returned: { label: 'ให้แก้',     icon: '✎',  color: 'var(--danger)' },
  graded:   { label: 'ตรวจแล้ว',   icon: '✓',  color: 'var(--jade)' },
};
export const cellOf = s => CELL[s] ?? CELL.missing;

const notReady = e => /does not exist|relation|schema cache|function/i.test(e?.message ?? '');
export const READY_MSG = 'ยังไม่ได้เปิดระบบห้องเรียนในฐานข้อมูล — ผู้ดูแลต้องรัน sql/25 แล้ว sql/26 ก่อน';
export const friendly = e => (e ? (notReady(e) ? READY_MSG : e.message) : '');

// ── ครู ────────────────────────────────────────────────────────────
export async function myClasses(teacherId) {
  const { data, error } = await supabase.from('classrooms')
    .select('*').eq('teacher_id', teacherId).eq('archived', false)
    .order('created_at', { ascending: false });
  return { rows: data ?? [], error };
}

// จำนวนคนรออนุมัติของทุกห้องรวดเดียว — ครูต้องเห็นตั้งแต่ยังไม่เปิดห้อง
export async function pendingCounts(classIds) {
  if (!classIds?.length) return { counts: new Map(), error: null };
  const { data, error } = await supabase.from('class_members')
    .select('class_id, status').in('class_id', classIds).eq('status', 'pending');
  const m = new Map();
  for (const r of data ?? []) m.set(r.class_id, (m.get(r.class_id) ?? 0) + 1);
  return { counts: m, error };
}

export async function createClass(name, detail) {
  const { data, error } = await supabase.rpc('class_create', { p_name: name, p_detail: detail || null });
  const row = Array.isArray(data) ? data[0] : data;
  return { id: row?.id ?? null, code: row?.code ?? null, error };
}

export async function regenCode(classId) {
  const { data, error } = await supabase.rpc('class_regen_code', { p_class_id: classId });
  return { code: data ?? null, error };
}

export async function setClassOpen(classId, open) {
  const { error } = await supabase.from('classrooms').update({ is_open: open }).eq('id', classId);
  return { error };
}
export async function archiveClass(classId) {
  const { error } = await supabase.from('classrooms').update({ archived: true }).eq('id', classId);
  return { error };
}

// รายชื่อในห้อง (ครูเท่านั้นจึงจะได้ครบ — นักเรียนจะได้แค่แถวตัวเอง ตาม RLS)
export async function classMembers(classId) {
  const { data, error } = await supabase.from('class_members')
    .select('*').eq('class_id', classId).order('joined_at');
  const rows = data ?? [];
  const ids = [...new Set(rows.map(r => r.student_id))];
  let m = new Map();
  if (ids.length) {
    const { data: ps } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids);
    m = new Map((ps ?? []).map(p => [p.id, p]));
  }
  return { rows: rows.map(r => ({ ...r, student: m.get(r.student_id) ?? null })), error };
}

export async function decideMember(memberId, ok) {
  const { error } = await supabase.rpc('class_decide', { p_member_id: memberId, p_ok: ok });
  return { error };
}
export async function removeMember(memberId) {
  const { error } = await supabase.from('class_members').delete().eq('id', memberId);
  return { error };
}
export async function setSeatNo(memberId, seat) {
  const { error } = await supabase.from('class_members').update({ seat_no: seat || null }).eq('id', memberId);
  return { error };
}

// ── งานที่ครูสั่ง ───────────────────────────────────────────────────
export async function listAssignments(classId) {
  const { data, error } = await supabase.from('assignments')
    .select('*').eq('class_id', classId).order('created_at');
  return { rows: data ?? [], error };
}
export async function createAssignment(classId, { title, brief, dueAt }) {
  if (!title?.trim()) return { error: { message: 'ตั้งชื่องานก่อน' } };
  const { error } = await supabase.from('assignments').insert({
    class_id: classId, title: title.trim(), brief: brief?.trim() || null, due_at: dueAt || null,
  });
  return { error };
}
export async function closeAssignment(id, closed) {
  const { error } = await supabase.from('assignments').update({ closed }).eq('id', id);
  return { error };
}
export async function deleteAssignment(id) {
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  return { error };
}

// ── ตารางติดตาม: นักเรียน × งาน ─────────────────────────────────────
export async function classProgress(classId) {
  const { data, error } = await supabase.rpc('class_progress', { p_class_id: classId });
  return { rows: data ?? [], error };
}
export async function assignmentCounts(classId) {
  const { data, error } = await supabase.rpc('class_assignment_counts', { p_class_id: classId });
  const m = new Map((data ?? []).map(r => [r.assignment_id, r]));
  return { counts: m, error };
}

// จัดผลลัพธ์ให้เป็นตาราง: 1 แถว = 1 นักเรียน · ช่อง = งานแต่ละชิ้น
export function toGrid(rows) {
  const students = new Map();
  const assignments = new Map();
  for (const r of rows) {
    if (!students.has(r.student_id)) {
      students.set(r.student_id, { id: r.student_id, name: r.student_name, seat: r.seat_no, cells: new Map() });
    }
    if (!assignments.has(r.assignment_id)) {
      assignments.set(r.assignment_id, { id: r.assignment_id, title: r.assignment_title, dueAt: r.due_at });
    }
    students.get(r.student_id).cells.set(r.assignment_id, {
      status: r.status, grade: r.grade, homeworkId: r.homework_id,
      submittedAt: r.submitted_at, version: r.version,
    });
  }
  return { students: [...students.values()], assignments: [...assignments.values()] };
}

// ── นักเรียน ───────────────────────────────────────────────────────
export async function joinClass(code) {
  const { data, error } = await supabase.rpc('class_join', { p_code: (code ?? '').trim() });
  const row = Array.isArray(data) ? data[0] : data;
  return { info: row ?? null, error };
}

// ห้องที่ฉันอยู่ (หรือกำลังรออนุมัติ) — RLS ให้เห็นเฉพาะแถวของตัวเอง
export async function myMemberships(studentId) {
  const { data, error } = await supabase.from('class_members')
    .select('*').eq('student_id', studentId).order('joined_at', { ascending: false });
  const rows = data ?? [];
  const ids = [...new Set(rows.map(r => r.class_id))];
  let cls = new Map(), tch = new Map();
  if (ids.length) {
    const { data: cs } = await supabase.from('classrooms').select('*').in('id', ids);
    cls = new Map((cs ?? []).map(c => [c.id, c]));
    const tids = [...new Set((cs ?? []).map(c => c.teacher_id))];
    if (tids.length) {
      const { data: ps } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', tids);
      tch = new Map((ps ?? []).map(p => [p.id, p]));
    }
  }
  return {
    rows: rows.map(r => {
      const c = cls.get(r.class_id) ?? null;
      return { ...r, classroom: c, teacher: c ? (tch.get(c.teacher_id) ?? null) : null };
    }),
    error,
  };
}

export async function leaveClass(memberId) {
  const { error } = await supabase.from('class_members').delete().eq('id', memberId);
  return { error };
}

// งานที่ครูสั่งในห้องที่ฉันอยู่ + สถานะของฉันเอง
export async function myAssignments(classId, studentId) {
  const { rows: asg, error } = await listAssignments(classId);
  if (error) return { rows: [], error };
  const { data: hw } = await supabase.from('homework')
    .select('id, assignment_id, status, grade, version, created_at')
    .eq('student_id', studentId).eq('class_id', classId);
  const m = new Map((hw ?? []).filter(h => h.assignment_id).map(h => [h.assignment_id, h]));
  return { rows: asg.map(a => ({ ...a, mine: m.get(a.id) ?? null })), error: null };
}

export const dueText = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const days = Math.ceil((d - Date.now()) / 86400000);
  if (days < 0) return `เลยกำหนดมา ${-days} วัน`;
  if (days === 0) return 'ครบกำหนดวันนี้';
  if (days === 1) return 'ครบกำหนดพรุ่งนี้';
  return `อีก ${days} วัน`;
};
