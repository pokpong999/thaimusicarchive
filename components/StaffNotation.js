'use client';
import { useEffect, useRef, useState } from 'react';
import { parseVerse } from './NotationPlayer';
import { usePermissions } from './Gate';
import { toMeasures, checkBars, pickupFor, UNITS_PER_HONG } from '../lib/staff';

// ด ร ม ฟ ซ ล ท → C D E F G A B (การปริวรรตโดยอนุโลม)
const THAI_TO_WESTERN = { 'ด':'c', 'ร':'d', 'ม':'e', 'ฟ':'f', 'ซ':'g', 'ล':'a', 'ท':'b' };
const PITCH_ORDER = { c:0, d:1, e:2, f:3, g:4, a:5, b:6 };

function loadVexFlow() {
  return new Promise((resolve) => {
    if (window.Vex) { resolve(window.Vex); return; }
    const js = document.createElement('script');
    js.src = 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js';
    js.onload = () => resolve(window.Vex);
    document.head.appendChild(js);
  });
}

function noteKey(n) {
  const base = THAI_TO_WESTERN[n.ch] ?? 'c';
  const octave = 4 + (n.register ?? 0);
  return `${base}/${octave}`;
}
function keyPitch(k) { const [b, o] = k.split('/'); return parseInt(o) * 7 + (PITCH_ORDER[b] ?? 0); }
function mergeHands(rhNotes, lhNotes) {
  const keys = [...new Set([...(lhNotes ?? []), ...(rhNotes ?? [])].map(noteKey))];
  keys.sort((a, b) => keyPitch(a) - keyPitch(b));
  return keys;
}

// ★ ตรรกะการแปลงย้ายไปอยู่ lib/staff.js แล้ว เพื่อให้ทดสอบด้วยเครื่องได้

const MW_MIN = 64;       // ความกว้างห้องเต็ม (4 ตำแหน่ง) แคบสุด — ต่ำกว่านี้ยอมให้เลื่อนแนวนอน
const MW_MAX = 150;      // ความกว้างห้องกว้างสุด
const CLEF_PAD = 52;     // พื้นที่กุญแจ+เครื่องหมายจังหวะ (ห้องแรกของบรรทัด)
const ROW_PAD = 30;      // ขอบซ้าย 10 + ขอบขวา 20
const ROW_H = 185;       // สูงพอสำหรับโน้ตต่ำ-สูงหลายเส้นน้อย
const STAVE_Y = 48;
const PER_ROW = 8;       // 8 ห้องต่อบรรทัด (นับเป็นหน่วยห้องเต็ม 4 ตำแหน่ง)

// น้ำหนักความกว้างของห้องตามจำนวนตำแหน่ง — ห้องยก 3 ตำแหน่ง / ห้องเศษ 1 ตำแหน่ง ไม่ควรกว้างเท่าห้องเต็ม
function sliceWeight(size) {
  return size >= 4 ? 1 : size === 3 ? 0.8 : size === 2 ? 0.6 : 0.42;
}

