/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Registre des profils d'impression prépresse 100% paramétriques
 */

import { PrintProfile, ProfileRegistryMetadata } from './types';

export const PROFILE_REGISTRY_VERSION = '2.0.0';

const WORKSHOP_NOTE = "Convention d'atelier, à valider par un imprimeur";

export const DEFAULT_PROFILES: PrintProfile[] = [
  {
    id: 'a4',
    version: '2.0.0',
    name: 'Flyer / Affiche A4 (210 × 297 mm)',
    description: 'Format standard européen pour dépliants, tracts, fiches techniques et affiches courantes',
    productType: 'commercial_print',
    widthMm: 210,
    heightMm: 297,
    orientation: 'portrait',
    dimensionToleranceMm: 0.5,

    bleed: { topMm: 5, bottomMm: 5, leftMm: 5, rightMm: 5 },
    requiredBleedMm: 5,

    criticalSafetyMarginMm: 4,
    advisorySafetyMarginMm: 10,
    requiredSafetyMarginMm: 10,

    criticalTextSizePt: 5,
    advisoryTextSizePt: 8,
    minTextSizePt: 8,

    criticalStrokeWidthPt: 0.25,
    advisoryStrokeWidthPt: 0.5,
    minStrokeWidthPt: 0.5,

    criticalImageDpi: 150,
    advisoryImageDpi: 300,

    allowedColorSpaces: ['DeviceCMYK', 'DeviceGray', 'Separation', 'ICCBased'],
    rgbAllowed: false,
    outputIntentRequired: false,
    prohibitRichBlackText: true,

    transparencyPolicy: 'discouraged',
    pdfxStandard: 'PDF/X-4',
    workshopConventionNote: WORKSHOP_NOTE,
    notes: 'Profil polyvalent offset feuille et presse numérique haute cadence.',
  },
  {
    id: 'a5',
    version: '2.0.0',
    name: 'Flyer A5 (148 × 210 mm)',
    description: 'Format demi-A4 économique idéal pour prospectus événementiels et flyers de distribution',
    productType: 'commercial_print',
    widthMm: 148,
    heightMm: 210,
    orientation: 'portrait',
    dimensionToleranceMm: 0.5,

    bleed: { topMm: 3, bottomMm: 3, leftMm: 3, rightMm: 3 },
    requiredBleedMm: 3,

    criticalSafetyMarginMm: 3,
    advisorySafetyMarginMm: 5,
    requiredSafetyMarginMm: 5,

    criticalTextSizePt: 5,
    advisoryTextSizePt: 7,
    minTextSizePt: 7,

    criticalStrokeWidthPt: 0.25,
    advisoryStrokeWidthPt: 0.5,
    minStrokeWidthPt: 0.5,

    criticalImageDpi: 150,
    advisoryImageDpi: 300,

    allowedColorSpaces: ['DeviceCMYK', 'DeviceGray', 'Separation', 'ICCBased'],
    rgbAllowed: false,
    outputIntentRequired: false,
    prohibitRichBlackText: true,

    transparencyPolicy: 'discouraged',
    pdfxStandard: 'PDF/X-4',
    workshopConventionNote: WORKSHOP_NOTE,
    notes: 'Exigences allégées adaptées aux dimensions compactes.',
  },
  {
    id: 'business_card',
    version: '2.0.0',
    name: 'Carte de Visite (85 × 55 mm)',
    description: 'Format bancaire standard pour cartes professionnelles et cartes de fidélité',
    productType: 'stationery',
    widthMm: 85,
    heightMm: 55,
    orientation: 'landscape',
    dimensionToleranceMm: 0.3,

    bleed: { topMm: 2, bottomMm: 2, leftMm: 2, rightMm: 2 },
    requiredBleedMm: 2,

    criticalSafetyMarginMm: 2,
    advisorySafetyMarginMm: 4,
    requiredSafetyMarginMm: 4,

    criticalTextSizePt: 4.5,
    advisoryTextSizePt: 6,
    minTextSizePt: 6,

    criticalStrokeWidthPt: 0.2,
    advisoryStrokeWidthPt: 0.4,
    minStrokeWidthPt: 0.4,

    criticalImageDpi: 200,
    advisoryImageDpi: 350,

    allowedColorSpaces: ['DeviceCMYK', 'DeviceGray', 'Separation', 'ICCBased'],
    rgbAllowed: false,
    outputIntentRequired: false,
    prohibitRichBlackText: true,

    transparencyPolicy: 'forbidden',
    pdfxStandard: 'PDF/X-1a',
    workshopConventionNote: WORKSHOP_NOTE,
    notes: 'Marge resserrée pour maximiser la surface utile ; aplatissement obligatoire pour massicotage rotatif.',
  },
  {
    id: 'brochure_a4',
    version: '2.0.0',
    name: 'Brochure A4 piquée (210 × 297 mm)',
    description: 'Catalogues, magazines agrafés 2 points métal et rapports annuels',
    productType: 'publishing',
    widthMm: 210,
    heightMm: 297,
    orientation: 'portrait',
    dimensionToleranceMm: 0.5,

    bleed: { topMm: 5, bottomMm: 5, leftMm: 5, rightMm: 5 },
    requiredBleedMm: 5,

    criticalSafetyMarginMm: 6,
    advisorySafetyMarginMm: 12,
    requiredSafetyMarginMm: 12,

    criticalTextSizePt: 5,
    advisoryTextSizePt: 8,
    minTextSizePt: 8,

    criticalStrokeWidthPt: 0.25,
    advisoryStrokeWidthPt: 0.5,
    minStrokeWidthPt: 0.5,

    criticalImageDpi: 180,
    advisoryImageDpi: 300,

    allowedColorSpaces: ['DeviceCMYK', 'DeviceGray', 'Separation', 'ICCBased'],
    rgbAllowed: false,
    outputIntentRequired: true,
    prohibitRichBlackText: true,

    transparencyPolicy: 'discouraged',
    pdfxStandard: 'PDF/X-4',
    workshopConventionNote: WORKSHOP_NOTE,
    notes: 'Marge intérieure de 12 mm requise pour compenser la chasse au pli et l’agrafage.',
  },
  {
    id: 'square_150',
    version: '2.0.0',
    name: 'Dépliant Carré (150 × 150 mm)',
    description: 'Faire-part, livrets carrés créatifs, invitations et cartons d’annonce',
    productType: 'commercial_print',
    widthMm: 150,
    heightMm: 150,
    orientation: 'any',
    dimensionToleranceMm: 0.5,

    bleed: { topMm: 3, bottomMm: 3, leftMm: 3, rightMm: 3 },
    requiredBleedMm: 3,

    criticalSafetyMarginMm: 4,
    advisorySafetyMarginMm: 8,
    requiredSafetyMarginMm: 8,

    criticalTextSizePt: 5,
    advisoryTextSizePt: 8,
    minTextSizePt: 8,

    criticalStrokeWidthPt: 0.25,
    advisoryStrokeWidthPt: 0.5,
    minStrokeWidthPt: 0.5,

    criticalImageDpi: 150,
    advisoryImageDpi: 300,

    allowedColorSpaces: ['DeviceCMYK', 'DeviceGray', 'Separation', 'ICCBased', 'DeviceRGB'],
    rgbAllowed: true, // Autorisé en presse numérique grand public avec conversion RVB
    outputIntentRequired: false,
    prohibitRichBlackText: false,

    transparencyPolicy: 'allowed',
    pdfxStandard: 'none',
    workshopConventionNote: WORKSHOP_NOTE,
    notes: 'Format moderne de communication événementielle, souvent imprimé en numérique direct.',
  },
  {
    id: 'large_format_a3',
    version: '2.0.0',
    name: 'Affiche A3 (297 × 420 mm)',
    description: 'Signalétique intérieure, affiches vitrines et posters promotionnels',
    productType: 'large_format',
    widthMm: 297,
    heightMm: 420,
    orientation: 'portrait',
    dimensionToleranceMm: 1.0,

    bleed: { topMm: 5, bottomMm: 5, leftMm: 5, rightMm: 5 },
    requiredBleedMm: 5,

    criticalSafetyMarginMm: 8,
    advisorySafetyMarginMm: 15,
    requiredSafetyMarginMm: 15,

    criticalTextSizePt: 6,
    advisoryTextSizePt: 10,
    minTextSizePt: 10,

    criticalStrokeWidthPt: 0.35,
    advisoryStrokeWidthPt: 0.75,
    minStrokeWidthPt: 0.75,

    criticalImageDpi: 120, // Grand format : tolérance plus basse sur la résolution
    advisoryImageDpi: 240,

    allowedColorSpaces: ['DeviceCMYK', 'DeviceGray', 'Separation', 'ICCBased'],
    rgbAllowed: false,
    outputIntentRequired: false,
    prohibitRichBlackText: false,

    transparencyPolicy: 'discouraged',
    pdfxStandard: 'PDF/X-4',
    workshopConventionNote: WORKSHOP_NOTE,
    notes: 'Marge de 15 mm et corps 10 pt recommandés pour garantir la lisibilité à distance.',
  },
];

