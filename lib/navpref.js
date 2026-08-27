'use client';
// lib/navpref.js — เลือกได้ว่าจะใช้ "แถบเมนูบน" หรือ "รางไอคอนซ้าย"  (Pk 27 ส.ค. 69)
//
//   เก็บไว้ในเครื่องของแต่ละคน (localStorage) ไม่ใช่ในฐานข้อมูล
//   เพราะเป็นความชอบส่วนตัว ไม่ใช่ข้อมูลของเว็บ — และจะได้ลองสลับดูได้เองโดยไม่กระทบคนอื่น
//
//   'top'  แถบเมนูบนแบบเดิม
//   'rail' รางไอคอนซ้าย กว้าง 56px ชี้เมาส์แล้วกางออกทับเนื้อหา
import { useCallback, useEffect, useState } from 'react';

export const NAV_KEY = 'thma-nav';
export const NAV_EVENT = 'thma-nav-change';

export function readNav() {
  if (typeof window === 'undefined') return 'top';
  try { return localStorage.getItem(NAV_KEY) === 'rail' ? 'rail' : 'top'; }
  catch (e) { return 'top'; }
}

export function writeNav(mode) {
  const v = mode === 'rail' ? 'rail' : 'top';
  try { localStorage.setItem(NAV_KEY, v); } catch (e) {}
  // แจ้งทุกชิ้นในหน้าเดียวกัน (storage event ไม่ยิงให้แท็บตัวเอง)
  try { window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: v })); } catch (e) {}
  applyNavClass(v);
  return v;
}

// ใส่คลาสไว้ที่ <html> เพื่อให้ CSS เว้นที่ให้รางได้ โดยไม่ต้องแก้ทุกหน้า
export function applyNavClass(v) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('nav-rail', v === 'rail');
}

export function useNavMode() {
  // เริ่มที่ 'top' เสมอ แล้วค่อยอ่านของจริงหลัง mount — กัน hydration ไม่ตรงกับ server
  const [mode, setMode] = useState('top');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = readNav();
    setMode(v); setReady(true); applyNavClass(v);
    const onChange = e => { const nv = e?.detail ?? readNav(); setMode(nv); applyNavClass(nv); };
    const onStorage = e => { if (e.key === NAV_KEY) onChange(); };
    window.addEventListener(NAV_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(NAV_EVENT, onChange); window.removeEventListener('storage', onStorage); };
  }, []);

  const set = useCallback(v => setMode(writeNav(v)), []);
  const toggle = useCallback(() => setMode(writeNav(readNav() === 'rail' ? 'top' : 'rail')), []);
  return { mode, ready, set, toggle, isRail: ready && mode === 'rail' };
}
