'use client';
// components/PinColorHint.js — บอกผู้โพสต์ว่าหมุดบนแผนที่จะเป็นสีอะไร (ไม่ระบุปี = เทา) ตั้งแต่ตอนกรอกฟอร์ม
import { pinColor, pinLabel, yearOf } from '../lib/eracolor';

export default function PinColorHint({ whenText, whenDate }) {
  const rec = { when_text: whenText, when_date: whenDate };
  const year = yearOf(rec), color = pinColor(rec), label = pinLabel(rec);
  const Pin = () => <span style={{ display: 'inline-block', width: 14, height: 14, background: color, border: '2px solid #0F1B2D',
    borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', marginRight: 8, verticalAlign: 'middle', boxShadow: '0 1px 4px rgba(0,0,0,.5)' }} />;
  return year == null ? (
    <div style={{ marginTop: -6, marginBottom: '1rem', padding: '8px 12px', borderRadius: 8, fontSize: '0.78rem', lineHeight: 1.7,
      background: 'rgba(154,163,173,0.12)', border: '1px solid rgba(154,163,173,0.5)', color: 'var(--cream)' }}>
      <Pin />⚠ ยังไม่พบปี พ.ศ. — <b>หมุดบนแผนที่จะเป็นสีเทา</b> (ไม่ระบุเวลา)<br />
      <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>ใส่ปี พ.ศ. 4 หลักในช่อง "เมื่อไหร่" (เช่น พ.ศ. 2466 · ราว 2500) หรือเลือกวันที่ แล้วหมุดจะได้สีตามช่วงเวลาทันที</span>
    </div>
  ) : (
    <div style={{ marginTop: -6, marginBottom: '1rem', padding: '6px 12px', borderRadius: 8, fontSize: '0.76rem',
      background: 'rgba(76,154,132,0.1)', border: '1px solid rgba(76,154,132,0.4)', color: 'var(--cream)' }}>
      <Pin />หมุดบนแผนที่: <b style={{ color }}>{label}</b> <span style={{ color: 'var(--muted)' }}>(อ่านปีได้ พ.ศ. {year})</span>
    </div>
  );
}
