// Advanced Scraper with Web + Image Support (DDG only) const cache = new Map(); const MAX_CACHE = 50;

function setCache(key, value) { if (cache.size >= MAX_CACHE) { const firstKey = cache.keys().next().value; cache.delete(firstKey); } cache.set(key, value); }

function getCache(key) { return cache.get(key); }

export default { async fetch(request) { const { searchParams } = new URL(request.url); const query = searchParams.get("query"); const state = searchParams.get("state") || "web";

if (!query) {
  return new Response(JSON.stringify({ error: "Missing query parameter ?query=" }), {
    status: 400,
  });
}

const cacheKey = `${state}:${query}`;
const cached = getCache(cacheKey);
if (cached) {
  return new Response(JSON.stringify({ query, state, cached: true, results: cached }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

async function scrapeWeb(q) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const html = await response.text();
  const results = [];
  const regex = /<a.*?class="result__a".*?href="(.*?)".*?>([\s\S]*?)<\/a>[\s\S]*?<a.*?class="result__snippet".*?>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = regex.exec(html)) !== null && results.length < 10) {
    results.push({
      title: match[2].replace(/<[^>]+>/g, "").trim(),
      url: match[1],
      snippet: match[3].replace(/<[^>]+>/g, "").trim(),
      displayed_link: null,
      source: "DuckDuckGo"
    });
  }
  return results;
}

async function scrapeImage(q) {
  const ddgTokenRes = await fetch("https://duckduckgo.com/");
  const html = await ddgTokenRes.text();
  const vqdMatch = html.match(/vqd='(\d+-\d+)'/);
  if (!vqdMatch) throw new Error("Failed to get vqd token from DDG");
  const vqd = vqdMatch[1];

  const imageUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}`;
  const res = await fetch(imageUrl, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const data = await res.json();
  return data.results.slice(0, 10).map(img => ({
    title: img.title,
    image: img.image,
    source: "DuckDuckGo"
  }));
}

try {
  const results = state === "image" ? await scrapeImage(query) : await scrapeWeb(query);
  setCache(cacheKey, results);
  return new Response(JSON.stringify({ query, state, source: "DuckDuckGo", results }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
} catch (err) {
  return new Response(JSON.stringify({ error: "Failed to fetch results", details: err.message }), {
    status: 500,
    headers: { "Content-Type": "application/json" }
  });
}

} };

  
