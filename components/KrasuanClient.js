'use client';
// components/KrasuanClient.js — คลังกระสวนส่วนตัว (เฉพาะเจ้าของคลัง)
// KRASUAN_PAGE_VER แสดงบนหน้าจอ ใช้ตรวจว่าอัปไฟล์ขึ้นจริงหรือยัง
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const KRASUAN_PAGE_VER = 'kr1';

/* ---------- แปลงโน้ตไทย → รหัสแป้น TH Notation ---------- */
const COLS = ['ด', 'ร', 'ม', 'ฟ', 'ซ', 'ล', 'ท'];
const HI = 'qwertyu', MID = 'asdfghj', LO = 'zxcvbnm';
function thn(tok) {
  const s = String(tok == null ? '' : tok);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const col = COLS.indexOf(ch);
    if (col < 0) { if (ch === '-') out += '-'; continue; }
    let row = MID;
    const nx = s[i + 1];
    if (nx === '\u0E4D') { row = HI; i++; }
    else if (nx === '\u0E3A' || nx === '\u0E38') { row = LO; i++; }
    out += row[col];
  }
  return out || '-';
}
function hongs(mel) {
  return String(mel || '').split('|').map((h) => {
    const t = h.trim().split(/\s+/).filter(Boolean);
    while (t.length < 4) t.push('-');
    return t.slice(0, 4).map(thn).join(' ');
  });
}

const BITMAP = { O: '----', A: 'X---', B: '-X--', C: '--X-', D: '---X', E: 'XX--',
  F: 'X-X-', G: 'X--X', H: '-XX-', I: '-X-X', J: '--XX', K: 'XXX-', L: 'XX-X',
  M: 'X-XX', N: '-XXX', P: 'XXXX' };
const bitsOf = (code) => [...code].map((c) => BITMAP[c]).join('');

const TH = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
const th = (n) => String(n).replace(/[0-9]/g, (d) => TH[+d]);
const thx = (s) => String(s || '').replace(/[0-9]/g, (d) => TH[+d]);

