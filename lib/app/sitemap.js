export default async function sitemap() {
  const base = 'https://thaimusicarchive.com';
  const staticPages = ['', '/songs', '/archive', '/leaderboard', '/krasuan', '/people', '/timeline',
    '/compare', '/search', '/about', '/spec', '/data', '/glossary', '/learn']
    .map(p => ({ url: base + p, changeFrequency: 'weekly', priority: p === '' ? 1 : 0.7 }));
  let songs = [], records = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/songs?select=id&limit=1000`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }, next: { revalidate: 86400 } });
    songs = (await res.json()).map(s => ({ url: `${base}/songs/${s.id}`, changeFrequency: 'monthly', priority: 0.8 }));
    const res2 = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/archive_records?select=id&approved=eq.true&limit=1000`,
      { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }, next: { revalidate: 86400 } });
    records = (await res2.json()).map(r => ({ url: `${base}/archive/${r.id}`, changeFrequency: 'monthly', priority: 0.6 }));
  } catch {}
  return [...staticPages, ...songs, ...records];
}
