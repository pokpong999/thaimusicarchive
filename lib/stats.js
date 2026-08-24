'use client';
import { supabase } from './supabase';

// นับวิว 1 ครั้งต่อชิ้นงานต่อ 6 ชั่วโมง (กันรีเฟรชรัว)
export function countView(type, id) {
  if (!id) return;
  try {
    const key = `v:${type}:${id}`;
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 6 * 3600 * 1000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {}
  supabase.rpc('bump_stat', { p_type: type, p_id: String(id), p_kind: 'view' });
}

export function countShare(type, id) {
  if (!id) return;
  supabase.rpc('bump_stat', { p_type: type, p_id: String(id), p_kind: 'share' });
}

export async function getStat(type, id) {
  const { data } = await supabase.from('content_stats')
    .select('views, shares').eq('target_type', type).eq('target_id', String(id)).maybeSingle();
  return data ?? { views: 0, shares: 0 };
}
