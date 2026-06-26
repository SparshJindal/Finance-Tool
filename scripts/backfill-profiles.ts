import { prisma } from '../src/lib/db';
import { generateHoldingProfile } from '../src/lib/providers/profile';

async function main() {
  console.log("Starting backfill for holding profiles...");
  
  const allHoldings = await prisma.holding.findMany();
  const holdings = allHoldings.filter((h: any) => !h.themes || h.themes.length === 0);

  console.log(`Found ${holdings.length} holdings with empty themes.`);

  for (const holding of holdings) {
    console.log(`Processing ${holding.ticker} - ${holding.company}...`);
    try {
      const profile = await generateHoldingProfile({
        ticker: holding.ticker,
        company: holding.company,
        thesis: holding.thesis || '',
        directionLogic: holding.directionLogic || 'LONG'
      });

      const allThemes = Array.from(new Set([...profile.aliases, ...profile.themes]));
      
      await prisma.holding.update({
        where: { id: holding.id },
        data: { themes: allThemes }
      });

      if (profile.competitors && profile.competitors.length > 0) {
        // Clear existing competitors to avoid duplicates since there's no unique constraint
        await prisma.competitor.deleteMany({
          where: { holdingId: holding.id }
        });

        const uniqueComps = Array.from(new Map(profile.competitors.filter(c => c.name).map(c => [c.name, c])).values());
        for (const comp of uniqueComps) {
          await prisma.competitor.create({
            data: {
              holdingId: holding.id,
              name: comp.name,
              ticker: comp.ticker || ""
            }
          });
        }
      }
      console.log(`  -> Saved themes: ${allThemes.join(', ')}`);
      console.log(`  -> Saved competitors: ${profile.competitors.map((c: any) => c.name).join(', ')}`);
    } catch (e) {
      console.error(`Failed to backfill ${holding.ticker}:`, e);
    }
    
    // Slight delay to avoid hitting rate limits too hard if there are many
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("Backfill complete.");
}

main().catch(console.error).finally(() => process.exit(0));
