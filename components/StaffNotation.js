'use client';
import { useEffect, useRef, useState } from 'react';
import { parseVerse } from './NotationPlayer';

// ด ร ม ฟ ซ ล ท → C D E F G A B (การปริวรรตโดยอนุโลม)
const THAI_TO_WESTERN = { 'ด':'c', 'ร':'d', 'ม':'e', 'ฟ':'f', 'ซ':'g', 'ล':'a', 'ท':'b' };

function loadVexFlow() {
  return new Promise((resolve) => {
    if (window.Vex) { resolve(window.Vex); return; }
    const js = document.createElement('script');
    js.src = 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js';
    js.onload = () => resolve(window.Vex);
    document.head.appendChild(js);
  });
}

// แปลงวรรค (16 ตำแหน่ง) → 4 ห้อง แต่ละห้องเป็น list ของ {keys, duration, isRest}
function verseToMeasures(positions) {
  const measures = [];
  const nMeasures = Math.max(1, Math.ceil(positions.length / 4));
  for (let m = 0; m < nMeasures; m++) {
    const slice = positions.slice(m * 4, m * 4 + 4);
    const events = [];
    let p = 0;
    while (p < 4) {
      const notes = slice[p];
      if (notes.length === 0) {
        // rest — นับช่องว่างติดกัน
        let span = 1;
        while (p + span < 4 && slice[p + span].length === 0) span++;
        events.push({ rest: true, units: span });
        p += span;
      } else {
        // โน้ต — นับช่องว่างตามหลัง (เสียงลาก)
        let span = 1;
        while (p + span < 4 && slice[p + span].length === 0) span++;
        events.push({ notes, units: span, pos: m * 4 + p });
        p += span;
      }
    }
    measures.push(events);
  }
  return measures;
}

const UNIT_DUR = { 1: '8', 2: 'q', 3: 'qd', 4: 'h' };

function noteKey(n) {
  const base = THAI_TO_WESTERN[n.ch] ?? 'c';
  const octave = 4 + (n.register ?? 0);
  return `${base}/${octave}`;
}

// ค่าความสูงเสียงไว้เรียงคอร์ดต่ำ→สูง
const PITCH_ORDER = { c:0, d:1, e:2, f:3, g:4, a:5, b:6 };
function keyPitch(k) {
  const [b, o] = k.split('/');
  return parseInt(o) * 7 + (PITCH_ORDER[b] ?? 0);
}
// รวมโน้ตสองมือที่ตำแหน่งเดียวกัน → คีย์คอร์ด (ตัดซ้ำ, เรียงต่ำ→สูง)
function mergeHands(rhNotes, lhNotes) {
  const keys = [...new Set([...(lhNotes ?? []), ...(rhNotes ?? [])].map(noteKey))];
  keys.sort((a, b) => keyPitch(a) - keyPitch(b));
  return keys;
}

