// lib/trjobs.js — ตรรกะการแปลล้วน ๆ ไม่แตะเครือข่าย ไม่แตะฐาน
//   (Pk 28 ส.ค. 69)
//
//   แยกออกมาจาก route เพื่อให้ "เทสต์ได้จริง" โดยไม่ต้องมี API key
//   route ทำแค่ ๓ อย่าง: ดึงแถวค้าง → เรียกฟังก์ชันในไฟล์นี้ → เขียนกลับ
import { glossaryText } from './glossary';

// ช่องที่ต้องแปลของแต่ละตาราง · ช่องไหน "ถอดเสียง" ไม่ใช่ "แปลความหมาย"
export const JOBS = {
  archive_records: {
    key: 'id',
    fields: [
      { th: 'what_text',   en: 'what_text_en',   kind: 'title', hint: 'หัวเรื่องเหตุการณ์' },
      { th: 'who_text',    en: 'who_text_en',    kind: 'name',  hint: 'ชื่อบุคคล/คณะ' },
      { th: 'when_text',   en: 'when_text_en',   kind: 'date',  hint: 'ข้อความบอกเวลา' },
      { th: 'where_text',  en: 'where_text_en',  kind: 'place', hint: 'สถานที่' },
      { th: 'description', en: 'description_en', kind: 'prose', hint: 'รายละเอียดเหตุการณ์' },
    ],
  },
  archive_media: {
    key: 'id',
    fields: [{ th: 'caption', en: 'caption_en', kind: 'prose', hint: 'คำบรรยายภาพ' }],
  },
  songs: {
    key: 'id',
    fields: [
      { th: 'name_th', en: 'name_en',    kind: 'songname', hint: 'ชื่อเพลง' },
      { th: 'history', en: 'history_en', kind: 'prose',    hint: 'ประวัติเพลง' },
      { th: 'lyrics',  en: 'lyrics_en',  kind: 'verse',    hint: 'บทร้อง' },
    ],
  },
};

const KIND_RULE = {
  songname: 'ถอดเสียงเป็นอักษรโรมันตามระบบราชบัณฑิตยสภา ห้ามแปลความหมาย ' +
            'คำบอกอัตราจังหวะท้ายชื่อให้ถอดเสียงด้วย (กราวนอก → Krao Nok · เขมรไทรโยค สองชั้น → Khamen Sai Yok Song Chan)',
  name:     'ชื่อคนและคณะให้ถอดเสียง ไม่แปลความหมาย · ยศและบรรดาศักดิ์ถอดเสียงแล้ววงเล็บอธิบายสั้น ๆ ได้',
  place:    'ชื่อสถานที่ให้ใช้ชื่ออังกฤษที่ใช้กันจริงถ้ามี (กรุงเทพฯ → Bangkok) ถ้าไม่มีให้ถอดเสียง',
  date:     'ปี พ.ศ. ให้เขียนเป็น BE แล้ววงเล็บปี ค.ศ. ต่อท้าย (พ.ศ. 2444 → BE 2444 (1901))',
  title:    'หัวเรื่อง แปลให้กระชับ เป็นวลี ไม่ต้องเป็นประโยคเต็ม ไม่ต้องมีจุดท้าย',
  prose:    'ร้อยแก้ว แปลให้เป็นภาษาอังกฤษเชิงวิชาการที่อ่านลื่น รักษาความหมายให้ครบ ไม่ตัด ไม่เติมความเห็น',
  verse:    'บทร้อง แปลตามความหมาย ขึ้นบรรทัดใหม่ตรงที่ต้นฉบับขึ้นบรรทัดใหม่',
};

export const SYSTEM_PROMPT =
`You translate Thai classical-music archive content into English for a public reference website.

RULES
1. Return ONLY a JSON object mapping each given id to its English string. No prose, no code fence.
2. Translate every id you are given. If a value is untranslatable, return the Thai unchanged.
3. Never add facts, opinions, footnotes or "translator's note". Never drop information.
4. Keep the register of the source: an archive entry stays factual and neutral.
5. Use the glossary below for Thai music terms. Romanise with the Royal Thai General System.
6. Keep numerals, years and proper names accurate. Do not convert Buddhist-era years except where told.

GLOSSARY
${glossaryText()}`;

// รวมงานหลายแถวหลายช่องเป็นคำสั่งเดียว — ประหยัดกว่าเรียกทีละช่องมาก
export function buildBatch(rows) {
  const items = [];
  for (const r of rows) {
    const job = JOBS[r.src];
    if (!job) continue;
    for (const f of job.fields) {
      const v = r.row[f.th];
      if (typeof v !== 'string' || v.trim() === '') continue;
      if (!/[฀-๿]/.test(v)) continue;          // ไม่มีอักษรไทย = ไม่ต้องแปล
      items.push({ id: `${r.src}:${r.row[job.key]}:${f.th}`, kind: f.kind, hint: f.hint, text: v });
    }
  }
  return items;
}

export function buildUserMessage(items) {
  const byKind = {};
  items.forEach(it => { (byKind[it.kind] ??= []).push(it); });
  const parts = Object.entries(byKind).map(([kind, list]) =>
    `## ${kind} — ${KIND_RULE[kind] ?? ''}\n` +
    list.map(it => `${it.id}\t${JSON.stringify(it.text)}`).join('\n'));
  return `Translate each line into English.\nEach line is: <id> TAB <thai text as a JSON string>.\n` +
    `Answer with a single JSON object: {"<id>": "<english>", …}\n\n` + parts.join('\n\n');
}

// อ่านคำตอบแบบเผื่อเหนียว — บางทีโมเดลห่อด้วย ```json
export function parseAnswer(text) {
  let s = String(text ?? '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('คำตอบไม่ใช่ JSON: ' + s.slice(0, 160));
  return JSON.parse(s.slice(a, b + 1));
}

// เอาคำตอบมาประกอบเป็น "แถวที่จะเขียนกลับ" ทีละตาราง
export function applyAnswer(rows, items, answer) {
  const want = new Map(items.map(it => [it.id, it]));
  const out = [];
  for (const r of rows) {
    const job = JOBS[r.src];
    if (!job) continue;
    const patch = {};
    let missing = 0, filled = 0;
    for (const f of job.fields) {
      const id = `${r.src}:${r.row[job.key]}:${f.th}`;
      if (!want.has(id)) { patch[f.en] = null; continue; }   // ต้นฉบับว่าง → คำแปลต้องว่างด้วย
      const v = answer[id];
      if (typeof v === 'string' && v.trim() !== '') { patch[f.en] = v.trim(); filled++; }
      else missing++;
    }
    // แปลไม่ครบ = ไม่ประทับลายนิ้วมือ รอบหน้าจะหยิบมาแปลใหม่ ไม่ปล่อยให้ค้างครึ่ง ๆ
    if (missing === 0) { patch.tr_hash = r.row.tr_src; patch.tr_at = new Date().toISOString(); patch.tr_err = null; }
    else patch.tr_err = `แปลไม่ครบ ${missing} ช่อง`;
    out.push({ src: r.src, key: r.row[job.key], patch, filled, missing });
  }
  return out;
}
