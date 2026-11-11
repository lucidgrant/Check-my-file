# Check MyFile — Journal des modifications techniques (Implementation Log)

Ce journal consigne de manière chronologique et détaillée les actions, décisions d'ingénierie, fichiers modifiés, résultats réels des tests et limites actuelles du prototype.

---

## Session du 11 novembre 2026

### 1. Objectifs de la session
- Implémentation complète du moteur de règles prépresse (14 règles déterministes).
- Passage à un système de profils 100% paramétrique (zéro seuil en dur dans les composants et le viewer).
- Refonte du modèle de verdict selon l'ADR-002 (priorité descendante, suppression de `WARNING`, compteurs indépendants, bannière verte bornée).
- Élimination intégrale du terme « certifié ».
- Unification de la liste « Non couvert » via la constante `UNCOVERED_CHECKS_CATALOG`.
- Suite de tests automatisée avec vérification par règle et par statut.

---

### 2. Actions & Fichiers modifiés

#### A. Gouvernance & Typologie des Règles
- **`src/rules/types.ts`** :
  - Création des types `RuleStatus` (`PASS`, `FAIL`, `NOT_VERIFIABLE`, `NOT_APPLICABLE`, `ERROR`).
  - Définition des sévérités `RuleSeverity` (`BLOCKING`, `ADVISORY`).
  - Définition des verdicts `OverallVerdict` (`ANALYSIS_FAILED` > `PROBLEMS_DETECTED` > `ATTENTION_REQUIRED` > `PARTIAL_VERIFICATION` > `NO_ISSUE_ON_CHECKED_RULES`).
  - Définition de l'interface `PreflightCounters`.
- **`src/rules/catalog.ts`** :
  - Ajout des 14 règles de contrôle : `BLEED-01`, `BLEED-02`, `BLEED-03`, `MARGIN-01`, `TEXT-01`, `FONT-01`, `STROKE-01`, `IMAGE-01`, `COLOR-01`, `COLOR-02`, `TRANSP-01`, `OVERPRINT-01`, `BOX-01`, `INGEST-01`.
  - Exportation de la constante unique `UNCOVERED_CHECKS_CATALOG`.

#### B. Profils d'Impression Paramétriques
- **`src/profiles/types.ts`** :
  - Extension de `PrintProfile` avec seuils critiques et d'alerte séparés (marge, corps, filet, résolution, tolérances, politiques colorimétriques et de transparence, standard PDF/X).
  - Ajout du champ `workshopConventionNote: "Convention d'atelier, à valider par un imprimeur"`.
- **`src/profiles/registry.ts`** :
  - Enrichissement des 6 profils standard (`Flyer A4`, `Flyer A5`, `Carte de Visite`, `Brochure A4 piquée`, `Dépliant Carré 150`, `Affiche A3`).
  - Factory `createCustomProfile` acceptant tous les seuils paramétriques.

