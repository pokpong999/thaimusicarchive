'use client';
import { useState } from 'react';

export default function ShareBar({ title }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const enc = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title ?? 'หอจดหมายเหตุดนตรีไทย');

  function open(link) { window.open(link, '_blank', 'width=600,height=500'); }
  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  async function nativeShare() {
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
