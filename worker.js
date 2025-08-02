// microsoftdeepsearch.soumoppt19.workers.dev

const cache = new Map(); const MAX_CACHE = 50;

function setCache(key, value) { if (cache.size >= MAX_CACHE) { const firstKey = cache.keys().next().value; cache.delete(firstKey); } cache.set(key, value); }

function getCache(key) { return cache.get(key); }

export default { async fetch(request) { const { searchParams } = new URL(request.url); const query = searchParams.get("query"); const state = searchParams.get("state") || "web";

if (!query) {
  return new Response(JSON.stringify({
    error: "Missing query parameter ?query="
  }), { status: 400 });
}

const cacheHit = getCache(query + state);
if (cacheHit) {
  return new Response(JSON.stringify({ query, state, cached: true, results: cacheHit }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
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

async function scrapeDDGImages(q) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  const html = await response.text();
  const urls = [...html.matchAll(/https?:\\/\\/external-content\.duckduckgo\.com\/iu\/\?u=[^\"']+/g)];
  const results = urls.slice(0, 10).map(u => ({
    image_url: decodeURIComponent(u[0]),
    source: "DuckDuckGo"
  }));
  return results;
}

try {
  let results;
  if (state === "image") {
    results = await scrapeDDGImages(query);
  } else {
    results = await scrapeDDG(query);
  }
  setCache(query + state, results);
  return new Response(JSON.stringify({ query, state, source: "DuckDuckGo", results }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
} catch (err) {
  return new Response(JSON.stringify({
    error: err.message || "Scraping failed"
  }), { status: 500 });
}

} };

  
