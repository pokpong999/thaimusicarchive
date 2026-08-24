'use client';
import { useEffect, useState } from 'react';
import { countView, getStat } from '../lib/stats';

export default function StatBadge({ type, id, style }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    if (!id) return;
    countView(type, id);
    const t = setTimeout(() => getStat(type, id).then(setS), 700);
    return () => clearTimeout(t);
  }, [type, id]);
  if (!s) return null;
  return (
    <span style={{fontSize:'0.72rem',color:'var(--muted)',display:'inline-flex',gap:'12px',...style}}>
      <span title="ยอดเข้าชม">👁 {(s.views ?? 0).toLocaleString('th-TH')}</span>
      <span title="ยอดแชร์">↗ {(s.shares ?? 0).toLocaleString('th-TH')}</span>
    </span>
  );
}
