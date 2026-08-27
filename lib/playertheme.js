'use client';
// lib/playertheme.js — สีกระดาษของ "โปรแกรมเล่นโน้ต"  (Pk 27 ส.ค. 69)
//
//   แยกกุญแจกับกระดานเขียนโน้ต (thma-board-theme) เพราะคนละโปรแกรมกัน
//   บางคนชอบเขียนบนพื้นเข้ม แต่เวลาเปิดอ่าน-เล่นอยากได้กระดาษขาวเหมือนโน้ตพิมพ์
//
//   'dark'  พื้นน้ำเงินเข้มแบบเดิม
//   'paper' กระดาษขาว หมึกดำ
//   'hicon' ขาวล้วน-ดำล้วน คมชัดสูง สำหรับฉายโปรเจกเตอร์หรือสายตาไม่ดี
import { useCallback, useEffect, useState } from 'react';

export const PLAYER_THEME_KEY = 'thma-player-theme';
export const PLAYER_THEMES = [
  { v: 'dark',  label: '🌙 พื้นสีเข้ม' },
  { v: 'paper', label: '📄 กระดาษขาว-ดำ' },
  { v: 'hicon', label: '◑ ขาว-ดำคมชัดสูง' },
];
const OK = PLAYER_THEMES.map(t => t.v);

export function readPlayerTheme() {
  if (typeof window === 'undefined') return 'dark';
  try { const v = localStorage.getItem(PLAYER_THEME_KEY); return OK.includes(v) ? v : 'dark'; }
  catch (e) { return 'dark'; }
}

export function writePlayerTheme(v) {
  const t = OK.includes(v) ? v : 'dark';
  try { localStorage.setItem(PLAYER_THEME_KEY, t); } catch (e) {}
  return t;
}

// คลาสที่เอาไปแปะกล่องนอกสุดของโปรแกรมเล่น
export const playerThemeClass = t => 'np-root' + (t === 'paper' ? ' np-paper' : t === 'hicon' ? ' np-hicon' : '');

export function usePlayerTheme() {
  // เริ่มที่ 'dark' เสมอ แล้วค่อยอ่านของจริงหลัง mount — กัน hydration ไม่ตรงกับฝั่ง server
  const [theme, setTheme] = useState('dark');
  useEffect(() => { setTheme(readPlayerTheme()); }, []);
  const set = useCallback(v => setTheme(writePlayerTheme(v)), []);
  return { theme, set, cls: playerThemeClass(theme) };
}
