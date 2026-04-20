# 🚀 PROMPT ERP HCS — MODE OPÉRATIONNEL RAPIDE

> **Objectif : rendre l'ERP utilisable au quotidien par HCS le plus vite possible.**
> Les règles comptables complètes s'appliquent, mais la priorité est la **fiabilité fonctionnelle** avant la perfection légale.

---

## 🏢 CONTEXTE ESSENTIEL

**HCS — High Coffee Shirt**, personnalisation textile (DTF, vinyle, broderie), Faaa, Tahiti.
- Devise : **XPF** — arrondi entier, `Math.round(ht * 1.13)` pour TVA 13%
- TVA standard : **13%** (textile). 16% si applicable. 0% export hors PF.
- Stack : **Vanilla JS + PHP/MySQL + localStorage** — pas de framework, jamais.
- Watcher FTP actif : éditer dans `hcs-erp/` → déployé automatiquement.
- Git source de vérité : `hcs-erp ok/` → `git push origin master`.

---

## ⚡ RÈGLES ABSOLUES (non négociables même en mode rapide)

| Règle | Pourquoi |
|-------|----------|
| Jamais `alert()` / `confirm()` natif dans les modules ERP | Utiliser `showConfirm()` / `toast()` |
| Toujours `Store.create/update/remove` | Jamais `localStorage` direct |
| Cache-buster `?v=YYYYMMDDNN` après chaque modif JS | Éviter les bugs de cache en prod |
| Copier `hcs-erp/` → `hcs-erp ok/` + git push après chaque session | Source de vérité git |
| Boutons action dans table → `type: 'actions'` + `col.actions` | `stopPropagation` bloque la délégation |
| TVA = entier XPF : `Math.round(ht * 1.13)` | Jamais de décimales en XPF |
| Facture numérotée séquentiellement, statut `Annulé` si erreur | Ne jamais supprimer une facture |

---

## 🎯 PRIORITÉS OPÉRATIONNELLES (dans cet ordre)

### ✅ PHASE 1 — Flux commercial complet (FAIT en grande partie)
- [x] Devis → Commande → Facture (flux lié)
- [x] Paiements partiels / totaux sur factures
- [x] Lien devis ↔ facture ↔ commande (navigation croisée)
- [x] Suivi "valeur bon de commande" (barre progression)
- [x] Carte planning créée automatiquement depuis devis → commande
- [x] Bouton 🗑 Supprimer dans liste devis et factures
- [ ] **Suppression facture → statut "Annulé"** (pas vraie suppression)
- [ ] **Aperçu / PDF facture correct** avec toutes les lignes réelles

### 🔄 PHASE 2 — Stock & Production (priorité suivante)
- [ ] Stock : mouvements entrée/sortie liés aux commandes
- [ ] Planning production : lecture depuis Store (pas seulement localStorage séparé)
- [ ] Atelier : bon de fabrication lié au bon de commande

### 📊 PHASE 3 — Comptabilité fiable
- [ ] Caisse POS → crée une facture + écriture comptable automatique
- [ ] Export comptable basique (liste écritures CSV/FEC)
- [ ] Clôture d'exercice (bloquer modifications après date)

### 🔮 PHASE 4 — Conformité légale complète
- [ ] Avoir (facture négative) pour erreurs sur factures validées
- [ ] Contrôle intégrité référentielle (suppression client/produit)
- [ ] Numérotation sans trou garantie
- [ ] Rapprochement bancaire

---

## 🛠️ COMPORTEMENT DE L'ASSISTANT

### Quand Grace demande une feature :
1. **Identifier** les fichiers impactés en 1 ligne
2. **Coder directement** — pas de plan interminable si c'est clair
3. **Alerter uniquement** si risque de régression ou incohérence comptable importante
4. **Bumper le version**, sync `hcs-erp ok/`, git push

### Quand quelque chose est ambigu :
- Poser **une seule question** (la plus importante), puis coder
- Ne pas bloquer sur des cas limites théoriques

### Format de réponse court :
```
[Ce que je fais + pourquoi si non-évident]
[Code / edit]
[Résultat + prochaine étape si pertinent]
```
Pas de headers, pas de checklists longues sauf si demandé.

---

## 📐 ARCHITECTURE — RAPPELS RAPIDES

```
index.html          ← SPA unique, ordre de chargement critique
js/app.js           ← Router, APPS[] (source de vérité navigation)
js/store.js         ← CRUD + localStorage + sync MySQL
js/modules/sales.js ← Devis, Commandes, Factures (IIFE)
js/modules/inventory.js ← Produits, variantes, stock
js/modules/manufacturing.js ← Ordres de fab.
modules/*.html      ← Vues en iframe (planning, caisse, etc.)
```

**Pattern module IIFE obligatoire :**
```javascript
window.MonModule = (() => {
  'use strict';
  const _state = {};
  function _prive() {}
  return { init(toolbar, area, viewId) {} };
})();
```

**Bonne pratique table avec bouton action :**
```javascript
{ type: 'actions', actions: [
    { label: '🗑', className: 'btn btn-ghost btn-sm',
      onClick: (row) => { showConfirm('Supprimer ?', () => {
        Store.remove('collection', row.id);
        toast('Supprimé.', 'success');
      });
    }}
  ]
}
```

---

## ⚠️ BUGS CONNUS À NE PAS REPRODUIRE

| Bug | Cause | Fix appliqué |
|-----|-------|--------------|
| Bouton 🗑 silencieux | `stopPropagation()` dans `render()` | Toujours `type:'actions'` |
| Facture avec "— Produit —" | Ligne acompte fictive `produit: "Acompte..."` | Utiliser `devis.lignes` directement |
| Reste à payer = totalTTC (jamais réduit) | `paiements[]` vide ou `montant` string | `parseFloat`, toujours initialiser `paiements:[]` |
| Picker bloqué (allSet jamais true) | `dynKeys` inclut attrs sans valeurs | Filtrer `attrVals[k].length > 0` |
| Écran blanc après F5 | `initApp()` non défini au reload | Auto-init en bas d'`app.js` |
| `_escT` non défini (toast.js) | Fonction utilisée avant déclaration | Déclarer avant `toast()` |
| FTP 421 Too many connections | Python watcher + deploy simultanés | Utiliser `curl --ftp-pasv -T` |

---

## 🔗 ACCÈS RAPIDES

| Ressource | Valeur |
|-----------|--------|
| ERP prod | https://highcoffeeshirts.com/erp/ |
| Login | admin / admin |
| FTP user | admin@highcoffeeshirts.com |
| FTP host | node41-ca.n0c.com (port 5022) |
| MySQL DB | highftqb_HCS_ERP |
| API header | `x-api-key: hcs-erp-2026` |
| Watcher | `python "C:\Users\highc\HCS\hcs-erp\watch-deploy.py"` |
| Git | `cd "hcs-erp ok" && git add -A && git commit -m "..." && git push` |

---

## 📋 COLLECTIONS STORE (17 actives)

`contacts` · `produits` · `devis` · `commandes` · `factures` · `ecritures` · `paiements` · `stock` · `ordresFab` · `postes` · `nomenclatures` · `fournisseurs` · `achats` · `employes` · `utilisateurs` · `auditLog` · `ecritures`

**Collections MySQL sync** : `devis`, `factures`, `produits`, `contacts`, `commandes`
— Doubler les clés JS + alias snake_case pour MySQL (ex: `totalTTC` + `total_ttc`).

---

*Prompt opérationnel HCS ERP v2.0 — 2026-04-20*
*Priorité : fonctionnel d'abord, conforme ensuite.*
