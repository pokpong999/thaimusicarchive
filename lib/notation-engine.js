// lib/notation-engine.js — กระดานโน้ตไทย (เอนจินฝั่ง DOM, ไม่ผูกกับ React)
// React ห่อด้วย components/NotationInput.js · ตรรกะดนตรีทั้งหมดอยู่ใน lib/notation-core.js
import {
  NOTES, HIGH, LOW, KEYMAP, KEY_OF, SABAT_GAP_DEFAULT,
  noteText, noteKey, splitLine, mkVerse, hongOf, hasSound,
  krasuanOf, verseCode, luktokOf, pairId, chingAt, CHING_CYCLE, buildVoices,
  textToVerses, versesToText, checkVerses, statsOf, trimVerses, parseHand, formatHand, HANDS, cellNotes, cellFirst,
  markAt, setMark, kroSpans, kroStrikes, KRO_GAP_DEFAULT, DAMP_DUR_DEFAULT,
  isDamp, setDamp, dampMask, DAMP_ALL, pairLead,
} from './notation-core';
import { SYSTEMS, SYSTEM_KEYS, systemOf, linesOf, handsOf, lineCount, systemForLines, autoOctaveOf } from './notation-systems';
import { BUILTIN_TUNINGS, DEFAULT_TUNING, hzOf, tuningBySlug, tuningForEnsemble, ensembleOf } from './tuning';
import { stepOf, noteOfStep } from './instruments';
import { TANGS, tangOf, tonicOf, scaleText, pentaText, shiftBetween, bestShift, guessTang,
         ensembleOffset, ENSEMBLES, WRITABLE_MIN, WRITABLE_MAX } from './tang';

// เลขรุ่นกระดาน — โชว์บนแถบบนสุด ให้เช็กได้ว่าไฟล์บนเว็บเป็นรุ่นไหน (เปลี่ยนทุกครั้งที่ส่งไฟล์ใหม่)
export const ENGINE_VERSION = '27 ส.ค. 69 · r10';
// กดโน้ตค้างนานกว่านี้ (มิลลิวินาที) = ประคบ — สั้นพอให้รู้ว่า "ค้าง" แต่ไม่ต้องรอ (Pk 26 ส.ค. 69)
export const HOLD_DAMP_MS = 250;

const $el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

export const ENGINE_CSS = `
.thn{--thn-bg:var(--navy3,#1E3050);--thn-sunk:var(--navy,#0F1B2D);--thn-raised:var(--navy2,#162336);
  --thn-ink:var(--cream,#F5F0E8);--thn-muted:var(--muted,#8A9BB5);--thn-line:var(--border,#2A3F5C);
  --thn-gold:var(--gold,#C9A84C);--thn-gold2:var(--gold2,#E8C96A);--thn-jade:var(--jade,#4C9A84);
  --thn-alert:var(--danger,#D47A8F);--cw:2.15rem;font-family:'Noto Sans Thai',sans-serif;color:var(--thn-ink)}
.thn *{box-sizing:border-box}
.thn-bar{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;background:var(--thn-raised);
  border:1px solid var(--thn-line);border-radius:8px;padding:.55rem .7rem;margin-bottom:.6rem}
.thn-seg{display:flex;background:var(--thn-sunk);border-radius:6px;padding:2px;gap:2px}
.thn-seg button{background:transparent;border:0;color:var(--thn-muted);font:inherit;font-size:.82rem;
  padding:7px 13px;min-height:32px;border-radius:5px;cursor:pointer;white-space:nowrap}
.thn-seg button[aria-pressed="true"]{background:var(--thn-gold);color:var(--thn-sunk);font-weight:600}
.thn-btn{background:var(--thn-sunk);border:1px solid var(--thn-line);color:var(--thn-ink);font:inherit;
  font-size:.82rem;padding:7px 13px;min-height:34px;border-radius:6px;cursor:pointer;white-space:nowrap;
  display:inline-flex;align-items:center;justify-content:center;gap:4px}
.thn-btn:hover{border-color:var(--thn-gold);color:var(--thn-gold)}
.thn-btn.on{background:rgba(201,168,76,.15);border-color:var(--thn-gold);color:var(--thn-gold)}
.thn-btn[disabled]{opacity:.55;cursor:default}
.thn-btn.play{background:var(--thn-jade);border-color:var(--thn-jade);color:#fff;font-weight:600}
.thn-btn.stop{background:rgba(212,122,143,.14);border-color:var(--thn-alert);color:var(--thn-alert)}
.thn-sep{width:1px;align-self:stretch;background:var(--thn-line);margin:0 .2rem}
.thn-note{font-size:.7rem;color:var(--thn-muted);margin-left:auto;font-family:monospace;white-space:nowrap;min-width:34ch;text-align:right}
.thn-pick{display:flex;align-items:center;gap:5px;font-size:.74rem;color:var(--thn-muted);white-space:nowrap}
.thn-pick select{background:var(--thn-sunk);border:1px solid var(--thn-line);border-radius:5px;color:var(--thn-ink);
  font:inherit;font-size:.8rem;padding:6px 8px;min-height:32px;outline:none;cursor:pointer}
.thn-split{font-family:monospace;font-size:.7rem;color:var(--thn-jade);white-space:nowrap}
.thn-rng{display:flex;align-items:center;gap:.4rem;font-size:.72rem;color:var(--thn-muted)}
.thn-rng input[type=range]{accent-color:var(--thn-gold);width:6.5rem}
.thn-rng b{font-family:monospace;color:var(--thn-ink);font-variant-numeric:tabular-nums}
.thn-chk{display:flex;align-items:center;gap:5px;font-size:.75rem;cursor:pointer}
.thn-chk input{accent-color:var(--thn-gold)}
.thn-score{background:var(--thn-bg);border:1px solid var(--thn-line);border-radius:8px;padding:.3rem 0 .8rem;
  overflow-x:auto;outline:none}
.thn-score:focus-visible{border-color:var(--thn-gold)}
.thn-sec{display:flex;align-items:center;gap:.6rem;padding:.9rem 1rem .3rem;position:sticky;left:0}
.thn-sec-name{font-weight:600;font-size:.9rem;color:var(--thn-gold)}
.thn-sec-rule{flex:1;height:1px;background:var(--thn-line)}
.thn-sec-meta{font-family:monospace;font-size:.66rem;color:var(--thn-muted)}
.thn-row{display:flex;flex-direction:column;gap:.2rem;padding:.5rem 1rem;width:max-content;min-width:100%;
  border-bottom:1px dashed rgba(42,63,92,.6)}
.thn-row:last-child{border-bottom:none}
.thn-top{display:flex;align-items:flex-start;gap:.55rem}
.thn-info{position:sticky;left:1rem;display:flex;flex-wrap:wrap;gap:.2rem 1rem;align-items:baseline;
  padding-left:4.15rem;width:max-content}
.thn-vlabel{width:3.6rem;flex:none;text-align:right;padding-top:1.25rem;font-family:monospace;
  font-size:.7rem;color:var(--thn-muted)}
.thn-vlabel b{color:var(--thn-ink);font-weight:600}
.thn-hands{display:flex;flex-direction:column;gap:2px}
.thn-hrow{display:flex;align-items:center;gap:.5rem;position:relative}
.thn-htag{width:.9rem;flex:none;font-family:monospace;font-size:.62rem;color:var(--thn-muted);text-align:center}
.thn-bars{display:flex;gap:.5rem;align-items:center}
.thn-grp{display:flex;gap:2px;padding:2px;border-radius:5px}
.thn-grp.cells{background:var(--thn-sunk)}
.thn-vsep{width:2px;flex:none;align-self:stretch;background:var(--thn-line);margin:0 .3rem;border-radius:2px}
.thn-vsep.ghost{background:transparent}
.thn:not(.readonly) .thn-hrow .thn-vsep:not(.ghost){cursor:col-resize;position:relative}
.thn:not(.readonly) .thn-hrow .thn-vsep:not(.ghost)::before{content:'';position:absolute;left:-6px;right:-6px;top:0;bottom:0}
.thn:not(.readonly) .thn-hrow .thn-vsep:not(.ghost):hover,.thn-vsep.dragging{background:var(--thn-gold2);width:3px;box-shadow:0 0 6px rgba(232,201,106,.7)}
.thn-grp.cells.split-before{box-shadow:-5px 0 0 0 var(--thn-gold2)}
.thn-grp.cells.split-after{box-shadow:5px 0 0 0 var(--thn-gold2)}
.thn.splitting, .thn.splitting *{cursor:col-resize!important}
.thn-newsep{display:inline-flex;align-items:center;justify-content:center;margin-top:.35rem;padding:0 .5rem;min-height:30px;min-width:26px;
  border:1px dashed var(--thn-line);border-radius:4px;color:var(--thn-gold2);
  font-family:monospace;font-size:.95rem;line-height:1.3;cursor:grab;user-select:none}
.thn-newsep:hover{border-color:var(--thn-gold2);background:rgba(232,201,106,.12)}
.thn.readonly .thn-newsep{display:none}
.thn-sec-tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.thn-sec-tools button{background:var(--thn-sunk);border:1px solid var(--thn-line);color:var(--thn-ink);font:inherit;font-size:.8rem;
  padding:5px 10px;min-height:32px;border-radius:5px;cursor:pointer;white-space:nowrap;line-height:1.3;
  display:inline-flex;align-items:center;justify-content:center;gap:3px}
.thn-sec-tools button:hover{border-color:var(--thn-gold);color:var(--thn-gold);background:rgba(201,168,76,.12)}
.thn-sec-tools button[disabled]{opacity:.45;cursor:default}
/* ปุ่มลบทั้งท่อน — งานอันตราย ต้องเห็นชัดว่าเป็นปุ่มลบ และแยกห่างจากปุ่มข้าง ๆ ไม่ให้กดพลาด */
.thn-sec-tools button.danger{background:rgba(212,122,143,.14);border-color:var(--thn-alert);color:var(--thn-alert);
  font-weight:600;margin-left:10px;min-width:44px}
.thn-sec-tools button.danger:hover{background:rgba(212,122,143,.3);border-color:var(--thn-alert);color:#fff}
.thn.readonly .thn-sec-tools{display:none}
.thn-cell{width:var(--cw);height:var(--cw);display:flex;align-items:center;justify-content:center;border-radius:3px;
  cursor:pointer;position:relative;font-size:1.05rem;line-height:1;color:var(--thn-ink);border:1px solid transparent;
  user-select:none;overflow:hidden}
.thn-cell .gl{display:block;text-align:center;line-height:1;font-family:'THNotation',serif;font-size:1.18em}
.thn.fnt-unicode .thn-cell .gl{font-family:'Noto Sans Thai',sans-serif;font-size:1em}
.thn-cell.sabat{justify-content:space-evenly;padding:0 1px}
.thn-cell.sabat .gl{color:var(--thn-jade)}
.thn.fnt-unicode .thn-cell.sabat .gl{font-size:.86em}
.thn-cell.beat{background:rgba(201,168,76,.10)}
.thn-cell.empty .gl{color:var(--thn-muted);opacity:.55}
.thn-cell.lead .gl{color:var(--thn-jade)}
.thn-cell:hover{background:rgba(201,168,76,.18)}
.thn-cell.sel{background:rgba(76,154,132,.28);border-color:rgba(76,154,132,.6)}
.thn-cell.sel.beat{background:rgba(76,154,132,.36)}
.thn.readonly .thn-selbar{display:none}
.thn-selbar{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;padding:.35rem .5rem;border:1px dashed rgba(76,154,132,.5);border-radius:6px;margin:.35rem 0}
.thn-selbar .thn-mini{margin-left:0;flex:1 1 100%;order:99;min-height:1.3em;line-height:1.3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.thn-cell.cur{border-color:var(--thn-gold2);background:rgba(232,201,106,.28);box-shadow:0 0 0 3px rgba(232,201,106,.3)}
.thn-cell.cur::after{content:'';position:absolute;left:3px;right:3px;bottom:-1px;height:2px;background:var(--thn-gold2);
  border-radius:2px;animation:thn-blink 1.15s ease-in-out infinite}
@keyframes thn-blink{0%,100%{opacity:1}50%{opacity:.25}}
.thn-cell.play{background:rgba(76,154,132,.22);border-color:var(--thn-jade)}
.thn-arc{position:absolute;height:8px;border-top:1.6px solid var(--thn-jade);border-radius:50% 50% 0 0/100% 100% 0 0;
  pointer-events:none;opacity:.85}
/* เครื่องหมายวิธีบรรเลง (Pk 2026-08-26): ประคบ = ตัวหนาล้วน ไม่มีเครื่องหมายอื่น · กรอ = คลื่นเหนือโน้ต ยาวถึงเสียงถัดไป */
.thn-cell.damp .gl{font-weight:900;text-shadow:0 0 1px currentColor}
.thn-kro{position:absolute;height:7px;pointer-events:none;color:var(--thn-gold2);opacity:.95;overflow:hidden}
.thn-kro svg{display:block;height:7px;width:100%}
.thn-cell.kro .gl{color:var(--thn-gold2)}
.thn-btn.mark-on{background:rgba(232,201,106,.18);border-color:var(--thn-gold2);color:var(--thn-gold2)}
.thn-ching{height:1rem}
.thn-ching.editable span{cursor:pointer;border-radius:3px;position:relative}
/* พื้นที่กดจริงสูงกว่าตัวอักษร ไม่งั้นคลิกวนฉิ่ง-ฉับ ยากมากบนมือถือ (Pk 27 ส.ค. 69) */
.thn-ching.editable span::before{content:'';position:absolute;left:0;right:0;top:-7px;bottom:-7px}
.thn-ching.editable span:hover{background:rgba(201,168,76,.25);color:var(--thn-gold)}
.thn-ching.editable span:empty::after{content:'·';opacity:.25}
.thn-seclevel{background:var(--thn-sunk);border:1px solid var(--thn-line);border-radius:5px;color:var(--thn-gold);
  font:inherit;font-size:.8rem;padding:5px 8px;min-height:32px;outline:none;cursor:pointer}
.thn-ching span{width:var(--cw);text-align:center;font-family:monospace;font-size:.56rem;color:var(--thn-muted);line-height:1rem}
.thn-kg{width:calc(var(--cw)*4 + 10px);flex:none;text-align:center;font-family:monospace;font-weight:600;
  font-size:.72rem;color:var(--thn-gold);letter-spacing:.06em;line-height:1.3}
.thn-kg.rest{color:var(--thn-muted);opacity:.62;font-weight:400}
.thn:not(.readonly) .thn-kg{cursor:grab}
.thn:not(.readonly) .thn-kg:hover{background:rgba(201,168,76,.14);border-radius:4px}
.thn-grp.cells.moving{opacity:.35;outline:2px dashed var(--thn-gold2)}
.thn-grp.cells.just{animation:thn-just 1.2s ease-out}
@keyframes thn-just{0%{box-shadow:0 0 0 3px var(--thn-gold2);background:rgba(232,201,106,.35)}100%{box-shadow:0 0 0 0 transparent}}
.thn-grp.cells.drop-before{box-shadow:-4px 0 0 0 var(--thn-jade)}
.thn-grp.cells.drop-after{box-shadow:4px 0 0 0 var(--thn-jade)}
.thn-ghost{position:fixed;z-index:9999;pointer-events:none;display:flex;gap:2px;padding:3px 5px;border-radius:6px;
  background:rgba(12,22,38,.95);border:1px solid var(--thn-gold2);box-shadow:0 6px 18px rgba(0,0,0,.45);font-family:'THNotation',serif;font-size:1.1rem;color:var(--thn-ink)}
.thn.fnt-unicode .thn-ghost{font-family:'Noto Sans Thai',sans-serif;font-size:.95rem}
.thn-ghost span{min-width:1.4em;text-align:center}
.thn-ghost small{font-family:sans-serif;font-size:.6rem;color:var(--thn-muted);align-self:center;margin-left:4px}
.thn.grabbing, .thn.grabbing *{cursor:grabbing!important}
.thn-luk{font-family:monospace;font-size:.7rem;color:var(--thn-muted);white-space:nowrap}
.thn-luk b{color:var(--thn-jade);font-weight:600;font-size:.84rem}
.thn-pair{font-family:monospace;font-size:.66rem;color:var(--thn-muted);white-space:nowrap}
.thn-pair b{color:var(--thn-gold);font-weight:600}
.thn-short{font-family:monospace;font-size:.66rem;color:var(--thn-jade);background:rgba(76,154,132,.16);
  border-radius:99px;padding:1px 9px;white-space:nowrap}
.thn-flag{font-size:.63rem;color:var(--thn-alert);white-space:nowrap}
.thn-pad{position:sticky;bottom:0;z-index:20;margin-top:.6rem;background:var(--thn-raised);border:1px solid var(--thn-line);
  border-radius:8px;padding:.6rem;display:flex;flex-wrap:wrap;gap:.45rem;align-items:center}
.thn-regseg button[aria-pressed="true"]{background:var(--thn-jade);color:#fff}
.thn-nkey{min-width:2.7rem;height:2.7rem;background:var(--thn-sunk);border:1px solid var(--thn-line);border-radius:7px;
  color:var(--thn-ink);font-family:'THNotation',serif;font-size:1.32rem;cursor:pointer;display:flex;flex-direction:column;
  align-items:center;justify-content:center;padding:0 .3rem;line-height:1}
.thn.fnt-unicode .thn-nkey{font-family:'Noto Sans Thai',sans-serif;font-size:1.15rem}
.thn-nkey:hover{border-color:var(--thn-gold)}
.thn-nkey small{font-family:monospace;font-size:.53rem;color:var(--thn-muted);line-height:1;margin-top:2px}
.thn-help{font-size:.68rem;color:var(--thn-muted);margin-left:auto;max-width:20rem;line-height:1.55}
.thn-help kbd{font-family:monospace;font-size:.72em;background:var(--thn-sunk);border:1px solid var(--thn-line);
  border-bottom-width:2px;border-radius:4px;padding:1px 5px;color:var(--thn-ink)}
.thn-panels{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-top:.6rem}
@media (max-width:820px){
  .thn-btn{font-size:.86rem;padding:9px 14px;min-height:42px}
  .thn-seg button{font-size:.86rem;padding:9px 14px;min-height:40px}
  .thn-pick select,.thn-seclevel{font-size:16px;min-height:40px}
  .thn-sec-tools{gap:8px}
  .thn-sec-tools button{font-size:.85rem;padding:8px 12px;min-height:40px}
  .thn-sec-tools button.danger{min-width:52px}
  .thn-newsep{min-height:38px;min-width:34px;font-size:1.05rem}.thn-panels{grid-template-columns:1fr}}
.thn-panel{background:var(--thn-raised);border:1px solid var(--thn-line);border-radius:8px;padding:.9rem 1rem}
.thn-plabel{font-family:monospace;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--thn-muted);
  margin:0 0 .7rem;display:flex;gap:.6rem;align-items:center}
.thn-plabel::after{content:'';flex:1;height:1px;background:var(--thn-line)}
.thn-stats{display:flex;flex-wrap:wrap;gap:1.2rem}
.thn-stat b{display:block;font-family:monospace;font-size:1.4rem;font-weight:600;color:var(--thn-gold);line-height:1.1}
.thn-stat span{font-size:.68rem;color:var(--thn-muted)}
.thn-kbars{display:flex;flex-direction:column;gap:.3rem;margin-top:.9rem}
.thn-kbar{display:grid;grid-template-columns:2.4rem 1fr 2.2rem;gap:.55rem;align-items:center;font-size:.72rem}
.thn-kbar code{font-family:monospace;font-weight:600}
.thn-kbar .track{height:7px;background:var(--thn-sunk);border-radius:99px;overflow:hidden}
.thn-kbar .fill{height:100%;background:var(--thn-gold);border-radius:99px}
.thn-kbar .n{font-family:monospace;color:var(--thn-muted);text-align:right}
.thn-checks{display:flex;flex-direction:column;gap:.5rem}
.thn-chkitem{display:flex;gap:.6rem;font-size:.78rem;line-height:1.55;align-items:flex-start}
.thn-chkitem i{flex:none;width:1.1rem;height:1.1rem;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:.66rem;font-style:normal;margin-top:.15rem}
.thn-chkitem.ok i{background:rgba(76,154,132,.18);color:var(--thn-jade)}
.thn-chkitem.warn i{background:rgba(212,122,143,.16);color:var(--thn-alert)}
.thn-chkitem.warn b{color:var(--thn-alert)}
.thn-chkitem em{font-style:normal;color:var(--thn-muted);font-size:.72rem;display:block}
.thn-paste{width:100%;background:var(--thn-sunk);border:1px solid var(--thn-line);border-radius:6px;color:var(--thn-ink);
  font-family:monospace;font-size:.74rem;line-height:1.8;padding:.6rem .7rem;resize:vertical;outline:none;margin-top:.5rem}
.thn-mini{font-size:.7rem;color:var(--thn-muted);margin-left:.5rem}
.thn-mini kbd,.thn-manual kbd{font-family:monospace;font-size:.72em;background:var(--thn-sunk);border:1px solid var(--thn-line);
  border-bottom-width:2px;border-radius:4px;padding:1px 5px;color:var(--thn-ink)}
.thn-manbar{margin-bottom:.6rem}
.thn-manual{background:var(--thn-raised);border:1px solid var(--thn-gold);border-radius:8px;
  padding:1rem 1.2rem;margin-bottom:.6rem}
.thn-man-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:.4rem 1.6rem}
.thn-manual h4{margin:.6rem 0 .3rem;font-size:.86rem;color:var(--thn-gold);font-weight:600}
.thn-manual p{margin:.25rem 0 .6rem;font-size:.79rem;line-height:1.85;color:var(--thn-ink)}
.thn-manual b{color:var(--thn-gold2);font-weight:600}
.thn-man-keys{border-collapse:collapse;margin:.3rem 0 .6rem;width:100%}
.thn-man-keys td{padding:2px 8px 2px 0;font-size:.77rem;line-height:1.8;vertical-align:top;
  border-bottom:1px dashed var(--thn-line)}
.thn-man-keys td:first-child{white-space:nowrap;width:1%}
.thn.readonly .thn-pad,.thn.readonly .thn-bar:nth-of-type(2),.thn.readonly .thn-panel.paste{display:none}
.thn.readonly .thn-cell{cursor:default}
.thn.readonly .thn-cell.cur{border-color:transparent;background:transparent;box-shadow:none}
.thn.readonly .thn-cell.cur::after{display:none}
`;

