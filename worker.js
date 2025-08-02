// Ultimate search scraper with Google + DuckDuckGo fallback, JSON output, and in-memory LRU caching

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

async function scrapeGoogle(q) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  });
  const html = await response.text();
  const results = [];
  const resultRegex = /<div class=\"tF2Cxc\">([\s\S]*?)<\/div><\/div><\/div>/g;
  let match;

  while ((match = resultRegex.exec(html)) !== null && results.length < 10) {
    const block = match[1];
    const titleMatch = block.match(/<h3.*?>(.*?)<\/h3>/);
    const urlMatch = block.match(/<a href=\"(https?:\/\/[^\"]+)\">/);
    const snippetMatch = block.match(/<div class=\"VwiC3b yXK7lf MUxGbd yDYNvb lyLwlc\">([\s\S]*?)<\/div>/);
    const displayedLinkMatch = block.match(/<span class=\"VuuXrf\">.*?<span.*?>(.*?)<\/span>/);

    if (titleMatch && urlMatch && snippetMatch) {
      results.push({
        title: titleMatch[1].replace(/<[^>]+>/g, "").trim(),
        url: urlMatch[1].trim(),
        snippet: snippetMatch[1].replace(/<[^>]+>/g, "").trim(),
        displayed_link: displayedLinkMatch ? displayedLinkMatch[1].trim() : null,
        source: "Google"
      });
    }
  }
  return results;
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

try {
  const googleResults = await scrapeGoogle(query);
  if (googleResults.length) {
    setCache(query, googleResults);
    return new Response(JSON.stringify({ query, source: "Google", results: googleResults }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } else {
    throw new Error("Google returned no results");
  }
} catch (err) {
  const ddgResults = await scrapeDDG(query);
  setCache(query, ddgResults);
  return new Response(JSON.stringify({ query, source: "DuckDuckGo", fallback: true, results: ddgResults }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}

} };

