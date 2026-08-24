export const metadata = { title: 'อภิธานศัพท์ดนตรีไทย · Thai Music Glossary — THMA' };

const TERMS = [
  ['กระสวน', 'Krasuan', 'รูปแบบจังหวะของ 1 วรรค (16 ตำแหน่ง) ไม่สนใจระดับเสียง', 'The rhythmic pattern of one phrase (16 positions), pitch ignored'],
  ['วรรค', 'Wak (phrase)', 'หน่วยทำนอง 4 ห้อง = 16 ตำแหน่งโน้ต', 'A melodic unit of 4 measures = 16 note positions'],
  ['ห้อง', 'Hong (measure)', 'หน่วยย่อยของวรรค บรรจุโน้ต 4 ตำแหน่ง', 'A measure containing 4 note positions'],
  ['ประโยค', 'Prayok (sentence)', 'วรรคหน้า + วรรคหลัง รวม 8 ห้อง', 'Two phrases (front + back) forming 8 measures'],
  ['ลูกตก', 'Luk tok (cadence tone)', 'เสียงตกท้ายวรรค/ประโยค เป็นเสาหลักของทำนอง', 'The structural tone at the end of a phrase — the melodic pillar'],
  ['ทาง', 'Thang (mode/key)', 'บันไดเสียง 7 ทางของดนตรีไทย เช่น ทางใน ทางนอก ทางเพียงออ', 'One of seven Thai modes/keys, e.g. thang nai, thang nok'],
  ['สะบัด', 'Sabat', 'การบรรเลงพลิ้ว 3 เสียงในจังหวะเดียว เสียงสุดท้ายลงตรงจังหวะ', 'A three-note flourish; the last note lands on the beat'],
  ['หน้าทับ', 'Nathab', 'วัฏจักรจังหวะกลองกำกับเพลง เช่น ปรบไก่ สองไม้', 'The drum cycle governing a piece, e.g. prop kai, song mai'],
  ['ฉิ่ง–ฉับ', 'Ching–chap', 'เสียงฉิ่งเปิด (ฉิ่ง) และปิด (ฉับ) กำหนดจังหวะหลัก', 'Open (ching) and damped (chap) cymbal strokes marking the beat'],
  ['อัตราจังหวะ', 'Attra (metrical level)', 'สามชั้น (ขยาย) สองชั้น (ต้นแบบ) ชั้นเดียว (ย่อ)', 'Sam chan (augmented), song chan (original), chan diao (diminished)'],
  ['เถา', 'Thao', 'เพลงชุดที่บรรเลงครบ 3 อัตรา สามชั้น→สองชั้น→ชั้นเดียว', 'A suite performing all three metrical levels in sequence'],
  ['ฆ้องวงใหญ่', 'Khong wong yai', 'ฆ้องวง 16 ลูก ผู้ถือทำนองหลักของวงปี่พาทย์', 'The 16-gong circle carrying the principal melody'],
  ['ทำนองหลัก', 'Principal melody', 'ทำนองแม่บทของเพลง ก่อนแปรเป็นทางเครื่องต่างๆ', 'The core melody from which instrumental variants derive'],
  ['การแปรทำนอง', 'Melodic variation', 'การแปลงทำนองหลักตามสำนวนเครื่องดนตรีแต่ละชนิด', 'Idiomatic transformation of the principal melody per instrument'],
  ['เสียงสูง–กลาง–ต่ำ', 'Registers', 'ระดับคู่แปด แสดงด้วยจุดบน (ดํ) ไม่มีจุด (ด) จุดล่าง (ดฺ)', 'Octave registers: dot above (high), plain (middle), dot below (low)'],
];

export default function GlossaryPage() {
  return (
    <main className="container" style={{maxWidth:'760px'}}>
      <div className="section-title" style={{fontSize:'1.3rem'}}>📖 อภิธานศัพท์ · Glossary</div>
      <div className="section-subtitle">ศัพท์ดนตรีไทยพื้นฐานสำหรับผู้ใช้ฐานข้อมูล · Essential terms for using this archive</div>
      <div style={{marginTop:'1.2rem'}}>
        {TERMS.map(([th, en, dth, den]) => (
          <div key={th} className="card" style={{padding:'0.9rem 1.2rem'}}>
            <div style={{display:'flex',gap:'10px',alignItems:'baseline',flexWrap:'wrap'}}>
              <b style={{fontSize:'1rem'}}>{th}</b>
              <span style={{color:'var(--gold)',fontSize:'0.82rem'}}>{en}</span>
            </div>
            <div style={{fontSize:'0.84rem',marginTop:'4px',lineHeight:1.8}}>{dth}</div>
            <div style={{fontSize:'0.78rem',color:'var(--muted)',lineHeight:1.7}}>{den}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