export function injectCss() {
  if (typeof document === 'undefined' || document.getElementById('thn-css')) return;
  const s = document.createElement('style'); s.id = 'thn-css'; s.textContent = ENGINE_CSS;
  document.head.appendChild(s);
}

const MANUAL_HTML = `
<div class="thn-man-grid">
  <section>
    <h4>๑ · เริ่มพิมพ์โน้ต</h4>
    <p>คลิกช่องใดก็ได้ในตารางเพื่อวางเคอร์เซอร์ (กรอบเหลืองกะพริบ) แล้วพิมพ์จากคีย์บอร์ดได้ทันที
    ใช้แป้นเดียวกับฟอนต์ TH Notation ใน Word:</p>
    <table class="thn-man-keys">
      <tr><td><kbd>q</kbd><kbd>w</kbd><kbd>e</kbd><kbd>r</kbd><kbd>t</kbd><kbd>y</kbd><kbd>u</kbd></td><td>ดํ รํ มํ ฟํ ซํ ลํ ทํ — เสียงสูง</td></tr>
      <tr><td><kbd>a</kbd><kbd>s</kbd><kbd>d</kbd><kbd>f</kbd><kbd>g</kbd><kbd>h</kbd><kbd>j</kbd></td><td>ด ร ม ฟ ซ ล ท — เสียงกลาง</td></tr>
      <tr><td><kbd>z</kbd><kbd>x</kbd><kbd>c</kbd><kbd>v</kbd><kbd>b</kbd><kbd>n</kbd><kbd>m</kbd></td><td>ดฺ รฺ มฺ ฟฺ ซฺ ลฺ ทฺ — เสียงต่ำ</td></tr>
      <tr><td>ตัวไทย / <kbd>1</kbd>–<kbd>7</kbd></td><td>ลงโน้ตตามระดับเสียงที่เลือกไว้ (ปุ่ม ต่ำ/กลาง/สูง บนแป้นล่าง)</td></tr>
      <tr><td><kbd>space</kbd> หรือ <kbd>-</kbd></td><td>ข้ามตำแหน่ง (ปล่อยเป็นขีด — ขีดคือข้อมูล ไม่ต้องพิมพ์เอง)</td></tr>
      <tr><td><kbd>⌫</kbd> / <kbd>Del</kbd></td><td>ถอยหลังแล้วลบ / ลบช่องปัจจุบัน</td></tr>
      <tr><td><kbd>←</kbd><kbd>→</kbd> <kbd>↑</kbd><kbd>↓</kbd></td><td>เดินทีละตำแหน่ง · ขึ้นลงวรรค (โหมดสองมือ ↑↓ ใช้สลับมือด้วย)</td></tr>
      <tr><td><kbd>Enter</kbd></td><td><b>แทรกห้องว่างทางขวา</b>ของห้องที่เคอร์เซอร์อยู่ (ในวรรคเดียวกัน) แล้วกระโดดเข้าไปพิมพ์ต่อ — <b>บรรทัดนี้ยาวขึ้น 1 ห้อง บรรทัดอื่นไม่กระทบ</b> · อยู่ห้องสุดท้ายของเพลงก็ต่อห้องใหม่ให้</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td><b>ลบห้อง</b>ที่เคอร์เซอร์อยู่ออกทันที <b>บรรทัดสั้นลง</b> (ไม่ดึงห้องจากบรรทัดอื่นมาแทน — ไว้จัดการบรรทัดที่ไม่ครบ 8 ห้อง เหลือ 1 ห้องก็ได้)
        · ใช้ <kbd>Ctrl</kbd>+<kbd>Backspace</kbd> / <kbd>Ctrl</kbd>+<kbd>Delete</kbd> / <kbd>Ctrl</kbd>+<kbd>D</kbd> แทนได้ · Mac ใช้ <kbd>⌘</kbd>
        · <b>กฎ: เพิ่ม/ลดห้องด้วย Enter / Ctrl+Enter ไม่มีผลกับบรรทัดอื่นเลย</b> · ถ้าต้องการให้ห้องทั้งเพลงเลื่อนไหล (ซ่อมโน้ตที่หายเป็นห้อง ๆ) ใช้ปุ่ม ⇥ แทรกห้อง / ⇤ ตัดห้องนี้ออก บนแถบเครื่องมือ หรือ <kbd>Shift</kbd>+<kbd>Delete</kbd></td></tr>
      <tr><td><kbd>Shift</kbd>+<kbd>Enter</kbd></td><td><b>ขึ้นบรรทัดใหม่</b>ต่อจากบรรทัดนี้ (ท้า+รับตามที่ตั้งไว้)</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>↑</kbd> / <kbd>Ctrl</kbd>+<kbd>↓</kbd></td><td>กระโดดไปต้นบรรทัดก่อนหน้า / ถัดไป</td></tr>
      <tr><td><kbd>Home</kbd> / <kbd>End</kbd></td><td>ไปต้น / ท้ายบรรทัดที่อยู่</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> (<kbd>Ctrl</kbd>+<kbd>Y</kbd>)</td><td>ย้อนกลับ (เก็บไว้ 60 ขั้น) — ใช้ได้ทั้งแป้นไทยและอังกฤษ หรือกดปุ่ม ↶ บนแถบเครื่องมือ</td></tr>
    </table>
    <p>พิมพ์ครบวรรค เคอร์เซอร์ขึ้นวรรคถัดไปให้เอง ครบบรรทัดก็ต่อบรรทัดใหม่ให้เอง
    ใช้เมาส์อย่างเดียวก็ได้ — กดปุ่มโน้ตบนแป้นล่างสุดของกระดาน</p>
  </section>
  <section>
    <h4>๒ · สะบัด</h4>
    <p>จิ้มช่องที่ต้องการ แล้วกด <kbd>Shift</kbd> พร้อมโน้ต <b>สองครั้ง</b> — ทั้งคู่ลงในช่องเดียวกัน
    ครบคู่แล้วเคอร์เซอร์จึงเดินต่อ (ใช้เมาส์: กดปุ่ม ◠ สะบัด ให้ติดค้าง แล้วกดโน้ตสองตัว)</p>
    <p>เส้นโค้งเขียวคร่อมครบกลุ่ม: ตัวนำจากช่องก่อนหน้า + คู่สะบัด = สามเสียง
    เล่นห่างเท่ากัน 80 ms โดยตัวสุดท้ายลงตรงจังหวะเสมอ · สะบัดที่ต้นห้อง (ไม่มีตัวนำ) ระบบติดธงเตือนให้ตรวจกับต้นฉบับ</p>
    <h4>๒ข · กรอ และ ประคบ</h4>
    <p><b>กรอ</b> = ตีสลับสองมือถี่ ๆ ให้เสียงยาวต่อเนื่อง · <b>ประคบ</b> = ใช้มืออีกข้างกดให้เสียงสั้น ไม่กังวานทับกัน</p>
    <table class="thn-man-keys">
      <tr><td><kbd>Alt</kbd>+โน้ต</td><td>ลงโน้ตนั้นพร้อม <b>กรอ</b> ในทีเดียว (เร็วสุดตอนพิมพ์รวด)</td></tr>
      <tr><td><b>กดแป้นโน้ตค้าง</b></td><td><b>ประคบ</b> — พิมพ์โน้ตตามปกติแล้วค้างไว้แวบเดียว (~0.25 วิ) ตัวนั้นจะกลายเป็นตัวหนา · ปล่อยเร็วกว่านั้น = โน้ตธรรมดา · ประคบ<b>เฉพาะแนวที่กำลังพิมพ์</b></td></tr>
      <tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+โน้ต</td><td>ลงโน้ตพร้อม <b>ประคบ</b> (ทางเลือก ไม่ต้องรอเวลา)</td></tr>
      <tr><td><kbd>~</kbd></td><td>สลับ <b>กรอ</b> ที่ช่องที่เคอร์เซอร์อยู่ (ไว้คลิกกลับมาแก้ทีหลัง)</td></tr>
      <tr><td>ปุ่ม <b>〰 กรอ</b> · <b>● ประคบ</b></td><td>บนแป้นล่าง กดให้ติดค้าง แล้วโน้ตที่พิมพ์ต่อจากนั้นติดเครื่องหมายให้เอง (กดซ้ำเพื่อเลิก)</td></tr>
    </table>
    <p>บนตาราง <b>กรอ</b> ขึ้นเป็นเส้นคลื่น<b>เหนือโน้ตตัวที่กรอตัวเดียว</b> (ไม่ลากยาวไปหาเสียงถัดไป)
    แต่เวลาเล่นยังกรอยาวไปจนถึงเสียงถัดไปเหมือนเดิม และ<b>จบก่อนถึงเสียงถัดไปราวสองไม้</b> ไม่ชนโน้ตตัวหน้า ·
    <b>ประคบ</b> ขึ้นเป็น<b>ตัวหนา</b>ล้วน ๆ ไม่มีเครื่องหมายอื่นมากวนกับจุดเสียงต่ำ–สูง
    และ<b>แยกอิสระรายมือ</b> — มือบนประคบ มือล่างไม่ประคบก็ได้ (กดค้างที่แนวไหน ประคบเฉพาะแนวนั้น)</p>
    <p><b>คู่สอง–คู่สาม ลงไม่พร้อมกัน</b> — สองมือตีคู่ชิดขนาดนั้นพร้อมกันเป๊ะไม่ได้จริง
    ระบบจึงให้แนวล่าง (มือซ้าย) ลงก่อนแนวบนราว 30 ms ให้เอง คู่สี่ขึ้นไปลงพร้อมกันตามปกติ</p>
    <p><b>กรอคู่อะไรก็ได้</b> — ระบบไม่เดาคู่ให้ ใส่เครื่องหมายที่แนวบน (มือขวา) ช่องเดียว เวลาเล่นระบบหยิบเสียงทั้งสองมือที่ตำแหน่งนั้นมาตีสลับกัน
    <b>เริ่มเสียงต่ำ จบเสียงสูง</b>เสมอ ระนาดกับฆ้องจึงขึ้นมือซ้ายจบมือขวา ส่วนขิมที่เสียงต่ำอยู่ทางขวาก็จะขึ้นมือขวาจบมือซ้ายเอง ·
    ตำแหน่งนั้นมีเสียงมือเดียว = <b>กรอเสียงเดียว</b> (ตีสลับมือด้วยเสียงเดิม) ·
    ความถี่การกรอปรับได้ที่ช่อง <b>กรอ</b> บนแป้นล่าง (45–120 ms ต่อไม้)</p>
    <h4>๓ · สองมือ R/L</h4>
    <p>ปุ่ม <b>สองมือ R/L</b> เปิดสองบรรทัด — R มือขวา (บน) · L มือซ้าย (ล่าง)
    กด <kbd>Tab</kbd> สลับมือ · เสียงสองมือลงพร้อมกัน ยกเว้น<b>คู่สองกับคู่สาม</b> ที่มือซ้ายลงก่อนนิดหนึ่ง (คู่สี่ คู่ห้า คู่แปด ลงพร้อมกัน)</p>
    <h4>๔ · บรรทัด วรรค ท่อน</h4>
    <p><b>วรรคท้า __ ห้อง + วรรครับ __ ห้อง</b> แล้วกด <b>＋ ขึ้นบรรทัดใหม่</b> —
    เช่น 4+4 ได้บรรทัด 8 ห้องสองวรรค · 4+3 ได้บรรทัด 7 ห้อง (เพลงจังหวะพิเศษ) · วรรครับ "ไม่มี" = บรรทัดวรรคเดียว
    การตั้งค่ามีผลกับบรรทัดที่กดเพิ่มเท่านั้น บรรทัดเดิมไม่ถูกจัดใหม่</p>
    <p><b>เลือกช่วง</b>: ลากเมาส์คลุมช่อง หรือ <kbd>Shift</kbd>+ลูกศร / <kbd>Shift</kbd>+คลิก · <kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>X</kbd>/<kbd>V</kbd> คัดลอก/ตัด/วาง
    (วางทับตั้งแต่เคอร์เซอร์ ข้ามวรรคได้ · วางข้อความโน้ตจากที่อื่นได้ด้วย) · <kbd>Delete</kbd> ล้างที่เลือก ·
    <b>⇥ แทรกห้อง / แทรก 1 ช่อง</b> เสียบช่องว่างที่เคอร์เซอร์ ทุกอย่างหลังจากนั้นเลื่อนไปข้างหน้า ครบบรรทัดแล้วตกบรรทัดล่างเอง ·
    <b>⇤ ตัดห้องนี้ออก / ✂ ตัดที่เลือกออก</b> (<kbd>Shift</kbd>+<kbd>Delete</kbd>) ดึงที่เหลือมาชิด —
    ใช้แก้โน้ตที่ถอดจาก PDF แล้วหายไปสองสามห้องจนรวนทั้งเพลง ·
    <b>ย้ายทั้งห้อง</b>: <b>กดเมาส์ค้าง</b>ที่ช่องโน้ตประมาณครึ่งวินาที (หรือลากที่ตัวอักษรรหัสกระสวนใต้ห้อง) ห้องจะลอยขึ้นมา
    ลากไปวางระหว่างห้องไหนก็ได้ (เส้นเขียวบอกจุดวาง) ห้องอื่นเลื่อนหลบให้เอง · เลือกหลายห้องเต็ม ๆ ก่อนแล้วกดค้าง = ย้ายทีเดียวทั้งช่วง</p>
    <p><b>เส้นแบ่งวรรค</b> (เส้นตั้งระหว่างวรรคท้ากับวรรครับ) <b>ลากได้</b>: จับเส้นแล้วลากไปวางระหว่างห้องไหนก็ได้ในบรรทัดเดียวกัน
    เช่น 4+4 → 3+5 หรือ 5+3 · ลากไปสุดบรรทัด = บรรทัดวรรคเดียว (จังหวะพิเศษ) · จำนวนห้องรวมของบรรทัดไม่เปลี่ยน
    การแบ่งที่ตั้งเองติดอยู่กับบรรทัดนั้นแม้แทรก/ตัดห้องแล้วโน้ตเลื่อนไหล · กระสวนและลูกตกท้า/รับคำนวณใหม่ตามวรรคใหม่ทันที</p>
    <p><b>บรรทัดที่ยังไม่มีเส้นแบ่งวรรค</b> (เช่น ตั้งวรรครับ "ไม่มี" หรือกด Enter เพิ่มห้องจนยาว): ลากป้าย <b>┊</b> หน้าบรรทัดไปวางระหว่างห้องที่ต้องการ
    ได้เส้นแบ่งวรรคใหม่ทันที (บรรทัดหนึ่งมีกี่วรรคก็ได้) · หรือวางเคอร์เซอร์ที่ห้องที่จะเป็นต้นวรรคใหม่แล้วกดแป้น <kbd>|</kbd> / ปุ่ม <b>┊ แบ่งวรรคตรงนี้</b> ·
    <b>⟷ รวมวรรค</b> รวมวรรคที่เคอร์เซอร์อยู่กับวรรคถัดไปในบรรทัดเดียวกัน (เส้นแบ่งหายไป 1 เส้น) — ฐานข้อมูลนับวรรคตามเส้นแบ่งเหล่านี้ตรง ๆ</p>
    <p><b>−ห้อง / +ห้อง</b> ปรับจำนวนห้องของวรรคที่เคอร์เซอร์อยู่ · <b>⧉ ซ้ำบรรทัดนี้</b> คัดลอกทั้งบรรทัดต่อท้าย ·
    <b>🗑 ลบบรรทัดนี้</b> ลบบรรทัดที่เคอร์เซอร์อยู่ (มีโน้ตจะถามยืนยันก่อน · กด <kbd>Ctrl</kbd>+<kbd>Z</kbd> เอาคืนได้)</p>
    <p><b>ท่อน</b> จัดการได้อิสระที่หัวท่อน: <b>✎</b> เปลี่ยนชื่อ · <b>อัตรา</b> (เพลงเถา: ท่อนละอัตรา) · <b>＋ก่อน / ＋หลัง</b> แทรกท่อนว่างก่อน/หลังท่อนนี้ ·
    <b>↑ ↓</b> สลับลำดับท่อน · <b>⤴ รวมกับท่อนก่อน</b> · <b>🗑</b> ลบทั้งท่อน (ถามยืนยันถ้ามีโน้ต) ·
    <b>✂ แยกที่เคอร์เซอร์</b> ให้บรรทัดที่เคอร์เซอร์อยู่เป็นต้นท่อนใหม่ (บรรทัดที่เหลือของท่อนเดิมตามไปด้วย) — ใช้ตอนพิมพ์ยาวมาแล้วเพิ่งรู้ว่าต้องขึ้นท่อนตรงไหน
    · ท่อนใหม่ที่แทรกจะได้ชื่อ "ท่อนใหม่ n" ให้กด ✎ เปลี่ยนได้ทันที · ทุกปุ่มย้อนได้ด้วย <kbd>Ctrl</kbd>+<kbd>Z</kbd></p>
  </section>
  <section>
    <h4>๕ · การเล่นและเสียง</h4>
    <p><b>▶ เล่นจากเคอร์เซอร์</b> · <b>■ หยุด</b> · <b>↺ ตั้งแต่ต้น</b> · คีย์ลัด <kbd>Ctrl</kbd>+<kbd>space</kbd> เล่น/หยุด · <kbd>Esc</kbd> หยุด</p>
    <p>คลิกช่องไหน เคอร์เซอร์ย้ายไปตรงนั้น (ถ้ากำลังเล่นอยู่ = กระโดดไปเล่นต่อจากตรงนั้นทันที) ·
    <b>ดับเบิลคลิก</b> = เล่นจากช่องนั้นเลย · แถบเขียววิ่งตามตำแหน่งที่กำลังดัง</p>
    <p><b>ช้า–เร็ว</b> ปรับความเร็ว (ตัวเลข = BPM) · <b>เครื่องสาย / ปี่พาทย์ +1</b> เลือกระบบเสียง (ปี่พาทย์สูงกว่า 1 เสียง) ·
    <b>เสียง</b> ฆ้องวงใหญ่จริง (โหลดครั้งแรกรอครู่หนึ่ง — ลูกที่ไม่มีไฟล์ใช้เสียงสังเคราะห์แทน) หรือสังเคราะห์ล้วน ·
    <b>♪ เสียงขณะพิมพ์</b> เปิด/ปิดเสียงเวลากดโน้ต</p>
    <p><b>ฉิ่ง–ฉับ</b> ติ๊กเปิด · โหมด <b>อัตโนมัติตามอัตรา</b>: สามชั้น ฉิ่งท้ายห้อง 4 ฉับท้ายห้อง 8 ·
    สองชั้น ฉิ่งท้ายห้อง 2 ฉับท้ายห้อง 4 · ชั้นเดียว ฉิ่งขีดที่ 2 ฉับขีดที่ 4 ของทุกห้อง — เดินตามอัตราของท่อนและตั้งจังหวะใหม่ทุกต้นท่อน ·
    โหมด <b>กำหนดฉิ่งเอง (จังหวะพิเศษ)</b>: คลิกที่แถวฉิ่งเหนือโน้ตได้เลย วน ว่าง → ฉิ่ง → ฉับ → ว่าง ·
    <b>กลอง</b> เลือกหน้าทับ (ปรบไก่/สองไม้) และเครื่อง ตีตามอัตราของท่อนเช่นกัน</p>
  </section>
  <section>
    <h4>๖ · ค่าที่ระบบอ่านให้ระหว่างพิมพ์</h4>
    <p>ตัวอักษรสีทองใต้แต่ละห้อง = <b>รหัสกระสวน</b> (O–P ตามระบบ 16 แบบ) ·
    ท้ายบรรทัด = <b>ลูกตก ท้า/รับ</b> พร้อมรหัสคู่ลูกตก (ดด01–ทท49) ·
    ป้ายเขียว "วรรคสั้น/วรรคยาว" = จังหวะพิเศษที่บันทึกไว้ตามจริง · ธงแดง ⚑ = จุดที่ควรเปิดต้นฉบับตรวจ
    (ห้องท้ายวรรคว่าง สะบัดต้นห้อง ประโยคไม่ครบคู่ ฯลฯ)</p>
    <p>กล่อง <b>อ่านจากที่พิมพ์</b> (สถิติ + กระสวนที่ใช้บ่อย) และ <b>ตรวจตามกฎฐานข้อมูล</b> อัปเดตสดตลอดการพิมพ์
    — ตรวจผ่านตั้งแต่ตอนพิมพ์ ไม่ต้องรอผู้ดูแลไล่ทีหลัง</p>
    <h4>๗ · เครื่องมือเสริม</h4>
    <p><b>ฟอนต์ TH Notation / ตัวไทย</b> สลับรูปแบบตัวโน้ต (ความหมายเดียวกัน) ·
    <b>วางโน้ตที่มีอยู่แล้ว</b> (กล่องล่างสุด) รับได้ทั้งโน้ตไทยเว้นวรรค รหัสแป้นที่คัดจาก Word (เช่น ---g|-h-q)
    และข้อความที่คัดจากฐานเดิม แล้วกด "อ่านเข้าตาราง" ·
    <b>▸ โน้ตสากล 5 เส้น</b> ใต้กระดาน เปิดดูพร้อมแถบวิ่งตอนเล่น ·
    <b>ร่างอัตโนมัติ</b>: ระบบเก็บร่างในเครื่องของคุณเองตลอดการพิมพ์ ปิดหน้าแล้วกลับมาจะมีกล่อง "กู้คืนร่าง"
    ให้เรียกคืน — ส่งหรือบันทึกสำเร็จแล้วร่างจะถูกล้างให้เอง</p>
  </section>
</div>`;

