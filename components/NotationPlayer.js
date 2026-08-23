'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { loadGongSamples, playSampleNote, samplesAvailable } from '../lib/sampler';
const StaffNotation = dynamic(() => import('./StaffNotation'), { ssr: false });

const NOTE_STEP = { 'ด':0, 'ร':1, 'ม':2, 'ฟ':3, 'ซ':4, 'ล':5, 'ท':6 };
const BASE_FREQ = 261.63;
const LOW_MARK = '\u0E3A';
const HIGH_MARK = '\u0E4D';
const SABAT_GAP = 0.045; // สะบัด: โน้ต 2-3 ตามติดโน้ตแรก 45ms คงที่ทุก tempo

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
  const [sound, setSound] = useState('real');
  const [bpm, setBpm] = useState(120);
  const [playState, setPlayState] = useState('stopped'); // stopped | playing | paused
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

  async function startFrom(startStep) {
    // ปิดรอบเก่า (buffers เก็บไว้ใช้ต่อ ไม่ต้องโหลดใหม่)
    playIdRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); }
    ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = ctxRef.current;
    await ctx.resume();

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
    setPlayState('playing');

    const stepDur = 60 / bpm / 2;
    const t0 = ctx.currentTime + 0.15;
    const totalSteps = verses.length * 16;
    const cursorTimeline = [];
    const startVerse = Math.floor(startStep / 16);

    function scheduleNote(n, noteTime) {
      let played = false;
      if (useReal) played = playSampleNote(ctx, buffers, n.ch, n.register, noteTime, 0.85);
      if (!played) {
        const f = noteFreq(n.ch, n.register);
        if (f) synthNote(ctx, f, noteTime, stepDur * 2.2);
      }
    }

    for (let vi = startVerse; vi < verses.length; vi++) {
      const v = verses[vi];
      const rh = parseVerse(v.right_hand);
      const lh = parseVerse(v.left_hand);
      const cb = parseVerse(v.combined);
      const useHands = v.right_hand || v.left_hand;
      const lines = !useHands ? [cb] : hand === 'R' ? [rh] : hand === 'L' ? [lh] : [rh, lh];
      const pStart = vi === startVerse ? startStep % 16 : 0;

      for (let p = pStart; p < 16; p++) {
        cursorTimeline.push({ time: t0 + (vi * 16 + p - startStep) * stepDur, verseIdx: vi, pos: p });
      }

      lines.forEach(line => {
        // หาเสียงเดี่ยวที่อยู่ติดหน้าช่องสะบัด — ถือเป็นเสียงที่ 1 ของสะบัด
        const consumed = new Array(16).fill(false);
        for (let p = pStart + 1; p < 16; p++) {
          if (line[p].length > 1 && line[p - 1].length === 1) consumed[p - 1] = true;
        }
        for (let p = pStart; p < 16; p++) {
          if (consumed[p]) continue; // ถูกดึงไปรวมกับสะบัดถัดไปแล้ว
          const t = t0 + (vi * 16 + p - startStep) * stepDur;
          if (line[p].length > 1) {
            // สะบัด: รวมเสียงนำ (ถ้ามี) + เสียงในช่อง → รัวช่องไฟเท่ากัน จบตรงจังหวะ
            const lead = (p > pStart && line[p - 1].length === 1) ? line[p - 1] : [];
            const run = [...lead, ...line[p]];
            run.forEach((n, ni) => scheduleNote(n, t - (run.length - 1 - ni) * SABAT_GAP));
          } else {
            line[p].forEach(n => scheduleNote(n, t));
          }
        }
      });
    }

        const endTime = t0 + (totalSteps - startStep) * stepDur;
    let idx = 0;
    function tick() {
      if (playIdRef.current !== myId) return;
      const now = ctx.currentTime;
      while (idx < cursorTimeline.length && cursorTimeline[idx].time <= now) {
        setCursor({ verseIdx: cursorTimeline[idx].verseIdx, pos: cursorTimeline[idx].pos });
        idx++;
      }
      if (now < endTime + 0.1) rafRef.current = requestAnimationFrame(tick);
      else { setPlayState('stopped'); setCursor(null); }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  async function togglePause() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (playState === 'playing') { await ctx.suspend(); setPlayState('paused'); }
    else if (playState === 'paused') { await ctx.resume(); setPlayState('playing'); }
  }

  function stop() {
    playIdRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    setPlayState('stopped'); setCursor(null);
  }

  // กดที่ห้อง → เล่นตั้งแต่ต้นห้องนั้น
  function seek(vi, p) {
    const hongStart = Math.floor(p / 4) * 4;
    startFrom(vi * 16 + hongStart);
  }

  function renderCell(notes, active, vi, p) {
    const isSabat = notes.length > 1;
    return (
      <span onClick={() => seek(vi, p)} title="กดเพื่อเล่นจากห้องนี้" style={{
        display:'inline-block', minWidth:'26px', textAlign:'center',
        padding:'2px 1px', borderRadius:'3px', fontSize:'0.92rem',
        cursor:'pointer', position:'relative',
        background: active ? 'rgba(201,168,76,0.4)' : 'transparent',
        color: notes.length ? 'var(--cream)' : 'var(--border)',
      }}>
        {isSabat && <span style={{
          position:'absolute', top:'-4px', left:'3px', right:'3px', height:'6px',
          borderTop:'1.5px solid var(--gold2)',
          borderRadius:'50% 50% 0 0',
          pointerEvents:'none',
        }} />}
        {notes.length ? notes.map(n =>
          n.ch + (n.register === -1 ? LOW_MARK : n.register === 1 ? HIGH_MARK : '')
        ).join('') : '–'}
      </span>
    );
  }

  function segCells(positions, vi) {
    return positions.map((notes, p) => (
      <span key={p} style={{display:'flex'}}>
        {p > 0 && p % 4 === 0 && <span style={{color:'var(--border)',margin:'0 3px'}}>|</span>}
        {renderCell(notes, cursor && cursor.verseIdx === vi && cursor.pos === p, vi, p)}
      </span>
    ));
  }

  function renderMulti(segs, label) {
    return (
      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
        {label && <span style={{fontSize:'0.65rem',color:'var(--muted)',width:'26px',textAlign:'right',flexShrink:0}}>{label}</span>}
        <div style={{display:'flex',flexWrap:'nowrap'}}>
          {segs.map((s, si) => (
            <span key={si} style={{display:'flex'}}>
              {si > 0 && <span style={{color:'var(--border)',margin:'0 3px'}}>|</span>}
              {segCells(s.positions, s.vi)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  function khimRow(v, reg) {
    return parseVerse(v.combined).map(notes => notes.filter(n => String(n.register) === reg));
  }

  if (!verses || verses.length === 0) {
    return <div style={{color:'var(--muted)',fontSize:'0.85rem'}}>ยังไม่มีข้อมูลโน้ตสำหรับเพลงนี้</div>;
  }

  return (
    <div>
      <div style={{display:'flex',gap:'10px',flexWrap:'wrap',alignItems:'center',marginBottom:'1rem'}}>
        {playState === 'stopped' && (
          <button className="btn btn-jade" onClick={() => startFrom(0)} disabled={loadingSamples}>
            {loadingSamples ? '⏳ โหลดเสียง...' : '▶ เล่นโน้ต'}
          </button>
        )}
        {playState !== 'stopped' && (
          <>
            <button className="btn btn-jade" onClick={togglePause}>
              {playState === 'playing' ? '⏸ พัก' : '▶ เล่นต่อ'}
            </button>
            <button className="btn btn-outline" onClick={stop}>■ หยุด</button>
          </>
        )}
        <select className="filter-select" value={sound} onChange={e => setSound(e.target.value)} disabled={playState !== 'stopped'}>
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
        <select className="filter-select" value={hand} onChange={e => setHand(e.target.value)} disabled={playState !== 'stopped'}>
          <option value="both">🔊 ทั้งสองมือ</option>
          <option value="R">🔊 มือขวา</option>
          <option value="L">🔊 มือซ้าย</option>
        </select>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'0.75rem',color:'var(--muted)'}}>
          ช้า <input type="range" min="50" max="220" value={bpm} onChange={e => setBpm(+e.target.value)}
            style={{accentColor:'var(--gold)'}} disabled={playState !== 'stopped'} /> เร็ว
          <span style={{fontFamily:'monospace'}}>{bpm}</span>
        </div>
        {sampleCount != null && sound === 'real' && (
          <span style={{fontSize:'0.68rem',color: sampleCount > 0 ? 'var(--jade)' : 'var(--danger)'}}>
            {sampleCount > 0 ? `♪ เสียงจริง ${sampleCount}/16 ลูก` : '⚠ ยังไม่มีไฟล์เสียง — ใช้เสียงสังเคราะห์แทน'}
          </span>
        )}
        <span style={{fontSize:'0.68rem',color:'var(--muted)'}}>💡 กดที่ห้องใดก็ได้เพื่อเล่นจากตรงนั้น</span>
      </div>

      {mode === 'staff' ? <StaffNotation verses={verses} /> :
      <div style={{background:'var(--navy3)',border:'1px solid var(--border)',borderRadius:'8px',
        padding:'1rem',overflowX:'auto',display:'flex',flexDirection:'column',gap:'0.7rem'}}>
        {Array.from({ length: Math.ceil(verses.length / 2) }, (_, pi) => {
          const pair = verses.slice(pi * 2, pi * 2 + 2);
          const idx0 = pi * 2;
          const label = pair.length === 2
            ? `วรรค ${pair[0].verse_no}–${pair[1].verse_no}`
            : `วรรค ${pair[0].verse_no}`;
          const luk = pair.map(v => v.luktok).filter(Boolean).join(' / ');
          const segs = f => pair.map((v, k) => ({ positions: parseVerse(f(v)), vi: idx0 + k }));
          return (
            <div key={pi} style={{paddingBottom:'0.5rem',
              borderBottom: pi < Math.ceil(verses.length/2)-1 ? '1px dashed rgba(42,63,92,0.6)' : 'none'}}>
              <div style={{fontSize:'0.62rem',color:'var(--muted)',marginBottom:'3px'}}>
                {label}{pair[0].section ? ` · ${pair[0].section}` : ''}{luk ? ` · ลูกตก: ${luk}` : ''}
              </div>
              {mode === 'combined' && renderMulti(segs(v => v.combined), null)}
              {mode === 'hands' && <>
                {renderMulti(segs(v => v.right_hand), 'R')}
                {renderMulti(segs(v => v.left_hand), 'L')}
              </>}
              {mode === 'khim' && ['1','0','-1'].map(reg =>
                <div key={reg}>{renderMulti(pair.map((v, k) => ({ positions: khimRow(v, reg), vi: idx0 + k })), REG_LABEL[reg])}</div>
              )}
              {mode === 'vocal' && renderMulti(segs(v => v.combined), '♪')}
            </div>
          );
        })}
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
