import SongDetailClient from './SongDetailClient';

export async function generateMetadata({ params }) {
  let name = null;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/songs?id=eq.${encodeURIComponent(params.id)}&select=name_th`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }, next: { revalidate: 3600 } }
    );
    const rows = await res.json();
    name = rows?.[0]?.name_th ?? null;
  } catch {}
  const title = name ? `${name} — หอจดหมายเหตุดนตรีไทย` : 'หอจดหมายเหตุดนตรีไทย';
  const description = name
    ? `โน้ตเพลง${name} เล่นเสียงได้จริงระบบ 7 เสียงไทย พร้อมประวัติเพลงและวิดีโอ`
    : 'ฐานข้อมูลเพลงไทย โน้ตเล่นเสียงได้จริง';
  return {
    title, description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function Page() {
  return <SongDetailClient />;
}
