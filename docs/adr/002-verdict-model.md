# ADR-002 : Modèle de verdict et hiérarchie de décision

## Statut
Accepté — Intégré dans Check MyFile v2.2.0.

## Contexte
Les versions initiales utilisaient un modèle de verdict inspiré des outils de reporting SaaS traditionnels, mélangeant sévérités floues (`warning`), faux positifs et promesses d'aptitude de type « Prêt à imprimer » non démontrées. En impression professionnelle, un fichier non conforme bloque le calage machine et génère des coûts de gâche papier considérables. Le produit exige un modèle strict, déterministe et prudent.

## Décision

### 1. Suppression du statut ambigu `WARNING`
Le statut `WARNING` est supprimé de l'ensemble du moteur de règles. Il est remplacé par une décomposition orthogonale :
- **Statut de résultat de règle** : `PASS`, `FAIL`, `NOT_VERIFIABLE`, `NOT_APPLICABLE`, `ERROR`.
- **Sévérité de non-conformité** :
  - `BLOCKING` : Défaut majeur empêchant le flashage ou détruisant le document (ex: fond perdu absent, police manquante, blanc en surimpression, RVB interdit).
  - `ADVISORY` : Point d'attention d'atelier (ex: corps de texte fin, marge de confort resserrée, rotation 90°).
  
Une alerte d'atelier est donc modélisée par `status: FAIL` avec `severity: ADVISORY`.

### 2. Hiérarchie stricte des verdicts globaux
Le verdict global du document est calculé par évaluation descendante sans ambiguïté :
1. **`ANALYSIS_FAILED`** : Le fichier est corrompu, protégé par mot de passe ou sans page exploitable.
2. **`PROBLEMS_DETECTED`** : Au moins une règle échoue avec sévérité `BLOCKING`.
3. **`ATTENTION_REQUIRED`** : Aucun défaut bloquant, mais au moins un point d'attention `ADVISORY`.
4. **`PARTIAL_VERIFICATION`** : Aucun `FAIL`, mais au moins un contrôle `NOT_VERIFIABLE` (refus de faux positif).
5. **`NO_ISSUE_ON_CHECKED_RULES`** : Toutes les règles évaluées sont en `PASS` ou `NOT_APPLICABLE`.

### 3. Libellé vert borné et absence de promesse infondée
Le libellé de succès n'est jamais « Prêt à imprimer » ou « Certifié conforme », mais :
> **« Aucun problème détecté sur les contrôles effectués »**

Ce libellé s'accompagne systématiquement de la liste officielle des contrôles non couverts (`UNCOVERED_CHECKS_CATALOG`) affichée dans l'interface et sur le rapport PDF.

### 4. Compteurs indépendants
Le moteur calcule et expose des compteurs disjoints :
`blockingIssuesCount`, `advisoryIssuesCount`, `notVerifiableCount`, `notApplicableCount`, `errorCount`, `passedRulesCount`.

## Conséquences
- Zéro faux sentiment de sécurité pour l'utilisateur.
- Transparence totale sur les limites du contrôle local dans le navigateur.
- Traçabilité granulaire de chaque décision au niveau de la règle.
