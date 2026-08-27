'use client';
// lib/songtypes.js — บัญชี "ประเภทเพลง" และ "ลักษณะการบรรเลง"  (Pk 27 ส.ค. 69)
//
//   เดิม songs.type เป็นข้อความเปล่า ๆ ตั้งได้ 3 ทางและใช้คนละชุดคำ
//   ตอนนี้คำที่อนุญาตอยู่ในตาราง song_types แก้ไขได้จากหน้าผู้ดูแล (ต้องรัน sql/29)
//
//   kind = 'type'  รูปแบบเพลง        เพลงสองชั้น · เพลงเถา · เพลงระบำ · เพลงหน้าพาทย์ …
//   kind = 'style' ลักษณะการบรรเลง   แปรทำนอง · บังคับทาง · กึ่งบังคับทาง
//
//   สองอย่างนี้เป็นคนละแกน เพลงหนึ่งมีได้ทั้งคู่ (เพลงสองชั้น + แปรทำนอง)
import { supabase } from './supabase';

export const KINDS = ['type', 'style'];
export const KIND_LABEL = { type: 'ประเภทเพลง', style: 'ลักษณะการบรรเลง' };
export const KIND_HINT = {
  type:  'รูปแบบของเพลง — เพลงสองชั้น · เพลงเถา · เพลงระบำ · เพลงหน้าพาทย์ …',
  style: 'ทางเครื่องแปรได้แค่ไหน — แปรทำนอง · บังคับทาง · กึ่งบังคับทาง',
};

// ยังไม่ได้รัน sql/29 ก็ยังใช้เว็บได้ — ตกกลับมาที่คำเดิมที่เคยฝังไว้ในโค้ด
const FALLBACK = {
  type: [],
  style: [
    { name: 'แปรทำนอง',     color: '#4C9A84' },
    { name: 'บังคับทาง',     color: '#D08A3E' },
    { name: 'กึ่งบังคับทาง', color: '#C9A84C' },
  ],
};

let cache = null;      // { type: [...], style: [...] }
let inflight = null;

// ผู้ดูแลแก้บัญชีแล้ว กล่องเลือกทุกกล่องในหน้าเดียวกันต้องเห็นทันที ไม่ต้องรีเฟรช
export const SONGTYPES_EVENT = 'thma-songtypes-change';

export function clearSongTypeCache() {
  cache = null; inflight = null;
  try { window.dispatchEvent(new CustomEvent(SONGTYPES_EVENT)); } catch (e) {}
}

// รายการที่ "เลือกได้" (ยังเปิดใช้อยู่) — ใช้ในกล่องเลือกทุกที่
export function loadSongTypes() {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = supabase.from('song_types').select('*').eq('active', true)
    .order('sort').order('name')
    .then(({ data, error }) => {
      const rows = error ? [] : (data ?? []);
      cache = {
        type:  rows.filter(r => r.kind === 'type'),
        style: rows.filter(r => r.kind === 'style'),
      };
      // ตารางยังไม่มี (ยังไม่ได้รัน sql/29) → ใช้คำเดิมไปก่อน จะได้ไม่มีกล่องเลือกว่าง
      if (!cache.style.length) cache.style = FALLBACK.style.map((s, i) => ({ ...s, kind: 'style', sort: (i + 1) * 10, active: true }));
      inflight = null;
      return cache;
    });
  return inflight;
}

// รายการทั้งหมดพร้อมจำนวนเพลงที่ใช้อยู่ — สำหรับหน้าผู้ดูแล
export async function loadSongTypesAdmin() {
  const [{ data: rows, error }, { data: songs }] = await Promise.all([
    supabase.from('song_types').select('*').order('kind').order('sort').order('name'),
    supabase.from('songs').select('type, style'),
  ]);
  if (error) return { error, list: { type: [], style: [] } };
  const used = { type: new Map(), style: new Map() };
  (songs ?? []).forEach(s => {
    if (s.type)  used.type.set(s.type,   (used.type.get(s.type) ?? 0) + 1);
    if (s.style) used.style.set(s.style, (used.style.get(s.style) ?? 0) + 1);
  });
  const withCount = k => (rows ?? []).filter(r => r.kind === k)
    .map(r => ({ ...r, count: used[k].get(r.name) ?? 0 }));
  // คำที่มีเพลงใช้อยู่แต่ไม่อยู่ในบัญชี (นำเข้าใหม่หลังรัน sql/29) — ต้องเห็น ไม่ใช่ซ่อนไว้
  const orphans = k => [...used[k].entries()]
    .filter(([name]) => !(rows ?? []).some(r => r.kind === k && r.name === name))
    .map(([name, count]) => ({ id: null, kind: k, name, count, sort: 9999, active: true, orphan: true }));
  return {
    error: null,
    list: { type: [...withCount('type'), ...orphans('type')], style: [...withCount('style'), ...orphans('style')] },
  };
}

