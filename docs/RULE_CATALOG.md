# Catalogue Général des Règles Prépresse — Check MyFile

**Version du catalogue :** 2.1.0  
**Version de compatibilité moteur :** 2.0.0  
**Statut de gouvernance :** Référence centrale normalisée  
**Dernière révision :** Novembre 2026  

---

## 1. Principes de Gouvernance

Le catalogue de règles Check MyFile constitue la source unique de vérité technique et métier pour l'ensemble du produit.

### Règle d'or :
> **Une règle métier est définie une fois, identifiée de manière stable, exécutée par le moteur déterministe, testée automatiquement et expliquée de manière cohérente à l'utilisateur.**

Chaque règle sépare strictement :
1. **La logique métier** (pourquoi le contrôle existe pour l'atelier).
2. **Les paramètres du profil** (les seuils en mm ou pt proviennent du support imprimé).
3. **L'algorithme de détection** (mathématique des boîtes PDF, extraction affine des glyphes, arborescence des dictionnaires).
4. **Les preuves et tests** (cas PASS, FAIL, WARNING, NOT_VERIFIABLE).
5. **Les messages utilisateur** (constat, explication, recommandation atelier).

---

## 2. Sommaire des Règles Actives

| Identifiant | Intitulé de la Règle | Catégorie | Unité | Sévérité par défaut | Norme de référence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`BLEED-01`** | Fond perdu géométrique requis | Géométrie & Coupe | mm | Erreur | ISO 15930-7 / GWG 2022 |
| **`BLEED-02`** | Balisage formel de la TrimBox | Géométrie & Coupe | Booléen | Avertissement | ISO 32000-1 / ISO 15930-1 |
| **`MARGIN-01`** | Marge intérieure de sécurité des textes | Zone de sécurité | mm | Avertissement | GWG 2022 Prepress |
| **`TEXT-01`** | Corps typographique minimal de lisibilité | Typographie | pt | Avertissement | ISO 12647-2 |
| **`FONT-01`** | Incorporation des polices et sous-ensembles | Typographie | Booléen | Erreur | ISO 15930-4 / ISO 32000-1 |
| **`STROKE-01`** | Épaisseur minimale des filets vectoriels | Tracés vectoriels | pt | Avertissement | GWG 2022 / ISO 12647-2 |
| **`TRANSP-01`** | Détection des transparences actives | Transparence | Booléen | Avertissement | ISO 15930-1 / ISO 15930-7 |
| **`BOX-01`** | Cohérence structurelle et rotation des pages | Structure PDF | mm / deg | Avertissement | ISO 32000-1 |

---

## 3. Fiches Techniques Détaillées par Règle

---

### FICHE RÈGLE : `BLEED-01`
#### Nom : Fond perdu géométrique requis
- **Version de la règle :** 1.2.0
- **Catégorie :** Géométrie & Coupe
- **Niveau de confiance :** ÉLEVÉ (`HIGH`) si TrimBox balisée, MOYEN (`MEDIUM`) si dimensions déduites, FAIBLE (`LOW`) si format discordeur.
- **Objectif atelier :** Éviter l'apparition de liserés blancs inesthétiques sur les tranches lors de la découpe au massicot en imposant un débord graphique suffisant au-delà de la ligne de coupe.
- **Définition technique exacte :**  
  $$\text{Débord} = \min(\text{TrimBox.x} - \text{BleedBox.x}, (\text{BleedBox.x} + \text{BleedBox.w}) - (\text{TrimBox.x} + \text{TrimBox.w}), \text{TrimBox.y} - \text{BleedBox.y}, (\text{BleedBox.y} + \text{BleedBox.h}) - (\text{TrimBox.y} + \text{TrimBox.h}))$$  
  Condition de conformité : $\text{Débord} \ge \text{requiredBleedMm} - 0.4\text{ mm}$ (tolérance de calcul).
- **Paramètres injectés depuis le profil :**
  - `requiredBleedMm` : Fond perdu prescrit (ex: 5 mm en A4, 3 mm en carte de visite).
- **Méthode de détection :** `pdf_box_math` (parseur de dictionnaires PDF via `pdf-lib`).
- **Conditions d'application :** Tout document découpé au format fini.
- **Statuts possibles :**
  - `PASS` : Débord mesuré $\ge$ seuil requis.
  - `WARNING` : Débord partiel ($\ge 1.5\text{ mm}$) ou débord présent sur MediaBox sans balise BleedBox explicite.
  - `FAIL` : Débord $< 1.5\text{ mm}$ ou nul (TrimBox = MediaBox).
  - `NOT_VERIFIABLE` : TrimBox absente et dimensions discordantes du profil sélectionné.
- **Limitations connues :** Vérifie la présence des boîtes géométriques dans le fichier, mais n'inspecte pas si les pixels effectifs du débord contiennent de la matière imprimée ou du blanc (nécessiterait un rendu raster complet).
- **Formulation professionnelle :** « Contrôle de la présence d'une réserve de fond perdu conforme aux tolérances mécaniques de façonnage du profil sélectionné. »
- **Références normatives :**
  - ISO 15930-7:2010 (PDF/X-4) — Clause 6.2.3
  - Ghent Workgroup (GWG) 2022 Prepress Specification — Section 3.1
- **Tests associés :** `Test 1` (PASS), `Test 2` (FAIL), `Test 3` (WARNING), `Test 4` (NOT_VERIFIABLE).

---

### FICHE RÈGLE : `BLEED-02`
#### Nom : Balisage formel de la TrimBox (zone de coupe)
- **Version de la règle :** 1.1.0
- **Catégorie :** Géométrie & Coupe
- **Niveau de confiance :** ÉLEVÉ (`HIGH`).
- **Objectif atelier :** Permettre aux logiciels d'imposition automatisée de caler immédiatement la page sur la planche d'impression sans intervention manuelle de l'opérateur.
- **Définition technique exacte :** Présence d'un dictionnaire explicite `/TrimBox` valide dans le dictionnaire `/Page` de chaque feuillet.
- **Méthode de détection :** `structure_meta` via `pdf-lib`.
- **Statuts possibles :**
  - `PASS` : `/TrimBox` explicite présente.
  - `WARNING` : `/TrimBox` absente mais format fini déductible des dimensions nominales du profil.
  - `NOT_VERIFIABLE` : `/TrimBox` absente et dimensions inconnues.
- **Recommandation atelier :** Activez l'option « Repères de coupe / TrimBox » lors de l'export PDF dans InDesign ou Illustrator.
- **Références normatives :**
  - ISO 32000-1:2008 — Section 14.11.2 (Page Boundaries)
  - ISO 15930-1:2001 (PDF/X-1a) — Clause 5.2.2
- **Tests associés :** `Test 1` (PASS), `Test 4` (WARNING / NOT_VERIFIABLE).

---

### FICHE RÈGLE : `MARGIN-01`
#### Nom : Marge intérieure de sécurité des textes
- **Version de la règle :** 1.2.0
- **Catégorie :** Zone de sécurité
- **Niveau de confiance :** ÉLEVÉ (`HIGH`) si textes extractibles présents.
- **Objectif atelier :** Empêcher le rognage d'informations textuelles critiques (numéros de téléphone, adresses, mentions légales) lors de la coupe au massicot ou lors de la chasse au pli sur les brochures.
- **Définition technique exacte :**  
  Pour chaque TextItem extrait :
  $$\text{Dist} = \min(x - \text{Trim.left}, \text{Trim.right} - (x + w), y - \text{Trim.bottom}, \text{Trim.top} - (y + h)) \ge \text{requiredSafetyMarginMm}$$  
  Seuil critique immédiat : $\text{Dist} < 2.5\text{ mm}$.
- **Paramètres injectés depuis le profil :**
  - `requiredSafetyMarginMm` : Marge prescrite (ex: 10 mm en A4, 3 mm en carte de visite, 12 mm en brochure).
- **Méthode de détection :** `glyph_bbox` (extraction de la matrice de transformation affine via PDF.js rapportée aux coordonnées de coupe).
- **Statuts possibles :**
  - `PASS` : Tous les textes extractibles respectent la marge de sécurité.
  - `WARNING` : Textes situés entre 2.5 mm et la marge requise.
  - `FAIL` : Textes situés à moins de 2.5 mm de la coupe (risque de massicotage immédiat).
  - `NOT_VERIFIABLE` : Aucun texte extractible (ex: document composé uniquement d'images ou de courbes vectorisées).
- **Limitations connues :** Ne s'applique pas aux textes convertis en tracés vectoriels bruts (courbes de Bézier sans chaîne de caractères).
- **Références normatives :**
  - GWG 2022 Prepress Specification — Section 4.3 (Safety Margins)
  - Guide des Bonnes Pratiques de l'Imprimerie (IDEP / UNIIC)
- **Tests associés :** `Test 1` (PASS), `Test 2` (FAIL).

---

### FICHE RÈGLE : `TEXT-01`
#### Nom : Corps typographique minimal de lisibilité
- **Version de la règle :** 1.2.0
- **Catégorie :** Corps de texte
- **Niveau de confiance :** ÉLEVÉ (`HIGH`).
- **Objectif atelier :** Assurer la netteté et la lisibilité du texte imprimé après trame et insolation de plaques, évitant l'empâtement des caractères sous la trame offset ou numérique.
- **Définition technique exacte :**  
  $$\text{Corps (pt)} = \sqrt{\text{transform}[0]^2 + \text{transform}[1]^2} \ge \text{minTextSizePt}$$  
  Seuil critique : $\text{Corps} < 0.75 \times \text{minTextSizePt}$.
- **Paramètres injectés depuis le profil :**
  - `minTextSizePt` : Corps minimal requis (ex: 8 pt en A4, 6 pt en carte de visite).
- **Méthode de détection :** `glyph_bbox` via PDF.js.
- **Statuts possibles :**
  - `PASS` : Tous les textes extractibles $\ge \text{minTextSizePt}$.
  - `WARNING` : Textes compris entre $0.75 \times \text{seuil}$ et le seuil.
  - `FAIL` : Textes sous le seuil critique (ex: $< 6\text{ pt}$ pour un seuil de 8 pt).
  - `NOT_VERIFIABLE` : Aucun texte extractible.
- **Limitations connues :** Ignore les puces techniques nulles ($< 1.5\text{ pt}$). Ne mesure pas le contraste de couleur entre l'encre et le fond.
- **Références normatives :**
  - ISO 12647-2:2013 — Section 4.3.4
  - GWG 2022 Sheetfed Prepress — Section 5.1
- **Tests associés :** `Test 1` (PASS), `Test 2` (FAIL).

---

### FICHE RÈGLE : `FONT-01`
#### Nom : Incorporation des polices et sous-ensembles
- **Version de la règle :** 1.2.0
- **Catégorie :** Typographie & Polices
- **Niveau de confiance :** ÉLEVÉ (`HIGH`) pour sous-ensembles et descripteurs inspectés.
- **Objectif atelier :** Empêcher toute substitution arbitraire de police lors du rastérage par le processeur d'image (RIP) de l'imprimante, préservant la fidélité typographique exacte de la maquette.
- **Définition technique exacte :**  
  Pour chaque police déclarée dans `/Resources /Font` :
  1. Préfixe normalisé de sous-ensemble : `/^[A-Z]{6}\+/` sur la clé `/BaseFont` $\rightarrow$ Incorporée garantie.
  2. Présence d'un flux `/FontFile`, `/FontFile2` ou `/FontFile3` dans le `/FontDescriptor` (ou sous `/DescendantFonts` pour les polices composites `/Type0`) $\rightarrow$ Incorporée.
  3. Présence d'un `/FontDescriptor` sans aucun flux `/FontFile` $\rightarrow$ Non incorporée confirmée (`FAIL`).
  4. Police Standard 14 sans `/FontDescriptor` $\rightarrow$ Non vérifiable avec certitude (`NOT_VERIFIABLE`), pour éviter tout faux positif bloquant.
- **Méthode de détection :** `font_dict` via `pdf-lib`.
- **Statuts possibles :**
  - `PASS` : 100% des polices détectées sont incorporées ou en sous-ensembles valides.
  - `FAIL` : Au moins une police externe manquante confirmée.
  - `NOT_VERIFIABLE` : Aucune police déclarée (textes vectorisés) ou polices standard sans descripteur complet.
- **Références normatives :**
  - ISO 15930-4 (PDF/X-1a:2003) — Clause 4.3
  - ISO 15930-7 (PDF/X-4:2010) — Clause 5.2.4
  - ISO 32000-1:2008 — Section 9.6
- **Tests associés :** `Test 1` (PASS), `Test 2` (FAIL).

---

### FICHE RÈGLE : `STROKE-01`
#### Nom : Épaisseur minimale des filets vectoriels
- **Version de la règle :** 1.2.0
- **Catégorie :** Tracés vectoriels
- **Niveau de confiance :** ÉLEVÉ (`HIGH`).
- **Objectif atelier :** Éviter la rupture ou disparition des lignes fines (« filets maigres ») lors de l'insolation des plaques offset ou de l'impression numérique.
- **Définition technique exacte :**  
  Vérification des arguments de l'opérateur `setLineWidth` dans les flux vectoriels de page : $\text{Largeur} \ge \text{minStrokeWidthPt}$ (seuil critique physique : $0.25\text{ pt}$).
- **Paramètres injectés depuis le profil :**
  - `minStrokeWidthPt` : Épaisseur minimale prescrite (ex: 0.5 pt en A4, 0.4 pt en carte de visite).
- **Méthode de détection :** `operator_stream` via PDF.js (`getOperatorList`).
- **Statuts possibles :**
  - `PASS` : Filets conformes ou aucun filet vectoriel à risque détecté.
  - `WARNING` : Filets compris entre 0.25 pt et le seuil du profil.
  - `FAIL` : Filets maigres $< 0.25\text{ pt}$.
- **Références normatives :**
  - GWG 2022 Prepress Specification — Section 6.2
  - ISO 12647-2:2013
- **Tests associés :** `Test 1` (PASS).

---

### FICHE RÈGLE : `TRANSP-01`
#### Nom : Détection des transparences actives
- **Version de la règle :** 1.2.0
- **Catégorie :** Transparence
- **Niveau de confiance :** ÉLEVÉ (`HIGH`).
- **Objectif atelier :** Vérifier l'adéquation du document avec le flux de production prépresse de l'imprimeur (PDF/X-1a exige l'aplatissement vectoriel, PDF/X-4 gère les transparences natives).
- **Définition technique exacte :**  
  Détection dans `/Resources /ExtGState` d'opacités `/ca < 1.0` ou `/CA < 1.0`, de modes de fusion `/BM != /Normal`, de masques `/SMask`, ou de groupes `/Group /S /Transparency`.
- **Méthode de détection :** `extgstate` via `pdf-lib`.
- **Statuts possibles :**
  - `PASS` : Aucune transparence active déclarée.
  - `WARNING` : Transparences actives détectées (requiert un flux PDF/X-4).
- **Références normatives :**
  - ISO 15930-1 (PDF/X-1a:2001) — Interdiction des transparences non aplaties.
  - ISO 15930-7 (PDF/X-4:2010) — Gestion native des transparences PDF 1.4.
- **Tests associés :** `Test 1` (PASS), `Test 3` (WARNING).

---

### FICHE RÈGLE : `BOX-01`
#### Nom : Cohérence structurelle et géométrie des pages
- **Version de la règle :** 1.2.0
- **Catégorie :** Structure PDF
- **Niveau de confiance :** ÉLEVÉ (`HIGH`).
- **Objectif atelier :** Détecter les variations imprévues de format entre pages d'un même feuillet et repérer les orientations de page déclarées par rotation logicielle (`/Rotate`).
- **Définition technique exacte :**  
  Vérification de la positivité de la `MediaBox`, détection d'écarts de dimensions $> 2\text{ mm}$ entre pages successives, et inspection de l'attribut `/Rotate != 0`.
- **Méthode de détection :** `structure_meta` via `pdf-lib`.
- **Statuts possibles :**
  - `PASS` : Géométrie uniforme sans rotation logicielle.
  - `WARNING` : Page avec rotation `/Rotate 90/180/270` ou document multi-formats détecté.
- **Références normatives :**
  - ISO 32000-1:2008 — Section 7.7.3.3 (Page Objects)
- **Tests associés :** `Test 1` (PASS), `Test 5` (WARNING sur `/Rotate 90`).
