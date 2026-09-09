/**
 * @file narrative-generator.ts
 * @description Generates bespoke personality synthesis narratives combining HD chart and Gene Keys output.
 */

import { typeNarratives, authorityNarratives, profileNarratives } from './data/hd-type-narratives.ts';
import { geneKeyArchetypes } from './data/gene-key-archetypes.ts';

export function generateNarrative(hd: any, gk: any, scoring?: any) {
  const typeName = (hd.type?.name?.replace(/\s+/g, '') || 'Generator') as keyof typeof typeNarratives;
  const typeInfo = (typeNarratives as any)[typeName] || (typeNarratives as any)[hd.type?.name] || (typeNarratives as any)['Generator'];
  
  const profileKey = (hd.profile?.numbers || '1/3') as keyof typeof profileNarratives;
  const profileInfo = (profileNarratives as any)[profileKey] || (profileNarratives as any)['1/3'];

  const authorityName = (hd.authority?.name || 'Sacral Authority') as keyof typeof authorityNarratives;
  const authorityInfo = (authorityNarratives as any)[authorityName] || (authorityNarratives as any)['Sacral Authority'] || {
    description: hd.authority?.description || "Make decisions following your natural internal compass.",
    howToDecide: "Pause and feel into the decision before acting from mental pressure.",
    waitingPeriod: "Varies depending on clarity."
  };

  const lifeWorkKeyNum = gk.activationSequence?.lifeWork?.key;
  const lifeWorkArchetype = (geneKeyArchetypes as any)[lifeWorkKeyNum] || {
    name: "Life's Theme",
    shadow: gk.activationSequence?.lifeWork?.shadow || "Shadow",
    gift: gk.activationSequence?.lifeWork?.gift || "Gift",
    siddhi: gk.activationSequence?.lifeWork?.siddhi || "Siddhi",
    description: "Your primary energy archetype for creative manifestation and worldly purpose."
  };

  const evolutionKeyNum = gk.activationSequence?.evolution?.key;
  const evolutionArchetype = (geneKeyArchetypes as any)[evolutionKeyNum];

  const crossName = hd.incarnationCross?.fullName || hd.incarnationCross?.name || "The Cross of Life Purpose";

  const summaryParagraph = `As a ${hd.type?.name} with a ${profileKey} (${profileInfo?.name || 'Pioneer'}) profile, you possess a distinct energetic blueprint. ${typeInfo?.description} Operating with ${authorityName}, ${authorityInfo?.description?.toLowerCase() || ''}`;

  const lifeThemeParagraph = `Your life theme centers around ${crossName}. In the Gene Keys framework, your Life's Work is anchored in Key ${lifeWorkKeyNum} (${lifeWorkArchetype.name || ''}), where your core growth catalyst lies in transmuting the shadow of ${lifeWorkArchetype.shadow} into the empowering gift of ${lifeWorkArchetype.gift}. At your highest resonance, this manifests as ${lifeWorkArchetype.siddhi}.`;

  const relationshipParagraph = `In relationships and personal connection, your ${hd.definition || 'definition'} provides an internal stability that pairs with your ${profileKey} dynamic. ${profileInfo?.personality || ''}`;

  const superpowers = [
    ...(typeInfo?.strengths || []),
    `${profileInfo?.name} dynamic: ${profileInfo?.theme || 'Adaptive perspective'}`,
    `Core Gift of ${lifeWorkArchetype.gift}: Ability to transform ${lifeWorkArchetype.shadow.toLowerCase()} into creative vitality`,
    ...(evolutionArchetype ? [`Evolutionary edge: Embodying ${evolutionArchetype.gift} in high-pressure situations`] : [])
  ];

  const growthEdges = [
    ...(typeInfo?.challenges || []),
    `Navigating the shadow of ${lifeWorkArchetype.shadow}: Catching reactive patterns before they dictate action`,
    `Honoring your ${authorityName}: Resisting mental urgency to make premature decisions`,
    `Aligning your signature: Cultivating ${hd.type?.signature || 'peace and satisfaction'} while noticing when ${hd.type?.notSelf || 'frustration'} arises`
  ];

  return {
    heroTagline: `The ${profileInfo?.name || 'Visionary'} ${hd.type?.name}`,
    oneLineEssence: `${typeInfo?.lifeTheme || 'Live your true design and embody your unique genius.'}`,
    summaryParagraph,
    lifeThemeParagraph,
    relationshipParagraph,
    superpowers,
    growthEdges,
    typeInfo,
    profileInfo,
    authorityInfo,
    lifeWorkArchetype
  };
}
