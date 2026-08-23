'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { loadGongSamples, playSampleNote, samplesAvailable } from '../lib/sampler';
const StaffNotation = dynamic(() => import('./StaffNotation'), { ssr: false });

const NOTE_STEP = { 'ด':0, 'ร':1, 'ม':2, 'ฟ':3, 'ซ':4, 'ล':5, 'ท':6 };
const BASE_FREQ = 261.63;
const LOW_MARK = '\u0E3A';
const HIGH_MARK = '\u0E4D';
const SABAT_GAP = 0.045; // ช่องไฟสะบัด (วินาที) — ปรับได้

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

// วรรคยาวตามจริง — ไม่บังคับ 4 ห้อง (รองรับ 1-2 ห้อง เช่นเพลงชั้นเดียว)
export function parseVerse(str) {
  if (!str) return [];
  const positions = [];
  const hongs = str.split('|');
  for (const hong of hongs) {
    const tokens = hong.trim().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) continue;
    const cells = tokens.map(t => t === '-' ? [] : parseToken(t));
    while (cells.length < 4) cells.push([]);
    positions.push(...cells.slice(0, 4));
  }
  return positions;
}

function padTo(arr, len) {
  const out = arr.slice();
  while (out.length < len) out.push([]);
  return out;
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
  const [hongsPerLine, setHongsPerLine] = useState(8);
  const [playState, setPlayState] = useState('stopped');
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [sampleCount, setSampleCount] = useState(null);
  const [cursor, setCursor] = useState(null);
  const ctxRef = useRef(null);
  const buffersRef = useRef(null);
  const rafRef = useRef(null);
  const playIdRef = useRef(0);

  // ── แปลงโน้ตทุกวรรคครั้งเดียว: ความยาวจริงต่อวรรค + offset สะสม ──
  const parsed = useMemo(() => {
    let offset = 0;
    return (verses ?? []).map(v => {
      const cb = parseVerse(v.combined);
      const rh = parseVerse(v.right_hand);
      const lh = parseVerse(v.left_hand);
      const len = Math.max(cb.length, rh.length, lh.length, 4);
      const item = {
        v, len, offset,
        cb: padTo(cb, len), rh: padTo(rh, len), lh: padTo(lh, len),
        useHands: !!(v.right_hand || v.left_hand),
      };
      offset += len;
      return item;
    });
  }, [verses]);
  const totalSteps = parsed.length ? parsed[parsed.length-1].offset + parsed[parsed.length-1].len : 0;

  useEffect(() => () => {
    playIdRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) ctxRef.current.close().catch(() => {});
  }, []);

  async function startFrom(startStep) {
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
    const cursorTimeline = [];

    function scheduleNote(n, noteTime) {
      let played = false;
      if (useReal) played = playSampleNote(ctx, buffers, n.ch, n.register, noteTime, 0.85);
      if (!played) {
        const f = noteFreq(n.ch, n.register);
        if (f) synthNote(ctx, f, noteTime, stepDur * 2.2);
      }
    }

    parsed.forEach((pv, vi) => {
      if (pv.offset + pv.len <= startStep) return;
      const pStart = Math.max(0, startStep - pv.offset);
      const lines = !pv.useHands ? [pv.cb]
        : hand === 'R' ? [pv.rh] : hand === 'L' ? [pv.lh] : [pv.rh, pv.lh];

      for (let p = pStart; p < pv.len; p++) {
        cursorTimeline.push({ time: t0 + (pv.offset + p - startStep) * stepDur, verseIdx: vi, pos: p });
      }

      // ── สะบัดข้ามมือ ──
      const consumed = lines.map(() => new Array(pv.len).fill(false));
      const runMap = {};
      for (let p = pStart; p < pv.len; p++) {
        lines.forEach((line, li) => {
          if (line[p].length > 1) {
            let lead = [];
            if (p > pStart) {
              if (line[p - 1].length === 1 && !consumed[li][p - 1]) {
                lead = line[p - 1]; consumed[li][p - 1] = true;
              } else {
                for (let lj = 0; lj < lines.length; lj++) {
                  if (lj !== li && lines[lj][p].length === 0
                      && lines[lj][p - 1].length === 1 && !consumed[lj][p - 1]) {
                    lead = lines[lj][p - 1]; consumed[lj][p - 1] = true; break;
                  }
                }
              }
            }
            runMap[li + '-' + p] = [...lead, ...line[p]];
          }
        });
      }

      lines.forEach((line, li) => {
        for (let p = pStart; p < pv.len; p++) {
          if (consumed[li][p]) continue;
          const t = t0 + (pv.offset + p - startStep) * stepDur;
          const run = runMap[li + '-' + p];
          if (run) {
            run.forEach((n, ni) => scheduleNote(n, t - (run.length - 1 - ni) * SABAT_GAP));
          } else {
            line[p].forEach(n => scheduleNote(n, t));
          }
        }
      });
    });

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

  function seek(vi, p) {
    const hongStart = Math.floor(p / 4) * 4;
    startFrom(parsed[vi].offset + hongStart);
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

  function khimRow(pv, reg) {
    return pv.cb.map(notes => notes.filter(n => String(n.register) === reg));
  }

  // ── จัดกลุ่มวรรคลงบรรทัด ตามจำนวนห้องต่อบรรทัดที่เลือก ──
  const lineGroups = useMemo(() => {
    const groups = [];
    let cur = [], curHongs = 0;
    parsed.forEach((pv, vi) => {
      const h = pv.len / 4;
      if (cur.length > 0 && curHongs + h > hongsPerLine) { groups.push(cur); cur = []; curHongs = 0; }
      cur.push(vi); curHongs += h;
    });
    if (cur.length) groups.push(cur);
    return groups;
  }, [parsed, hongsPerLine]);

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
        <select className="filter-select" value={hongsPerLine} onChange={e => setHongsPerLine(+e.target.value)}>
          <option value="2">2 ห้อง/บรรทัด</option>
          <option value="4">4 ห้อง/บรรทัด</option>
          <option value="8">8 ห้อง/บรรทัด</option>
          <option value="16">16 ห้อง/บรรทัด</option>
        </select>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'0.75rem',color:'var(--muted)'}}>
          ช้า <input type="range" min="50" max="220" value={bpm} onChange={e => setBpm(+e.target.value)}
            style={{accentColor:'var(--gold)'}} disabled={playState !== 'stopped'} /> เร็ว
          <span style={{fontFamily:'monospace'}}>{bpm}</span>
        </div>
        {sampleCount != null && sound === 'real' && (
          <span style={{fontSize:'0.68rem',color: sampleCount > 0 ? 'var(--jade)' : 'var(--danger)'}}>
            {sampleCount > 0 ? `♪ เสียงจริง ${sampleCount}/16 ลูก` : '⚠ ยังไม่มีไฟล์เสียง'}
          </span>
        )}
        <span style={{fontSize:'0.68rem',color:'var(--muted)'}}>💡 กดที่ห้องใดก็ได้เพื่อเล่นจากตรงนั้น</span>
      </div>

      {mode === 'staff' ? <StaffNotation verses={verses} /> :
      <div style={{background:'var(--navy3)',border:'1px solid var(--border)',borderRadius:'8px',
        padding:'1rem',overflowX:'auto',display:'flex',flexDirection:'column',gap:'0.7rem'}}>
        {lineGroups.map((group, gi) => {
          const first = parsed[group[0]].v;
          const last = parsed[group[group.length-1]].v;
          const label = group.length > 1
            ? `วรรค ${first.verse_no}–${last.verse_no}` : `วรรค ${first.verse_no}`;
          const luk = group.map(vi => parsed[vi].v.luktok).filter(Boolean).join(' / ');
          const segs = f => group.map(vi => ({ positions: f(parsed[vi]), vi }));
          return (
            <div key={gi} style={{paddingBottom:'0.5rem',
              borderBottom: gi < lineGroups.length-1 ? '1px dashed rgba(42,63,92,0.6)' : 'none'}}>
              <div style={{fontSize:'0.62rem',color:'var(--muted)',marginBottom:'3px'}}>
                {label}{first.section ? ` · ${first.section}` : ''}{luk ? ` · ลูกตก: ${luk}` : ''}
              </div>
              {mode === 'combined' && renderMulti(segs(pv => pv.cb), null)}
              {mode === 'hands' && <>
                {renderMulti(segs(pv => pv.rh), 'R')}
                {renderMulti(segs(pv => pv.lh), 'L')}
              </>}
              {mode === 'khim' && ['1','0','-1'].map(reg =>
                <div key={reg}>{renderMulti(group.map(vi => ({ positions: khimRow(parsed[vi], reg), vi })), REG_LABEL[reg])}</div>
              )}
              {mode === 'vocal' && renderMulti(segs(pv => pv.cb), '♪')}
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
