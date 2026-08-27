'use client';
// components/SongTypeSelect.js — กล่องเลือกประเภทเพลง / ลักษณะการบรรเลง  (Pk 27 ส.ค. 69)
//
//   อ่านรายการจากตาราง song_types ไม่ใช่คำที่ฝังไว้ในโค้ด
//   ผู้ดูแลเพิ่มคำใหม่แล้วกล่องนี้เห็นทันทีทุกหน้า ไม่ต้องแก้โค้ด
//
//   ถ้าเพลงนี้ใช้คำที่ถูกปิดไปแล้ว (หรือคำนอกบัญชี) จะเพิ่มเข้ามาในรายการชั่วคราว
//   ไม่งั้นกล่องจะเด้งไปคำอื่นเงียบ ๆ แล้วค่าเดิมหายตอนกดบันทึก
import { useEffect, useState } from 'react';
import { loadSongTypes, SONGTYPES_EVENT } from '../lib/songtypes';

export default function SongTypeSelect({ kind = 'type', value, onChange, allowBlank = true,
                                         blankLabel = '— ยังไม่ระบุ —', className = 'form-input', style, disabled }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    const pull = () => loadSongTypes().then(c => { if (live) setRows(c[kind] ?? []); });
    pull();
    window.addEventListener(SONGTYPES_EVENT, pull);
    return () => { live = false; window.removeEventListener(SONGTYPES_EVENT, pull); };
  }, [kind]);

  const list = rows ?? [];
  const missing = value && !list.some(r => r.name === value);

  return (
    <select className={className} style={style} disabled={disabled || rows === null}
      value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
      {allowBlank && <option value="">{blankLabel}</option>}
      {missing && <option value={value}>{value} (นอกบัญชี)</option>}
      {list.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
    </select>
  );
}

// จุดสีหน้าชื่อ — ใช้ในตาราง/ป้าย
export function SongTypeDot({ color }) {
  if (!color) return null;
  return <span aria-hidden="true" style={{display:'inline-block',width:'8px',height:'8px',borderRadius:'50%',
    background:color,marginRight:'5px',verticalAlign:'middle'}} />;
}
