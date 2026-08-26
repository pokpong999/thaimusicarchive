'use client';
// app/convert/page.js — 🔁 แปลงโน้ตข้ามระบบ (2026-08-25)
//   นำเข้าไฟล์ทุกชนิด (PDF/Word/Excel/รูป/MusicXML/MIDI/ข้อความ) → กระดานโน้ตไทย (แก้ได้ ฟังได้ ดูโน้ตสากลได้) → ส่งออก MusicXML/MIDI/ข้อความ
//   ไม่บันทึกลงฐาน — ใช้เป็นเครื่องมือแปลงล้วน ๆ (ร่างเก็บใน localStorage 'convert') · จะลงฐานให้ไปที่ "เพิ่มเพลง" แล้วนำเข้าจากที่นั่น
import { useRef, useState } from 'react';
import Link from 'next/link';
import NotationInput from '../../components/NotationInput';
import NotationImport from '../../components/NotationImport';
import { hasSound } from '../../lib/notation-core';

export default function ConvertPage() {
  const padRef = useRef(null);
  const [stat, setStat] = useState({ verses: 0 });
  return (
    <main className="container" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>🔁 แปลงโน้ตข้ามระบบ</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 2 }}>
            อักษรไทย ⇄ TH Notation ⇄ โน้ตสากล 5 เส้น · นำเข้าจาก PDF · Word · Excel · รูปภาพ · MusicXML · MIDI แล้วแก้บนกระดาน ฟัง และส่งออกได้ทันที
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <Link href="/songs/new?mode=import"><button className="btn btn-outline btn-sm">➕ จะบันทึกเข้าฐาน? ไป "เพิ่มเพลง → นำเข้าจากไฟล์"</button></Link>
      </div>

      <NotationImport embedded title="📥 นำเข้า / ⬇ ส่งออก"
        getVerses={() => padRef.current ? padRef.current.getVerses() : []}
        onImport={(vs, { mode }) => {
          const pad = padRef.current; if (!pad) return;
          const cur = pad.getVerses().filter(hasSound);
          pad.loadVerses(mode === 'append' && cur.length ? [...cur, ...vs] : vs);
          window.scrollTo({ top: document.getElementById('convert-board')?.offsetTop - 70, behavior: 'smooth' });
        }} />

      <div id="convert-board" style={{ marginTop: 12 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 4 }}>กระดานโน้ตไทย — แก้ได้ กด ▶ ฟังได้ เปิด "โน้ตสากล 5 เส้น" ดูได้ · {stat.verses ? `${stat.verses} วรรค` : 'ยังว่าง'}</div>
        <NotationInput ref={padRef} options={{ base: 4, lineHong: 8, draftKey: 'convert', staff: true }}
          onChange={({ verses }) => setStat({ verses: (verses || []).filter(hasSound).length })} />
      </div>
    </main>
  );
}
