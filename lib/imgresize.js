// lib/imgresize.js — ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด
// เหตุผล: รูปจากกล้อง (DSC_xxxx.jpg) ใหญ่ 3–10 MB ทำให้ภาพแชร์ Facebook สร้างไม่ทัน
//         และหน้าจดหมายเหตุโหลดช้า · ย่อแล้วคุณภาพยังพอสำหรับเว็บและภาพแชร์
export async function shrinkImage(file, maxPx = 2000, quality = 0.85) {
  if (!file || !/^image\//.test(file.type)) return file;
  if (file.type === 'image/gif') return file;                    // gif เคลื่อนไหว อย่าแตะ
  if (file.size <= 900 * 1024) return file;                      // เล็กอยู่แล้ว ไม่ต้องย่อ
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;             // ย่อแล้วไม่เล็กลง ใช้ของเดิม
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;                                                  // เบราว์เซอร์เก่า / HEIC → ใช้ไฟล์เดิม
  }
}