#### C. Moteur d'Analyse (`src/services/pdfAnalyzer.ts`)
- Implémentation du décodage de flux via `decodePDFRawStream` pour décompresser les streams zlib FlateDecode dans les deux environnements (navigateur et Node.js).
- `MARGIN-01` & `TEXT-01` : Filtrage strict des textes situés hors TrimBox (repères d'imprimeur, slug) et calcul du corps effectif via la matrice CTM.
- `FONT-01` : Vérification des flux binaires `FontFile`/`FontFile2`/`FontFile3` de taille > 0. Normalisation des clés de polices pour matcher les opérateurs `/Tf` dans les flux décompressés.
- `STROKE-01` : Détection des opérateurs de tracé `w` et `S`. Statut `NOT_APPLICABLE` si aucun tracé n'est présent.
- `IMAGE-01` : Détection des images XObject et calcul de la résolution effective (DPI).
- `COLOR-01` : Détection du RVB (`rg`, `RG`) et respect de la politique de séparation quadrichromique.
- `TRANSP-01` : Détection des `/ExtGState` avec opacité active (`/ca`, `/CA < 1`, `/BM`).
- `OVERPRINT-01` : Détection de la surimpression et alerte sur les objets blancs en surimpression.
- `BOX-01` : Détection des rotations non nulles (`/Rotate`) et de l'hétérogénéité des formats.
- `INGEST-01` : Contrôle de décodage, corruption et mots de passe.
- Calcul déterministe des compteurs indépendants et du verdict global selon la hiérarchie officielle.

#### D. Surfaces Utilisateur & Rapport
- **`src/components/Header.tsx`** :
  - Intégration du bandeau d'évaluation normalisé avec libellé vert borné : « Aucun problème détecté sur les contrôles effectués ».
  - Suppression de toute mention de « certifié ».
- **`src/components/InspectionSidebar.tsx`** :
  - Support des 14 contrôles avec icônes distinctes.
  - Affichage des compteurs disjoints (bloquants, points d'attention, non vérifiables).
  - Intégration directe de `UNCOVERED_CHECKS_CATALOG`.
- **`src/services/reportGenerator.ts`** :
  - Rapport PDF avec cartouche de versioning, tableau des contrôles, bannière de verdict hiérarchique, et section dédiée au périmètre technique non couvert.
- **`src/components/RuleDetailModal.tsx`** :
  - Consultation des fiches techniques des 14 règles avec catégories normalisées et notes d'atelier.
- **`src/App.tsx`** :
  - Alignement des statuts de gestion d'erreur sur `ANALYSIS_FAILED`.

---

### 3. Résultats réels des vérifications

| Outil de vérification | Commande | Résultat constaté |
| :--- | :--- | :--- |
| **Compilation Vite** | `compile_applet` | **SUCCÈS (0 erreur)** |
| **Linter TypeScript** | `tsc --noEmit` (`lint_applet`) | **SUCCÈS (0 erreur, exit code 0)** |
| **Suite de tests automatisée** | `bun x tsx scripts/runTests.ts` | **10/10 TESTS PASS (100% de réussite)** |

#### Détail des 10 tests exécutés
1. `Test 1` : Document Conforme (`BLEED-01`, `BLEED-02`, `TEXT-01`, `MARGIN-01`, `FONT-01: PASS`) $\rightarrow$ **PASS**
2. `Test 2` : `BLEED-01 = FAIL BLOCKING` (0 mm de fond perdu) $\rightarrow$ **PASS**
3. `Test 3` : `BLEED-01 = NOT_VERIFIABLE` (TrimBox absente du PDF) $\rightarrow$ **PASS**
4. `Test 4` : `FONT-01 = FAIL` (Police Standard 14 non incorporée) $\rightarrow$ **PASS**
5. `Test 5` : `STROKE-01 = NOT_APPLICABLE` (Document sans aucun filet) $\rightarrow$ **PASS**
6. `Test 6` : `COLOR-01 = FAIL BLOCKING` (RVB interdit par le profil A4) $\rightarrow$ **PASS**
7. `Test 7` : `TRANSP-01 = FAIL` (Transparences actives `/ca 0.5`) $\rightarrow$ **PASS**
8. `Test 8` : `BOX-01 = FAIL ADVISORY` (Page avec rotation 90°) $\rightarrow$ **PASS**
9. `Test 9` : Producteur Externe (Fichier marqué InDesign CC 2024) $\rightarrow$ **PASS**
10. `Test 10` : Rapport PDF avec cartouche de gouvernance et liste non-couvert $\rightarrow$ **PASS**

---

### 4. Limites techniques documentées
- **Images imbriquées dans des Form XObjects profonds** : La résolution effective est estimée sur le premier niveau de projection CTM.
- **Polices Type 3 non conventionnelles** : Si une police Type 3 ne déclare aucun flux binaire dans `CharProcs`, elle est qualifiée de non incorporée.
- **Texte vectorisé (tracé de contours)** : Les textes convertis en courbes dans Illustrator/InDesign ne sont plus des éléments typographiques et ne sont pas mesurables par `TEXT-01`.
