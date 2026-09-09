/**
 * @file synthesizer.ts
 * @description Central Personality Profile Synthesizer.
 * Integrates natalengine calculations, Gene Keys archetypes, center themes, and Markdown generation.
 */

// @ts-ignore - natalengine does not have bundled TS declaration files
import { calculateHumanDesign, calculateGeneKeys } from 'natalengine';
import { generateNarrative } from './narrative-generator.ts';
import { generateProfileMarkdown } from './markdown-generator.ts';
import { geneKeyArchetypes } from './data/gene-key-archetypes.ts';
import { centerThemes } from './data/center-themes.ts';

export interface SynthesizeOptions {
  birthDate: string; // YYYY-MM-DD
  birthHour?: number; // Decimal hours (e.g. 14.5 for 2:30 PM)
  timezone?: number; // UTC offset (e.g. -5, 0, +2)
  birthLocation?: string;
}

export function synthesizeProfile({
  birthDate,
  birthHour = 12.0,
  timezone = 0,
  birthLocation = ''
}: SynthesizeOptions) {
  if (!birthDate) {
    throw new Error('birthDate (YYYY-MM-DD) is required');
  }

  // 1. Calculate Human Design chart via natalengine
  const hd = calculateHumanDesign(birthDate, Number(birthHour), Number(timezone));

  // 2. Derive Gene Keys profile via natalengine
  const gk = calculateGeneKeys(hd);

  // 3. Enrich Gene Keys sequences with rich archetype data
  const enrichKey = (keyObj: any) => {
    if (!keyObj || !keyObj.key) return null;
    const arch = (geneKeyArchetypes as any)[keyObj.key] || {};
    return {
      ...keyObj,
      name: arch.name || keyObj.name,
      shadow: keyObj.shadow || arch.shadow,
      gift: keyObj.gift || arch.gift,
      siddhi: keyObj.siddhi || arch.siddhi,
      codonRing: arch.codonRing || '',
      amino: arch.amino || '',
      description: arch.description || '',
      shadowDescription: arch.shadowDescription || '',
      giftDescription: arch.giftDescription || '',
      siddhiDescription: arch.siddhiDescription || ''
    };
  };

  const enrichedActivation = {
    lifeWork: enrichKey(gk.activationSequence?.lifeWork),
    evolution: enrichKey(gk.activationSequence?.evolution),
    radiance: enrichKey(gk.activationSequence?.radiance),
    purpose: enrichKey(gk.activationSequence?.purpose)
  };

  const enrichedVenus = {
    attraction: enrichKey(gk.venusSequence?.attraction),
    iq: enrichKey(gk.venusSequence?.iq),
    eq: enrichKey(gk.venusSequence?.eq),
    sq: enrichKey(gk.venusSequence?.sq)
  };

  const enrichedPearl = {
    vocation: enrichKey(gk.pearlSequence?.vocation),
    culture: enrichKey(gk.pearlSequence?.culture),
    pearl: enrichKey(gk.pearlSequence?.pearl)
  };

  // 4. Enrich Centers with thematic wisdom and health tips
  const definedKeys = new Set(((hd.centers?.defined || []) as any[]).map((c: any) => c.key || c.name?.toLowerCase()));
  const allCenters = [
    'head', 'ajna', 'throat', 'g', 'heart', 'sacral', 'solar', 'spleen', 'root'
  ].map(key => {
    const isDefined = definedKeys.has(key);
    const theme = (centerThemes as any)[key] || {};
    return {
      key,
      name: theme.name || key.toUpperCase(),
      defined: isDefined,
      biological: theme.biologicalCorrelation || '',
      themeSummary: isDefined ? theme.definedTheme : theme.undefinedTheme,
      strengths: isDefined ? theme.definedStrengths : theme.undefinedWisdom,
      healthTip: theme.healthTip || '',
      questionForReflection: theme.questionForReflection || ''
    };
  });

  // 5. Generate Bespoke Narrative Synthesis
  const narrative = generateNarrative(hd, gk);

  const baseResult = {
    meta: {
      birthDate,
      birthHour,
      timezone,
      birthLocation,
      generatedAt: new Date().toISOString()
    },
    identity: {
      type: hd.type,
      authority: hd.authority,
      profile: hd.profile,
      definition: hd.definition,
      incarnationCross: hd.incarnationCross,
      variable: hd.variable,
      channelsCount: (hd.channels || []).length,
      channels: hd.channels || []
    },
    geneKeys: {
      activationSequence: enrichedActivation,
      venusSequence: enrichedVenus,
      pearlSequence: enrichedPearl,
      primeGifts: gk.primeGifts || [],
      core: enrichKey(gk.core)
    },
    centers: allCenters,
    narrative
  };

  // Generate complete Markdown representation
  const markdown = generateProfileMarkdown(baseResult);

  return {
    ...baseResult,
    markdown
  };
}
