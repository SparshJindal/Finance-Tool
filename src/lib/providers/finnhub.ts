const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

export async function getCompanyProfile(ticker: string) {
  if (!FINNHUB_API_KEY) return {};
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`);
    if (!res.ok) return {};
    return await res.json();
  } catch (error) {
    console.error(`[Finnhub Profile Error] ${ticker}:`, error);
    return {};
  }
}

export async function getPeers(ticker: string): Promise<string[]> {
  if (!FINNHUB_API_KEY) return [];
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/peers?symbol=${ticker}&token=${FINNHUB_API_KEY}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error(`[Finnhub Peers Error] ${ticker}:`, error);
    return [];
  }
}

export async function getEarningsCalendar(ticker: string, fromISO: string, toISO: string): Promise<any[]> {
  if (!FINNHUB_API_KEY) return [];
  try {
    const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${fromISO.split('T')[0]}&to=${toISO.split('T')[0]}&symbol=${ticker}&token=${FINNHUB_API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.earningsCalendar ?? [];
  } catch (error) {
    console.error(`[Finnhub EarningsCalendar Error] ${ticker}:`, error);
    return [];
  }
}

export async function getEarningsSurprises(ticker: string): Promise<any[]> {
  if (!FINNHUB_API_KEY) return [];
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${ticker}&token=${FINNHUB_API_KEY}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error(`[Finnhub EarningsSurprises Error] ${ticker}:`, error);
    return [];
  }
}
