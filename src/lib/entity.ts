export interface ResolvedEntity {
  canonicalName: string;
  aliases: string[];
  negativeAliases: string[];
}

export function resolveEntity(ticker: string, exchange: string = 'US', companyName: string): ResolvedEntity {
  const cleanTicker = ticker.split('.')[0].toUpperCase();
  const canonicalName = companyName;
  const aliases: string[] = [];
  const negativeAliases: string[] = [];
  
  if (cleanTicker === 'MU') {
    negativeAliases.push('Microchip', 'Microchip Technology', 'MCHP');
  } else if (cleanTicker === 'MCHP') {
    negativeAliases.push('Micron', 'Micron Technology', 'MU');
  } else if (cleanTicker === 'RELIANCE') {
    negativeAliases.push('Reliance Power', 'Reliance Infrastructure', 'Reliance Capital', 'Reliance Communications', 'Reliance Naval');
  } else if (cleanTicker === 'HDFCBANK') {
    negativeAliases.push('HDFC AMC', 'HDFC Life', 'HDFC ERGO');
  } else if (cleanTicker === 'AAPL') {
    negativeAliases.push('Alphabet', 'Google');
  } else if (cleanTicker === 'NVDA') {
    // SK Hynix is a frequent false-positive trigger where the event is attributed to NVDA
    negativeAliases.push('SK Hynix');
  }

  // Handle exchange suffix confusion if needed, though most India confusion is intra-market
  // E.g. .NS / .BO
  if (exchange === 'NS' || exchange === 'BO') {
    if (cleanTicker === 'TCS') {
      negativeAliases.push('TCS Group', 'Tinkoff');
    }
  }

  return {
    canonicalName,
    aliases,
    negativeAliases
  };
}
