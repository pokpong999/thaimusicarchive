'use client';
import { FeaturePage } from '../../components/Gate';
const CODES = [
  ['O','----'],['A','X---'],['B','-X--'],['C','--X-'],['D','---X'],['E','XX--'],['F','X-X-'],['G','X--X'],
  ['H','-XX-'],['I','-X-X'],['J','--XX'],['K','XXX-'],['L','XX-X'],['M','X-XX'],['N','-XXX'],['P','XXXX'],
];

export default function SpecPage() {
  return (
    <FeaturePage feature="page_spec">
    <main className="container" style={{maxWidth:'760px',lineHeight:2}}>
      <div className="section-title" style={{fontSize:'1.35rem'}}>Krasuan Code Standard v1.0</div>
      <div className="section-subtitle">มาตรฐานรหัสกระสวนเพลงไทย · The standard encoding for Thai classical music rhythmic patterns</div>

      <div className="card" style={{marginTop:'1.2rem',fontSize:'0.9rem'}}>
        <p><b>ไทย</b> — กระสวน คือรูปแบบจังหวะของเพลงไทย 1 กระสวน = 1 วรรค = 4 ห้อง = 16 ตำแหน่ง
        แต่ละตำแหน่งมีเสียง (X) หรือไม่มีเสียง (-) โดยไม่สนใจระดับเสียง รหัสกระสวนแทนแต่ละห้อง (4 ตำแหน่ง)
        ด้วยอักษรโรมัน 1 ตัว รวม 16 แบบ ดังนั้น 1 กระสวน = อักษร 4 ตัว เช่น <b style={{fontFamily:'monospace',color:'var(--gold)'}}>NIII</b> —
        กระสวนที่เป็นไปได้ทางทฤษฎีมี 65,536 แบบ ฐานข้อมูลนี้พบใช้จริง 1,451 แบบ จาก 19,963 วรรคใน 279 เพลง</p>
        <p><b>English</b> — A <i>krasuan</i> is the rhythmic pattern of one Thai musical phrase (วรรค):
        4 measures × 4 positions = 16 slots, each sounding (X) or silent (-), pitch ignored.
        Each measure maps to one Roman letter (16 possibilities), so one krasuan = a 4-letter code,
        e.g. <b style={{fontFamily:'monospace',color:'var(--gold)'}}>NIII</b>. Of 65,536 theoretical patterns,
        this database documents 1,451 in actual use across 19,963 phrases from 279 pieces.</p>
      </div>

      <div className="card">
        <div style={{fontWeight:600,marginBottom:'0.8rem'}}>ตารางรหัส · Code Table</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:'8px'}}>
          {CODES.map(([c, p]) => (
            <div key={c} style={{background:'var(--navy3)',borderRadius:'6px',padding:'8px 12px',
              fontFamily:'monospace',display:'flex',justifyContent:'space-between'}}>
              <b style={{color:'var(--gold)'}}>{c}</b><span>{p}</span>
            </div>
          ))}
        </div>
        <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:'0.8rem'}}>
          หมายเหตุ · Notes: <b>I</b> (-X-X) = จังหวะฉิ่ง ching pattern · <b>N</b> (-XXX) = สะบัด sabat triplet ·
          <b> O</b> (----) = ห้องว่าง/เสียงยืน sustained
        </div>
      </div>

      <div className="card" style={{fontSize:'0.85rem'}}>
        <div style={{fontWeight:600,marginBottom:'0.5rem'}}>การอ้างอิงมาตรฐานนี้ · Citing this standard</div>
        <div style={{fontFamily:'monospace',fontSize:'0.78rem',background:'var(--navy3)',padding:'0.8rem',borderRadius:'6px'}}>
          Khamprasert, P. (2026). <i>The Krasuan Code: A standard encoding system for Thai classical music
          rhythmic patterns</i> (v1.0). Thai Music Archive. https://thaimusicarchive.com/spec
        </div>
        <div style={{marginTop:'0.6rem',fontSize:'0.78rem',color:'var(--muted)'}}>
          © Pokpong Khamprasert. The code system specification may be used freely with attribution.
          ระบบรหัสนี้ใช้ได้เสรีโดยอ้างอิงที่มา
        </div>
      </div>
      <a href="/krasuan"><button className="btn btn-primary btn-sm">🥁 ทดลองค้นกระสวน · Try Krasuan Search</button></a>
    </main>
    </FeaturePage>
  );
}
