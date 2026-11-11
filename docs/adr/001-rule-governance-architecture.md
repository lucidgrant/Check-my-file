# ADR-001 : Architecture de Gouvernance et de Centralisation des Règles Métier Prépresse

- **Statut :** Accepté
- **Date :** Novembre 2026
- **Auteurs :** Équipe d'ingénierie Check MyFile
- **Décideurs :** Architecte logiciel & Direction technique prépresse

---

## 1. Contexte & Problématique

Dans les versions initiales du projet, plusieurs risques de cohérence avaient été identifiés :
1. **Dispersion des seuils techniques** : Les marges de sécurité (10 mm), les tailles minimales de texte (8 pt) et le fond perdu (5 mm) étaient dispersés ou dupliqués entre les composants graphiques (`UploadSection`, `PdfViewer`) et les services de calcul.
2. **Couplage rigide entre règles et profils** : Il était difficile d'adapter un seuil à un produit spécifique (ex: carte de visite à 85×55 mm vs brochure agrafée) sans risquer de briser d'autres contrôles.
3. **Absence d'identifiants stables** : Les anomalies étaient identifiées par des chaînes informelles (`bleed`, `text_size`), empêchant une traçabilité précise entre les spécifications normatives (ISO/GWG), les tests unitaires et les rapports client.
4. **Risque de sur-promesse** : La tentation d'afficher des promesses invérifiables (« Prêt à imprimer ») nuisait à la crédibilité industrielle du produit.

---

## 2. Décision Architecturale

Nous adoptons une **architecture de gouvernance des règles** structurée autour de cinq piliers indépendants et découplés :

```text
┌───────────────────────────────────────────────────────────────┐
│               1. CATALOGUE CENTRAL DES RÈGLES                 │
│         (src/rules/ : BLEED-01, FONT-01, TEXT-01...)          │
└───────────────────────────────┬───────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  2. PROFILS   │       │   3. MOTEUR   │       │   4. TESTS    │
│  D'IMPRESSION │       │ DE DÉTECTION  │       │  AUTOMATISÉS  │
│(src/profiles/)│       │ (pdfAnalyzer) │       │(preflightTests│
└───────┬───────┘       └───────┬───────┘       └───────┬───────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
┌───────────────────────────────────────────────────────────────┐
│             5. INTERFACE UTILISATEUR & RAPPORT PDF            │
│  (Header v2.0.0, InspectionSidebar, RuleDetailModal, PDF)     │
└───────────────────────────────────────────────────────────────┘
```

### Piliers de la décision :
1. **Catalogue Centralisé (`src/rules/catalog.ts`)** :
   - Chaque règle dispose d'un identifiant stable (`BLEED-01`, `BLEED-02`, `MARGIN-01`, `TEXT-01`, `FONT-01`, `STROKE-01`, `TRANSP-01`, `BOX-01`).
   - Définition formelle, objectif atelier, méthode de détection, sévérité par défaut, limitations connues et références normatives (ISO 15930, ISO 12647-2, GWG 2022).
   - Versionné indépendamment (`RULE_CATALOG_VERSION = 2.1.0`).

2. **Système de Profils Configurables (`src/profiles/registry.ts`)** :
   - Les règles sont indépendantes de leurs paramètres.
   - Les seuils proviennent du profil sélectionné (A4, A5, Carte de visite, Brochure, Affiche, Carré, Personnalisé).
   - Aucun composant d'interface n'héberge de constantes prépresse en dur.
   - Versionné indépendamment (`PROFILE_REGISTRY_VERSION = 1.2.0`).

3. **Moteur Déterministe Normalisé (`src/services/pdfAnalyzer.ts`)** :
   - Le moteur exécute les règles et retourne un résultat structuré `RuleCheckResult` pour chaque règle.
   - Statuts normalisés : `PASS`, `FAIL`, `WARNING`, `NOT_VERIFIABLE`, `ERROR`.
   - Règle de prudence absolue : ne jamais transformer une absence de preuve en conformité.
   - Version du moteur : `ENGINE_VERSION = 2.0.0`.

4. **Suite de Tests Automatisée (`src/services/preflightTests.ts`)** :
   - Assertions explicites sur les résultats de chaque règle (conforme, non conforme, cas limite, non vérifiable, rotation).
   - Exécution CLI reproductible (`bun x tsx scripts/runTests.ts`).

5. **Traçabilité & Fiches Règles dans l'Expérience Utilisateur** :
   - Chaque anomalie et chaque ligne du rapport porte l'identifiant de sa règle (`[BLEED-01]`, etc.).
   - Composant modal interactif `RuleDetailModal` permettant de consulter la fiche technique de n'importe quelle règle d'un simple clic.
   - Le rapport PDF et l'en-tête affichent les 3 versions de référence : Moteur, Catalogue et Profil.

---

## 3. Conséquences

### Positives :
- **Extensibilité** : L'ajout d'une nouvelle règle prépresse (ex: résolution d'image `IMAGE-01` ou profil ICC `COLOR-01`) se fait de manière purement additive sans refactoriser le code existant.
- **Rigueur & Crédibilité** : Les professionnels de l'imprimerie et les développeurs partagent le même langage, les mêmes identifiants et les mêmes références ISO.
- **Zéro Régression** : La suite de tests vérifie automatiquement l'impact de tout ajustement d'algorithme sur l'ensemble du catalogue.

### Négatives / Contraintes acceptées :
- Nécessite de maintenir à jour la documentation normative lors de chaque incrément de version de règle.
- L'arbre des résultats contient plus de métadonnées, ce qui est largement compensé par la clarté du diagnostic.
