/**
 * @file markdown-generator.ts
 * @description Converts a synthesized Human Design & Gene Keys profile into a clean, comprehensive Markdown document ready to copy and export.
 */

function formatGeneKeySphere(sphereName: string, sphere: any): string {
  if (!sphere) return '';
  return `### ${sphereName}: Key ${sphere.key} — ${sphere.name}
- **Spectrum:** \`${sphere.shadow}\` (Shadow) ➔ \`${sphere.gift}\` (Gift) ➔ \`${sphere.siddhi}\` (Siddhi)
- **Codon Ring:** ${sphere.codonRing || 'N/A'}${sphere.amino ? ` (${sphere.amino})` : ''}
- **Core Theme:** ${sphere.description || 'N/A'}
- **Shadow Frequency:** ${sphere.shadowDescription || 'N/A'}
- **Gift Breakthrough:** ${sphere.giftDescription || 'N/A'}
- **Siddhi State:** ${sphere.siddhiDescription || 'N/A'}
`;
}

export function generateProfileMarkdown(profile: any): string {
  if (!profile) return '';

  const { identity, geneKeys, centers, narrative, meta } = profile;
  const act = geneKeys?.activationSequence || {};
  const ven = geneKeys?.venusSequence || {};
  const prl = geneKeys?.pearlSequence || {};

  const definedCenters = (centers || []).filter((c: any) => c.defined);
  const undefinedCenters = (centers || []).filter((c: any) => !c.defined);

  return `# Energetic Blueprint: Human Design × Gene Keys Report

> Generated on: ${new Date(meta?.generatedAt || Date.now()).toLocaleDateString()}  
> Birth Date: ${meta?.birthDate || 'N/A'} | Time: ${meta?.birthHour ? `${Math.floor(meta.birthHour)}:${Math.round((meta.birthHour % 1) * 60).toString().padStart(2, '0')}` : 'N/A'} | UTC Offset: ${meta?.timezone ?? 0} | Location: ${meta?.birthLocation || 'N/A'}

---

## 1. Core Identity & Mechanics

| Dimension | Placement | Description |
| :--- | :--- | :--- |
| **Energy Type** | **${identity?.type?.name || 'N/A'}** | ${identity?.type?.description || ''} |
| **Strategy** | **${identity?.type?.strategy || 'N/A'}** | How to navigate decisions and life opportunities |
| **Inner Authority** | **${identity?.authority?.name || 'N/A'}** | ${identity?.authority?.description || ''} |
| **Profile** | **${identity?.profile?.numbers || 'N/A'} (${identity?.profile?.name || 'N/A'})** | ${identity?.profile?.theme || ''} |
| **Definition** | **${identity?.definition || 'N/A'}** | Internal energetic connectivity |
| **Signature** | **${identity?.type?.signature || 'N/A'}** | Feeling of fulfillment when living in alignment |
| **Not-Self Theme** | **${identity?.type?.notSelf || 'N/A'}** | Primary indicator of resistance / conditioning |
| **Incarnation Cross** | **${identity?.incarnationCross?.fullName || identity?.incarnationCross?.name || 'N/A'}** | Macro life purpose and trajectory |

---

## 2. Synthesis & Essence

**Archetype:** ${narrative?.heroTagline || `${identity?.profile?.name} ${identity?.type?.name}`}  
*"${narrative?.oneLineEssence || ''}"*

### Energetic Dynamics
${narrative?.summaryParagraph || ''}

### Purpose & Evolution
${narrative?.lifeThemeParagraph || ''}

### Relational Dynamics
${narrative?.relationshipParagraph || ''}

### Core Strengths & Superpowers
${(narrative?.superpowers || []).map((s: string) => `- ${s}`).join('\n')}

### Evolutionary Growth Edges
${(narrative?.growthEdges || []).map((g: string) => `- ${g}`).join('\n')}

---

## 3. Centers Architecture (9 Centers)

### Defined Centers (Fixed & Consistent Energy)
${definedCenters.length > 0 ? definedCenters.map((c: any) => `
- **${c.name}** (Biological: ${c.biological || 'Internal system'})
  - *Theme:* ${c.themeSummary}
  - *Strengths:* ${c.strengths?.join(', ') || 'Consistent presence'}
  - *Inquiry:* "${c.questionForReflection || ''}"
`).join('') : '_None (Reflector blueprint)_'}

### Undefined / Open Centers (Receptors of Wisdom)
${undefinedCenters.length > 0 ? undefinedCenters.map((c: any) => `
- **${c.name}** (Biological: ${c.biological || 'Internal system'})
  - *Wisdom Potential:* ${c.themeSummary}
  - *Wisdom Lessons:* ${c.strengths?.join(', ') || 'Fluid perception'}
  - *Health & Care:* ${c.healthTip || 'Stay grounded in your authentic rhythm.'}
  - *Inquiry:* "${c.questionForReflection || ''}"
`).join('') : '_All centers defined_'}

---

## 4. Defined Channels
${(identity?.channels && identity.channels.length > 0) ? identity.channels.map((ch: any) => `
- **Channel of ${ch.name}** (Gates ${ch.gates?.join(' ➔ ')})
  - *Centers Connected:* ${ch.centers?.join(' & ')}
  - *Circuitry:* ${ch.circuit || 'Individual'} (${ch.subcircuit || 'Core'})
  - *Theme:* ${ch.theme || 'Specialized gift'}
`).join('') : '_No defined channels (Open BodyGraph)_'}

---

## 5. Gene Keys: The Hologenetic Profile

### A. Activation Sequence (Primary Purpose & Vitality)
${formatGeneKeySphere("Life's Work (Conscious Sun)", act.lifeWork)}
${formatGeneKeySphere("Evolution (Conscious Earth)", act.evolution)}
${formatGeneKeySphere("Radiance (Unconscious Sun)", act.radiance)}
${formatGeneKeySphere("Purpose (Unconscious Earth)", act.purpose)}

### B. Venus Sequence (Emotional Opening & Relationships)
${formatGeneKeySphere("Attraction (Unconscious Moon)", ven.attraction)}
${formatGeneKeySphere("IQ — Mental Patterns (Conscious Mars/Venus)", ven.iq)}
${formatGeneKeySphere("EQ — Emotional Patterns (Conscious Mars/Venus)", ven.eq)}
${formatGeneKeySphere("SQ — Spiritual Essence (Unconscious Venus)", ven.sq)}

### C. Pearl Sequence (Prosperity & Service)
${formatGeneKeySphere("Vocation / Core Wound (Unconscious Mars)", prl.vocation)}
${formatGeneKeySphere("Culture (Unconscious Jupiter)", prl.culture)}
${formatGeneKeySphere("Pearl (Conscious Jupiter)", prl.pearl)}

---

## 6. Daily Contemplation Guide

1. **Strategy Alignment:** Practice your strategy (*${identity?.type?.strategy}*) daily before committing time or energetic resources.
2. **Authority Check:** When decisions arise, honor your *${identity?.authority?.name}* rather than acting from mental urgency.
3. **Shadow Transformation:** When feeling *${act.lifeWork?.shadow || 'contracted'}*, pause and inquire: *"How can I transmute this into ${act.lifeWork?.gift || 'creative expression'}?"*
4. **Signature Realization:** Look for moments of *${identity?.type?.signature}* as validation that you are honoring your true design.

---
*Generated by Archetype Engine (Human Design × Gene Keys)*
`;
}
