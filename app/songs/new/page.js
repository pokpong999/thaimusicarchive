'use client';
// app/songs/new/page.js — เพิ่มเพลงใหม่เข้าฐาน (ใช้กระดานโน้ตไทย)
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import NotationInput from '../../../components/NotationInput';
import RankGate from '../../../components/RankGate';
import { versesToRows, versesToText, checkVerses, hasSound } from '../../../lib/notation-core';

const TYPES = ['🟢 แปรทำนอง', '🟠 บังคับทาง', '🟡 กึ่งบังคับทาง'];
const INSTS = ['ทำนองหลัก','ระนาดเอก','ระนาดทุ้ม','ฆ้องวงใหญ่','ฆ้องวงเล็ก','ปี่ใน','ขลุ่ยเพียงออ','ซอด้วง','ซออู้','ซอสามสาย','จะเข้','ขิม'];

export default function NewSongPage() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [songType, setSongType] = useState(TYPES[0]);
  const [instrument, setInstrument] = useState('ทำนองหลัก');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState({ verses: 0, warn: 0 });
  const padRef = useRef(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user)); }, []);

  function onChange({ verses, base }) {
    const ck = checkVerses(verses, { base });
    setSummary({ verses: verses.filter(hasSound).length, warn: ck.filter(c => c.kind === 'warn').length });
  }

  async function submit() {
    if (!name.trim()) { setMsg('⚠ ใส่ชื่อเพลง'); return; }
    const verses = padRef.current.getVerses();
    const st = padRef.current.getState();
    if (!verses.filter(hasSound).length) { setMsg('⚠ กรอกโน้ตอย่างน้อย 1 วรรค'); return; }
    if (padRef.current.stop) padRef.current.stop();
    setBusy(true); setMsg('กำลังส่ง…');
    const rows = versesToRows(verses, { twoHands: st.twoHands });
    const { error } = await supabase.from('song_submissions').insert({
      name_th: name.trim(), song_type: songType, instrument,
      notation_text: versesToText(verses, { twoHands: st.twoHands }),   // อ่านได้ด้วยตา + ระบบเก่ายังอ่านออก
      notation_json: { rows, base: st.base, line_hong: st.lineHong, two_hands: st.twoHands,
                       ensemble: st.ensemble, level: st.level },       // ระบบใหม่ใช้ตัวนี้
      note: note || null, submitted_by: user.id,
    });
    setBusy(false);
    if (error) { setMsg(error.message.includes('row-level security')
      ? '⚠ บัญชีของคุณยังไม่ถึงบรรดาศักดิ์ ขุน (300 ศักดินา) จึงยังใช้ระบบบันทึกโน้ตไม่ได้ — ร่วมบันทึกเหตุการณ์จดหมายเหตุเพื่อสะสมศักดินาก่อน'
      : '⚠ ' + error.message); return; }
    setMsg(`✓ ส่งเพลง "${name}" (${rows.length} วรรค) แล้ว — รอผู้ดูแลตรวจสอบและอนุมัติ (+10 ศักดินาเมื่อผ่าน)`);
    padRef.current.clearDraft();
    setName(''); setNote('');
  }

  if (!user) return (
    <main className="container" style={{maxWidth:'500px'}}>
      <div className="lock-box">
        <div style={{marginBottom:'1rem'}}>เข้าสู่ระบบเพื่อเพิ่มเพลงใหม่</div>
        <Link href="/login"><button className="btn btn-primary">เข้าสู่ระบบ / สมัคร</button></Link>
      </div>
    </main>
  );

  // ช่วงเปิดตัว: ระบบบันทึกโน้ตเปิดให้ระดับ ขุน (300 ศักดินา) ขึ้นไป
  return (
    <RankGate minPoints={300}>
    <main className="container" style={{maxWidth:'1180px'}}>
      <Link href="/"><span style={{color:'var(--muted)',fontSize:'0.8rem'}}>← กลับรายการเพลง</span></Link>
      <div className="card" style={{marginTop:'1rem'}}>
        <div className="section-title" style={{fontSize:'1.1rem'}}>เพิ่มเพลงใหม่เข้าฐานข้อมูล</div>
        <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:'1.1rem'}}>
          พิมพ์โน้ตด้วยแป้น TH Notation (a s d f g h j = ด ร ม ฟ ซ ล ท) · ผู้ดูแลตรวจสอบก่อนเผยแพร่ · เครดิตชื่อผู้เพิ่มแสดงในหน้าเพลง
        </div>

        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:'0.8rem'}}>
          <div className="form-group">
            <label className="form-label">ชื่อเพลง *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น จีนล่องหน่าย สองชั้น" />
          </div>
          <div className="form-group">
            <label className="form-label">ประเภทเพลง</label>
            <select className="form-input" value={songType} onChange={e => setSongType(e.target.value)}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">ทาง / เครื่องดนตรี</label>
            <select className="form-input" value={instrument} onChange={e => setInstrument(e.target.value)}>
              {INSTS.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
        </div>

        <NotationInput ref={padRef} onChange={onChange} options={{ base: 4, lineHong: 8, draftKey: 'new' }} />

        <div className="form-group" style={{marginTop:'1rem'}}>
          <label className="form-label">ที่มาโน้ต / หมายเหตุถึงผู้ดูแล</label>
          <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="เช่น ถอดจากโน้ตครูสำนัก…" />
        </div>
        <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'}}>
          <button className="btn btn-jade" onClick={submit} disabled={busy}>✓ ส่งเพลง — รอผู้ดูแลตรวจสอบ</button>
          <span style={{fontSize:'0.75rem',color:'var(--muted)'}}>
            {summary.verses} วรรค{summary.warn ? ` · ⚑ มี ${summary.warn} จุดที่ระบบทักไว้ (ส่งได้ ผู้ดูแลจะเห็นธง)` : ''}
          </span>
        </div>
        {msg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{msg}</div>}
      </div>
    </main>
    </RankGate>
  );
}
