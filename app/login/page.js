'use client';
import { EText, EImage } from '../../components/Editable';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  async function doLogin() {
    setMsg('กำลังเข้าสู่ระบบ...');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMsg('⚠ ' + error.message); return; }
    window.location.href = '/';
  }

  async function doRegister() {
    setMsg('กำลังสมัคร...');
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name } },
    });
    if (error) { setMsg('⚠ ' + error.message); return; }
    setMsg('✓ สมัครสำเร็จ! กรุณาตรวจสอบ email เพื่อยืนยัน แล้วกลับมา login');
  }

  return (
    <main className="container" style={{maxWidth:'420px'}}>
      <div className="card">
        <EImage k="login.cover" height={160} style={{marginBottom:'1rem'}} />
        <div className="section-title" style={{fontSize:'1.1rem',marginBottom:'0.3rem'}}>
          {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </div>
        <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:'1.3rem'}}>
          Thai Music Archive · Member Portal
        </div>
        {mode === 'register' && (
          <div className="form-group">
            <label className="form-label">ชื่อที่แสดง</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">อีเมล</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="yourname@email.com" />
        </div>
        <div className="form-group">
          <label className="form-label">รหัสผ่าน</label>
          <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" />
        </div>
        <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}}
          onClick={mode === 'login' ? doLogin : doRegister}>
          {mode === 'login' ? 'เข้าสู่ระบบ' : '✦ สมัครสมาชิก'}
        </button>
        {msg && <div style={{marginTop:'0.8rem',fontSize:'0.8rem',color:'var(--jade)'}}>{msg}</div>}
        <div style={{textAlign:'center',marginTop:'1rem',fontSize:'0.78rem'}}>
          <a style={{color:'var(--jade)',cursor:'pointer'}}
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMsg(''); }}>
            {mode === 'login' ? 'ยังไม่มีบัญชี? สมัครฟรี' : 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ'}
          </a>
        </div>
      </div>
    </main>
  );
}
