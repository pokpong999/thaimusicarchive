'use client';
import { EText, EImage } from '../../components/Editable';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

// แปลข้อความผิดพลาดของ Supabase เป็นภาษาไทยที่บอกทางแก้
function thaiError(raw) {
  const m = String(raw || '');
  if (/Invalid login credentials/i.test(m))
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง — ถ้ายังไม่เคยสมัคร ให้กดปุ่ม "สมัครสมาชิกใหม่" ด้านล่างก่อน';
  if (/Email not confirmed/i.test(m))
    return 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล — แจ้งผู้ดูแลเพื่อเปิดใช้งานให้';
  if (/User already registered|already been registered/i.test(m))
    return 'อีเมลนี้มีบัญชีอยู่แล้ว — กด "มีบัญชีแล้ว? เข้าสู่ระบบ" ด้านล่าง';
  if (/Database error saving new user|Database error/i.test(m))
    return 'ฐานข้อมูลปฏิเสธการสร้างบัญชี — แจ้งผู้ดูแลพร้อมข้อความนี้ (รหัส: profiles trigger)';
  if (/Signups not allowed/i.test(m))
    return 'ขณะนี้ระบบปิดรับสมัครสมาชิก — แจ้งผู้ดูแล';
  if (/Password should be at least/i.test(m))
    return 'รหัสผ่านสั้นเกินไป — ต้องอย่างน้อย 6 ตัวอักษร';
  if (/For security purposes|rate limit|too many requests/i.test(m))
    return 'ลองถี่เกินไป — รอสัก 1 นาทีแล้วลองใหม่';
  if (/Unable to validate email address|invalid format/i.test(m))
    return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (/fetch|network/i.test(m))
    return 'ต่ออินเทอร์เน็ตไม่ได้ — ลองใหม่อีกครั้ง';
  return m;
}

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState('');   // ข้อความอังกฤษต้นฉบับ ไว้ให้ผู้ดูแลอ่าน
  const [busy, setBusy] = useState(false);

  function fail(raw) { setMsg('⚠ ' + thaiError(raw)); setDetail(String(raw || '')); setBusy(false); }
  function clear() { setMsg(''); setDetail(''); }

  async function doLogin() {
    clear(); setBusy(true); setMsg('กำลังเข้าสู่ระบบ...');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    });
    if (error) { fail(error.message); return; }
    window.location.href = '/';
  }

  async function doRegister() {
    clear();
    if (!name.trim()) { setMsg('⚠ กรอกชื่อที่แสดงก่อน'); return; }
    if (!email.trim()) { setMsg('⚠ กรอกอีเมล'); return; }
    if (password.length < 6) { setMsg('⚠ รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร'); return; }
    setBusy(true); setMsg('กำลังสมัคร...');
    const mail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: mail, password,
      options: { data: { display_name: name.trim() } },
    });
    if (error) { fail(error.message); return; }
    // อีเมลนี้มีบัญชีอยู่แล้ว — Supabase ไม่บอกตรง ๆ แต่คืน user ที่ไม่มี identities
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setBusy(false);
      setMsg('⚠ อีเมลนี้มีบัญชีอยู่แล้ว — กด "มีบัญชีแล้ว? เข้าสู่ระบบ" ด้านล่าง');
      return;
    }
    // ปิดยืนยันอีเมลแล้ว → ได้ session ทันที
    if (data.session) { window.location.href = '/'; return; }
    // เผื่อยังเปิดยืนยันอีเมลอยู่: ลองเข้าสู่ระบบต่อทันที
    const { error: e2 } = await supabase.auth.signInWithPassword({ email: mail, password });
    if (!e2) { window.location.href = '/'; return; }
    setBusy(false);
    setMsg('✓ สร้างบัญชีแล้ว แต่ระบบยังบังคับยืนยันอีเมลอยู่ — ตรวจกล่องอีเมล (รวมถึงเมลขยะ) แล้วกลับมาเข้าสู่ระบบ');
    setDetail(e2.message);
  }

  async function doReset() {
    clear();
    if (!email.trim()) { setMsg('⚠ กรอกอีเมลที่ใช้สมัครก่อน แล้วกดลิงก์นี้อีกครั้ง'); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setBusy(false);
    if (error) { fail(error.message); return; }
    setMsg('✓ ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว — ตรวจกล่องอีเมลและเมลขยะ');
  }

  const isLogin = mode === 'login';

  return (
    <main className="container" style={{maxWidth:'420px'}}>
      <div className="card">
        <EImage k="login.cover" height={160} style={{marginBottom:'1rem'}} />
        <div className="section-title" style={{fontSize:'1.1rem',marginBottom:'0.3rem'}}>
          {isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </div>
        <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:'1.1rem'}}>
          Thai Music Archive · Member Portal
        </div>

        {/* สลับโหมดแบบเห็นชัด — ปัญหาเดิมคือคนกดเข้าสู่ระบบทั้งที่ยังไม่เคยสมัคร */}
        <div style={{display:'flex',gap:'6px',marginBottom:'1.2rem',
          background:'var(--navy3)',padding:'4px',borderRadius:'10px'}}>
          {[['login','เข้าสู่ระบบ'],['register','สมัครสมาชิกใหม่']].map(([k, label]) => (
            <button key={k} type="button"
              onClick={() => { setMode(k); clear(); }}
              style={{flex:1,padding:'8px 6px',borderRadius:'7px',cursor:'pointer',
                fontSize:'0.82rem',fontWeight:600,fontFamily:'inherit',
                border: mode===k ? '1px solid var(--gold)' : '1px solid transparent',
                background: mode===k ? 'var(--gold)' : 'transparent',
                color: mode===k ? 'var(--navy)' : 'var(--muted)'}}>
              {label}
            </button>
          ))}
        </div>

        {!isLogin && (
          <div className="form-group">
            <label className="form-label">ชื่อที่แสดง</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)}
              placeholder="ชื่อ-นามสกุล" autoComplete="name" />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">อีเมล</label>
          <input className="form-input" type="email" value={email} inputMode="email"
            autoCapitalize="none" autoCorrect="off" spellCheck="false"
            autoComplete={isLogin ? 'username' : 'email'}
            onChange={e => setEmail(e.target.value)} placeholder="yourname@email.com" />
        </div>
        <div className="form-group">
          <label className="form-label">รหัสผ่าน</label>
          <input className="form-input" type="password" value={password}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (isLogin ? doLogin() : doRegister())}
            placeholder="อย่างน้อย 6 ตัวอักษร" />
        </div>

        <button className="btn btn-primary" disabled={busy}
          style={{width:'100%',justifyContent:'center'}}
          onClick={isLogin ? doLogin : doRegister}>
          {busy ? '⏳ กำลังดำเนินการ...' : (isLogin ? 'เข้าสู่ระบบ' : '✦ สมัครสมาชิก')}
        </button>

        {msg && (
          <div style={{marginTop:'0.8rem',fontSize:'0.82rem',lineHeight:1.7,
            color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)'}}>
            {msg}
            {detail && (
              <div style={{fontSize:'0.68rem',color:'var(--muted)',marginTop:'4px',fontFamily:'monospace'}}>
                {detail}
              </div>
            )}
          </div>
        )}

        {isLogin && (
          <div style={{textAlign:'center',marginTop:'1rem',fontSize:'0.76rem'}}>
            <a style={{color:'var(--muted)',cursor:'pointer'}} onClick={doReset}>ลืมรหัสผ่าน?</a>
          </div>
        )}

        <div style={{marginTop:'1.2rem',paddingTop:'0.9rem',borderTop:'1px solid var(--border)',
          fontSize:'0.72rem',color:'var(--muted)',lineHeight:1.8}}>
          สมัครไม่ผ่าน? แจ้งผู้ดูแลพร้อมข้อความสีเทาด้านบน<br/>
          ✉️ tasanastudio@gmail.com · LINE: p.khamprasert
        </div>
      </div>
    </main>
  );
}
