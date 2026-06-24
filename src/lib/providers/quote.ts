export async function fetchQuote(ticker: string, exchange: string): Promise<{ priceChangePct: number, volumeRatio: number } | null> {
  try {
    let symbol = ticker;
    if (exchange === "NSE") {
      symbol = `${ticker}.NS`;
    } else if (exchange === "BSE") {
      symbol = `${ticker}.BO`;
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return null;
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    const volumes = result.indicators?.quote?.[0]?.volume;

    if (!meta || !meta.regularMarketPrice || !meta.chartPreviousClose || !volumes || volumes.length === 0) {
      return null;
    }

    const currentPrice = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    const priceChangePct = ((currentPrice - prevClose) / prevClose) * 100;

    // The last element is today's volume. The others are previous days.
    const todayVolume = volumes[volumes.length - 1] || 0;
    
    // Calculate average volume over the available days (up to 5)
    let validVolumes = volumes.filter((v: number | null) => v !== null && v > 0);
    if (validVolumes.length === 0) {
      return { priceChangePct, volumeRatio: 1.0 }; // Fallback if volume is totally missing
    }

    const totalVolume = validVolumes.reduce((a: number, b: number) => a + b, 0);
    const avgVolume = totalVolume / validVolumes.length;
    
    const volumeRatio = todayVolume / avgVolume;

    return {
      priceChangePct: parseFloat(priceChangePct.toFixed(2)),
      volumeRatio: parseFloat(volumeRatio.toFixed(2))
    };
  } catch (error) {
    console.error(`[fetchQuote] Error fetching quote for ${ticker} (${exchange}):`, error);
    return null;
  }
}