/* ---------- ตารางกระสวน ---------- */
function Grid({ code, size = 26 }) {
  const bits = bitsOf(code);
  return (
    <div style={{ display: 'flex', gap: size * 0.55, alignItems: 'flex-end' }}>
      {[0, 1, 2, 3].map((h) => (
        <div key={h}>
          <div style={{ display: 'flex', border: '1.5px solid #3A3630' }}>
            {[0, 1, 2, 3].map((p) => (
              <div key={p} style={{
                width: size, height: size,
                background: bits[h * 4 + p] === 'X' ? '#111' : '#EDE9E0',
                borderLeft: p ? '1.5px solid #fff' : 'none',
              }} />
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: '#6B6558', marginTop: 2 }}>
            ห้อง {th(h + 1)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- แถวโน้ต 4 ห้อง ---------- */
function Bars({ mel, small }) {
  return (
    <div style={{ display: 'flex' }}>
      {hongs(mel).map((h, i) => (
        <div key={i} style={{
          flex: 1, textAlign: 'center', padding: small ? '2px 4px' : '4px 6px',
          border: '1px solid #C9C4BA', borderLeft: i ? 'none' : '1px solid #C9C4BA',
          fontFamily: 'THNotation, "TH Notation2", serif',
          fontSize: small ? 15 : 18, whiteSpace: 'nowrap',
        }}>{h}</div>
      ))}
    </div>
  );
}

export default function KrasuanPrivatePage() {
  const [state, setState] = useState('loading');   // loading | denied | ready | error
  const [msg, setMsg] = useState('');
  const [index, setIndex] = useState([]);
  const [q, setQ] = useState('');
  const [dens, setDens] = useState('');
  const [sel, setSel] = useState(null);
  const [one, setOne] = useState(null);
  const [busy, setBusy] = useState(false);

  async function call(path) {
    const { data } = await supabase.auth.getSession();
    const token = data && data.session ? data.session.access_token : '';
    const r = await fetch('/api/krasuan' + path, {
      headers: token ? { authorization: 'Bearer ' + token } : {},
      cache: 'no-store',
    });
    const j = await r.json().catch(() => ({ error: 'อ่านคำตอบไม่ได้' }));
    if (!r.ok) { const e = new Error(j.error || ('ผิดพลาด ' + r.status)); e.status = r.status; throw e; }
    return j;
  }

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const idx = await call('');
        if (!live) return;
        setIndex(idx); setState('ready');
      } catch (e) {
        if (!live) return;
        if (e.status === 403) { setState('denied'); }
        else { setState('error'); setMsg(e.message); }
      }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!sel) { setOne(null); return; }
    let live = true;
    setBusy(true); setOne(null);
    call('?code=' + sel)
      .then((j) => { if (live) setOne(j); })
      .catch((e) => { if (live) setMsg(e.message); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [sel]);

  const rows = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return index.filter((r) =>
      (!dens || String(r.d) === dens) &&
      (!needle || r.c.includes(needle))
    );
  }, [index, q, dens]);

  if (state === 'loading') return <Shell><p>กำลังเปิดคลัง…</p></Shell>;

  if (state === 'denied') return (
    <Shell>
      <h1 style={{ margin: '0 0 8px' }}>คลังกระสวน</h1>
      <p style={{ color: '#8A3B34' }}>หน้านี้เปิดเฉพาะเจ้าของคลัง</p>
      <p style={{ fontSize: 14, color: '#6B6558' }}>
        ถ้านี่คือเครื่องของคุณ ให้เข้าสู่ระบบด้วยบัญชีผู้ดูแลก่อน แล้วเปิดหน้านี้ใหม่
      </p>
    </Shell>
  );

  if (state === 'error') return (
    <Shell><h1>คลังกระสวน</h1><p style={{ color: '#8A3B34' }}>{msg}</p></Shell>
  );

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>คลังกระสวน</h1>
        <span style={{ fontSize: 14, color: '#6B6558' }} data-krver={KRASUAN_PAGE_VER}>
          {th(index.length)} กระสวน · ส่วนตัว · รุ่น {KRASUAN_PAGE_VER}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '14px 0', flexWrap: 'wrap' }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นรหัส เช่น DNDN หรือ NP"
          style={{ padding: '6px 10px', border: '1px solid #C9C4BA', borderRadius: 4, minWidth: 200 }}
        />
        <select value={dens} onChange={(e) => setDens(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #C9C4BA', borderRadius: 4 }}>
          <option value="">ทุกความหนาแน่น</option>
          {Array.from({ length: 17 }, (_, i) => i).map((i) => (
            <option key={i} value={String(i)}>{th(i)} เสียง</option>
          ))}
        </select>
        <span style={{ alignSelf: 'center', fontSize: 14, color: '#6B6558' }}>
          พบ {th(rows.length)} แบบ
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,300px) 1fr', gap: 20 }}>
        {/* รายการซ้าย */}
        <div style={{ maxHeight: '70vh', overflowY: 'auto', border: '1px solid #E2DED4' }}>
          {rows.slice(0, 400).map((r) => (
            <button key={r.c} onClick={() => setSel(r.c)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                padding: '6px 10px', border: 'none', borderBottom: '1px solid #F0EDE6',
                background: sel === r.c ? '#F3EFE6' : 'transparent', font: 'inherit',
              }}>
              <b>{r.c}</b>
              <span style={{ fontSize: 13, color: '#6B6558' }}>
                {' '}· {th(r.d)} เสียง · {th(r.f)} วรรค · {th(r.m)} ทำนอง
              </span>
            </button>
          ))}
          {rows.length > 400 && (
            <div style={{ padding: 10, fontSize: 13, color: '#6B6558' }}>
              แสดง ๔๐๐ แบบแรก — พิมพ์ค้นเพื่อแคบลง
            </div>
          )}
        </div>

        {/* รายละเอียดขวา */}
        <div>
          {!sel && <p style={{ color: '#6B6558' }}>เลือกกระสวนจากรายการทางซ้าย</p>}
          {busy && <p>กำลังเปิด…</p>}
          {one && <Detail x={one} />}
        </div>
      </div>
    </Shell>
  );
}

function Detail({ x }) {
  const [n, setN] = useState(25);
  return (
    <div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: '#9E2B25', lineHeight: 1 }}>{x.code}</div>
        <Grid code={x.code} />
      </div>

      <div style={{ margin: '14px 0', fontSize: 15 }}>
        <b>{th(x.freq)}</b> วรรค · <b>{th(x.n_songs)}</b> เพลง ·{' '}
        <b>{th(x.n_mel)}</b> ทำนองไม่ซ้ำ · อันดับ {th(x.rank_all)} ของคลัง ·{' '}
        ลำดับที่ {th(x.rank_chap)} ในบทที่ {th(x.density)}
      </div>

      {x.tang && (
        <section style={{ margin: '18px 0' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>
            รูปทำนอง {x.tang.shape_id} ครบทั้ง ๗ ทาง
            <span style={{ fontWeight: 400, fontSize: 14, color: '#6B6558' }}>
              {' '}· {th(x.tang.freq)} วรรค · ทางอ้างอิง {x.tang.ref}
            </span>
          </h3>
          {x.tang.rows.map((r) => (
            <div key={r[0]} style={{ display: 'flex', alignItems: 'stretch', marginBottom: 2 }}>
              <div style={{ width: 110, fontSize: 14, alignSelf: 'center' }}>{r[0]}</div>
              <div style={{ flex: 1 }}><Bars mel={r[1]} small /></div>
            </div>
          ))}
        </section>
      )}

      <section>
        <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>
          ทำนองทั้งหมดที่พบ
          <span style={{ fontWeight: 400, fontSize: 14, color: '#6B6558' }}>
            {' '}· {th(x.n_mel)} แบบ เรียงตามความถี่
          </span>
        </h3>
        {x.melodies.slice(0, n).map((m, i) => (
          <div key={m.id + i} style={{ borderBottom: '1px solid #EEEAE1', padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#6B6558', minWidth: 90 }}>
                {th(i + 1)}. {m.id}
              </span>
              <div style={{ flex: 1, minWidth: 260 }}><Bars mel={m.mel} /></div>
              <span style={{ fontFamily: 'THNotation, "TH Notation2", serif', fontSize: 18 }}>
                {thn(m.luktok)}
              </span>
              <span style={{ fontSize: 13, color: '#6B6558' }}>
                {th(m.freq)} วรรค · {th(m.songs)} เพลง
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#6B6558', marginTop: 4 }}>
              {(m.places || []).map((pl, k) => (
                <span key={k}>
                  {k ? '  |  ' : ''}
                  {pl.song} — {pl.secs.map((sc) => (sc.sec ? thx(sc.sec) + ' ' : '') +
                    'ว.' + sc.verses.map((v) => th(v)).join(', ')).join(' · ')}
                </span>
              ))}
              {m.more_songs ? '  |  และอีก ' + th(m.more_songs) + ' เพลง' : ''}
            </div>
          </div>
        ))}
        {x.melodies.length > n && (
          <button onClick={() => setN(n + 50)}
            style={{ marginTop: 10, padding: '6px 14px', cursor: 'pointer',
                     border: '1px solid #C9C4BA', background: '#fff', borderRadius: 4 }}>
            ดูเพิ่มอีก ๕๐ ทำนอง (เหลือ {th(x.melodies.length - n)})
          </button>
        )}
      </section>
    </div>
  );
}

function Shell({ children }) {
  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 16px 60px',
                   background: '#FCFBF8', color: '#1A1815', minHeight: '60vh' }}>
      <style>{`@font-face{font-family:'THNotation';src:url('/fonts/THNotation.woff2') format('woff2');font-display:swap}`}</style>
      {children}
    </main>
  );
}
