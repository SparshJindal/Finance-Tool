import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

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
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      return null;
    }

    // Clean up whitespace
    let cleanText = article.textContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();

    if (cleanText.length > maxLength) {
      cleanText = cleanText.substring(0, maxLength) + '...';
    }

    return cleanText.length > 50 ? cleanText : null;
  } catch (error) {
    // Silently fail and return null
    return null;
  }
}
