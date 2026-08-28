// lib/glossary.js — บัญชีศัพท์ดนตรีไทยสำหรับส่งไปกับคำสั่งแปล  (Pk 28 ส.ค. 69)
//
//   ถ้าไม่มีบัญชีนี้ เครื่องจะแปล "ลูกตก" เป็น "falling child"
//   และแปลชื่อเพลง "กราวนอก" เป็น "Outside Grab"
//
//   ไฟล์นี้ใช้ทั้งฝั่งเซิร์ฟเวอร์ (app/api/translate) และเอาไว้อ่านทบทวนได้
//   เติมศัพท์ใหม่ได้เรื่อย ๆ — เติมแล้วสั่ง "แปลใหม่ทั้งคลัง" ที่หน้าผู้ดูแลได้
export const GLOSSARY = [
  ['ดนตรีไทย', 'Thai classical music'],
  ['เพลงไทย', 'Thai classical song'],
  ['วรรค', 'verse (a 4-bar phrase)'],
  ['ท่อน', 'part (a section of a song)'],
  ['ห้อง', 'bar'],
  ['ประโยค', 'phrase'],
  ['ลูกตก', 'final note (cadence note of a phrase)'],
  ['กระสวน', 'rhythmic pattern (krasuan)'],
  ['ทาง', 'version / arrangement for a particular instrument'],
  ['ทางเพียงออบน', 'thang phiang o bon (a tuning level)'],
  ['ทางเพียงออล่าง', 'thang phiang o lang (a tuning level)'],
  ['หน้าทับ', 'drum pattern (na thap)'],
  ['อัตรา', 'metric rate'],
  ['สามชั้น', 'sam chan (the slowest rate)'],
  ['สองชั้น', 'song chan (the medium rate)'],
  ['ชั้นเดียว', 'chan diao (the fastest rate)'],
  ['เถา', 'thao (a set of one song in all three rates)'],
  ['เพลงเรื่อง', 'phleng rueang (a suite of linked pieces)'],
  ['เพลงตับ', 'phleng tap (a narrative suite)'],
  ['หน้าพาทย์', 'na phat (ceremonial repertoire)'],
  ['โหมโรง', 'overture'],
  ['เสภา', 'sepha'],
  ['สะบัด', 'sabat (a quick three-note flourish)'],
  ['กรอ', 'kro (a sustained tremolo)'],
  ['ประคบ', 'prakhop (a paired-note stroke)'],
  ['ปี่พาทย์', 'piphat ensemble'],
  ['เครื่องสาย', 'string ensemble'],
  ['มโหรี', 'mahori ensemble'],
  ['ฆ้องวงใหญ่', 'khong wong yai (large gong circle)'],
  ['ฆ้องวงเล็ก', 'khong wong lek (small gong circle)'],
  ['ระนาดเอก', 'ranat ek (lead xylophone)'],
  ['ระนาดทุ้ม', 'ranat thum (alto xylophone)'],
  ['ปี่ใน', 'pi nai (oboe)'],
  ['ตะโพน', 'taphon (barrel drum)'],
  ['กลองแขก', 'klong khaek (paired drums)'],
  ['ฉิ่ง', 'ching (small cymbals)'],
  ['ครูดนตรี', 'music master'],
  ['ครู', 'master / teacher'],
  ['สำนัก', 'school (lineage of teaching)'],
  ['ไหว้ครู', 'wai khru (the teacher-honouring ceremony)'],
  ['ศักดินา', 'sakdina (this site’s contribution points)'],
  ['จดหมายเหตุ', 'archive record'],
  ['พ.ศ.', 'BE (Buddhist Era)'],
  ['รัชกาลที่ 5', 'the reign of King Rama V'],
];

export const glossaryText = () => GLOSSARY.map(([th, en]) => `${th} = ${en}`).join('\n');
