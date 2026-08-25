'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

const ICON = { pending: '🔔', approved: '✓', comment: '💬' };

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'เมื่อครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`;
  if (s < 604800) return `${Math.floor(s / 86400)} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export default function NotificationBell({ userId }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const unread = items.filter(n => !n.read).length;

  // ⚠️ ของเดิมดึงและมาร์คอ่าน "ทุกแถวในตาราง" โดยไม่กรอง user_id
  //    ถ้า RLS ไม่รัดกุมจะเห็น/แก้แจ้งเตือนของสมาชิกคนอื่น — แก้แล้วตรงนี้
  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(30);
    setItems(data ?? []);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();
    const t = setInterval(load, 60000);
    // แจ้งเตือนเด้งทันทีโดยไม่ต้องรอรอบถัดไป
    const ch = supabase.channel('notif-' + userId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        payload => setItems(prev => [payload.new, ...prev].slice(0, 30)))
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, [userId, load]);

  useEffect(() => {
    function onClick(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setItems(items.map(n => ({ ...n, read: true })));
      await supabase.from('notifications').update({ read: true })
        .eq('user_id', userId).eq('read', false);
    }
  }

  async function clearRead() {
    await supabase.from('notifications').delete().eq('user_id', userId).eq('read', true);
    load();
  }

  if (!userId) return null;

  return (
    <div ref={boxRef} style={{position:'relative'}}>
      <button onClick={toggle} title="การแจ้งเตือน"
        style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.15rem',position:'relative',padding:'4px'}}>
        🔔
        {unread > 0 && <span style={{position:'absolute',top:'-2px',right:'-4px',background:'#c0392b',
          color:'#fff',borderRadius:'9px',fontSize:'0.6rem',padding:'1px 5px',fontWeight:700}}>
          {unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div style={{position:'absolute',right:0,top:'2.2rem',width:'330px',maxHeight:'440px',overflowY:'auto',
          background:'var(--navy2)',border:'1px solid var(--gold)',borderRadius:'10px',zIndex:200,
          boxShadow:'0 8px 30px rgba(0,0,0,0.5)'}}>
          <div style={{padding:'0.7rem 1rem',borderBottom:'1px solid var(--border)',fontWeight:600,
            fontSize:'0.85rem',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px'}}>
            <span>🔔 การแจ้งเตือน</span>
            {items.length > 0 && (
              <span onClick={clearRead} style={{fontSize:'0.68rem',color:'var(--muted)',cursor:'pointer',fontWeight:400}}>
                ล้างที่อ่านแล้ว</span>
            )}
          </div>
          {items.length === 0 && (
            <div style={{padding:'1rem',fontSize:'0.8rem',color:'var(--muted)'}}>ยังไม่มีการแจ้งเตือน</div>
          )}
          {items.map(n => (
            <Link key={n.id} href={n.link ?? '#'} onClick={() => setOpen(false)}>
              <div style={{padding:'0.7rem 1rem',borderBottom:'1px solid rgba(42,63,92,0.35)',cursor:'pointer',
                fontSize:'0.8rem',lineHeight:1.6,background: n.read ? 'transparent' : 'rgba(201,168,76,0.07)'}}>
                <div style={{fontWeight:600}}>
                  <span style={{marginRight:'5px'}}>{ICON[n.kind] ?? '•'}</span>{n.title}
                </div>
                {n.body && <div style={{color:'var(--muted)',fontSize:'0.76rem',
                  overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',
                  WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{n.body}</div>}
                <div style={{color:'var(--muted)',fontSize:'0.68rem',marginTop:'2px'}}>{ago(n.created_at)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
