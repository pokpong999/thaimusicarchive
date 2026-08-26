'use client';
// components/DraftBar.js — แถบ "ฉบับร่าง" เหนือฟอร์มเพิ่มเพลง / บันทึกเหตุการณ์ (Pk 2026-08-26)
//   โชว์สถานะการเก็บร่างอัตโนมัติ + ปุ่ม 💾 บันทึกร่าง + ปุ่มทิ้งร่าง
//   และรายการ "ร่างที่ค้างอยู่" ของประเภทนี้ ให้กดเปิดมาแก้ต่อได้จากหน้าเดียวกัน
import Link from 'next/link';
import { draftSummary } from '../lib/drafts';
import { fmtDT } from '../lib/fmtdate';

export default function DraftBar({ kind, draftId, savedAt, saving, error, others = [], onSave, onDiscard, onOpen }) {
  const label = kind === 'song' ? 'เพลง' : 'เหตุการณ์';
  return (
    <div className="draft-bar card" style={{ padding: '0.6rem 0.9rem', marginBottom: '0.8rem', borderColor: 'rgba(76,154,132,0.35)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
        <span style={{ fontWeight: 600 }}>📝 ฉบับร่าง</span>
        <span data-t="draft-state" style={{ color: error ? 'var(--danger)' : savedAt ? 'var(--jade)' : 'var(--muted)' }}>
          {error ? '⚠ เก็บร่างไม่สำเร็จ: ' + error
            : saving ? '⏳ กำลังเก็บร่าง…'
            : savedAt ? `เก็บร่างไว้ให้แล้ว ${new Date(savedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. — ยังไม่ได้ส่ง`
            : 'พิมพ์ได้เลย ระบบเก็บร่างให้อัตโนมัติ ปิดหน้าไปแล้วกลับมาแก้ต่อได้'}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-outline btn-sm" onClick={onSave} disabled={saving}>💾 บันทึกร่าง</button>
        {draftId && <button type="button" className="btn btn-outline btn-sm" onClick={onDiscard}>🗑 ทิ้งร่างนี้</button>}
        <Link href="/dashboard#drafts" style={{ fontSize: '0.72rem', color: 'var(--gold2)' }}>ร่างทั้งหมดของฉัน ↗</Link>
      </div>
      {others.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 4 }}>ร่าง{label}อื่นที่ค้างอยู่ ({others.length}) — กดเพื่อเปิดมาแก้ต่อ</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {others.map(d => (
              <button key={d.id} type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.74rem' }}
                title={draftSummary(d) + ' · แก้ล่าสุด ' + fmtDT(d.updated_at)} onClick={() => onOpen(d)}>
                ✏️ {d.title || '(ยังไม่ตั้งชื่อ)'}
                <span style={{ color: 'var(--muted)' }}> · {draftSummary(d)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
