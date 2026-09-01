'use client';
// components/NotationPad.js — แป้นพิมพ์โน้ตสำหรับมือถือ  (Pk 28 ส.ค. 69)
//
//   "ช่วยออกแบบการพิมพ์โน้ตในโทรศัพท์ให้ด้วย ให้ครอบคลุมทุกฟังชั่นที่เราออกแบบไว้
//    เช่น สะบัด กรอ แก้ไข ลบ ต่าง ๆ พร้อมอธิบายวิธีใช้ด้วย"
//
//   ★ แป้นนี้ไม่ได้เขียนตรรกะโน้ตขึ้นใหม่เลยสักบรรทัด
//     ทุกปุ่มเรียกคำสั่งเดียวกับที่แป้นพิมพ์บนคอมพิวเตอร์เรียก (lib/notation-engine.js)
//     สิ่งที่พิมพ์บนมือถือกับบนคอมจึงออกมาเหมือนกันเป๊ะ ไม่มีทางเพี้ยนกัน
//
//   วางไว้ล่างจอเพราะนิ้วโป้งเอื้อมถึง · กระดานโน้ตเลื่อนขึ้นไปอยู่เหนือแป้น
import { useEffect, useState } from 'react';

const NOTES = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'];
const REG = [[-1, 'ต่ำ'], [0, 'กลาง'], [1, 'สูง']];

