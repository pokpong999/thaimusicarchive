// lib/uiwords.js — บัญชีคำแปลหน้าเว็บ ไทย → อังกฤษ  (Pk 28 ส.ค. 69)
//
//   คีย์ = ข้อความไทย "ทั้งก้อน" ที่ปรากฏบนหน้าเว็บจริง (ตัวเลขแทนด้วย {n})
//   ค่า  = คำอังกฤษ
//
//   ★ เติมคำใหม่ได้เรื่อย ๆ ที่ไฟล์นี้ไฟล์เดียว ไม่ต้องแตะหน้าอื่น
//   ★ คำที่ยังไม่มีในบัญชี = คงภาษาไทยไว้ ไม่พัง ไม่ขึ้นรหัส
//   ★ ห้ามใส่ชื่อเพลง ชื่อครู หรือเนื้อหาที่สมาชิกเขียน — นั่นคนละระบบ (แปลในฐานข้อมูล)
//
//   ศัพท์เฉพาะที่ตกลงไว้:
//     ศักดินา = sakdina (หน่วยแต้มของเว็บ ไม่แปลเป็น points เพราะเป็นชื่อเฉพาะ)
//     วรรค = verse · ท่อน = part · ห้อง = bar · ลูกตก = final note · กระสวน = pattern
//     ทาง = version/arrangement · หน้าทับ = drum pattern · จดหมายเหตุ = archive record
export const EN = {
  // ── โครงเว็บ · ท้ายหน้า ──
  'หอจดหมายเหตุดนตรีไทย': 'Thai Music Archive',
  'หอจดหมายเหตุดนตรีไทย · Thai Music Archive': 'Thai Music Archive',
  'หอจดหมายเหตุดนตรีไทย · Thai Music Archive (THMA)': 'Thai Music Archive (THMA)',
  'หอจดหมายเหตุดนตรีไทย — Thai Music Archive': 'Thai Music Archive',
  'ดนตรีไทย': 'Thai music',
  'ฐานข้อมูลเพลงไทย โน้ตเล่นเสียงได้จริง': 'Thai song database with playable notation',
  'ฐานข้อมูลเพลงไทย โน้ตเล่นเสียงได้จริง และหอจดหมายเหตุเหตุการณ์ดนตรีไทยบนแผนที่':
    'A database of Thai songs with playable notation, and an archive of Thai music history on the map',
  'ฐานข้อมูลเพลงไทย {n} เพลง โน้ตเล่นเสียงจริงระบบ {n} เสียงไทย หน้าทับกลอง-ฉิ่ง บันทึกเหตุการณ์ดนตรีไทยบนแผนที่ อดีต ปัจจุบัน อนาคต':
    '{n} Thai songs with playable notation in the {n}-tone Thai system, drum and ching patterns, and Thai music events mapped across past, present and future',
  'ข้อมูลและลิขสิทธิ์ © ปกป้อง ขำประเสริฐ (Pokpong Khamprasert) — ผลงานที่สมาชิกเพิ่มแสดงเครดิตผู้เพิ่มกำกับไว้':
    'Data and copyright © Pokpong Khamprasert — contributions by members are credited to their contributors',
  'ติดต่อผู้ดูแล: ✉️': 'Contact the team: ✉️',

  // ── ป้ายเป้าหมายหน้าแรก ──
  'เข้ามาแล้วทำอะไรก่อน?': 'Where do I start?',
  'ฟรี': 'free',
  'คุณ': 'you',
  'ซ่อนป้ายนี้': 'Hide this banner',
  '✦ สมัครสมาชิก เริ่มสะสมศักดินา': '✦ Register and start earning sakdina',
  'ดูเหตุการณ์ที่สมาชิกบันทึกไว้ →': 'See what members have recorded →',
  '🏆 อันดับผู้ร่วมสร้าง': '🏆 Contributor ranking',
  'ปลดล็อกแอปบันทึกโน้ตแล้ว': 'Notation app unlocked',
  '✎ บันทึกโน้ตเพลง': '✎ Write notation',
  '📜 บันทึกเหตุการณ์': '📜 Record an event',
  '📜 บันทึกเหตุการณ์ (+{n})': '📜 Record an event (+{n})',
  'แดชบอร์ดของฉัน': 'My dashboard',
  'บันทึกเหตุการณ์ดนตรีไทย': 'Record a Thai music event',
  'ใคร ทำอะไร เมื่อไหร่ ที่ไหน · แนบรูป + ปักหมุด = {n} ศักดินา/บันทึก':
    'Who, what, when, where · with a photo and a map pin = {n} sakdina per record',
  'ปลดล็อกแอปบันทึกโน้ตเพลงไทย ฟรี': 'Unlock the Thai notation app, free',
  'พิมพ์โน้ต ฟังเสียงฆ้องจริง หน้าทับกลอง ส่งออก Music Sheet':
    'Type notation, hear real gong samples, add drum patterns, export a music sheet',
  'อีก': 'Need',
  'ศักดินา ≈': 'sakdina ≈',
  'ศักดินา': 'sakdina',
  'ศักดินาของคุณ': 'Your sakdina',

  // ── ตัววิ่ง · สุ่มเหตุการณ์ · ครบรอบ ──
  'นักจดหมายเหตุดนตรีไทยดีเด่น': 'Outstanding music archivists',
  'สมาชิก': 'Member',
  'สุ่มเหตุการณ์ดนตรีไทย': 'Random Thai music events',
  'หยิบมาจากหอจดหมายเหตุแบบสุ่ม · เข้าหน้านี้ใหม่ก็ได้เรื่องใหม่':
    'Picked at random from the archive · reload for a different set',
  '🎲 สุ่มใหม่': '🎲 Shuffle',
  'อ่านต่อ →': 'Read more →',
  'ดุริยกาล': 'On this day in Thai music',

  // ── ประตูสิทธิ์ ──
  'กำลังโหลด...': 'Loading…',
  'กำลังโหลด…': 'Loading…',
  'กำลังตรวจสอบสิทธิ์...': 'Checking your access…',
  'ส่วนนี้อยู่ระหว่างปรับปรุง': 'This section is being worked on',
  'เรากำลังเตรียมเนื้อหาส่วนนี้ให้สมบูรณ์ที่สุด': 'We are still preparing this part of the site',
  'จะเปิดให้บริการเร็วๆ นี้': 'It will open soon',
  '← กลับหน้าแรก': '← Back to home',
  '← หน้าแรก': '← Home',
  '← กลับรายการ': '← Back to the list',
  '← กลับรายการเพลง': '← Back to the song list',
  '← กลับหอจดหมายเหตุ': '← Back to the archive',
  'ร่วมอุปถัมภ์หอจดหมายเหตุดนตรีไทย เพื่อปลดล็อกการพิมพ์และดาวน์โหลดโน้ต':
    'Become a patron of the Thai Music Archive to unlock printing and downloading notation',
  'และช่วยให้โครงการอนุรักษ์นี้เดินหน้าต่อได้': 'and help keep this preservation project going',
  'ดูรายละเอียดสมาชิกอุปถัมภ์': 'See patron membership details',
  'ส่วนนี้ยังไม่เปิดสำหรับบัญชีของคุณ': 'This section is not open to your account yet',
  '💎 สมาชิกอุปถัมภ์': '💎 Patron members',
  'ฟีเจอร์นี้': 'This feature',
  'ลองเข้าสู่ระบบ หรือส่วนนี้อาจอยู่ระหว่างปรับปรุง':
    'Try signing in — or this section may still be under construction',
  'ส่วนนี้อาจอยู่ระหว่างปรับปรุง หรือเปิดเฉพาะสมาชิกอุปถัมภ์':
    'This section may be under construction, or open to patron members only',
  'เข้าสู่ระบบก่อน แล้วสะสมศักดินาจากการร่วมบันทึกจดหมายเหตุ':
    'Sign in first, then earn sakdina by contributing to the archive',
  'เข้าสู่ระบบ / สมัครฟรี': 'Sign in / register free',
  'ช่วงเปิดตัว ระบบบันทึกโน้ตเป็นสิทธิ์ของสมาชิกที่ร่วมสร้างคลังจดหมายเหตุมาก่อน':
    'During launch, the notation system is reserved for members who have contributed to the archive',
  'วิธีได้ศักดินา': 'How to earn sakdina',
  'วิธีได้ศักดินา:': 'How to earn sakdina:',
  '📜 บันทึกเหตุการณ์จดหมายเหตุ': '📜 Record an archive event',
  'ผลงานของฉัน': 'My Contributions',
  'ทำเนียบสมาชิก': 'Contributors',
  'บันทึกเหตุการณ์จดหมายเหตุ ได้รับอนุมัติ': 'Archive record approved',
  'บันทึกที่มีทั้งรูปและปักหมุดแผนที่ (โบนัส)': 'Record with both a photo and a map pin (bonus)',
  'วิดีโอเพลง ได้รับอนุมัติ': 'Song video approved',

  // ── ความคิดเห็น ──
  'บัญชีของคุณยังไม่ได้รับสิทธิ์แสดงความคิดเห็นในหน้านี้':
    'Your account cannot comment on this page yet',
  'เข้าสู่ระบบ': 'Sign in',
  'เพื่อร่วมแสดงความคิดเห็น': 'to join the discussion',
  '⚠ โหลดความคิดเห็นไม่สำเร็จ': '⚠ Could not load comments',
  'ยังไม่มีความคิดเห็น — เป็นคนแรกได้เลย': 'No comments yet — be the first',
  '⚠ เข้าสู่ระบบก่อนจึงจะแสดงความคิดเห็นได้': '⚠ Sign in before commenting',
  '⚠ พิมพ์ข้อความหรือแนบรูป': '⚠ Type something or attach a photo',
  '⏳ กำลังย่อรูป...': '⏳ Resizing photo…',
  '⚠ รูปใหญ่เกินไป ลองรูปอื่น': '⚠ That photo is too large — try another',
  '⏳ กำลังอัปโหลดรูป...': '⏳ Uploading photo…',
  '⚠ อัปโหลดรูปไม่สำเร็จ:': '⚠ Photo upload failed:',
  '⏳ กำลังส่ง...': '⏳ Sending…',
  '⚠ ส่งไม่สำเร็จ:': '⚠ Could not send:',
  'ลบความคิดเห็นนี้?': 'Delete this comment?',
  '⚠ ลบไม่สำเร็จ:': '⚠ Delete failed:',
  'ลบไม่สำเร็จ:': 'Delete failed:',
  '⚠ ลบไม่สำเร็จ — ไม่มีสิทธิ์ลบความคิดเห็นนี้': '⚠ Delete failed — you cannot delete this comment',
  'แสดงความคิดเห็น แบ่งปันความรู้ ความทรงจำ...': 'Comment — share what you know or remember…',
  'ส่งความคิดเห็น': 'Post comment',
  'วัน-เวลาที่โพสต์': 'Posted on',
  'ลบ': 'Delete',
  '🗑 ลบ': '🗑 Delete',
  'ลบ (แอดมิน)': 'Delete (staff)',

  // ── แชร์ · สถิติ · แจ้งเตือน ──
  'แชร์:': 'Share:',
  '✓ คัดลอกแล้ว': '✓ Copied',
  '🔗 คัดลอกลิงก์': '🔗 Copy link',
  '📱 อื่น ๆ (TikTok ฯลฯ)': '📱 More (TikTok etc.)',
  'ยอดเข้าชม': 'Views',
  'ยอดแชร์': 'Shares',
  '🔔 การแจ้งเตือน': '🔔 Notifications',
  'การแจ้งเตือน': 'Notifications',
  'ล้างที่อ่านแล้ว': 'Clear read',
  'ยังไม่มีการแจ้งเตือน': 'No notifications yet',
  'เมื่อครู่': 'just now',

  // ── ส่งออก · พิมพ์ ──
  '🖨 พิมพ์/ดาวน์โหลดโน้ต:': '🖨 Print / download notation:',
  '💎 สำหรับสมาชิกอุปถัมภ์ — ดูรายละเอียด': '💎 Patron members only — details',
  'ดาวน์โหลด:': 'Download:',
  '💎 ดาวน์โหลดไฟล์สำหรับสมาชิกอุปถัมภ์': '💎 File downloads are for patron members',
  '🖨 ส่งออก Music Sheet (PDF · PNG · DOCX · Excel)': '🖨 Export music sheet (PDF · PNG · DOCX · Excel)',
  'ฉบับพิมพ์ในเบราว์เซอร์': 'Print view in the browser',
  'วรรค': 'Verses',
  'ท่อน': 'Part',
  'ห้อง {n}': 'Bar {n}',
  'ลูกตก': 'Final note',
  'โน้ต': 'Notation',
  'กระสวน': 'Pattern',
  'กระสวนไม่ซ้ำ': 'Unique patterns',
  'รหัส': 'Code',

  // ── ฉบับร่าง ──
  '📝 ฉบับร่าง': '📝 Draft',
  '💾 บันทึกร่าง': '💾 Save draft',
  '🗑 ทิ้งร่างนี้': '🗑 Discard this draft',
  'ร่างทั้งหมดของฉัน ↗': 'All my drafts ↗',
  'เพลง': 'Song',
  'เหตุการณ์': 'Event',
  '⚠ เก็บร่างไม่สำเร็จ:': '⚠ Could not save the draft:',
  '⏳ กำลังเก็บร่าง…': '⏳ Saving draft…',
  'พิมพ์ได้เลย ระบบเก็บร่างให้อัตโนมัติ ปิดหน้าไปแล้วกลับมาแก้ต่อได้':
    'Just start typing — drafts save automatically, so you can close the page and come back',
  '· แก้ล่าสุด': '· last edited',
  '(ยังไม่ตั้งชื่อ)': '(untitled)',

  // ── หมุดแผนที่ ──
  '⚠ ยังไม่พบปี พ.ศ. —': '⚠ No Buddhist-era year found —',
  'หมุดบนแผนที่จะเป็นสีเทา': 'the map pin will be grey',
  '(ไม่ระบุเวลา)': '(no date)',
  'ใส่ปี พ.ศ. {n} หลักในช่อง "เมื่อไหร่" (เช่น พ.ศ. {n} · ราว {n}) หรือเลือกวันที่ แล้วหมุดจะได้สีตามช่วงเวลาทันที':
    'Put a {n}-digit Buddhist-era year in the "When" field (e.g. BE {n} · c. {n}) or pick a date, and the pin takes the colour of its era',
  'หมุดบนแผนที่:': 'Map pin:',
  'เมื่อไหร่': 'When',

  // ── แฟ้มผลงาน ──
  'บันทึกส่วนตัว': 'Private notes',
  'หอจดหมายเหตุดนตรีไทย · thaimusicarchive.com': 'Thai Music Archive · thaimusicarchive.com',
  'แฟ้มผลงาน · PORTFOLIO': 'PORTFOLIO',
  'รวบรวมจาก หอจดหมายเหตุดนตรีไทย · thaimusicarchive.com':
    'Compiled from the Thai Music Archive · thaimusicarchive.com',
  'Portfolio · แฟ้มผลงาน': 'Portfolio',
  'คำนำ': 'Foreword',
  'ยังไม่ได้เลือกรายการใส่เล่ม': 'Nothing selected for the book yet',

  // ── หน้าเพลง ──
  'ประวัติเพลง': 'Song history',
  '✏️ แก้ไข': '✏️ Edit',
  '✏️ แก้ไขข้อมูล': '✏️ Edit details',
  'เนื้อร้อง (แสดงในโหมดโน้ตขับร้อง)': 'Lyrics (shown in vocal notation mode)',
  '✓ บันทึก': '✓ Save',
  '✓ บันทึกแล้ว': '✓ Saved',
  'ยกเลิก': 'Cancel',
  'ยังไม่มีประวัติเพลงนี้': 'No history for this song yet',
  '✒️ บทร้อง': '✒️ Lyrics',
  'ทาง / เครื่องดนตรี:': 'Version / instrument:',
  '✎ แก้โน้ตทางนี้': '✎ Edit this version',
  '＋ เสนอทางเครื่องอื่น': '＋ Add another instrument version',
  '📁 โน้ตต้นฉบับ (PDF)': '📁 Source manuscript (PDF)',
  'ไฟล์ PDF (ไม่เกิน {n}MB)': 'PDF file (max {n} MB)',
  'คำอธิบาย (เช่น สำนัก/ที่มา/ปี)': 'Description (school / source / year)',
  'คำอธิบาย (ถ้ามี)': 'Description (optional)',
  '✓ อัปโหลด — รอ Admin อนุมัติ': '✓ Upload — pending staff approval',
  'ยังไม่มีไฟล์ต้นฉบับ': 'No source files yet',
  'ยังไม่มีข้อมูลวิเคราะห์สำหรับเพลงนี้': 'No analysis for this song yet',
  'ยังไม่มีบันทึกเสียงของเพลงนี้ — ร่วมเป็นผู้อนุรักษ์ อัปโหลดเสียงบรรเลงด้านล่าง':
    'No recordings of this song yet — help preserve it by uploading one below',
  '🎙 อัปโหลดบันทึกเสียง (MP{n}/M{n}A ≤{n}MB)': '🎙 Upload a recording (MP{n}/M{n}A ≤ {n} MB)',
  '— สิทธิ์เผยแพร่ (ไม่บังคับ) —': '— Publishing rights (optional) —',
  'บันทึกเอง เผยแพร่ได้': 'My own recording, free to publish',
  'ได้รับอนุญาตจากเจ้าของ': 'Permission from the rights holder',
  'เผยแพร่เพื่อการศึกษาเท่านั้น': 'Educational use only',
  'เผยแพร่เพื่อการศึกษา': 'Educational use',
  'สาธารณสมบัติ (หมดอายุลิขสิทธิ์)': 'Public domain (copyright expired)',
  'สาธารณสมบัติ': 'Public domain',
  '⚠ อัปโหลดเฉพาะเสียงที่คุณมีสิทธิ์เผยแพร่ (บันทึกเอง หรือได้รับอนุญาตจากเจ้าของ)':
    '⚠ Only upload audio you have the right to publish (your own recording, or with the owner\'s permission)',
  '✓ ส่งไฟล์เสียง': '✓ Submit audio',
  'ส่งเพื่อรอ Admin อนุมัติ': 'Submitted for staff approval',
  'ยังไม่มีวิดีโอสำหรับเพลงนี้': 'No videos for this song yet',
  'เข้าสู่ระบบเพื่อเพิ่มวิดีโอ': 'Sign in to add a video',
  'ทำนองหลัก': 'Main melody',
  'อ่านโน้ตไม่ได้:': 'Could not read the notation:',
  '— ยังไม่ได้รัน sql/{n}-{n} หรือ Supabase ยังไม่รีเฟรชคอลัมน์ใหม่':
    '— sql/{n}-{n} has not been run, or Supabase has not refreshed the new columns',
  'ยังไม่ได้รัน sql/{n} — ระบบเพลงย่อยยังไม่พร้อม':
    'sql/{n} has not been run — the part-song system is not ready',
  'โน้ตชุดนี้ยังไม่ได้อนุมัติ — แสดงให้ดูไว้ก่อน กดอนุมัติที่หน้าผู้ดูแลเพื่อให้ทุกคนเห็น':
    'This notation is not approved yet — shown here for review. Approve it in the admin page so everyone can see it',
  '⚠ เลือกไฟล์ PDF ก่อน': '⚠ Choose a PDF file first',
  '⚠ ไฟล์ใหญ่เกิน {n}MB': '⚠ File is larger than {n} MB',
  'กำลังอัปโหลด...': 'Uploading…',
  '⏳ กำลังอัปโหลด...': '⏳ Uploading…',
  '⏳ กำลังบันทึก...': '⏳ Saving…',
  '✓ อัปโหลดแล้ว — รอ Admin อนุมัติ (+{n} ศักดินาเมื่อผ่าน)':
    '✓ Uploaded — pending staff approval (+{n} sakdina once approved)',
  '⚠ URL ไม่ถูกต้อง': '⚠ That URL is not valid',
  '✓ ส่งวิดีโอแล้ว — รอ Admin อนุมัติ': '✓ Video submitted — pending staff approval',
  '⚠ เลือกไฟล์เสียงก่อน': '⚠ Choose an audio file first',
  '✓ ส่งแล้ว รอ Admin ตรวจสอบ (+{n} ศักดินาเมื่อผ่าน)':
    '✓ Submitted for staff review (+{n} sakdina once approved)',
  '♪ โน้ตเพลง': '♪ Notation',
  '📜 ประวัติเพลง': '📜 History',
  '📊 วิเคราะห์': '📊 Analysis',
  '— หอจดหมายเหตุดนตรีไทย': '— Thai Music Archive',
  '📚 คัดลอกการอ้างอิง': '📚 Copy citation',
  'ประวัติความเป็นมา ผู้ประพันธ์ ยุคสมัย การใช้งาน...':
    'Origins, composer, period, how it is used…',
  '＋ แนบ PDF ต้นฉบับ': '＋ Attach a source PDF',
  'เช่น โน้ตลายมือครูสำนักบ้านบาตร พ.ศ. {n}':
    'e.g. handwritten notation from the Ban Bat school, BE {n}',
  'ชื่อชุด/รายการ': 'Album / track title',
  'ผู้บรรเลง/วง': 'Performer / ensemble',
  'ปีที่บันทึก': 'Year recorded',
  '+ เพิ่มวิดีโอ': '+ Add a video',
  'ส่งโดย': 'Submitted by',
  'ลบวิดีโอนี้?': 'Delete this video?',

  // ── หอจดหมายเหตุ ──
  '(ไม่ระบุปี)': '(year unknown)',
  'ไม่ระบุปี': 'Year unknown',
  'ไม่ระบุชื่อ': 'Unnamed',
  'ดูรายละเอียด →': 'See details →',
  '✚ บันทึกเหตุการณ์': '✚ Record an event',
  'เข้าสู่ระบบเพื่อบันทึก': 'Sign in to contribute',
  'ทุกยุค': 'All eras',
  'อดีต': 'Past',
  'ปัจจุบัน': 'Present',
  'อนาคต': 'Future',
  '🗺 แผนที่': '🗺 Map',
  '☰ รายการ': '☰ List',
  'ยังไม่มีบันทึก — เป็นคนแรกที่บันทึกเลย!': 'Nothing recorded yet — be the first!',
  '✍️ โพสต์โดย': '✍️ Posted by',
  'โพสต์โดย': 'Posted by',
  'ค้นหา ใคร / ทำอะไร / ที่ไหน...': 'Search who / what / where…',
  '(แสดงป้าย {n} หมุดแรก ที่เหลือกดหมุดเพื่อดู)':
    '(labels shown for the first {n} pins — click a pin for the rest)',
  'ลบบันทึก': 'Delete record',
  'ไม่พบบันทึกนี้': 'Record not found',
  'ใคร': 'Who',
  'ที่ไหน': 'Where',
  'วันที่': 'Date',
  'บันทึกเมื่อ': 'Recorded on',
  '🗑 ลบเหตุการณ์นี้': '🗑 Delete this event',
  '📍 ตำแหน่งเหตุการณ์': '📍 Location',
  'เปิดใน Google Maps ↗': 'Open in Google Maps ↗',
  'ยังไม่มีคำบรรยายภาพ': 'No caption yet',
  '✎ คำบรรยาย': '✎ Caption',
  'ยังไม่มีภาพประกอบ — กด "＋ เพิ่มรูป" เพื่ออัปโหลด (เลือกหลายรูปพร้อมกันได้)':
    'No photos yet — press "＋ Add photo" to upload (you can pick several at once)',
  '＋ เพิ่มรูป': '＋ Add photo',
  'ใหญ่เกิน {n}MB': 'larger than {n} MB',
  '⚠ อัปโหลดไม่สำเร็จ:': '⚠ Upload failed:',
  '⚠ บันทึกไม่สำเร็จ:': '⚠ Save failed:',
  '✓ เพิ่มรูปแล้ว': '✓ Photo added',
  'ลบเหตุการณ์นี้ถาวร? รูปประกอบทั้งหมดจะถูกลบด้วย':
    'Permanently delete this event? All its photos will be deleted too',
  'คำบรรยายภาพนี้ (ใช้เป็นข้อความแทนภาพสำหรับคนตาบอด และแสดงใต้รูป)':
    'Caption for this photo (used as alt text for screen readers and shown below the image)',
  '✓ บันทึกคำบรรยายแล้ว': '✓ Caption saved',
  'ลบรูปนี้?': 'Delete this photo?',
  '✓ ลบรูปแล้ว': '✓ Photo deleted',
  'วันที่ของเหตุการณ์ (ใช้เรียงลำดับและกำหนดสีหมุด)':
    'Date of the event (used for sorting and pin colour)',
  'วัน-เวลาที่โพสต์เข้าหอจดหมายเหตุ': 'Date and time it was posted to the archive',

  // ── ทำเนียบสมาชิก ──
  'ทำเนียบนักจดหมายเหตุ': 'Archivist leaderboard',
  'อันดับผู้ร่วมสร้างหอจดหมายเหตุดนตรีไทย · สะสมศักดินาจากผลงานที่ได้รับอนุมัติ':
    'Ranking of Thai Music Archive contributors · sakdina is earned from approved contributions',
  'เงื่อนไขการได้ศักดินา': 'How sakdina is earned',
  'ศักดินาเข้าเมื่อผู้ดูแลตรวจแล้ว "อนุมัติ" ผลงานเท่านั้น · ของที่ยังรอตรวจยังไม่นับ':
    'Sakdina is credited only once staff approve a contribution · items awaiting review do not count',
  'ผลงาน': 'Contributions',
  'ลำดับบรรดาศักดิ์': 'Rank ladder',
  'อันดับ': 'Rank',
  'บรรดาศักดิ์': 'Title',
  'ก้าวต่อไป': 'Next step',
  'ผู้ดูแล — เห็นเฉพาะคุณ ไม่นับอันดับ': 'Staff — visible only to you, not ranked',
  'หมายเหตุ:': 'Note:',
  'ผู้ดูแลระบบไม่ลงแข่งขันในทำเนียบนี้ — ทำเนียบนับเฉพาะสมาชิก':
    'Staff do not compete here — the leaderboard counts members only',
  'วิดีโอเพลงได้รับอนุมัติ +{n} · บันทึกจดหมายเหตุได้รับอนุมัติ +{n} · โบนัสบันทึกที่มีทั้งรูปและพิกัด +{n}':
    'Approved song video +{n} · approved archive record +{n} · bonus for a record with both a photo and coordinates +{n}',
  'อนุมัติ': 'Approve',
  'ผู้ดูแลไม่ถูกจัดอันดับ': 'Staff are not ranked',
  '— สูงสุดแล้ว —': '— highest rank —',
  'ผู้ดูแล': 'Staff',

  // ── ผลงานของฉัน ──
  'เข้าสู่ระบบเพื่อดูผลงานของคุณ': 'Sign in to see your contributions',
  'ยังไม่มีรายการ': 'Nothing here yet',
  '✏️ แก้โปรไฟล์': '✏️ Edit profile',
  '📔 ไดอารี่ดนตรี → 📁 แฟ้มผลงาน': '📔 Music diary → 📁 Portfolio',
  'เขียนบันทึกส่วนตัวเก็บไว้ทุกวัน แล้ววันหนึ่งเลือกบันทึกที่ภูมิใจ + เหตุการณ์ที่โพสต์ มาทำเป็นเล่มสวย ๆ พิมพ์เป็น PDF ได้':
    'Keep a private journal day by day, then one day pick the entries you are proud of, along with the events you posted, and turn them into a printable PDF book',
  '📔 เขียนไดอารี่': '📔 Write in the diary',
  '📁 แฟ้มผลงาน': '📁 Portfolio',
  'ยังไม่ได้ส่ง — เห็นคนเดียว ไม่นับศักดินา': 'Not submitted — visible only to you, earns no sakdina',
  '＋ ร่างเพลงใหม่': '＋ New song draft',
  '＋ ร่างเหตุการณ์ใหม่': '＋ New event draft',
  'ยังไม่มีร่างค้างอยู่ — เริ่มเขียนแล้วปิดหน้าไปได้เลย ระบบเก็บร่างให้อัตโนมัติ':
    'No drafts waiting — start writing and you can close the page any time, drafts save themselves',
  '✏️ แก้ต่อ / ส่ง': '✏️ Continue / submit',
  '🗑 ลบร่าง': '🗑 Delete draft',
  'ยังไม่มีความคิดเห็น': 'No comments yet',
  '✓ อนุมัติแล้ว': '✓ Approved',
  '⏳ รอตรวจ': '⏳ Awaiting review',
  'ทิ้งร่างนี้? (ลบแล้วเรียกคืนไม่ได้)': 'Discard this draft? This cannot be undone',
  'ลบรายการนี้? (ลบแล้วหายจากเว็บทันที)': 'Delete this item? It disappears from the site immediately',
  '🎼 เพลง': '🎼 Songs',
  '📜 เหตุการณ์': '📜 Events',
  '📜 บันทึกจดหมายเหตุ': '📜 Archive records',
  '🎬 วิดีโอเพลง': '🎬 Song videos',
  '🎹 ทางเครื่องดนตรี': '🎹 Instrument versions',
  '🎼 เพลงที่เพิ่ม': '🎼 Songs added',
  '📁 ไฟล์ PDF ต้นฉบับ': '📁 Source PDFs',
  '(รูปภาพ)': '(photo)',

  // ── เข้าสู่ระบบ ──
  'ชื่อที่แสดง': 'Display name',
  'ชื่อที่แสดง *': 'Display name *',
  'อีเมล': 'Email',
  'รหัสผ่าน': 'Password',
  'ยืนยันรหัสผ่าน (พิมพ์ซ้ำอีกครั้ง)': 'Confirm password (type it again)',
  'พิมพ์รหัสผ่านเดิมอีกครั้ง': 'Type the same password again',
  'แสดงรหัสผ่าน': 'Show password',
  'ลืมรหัสผ่าน?': 'Forgot your password?',
  'สมัครไม่ผ่าน? แจ้งผู้ดูแลพร้อมข้อความสีเทาด้านบน':
    'Registration failing? Send the grey message above to the site team',
  'ส่งอีเมลยืนยันใหม่': 'Resend the verification email',
  '📧 ส่งอีเมลยืนยันใหม่': '📧 Resend verification email',
  'กำลังเข้าสู่ระบบ...': 'Signing in…',
  '⚠ กรอกชื่อที่แสดงก่อน': '⚠ Enter a display name first',
  '⚠ กรอกอีเมล': '⚠ Enter your email',
  'กำลังสมัคร...': 'Creating your account…',
  '⚠ อีเมลนี้มีบัญชีอยู่แล้ว — กดแท็บ "เข้าสู่ระบบ" ด้านบน':
    '⚠ That email already has an account — use the "Sign in" tab above',
  '✓ สร้างบัญชีแล้ว — ส่งลิงก์ยืนยันไปที่': '✓ Account created — a verification link was sent to',
  'เปิดอีเมลแล้วกดลิงก์ (ดูในเมลขยะด้วย) จะเด้งกลับมาที่เว็บนี้และเข้าใช้งานได้ทันที':
    'Open the email and click the link (check your spam folder) — it brings you straight back here, signed in',
  '⚠ กรอกอีเมลที่ใช้สมัครก่อน': '⚠ Enter the email you registered with first',
  '✓ ส่งอีเมลยืนยันใหม่ไปที่': '✓ A new verification email was sent to',
  'แล้ว — ตรวจกล่องอีเมลและเมลขยะ': '— check your inbox and spam folder',
  '⚠ กรอกอีเมลที่ใช้สมัครก่อน แล้วกดลิงก์นี้อีกครั้ง':
    '⚠ Enter the email you registered with, then click this link again',
  '✓ ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว — กดลิงก์ในอีเมลจะกลับมาที่เว็บนี้ให้ตั้งรหัสใหม่ (ดูในเมลขยะด้วย)':
    '✓ A password-reset link was emailed to you — clicking it brings you back here to set a new one (check your spam folder)',
  'สมัครสมาชิก': 'Register',
  'สมัครสมาชิกใหม่': 'Create an account',
  '✦ สมัครสมาชิก': '✦ Register',
  'เข้าสู่ระบบ / สมัคร': 'Sign in / Register',
  'ชื่อ-นามสกุล': 'Full name',
  'ชื่อ-นามสกุล หรือนามแฝง': 'Full name or pen name',
  '✗ ยังไม่ตรงกัน': '✗ Does not match yet',
  '✓ ตรงกันแล้ว': '✓ Matches',
  '⏳ กำลังดำเนินการ...': '⏳ Working…',

  // ── โปรไฟล์ ──
  'เข้าสู่ระบบเพื่อจัดการโปรไฟล์': 'Sign in to manage your profile',
  'โปรไฟล์ของฉัน': 'My profile',
  'JPG/PNG ไม่เกิน {n}MB': 'JPG/PNG, max {n} MB',
  'แนะนำตัว': 'About you',
  '✓ บันทึกโปรไฟล์': '✓ Save profile',
  'ข้อมูลส่วนตัว (เบอร์โทร/LINE) เห็นเฉพาะ Admin เพื่อการติดต่อ — ไม่แสดงสาธารณะ':
    'Contact details (phone / LINE) are visible to staff only — never shown publicly',
  '✓ เปลี่ยนรูปโปรไฟล์แล้ว': '✓ Profile photo updated',
  '⚠ บัญชีนี้ยังไม่มีสิทธิ์แก้โปรไฟล์ — แจ้งผู้ดูแลให้รัน sql/{n}_contributions.sql':
    '⚠ This account cannot edit its profile yet — ask the site team to run sql/{n}_contributions.sql',
  '⚠ บันทึกไม่สำเร็จ — ไม่พบโปรไฟล์ของคุณ': '⚠ Save failed — your profile was not found',
  '📷 เปลี่ยนรูปโปรไฟล์': '📷 Change profile photo',
  'เบอร์โทร': 'Phone',
  'สำนัก / วง / สถาบัน': 'School / ensemble / institution',
  'เช่น วิทยาลัยนาฏศิลป': 'e.g. College of Dramatic Arts',
  'จังหวัด': 'Province',

  // ── ค้นหา · เส้นเวลา ──
  '🔍 ค้นหาทั้งเว็บ': '🔍 Search the whole site',
  'ชื่อเพลง · ชื่อครูดนตรี · เหตุการณ์ · สถานที่ · สมาชิก...':
    'Song · musician · event · place · member…',
  'ค้นหา': 'Search',
  'เพลง · เหตุการณ์ในหอจดหมายเหตุ · ครูดนตรี · สมาชิก':
    'Songs · archive events · musicians · members',
  'ลองพิมพ์สั้นลง หรือค้นด้วยคำอื่น เช่น ชื่อครู ชื่อสถานที่ หรือ Song ID':
    'Try a shorter word, or search by musician, place, or Song ID',
  'ค้นเฉพาะภาษาไทย — ยังไม่ได้รัน sql/{n} หรือยังไม่มีคำแปลในฐาน':
    'Searching Thai only — sql/{n} has not been run, or there are no translations yet',
  'หน้าค้นหารุ่น': 'Search page build',
  '🕰 เส้นเวลาดนตรีไทย': '🕰 Thai music timeline',
  'เหตุการณ์ในจดหมายเหตุ เรียงตามปี พ.ศ.': 'Archive events ordered by Buddhist-era year',

  // ── บรรดาศักดิ์ (ทับศัพท์ไว้ เพราะเป็นชื่อเฉพาะของระบบ) ──
  'มหาดเล็ก': 'Mahatlek',
  'จางวาง': 'Changwang',
  'ขุน': 'Khun',
  'หลวง': 'Luang',
  'พระ': 'Phra',
  'พระยา': 'Phraya',
  'เจ้าพระยา': 'Chao Phraya',
  'ทาส': 'That',

  // ── ชิ้นข้อความในป้ายเป้าหมาย (React แยกเป็นหลาย node) ──
  '🎯 เป้าหมายของคุณ:': '🎯 Your goal:',
  'ศักดินา → ปลดล็อกแอปบันทึกโน้ตฟรี': 'sakdina → unlock the notation app, free',
  'ตอนนี้': 'now',
  'บันทึก (มีรูป+พิกัด = {n} ศักดินา)': 'records (photo + coordinates = {n} sakdina)',
  'บันทึก': 'records',
  'หน้าแรกรุ่น': 'Home build',
  'หน้าฐานข้อมูลเพลงรุ่น': 'Song database build',
  'เปลี่ยนเป็นภาษาไทย': 'Switch to Thai',
  'จางวาง {n}': 'Changwang {n}',
  'ขุน {n}': 'Khun {n}',
  'หลวง {n}': 'Luang {n}',
  'พระ {n}': 'Phra {n}',
  'พระยา {n}': 'Phraya {n}',
  'เจ้าพระยา {n}': 'Chao Phraya {n}',

  // ── บัญชีประเภทเพลง / ลักษณะการบรรเลง (คำในตาราง song_types) ──
  'เพลงเถา': 'Thao suite',
  'เพลงสามชั้น': 'Sam chan (slow rate)',
  'เพลงสองชั้น': 'Song chan (medium rate)',
  'เพลงชั้นเดียว': 'Chan diao (fast rate)',
  'เพลงหน้าพาทย์': 'Na phat (ceremonial)',
  'เพลงระบำ': 'Dance piece',
  'เพลงโหมโรง': 'Overture',
  'เพลงโหมโรงเสภา': 'Sepha overture',
  'เพลงตระโหมโรง': 'Tra overture',
  'เพลงเรื่อง': 'Suite (phleng rueang)',
  'เพลงตับ': 'Suite (phleng tap)',
  'เพลงจังหวะพิเศษ (ฉิ่งตัด)': 'Special metre (ching tat)',
  'แปรทำนอง': 'Free variation',
  'เพลงแปรทำนอง': 'Free variation',
  'บังคับทาง': 'Fixed version',
  'เพลงบังคับทาง': 'Fixed version',
  'กึ่งบังคับทาง': 'Partly fixed',
  'เพลงกึ่งบังคับทาง': 'Partly fixed',
  'มีทั้งสองแบบ (บังคับทาง + แปรทำนอง)': 'Both (fixed and free)',
  'ทางเครื่องแปรจากทำนองหลักได้อิสระตามสำนวนเครื่องดนตรี':
    'Each instrument varies the main melody freely in its own idiom',
  'ทำนองบังคับ เล่นตามที่วางไว้ แปรเองไม่ได้':
    'A fixed melody, played as written, not varied',
  'บังคับบางช่วง แปรได้บางช่วง': 'Fixed in places, free in others',

  // ── อัตราจังหวะ ──
  'สามชั้น': 'Sam chan',
  'สองชั้น': 'Song chan',
  'ชั้นเดียว': 'Chan diao',
  'ทุกอัตรา': 'All rates',

  // ── เพลงย่อยในเพลงเรื่อง ──
  'โน้ตชุดเดียวกันกับในเรื่อง — แก้ที่นี่หรือที่หน้าเรื่องก็เปลี่ยนทั้งสองที่':
    'The same notation as in the suite — editing here or there changes both',
  'โน้ตชุดเดียวกัน — แก้ที่เพลงย่อยหรือที่นี่ก็เปลี่ยนทั้งสองที่':
    'The same notation — editing the part song or this page changes both',
};
