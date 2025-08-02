const cache = new Map(); const MAX_CACHE = 50;

function setCache(key, value) { if (cache.size >= MAX_CACHE) { const firstKey = cache.keys().next().value; cache.delete(firstKey); } cache.set(key, value); }

function getCache(key) { return cache.get(key); }

export default { async fetch(request) { const { searchParams } = new URL(request.url); const query = searchParams.get("query");

if (!query) {
  return new Response(JSON.stringify({
    error: "Missing query parameter ?query="
  }), { status: 400 });
}

const cacheHit = getCache(query);
if (cacheHit) {
  return new Response(JSON.stringify({ query, cached: true, results: cacheHit }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}

async function scrapeBing(q) {
  const res = await fetch("https://www.bing.com/search?q=" + encodeURIComponent(q));
  const html = await res.text();

  const matches = [...html.matchAll(/<li class=\"b_algo\".*?<h2><a href=\"(.*?)\".*?>(.*?)<\/a><\/h2>.*?<p>(.*?)<\/p>/gs)];

  return matches.map(match => ({
    title: stripHTML(match[2]),
    url: match[1],
    snippet: stripHTML(match[3]),
    displayed_link: null,
    source: "Bing"
  })).slice(0, 10);
}

async function scrapeDDG(q) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  const html = await response.text();
  const results = [];
  const regex = /<a.*?class=\"result__a\".*?href=\"(.*?)\".*?>([\s\S]*?)<\/a>[\s\S]*?<a.*?class=\"result__snippet\".*?>([\s\S]*?)<\/a>/g;
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

function stripHTML(str) {
  return str.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
}

try {
  const bingResults = await scrapeBing(query);
  if (bingResults.length) {
    setCache(query, bingResults);
    return new Response(JSON.stringify({ query, source: "Bing", results: bingResults }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } else {
    throw new Error("Bing returned no results");
  }
} catch (err) {
  const ddgResults = await scrapeDDG(query);
  setCache(query, ddgResults);
  return new Response(JSON.stringify({ query, source: "DuckDuckGo", fallback: true, results: ddgResults }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}

} };
