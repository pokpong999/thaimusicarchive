'use client';
import { useState } from 'react';
import { countShare } from '../lib/stats';

// ── รุ่นของภาพแชร์ ───────────────────────────────────────────────
// Facebook/LINE เก็บภาพแชร์ของแต่ละลิงก์ไว้ในแคช ถ้าลิงก์เดิมเคยถูกแชร์
// ตอนที่ภาพยังไม่มีรูป มันจะใช้ของเก่าตลอดจนกว่าจะไปกด Scrape Again เอง
// การพ่วง ?v= ทำให้เป็น "ลิงก์ใหม่" ในสายตาโซเชียล → ดึงภาพแชร์สดทุกครั้ง
// ⚠️ ถ้าแก้หน้าตาภาพแชร์อีกในอนาคต ให้บวกเลขนี้ขึ้น 1 แล้วจบ ไม่ต้องแตะ Facebook
const SHARE_V = '2';

function shareUrl() {
  if (typeof window === 'undefined') return '';
  try {
    const u = new URL(window.location.href);
    u.hash = '';
    u.searchParams.set('v', SHARE_V);
    return u.toString();
  } catch {
    return window.location.href;
  }
}

export default function ShareBar({ title, statType, statId }) {
  const [copied, setCopied] = useState(false);
  const url = shareUrl();
  const enc = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title ?? 'หอจดหมายเหตุดนตรีไทย');

  function bump() { if (statType && statId) countShare(statType, statId); }
  function open(link) { bump(); window.open(link, '_blank', 'width=600,height=500'); }
  async function copy() {
    bump();
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  async function nativeShare() {
    bump();
    if (navigator.share) {
      try { await navigator.share({ title: title, url }); } catch {}
    } else copy();
  }

  const B = ({ label, onClick }) => (
    <button className="btn btn-outline btn-sm" onClick={onClick} style={{fontSize:'0.72rem'}}>{label}</button>
  );

  return (
    <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
      <span style={{fontSize:'0.72rem',color:'var(--muted)'}}>แชร์:</span>
      <B label="📘 Facebook" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${enc}`)} />
      <B label="💬 LINE" onClick={() => open(`https://social-plugins.line.me/lineit/share?url=${enc}`)} />
      <B label="✉️ Messenger" onClick={() => open(`https://www.facebook.com/dialog/send?link=${enc}&redirect_uri=${enc}&app_id=291494419107518`)} />
      <B label="🐦 X" onClick={() => open(`https://twitter.com/intent/tweet?url=${enc}&text=${encTitle}`)} />
      <B label={copied ? '✓ คัดลอกแล้ว' : '🔗 คัดลอกลิงก์'} onClick={copy} />
      <B label="📱 อื่น ๆ (TikTok ฯลฯ)" onClick={nativeShare} />
    </div>
  );
}
