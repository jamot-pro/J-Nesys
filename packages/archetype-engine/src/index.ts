/**
 * @file index.ts
 * @description Main entry point for @jamot/archetype-engine
 */

export * from './synthesizer.ts';
export * from './markdown-generator.ts';
export * from './narrative-generator.ts';
export { geneKeyArchetypes } from './data/gene-key-archetypes.ts';
export { typeNarratives, authorityNarratives, profileNarratives } from './data/hd-type-narratives.ts';
export { centerThemes } from './data/center-themes.ts';
