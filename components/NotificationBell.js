'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

export default function NotificationBell({ userId }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const unread = items.filter(n => !n.read).length;

  useEffect(() => {
    if (!userId) return;
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [userId]);

  useEffect(() => {
    function onClick(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  async function load() {
    const { data } = await supabase.from('notifications').select('*')
      .order('created_at', { ascending: false }).limit(15);
    setItems(data ?? []);
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await supabase.from('notifications').update({ read: true }).eq('read', false);
      setItems(items.map(n => ({ ...n, read: true })));
    }
  }

  if (!userId) return null;

  return (
    <div ref={boxRef} style={{position:'relative'}}>
      <button onClick={toggle} style={{background:'none',border:'none',cursor:'pointer',
        fontSize:'1.15rem',position:'relative',padding:'4px'}}>
        🔔
        {unread > 0 && <span style={{position:'absolute',top:'-2px',right:'-4px',background:'#c0392b',
          color:'#fff',borderRadius:'9px',fontSize:'0.6rem',padding:'1px 5px',fontWeight:700}}>{unread}</span>}
      </button>
      {open && (
        <div style={{position:'absolute',right:0,top:'2.2rem',width:'320px',maxHeight:'420px',overflowY:'auto',
          background:'var(--navy2)',border:'1px solid var(--gold)',borderRadius:'10px',zIndex:200,
          boxShadow:'0 8px 30px rgba(0,0,0,0.5)'}}>
          <div style={{padding:'0.7rem 1rem',borderBottom:'1px solid var(--border)',fontWeight:600,fontSize:'0.85rem'}}>
            🔔 การแจ้งเตือน</div>
          {items.length === 0 && <div style={{padding:'1rem',fontSize:'0.8rem',color:'var(--muted)'}}>ยังไม่มีการแจ้งเตือน</div>}
          {items.map(n => (
            <Link key={n.id} href={n.link ?? '#'} onClick={() => setOpen(false)}>
              <div style={{padding:'0.7rem 1rem',borderBottom:'1px solid rgba(42,63,92,0.35)',cursor:'pointer',
                fontSize:'0.8rem',lineHeight:1.6,background: n.read ? 'transparent' : 'rgba(201,168,76,0.07)'}}>
                {n.message}
                <div style={{fontSize:'0.66rem',color:'var(--muted)',marginTop:'2px'}}>
                  {new Date(n.created_at).toLocaleString('th-TH', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
