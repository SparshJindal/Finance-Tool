import * as cheerio from 'cheerio';

export async function fetchArticleExcerpt(url: string, maxLength: number = 1500): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove noisy elements that aren't the article body
    $('script, style, noscript, iframe, svg, nav, footer, header, aside, .ad, .advertisement, .social-share').remove();

    // Try to find the main article container first
    let mainContent = $('article, main, .article-content, .post-content, .entry-content').text();
    
    // If no specific container found, fall back to the whole body
    if (!mainContent || mainContent.trim().length < 200) {
      mainContent = $('body').text();
    }

    // Clean up whitespace
    let cleanText = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();

    if (cleanText.length > maxLength) {
      cleanText = cleanText.substring(0, maxLength) + '...';
    }

    return cleanText.length > 50 ? cleanText : null;
  } catch (error) {
    // console.error(`[fetchArticleExcerpt] Failed to fetch ${url}:`, error);
    return null; // Silently fail and return null
  }
}
