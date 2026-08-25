'use client';
// components/NathabEditor.js — กระดานเขียนโน้ตหน้าทับ (ระบบกลาง ใช้กับทุกเพลง)
//
//   ตาราง = ห้อง × 4 ตำแหน่ง (เหมือนโน้ตทำนอง) · กดช่องแล้วเลือกพยางค์กลองจากแป้น
//   ฉิ่ง–ฉับ แสดงเป็นแถวอ้างอิงตามอัตรา · กด ▶ ฟังวนด้วยเสียงกลองจริงจากคลัง (ไม่มีไฟล์ = สังเคราะห์)
//   ผลลัพธ์คือ pattern_text รูปแบบเดิม "- - - เท่ง | - - - พรึม" → เข้ากับเครื่องเล่นทุกตัวทันที
//
//   <NathabEditor value={row} onSave={row => ...} saveLabel="บันทึก" readOnly lockMeta />
//   <NathabPreview row={row} />            แสดงอย่างเดียว + ปุ่มฟัง (ใช้ในรายการคลัง)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHING_PATTERNS, DEFAULT_HONGS, DRUMS, LEVELS, SYLLABLES, cellsToText, textToCells,
         loadDrumBank, playPercussion } from '../lib/nathab';

const KEYS = '123456789';

// ── ตัวเล่นวนหน้าทับ (ใช้ร่วมกันทั้งกระดานและรายการคลัง) ──
export function usePatternPlayer() {
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const ctxRef = useRef(null), idRef = useRef(0), rafRef = useRef(0);

  const stop = useCallback(() => {
    idRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    setPlaying(false); setStep(-1);
  }, []);
  useEffect(() => stop, [stop]);

  // cells: array พยางค์/'' · loops: จำนวนรอบ (Infinity = วนจนกด stop)
  const start = useCallback(async (cells, { instrument = 'ตะโพน', level = 'สองชั้น', bpm = 100, ching = true, loops = Infinity } = {}) => {
    stop();
    if (!cells?.length) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ctx;
    await ctx.resume();
    const myId = ++idRef.current;
    try { await Promise.all([loadDrumBank(ctx, instrument), ching ? loadDrumBank(ctx, 'ฉิ่ง') : null].filter(Boolean)); } catch (e) {}
    if (idRef.current !== myId) return;
    setPlaying(true);
    const stepDur = 60 / bpm / 2;
    const len = cells.length;
    const cyc = (CHING_PATTERNS[level]?.hongs ?? 4) * 4;
    const t0 = ctx.currentTime + 0.15;
    let next = 0;                      // ขั้นถัดไปที่ยังไม่นัด (นับต่อเนื่องข้ามรอบ)
    const maxSteps = Number.isFinite(loops) ? loops * len : Infinity;
    const schedule = until => {
      while (next < maxSteps && t0 + next * stepDur < until) {
        const t = t0 + next * stepDur, i = next % len;
        if (cells[i]) playPercussion(ctx, cells[i], t, 0.8, instrument);
        if (ching) { const pp = (next % cyc) + 1; if (pp === cyc / 2) playPercussion(ctx, 'ฉิ่ง', t, 0.55, 'ฉิ่ง'); else if (pp === cyc) playPercussion(ctx, 'ฉับ', t, 0.55, 'ฉิ่ง'); }
        next++;
      }
    };
    const tick = () => {
      if (idRef.current !== myId) return;
      const now = ctx.currentTime;
      schedule(now + 1.5);
      const cur = Math.floor((now - t0) / stepDur);
      if (cur >= 0) setStep(cur % len);
      if (cur >= maxSteps) { stop(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    schedule(ctx.currentTime + 1.5);
    rafRef.current = requestAnimationFrame(tick);
  }, [stop]);

  return { playing, step, start, stop };
}

function chingMarks(len, level) {
  const cyc = (CHING_PATTERNS[level]?.hongs ?? 4) * 4;
  return Array.from({ length: len }, (_, i) => { const pp = (i % cyc) + 1; return pp === cyc / 2 ? 'ฉิ่ง' : pp === cyc ? 'ฉับ' : ''; });
}

// ── ตารางโน้ต (ใช้ทั้งโหมดแก้และโหมดดู) ──
function Grid({ cells, level, active, playStep, onPick, hongsPerLine = 8, compact = false }) {
  const marks = useMemo(() => chingMarks(cells.length, level), [cells.length, level]);
  const lines = [];
  for (let i = 0; i < cells.length; i += hongsPerLine * 4) lines.push(i);
  const cellW = compact ? 34 : 46;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 10, overflowX: 'auto' }}>
      {lines.map(start => {
        const end = Math.min(cells.length, start + hongsPerLine * 4);
        const idx = Array.from({ length: end - start }, (_, k) => start + k);
        return (
          <div key={start}>
            {!compact && <div style={{ display: 'flex', fontSize: '0.6rem', color: 'var(--gold2)', marginBottom: 2 }}>
              {idx.map(i => <span key={i} style={{ width: cellW, textAlign: 'center', flexShrink: 0, marginLeft: i % 4 === 0 && i !== start ? 9 : 0 }}>{marks[i]}</span>)}
            </div>}
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              {idx.map(i => (
                <span key={i} style={{ display: 'flex', flexShrink: 0 }}>
                  {i % 4 === 0 && i !== start && <span style={{ width: 9, display: 'flex', justifyContent: 'center', color: 'var(--border)' }}>|</span>}
                  <button type="button" onClick={onPick ? () => onPick(i) : undefined} tabIndex={-1}
                    title={onPick ? `ห้อง ${Math.floor(i / 4) + 1} ตำแหน่ง ${i % 4 + 1}` : undefined}
                    style={{
                      width: cellW, minHeight: compact ? 26 : 38, padding: '2px 1px', borderRadius: 4,
                      fontSize: compact ? '0.72rem' : '0.86rem', lineHeight: 1.3, fontFamily: 'inherit',
                      cursor: onPick ? 'pointer' : 'default',
                      border: active === i ? '2px solid var(--gold)' : '1px solid rgba(42,63,92,0.6)',
                      background: playStep === i ? 'rgba(201,168,76,0.45)' : cells[i] ? 'rgba(76,154,132,0.18)' : 'transparent',
                      color: cells[i] ? 'var(--cream)' : 'var(--muted)',
                    }}>{cells[i] || '-'}</button>
                </span>
              ))}
            </div>
            {!compact && <div style={{ display: 'flex', fontSize: '0.58rem', color: 'var(--muted)', marginTop: 2 }}>
              {idx.map(i => <span key={i} style={{ width: cellW, textAlign: 'center', flexShrink: 0, marginLeft: i % 4 === 0 && i !== start ? 9 : 0 }}>{i % 4 === 0 ? `ห้อง ${i / 4 + 1}` : ''}</span>)}
            </div>}
          </div>
        );
      })}
    </div>
  );
}

