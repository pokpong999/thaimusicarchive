'use client';
// components/TranslateAdmin.js — แผงคำแปลอังกฤษในหน้าผู้ดูแล  (Pk 28 ส.ค. 69)
//
//   ใช้ไล่แปลของเก่าที่ค้างอยู่ (เหตุการณ์ 270 กว่ารายการ · เพลง 300 เพลง)
//   ของใหม่ไม่ต้องมากด — เว็บสั่งแปลเองตอนสมาชิกส่งและตอนผู้ดูแลกดอนุมัติ
//
//   ★ บอกสถานะการตั้งค่าให้ชัด ก่อนที่จะกดแล้วงงว่าทำไมไม่ขยับ
//     ไม่มีกุญแจ = ขึ้นบอกตรง ๆ ว่าต้องไปวางที่ไหน
import { useEffect, useState } from 'react';
import { trStats, trHealth, kickTranslate, trReset } from '../lib/translate';

const SRC_NAME = {
  archive_records: 'เหตุการณ์ในหอจดหมายเหตุ',
  archive_media:   'คำบรรยายภาพ',
  songs:           'ชื่อเพลง · ประวัติเพลง · บทร้อง',
};

export default function TranslateAdmin() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [err, setErr] = useState('');
  const [stop, setStop] = useState(false);

  const refresh = async () => {
    const s = await trStats();
    if (s.error) setErr(sqlHint(s.error.message));
    else { setStats(s); setErr(''); }
  };
  useEffect(() => { trHealth().then(setHealth); refresh(); }, []);

  const sqlHint = m => (/thma_tr_stats|schema cache|does not exist|tr_src/i.test(m ?? '')
    ? 'ยังไม่ได้รัน sql/37_translate.sql · ' + m : m);

  // ไล่แปลเป็นรอบ ๆ รอบละ 20 แถว จนกว่าจะหมดหรือกดหยุด
  async function run(all) {
    setBusy(true); setStop(false); setLog([]); setErr('');
    let guard = 0;
    while (guard++ < 200) {
      const r = await kickTranslate(20);
      if (r.error) { setErr(sqlHint(r.error)); break; }
      setLog(l => [`แปลแล้ว ${r.done ?? 0} รายการ (${r.fields ?? 0} ช่อง) · ${r.by ?? ''}`, ...l].slice(0, 12));
      await refresh();
      if (!all) break;
      if (!r.rows) break;                 // ไม่มีงานค้างแล้ว
      if (stop) break;
      await new Promise(z => setTimeout(z, 400));
    }
    setBusy(false);
  }

  async function reset() {
    if (!confirm('ล้างคำแปลอังกฤษทั้งหมด แล้วสั่งแปลใหม่?\nใช้ตอนแก้บัญชีศัพท์หรือเปลี่ยนเจ้าที่แปล')) return;
    const { n, error } = await trReset(null);
    if (error) { setErr(sqlHint(error.message)); return; }
    setLog(l => [`ล้างคำแปล ${n} รายการ — กด "แปลที่ค้างอยู่" เพื่อแปลใหม่`, ...l]);
    refresh();
  }

  const pending = stats?.pending ?? 0;
  const box = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem 1.1rem', marginBottom: '0.9rem' };

  return (
    <div data-tradmin>
      <div style={{fontWeight:600, marginBottom:'0.7rem'}}>🌐 คำแปลภาษาอังกฤษของเนื้อหาที่สมาชิกเขียน</div>

      {/* ── สถานะการตั้งค่า ── */}
      <div style={box}>
        <div style={{fontSize:'0.8rem', color:'var(--muted)', marginBottom:'0.5rem'}}>การตั้งค่าที่ Vercel</div>
        {health == null ? <div style={{fontSize:'0.85rem'}}>กำลังตรวจ…</div> : (
          <div style={{display:'grid', gap:'4px', fontSize:'0.85rem'}} data-trhealth>
            {/* ★ เขียว = ต่อฐานได้จริง ไม่ใช่แค่ "มีตัวแปร" — เดิมบอกเขียวทั้งที่กุญแจใช้ไม่ได้ */}
            <Row ok={health.supabase}
              on={'ต่อฐานข้อมูลได้จริง (ทดสอบแล้ว)' + (health.diag?.used_key ? ' · ใช้ ' + health.diag.used_key : '')}
              off="ต่อฐานข้อมูลไม่ได้ — ดูรายละเอียดด้านล่าง" />
            <Row ok={health.anthropic || health.google}
              on={`ตัวแปลพร้อม: ${health.anthropic ? 'Anthropic · ' + (health.model ?? '') : 'Google Translate'}`}
              off="ยังไม่ได้วางกุญแจตัวแปล — ใส่ ANTHROPIC_API_KEY หรือ GOOGLE_TRANSLATE_API_KEY" />

            {/* ── ต่อฐานไม่ได้: บอกให้ชัดว่าผิดตรงไหน ต้องไปแก้ที่ไหน ── */}
            {!health.supabase && health.diag && (
              <div data-trdiag style={{marginTop:'0.5rem', padding:'0.7rem 0.9rem', borderRadius:'8px',
                background:'rgba(200,60,40,0.10)', border:'1px solid var(--danger)'}}>
                <div style={{color:'var(--danger)', fontWeight:600, marginBottom:'0.35rem'}}>
                  {health.diag.problem ?? 'ต่อฐานข้อมูลไม่ได้'}
                </div>
                <div style={{fontSize:'0.76rem', color:'var(--muted)', lineHeight:1.8}}>
                  กุญแจที่วางไว้: {health.diag.key_len
                    ? <>ยาว {health.diag.key_len} ตัว · ขึ้นต้น <code>{health.diag.key_head}…</code>
                        {health.diag.key_kind && <> · ชนิด {health.diag.key_kind}</>}
                        {health.diag.key_role && <> · สิทธิ์ <b style={{color: health.diag.key_role === 'service_role' ? 'var(--jade)' : 'var(--danger)'}}>{health.diag.key_role}</b></>}
                      </>
                    : <b>ยังไม่ได้วาง</b>}
                  <br />
                  โปรเจ็คของกุญแจ: <code>{health.diag.key_ref ?? '—'}</code> ·
                  โปรเจ็คที่เว็บชี้ไป: <code>{health.diag.url_ref ?? '—'}</code>
                  {health.diag.key_ref && health.diag.url_ref && health.diag.key_ref !== health.diag.url_ref
                    && <b style={{color:'var(--danger)'}}> ← ไม่ตรงกัน</b>}
                  {health.diag.db_status ? <><br />ฐานตอบรหัส {health.diag.db_status}</> : null}
                </div>
                {/* ตารางกุญแจทุกตัวที่มี — ดูด้วยตาได้เลยว่าตัวไหนใช้ได้ ตัวไหนของคนละโปรเจ็ค */}
                {health.diag.keys?.length > 0 && (
                  <div style={{marginTop:'0.5rem', overflowX:'auto'}}>
                    <table style={{fontSize:'0.72rem', borderCollapse:'collapse', minWidth:'420px'}}>
                      <thead><tr style={{color:'var(--muted)'}}>
                        <th style={{textAlign:'left', padding:'2px 10px 2px 0'}}>ตัวแปร</th>
                        <th style={{textAlign:'left', padding:'2px 10px 2px 0'}}>ชนิด</th>
                        <th style={{textAlign:'left', padding:'2px 10px 2px 0'}}>สิทธิ์</th>
                        <th style={{textAlign:'left', padding:'2px 10px 2px 0'}}>โปรเจ็ค</th>
                        <th style={{textAlign:'left', padding:'2px 0'}}>ผลลอง</th>
                      </tr></thead>
                      <tbody>
                        {health.diag.keys.map(k => (
                          <tr key={k.name}>
                            <td style={{padding:'2px 10px 2px 0'}}><code>{k.name}</code></td>
                            <td style={{padding:'2px 10px 2px 0'}}>{k.kind ?? '—'}</td>
                            <td style={{padding:'2px 10px 2px 0',
                              color: k.role && k.role !== 'service_role' ? 'var(--danger)' : 'inherit'}}>{k.role ?? '—'}</td>
                            <td style={{padding:'2px 10px 2px 0',
                              color: k.ref && health.diag.url_ref && k.ref !== health.diag.url_ref ? 'var(--danger)' : 'inherit'}}>
                              {k.ref ?? '—'}</td>
                            <td style={{padding:'2px 0', color: k.ok ? 'var(--jade)' : 'var(--danger)'}}>
                              {k.ok === null ? 'ไม่ได้ลอง' : k.ok ? '✓ ใช้ได้' : '✗ ' + (k.status ?? 'ไม่ผ่าน')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* ★ กุญแจสาธารณะที่เว็บใช้อยู่ = หลักฐานว่าโปรเจ็คไหนคือตัวจริง */}
                {health.diag.anon_ref && (
                  <div style={{fontSize:'0.76rem', color:'var(--muted)', marginTop:'0.4rem'}}>
                    กุญแจสาธารณะที่เว็บใช้อยู่ (และใช้ได้ปกติ) เป็นของโปรเจ็ค{' '}
                    <code style={{color:'var(--jade)'}}>{health.diag.anon_ref}</code>
                    {health.diag.anon_ref === health.diag.url_ref && <b style={{color:'var(--jade)'}}> ← นี่คือโปรเจ็คที่ถูก</b>}
                  </div>
                )}
                {/* วิธีแก้ — แยกตามอาการ ไม่ใช่บอกกลาง ๆ เหมือนกันหมด */}
                {/คนละตัว|คนละโปรเจ็ค/.test(health.diag.problem ?? '') ? (
                  <div style={{fontSize:'0.76rem', color:'var(--gold2)', marginTop:'0.45rem', lineHeight:1.9}}>
                    <b>ทางแก้ที่ตัวเชื่อมมาทับไม่ได้</b> (แนะนำ — ไม่ต้องไปยุ่งกับตัวเชื่อม)<br />
                    1. Supabase → เลือกโปรเจ็ค <code style={{color:'var(--jade)'}}>{health.diag.url_ref}</code>{' '}
                       (ตัวที่เว็บใช้อยู่ ไม่ใช่ตัวที่ตัวเชื่อมผูกไว้)<br />
                    2. Settings → API → หัวข้อ <b>service_role</b> → Reveal → กดปุ่มคัดลอก<br />
                    3. Vercel → Environment Variables → <b>Add Environment Variable</b><br />
                    &nbsp;&nbsp;&nbsp;ชื่อ <code>THMA_SUPABASE_KEY</code> · ค่า = กุญแจที่คัดลอกมา · เลือก All Environments<br />
                    4. Deployments → <b>Redeploy</b><br />
                    <span style={{color:'var(--muted)'}}>
                      ใช้ชื่อใหม่เพราะตัวเชื่อม Supabase↔Vercel ดูแลชื่อที่ขึ้นต้นด้วย SUPABASE_ อยู่
                      ถ้าไปวางทับชื่อเดิม มันจะเขียนกลับเป็นของโปรเจ็คผิดอีก
                    </span>
                  </div>
                ) : (
                  <div style={{fontSize:'0.76rem', color:'var(--gold2)', marginTop:'0.45rem', lineHeight:1.8}}>
                    วิธีแก้: Supabase → Settings → API → หัวข้อ <b>service_role</b> → กด Reveal → คัดลอกทั้งก้อน<br />
                    → Vercel → Environment Variables → <code>SUPABASE_SERVICE_ROLE_KEY</code> → วางทับ<br />
                    → <b>Deployments → Redeploy</b> (ไม่ Redeploy ค่าใหม่จะยังไม่มีผล)
                  </div>
                )}
              </div>
            )}
            {health.ver && <div style={{fontSize:'0.68rem', color:'var(--muted)'}}>ตัวแปลรุ่น {health.ver}</div>}
          </div>
        )}
      </div>

      {/* ── งานค้าง ── */}
      <div style={box}>
        <div style={{display:'flex', alignItems:'baseline', gap:'10px', flexWrap:'wrap'}}>
          <div style={{fontSize:'1.05rem', fontWeight:700, color: pending ? 'var(--gold)' : 'var(--jade)'}}>
            {stats == null ? '—' : pending ? `ค้างอยู่ ${pending} รายการ` : 'แปลครบแล้ว'}
          </div>
          <button className="btn btn-outline btn-sm" onClick={refresh} disabled={busy}>↻ นับใหม่</button>
        </div>
        {stats?.rows && (
          <div style={{marginTop:'0.6rem', fontSize:'0.82rem', display:'grid', gap:'3px'}}>
            {stats.rows.map(r => (
              <div key={r.src} style={{display:'flex', gap:'8px'}}>
                <span style={{minWidth:'210px'}}>{SRC_NAME[r.src] ?? r.src}</span>
                <span style={{color:'var(--gold)'}}>ค้าง {r.pending}</span>
                <span style={{color:'var(--jade)'}}>แปลแล้ว {r.done}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'0.8rem'}}>
          <button className="btn btn-primary btn-sm" disabled={busy || !pending || !health?.ready}
            onClick={() => run(true)}>
            {busy ? '⏳ กำลังแปล…' : `▶ แปลที่ค้างอยู่ทั้งหมด (${pending})`}
          </button>
          <button className="btn btn-outline btn-sm" disabled={busy || !pending || !health?.ready}
            onClick={() => run(false)}>แปลทีละ 20 รายการ</button>
          {busy && <button className="btn btn-outline btn-sm" onClick={() => setStop(true)}>■ หยุด</button>}
          <span style={{flex:1}} />
          <button className="btn btn-danger btn-sm" disabled={busy} onClick={reset}>ล้างคำแปล แล้วแปลใหม่</button>
        </div>
      </div>

      {err && <div style={{color:'var(--danger)', fontSize:'0.82rem', marginBottom:'0.7rem'}}>⚠ {err}</div>}

      {log.length > 0 && (
        <div style={{fontSize:'0.78rem', color:'var(--muted)', display:'grid', gap:'2px'}} data-trlog>
          {log.map((l, i) => <div key={i}>· {l}</div>)}
        </div>
      )}

      <div style={{fontSize:'0.76rem', color:'var(--muted)', marginTop:'1rem', lineHeight:1.8}}>
        ของใหม่ไม่ต้องมากดที่นี่ — เว็บสั่งแปลให้เองตอนสมาชิกกดส่ง และตอนผู้ดูแลกดอนุมัติ<br/>
        ปุ่มนี้มีไว้ไล่แปล<b>ของเก่า</b> กับตอนที่มีอะไรหลุด<br/>
        สมาชิกกลับมาแก้ข้อความไทย → ระบบรู้เองว่าคำแปลเก่าใช้ไม่ได้ แล้วเข้าคิวแปลใหม่
      </div>
    </div>
  );
}

const Row = ({ ok, on, off }) => (
  <div style={{color: ok ? 'var(--jade)' : 'var(--danger)'}}>{ok ? '✓' : '✗'} {ok ? on : off}</div>
);
