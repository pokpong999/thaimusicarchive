// lib/homework.js — ระบบส่งการบ้าน นักเรียน → ครู  (Pk เคาะ 27 ส.ค. 69)
//   ต้องรัน sql/25_homework.sql ก่อนใช้งาน
//
//   สถานะของงาน
//     sent      ส่งแล้ว รอครูตรวจ
//     returned  ครูส่งกลับมาให้แก้
//     graded    ครูตรวจแล้ว (มีเกรด)
import { supabase } from './supabase';

export const HW_STATUS = {
  sent:     { label: 'รอครูตรวจ',      icon: '📮', color: 'var(--gold)' },
  returned: { label: 'ครูส่งกลับให้แก้', icon: '✎',  color: 'var(--danger)' },
  graded:   { label: 'ตรวจแล้ว',        icon: '✓',  color: 'var(--jade)' },
};
export const hwStatus = s => HW_STATUS[s] ?? HW_STATUS.sent;

// รายชื่อครูให้นักเรียนเลือก
export async function listTeachers() {
  const { data, error } = await supabase.from('thma_teachers')
    .select('id, display_name, avatar_url, organization, province').order('display_name');
  if (error) return { teachers: [], error };
  return { teachers: data ?? [], error: null };
}

// นักเรียนส่งงาน
export async function sendHomework({ studentId, teacherId, title, instrument, songType,
                                     notationText, notationJson, note, classId, assignmentId }) {
  if (!teacherId && !classId && !assignmentId) return { error: { message: 'เลือกครูที่จะส่งงานให้ก่อน' } };
  if (!title?.trim()) return { error: { message: 'ตั้งชื่องานก่อน' } };
  const payload = {
    title: title.trim(), instrument: instrument ?? null, song_type: songType ?? null,
    notation_text: notationText ?? null, notation_json: notationJson ?? null,
    student_note: note?.trim() || null, status: 'sent',
    class_id: classId ?? null, assignment_id: assignmentId ?? null,
  };

  // งานที่ครูสั่ง 1 ชิ้น นักเรียน 1 คน มีได้แถวเดียว (sql/26)
  // ถ้าเคยส่งไปแล้ว การส่งใหม่คือการแก้แถวเดิม และนับเป็นครั้งที่ถัดไป
  if (assignmentId) {
    const { data: old } = await supabase.from('homework')
      .select('id, version').eq('assignment_id', assignmentId).eq('student_id', studentId).maybeSingle();
    if (old?.id) {
      const { error } = await supabase.from('homework')
        .update({ ...payload, version: (old.version ?? 1) + 1 }).eq('id', old.id);
      return { id: old.id, resent: true, error };
    }
  }

  const { data, error } = await supabase.from('homework').insert({
    student_id: studentId,
    // ส่งเข้าห้อง: ฐานข้อมูลจะเขียนทับ teacher_id ให้เป็นครูเจ้าของห้องเองอยู่แล้ว
    teacher_id: teacherId ?? null,
    ...payload,
  }).select('id').single();
  return { id: data?.id ?? null, error };
}

// ส่งงานที่แก้แล้วซ้ำเข้าไปในชิ้นเดิม — นับเป็นครั้งที่เท่าไร และกลับไปรอตรวจใหม่
export async function resendHomework(id, { notationText, notationJson, note, version }) {
  const { error } = await supabase.from('homework').update({
    notation_text: notationText ?? null, notation_json: notationJson ?? null,
    student_note: note?.trim() || null, status: 'sent', version: (version ?? 1) + 1,
  }).eq('id', id);
  return { error };
}

// งานที่ฉันส่งไป (นักเรียน)
export async function listMyHomework(studentId) {
  const { data, error } = await supabase.from('homework')
    .select('*').eq('student_id', studentId).order('created_at', { ascending: false });
  return { rows: await withNames(data ?? []), error };
}

// กล่องงานที่ส่งมาถึงฉัน (ครู)
export async function listInbox(teacherId) {
  const { data, error } = await supabase.from('homework')
    .select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false });
  return { rows: await withNames(data ?? []), error };
}

// submitted_by ชี้ไป auth.users ไม่ใช่ profiles — ต้องดึงชื่อแยกแล้วค่อยจับคู่
//   และเติมชื่อห้องเรียน/ชื่องานที่ครูสั่งให้ด้วย ถ้าการบ้านชิ้นนั้นผูกไว้ (sql/26)
async function withNames(rows) {
  if (!rows.length) return rows;
  const ids = [...new Set(rows.flatMap(r => [r.student_id, r.teacher_id]).filter(Boolean))];
  let m = new Map();
  if (ids.length) {
    const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids);
    m = new Map((data ?? []).map(p => [p.id, p]));
  }
  const cIds = [...new Set(rows.map(r => r.class_id).filter(Boolean))];
  const aIds = [...new Set(rows.map(r => r.assignment_id).filter(Boolean))];
  let cm = new Map(), am = new Map();
  if (cIds.length) {
    const { data } = await supabase.from('classrooms').select('id, name').in('id', cIds);
    cm = new Map((data ?? []).map(c => [c.id, c.name]));
  }
  if (aIds.length) {
    const { data } = await supabase.from('assignments').select('id, title, due_at').in('id', aIds);
    am = new Map((data ?? []).map(a => [a.id, a]));
  }
  return rows.map(r => ({ ...r,
    student: m.get(r.student_id) ?? null,
    teacher: m.get(r.teacher_id) ?? null,
    class_name: r.class_id ? (cm.get(r.class_id) ?? null) : null,
    assignment_title: r.assignment_id ? (am.get(r.assignment_id)?.title ?? null) : null }));
}

export async function listComments(homeworkId) {
  const { data, error } = await supabase.from('homework_comments')
    .select('*').eq('homework_id', homeworkId).order('created_at');
  const rows = data ?? [];
  const ids = [...new Set(rows.map(r => r.author_id))];
  let m = new Map();
  if (ids.length) {
    const { data: ps } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids);
    m = new Map((ps ?? []).map(p => [p.id, p]));
  }
  return { rows: rows.map(r => ({ ...r, author: m.get(r.author_id) ?? null })), error };
}

export async function addComment(homeworkId, authorId, body) {
  if (!body?.trim()) return { error: { message: 'ยังไม่ได้พิมพ์อะไร' } };
  const { error } = await supabase.from('homework_comments')
    .insert({ homework_id: homeworkId, author_id: authorId, body: body.trim() });
  return { error };
}

// ครูตรวจ: ให้เกรด หรือส่งกลับให้แก้
export async function reviewHomework(id, status, grade = null) {
  const { error } = await supabase.rpc('hw_review', { p_id: id, p_status: status, p_grade: grade });
  return { error };
}

// ครูส่งงานดีเข้าคิวอนุมัติจริง — เครดิตยังเป็นของนักเรียน
export async function promoteHomework(id) {
  const { data, error } = await supabase.rpc('hw_promote', { p_id: id });
  return { submissionId: data ?? null, error };
}

export async function deleteHomework(id) {
  const { error } = await supabase.from('homework').delete().eq('id', id);
  return { error };
}

// อ่านโน้ตที่ส่งมาให้กลับเป็นวรรค เพื่อเปิดดู/เล่นเสียงในหน้าตรวจงาน
export function versesOf(hw) {
  const rows = hw?.notation_json?.rows;
  if (Array.isArray(rows) && rows.length) return rows;
  const text = hw?.notation_text ?? '';
  if (!text.trim()) return [];
  return text.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
    .map((l, i) => ({ verse_no: i + 1, combined: l.trim() }));
}
