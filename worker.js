const cache = new Map();
const MAX_CACHE = 50;

function setCache(key, value) {
  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, value);
}

function getCache(key) {
  return cache.get(key);
}

async function scrapeBing(q) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  });
  const html = await response.text();
  const results = [];

  const blockRegex = /<li class="b_algo".*?>([\s\S]*?)<\/li>/g;
  let match;

  while ((match = blockRegex.exec(html)) !== null && results.length < 10) {
    const block = match[1];
    const titleMatch = block.match(/<h2><a href="(.*?)".*?>(.*?)<\/a><\/h2>/);
    const snippetMatch = block.match(/<p>(.*?)<\/p>/);

    if (titleMatch) {
      results.push({
        title: titleMatch[2].replace(/<[^>]+>/g, "").trim(),
        url: titleMatch[1].trim(),
        snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "",
        displayed_link: null,
        source: "Bing"
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

export default {
  async fetch(request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query) {
      return new Response(JSON.stringify({
        error: "Missing query parameter ?query="
      }), { status: 400 });
    }

    const cached = getCache(query);
    if (cached) {
      return new Response(JSON.stringify({ query, cached: true, results: cached }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
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
  }
};
