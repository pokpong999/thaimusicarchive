'use client';
export default function Error({ error, reset }) {
  return (
    <main className="container" style={{maxWidth:'620px',textAlign:'center',paddingTop:'4rem'}}>
      <div style={{fontSize:'2.5rem'}}>🎼</div>
      <div className="section-title" style={{fontSize:'1.15rem',margin:'0.8rem 0'}}>ขออภัย เกิดข้อผิดพลาดในหน้านี้</div>
      <div style={{fontSize:'0.78rem',color:'var(--muted)',background:'var(--navy3)',borderRadius:'8px',
        padding:'0.8rem 1rem',margin:'1rem 0',fontFamily:'monospace',wordBreak:'break-all',textAlign:'left'}}>
        {String(error?.message ?? error)}
      </div>
      <div style={{display:'flex',gap:'10px',justifyContent:'center'}}>
        <button className="btn btn-primary btn-sm" onClick={() => reset()}>ลองใหม่</button>
        <a href="/"><button className="btn btn-outline btn-sm">กลับหน้าแรก</button></a>
      </div>
      <div style={{fontSize:'0.68rem',color:'var(--muted)',marginTop:'1rem'}}>
        พบปัญหาซ้ำ โปรดแคปหน้าจอนี้ส่งให้ผู้ดูแล</div>
    </main>
  );
}
