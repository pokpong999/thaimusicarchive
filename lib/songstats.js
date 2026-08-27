// lib/songstats.js — ตัวเลขสรุปของเพลง (จำนวนวรรค · กระสวนไม่ซ้ำ) ให้ตรงกับโน้ตจริงเสมอ
//   เดิมเขียนครั้งเดียวตอนอนุมัติเพลง แล้วไม่เคยอัปเดตอีกเลย — แก้โน้ตเพิ่ม/ลดวรรคทีไร ป้ายบนหน้าเพลงเพี้ยนถาวร
//   (Pk 27 ส.ค. 69) · เรียกได้หลังทุกครั้งที่บันทึกโน้ตของ "ทำนองหลัก"
import { supabase } from './supabase';

export const MAIN_INSTRUMENT = 'ทำนองหลัก';

export async function refreshSongStats(songId, instrument = MAIN_INSTRUMENT) {
  if (!songId) return { skipped: true };
  // นับจากทำนองหลักเท่านั้น — ทางเครื่องอื่นเป็นการแปรทำนอง ไม่ใช่ความยาวของเพลง
  if (instrument && instrument !== MAIN_INSTRUMENT) return { skipped: true };
  try {
    const { data, error } = await supabase.from('song_melody')
      .select('krasuan').eq('song_id', songId).eq('instrument', MAIN_INSTRUMENT);
    if (error || !data) return { error };
    const total = data.length;
    const uniq = new Set(data.map(r => r.krasuan).filter(Boolean)).size;
    const { error: e2 } = await supabase.from('songs')
      .update({ total_verses: total, unique_patterns: uniq }).eq('id', songId);
    return { error: e2, total, uniq };
  } catch (e) { return { error: e }; }
}