const NOTE_HTML = `
<div class="thn-bar thn-manbar">
  <button class="thn-btn" type="button" data-a="manual">📖 วิธีใช้งาน</button>
  <span class="thn-mini" style="margin-left:0">พิมพ์โน้ตด้วยแป้น <kbd>a</kbd><kbd>s</kbd><kbd>d</kbd><kbd>f</kbd><kbd>g</kbd><kbd>h</kbd><kbd>j</kbd> = ด ร ม ฟ ซ ล ท · กดปุ่มนี้เพื่อดูคู่มือทั้งหมด</span>
  <span class="thn-note" data-t="ver" title="รุ่นของกระดานโน้ตที่กำลังใช้"></span>
</div>
<div class="thn-manual" data-t="manual" hidden>` + MANUAL_HTML + `</div>
<div class="thn-bar">
  <button class="thn-btn play" type="button" data-a="play">▶ เล่นจากเคอร์เซอร์</button>
  <button class="thn-btn stop" type="button" data-a="stop" disabled>■ หยุด</button>
  <button class="thn-btn" type="button" data-a="all">↺ ตั้งแต่ต้น</button>
  <div class="thn-rng">ช้า <input type="range" data-f="bpm" min="50" max="200" value="120" aria-label="ความเร็ว"> เร็ว <b data-t="bpm">120</b></div>
  <div class="thn-sep"></div>
  <label class="thn-pick" title="ระบบเสียง: ความถี่จริงของโน้ตแต่ละเสียง (ตารางกรมศิลปากร)">🎚 เสียงตั้ง <select data-f="tuning">${BUILTIN_TUNINGS.map(t => `<option value="${t.slug}">${t.name_th}</option>`).join('')}</select></label>
  <label class="thn-pick" data-t="srcwrap" style="display:none">เสียง <select data-f="src"><option value="synth">〰 สังเคราะห์</option></select></label>
  <label class="thn-chk"><input type="checkbox" data-f="ching"> ฉิ่ง–ฉับ</label>
  <label class="thn-pick"><select data-f="chingmode"><option value="auto">ฉิ่งอัตโนมัติตามอัตรา</option><option value="manual">กำหนดฉิ่งเอง (จังหวะพิเศษ)</option></select></label>
  <label class="thn-pick" data-t="drumwrap" style="display:none">กลอง <select data-f="nathab"><option value="none">ไม่มี</option><option>ปรบไก่</option><option>สองไม้</option></select>
    <select data-f="drum"><option>ตะโพน</option><option>กลองแขก</option><option>กลองสองหน้า</option><option>โทนรำมะนา</option><option>กลองทัด</option></select></label>
  <button class="thn-btn on" type="button" data-a="snd">♪ เสียงขณะพิมพ์</button>
  <span class="thn-mini" data-t="sndmsg" style="margin-left:0"></span>
  <span class="thn-note" data-t="caret"></span>
</div>
<div class="thn-bar">
  <label class="thn-pick" title="ระบบบันทึก: จำนวนบรรทัดในหนึ่งวรรค (ขิมใช้ 3 บรรทัด)">ระบบ <select data-f="system">${SYSTEM_KEYS.map(k => `<option value="${k}">${SYSTEMS[k].short}</option>`).join('')}</select></label>
  <label class="thn-pick" title="ทาง (บันไดเสียง) ของเพลงนี้">ทาง <select data-f="tang">${TANGS.map(t => `<option value="${t.no}">${t.short}</option>`).join('')}</select></label>
  <label class="thn-pick" title="โน้ตจดด้วยระบบไหน — ทางเดียวกัน เครื่องสายเขียนตัวอักษรสูงกว่าปี่พาทย์ 1 ขั้น (เสียงเท่ากัน)">จด <select data-f="notens"><option value="piphat">ปี่พาทย์</option><option value="khrueangsai">เครื่องสาย</option></select></label>
  <label class="thn-pick" title="เปลี่ยนทางแล้วโน้ตบนจอขยับตามหรือไม่">เปลี่ยนทาง <select data-f="tangview"><option value="fix">ตรึงโน้ต (เสียงเปลี่ยน)</option><option value="real">ย้ายโน้ตจริง</option></select></label>
  <span class="thn-pick" data-t="tanginfo" style="font-size:.7rem"></span>
  <label class="thn-pick">วรรคท้า <select data-f="ta"><option>1</option><option>2</option><option>3</option><option value="4" selected>4</option><option>5</option><option>6</option><option>7</option><option>8</option></select> ห้อง</label>
  <label class="thn-pick">＋ วรรครับ <select data-f="rap"><option value="0">ไม่มี</option><option>1</option><option>2</option><option>3</option><option value="4" selected>4</option><option>5</option><option>6</option></select> ห้อง</label>
  <button class="thn-btn" type="button" data-a="newline" title="Shift+Enter">＋ ขึ้นบรรทัดใหม่ (<span data-t="linesum">8 ห้อง</span>)</button>
  <span class="thn-split" data-t="split"></span>
  <div class="thn-seg" role="group"><button type="button" data-font="notation" aria-pressed="true">ฟอนต์ TH Notation</button><button type="button" data-font="unicode" aria-pressed="false">ตัวไทย</button></div>
  <div class="thn-sep"></div>
  <button class="thn-btn" type="button" data-a="hong-" title="ลดห้องของวรรคที่เคอร์เซอร์อยู่">−ห้อง</button>
  <button class="thn-btn" type="button" data-a="hong+" title="เพิ่มห้องของวรรคที่เคอร์เซอร์อยู่">+ห้อง</button>
  <button class="thn-btn" type="button" data-a="dup">⧉ ซ้ำบรรทัดนี้</button>
  <button class="thn-btn" type="button" data-a="delline" title="ลบบรรทัดที่เคอร์เซอร์อยู่ทั้งบรรทัด">🗑 ลบบรรทัดนี้</button>
  <button class="thn-btn" type="button" data-a="splitverse" title="แบ่งวรรคตรงห้องที่เคอร์เซอร์อยู่ — ห้องนี้กลายเป็นต้นวรรคใหม่ (แป้น | )">┊ แบ่งวรรค</button>
  <button class="thn-btn" type="button" data-a="mergeverse" title="รวมวรรคที่เคอร์เซอร์อยู่กับวรรคถัดไปในบรรทัดเดียวกัน">⟷ รวมวรรค</button>
  <button class="thn-btn" type="button" data-a="clr">ล้างทั้งหมด</button>
</div>
<div class="thn-bar thn-selbar" data-t="selbar">
  <span class="thn-mini" data-t="selinfo">ลากเมาส์คลุมช่องเพื่อเลือก · Shift+ลูกศร ก็ได้</span>
  <button class="thn-btn" type="button" data-a="inshong" title="แทรกห้องว่างหน้าห้องที่เคอร์เซอร์อยู่แบบเลื่อนไหลทั้งเพลง — ห้องที่เหลือเลื่อนไปข้างหน้า ครบบรรทัดแล้วตกบรรทัดล่าง · Enter = แทรกทางขวาเฉพาะบรรทัดนี้">⇥ แทรกห้อง</button>
  <button class="thn-btn" type="button" data-a="inscell" title="แทรกช่องว่าง 1 ตำแหน่งที่เคอร์เซอร์ — ที่เหลือเลื่อนไปข้างหน้า">⇥ แทรก 1 ช่อง</button>
  <button class="thn-btn" type="button" data-a="delhong" title="ตัดห้องที่เคอร์เซอร์อยู่ออก — ห้องที่เหลือทั้งเพลงเลื่อนมาชิด (Shift+Delete) · Ctrl+Enter = ลบห้องแบบบรรทัดสั้นลง">⇤ ตัดห้องนี้ออก</button>
  <button class="thn-btn" type="button" data-a="delsel" title="ตัดช่องที่เลือกออกทั้งหมด — ที่เหลือเลื่อนมาชิด (Shift+Delete)">✂ ตัดที่เลือกออก</button>
  <div class="thn-sep"></div>
  <button class="thn-btn" type="button" data-a="copy" title="คัดลอกช่องที่เลือก (Ctrl+C)">⎘ คัดลอก</button>
  <button class="thn-btn" type="button" data-a="cut" title="คัดลอกแล้วล้างช่องที่เลือก (Ctrl+X)">✂ ตัด</button>
  <button class="thn-btn" type="button" data-a="paste" title="วางทับตั้งแต่เคอร์เซอร์ (Ctrl+V)">📋 วาง</button>
  <button class="thn-btn" type="button" data-a="clrsel" title="ล้างโน้ตในช่องที่เลือก ช่องยังอยู่ (Delete)">ล้างที่เลือก</button>
  <div class="thn-sep"></div>
  <button class="thn-btn" type="button" data-a="undo" title="ย้อนกลับขั้นล่าสุด (Ctrl+Z · เก็บ 60 ขั้น)" disabled>↶ ย้อนกลับ</button>
</div>
<div class="thn-score" data-t="score" tabindex="0" role="application" aria-label="ตารางบันทึกโน้ต"></div>
<div class="thn-pad">
  <div class="thn-seg thn-regseg" role="group"><button type="button" data-reg="-1" aria-pressed="false">ต่ำ</button><button type="button" data-reg="0" aria-pressed="true">กลาง</button><button type="button" data-reg="1" aria-pressed="false">สูง</button></div>
  <div data-t="keys" style="display:flex;gap:.35rem;flex-wrap:wrap"></div>
  <button class="thn-btn" type="button" data-a="skip" style="height:2.7rem">– เว้น</button>
  <button class="thn-btn" type="button" data-a="sabat" style="height:2.7rem">◠ สะบัด</button>
  <button class="thn-btn" type="button" data-a="kro" style="height:2.7rem" title="กรอ — ตีสลับสองมือให้เสียงยาว (Alt+โน้ต · แป้น ~ สลับที่ช่องเคอร์เซอร์)">〰</button>
  <button class="thn-btn" type="button" data-a="damp" style="height:2.7rem" title="ประคบ — มืออีกข้างกดให้เสียงสั้น · วิธีเร็วสุด: กดแป้นโน้ตค้างไว้แวบเดียว · ปุ่มนี้กดติดค้างไว้ได้เมื่อต้องประคบหลายตัวติดกัน">●</button>
  <label class="thn-pick" title="ความถี่ของการกรอ (วินาทีต่อไม้) — ยิ่งน้อยยิ่งตีถี่"><select data-f="krogap">
    <option value="0.045">〰 45</option><option value="0.055">〰 55</option>
    <option value="0.07" selected>〰 70</option><option value="0.09">〰 90</option>
    <option value="0.12">〰 120</option></select></label>
  <button class="thn-btn" type="button" data-a="bs" style="height:2.7rem">⌫ ลบ</button>
  <p class="thn-help">พิมพ์จากคีย์บอร์ด: <kbd>a</kbd><kbd>s</kbd><kbd>d</kbd><kbd>f</kbd><kbd>g</kbd><kbd>h</kbd><kbd>j</kbd> = ด ร ม ฟ ซ ล ท · <kbd>q</kbd>–<kbd>u</kbd> สูง · <kbd>z</kbd>–<kbd>m</kbd> ต่ำ · <kbd>Shift</kbd>+โน้ต ×2 = สะบัด · <kbd>Alt</kbd>+โน้ต = กรอ · <kbd>Alt</kbd>+<kbd>Shift</kbd>+โน้ต = ประคบ · <kbd>space</kbd> ข้าม · <kbd>Enter</kbd> แทรกห้องขวา · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> ลบห้อง · <kbd>Shift</kbd>+<kbd>Enter</kbd> ขึ้นบรรทัดใหม่ · <kbd>Ctrl</kbd>+<kbd>space</kbd> เล่น/หยุด · <kbd>Ctrl</kbd>+<kbd>Z</kbd> ย้อน</p>
</div>
<div class="thn-panels">
  <section class="thn-panel"><p class="thn-plabel">อ่านจากที่พิมพ์</p>
    <div class="thn-stats"><div class="thn-stat"><b data-t="stV">0</b><span>วรรค</span></div><div class="thn-stat"><b data-t="stH">0</b><span>ห้อง</span></div><div class="thn-stat"><b data-t="stN">0</b><span>เสียง</span></div><div class="thn-stat"><b data-t="stU">0</b><span>กระสวนไม่ซ้ำ</span></div></div>
    <div class="thn-kbars" data-t="kbars"></div></section>
  <section class="thn-panel"><p class="thn-plabel">ตรวจตามกฎฐานข้อมูล</p><div class="thn-checks" data-t="checks"></div></section>
</div>
<section class="thn-panel paste" style="margin-top:.6rem"><p class="thn-plabel">วางโน้ตที่มีอยู่แล้ว</p>
  <textarea class="thn-paste" data-t="paste" rows="3" placeholder="วางได้ทั้งโน้ตไทย (- - - ซ | - ล - ดํ) · รหัสแป้น TH Notation (---g|-h-q) · หรือข้อความที่คัดจากฐานเดิม แล้วกดอ่าน"></textarea>
  <div style="display:flex;gap:.45rem;margin-top:.5rem;align-items:center;flex-wrap:wrap">
    <button class="thn-btn" type="button" data-a="read">อ่านเข้าตาราง (แทนที่ของเดิม)</button>
    <span class="thn-mini" data-t="pmsg"></span></div>
</section>`;

export class NotationEngine {
  constructor(root, opts = {}) {
    injectCss();
    this.root = root;
    try { root.__thn = this; } catch { /* ไว้ตรวจสอบ/ทดสอบจากคอนโซล */ }
    this.onChange = opts.onChange || (() => {});
    const ta = opts.ta || opts.base || 4;
    const rap = opts.rap != null ? opts.rap : Math.max(0, (opts.lineHong || 8) - ta);
    this.S = { ta, rap, system: SYSTEMS[opts.system] ? opts.system : (opts.twoHands ? 'hands2' : 'melody1'), sound: true,
      reg: 0, sabatArm: false, markArm: '', kroGap: opts.kroGap || KRO_GAP_DEFAULT, bpm: opts.bpm || 120, chingOn: !!opts.chingOn,
      tuning: opts.tuning || null,      // slug ของระบบเสียง (ว่าง = ตั้งจาก ensemble ตอนโหลดรายการ)
      tang: opts.tang || 2,             // ทางที่ "อยากได้ยิน" (1–7)
      tangHome: opts.tang || 2,         // ทางที่ "ตัวอักษรบนจอเขียนไว้จริง"
      tangView: opts.tangView === 'real' ? 'real' : 'fix',
      level: opts.level || 'สองชั้น', chingMode: 'auto', font: 'notation',
      caret: { v: 0, p: 0, hand: 'r' }, verses: [], total: 0,
      src: opts.audio ? 'real' : 'synth', nathab: opts.nathab || 'none', drum: opts.drum || 'ตะโพน', sel: null };
    this.clip = null;   // คลิปบอร์ดภายใน: [{r:[],l:[]}]
    this.drag = null;   // { anchor: step } ระหว่างลากเมาส์
    Object.defineProperty(this.S, 'base', { get() { return this.ta; } });
    Object.defineProperty(this.S, 'lineHong', { get() { return this.ta + this.rap; } });
    // ปลั๊กเสียงจริง: opts.audio = { load(ctx) → Promise<buffers>, play(ctx, buffers, ch, reg, t, gain, shift) → bool }
    this.audio = opts.audio || null;
    // twoHands = คุณสมบัติเทียบเท่าของเดิม (โค้ดภายนอกยังอ่าน/เขียนได้) — ที่จริงเก็บเป็น S.system
    Object.defineProperty(this.S, 'twoHands', {
      get() { return lineCount(this.system) >= 2; },
      set(v) { if (v && lineCount(this.system) < 2) this.system = 'hands2'; else if (!v) this.system = 'melody1'; },
      enumerable: false, configurable: true,
    });
    // ensemble = คุณสมบัติเทียบเท่าของเดิม ('sai' | 'piphat') — ที่จริงเก็บเป็น S.tuning
    const eng0 = this;
    Object.defineProperty(this.S, 'ensemble', {
      get() { return ensembleOf(eng0.tuningObj()); },
      set(v) { const t = tuningForEnsemble(eng0.tunings, v === 'piphat' ? 'piphat' : 'sai'); this.tuning = t ? t.slug : DEFAULT_TUNING; },
      enumerable: false, configurable: true,
    });
    // ระบบบันทึกของตัวอักษร ผูกกับชุดความถี่เสมอ — ตัวอักษรกับเสียงจะได้ไม่หลุดจากกัน
    Object.defineProperty(this.S, 'notEns', {
      get() { return ensembleOf(eng0.tuningObj()) === 'piphat' ? 'piphat' : 'khrueangsai'; },
      set(v) { const t = tuningForEnsemble(eng0.tunings, v === 'khrueangsai' ? 'sai' : 'piphat'); if (t) this.tuning = t.slug; },
      enumerable: false, configurable: true,
    });
    this.tunings = BUILTIN_TUNINGS; this.hzMap = null;
    if (!this.S.tuning) this.S.ensemble = opts.ensemble || 'sai';
    this.buffers = null; this.loadingSamples = false;
    // ปลั๊กหน้าทับ: opts.percussion = { load() → Promise<rows>, parse(text) → {hits,len}, play(ctx, syll, t, gain) }
    this.perc = opts.percussion || null; this.percRows = null;
    this.readOnly = !!opts.readOnly;
    this.onPlayStep = opts.onPlayStep || null;
    this.undoStack = [];
    this.actx = null;
    this.play = { on: false, id: 0, raf: 0, lastStep: -1 };
    this.cellEls = []; this.rows = []; this.rowEls = []; this.rowOfVerse = [];
    root.classList.add('thn', 'fnt-notation');
    if (this.readOnly) root.classList.add('readonly');
    root.innerHTML = NOTE_HTML;
    this.q = sel => root.querySelector(sel);
    this.t = name => root.querySelector(`[data-t="${name}"]`);
    if (this.audio) this.t('srcwrap').style.display = '';
    if (this.perc) this.t('drumwrap').style.display = '';
    const verEl = this.t('ver'); if (verEl) verEl.textContent = 'กระดานรุ่น ' + ENGINE_VERSION;
    this.bind();
    this.setVerses(opts.verses && opts.verses.length ? opts.verses : null);
    // เปิดโน้ตเก่าที่ไม่ได้บันทึกทางไว้ → เดาจากโน้ตให้เลย (แถบสถานะจะบอกว่าได้ทางอะไร)
    if (!opts.tang) this.adoptDetectedTang();
    this.buildPad();
  }

  // เติมรายชื่อหน้าทับจากคลังกลางลง dropdown "กลอง" (เรียกจาก NotationInput หลังโหลดคลัง)
  setNathabOptions(names) {
    const sel = this.q('[data-f="nathab"]'); if (!sel || !names || !names.length) return;
    const cur = this.S.nathab;
    sel.innerHTML = '<option value="none">ไม่มี</option>' + names.map(n => `<option value="${n.replace(/"/g, '&quot;')}">${n}</option>`).join('');
    sel.value = names.includes(cur) ? cur : 'none';
    if (sel.value === 'none') this.S.nathab = 'none';
  }

  // เติมรายชื่อชุดเครื่องกำกับจังหวะ [[ค่า, ป้าย], …] ลง dropdown "เครื่อง"
  setDrumOptions(list) {
    const sel = this.q('[data-f="drum"]'); if (!sel || !list || !list.length) return;
    const cur = this.S.drum;
    sel.innerHTML = list.map(([v, l]) => `<option value="${v.replace(/"/g, '&quot;')}">${l}</option>`).join('');
    sel.value = list.some(([v]) => v === cur) ? cur : list[0][0];
    this.S.drum = sel.value;
  }

  /* ─── ข้อมูลเข้า/ออก ─── */
  setVerses(verses) {
    this.invalidateTang();
    const S = this.S;
    if (!verses) S.verses = [...this.newLine('ท่อน 1'), ...this.newLine('ท่อน 1')];
    else {
      S.verses = verses.map(v => ({ sec: v.sec, nl: v.nl, level: v.level, ching: v.ching, cells: v.cells.map(c => { const o = { r: c.r || [], l: c.l || [], x: c.x || [] }; if (c.m) o.m = c.m; if (c.d) o.d = c.d; return o; }) }));
      const used = S.verses.some(v => v.cells.some(c => c.x.length)) ? 3
                 : S.verses.some(v => v.cells.some(c => c.l.length)) ? 2 : 1;
      if (used > lineCount(S.system)) S.system = systemForLines(used, S.system);
      this.appendLine();
    }
    S.caret = { v: 0, p: 0, hand: 'r' };
    this.reindex();
    this.syncControls();
    this.rebuild();
  }
  getVerses() { return trimVerses(this.S.verses).map(v => ({ sec: v.sec, nl: v.nl, cells: v.cells, level: v.level, ching: v.ching })); }
  // chingOn / nathab / drum / bpm ส่งออกด้วย — หน้าแก้โน้ตเอาไปบันทึกเป็น "ค่าเริ่มต้นของเพลง" (Pk 2026-08-26)
  getState() { const S = this.S; return { base: S.base, lineHong: S.lineHong, ta: S.ta, rap: S.rap, system: S.system, lines: lineCount(S.system), twoHands: S.twoHands, ensemble: S.ensemble, tuning: S.tuning, tang: S.tang, tangHome: S.tangHome, notEns: S.notEns, tangView: S.tangView, level: S.level, chingMode: S.chingMode, chingOn: S.chingOn, kroGap: S.kroGap, nathab: S.nathab, drum: S.drum, bpm: S.bpm }; }
  hands() { return handsOf(this.S.system); }
  nH() { return lineCount(this.S.system); }
  // เติมรายชื่อเครื่องดนตรีลงตัวเลือก "เสียง" (เรียกจาก React หลังอ่านทะเบียนจากฐาน)
  //   list = [{ slug, name_th, transpose }] · เลือกอันแรกอัตโนมัติถ้ายังใช้เสียงสังเคราะห์อยู่
  // แถบบอกว่าตอนนี้ทางอะไร ปัญจมูลอะไร และตรงกับโน้ตบนกระดานไหม
  syncTangInfo() {
    const el = this.t('tanginfo'); if (!el) return;
    const S = this.S, sh = this.tangShift();
    const det = this.detectTang();
    let msg = pentaText(S.tang, S.notEns);
    if (sh) msg += ` · เสียง${sh > 0 ? 'สูงขึ้น' : 'ต่ำลง'} ${Math.abs(sh)} ขั้น (โน้ตตรึงไว้ที่${tangOf(S.tangHome).short})`;
    if (det && det.no !== S.tangHome) msg += ` · ⚠ โน้ตบนกระดานดูเป็น${tangOf(det.no).short}`;
    else if (det && det.extra.length) msg += ` · มีเสียงนอกบันได ${det.extra.join(' ')}`;
    el.textContent = msg;
    el.style.color = (det && det.no !== S.tangHome) ? 'var(--thn-warn, #d9a441)' : 'var(--thn-muted)';
  }

