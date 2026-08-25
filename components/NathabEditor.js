'use client';
// components/NathabEditor.js — กระดานเขียนโน้ตหน้าทับ (ระบบกลาง ใช้กับทุกเพลง)
//
//   ตาราง = ห้อง × 4 ตำแหน่ง (เหมือนโน้ตทำนอง) · กดช่องแล้วเลือกพยางค์กลองจากแป้น
//   ชุดเครื่องมีได้หลาย "บรรทัด" (voice) ตีพร้อมกันได้ — ตะโพน+กลองทัด · กลองแขกตัวผู้/ตัวเมีย · โทน/รำมะนา (lib/nathab.js DRUM_SETS)
//   ฉิ่ง–ฉับ แสดงเป็นแถวอ้างอิงตามอัตรา · กด ▶ ฟังวนด้วยเสียงกลองจริงจากคลัง (ไม่มีไฟล์ = สังเคราะห์)
//   ผลลัพธ์คือ pattern_text บรรทัดละ voice "- - - เท่ง | - - - พรึม\n- - - - | - - - ตูม" → เข้ากับเครื่องเล่นทุกตัวทันที
//
//   <NathabEditor value={row} onSave={row => ...} saveLabel="บันทึก" readOnly lockMeta />
//   <NathabPreview row={row} />            แสดงอย่างเดียว + ปุ่มฟัง (ใช้ในรายการคลัง)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHING_PATTERNS, DEFAULT_HONGS, DRUMS, DRUM_SETS, LEVELS, drumLabel, setOf, banksFor, voicesToText, textToVoices, cellsToText,
         loadSetBanks, loadDrumBank, playPercussion } from '../lib/nathab';

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

  // voices: [cells0, cells1, …] (ทุก voice ยาวเท่ากัน) · loops: จำนวนรอบ (Infinity = วนจนกด stop)
  const start = useCallback(async (voices, { instrument = 'ตะโพน', level = 'สองชั้น', bpm = 100, ching = true, loops = Infinity } = {}) => {
    stop();
    const len = Math.max(...(voices ?? []).map(v => v.length), 0);
    if (!len) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ctx;
    await ctx.resume();
    const myId = ++idRef.current;
    try { await loadSetBanks(ctx, instrument, { ching }); } catch (e) {}
    if (idRef.current !== myId) return;
    setPlaying(true);
    const stepDur = 60 / bpm / 2;
    const cyc = (CHING_PATTERNS[level]?.hongs ?? 4) * 4;
    const t0 = ctx.currentTime + 0.15;
    let next = 0;                      // ขั้นถัดไปที่ยังไม่นัด (นับต่อเนื่องข้ามรอบ)
    const maxSteps = Number.isFinite(loops) ? loops * len : Infinity;
    const schedule = until => {
      while (next < maxSteps && t0 + next * stepDur < until) {
        const t = t0 + next * stepDur, i = next % len;
        voices.forEach((cells, vi) => { if (cells[i]) playPercussion(ctx, cells[i], t, 0.8, banksFor(instrument, vi)); });
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

// ── ตารางโน้ตหลายบรรทัด (ใช้ทั้งโหมดแก้และโหมดดู) ──
// voices: [cells…] · labels: ชื่อบรรทัด · active: {v, i} · onPick(v, i)
function Grid({ voices, labels, level, active, playStep, onPick, hongsPerLine = 4, compact = false }) {
  const len = Math.max(...voices.map(v => v.length), 0);
  const marks = useMemo(() => chingMarks(len, level), [len, level]);
  const lines = [];
  for (let i = 0; i < len; i += hongsPerLine * 4) lines.push(i);
  const cellW = compact ? 32 : 46;
  const labW = compact ? 44 : 64;
  const showLab = voices.length > 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 12, overflowX: 'auto', maxWidth: '100%' }}>
      {lines.map(start => {
        const end = Math.min(len, start + hongsPerLine * 4);
        const idx = Array.from({ length: end - start }, (_, k) => start + k);
        const pad = <span style={{ width: showLab ? labW : (compact && lines.length > 1 ? 22 : 0), flexShrink: 0 }} />;
        return (
          <div key={start}>
            {!compact && <div style={{ display: 'flex', fontSize: '0.6rem', color: 'var(--gold2)', marginBottom: 2 }}>
              {pad}{idx.map(i => <span key={i} style={{ width: cellW, textAlign: 'center', flexShrink: 0, marginLeft: i % 4 === 0 && i !== start ? 9 : 0 }}>{marks[i]}</span>)}
            </div>}
            {voices.map((cells, vi) => (
              <div key={vi} style={{ display: 'flex', alignItems: 'stretch', marginTop: vi ? 2 : 0 }}>
                {showLab
                  ? <span style={{ width: labW, fontSize: compact ? '0.6rem' : '0.68rem', color: active && active.v === vi ? 'var(--gold)' : 'var(--muted)', alignSelf: 'center', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={labels[vi]}>{labels[vi]}{compact && lines.length > 1 ? ` ${start / 4 + 1}` : ''}</span>
                  : (compact && lines.length > 1 ? <span style={{ width: 22, fontSize: '0.56rem', color: 'var(--muted)', alignSelf: 'center', flexShrink: 0 }}>{start / 4 + 1}</span> : null)}
                {idx.map(i => (
                  <span key={i} style={{ display: 'flex', flexShrink: 0 }}>
                    {i % 4 === 0 && i !== start && <span style={{ width: 9, display: 'flex', justifyContent: 'center', color: 'var(--border)' }}>|</span>}
                    <button type="button" onClick={onPick ? () => onPick(vi, i) : undefined} tabIndex={-1}
                      title={onPick ? `${labels[vi]} · ห้อง ${Math.floor(i / 4) + 1} ตำแหน่ง ${i % 4 + 1}` : undefined}
                      style={{
                        width: cellW, minHeight: compact ? 26 : 38, padding: '2px 1px', borderRadius: 4,
                        fontSize: compact ? '0.72rem' : '0.86rem', lineHeight: 1.3, fontFamily: 'inherit',
                        cursor: onPick ? 'pointer' : 'default',
                        border: active && active.v === vi && active.i === i ? '2px solid var(--gold)' : '1px solid rgba(42,63,92,0.6)',
                        background: playStep === i ? 'rgba(201,168,76,0.45)' : cells[i] ? 'rgba(76,154,132,0.18)' : 'transparent',
                        color: cells[i] ? 'var(--cream)' : 'var(--muted)',
                      }}>{cells[i] || '-'}</button>
                  </span>
                ))}
              </div>
            ))}
            {!compact && <div style={{ display: 'flex', fontSize: '0.58rem', color: 'var(--muted)', marginTop: 2 }}>
              {pad}{idx.map(i => <span key={i} style={{ width: cellW, textAlign: 'center', flexShrink: 0, marginLeft: i % 4 === 0 && i !== start ? 9 : 0 }}>{i % 4 === 0 ? `ห้อง ${i / 4 + 1}` : ''}</span>)}
            </div>}
          </div>
        );
      })}
    </div>
  );
}

// ── แสดงอย่างเดียว + ปุ่มฟัง ──
export function NathabPreview({ row, bpm = 100 }) {
  const set = setOf(row?.instrument);
  const voices = useMemo(() => textToVoices(row?.pattern_text, set.voices.length), [row?.pattern_text, set.voices.length]);
  const labels = set.voices.map(v => v.label);
  const { playing, step, start, stop } = usePatternPlayer();
  const level = LEVELS.includes(row?.level) ? row.level : 'ทุกอัตรา';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <button type="button" className={`btn btn-sm ${playing ? 'btn-outline' : 'btn-jade'}`}
        onClick={() => playing ? stop() : start(voices, { instrument: row.instrument, level: level === 'ทุกอัตรา' ? 'สองชั้น' : level, bpm, loops: 2 })}>
        {playing ? '■ หยุด' : '▶ ฟัง'}
      </button>
      <Grid voices={voices} labels={labels} level={level === 'ทุกอัตรา' ? 'สองชั้น' : level} playStep={playing ? step : -1} compact hongsPerLine={4} />
    </div>
  );
}

// ── กระดานเขียน ──
export default function NathabEditor({ value, onSave, onCancel, saveLabel = '💾 บันทึก', readOnly = false, lockMeta = false, busy = false, names = [] }) {
  const [nathab, setNathab] = useState(value?.nathab ?? '');
  const [level, setLevel] = useState(LEVELS.includes(value?.level) ? value.level : 'สองชั้น');
  const [instrument, setInstrumentState] = useState(value?.instrument && DRUM_SETS[value.instrument] ? value.instrument : 'ตะโพน');
  const set = setOf(instrument);
  const nV = set.voices.length;
  const [voices, setVoices] = useState(() => {
    const v = textToVoices(value?.pattern_text, setOf(value?.instrument ?? 'ตะโพน').voices.length);
    const len = Math.max(...v.map(x => x.length), 0);
    return len ? v : Array.from({ length: setOf(value?.instrument ?? 'ตะโพน').voices.length }, () => new Array(DEFAULT_HONGS[level] * 4).fill(''));
  });
  const [note, setNote] = useState(value?.note ?? '');
  const [source, setSource] = useState(value?.source ?? '');
  const [active, setActive] = useState({ v: 0, i: 0 });
  const [custom, setCustom] = useState('');
  const [bpm, setBpm] = useState(100);
  const [chingOn, setChingOn] = useState(true);
  const [text, setText] = useState(() => voicesToText(voices));
  const [textErr, setTextErr] = useState('');
  const rootRef = useRef(null);
  const { playing, step, start, stop } = usePatternPlayer();

  const len = Math.max(...voices.map(v => v.length), 0);
  const hongs = len / 4;
  const palette = set.voices[active.v]?.syll ?? set.voices[0].syll;
  const labels = set.voices.map(v => v.label);
  const playLevel = level === 'ทุกอัตรา' ? 'สองชั้น' : level;

  // ซิงก์ตาราง → ข้อความ (แก้ข้อความจะแปลงกลับตอน blur)
  useEffect(() => { setText(voicesToText(voices)); setTextErr(''); }, [voices]);

  // เปลี่ยนชุดเครื่อง → ปรับจำนวนบรรทัดให้ตรงชุด (โน้ตบรรทัดที่มีอยู่คงไว้)
  function setInstrument(inst) {
    setInstrumentState(inst);
    const n = setOf(inst).voices.length;
    setVoices(vs => { const out = vs.slice(0, n); while (out.length < n) out.push(new Array(len).fill('')); return out; });
    setActive(a => ({ v: Math.min(a.v, n - 1), i: a.i }));
  }
  const setCell = useCallback((v, i, syll) => {
    if (readOnly) return;
    setVoices(vs => vs.map((cells, k) => { if (k !== v) return cells; const n = cells.slice(); n[i] = syll; return n; }));
  }, [readOnly]);
  const advance = () => setActive(a => ({ v: a.v, i: Math.min(len - 1, a.i + 1) }));

  function pick(syll) {
    setCell(active.v, active.i, syll);
    // ฟังเสียงที่เลือกทันที (เสียงของบรรทัดนั้น)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const banks = banksFor(instrument, active.v);
      Promise.all(banks.map(b => loadDrumBank(ctx, b))).then(() => { playPercussion(ctx, syll, ctx.currentTime + 0.02, 0.8, banks); setTimeout(() => ctx.close().catch(() => {}), 1500); });
    } catch (e) {}
    advance();
  }
  function setHongs(n) {
    const L = Math.max(1, Math.min(64, n)) * 4;
    setVoices(vs => vs.map(cells => { const out = cells.slice(0, L); while (out.length < L) out.push(''); return out; }));
    setActive(a => ({ v: a.v, i: Math.min(a.i, L - 1) }));
  }
  function changeLevel(lv) {
    setLevel(lv);
    // หน้าทับว่างเปล่าอยู่ → ปรับจำนวนห้องให้เหมาะกับอัตราใหม่
    if (voices.every(cells => cells.every(c => !c))) setHongs(DEFAULT_HONGS[lv]);
  }
  function applyText() {
    const v = textToVoices(text, nV);
    if (!Math.max(...v.map(x => x.length), 0)) { setTextErr('อ่านโน้ตไม่ได้ — ใช้รูปแบบ  - - - เท่ง | - - - พรึม  (บรรทัดละเครื่อง)'); return; }
    setVoices(v); setTextErr('');
  }
  function onKey(e) {
    if (readOnly) return;
    const t = e.target;
    if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
    if (e.key === 'ArrowRight') { setActive(a => ({ v: a.v, i: (a.i + 1) % len })); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { setActive(a => ({ v: a.v, i: (a.i - 1 + len) % len })); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { setActive(a => nV > 1 ? { v: (a.v + 1) % nV, i: a.i } : { v: a.v, i: Math.min(len - 1, a.i + 4) }); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setActive(a => nV > 1 ? { v: (a.v - 1 + nV) % nV, i: a.i } : { v: a.v, i: Math.max(0, a.i - 4) }); e.preventDefault(); }
    else if (e.key === 'Tab') { setActive(a => ({ v: (a.v + 1) % nV, i: a.i })); e.preventDefault(); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { setCell(active.v, active.i, ''); e.preventDefault(); }
    else if (e.key === '-' || e.key === '0') { setCell(active.v, active.i, ''); advance(); e.preventDefault(); }
    else if (e.key === ' ') { playing ? stop() : start(voices, { instrument, level: playLevel, bpm, ching: chingOn }); e.preventDefault(); }
    else if (e.key === 'Escape') { stop(); }
    else { const k = KEYS.indexOf(e.key); if (k >= 0 && palette[k]) { pick(palette[k]); e.preventDefault(); } }
  }

  const rowOut = () => ({ nathab: nathab.trim(), level, instrument, pattern_text: voicesToText(voices), note: note.trim() || null, source: source.trim() || null });
  const hasAny = voices.some(cells => cells.some(c => c));
  const canSave = !readOnly && nathab.trim() && hasAny && !busy;

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
        <select className="filter-select" value={instrument} disabled={readOnly || lockMeta} onChange={e => setInstrument(e.target.value)} title="ชุดเครื่องกำกับจังหวะ (หลายบรรทัดตีพร้อมกันได้)">
          {DRUMS.map(d => <option key={d} value={d}>{drumLabel(d)}</option>)}
          {!DRUMS.includes(instrument) && <option value={instrument}>{drumLabel(instrument)}</option>}
        </select>
        <label style={{ fontSize: '0.76rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          ยาว <input type="number" className="form-input" style={{ width: 60 }} min={1} max={64} value={hongs} disabled={readOnly}
            onChange={e => setHongs(+e.target.value || 1)} /> ห้อง
        </label>
        {nV > 1 && <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{nV} บรรทัด: {labels.join(' / ')} — ตีพร้อมกันได้ · ↑↓ หรือ Tab สลับบรรทัด</span>}
      </div>

      {/* แถบเล่น */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <button type="button" className={`btn btn-sm ${playing ? 'btn-outline' : 'btn-jade'}`}
          onClick={() => playing ? stop() : start(voices, { instrument, level: playLevel, bpm, ching: chingOn })}>
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
        <Grid voices={voices} labels={labels} level={playLevel} active={readOnly ? null : active} playStep={playing ? step : -1}
          onPick={readOnly ? null : (v, i) => setActive({ v, i })} hongsPerLine={4} />
      </div>

      {/* แป้นพยางค์ (ของบรรทัดที่เลือกอยู่) */}
      {!readOnly && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{nV > 1 ? <b style={{ color: 'var(--gold)' }}>{labels[active.v]}</b> : null} ช่อง {Math.floor(active.i / 4) + 1}.{active.i % 4 + 1} →</span>
          {palette.map((s, k) => (
            <button key={s} type="button" className="btn btn-outline btn-sm" onClick={() => pick(s)} title={`คีย์ ${KEYS[k]}`}
              style={{ minWidth: 52 }}>{s}<span style={{ fontSize: '0.6rem', color: 'var(--muted)', marginLeft: 4 }}>{KEYS[k]}</span></button>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setCell(active.v, active.i, ''); advance(); }} title="คีย์ - หรือ Backspace">– ว่าง</button>
          <input className="form-input" style={{ width: 90 }} value={custom} placeholder="พยางค์อื่น" onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { pick(custom.trim()); setCustom(''); } }} />
          <button type="button" className="btn btn-outline btn-sm" disabled={!custom.trim()} onClick={() => { pick(custom.trim()); setCustom(''); }}>ใส่</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setVoices(vs => vs.map(c => new Array(c.length).fill('')))}>🗑 ล้างทั้งหมด</button>
        </div>
      )}
      {!readOnly && <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: 6 }}>
        แป้นพิมพ์: ← → เลื่อนช่อง · {nV > 1 ? '↑ ↓ / Tab สลับบรรทัดเครื่อง' : '↑ ↓ เลื่อนทีละห้อง'} · 1–9 ใส่พยางค์ · - หรือ Backspace ลบ · Space ฟัง/หยุด
      </div>}

      {/* ข้อความโน้ต (แก้ตรงได้) */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginBottom: 3 }}>โน้ตแบบข้อความ (คัดลอก/วางได้{nV > 1 ? ` · บรรทัดละเครื่อง: ${labels.join(' / ')}` : ''})</div>
        <textarea className="form-input" rows={Math.max(2, nV)} value={text} readOnly={readOnly}
          style={{ fontFamily: 'monospace', fontSize: '0.8rem', width: '100%', resize: 'vertical' }}
          onChange={e => setText(e.target.value)} onBlur={() => { if (!readOnly && text !== voicesToText(voices)) applyText(); }} />
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
