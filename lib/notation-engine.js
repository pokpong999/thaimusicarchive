// lib/notation-engine.js — กระดานโน้ตไทย (เอนจินฝั่ง DOM, ไม่ผูกกับ React)
// React ห่อด้วย components/NotationInput.js · ตรรกะดนตรีทั้งหมดอยู่ใน lib/notation-core.js
import {
  NOTES, HIGH, LOW, KEYMAP, KEY_OF, SABAT_GAP_DEFAULT,
  noteText, noteKey, splitLine, mkVerse, hongOf, hasSound,
  krasuanOf, verseCode, luktokOf, pairId, chingAt, CHING_CYCLE, buildVoices,
  textToVerses, versesToText, checkVerses, statsOf, trimVerses, parseHand, formatHand,
} from './notation-core';

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
.thn-seg button{background:transparent;border:0;color:var(--thn-muted);font:inherit;font-size:.76rem;
  padding:5px 11px;border-radius:5px;cursor:pointer;white-space:nowrap}
.thn-seg button[aria-pressed="true"]{background:var(--thn-gold);color:var(--thn-sunk);font-weight:600}
.thn-btn{background:var(--thn-sunk);border:1px solid var(--thn-line);color:var(--thn-ink);font:inherit;
  font-size:.76rem;padding:6px 12px;border-radius:6px;cursor:pointer;white-space:nowrap}