// ── แสดงอย่างเดียว + ปุ่มฟัง ──
export function NathabPreview({ row, bpm = 100 }) {
  const cells = useMemo(() => textToCells(row?.pattern_text), [row?.pattern_text]);
  const { playing, step, start, stop } = usePatternPlayer();
  const level = LEVELS.includes(row?.level) ? row.level : 'ทุกอัตรา';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className={`btn btn-sm ${playing ? 'btn-outline' : 'btn-jade'}`}
        onClick={() => playing ? stop() : start(cells, { instrument: row.instrument, level: level === 'ทุกอัตรา' ? 'สองชั้น' : level, bpm, loops: 2 })}>
        {playing ? '■ หยุด' : '▶ ฟัง'}
      </button>
      <Grid cells={cells} level={level === 'ทุกอัตรา' ? 'สองชั้น' : level} playStep={playing ? step : -1} compact hongsPerLine={16} />
    </div>
  );
}

// ── กระดานเขียน ──
export default function NathabEditor({ value, onSave, onCancel, saveLabel = '💾 บันทึก', readOnly = false, lockMeta = false, busy = false, names = [] }) {
  const [nathab, setNathab] = useState(value?.nathab ?? '');
  const [level, setLevel] = useState(LEVELS.includes(value?.level) ? value.level : 'สองชั้น');
  const [instrument, setInstrument] = useState(DRUMS.includes(value?.instrument) ? value.instrument : 'ตะโพน');
  const [cells, setCells] = useState(() => {
    const c = textToCells(value?.pattern_text);
    return c.length ? c : new Array(DEFAULT_HONGS[level] * 4).fill('');
  });
  const [note, setNote] = useState(value?.note ?? '');
  const [source, setSource] = useState(value?.source ?? '');
  const [active, setActive] = useState(0);
  const [custom, setCustom] = useState('');
  const [bpm, setBpm] = useState(100);
  const [chingOn, setChingOn] = useState(true);
  const [text, setText] = useState(() => cellsToText(cells));
  const [textErr, setTextErr] = useState('');
  const rootRef = useRef(null);
  const { playing, step, start, stop } = usePatternPlayer();

  const hongs = cells.length / 4;
  const palette = SYLLABLES[instrument] ?? SYLLABLES['ตะโพน'];
  const playLevel = level === 'ทุกอัตรา' ? 'สองชั้น' : level;

  // ซิงก์ตาราง → ข้อความ (แก้ข้อความจะแปลงกลับตอน blur)
  useEffect(() => { setText(cellsToText(cells)); setTextErr(''); }, [cells]);

  const setCell = useCallback((i, syll) => {
    if (readOnly) return;
    setCells(cs => { const n = cs.slice(); n[i] = syll; return n; });
  }, [readOnly]);

  function pick(syll) {
    setCell(active, syll);
    // ฟังเสียงที่เลือกทันที
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      loadDrumBank(ctx, instrument).then(() => { playPercussion(ctx, syll, ctx.currentTime + 0.02, 0.8, instrument); setTimeout(() => ctx.close().catch(() => {}), 1500); });
    } catch (e) {}
    setActive(a => Math.min(cells.length - 1, a + 1));
  }
  function setHongs(n) {
    const len = Math.max(1, Math.min(64, n)) * 4;
    setCells(cs => { const out = cs.slice(0, len); while (out.length < len) out.push(''); return out; });
    setActive(a => Math.min(a, len - 1));
  }
  function changeLevel(lv) {
    setLevel(lv);
    // หน้าทับว่างเปล่าอยู่ → ปรับจำนวนห้องให้เหมาะกับอัตราใหม่
    if (cells.every(c => !c)) setHongs(DEFAULT_HONGS[lv]);
  }
  function applyText() {
    const c = textToCells(text);
    if (!c.length) { setTextErr('อ่านโน้ตไม่ได้ — ใช้รูปแบบ  - - - เท่ง | - - - พรึม'); return; }
    setCells(c); setTextErr('');
  }
  function onKey(e) {
    if (readOnly) return;
    const t = e.target;
    if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
    const len = cells.length;
    if (e.key === 'ArrowRight') { setActive(a => (a + 1) % len); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { setActive(a => (a - 1 + len) % len); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { setActive(a => Math.min(len - 1, a + 4)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setActive(a => Math.max(0, a - 4)); e.preventDefault(); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { setCell(active, ''); e.preventDefault(); }
    else if (e.key === '-' || e.key === '0') { setCell(active, ''); setActive(a => Math.min(len - 1, a + 1)); e.preventDefault(); }
    else if (e.key === ' ') { playing ? stop() : start(cells, { instrument, level: playLevel, bpm, ching: chingOn }); e.preventDefault(); }
    else if (e.key === 'Escape') { stop(); }
    else { const k = KEYS.indexOf(e.key); if (k >= 0 && palette[k]) { pick(palette[k]); e.preventDefault(); } }
  }

  const rowOut = () => ({ nathab: nathab.trim(), level, instrument, pattern_text: cellsToText(cells), note: note.trim() || null, source: source.trim() || null });
  const canSave = !readOnly && nathab.trim() && cells.some(c => c) && !busy;

  return (
    <div ref={rootRef} tabIndex={0} onKeyDown={onKey} style={{ outline: 'none' }}
      onClick={() => rootRef.current?.focus({ preventScroll: true })}>
      {/* ข้อมูลหน้าทับ */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input className="form-input" list="nathab-names" style={{ width: 180 }} value={nathab} placeholder="ชื่อหน้าทับ เช่น สามไม้"
          disabled={readOnly || lockMeta} onChange={e => setNathab(e.target.value)} />
        {names.length > 0 && <datalist id="nathab-names">{names.map(n => <option key={n} value={n} />)}</datalist>}
        <select className="filter-select" value={level} disabled={readOnly || lockMeta} onChange={e => changeLevel(e.target.value)}>
          {LEVELS.map(l => <option key={l}>{l}</option>)}
        </select>
        <select className="filter-select" value={instrument} disabled={readOnly || lockMeta} onChange={e => setInstrument(e.target.value)}>
          {DRUMS.map(d => <option key={d}>{d}</option>)}
        </select>
        <label style={{ fontSize: '0.76rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          ยาว <input type="number" className="form-input" style={{ width: 60 }} min={1} max={64} value={hongs} disabled={readOnly}
            onChange={e => setHongs(+e.target.value || 1)} /> ห้อง
        </label>
      </div>

      {/* แถบเล่น */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <button type="button" className={`btn btn-sm ${playing ? 'btn-outline' : 'btn-jade'}`}
          onClick={() => playing ? stop() : start(cells, { instrument, level: playLevel, bpm, ching: chingOn })}>
          {playing ? '■ หยุด' : '▶ ฟังวน'}
        </button>
        <label style={{ fontSize: '0.76rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={chingOn} onChange={e => setChingOn(e.target.checked)} style={{ accentColor: 'var(--gold)' }} /> ฉิ่ง
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--muted)' }}>
          ช้า <input type="range" min="50" max="200" value={bpm} onChange={e => setBpm(+e.target.value)} style={{ accentColor: 'var(--gold)' }} /> เร็ว
          <span style={{ fontFamily: 'monospace' }}>{bpm}</span>
        </div>
        {level === 'ทุกอัตรา' && <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>(ฉิ่งอ้างอิงแสดงแบบสองชั้น)</span>}
      </div>

      {/* ตารางโน้ต */}
      <div style={{ background: 'var(--navy3)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.8rem' }}>
        <Grid cells={cells} level={playLevel} active={readOnly ? -1 : active} playStep={playing ? step : -1}
          onPick={readOnly ? null : i => setActive(i)} hongsPerLine={8} />
      </div>

      {/* แป้นพยางค์ */}
      {!readOnly && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>ช่อง {Math.floor(active / 4) + 1}.{active % 4 + 1} →</span>
          {palette.map((s, k) => (
            <button key={s} type="button" className="btn btn-outline btn-sm" onClick={() => pick(s)} title={`คีย์ ${KEYS[k]}`}
              style={{ minWidth: 52 }}>{s}<span style={{ fontSize: '0.6rem', color: 'var(--muted)', marginLeft: 4 }}>{KEYS[k]}</span></button>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setCell(active, ''); setActive(a => Math.min(cells.length - 1, a + 1)); }} title="คีย์ - หรือ Backspace">– ว่าง</button>
          <input className="form-input" style={{ width: 90 }} value={custom} placeholder="พยางค์อื่น" onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { pick(custom.trim()); setCustom(''); } }} />
          <button type="button" className="btn btn-outline btn-sm" disabled={!custom.trim()} onClick={() => { pick(custom.trim()); setCustom(''); }}>ใส่</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setCells(new Array(cells.length).fill(''))}>🗑 ล้างทั้งหมด</button>
        </div>
      )}
      {!readOnly && <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: 6 }}>
        แป้นพิมพ์: ← → ↑ ↓ เลื่อนช่อง · 1–9 ใส่พยางค์ · - หรือ Backspace ลบ · Space ฟัง/หยุด
      </div>}

      {/* ข้อความโน้ต (แก้ตรงได้) */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginBottom: 3 }}>โน้ตแบบข้อความ (คัดลอก/วางได้)</div>
        <textarea className="form-input" rows={2} value={text} readOnly={readOnly}
          style={{ fontFamily: 'monospace', fontSize: '0.8rem', width: '100%', resize: 'vertical' }}
          onChange={e => setText(e.target.value)} onBlur={() => { if (!readOnly && text !== cellsToText(cells)) applyText(); }} />
        {textErr && <div style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>{textErr}</div>}
      </div>

      {/* หมายเหตุ + ที่มา */}
      {(!readOnly || note || source) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <input className="form-input" style={{ flex: '1 1 240px' }} value={note} readOnly={readOnly} placeholder="หมายเหตุ (เช่น ใช้กับเพลงกลุ่มไหน จุดสังเกต)" onChange={e => setNote(e.target.value)} />
          <input className="form-input" style={{ flex: '1 1 200px' }} value={source} readOnly={readOnly} placeholder="ที่มา / ครูผู้ถ่ายทอด" onChange={e => setSource(e.target.value)} />
        </div>
      )}

      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary btn-sm" disabled={!canSave} onClick={() => { stop(); onSave?.(rowOut()); }}>{busy ? '⏳ กำลังบันทึก...' : saveLabel}</button>
          {onCancel && <button type="button" className="btn btn-outline btn-sm" onClick={() => { stop(); onCancel(); }}>ยกเลิก</button>}
          {!nathab.trim() && <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>ตั้งชื่อหน้าทับก่อนบันทึก</span>}
        </div>
      )}
    </div>
  );
}