export function getProfileById(id: string): PrintProfile | undefined {
  return DEFAULT_PROFILES.find(p => p.id === id);
}

export function getAllProfiles(): PrintProfile[] {
  return [...DEFAULT_PROFILES];
}

export function getProfilesByProductType(type: PrintProfile['productType']): PrintProfile[] {
  return DEFAULT_PROFILES.filter(p => p.productType === type);
}

export function createCustomProfile(params: {
  widthMm: number;
  heightMm: number;
  requiredBleedMm?: number;
  criticalSafetyMarginMm?: number;
  advisorySafetyMarginMm?: number;
  criticalTextSizePt?: number;
  advisoryTextSizePt?: number;
  criticalStrokeWidthPt?: number;
  advisoryStrokeWidthPt?: number;
  criticalImageDpi?: number;
  advisoryImageDpi?: number;
  pdfxStandard?: PrintProfile['pdfxStandard'];
  rgbAllowed?: boolean;
}): PrintProfile {
  const width = Math.max(10, Number(params.widthMm) || 210);
  const height = Math.max(10, Number(params.heightMm) || 297);
  const bleedVal = Math.max(0, Number(params.requiredBleedMm ?? 5));
  const advSafety = Math.max(2, Number(params.advisorySafetyMarginMm ?? 10));
  const critSafety = Math.max(1, Number(params.criticalSafetyMarginMm ?? Math.round(advSafety / 2)));
  const advText = Math.max(4, Number(params.advisoryTextSizePt ?? 8));
  const critText = Math.max(3, Number(params.criticalTextSizePt ?? 5));
  const advStroke = Math.max(0.1, Number(params.advisoryStrokeWidthPt ?? 0.5));
  const critStroke = Math.max(0.05, Number(params.criticalStrokeWidthPt ?? 0.25));
  const advDpi = Math.max(100, Number(params.advisoryImageDpi ?? 300));
  const critDpi = Math.max(72, Number(params.criticalImageDpi ?? 150));

  return {
    id: 'custom',
    version: '2.0.0',
    name: `Personnalisé (${width} × ${height} mm)`,
    description: 'Profil sur-mesure défini par l’utilisateur pour son support spécifique',
    productType: 'custom',
    widthMm: width,
    heightMm: height,
    orientation: width > height ? 'landscape' : width === height ? 'any' : 'portrait',
    dimensionToleranceMm: 0.5,

    bleed: { topMm: bleedVal, bottomMm: bleedVal, leftMm: bleedVal, rightMm: bleedVal },
    requiredBleedMm: bleedVal,

    criticalSafetyMarginMm: critSafety,
    advisorySafetyMarginMm: advSafety,
    requiredSafetyMarginMm: advSafety,

    criticalTextSizePt: critText,
    advisoryTextSizePt: advText,
    minTextSizePt: advText,

    criticalStrokeWidthPt: critStroke,
    advisoryStrokeWidthPt: advStroke,
    minStrokeWidthPt: advStroke,

    criticalImageDpi: critDpi,
    advisoryImageDpi: advDpi,

    allowedColorSpaces: ['DeviceCMYK', 'DeviceGray', 'Separation', 'ICCBased', 'DeviceRGB'],
    rgbAllowed: params.rgbAllowed ?? true,
    outputIntentRequired: false,
    prohibitRichBlackText: false,

    transparencyPolicy: 'allowed',
    pdfxStandard: params.pdfxStandard || 'none',
    workshopConventionNote: WORKSHOP_NOTE,
    isCustom: true,
  };
}

export const PROFILE_REGISTRY_METADATA: ProfileRegistryMetadata = {
  registryVersion: PROFILE_REGISTRY_VERSION,
  lastUpdated: '2026-11-11',
  profilesCount: DEFAULT_PROFILES.length,
  profiles: DEFAULT_PROFILES,
};