export default function StaffNotation({ verses, cursor = null }) {
  const ref = useRef(null);
  const geomRef = useRef([]);   // [{verseIdx, rowEl, rects:[{x,w,start,size}], len}]
  const hasHands = verses.some(v => (v.right_hand ?? '').trim() || (v.left_hand ?? '').trim() || (v.third_hand ?? '').trim());
  const { can } = usePermissions();
  const [source, setSource] = useState('combined');
  const [beat, setBeat] = useState('thai'); // 'thai' ตกท้ายห้อง | 'western' ตกต้นห้อง
  const [fitTick, setFitTick] = useState(0);
  useEffect(() => {
    if (!can('staff_chord') && source === 'hands') setSource('combined');
    if (!can('staff_beat') && beat === 'western') setBeat('thai');
  }, [can, source, beat]);

  useEffect(() => {
    let t;
    const onR = () => { clearTimeout(t); t = setTimeout(() => setFitTick(x => x + 1), 250); };
    window.addEventListener('resize', onR);
    return () => { window.removeEventListener('resize', onR); clearTimeout(t); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Vex = await loadVexFlow();
      {
      if (cancelled || !ref.current) return;
      const VF = (Vex && Vex.Flow) || window.VexFlow;
      if (!VF) throw new Error('โหลดไลบรารีโน้ตสากลไม่สำเร็จ');
      ref.current.innerHTML = '';
      geomRef.current = [];
      // ความกว้างที่ใช้วางห้องได้จริง = กล่อง − padding 1rem สองข้าง − กุญแจ − ขอบ
      const boxW = (ref.current.clientWidth || 1100) - 34;
      const avail = boxW - CLEF_PAD - ROW_PAD;
      // จำนวนห้องเต็มต่อบรรทัดที่พอดีจอ: ปกติ 8 · จอแคบลดลงตามจริง (อย่างน้อยเท่ากับ 1 วรรค)
      const fitMeasures = Math.max(1, Math.min(PER_ROW, Math.floor(avail / MW_MIN)));

      // เตรียมข้อมูลทุกวรรค
      const prepared = verses.map((v, vi) => {
        let positions, handPos = null;
        if (source === 'hands' && ((v.right_hand ?? '').trim() || (v.left_hand ?? '').trim())) {
          const rh = parseVerse(v.right_hand);
          const lh = parseVerse(v.left_hand);
          // ขิม 3 บรรทัด: บรรทัดบน (สูง) = กุญแจซอล · กลาง + ต่ำ = กุญแจฟา
          const xh = (v.third_hand ?? '').trim() ? parseVerse(v.third_hand) : [];
          const len = Math.max(rh.length, lh.length, xh.length);
          handPos = Array.from({ length: len }, (_, i) => ({ rh: rh[i] ?? [], lh: [...(lh[i] ?? []), ...(xh[i] ?? [])] }));
          positions = handPos.map(hp => [...hp.rh, ...hp.lh]);
        } else {
          positions = parseVerse(v.combined);
        }
        return { vi, v, positions, handPos, measures: positions.length / 4 };
      });

      // จัดกลุ่มวรรคลงบรรทัด: นับเป็นห้องเต็ม (4 ตำแหน่ง) ไม่เกิน fitMeasures — ปกติ 2 วรรค/บรรทัด
      const rows = [];
      let cur = [], curCount = 0;
      prepared.forEach(pv => {
        if (curCount > 0 && curCount + pv.measures > fitMeasures) {
          rows.push(cur); cur = []; curCount = 0;
        }
        cur.push(pv); curCount += pv.measures;
      });
      if (cur.length) rows.push(cur);

      rows.forEach(rowVerses => {
        // ต่อวรรคในบรรทัดเป็นสายเดียว แล้วค่อยแบ่งห้อง — แบบสากล ห้องยกท้ายวรรคจะรวมกับห้องต้นวรรคถัดไป
        // (เดิมแบ่งทีละวรรค เกิดห้องเศษ 1 ตำแหน่ง + ห้องยก 3 ตำแหน่งติดกันกลางบรรทัด และกว้างเท่าห้องเต็ม)
        const stream = [], handStream = [], verseMap = [];
        rowVerses.forEach(pv => {
          verseMap.push({ verseIdx: pv.vi, offset: stream.length, len: pv.positions.length });
          stream.push(...pv.positions);
          pv.positions.forEach((_, i) => handStream.push(pv.handPos ? pv.handPos[i] : null));
        });
        // ★ แปลงด้วย lib/staff.js — รับประกันว่าทุกห้องครบจังหวะ (ทดสอบไว้ 63 ข้อ)
        const measures = toMeasures(stream, { pickup: pickupFor(beat, stream.length) });
        const wrong = checkBars(measures);
        if (wrong.length) console.warn('StaffNotation: ห้องไม่ครบจังหวะ', wrong);
        const slices = measures.map(m => ({ start: m.start, size: m.size, events: m.events }));
        const totalWeight = slices.reduce((s, sl) => s + sliceWeight(sl.size), 0);
        // บีบ/ขยายให้พอดีความกว้างกล่อง — ล้นได้เฉพาะเมื่อแม้แต่วรรคเดียวก็ยังแคบกว่า MW_MIN (แล้วค่อยเลื่อนแนวนอน)
        const unit = Math.max(MW_MIN, Math.min(MW_MAX, Math.floor(avail / totalWeight)));
        const widths = slices.map(sl => Math.floor(unit * sliceWeight(sl.size)));
        const rowWidth = CLEF_PAD + widths.reduce((a, b) => a + b, 0) + ROW_PAD;

        const label = document.createElement('div');
        label.textContent = 'วรรค ' + rowVerses.map(pv =>
          `${pv.v.verse_no}${pv.v.section ? ' (' + pv.v.section + ')' : ''}`).join(' · ');
        label.style.cssText = 'font-size:0.62rem;color:#8A9BB5;margin:10px 0 2px';
        ref.current.appendChild(label);

        const rowEl = document.createElement('div');
        rowEl.style.cssText = 'position:relative;width:max-content;max-width:100%';
        ref.current.appendChild(rowEl);
        const div = document.createElement('div');
        rowEl.appendChild(div);

        const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
        renderer.resize(rowWidth, ROW_H);
        const ctx = renderer.getContext();
        ctx.setFillStyle('#F5F0E8'); ctx.setStrokeStyle('#F5F0E8');

        const rects = [];
        const rowNotes = [];    // โน้ตทุกตัวในบรรทัดนี้ เรียงตามเวลา
        const rowTies = [];     // {from} = ดัชนีในบรรทัด · โยงไปตัวถัดไปเสมอ
        let x = 10;
        slices.forEach((slice, si) => {
          const first = si === 0;
          const w = widths[si] + (first ? CLEF_PAD : 0);
          const stave = new VF.Stave(x, STAVE_Y, w);
          if (first) stave.addClef('treble').addTimeSignature('2/4');
          stave.setContext(ctx).draw();

          const vexNotes = [];
          slice.events.forEach(ev => {
            const hp = handStream[ev.pos];
            // ★ จุดต้องอยู่ใน "ชื่อค่าโน้ต" (qd) ไม่ใช่ไปติดทีหลัง
            //   Dot.buildAndAttach วาดจุดให้แต่ไม่นับความยาว ห้องจึงขาดไป 1 ตำแหน่ง
            const mk = (keys, duration) => new VF.StaveNote({ keys, duration });
            if (ev.kind === 'rest') {
              vexNotes.push(mk(['b/4'], ev.duration + 'r'));
              return;
            }
            if (ev.kind === 'sabat') {
              // สะบัด: เขบ็ดสองชั้นสองตัวใน 1 ตำแหน่ง
              const pair = ev.notes.slice(0, 2).map(n =>
                new VF.StaveNote({ keys: [noteKey(n)], duration: '16' }));
              vexNotes.push(...pair);
              rowNotes.push(...pair);
              if (ev.tieTo) rowTies.push({ from: rowNotes.length - 1 });
              return;
            }
            const keys = (hp && hp.rh.length <= 1 && hp.lh.length <= 1)
              ? mergeHands(hp.rh, hp.lh)
              : ev.notes.map(noteKey);
            const n = mk(keys.length ? keys : ['c/4'], ev.duration);
            vexNotes.push(n); rowNotes.push(n);
            if (ev.tieTo) rowTies.push({ from: rowNotes.length - 1 });
          });

          try {
            /* ★ setStrict(true) — ห้องที่ไม่ครบจังหวะจะโยน error ทันที
               ของเดิมปิดการตรวจไว้ ห้องที่ผิดจึงวาดออกมาเฉย ๆ โดยไม่มีอะไรเตือน
               (นี่คือต้นเหตุที่ Pk เห็น "โน้ตไม่ครบห้อง" — Pk 1 ก.ย. 69) */
            const voice = new VF.Voice({ num_beats: slice.size, beat_value: 8 }).setStrict(true);
            voice.addTickables(vexNotes);
            new VF.Formatter().joinVoices([voice]).format([voice], Math.max(20, widths[si] - 26));
            // คานเชื่อมเขบ็ดตามจังหวะ (กลุ่มละ 1 จังหวะ = 2 เขบ็ด) — ไม่ให้เขบ็ดโดดเดี่ยวมีธงเดี่ยว
            const beams = VF.Beam.generateBeams(vexNotes, {
              groups: [new VF.Fraction(1, 4)],
              beam_rests: false, maintain_stem_directions: false,
            });
            voice.draw(ctx, stave);
            beams.forEach(b => b.setContext(ctx).draw());
          } catch (e) {
            console.warn('StaffNotation ห้องที่วาดไม่ได้:', e?.message ?? e);
          }

          rects.push({ x: x + (first ? CLEF_PAD : 0), w: widths[si], start: slice.start, size: slice.size });
          x += w;
        });

        /* ★ เส้นโยงเสียงลาก — วาดหลังจากวาดห้องครบทั้งบรรทัดแล้ว
           เดิมวาดทีละห้อง เส้นที่ต้องข้ามไปห้องถัดไปจึงไม่มีปลายทาง วาดไม่ได้เลย
           ผลคือ "ด ค้างสี่ห้อง" ออกมาเป็นตัวขาวสี่ตัวติดกัน = อ่านว่าตีสี่ครั้ง ไม่ใช่ลากเสียง
           (Pk 1 ก.ย. 69)                                                            */
        rowTies.forEach(tp => {
          const a = rowNotes[tp.from], b2 = rowNotes[tp.from + 1];
          if (!a || !b2) return;
          if (a.isRest?.() || b2.isRest?.()) return;
          try {
            new VF.StaveTie({ first_note: a, last_note: b2,
              first_indices: [0], last_indices: [0] }).setContext(ctx).draw();
          } catch (e) { /* ปลายทางอยู่คนละบรรทัด ข้ามไป */ }
        });
        geomRef.current.push({ rowEl, rects, verses: verseMap });
      });
      }
    })().catch(err => {
      console.error('StaffNotation:', err);
      if (ref.current) ref.current.innerHTML =
        '<div style="color:#8A9BB5;font-size:0.85rem;padding:1rem">' +
        'แสดงโน้ตสากลไม่สำเร็จ: ' + (err?.message ?? err) + '</div>';
    });
    return () => { cancelled = true; };
  }, [verses, source, beat, fitTick]);

  // ── แถบไฮไลต์ + เส้นตำแหน่งที่กำลังเล่น ──
  useEffect(() => {
    // ล้างของเก่า
    document.querySelectorAll('.staff-cursor-line, .staff-cursor-band').forEach(el => el.remove());
    if (!cursor) return;
    // หาบรรทัดที่มีวรรคนี้ แล้วแปลงตำแหน่งในวรรคเป็นตำแหน่งในสายของบรรทัด
    let g = null, vm = null;
    for (const row of geomRef.current) {
      vm = row.verses.find(v => v.verseIdx === cursor.verseIdx);
      if (vm) { g = row; break; }
    }
    if (!g) return;
    const gpos = vm.offset + cursor.pos;
    const rect = g.rects.find(r => gpos >= r.start && gpos < r.start + r.size);
    if (!rect) return;

    // แถบไฮไลต์ทั้งห้อง
    const band = document.createElement('div');
    band.className = 'staff-cursor-band';
    band.style.cssText = `position:absolute;top:${STAVE_Y - 14}px;height:86px;left:${rect.x}px;width:${rect.w}px;`
      + 'background:rgba(201,168,76,0.13);border-radius:4px;pointer-events:none';
    g.rowEl.appendChild(band);

    // เส้นวิ่งตามตำแหน่ง
    const frac = (gpos - rect.start + 0.5) / rect.size;
    const lx = rect.x + 6 + frac * (rect.w - 22);
    const line = document.createElement('div');
    line.className = 'staff-cursor-line';
    line.style.cssText = `position:absolute;top:${STAVE_Y - 14}px;height:86px;left:${lx}px;width:2px;`
      + 'background:#C9A84C;box-shadow:0 0 6px rgba(201,168,76,0.8);pointer-events:none';
    g.rowEl.appendChild(line);

    g.rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cursor]);

  return (
    <div>
      <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',marginBottom:'8px'}}>
        <span style={{fontSize:'0.72rem',color:'var(--muted)'}}>แหล่งทำนอง:</span>
        <select className="form-input" style={{width:'auto',fontSize:'0.78rem',padding:'4px 8px'}}
          value={source} onChange={e => setSource(e.target.value)}>
          <option value="combined">บรรทัดเดียว — ทำนองรวม (โน้ตหัวเดียว)</option>
          {hasHands && can('staff_chord') && <option value="hands">สองบรรทัด — รวมมือ R+L (บันทึกคู่เสียง)</option>}
        </select>
        <span style={{fontSize:'0.72rem',color:'var(--muted)'}}>จังหวะตก:</span>
        <select className="form-input" style={{width:'auto',fontSize:'0.78rem',padding:'4px 8px'}}
          value={beat} onChange={e => setBeat(e.target.value)}>
          <option value="thai">แบบไทย — ตกท้ายห้อง</option>
          {can('staff_beat') && <option value="western">แบบสากล — ตกต้นห้อง (ยกเข้าห้องถัดไป)</option>}
        </select>
      </div>
      <div style={{fontSize:'0.68rem',color:'var(--muted)',marginBottom:'6px'}}>
        * การปริวรรตเป็นโน้ตสากลใช้การเทียบโดยอนุโลม (ด→C) — ระดับเสียงจริงเป็นระบบ 7 เท่าไทย
        {source === 'hands' && ' · ตำแหน่งที่สองมือพร้อมกันบันทึกเป็นคู่เสียง (คู่ 4 · 5 · 6 · 8 ตามจริง)'}
        {beat === 'western' && ' · จังหวะตก (ลูกตก) อยู่ต้นห้อง โน้ตช่วงแรกของวรรคเป็นห้องยก (anacrusis)'}
      </div>
      <div ref={ref} style={{background:'var(--navy3)',border:'1px solid var(--border)',
        borderRadius:'8px',padding:'1rem',overflowX:'auto'}} />
    </div>
  );
}
