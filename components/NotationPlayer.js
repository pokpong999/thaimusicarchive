'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
const StaffNotation = dynamic(() => import('./StaffNotation'), { ssr: false });

// ── 7-TET Thai tuning ──
// ด ร ม ฟ ซ ล ท = step 0..6, octave = 7 steps, ratio per step = 2^(1/7)
const NOTE_STEP = { 'ด':0, 'ร':1, 'ม':2, 'ฟ':3, 'ซ':4, 'ล':5, 'ท':6 };
const BASE_FREQ = 261.63; // ด กลาง
const LOW_MARK = '\u0E3A';   // พินทุ (จุดล่าง) = เสียงต่ำ
const HIGH_MARK = '\u0E4D';  // นิคหิต (วงกลมบน) = เสียงสูง

function noteFreq(ch, register) {
  const step = NOTE_STEP[ch];
  if (step == null) return null;
  const totalStep = step + register * 7;
  return BASE_FREQ * Math.pow(2, totalStep / 7);
}

// แปลง token เช่น "ล" "ทฺ" "ซํ" "รม" → [{ch, register}]
function parseToken(token) {
  const notes = [];
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (NOTE_STEP[ch] != null) {
      let register = 0;
      if (token[i+1] === LOW_MARK) { register = -1; i++; }
      else if (token[i+1] === HIGH_MARK) { register = 1; i++; }
      notes.push({ ch, register });
    }
  }
  return notes;
}

// แปลงสตริงวรรค "- - - ล | - - ด รม | ..." → array 16 ช่อง (แต่ละช่อง = array of notes)
export function parseVerse(str) {
  if (!str) return Array(16).fill([]);
  const positions = [];
  const hongs = str.split('|');
  for (const hong of hongs) {
    const tokens = hong.trim().split(/\s+/).filter(t => t.length > 0);
    for (const t of tokens) {
      positions.push(t === '-' ? [] : parseToken(t));
    }
  }
  while (positions.length < 16) positions.push([]);
  return positions.slice(0, 16);
}

// ── เสียงฆ้อง/ระนาดสังเคราะห์ ──
function playNote(ctx, freq, time, dur, gain = 0.5) {
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine'; osc.frequency.value = freq;
  osc2.type = 'sine'; osc2.frequency.value = freq * 3.02; // harmonic แบบโลหะ
  const g2 = ctx.createGain(); g2.gain.value = 0.18;
  osc.connect(g); osc2.connect(g2); g2.connect(g);
  g.connect(ctx.destination);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.start(time); osc.stop(time + dur + 0.05);
  osc2.start(time); osc2.stop(time + dur + 0.05);
}

const REG_LABEL = { '-1': 'ต่ำ', '0': 'กลาง', '1': 'สูง' };

