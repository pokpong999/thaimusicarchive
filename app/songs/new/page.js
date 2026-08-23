'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';

const NOTES = ['ด','ร','ม','ฟ','ซ','ล','ท'];
const LOW = '\u0E3A', HIGH = '\u0E4D';

export default function NewSongPage() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [songType, setSongType] = useState('🟢 แปรทำนอง');
  const [instrument, setInstrument] = useState('ทำนองหลัก');
  const [note, setNote] = useState('');
  const [text, setText] = useState('- - - - | - - - - | - - - - | - - - -');
  const [register, setRegister] = useState(0);
  const [msg, setMsg] = useState('');
  const taRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // แทรกอักขระที่ตำแหน่ง cursor ใน textarea
  function insert(str) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const next = text.slice(0, start) + str + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + str.length;
    });
  }

  function insertNote(n) {
    insert(n + (register === -1 ? LOW : register === 1 ? HIGH : ''));
  }

  function addVerseLine() {
    setText(t => (t.trim() ? t + '\n' : '') + '- - - - | - - - - | - - - - | - - - -');
  }
  function addShortVerseLine() {
    setText(t => (t.trim() ? t + '\n' : '') + '- - - - | - - - -');
  }

  async function submit() {
    if (!name.trim()) { setMsg('⚠ ใส่ชื่อเพลง'); return; }
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) { setMsg('⚠ กรอกโน้ตอย่างน้อย 1 วรรค'); return; }
    const { error } = await supabase.from('song_submissions').insert({
      name_th: name.trim(), song_type: songType, instrument,
      notation_text: lines.join('\n'), note: note || null, submitted_by: user.id,
    });
    if (error) { setMsg('⚠ ' + error.message); return; }
    setMsg(`✓ ส่งเพลง "${name}" (${lines.length} วรรค) แล้ว — รอ Admin ตรวจสอบและอนุมัติ (+10 แต้มเมื่อผ่าน)`);
    setName(''); setText('- - - - | - - - - | - - - - | - - - -'); setNote('');
  }

  if (!user) return (
    <main className="container" style={{maxWidth:'500px'}}>
      <div className="lock-box">
        <div style={{marginBottom:'1rem'}}>เข้าสู่ระบบเพื่อเพิ่มเพลงใหม่</div>
        <Link href="/login"><button className="btn btn-primary">เข้าสู่ระบบ / สมัคร</button></Link>
      </div>
    </main>
  );

  return (
    <main className="container" style={{maxWidth:'760px'}}>
      <Link href="/"><span style={{color:'var(--muted)',fontSize:'0.8rem'}}>← กลับรายการเพลง</span></Link>
      <div className="card" style={{marginTop:'1rem'}}>
        <div className="section-title" style={{fontSize:'1.1rem'}}>เพิ่มเพลงใหม่เข้าฐานข้อมูล</div>
        <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:'1.3rem'}}>
          กรอกโน้ตด้วยแป้นพิมพ์โน้ตด้านล่าง · 1 บรรทัด = 1 วรรค · Admin ตรวจสอบก่อนเผยแพร่ · เครดิตชื่อผู้เพิ่มแสดงในหน้าเพลง
        </div>

        <div className="form-group">
          <label className="form-label">ชื่อเพลง *</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)}
            placeholder="เช่น จีนล่องหน่าย สองชั้น" />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
          <div className="form-group">
            <label className="form-label">ประเภทเพลง</label>
            <select className="form-input" value={songType} onChange={e => setSongType(e.target.value)}>
              <option>🟢 แปรทำนอง</option>
              <option>🟠 บังคับทาง</option>
              <option>🟡 กึ่งบังคับทาง</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">ทาง / เครื่องดนตรี</label>
            <select className="form-input" value={instrument} onChange={e => setInstrument(e.target.value)}>
              {['ทำนองหลัก','ระนาดเอก','ระนาดทุ้ม','ฆ้องวงเล็ก','ปี่ใน','ขลุ่ยเพียงออ','ซอด้วง','ซออู้','ซอสามสาย','จะเข้','ขิม'].map(i =>
                <option key={i}>{i}</option>)}
            </select>
          </div>
        </div>

        {/* ── แป้นพิมพ์โน้ต ── */}
        <div className="form-group">
          <label className="form-label">โน้ตเพลง (1 บรรทัด = 1 วรรค)</label>
          <div style={{background:'var(--navy3)',border:'1px solid var(--border)',borderRadius:'8px 8px 0 0',
            padding:'0.7rem',display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
            <div style={{display:'flex',gap:'4px'}}>
              {[[-1,'ต่ำ ฺ'],[0,'กลาง'],[1,'สูง ํ']].map(([r, lbl]) => (
                <button key={r} onClick={() => setRegister(r)} className="btn btn-sm"
                  style={{background: register === r ? 'var(--gold)' : 'var(--navy2)',
                    color: register === r ? 'var(--navy)' : 'var(--muted)',
                    border:'1px solid var(--border)',fontSize:'0.72rem'}}>
                  {lbl}
                </button>
              ))}
            </div>
            <div style={{width:'1px',height:'22px',background:'var(--border)'}} />
            {NOTES.map(n => (
              <button key={n} onClick={() => insertNote(n)} className="btn btn-sm"
                style={{background:'var(--navy2)',color:'var(--cream)',border:'1px solid var(--border)',
                  fontSize:'1rem',minWidth:'38px',fontWeight:600}}>
                {n}{register === -1 ? LOW : register === 1 ? HIGH : ''}
              </button>
            ))}
            <div style={{width:'1px',height:'22px',background:'var(--border)'}} />
            <button onClick={() => insert('-')} className="btn btn-sm"
              style={{background:'var(--navy2)',color:'var(--muted)',border:'1px solid var(--border)',minWidth:'34px'}}>–</button>
            <button onClick={() => insert(' ')} className="btn btn-sm"
              style={{background:'var(--navy2)',color:'var(--muted)',border:'1px solid var(--border)',fontSize:'0.72rem'}}>เว้นวรรค</button>
            <button onClick={() => insert(' | ')} className="btn btn-sm"
              style={{background:'var(--navy2)',color:'var(--muted)',border:'1px solid var(--border)',fontSize:'0.72rem'}}>| กั้นห้อง</button>
          </div>
          <textarea ref={taRef} className="form-input" rows="8" value={text}
            onChange={e => setText(e.target.value)}
            style={{resize:'vertical',fontFamily:'monospace',fontSize:'0.9rem',borderRadius:'0 0 8px 8px',borderTop:'none'}} />
          <div style={{display:'flex',gap:'8px',marginTop:'0.5rem',flexWrap:'wrap'}}>
            <button className="btn btn-outline btn-sm" onClick={addVerseLine}>＋ เพิ่มวรรค 4 ห้อง</button>
            <button className="btn btn-outline btn-sm" onClick={addShortVerseLine}>＋ เพิ่มวรรค 2 ห้อง</button>
          </div>
          <div style={{fontSize:'0.7rem',color:'var(--muted)',marginTop:'0.5rem',lineHeight:1.7}}>
            💡 วิธีใช้: คลิกตำแหน่งที่ต้องการในช่องโน้ต → กดปุ่มโน้ตด้านบน · เลือก ต่ำ/กลาง/สูง ก่อนกดโน้ต ·
            สะบัดพิมพ์โน้ตติดกันไม่เว้นวรรค (รม) · 1 ห้อง = 4 ตำแหน่ง
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">หมายเหตุถึง Admin (ที่มาโน้ต สำนัก ฯลฯ)</label>
          <input className="form-input" value={note} onChange={e => setNote(e.target.value)}
            placeholder="เช่น ถอดจากโน้ตครูสำนัก..." />
        </div>
        <button className="btn btn-jade" style={{width:'100%',justifyContent:'center'}} onClick={submit}>
          ✓ ส่งเพลง — รอ Admin ตรวจสอบ
        </button>
        {msg && <div style={{marginTop:'0.8rem',fontSize:'0.82rem',color:'var(--jade)'}}>{msg}</div>}
      </div>
    </main>
  );
}
