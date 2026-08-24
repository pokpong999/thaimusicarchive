'use client';
import { useEffect, useState } from 'react';

export default function PWA() {
  const [prompt, setPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone;
    if (standalone) return;
    try { if (localStorage.getItem('pwa-dismissed')) return; } catch {}

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) { setIos(true); setTimeout(() => setShow(true), 4000); return; }

    function onPrompt(e) { e.preventDefault(); setPrompt(e); setShow(true); }
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem('pwa-dismissed', '1'); } catch {}
  }
  async function install() {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null); dismiss();
  }
  if (!show) return null;

  return (
    <div style={{position:'fixed',left:'12px',right:'12px',bottom:'12px',zIndex:9000,
      background:'var(--navy2)',border:'1px solid var(--gold)',borderRadius:'14px',
      padding:'0.9rem 1rem',boxShadow:'0 8px 28px rgba(0,0,0,0.55)',
      display:'flex',gap:'12px',alignItems:'center',maxWidth:'520px',margin:'0 auto'}}>
      <img src="/icon-192.png" alt="" width={44} height={44} style={{borderRadius:'10px',flexShrink:0}} />
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:'0.88rem',color:'var(--cream)'}}>ติดตั้งลงหน้าจอมือถือ</div>
        <div style={{fontSize:'0.74rem',color:'var(--muted)',lineHeight:1.6}}>
          {ios ? 'กดปุ่มแชร์ ⬆️ ด้านล่าง แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"'
               : 'เปิดเร็วขึ้น เต็มจอ และดูโน้ตที่เคยเปิดได้แม้เน็ตหลุด'}
        </div>
      </div>
      {!ios && <button className="btn btn-primary btn-sm" onClick={install}
        style={{whiteSpace:'nowrap'}}>ติดตั้ง</button>}
      <button onClick={dismiss} aria-label="ปิด"
        style={{background:'none',border:'none',color:'var(--muted)',fontSize:'1.1rem',cursor:'pointer'}}>✕</button>
    </div>
  );
}