  // ตั้งทางตามที่เดาได้จากโน้ตบนกระดาน (ใช้ตอนเปิดเพลงเก่าที่ไม่มีข้อมูลทาง)
  adoptDetectedTang() {
    const d = this.detectTang();
    if (d) { this.S.tang = d.no; this.S.tangHome = d.no; }
    return d;
  }

  /* ─── ทาง (บันไดเสียง) ─── */
  // ขั้นเสียงที่ต้องเลื่อนตอนเล่น — โหมดตรึงโน้ตเท่านั้นที่มีค่า (โหมดย้ายจริงย้ายตัวอักษรไปแล้ว)
  tangShift() { return shiftBetween(this.S.tangHome, this.S.tang); }
  // ทางที่ "เดาได้จากโน้ตจริงบนกระดาน" — ไว้เตือนเมื่อไม่ตรงกับที่ตั้งไว้
  detectTang() {
    if (this._tangCache && this._tangCache.ens === this.S.notEns) return this._tangCache.val;
    const steps = [];
    this.S.verses.forEach(v => v.cells.forEach(c => HANDS.forEach(h => (c[h] || []).forEach(n => steps.push(stepOf(n.ch, n.reg || 0))))));
    if (!steps.length) return null;
    const g = guessTang(steps, { ens: this.S.notEns })[0];
    const val = g ? { no: g.no, name: g.name, extra: g.extra } : null;
    this._tangCache = { ens: this.S.notEns, val };
    return val;
  }
  // โน้ตเปลี่ยน → ต้องเดาทางใหม่ (เดินโน้ตทั้งเพลง จึงห้ามทำทุกครั้งที่วาดจอ)
  invalidateTang() { this._tangCache = null; }
  // หน่วงการเดาทาง — พิมพ์รัว ๆ จะได้ไม่เดินโน้ตทั้งเพลงทุกตัวอักษร
  scheduleTangInfo() {
    clearTimeout(this._tangT);
    this._tangT = setTimeout(() => { if (!this.dead) this.syncTangInfo(); }, 350);
  }
  // ย้ายตัวอักษรโน้ตทั้งเพลงไปกี่ขั้น (ใช้ทั้งย้ายทางจริง และสลับระบบบันทึก)
  transposeAll(by) {
    if (!by) return true;
    const steps = [];
    this.S.verses.forEach(v => v.cells.forEach(c => HANDS.forEach(h => (c[h] || []).forEach(n => steps.push(stepOf(n.ch, n.reg || 0))))));
    const use = steps.length ? bestShift(steps, by) : by;
    if (steps.some(x => x + use < WRITABLE_MIN || x + use > WRITABLE_MAX)) {
      this.flash('ย้ายไม่ได้ — โน้ตจะเกินช่วงเสียงที่เขียนได้ (ดฺ ถึง ดํ)');
      return false;
    }
    this.pushUndo();
    this.S.verses.forEach(v => v.cells.forEach(c => HANDS.forEach(h => {
      c[h] = (c[h] || []).map(n => { const o = noteOfStep(stepOf(n.ch, n.reg || 0) + use); return { ch: o.ch, reg: o.reg }; });
    })));
    return true;
  }

  // ระบบเสียงที่กำลังใช้อยู่ (object)
  tuningObj() { return tuningBySlug(this.tunings, this.S.tuning); }
  // ระบบเสียงที่ "ไฟล์เสียงของเครื่องที่เลือก" ถูกตั้งไว้ (ว่าง = ถือว่าตรงกับระบบที่กำลังเล่น)
  srcTuning() { const i = this.srcInst(); return i && i.tuning ? tuningBySlug(this.tunings, i.tuning) : null; }
  // ความถี่จริงรายขั้นเสียงของไฟล์เครื่องนี้ (มาจากตารางรายตำแหน่ง) — ตั้งจากภายนอกด้วย setNoteHzMap
  setNoteHzMap(map) { this.hzMap = map || null; }
  // ความถี่จริงของโน้ตหนึ่งตัวตามระบบเสียงที่เลือก
  hzOfNote(n) { const o = noteOfStep(stepOf(n.ch, n.reg || 0) + this.tangShift()); return hzOf(this.tuningObj(), o.ch, o.reg); }
  // เติมรายการระบบเสียงจากฐานข้อมูล
  setTuningOptions(list, { pick = null } = {}) {
    this.tunings = Array.isArray(list) && list.length ? list : BUILTIN_TUNINGS;
    const sel = this.q('[data-f="tuning"]');
    const want = (pick && this.tunings.some(t => t.slug === pick)) ? pick
      : this.tunings.some(t => t.slug === this.S.tuning) ? this.S.tuning
      : (this.tunings.find(t => t.is_default) || this.tunings[0]).slug;
    this.S.tuning = want;
    if (sel) {
      sel.innerHTML = this.tunings.map(t => `<option value="${t.slug}">${t.name_th}</option>`).join('');
      sel.value = want;
    }
    this.emit();
  }

  setSourceOptions(list, { pick = null } = {}) {
    this.sources = Array.isArray(list) ? list : [];
    const sel = this.q('[data-f="src"]');
    if (!sel) return;
    const cur = this.S.src;
    sel.innerHTML = this.sources.map(i => `<option value="${i.slug}">🎵 ${i.name_th}</option>`).join('')
      + '<option value="synth">〰 สังเคราะห์</option>';
    const want = pick && this.sources.some(i => i.slug === pick) ? pick
      : this.sources.some(i => i.slug === cur) ? cur
      : (cur === 'real' && this.sources.length ? this.sources[0].slug
        : cur === 'synth' ? 'synth' : (this.sources[0]?.slug ?? 'synth'));
    this.S.src = want; sel.value = want;
    this.buffers = null; this.hzMap = null;
    if (want !== 'synth') this.ensureAssets();
  }
  srcInst() { return (this.sources || []).find(i => i.slug === this.S.src) || null; }
  loadText(text) { const vs = textToVerses(text, { base: this.S.base }); if (!vs.length) return 0; this.pushUndo(); this.setVerses(vs); this.emit(); return vs.length; }
  toText() { return versesToText(this.getVerses(), { lines: this.nH() }); }
  emit() { this.invalidateTang(); this.scheduleTangInfo(); this.onChange({ verses: this.getVerses(), ...this.getState() }); }
  destroy() { this.dead = true; clearTimeout(this._tangT); clearTimeout(this._an); clearTimeout(this._rsT); window.removeEventListener('resize', this._resize); this.stopPlay(); this.root.innerHTML = ''; this.root.classList.remove('thn', 'fnt-notation', 'fnt-unicode'); document.removeEventListener('keydown', this._key); document.removeEventListener('keyup', this._keyup); window.removeEventListener('blur', this._blur); this.clearHold(); document.removeEventListener('mouseup', this._up); document.removeEventListener('mousemove', this._mv); if (this.move) this.endMove(false); document.removeEventListener('paste', this._paste); }

