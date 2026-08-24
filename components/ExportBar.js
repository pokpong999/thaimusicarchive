'use client';
import { useState } from 'react';

function loadScript(src, check) {
  return new Promise((resolve) => {
    if (check()) { resolve(); return; }
    const js = document.createElement('script');
    js.src = src;
    js.onload = () => resolve();
    document.head.appendChild(js);
  });
}

const CDN = {
  xlsx: ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => window.XLSX],
  html2canvas: ['https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', () => window.html2canvas],
  jspdf: ['https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', () => window.jspdf],
  docx: ['https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js', () => window.docx],
};

function dl(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ExportBar({ song, instrument, verses, targetId }) {
  const [busy, setBusy] = useState('');
  const base = `${song.id}_${song.name_th}_${instrument}`.replace(/\s+/g, '_');

  async function exportExcel() {
    setBusy('excel');
    await loadScript(...CDN.xlsx);
    const rows = [['วรรค', 'ท่อน', 'ห้อง 1', 'ห้อง 2', 'ห้อง 3', 'ห้อง 4', 'ลูกตก']];
    verses.forEach(v => {
      const hongs = (v.combined ?? '').split('|').map(h => h.trim());
      rows.push([v.verse_no, v.section ?? '', hongs[0] ?? '', hongs[1] ?? '', hongs[2] ?? '', hongs[3] ?? '', v.luktok ?? '']);
    });
    const ws = window.XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:6},{wch:10},{wch:16},{wch:16},{wch:16},{wch:16},{wch:8}];
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'โน้ต');
    window.XLSX.writeFile(wb, base + '.xlsx');
    setBusy('');
  }

  async function captureCanvas() {
    await loadScript(...CDN.html2canvas);
    const el = document.getElementById(targetId);
    return window.html2canvas(el, { backgroundColor: '#1E3050', scale: 2 });
  }

  async function exportJpg() {
    setBusy('jpg');
    const canvas = await captureCanvas();
    canvas.toBlob(b => { dl(b, base + '.jpg'); setBusy(''); }, 'image/jpeg', 0.92);
  }

  async function exportPdf() {
    setBusy('pdf');
    const canvas = await captureCanvas();
    await loadScript(...CDN.jspdf);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageW = 210, margin = 10;
    const imgW = pageW - margin * 2;
    const imgH = canvas.height * imgW / canvas.width;
    const pageH = 297 - margin * 2;
    // แบ่งภาพเป็นหลายหน้า
    let y = 0;
    const sliceH = pageH * canvas.width / imgW;
    let page = 0;
    while (y < canvas.height) {
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.min(sliceH, canvas.height - y);
      slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin, imgW, slice.height * imgW / canvas.width);
      y += sliceH; page++;
    }
    pdf.save(base + '.pdf');
    setBusy('');
  }

  async function exportDocx() {
    setBusy('docx');
    await loadScript(...CDN.docx);
    const D = window.docx;
    const rows = [
      new D.TableRow({ children: ['วรรค','ห้อง 1','ห้อง 2','ห้อง 3','ห้อง 4','ลูกตก'].map(h =>
        new D.TableCell({ children: [new D.Paragraph({ children: [new D.TextRun({ text: h, bold: true })] })] })
      )}),
      ...verses.map(v => {
        const hongs = (v.combined ?? '').split('|').map(h => h.trim());
        return new D.TableRow({ children: [String(v.verse_no), hongs[0]??'', hongs[1]??'', hongs[2]??'', hongs[3]??'', v.luktok??''].map(c =>
          new D.TableCell({ children: [new D.Paragraph(c)] })
        )});
      }),
    ];
    const doc = new D.Document({ sections: [{ children: [
      new D.Paragraph({ children: [new D.TextRun({ text: `${song.name_th} (${song.id})`, bold: true, size: 32 })] }),
      new D.Paragraph({ children: [new D.TextRun({ text: `ทาง: ${instrument} · หอจดหมายเหตุดนตรีไทย thaimusicarchive.com`, size: 20 })] }),
      new D.Paragraph(''),
      new D.Table({ rows, width: { size: 100, type: D.WidthType.PERCENTAGE } }),
    ]}]});
    const blob = await D.Packer.toBlob(doc);
    dl(blob, base + '.docx');
    setBusy('');
  }

  const B = ({ id, label, fn }) => (
    <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={fn}>
      {busy === id ? '⏳...' : label}
    </button>
  );

  return (
    <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
      <span style={{fontSize:'0.72rem',color:'var(--muted)'}}>ดาวน์โหลด:</span>
      <a href={`/songs/${song?.id}/print`} className="btn btn-sm"
        style={{background:'var(--gold)',color:'var(--navy)',fontWeight:600,fontSize:'0.72rem'}}>
        🖨 ฉบับพิมพ์ / PDF สวย</a>
      <B id="docx" label="📄 DOCX" fn={exportDocx} />
      <B id="pdf" label="📕 PDF" fn={exportPdf} />
      <B id="jpg" label="🖼 JPG" fn={exportJpg} />
      <B id="excel" label="📊 Excel" fn={exportExcel} />
    </div>
  );
}