export default function StaffNotation({ verses }) {
  const ref = useRef(null);
  const hasHands = verses.some(v => (v.right_hand ?? '').trim() || (v.left_hand ?? '').trim());
  const [source, setSource] = useState('combined'); // 'combined' | 'hands'

  useEffect(() => {
    let cancelled = false;
    loadVexFlow().then((Vex) => {
      if (cancelled || !ref.current) return;
      const VF = Vex.Flow;
      ref.current.innerHTML = '';

      const measureWidth = 170;
      const rowWidth = measureWidth * 4 + 60;

      verses.forEach((v, vi) => {
        const div = document.createElement('div');
        const label = document.createElement('div');
        label.textContent = `วรรค ${v.verse_no}${v.section ? ' · ' + v.section : ''}`;
        label.style.cssText = 'font-size:0.62rem;color:#8A9BB5;margin:8px 0 2px';
        ref.current.appendChild(label);
        ref.current.appendChild(div);

        let positions, handPos = null;
        if (source === 'hands' && ((v.right_hand ?? '').trim() || (v.left_hand ?? '').trim())) {
          const rh = parseVerse(v.right_hand);
          const lh = parseVerse(v.left_hand);
          const len = Math.max(rh.length, lh.length);
          handPos = Array.from({ length: len }, (_, i) => ({ rh: rh[i] ?? [], lh: lh[i] ?? [] }));
          positions = handPos.map(hp => [...hp.rh, ...hp.lh]); // สำหรับนับ rest/span
        } else {
          positions = parseVerse(v.combined);
        }
        const measures = verseToMeasures(positions);
        const rowWidth = measureWidth * measures.length + 60;

        const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
        renderer.resize(rowWidth, 110);
        const ctx = renderer.getContext();
        ctx.setFillStyle('#F5F0E8'); ctx.setStrokeStyle('#F5F0E8');

        let x = 10;
        measures.forEach((events, mi) => {
          const stave = new VF.Stave(x, 10, measureWidth + (mi === 0 ? 50 : 0));
          if (mi === 0) { stave.addClef('treble').addTimeSignature('2/4'); }
          stave.setContext(ctx).draw();

          const vexNotes = [];
          events.forEach(ev => {
            let dur = UNIT_DUR[ev.units] ?? '8';
            const dotted = dur.endsWith('d');
            if (dotted) dur = dur[0];
            if (ev.rest) {
              const n = new VF.StaveNote({ keys: ['b/4'], duration: dur + 'r' });
              if (dotted) VF.Dot.buildAndAttach([n], { all: true });
              vexNotes.push(n);
            } else if (handPos && ev.pos != null
                && (handPos[ev.pos].rh.length <= 1 && handPos[ev.pos].lh.length <= 1)) {
              // สองมือ: ตำแหน่งปกติ → คอร์ดคู่เสียง (คู่ 4 5 6 8 ตามจริง)
              const keys = mergeHands(handPos[ev.pos].rh, handPos[ev.pos].lh);
              const n = new VF.StaveNote({ keys, duration: dur });
              if (dotted) VF.Dot.buildAndAttach([n], { all: true });
              vexNotes.push(n);
            } else if (ev.notes.length === 1) {
              const n = new VF.StaveNote({ keys: [noteKey(ev.notes[0])], duration: dur });
              if (dotted) VF.Dot.buildAndAttach([n], { all: true });
              vexNotes.push(n);
            } else {
              // สะบัด: หลายโน้ตในหนึ่งตำแหน่ง → เขบ็ตย่อย 16
              const subNotes = ev.notes.slice(0, 2).map(n =>
                new VF.StaveNote({ keys: [noteKey(n)], duration: '16' }));
              vexNotes.push(...subNotes);
              // เติมเวลาที่เหลือถ้ามีเสียงลาก
              if (ev.units >= 2) {
                const sustain = new VF.StaveNote({
                  keys: [noteKey(ev.notes[ev.notes.length - 1])],
                  duration: ev.units === 2 ? '8' : ev.units === 3 ? 'q' : 'q',
                });
                vexNotes.push(sustain);
              }
            }
          });

          try {
            const voice = new VF.Voice({ num_beats: 2, beat_value: 4 }).setStrict(false);
            voice.addTickables(vexNotes);
            new VF.Formatter().joinVoices([voice]).format([voice], measureWidth - 30);
            const beams = VF.Beam.generateBeams(vexNotes.filter(n => !n.isRest()));
            voice.draw(ctx, stave);
            beams.forEach(b => b.setContext(ctx).draw());
          } catch (e) { /* ห้องที่ format ไม่ได้ ข้าม */ }

          x += measureWidth + (mi === 0 ? 50 : 0);
        });
      });
    });
    return () => { cancelled = true; };
  }, [verses, source]);

  return (
    <div>
      <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',marginBottom:'8px'}}>
        <span style={{fontSize:'0.72rem',color:'var(--muted)'}}>แหล่งทำนอง:</span>
        <select className="form-input" style={{width:'auto',fontSize:'0.78rem',padding:'4px 8px'}}
          value={source} onChange={e => setSource(e.target.value)}>
          <option value="combined">บรรทัดเดียว — ทำนองรวม (โน้ตหัวเดียว)</option>
          {hasHands && <option value="hands">สองบรรทัด — รวมมือ R+L (บันทึกคู่เสียง)</option>}
        </select>
        {!hasHands && <span style={{fontSize:'0.66rem',color:'var(--muted)'}}>* เพลงนี้มีข้อมูลบรรทัดเดียว</span>}
      </div>
      <div style={{fontSize:'0.68rem',color:'var(--muted)',marginBottom:'6px'}}>
        * การปริวรรตเป็นโน้ตสากลใช้การเทียบโดยอนุโลม (ด→C) — ระดับเสียงจริงเป็นระบบ 7 เท่าไทย
        {source === 'hands' && ' · ตำแหน่งที่สองมือบรรเลงพร้อมกันบันทึกเป็นคู่เสียง (คู่ 4 · 5 · 6 · 8 ตามข้อมูลจริง)'}
      </div>
      <div ref={ref} style={{background:'var(--navy3)',border:'1px solid var(--border)',
        borderRadius:'8px',padding:'1rem',overflowX:'auto'}} />
    </div>
  );
}
