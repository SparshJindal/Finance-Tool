export type SourceTier = 1 | 2 | 3

export function sourceTier(source: string, url?: string): SourceTier {
  const s = source.toLowerCase()
  const u = url ? url.toLowerCase() : ''

  const t1Names = [
    'reuters', 'bloomberg', 'cnbc', 'wsj', 'financial times', 'apnews', 'associated press',
    'the economic times', 'livemint', 'moneycontrol', 'business standard'
  ]
  const t1Urls = [
    'reuters.com', 'bloomberg.com', 'cnbc.com', 'wsj.com', 'ft.com', 'apnews.com',
    'economictimes.indiatimes.com', 'livemint.com', 'moneycontrol.com', 'business-standard.com',
    'sec.gov', 'gcs-web.com', 'investor-relations', 'investors.'
  ]

  if (t1Names.some(x => s.includes(x)) || t1Urls.some(x => u.includes(x))) {
    return 1
  }

  const t3Names = [
    'foreignpolicyjournal', 'mediapost', 'simplywall', 'motley fool', 
    'prnewswire', 'globenewswire', 'businesswire', 'seeking alpha pr', 'seekingalpha pr'
  ]
  const t3Urls = [
    'foreignpolicyjournal.com', 'mediapost.com', 'simplywall.st', 'fool.com',
    'prnewswire.com', 'globenewswire.com', 'businesswire.com', 'blogspot.com', 'medium.com'
  ]

  if (t3Names.some(x => s.includes(x)) || t3Urls.some(x => u.includes(x))) {
    return 3
  }

  return 2
}