export default function NotationPlayer({ verses, lyrics }) {
  // verses: [{verse_no, section, right_hand, left_hand, combined, luktok}]
  const [mode, setMode] = useState('combined'); // combined | hands | khim | vocal
  const [hand, setHand] = useState('both');     // both | R | L (สำหรับเล่นเสียง)
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(null);   // {verseIdx, pos}
  const ctxRef = useRef(null);
  const stopRef = useRef(false);

  useEffect(() => () => { stopRef.current = true; }, []);

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctxRef.current;
  }

  async function play() {
    if (playing) { stopRef.current = true; setPlaying(false); setCursor(null); return; }
    const ctx = getCtx();
    await ctx.resume();
    stopRef.current = false;
    setPlaying(true);

    const stepDur = 60 / bpm / 2; // 1 ตำแหน่ง = ครึ่งจังหวะ
    let t = ctx.currentTime + 0.1;
    const schedule = [];

    verses.forEach((v, vi) => {
      const rh = parseVerse(v.right_hand);
      const lh = parseVerse(v.left_hand);
      const cb = parseVerse(v.combined);
      for (let p = 0; p < 16; p++) {
        const notesToPlay = [];
        if (hand === 'both' || mode === 'combined') {
          if (hand === 'R') notesToPlay.push(...rh[p]);
          else if (hand === 'L') notesToPlay.push(...lh[p]);
          else { notesToPlay.push(...rh[p], ...lh[p]); }
        } else if (hand === 'R') notesToPlay.push(...rh[p]);
        else if (hand === 'L') notesToPlay.push(...lh[p]);
        schedule.push({ time: t, verseIdx: vi, pos: p, notes: notesToPlay });
        // สะบัด: หลายโน้ตในช่องเดียว เล่นรัวแบ่งเวลากัน
        notesToPlay.forEach((n, ni) => {
          const f = noteFreq(n.ch, n.register);
          if (f) {
            const sub = notesToPlay.length > 1 ? stepDur / notesToPlay.length : 0;
            playNote(ctx, f, t + ni * sub, stepDur * 2.2, 0.45);
          }
        });
        t += stepDur;
      }
    });

    // cursor animation
    for (const s of schedule) {
      const wait = (s.time - ctx.currentTime) * 1000;
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      if (stopRef.current) break;
      setCursor({ verseIdx: s.verseIdx, pos: s.pos });
    }
    setPlaying(false);
    setCursor(null);
  }

  function renderCell(notes, active) {
    return (
      <span style={{
        display:'inline-block', minWidth:'26px', textAlign:'center',
        padding:'2px 1px', borderRadius:'3px', fontSize:'0.92rem',
        background: active ? 'rgba(201,168,76,0.35)' : 'transparent',
        color: notes.length ? 'var(--cream)' : 'var(--border)',
        transition: 'background 0.1s',
      }}>
        {notes.length ? notes.map(n =>
          n.ch + (n.register === -1 ? LOW_MARK : n.register === 1 ? HIGH_MARK : '')
        ).join('') : '–'}
      </span>
    );
  }

  function renderLine(parsedPositions, vi, label) {
    return (
      <div style={{display:'flex',alignItems:'center',gap:'6px',fontFamily:"'Noto Sans Thai',monospace"}}>
        {label && <span style={{fontSize:'0.65rem',color:'var(--muted)',width:'26px',textAlign:'right',flexShrink:0}}>{label}</span>}
        <div style={{display:'flex',flexWrap:'nowrap'}}>
          {parsedPositions.map((notes, p) => (
            <span key={p} style={{display:'flex'}}>
              {p > 0 && p % 4 === 0 && <span style={{color:'var(--border)',margin:'0 3px'}}>|</span>}
              {renderCell(notes, cursor && cursor.verseIdx === vi && cursor.pos === p)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  function renderKhim(v, vi) {
    // 3 บรรทัดแบบขิม: สูง / กลาง / ต่ำ จากทำนองรวม
    const cb = parseVerse(v.combined);
    const rows = { '1': [], '0': [], '-1': [] };
    cb.forEach(notes => {
      ['1','0','-1'].forEach(reg => {
        rows[reg].push(notes.filter(n => String(n.register) === reg));
      });
    });
    return ['1','0','-1'].map(reg => (
      <div key={reg}>{renderLine(rows[reg], vi, REG_LABEL[reg])}</div>
    ));
  }

  if (!verses || verses.length === 0) {
    return <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ยังไม่มีข้อมูลโน้ตสำหรับเพลงนี้</div>;
  }

  return (
    <div>
      {/* controls */}
      <div style={{display:'flex',gap:'10px',flexWrap:'wrap',alignItems:'center',marginBottom:'1rem'}}>
        <button className="btn btn-jade" onClick={play}>
          {playing ? '■ หยุด' : '▶ เล่นโน้ต'}
        </button>
        <select className="filter-select" value={mode} onChange={e => setMode(e.target.value)}>
          <option value="combined">บรรทัดเดียว (ทำนองรวม)</option>
          <option value="hands">สองบรรทัด (แยกมือ R/L)</option>
          <option value="khim">สามบรรทัด (แบบขิม)</option>
          <option value="vocal">โน้ตขับร้อง (มีเนื้อ)</option>
          <option value="staff">โน้ตสากล 5 เส้น</option>
        </select>
        <select className="filter-select" value={hand} onChange={e => setHand(e.target.value)}>
          <option value="both">🔊 เล่นทั้งสองมือ</option>
          <option value="R">🔊 มือขวาอย่างเดียว</option>
          <option value="L">🔊 มือซ้ายอย่างเดียว</option>
        </select>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'0.75rem',color:'var(--muted)'}}>
          ช้า <input type="range" min="50" max="220" value={bpm} onChange={e => setBpm(+e.target.value)}
            style={{accentColor:'var(--gold)'}} /> เร็ว
          <span style={{fontFamily:'monospace'}}>{bpm}</span>
        </div>
        <span style={{fontSize:'0.68rem',color:'var(--jade)'}}>♪ ระบบเสียง 7 เท่าไทย (7-TET)</span>
      </div>

      {/* notation */}
      {mode === 'staff' ? <StaffNotation verses={verses} /> :
      <div style={{background:'var(--navy3)',border:'1px solid var(--border)',borderRadius:'8px',
        padding:'1rem',overflowX:'auto',display:'flex',flexDirection:'column',gap:'0.7rem'}}>
        {verses.map((v, vi) => (
          <div key={vi} style={{paddingBottom:'0.5rem',
            borderBottom: vi < verses.length-1 ? '1px dashed rgba(42,63,92,0.6)' : 'none'}}>
            <div style={{fontSize:'0.62rem',color:'var(--muted)',marginBottom:'3px'}}>
              วรรค {v.verse_no}{v.section ? ` · ${v.section}` : ''}{v.luktok ? ` · ลูกตก: ${v.luktok}` : ''}
            </div>
            {mode === 'combined' && renderLine(parseVerse(v.combined), vi, null)}
            {mode === 'hands' && <>
              {renderLine(parseVerse(v.right_hand), vi, 'R')}
              {renderLine(parseVerse(v.left_hand), vi, 'L')}
            </>}
            {mode === 'khim' && renderKhim(v, vi)}
            {mode === 'vocal' && renderLine(parseVerse(v.combined), vi, '♪')}
          </div>
        ))}
        {mode === 'vocal' && (
          <div style={{marginTop:'0.5rem',padding:'0.8rem',background:'var(--navy2)',borderRadius:'6px'}}>
            <div style={{fontSize:'0.68rem',color:'var(--muted)',marginBottom:'4px'}}>เนื้อร้อง</div>
            <div style={{fontSize:'0.9rem',lineHeight:2,whiteSpace:'pre-wrap'}}>
              {lyrics || <span style={{color:'var(--muted)'}}>ยังไม่มีเนื้อร้อง — Admin เพิ่มได้ในหน้าแก้ไข</span>}
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}
