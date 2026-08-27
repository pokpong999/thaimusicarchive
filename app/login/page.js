'use client';
// app/login/page.js — เข้าสู่ระบบ / สมัครสมาชิก / ลืมรหัสผ่าน
//   Pk 2026-08-26: เพิ่มยืนยันรหัสผ่าน 2 รอบ · ส่ง emailRedirectTo ให้ลิงก์ในอีเมลเด้งกลับเว็บเรา
//   · ปุ่มส่งอีเมลยืนยันใหม่ · ลืมรหัสผ่านพากลับมาที่ /auth/callback แล้วตั้งรหัสใหม่ได้จริง
//   โค้ดนี้ทำงานถูกทั้งตอน Supabase เปิดและปิด "Confirm email"
import { EText, EImage } from '../../components/Editable';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { callbackUrl, thaiAuthError, passwordProblem, passwordStrength, MIN_PASSWORD } from '../../lib/auth';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState('');   // ข้อความอังกฤษต้นฉบับ ไว้ให้ผู้ดูแลอ่าน
  const [busy, setBusy] = useState(false);
  const [needConfirm, setNeedConfirm] = useState(false);   // ขึ้นปุ่ม "ส่งอีเมลยืนยันใหม่"
  const [cool, setCool] = useState(0);                     // กันกดรัวจนชนโควตาอีเมล

  function fail(raw) { setMsg('⚠ ' + thaiAuthError(raw)); setDetail(String(raw || '')); setBusy(false); }
  function clear() { setMsg(''); setDetail(''); setNeedConfirm(false); }
  function startCool(sec = 60) {
    setCool(sec);
    const t = setInterval(() => setCool(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
  }

  async function doLogin() {
    clear(); setBusy(true); setMsg('กำลังเข้าสู่ระบบ...');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    });
    if (error) {
      fail(error.message);
      if (/Email not confirmed/i.test(error.message)) setNeedConfirm(true);
      return;
    }
    window.location.href = '/';
  }

  async function doRegister() {
    clear();
    if (!name.trim()) { setMsg('⚠ กรอกชื่อที่แสดงก่อน'); return; }
    if (!email.trim()) { setMsg('⚠ กรอกอีเมล'); return; }
    const bad = passwordProblem(password, password2);
    if (bad) { setMsg('⚠ ' + bad); return; }
    setBusy(true); setMsg('กำลังสมัคร...');
    const mail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: mail, password,
      // ลิงก์ยืนยันในอีเมลจะพากลับมาที่หน้านี้ของเว็บเรา (ต้องใส่ URL นี้ใน Supabase → Redirect URLs)
      options: { data: { display_name: name.trim() }, emailRedirectTo: callbackUrl() },
    });
    if (error) { fail(error.message); return; }
    // อีเมลนี้มีบัญชีอยู่แล้ว — Supabase ไม่บอกตรง ๆ แต่คืน user ที่ไม่มี identities
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setBusy(false);
      setMsg('⚠ อีเมลนี้มีบัญชีอยู่แล้ว — กดแท็บ "เข้าสู่ระบบ" ด้านบน');
      return;
    }
    // Confirm email ปิดอยู่ → ได้ session ทันที เข้าเว็บได้เลย
    if (data.session) { window.location.href = '/'; return; }
    // Confirm email เปิดอยู่ → ต้องไปกดลิงก์ในอีเมลก่อน
    setBusy(false);
    setNeedConfirm(true);
    startCool(60);
    setMsg('✓ สร้างบัญชีแล้ว — ส่งลิงก์ยืนยันไปที่ ' + mail
      + ' เปิดอีเมลแล้วกดลิงก์ (ดูในเมลขยะด้วย) จะเด้งกลับมาที่เว็บนี้และเข้าใช้งานได้ทันที');
  }

  async function resendConfirm() {
    const mail = email.trim().toLowerCase();
    if (!mail) { setMsg('⚠ กรอกอีเมลที่ใช้สมัครก่อน'); return; }
    setBusy(true); setDetail('');
    const { error } = await supabase.auth.resend({
      type: 'signup', email: mail, options: { emailRedirectTo: callbackUrl() },
    });
    setBusy(false);
    if (error) { fail(error.message); setNeedConfirm(true); return; }
    startCool(60);
    setMsg('✓ ส่งอีเมลยืนยันใหม่ไปที่ ' + mail + ' แล้ว — ตรวจกล่องอีเมลและเมลขยะ');
  }

  async function doReset() {
    clear();
    if (!email.trim()) { setMsg('⚠ กรอกอีเมลที่ใช้สมัครก่อน แล้วกดลิงก์นี้อีกครั้ง'); return; }
    setBusy(true);
    // พากลับมาที่หน้ารับของเรา แล้วตั้งรหัสใหม่ได้เลย (เดิมเด้งไปหน้าแรก ไม่มีที่ให้พิมพ์รหัสใหม่)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: callbackUrl() });
    setBusy(false);
    if (error) { fail(error.message); return; }
    startCool(60);
    setMsg('✓ ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว — กดลิงก์ในอีเมลจะกลับมาที่เว็บนี้ให้ตั้งรหัสใหม่ (ดูในเมลขยะด้วย)');
  }

  const isLogin = mode === 'login';
  const mismatch = !isLogin && password2.length > 0 && password !== password2;
  const matched = !isLogin && password.length >= MIN_PASSWORD && password2.length > 0 && password === password2;
  const st = passwordStrength(password);

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
            <button key={k} type="button" data-t={'tab-' + k}
              onClick={() => { setMode(k); clear(); setPassword2(''); }}
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
            <input className="form-input" data-t="name" value={name} onChange={e => setName(e.target.value)}
              placeholder="ชื่อ-นามสกุล" autoComplete="name" />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">อีเมล</label>
          <input className="form-input" data-t="email" type="email" value={email} inputMode="email"
            autoCapitalize="none" autoCorrect="off" spellCheck="false"
            autoComplete={isLogin ? 'username' : 'email'}
            onChange={e => setEmail(e.target.value)} placeholder="yourname@email.com" />
        </div>
        <div className="form-group">
          <label className="form-label">รหัสผ่าน</label>
          <input className="form-input" data-t="pw1" type={showPw ? 'text' : 'password'} value={password}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (isLogin ? doLogin() : doRegister())}
            placeholder={`อย่างน้อย ${MIN_PASSWORD} ตัวอักษร`} />
          {!isLogin && password.length > 0 && (
            <div data-t="strength" style={{display:'flex',gap:6,alignItems:'center',marginTop:5}}>
              <div style={{flex:1,height:5,background:'var(--navy3)',borderRadius:99,overflow:'hidden'}}>
                <div style={{width:(st.score/4*100)+'%',height:'100%',borderRadius:99,
                  background: st.score <= 1 ? 'var(--danger)' : st.score === 2 ? 'var(--gold)' : 'var(--jade)'}} />
              </div>
              <span style={{fontSize:'0.68rem',color:'var(--muted)'}}>{st.label}</span>
            </div>
          )}
        </div>

        {/* ยืนยันรหัสผ่านรอบสอง — Pk ขอ 2026-08-26 */}
        {!isLogin && (
          <div className="form-group">
            <label className="form-label">ยืนยันรหัสผ่าน (พิมพ์ซ้ำอีกครั้ง)</label>
            <input className="form-input" data-t="pw2" type={showPw ? 'text' : 'password'} value={password2}
              autoComplete="new-password"
              onChange={e => setPassword2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doRegister()}
              placeholder="พิมพ์รหัสผ่านเดิมอีกครั้ง"
              style={{borderColor: mismatch ? 'var(--danger)' : matched ? 'var(--jade)' : undefined}} />
            <div data-t="pw-hint" style={{fontSize:'0.72rem',marginTop:4,minHeight:'1.1em',
              color: mismatch ? 'var(--danger)' : matched ? 'var(--jade)' : 'var(--muted)'}}>
              {mismatch ? '✗ ยังไม่ตรงกัน' : matched ? '✓ ตรงกันแล้ว' : ''}
            </div>
          </div>
        )}

        {!isLogin && (
          <label style={{display:'flex',gap:6,alignItems:'center',fontSize:'0.76rem',
            color:'var(--muted)',marginBottom:'0.9rem',cursor:'pointer'}}>
            <input type="checkbox" data-t="showpw" checked={showPw} onChange={e => setShowPw(e.target.checked)}
              style={{accentColor:'var(--gold)'}} /> แสดงรหัสผ่าน
          </label>
        )}

        <button className="btn btn-primary" data-t="submit" disabled={busy || (!isLogin && mismatch)}
          style={{width:'100%',justifyContent:'center'}}
          onClick={isLogin ? doLogin : doRegister}>
          {busy ? '⏳ กำลังดำเนินการ...' : (isLogin ? 'เข้าสู่ระบบ' : '✦ สมัครสมาชิก')}
        </button>

        {msg && (
          <div data-t="msg" style={{marginTop:'0.8rem',fontSize:'0.82rem',lineHeight:1.7,
            color: msg.startsWith('⚠') ? 'var(--gold)' : 'var(--jade)'}}>
            {msg}
            {detail && (
              <div style={{fontSize:'0.68rem',color:'var(--muted)',marginTop:'4px',fontFamily:'monospace'}}>
                {detail}
              </div>
            )}
          </div>
        )}

        {/* ยังไม่ได้ยืนยันอีเมล → ขอลิงก์ใหม่ได้จากตรงนี้ ไม่ต้องรบกวนผู้ดูแล */}
        {needConfirm && (
          <button className="btn btn-outline" data-t="resend" disabled={busy || cool > 0}
            style={{width:'100%',justifyContent:'center',marginTop:'0.6rem'}}
            onClick={resendConfirm}>
            {cool > 0 ? `📧 ส่งอีเมลยืนยันใหม่ได้ในอีก ${cool} วินาที` : '📧 ส่งอีเมลยืนยันใหม่'}
          </button>
        )}

        {isLogin && (
          <div style={{textAlign:'center',marginTop:'1rem',fontSize:'0.76rem'}}>
            <a data-t="forgot" style={{color:'var(--gold2)',cursor:'pointer',textDecoration:'underline',
              display:'inline-block',padding:'8px 10px',fontSize:'0.85rem'}} onClick={doReset}>ลืมรหัสผ่าน?</a>
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