  syncControls() {
    const S = this.S, r = this.root;
    { const sy = r.querySelector('[data-f="system"]'); if (sy) sy.value = S.system; }
    { const tn = r.querySelector('[data-f="tuning"]'); if (tn && S.tuning) tn.value = S.tuning; }
    { const tg = r.querySelector('[data-f="tang"]'); if (tg) tg.value = String(S.tang); }
    { const ne = r.querySelector('[data-f="notens"]'); if (ne) ne.value = S.notEns; }
    { const tv = r.querySelector('[data-f="tangview"]'); if (tv) tv.value = S.tangView; }
    this.scheduleTangInfo();
    r.querySelectorAll('[data-font]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.font === S.font)));
    this.q('[data-f="ta"]').value = String(S.ta);
    this.q('[data-f="rap"]').value = String(S.rap);
    this.q('[data-f="chingmode"]').value = S.chingMode;
    // ค่าเริ่มต้นของเพลง (ฉิ่ง/กลอง/ความเร็ว) ที่ส่งเข้ามาตอนเปิดกระดาน ต้องขึ้นบนแถบเครื่องมือด้วย
    { const c = this.q('[data-f="ching"]'); if (c) c.checked = !!S.chingOn; }
    { const kg = this.q('[data-f="krogap"]'); if (kg) kg.value = String(S.kroGap); }
    { const n = this.q('[data-f="nathab"]'); if (n && [...n.options].some(o => o.value === S.nathab)) n.value = S.nathab; }
    { const d = this.q('[data-f="drum"]'); if (d && [...d.options].some(o => o.value === S.drum)) d.value = S.drum; }
    this.q('[data-f="bpm"]').value = S.bpm; this.t('bpm').textContent = S.bpm;
    this.t('linesum').textContent = (S.ta + S.rap) + ' ห้อง';
    this.t('split').textContent = S.rap > 0 ? 'ท้า ' + S.ta + ' + รับ ' + S.rap : 'วรรคเดียว ' + S.ta + ' ห้อง';
  }

  /* ─── โครงสร้าง ─── */
  newLine(sec) {
    const S = this.S, sizes = S.rap > 0 ? [S.ta, S.rap] : [S.ta];
    return sizes.map((h, i) => mkVerse(sec, h, i === 0));
  }
  reindex() { let o = 0; this.S.verses.forEach(v => { v._off = o; o += v.cells.length; }); this.S.total = o; }
  appendLine() { const S = this.S; S.verses.push(...this.newLine(S.verses.length ? S.verses[S.verses.length - 1].sec : 'ท่อน 1')); this.reindex(); }
  lineStartOf(i) { while (i > 0 && !this.S.verses[i].nl) i--; return i; }
  // ไม่ถูกเรียกอัตโนมัติแล้ว (ดู rebuild) — เก็บไว้เผื่อใช้ตอนบันทึก
  trimTail() {
    const S = this.S;
    while (S.verses.length > 2) {
      const tailStart = this.lineStartOf(S.verses.length - 1);
      if (tailStart <= 0 || S.caret.v >= tailStart) break;
      const prevStart = this.lineStartOf(tailStart - 1);
      if (S.verses.slice(tailStart).some(hasSound) || S.verses.slice(prevStart, tailStart).some(hasSound)) break;
      S.verses.length = tailStart;
    }
  }
  // เก็บสถานะทางไปด้วย — ย้ายทาง/สลับระบบบันทึกแล้วกดย้อนกลับ ต้องคืนทั้งโน้ตและทาง
  pushUndo() {
    const S = this.S;
    this.undoStack.push(JSON.stringify({ v: S.verses, c: S.caret,
      tang: S.tang, tangHome: S.tangHome, notEns: S.notEns, tuning: S.tuning }));
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.syncUndo();
  }
  syncUndo() { const b = this.q('[data-a="undo"]'); if (b) { b.disabled = !this.undoStack.length; b.textContent = this.undoStack.length ? `↶ ย้อนกลับ (${this.undoStack.length})` : '↶ ย้อนกลับ'; } }
  undo() {
    const s = this.undoStack.pop(); this.syncUndo();
    if (!s) { this.flash('ไม่มีอะไรให้ย้อน'); return; }
    const o = JSON.parse(s);
    this.S.verses = o.v; this.S.caret = o.c; this.S.sel = null;
    if (o.tang != null) { this.S.tang = o.tang; this.S.tangHome = o.tangHome; if (o.tuning) this.S.tuning = o.tuning; }   // notEns ผูกกับ tuning จึงคืนตามเอง
    this.reindex(); this.rebuild(); this.syncControls(); this.emit(); this.flash('ย้อนกลับแล้ว');
  }
  computeRows() {
    this.rows = []; this.rowOfVerse = [];
    let cur = null, lastSec = null, no = 0;
    this.S.verses.forEach((v, vi) => {
      const secChanged = v.sec !== lastSec;
      if (secChanged) { lastSec = v.sec; no = 0; cur = null; }
      if (!cur || v.nl) { cur = { sec: v.sec, vs: [], newSec: secChanged, no: ++no }; this.rows.push(cur); }
      cur.vs.push(vi); this.rowOfVerse[vi] = this.rows.length - 1;
    });
  }
  /* ─── ท่อน: จัดการอิสระ (Pk 2026-08-26) ───
     "ท่อน" = ช่วงวรรคที่ติดกันและมี sec เดียวกัน (contiguous block) — อ้างด้วยดัชนีวรรคเริ่มต้น
     ทำแบบนี้เพื่อให้ท่อนชื่อซ้ำกันคนละที่ในเพลง (เช่น "ลา" สองครั้ง) ไม่ถูกจับรวมเป็นท่อนเดียว   */
  sectionBlocks() {
    const out = [];
    this.S.verses.forEach((v, i) => {
      const last = out[out.length - 1];
      if (last && last.sec === v.sec && last.to === i - 1) last.to = i;
      else out.push({ sec: v.sec, from: i, to: i });
    });
    return out;
  }
  blockAt(vi) { return this.sectionBlocks().find(b => vi >= b.from && vi <= b.to) || null; }
  // ชื่อท่อนที่ยังไม่ถูกใช้
  freeSecName(base = 'ท่อนใหม่') {
    const used = new Set(this.S.verses.map(v => v.sec));
    if (!used.has(base)) return base;
    for (let n = 2; ; n++) { const k = base + ' ' + n; if (!used.has(k)) return k; }
  }
  // คืนเคอร์เซอร์ให้อยู่วรรคเดิม (หรือใกล้ที่สุด) หลังโครงสร้างเปลี่ยน
  //   ปุ่มบนหัวท่อนถูกสร้างใหม่ทุกครั้งที่ rebuild → ปุ่มที่เพิ่งกดหายไปจาก DOM โฟกัสตกไปที่ body
  //   ทำให้คีย์ลัด (Ctrl+Z ฯลฯ) ไม่ทำงานต่อ — ต้องคืนโฟกัสให้กระดานเอง
  afterStructure(vi = null) {
    const S = this.S;
    this.reindex(); this.rebuild();
    if (vi != null) { const v = Math.max(0, Math.min(vi, S.verses.length - 1)); this.setCaret({ v, p: 0, hand: S.caret.hand }); }
    const sc = this.t('score'); if (sc) sc.focus({ preventScroll: true });
    this.emit();
  }
  renameSection(vi) {
    const b = this.blockAt(vi); if (!b) return;
    const nm = window.prompt('ชื่อท่อน (ใช้กับทุกวรรคของท่อนนี้)', b.sec);
    if (nm == null) return;
    const name = nm.trim();
    if (!name || name === b.sec) return;
    this.pushUndo();
    for (let i = b.from; i <= b.to; i++) this.S.verses[i].sec = name;
    this.afterStructure(b.from);
    this.flash(`เปลี่ยนชื่อท่อนเป็น "${name}" แล้ว (Ctrl+Z คืนได้)`);
  }
  insertSection(vi, where = 'after') {
    const b = this.blockAt(vi); if (!b) return;
    const name = this.freeSecName();
    this.pushUndo();
    const at = where === 'before' ? b.from : b.to + 1;
    const made = this.newLine(name);
    made.forEach(v => { v.level = this.S.verses[b.from].level; });
    this.S.verses.splice(at, 0, ...made);
    this.afterStructure(at);
    this.flash(`แทรกท่อน "${name}" ${where === 'before' ? 'ก่อน' : 'หลัง'}ท่อน "${b.sec}" แล้ว — กด ✎ เปลี่ยนชื่อได้`);
  }
  moveSection(vi, dir) {
    const blocks = this.sectionBlocks(), si = blocks.findIndex(b => vi >= b.from && vi <= b.to);
    const other = blocks[si + dir];
    if (si < 0 || !other) return;
    const S = this.S, me = blocks[si];
    this.pushUndo();
    const a = dir < 0 ? other : me, bb = dir < 0 ? me : other;   // a อยู่ก่อน bb เสมอ
    const A = S.verses.slice(a.from, a.to + 1), B = S.verses.slice(bb.from, bb.to + 1);
    S.verses.splice(a.from, (bb.to - a.from) + 1, ...B, ...A);
    S.verses[a.from].nl = true;                                  // ต้นท่อนต้องเป็นหัวบรรทัดเสมอ
    S.verses[a.from + B.length].nl = true;
    this.afterStructure(dir < 0 ? a.from : a.from + B.length);
    this.flash(`สลับที่ท่อน "${me.sec}" กับ "${other.sec}" แล้ว (Ctrl+Z คืนได้)`);
  }
  mergeSection(vi) {
    const blocks = this.sectionBlocks(), si = blocks.findIndex(b => vi >= b.from && vi <= b.to);
    if (si <= 0) return;
    const me = blocks[si], prev = blocks[si - 1], S = this.S;
    this.pushUndo();
    for (let i = me.from; i <= me.to; i++) { S.verses[i].sec = prev.sec; S.verses[i].level = S.verses[prev.from].level; }
    S.verses[me.from].nl = true;
    this.afterStructure(me.from);
    this.flash(`รวมท่อน "${me.sec}" เข้ากับ "${prev.sec}" แล้ว (Ctrl+Z คืนได้)`);
  }
  // ให้บรรทัดที่เคอร์เซอร์อยู่เป็นต้นท่อนใหม่ (บรรทัดที่เหลือของท่อนเดิมตามไปด้วย)
  splitSectionAtCaret(vi) {
    const b = this.blockAt(vi); if (!b) return;
    const S = this.S, cv = S.caret.v;
    if (cv < b.from || cv > b.to) { this.flash(`เคอร์เซอร์ไม่ได้อยู่ในท่อน "${b.sec}" — คลิกช่องในท่อนนี้ก่อนแล้วค่อยกด ✂`); return; }
    const start = this.lineStartOf(cv);
    if (start === b.from) { this.flash('บรรทัดนี้เป็นต้นท่อนอยู่แล้ว'); return; }
    const name = this.freeSecName();
    this.pushUndo();
    for (let i = start; i <= b.to; i++) S.verses[i].sec = name;
    S.verses[start].nl = true;
    this.afterStructure(start);
    this.flash(`แยกเป็นท่อน "${name}" ตั้งแต่บรรทัดนี้ลงไป — กด ✎ เปลี่ยนชื่อได้ (Ctrl+Z คืนได้)`);
  }
  deleteSection(vi) {
    const blocks = this.sectionBlocks(), si = blocks.findIndex(b => vi >= b.from && vi <= b.to);
    if (si < 0 || blocks.length <= 1) { this.flash('เพลงต้องมีอย่างน้อยหนึ่งท่อน'); return; }
    const b = blocks[si], S = this.S;
    const n = b.to - b.from + 1;
    // ถามทุกครั้ง — เดิมท่อนว่างลบทันทีโดยไม่ถาม ซึ่งเสียท่อนที่เพิ่งตั้งชื่อไว้ไปเฉย ๆ (Pk 27 ส.ค. 69)
    const warn = S.verses.slice(b.from, b.to + 1).some(hasSound)
      ? `ท่อน "${b.sec}" มีโน้ตอยู่ ${n} วรรค — ลบทั้งท่อน?`
      : `ลบท่อน "${b.sec}" (${n} วรรค ยังไม่มีโน้ต)?`;
    if (!window.confirm(warn)) return;
    this.pushUndo(); this.stopPlay();
    S.verses.splice(b.from, n);
    if (!S.verses.length) S.verses.push(...this.newLine('ท่อน 1'));
    if (S.verses[b.from]) S.verses[b.from].nl = true;
    S.caret = { v: Math.min(b.from, S.verses.length - 1), p: 0, hand: S.caret.hand };
    this.setSel(null);
    this.afterStructure(Math.min(b.from, S.verses.length - 1));
    this.flash(`ลบท่อน "${b.sec}" (${n} วรรค) แล้ว (Ctrl+Z คืนได้)`);
  }

  // ระดับอัตราของท่อน (เพลงเถา: ท่อนละอัตรา) — เก็บที่ v.level ของทุกวรรคในท่อน
  secLevel(sec) {
    const v = this.S.verses.find(x => x.sec === sec && x.level);
    return v ? v.level : this.S.level;
  }
  // meta ต่อ step: {mark, level, rel} — rel นับใหม่ทุกต้นท่อน ฉิ่งจึงตั้งต้นตรงกับท่อน
  buildChingMeta() {
    const S = this.S, meta = new Array(S.total);
    let lastSec = null, rel = 0, level = S.level, cyc = 16;
    S.verses.forEach(v => {
      if (v.sec !== lastSec) { lastSec = v.sec; rel = 0; level = this.secLevel(v.sec); cyc = (CHING_CYCLE[level] || 4) * 4; }
      for (let i = 0; i < v.cells.length; i++, rel++) {
        let mark = '';
        if (S.chingMode === 'manual') mark = (v.ching && v.ching[i]) || '';
        else { const p = (rel % cyc) + 1; mark = p === cyc / 2 ? 'ฉิ่ง' : p === cyc ? 'ฉับ' : ''; }
        meta[v._off + i] = { mark, level, rel };
      }
    });
    return meta;
  }
  // ทุกช่องต้องมีอาร์เรย์ครบทุกบรรทัด (วรรคเก่าที่บันทึกไว้ตอนยังมี 2 บรรทัด ไม่มี .x)
  ensureHands() {
    const S = this.S;
    S.verses.forEach(v => v.cells.forEach(c => { HANDS.forEach(h => { if (!Array.isArray(c[h])) c[h] = []; }); }));
  }

  /* ─── ทางเก็บระนาดเอก: เติมคู่แปดให้มืออีกข้างอัตโนมัติ ─── */
  // แนวปลายทางยัง "อัตโนมัติ" อยู่ไหม (ว่าง หรือเป็นคู่แปดของแนวต้นทางเป๊ะ ๆ) — ถ้าคนแก้เองแล้วจะไม่ทับ
  static isOct(from, to, shift) {
    if (!to || !to.length) return true;
    if (!from || from.length !== to.length) return false;
    return from.every((n, i) => to[i] && to[i].ch === n.ch && (to[i].reg ?? 0) === NotationEngine.octReg(n, shift));
  }
  static octReg(n, shift) { return Math.max(-1, Math.min(1, (n.reg ?? 0) + shift)); }
  autoSpec() { return autoOctaveOf(this.S.system); }
  // เรียกหลังแก้ช่อง · prevFrom = โน้ตแนวต้นทางก่อนแก้ (ใช้ดูว่าแนวปลายทางยังเป็นอัตโนมัติอยู่ไหม)
  applyAutoOctave(cell, prevFrom) {
    const sp = this.autoSpec(); if (!sp || !cell) return;
    if (!NotationEngine.isOct(prevFrom, cell[sp.to], sp.shift)) return;   // คนแก้มือซ้ายเองไว้ — ไม่ทับ
    cell[sp.to] = (cell[sp.from] || []).map(n => ({ ch: n.ch, reg: NotationEngine.octReg(n, sp.shift) }));
  }
  // เติมคู่แปดทั้งเพลง (ตอนสลับมาใช้ระบบทางเก็บ) — เฉพาะช่องที่มืออีกข้างยังว่าง
  fillAutoOctave() {
    const sp = this.autoSpec(); if (!sp) return;
    this.S.verses.forEach(v => v.cells.forEach(c => {
      if ((c[sp.to] || []).length) return;
      c[sp.to] = (c[sp.from] || []).map(n => ({ ch: n.ch, reg: NotationEngine.octReg(n, sp.shift) }));
    }));
  }

  voicesG() {
    const S = this.S, HK = this.hands();
    const G = HK.map(() => []);
    S.verses.forEach(v => v.cells.forEach(c => {
      if (HK.length === 1) G[0].push(cellFirst(c));
      else HK.forEach((h, hi) => G[hi].push(c[h] || []));
    }));
    return G;
  }

  /* ─── วาด ─── */
  buildRow(row, ctx) {
    const S = this.S, { runs, consumed, total } = ctx;
    const wrap = $el('div', 'thn-row'), top = $el('div', 'thn-top');
    const first = row.vs[0], last = row.vs[row.vs.length - 1];
    const lab = $el('div', 'thn-vlabel'); lab.innerHTML = 'ว.<b>' + (first + 1) + (last !== first ? '–' + (last + 1) : '') + '</b>';
    // ป้ายลากสร้าง "เส้นแบ่งวรรคใหม่" — บรรทัดที่ไม่มีเส้นเลย (หรืออยากได้เส้นเพิ่ม) ก็แบ่งวรรคได้
    if (!this.readOnly && this.lineHongTotal(row) > 1) {
      const nb = $el('div', 'thn-newsep', '┊');
      nb.title = 'ลากไปวางระหว่างห้องที่ต้องการ = สร้างเส้นแบ่งวรรคใหม่ในบรรทัดนี้ (หรือวางเคอร์เซอร์แล้วกดแป้น | )';
      nb.addEventListener('mousedown', ev => { ev.preventDefault(); ev.stopPropagation(); this.beginSplit(row, null, nb, wrap, 'new'); });
      lab.append(nb);
    }
    top.append(lab);
    const hands = $el('div', 'thn-hands');

    const cr = $el('div', 'thn-hrow'); cr.append($el('span', 'thn-htag', ''));
    const cbars = $el('div', 'thn-bars');
    const manual = S.chingMode === 'manual' && !this.readOnly;
    row.vs.forEach((vi, k) => {
      if (k) cbars.append($el('span', 'thn-vsep ghost'));
      const v = S.verses[vi];
      for (let h = 0; h < hongOf(v); h++) {
        const g = $el('div', 'thn-grp thn-ching' + (manual ? ' editable' : ''));
        for (let p = 0; p < 4; p++) {
          const idx = h * 4 + p;
          const m = ctx.chingMeta[v._off + idx];
          const sp = $el('span', '', m ? m.mark : '');
          if (manual) {
            sp.title = 'คลิกสลับ ว่าง → ฉิ่ง → ฉับ';
            sp.addEventListener('click', () => {
              this.pushUndo();
              if (!v.ching) v.ching = new Array(v.cells.length).fill('');
              const cur = v.ching[idx] || '';
              v.ching[idx] = cur === '' ? 'ฉิ่ง' : cur === 'ฉิ่ง' ? 'ฉับ' : '';
              this.repaintRows([this.rowOfVerse[vi]]); this.emit();
            });
          }
          g.append(sp);
        }
        cbars.append(g);
      }
    });
    cr.append(cbars); hands.append(cr);

    const arcJobs = [], kroJobs = [];
    const LINES = linesOf(S.system);
    LINES.forEach((ln, hi) => {
      const hand = ln.key;
      const hr = $el('div', 'thn-hrow'); hr.append($el('span', 'thn-htag', LINES.length > 1 ? ln.tag : ''));
      const bars = $el('div', 'thn-bars');
      row.vs.forEach((vi, k) => {
        if (k) {
          const sep = $el('span', 'thn-vsep');
          if (!this.readOnly) { sep.title = 'ลากเส้นแบ่งวรรคไปวางระหว่างห้องไหนก็ได้ในบรรทัดนี้'; sep.addEventListener('mousedown', ev => { ev.preventDefault(); ev.stopPropagation(); this.beginSplit(row, k, sep, wrap); }); }
          bars.append(sep);
        }
        const v = S.verses[vi];
        for (let h = 0; h < hongOf(v); h++) {
          const g = $el('div', 'thn-grp cells'); g.dataset.hong = v._off + h * 4; g.dataset.line = row.vs[0];
          for (let p = 0; p < 4; p++) {
            const idx = h * 4 + p, step = v._off + idx, cell = v.cells[idx];
            const notes = LINES.length > 1 ? (cell[hand] || []) : cellFirst(cell);
            const c = $el('div', 'thn-cell');
            if (p === 3) c.classList.add('beat');
            if (!notes.length) c.classList.add('empty');
            if (notes.length > 1) c.classList.add('sabat');
            // ประคบแยกอิสระรายมือ (Pk 27 ส.ค.) — แนวไหนติดประคบ แนวนั้นหนา แนวอื่นไม่เกี่ยว
            if (LINES.length > 1 ? isDamp(cell, hand) : dampMask(cell)) c.classList.add('damp');
            if (cell.m === 'kro') c.classList.add('kro');
            const run = runs.get(hi * total + step);
            if (run) arcJobs.push({ hr, run, hi });
            if (cell.m === 'kro' && hi === 0) kroJobs.push({ hr, step });
            if (consumed[hi][step]) c.classList.add('lead');
            if (notes.length) notes.forEach(n => c.append($el('span', 'gl', S.font === 'notation' ? noteKey(n) : noteText(n))));
            else c.append($el('span', 'gl', '-'));
            if (S.caret.v === vi && S.caret.p === idx && (LINES.length === 1 || S.caret.hand === hand)) c.classList.add('cur');
            c.dataset.step = step;
            c.addEventListener('mousedown', ev => {
              ev.preventDefault();
              if (ev.shiftKey && !this.readOnly) { this.setSel(this.caretStep(), step); this.S.caret = { v: vi, p: idx, hand }; this.afterPaint(); }
              else {
                // คลิกในช่วงที่เลือกไว้ ยังไม่ล้างทันที (เผื่อกดค้างย้ายทั้งช่วง) — ปล่อยเมาส์โดยไม่ลากค่อยล้าง
                const inSel = !!(this.S.sel && this.S.sel.a <= step && step <= this.S.sel.b);
                if (!inSel) this.setSel(null);
                this.setCaret({ v: vi, p: idx, hand }, { scroll: false });
                if (!this.readOnly) this.drag = { anchor: step, inSel, moved: false, x: ev.clientX, y: ev.clientY };
              }
              if (this.play.on) this.startPlay(step);
              this.t('score').focus({ preventScroll: true });
              // กดค้าง ~0.4 วิ โดยไม่ลากออกจากช่อง = ยกทั้งห้องขึ้นมาย้าย
              if (!this.readOnly && !ev.shiftKey) { clearTimeout(this._lp); this._lp = setTimeout(() => { if (this.drag && this.drag.anchor === step && !this.drag.moved) this.beginMove(step, ev); }, 400); }
            });
            c.addEventListener('mouseenter', () => { if (this.drag && this.drag.anchor !== step && this.drag.moved) { clearTimeout(this._lp); this.setSel(this.drag.anchor, step); } });
            c.addEventListener('dblclick', ev => { ev.preventDefault(); this.startPlay(step); });
            this.cellEls[step] = this.cellEls[step] || { r: null, l: null };
            this.cellEls[step][hand] = c;
            g.append(c);
          }
          bars.append(g);
        }
      });
      hr.append(bars); hands.append(hr);
    });

    const kr = $el('div', 'thn-hrow'); kr.append($el('span', 'thn-htag', ''));
    const kbars = $el('div', 'thn-bars');
    row.vs.forEach((vi, k) => {
      if (k) kbars.append($el('span', 'thn-vsep ghost'));
      const v = S.verses[vi];
      for (let h = 0; h < hongOf(v); h++) {
        const code = krasuanOf(v, h), kg = $el('div', 'thn-kg' + (code === 'O' ? ' rest' : ''), code);
        if (!this.readOnly) { kg.title = 'ลากเพื่อย้ายห้องนี้ (หรือกดค้างที่ช่องโน้ต)'; kg.addEventListener('mousedown', ev => { ev.preventDefault(); this.beginMove(v._off + h * 4, ev); }); }
        kbars.append(kg);
      }
    });
    kr.append(kbars); hands.append(kr);
    top.append(hands); wrap.append(top);

    const info = $el('div', 'thn-info');
    const lt = row.vs.map(vi => luktokOf(S.verses[vi]));
    if (lt.some(Boolean)) {
      const d = $el('span', 'thn-luk');
      d.innerHTML = row.vs.length === 2
        ? 'ลูกตก ท้า <b>' + (lt[0] ? lt[0].ch : '–') + '</b> · รับ <b>' + (lt[1] ? lt[1].ch : '–') + '</b>'
        : 'ลูกตก <b>' + (lt[0] ? lt[0].ch : '–') + '</b>';
      info.append(d);
    }
    if (row.vs.length === 2 && lt[0] && lt[1]) { const id = pairId(lt[0].ch, lt[1].ch); const pb = $el('span', 'thn-pair'); pb.innerHTML = 'ประโยค ' + row.no + ' · <b>' + id.th + '</b> / ' + id.en; info.append(pb); }
    row.vs.forEach(vi => { const v = S.verses[vi]; if (hongOf(v) !== S.base && hasSound(v)) info.append($el('span', 'thn-short', 'ว.' + (vi + 1) + (hongOf(v) < S.base ? ' วรรคสั้น ' : ' วรรคยาว ') + hongOf(v) + ' ห้อง (จังหวะพิเศษ)')); });
    lt.forEach((x, k) => { if (x && !x.exact) info.append($el('span', 'thn-flag', '⚑ ว.' + (row.vs[k] + 1) + ' ห้องท้ายว่าง')); });
    row.vs.forEach(vi => { const v = S.verses[vi]; for (let h = 0; h < hongOf(v); h++) { const c = v.cells[h * 4]; if (c.r.length > 1 || (c.l || []).length > 1 || (c.x || []).length > 1) { info.append($el('span', 'thn-flag', '⚑ ว.' + (vi + 1) + ' สะบัดต้นห้อง')); return; } } });
    if (info.childNodes.length) wrap.append(info);
    wrap._arcJobs = arcJobs;
    wrap._kroJobs = kroJobs;
    return wrap;
  }
  // ตำแหน่งที่ "มีเสียงถัดไป" หลังจาก step หนึ่ง — ปลายของช่วงกรอ (Pk: กรอยาวถึงโน้ตตัวหน้า)
  nextSoundStep(step) {
    const S = this.S;
    for (let k = step + 1; k < S.total; k++) { const c = this.cellAt(k); if (c && cellNotes(c).length) return k; }
    return S.total;
  }
  // คลื่นกรอ: อยู่เหนือ "โน้ตตัวที่กรอ" ตัวเดียว ไม่ลากยาวไปหาเสียงถัดไป (Pk 27 ส.ค.)
  //   ตอนเล่นยังกรอยาวถึงเสียงถัดไปเหมือนเดิม — เปลี่ยนแค่การแสดงผลบนกระดาน
  drawKro(wrap) {
    (wrap._kroJobs || []).forEach(({ hr, step }) => {
      const HK = this.hands();
      const from = this.cellEls[step] && this.cellEls[step][HK[0] || 'r'];
      if (!from) return;
      const box = hr.getBoundingClientRect(), a = from.getBoundingClientRect();
      const w = Math.max(10, a.width - 4);
      const el = $el('div', 'thn-kro');
      el.style.left = (a.left - box.left + 2) + 'px';
      el.style.width = w + 'px';
      el.style.top = (a.top - box.top - 6) + 'px';
      // คลื่นวาดด้วย SVG ซ้ำเป็นลูก ๆ ตามความกว้างจริง
      const n = Math.max(2, Math.round(w / 7));
      let d = 'M0 5';
      for (let i = 0; i < n; i++) d += ` q 1.75 -4.5 3.5 0 t 3.5 0`;
      el.innerHTML = `<svg viewBox="0 0 ${n * 7} 7" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
      hr.append(el);
    });
  }
  drawArcs(wrap) {
    (wrap._arcJobs || []).forEach(({ hr, run, hi }) => {
      const HKa = this.hands();
      const pairEl = this.cellEls[run.step] && this.cellEls[run.step][HKa[hi] || 'r'];
      if (!pairEl) return;
      let leftEl = pairEl;
      if (run.leadStep >= 0 && run.leadHand === hi) { const le = this.cellEls[run.leadStep] && this.cellEls[run.leadStep][HKa[hi] || 'r']; if (le && le.closest('.thn-hrow') === hr) leftEl = le; }
      const box = hr.getBoundingClientRect(), l = leftEl.getBoundingClientRect(), r = pairEl.getBoundingClientRect();
      const arc = $el('div', 'thn-arc');
      arc.style.left = (l.left - box.left + 2) + 'px'; arc.style.width = Math.max(8, r.right - l.left - 4) + 'px'; arc.style.top = (l.top - box.top + 1) + 'px';
      hr.append(arc);
    });
  }
  // บีบ/คลายความกว้างช่อง (--cw) ให้บรรทัดที่กว้างสุดพอดีกรอบ — ตกขอบเฉพาะเมื่อย่อสุดแล้วยังไม่พอ (จอแคบมาก)
  fitWidth(reset = true) {
    if (this.dead) return;
    const score = this.t('score'); if (!score) return;
    const BASE = 34.4, MIN = 18;
    if (reset) this.root.style.setProperty('--cw', BASE + 'px');
    let maxPos = 0;
    this.rows.forEach(r => { let n = 0; r.vs.forEach(vi => n += this.S.verses[vi].cells.length); if (n > maxPos) maxPos = n; });
    if (!maxPos) maxPos = 32;
    let cw = parseFloat(this.root.style.getPropertyValue('--cw')) || BASE;
    for (let i = 0; i < 6; i++) {
      const over = score.scrollWidth - score.clientWidth;
      if (over <= 2 || cw <= MIN) break;
      cw = Math.max(MIN, cw - over / maxPos - 0.5);
      this.root.style.setProperty('--cw', cw.toFixed(2) + 'px');
    }
    // เส้นโค้งสะบัดอิงพิกัดจริง ต้องวาดใหม่หลังได้ขนาดสุดท้าย
    this.root.querySelectorAll('.thn-arc, .thn-kro').forEach(a => a.remove());
    this.rowEls.forEach(w => { this.drawArcs(w); this.drawKro(w); });
  }
  rebuild() {
    // (เดิมเรียก trimTail() ตรงนี้ — เก็บบรรทัดว่างท้ายเพลงทิ้งเงียบ ๆ ทุกครั้งที่วาดใหม่
    //  ทำให้ Shift+Enter/ลบห้อง แล้ว "บรรทัดที่ 3 หายทั้งบรรทัด" (Pk รายงาน 25 ส.ค.) → เลิกลบเองแล้ว ผู้ใช้ลบเองด้วย 🗑 ลบบรรทัดนี้)
    this.reindex();
    const S = this.S;
    if (S.caret.v >= S.verses.length) S.caret = { v: S.verses.length - 1, p: 0, hand: 'r' };
    if (S.caret.p >= S.verses[S.caret.v].cells.length) S.caret.p = S.verses[S.caret.v].cells.length - 1;
    this.computeRows();
    const score = this.t('score'); score.innerHTML = '';
    this.cellEls = []; this.rowEls = [];
    const ctx = buildVoices(this.voicesG());
    ctx.chingMeta = this.buildChingMeta();
    this.rows.forEach((row, ri) => {
      if (row.newSec) {
        const head = $el('div', 'thn-sec');
        head.append($el('span', 'thn-sec-name', row.sec), $el('span', 'thn-sec-rule'));
        // เครื่องมือจัดการท่อน (Pk 2026-08-26): เปลี่ยนชื่อ · แทรกก่อน/หลัง · เลื่อนขึ้น/ลง · รวม · แยกที่เคอร์เซอร์ · ลบ
        if (!this.readOnly) {
          const at = row.vs[0], blocks = this.sectionBlocks(), si = blocks.findIndex(b => at >= b.from && at <= b.to);
          const tools = $el('div', 'thn-sec-tools');
          const mk = (label, title, fn, disabled) => {
            const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title;
            if (disabled) b.disabled = true; else b.addEventListener('click', fn);
            tools.append(b); return b;
          };
          mk('✎', 'เปลี่ยนชื่อท่อนนี้', () => this.renameSection(at));
          mk('＋ก่อน', 'แทรกท่อนว่างก่อนท่อนนี้', () => this.insertSection(at, 'before'));
          mk('＋หลัง', 'แทรกท่อนว่างหลังท่อนนี้', () => this.insertSection(at, 'after'));
          mk('↑', 'สลับที่กับท่อนก่อนหน้า', () => this.moveSection(at, -1), si <= 0);
          mk('↓', 'สลับที่กับท่อนถัดไป', () => this.moveSection(at, 1), si < 0 || si >= blocks.length - 1);
          mk('⤴ รวมกับท่อนก่อน', 'ยุบท่อนนี้เข้าเป็นส่วนหนึ่งของท่อนก่อนหน้า', () => this.mergeSection(at), si <= 0);
          mk('✂ แยกที่เคอร์เซอร์', 'ให้บรรทัดที่เคอร์เซอร์อยู่ (ต้องอยู่ในท่อนนี้) เป็นต้นท่อนใหม่', () => this.splitSectionAtCaret(at));
          mk('🗑 ลบท่อน', 'ลบท่อนนี้ทั้งท่อน (ทุกวรรคในท่อนหายทั้งหมด · Ctrl+Z คืนได้)', () => this.deleteSection(at), blocks.length <= 1)
            .classList.add('danger');
          head.append(tools);
        }
        // อัตราชั้นของท่อนนี้ (เพลงเถาแต่ละท่อนคนละอัตรา) — คุมตำแหน่งฉิ่งและหน้าทับของท่อน
        const sel = document.createElement('select');
        sel.className = 'thn-seclevel';
        ['สามชั้น', 'สองชั้น', 'ชั้นเดียว'].forEach(lv => { const o = document.createElement('option'); o.textContent = lv; sel.append(o); });
        sel.value = this.secLevel(row.sec);
        if (this.readOnly) sel.disabled = true;
        sel.addEventListener('change', () => {
          this.pushUndo();
          // เฉพาะช่วงวรรคของท่อนนี้ (ท่อนชื่อซ้ำกันคนละที่ในเพลงจึงตั้งอัตราต่างกันได้)
          const b = this.blockAt(row.vs[0]);
          if (b) for (let i = b.from; i <= b.to; i++) this.S.verses[i].level = sel.value;
          else this.S.verses.forEach(v => { if (v.sec === row.sec) v.level = sel.value; });
          this.rebuild(); this.emit();
        });
        const wrapSel = $el('span', 'thn-pick'); wrapSel.append(document.createTextNode('อัตรา '), sel);
        head.append(wrapSel);
        const cnt = this.S.verses.filter(x => x.sec === row.sec).length;
        head.append($el('span', 'thn-sec-meta', cnt + ' วรรค · ' + Math.floor(cnt / 2) + ' ประโยค' + (cnt % 2 ? ' + เศษ 1' : '')));
        score.append(head);
      }
      const w = this.buildRow(row, ctx); this.rowEls[ri] = w; score.append(w);
    });
    this.fitWidth();
    this.paintSel();
    this.afterPaint();
  }
  repaintRows(idxs) {
    const ctx = buildVoices(this.voicesG());
    ctx.chingMeta = this.buildChingMeta();
    [...new Set(idxs)].filter(i => i >= 0 && i < this.rows.length).sort((a, b) => a - b).forEach(ri => {
      const w = this.buildRow(this.rows[ri], ctx); this.rowEls[ri].replaceWith(w); this.rowEls[ri] = w; this.drawArcs(w); this.drawKro(w);
    });
    this.paintSel();
    this.afterPaint();
  }

  /* ─── เลือกช่วง · คัดลอก/วาง · แทรก/ตัดแล้วเลื่อน (reflow) ─── */
  setSel(a, b) {
    const S = this.S;
    S.sel = (a == null || b == null) ? null : { a: Math.min(a, b), b: Math.max(a, b) };
    this.paintSel();
  }
  selRange() { const s = this.S.sel; return s ? [s.a, s.b] : null; }
  paintSel() {
    const S = this.S;
    this.root.querySelectorAll('.thn-cell.sel').forEach(e => e.classList.remove('sel'));
    if (S.sel) for (let st = S.sel.a; st <= S.sel.b; st++) { const m = this.cellEls[st]; if (m) HANDS.forEach(h => { if (m[h]) m[h].classList.add('sel'); }); }
    const info = this.t('selinfo');
    if (info) info.textContent = S.sel ? `เลือก ${S.sel.b - S.sel.a + 1} ช่อง (${((S.sel.b - S.sel.a + 1) / 4).toFixed(2).replace(/\.?0+$/, '')} ห้อง)` : 'ลากเมาส์คลุมช่องเพื่อเลือก · Shift+ลูกศร ก็ได้';
  }
  // step → {v, p}
  locate(step) {
    const S = this.S;
    for (let v = 0; v < S.verses.length; v++) { const n = S.verses[v].cells.length; if (step < S.verses[v]._off + n) return { v, p: step - S.verses[v]._off }; }
    return null;
  }
  cellAt(step) { const l = this.locate(step); return l ? this.S.verses[l.v].cells[l.p] : null; }
  // ช่วงที่ใช้ทำงาน: ที่เลือกไว้ หรือช่องเคอร์เซอร์ช่องเดียว
  workRange() { return this.selRange() || [this.caretStep(), this.caretStep()]; }
  copySel() {
    const [a, b] = this.workRange();
    this.clip = [];
    for (let st = a; st <= b; st++) { const c = this.cellAt(st); this.clip.push(c ? { r: c.r.map(n => ({ ...n })), l: (c.l || []).map(n => ({ ...n })), x: (c.x || []).map(n => ({ ...n })), m: c.m, d: c.d } : { r: [], l: [], x: [] }); }
    // ส่งขึ้นคลิปบอร์ดระบบเป็นข้อความโน้ตด้วย (วางลง Word/ฐานข้อมูลได้)
    const nH = this.nH();
    const txt = nH >= 2
      ? 'R: ' + formatHand(this.clip.map(c => c.r)) + '\nL: ' + formatHand(this.clip.map(c => c.l || []))
        + (nH >= 3 ? '\nX: ' + formatHand(this.clip.map(c => c.x || [])) : '')
      : formatHand(this.clip.map(cellFirst));
    try { navigator.clipboard && navigator.clipboard.writeText(txt).catch(() => {}); } catch (e) {}
    this.flash(`คัดลอก ${this.clip.length} ช่อง`);
    return this.clip;
  }
  clearSel() {
    if (this.readOnly) return;
    const [a, b] = this.workRange();
    this.pushUndo();
    for (let st = a; st <= b; st++) { const c = this.cellAt(st); if (c) { c.r = []; c.l = []; c.x = []; delete c.m; delete c.d; } }
    this.rebuild(); this.emit();
  }
  cutSel() { if (this.readOnly) return; this.copySel(); this.clearSel(); }
  // วางทับตั้งแต่เคอร์เซอร์ ข้ามวรรคได้ สุดเพลงแล้วต่อบรรทัดให้เอง · cells = [{r,l}]
  pasteCells(cells) {
    if (this.readOnly || !cells || !cells.length) return;
    this.pushUndo();
    const S = this.S, start = this.caretStep();
    while (S.total < start + cells.length) this.appendLine();
    cells.forEach((c, i) => { const t = this.cellAt(start + i); if (t) { t.r = (c.r || []).map(n => ({ ...n })); t.l = (c.l || []).map(n => ({ ...n })); t.x = (c.x || []).map(n => ({ ...n })); if (c.m) t.m = c.m; else delete t.m; if (c.d) t.d = c.d; else delete t.d; } });
    this.setSel(null);
    this.rebuild();
    const end = this.locate(Math.min(start + cells.length, S.total - 1));
    if (end) this.setCaret({ ...end, hand: S.caret.hand });
    this.emit();
    this.flash(`วาง ${cells.length} ช่อง`);
  }
  pasteText(text) {
    const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return false;
    const strip = l => l.replace(/^(?:ว\.?\s*\d+\s*)?[RL]\s*[:.]\s*/i, '').replace(/^ว\.?\s*\d+\s*[:.]?\s*/i, '').replace(/\[[A-Z?]+\]\s*$/, '').trim();
    const rl = lines.find(l => /^(?:ว\.?\s*\d+\s*)?R\s*[:.]/i.test(l)), ll = lines.find(l => /^(?:ว\.?\s*\d+\s*)?L\s*[:.]/i.test(l));
    let cells;
    if (rl) {
      const R = parseHand(strip(rl)), L = ll ? parseHand(strip(ll)) : [];
      cells = R.map((r, i) => ({ r, l: L[i] || [] }));
    } else {
      const R = [].concat(...lines.map(l => parseHand(strip(l))));
      cells = R.map(r => ({ r, l: [] }));
    }
    if (!cells.length || !cells.some(c => cellNotes(c).length)) return false;
    this.pasteCells(cells);
    return true;
  }
  // reflow: แปลงทุกวรรคเป็นสายช่องเดียว → แก้ → ตัดกลับเป็นวรรคขนาดเดิม (เกินท้ายเพลง = ต่อบรรทัดใหม่)
  reflow(mutate) {
    const S = this.S;
    const meta = S.verses.map(v => ({ sec: v.sec, nl: v.nl, level: v.level, ching: v.ching, size: v.cells.length }));
    let stream = [];
    S.verses.forEach(v => stream.push(...v.cells));
    stream = mutate(stream) || stream;
    const out = []; let k = 0;
    meta.forEach(m => {
      const cells = stream.slice(k, k + m.size); k += m.size;
      while (cells.length < m.size) cells.push({ r: [], l: [] });
      out.push({ sec: m.sec, nl: m.nl, level: m.level, ching: m.ching, cells });
    });
    const lastSec = out.length ? out[out.length - 1].sec : 'ท่อน 1';
    const lastLevel = out.length ? out[out.length - 1].level : undefined;
    while (k < stream.length) {
      this.newLine(lastSec).forEach(v => {
        const size = v.cells.length, cells = stream.slice(k, k + size); k += size;
        while (cells.length < size) cells.push({ r: [], l: [] });
        out.push({ ...v, level: lastLevel, cells });
      });
    }
    S.verses = out;
    this.reindex();
  }
  insertAt(step, count) {
    if (this.readOnly || count < 1) return;
    this.pushUndo();
    this.reflow(st => { st.splice(step, 0, ...Array.from({ length: count }, () => ({ r: [], l: [] }))); return st; });
    // ตั้งเคอร์เซอร์ก่อน rebuild — บรรทัดใหม่ที่เพิ่งงอกท้ายเพลงจะได้ไม่ถูก trimTail เก็บทิ้ง
    const l0 = this.locate(step); if (l0) this.S.caret = { ...l0, hand: this.S.caret.hand };
    this.setSel(null); this.rebuild();
    const l = this.locate(step); if (l) this.setCaret({ ...l, hand: this.S.caret.hand });
    this.emit();
    this.flash(count % 4 === 0 ? `แทรก ${count / 4} ห้อง — ที่เหลือเลื่อนไปข้างหน้า` : `แทรก ${count} ช่อง`);
  }
  removeRange(a, b) {
    if (this.readOnly) return;
    const S = this.S, n = b - a + 1;
    if (n >= S.total) { this.clearSel(); return; }
    this.pushUndo();
    this.reflow(st => { st.splice(a, n); return st; });
    this.setSel(null); this.rebuild();
    const l = this.locate(Math.min(a, S.total - 1)); if (l) this.setCaret({ ...l, hand: S.caret.hand });
    this.emit();
    this.flash(n % 4 === 0 ? `ตัดออก ${n / 4} ห้อง — ที่เหลือเลื่อนมาชิด` : `ตัดออก ${n} ช่อง — ที่เหลือเลื่อนมาชิด`);
  }
  hongStart() { return this.caretStep() - (this.S.caret.p % 4); }
  // Enter = แทรกห้องว่างทางขวาของห้องที่เคอร์เซอร์อยู่ "ในวรรคเดียวกัน" แล้วกระโดดเข้าไปพิมพ์ต่อ
  // Pk เคาะ 2026-08-25 (รอบสาม): เพิ่ม/ลดห้องต้องไม่กระทบบรรทัดอื่นเลย — บรรทัดนี้ยาวขึ้น 1 ห้อง ไม่ไหลไปบรรทัดถัดไป
  insertBarRight() {
    if (this.readOnly) return;
    const S = this.S, v = this.curVerse(), h = Math.floor(S.caret.p / 4);
    this.pushUndo();
    v.cells.splice((h + 1) * 4, 0, ...Array.from({ length: 4 }, () => ({ r: [], l: [] })));
    if (v.ching) v.ching.splice((h + 1) * 4, 0, '', '', '', '');
    S.caret = { ...S.caret, p: (h + 1) * 4 };
    this.setSel(null); this.reindex(); this.rebuild();
    const at = v._off + (h + 1) * 4;
    const g = this.root.querySelector(`.thn-grp.cells[data-hong="${at}"]`); if (g) { g.classList.add('just'); setTimeout(() => g.classList.remove('just'), 1300); }
    const row = this.rows[this.rowOfVerse[S.caret.v]];
    const total = row ? row.vs.reduce((n, x) => n + hongOf(S.verses[x]), 0) : 0;
    this.flash(`แทรกห้องใหม่หลังห้อง ${h + 1} ของ ว.${S.caret.v + 1} — บรรทัดนี้ ${total} ห้อง${total > 8 ? ' (เกิน 8 — ลบห้องที่ไม่ใช้ด้วย Ctrl+Enter)' : ''} (Ctrl+Z คืนได้)`);
    this.emit();
  }
  // Ctrl+Enter = ลบห้องที่เคอร์เซอร์อยู่ออกจากวรรคนั้นทันที บรรทัดสั้นลง (ไม่ดึงห้องจากบรรทัดอื่นมาแทน)
  // Pk เคาะ 2026-08-25: ไว้จัดการบรรทัดที่ไม่ครบ 8 ห้อง — ลบแล้วเหลือ 1 ห้องก็ได้ · วรรคหมดห้อง = วรรคหายไป
  deleteBar() {
    if (this.readOnly) return;
    const S = this.S, v = this.curVerse(), vi = S.caret.v, h = Math.floor(S.caret.p / 4);
    const gone = v.cells.slice(h * 4, h * 4 + 4).map(c => { const n = cellFirst(c); return n.length ? n.map(x => S.font === 'notation' ? noteKey(x) : noteText(x)).join('') : '-'; }).join(' ');
    this.pushUndo();
    v.cells.splice(h * 4, 4);
    if (v.ching) v.ching.splice(h * 4, 4);
    let msg = `ลบห้อง ${h + 1} ของ ว.${vi + 1} (${gone}) แล้ว — บรรทัดเหลือ `;
    if (!v.cells.length) {
      // วรรคไม่เหลือห้อง → เอาวรรคออก · ถ้าเป็นหัวบรรทัด ให้วรรคถัดไปในบรรทัดเดียวกันเป็นหัวแทน
      const wasNl = v.nl;
      S.verses.splice(vi, 1);
      if (wasNl && S.verses[vi] && !S.verses[vi].nl) S.verses[vi].nl = true;
      if (!S.verses.length) S.verses.push(...this.newLine('ท่อน 1'));
      S.caret = { v: Math.min(vi, S.verses.length - 1), p: 0, hand: S.caret.hand };
    } else {
      S.caret = { ...S.caret, p: Math.min(h * 4, v.cells.length - 1) };
    }
    this.setSel(null); this.reindex(); this.rebuild();
    const row = this.rows[this.rowOfVerse[S.caret.v]];
    const sizes = row ? row.vs.map(x => hongOf(S.verses[x])) : [];
    this.flash(msg + sizes.join(' + ') + ' ห้อง (Ctrl+Z คืนได้)');
    this.emit();
  }
  // Shift+Enter = ขึ้นบรรทัดใหม่ต่อจากบรรทัดนี้ (ท้า+รับตามที่ตั้ง)
  newLineAfterCaret() {
    if (this.readOnly) return;
    const S = this.S;
    this.pushUndo();
    const ri = this.rowOfVerse[S.caret.v];
    const after = this.rows[ri] ? this.rows[ri].vs[this.rows[ri].vs.length - 1] + 1 : S.verses.length;
    const sec = S.verses[S.caret.v] ? S.verses[S.caret.v].sec : 'ท่อน 1';
    S.verses.splice(after, 0, ...this.newLine(sec));
    S.caret = { v: after, p: 0, hand: S.caret.hand };
    this.setSel(null); this.reindex(); this.rebuild(); this.emit();
    this.flash('ขึ้นบรรทัดใหม่แล้ว');
  }
  // Ctrl+↑/↓ = ต้นบรรทัดก่อน/ถัดไป · Home/End = ต้น/ท้ายบรรทัด
  gotoLine(delta) {
    const S = this.S, ri = this.rowOfVerse[S.caret.v], row = this.rows[ri + delta];
    if (!row) return;
    this.setCaret({ v: row.vs[0], p: 0, hand: S.caret.hand });
  }
  gotoLineEdge(end) {
    const S = this.S, row = this.rows[this.rowOfVerse[S.caret.v]];
    if (!row) return;
    const v = end ? row.vs[row.vs.length - 1] : row.vs[0];
    this.setCaret({ v, p: end ? S.verses[v].cells.length - 1 : 0, hand: S.caret.hand });
  }

  /* ─── เส้นแบ่งวรรคของบรรทัด ───
     ตำแหน่งเส้น = จำนวนห้องที่อยู่ก่อนเส้น นับจากต้นบรรทัด (1 … ห้องรวม−1)
     บรรทัดหนึ่งมีกี่เส้นก็ได้ → กี่วรรคก็ได้ (ไม่ผูกกับ "ท้า+รับ" อีกต่อไป)          */
  lineCuts(row) {
    const S = this.S, out = []; let acc = 0;
    row.vs.forEach((vi, i) => { acc += hongOf(S.verses[vi]); if (i < row.vs.length - 1) out.push(acc); });
    return out;
  }
  lineHongTotal(row) { return row.vs.reduce((n, vi) => n + hongOf(this.S.verses[vi]), 0); }
  // เขียนเส้นแบ่งของบรรทัดใหม่ทั้งชุด — โน้ต/ฉิ่งไหลตามลำดับเดิม ห้องรวมไม่เปลี่ยน
  applyLineSplits(row, cuts, { undo = true, msg = null } = {}) {
    const S = this.S;
    const first = row.vs[0], old = row.vs.map(vi => S.verses[vi]);
    const totalH = old.reduce((n, v) => n + hongOf(v), 0);
    const clean = [...new Set(cuts.map(c => Math.round(c)))].filter(c => c > 0 && c < totalH).sort((a, b) => a - b);
    if (JSON.stringify(clean) === JSON.stringify(this.lineCuts(row))) return null;   // ไม่มีอะไรเปลี่ยน
    if (undo) this.pushUndo();
    const sizes = []; let prev = 0;
    clean.forEach(c => { sizes.push(c - prev); prev = c; });
    sizes.push(totalH - prev);
    const cells = [].concat(...old.map(v => v.cells));
    const anyChing = old.some(v => v.ching);
    const ching = anyChing ? [].concat(...old.map(v => v.ching || new Array(v.cells.length).fill(''))) : null;
    const made = []; let at = 0;
    sizes.forEach((h, i) => {
      const v = { sec: old[0].sec, nl: i === 0, level: old[0].level, cells: cells.slice(at * 4, (at + h) * 4) };
      if (ching) v.ching = ching.slice(at * 4, (at + h) * 4);
      at += h; made.push(v);
    });
    const caretStep = this.caretStep();
    S.verses.splice(first, old.length, ...made);
    this.reindex(); this.rebuild();
    const l = this.locate(Math.min(caretStep, S.total - 1)); if (l) this.setCaret({ ...l, hand: S.caret.hand });
    this.emit();
    this.flash(msg || `แบ่งวรรคใหม่: ${sizes.join(' + ')} ห้อง (Ctrl+Z คืนได้)`);
    return sizes;
  }
  // ┊ แบ่งวรรคตรงห้องที่เคอร์เซอร์อยู่ (ห้องนั้นเป็นต้นวรรคใหม่)
  splitVerseAtCaret() {
    if (this.readOnly) return;
    const S = this.S, row = this.rows[this.rowOfVerse[S.caret.v]];
    if (!row) return;
    // ห้องที่เคอร์เซอร์อยู่ นับเป็นห้องที่เท่าไรของบรรทัด
    let before = 0;
    for (const vi of row.vs) { if (vi === S.caret.v) break; before += hongOf(S.verses[vi]); }
    const pos = before + Math.floor(S.caret.p / 4);
    if (pos <= 0) { this.flash('ห้องนี้เป็นต้นบรรทัดอยู่แล้ว — วางเคอร์เซอร์ที่ห้องที่จะให้เป็นต้นวรรคใหม่'); return; }
    const cuts = this.lineCuts(row);
    if (cuts.includes(pos)) { this.flash('ตรงนี้เป็นเส้นแบ่งวรรคอยู่แล้ว'); return; }
    this.applyLineSplits(row, [...cuts, pos]);
  }
  // ⟷ รวมวรรคที่เคอร์เซอร์อยู่กับวรรคถัดไปในบรรทัดเดียวกัน
  mergeVerseAtCaret() {
    if (this.readOnly) return;
    const S = this.S, row = this.rows[this.rowOfVerse[S.caret.v]];
    if (!row || row.vs.length < 2) { this.flash('บรรทัดนี้มีวรรคเดียวอยู่แล้ว — ไม่มีเส้นให้รวม'); return; }
    const k = row.vs.indexOf(S.caret.v);
    const cuts = this.lineCuts(row);
    // อยู่วรรคสุดท้าย → รวมกับวรรคก่อนหน้า (เอาเส้นซ้ายออก) ไม่งั้นเอาเส้นขวาออก
    const drop = k < row.vs.length - 1 ? cuts[k] : cuts[k - 1];
    this.applyLineSplits(row, cuts.filter(c => c !== drop), { msg: 'รวมวรรคแล้ว (Ctrl+Z คืนได้)' });
  }
  /* ─── ลากเส้นแบ่งวรรค ─── mode 'move' = ย้ายเส้นเดิม · 'new' = สร้างเส้นใหม่จากป้าย ┊ */
  beginSplit(row, k, sepEl, rowEl, mode = 'move') {
    if (this.readOnly || this.move || this.split) return;
    const S = this.S;
    const sizes = row.vs.map(vi => hongOf(S.verses[vi]));
    const totalH = sizes.reduce((a, b) => a + b, 0);
    if (mode === 'new') {
      this.split = { row, k: null, mode, sepEl, rowEl, sizes, min: 1, max: totalH - 1, cur: -1, to: null, mark: null };
      this.flash('ลากไปวางระหว่างห้องที่ต้องการ — ได้เส้นแบ่งวรรคใหม่ตรงนั้น · Esc ยกเลิก');
    } else {
      let before = 0; for (let i = 0; i < k - 1; i++) before += sizes[i];
      // เส้นนี้เลื่อนได้ในช่วง [ต้นวรรคซ้าย, ท้ายวรรคขวา]
      this.split = { row, k, mode, sepEl, rowEl, sizes, min: before, max: before + sizes[k - 1] + sizes[k], cur: before + sizes[k - 1], to: null, mark: null };
      this.flash('ลากเส้นแบ่งวรรคไปวางระหว่างห้องที่ต้องการ (ในบรรทัดเดียวกัน) · Esc ยกเลิก');
    }
    sepEl.classList.add('dragging'); this.root.classList.add('splitting');
  }
  splitAt(ev) {
    const sp = this.split; if (!sp) return;
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const grp = el && el.closest ? el.closest('.thn-grp.cells') : null;
    if (sp.mark) { sp.mark.classList.remove('split-before', 'split-after'); sp.mark = null; }
    sp.to = null;
    if (!grp || !sp.rowEl.contains(grp)) return;
    // ตำแหน่งห้องในบรรทัด (0-based) จาก step ของห้อง
    const h = +grp.dataset.hong, S = this.S;
    const lineStart = S.verses[sp.row.vs[0]]._off;
    const idx = (h - lineStart) / 4;
    const r = grp.getBoundingClientRect();
    const after = ev.clientX > r.left + r.width / 2;
    const pos = after ? idx + 1 : idx;                       // จำนวนห้องที่อยู่ก่อนเส้น
    if (pos < sp.min || pos > sp.max || pos === sp.cur) return;
    if (sp.mode === 'new' && this.lineCuts(sp.row).includes(pos)) return;   // ตรงนั้นมีเส้นอยู่แล้ว
    sp.to = pos; sp.mark = grp; grp.classList.add(after ? 'split-after' : 'split-before');
  }
  endSplit(commit) {
    const sp = this.split; if (!sp) return;
    this.split = null; this.root.classList.remove('splitting');
    sp.sepEl.classList.remove('dragging');
    if (sp.mark) sp.mark.classList.remove('split-before', 'split-after');
    if (!commit || sp.to == null) return;
    if (sp.mode === 'new') this.applyLineSplits(sp.row, [...this.lineCuts(sp.row), sp.to], { msg: null });
    else this.applySplit(sp.row, sp.k, sp.to);
  }
  // ย้ายเส้นแบ่งที่ k ของบรรทัด ให้มี pos ห้องอยู่ก่อนเส้น (นับจากต้นบรรทัด) · ห้องรวมของบรรทัดเท่าเดิม
  //   pos = ต้นบรรทัด หรือ ท้ายบรรทัด → เส้นนั้นหายไป (วรรคซ้าย/ขวารวมกัน)
  applySplit(row, k, pos) {
    const cuts = this.lineCuts(row);
    const next = cuts.slice();
    next[k - 1] = pos;                                   // เส้นที่ k คือ cuts[k-1]
    this.applyLineSplits(row, next);
  }

  /* ─── ย้ายทั้งห้องด้วยเมาส์ (กดค้างที่ช่อง หรือลากป้ายรหัสกระสวนใต้ห้อง) ─── */
  beginMove(step, ev) {
    if (this.readOnly || this.move) return;
    const S = this.S, a0 = step - (step % 4);
    // ถ้าเลือกช่วงที่ครอบห้องนี้อยู่และเต็มห้อง → ย้ายทั้งช่วง
    let a = a0, n = 4;
    if (S.sel && S.sel.a <= step && step <= S.sel.b && S.sel.a % 4 === 0 && (S.sel.b - S.sel.a + 1) % 4 === 0) { a = S.sel.a; n = S.sel.b - S.sel.a + 1; }
    this.drag = null; clearTimeout(this._lp);
    const ghost = $el('div', 'thn-ghost');
    for (let st = a; st < a + n; st++) {
      if (st > a && st % 4 === 0) ghost.append($el('span', '', '|'));
      const c = this.cellAt(st), notes = c ? (this.nH() > 1 ? cellNotes(c) : cellFirst(c)) : [];
      ghost.append($el('span', '', notes.length ? notes.map(x => S.font === 'notation' ? noteKey(x) : noteText(x)).join('') : '-'));
    }
    ghost.append($el('small', '', n / 4 + ' ห้อง'));
    document.body.append(ghost);
    this.move = { a, n, ghost, to: null, mark: null };
    this.root.classList.add('grabbing');
    this.root.querySelectorAll('.thn-grp.cells').forEach(g => { const h = +g.dataset.hong; if (h >= a && h < a + n) g.classList.add('moving'); });
    this.flash(`ยกห้องขึ้นมาแล้ว — ลากไปวางระหว่างห้องที่ต้องการ (Esc ยกเลิก)`);
    this.moveAt(ev);
  }
  moveAt(ev) {
    const m = this.move; if (!m) return;
    m.ghost.style.left = (ev.clientX + 14) + 'px'; m.ghost.style.top = (ev.clientY - 18) + 'px';
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const grp = el && el.closest ? el.closest('.thn-grp.cells') : null;
    if (m.mark) { m.mark.classList.remove('drop-before', 'drop-after'); m.mark = null; }
    m.to = null;
    if (!grp) return;
    const h = +grp.dataset.hong, r = grp.getBoundingClientRect();
    const after = ev.clientX > r.left + r.width / 2;
    const to = after ? h + 4 : h;
    if (to >= m.a && to <= m.a + m.n) return;   // วางที่เดิม
    m.to = to; m.mark = grp; grp.classList.add(after ? 'drop-after' : 'drop-before');
  }
  endMove(commit) {
    const m = this.move; if (!m) return;
    this.move = null; this.root.classList.remove('grabbing');
    m.ghost.remove();
    if (m.mark) m.mark.classList.remove('drop-before', 'drop-after');
    this.root.querySelectorAll('.thn-grp.cells.moving').forEach(g => g.classList.remove('moving'));
    if (commit && m.to != null) this.moveBlock(m.a, m.n, m.to); else this.paintSel();
  }
  // ตัดช่วง a..a+n-1 ออกแล้วเสียบที่ตำแหน่ง to (นับในสายเดิม) — ทุกอย่างเลื่อนตาม ไม่มีอะไรหาย
  moveBlock(a, n, to) {
    if (this.readOnly || to >= a && to <= a + n) return;
    this.pushUndo();
    const t2 = to > a ? to - n : to;
    this.reflow(st => { const blk = st.splice(a, n); st.splice(t2, 0, ...blk); return st; });
    this.rebuild();
    const l = this.locate(t2); if (l) this.setCaret({ ...l, hand: this.S.caret.hand });
    this.setSel(t2, t2 + n - 1);
    this.emit();
    this.flash(`ย้าย ${n / 4} ห้องไปที่ใหม่แล้ว — ที่เหลือเลื่อนตาม (Ctrl+Z ย้อนได้)`);
  }
  flash(msg) {
    const el = this.t('selinfo'); if (!el) return;
    el.textContent = msg; clearTimeout(this._fl);
    this._fl = setTimeout(() => this.paintSel(), 2500);
  }
  touchCaretRow() { const ri = this.rowOfVerse[this.S.caret.v]; this.repaintRows([ri - 1, ri, ri + 1]); }
  afterPaint() {
    if (this.dead) return;
    const S = this.S, v = S.verses[S.caret.v];
    this.t('caret').textContent = 'ว.' + (S.caret.v + 1) + ' · ห้อง ' + (Math.floor(S.caret.p / 4) + 1) + '/' + hongOf(v) + ' · ตำแหน่ง ' + (S.caret.p % 4 + 1) + (this.nH() > 1 ? ' · ' + ((linesOf(S.system).find(l => l.key === S.caret.hand) || {}).label || '') : '');
    clearTimeout(this._an);
    this._an = setTimeout(() => this.analyse(), 180);
  }
  caretStep() { return this.S.verses[this.S.caret.v]._off + this.S.caret.p; }
  setCaret(c, { scroll = true } = {}) {
    const old = this.cellEls[this.caretStep()];
    if (old) HANDS.forEach(h => { if (old[h]) old[h].classList.remove('cur'); });
    this.S.caret = c;
    const nu = this.cellEls[this.caretStep()], hand = this.nH() > 1 ? c.hand : 'r';
    if (nu && nu[hand]) { nu[hand].classList.add('cur'); if (scroll && !this.play.on) nu[hand].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    this.afterPaint();
  }
  analyse() {
    if (this.dead) return;
    const S = this.S, st = statsOf(S.verses);
    this.t('stV').textContent = st.verses; this.t('stH').textContent = st.hongs; this.t('stN').textContent = st.notes; this.t('stU').textContent = st.unique;
    const box = this.t('kbars'); box.innerHTML = '';
    const max = st.top.length ? st.top[0][1] : 1;
    st.top.forEach(([code, n]) => { const r = $el('div', 'thn-kbar'), t = $el('div', 'track'), f = $el('div', 'fill'); f.style.width = Math.round(n / max * 100) + '%'; t.append(f); r.append($el('code', '', code), t, $el('span', 'n', String(n))); box.append(r); });
    if (!st.top.length) box.innerHTML = '<p class="thn-mini" style="margin:0">ยังไม่มีห้องที่มีเสียง — เริ่มพิมพ์ได้เลย</p>';
    const cb = this.t('checks'); cb.innerHTML = '';
    checkVerses(S.verses, { base: S.base }).forEach(({ kind, title, detail }) => {
      const d = $el('div', 'thn-chkitem ' + kind); d.append($el('i', '', kind === 'ok' ? '✓' : '!'));
      const t = $el('div'); t.append($el('b', '', title)); if (detail) t.append($el('em', '', detail)); d.append(t); cb.append(d);
    });
  }

  /* ─── เสียง ─── */
  ac() { try { this.actx = this.actx || new (window.AudioContext || window.webkitAudioContext)(); if (this.actx.state === 'suspended') this.actx.resume(); } catch (e) { return null; } return this.actx; }
  // opts.damp = ประคบ (เสียงสั้น) — ส่งต่อให้คลังเสียง ถ้าไม่มีไฟล์จริงก็หรี่เสียงให้สั้นแทน
  tone(n, at, gain, opts = null) {
    const ctx = this.ac(); if (!ctx) return;
    const step = NOTES.indexOf(n.ch); if (step < 0) return;
    const damp = !!(opts && opts.damp);
    if (this.S.src !== 'synth' && this.audio && this.buffers) {
      const ok = this.audio.play(ctx, this.buffers, n.ch, n.reg, Math.max(ctx.currentTime, at), gain * 2, this.tangShift(), this.srcInst(),
        { tuning: this.tuningObj(), srcTuning: this.srcTuning(), hzMap: this.hzMap, damp, dampDur: DAMP_DUR_DEFAULT });
      if (ok) return;   // ลูกไหนไม่มีไฟล์ตกมาใช้เสียงสังเคราะห์
    }
    const f = this.hzOfNote(n);   // ความถี่จริงตามระบบเสียงที่เลือก (ตารางกรมศิลปากร)
    const t = Math.max(ctx.currentTime, at), dur = damp ? DAMP_DUR_DEFAULT : 0.6;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o1.type = 'sine'; o1.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 3.02; g2.gain.value = 0.16;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o1.start(t); o1.stop(t + dur + 0.05); o2.start(t); o2.stop(t + dur + 0.05);
  }
  chingHit(at, damped) {
    const ctx = this.ac(); if (!ctx) return;
    const t = Math.max(ctx.currentTime, at), dur = damped ? 0.09 : 1.1;
    // มีไฟล์เสียงฉิ่งจริงในคลัง → ใช้ไฟล์ · ไม่มี → สังเคราะห์ต่อไปเหมือนเดิม
    if (this.perc && this.perc.play) {
      const before = this.percUsedReal;
      this.percUsedReal = this.perc.play(ctx, damped ? 'ฉับ' : 'ฉิ่ง', t, 0.5, 'ฉิ่ง');
      if (this.percUsedReal) return;
      this.percUsedReal = before;
    }
    [2900, 4350, 6100].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination); const amp = 0.16 * [1, 0.5, 0.25][i]; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.start(t); o.stop(t + dur + 0.05); });
  }
  typeTone(n, opts = null) { if (!this.S.sound) return; const c = this.ac(); if (c) this.tone(n, c.currentTime, 0.4, opts); }
  clearPlayMark() { this.root.querySelectorAll('.thn-cell.play').forEach(e => e.classList.remove('play')); this.play.lastStep = -1; }
  stopPlay() {
    this.play.on = false; this.play.id++;
    if (!this.root.isConnected && this.dead) { if (this.actx) { try { this.actx.close(); } catch (e) {} this.actx = null; } return; }
    if (this.play.raf) cancelAnimationFrame(this.play.raf);
    if (this.actx) { try { this.actx.close(); } catch (e) {} this.actx = null; }
    this.clearPlayMark();
    if (this.onPlayStep) this.onPlayStep(-1);
    const sb = this.q('[data-a="stop"]'), pb = this.q('[data-a="play"]');
    if (sb) sb.disabled = true; if (pb) pb.textContent = '▶ เล่นจากเคอร์เซอร์';
  }
  async ensureAssets() {
    const S = this.S, msg = this.t('sndmsg');
    if (S.src !== 'synth' && this.audio && !this.buffers && !this.loadingSamples) {
      this.loadingSamples = true; if (msg) msg.textContent = '⏳ โหลดเสียงฆ้อง…';
      try {
        const ctx = this.ac(); const inst = this.srcInst();
        this.buffers = await this.audio.load(ctx, inst || S.src);
        // ความถี่จริงรายตำแหน่งที่ผู้ดูแลกรอกไว้ (ถ้ามี) — ใช้คำนวณอัตราเล่นให้ตรงระบบเสียง
        if (this.audio.notes) { try { this.setNoteHzMap(await this.audio.notes(inst?.slug || S.src)); } catch { this.setNoteHzMap(null); } }
        const n = this.buffers?.count ?? Object.keys(this.buffers || {}).length;
        const want = inst?.note_count || 16;
        if (msg) msg.textContent = !n ? '⚠ ยังไม่มีไฟล์เสียง ใช้สังเคราะห์แทน'
          : n >= want ? `♪ เสียงจริงครบ ${n} เสียง`
          : `♪ เสียงจริง ${n}/${want} เสียง (ที่ขาดขยับจากตัวใกล้สุด)`;
      }
      catch (e) { if (msg) msg.textContent = '⚠ โหลดเสียงไม่ได้ ใช้สังเคราะห์แทน'; }
      this.loadingSamples = false;
    }
    if ((S.nathab !== 'none' || S.chingOn) && this.perc) {
      try { this.percRows = await this.perc.load(this.ac(), S.drum) ?? this.percRows; }
      catch (e) { this.percRows = this.percRows ?? []; }
    }
  }
  async startPlay(fromStep) {
    this.stopPlay();
    await this.ensureAssets();
    const ctx = this.ac(); if (!ctx) return;
    const S = this.S, { runs, consumed, total, at } = buildVoices(this.voicesG());
    const myId = ++this.play.id; this.play.on = true;
    const t0 = ctx.currentTime + 0.28, SD = 60 / S.bpm / 2, tl = [];
    const meta = this.buildChingMeta();
    // หน้าทับ: เลือกตามอัตราของท่อน (เพลงเถาเปลี่ยนอัตรากลางเพลงได้) · จังหวะนับใหม่ทุกต้นท่อน
    const drumByLevel = {};
    if (S.nathab !== 'none' && this.perc && this.percRows) {
      ['สามชั้น', 'สองชั้น', 'ชั้นเดียว'].forEach(lv => {
        const row = this.perc.find ? this.perc.find(this.percRows, S.nathab, lv, S.drum)
          : this.percRows.find(r => r.nathab === S.nathab && r.level === lv && r.instrument === S.drum);
        if (row) drumByLevel[lv] = this.perc.parse(row.pattern_text);
      });
    }
    /* กรอ / ประคบ (Pk 2026-08-26)
       กรอ = ตีสลับสองมือถี่ ๆ ตั้งแต่ช่องที่ติดเครื่องหมาย ไปจนถึงเสียงถัดไป
             เริ่มเสียงต่ำ จบเสียงสูง (ระนาด/ฆ้อง = ขึ้นซ้ายจบขวา · ขิม = ขึ้นขวาจบซ้าย โดยอัตโนมัติ)
       ช่องที่อยู่ "ระหว่างกลาง" ของช่วงกรอ ไม่มีเสียงอยู่แล้ว จึงไม่ต้องกันอะไรเพิ่ม            */
    const spans = kroSpans({
      total,
      markOf: st => { const c = this.cellAt(st); return (c && c.m) || ''; },
      notesOf: st => { const c = this.cellAt(st); return c ? cellNotes(c) : []; },
    });
    const kroAt = new Map(spans.map(sp => [sp.start, sp]));
    for (let s = fromStep; s < total; s++) {
      const t = t0 + (s - fromStep) * SD; tl.push({ t, s });
      const m = meta[s];
      if (S.chingOn && m && m.mark) this.chingHit(t, m.mark === 'ฉับ');
      const dp = m && drumByLevel[m.level];
      if (dp && dp.len > 0) { const pp = (m.rel % dp.len) + 1; dp.hits.forEach(h => { if (h.pos === pp) { if (this.perc.playHit) this.perc.playHit(ctx, S.drum, h, t, 0.75); else this.perc.play(ctx, h.syll, t, 0.75, S.drum); } }); }
      const sp = kroAt.get(s);
      if (sp) {
        // ทั้งช่วงกรอถูกแทนด้วยการตีสลับ — ไม่ต้องตีโน้ตปกติที่ช่องนี้ซ้ำอีก
        kroStrikes({ dur: (sp.end - sp.start) * SD, gap: S.kroGap, low: sp.low, high: sp.high })
          .forEach(k => this.tone(k.note, t + k.t, 0.40 * k.vel));
        continue;
      }
      const cellHere = this.cellAt(s), HKp = this.hands();
      // คู่สอง/คู่สาม (Pk 27 ส.ค.): แนวที่เสียงต่ำกว่าลงก่อนนิดหนึ่ง แม้เขียนไว้ตำแหน่งเดียวกัน
      //   ระนาด/ฆ้อง = มือซ้ายลงก่อนตามที่ Pk สั่ง · ขิมที่เสียงต่ำอยู่ขวา ก็จะเป็นมือขวาลงก่อนเอง
      const lead = consumed.length > 1
        ? pairLead(Array.from({ length: consumed.length }, (_, li) => at(li, s)))
        : [];
      for (let li = 0; li < consumed.length; li++) {   // ทุกบรรทัดตามระบบบันทึก (ขิม/จะเข้ = 3)
        if (consumed[li][s]) continue;
        // ประคบแยกรายมือ — แนวนี้ติดประคบไหม (ระบบแนวเดียวดูที่บิตไหนก็ได้)
        const damp = consumed.length > 1 ? isDamp(cellHere, HKp[li]) : !!dampMask(cellHere);
        const tt = t - (lead[li] || 0);
        const run = runs.get(li * total + s);
        if (run) run.notes.forEach((n, i) => { const back = run.notes.length - 1 - i; this.tone(n, tt - back * SABAT_GAP_DEFAULT, back === 0 ? 0.42 : back === 1 ? 0.34 : 0.28, { damp }); });
        else at(li, s).forEach(n => this.tone(n, tt, 0.42, { damp }));
      }
    }
    const endT = t0 + (total - fromStep) * SD;
    this.q('[data-a="stop"]').disabled = false; this.q('[data-a="play"]').textContent = '▶ กำลังเล่น…';
    const tick = () => {
      if (this.play.id !== myId) return;
      const now = ctx.currentTime; let cur = -1;
      for (let i = 0; i < tl.length; i++) { if (tl[i].t <= now) cur = tl[i].s; else break; }
      if (cur !== this.play.lastStep) { this.clearPlayMark(); const m = this.cellEls[cur]; if (m) { HANDS.forEach(h => { if (m[h]) m[h].classList.add('play'); }); if (m.r) m.r.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } this.play.lastStep = cur; if (this.onPlayStep) this.onPlayStep(cur); }
      if (now < endT) this.play.raf = requestAnimationFrame(tick); else this.stopPlay();
    };
    this.play.raf = requestAnimationFrame(tick);
  }

  /* ─── แก้ไข ─── */
  curVerse() { return this.S.verses[this.S.caret.v]; }
  curCell() { return this.curVerse().cells[this.S.caret.p]; }
  handKey() { return this.nH() > 1 ? this.S.caret.hand : 'r'; }
  advance() {
    const S = this.S, v = this.curVerse();
    if (S.caret.p < v.cells.length - 1) { this.setCaret({ ...S.caret, p: S.caret.p + 1 }); return; }
    if (S.caret.v < S.verses.length - 1) { this.setCaret({ v: S.caret.v + 1, p: 0, hand: S.caret.hand }); return; }
    const at = S.caret.v; this.appendLine(); this.rebuild(); this.setCaret({ v: at + 1, p: 0, hand: S.caret.hand });
  }
  // mark = '' | 'kro' | 'damp' — Alt+โน้ต = กรอ · Alt+Shift+โน้ต = ประคบ · ปุ่มติดค้างบนแป้นล่างก็ได้
  putNote(i, reg, sabat, mark = null) {
    if (this.readOnly) return;
    if (this.S.sel) this.setSel(null);
    this.pushUndo();
    const use = mark != null ? mark : this.S.markArm;
    const n = { ch: NOTES[i], reg }, cell = this.curCell(), hk = this.handKey();
    // กรอผูกกับทั้งช่อง · ประคบผูกกับ "มือที่กำลังพิมพ์" เท่านั้น (Pk 27 ส.ค.)
    if (use === 'kro') { cell.m = 'kro'; delete cell.d; }
    else if (use === 'damp') { setDamp(cell, hk, true); delete cell.m; }
    const prevFrom = [...(cell[(this.autoSpec() || {}).from] || [])];
    let done = true;
    if (sabat) {
      if (cell[hk].length >= 2) cell[hk] = [];
      cell[hk] = [...cell[hk], n]; done = cell[hk].length >= 2;
      if (done && this.S.sabatArm) { this.S.sabatArm = false; this.q('[data-a="sabat"]').classList.remove('on'); }
    } else cell[hk] = [n];
    if (hk === (this.autoSpec() || {}).from) this.applyAutoOctave(cell, prevFrom);
    this.touchCaretRow(); this.typeTone(n, { damp: use === 'damp' });
    if (done) this.advance();
    this.emit();
  }
  skip() { if (this.readOnly) return; this.pushUndo(); this.clearCurCell(); this.touchCaretRow(); this.advance(); this.emit(); }
  /* ─── ประคบด้วยการกดค้าง (Pk 26 ส.ค. 69) ───
     พิมพ์โน้ตตามปกติ แล้วถ้ายังกดแป้นนั้นค้างไว้เกิน HOLD_DAMP_MS โน้ตตัวที่เพิ่งลงจะกลายเป็นประคบ
     แสดงผลเป็น "ตัวหนา" อย่างเดียว ไม่มีเครื่องหมายเพิ่ม · ปล่อยแป้นก่อนครบเวลา = โน้ตธรรมดา     */
  typeNote(i, reg, sabat, keyId) {
    const at = { v: this.S.caret.v, p: this.S.caret.p, hand: this.handKey() };   // จำช่อง+มือที่กำลังจะลงโน้ต (เคอร์เซอร์เดินต่อไปแล้ว)
    this.putNote(i, reg, sabat);
    this.clearHold();
    if (this.readOnly || !keyId) return;
    const h = this.hold = { key: keyId, at: { ...at, hand: this.nH() > 1 ? at.hand : 'r' } };
    h.t = setTimeout(() => { if (this.hold === h) { this.hold = null; this.dampAt(h.at); } }, HOLD_DAMP_MS);
  }
  clearHold() { if (this.hold) { clearTimeout(this.hold.t); this.hold = null; } }
  dampAt({ v, p, hand }) {
    const vv = this.S.verses[v], cell = vv && vv.cells[p];
    if (!cell || this.readOnly) return;
    if (cell.m === 'kro') return;                             // ติดกรอไว้อยู่ อย่าไปทับ
    const hk = hand || 'r';
    if (isDamp(cell, hk)) return;
    setDamp(cell, hk, true);
    const ri = this.rowOfVerse[v];
    if (ri == null) this.rebuild(); else this.repaintRows([ri - 1, ri, ri + 1]);
    this.emit();
    this.flash(`ประคบ${this.nH() > 1 ? ' (เฉพาะ' + (hk === 'r' ? 'แนวบน' : hk === 'l' ? 'แนวล่าง' : 'แนวที่สาม') + ')' : ''} — โน้ตตัวนี้เป็นตัวหนา เสียงสั้น ไม่กังวานทับตัวถัดไป (ปล่อยแป้นเร็วกว่านี้ = โน้ตธรรมดา)`);
  }
  // สลับเครื่องหมายที่ช่องที่เคอร์เซอร์อยู่ (แป้น ~ = กรอ) — ไว้กลับมาแก้ทีหลัง · ประคบใช้วิธีกดโน้ตค้าง
  toggleMark(mark) {
    if (this.readOnly) return;
    const cell = this.curCell();
    this.pushUndo();
    const was = mark === 'damp' ? (isDamp(cell, this.handKey()) ? 'damp' : '') : (cell.m || '');
    if (mark === 'damp') setDamp(cell, this.handKey(), was !== 'damp');
    else if (was === mark) delete cell.m;
    else { cell.m = mark; delete cell.d; }
    this.touchCaretRow(); this.emit();
    const name = mark === 'kro' ? 'กรอ' : 'ประคบ';
    this.flash(was === mark ? `เอา${name}ออกแล้ว` : `ใส่${name}ที่ ว.${this.S.caret.v + 1} ห้อง ${Math.floor(this.S.caret.p / 4) + 1} ตำแหน่ง ${this.S.caret.p % 4 + 1}`);
  }
  // ปุ่มติดค้างบนแป้นล่าง — โน้ตที่พิมพ์ต่อจากนี้จะติดเครื่องหมายให้เอง
  armMark(mark) {
    this.S.markArm = this.S.markArm === mark ? '' : mark;
    ['kro', 'damp'].forEach(k => { const b = this.q(`[data-a="${k}"]`); if (b) b.classList.toggle('mark-on', this.S.markArm === k); });
    this.flash(this.S.markArm ? `ติด${mark === 'kro' ? 'กรอ' : 'ประคบ'}ไว้ — โน้ตที่พิมพ์ต่อจากนี้จะได้เครื่องหมายนี้ (กดซ้ำเพื่อเลิก)` : 'เลิกติดเครื่องหมายแล้ว');
  }
  // ล้างช่องที่เคอร์เซอร์ · ระบบทางเก็บ: ล้างมือขวาแล้วมือซ้ายที่เป็นคู่แปดอัตโนมัติหายตาม
  clearCurCell() {
    const cell = this.curCell(), hk = this.handKey(), sp = this.autoSpec();
    const prevFrom = sp ? [...(cell[sp.from] || [])] : null;
    cell[hk] = [];
    if (sp && hk === sp.from) this.applyAutoOctave(cell, prevFrom);
  }
  backspace() {
    if (this.readOnly) return;
    const S = this.S; this.pushUndo();
    if (S.caret.p > 0) this.setCaret({ ...S.caret, p: S.caret.p - 1 });
    else if (S.caret.v > 0) { const pv = S.verses[S.caret.v - 1]; this.setCaret({ v: S.caret.v - 1, p: pv.cells.length - 1, hand: S.caret.hand }); }
    this.clearCurCell(); this.touchCaretRow(); this.emit();
  }
  resizeVerse(delta) {
    const v = this.curVerse(), nh = hongOf(v) + delta;
    if (nh < 1 || nh > 8) return;
    this.pushUndo();
    if (delta > 0) for (let i = 0; i < 4; i++) v.cells.push({ r: [], l: [] }); else v.cells.length = nh * 4;
    if (this.S.caret.p >= v.cells.length) this.S.caret.p = v.cells.length - 1;
    this.rebuild(); this.emit();
  }
  buildPad() {
    const S = this.S, box = this.t('keys'); box.innerHTML = '';
    NOTES.forEach((n, i) => {
      const b = $el('button', 'thn-nkey'); b.type = 'button';
      b.append(document.createTextNode(S.font === 'notation' ? KEY_OF[n + '|' + S.reg] : n + (S.reg === 1 ? HIGH : S.reg === -1 ? LOW : '')));
      b.append($el('small', '', KEY_OF[n + '|' + S.reg]));
      b.addEventListener('click', () => this.putNote(i, S.reg, S.sabatArm));
      box.append(b);
    });
  }
  bind() {
    const S = this.S, r = this.root;
    const act = {
      manual: e => { const m = this.t('manual'); m.hidden = !m.hidden; e.currentTarget.classList.toggle('on', !m.hidden); },
      play: () => this.startPlay(this.caretStep()), all: () => this.startPlay(0), stop: () => this.stopPlay(),
      snd: e => { S.sound = !S.sound; e.currentTarget.classList.toggle('on', S.sound); },
      skip: () => this.skip(), bs: () => this.backspace(),
      sabat: e => { S.sabatArm = !S.sabatArm; e.currentTarget.classList.toggle('on', S.sabatArm); },
      kro: () => this.armMark('kro'),
      damp: () => this.armMark('damp'),
      'hong+': () => this.resizeVerse(1), 'hong-': () => this.resizeVerse(-1),
      inshong: () => this.insertAt(this.hongStart(), 4),
      inscell: () => this.insertAt(this.caretStep(), 1),
      delhong: () => { const a = this.hongStart(); this.removeRange(a, a + 3); },
      delsel: () => { const r = this.selRange(); if (!r) { this.flash('ยังไม่ได้เลือกช่วง — ลากเมาส์คลุมช่องก่อน'); return; } this.removeRange(r[0], r[1]); },
      copy: () => this.copySel(), cut: () => this.cutSel(),
      paste: () => { if (this.clip) this.pasteCells(this.clip); else if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(t => { if (!this.pasteText(t)) this.flash('คลิปบอร์ดไม่มีโน้ต'); }).catch(() => this.flash('อ่านคลิปบอร์ดไม่ได้ — ใช้ Ctrl+V ในกระดานแทน')); else this.flash('ยังไม่มีอะไรให้วาง'); },
      clrsel: () => this.clearSel(),
      undo: () => this.undo(),
      newline: () => {
        this.pushUndo();
        const ri = this.rowOfVerse[S.caret.v];
        const after = this.rows[ri] ? this.rows[ri].vs[this.rows[ri].vs.length - 1] + 1 : S.verses.length;
        const sec = S.verses[S.caret.v] ? S.verses[S.caret.v].sec : 'ท่อน 1';
        S.verses.splice(after, 0, ...this.newLine(sec));
        S.caret = { v: after, p: 0, hand: 'r' };   // เคอร์เซอร์อยู่บรรทัดใหม่ → trimTail จะไม่เก็บทิ้ง
        this.reindex(); this.rebuild(); this.emit();
      },
      delline: () => {
        const ri = this.rowOfVerse[S.caret.v];
        if (ri == null || !this.rows[ri]) return;
        const vs = this.rows[ri].vs;
        const start = vs[0], count = vs.length;
        if (vs.some(vi => hasSound(S.verses[vi]))
            && !window.confirm('บรรทัดนี้มีโน้ตอยู่ — ลบทั้งบรรทัด?')) return;
        this.pushUndo(); this.stopPlay();
        S.verses.splice(start, count);
        // กระดานต้องมีอย่างน้อย 1 บรรทัดเสมอ
        if (!S.verses.length) S.verses.push(...this.newLine('ท่อน 1'));
        // บรรทัดแรกของท่อน/กระดาน ต้องเป็นหัวบรรทัดเสมอ ไม่งั้นไปเกาะบรรทัดก่อนหน้า
        if (S.verses[start] && !S.verses[start].nl) S.verses[start].nl = true;
        S.caret = { v: Math.min(start, S.verses.length - 1), p: 0, hand: 'r' };
        this.reindex(); this.rebuild(); this.emit();
      },
      dup: () => { this.pushUndo(); const ri = this.rowOfVerse[S.caret.v]; const at = this.rows[ri].vs[this.rows[ri].vs.length - 1] + 1; S.verses.splice(at, 0, ...this.rows[ri].vs.map(vi => JSON.parse(JSON.stringify(S.verses[vi])))); this.reindex(); this.rebuild(); this.setCaret({ v: at, p: 0, hand: 'r' }); this.emit(); },
      sec: () => this.insertSection(S.verses.length - 1, 'after'),
      secname: () => this.renameSection(S.caret.v),
      splitverse: () => this.splitVerseAtCaret(),
      mergeverse: () => this.mergeVerseAtCaret(),
      clr: () => { if (!window.confirm('ล้างโน้ตทั้งหมด?')) return; this.pushUndo(); this.stopPlay(); S.verses = [...this.newLine('ท่อน 1'), ...this.newLine('ท่อน 1')]; S.caret = { v: 0, p: 0, hand: 'r' }; this.reindex(); this.rebuild(); this.emit(); },
      read: () => { const n = this.loadText(this.t('paste').value); this.t('pmsg').textContent = n ? 'อ่านเข้าตาราง ' + n + ' วรรค' : 'อ่านไม่ออก — ตรวจว่ามีตัวโน้ตหรือรหัสแป้นอยู่ในข้อความ'; setTimeout(() => this.t('pmsg').textContent = '', 3500); },
    };
    r.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', e => act[b.dataset.a] && act[b.dataset.a](e)));
    { const sy = r.querySelector('[data-f="system"]');
      if (sy) sy.addEventListener('change', () => { S.system = SYSTEMS[sy.value] ? sy.value : 'melody1'; if (!handsOf(S.system).includes(S.caret.hand)) S.caret.hand = 'r'; this.ensureHands(); this.fillAutoOctave(); this.syncControls(); this.rebuild(); this.emit(); }); }
    { const tn = this.q('[data-f="tuning"]'); if (tn) tn.addEventListener('change', e => { S.tuning = e.target.value; this.syncControls(); this.emit(); }); }
    // ทาง: โหมด "ย้ายโน้ตจริง" ย้ายตัวอักษรทั้งเพลง (ย้อนกลับได้) · โหมด "ตรึงโน้ต" เปลี่ยนแค่เสียง
    { const tg = this.q('[data-f="tang"]'); if (tg) tg.addEventListener('change', e => {
        const want = Math.max(1, Math.min(7, parseInt(e.target.value, 10) || 2));
        if (S.tangView === 'real') {
          if (this.transposeAll(shiftBetween(S.tangHome, want))) { S.tangHome = want; S.tang = want; }
          this.rebuild();
        } else S.tang = want;
        this.syncControls(); this.emit();
      }); }
    // ระบบบันทึก: ย้ายตัวอักษร 1 ขั้น + สลับชุดความถี่ให้ตรงกัน → เสียงที่ได้ยินไม่เปลี่ยน
    { const ne = this.q('[data-f="notens"]'); if (ne) ne.addEventListener('change', e => {
        const want = e.target.value === 'khrueangsai' ? 'khrueangsai' : 'piphat';
        if (want === S.notEns) return;
        if (!this.transposeAll(ensembleOffset(want) - ensembleOffset(S.notEns))) { this.syncControls(); return; }
        S.notEns = want;          // setter สลับชุดความถี่ให้เอง → เสียงที่ได้ยินไม่เปลี่ยน
        this.rebuild(); this.syncControls(); this.emit();
        this.flash('สลับเป็นระบบ' + ENSEMBLES[want] + ' — ตัวอักษรขยับ เสียงเท่าเดิม');
      }); }
    { const tv = this.q('[data-f="tangview"]'); if (tv) tv.addEventListener('change', e => {
        S.tangView = e.target.value === 'real' ? 'real' : 'fix';
        // สลับมาโหมดย้ายจริงทั้งที่ค้างเสียงไว้ → ย้ายตัวอักษรให้ตรงเสียงที่ได้ยินอยู่
        if (S.tangView === 'real' && S.tang !== S.tangHome) {
          if (this.transposeAll(shiftBetween(S.tangHome, S.tang))) { S.tangHome = S.tang; this.rebuild(); }
        }
        this.syncControls(); this.emit();
      }); }
    r.querySelectorAll('[data-font]').forEach(b => b.addEventListener('click', () => { S.font = b.dataset.font; r.classList.toggle('fnt-unicode', S.font === 'unicode'); r.classList.toggle('fnt-notation', S.font === 'notation'); this.syncControls(); this.buildPad(); this.rebuild(); }));
    r.querySelectorAll('[data-reg]').forEach(b => b.addEventListener('click', () => { S.reg = +b.dataset.reg; r.querySelectorAll('[data-reg]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); this.buildPad(); }));
    this.q('[data-f="ta"]').addEventListener('change', e => { S.ta = +e.target.value; this.syncControls(); });
    this.q('[data-f="rap"]').addEventListener('change', e => { S.rap = +e.target.value; this.syncControls(); });
    this.q('[data-f="chingmode"]').addEventListener('change', e => { S.chingMode = e.target.value; this.rebuild(); });
    { const kg = this.q('[data-f="krogap"]'); if (kg) kg.addEventListener('change', e => { S.kroGap = parseFloat(e.target.value) || KRO_GAP_DEFAULT; this.emit(); }); }
    this.q('[data-f="bpm"]').addEventListener('input', e => { S.bpm = +e.target.value; this.t('bpm').textContent = S.bpm; });
    this.q('[data-f="ching"]').addEventListener('change', e => { S.chingOn = e.target.checked; });
    this.q('[data-f="src"]').addEventListener('change', e => { S.src = e.target.value; this.buffers = null; this.hzMap = null; if (S.src !== 'synth') this.ensureAssets(); this.emit(); });
    this.q('[data-f="nathab"]').addEventListener('change', e => { S.nathab = e.target.value; if (S.nathab !== 'none') this.ensureAssets(); });
    this.q('[data-f="drum"]').addEventListener('change', e => { S.drum = e.target.value; if (S.nathab !== 'none') this.ensureAssets(); });
    // โหลดเสียงจริงตั้งแต่เปิดกระดาน (เสียงขณะพิมพ์เป็นเสียงเครื่องจริง) · เพลงที่ตั้งกลอง/ฉิ่งไว้ก็โหลดเสียงกลองรอเลย
    if (S.src !== 'synth' || S.nathab !== 'none' || S.chingOn) this.ensureAssets();

    this._key = e => {
      if (!r.contains(document.activeElement) && document.activeElement !== r) return;   // รับคีย์เฉพาะเมื่อโฟกัสอยู่ในกระดาน
      if (this.readOnly) { if ((e.ctrlKey || e.metaKey) && e.key === ' ') { e.preventDefault(); this.play.on ? this.stopPlay() : this.startPlay(this.caretStep()); } else if (e.key === 'Escape') this.stopPlay(); return; }
      const tg = e.target; if (tg && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tg.tagName)) return;
      // คีย์ลัดดูจากตำแหน่งปุ่ม (e.code) — แป้นภาษาไทย Ctrl+Z ให้ e.key เป็น 'ผ' ถ้าดูแค่ e.key จะไม่ทำงาน
      const code = (e.code || '').replace(/^Key/, '').toLowerCase() || (typeof e.key === 'string' ? e.key.toLowerCase() : '');
      if ((e.ctrlKey || e.metaKey) && (code === 'z' || code === 'y')) { e.preventDefault(); this.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && code === 'c') { e.preventDefault(); this.copySel(); return; }
      if ((e.ctrlKey || e.metaKey) && code === 'x') { e.preventDefault(); this.cutSel(); return; }
      if ((e.ctrlKey || e.metaKey) && code === 'v') { if (this.clip) { e.preventDefault(); this.pasteCells(this.clip); } return; }   // ไม่มีคลิปภายใน → ปล่อยให้ paste event อ่านข้อความ
      if ((e.ctrlKey || e.metaKey) && code === 'a') { e.preventDefault(); this.setSel(0, S.total - 1); return; }
      if (e.shiftKey && e.key === 'Delete') { e.preventDefault(); const rr = this.selRange(); if (rr) this.removeRange(rr[0], rr[1]); else { const a = this.hongStart(); this.removeRange(a, a + 3); } return; }
      if (e.shiftKey && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
        e.preventDefault();
        const anchor = S.sel ? (S.sel.a === this.caretStep() ? S.sel.b : S.sel.a) : this.caretStep();
        const cur = this.caretStep();
        const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -S.lineHong * 4 : S.lineHong * 4;
        const nx = Math.max(0, Math.min(S.total - 1, cur + d));
        const l = this.locate(nx); if (l) { this.setCaret({ ...l, hand: S.caret.hand }); this.setSel(anchor, nx); }
        return;
      }
      if (S.sel && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); this.clearSel(); this.setSel(null); return; }
      if (this.move && e.key === 'Escape') { e.preventDefault(); this.endMove(false); this.flash('ยกเลิกการย้าย'); return; }
      if (this.split && e.key === 'Escape') { e.preventDefault(); this.endSplit(false); this.flash('ยกเลิกการย้ายเส้นแบ่งวรรค'); return; }
      if (S.sel && e.key === 'Escape') { this.setSel(null); }
      if ((e.ctrlKey || e.metaKey) && e.key === ' ') { e.preventDefault(); this.play.on ? this.stopPlay() : this.startPlay(this.caretStep()); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); this.gotoLine(e.key === 'ArrowDown' ? 1 : -1); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === 'Backspace' || e.key === 'Delete' || code === 'd')) { e.preventDefault(); this.deleteBar(); return; }
      // Alt+โน้ต = ลงโน้ตพร้อมกรอ · Alt+Shift+โน้ต = ลงโน้ตพร้อมประคบ (Pk เคาะ 2026-08-26)
      //   อ่านจาก e.code (ตำแหน่งปุ่ม) ไม่ใช่ e.key — บน Mac กด Option+s ได้ตัวอักษรแปลก ๆ ออกมา
      if (e.altKey && !e.ctrlKey && !e.metaKey && KEYMAP[code]) {
        e.preventDefault();
        const m = KEYMAP[code];
        this.putNote(m.i, m.reg, false, e.shiftKey ? 'damp' : 'kro');
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key, lower = typeof k === 'string' && k.length === 1 ? k.toLowerCase() : k;
      // กดค้าง = ประคบ · ระบบปฏิบัติการจะยิง keydown ซ้ำ ๆ ตอนกดค้าง ต้องกันไว้ ไม่งั้นโน้ตจะไหลรัว
      const held = !!e.repeat, kid = code || (typeof lower === 'string' ? lower : '');
      const rep = () => { e.preventDefault(); return true; };     // คีย์ซ้ำจากการกดค้าง — กลืนทิ้ง อย่าลงโน้ตเพิ่ม
      if (KEYMAP[lower]) { if (held) return rep(); e.preventDefault(); const m = KEYMAP[lower]; this.typeNote(m.i, m.reg, e.shiftKey, kid); return; }
      const ti = NOTES.indexOf(k); if (ti >= 0) { if (held) return rep(); e.preventDefault(); this.typeNote(ti, S.reg, e.shiftKey, kid); return; }
      if (/^[1-7]$/.test(k)) { if (held) return rep(); e.preventDefault(); this.typeNote(+k - 1, S.reg, e.shiftKey, kid); return; }
      if (k === ' ' || k === '-') { e.preventDefault(); this.skip(); return; }
      // | = แบ่งวรรคตรงห้องที่เคอร์เซอร์อยู่ (Pk 2026-08-26) · Shift+| บนแป้นไทยได้ทั้ง '|' และ 'ฯ'
      if (k === '|' || k === '\\' || k === 'ฯ') { e.preventDefault(); this.splitVerseAtCaret(); return; }
      // ~ สลับกรอที่ช่องที่เคอร์เซอร์อยู่ (ประคบใช้วิธีกดโน้ตค้าง ไม่ผูกกับแป้นเครื่องหมายแล้ว —
      //  แป้น . เดิมถูกยกเลิก เพราะไปสับสนกับจุดกำหนดเสียงต่ำ–สูง · Pk 26 ส.ค. 69)
      if (k === '~' || k === '`' || code === 'backquote') { e.preventDefault(); this.toggleMark('kro'); return; }
      if (k === 'Escape') { e.preventDefault(); this.stopPlay(); return; }
      if (k === 'Backspace') { e.preventDefault(); this.backspace(); return; }
      if (k === 'Delete') { e.preventDefault(); this.pushUndo(); this.clearCurCell(); this.touchCaretRow(); this.emit(); return; }
      if (k === 'Tab') { e.preventDefault(); const H = this.hands(); if (H.length > 1) { const i = Math.max(0, H.indexOf(S.caret.hand)); this.setCaret({ ...S.caret, hand: H[(i + (e.shiftKey ? H.length - 1 : 1)) % H.length] }); } return; }
      // Enter = แทรกห้องขวา · Ctrl+Enter = ลบทั้งห้อง · Shift+Enter = ขึ้นบรรทัดใหม่ (Pk เคาะ 2026-08-25)
      if (k === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) this.deleteBar();
        else if (e.shiftKey) this.newLineAfterCaret();
        else this.insertBarRight();
        return;
      }
      if (k === 'Home') { e.preventDefault(); this.gotoLineEdge(false); return; }
      if (k === 'End') { e.preventDefault(); this.gotoLineEdge(true); return; }
      if (k === 'ArrowRight') { e.preventDefault(); this.advance(); return; }
      if (k === 'ArrowLeft') { e.preventDefault(); if (S.caret.p > 0) this.setCaret({ ...S.caret, p: S.caret.p - 1 }); else if (S.caret.v > 0) { const pv = S.verses[S.caret.v - 1]; this.setCaret({ v: S.caret.v - 1, p: pv.cells.length - 1, hand: S.caret.hand }); } return; }
      if (k === 'ArrowDown') { e.preventDefault(); const H = this.hands(); const hi = Math.max(0, H.indexOf(S.caret.hand));
        if (hi < H.length - 1) this.setCaret({ ...S.caret, hand: H[hi + 1] });
        else if (S.caret.v < S.verses.length - 1) { const nv = S.verses[S.caret.v + 1]; this.setCaret({ v: S.caret.v + 1, p: Math.min(S.caret.p, nv.cells.length - 1), hand: H[0] }); } return; }
      if (k === 'ArrowUp') { e.preventDefault(); const H = this.hands(); const hi = Math.max(0, H.indexOf(S.caret.hand));
        if (hi > 0) this.setCaret({ ...S.caret, hand: H[hi - 1] });
        else if (S.caret.v > 0) { const pv = S.verses[S.caret.v - 1]; this.setCaret({ v: S.caret.v - 1, p: Math.min(S.caret.p, pv.cells.length - 1), hand: H[H.length - 1] }); } return; }
    };
    document.addEventListener('keydown', this._key);
    // ปล่อยแป้นก่อนครบเวลา = ไม่ประคบ · สลับหน้าต่างกลางคันก็ยกเลิกเช่นกัน
    this._keyup = e => {
      if (!this.hold) return;
      const c = (e.code || '').replace(/^Key/, '').toLowerCase() || (typeof e.key === 'string' ? e.key.toLowerCase() : '');
      if (!c || c === this.hold.key) this.clearHold();
    };
    this._blur = () => this.clearHold();
    document.addEventListener('keyup', this._keyup);
    window.addEventListener('blur', this._blur);
    this._up = ev => { clearTimeout(this._lp); if (this.drag && this.drag.inSel && !this.drag.moved && !this.move) this.setSel(null); this.drag = null; if (this.move) this.endMove(true); if (this.split) this.endSplit(true); };
    document.addEventListener('mouseup', this._up);
    this._mv = ev => {
      if (this.move) this.moveAt(ev);
      if (this.split) this.splitAt(ev);
      // ลากเลือกช่วง: เริ่มนับเมื่อเมาส์ขยับเกิน 6px จากจุดกด (กันตารางขยับใต้เมาส์แล้วการกดค้างหลุด)
      const d = this.drag;
      if (d && !d.moved && !this.move && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6) {
        d.moved = true; clearTimeout(this._lp);
        const el = document.elementFromPoint(ev.clientX, ev.clientY), c = el && el.closest ? el.closest('.thn-cell') : null;
        if (c && c.dataset.step != null && +c.dataset.step !== d.anchor) this.setSel(d.anchor, +c.dataset.step);
      }
    };
    document.addEventListener('mousemove', this._mv);
    this._paste = e => {
      if (this.readOnly || this.clip) return;
      if (!r.contains(document.activeElement)) return;
      const tg = e.target; if (tg && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tg.tagName)) return;
      const t = e.clipboardData && e.clipboardData.getData('text');
      if (t && this.pasteText(t)) e.preventDefault();
    };
    document.addEventListener('paste', this._paste);
    this._resize = () => { clearTimeout(this._rsT); this._rsT = setTimeout(() => this.fitWidth(true), 200); };
    window.addEventListener('resize', this._resize);
    this.t('score').addEventListener('focus', () => r.classList.add('focused'));
  }
}
