'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { loadGongSamples, playSampleNote, samplesAvailable } from '../lib/sampler';
const StaffNotation = dynamic(() => import('./StaffNotation'), { ssr: false });

// ── 7-TET Thai tuning (สำหรับเสียงสังเคราะห์ fallback) ──
const NOTE_STEP = { 'ด':0, 'ร':1, 'ม':2, 'ฟ':3, 'ซ':4, 'ล':5, 'ท':6 };
const BASE_FREQ = 261.63;
const LOW_MARK = '\u0E3A';
const HIGH_MARK = '\u0E4D';

function noteFreq(ch, register) {
  const step = NOTE_STEP[ch];
  if (step == null) return null;
  return BASE_FREQ * Math.pow(2, (step + register * 7) / 7);
}

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

export function parseVerse(str) {
  if (!str) return Array(16).fill([]);
  const positions = [];
  const hongs = str.split('|');
  for (const hong of hongs) {
    const tokens = hong.trim().split(/\s+/).filter(t => t.length > 0);
    for (const t of tokens) positions.push(t === '-' ? [] : parseToken(t));
  }
  while (positions.length < 16) positions.push([]);
  return positions.slice(0, 16);
}

function synthNote(ctx, freq, time, dur, gain = 0.45) {
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine'; osc.frequency.value = freq;
  osc2.type = 'sine'; osc2.frequency.value = freq * 3.02;
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
  const [mode, setMode] = useState('combined');
  const [hand, setHand] = useState('both');
  const [sound, setSound] = useState('real');   // real | synth
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [sampleCount, setSampleCount] = useState(null);
  const [cursor, setCursor] = useState(null);
  const ctxRef = useRef(null);
  const buffersRef = useRef(null);
  const rafRef = useRef(null);
  const playIdRef = useRef(0);

  useEffect(() => () => {
    playIdRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) ctxRef.current.close().catch(() => {});
  }, []);

  function getCtx() {
    if (!ctxRef.current || ctxRef.current.state === 'closed')
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctxRef.current;
  }

  async function play() {
    if (playing) { stop(); return; }
    const ctx = getCtx();
    await ctx.resume();

    // โหลด sample จริง (ครั้งแรกเท่านั้น)
    let buffers = buffersRef.current;
    if (sound === 'real' && !buffers) {
      setLoadingSamples(true);
      buffers = await loadGongSamples(ctx);
      buffersRef.current = buffers;
      setSampleCount(Object.keys(buffers).length);
      setLoadingSamples(false);
    }
    const useReal = sound === 'real' && samplesAvailable(buffers);

    const myId = ++playIdRef.current;
    setPlaying(true);

    // ═══ SCHEDULE ทุกโน้ตล่วงหน้าบน audio clock — จังหวะแม่นระดับ sample ═══
    const stepDur = 60 / bpm / 2;
    const t0 = ctx.currentTime + 0.15;
    const cursorTimeline = [];

    verses.forEach((v, vi) => {
      const rh = parseVerse(v.right_hand);
      const lh = parseVerse(v.left_hand);
      const cb = parseVerse(v.combined);
      const useHands = v.right_hand || v.left_hand;

      for (let p = 0; p < 16; p++) {
        const t = t0 + (vi * 16 + p) * stepDur;
        cursorTimeline.push({ time: t, verseIdx: vi, pos: p });

        let notesToPlay = [];
        if (!useHands) notesToPlay = cb[p];
        else if (hand === 'R') notesToPlay = rh[p];
        else if (hand === 'L') notesToPlay = lh[p];
        else notesToPlay = [...rh[p], ...lh[p]];

        const sub = notesToPlay.length > 1 ? stepDur / notesToPlay.length : 0;
        notesToPlay.forEach((n, ni) => {
          const noteTime = t + ni * sub;
          let played = false;
          if (useReal) played = playSampleNote(ctx, buffers, n.ch, n.register, noteTime, 0.85);
          if (!played) {
            const f = noteFreq(n.ch, n.register);
            if (f) synthNote(ctx, f, noteTime, stepDur * 2.2);
          }
        });
      }
    });

    // ═══ CURSOR: requestAnimationFrame เทียบกับ audio clock — ไม่หลุดจังหวะ ═══
    const endTime = t0 + verses.length * 16 * stepDur;
    let idx = 0;
    function tick() {
      if (playIdRef.current !== myId) return;
      const now = ctx.currentTime;
      while (idx < cursorTimeline.length && cursorTimeline[idx].time <= now) {
        setCursor({ verseIdx: cursorTimeline[idx].verseIdx, pos: cursorTimeline[idx].pos });
        idx++;
      }
      if (now < endTime) rafRef.current = requestAnimationFrame(tick);
      else { setPlaying(false); setCursor(null); }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function stop() {
    playIdRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    buffersRef.current = buffersRef.current; // buffers ใช้ซ้ำได้หลัง ctx ใหม่? — ไม่ได้ ต้อง decode ใหม่
    buffersRef.current = null;
    setPlaying(false); setCursor(null);
  }

  function renderCell(notes, active) {
    return (
      <span style={{
        display:'inline-block', minWidth:'26px', textAlign:'center',
        padding:'2px 1px', borderRadius:'3px', fontSize:'0.92rem',
        background: active ? 'rgba(201,168,76,0.4)' : 'transparent',
        color: notes.length ? 'var(--cream)' : 'var(--border)',
      }}>
        {notes.length ? notes.map(n =>
          n.ch + (n.register === -1 ? LOW_MARK : n.register === 1 ? HIGH_MARK : '')
        ).join('') : '–'}
      </span>
    );
  }

  function renderLine(parsedPositions, vi, label) {
    return (
      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
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
    const cb = parseVerse(v.combined);
    const rows = { '1': [], '0': [], '-1': [] };
    cb.forEach(notes => {
      ['1','0','-1'].forEach(reg => rows[reg].push(notes.filter(n => String(n.register) === reg)));
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
      <div style={{display:'flex',gap:'10px',flexWrap:'wrap',alignItems:'center',marginBottom:'1rem'}}>
        <button className="btn btn-jade" onClick={play} disabled={loadingSamples}>
          {loadingSamples ? '⏳ โหลดเสียง...' : playing ? '■ หยุด' : '▶ เล่นโน้ต'}
        </button>
        <select className="filter-select" value={sound} onChange={e => setSound(e.target.value)}>
          <option value="real">🎵 เสียงฆ้องวงใหญ่จริง</option>
          <option value="synth">〰 เสียงสังเคราะห์</option>
        </select>
        <select className="filter-select" value={mode} onChange={e => setMode(e.target.value)}>
          <option value="combined">บรรทัดเดียว (ทำนองรวม)</option>
          <option value="hands">สองบรรทัด (แยกมือ R/L)</option>
          <option value="khim">สามบรรทัด (แบบขิม)</option>
          <option value="vocal">โน้ตขับร้อง (มีเนื้อ)</option>
          <option value="staff">โน้ตสากล 5 เส้น</option>
        </select>
        <select className="filter-select" value={hand} onChange={e => setHand(e.target.value)}>
          <option value="both">🔊 ทั้งสองมือ</option>
          <option value="R">🔊 มือขวา</option>
          <option value="L">🔊 มือซ้าย</option>
        </select>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'0.75rem',color:'var(--muted)'}}>
          ช้า <input type="range" min="50" max="220" value={bpm} onChange={e => setBpm(+e.target.value)}
            style={{accentColor:'var(--gold)'}} disabled={playing} /> เร็ว
          <span style={{fontFamily:'monospace'}}>{bpm}</span>
        </div>
        {sampleCount != null && sound === 'real' && (
          <span style={{fontSize:'0.68rem',color: sampleCount > 0 ? 'var(--jade)' : 'var(--danger)'}}>
            {sampleCount > 0 ? `♪ เสียงจริง ${sampleCount}/16 ลูก` : '⚠ ยังไม่มีไฟล์เสียง — ใช้เสียงสังเคราะห์แทน'}
          </span>
        )}
      </div>

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
              {lyrics || <span style={{color:'var(--muted)'}}>ยังไม่มีเนื้อร้อง</span>}
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}