export async function addSongType(kind, name, { color = null, note = null } = {}) {
  const n = (name ?? '').trim();
  if (!n) return { error: { message: 'ยังไม่ได้ใส่ชื่อ' } };
  const { data: last } = await supabase.from('song_types').select('sort')
    .eq('kind', kind).order('sort', { ascending: false }).limit(1);
  const sort = ((last?.[0]?.sort) ?? 0) + 10;
  const { error } = await supabase.from('song_types').insert({ kind, name: n, sort, color, note });
  clearSongTypeCache();
  if (error && /duplicate|unique/i.test(error.message)) return { error: { message: `มี "${n}" อยู่แล้ว` } };
  return { error };
}

// เปลี่ยนชื่อ — moveSongs = true จะย้ายเพลงที่ใช้ชื่อเดิมตามไปด้วย
//   ถ้าไม่ย้าย เพลงเก่าจะกลายเป็นคำนอกบัญชี (ยังเห็นอยู่ในหน้าผู้ดูแล ไม่หายเงียบ)
export async function renameSongType(row, newName, { moveSongs = true } = {}) {
  const n = (newName ?? '').trim();
  if (!n) return { error: { message: 'ยังไม่ได้ใส่ชื่อใหม่' } };
  if (n === row.name) return { error: null, moved: 0 };
  let moved = 0;
  if (moveSongs) {
    const col = row.kind === 'type' ? 'type' : 'style';
    const { error: e1, count } = await supabase.from('songs')
      .update({ [col]: n }, { count: 'exact' }).eq(col, row.name);
    if (e1) return { error: e1 };
    moved = count ?? 0;
  }
  if (row.id != null) {
    const { error } = await supabase.from('song_types').update({ name: n }).eq('id', row.id);
    clearSongTypeCache();
    if (error) return { error };
  } else {
    // คำนอกบัญชี — เปลี่ยนชื่อแล้วเก็บเข้าบัญชีเลย
    const r = await addSongType(row.kind, n);
    if (r.error) return r;
  }
  clearSongTypeCache();
  return { error: null, moved };
}

export async function setSongTypeActive(row, active) {
  if (row.id == null) return { error: { message: 'คำนี้ยังไม่อยู่ในบัญชี — กด "เก็บเข้าบัญชี" ก่อน' } };
  const { error } = await supabase.from('song_types').update({ active }).eq('id', row.id);
  clearSongTypeCache();
  return { error };
}

// ลบได้เฉพาะคำที่ไม่มีเพลงไหนใช้ — กันไม่ให้ข้อมูลเพลงกลายเป็นคำที่ไม่มีความหมาย
export async function deleteSongType(row) {
  if (row.count > 0) return { error: { message: `ยังมี ${row.count} เพลงใช้ "${row.name}" อยู่ — เปลี่ยนชื่อ หรือย้ายเพลงก่อน` } };
  if (row.id == null) return { error: null };
  const { error } = await supabase.from('song_types').delete().eq('id', row.id);
  clearSongTypeCache();
  return { error };
}

export async function moveSongType(list, row, dir) {
  const i = list.findIndex(x => x.id === row.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return { error: null };
  const a = list[i], b = list[j];
  if (a.id == null || b.id == null) return { error: { message: 'คำนอกบัญชีเรียงลำดับไม่ได้' } };
  await supabase.from('song_types').update({ sort: b.sort }).eq('id', a.id);
  await supabase.from('song_types').update({ sort: a.sort }).eq('id', b.id);
  clearSongTypeCache();
  return { error: null };
}

// ย้ายเพลงทั้งหมดจากคำหนึ่งไปอีกคำหนึ่ง (รวมคำซ้ำ)
export async function mergeSongType(row, intoName) {
  const col = row.kind === 'type' ? 'type' : 'style';
  const { error, count } = await supabase.from('songs')
    .update({ [col]: intoName }, { count: 'exact' }).eq(col, row.name);
  if (error) return { error };
  if (row.id != null) await supabase.from('song_types').delete().eq('id', row.id);
  clearSongTypeCache();
  return { error: null, moved: count ?? 0 };
}
