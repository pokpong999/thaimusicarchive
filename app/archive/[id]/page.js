import ArchiveDetailClient from './ArchiveDetailClient';

export async function generateMetadata({ params }) {
  let rec = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/archive_records?id=eq.${encodeURIComponent(params.id)}&select=what_text,who_text,when_text`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }, next: { revalidate: 3600 } }
    );
    const rows = await res.json();
    rec = rows?.[0] ?? null;
  } catch {}
  const title = rec ? `${rec.what_text} — หอจดหมายเหตุดนตรีไทย` : 'หอจดหมายเหตุดนตรีไทย';
  const description = rec ? `${rec.who_text} · ${rec.when_text}` : 'บันทึกเหตุการณ์ดนตรีไทย อดีต ปัจจุบัน อนาคต';
  return {
    title, description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function Page() {
  return <ArchiveDetailClient />;
}
