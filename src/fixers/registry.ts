/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Registre centralisé des correcteurs prépresse déterministes
 */

import { FixerDefinition, FixerId, FixPlan } from './types';
import { boxFixer } from './boxFixer';
import { structFixer } from './structFixer';
import { secFixer } from './secFixer';
import { annotFixer } from './annotFixer';
import { hairlineFixer } from './hairlineFixer';
import { colorFeasibilityFixer } from './colorFeasibility';
import { PrintProfile } from '../profiles/types';
import { RuleCheckResult } from '../rules/types';

export const FIXER_REGISTRY_VERSION = '1.0.0';

export const ALL_FIXERS: FixerDefinition[] = [
  boxFixer,
  structFixer,
  secFixer,
  annotFixer,
  hairlineFixer,
  colorFeasibilityFixer,
];

export function getFixerById(id: FixerId | string): FixerDefinition | undefined {
  return ALL_FIXERS.find(f => f.id === id);
}

export function getAllFixers(): FixerDefinition[] {
  return [...ALL_FIXERS];
}

export function getFixersForRule(ruleId: string): FixerDefinition[] {
  return ALL_FIXERS.filter(f => f.ruleIds.includes(ruleId));
}

export async function getApplicableFixers(findings: RuleCheckResult[], profile: PrintProfile): Promise<FixPlan[]> {
  const plans: FixPlan[] = [];
  for (const fixer of ALL_FIXERS) {
    try {
      const plan = await fixer.plan(findings, profile);
      if (plan.applicable) {
        plans.push(plan);
      }
    } catch {
      // Ignorer si échec de planification
    }
  }
  return plans;
}

/**
 * Génère automatiquement la documentation markdown docs/FIXER_CATALOG.md directement depuis le code
 */
export function generateFixerCatalogMarkdown(): string {
  let md = `# Référentiel des Correcteurs Prépresse Déterministes — Check MyFile\n\n`;
  md += `*Version du registre : ${FIXER_REGISTRY_VERSION} — Généré automatiquement depuis le code source (\`src/fixers/registry.ts\`)*\n\n`;
  md += `## Principes Fondamentaux de la Correction Déterministe\n\n`;
  md += `1. **Fonction pure** : \`(octets_in, profil, options) → (octets_out, journal)\`. Même entrée binaire + mêmes options = mêmes octets en sortie au bit près (aucun horodatage variable, aucune IA, aucun aléatoire).\n`;
  md += `2. **Immutabilité de l’original** : L’original utilisateur n’est jamais modifié ; une copie est produite.\n`;
  md += `3. **Re-vérification obligatoire (Porte de validation)** : Le même moteur d’inspection est relancé sur la copie. La règle ciblée doit obligatoirement s’améliorer, et aucune autre règle ne doit régresser. Sinon, le fichier produit est rejeté en bloc avec motif explicite.\n`;
  md += `4. **Idempotence** : Appliquer le correcteur une seconde fois sur sa propre sortie produit un résultat identique sans effet secondaire.\n`;
  md += `5. **Zéro contenu inventé** : Pas de débord étiré artificiellement par miroir, pas d’incorporation synthétique de polices sans fichier, pas de vectorisation destructive.\n`;
  md += `6. **Classification des risques** :\n`;
  md += `   - **Niveau 1 (Structurel)** : Ne touche à aucun élément visuel (TrimBox, nettoyage d'annotations, réparation xref). Application en un clic.\n`;
  md += `   - **Niveau 2 (Contenu)** : Modifie certains tracés géométriques (épaississement de filets). Confirmation explicite requise.\n`;
  md += `   - **Niveau 3 (Rendu / Couleur)** : Conversion chromatique (RVB vers CMJN). Confirmation explicite et documentation de licence.\n\n`;

  md += `## Catalogue des Correcteurs Implémentés\n\n`;

  for (const fixer of ALL_FIXERS) {
    const riskBadge = fixer.riskLevel === 1 
      ? '🟢 Niveau 1 (Structurel — Sans modification visuelle)'
      : fixer.riskLevel === 2
      ? '🟡 Niveau 2 (Modification de tracé / contenu)'
      : '🔴 Niveau 3 (Rendu / Espace colorimétrique)';

    md += `### ${fixer.id} — ${fixer.name}\n\n`;
    md += `- **Version** : \`${fixer.version}\`\n`;
    md += `- **Niveau de risque** : ${riskBadge}\n`;
    md += `- **Règles ciblées** : ${fixer.ruleIds.map(r => `\`${r}\``).join(', ')}\n`;
    md += `- **Statut** : ${fixer.isExperimental ? '⚠️ *Étude de faisabilité / Expérimental*' : '✅ *Production / Actif*'}\n`;
    md += `- **Description** : ${fixer.description}\n`;
    md += `- **Objectif métier** : ${fixer.businessObjective}\n\n`;

    md += `#### Outils et Déterminisme\n`;
    for (const tool of fixer.tools) {
      md += `- **Outil** : \`${tool.name}\` (version épinglée : \`${tool.version}\`${tool.license ? `, licence : ${tool.license}` : ''})\n`;
      md += `  - Options déterministes : \`${tool.deterministicOptions.join(' ')}\`\n`;
    }
    md += `\n`;

    md += `#### Préconditions\n`;
    for (const p of fixer.preconditions) {
      md += `- ${p}\n`;
    }
    md += `\n`;

    md += `#### Limites et Garde-fous\n`;
    for (const l of fixer.limits) {
      md += `- ${l}\n`;
    }
    md += `\n`;

    md += `#### Éléments Rigoureusement Intouchés\n`;
    for (const u of fixer.untouchedAspects) {
      md += `- ${u}\n`;
    }
    md += `\n---\n\n`;
  }

  return md;
}