export default function NotationPad({ eng, open, onClose, tick = 0 }) {
  const [reg, setReg] = useState(0);
  const [sabat, setSabat] = useState(false);   // ติดค้าง: ตัวถัดไปจะไปรวมกับตัวก่อนในช่องเดียว
  const [help, setHelp] = useState(false);
  const [at, setAt] = useState('');

  // ตำแหน่งเคอร์เซอร์ปัจจุบัน — ให้คนพิมพ์รู้ว่ากำลังลงตรงไหน
  useEffect(() => {
    if (!eng || !open) return;
    try {
      const S = eng.S, v = S.verses[S.caret.v];
      const nH = eng.nH();
      const hand = nH > 1 ? (S.caret.hand === 'r' ? ' · มือขวา' : S.caret.hand === 'l' ? ' · มือซ้าย' : ' · แนวที่ 3') : '';
      setAt(`ว.${S.caret.v + 1} · ห้อง ${Math.floor(S.caret.p / 4) + 1}/${v ? v.cells.length / 4 : 1} · ตำแหน่ง ${S.caret.p % 4 + 1}${hand}`);
    } catch (e) { setAt(''); }
  }, [eng, open, tick]);

  if (!open) return null;

  const call = (fn, ...a) => {
    if (!eng) return;
    try { fn.apply(eng, a); } catch (e) {}
  };
  const note = i => {
    if (!eng) return;
    // ★ สะบัด = โน้ตสองตัวในช่องเดียว จึงต้องคาปุ่มไว้จนกว่าจะครบคู่
    //   (ถ้าปลดตั้งแต่ตัวแรก ตัวที่สองจะไปทับตัวแรกแทนที่จะรวมกัน)
    let cell = null, hk = 'r';
    try { cell = eng.curCell(); hk = eng.handKey(); } catch (e) {}
    call(eng.typeNote, i, reg, sabat, null);
    if (sabat && cell && (cell[hk] || []).length >= 2) setSabat(false);   // ครบคู่แล้วปลดเอง
  };
  // ล้างโน้ตในช่องที่เคอร์เซอร์อยู่ โดยไม่ขยับเคอร์เซอร์
  const clearCell = () => {
    if (!eng) return;
    eng.pushUndo(); eng.clearCurCell(); eng.touchCaretRow(); eng.emit();
  };
  const move = d => {
    if (!eng) return;
    const S = eng.S, v = S.verses[S.caret.v];
    let { v: vi, p } = S.caret;
    p += d;
    if (p < 0) { if (vi > 0) { vi--; p = S.verses[vi].cells.length - 1; } else p = 0; }
    else if (p >= v.cells.length) { if (vi < S.verses.length - 1) { vi++; p = 0; } else p = v.cells.length - 1; }
    eng.setCaret({ ...S.caret, v: vi, p });
    eng.emit();
  };
  const hand = () => {
    if (!eng || eng.nH() < 2) return;
    const order = ['r', 'l', 'x'].slice(0, eng.nH());
    const i = order.indexOf(eng.S.caret.hand ?? 'r');
    eng.setCaret({ ...eng.S.caret, hand: order[(i + 1) % order.length] });
    eng.emit();
  };

  const K = { border: '1px solid var(--border)', background: 'var(--navy2)', color: 'var(--cream)',
    borderRadius: '10px', fontFamily: 'inherit', cursor: 'pointer', minHeight: '46px', fontSize: '0.86rem' };
  const on = { borderColor: 'var(--gold)', color: 'var(--gold)', background: 'rgba(201,168,76,0.14)' };

  return (
    <>
      <div data-notepad style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 300,
        background: 'var(--navy)', borderTop: '1px solid var(--gold)',
        padding: '6px 8px calc(6px + env(safe-area-inset-bottom))',
        boxShadow: '0 -6px 20px rgba(0,0,0,0.45)',
      }}>
        {/* ── แถบบอกตำแหน่ง ── */}
        <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'5px'}}>
          <span data-padat style={{fontSize:'0.72rem',color:'var(--gold2)',fontFamily:'monospace',
            flex:1,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{at}</span>
          {eng && eng.nH() > 1 && (
            <button type="button" style={{...K, padding:'0 10px', minHeight:'32px', fontSize:'0.74rem'}}
              onClick={hand} data-padhand>⇅ สลับแนว</button>
          )}
          <button type="button" style={{...K, padding:'0 10px', minHeight:'32px', fontSize:'0.74rem'}}
            onClick={() => setHelp(true)} data-padhelp>? วิธีใช้</button>
          <button type="button" style={{...K, padding:'0 10px', minHeight:'32px', fontSize:'0.74rem'}}
            onClick={onClose} data-padclose>✕ ปิดแป้น</button>
        </div>

        {/* ── ระดับเสียง ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'4px',marginBottom:'4px'}} data-padreg>
          {REG.map(([r, label]) => (
            <button key={r} type="button" onClick={() => setReg(r)}
              style={{...K, minHeight:'36px', fontSize:'0.78rem', ...(reg === r ? on : {})}}
              data-reg={r} aria-pressed={reg === r}>
              {label}{r === 1 ? ' ํ' : r === -1 ? ' ฺ' : ''}
            </button>
          ))}
        </div>

        {/* ── ตัวโน้ต ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:'4px',marginBottom:'4px'}} data-padnotes>
          {NOTES.map((n, i) => (
            <button key={n} type="button" onClick={() => note(i)} data-note={n}
              style={{...K, minHeight:'52px', fontSize:'1.25rem', fontWeight:600,
                fontFamily:"'Noto Serif Thai', serif"}}>
              {n}{reg === 1 ? 'ํ' : reg === -1 ? 'ฺ' : ''}
            </button>
          ))}
          <button type="button" onClick={() => call(eng.skip)} data-padskip
            style={{...K, minHeight:'52px', fontSize:'1.1rem'}} title="เว้นช่องนี้ว่าง แล้วไปช่องถัดไป">–</button>
        </div>

        {/* ── เครื่องมือ ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'4px',marginBottom:'4px'}} data-padtools>
          <button type="button" onClick={() => setSabat(s => !s)} data-padsabat aria-pressed={sabat}
            style={{...K, ...(sabat ? on : {})}} title="ใส่โน้ตสองตัวในช่องเดียว">⚡ สะบัด</button>
          <button type="button" onClick={() => call(eng.toggleMark, 'kro')} data-padkro
            style={K} title="กรอ — ตีสลับสองมือให้เสียงยาว">〰 กรอ</button>
          <button type="button" onClick={() => call(eng.toggleMark, 'damp')} data-paddamp
            style={K} title="ประคบ — เสียงสั้น ไม่กังวานทับตัวถัดไป">● ประคบ</button>
          <button type="button" onClick={() => call(eng.undo)} data-padundo style={K}>↩ ย้อนกลับ</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'4px',marginBottom:'4px'}} data-padedit>
          <button type="button" onClick={() => move(-1)} data-padprev style={K}>‹ ถอย</button>
          <button type="button" onClick={() => move(1)} data-padnext style={K}>เดิน ›</button>
          <button type="button" onClick={clearCell} data-padclear style={K} title="ล้างโน้ตในช่องนี้ ช่องยังอยู่">⌧ ล้างช่อง</button>
          <button type="button" onClick={() => call(eng.backspace)} data-padback style={K}
            title="ลบช่องก่อนหน้าแล้วถอยไป">⌫ ลบย้อน</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'4px'}} data-padbars>
          <button type="button" onClick={() => call(eng.resizeVerse, 1)} data-padaddbar
            style={{...K, minHeight:'40px', fontSize:'0.8rem'}} title="วรรคนี้ยาวขึ้น 1 ห้อง">⊕ เพิ่มห้อง</button>
          <button type="button" onClick={() => call(eng.resizeVerse, -1)} data-paddelbar
            style={{...K, minHeight:'40px', fontSize:'0.8rem'}} title="วรรคนี้สั้นลง 1 ห้อง">⊖ ลดห้อง</button>
          <button type="button" onClick={() => call(eng.newLineAfterCaret)} data-padnewline
            style={{...K, minHeight:'40px', fontSize:'0.8rem'}} title="ขึ้นบรรทัดใหม่ตรงนี้">↵ ขึ้นบรรทัด</button>
        </div>
      </div>

      {help && <PadHelp onClose={() => setHelp(false)} />}
    </>
  );
}

// ── วิธีใช้ ────────────────────────────────────────────────────────
function PadHelp({ onClose }) {
  const row = (a, b) => (
    <div style={{display:'grid',gridTemplateColumns:'92px 1fr',gap:'10px',padding:'7px 0',
      borderBottom:'1px solid rgba(42,63,92,0.5)',fontSize:'0.84rem',lineHeight:1.7}}>
      <b style={{color:'var(--gold2)'}}>{a}</b><span>{b}</span>
    </div>
  );
  return (
    <div data-padhelpsheet onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:400, background:'rgba(4,10,20,0.82)',
      display:'flex', alignItems:'flex-end', justifyContent:'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'var(--navy2)', borderTop:'2px solid var(--gold)', borderRadius:'14px 14px 0 0',
        width:'100%', maxWidth:'560px', maxHeight:'86vh', overflowY:'auto',
        padding:'1rem 1.1rem calc(1.2rem + env(safe-area-inset-bottom))',
      }}>
        <div style={{display:'flex',alignItems:'center',marginBottom:'0.7rem'}}>
          <div style={{fontWeight:700,fontSize:'1.05rem',flex:1}}>วิธีพิมพ์โน้ตบนมือถือ</div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>ปิด</button>
        </div>

        <div style={{fontSize:'0.84rem',color:'var(--muted)',lineHeight:1.9,marginBottom:'0.8rem'}}>
          <b style={{color:'var(--cream)'}}>เริ่มยังไง</b> — แตะ<b>ช่องบนกระดาน</b>ที่อยากลงโน้ต
          ช่องนั้นจะมีกรอบเรืองขึ้นมา แล้วกดตัวโน้ตที่แป้นล่าง
          เคอร์เซอร์เดินไปช่องถัดไปให้เอง พิมพ์ต่อได้เรื่อย ๆ
        </div>

        {row('ด ร ม ฟ ซ ล ท', 'ลงโน้ตในช่องที่เคอร์เซอร์อยู่ แล้วเดินไปช่องถัดไป')}
        {row('ต่ำ / กลาง / สูง', 'เลือกก่อนกดตัวโน้ต · ค้างไว้จนกว่าจะเปลี่ยน — ตัวโน้ตบนแป้นจะโชว์จุดบน/ล่างให้ดูว่ากำลังอยู่ระดับไหน')}
        {row('–', 'เว้นช่องนี้ว่างไว้ แล้วเดินไปช่องถัดไป (ใช้ตอนต้องการเว้นจังหวะ)')}
        {row('⚡ สะบัด', 'กดปุ่มนี้ก่อน แล้วกดโน้ตสองตัวติดกัน ทั้งสองตัวจะไปอยู่ใน "ช่องเดียวกัน" = สะบัด · ครบสองตัวแล้วปุ่มปลดเอง')}
        {row('〰 กรอ', 'ใส่/เอาออกที่ช่องที่เคอร์เซอร์อยู่ · กดซ้ำเพื่อเอาออก หรือลบโน้ตในช่องจนหมด เครื่องหมายก็หายเอง')}
        {row('● ประคบ', 'เสียงสั้น ไม่กังวานทับตัวถัดไป · บนคอมใช้วิธีกดโน้ตค้าง บนมือถือกดปุ่มนี้แทน')}
        {row('⌧ ล้างช่อง', 'ลบโน้ตในช่องที่อยู่ ช่องยังคงอยู่ เคอร์เซอร์ไม่ขยับ')}
        {row('⌫ ลบย้อน', 'ถอยไปช่องก่อนหน้าแล้วลบโน้ตในช่องนั้น (เหมือนปุ่ม Backspace)')}
        {row('‹ ถอย / เดิน ›', 'เลื่อนเคอร์เซอร์ทีละช่อง ข้ามวรรคได้ · หรือแตะช่องที่ต้องการบนกระดานตรง ๆ ก็ได้')}
        {row('⇅ สลับแนว', 'เพลงที่บันทึกสองมือ ใช้สลับระหว่างมือขวา/มือซ้าย (โผล่เฉพาะเพลงสองแนวขึ้นไป)')}
        {row('⊕ เพิ่มห้อง\n⊖ ลดห้อง', 'ทำให้วรรคที่อยู่ยาวขึ้นหรือสั้นลง 1 ห้อง — ใช้ตอนวรรคนั้นมีไม่ครบ 4 ห้อง')}
        {row('↵ ขึ้นบรรทัด', 'บังคับให้ขึ้นบรรทัดใหม่ตรงตำแหน่งนี้ · หน้าเพลงจะแสดงตามที่จัดไว้นี้')}
        {row('↩ ย้อนกลับ', 'ยกเลิกสิ่งที่เพิ่งทำ กดซ้ำได้หลายครั้ง')}

        <div style={{fontSize:'0.82rem',color:'var(--muted)',lineHeight:1.9,marginTop:'0.9rem'}}>
          <b style={{color:'var(--cream)'}}>ที่ควรรู้</b><br />
          · แป้นนี้เรียกคำสั่งชุดเดียวกับแป้นพิมพ์บนคอมพิวเตอร์ พิมพ์บนมือถือกับบนคอมได้ผลเหมือนกันเป๊ะ<br />
          · ระบบเก็บร่างให้อัตโนมัติ ปิดหน้าไปแล้วกลับมาพิมพ์ต่อได้<br />
          · <b style={{color:'var(--gold2)'}}>อย่าลืมกดบันทึก</b>เมื่อพิมพ์เสร็จ — ร่างที่ยังไม่บันทึกจะไม่ขึ้นให้คนอื่นเห็น<br />
          · แนวนอนของโทรศัพท์เห็นได้หลายห้องกว่า ถ้าโน้ตยาวลองหมุนจอดู
        </div>
      </div>
    </div>
  );
}
