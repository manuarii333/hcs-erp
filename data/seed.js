/* ================================================================
   HCS ERP — data/seed.js
   Données initiales complètes HCS Polynésie.
   Chargé au premier démarrage par store.js si localStorage vide.
   ================================================================ */

'use strict';

/* ================================================================
   SEED : objet global consommé par Store.load()
   ================================================================ */
const SEED = {

  /* ==============================================================
     PRODUITS (16)
     Textile, sublimation, DTF, découpe, signalétique, accessoires,
     consommables, services — prix en XPF, TVA 16%/13%
     ============================================================== */
  produits: [
    /* --- TEXTILE --- */
    {
      id: 'prod-001', sku: 'TEX-POLO-001', emoji: '👕',
      nom: 'Polo brodé personnalisé',
      categorie: 'Textile',
      prix: 3500, cout: 1200, stock: 85, stockMin: 10,
      unite: 'pce', description: 'Polo 100% coton piqué 220g, broderie jusqu\'à 10 000 points'
    },
    {
      id: 'prod-002', sku: 'TEX-TSHIRT-001', emoji: '👕',
      nom: 'T-shirt impression DTF',
      categorie: 'Textile',
      prix: 2200, cout: 750, stock: 120, stockMin: 15,
      unite: 'pce', description: 'T-shirt col rond 190g, impression DTF pleine couleur'
    },
    {
      id: 'prod-003', sku: 'TEX-CASQUETTE-001', emoji: '🧢',
      nom: 'Casquette brodée 5 panneaux',
      categorie: 'Textile',
      prix: 2800, cout: 900, stock: 42, stockMin: 8,
      unite: 'pce', description: 'Casquette coton 6 panneaux, broderie frontale logo'
    },
    {
      id: 'prod-004', sku: 'TEX-SAC-001', emoji: '👜',
      nom: 'Tote bag sérigraphié',
      categorie: 'Textile',
      prix: 1200, cout: 350, stock: 200, stockMin: 20,
      unite: 'pce', description: 'Sac coton naturel 150g, impression 1 couleur'
    },
    /* --- SUBLIMATION --- */
    {
      id: 'prod-005', sku: 'SUB-MUG-001', emoji: '☕',
      nom: 'Mug sublimation 320ml',
      categorie: 'Sublimation',
      prix: 1800, cout: 450, stock: 150, stockMin: 20,
      unite: 'pce', description: 'Mug blanc brillant 320ml, sublimation 360°'
    },
    {
      id: 'prod-006', sku: 'SUB-COUSSIN-001', emoji: '🛋️',
      nom: 'Coussin sublimé 40x40',
      categorie: 'Sublimation',
      prix: 2500, cout: 700, stock: 60, stockMin: 8,
      unite: 'pce', description: 'Coussin polyester avec garnissage, sublimation pleine face'
    },
    {
      id: 'prod-007', sku: 'SUB-PLAQUE-001', emoji: '🖼️',
      nom: 'Plaque aluminium sublimée A4',
      categorie: 'Sublimation',
      prix: 3200, cout: 900, stock: 35, stockMin: 5,
      unite: 'pce', description: 'Plaque alu blanc 21×29,7cm, sublimation HD, finition brillante'
    },
    /* --- DTF (Direct To Film) --- */
    {
      id: 'prod-008', sku: 'DTF-TRANSFERT-A4', emoji: '🎨',
      nom: 'Transfert DTF A4',
      categorie: 'DTF',
      prix: 850, cout: 220, stock: 500, stockMin: 50,
      unite: 'pce', description: 'Film DTF A4 prêt à presser, poudre colle incluse'
    },
    {
      id: 'prod-009', sku: 'DTF-TRANSFERT-A3', emoji: '🎨',
      nom: 'Transfert DTF A3',
      categorie: 'DTF',
      prix: 1400, cout: 380, stock: 320, stockMin: 30,
      unite: 'pce', description: 'Film DTF A3, idéal pour dos de t-shirt et grandes impressions'
    },
    /* --- DÉCOUPE VINYLE --- */
    {
      id: 'prod-010', sku: 'DEC-STICKER-A5', emoji: '✂️',
      nom: 'Sticker découpé A5',
      categorie: 'Découpe',
      prix: 600, cout: 150, stock: 0, stockMin: 20,
      unite: 'pce', description: 'Sticker vinyle adhésif découpé au tracé, A5'
    },
    {
      id: 'prod-011', sku: 'DEC-LETTRAGE-ML', emoji: '✂️',
      nom: 'Lettrage vinyle (par mètre linéaire)',
      categorie: 'Découpe',
      prix: 4500, cout: 1200, stock: 999, stockMin: 0,
      unite: 'ml', description: 'Vinyle adhésif découpé, pose incluse jusqu\'à 50m'
    },
    /* --- SIGNALÉTIQUE --- */
    {
      id: 'prod-012', sku: 'SIG-BACHE-M2', emoji: '🪟',
      nom: 'Bâche PVC imprimée (m²)',
      categorie: 'Signalétique',
      prix: 8500, cout: 2800, stock: 999, stockMin: 0,
      unite: 'm²', description: 'Bâche PVC 500g/m², impression UV, oeillets inclus'
    },
    {
      id: 'prod-013', sku: 'SIG-PANNEAU-A1', emoji: '🪟',
      nom: 'Panneau Dibond A1 imprimé',
      categorie: 'Signalétique',
      prix: 18000, cout: 7000, stock: 8, stockMin: 2,
      unite: 'pce', description: 'Panneau aluminium composite 3mm, impression numérique UV'
    },
    /* --- ACCESSOIRES / FOURNITURES --- */
    {
      id: 'prod-014', sku: 'ACC-CORDON-001', emoji: '🔑',
      nom: 'Cordon tour de cou sublimé',
      categorie: 'Accessoires',
      prix: 650, cout: 180, stock: 300, stockMin: 30,
      unite: 'pce', description: 'Cordon polyester sublimation, attache métal, longueur 45cm'
    },
    /* --- CONSOMMABLES --- */
    {
      id: 'prod-015', sku: 'CONS-ENCRE-DTF-1L', emoji: '🖨️',
      nom: 'Encre DTF 1 litre (C/M/Y/K/W)',
      categorie: 'Consommables',
      prix: 25000, cout: 15000, stock: 6, stockMin: 2,
      unite: 'L', description: 'Encre DTF pigmentaire 1L, compatible BN-20 / BN-30'
    },
    /* --- SERVICES --- */
    {
      id: 'prod-016', sku: 'SRV-DESIGN-H', emoji: '💻',
      nom: 'Création graphique (heure)',
      categorie: 'Services',
      prix: 7500, cout: 3000, stock: 999, stockMin: 0,
      unite: 'h', description: 'Studio graphique HCS, BAT inclus jusqu\'à 3 révisions'
    },
    /* --- TEXTILE HCS --- */
    {
      id: 'prod-017', sku: 'TUC-001', emoji: '👕',
      nom: 'T-shirt Unis Coton',
      categorie: 'Textile',
      prix: 1800, cout: 600, stock: 0, stockMin: 10,
      unite: 'pce', description: 'T-shirt uni 100% coton, disponible en plusieurs coloris'
    },
    {
      id: 'prod-018', sku: 'CAP-001', emoji: '🧢',
      nom: 'Casquette Polyester',
      categorie: 'Textile',
      prix: 2200, cout: 750, stock: 0, stockMin: 8,
      unite: 'pce', description: 'Casquette polyester, fermeture ajustable, personnalisable'
    },
    {
      id: 'prod-019', sku: 'HTV-001', emoji: '🔥',
      nom: 'Heat Transfer Vinyl',
      categorie: 'DTF',
      prix: 950, cout: 300, stock: 0, stockMin: 20,
      unite: 'pce', description: 'Transfert thermocollant heat transfer vinyl (HTV), pressage à chaud'
    }
  ],

  /* ==============================================================
     CONTACTS (8) — entreprises et particuliers polynésiens
     ============================================================== */
  contacts: [
    {
      id: 'cont-001', type: 'Mairie', nom: 'Mairie de Faa\'a',
      email: 'contact@mairie-faaa.pf', telephone: '40 80 45 00',
      adresse: 'BP 3030, Faa\'a, Tahiti', ile: 'Tahiti',
      interlocuteur: 'M. Oscar Temaru', siret: '10001000100010'
    },
    {
      id: 'cont-002', type: 'Hôtel', nom: 'Hotel Intercontinental Tahiti',
      email: 'achat@ihg-tahiti.pf', telephone: '40 47 88 88',
      adresse: 'BP 6014, Faaa, Tahiti', ile: 'Tahiti',
      interlocuteur: 'Mme. Vaiana Teriitahi', siret: '20002000200020'
    },
    {
      id: 'cont-003', type: 'Association', nom: 'Association Heiva i Tahiti',
      email: 'heiva@culture.pf', telephone: '40 54 54 00',
      adresse: 'Maison de la Culture, Papeete', ile: 'Tahiti',
      interlocuteur: 'M. Tamatoa Mara', siret: '30003000300030'
    },
    {
      id: 'cont-004', type: 'Commerce', nom: 'Carrefour Punaauia',
      email: 'direction@carrefour-punaauia.pf', telephone: '40 83 06 06',
      adresse: 'Centre commercial Aima, Punaauia', ile: 'Tahiti',
      interlocuteur: 'Mme. Céleste Dumont', siret: '40004000400040'
    },
    {
      id: 'cont-005', type: 'Compagnie aérienne', nom: 'Air Tahiti Nui',
      email: 'procurement@airtahitinui.pf', telephone: '40 86 42 42',
      adresse: 'BP 1673, Papeete, Tahiti', ile: 'Tahiti',
      interlocuteur: 'M. Henri Flosse', siret: '50005000500050'
    },
    {
      id: 'cont-006', type: 'Particulier', nom: 'Teiva Moana',
      email: 'teiva.moana@gmail.com', telephone: '87 23 45 67',
      adresse: 'Moorea, PK 12', ile: 'Moorea',
      interlocuteur: 'Teiva Moana', siret: null
    },
    {
      id: 'cont-007', type: 'Particulier', nom: 'Hina Teriitahi',
      email: 'hina.teriitahi@hotmail.fr', telephone: '87 56 78 90',
      adresse: 'Huahine, Fare', ile: 'Huahine',
      interlocuteur: 'Hina Teriitahi', siret: null
    },
    {
      id: 'cont-008', type: 'Particulier', nom: 'Patrick Legrand',
      email: 'p.legrand@outlook.com', telephone: '87 99 12 34',
      adresse: 'Bora Bora, Vaitape', ile: 'Bora Bora',
      interlocuteur: 'Patrick Legrand', siret: null
    }
  ],

  /* ==============================================================
     CLIENTS (8) — entreprises et organisations clientes HCS
     ============================================================== */
  clients: [
    {
      id: 'cli-001', nom: 'Mairie de Faa\'a', type: 'Collectivité',
      email: 'contact@mairie-faaa.pf', telephone: '40 80 45 00',
      adresse: 'BP 3030, Faa\'a, Tahiti', ile: 'Tahiti',
      interlocuteur: 'M. Oscar Temaru', ca: 285000, statut: 'actif'
    },
    {
      id: 'cli-002', nom: 'Hotel Intercontinental Tahiti', type: 'Hôtellerie',
      email: 'achat@ihg-tahiti.pf', telephone: '40 47 88 88',
      adresse: 'BP 6014, Faa\'a, Tahiti', ile: 'Tahiti',
      interlocuteur: 'Mme Sophie Blanc', ca: 520000, statut: 'actif'
    },
    {
      id: 'cli-003', nom: 'Air Tahiti Nui', type: 'Transport',
      email: 'uniform@airtahitinui.pf', telephone: '40 46 03 03',
      adresse: 'Immeuble Dexter, Faa\'a', ile: 'Tahiti',
      interlocuteur: 'M. Teiva Martin', ca: 340000, statut: 'actif'
    },
    {
      id: 'cli-004', nom: 'Lycée Paul Gauguin', type: 'Éducation',
      email: 'intendance@lpg.pf', telephone: '40 41 71 60',
      adresse: '8 rue Morenhout, Papeete', ile: 'Tahiti',
      interlocuteur: 'Mme Hina Tefaafana', ca: 95000, statut: 'actif'
    },
    {
      id: 'cli-005', nom: 'Clinique Cardella', type: 'Santé',
      email: 'admin@cardella.pf', telephone: '40 46 01 01',
      adresse: 'Rue Anne-Marie Javouhey, Papeete', ile: 'Tahiti',
      interlocuteur: 'M. Rui Cardella', ca: 180000, statut: 'actif'
    },
    {
      id: 'cli-006', nom: 'Te Fare Tauhiti Nui', type: 'Culture',
      email: 'contact@maisondelaculture.pf', telephone: '40 54 45 44',
      adresse: 'Blvd Pomare, Papeete', ile: 'Tahiti',
      interlocuteur: 'Mme Mere Tetuanui', ca: 72000, statut: 'actif'
    },
    {
      id: 'cli-007', nom: 'Surf School Tahiti', type: 'Sport',
      email: 'hello@surftahiti.pf', telephone: '87 23 14 55',
      adresse: 'Plage de Mahina, Tahiti', ile: 'Tahiti',
      interlocuteur: 'M. Keoni Toa', ca: 48000, statut: 'actif'
    },
    {
      id: 'cli-008', nom: 'Fenua Events', type: 'Événementiel',
      email: 'booking@fenuaevents.pf', telephone: '87 72 88 10',
      adresse: 'Punaauia, Tahiti', ile: 'Tahiti',
      interlocuteur: 'Mme Vahine Arii', ca: 135000, statut: 'actif'
    }
  ],

  /* ==============================================================
     FOURNISSEURS (4)
     ============================================================== */
  fournisseurs: [
    /* ── Fournisseurs HCS — Polynésie française (locaux) ── */
    {
      id: 'four-hcs-001', nom: 'Anémone Tahiti',
      pays: 'Polynésie française', devise: 'XPF',
      email: 'contact@anemone.pf', telephone: '+689 40 50 00 01',
      contact: '',
      delaiLivraison: 2,
      conditions: 'Crédit 30j. Livraison 24-48h.',
      notes: 'Fournisseur principal textile. T-shirts, polos, casquettes blank.'
    },
    {
      id: 'four-hcs-002', nom: 'HT4You',
      pays: 'Polynésie française', devise: 'XPF',
      email: 'info@ht4you.pf', telephone: '+689 40 50 00 02',
      contact: '',
      delaiLivraison: 1,
      conditions: 'Paiement à la commande. MOQ 10 transferts.',
      notes: 'Transferts DTF, films, encres. Livraison J+1.'
    },
    /* ── Fournisseurs HCS — International ── */
    {
      id: 'four-hcs-003', nom: 'AliExpress Pro',
      pays: 'Chine', devise: 'USD',
      email: 'supplier@alibaba.com', telephone: '',
      contact: '',
      delaiLivraison: 22,
      conditions: 'Acompte 100%. MOQ 100 pcs.',
      notes: 'Textile en gros, casquettes, bags. Délai 15-30 jours.'
    },
    {
      id: 'four-hcs-004', nom: 'Stanley/Stella Europe',
      pays: 'Belgique', devise: 'EUR',
      email: 'orders@stanleystella.com', telephone: '+32 2 000 0000',
      contact: '',
      delaiLivraison: 8,
      conditions: 'Facture EUR. Livraison DHL.',
      notes: 'T-shirts bio premium, polos éco. Délai 7-10 jours.'
    },
    /* ── Fournisseurs complémentaires ── */
    {
      id: 'four-001', nom: 'DTF Supplies USA',
      pays: 'États-Unis', devise: 'USD',
      email: 'orders@dtfsupplies.com', telephone: '+1 714 555 0123',
      contact: 'John Carter',
      delaiLivraison: 21,
      conditions: 'Paiement 30j, minimum commande 500 USD'
    },
    {
      id: 'four-002', nom: 'Textile Import NZ',
      pays: 'Nouvelle-Zélande', devise: 'NZD',
      email: 'sales@textileimport.co.nz', telephone: '+64 9 555 0187',
      contact: 'Sarah Thompson',
      delaiLivraison: 14,
      conditions: 'Paiement 45j, franco de port dès 1000 NZD'
    },
    {
      id: 'four-003', nom: 'SignPro Australie',
      pays: 'Australie', devise: 'AUD',
      email: 'info@signpro.com.au', telephone: '+61 2 9555 0198',
      contact: 'Mark Wilson',
      delaiLivraison: 18,
      conditions: 'Paiement comptant, remise 5% dès 2000 AUD'
    },
    {
      id: 'four-004', nom: 'Sublimation Asia',
      pays: 'Chine', devise: 'USD',
      email: 'trade@sublimationasia.cn', telephone: '+86 755 5555 0199',
      contact: 'Li Wei',
      delaiLivraison: 35,
      conditions: 'Acompte 30%, solde à expédition'
    }
  ],

  /* ==============================================================
     OPPORTUNITÉS CRM (6) — différents stades du pipeline
     ============================================================== */
  opportunites: [
    {
      id: 'opp-001', nom: 'Uniformes Mairie Faa\'a 2026',
      client: 'Mairie de Faa\'a', contactId: 'cont-001',
      stade: 'Proposition', probabilite: 60,
      montant: 450000, echeance: '2026-04-15',
      notes: 'Commande de 200 polos brodés logo commune + t-shirts agents'
    },
    {
      id: 'opp-002', nom: 'Kit communication Hotel Intercontinental',
      client: 'Hotel Intercontinental Tahiti', contactId: 'cont-002',
      stade: 'Négociation', probabilite: 75,
      montant: 280000, echeance: '2026-03-30',
      notes: 'Bâches piscine, signalétique restaurant, mugs personnalisés'
    },
    {
      id: 'opp-003', nom: 'Tenues Heiva 2026 — Danse',
      client: 'Association Heiva i Tahiti', contactId: 'cont-003',
      stade: 'Qualifié', probabilite: 45,
      montant: 180000, echeance: '2026-05-01',
      notes: 'T-shirts coordinateurs + bâches déco scène'
    },
    {
      id: 'opp-004', nom: 'PLV Carrefour Punaauia — Promo été',
      client: 'Carrefour Punaauia', contactId: 'cont-004',
      stade: 'Gagné', probabilite: 100,
      montant: 320000, echeance: '2026-02-28',
      notes: 'Panneau promotion, stickers sol, bâches façade. Commande signée.'
    },
    {
      id: 'opp-005', nom: 'Uniformes Cabin Crew Air Tahiti Nui',
      client: 'Air Tahiti Nui', contactId: 'cont-005',
      stade: 'Nouveau', probabilite: 20,
      montant: 1200000, echeance: '2026-06-30',
      notes: 'RDV commercial le 15/03 — forte opportunité si on décroche l\'AO'
    },
    {
      id: 'opp-006', nom: 'Pack mariage Hina Teriitahi',
      client: 'Hina Teriitahi', contactId: 'cont-007',
      stade: 'Perdu', probabilite: 0,
      montant: 85000, echeance: '2026-02-14',
      notes: 'Perdu face à un concurrent local — prix trop élevé'
    }
  ],

  /* ==============================================================
     DEVIS (3)
     ============================================================== */
  devis: [
    {
      id: 'dev-001', ref: 'DEV-2026-00001', _type: 'Devis',
      client: 'Mairie de Faa\'a', contactId: 'cont-001',
      date: '2026-02-10', dateExpiration: '2026-03-10',
      statut: 'Envoyé',
      lignes: [
        { produitId: 'prod-001', description: 'Polo brodé logo Mairie', qte: 50, prixUnitaire: 3500, remise: 5 },
        { produitId: 'prod-016', description: 'Création graphique vecteur logo', qte: 2, prixUnitaire: 7500, remise: 0 }
      ],
      totalHT: 181250, totalTVA: 23563, totalTTC: 204813,
      notes: 'Prix valables 30 jours. Livraison estimée 15 jours ouvrés.'
    },
    {
      id: 'dev-002', ref: 'DEV-2026-00002', _type: 'Devis',
      client: 'Hotel Intercontinental Tahiti', contactId: 'cont-002',
      date: '2026-02-18', dateExpiration: '2026-03-18',
      statut: 'Brouillon',
      lignes: [
        { produitId: 'prod-012', description: 'Bâche PVC piscine 6×2m', qte: 12, prixUnitaire: 8500, remise: 10 },
        { produitId: 'prod-005', description: 'Mugs sublimés logo hôtel', qte: 100, prixUnitaire: 1800, remise: 15 }
      ],
      totalHT: 234000, totalTVA: 30420, totalTTC: 264420,
      notes: 'À valider avec service achat avant envoi.'
    },
    {
      id: 'dev-003', ref: 'DEV-2026-00003', _type: 'Devis',
      client: 'Patrick Legrand', contactId: 'cont-008',
      date: '2026-03-01', dateExpiration: '2026-03-31',
      statut: 'Confirmé',
      lignes: [
        { produitId: 'prod-006', description: 'Coussins sublimés photos famille', qte: 5, prixUnitaire: 2500, remise: 0 },
        { produitId: 'prod-007', description: 'Plaque aluminium souvenir', qte: 2, prixUnitaire: 3200, remise: 0 }
      ],
      totalHT: 18900, totalTVA: 2457, totalTTC: 21357,
      notes: 'Client VIP Bora Bora — livraison express Inter-îles.'
    }
  ],

  /* ==============================================================
     COMMANDES (2)
     ============================================================== */
  commandes: [
    {
      id: 'cmd-001', ref: 'CMD-2026-00001', _type: 'Commande',
      client: 'Carrefour Punaauia', contactId: 'cont-004',
      date: '2026-02-20', dateLivraison: '2026-03-05',
      statut: 'En cours',
      lignes: [
        { produitId: 'prod-013', description: 'Panneau Dibond façade A1', qte: 4, prixUnitaire: 18000, remise: 0 },
        { produitId: 'prod-010', description: 'Stickers promotionnels A5', qte: 200, prixUnitaire: 600, remise: 20 }
      ],
      totalHT: 168000, totalTVA: 21840, totalTTC: 189840,
      notes: 'Livraison avant ouverture promo le 05/03.'
    },
    {
      id: 'cmd-002', ref: 'CMD-2026-00002', _type: 'Commande',
      client: 'Association Heiva i Tahiti', contactId: 'cont-003',
      date: '2026-03-01', dateLivraison: '2026-04-15',
      statut: 'Confirmé',
      lignes: [
        { produitId: 'prod-002', description: 'T-shirts coordinateurs Heiva', qte: 30, prixUnitaire: 2200, remise: 5 },
        { produitId: 'prod-012', description: 'Bâche décoration scène 8×3m', qte: 3, prixUnitaire: 8500, remise: 0 }
      ],
      totalHT: 88200, totalTVA: 11466, totalTTC: 99666,
      notes: 'Motif pareo polynésien — BAT à valider avant impression.'
    }
  ],

  /* ==============================================================
     FACTURES (2)
     ============================================================== */
  factures: [
    {
      id: 'fac-001', ref: 'FAC-2026-00001', _type: 'Facture',
      client: 'Carrefour Punaauia', contactId: 'cont-004',
      commandeId: 'cmd-001',
      date: '2026-03-05', dateEcheance: '2026-04-05',
      statut: 'Payé',
      lignes: [
        { description: 'Panneau Dibond façade A1', qte: 4, prixUnitaire: 18000, remise: 0 },
        { description: 'Stickers promotionnels A5 ×200', qte: 1, prixUnitaire: 96000, remise: 0 }
      ],
      totalHT: 168000, totalTVA: 21840, totalTTC: 189840,
      modePaiement: 'Virement bancaire',
      notes: 'Réglée le 05/03/2026. Merci pour votre confiance.'
    },
    {
      id: 'fac-002', ref: 'FAC-2026-00002', _type: 'Facture',
      client: 'Mairie de Faa\'a', contactId: 'cont-001',
      commandeId: null,
      date: '2026-02-28', dateEcheance: '2026-03-30',
      statut: 'En attente',
      lignes: [
        { description: 'Polo brodé logo Mairie ×50', qte: 1, prixUnitaire: 166250, remise: 0 },
        { description: 'Création graphique — 2h', qte: 1, prixUnitaire: 15000, remise: 0 }
      ],
      totalHT: 181250, totalTVA: 23563, totalTTC: 204813,
      modePaiement: 'Bon de commande administrative',
      notes: 'Relance prévue le 25/03 si non réglée.'
    }
  ],

  /* ==============================================================
     BONS D'ACHAT FOURNISSEURS (3)
     ============================================================== */
  bonsAchat: [
    {
      id: 'ba-001', ref: 'BA-2026-00001', _type: 'Bon d\'achat',
      fournisseur: 'DTF Supplies USA', fournisseurId: 'four-001',
      date: '2026-02-05', dateLivraisonPrevue: '2026-02-26',
      statut: 'Livré',
      lignes: [
        { description: 'Encre DTF Blanc 1L', qte: 4, prixUnitaire: 14000, remise: 0 },
        { description: 'Encre DTF CMYK 1L chaque', qte: 8, prixUnitaire: 12000, remise: 5 }
      ],
      totalHT: 147200, totalTVA: 19136, totalTTC: 166336,
      notes: 'Livré le 24/02 — stocks reconstitués.'
    },
    {
      id: 'ba-002', ref: 'BA-2026-00002', _type: 'Bon d\'achat',
      fournisseur: 'Textile Import NZ', fournisseurId: 'four-002',
      date: '2026-02-15', dateLivraisonPrevue: '2026-03-01',
      statut: 'En cours',
      lignes: [
        { description: 'Polo coton piqué 220g (blanc)', qte: 200, prixUnitaire: 950, remise: 8 },
        { description: 'T-shirt col rond 190g (noir)', qte: 150, prixUnitaire: 600, remise: 5 }
      ],
      totalHT: 260300, totalTVA: 33839, totalTTC: 294139,
      notes: 'Conteneur Maritime Auckland — ETA 01/03.'
    },
    {
      id: 'ba-003', ref: 'BA-2026-00003', _type: 'Bon d\'achat',
      fournisseur: 'Sublimation Asia', fournisseurId: 'four-004',
      date: '2026-03-01', dateLivraisonPrevue: '2026-04-05',
      statut: 'Confirmé',
      lignes: [
        { description: 'Mug sublimation blanc 320ml', qte: 500, prixUnitaire: 380, remise: 10 },
        { description: 'Coussin polyester 40×40', qte: 200, prixUnitaire: 580, remise: 0 }
      ],
      totalHT: 287100, totalTVA: 37323, totalTTC: 324423,
      notes: 'Acompte 30% viré le 02/03.'
    }
  ],

  /* ==============================================================
     ORDRES DE FABRICATION (5)
     ============================================================== */
  ordresFab: [
    {
      id: 'of-001', ref: 'OF-2026-00001', emoji: '👕',
      produit: 'Polos brodés Mairie Faa\'a',
      produitId: 'prod-001', quantite: 50,
      dateDebut: '2026-02-22', dateFin: '2026-03-05',
      statut: 'Terminé',
      operateur: 'Yannick',
      notes: 'Logo vectorisé, 8 000 points, bleu marine pantone 540C'
    },
    {
      id: 'of-002', ref: 'OF-2026-00002', emoji: '🪟',
      produit: 'Bâches PVC Carrefour',
      produitId: 'prod-012', quantite: 4,
      dateDebut: '2026-02-25', dateFin: '2026-03-04',
      statut: 'Terminé',
      operateur: 'Yannick',
      notes: 'Format 4×1,5m, œillets tous les 50cm'
    },
    {
      id: 'of-003', ref: 'OF-2026-00003', emoji: '🎨',
      produit: 'Plaques DTF A3 — Stock',
      produitId: 'prod-009', quantite: 200,
      dateDebut: '2026-03-03', dateFin: '2026-03-07',
      statut: 'En cours',
      operateur: 'Yannick',
      notes: 'Motifs fleurs de tiaré pour stock de saison touristique'
    },
    {
      id: 'of-004', ref: 'OF-2026-00004', emoji: '✂️',
      produit: 'Lettrage vinyle véhicule Air Tahiti Nui',
      produitId: 'prod-011', quantite: 12,
      dateDebut: '2026-03-10', dateFin: '2026-03-14',
      statut: 'Confirmé',
      operateur: 'Yannick',
      notes: 'Pose sur 12 navettes aéroport — déplacements prévus Faaa'
    },
    {
      id: 'of-005', ref: 'OF-2026-00005', emoji: '☕',
      produit: 'Mugs sublimés Hotel Intercontinental',
      produitId: 'prod-005', quantite: 100,
      dateDebut: '2026-03-15', dateFin: '2026-03-18',
      statut: 'Brouillon',
      operateur: null,
      notes: 'En attente validation BAT client avant lancement'
    }
  ],

  /* ==============================================================
     FACTURES PARTIELLES / ACOMPTES (4)
     Liées aux devis / commandes en cours
     ============================================================== */
  facturesPartielles: [
    {
      id: 'facp-001', ref: 'FACP-2026-00001',
      type: 'Acompte',
      devisId: 'dev-001', commandeId: null, factureFinaleId: null,
      client: 'Mairie de Faa\'a', contactId: 'cont-001',
      date: '2026-02-12', dateEcheance: '2026-02-28',
      pourcentage: 30,
      montantHT: 54375, montantTVA: 7069, montantTTC: 61444,
      statut: 'Payé',
      modePaiement: 'Virement bancaire',
      notes: 'Acompte 30% sur DEV-2026-00001 — Polos brodés Mairie'
    },
    {
      id: 'facp-002', ref: 'FACP-2026-00002',
      type: 'Acompte',
      devisId: null, commandeId: 'cmd-002', factureFinaleId: null,
      client: 'Association Heiva i Tahiti', contactId: 'cont-003',
      date: '2026-03-03', dateEcheance: '2026-03-17',
      pourcentage: 40,
      montantHT: 35280, montantTVA: 4586, montantTTC: 39866,
      statut: 'En attente',
      modePaiement: 'Virement bancaire',
      notes: 'Acompte 40% sur CMD-2026-00002 — Tenues Heiva 2026'
    },
    {
      id: 'facp-003', ref: 'FACP-2026-00003',
      type: 'Acompte',
      devisId: 'dev-002', commandeId: null, factureFinaleId: null,
      client: 'Hotel Intercontinental Tahiti', contactId: 'cont-002',
      date: '2026-02-20', dateEcheance: '2026-03-05',
      pourcentage: 50,
      montantHT: 117000, montantTVA: 15210, montantTTC: 132210,
      statut: 'Payé',
      modePaiement: 'Virement bancaire',
      notes: 'Acompte 50% sur DEV-2026-00002 — Kit communication hôtel'
    },
    {
      id: 'facp-004', ref: 'FACP-2026-00004',
      type: 'Situation',
      devisId: null, commandeId: null, factureFinaleId: null,
      client: 'Air Tahiti Nui', contactId: 'cont-005',
      date: '2026-03-01', dateEcheance: '2026-03-31',
      pourcentage: 25,
      montantHT: 9450, montantTVA: 1229, montantTTC: 10679,
      statut: 'Brouillon',
      modePaiement: null,
      notes: 'Situation 1/4 — Études préliminaires uniformes cabin crew'
    }
  ],

  /* ==============================================================
     PAIEMENTS (7) — encaissements clients et décaissements fournisseurs
     ============================================================== */
  paiements: [
    /* -- Encaissements clients -- */
    {
      id: 'pay-001', ref: 'PAY-2026-00001',
      type: 'encaissement',
      date: '2026-03-05',
      montant: 189840,
      mode: 'virement',
      client: 'Carrefour Punaauia', contactId: 'cont-004',
      facture: 'FAC-2026-00001', facturePartielleId: null,
      reference: 'VIR-CBP-20260305',
      statut: 'encaissé',
      notes: 'Règlement complet FAC-2026-00001'
    },
    {
      id: 'pay-002', ref: 'PAY-2026-00002',
      type: 'encaissement',
      date: '2026-02-14',
      montant: 61444,
      mode: 'virement',
      client: 'Mairie de Faa\'a', contactId: 'cont-001',
      facture: 'FACP-2026-00001', facturePartielleId: 'facp-001',
      reference: 'VIR-MAIRIE-20260214',
      statut: 'encaissé',
      notes: 'Acompte 30% FACP-2026-00001 reçu'
    },
    {
      id: 'pay-003', ref: 'PAY-2026-00003',
      type: 'encaissement',
      date: '2026-02-22',
      montant: 132210,
      mode: 'virement',
      client: 'Hotel Intercontinental Tahiti', contactId: 'cont-002',
      facture: 'FACP-2026-00003', facturePartielleId: 'facp-003',
      reference: 'VIR-IHG-20260222',
      statut: 'encaissé',
      notes: 'Acompte 50% FACP-2026-00003 reçu'
    },
    /* -- Décaissements fournisseurs -- */
    {
      id: 'pay-004', ref: 'PAY-2026-00004',
      type: 'decaissement',
      date: '2026-02-05',
      montant: 166336,
      mode: 'virement',
      client: 'DTF Supplies USA', contactId: null,
      facture: 'BA-2026-00001', facturePartielleId: null,
      reference: 'VIR-DTFUSA-20260205',
      statut: 'encaissé',
      notes: 'Règlement BA-2026-00001 — encres DTF'
    },
    {
      id: 'pay-005', ref: 'PAY-2026-00005',
      type: 'decaissement',
      date: '2026-03-02',
      montant: 97327,
      mode: 'virement',
      client: 'Sublimation Asia', contactId: null,
      facture: 'BA-2026-00003', facturePartielleId: null,
      reference: 'VIR-SUBASIA-20260302',
      statut: 'encaissé',
      notes: 'Acompte 30% BA-2026-00003 — mugs et coussins'
    },
    {
      id: 'pay-006', ref: 'PAY-2026-00006',
      type: 'decaissement',
      date: '2026-02-15',
      montant: 102655,
      mode: 'virement',
      client: 'Propriétaire local', contactId: null,
      facture: 'LOYER-FEV-2026', facturePartielleId: null,
      reference: 'LOYER-FEV-2026',
      statut: 'encaissé',
      notes: 'Loyer local commercial — Février 2026'
    },
    {
      id: 'pay-007', ref: 'PAY-2026-00007',
      type: 'decaissement',
      date: '2026-03-01',
      montant: 8213,
      mode: 'carte',
      client: 'Adobe Systems', contactId: null,
      facture: 'ADOBE-CC-MAR26', facturePartielleId: null,
      reference: 'ADOBE-CC-MAR26',
      statut: 'encaissé',
      notes: 'Adobe Creative Cloud — abonnement mensuel Mars 2026'
    }
  ],

  /* ==============================================================
     ÉCRITURES COMPTABLES (28)
     Journaux : Achats, Ventes, Banque, OD (Opérations Diverses)
     ============================================================== */
  ecritures: [
    /* ── JOURNAL ACHATS — BA-2026-00001 Encres DTF ── */
    {
      id: 'ec-001', date: '2026-02-05',
      libelle: 'Achat encres DTF — DTF Supplies USA',
      compte: '607000', debit: 147200, credit: 0,
      journal: 'Achats', pieceRef: 'BA-2026-00001'
    },
    {
      id: 'ec-002', date: '2026-02-05',
      libelle: 'TVA déductible — DTF Supplies USA',
      compte: '445620', debit: 19136, credit: 0,
      journal: 'Achats', pieceRef: 'BA-2026-00001'
    },
    {
      id: 'ec-003', date: '2026-02-05',
      libelle: 'Fournisseur DTF Supplies USA — à payer',
      compte: '401000', debit: 0, credit: 166336,
      journal: 'Achats', pieceRef: 'BA-2026-00001'
    },

    /* ── JOURNAL ACHATS — Loyer Février 2026 ── */
    {
      id: 'ec-009', date: '2026-02-15',
      libelle: 'Loyer local commercial — Février 2026',
      compte: '613000', debit: 88496, credit: 0,
      journal: 'Achats', pieceRef: 'DEP-003'
    },
    {
      id: 'ec-010', date: '2026-02-15',
      libelle: 'TVA déductible — loyer Fév. 2026',
      compte: '445620', debit: 14159, credit: 0,
      journal: 'Achats', pieceRef: 'DEP-003'
    },
    {
      id: 'ec-011', date: '2026-02-15',
      libelle: 'Fournisseur loyer — Fév. 2026 à payer',
      compte: '401000', debit: 0, credit: 102655,
      journal: 'Achats', pieceRef: 'DEP-003'
    },

    /* ── JOURNAL ACHATS — Adobe CC Mars 2026 ── */
    {
      id: 'ec-012', date: '2026-03-01',
      libelle: 'Abonnement Adobe Creative Cloud — Mars 2026',
      compte: '626000', debit: 7080, credit: 0,
      journal: 'Achats', pieceRef: 'DEP-006'
    },
    {
      id: 'ec-013', date: '2026-03-01',
      libelle: 'TVA déductible — Adobe CC',
      compte: '445620', debit: 1133, credit: 0,
      journal: 'Achats', pieceRef: 'DEP-006'
    },
    {
      id: 'ec-014', date: '2026-03-01',
      libelle: 'Fournisseur Adobe Systems — à payer',
      compte: '401000', debit: 0, credit: 8213,
      journal: 'Achats', pieceRef: 'DEP-006'
    },

    /* ── JOURNAL VENTES — FAC-2026-00001 Carrefour ── */
    {
      id: 'ec-004', date: '2026-03-05',
      libelle: 'Vente signalétique — Carrefour Punaauia',
      compte: '706000', debit: 0, credit: 168000,
      journal: 'Ventes', pieceRef: 'FAC-2026-00001'
    },
    {
      id: 'ec-005', date: '2026-03-05',
      libelle: 'TVA collectée — Carrefour FAC-2026-00001',
      compte: '445710', debit: 0, credit: 21840,
      journal: 'Ventes', pieceRef: 'FAC-2026-00001'
    },
    {
      id: 'ec-006', date: '2026-03-05',
      libelle: 'Client Carrefour Punaauia — FAC-2026-00001',
      compte: '411000', debit: 189840, credit: 0,
      journal: 'Ventes', pieceRef: 'FAC-2026-00001'
    },

    /* ── JOURNAL VENTES — FAC-2026-00002 Mairie Faa'a ── */
    {
      id: 'ec-015', date: '2026-02-28',
      libelle: 'Vente textile/service — Mairie de Faa\'a',
      compte: '706000', debit: 0, credit: 181250,
      journal: 'Ventes', pieceRef: 'FAC-2026-00002'
    },
    {
      id: 'ec-016', date: '2026-02-28',
      libelle: 'TVA collectée — Mairie FAC-2026-00002',
      compte: '445710', debit: 0, credit: 23563,
      journal: 'Ventes', pieceRef: 'FAC-2026-00002'
    },
    {
      id: 'ec-017', date: '2026-02-28',
      libelle: 'Client Mairie de Faa\'a — FAC-2026-00002',
      compte: '411000', debit: 204813, credit: 0,
      journal: 'Ventes', pieceRef: 'FAC-2026-00002'
    },

    /* ── JOURNAL VENTES — FACP-2026-00001 Acompte Mairie ── */
    {
      id: 'ec-018', date: '2026-02-12',
      libelle: 'Acompte client 30% — Mairie de Faa\'a',
      compte: '419000', debit: 0, credit: 61444,
      journal: 'Ventes', pieceRef: 'FACP-2026-00001'
    },
    {
      id: 'ec-019', date: '2026-02-12',
      libelle: 'TVA sur acompte — Mairie FACP-001',
      compte: '445710', debit: 0, credit: 7069,
      journal: 'Ventes', pieceRef: 'FACP-2026-00001'
    },
    {
      id: 'ec-020', date: '2026-02-12',
      libelle: 'Client Mairie — acompte facturé FACP-001',
      compte: '411000', debit: 61444, credit: 0,
      journal: 'Ventes', pieceRef: 'FACP-2026-00001'
    },

    /* ── JOURNAL BANQUE — Règlements reçus ── */
    {
      id: 'ec-007', date: '2026-03-05',
      libelle: 'Virement reçu — Carrefour FAC-2026-00001',
      compte: '512000', debit: 189840, credit: 0,
      journal: 'Banque', pieceRef: 'PAY-2026-00001'
    },
    {
      id: 'ec-008', date: '2026-03-05',
      libelle: 'Solde client Carrefour — FAC-001 réglée',
      compte: '411000', debit: 0, credit: 189840,
      journal: 'Banque', pieceRef: 'PAY-2026-00001'
    },
    {
      id: 'ec-021', date: '2026-02-14',
      libelle: 'Virement reçu — Mairie acompte FACP-001',
      compte: '512000', debit: 61444, credit: 0,
      journal: 'Banque', pieceRef: 'PAY-2026-00002'
    },
    {
      id: 'ec-022', date: '2026-02-14',
      libelle: 'Solde client Mairie — acompte encaissé',
      compte: '411000', debit: 0, credit: 61444,
      journal: 'Banque', pieceRef: 'PAY-2026-00002'
    },
    {
      id: 'ec-023', date: '2026-02-22',
      libelle: 'Virement reçu — Hotel Intercontinental acompte',
      compte: '512000', debit: 132210, credit: 0,
      journal: 'Banque', pieceRef: 'PAY-2026-00003'
    },
    {
      id: 'ec-024', date: '2026-02-22',
      libelle: 'Solde acompte IHG encaissé — FACP-003',
      compte: '419000', debit: 132210, credit: 0,
      journal: 'Banque', pieceRef: 'PAY-2026-00003'
    },

    /* ── JOURNAL BANQUE — Règlements fournisseurs ── */
    {
      id: 'ec-025', date: '2026-02-05',
      libelle: 'Virement émis — DTF Supplies USA BA-001',
      compte: '401000', debit: 166336, credit: 0,
      journal: 'Banque', pieceRef: 'PAY-2026-00004'
    },
    {
      id: 'ec-026', date: '2026-02-05',
      libelle: 'Banque — règlement fournisseur DTF',
      compte: '512000', debit: 0, credit: 166336,
      journal: 'Banque', pieceRef: 'PAY-2026-00004'
    },
    {
      id: 'ec-027', date: '2026-02-15',
      libelle: 'Virement émis — loyer Fév. 2026',
      compte: '401000', debit: 102655, credit: 0,
      journal: 'Banque', pieceRef: 'PAY-2026-00006'
    },
    {
      id: 'ec-028', date: '2026-02-15',
      libelle: 'Banque — règlement loyer Fév. 2026',
      compte: '512000', debit: 0, credit: 102655,
      journal: 'Banque', pieceRef: 'PAY-2026-00006'
    }
  ],

  /* ==============================================================
     MESSAGES DE DISCUSSION
     Canaux : général, production, ventes + inbox
     ============================================================== */
  messages: [
    /* --- #général --- */
    {
      id: 'msg-001', canal: 'général',
      auteur: 'Yannick', date: '2026-03-03T08:15:00',
      texte: 'Bonjour l\'équipe ! La BN-20 est opérationnelle après la maintenance du weekend. On repart sur les plaques DTF today 🎨'
    },
    {
      id: 'msg-002', canal: 'général',
      auteur: 'Administrateur', date: '2026-03-03T08:30:00',
      texte: 'Super Yannick ! N\'oublie pas que Carrefour passe récupérer sa commande en fin de journée.'
    },
    {
      id: 'msg-003', canal: 'général',
      auteur: 'Vendeur', date: '2026-03-03T09:00:00',
      texte: 'La Mairie de Faa\'a a relancé pour son devis. Je leur prépare une proposition révisée aujourd\'hui.'
    },
    {
      id: 'msg-004', canal: 'général',
      auteur: 'Yannick', date: '2026-03-04T11:20:00',
      texte: 'Stock encre blanche DTF presque épuisé — moins de 500ml. À commander en urgence !'
    },
    {
      id: 'msg-005', canal: 'général',
      auteur: 'Administrateur', date: '2026-03-04T11:45:00',
      texte: 'Bon d\'achat créé chez DTF Supplies USA. Délai estimé 3 semaines. On gère avec ce qu\'il reste.'
    },
    /* --- #production --- */
    {
      id: 'msg-006', canal: 'production',
      auteur: 'Yannick', date: '2026-03-01T07:30:00',
      texte: 'OF-2026-00001 terminé ! 50 polos Mairie brodés et emballés. Qualité nickel.'
    },
    {
      id: 'msg-007', canal: 'production',
      auteur: 'Yannick', date: '2026-03-02T10:00:00',
      texte: 'Bâches Carrefour en cours de laminage. Prêtes demain matin.'
    },
    {
      id: 'msg-008', canal: 'production',
      auteur: 'Administrateur', date: '2026-03-02T10:15:00',
      texte: 'Parfait. Pense à photographier pour le portfolio avant livraison.'
    },
    {
      id: 'msg-009', canal: 'production',
      auteur: 'Yannick', date: '2026-03-03T14:00:00',
      texte: 'Lancement OF-2026-00003 — 200 plaques DTF motifs tiaré. La BN-20 tourne bien 🔥'
    },
    /* --- #ventes --- */
    {
      id: 'msg-010', canal: 'ventes',
      auteur: 'Vendeur', date: '2026-02-28T09:00:00',
      texte: 'Air Tahiti Nui a demandé un RDV pour les uniformes cabin crew. Grande opportunité !'
    },
    {
      id: 'msg-011', canal: 'ventes',
      auteur: 'Administrateur', date: '2026-02-28T09:20:00',
      texte: 'Excellent ! Prépare un dossier de présentation HCS avec nos références hôtellerie et événementiel.'
    },
    {
      id: 'msg-012', canal: 'ventes',
      auteur: 'Vendeur', date: '2026-03-01T16:00:00',
      texte: 'Devis Hotel Intercontinental envoyé. Montant : 264 420 XPF TTC. Retour attendu cette semaine.'
    },
    {
      id: 'msg-013', canal: 'ventes',
      auteur: 'Vendeur', date: '2026-03-04T11:00:00',
      texte: 'L\'Intercontinental demande à voir des échantillons avant de signer. Je prépare un kit démo.'
    },
    /* --- inbox (messages directs) --- */
    {
      id: 'msg-014', canal: 'inbox',
      auteur: 'Patrick Legrand', date: '2026-03-01T15:30:00',
      texte: 'Bonjour, je souhaite commander des coussins et une plaque pour un cadeau de mariage. Pouvez-vous faire une livraison sur Bora Bora ?'
    },
    {
      id: 'msg-015', canal: 'inbox',
      auteur: 'Administrateur', date: '2026-03-01T16:00:00',
      texte: 'Bonjour Patrick ! Oui, nous livrons sur toutes les îles. Devis envoyé par email. N\'hésitez pas à revenir vers nous.'
    }
  ],

  /* ==============================================================
     UTILISATEURS (5)
     Comptes initiaux HCS — mots de passe hachés via _seedHashMdp()
     ============================================================== */
  utilisateurs: (function () {
    /* Hachage simple identique à auth.js — doit rester synchronisé */
    function _seedHashMdp(mdp) {
      let h = 5381;
      const s = 'hcs2026:' + mdp + ':erp';
      for (let i = 0; i < s.length; i++) {
        h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
      }
      return h.toString(16).padStart(8, '0');
    }
    return [
      {
        id: 'usr-001',
        login: 'admin',
        mdpHash: _seedHashMdp('admin2026'),
        prenom: 'Administrateur',
        nom: 'HCS',
        email: 'admin@hcs.pf',
        telephone: '+689 40 00 00 00',
        role: 'super_admin',
        actif: true,
        avatar: 'AD',
        couleurAvatar: '#DC2626',
        dateCreation: '2026-01-01T08:00:00.000Z',
        derniereConnexion: null,
        creePar: 'system'
      },
      {
        id: 'usr-002',
        login: 'yannick',
        mdpHash: _seedHashMdp('yannick2026'),
        prenom: 'Yannick',
        nom: 'Teriitahi',
        email: 'yannick@hcs.pf',
        telephone: '+689 87 12 34 56',
        role: 'admin',
        actif: true,
        avatar: 'YT',
        couleurAvatar: '#6366F1',
        dateCreation: '2026-01-01T08:00:00.000Z',
        derniereConnexion: null,
        creePar: 'usr-001'
      },
      {
        id: 'usr-003',
        login: 'vendeur',
        mdpHash: _seedHashMdp('vente2026'),
        prenom: 'Marie',
        nom: 'Dupont',
        email: 'marie@hcs.pf',
        telephone: '+689 87 98 76 54',
        role: 'vendeur',
        actif: true,
        avatar: 'MD',
        couleurAvatar: '#7C3AED',
        dateCreation: '2026-01-15T08:00:00.000Z',
        derniereConnexion: null,
        creePar: 'usr-001'
      },
      {
        id: 'usr-004',
        login: 'comptable',
        mdpHash: _seedHashMdp('compta2026'),
        prenom: 'Sophie',
        nom: 'Martin',
        email: 'sophie@hcs.pf',
        telephone: '+689 87 11 22 33',
        role: 'comptable',
        actif: true,
        avatar: 'SM',
        couleurAvatar: '#0891B2',
        dateCreation: '2026-02-01T08:00:00.000Z',
        derniereConnexion: null,
        creePar: 'usr-001'
      },
      {
        id: 'usr-005',
        login: 'magasin',
        mdpHash: _seedHashMdp('stock2026'),
        prenom: 'Teiva',
        nom: 'Moana',
        email: 'teiva@hcs.pf',
        telephone: '+689 87 55 66 77',
        role: 'magasinier',
        actif: false,
        avatar: 'TM',
        couleurAvatar: '#D97706',
        dateCreation: '2026-02-15T08:00:00.000Z',
        derniereConnexion: null,
        creePar: 'usr-001'
      }
    ];
  })(),

  /* Journal d'audit — vide au démarrage, rempli par l'application */
  auditLog: [],

  /* ==============================================================
     DÉPENSES MAGASIN (8 exemples)
     TVA 13% = taux standard HCS Polynésie
     TVA 16% = taux majoré (loyer, services premium)
     ============================================================== */
  depenses: [
    {
      id: 'dep-001', date: '2026-02-05',
      description: 'Encres DTF CMYK + Blanc — DTF Supplies USA',
      categorie: 'Matières premières',
      montantHT: 130265, tauxTVA: 13,
      montantTVA: 16934, montantTTC: 147199,
      modePaiement: 'Virement', reference: 'BA-2026-00001', notes: ''
    },
    {
      id: 'dep-002', date: '2026-02-10',
      description: 'Films DTF A4 + A3 — lot 500 pièces',
      categorie: 'Matières premières',
      montantHT: 44248, tauxTVA: 13,
      montantTVA: 5752, montantTTC: 50000,
      modePaiement: 'Carte', reference: '', notes: 'Commande urgente stock bas'
    },
    {
      id: 'dep-003', date: '2026-02-15',
      description: 'Loyer local commercial — Février 2026',
      categorie: 'Loyer & charges',
      montantHT: 88496, tauxTVA: 16,
      montantTVA: 14159, montantTTC: 102655,
      modePaiement: 'Virement', reference: 'BAIL-2026-02', notes: ''
    },
    {
      id: 'dep-004', date: '2026-02-20',
      description: 'Électricité — Février 2026',
      categorie: 'Énergie & utilités',
      montantHT: 26549, tauxTVA: 13,
      montantTVA: 3451, montantTTC: 30000,
      modePaiement: 'Prélèvement', reference: 'EDT-FEV26', notes: ''
    },
    {
      id: 'dep-005', date: '2026-02-25',
      description: 'Polos blancs stock vierge — lot 100 pièces',
      categorie: 'Textile & fournitures',
      montantHT: 79646, tauxTVA: 13,
      montantTVA: 10354, montantTTC: 90000,
      modePaiement: 'Carte', reference: '', notes: ''
    },
    {
      id: 'dep-006', date: '2026-03-01',
      description: 'Abonnement Adobe Creative Cloud — Mars 2026',
      categorie: 'Abonnements & services',
      montantHT: 7080, tauxTVA: 16,
      montantTVA: 1133, montantTTC: 8213,
      modePaiement: 'Carte', reference: '', notes: 'Licence mensuelle'
    },
    {
      id: 'dep-007', date: '2026-03-03',
      description: 'Transport livraison Carrefour Punaauia',
      categorie: 'Livraison & transport',
      montantHT: 8850, tauxTVA: 13,
      montantTVA: 1150, montantTTC: 10000,
      modePaiement: 'Espèces', reference: '', notes: ''
    },
    {
      id: 'dep-008', date: '2026-03-05',
      description: 'Maintenance presse sublimation — Révision annuelle',
      categorie: 'Équipement & maintenance',
      montantHT: 35398, tauxTVA: 13,
      montantTVA: 4602, montantTTC: 40000,
      modePaiement: 'Chèque', reference: 'MAINT-2026-01', notes: ''
    }
  ],

  /* Méta-données de la base */
  _meta: {
    version: '1.3.0',
    seedVersion: '1.3.0',
    createdAt: new Date().toISOString(),
    counters: {
      devis:              3,
      commandes:          2,
      factures:           2,
      facturesPartielles: 4,
      paiements:          7,
      bonsAchat:          3,
      ordresFab:          5,
      ecritures:          28,
      utilisateurs:       5
    }
  }
};
