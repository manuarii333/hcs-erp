/* ================================================================
   HCS ERP — js/modules/advisor.js  v1.0
   Module "Conseiller Comptable" — moteur d'analyse financière,
   notifications intelligentes et génération de bilans imprimables.

   Inspiré des outils de pilotage : QuickBooks Insights, Sage Pilotage,
   Pennylane Recommandations, FreshBooks Health Score.

   Analyses :
     • Marge brute Ventes vs Dépenses
     • Évolution CA mois M vs mois M-1
     • Factures impayées > 30 jours
     • TVA à reverser / TVA déductible non réclamée
     • Stock sous seuil d'alerte
     • Devis sans réponse > 15 jours
     • Trésorerie (banque + caisse)
     • OF en retard
     • Opportunités CRM non suivies
     • Top dépense par catégorie

   Niveaux d'alerte :
     critique   → rouge   — action immédiate requise
     avertissement → orange — à surveiller cette semaine
     conseil    → bleu    — recommandation d'optimisation
     opportunite → vert   — bonne nouvelle / point fort
   ================================================================ */

'use strict';

const Advisor = (() => {

  /* ================================================================
     CONSTANTES
     ================================================================ */
  const SEUIL_MARGE_CRITIQUE  = 20;   // % — en dessous : critique
  const SEUIL_MARGE_WARNING   = 35;   // % — en dessous : avertissement
  const SEUIL_DEP_VENTES      = 80;   // % — dépenses/ventes max
  const SEUIL_TRESO_CRITIQUE  = 100000; // XPF
  const SEUIL_TRESO_WARNING   = 300000; // XPF
  const JOURS_FACTURE_RETARD  = 30;   // jours
  const JOURS_DEVIS_ATTENTE   = 15;   // jours
  const JOURS_CRM_INACTIF     = 21;   // jours

  /* ================================================================
     UTILITAIRES INTERNES
     ================================================================ */
  function _now() { return new Date(); }

  function _moisCourant() {
    const n = _now();
    return { an: n.getFullYear(), mo: n.getMonth() };
  }

  function _moisPrecedent() {
    const n = _now();
    let mo = n.getMonth() - 1;
    let an = n.getFullYear();
    if (mo < 0) { mo = 11; an--; }
    return { an, mo };
  }

  function _filtreMois(items, dateField, an, mo) {
    return items.filter(i => {
      const d = new Date(i[dateField] || i._createdAt || '');
      return !isNaN(d) && d.getFullYear() === an && d.getMonth() === mo;
    });
  }

  function _joursDepuis(dateStr) {
    if (!dateStr) return 9999;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  }

  function _fmtNum(n) {
    if (n == null) return '—';
    return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' XPF';
  }

  function _fmtPct(n) { return Math.round(n) + '%'; }

  /* ================================================================
     MOTEUR D'ANALYSE — retourne un tableau d'alertes
     ================================================================ */
  function analyser() {
    const db     = Store.getDB();
    const alertes = [];

    /* --- Agrégats du mois courant --- */
    const { an: anCur, mo: moCur } = _moisCourant();
    const { an: anPrev, mo: moPrev } = _moisPrecedent();

    const factures    = db.factures    || [];
    const depenses    = db.depenses    || [];
    const devis       = db.devis       || [];
    const produits    = db.produits    || [];
    const opportunites= db.opportunites|| [];
    const ordresFab   = db.ordresFab   || [];
    const ecritures   = db.ecritures   || [];

    /* ==============================================================
       1. MARGE BRUTE : Ventes TTC vs Dépenses TTC (mois courant)
       ============================================================== */
    const ventesPayeesMois = _filtreMois(
      factures.filter(f => ['Payé','Payée'].includes(f.statut)), 'date', anCur, moCur
    ).reduce((s,f) => s + (f.totalTTC||0), 0);

    const toutesVentesMois = _filtreMois(factures, 'date', anCur, moCur)
      .reduce((s,f) => s + (f.totalTTC||0), 0);

    const depensesMois = _filtreMois(depenses, 'date', anCur, moCur)
      .reduce((s,d) => s + (d.montantTTC||0), 0);

    const margeBrute  = toutesVentesMois - depensesMois;
    const margePct    = toutesVentesMois > 0
      ? Math.round(margeBrute / toutesVentesMois * 100) : 0;
    const depPct      = toutesVentesMois > 0
      ? Math.round(depensesMois / toutesVentesMois * 100) : 100;

    if (toutesVentesMois > 0) {
      if (depPct >= SEUIL_DEP_VENTES) {
        alertes.push({
          niveau: 'critique',
          icone:  '⚠️',
          titre:  'Dépenses trop élevées ce mois-ci',
          detail: `Tes dépenses représentent ${depPct}% de tes ventes (${_fmtNum(depensesMois)} / ${_fmtNum(toutesVentesMois)}). Marge brute : ${_fmtNum(margeBrute)}.`,
          action: 'Revoir les postes de dépenses — catégorie la plus lourde :',
          lien:   { label:'Voir les dépenses', app:'comptabilite', vue:'depenses' },
          poids:  30
        });
      } else if (margePct < SEUIL_MARGE_WARNING) {
        alertes.push({
          niveau: 'avertissement',
          icone:  '📉',
          titre:  `Marge brute faible : ${margePct}%`,
          detail: `Ventes : ${_fmtNum(toutesVentesMois)} · Dépenses : ${_fmtNum(depensesMois)} · Résultat : ${_fmtNum(margeBrute)}.`,
          action: `Objectif marge recommandé : >${SEUIL_MARGE_WARNING}%`,
          lien:   { label:'Analyser les dépenses', app:'comptabilite', vue:'depenses' },
          poids:  15
        });
      } else if (margePct >= 50) {
        alertes.push({
          niveau: 'opportunite',
          icone:  '🚀',
          titre:  `Excellente marge ce mois : ${margePct}%`,
          detail: `Ventes : ${_fmtNum(toutesVentesMois)} · Bénéfice brut : ${_fmtNum(margeBrute)}.`,
          action: 'Continue sur cette lancée ! Envisage de réinvestir dans le stock ou l\'équipement.',
          lien:   null,
          poids:  -10
        });
      }
    } else if (depensesMois > 0) {
      alertes.push({
        niveau: 'critique',
        icone:  '🔴',
        titre:  'Dépenses ce mois sans ventes enregistrées',
        detail: `${_fmtNum(depensesMois)} de dépenses pour 0 vente. Pensez à enregistrer vos ventes ou à créer vos factures.`,
        action: 'Créer une facture ou vérifier les statuts de paiement.',
        lien:   { label:'Voir les factures', app:'ventes', vue:'invoices' },
        poids:  25
      });
    }

    /* ==============================================================
       2. ÉVOLUTION CA — mois M vs mois M-1
       ============================================================== */
    const ventesPrev = _filtreMois(factures, 'date', anPrev, moPrev)
      .reduce((s,f) => s + (f.totalTTC||0), 0);

    if (ventesPrev > 0 && toutesVentesMois > 0) {
      const evol = Math.round((toutesVentesMois - ventesPrev) / ventesPrev * 100);
      if (evol <= -15) {
        alertes.push({
          niveau: 'avertissement',
          icone:  '📉',
          titre:  `CA en baisse de ${Math.abs(evol)}% vs mois précédent`,
          detail: `Mois courant : ${_fmtNum(toutesVentesMois)} · Mois précédent : ${_fmtNum(ventesPrev)}.`,
          action: 'Analyser les causes : moins de commandes ? Clients perdus ? Devis non convertis ?',
          lien:   { label:'Voir le rapport ventes', app:'ventes', vue:'sales-report' },
          poids:  12
        });
      } else if (evol >= 20) {
        alertes.push({
          niveau: 'opportunite',
          icone:  '📈',
          titre:  `CA en hausse de ${evol}% vs mois précédent !`,
          detail: `Mois courant : ${_fmtNum(toutesVentesMois)} · Mois précédent : ${_fmtNum(ventesPrev)}.`,
          action: 'Excellente progression ! Vérifier que la production peut suivre la demande.',
          lien:   null,
          poids:  -8
        });
      }
    }

    /* ==============================================================
       3. FACTURES IMPAYÉES > 30 JOURS
       ============================================================== */
    const facturesRetard = factures.filter(f => {
      if (['Payé','Payée','Annulé','Annulée'].includes(f.statut)) return false;
      return _joursDepuis(f.dateEcheance || f.date) > JOURS_FACTURE_RETARD;
    });
    const montantRetard = facturesRetard.reduce((s,f) => s+(f.totalTTC||0), 0);

    if (facturesRetard.length > 0) {
      alertes.push({
        niveau: facturesRetard.length >= 3 ? 'critique' : 'avertissement',
        icone:  '🧾',
        titre:  `${facturesRetard.length} facture${facturesRetard.length>1?'s':''} impayée${facturesRetard.length>1?'s':''} depuis plus de ${JOURS_FACTURE_RETARD} jours`,
        detail: `Montant total à recouvrer : ${_fmtNum(montantRetard)}. Clients concernés : ${facturesRetard.map(f=>f.client||'—').join(', ')}.`,
        action: 'Envoyer des relances de paiement dès aujourd\'hui.',
        lien:   { label:'Voir les factures', app:'ventes', vue:'invoices' },
        poids:  facturesRetard.length >= 3 ? 25 : 12
      });
    }

    /* ==============================================================
       4. TVA — Solde déductible vs collectée
       ============================================================== */
    const tvaCollecteeMois = _filtreMois(depenses.filter(()=>false), 'date', anCur, moCur); // placeholder
    const tvaDedMois    = _filtreMois(depenses, 'date', anCur, moCur)
      .reduce((s,d) => s + (d.montantTVA||0), 0);
    const tvaColMois    = _filtreMois(factures, 'date', anCur, moCur)
      .reduce((s,f) => {
        const ttc = f.totalTTC || 0;
        const ht  = f.totalHT  || Math.round(ttc / 1.13);
        return s + (ttc - ht);
      }, 0);
    const soldeTVA = tvaColMois - tvaDedMois;

    if (soldeTVA > 0) {
      alertes.push({
        niveau: 'conseil',
        icone:  '💡',
        titre:  `TVA à reverser ce mois : ${_fmtNum(soldeTVA)}`,
        detail: `TVA collectée sur ventes : ${_fmtNum(tvaColMois)} · TVA déductible sur achats : ${_fmtNum(tvaDedMois)}.`,
        action: 'Prévoir le règlement de la TVA nette avant la date déclarative.',
        lien:   { label:'Rapport TVA', app:'comptabilite', vue:'tax-report' },
        poids:  0
      });
    } else if (tvaDedMois > tvaColMois && tvaDedMois > 0) {
      alertes.push({
        niveau: 'opportunite',
        icone:  '💰',
        titre:  `Crédit de TVA ce mois : ${_fmtNum(Math.abs(soldeTVA))}`,
        detail: `Ta TVA déductible (${_fmtNum(tvaDedMois)}) dépasse ta TVA collectée (${_fmtNum(tvaColMois)}). Tu as un crédit à reporter.`,
        action: 'Reporter ce crédit sur la prochaine déclaration TVA.',
        lien:   null,
        poids:  -5
      });
    }

    /* ==============================================================
       5. STOCK SOUS SEUIL
       ============================================================== */
    const produitsRupture = produits.filter(p => (p.stock||0) <= 0);
    const produitsBas     = produits.filter(p => (p.stock||0) > 0 && (p.stock||0) <= (p.stockMin||5));

    if (produitsRupture.length > 0) {
      alertes.push({
        niveau: 'critique',
        icone:  '📦',
        titre:  `${produitsRupture.length} produit${produitsRupture.length>1?'s':''} en rupture de stock`,
        detail: `Références : ${produitsRupture.slice(0,4).map(p=>p.nom).join(', ')}${produitsRupture.length>4?'…':''}.`,
        action: 'Passer des commandes fournisseur immédiatement.',
        lien:   { label:'Voir le stock', app:'stock', vue:'products' },
        poids:  20
      });
    } else if (produitsBas.length > 0) {
      alertes.push({
        niveau: 'avertissement',
        icone:  '⚠️',
        titre:  `${produitsBas.length} produit${produitsBas.length>1?'s':''} sous le seuil minimum`,
        detail: `${produitsBas.slice(0,4).map(p=>`${p.nom} (${p.stock} restants)`).join(', ')}${produitsBas.length>4?'…':''}.`,
        action: 'Anticiper les réapprovisionnements avant rupture.',
        lien:   { label:'Voir le stock', app:'stock', vue:'stock-report' },
        poids:  10
      });
    }

    /* ==============================================================
       6. DEVIS EN ATTENTE DE RÉPONSE > 15 JOURS
       ============================================================== */
    const devisEnAttente = devis.filter(d => {
      if (!['Envoyé','Brouillon'].includes(d.statut)) return false;
      return _joursDepuis(d.date) > JOURS_DEVIS_ATTENTE;
    });

    if (devisEnAttente.length > 0) {
      const montantDevis = devisEnAttente.reduce((s,d)=>s+(d.totalTTC||0),0);
      alertes.push({
        niveau: 'avertissement',
        icone:  '📄',
        titre:  `${devisEnAttente.length} devis sans réponse depuis +${JOURS_DEVIS_ATTENTE} jours`,
        detail: `Montant potentiel : ${_fmtNum(montantDevis)}. Clients : ${devisEnAttente.slice(0,3).map(d=>d.client||'—').join(', ')}.`,
        action: 'Relancer chaque client par téléphone ou email pour conclure la vente.',
        lien:   { label:'Voir les devis', app:'ventes', vue:'quotes' },
        poids:  10
      });
    }

    /* ==============================================================
       7. TRÉSORERIE (écritures 512 Banque + 530 Caisse)
       ============================================================== */
    const tresorerie = ecritures
      .filter(e => ['512000','530000','512','530'].includes(String(e.compte||'')))
      .reduce((s,e) => s + (Number(e.debit)||0) - (Number(e.credit)||0), 0);

    if (tresorerie < SEUIL_TRESO_CRITIQUE) {
      alertes.push({
        niveau: 'critique',
        icone:  '🏦',
        titre:  `Trésorerie critique : ${_fmtNum(tresorerie)}`,
        detail: `Le solde combiné Banque + Caisse est inférieur à ${_fmtNum(SEUIL_TRESO_CRITIQUE)}.`,
        action: 'Accélérer les encaissements de factures et reporter les dépenses non urgentes.',
        lien:   { label:'Voir le journal', app:'comptabilite', vue:'journal' },
        poids:  30
      });
    } else if (tresorerie < SEUIL_TRESO_WARNING) {
      alertes.push({
        niveau: 'avertissement',
        icone:  '💸',
        titre:  `Trésorerie à surveiller : ${_fmtNum(tresorerie)}`,
        detail: `Solde Banque + Caisse en dessous de ${_fmtNum(SEUIL_TRESO_WARNING)}.`,
        action: 'Surveiller les entrées/sorties et anticiper les règlements fournisseurs.',
        lien:   null,
        poids:  8
      });
    }

    /* ==============================================================
       8. ORDRES DE FABRICATION EN RETARD
       ============================================================== */
    const ofEnRetard = ordresFab.filter(of => {
      if (['Terminé','Annulé'].includes(of.statut)) return false;
      if (!of.dateButoir) return false;
      return new Date(of.dateButoir) < _now();
    });

    if (ofEnRetard.length > 0) {
      alertes.push({
        niveau: 'avertissement',
        icone:  '🏭',
        titre:  `${ofEnRetard.length} ordre${ofEnRetard.length>1?'s':''} de fabrication en retard`,
        detail: `OF concernés : ${ofEnRetard.slice(0,4).map(o=>o.ref||o.id).join(', ')}.`,
        action: 'Prioriser ces ordres en production pour respecter les délais clients.',
        lien:   { label:'Voir la production', app:'production', vue:'mo' },
        poids:  8
      });
    }

    /* ==============================================================
       9. OPPORTUNITÉS CRM NON SUIVIES
       ============================================================== */
    const oppsInactives = (db.opportunites||[]).filter(o => {
      if (['Gagné','Perdu'].includes(o.statut)) return false;
      return _joursDepuis(o._updatedAt || o._createdAt) > JOURS_CRM_INACTIF;
    });

    if (oppsInactives.length > 0) {
      const mntOpp = oppsInactives.reduce((s,o)=>s+(o.montant||0),0);
      alertes.push({
        niveau: 'conseil',
        icone:  '🎯',
        titre:  `${oppsInactives.length} opportunité${oppsInactives.length>1?'s':''} CRM sans activité depuis +${JOURS_CRM_INACTIF} jours`,
        detail: `Potentiel commercial non exploité : ${_fmtNum(mntOpp)}.`,
        action: 'Recontacter ces prospects pour faire avancer le pipeline.',
        lien:   { label:'Voir le pipeline CRM', app:'crm', vue:'pipeline' },
        poids:  5
      });
    }

    /* ==============================================================
       10. TOP CATÉGORIE DE DÉPENSES (conseil)
       ============================================================== */
    const catTotaux = {};
    depensesMoisItems().forEach(d => {
      catTotaux[d.categorie] = (catTotaux[d.categorie]||0) + (d.montantTTC||0);
    });
    const topCat = Object.entries(catTotaux).sort(([,a],[,b])=>b-a)[0];
    if (topCat && depensesMois > 0) {
      const pctTop = Math.round(topCat[1] / depensesMois * 100);
      if (pctTop > 40) {
        alertes.push({
          niveau: 'conseil',
          icone:  '💡',
          titre:  `"${topCat[0]}" représente ${pctTop}% de tes dépenses`,
          detail: `Ce poste pèse ${_fmtNum(topCat[1])} sur un total de ${_fmtNum(depensesMois)} de dépenses ce mois.`,
          action: 'Analyser si ce poste peut être optimisé (renégociation, substitution, mutualisation).',
          lien:   { label:'Voir les dépenses', app:'comptabilite', vue:'depenses' },
          poids:  0
        });
      }
    }

    return alertes;

    /* Helper interne */
    function depensesMoisItems() {
      return _filtreMois(depenses, 'date', anCur, moCur);
    }
  }

  /* ================================================================
     CALCUL DU SCORE DE SANTÉ FINANCIÈRE (0–100)
     ================================================================ */
  function calculerScore(alertes) {
    let score = 100;
    alertes.forEach(a => { score -= (a.poids || 0); });
    return Math.max(0, Math.min(100, score));
  }

  /* ================================================================
     EXÉCUTION AU LOGIN — notifications + toast résumé
     ================================================================ */
  function runAtLogin() {
    try {
      const alertes   = analyser();
      const critiques = alertes.filter(a => a.niveau === 'critique');
      const warnings  = alertes.filter(a => a.niveau === 'avertissement');

      /* Ajouter les alertes critiques dans les notifications système */
      critiques.forEach(a => {
        Store.addNotification(`${a.icone} ${a.titre}`, 'conseiller');
      });

      /* Toast de résumé */
      if (critiques.length > 0) {
        setTimeout(() => {
          if (typeof toast === 'function') {
            toast(
              `🔴 ${critiques.length} alerte${critiques.length>1?'s':''} critique${critiques.length>1?'s':''} — consulte le Conseiller Comptable`,
              'error'
            );
          }
        }, 1500);
      } else if (warnings.length > 0) {
        setTimeout(() => {
          if (typeof toast === 'function') {
            toast(
              `⚠️ ${warnings.length} point${warnings.length>1?'s':''} à surveiller — consulte le Conseiller Comptable`,
              'warning'
            );
          }
        }, 1500);
      } else if (alertes.length > 0) {
        setTimeout(() => {
          if (typeof toast === 'function') {
            toast('✅ Situation financière saine — aucune alerte critique', 'success');
          }
        }, 1500);
      }

      /* Badge dans la topbar sur le module Comptabilité */
      _updateTopbarBadge(critiques.length);

    } catch (e) {
      console.warn('[Advisor] Erreur analyse login :', e);
    }
  }

  /* ================================================================
     BADGE TOPBAR (rouge si alertes critiques)
     ================================================================ */
  function _updateTopbarBadge(count) {
    if (count <= 0) return;
    setTimeout(() => {
      const btn = document.querySelector('.app-item[data-app="comptabilite"]');
      if (!btn) return;
      let badge = btn.querySelector('.advisor-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'advisor-badge';
        badge.style.cssText = `
          position:absolute; top:4px; right:4px;
          background:#DC2626; color:#fff;
          font-size:9px; font-weight:700;
          border-radius:99px; padding:1px 5px;
          min-width:16px; text-align:center;
          line-height:14px; pointer-events:none;
        `;
        btn.style.position = 'relative';
        btn.appendChild(badge);
      }
      badge.textContent = count;
    }, 800);
  }

  /* ================================================================
     VUE PANEL "CONSEILLER COMPTABLE" dans la Comptabilité
     ================================================================ */
  function init(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="Advisor.genererBilan()">
        🖨️ Générer le bilan
      </button>
      <button class="btn btn-ghost btn-sm" onclick="Advisor.init(document.getElementById('toolbar-actions'), document.getElementById('view-content'))"
        title="Rafraîchir l'analyse">
        🔄 Actualiser
      </button>
    `;

    const alertes = analyser();
    const score   = calculerScore(alertes);
    const critiques  = alertes.filter(a => a.niveau === 'critique');
    const warnings   = alertes.filter(a => a.niveau === 'avertissement');
    const conseils   = alertes.filter(a => a.niveau === 'conseil');
    const opportunites = alertes.filter(a => a.niveau === 'opportunite');

    const scoreColor = score >= 75 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626';
    const scoreLabel = score >= 75 ? 'Bonne santé' : score >= 50 ? 'À surveiller' : 'Attention requise';

    const { an: anCur, mo: moCur } = _moisCourant();
    const MOIS = ['Janv','Févr','Mars','Avr','Mai','Juin',
                  'Juil','Août','Sept','Oct','Nov','Déc'];

    area.innerHTML = `
      <div style="padding:24px;max-width:1100px;">

        <!-- En-tête -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;
             gap:20px;margin-bottom:24px;flex-wrap:wrap;">

          <!-- Score santé -->
          <div class="card" style="padding:24px 32px;display:flex;align-items:center;gap:24px;min-width:280px;">
            <div style="position:relative;width:90px;height:90px;">
              <svg viewBox="0 0 90 90" style="transform:rotate(-90deg);">
                <circle cx="45" cy="45" r="38" fill="none" stroke="#E5E7EB" stroke-width="8"/>
                <circle cx="45" cy="45" r="38" fill="none" stroke="${scoreColor}" stroke-width="8"
                  stroke-dasharray="${2*Math.PI*38}"
                  stroke-dashoffset="${2*Math.PI*38*(1-score/100)}"
                  stroke-linecap="round"/>
              </svg>
              <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                align-items:center;justify-content:center;">
                <span style="font-size:22px;font-weight:800;color:${scoreColor};
                  font-family:var(--font-mono);">${score}</span>
                <span style="font-size:9px;color:var(--text-muted);">/100</span>
              </div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;
                letter-spacing:.08em;margin-bottom:4px;">Score de santé</div>
              <div style="font-size:20px;font-weight:700;color:${scoreColor};">${scoreLabel}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                ${MOIS[moCur]} ${anCur} · Analyse en temps réel
              </div>
              <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                ${critiques.length ? `<span class="badge" style="background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;">🔴 ${critiques.length} critique${critiques.length>1?'s':''}</span>` : ''}
                ${warnings.length  ? `<span class="badge" style="background:#FFF7ED;color:#D97706;border:1px solid #FED7AA;">⚠️ ${warnings.length} avertissement${warnings.length>1?'s':''}</span>` : ''}
                ${conseils.length  ? `<span class="badge" style="background:#EFF6FF;color:#2563EB;border:1px solid #BFDBFE;">💡 ${conseils.length} conseil${conseils.length>1?'s':''}</span>` : ''}
                ${opportunites.length ? `<span class="badge" style="background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0;">✅ ${opportunites.length}</span>` : ''}
              </div>
            </div>
          </div>

          <!-- KPIs rapides -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;flex:1;min-width:400px;">
            ${_kpiCards()}
          </div>
        </div>

        <!-- Pas d'alertes -->
        ${alertes.length === 0 ? `
          <div class="card" style="padding:48px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">✅</div>
            <div style="font-size:18px;font-weight:700;color:#16A34A;margin-bottom:8px;">
              Situation financière saine !
            </div>
            <div style="color:var(--text-muted);">
              Aucune alerte détectée. Tous les indicateurs sont dans les normes.
            </div>
          </div>
        ` : ''}

        <!-- Alertes critiques -->
        ${critiques.length ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:13px;font-weight:700;color:#DC2626;text-transform:uppercase;
              letter-spacing:.08em;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
              <span>🔴 Alertes critiques — action immédiate requise</span>
            </div>
            ${critiques.map(a => _renderAlerte(a)).join('')}
          </div>
        ` : ''}

        <!-- Avertissements -->
        ${warnings.length ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:13px;font-weight:700;color:#D97706;text-transform:uppercase;
              letter-spacing:.08em;margin-bottom:10px;">⚠️ Avertissements — à traiter cette semaine</div>
            ${warnings.map(a => _renderAlerte(a)).join('')}
          </div>
        ` : ''}

        <!-- Conseils -->
        ${conseils.length ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:13px;font-weight:700;color:#2563EB;text-transform:uppercase;
              letter-spacing:.08em;margin-bottom:10px;">💡 Conseils & recommandations</div>
            ${conseils.map(a => _renderAlerte(a)).join('')}
          </div>
        ` : ''}

        <!-- Opportunités -->
        ${opportunites.length ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:13px;font-weight:700;color:#16A34A;text-transform:uppercase;
              letter-spacing:.08em;margin-bottom:10px;">✅ Points positifs</div>
            ${opportunites.map(a => _renderAlerte(a)).join('')}
          </div>
        ` : ''}

      </div>
    `;
  }

  /* --- Carte alerte individuelle --- */
  function _renderAlerte(a) {
    const styles = {
      critique:      { bg:'#FEF2F2', bord:'#FECACA', col:'#B91C1C', dot:'#DC2626' },
      avertissement: { bg:'#FFFBEB', bord:'#FDE68A', col:'#92400E', dot:'#D97706' },
      conseil:       { bg:'#EFF6FF', bord:'#BFDBFE', col:'#1E40AF', dot:'#2563EB' },
      opportunite:   { bg:'#F0FDF4', bord:'#BBF7D0', col:'#14532D', dot:'#16A34A' }
    };
    const s = styles[a.niveau] || styles.conseil;

    return `
      <div style="background:${s.bg};border:1px solid ${s.bord};border-left:4px solid ${s.dot};
           border-radius:var(--radius-lg);padding:16px 18px;margin-bottom:10px;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <span style="font-size:22px;flex-shrink:0;">${a.icone}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:14px;color:${s.col};margin-bottom:4px;">
              ${a.titre}
            </div>
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;line-height:1.5;">
              ${a.detail}
            </div>
            <div style="font-size:12px;font-weight:600;color:${s.dot};">
              → ${a.action}
            </div>
          </div>
          ${a.lien ? `
            <button class="btn btn-ghost btn-sm" style="flex-shrink:0;border-color:${s.dot};color:${s.dot};"
              onclick="openApp('${a.lien.app}');setTimeout(()=>openView('${a.lien.vue}'),60);">
              ${a.lien.label} →
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /* --- KPI cards rapides --- */
  function _kpiCards() {
    const db = Store.getDB();
    const { an, mo } = _moisCourant();
    const factures = db.factures || [];
    const depenses = db.depenses || [];

    const vtesMois = _filtreMois(factures, 'date', an, mo).reduce((s,f)=>s+(f.totalTTC||0),0);
    const depMois  = _filtreMois(depenses, 'date', an, mo).reduce((s,d)=>s+(d.montantTTC||0),0);
    const resultat = vtesMois - depMois;
    const marge    = vtesMois > 0 ? Math.round(resultat/vtesMois*100) : 0;
    const factImpay= factures.filter(f=>!['Payé','Payée','Annulé','Annulée'].includes(f.statut)).length;
    const tvaADeclarer = _filtreMois(depenses, 'date', an, mo).reduce((s,d)=>s+(d.montantTVA||0),0);

    return [
      { icon:'📈', label:'Ventes ce mois', val:_fmtNum(vtesMois), color:'#16A34A' },
      { icon:'💸', label:'Dépenses ce mois', val:_fmtNum(depMois), color:'#DC2626' },
      { icon:'💰', label:`Résultat (marge ${marge}%)`, val:_fmtNum(resultat),
        color: resultat >= 0 ? '#16A34A' : '#DC2626' },
      { icon:'🧾', label:'Factures impayées', val:factImpay + ' facture' + (factImpay>1?'s':''),
        color: factImpay > 0 ? '#D97706' : '#6B7280' },
      { icon:'💡', label:'TVA déductible ce mois', val:_fmtNum(tvaADeclarer), color:'#0891B2' },
      { icon:'📦', label:'Produits sous seuil',
        val:(db.produits||[]).filter(p=>(p.stock||0)<=(p.stockMin||5)).length + ' réf.',
        color:'#7C3AED' }
    ].map(k => `
      <div class="card" style="padding:14px 16px;">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);
          text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">
          ${k.icon} ${k.label}
        </div>
        <div style="font-size:16px;font-weight:700;color:${k.color};
          font-family:var(--font-mono);">${k.val}</div>
      </div>
    `).join('');
  }

  /* ================================================================
     GÉNÉRATION DU BILAN IMPRIMABLE
     ================================================================ */
  function genererBilan() {
    const db   = Store.getDB();
    const now  = new Date();
    const { an, mo } = _moisCourant();
    const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin',
                  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

    const factures = db.factures || [];
    const depenses = db.depenses || [];

    const _fm = (items, an, mo) => _filtreMois(items, 'date', an, mo);

    /* Données mois courant */
    const vtesMois  = _fm(factures, an, mo).reduce((s,f)=>s+(f.totalTTC||0),0);
    const vtesPay   = _fm(factures.filter(f=>['Payé','Payée'].includes(f.statut)), an, mo).reduce((s,f)=>s+(f.totalTTC||0),0);
    const depMois   = _fm(depenses, an, mo).reduce((s,d)=>s+(d.montantTTC||0),0);
    const depHT     = _fm(depenses, an, mo).reduce((s,d)=>s+(d.montantHT||0),0);
    const tva13     = _fm(depenses.filter(d=>d.tauxTVA===13), an, mo).reduce((s,d)=>s+(d.montantTVA||0),0);
    const tva16     = _fm(depenses.filter(d=>d.tauxTVA===16), an, mo).reduce((s,d)=>s+(d.montantTVA||0),0);
    const tvaTot    = tva13 + tva16;
    const resultat  = vtesMois - depMois;
    const alertes   = analyser();
    const score     = calculerScore(alertes);

    /* Dépenses par catégorie */
    const cats = {};
    _fm(depenses, an, mo).forEach(d => {
      cats[d.categorie||'Divers'] = (cats[d.categorie||'Divers']||0) + (d.montantTTC||0);
    });
    const catsTriees = Object.entries(cats).sort(([,a],[,b])=>b-a);

    /* Générer l'HTML du bilan */
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Bilan HCS — ${MOIS[mo]} ${an}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; color:#1E1E2D; background:#fff; padding:30px; font-size:13px; }
    h1 { font-size:22px; font-weight:800; color:#1E1E2D; margin-bottom:4px; }
    h2 { font-size:14px; font-weight:700; color:#374151; margin:20px 0 10px; padding-bottom:6px; border-bottom:2px solid #E5E7EB; }
    h3 { font-size:12px; font-weight:700; color:#6B7280; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; padding-bottom:20px; border-bottom:3px solid #6366F1; }
    .logo { font-size:28px; font-weight:900; color:#6366F1; }
    .subtitle { font-size:13px; color:#6B7280; margin-top:4px; }
    .period-badge { background:#EEF2FF; color:#6366F1; border:2px solid #C7D2FE; border-radius:8px; padding:8px 16px; text-align:center; }
    .period-badge strong { display:block; font-size:16px; font-weight:800; }
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
    .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px; }
    .card { background:#F9FAFB; border:1px solid #E5E7EB; border-radius:8px; padding:14px 16px; }
    .kpi-val { font-size:22px; font-weight:800; font-family:monospace; margin-top:4px; }
    .kpi-lbl { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#6B7280; }
    table { width:100%; border-collapse:collapse; margin-bottom:16px; }
    th { background:#F3F4F6; font-size:11px; font-weight:700; color:#374151; text-transform:uppercase; padding:8px 12px; text-align:left; }
    td { padding:8px 12px; border-bottom:1px solid #E5E7EB; font-size:13px; }
    tr:last-child td { border-bottom:none; }
    .total-row td { background:#F9FAFB; font-weight:700; border-top:2px solid #E5E7EB; }
    .right { text-align:right; font-family:monospace; }
    .green { color:#16A34A; }
    .red { color:#DC2626; }
    .blue { color:#0891B2; }
    .purple { color:#7C3AED; }
    .bar { height:8px; background:#E5E7EB; border-radius:4px; margin-top:4px; }
    .bar-fill { height:100%; border-radius:4px; background:#6366F1; }
    .score-box { display:flex; align-items:center; gap:16px; padding:16px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:8px; margin-bottom:20px; }
    .score-circle { width:64px; height:64px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:800; font-size:20px; border:4px solid; }
    .alerte { padding:10px 14px; border-radius:6px; margin-bottom:8px; border-left:4px solid; }
    .alerte-critique { background:#FEF2F2; border-color:#DC2626; }
    .alerte-avert { background:#FFFBEB; border-color:#D97706; }
    .alerte-conseil { background:#EFF6FF; border-color:#2563EB; }
    .alerte-opp { background:#F0FDF4; border-color:#16A34A; }
    .alerte-titre { font-weight:700; font-size:13px; margin-bottom:3px; }
    .footer { margin-top:32px; padding-top:16px; border-top:1px solid #E5E7EB; display:flex; justify-content:space-between; color:#9CA3AF; font-size:11px; }
    @media print {
      body { padding:20px; }
      button { display:none; }
      .page-break { page-break-before:always; }
    }
  </style>
</head>
<body>

  <div style="text-align:right;margin-bottom:20px;">
    <button onclick="window.print()" style="background:#6366F1;color:#fff;border:none;
      border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;">
      🖨️ Imprimer ce bilan
    </button>
  </div>

  <!-- En-tête -->
  <div class="header">
    <div>
      <div class="logo">⬡ HCS ERP</div>
      <h1 style="margin-top:8px;">Bilan de Gestion Mensuel</h1>
      <div class="subtitle">HCS Polynésie · Système de gestion comptable</div>
      <div class="subtitle">Généré le ${now.toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'})} à ${now.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}</div>
    </div>
    <div class="period-badge">
      <span style="font-size:11px;color:#6B7280;">PÉRIODE</span>
      <strong>${MOIS[mo]} ${an}</strong>
    </div>
  </div>

  <!-- Score de santé -->
  <div class="score-box">
    <div class="score-circle" style="border-color:${score>=75?'#16A34A':score>=50?'#D97706':'#DC2626'};
      color:${score>=75?'#16A34A':score>=50?'#D97706':'#DC2626'};">
      ${score}
    </div>
    <div>
      <div style="font-weight:700;font-size:16px;">Score de santé financière : ${score>=75?'Bonne santé ✅':score>=50?'À surveiller ⚠️':'Attention requise 🔴'}</div>
      <div style="color:#6B7280;font-size:12px;margin-top:4px;">
        ${alertes.filter(a=>a.niveau==='critique').length} alerte(s) critique(s) ·
        ${alertes.filter(a=>a.niveau==='avertissement').length} avertissement(s) ·
        Score calculé sur ${alertes.length} indicateurs analysés
      </div>
    </div>
  </div>

  <!-- Résultats clés -->
  <h2>1. Résultats du mois — ${MOIS[mo]} ${an}</h2>
  <div class="grid3">
    <div class="card">
      <div class="kpi-lbl">📈 Chiffre d'affaires TTC</div>
      <div class="kpi-val green">${_fmtNum(vtesMois)}</div>
      <div style="font-size:11px;color:#6B7280;margin-top:4px;">dont encaissé : ${_fmtNum(vtesPay)}</div>
    </div>
    <div class="card">
      <div class="kpi-lbl">💸 Dépenses TTC</div>
      <div class="kpi-val red">${_fmtNum(depMois)}</div>
      <div style="font-size:11px;color:#6B7280;margin-top:4px;">HT : ${_fmtNum(depHT)}</div>
    </div>
    <div class="card">
      <div class="kpi-lbl">💰 Résultat brut</div>
      <div class="kpi-val ${resultat>=0?'green':'red'}">${_fmtNum(resultat)}</div>
      <div style="font-size:11px;color:#6B7280;margin-top:4px;">
        Marge : ${vtesMois>0?Math.round(resultat/vtesMois*100)+'%':'—'}
      </div>
    </div>
  </div>

  <!-- Dépenses par catégorie -->
  <h2>2. Détail des dépenses par catégorie</h2>
  <table>
    <thead><tr><th>Catégorie</th><th class="right">Montant TTC</th><th class="right">% des dépenses</th><th>Répartition</th></tr></thead>
    <tbody>
      ${catsTriees.map(([cat, mont]) => {
        const pct = Math.round(mont / (depMois||1) * 100);
        return `<tr>
          <td>${cat}</td>
          <td class="right" style="font-family:monospace;">${_fmtNum(mont)}</td>
          <td class="right">${pct}%</td>
          <td><div class="bar"><div class="bar-fill" style="width:${pct}%;"></div></div></td>
        </tr>`;
      }).join('')}
    </tbody>
    <tfoot><tr class="total-row">
      <td><strong>TOTAL DÉPENSES</strong></td>
      <td class="right red"><strong>${_fmtNum(depMois)}</strong></td>
      <td class="right">100%</td>
      <td></td>
    </tr></tfoot>
  </table>

  <!-- TVA -->
  <h2>3. Synthèse TVA</h2>
  <div class="grid3">
    <div class="card">
      <div class="kpi-lbl blue">TVA déductible (13%)</div>
      <div class="kpi-val blue">${_fmtNum(tva13)}</div>
    </div>
    <div class="card">
      <div class="kpi-lbl purple">TVA déductible (16%)</div>
      <div class="kpi-val purple">${_fmtNum(tva16)}</div>
    </div>
    <div class="card">
      <div class="kpi-lbl">Total TVA déductible</div>
      <div class="kpi-val">${_fmtNum(tvaTot)}</div>
    </div>
  </div>
  <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:12px 16px;font-size:13px;color:#1E40AF;">
    💡 <strong>Rappel :</strong> Conserver toutes les factures fournisseurs pour justifier la TVA déductible lors de la déclaration.
  </div>

  <!-- Recommandations -->
  <div class="page-break"></div>
  <h2 style="margin-top:24px;">4. Recommandations du Conseiller Comptable</h2>
  ${alertes.length === 0
    ? '<div style="color:#16A34A;padding:16px;background:#F0FDF4;border-radius:8px;">✅ Aucune alerte — situation financière saine.</div>'
    : alertes.map(a => `
      <div class="alerte alerte-${a.niveau==='critique'?'critique':a.niveau==='avertissement'?'avert':a.niveau==='conseil'?'conseil':'opp'}">
        <div class="alerte-titre">${a.icone} ${a.titre}</div>
        <div style="font-size:12px;color:#374151;">${a.detail}</div>
        <div style="font-size:12px;font-weight:600;margin-top:4px;">→ ${a.action}</div>
      </div>
    `).join('')
  }

  <!-- Pied de page -->
  <div class="footer">
    <span>HCS ERP v2.0 · Polynésie Française</span>
    <span>Bilan ${MOIS[mo]} ${an} · Généré automatiquement</span>
    <span>Confidentiel — usage interne</span>
  </div>

</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      if (typeof toast === 'function') toast('Pop-up bloquée — autorise les pop-ups pour ce site.', 'error');
    }
  }

  /* ================================================================
     API PUBLIQUE
     ================================================================ */
  return { init, analyser, calculerScore, runAtLogin, genererBilan };

})();

/* Exposition globale */
window.Advisor = Advisor;
