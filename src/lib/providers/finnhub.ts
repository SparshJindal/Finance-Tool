const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

export async function getCompanyProfile(ticker: string) {
  if (!FINNHUB_API_KEY) throw new Error("FINNHUB_API_KEY is not set");
  const res = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`);
  if (!res.ok) throw new Error(`Finnhub profile error: ${res.statusText}`);
  return res.json();
}

export async function getPeers(ticker: string) {
  if (!FINNHUB_API_KEY) throw new Error("FINNHUB_API_KEY is not set");
  const res = await fetch(`https://finnhub.io/api/v1/stock/peers?symbol=${ticker}&token=${FINNHUB_API_KEY}`);
  if (!res.ok) throw new Error(`Finnhub peers error: ${res.statusText}`);
  return res.json() as Promise<string[]>;
}