.thn-btn:hover{border-color:var(--thn-gold);color:var(--thn-gold)}
.thn-btn.on{background:rgba(201,168,76,.15);border-color:var(--thn-gold);color:var(--thn-gold)}
.thn-btn[disabled]{opacity:.4;cursor:default}
.thn-btn.play{background:var(--thn-jade);border-color:var(--thn-jade);color:#fff;font-weight:600}
.thn-btn.stop{background:rgba(212,122,143,.14);border-color:var(--thn-alert);color:var(--thn-alert)}
.thn-sep{width:1px;align-self:stretch;background:var(--thn-line);margin:0 .2rem}
.thn-note{font-size:.7rem;color:var(--thn-muted);margin-left:auto;font-family:monospace}
.thn-pick{display:flex;align-items:center;gap:5px;font-size:.74rem;color:var(--thn-muted);white-space:nowrap}
.thn-pick select{background:var(--thn-sunk);border:1px solid var(--thn-line);border-radius:5px;color:var(--thn-ink);
  font:inherit;font-size:.75rem;padding:4px 6px;outline:none;cursor:pointer}
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
.thn-cell{width:var(--cw);height:var(--cw);display:flex;align-items:center;justify-content:center;border-radius:3px;
  cursor:pointer;position:relative;font-size:1.05rem;line-height:1;color:var(--thn-ink);border:1px solid transparent;
  user-select:none;overflow:hidden}
.thn-cell .gl{display:block;text-align:center;line-height:1;font-family:'THNotation',serif;font-size:1.18em}
.thn.fnt-unicode .thn-cell .gl{font-family:'Noto Sans Thai',sans-serif;font-size:1em}
.thn-cell.sabat{justify-content:space-evenly;padding:0 1px}
.thn-cell.sabat .gl{color:var(--thn-jade)}
.thn.fnt-unicode .thn-cell.sabat .gl{font-size:.86em}
.thn-cell.beat{background:rgba(201,168,76,.10)}
.thn-cell.empty .gl{color:var(--thn-muted);opacity:.42}
.thn-cell.lead .gl{color:var(--thn-jade)}
.thn-cell:hover{background:rgba(201,168,76,.18)}
.thn-cell.sel{background:rgba(76,154,132,.28);border-color:rgba(76,154,132,.6)}
.thn-cell.sel.beat{background:rgba(76,154,132,.36)}
.thn.readonly .thn-selbar{display:none}
.thn-selbar{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;padding:.35rem .5rem;border:1px dashed rgba(76,154,132,.5);border-radius:6px;margin:.35rem 0}
.thn-selbar .thn-mini{margin-left:0}
.thn-cell.cur{border-color:var(--thn-gold2);background:rgba(232,201,106,.28);box-shadow:0 0 0 3px rgba(232,201,106,.3)}
.thn-cell.cur::after{content:'';position:absolute;left:3px;right:3px;bottom:-1px;height:2px;background:var(--thn-gold2);
  border-radius:2px;animation:thn-blink 1.15s ease-in-out infinite}
@keyframes thn-blink{0%,100%{opacity:1}50%{opacity:.25}}
.thn-cell.play{background:rgba(76,154,132,.22);border-color:var(--thn-jade)}
.thn-arc{position:absolute;height:8px;border-top:1.6px solid var(--thn-jade);border-radius:50% 50% 0 0/100% 100% 0 0;
  pointer-events:none;opacity:.85}
.thn-ching{height:1rem}
.thn-ching.editable span{cursor:pointer;border-radius:3px}
.thn-ching.editable span:hover{background:rgba(201,168,76,.25);color:var(--thn-gold)}
.thn-ching.editable span:empty::after{content:'·';opacity:.25}
.thn-seclevel{background:var(--thn-sunk);border:1px solid var(--thn-line);border-radius:5px;color:var(--thn-gold);
  font:inherit;font-size:.74rem;padding:2px 6px;outline:none;cursor:pointer}
.thn-ching span{width:var(--cw);text-align:center;font-family:monospace;font-size:.56rem;color:var(--thn-muted);line-height:1rem}
.thn-kg{width:calc(var(--cw)*4 + 10px);flex:none;text-align:center;font-family:monospace;font-weight:600;
  font-size:.72rem;color:var(--thn-gold);letter-spacing:.06em;line-height:1.3}
.thn-kg.rest{color:var(--thn-muted);opacity:.45;font-weight:400}
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
@media (max-width:820px){.thn-panels{grid-template-columns:1fr}}
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
    <h4>๓ · สองมือ R/L</h4>
    <p>ปุ่ม <b>สองมือ R/L</b> เปิดสองบรรทัด — R มือขวา (บน) · L มือซ้าย (ล่าง)
    กด <kbd>Tab</kbd> สลับมือ · เสียงสองมือลงพร้อมกันเสมอ (คู่สี่ คู่ห้า คู่แปด)</p>
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
    <p><b>−ห้อง / +ห้อง</b> ปรับจำนวนห้องของวรรคที่เคอร์เซอร์อยู่ · <b>⧉ ซ้ำบรรทัดนี้</b> คัดลอกทั้งบรรทัดต่อท้าย ·
    <b>🗑 ลบบรรทัดนี้</b> ลบบรรทัดที่เคอร์เซอร์อยู่ (มีโน้ตจะถามยืนยันก่อน · กด <kbd>Ctrl</kbd>+<kbd>Z</kbd> เอาคืนได้) ·
    <b>＋ ขึ้นท่อนใหม่</b> เริ่มท่อนถัดไป · <b>✎ ชื่อท่อน</b> ตั้งชื่อท่อนที่เคอร์เซอร์อยู่ ·
    <b>อัตรา</b> ของแต่ละท่อนตั้งที่หัวท่อน (เพลงเถา: ท่อนละอัตราได้)</p>
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
</div>
<div class="thn-manual" data-t="manual" hidden>` + MANUAL_HTML + `</div>
<div class="thn-bar">
  <button class="thn-btn play" type="button" data-a="play">▶ เล่นจากเคอร์เซอร์</button>
  <button class="thn-btn stop" type="button" data-a="stop" disabled>■ หยุด</button>
  <button class="thn-btn" type="button" data-a="all">↺ ตั้งแต่ต้น</button>
  <div class="thn-rng">ช้า <input type="range" data-f="bpm" min="50" max="200" value="120" aria-label="ความเร็ว"> เร็ว <b data-t="bpm">120</b></div>
  <div class="thn-sep"></div>
  <div class="thn-seg" role="group"><button type="button" data-ens="sai" aria-pressed="true">🎻 เครื่องสาย</button><button type="button" data-ens="piphat" aria-pressed="false">🥁 ปี่พาทย์ +1</button></div>
  <label class="thn-pick" data-t="srcwrap" style="display:none">เสียง <select data-f="src"><option value="real">🎵 ฆ้องวงใหญ่จริง</option><option value="synth">〰 สังเคราะห์</option></select></label>
  <label class="thn-chk"><input type="checkbox" data-f="ching"> ฉิ่ง–ฉับ</label>
  <label class="thn-pick"><select data-f="chingmode"><option value="auto">ฉิ่งอัตโนมัติตามอัตรา</option><option value="manual">กำหนดฉิ่งเอง (จังหวะพิเศษ)</option></select></label>
  <label class="thn-pick" data-t="drumwrap" style="display:none">กลอง <select data-f="nathab"><option value="none">ไม่มี</option><option>ปรบไก่</option><option>สองไม้</option></select>
    <select data-f="drum"><option>ตะโพน</option><option>กลองแขก</option><option>กลองสองหน้า</option><option>โทนรำมะนา</option><option>กลองทัด</option></select></label>
  <button class="thn-btn on" type="button" data-a="snd">♪ เสียงขณะพิมพ์</button>
  <span class="thn-mini" data-t="sndmsg" style="margin-left:0"></span>
  <span class="thn-note" data-t="caret"></span>
</div>
<div class="thn-bar">
  <div class="thn-seg" role="group"><button type="button" data-mode="1" aria-pressed="true">ทำนองรวม</button><button type="button" data-mode="2" aria-pressed="false">สองมือ R/L</button></div>
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
  <button class="thn-btn" type="button" data-a="sec">＋ ขึ้นท่อนใหม่</button>
  <button class="thn-btn" type="button" data-a="secname">✎ ชื่อท่อน</button>
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
  <button class="thn-btn" type="button" data-a="bs" style="height:2.7rem">⌫ ลบ</button>
  <p class="thn-help">พิมพ์จากคีย์บอร์ด: <kbd>a</kbd><kbd>s</kbd><kbd>d</kbd><kbd>f</kbd><kbd>g</kbd><kbd>h</kbd><kbd>j</kbd> = ด ร ม ฟ ซ ล ท · <kbd>q</kbd>–<kbd>u</kbd> สูง · <kbd>z</kbd>–<kbd>m</kbd> ต่ำ · <kbd>Shift</kbd>+โน้ต ×2 = สะบัด · <kbd>space</kbd> ข้าม · <kbd>Enter</kbd> แทรกห้องขวา · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> ลบห้อง · <kbd>Shift</kbd>+<kbd>Enter</kbd> ขึ้นบรรทัดใหม่ · <kbd>Ctrl</kbd>+<kbd>space</kbd> เล่น/หยุด · <kbd>Ctrl</kbd>+<kbd>Z</kbd> ย้อน</p>
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
    this.onChange = opts.onChange || (() => {});
    const ta = opts.ta || opts.base || 4;
    const rap = opts.rap != null ? opts.rap : Math.max(0, (opts.lineHong || 8) - ta);
    this.S = { ta, rap, twoHands: !!opts.twoHands, sound: true,
      reg: 0, sabatArm: false, ensemble: opts.ensemble || 'sai', bpm: opts.bpm || 120, chingOn: false,
      level: opts.level || 'สองชั้น', chingMode: 'auto', font: 'notation',
      caret: { v: 0, p: 0, hand: 'r' }, verses: [], total: 0,
      src: opts.audio ? 'real' : 'synth', nathab: 'none', drum: 'ตะโพน', sel: null };
    this.clip = null;   // คลิปบอร์ดภายใน: [{r:[],l:[]}]
    this.drag = null;   // { anchor: step } ระหว่างลากเมาส์
    Object.defineProperty(this.S, 'base', { get() { return this.ta; } });
    Object.defineProperty(this.S, 'lineHong', { get() { return this.ta + this.rap; } });
    // ปลั๊กเสียงจริง: opts.audio = { load(ctx) → Promise<buffers>, play(ctx, buffers, ch, reg, t, gain, shift) → bool }
    this.audio = opts.audio || null; this.buffers = null; this.loadingSamples = false;
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
    this.bind();
    this.setVerses(opts.verses && opts.verses.length ? opts.verses : null);
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

  /* ─── ข้อมูลเข้า/ออก ─── */
  setVerses(verses) {
    const S = this.S;
    if (!verses) S.verses = [...this.newLine('ท่อน 1'), ...this.newLine('ท่อน 1')];
    else {
      S.verses = verses.map(v => ({ sec: v.sec, nl: v.nl, level: v.level, ching: v.ching, cells: v.cells.map(c => ({ r: c.r || [], l: c.l || [] })) }));
      if (S.verses.some(v => v.cells.some(c => c.l.length))) S.twoHands = true;
      this.appendLine();
    }
    S.caret = { v: 0, p: 0, hand: 'r' };
    this.reindex();
    this.syncControls();
    this.rebuild();
  }
  getVerses() { return trimVerses(this.S.verses).map(v => ({ sec: v.sec, nl: v.nl, cells: v.cells, level: v.level, ching: v.ching })); }
  getState() { const S = this.S; return { base: S.base, lineHong: S.lineHong, ta: S.ta, rap: S.rap, twoHands: S.twoHands, ensemble: S.ensemble, level: S.level, chingMode: S.chingMode }; }
  loadText(text) { const vs = textToVerses(text, { base: this.S.base }); if (!vs.length) return 0; this.pushUndo(); this.setVerses(vs); this.emit(); return vs.length; }
  toText() { return versesToText(this.getVerses(), { twoHands: this.S.twoHands }); }
  emit() { this.onChange({ verses: this.getVerses(), ...this.getState() }); }
  destroy() { this.dead = true; clearTimeout(this._an); clearTimeout(this._rsT); window.removeEventListener('resize', this._resize); this.stopPlay(); this.root.innerHTML = ''; this.root.classList.remove('thn', 'fnt-notation', 'fnt-unicode'); document.removeEventListener('keydown', this._key); document.removeEventListener('mouseup', this._up); document.removeEventListener('mousemove', this._mv); if (this.move) this.endMove(false); document.removeEventListener('paste', this._paste); }

  syncControls() {
    const S = this.S, r = this.root;
    r.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.mode === '2') === S.twoHands)));
    r.querySelectorAll('[data-ens]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ens === S.ensemble)));
    r.querySelectorAll('[data-font]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.font === S.font)));
    this.q('[data-f="ta"]').value = String(S.ta);
    this.q('[data-f="rap"]').value = String(S.rap);
    this.q('[data-f="chingmode"]').value = S.chingMode;
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
  pushUndo() { this.undoStack.push(JSON.stringify({ v: this.S.verses, c: this.S.caret })); if (this.undoStack.length > 60) this.undoStack.shift(); this.syncUndo(); }
  syncUndo() { const b = this.q('[data-a="undo"]'); if (b) { b.disabled = !this.undoStack.length; b.textContent = this.undoStack.length ? `↶ ย้อนกลับ (${this.undoStack.length})` : '↶ ย้อนกลับ'; } }
  undo() { const s = this.undoStack.pop(); this.syncUndo(); if (!s) { this.flash('ไม่มีอะไรให้ย้อน'); return; } const o = JSON.parse(s); this.S.verses = o.v; this.S.caret = o.c; this.S.sel = null; this.reindex(); this.rebuild(); this.emit(); this.flash('ย้อนกลับแล้ว'); }
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
  voicesG() {
    const S = this.S, G = [[], []];
    S.verses.forEach(v => v.cells.forEach(c => { G[0].push(S.twoHands ? c.r : (c.r.length ? c.r : c.l)); G[1].push(S.twoHands ? c.l : []); }));
    return G;
  }

  /* ─── วาด ─── */
  buildRow(row, ctx) {
    const S = this.S, { runs, consumed, total } = ctx;
    const wrap = $el('div', 'thn-row'), top = $el('div', 'thn-top');
    const first = row.vs[0], last = row.vs[row.vs.length - 1];
    const lab = $el('div', 'thn-vlabel'); lab.innerHTML = 'ว.<b>' + (first + 1) + (last !== first ? '–' + (last + 1) : '') + '</b>';
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

    const arcJobs = [];
    (S.twoHands ? ['r', 'l'] : ['r']).forEach((hand, hi) => {
      const hr = $el('div', 'thn-hrow'); hr.append($el('span', 'thn-htag', S.twoHands ? (hand === 'r' ? 'R' : 'L') : ''));
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
            const notes = S.twoHands ? cell[hand] : (cell.r.length ? cell.r : cell.l);
            const c = $el('div', 'thn-cell');
            if (p === 3) c.classList.add('beat');
            if (!notes.length) c.classList.add('empty');
            if (notes.length > 1) c.classList.add('sabat');
            const run = runs.get(hi * total + step);
            if (run) arcJobs.push({ hr, run, hi });
            if (consumed[hi][step]) c.classList.add('lead');
            if (notes.length) notes.forEach(n => c.append($el('span', 'gl', S.font === 'notation' ? noteKey(n) : noteText(n))));
            else c.append($el('span', 'gl', '-'));
            if (S.caret.v === vi && S.caret.p === idx && (!S.twoHands || S.caret.hand === hand)) c.classList.add('cur');
            c.dataset.step = step;
            c.addEventListener('mousedown', ev => {
              ev.preventDefault();
              if (ev.shiftKey && !this.readOnly) { this.setSel(this.caretStep(), step); this.S.caret = { v: vi, p: idx, hand }; this.afterPaint(); }
              else {
                // คลิกในช่วงที่เลือกไว้ ยังไม่ล้างทันที (เผื่อกดค้างย้ายทั้งช่วง) — ปล่อยเมาส์โดยไม่ลากค่อยล้าง
                const inSel = !!(this.S.sel && this.S.sel.a <= step && step <= this.S.sel.b);
                if (!inSel) this.setSel(null);
                this.setCaret({ v: vi, p: idx, hand });
                if (!this.readOnly) this.drag = { anchor: step, inSel, moved: false };
              }
              if (this.play.on) this.startPlay(step);
              this.t('score').focus();
              // กดค้าง ~0.4 วิ โดยไม่ลากออกจากช่อง = ยกทั้งห้องขึ้นมาย้าย
              if (!this.readOnly && !ev.shiftKey) { clearTimeout(this._lp); this._lp = setTimeout(() => { if (this.drag && this.drag.anchor === step && !this.drag.moved) this.beginMove(step, ev); }, 400); }
            });
            c.addEventListener('mouseenter', () => { if (this.drag && this.drag.anchor !== step) { clearTimeout(this._lp); this.drag.moved = true; this.setSel(this.drag.anchor, step); } });
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
    row.vs.forEach(vi => { const v = S.verses[vi]; for (let h = 0; h < hongOf(v); h++) { const c = v.cells[h * 4]; if (c.r.length > 1 || c.l.length > 1) { info.append($el('span', 'thn-flag', '⚑ ว.' + (vi + 1) + ' สะบัดต้นห้อง')); return; } } });
    if (info.childNodes.length) wrap.append(info);
    wrap._arcJobs = arcJobs;
    return wrap;
  }
  drawArcs(wrap) {
    (wrap._arcJobs || []).forEach(({ hr, run, hi }) => {
      const pairEl = this.cellEls[run.step] && this.cellEls[run.step][hi ? 'l' : 'r'];
      if (!pairEl) return;
      let leftEl = pairEl;
      if (run.leadStep >= 0 && run.leadHand === hi) { const le = this.cellEls[run.leadStep] && this.cellEls[run.leadStep][hi ? 'l' : 'r']; if (le && le.closest('.thn-hrow') === hr) leftEl = le; }
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
    this.root.querySelectorAll('.thn-arc').forEach(a => a.remove());
    this.rowEls.forEach(w => this.drawArcs(w));
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
        // อัตราชั้นของท่อนนี้ (เพลงเถาแต่ละท่อนคนละอัตรา) — คุมตำแหน่งฉิ่งและหน้าทับของท่อน
        const sel = document.createElement('select');
        sel.className = 'thn-seclevel';
        ['สามชั้น', 'สองชั้น', 'ชั้นเดียว'].forEach(lv => { const o = document.createElement('option'); o.textContent = lv; sel.append(o); });
        sel.value = this.secLevel(row.sec);
        if (this.readOnly) sel.disabled = true;
        sel.addEventListener('change', () => {
          this.pushUndo();
          this.S.verses.forEach(v => { if (v.sec === row.sec) v.level = sel.value; });
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
      const w = this.buildRow(this.rows[ri], ctx); this.rowEls[ri].replaceWith(w); this.rowEls[ri] = w; this.drawArcs(w);
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
    if (S.sel) for (let st = S.sel.a; st <= S.sel.b; st++) { const m = this.cellEls[st]; if (m) { if (m.r) m.r.classList.add('sel'); if (m.l) m.l.classList.add('sel'); } }
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
    for (let st = a; st <= b; st++) { const c = this.cellAt(st); this.clip.push(c ? { r: c.r.map(n => ({ ...n })), l: c.l.map(n => ({ ...n })) } : { r: [], l: [] }); }
    // ส่งขึ้นคลิปบอร์ดระบบเป็นข้อความโน้ตด้วย (วางลง Word/ฐานข้อมูลได้)
    const txt = this.S.twoHands
      ? 'R: ' + formatHand(this.clip.map(c => c.r)) + '\nL: ' + formatHand(this.clip.map(c => c.l))
      : formatHand(this.clip.map(c => c.r.length ? c.r : c.l));
    try { navigator.clipboard && navigator.clipboard.writeText(txt).catch(() => {}); } catch (e) {}
    this.flash(`คัดลอก ${this.clip.length} ช่อง`);
    return this.clip;
  }
  clearSel() {
    if (this.readOnly) return;
    const [a, b] = this.workRange();
    this.pushUndo();
    for (let st = a; st <= b; st++) { const c = this.cellAt(st); if (c) { c.r = []; c.l = []; } }
    this.rebuild(); this.emit();
  }
  cutSel() { if (this.readOnly) return; this.copySel(); this.clearSel(); }
  // วางทับตั้งแต่เคอร์เซอร์ ข้ามวรรคได้ สุดเพลงแล้วต่อบรรทัดให้เอง · cells = [{r,l}]
  pasteCells(cells) {
    if (this.readOnly || !cells || !cells.length) return;
    this.pushUndo();
    const S = this.S, start = this.caretStep();
    while (S.total < start + cells.length) this.appendLine();
    cells.forEach((c, i) => { const t = this.cellAt(start + i); if (t) { t.r = c.r.map(n => ({ ...n })); t.l = c.l.map(n => ({ ...n })); } });
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
    if (!cells.length || !cells.some(c => c.r.length || c.l.length)) return false;
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
    const gone = v.cells.slice(h * 4, h * 4 + 4).map(c => { const n = c.r.length ? c.r : c.l; return n.length ? n.map(x => S.font === 'notation' ? noteKey(x) : noteText(x)).join('') : '-'; }).join(' ');
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

  /* ─── ลากเส้นแบ่งวรรค (ย้ายห้องระหว่างวรรคซ้าย/ขวาในบรรทัดเดียวกัน) ─── */
  beginSplit(row, k, sepEl, rowEl) {
    if (this.readOnly || this.move || this.split) return;
    const S = this.S;
    const sizes = row.vs.map(vi => hongOf(S.verses[vi]));
    let before = 0; for (let i = 0; i < k - 1; i++) before += sizes[i];
    // เส้นนี้เลื่อนได้ในช่วง [ต้นวรรคซ้าย, ท้ายวรรคขวา]
    this.split = { row, k, sepEl, rowEl, sizes, min: before, max: before + sizes[k - 1] + sizes[k], cur: before + sizes[k - 1], to: null, mark: null };
    sepEl.classList.add('dragging'); this.root.classList.add('splitting');
    this.flash('ลากเส้นแบ่งวรรคไปวางระหว่างห้องที่ต้องการ (ในบรรทัดเดียวกัน) · Esc ยกเลิก');
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
    sp.to = pos; sp.mark = grp; grp.classList.add(after ? 'split-after' : 'split-before');
  }
  endSplit(commit) {
    const sp = this.split; if (!sp) return;
    this.split = null; this.root.classList.remove('splitting');
    sp.sepEl.classList.remove('dragging');
    if (sp.mark) sp.mark.classList.remove('split-before', 'split-after');
    if (!commit || sp.to == null) return;
    this.applySplit(sp.row, sp.k, sp.to);
  }
  // ย้ายเส้นแบ่งที่ k ของบรรทัด ให้มี pos ห้องอยู่ก่อนเส้น (นับจากต้นบรรทัด) · ห้องรวมของบรรทัดเท่าเดิม
  applySplit(row, k, pos) {
    const S = this.S;
    this.pushUndo();
    const left = S.verses[row.vs[k - 1]], right = S.verses[row.vs[k]];
    let before = 0; for (let i = 0; i < k - 1; i++) before += hongOf(S.verses[row.vs[i]]);
    const newLeft = pos - before;                               // จำนวนห้องของวรรคซ้ายหลังย้าย
    const stream = [...left.cells, ...right.cells];
    const chingS = (left.ching || right.ching) ? [...(left.ching || new Array(left.cells.length).fill('')), ...(right.ching || new Array(right.cells.length).fill(''))] : null;
    left.cells = stream.slice(0, newLeft * 4); right.cells = stream.slice(newLeft * 4);
    if (chingS) { left.ching = chingS.slice(0, newLeft * 4); right.ching = chingS.slice(newLeft * 4); }
    const caretStep = this.caretStep();
    // วรรคที่เหลือ 0 ห้อง → ตัดทิ้ง (บรรทัดกลายเป็นวรรคเดียว)
    if (!right.cells.length) S.verses.splice(row.vs[k], 1);
    if (!left.cells.length) { const li = row.vs[k - 1]; const wasNl = left.nl; S.verses.splice(li, 1); if (wasNl && S.verses[li]) S.verses[li].nl = true; }
    this.reindex(); this.rebuild();
    const l = this.locate(Math.min(caretStep, S.total - 1)); if (l) this.setCaret({ ...l, hand: S.caret.hand });
    this.emit();
    const sizes = this.rows[this.rowOfVerse[S.caret.v]].vs.map(vi => hongOf(S.verses[vi]));
    this.flash(`แบ่งวรรคใหม่: ${sizes.join(' + ')} ห้อง (Ctrl+Z คืนได้)`);
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
      const c = this.cellAt(st), notes = c ? (S.twoHands ? c.r : (c.r.length ? c.r : c.l)) : [];
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
    this.t('caret').textContent = 'ว.' + (S.caret.v + 1) + ' · ห้อง ' + (Math.floor(S.caret.p / 4) + 1) + '/' + hongOf(v) + ' · ตำแหน่ง ' + (S.caret.p % 4 + 1) + (S.twoHands ? ' · มือ' + (S.caret.hand === 'r' ? 'ขวา' : 'ซ้าย') : '');
    clearTimeout(this._an);
    this._an = setTimeout(() => this.analyse(), 180);
  }
  caretStep() { return this.S.verses[this.S.caret.v]._off + this.S.caret.p; }
  setCaret(c) {
    const old = this.cellEls[this.caretStep()];
    if (old) { if (old.r) old.r.classList.remove('cur'); if (old.l) old.l.classList.remove('cur'); }
    this.S.caret = c;
    const nu = this.cellEls[this.caretStep()], hand = this.S.twoHands ? c.hand : 'r';
    if (nu && nu[hand]) { nu[hand].classList.add('cur'); if (!this.play.on) nu[hand].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
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
  tone(n, at, gain) {
    const ctx = this.ac(); if (!ctx) return;
    const step = NOTES.indexOf(n.ch); if (step < 0) return;
    if (this.S.src === 'real' && this.audio && this.buffers) {
      const ok = this.audio.play(ctx, this.buffers, n.ch, n.reg, Math.max(ctx.currentTime, at), gain * 2, this.S.ensemble === 'piphat' ? 1 : 0);
      if (ok) return;   // ลูกไหนไม่มีไฟล์ตกมาใช้เสียงสังเคราะห์
    }
    const f = 261.63 * Math.pow(2, (step + n.reg * 7 + (this.S.ensemble === 'piphat' ? 1 : 0)) / 7);
    const t = Math.max(ctx.currentTime, at), dur = 0.6;
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
  typeTone(n) { if (!this.S.sound) return; const c = this.ac(); if (c) this.tone(n, c.currentTime, 0.4); }
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
    if (S.src === 'real' && this.audio && !this.buffers && !this.loadingSamples) {
      this.loadingSamples = true; if (msg) msg.textContent = '⏳ โหลดเสียงฆ้อง…';
      try { const ctx = this.ac(); this.buffers = await this.audio.load(ctx); const n = Object.keys(this.buffers || {}).length; if (msg) msg.textContent = n ? `♪ เสียงจริง ${n}/16 ลูก` : '⚠ ยังไม่มีไฟล์เสียง ใช้สังเคราะห์แทน'; }
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
    for (let s = fromStep; s < total; s++) {
      const t = t0 + (s - fromStep) * SD; tl.push({ t, s });
      const m = meta[s];
      if (S.chingOn && m && m.mark) this.chingHit(t, m.mark === 'ฉับ');
      const dp = m && drumByLevel[m.level];
      if (dp && dp.len > 0) { const pp = (m.rel % dp.len) + 1; dp.hits.forEach(h => { if (h.pos === pp) this.perc.play(ctx, h.syll, t, 0.75, S.drum); }); }
      for (let li = 0; li < 2; li++) {
        if (consumed[li][s]) continue;
        const run = runs.get(li * total + s);
        if (run) run.notes.forEach((n, i) => { const back = run.notes.length - 1 - i; this.tone(n, t - back * SABAT_GAP_DEFAULT, back === 0 ? 0.42 : back === 1 ? 0.34 : 0.28); });
        else at(li, s).forEach(n => this.tone(n, t, 0.42));
      }
    }
    const endT = t0 + (total - fromStep) * SD;
    this.q('[data-a="stop"]').disabled = false; this.q('[data-a="play"]').textContent = '▶ กำลังเล่น…';
    const tick = () => {
      if (this.play.id !== myId) return;
      const now = ctx.currentTime; let cur = -1;
      for (let i = 0; i < tl.length; i++) { if (tl[i].t <= now) cur = tl[i].s; else break; }
      if (cur !== this.play.lastStep) { this.clearPlayMark(); const m = this.cellEls[cur]; if (m) { if (m.r) m.r.classList.add('play'); if (m.l) m.l.classList.add('play'); if (m.r) m.r.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } this.play.lastStep = cur; if (this.onPlayStep) this.onPlayStep(cur); }
      if (now < endT) this.play.raf = requestAnimationFrame(tick); else this.stopPlay();
    };
    this.play.raf = requestAnimationFrame(tick);
  }

  /* ─── แก้ไข ─── */
  curVerse() { return this.S.verses[this.S.caret.v]; }
  curCell() { return this.curVerse().cells[this.S.caret.p]; }
  handKey() { return this.S.twoHands ? this.S.caret.hand : 'r'; }
  advance() {
    const S = this.S, v = this.curVerse();
    if (S.caret.p < v.cells.length - 1) { this.setCaret({ ...S.caret, p: S.caret.p + 1 }); return; }
    if (S.caret.v < S.verses.length - 1) { this.setCaret({ v: S.caret.v + 1, p: 0, hand: S.caret.hand }); return; }
    const at = S.caret.v; this.appendLine(); this.rebuild(); this.setCaret({ v: at + 1, p: 0, hand: S.caret.hand });
  }
  putNote(i, reg, sabat) {
    if (this.readOnly) return;
    if (this.S.sel) this.setSel(null);
    this.pushUndo();
    const n = { ch: NOTES[i], reg }, cell = this.curCell(), hk = this.handKey();
    let done = true;
    if (sabat) {
      if (cell[hk].length >= 2) cell[hk] = [];
      cell[hk] = [...cell[hk], n]; done = cell[hk].length >= 2;
      if (done && this.S.sabatArm) { this.S.sabatArm = false; this.q('[data-a="sabat"]').classList.remove('on'); }
    } else cell[hk] = [n];
    this.touchCaretRow(); this.typeTone(n);
    if (done) this.advance();
    this.emit();
  }
  skip() { if (this.readOnly) return; this.pushUndo(); this.curCell()[this.handKey()] = []; this.touchCaretRow(); this.advance(); this.emit(); }
  backspace() {
    if (this.readOnly) return;
    const S = this.S; this.pushUndo();
    if (S.caret.p > 0) this.setCaret({ ...S.caret, p: S.caret.p - 1 });
    else if (S.caret.v > 0) { const pv = S.verses[S.caret.v - 1]; this.setCaret({ v: S.caret.v - 1, p: pv.cells.length - 1, hand: S.caret.hand }); }
    this.curCell()[this.handKey()] = []; this.touchCaretRow(); this.emit();
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
      sec: () => { this.pushUndo(); const name = 'ท่อน ' + (new Set(S.verses.map(v => v.sec)).size + 1); S.verses.push(...this.newLine(name), ...this.newLine(name)); this.reindex(); this.rebuild(); const f = S.verses.findIndex(v => v.sec === name); if (f >= 0) this.setCaret({ v: f, p: 0, hand: 'r' }); this.emit(); },
      secname: () => { const cur = this.curVerse().sec; const nm = window.prompt('ชื่อท่อน (ใช้กับทุกวรรคของท่อนนี้)', cur); if (!nm || nm.trim() === cur) return; this.pushUndo(); S.verses.forEach(v => { if (v.sec === cur) v.sec = nm.trim(); }); this.rebuild(); this.emit(); },
      clr: () => { if (!window.confirm('ล้างโน้ตทั้งหมด?')) return; this.pushUndo(); this.stopPlay(); S.verses = [...this.newLine('ท่อน 1'), ...this.newLine('ท่อน 1')]; S.caret = { v: 0, p: 0, hand: 'r' }; this.reindex(); this.rebuild(); this.emit(); },
      read: () => { const n = this.loadText(this.t('paste').value); this.t('pmsg').textContent = n ? 'อ่านเข้าตาราง ' + n + ' วรรค' : 'อ่านไม่ออก — ตรวจว่ามีตัวโน้ตหรือรหัสแป้นอยู่ในข้อความ'; setTimeout(() => this.t('pmsg').textContent = '', 3500); },
    };
    r.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', e => act[b.dataset.a] && act[b.dataset.a](e)));
    r.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { S.twoHands = b.dataset.mode === '2'; if (!S.twoHands) S.caret.hand = 'r'; this.syncControls(); this.rebuild(); this.emit(); }));
    r.querySelectorAll('[data-ens]').forEach(b => b.addEventListener('click', () => { S.ensemble = b.dataset.ens; this.syncControls(); this.emit(); }));
    r.querySelectorAll('[data-font]').forEach(b => b.addEventListener('click', () => { S.font = b.dataset.font; r.classList.toggle('fnt-unicode', S.font === 'unicode'); r.classList.toggle('fnt-notation', S.font === 'notation'); this.syncControls(); this.buildPad(); this.rebuild(); }));
    r.querySelectorAll('[data-reg]').forEach(b => b.addEventListener('click', () => { S.reg = +b.dataset.reg; r.querySelectorAll('[data-reg]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); this.buildPad(); }));
    this.q('[data-f="ta"]').addEventListener('change', e => { S.ta = +e.target.value; this.syncControls(); });
    this.q('[data-f="rap"]').addEventListener('change', e => { S.rap = +e.target.value; this.syncControls(); });
    this.q('[data-f="chingmode"]').addEventListener('change', e => { S.chingMode = e.target.value; this.rebuild(); });
    this.q('[data-f="bpm"]').addEventListener('input', e => { S.bpm = +e.target.value; this.t('bpm').textContent = S.bpm; });
    this.q('[data-f="ching"]').addEventListener('change', e => { S.chingOn = e.target.checked; });
    this.q('[data-f="src"]').addEventListener('change', e => { S.src = e.target.value; if (S.src === 'real') this.ensureAssets(); });
    this.q('[data-f="nathab"]').addEventListener('change', e => { S.nathab = e.target.value; if (S.nathab !== 'none') this.ensureAssets(); });
    this.q('[data-f="drum"]').addEventListener('change', e => { S.drum = e.target.value; if (S.nathab !== 'none') this.ensureAssets(); });
    if (S.src === 'real') this.ensureAssets();   // โหลดเสียงจริงตั้งแต่เปิดกระดาน ให้เสียงขณะพิมพ์เป็นฆ้องจริงด้วย

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
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key, lower = typeof k === 'string' && k.length === 1 ? k.toLowerCase() : k;
      if (KEYMAP[lower]) { e.preventDefault(); const m = KEYMAP[lower]; this.putNote(m.i, m.reg, e.shiftKey); return; }
      const ti = NOTES.indexOf(k); if (ti >= 0) { e.preventDefault(); this.putNote(ti, S.reg, e.shiftKey); return; }
      if (/^[1-7]$/.test(k)) { e.preventDefault(); this.putNote(+k - 1, S.reg, e.shiftKey); return; }
      if (k === ' ' || k === '-') { e.preventDefault(); this.skip(); return; }
      if (k === 'Escape') { e.preventDefault(); this.stopPlay(); return; }
      if (k === 'Backspace') { e.preventDefault(); this.backspace(); return; }
      if (k === 'Delete') { e.preventDefault(); this.pushUndo(); this.curCell()[this.handKey()] = []; this.touchCaretRow(); this.emit(); return; }
      if (k === 'Tab') { e.preventDefault(); if (S.twoHands) this.setCaret({ ...S.caret, hand: S.caret.hand === 'r' ? 'l' : 'r' }); return; }
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
      if (k === 'ArrowDown') { e.preventDefault(); if (S.twoHands && S.caret.hand === 'r') this.setCaret({ ...S.caret, hand: 'l' }); else if (S.caret.v < S.verses.length - 1) { const nv = S.verses[S.caret.v + 1]; this.setCaret({ v: S.caret.v + 1, p: Math.min(S.caret.p, nv.cells.length - 1), hand: 'r' }); } return; }
      if (k === 'ArrowUp') { e.preventDefault(); if (S.twoHands && S.caret.hand === 'l') this.setCaret({ ...S.caret, hand: 'r' }); else if (S.caret.v > 0) { const pv = S.verses[S.caret.v - 1]; this.setCaret({ v: S.caret.v - 1, p: Math.min(S.caret.p, pv.cells.length - 1), hand: S.twoHands ? 'l' : 'r' }); } return; }
    };
    document.addEventListener('keydown', this._key);
    this._up = ev => { clearTimeout(this._lp); if (this.drag && this.drag.inSel && !this.drag.moved && !this.move) this.setSel(null); this.drag = null; if (this.move) this.endMove(true); if (this.split) this.endSplit(true); };
    document.addEventListener('mouseup', this._up);
    this._mv = ev => { if (this.move) this.moveAt(ev); if (this.split) this.splitAt(ev); };
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
