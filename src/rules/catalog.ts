/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Référentiel centralisé des règles de contrôle prépresse (14 règles)
 */

import { PreflightRule, RuleCatalogMetadata } from './types';

export const RULE_CATALOG_VERSION = '2.2.0';

/**
 * Liste unique officielle des contrôles non couverts dans cette version de prototype.
 * Cette constante est partagée entre le moteur, l'UI, le rapport PDF et la documentation.
 */
export const UNCOVERED_CHECKS_CATALOG: string[] = [
  'Séparation des formes de découpe, vernis sélectifs et dorures à chaud (tons directs dédiés)',
  'Vectorisation des polices bitmap Type 3 exotiques et émulations synthétiques de faux gras',
  'Validation colorimétrique par profil ICC de presse cible étalonné (épreuve contractuelle FOGRA51/52)',
  'Compensation mécanique de la chasse au pli sur cahiers épais multipages (> 64 pages agrafées)',
  'Génération dynamique des traits de coupe et repères de repérage lors de l’imposition RIP',
];

export const PREFLIGHT_RULES: PreflightRule[] = [
  // 1. GÉOMÉTRIE : BLEED-01
  {
    id: 'BLEED-01',
    name: 'Fond perdu requis (4 côtés)',
    version: '2.0.0',
    category: 'geometry',
    objective: 'Éviter l’apparition d’un liséré blanc après massicotage en garantissant un débord suffisant de la feuille.',
    businessDescription: 'Le document doit présenter un fond perdu sur chacun des 4 côtés (haut, bas, gauche, droite) au moins égal à l’exigence du profil.',
    technicalDefinition: 'Mesure de BleedBox ou MediaBox par rapport à la TrimBox : Math.min(top, bottom, left, right) >= profile.bleed.',
    parameters: [
      { key: 'requiredBleedMm', name: 'Fond perdu requis', unit: 'mm', description: 'Débord minimum exigé par le profil d’impression' },
    ],
    primaryUnit: 'mm',
    detectionMethod: 'pdf_box_math',
    detectionMethodDescription: 'Calcul différentiel entre la TrimBox et la BleedBox/MediaBox mesurées sur chaque bord.',
    applicationConditions: 'Appliqué à chaque page du document. Exige une TrimBox identifiable.',
    defaultSeverity: 'BLOCKING',
    knownLimitations: [
      'Si la TrimBox est absente, le débord ne peut pas être mesuré avec certitude et passe en NOT_VERIFIABLE.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Fond perdu (4 côtés)',
      passSummary: 'Fond perdu conforme sur tous les côtés du document.',
      failBlockingSummary: 'Fond perdu insuffisant ou manquant sur au moins un côté (risque de liseré blanc à la coupe).',
      failAdvisorySummary: 'Fond perdu légèrement inférieur à la recommandation d’atelier.',
      notVerifiableSummary: 'TrimBox absente du PDF : impossibilité de mesurer le fond perdu sans inventer la ligne de coupe.',
      notApplicableSummary: 'Non applicable sur ce type de produit.',
      atelierRecommendation: 'Ajoutez le débord requis dans votre logiciel de mise en page (ex: 5 mm) et exportez en cochant "Utiliser les paramètres de fond perdu du document".',
    },
    professionalPhrasing: 'Débord de matière suffisant au-delà du format fini pour tolérer les micro-décalages de massicot.',
    technicalReferences: [
      { name: 'ISO 15930-7 (PDF/X-4)', standard: 'ISO 15930-7', section: 'Clause 6.2.2', verified: false },
      { name: 'GWG 2022 Prepress Specification', standard: 'Ghent Workgroup 2022', section: 'Bleed definition', verified: false },
    ],
    associatedTestIds: ['TEST-BLEED-01-PASS', 'TEST-BLEED-01-FAIL-BLOCKING', 'TEST-BLEED-01-NOT-VERIFIABLE'],
  },

  // 2. GÉOMÉTRIE : BLEED-02
  {
    id: 'BLEED-02',
    name: 'Définition et cohérence de la TrimBox',
    version: '2.0.0',
    category: 'geometry',
    objective: 'Fournir au RIP d’imposition le repère exact du format fini du document.',
    businessDescription: 'Le fichier doit contenir une TrimBox explicite, valide (4 coordonnées positives), et strictement contenue dans la MediaBox.',
    technicalDefinition: 'Présence d’un tableau /TrimBox valide dans le dictionnaire de page tel que TrimBox ⊆ MediaBox.',
    parameters: [
      { key: 'dimensionToleranceMm', name: 'Tolérance dimensionnelle', unit: 'mm', description: 'Tolérance admise sur les dimensions du format fini' }
    ],
    primaryUnit: 'mm',
    detectionMethod: 'pdf_box_math',
    detectionMethodDescription: 'Inspection directe du dictionnaire de page PDF pour extraire le rectangle /TrimBox.',
    applicationConditions: 'Toutes pages.',
    defaultSeverity: 'BLOCKING',
    knownLimitations: [
      'Certains logiciels bureautiques grand public n’inscrivent jamais de /TrimBox.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Boîte de coupe (TrimBox)',
      passSummary: 'TrimBox explicite et correctement inscrite dans la MediaBox.',
      failBlockingSummary: 'TrimBox absente, non conforme ou débordant de la MediaBox.',
      failAdvisorySummary: 'TrimBox présente mais présentant un écart mineur par rapport au profil cible.',
      notVerifiableSummary: 'Structure de page illisible pour le calcul des boîtes.',
      notApplicableSummary: 'Non applicable.',
      atelierRecommendation: 'Activez la case "Repères et fonds perdus" ou exportez au format PDF/X pour intégrer la TrimBox.',
    },
    professionalPhrasing: 'Balise de coupe délimitant le produit final massicoté.',
    technicalReferences: [
      { name: 'ISO 32000-1 (PDF 1.7)', standard: 'ISO 32000-1', section: '14.11.2 Page boundaries', verified: false },
    ],
    associatedTestIds: ['TEST-BLEED-02-PASS', 'TEST-BLEED-02-FAIL'],
  },

  // 3. GÉOMÉTRIE : BLEED-03 (Heuristique de matière)
  {
    id: 'BLEED-03',
    name: 'Présence de matière dans le fond perdu',
    version: '1.0.0',
    category: 'geometry',
    objective: 'Vérifier qu’il y a réellement des visuels ou aplats prolongeant la maquette dans la bande de débord.',
    businessDescription: 'Une TrimBox avec débord géométrique ne suffit pas si la zone de fond perdu est laissée blanche alors que le fond de page est coloré.',
    technicalDefinition: 'Échantillonnage des pixels ou détection d’éléments vectoriels situés entre la TrimBox et la BleedBox.',
    parameters: [
      { key: 'sampleBandMm', name: 'Largeur de bande analysée', unit: 'mm', description: 'Largeur d’échantillonnage hors coupe' }
    ],
    primaryUnit: 'pixels/objets',
    detectionMethod: 'bleed_raster_edge',
    detectionMethodDescription: 'Heuristique par rendu rasterisé de la marge extérieure ou détection de coordonnées graphiques hors TrimBox.',
    applicationConditions: 'Pages disposant d’une TrimBox explicite et d’un débord géométrique positif.',
    defaultSeverity: 'ADVISORY',
    knownLimitations: [
      'Heuristique à niveau de confiance MEDIUM : sur une page à fond blanc intentionnel, la zone de débord est naturellement blanche.',
    ],
    implementationStatus: 'approximate',
    confidenceLevel: 'MEDIUM',
    userMessages: {
      title: 'Matière dans le fond perdu',
      passSummary: 'Matière graphique confirmée dans la zone de débord.',
      failBlockingSummary: 'Aucune matière détectée au-delà de la ligne de coupe.',
      failAdvisorySummary: 'Zone de fond perdu blanche ou monochrome : vérifiez si un fond perdu coloré était attendu.',
      notVerifiableSummary: 'Analyse de matière impossible sans TrimBox explicite.',
      notApplicableSummary: 'Document monochrome ou à fond blanc déclaré.',
      atelierRecommendation: 'Étirez vos photos et fonds de couleur jusqu’au bord externe de la zone rouge de fond perdu.',
    },
    professionalPhrasing: 'Continuité de l’encrage au-delà de la ligne de coupe pour parer au désalignement du massicot.',
    technicalReferences: [
      { name: 'Convention d’atelier prépresse', standard: 'Atelier', verified: false }
    ],
    associatedTestIds: ['TEST-BLEED-03-ADVISORY'],
  },

  // 4. MARGES : MARGIN-01
  {
    id: 'MARGIN-01',
    name: 'Zone de sécurité intérieure (Zone tranquille)',
    version: '2.0.0',
    category: 'margins',
    objective: 'Empêcher le rognage involontaire d’informations critiques lors de la coupe massicot.',
    businessDescription: 'Tout texte ou élément d’information important doit se situer à une distance minimale de la ligne de coupe.',
    technicalDefinition: 'Pour tout texte visible situé à l’intérieur de la TrimBox, distance minimale au bord de TrimBox >= profile.safetyMargin.',
    parameters: [
      { key: 'criticalSafetyMarginMm', name: 'Marge critique', unit: 'mm', description: 'Seuil bloquant de rognage probable' },
      { key: 'advisorySafetyMarginMm', name: 'Marge recommandée', unit: 'mm', description: 'Seuil de confort esthétique d’atelier' },
    ],
    primaryUnit: 'mm',
    detectionMethod: 'glyph_bbox',
    detectionMethodDescription: 'Filtrage des glyphes situés dans la TrimBox (en ignorant les repères hors coupe et les textes masqués).',
    applicationConditions: 'Pages avec texte présent dans le format fini.',
    defaultSeverity: 'BLOCKING',
    knownLimitations: [
      'Les éléments de foliotage ou repères situés hors TrimBox sont filtrés mais peuvent générer des alertes si la TrimBox est mal calée.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Zone de sécurité intérieure',
      passSummary: 'Tous les éléments textuels respectent la zone tranquille.',
      failBlockingSummary: 'Texte critique trop proche de la coupe (< seuil critique, risque de massicotage du texte).',
      failAdvisorySummary: 'Texte présent dans la zone de vigilance d’atelier (< seuil recommandé).',
      notVerifiableSummary: 'TrimBox non disponible pour calculer la distance intérieure.',
      notApplicableSummary: 'Aucun texte sur la page.',
      atelierRecommendation: 'Repoussez vos textes et logos vers l’intérieur de la page pour laisser une marge de sécurité.',
    },
    professionalPhrasing: 'Distance minimale de sécurité entre les textes et la ligne de massicotage.',
    technicalReferences: [
      { name: 'ISO 12647-2 (Procédés d’impression)', standard: 'ISO 12647-2', verified: false },
    ],
    associatedTestIds: ['TEST-MARGIN-01-PASS', 'TEST-MARGIN-01-FAIL-BLOCKING', 'TEST-MARGIN-01-FAIL-ADVISORY'],
  },

  // 5. TYPOGRAPHIE : TEXT-01
  {
    id: 'TEXT-01',
    name: 'Corps de texte minimal effectif',
    version: '2.0.0',
    category: 'typography',
    objective: 'Garantir la lisibilité typographique après impression et engraissement du point de trame.',
    businessDescription: 'Les textes utiles ne doivent pas être composés dans un corps inférieur au seuil de lisibilité du support.',
    technicalDefinition: 'Corps effectif = taille nominale * échelle de la matrice CTM/TextMatrix >= profile.minTextSizePt.',
    parameters: [
      { key: 'criticalTextSizePt', name: 'Corps critique', unit: 'pt', description: 'Seuil bloquant en-dessous duquel le texte est illisible' },
      { key: 'advisoryTextSizePt', name: 'Corps recommandé', unit: 'pt', description: 'Seuil de confort de lecture' },
    ],
    primaryUnit: 'pt',
    detectionMethod: 'glyph_bbox',
    detectionMethodDescription: 'Extraction PDF.js des TextItems avec calcul du déterminant de la matrice de transformation pour obtenir la taille réelle projetée.',
    applicationConditions: 'Textes visibles situés dans le format fini.',
    defaultSeverity: 'ADVISORY',
    knownLimitations: [
      'Les textes transformés en courbes (vectorisés) ne sont pas inspectés par cette règle.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Corps de texte minimal',
      passSummary: 'Corps de texte conforme aux exigences de lisibilité.',
      failBlockingSummary: 'Texte minuscule inférieur au seuil critique (< seuil critique pt).',
      failAdvisorySummary: 'Texte très fin inférieur à la recommandation d’atelier (< seuil recommandé pt).',
      notVerifiableSummary: 'Textes vectorisés ou non identifiables.',
      notApplicableSummary: 'Aucun texte présent sur le document.',
      atelierRecommendation: 'Augmentez le corps de la typographie pour prévenir le bouchage des lettres à l’impression.',
    },
    professionalPhrasing: 'Taille de police effective calculée après application de la matrice de mise à l’échelle.',
    technicalReferences: [
      { name: 'GWG 2022 Prepress Specification', standard: 'GWG 2022', section: 'Small text rendering', verified: false },
    ],
    associatedTestIds: ['TEST-TEXT-01-PASS', 'TEST-TEXT-01-FAIL'],
  },

  // 6. TYPOGRAPHIE : FONT-01
  {
    id: 'FONT-01',
    name: 'Incorporation effective des polices',
    version: '2.0.0',
    category: 'typography',
    objective: 'Éviter toute substitution de police ou décalage de composition au RIP de l’imprimeur.',
    businessDescription: 'Toutes les polices utilisées dans le document doivent être incorporées (complètes ou sous-ensembles) avec un flux binaire valide.',
    technicalDefinition: 'Vérification de la présence d’un flux FontFile, FontFile2 ou FontFile3 de taille > 0 dans le FontDescriptor des polices référencées dans les flux de contenu.',
    parameters: [],
    primaryUnit: 'booléen/flux',
    detectionMethod: 'font_stream',
    detectionMethodDescription: 'Inspection des dictionnaires de polices et validation de la présence effective du flux de données vectorielles.',
    applicationConditions: 'Polices effectivement employées sur les pages du document.',
    defaultSeverity: 'BLOCKING',
    knownLimitations: [
      'Les polices Type 3 générées dynamiquement par certains convertisseurs ne possèdent pas toujours de FontDescriptor classique.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Incorporation des polices',
      passSummary: 'Toutes les polices utilisées sont dûment incorporées.',
      failBlockingSummary: 'Police système non incorporée détectée : risque majeur de substitution de texte à l’impression.',
      failAdvisorySummary: 'Sous-ensemble incomplet ou police Standard 14 non embarquée.',
      notVerifiableSummary: 'Descripteur de police inaccessible ou incomplet.',
      notApplicableSummary: 'Document sans police (tout vectorisé ou image pure).',
      atelierRecommendation: 'Dans vos options d’exportation PDF, activez systématiquement "Incorporer toutes les polices".',
    },
    professionalPhrasing: 'Embarquement obligatoire des glyphes vectoriels au sein du conteneur PDF.',
    technicalReferences: [
      { name: 'ISO 15930-7 (PDF/X-4)', standard: 'ISO 15930-7', section: 'Clause 6.3 Fonts', verified: false },
      { name: 'ISO 32000-1', standard: 'ISO 32000-1', section: '9.9 Embedded font programs', verified: false },
    ],
    associatedTestIds: ['TEST-FONT-01-PASS', 'TEST-FONT-01-FAIL'],
  },

  // 7. VECTEURS : STROKE-01
  {
    id: 'STROKE-01',
    name: 'Épaisseur minimale des filets (Hairlines)',
    version: '2.0.0',
    category: 'vector',
    objective: 'Empêcher la disparition des traits ultra-fins (filets maigres) lors de la gravure des plaques CTP.',
    businessDescription: 'Les filets et tracés vectoriels doivent posséder une épaisseur minimale suffisante pour être reproduits par le procédé d’impression.',
    technicalDefinition: 'Épaisseur de tracé corrigée par la CTM >= profile.minStrokeWidthPt. Si aucun tracé présent -> NOT_APPLICABLE.',
    parameters: [
      { key: 'criticalStrokeWidthPt', name: 'Épaisseur critique', unit: 'pt', description: 'Seuil bloquant (ex: 0.2 pt)' },
      { key: 'advisoryStrokeWidthPt', name: 'Épaisseur recommandée', unit: 'pt', description: 'Seuil de sécurité d’atelier (ex: 0.5 pt)' },
    ],
    primaryUnit: 'pt',
    detectionMethod: 'operator_stream',
    detectionMethodDescription: 'Parcours des opérateurs graphiques (w, S, s, B, b) dans le flux de contenu.',
    applicationConditions: 'Pages contenant des opérations de tracé de contours.',
    defaultSeverity: 'ADVISORY',
    knownLimitations: [
      'Les contours vectoriels complexes imbriqués dans des Form XObjects profonds peuvent être difficiles à tracer sans exécution complète.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Épaisseur des filets',
      passSummary: 'Tous les tracés vectoriels ont une épaisseur suffisante.',
      failBlockingSummary: 'Filet ultra-fin détecté (< seuil critique pt) : disparition quasi-certaine à la gravure.',
      failAdvisorySummary: 'Filet maigre inférieur au seuil recommandé (< seuil recommandé pt).',
      notVerifiableSummary: 'Opérateurs de tracé trop complexes pour une mesure déterministe.',
      notApplicableSummary: 'Aucun filet ou tracé vectoriel dans le document.',
      atelierRecommendation: 'Épaississez les contours à au moins 0,5 pt dans votre logiciel d’illustration.',
    },
    professionalPhrasing: 'Résistance mécanique minimale des traits fins lors de la rastérisation RIP.',
    technicalReferences: [
      { name: 'GWG 2022 Prepress Specification', standard: 'GWG 2022', section: 'Minimum line thickness', verified: false },
    ],
    associatedTestIds: ['TEST-STROKE-01-PASS', 'TEST-STROKE-01-FAIL', 'TEST-STROKE-01-NOT-APPLICABLE'],
  },

  // 8. IMAGES : IMAGE-01
  {
    id: 'IMAGE-01',
    name: 'Résolution effective des images (DPI)',
    version: '1.0.0',
    category: 'images',
    objective: 'Prévenir la pixellisation et le flou des images matricielles à l’impression papier.',
    businessDescription: 'Toutes les images photographiques ou tramées doivent présenter une résolution effective adaptée au profil d’impression.',
    technicalDefinition: 'DPI effectif = (pixels natifs * 72) / (dimension affichée en points CTM).',
    parameters: [
      { key: 'criticalImageDpi', name: 'Résolution critique', unit: 'DPI', description: 'Résolution bloquante (ex: 150 DPI)' },
      { key: 'advisoryImageDpi', name: 'Résolution recommandée', unit: 'DPI', description: 'Résolution optimale standard (ex: 300 DPI)' },
    ],
    primaryUnit: 'DPI',
    detectionMethod: 'image_ctm',
    detectionMethodDescription: 'Extraction des opérandes Do / paintImageXObject avec corrélation entre les dimensions en pixels du XObject et la matrice CTM.',
    applicationConditions: 'Pages contenant au moins une image matricielle (Image XObject ou inline image).',
    defaultSeverity: 'ADVISORY',
    knownLimitations: [
      'Les masques de découpe vectoriels sur images peuvent fausser l’estimation visuelle de la surface visible.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Résolution des images',
      passSummary: 'Toutes les images présentent une résolution conforme.',
      failBlockingSummary: 'Image basse résolution critique détectée (< seuil critique DPI) : risque de pixellisation flagrante.',
      failAdvisorySummary: 'Image de résolution moyenne (< seuil recommandé DPI).',
      notVerifiableSummary: 'Image dans un flux compressé non analysable localement.',
      notApplicableSummary: 'Aucune image matricielle dans le document.',
      atelierRecommendation: 'Fournissez des images haute résolution (300 DPI à taille réelle d’impression).',
    },
    professionalPhrasing: 'Finesse de tramage calculée d’après le ratio pixels natifs sur emprise géométrique.',
    technicalReferences: [
      { name: 'GWG 2022 Prepress Specification', standard: 'GWG 2022', section: 'Resolution of images', verified: false },
    ],
    associatedTestIds: ['TEST-IMAGE-01-PASS', 'TEST-IMAGE-01-FAIL-BLOCKING', 'TEST-IMAGE-01-NOT-APPLICABLE'],
  },

  // 9. COULEURS : COLOR-01
  {
    id: 'COLOR-01',
    name: 'Espaces colorimétriques & Noir quadri',
    version: '1.0.0',
    category: 'color',
    objective: 'Empêcher les dérives de teintes à la conversion RVB->CMJN et les flous de repérage sur les petits textes noirs.',
    businessDescription: 'Les couleurs utilisées doivent respecter la politique du profil (CMJN exigé, RVB proscrit sauf tolérance explicite). Le texte noir de labeur doit être en noir 100% K.',
    technicalDefinition: 'Inspection des espaces de couleur (cs, CS) dans les flux et dictionnaires. Détection de composantes RVB si interdites.',
    parameters: [
      { key: 'rgbAllowed', name: 'Tolérance RVB', unit: 'booléen', description: 'Autorise ou non le RVB dans le flux' },
      { key: 'prohibitRichBlackText', name: 'Interdiction noir riche sur texte', unit: 'booléen', description: 'Signale le texte noir composé en quadrichromie' },
    ],
    primaryUnit: 'espace couleur',
    detectionMethod: 'colorspace_audit',
    detectionMethodDescription: 'Parcours des opérateurs colorimétriques (rg, RG, k, K, g, G, sc, scn) et des ressources ColorSpace.',
    applicationConditions: 'Toutes pages.',
    defaultSeverity: 'BLOCKING',
    knownLimitations: [
      'Certains profils RVB incorporés peuvent être convertis à la volée par les RIP modernes avec compensation de point noir.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Espaces colorimétriques',
      passSummary: 'Espaces colorimétriques conformes aux spécifications du profil.',
      failBlockingSummary: 'Présence d’éléments en RVB non autorisés : risque important de dérive des couleurs à l’impression.',
      failAdvisorySummary: 'Texte noir composé en quadrichromie (noir riche) ou espace couleur non standard.',
      notVerifiableSummary: 'Dictionnaire colorimétrique complexe non décodable.',
      notApplicableSummary: 'Document monochrome pur.',
      atelierRecommendation: 'Convertissez l’ensemble de vos visuels et nuanciers en CMJN (ex: FOGRA39 ou FOGRA51) avant l’export PDF.',
    },
    professionalPhrasing: 'Séparation quadrichromique stricte sans espace dépendant du périphérique non étalonné.',
    technicalReferences: [
      { name: 'ISO 12647-2 (Offset standard)', standard: 'ISO 12647-2', verified: false },
    ],
    associatedTestIds: ['TEST-COLOR-01-PASS', 'TEST-COLOR-01-FAIL-RGB'],
  },

  // 10. NORMES : COLOR-02
  {
    id: 'COLOR-02',
    name: 'OutputIntent & Déclaration PDF/X',
    version: '1.0.0',
    category: 'standards',
    objective: 'Indiquer au RIP l’espace colorimétrique d’impression cible contractuel.',
    businessDescription: 'Si le profil exige un standard PDF/X (ex: PDF/X-1a ou PDF/X-4), le document doit déclarer un dictionnaire /OutputIntent valide.',
    technicalDefinition: 'Présence dans la racine du document (/Root) d’un tableau /OutputIntents avec /S /GTS_PDFX et /OutputConditionIdentifier.',
    parameters: [
      { key: 'pdfxStandard', name: 'Standard PDF/X exigé', unit: 'standard', description: 'none, PDF/X-1a ou PDF/X-4' }
    ],
    primaryUnit: 'dictionnaire /OutputIntent',
    detectionMethod: 'output_intent',
    detectionMethodDescription: 'Lecture directe du dictionnaire de catalogue PDF (/Root -> /OutputIntents).',
    applicationConditions: 'Profils exigeant explicitement un standard PDF/X.',
    defaultSeverity: 'ADVISORY',
    knownLimitations: [
      'Si le profil est configuré sur "none", cette règle passe automatiquement en NOT_APPLICABLE.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Conformité PDF/X & OutputIntent',
      passSummary: 'Dictionnaire OutputIntent présent et conforme au standard attendu.',
      failBlockingSummary: 'Déclaration PDF/X obligatoire absente du fichier.',
      failAdvisorySummary: 'OutputIntent présent mais non aligné sur la condition d’impression cible recommandée.',
      notVerifiableSummary: 'Catalogue PDF non inspectable.',
      notApplicableSummary: 'Aucun standard PDF/X requis par ce profil d’impression.',
      atelierRecommendation: 'Sélectionnez le pré-réglage "Qualité presse" ou "Norme PDF/X-4:2010" lors de l’export.',
    },
    professionalPhrasing: 'Déclaration explicite de l’intention de sortie (Output Condition) pour étalonnage colorimétrique.',
    technicalReferences: [
      { name: 'ISO 15930-7 (PDF/X-4)', standard: 'ISO 15930-7', section: 'Clause 6.2 Output intents', verified: false },
    ],
    associatedTestIds: ['TEST-COLOR-02-PASS', 'TEST-COLOR-02-NOT-APPLICABLE'],
  },

  // 11. TRANSPARENCES : TRANSP-01
  {
    id: 'TRANSP-01',
    name: 'Transparences actives et modes de fusion',
    version: '2.0.0',
    category: 'transparency',
    objective: 'Détecter les transparences non aplaties susceptibles de provoquer des artefacts sur les RIP anciens.',
    businessDescription: 'Les objets présentant une opacité inférieure à 100%, un mode de fusion complexe ou un masque de transparence doivent respecter la politique du profil.',
    technicalDefinition: 'Détection d’usage effectif de transparence via /gs (/CA, /ca < 1, /BM différent de /Normal), /SMask ou Form XObject avec /Group /S /Transparency.',
    parameters: [
      { key: 'transparencyPolicy', name: 'Politique de transparence', unit: 'politique', description: 'allowed, discouraged, forbidden' }
    ],
    primaryUnit: 'occurrences actives',
    detectionMethod: 'extgstate',
    detectionMethodDescription: 'Analyse des dictionnaires /ExtGState et /XObject effectivement invoqués par les opérateurs de page.',
    applicationConditions: 'Toutes pages.',
    defaultSeverity: 'ADVISORY',
    knownLimitations: [
      'Le groupe de transparence par défaut posé sur chaque page par certains générateurs modernes sans objet transparent actif est ignoré pour éviter les faux positifs.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Transparences et modes de fusion',
      passSummary: 'Aucune transparence active détectée ou transparence autorisée par le profil.',
      failBlockingSummary: 'Transparences actives strictement interdites par ce profil (ex: PDF/X-1a massicot rotatif).',
      failAdvisorySummary: 'Transparences actives détectées (déconseillées pour ce flux : risque de trames fantômes).',
      notVerifiableSummary: 'Flux de transparence non décodable.',
      notApplicableSummary: 'Transparences pleinement autorisées sans contrainte.',
      atelierRecommendation: 'Aplatissez les transparences lors de l’export si vous imprimez sur un flux PDF/X-1a ou grand format.',
    },
    professionalPhrasing: 'Gestion des couches alpha et modes de composition susceptibles d’altérer le tramage.',
    technicalReferences: [
      { name: 'ISO 15930-1 (PDF/X-1a)', standard: 'ISO 15930-1', section: 'Clause 6.2 (Transparency forbidden)', verified: false },
    ],
    associatedTestIds: ['TEST-TRANSP-01-PASS', 'TEST-TRANSP-01-FAIL-ADVISORY'],
  },

  // 12. SURIMPRESSION : OVERPRINT-01
  {
    id: 'OVERPRINT-01',
    name: 'Gestion de la surimpression (Overprint)',
    version: '1.0.0',
    category: 'overprint',
    objective: 'Éviter la disparition des textes blancs mis en surimpression et les défauts de défonce sur le noir.',
    businessDescription: 'Le blanc (0% de couleur) ne doit JAMAIS être en surimpression (car il disparaît complètement à l’impression). Le noir de titrage doit être géré avec discernement.',
    technicalDefinition: 'Inspection des paramètres /OP, /op, /OPM dans les ExtGState appliqués sur des objets de couleur blanche ou noire.',
    parameters: [],
    primaryUnit: 'paramètres /OP',
    detectionMethod: 'extgstate',
    detectionMethodDescription: 'Filtrage des états graphiques appliquant /OP true combiné à un tracé ou remplissage blanc.',
    applicationConditions: 'Pages avec états graphiques de surimpression.',
    defaultSeverity: 'BLOCKING',
    knownLimitations: [
      'Certains RIP modernes intègrent une règle automatique forçant le blanc en défonce ("Knockout White"). Notre contrôle alerte en amont de manière préventive.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Surimpression (Overprint)',
      passSummary: 'Paramètres de surimpression conformes et sains.',
      failBlockingSummary: 'Élément blanc en surimpression détecté : disparaîtra totalement sur la presse imprimée.',
      failAdvisorySummary: 'Surimpression non standard susceptible de produire un résultat inattendu.',
      notVerifiableSummary: 'États graphiques complexes.',
      notApplicableSummary: 'Aucune commande de surimpression invoquée.',
      atelierRecommendation: 'Vérifiez la palette "Aspect" ou "Attributs" de votre logiciel et décochez "Surimprimer le tracé / le fond" sur les éléments blancs.',
    },
    professionalPhrasing: 'Définition des interactions de superposition d’encres pour prévenir les disparitions involontaires.',
    technicalReferences: [
      { name: 'GWG 2022 Prepress Specification', standard: 'GWG 2022', section: 'White Overprint rule', verified: false },
    ],
    associatedTestIds: ['TEST-OVERPRINT-01-PASS', 'TEST-OVERPRINT-01-FAIL-WHITE'],
  },

  // 13. STRUCTURE : BOX-01
  {
    id: 'BOX-01',
    name: 'Orientation et homogénéité des pages',
    version: '2.0.0',
    category: 'structure',
    objective: 'Garantir un traitement machine fluide et prévenir les erreurs de pivotement ou d’hétérogénéité des formats.',
    businessDescription: 'Toutes les pages d’un même cahier doivent avoir des dimensions identiques et une rotation cohérente (sauf orientation déclarée paysage/portrait uniforme).',
    technicalDefinition: 'Vérification de l’égalité des dimensions MediaBox entre les pages et absence de /Rotate disparate.',
    parameters: [],
    primaryUnit: 'degrés / mm',
    detectionMethod: 'structure_meta',
    detectionMethodDescription: 'Comparaison des dictionnaires de page MediaBox et entrée /Rotate pour toutes les pages.',
    applicationConditions: 'Toutes pages.',
    defaultSeverity: 'ADVISORY',
    knownLimitations: [
      'Certains documents multiformats sont intentionnels (ex: couverture 3 volets avec rabat).',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Orientation et formats des pages',
      passSummary: 'Formats et orientations homogènes sur l’ensemble du document.',
      failBlockingSummary: 'Incohérence majeure de format rendant l’imposition impossible.',
      failAdvisorySummary: 'Rotation de page (/Rotate) non nulle ou présence de pages de formats différents.',
      notVerifiableSummary: 'Nombre de pages insuffisant.',
      notApplicableSummary: 'Non applicable sur document 1 page.',
      atelierRecommendation: 'Homogénéisez l’orientation et les dimensions de toutes les pages de votre document avant export.',
    },
    professionalPhrasing: 'Cohérence structurelle des feuillets d’imposition au regard du plan de pliage.',
    technicalReferences: [
      { name: 'ISO 32000-1', standard: 'ISO 32000-1', section: '7.7.3.3 Page Object (/Rotate)', verified: false },
    ],
    associatedTestIds: ['TEST-BOX-01-PASS', 'TEST-BOX-01-ADVISORY-ROTATION'],
  },

  // 14. INTÉGRITÉ : INGEST-01
  {
    id: 'INGEST-01',
    name: 'Intégrité du fichier & Droits d’accès',
    version: '1.0.0',
    category: 'integrity',
    objective: 'Valider que le fichier est un conteneur PDF valide, non endommagé et accessible sans mot de passe d’ouverture.',
    businessDescription: 'Le fichier doit être décodable par le moteur prévol. Les PDF protégés par mot de passe utilisateur ou corrompus sont rejetés immédiatement.',
    technicalDefinition: 'Vérification de l’en-tête %PDF-, de la table xref, de l’absence de mot de passe d’ouverture et présence de pageCount > 0.',
    parameters: [],
    primaryUnit: 'statut conteneur',
    detectionMethod: 'structure_meta',
    detectionMethodDescription: 'Tentative d’ouverture structurelle avec pdf-lib et PDF.js avec analyse des codes d’erreur de bas niveau.',
    applicationConditions: 'Tout fichier soumis au traitement.',
    defaultSeverity: 'BLOCKING',
    knownLimitations: [
      'La bibliothèque pdf-lib ne peut pas ouvrir un fichier protégé par mot de passe même si seules les modifications sont restreintes.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Intégrité du document',
      passSummary: 'Fichier PDF intact, lisible et exploitable.',
      failBlockingSummary: 'Fichier corrompu, protégé par mot de passe ou sans page exploitable.',
      failAdvisorySummary: 'Restrictions partielles de sécurité détectées mais document analysable.',
      notVerifiableSummary: 'Fichier non analysable.',
      notApplicableSummary: 'Non applicable.',
      atelierRecommendation: 'Enregistrez une copie non protégée et non altérée depuis votre logiciel source.',
    },
    professionalPhrasing: 'Validation de la conformité syntaxique du flux binaire PDF.',
    technicalReferences: [
      { name: 'ISO 32000-1', standard: 'ISO 32000-1', section: '7.5 File Structure', verified: false },
    ],
    associatedTestIds: ['TEST-INGEST-01-PASS', 'TEST-INGEST-01-FAIL-PASSWORD'],
  },

  // 15. ANNOTATIONS : ANNOT-01
  {
    id: 'ANNOT-01',
    name: 'Annotations et commentaires non imprimables',
    version: '1.0.0',
    category: 'annotations',
    objective: 'Détecter les annotations résiduelles (notes, commentaires, tampons, formulaires) susceptibles d’altérer le tirage ou d’être ignorées par le RIP.',
    businessDescription: 'Les annotations interactives de relecture ne font pas partie de la maquette d’impression et doivent être purgées ou aplaties avant gravure des plaques.',
    technicalDefinition: 'Inspection du tableau /Annots de chaque dictionnaire de page. Tout élément de sous-type autre que /Link est signalé.',
    parameters: [],
    primaryUnit: 'annotations',
    detectionMethod: 'annotations_audit',
    detectionMethodDescription: 'Parcours des dictionnaires /Annots des pages PDF avec filtrage des /Subtype non imprimables (/Text, /FreeText, /Stamp, /Highlight, /Widget, etc.).',
    applicationConditions: 'Toutes pages comportant un dictionnaire d’annotations.',
    defaultSeverity: 'ADVISORY',
    knownLimitations: [
      'Les annotations avec drapeau /F 4 (/Print) peuvent être imprimées par certains RIP mais sont généralement indésirables en flux prépresse standard.',
    ],
    implementationStatus: 'complete',
    confidenceLevel: 'HIGH',
    userMessages: {
      title: 'Annotations et commentaires non imprimables',
      passSummary: 'Aucune annotation ou commentaire résiduel détecté.',
      failBlockingSummary: 'Annotations interactives bloquantes détectées.',
      failAdvisorySummary: 'Annotations ou commentaires non imprimables détectés sur le document.',
      notVerifiableSummary: 'Structure des annotations non vérifiable.',
      notApplicableSummary: 'Aucune annotation présente.',
      atelierRecommendation: 'Supprimez les annotations de relecture ou aplatissez-les avant l’envoi à l’imprimeur.',
    },
    professionalPhrasing: 'Vérification de l’absence d’éléments interactifs ou de balisage éditorial résiduels dans le flux graphique.',
    technicalReferences: [
      { name: 'ISO 32000-1', standard: 'ISO 32000-1', section: '12.5 Annotations', verified: false },
    ],
    associatedTestIds: ['TEST-ANNOT-01-PASS', 'TEST-ANNOT-01-FAIL'],
  },
];

export function getRuleById(id: string): PreflightRule | undefined {
  return PREFLIGHT_RULES.find(r => r.id === id);
}

export function getAllRules(): PreflightRule[] {
  return [...PREFLIGHT_RULES];
}

export const RULE_CATALOG_METADATA: RuleCatalogMetadata = {
  catalogVersion: RULE_CATALOG_VERSION,
  engineVersion: '2.2.0',
  lastUpdated: '2026-11-11',
  rulesCount: PREFLIGHT_RULES.length,
  rules: PREFLIGHT_RULES,
};
