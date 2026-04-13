# ═══════════════════════════════════════════════════════════════
# HCS ERP — 10 PROMPTS POUR CLAUDE CODE
# ═══════════════════════════════════════════════════════════════
# 
# MODE D'EMPLOI :
# 1. Ouvrez VS Code dans votre dossier hcs-erp/
# 2. Lancez Claude Code (terminal → tapez: claude)
# 3. Copiez-collez chaque prompt UN PAR UN dans l'ordre
# 4. Attendez que Claude Code finisse avant de passer au suivant
# 5. Testez entre chaque prompt : npx serve . -p 8080
#
# ═══════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────
# PROMPT 1 — INITIALISATION DU PROJET
# ─────────────────────────────────────────────

Lis le fichier CLAUDE.md à la racine pour comprendre le contexte du projet.

Crée le projet HCS ERP dans le dossier courant avec cette structure :
- index.html (shell principal avec topbar, sidebar dynamique, content area, modal container)
- css/variables.css (design tokens : couleurs dark mode, fonts, spacing, radius)
- css/layout.css (topbar 48px, sidebar 220px, content area flex, toolbar)
- css/components.css (boutons .btn-primary/.btn-ghost/.btn-danger, badges statuts, tables .data-table, cards .dash-card, tooltips)
- css/forms.css (inputs, selects, textareas, .form-grid, .form-group, .line-table pour les lignes de commande)
- css/kanban.css (colonnes kanban, cartes, drag indicators)
- css/chat.css (layout chat, messages, canaux, input)
- js/app.js (router principal : définition des 9 modules avec leurs sous-menus sidebar, fonction openApp(appId), openView(viewId), renderView() qui dispatch vers le bon module)
- js/store.js (objet DB global, fonctions CRUD génériques, sauvegarde/chargement localStorage, import/export JSON)
- js/utils.js (fmt(amount) formatage XPF avec espaces, fmtDate(), fmtDateTime(), calcTTC(), calcHT(), generateNum(prefix, counter))
- js/auth.js (écran login, 3 comptes : admin/admin2026 rôle admin, vendeur/vente2026 rôle vendeur, yannick/yannick2026 rôle admin, gestion session, bouton déconnexion)
- data/seed.js (données initiales complètes HCS, appelé au premier chargement)

Le data/seed.js doit contenir :
- 16 produits HCS (textile, sublimation, DTF, découpe, signalétique, accessoires, consommables, services) avec prix en XPF, coût, stock, SKU, emoji
- 8 contacts polynésiens (Mairie Faa'a, Hotel Intercontinental, Association Heiva, Carrefour Punaauia, Air Tahiti Nui, Teiva Moana, Hina Teriitahi, Patrick Legrand)
- 4 fournisseurs (DTF Supplies USA, Textile Import NZ, SignPro Australie, Sublimation Asia)
- 6 opportunités CRM à différents stades
- 3 devis, 2 commandes, 2 factures d'exemple
- 3 bons d'achat fournisseurs
- 5 ordres de fabrication (polos brodés, bâches, plaques DTF, lettrage, mugs)
- 8 écritures comptables de base
- Des messages de discussion dans les canaux #général, #production, #ventes, boîte de réception

Design : fond #05060c, surfaces #0a0c16 / #0f1120, accent bleu #4a5fff, vert #00d4aa, rouge #ff6b6b, orange #ffc857, violet #b07bff.
Fonts : DM Sans (Google Fonts) + JetBrains Mono pour les chiffres.
Devise : XPF partout. Taxe : TGC 13%.
Style navigation identique à Odoo : topbar = switch entre apps, sidebar = sous-menus du module actif, toolbar = actions + recherche + switch vue liste/kanban.

L'index.html charge tous les CSS via <link> et tous les JS via <script> dans le bon ordre. Le dossier modules/ existe déjà avec 19 fichiers HTML (ne pas y toucher).


# ─────────────────────────────────────────────
# PROMPT 2 — COMPOSANTS RÉUTILISABLES
# ─────────────────────────────────────────────

Crée les composants réutilisables dans js/components/ :

1. table.js — Exporte une fonction renderTable(containerId, config) où config contient :
   - columns: [{key, label, type: 'text'|'money'|'date'|'badge'|'actions', width, badgeMap}]
   - data: tableau d'objets
   - searchable: true/false (champ recherche en haut)
   - sortable: true/false (clic sur les headers pour trier)
   - onRowClick: callback(item)
   - actions: [{label, icon, onClick, className}]
   Le composant génère une table .data-table avec tri, recherche live, et lignes cliquables. Les montants type 'money' utilisent fmt() de utils.js. Les badges utilisent un badgeMap {status: 'badge-class'}.

2. kanban.js — Exporte renderKanban(containerId, config) :
   - stages: [{id, label, color}]
   - cards: tableau d'objets avec un champ stage
   - cardTemplate: function(item) retourne le HTML d'une carte
   - onCardClick: callback(item)
   - onStageChange: callback(itemId, newStage)
   Affiche des colonnes avec header (nom + count + total montant), cartes à l'intérieur. Boutons dans chaque carte pour changer de colonne.

3. form.js — Exporte renderForm(containerId, config) :
   - fields: [{key, label, type: 'text'|'number'|'select'|'date'|'textarea'|'static'|'money', options, required, colSpan}]
   - data: objet avec les valeurs actuelles (ou {} pour création)
   - onSave: callback(formData)
   - title: string
   - actions: boutons additionnels [{label, className, onClick}]
   Génère un formulaire .form-view avec .form-grid, validation basique, et boutons Sauvegarder/Annuler.

4. modal.js — Exporte :
   - showModal(title, bodyHtml, onConfirm, confirmLabel='Confirmer')
   - showFormModal(title, fields, data, onSave) — utilise form.js dans une modale
   - closeModal()
   - showConfirm(message, onYes) — modale de confirmation simple
   Utilise le conteneur #modalBg de index.html.

5. toast.js — Exporte toast(message, type='success') :
   - Types : success (vert), error (rouge), warning (orange), info (bleu)
   - Apparaît en haut à droite, disparaît après 3 secondes
   - Animation slide-in depuis la droite
   Crée un conteneur #toastContainer si absent.

6. chart.js — Exporte :
   - barChart(containerId, {labels, values, colors, height}) — barres horizontales en CSS pur
   - pieChart(containerId, {segments: [{label, value, color}]}) — camembert en CSS conic-gradient
   - statCard(containerId, {icon, value, label, color}) — carte KPI


# ─────────────────────────────────────────────
# PROMPT 3 — MODULE CRM
# ─────────────────────────────────────────────

Crée js/modules/crm.js qui gère le module CRM avec 3 sous-vues :

1. Vue "pipeline" (kanban par défaut) :
   - 6 colonnes : Nouveau → Qualifié → Proposition → Négociation → Gagné → Perdu
   - Chaque carte affiche : nom opportunité, nom contact, montant XPF, probabilité %, date prévue
   - Boutons dans chaque carte pour déplacer vers une autre colonne
   - Header de colonne : nom, nombre d'opps, total montant XPF
   - Bouton "+ Opportunité" dans toolbar → modale de création (nom, contact via select, montant, probabilité, date, notes)
   - Clic sur carte → modale d'édition avec les mêmes champs + select étape + bouton supprimer
   - Utilise renderKanban de components/kanban.js
   - Données depuis DB.opportunities et DB.contacts

2. Vue "contacts" (liste, filtré type='person') :
   - Table avec colonnes : Nom, Téléphone, Email, Entreprise, Tags, Total dépensé (XPF)
   - Bouton "+ Contact" → modale création
   - Clic sur ligne → modale édition
   - Recherche par nom/email
   - Utilise renderTable de components/table.js

3. Vue "companies" (liste, filtré type='company') :
   - Table : Nom, Téléphone, Email, Adresse, Tags, Total dépensé
   - Même logique CRUD que contacts
   
Le module exporte une fonction initCRM(toolbar, area, viewId) appelée par le router de app.js.


# ─────────────────────────────────────────────
# PROMPT 4 — MODULE VENTES
# ─────────────────────────────────────────────

Crée js/modules/sales.js qui gère le module Ventes avec 4 sous-vues :

1. Vue "quotes" (Devis) — Liste :
   - Table : Numéro (DEV-xxxx), Date, Client, Montant TTC, Statut (badge: brouillon/envoyé/confirmé/annulé)
   - Toolbar : bouton "+ Nouveau Devis", recherche, filtre par statut
   - Clic sur ligne → vue formulaire du devis

   Formulaire devis :
   - Header : numéro + badge statut + boutons actions (Envoyer, Confirmer, Convertir en Commande, Annuler)
   - Champs : client (select depuis DB.contacts), date, validité, notes
   - Tableau de lignes (.line-table) : Produit (select), Description, Quantité, Prix unitaire HT, Remise %, Sous-total HT
   - Bouton "+ Ajouter une ligne"
   - Quand on sélectionne un produit, le prix se remplit automatiquement
   - Bloc totaux en bas à droite : Sous-total HT, Remise globale %, TGC 13%, TOTAL TTC
   - "Confirmer" change le statut
   - "Convertir en Commande" crée une entrée dans DB.orders avec les mêmes lignes et lie quoteId

2. Vue "orders" (Commandes) — même structure mais statuts : brouillon → confirmé → en production → prêt → livré → terminé. Bouton "Créer Facture".

3. Vue "invoices" (Factures) — même structure mais :
   - Statuts : brouillon → envoyé → payé partiel → payé → en retard
   - Section "Paiements" dans le formulaire : table avec date, montant, méthode (espèces/carte/virement/chèque), bouton "+ Enregistrer paiement"
   - Calcul automatique du reste à payer
   - Quand un paiement couvre le total → statut passe à "payé"
   - Écriture comptable auto dans DB.journal

4. Vue "sales-report" — Dashboard :
   - 4 KPIs : CA du mois, Nombre de ventes, Ticket moyen, Devis en attente
   - Graphique barres : CA par semaine (4 dernières semaines)
   - Graphique barres : Top 5 produits vendus
   - Table : dernières 10 factures

Tous les calculs en XPF, TGC 13%. Le module exporte initSales(toolbar, area, viewId).


# ─────────────────────────────────────────────
# PROMPT 5 — MODULES ACHATS & INVENTAIRE
# ─────────────────────────────────────────────

Crée js/modules/purchases.js :

1. Vue "suppliers" (Fournisseurs) — Liste :
   - Table : Nom, Contact, Téléphone, Email, Pays, Tags
   - CRUD complet via modale (nom, contact, phone, email, pays, tags, notes)

2. Vue "po" (Bons de commande) — Liste + Formulaire :
   - Table : Numéro (ACH-xxxx), Date, Fournisseur, Montant, Statut
   - Formulaire : fournisseur (select), date, date prévue livraison, lignes (description, produit optionnel, qté, coût unitaire)
   - Statuts : brouillon → confirmé → reçu → terminé
   - Bouton "Marquer comme reçu" : met à jour les stocks des produits liés (ajoute les quantités)
   - Écriture comptable auto dans DB.journal (débit 607 Achats, crédit 401 Fournisseurs)

3. Vue "purchase-report" — KPIs : Total achats mois, Nombre de commandes, Top fournisseur, Délai moyen livraison.

Crée js/modules/inventory.js :

1. Vue "products" — Liste + Formulaire :
   - Table : Emoji, Nom, SKU, Catégorie, Prix vente, Coût, Stock, Marge %, Statut stock
   - Stock coloré : vert si >20, orange si ≤20, rouge si ≤5
   - Formulaire produit complet : nom, SKU, catégorie (select), prix, coût, stock, stock minimum, emoji, unité, description
   - CRUD complet

2. Vue "categories" — Liste simple des catégories produit avec nombre de produits par catégorie. Ajout/suppression.

3. Vue "stock-moves" — Historique mouvements :
   - Table : Date, Produit, Type (Entrée/Sortie/Ajustement), Quantité, Motif, Référence
   - Les ventes créent des sorties, les réceptions d'achats créent des entrées
   - Bouton "Ajustement manuel" pour corriger un stock

4. Vue "stock-report" — Dashboard :
   - KPIs : Valeur totale stock (somme prix×qté), Produits en rupture, Alertes stock bas, Nombre références
   - Table : produits sous le seuil d'alerte
   - Graphique : répartition valeur stock par catégorie


# ─────────────────────────────────────────────
# PROMPT 6 — MODULE FABRICATION
# ─────────────────────────────────────────────

Crée js/modules/manufacturing.js :

1. Vue "mo" (Ordres de fabrication) — Kanban + Liste :
   - Kanban par défaut avec colonnes : Brouillon → Prêt → En cours → En attente → Terminé
   - Chaque carte : numéro OF, produit, quantité, assigné à, priorité (🔴🟡🟢), barre de progression, date butoir
   - Switch vue liste dans toolbar
   - Formulaire OF : produit (texte libre), quantité, priorité (select: basse/moyenne/haute/urgente), assigné à, poste de travail (select), commande liée (select optionnel), date début, date butoir, notes, progression (slider 0-100)
   - Actions : Démarrer, Mettre en pause, Terminer (met à jour le stock produit fini si lié)

2. Vue "bom" (Nomenclatures) — Liste :
   - Table : Produit fini, Nombre composants, Coût total composants
   - Formulaire : produit fini, lignes de composants (composant, quantité, unité)
   - Ex: "Polo brodé" = 1 Polo Blanc + 1 Fil broderie + 0.5h Machine

3. Vue "work-centers" (Postes de travail) — Cartes :
   - 6 postes : BN20 Yannick, Presse Sublimation, Découpe SignMaster, Atelier DTF USA, Broderie, Presse Transfert
   - Chaque carte : nom, responsable, capacité/jour, OF en cours sur ce poste, taux de charge
   - CRUD via modale


# ─────────────────────────────────────────────
# PROMPT 7 — MODULE COMPTABILITÉ
# ─────────────────────────────────────────────

Crée js/modules/accounting.js :

1. Vue "journal" — Journal comptable :
   - Table : Date, Référence, Libellé, Compte, Débit, Crédit
   - Filtres : par date (de/à), par compte, par catégorie
   - Bouton "+ Écriture manuelle" → modale (date, réf, libellé, compte via select, débit, crédit, catégorie)
   - Les écritures sont aussi créées automatiquement par les factures et les achats
   - Total débit et total crédit en pied de table

2. Vue "accounts" — Plan comptable simplifié :
   - Table : Numéro, Libellé, Type (Actif/Passif/Charge/Produit), Solde
   - Comptes HCS : 
     * 411 Clients, 401 Fournisseurs
     * 512 Banque, 531 Caisse
     * 601 Achats matières, 607 Achats marchandises
     * 701 Ventes produits, 706 Prestations services
     * 445 TGC collectée, 445 TGC déductible

3. Vue "pl-report" — Compte de résultat (P&L) :
   - Section Produits : total ventes (701+706)
   - Section Charges : total achats (601+607) + autres charges
   - Résultat net = Produits - Charges
   - Par mois (sélecteur de période)
   - Graphique barres : Produits vs Charges par mois

4. Vue "balance" — Balance générale :
   - Table : Compte, Libellé, Total Débit, Total Crédit, Solde Débiteur, Solde Créditeur
   - Calculé depuis les écritures du journal
   - Totaux en pied : vérification Débit = Crédit

5. Vue "tax-report" — Rapport TGC :
   - TGC collectée sur ventes (13% du CA HT)
   - TGC déductible sur achats (13% des achats HT)
   - TGC nette à reverser = collectée - déductible
   - Par mois, avec total trimestriel
   - Alerte si montant à reverser

Tous les montants en XPF.


# ─────────────────────────────────────────────
# PROMPT 8 — MODULE DISCUSSION
# ─────────────────────────────────────────────

Crée js/modules/discuss.js :

Layout type Odoo Discuss :
- Gauche : sidebar des canaux (240px)
- Droite : zone de messages

1. Canaux prédéfinis :
   - 📥 Boîte de réception (notifications système)
   - #️⃣ Général (discussion libre)
   - 🏭 Production (échanges atelier)
   - 💼 Ventes (échanges commerciaux)

2. Messages directs :
   - 👤 Yannick
   - 👤 Vendeur

3. Chaque canal/DM affiche :
   - Liste des messages avec avatar coloré, nom, horodatage, texte
   - Scroll automatique vers le bas
   - Zone de saisie en bas : input texte + bouton Envoyer
   - Envoi avec Enter

4. Boîte de réception : affiche les notifications système :
   - Alertes stock bas
   - Devis confirmés
   - Factures en retard
   - OF terminés
   Ces notifications sont générées automatiquement par les autres modules (ajouter une fonction addNotification(text) dans store.js)

5. Les messages sont stockés dans DB.messages et persistés en localStorage.

6. Le user actuel est déterminé par auth.js (admin → "Admin", vendeur → "Vendeur", yannick → "Yannick").

Le compteur de messages non lus s'affiche sur l'onglet Discussion dans la topbar.


# ─────────────────────────────────────────────
# PROMPT 9 — INTÉGRATION POS + AGENTS HCS
# ─────────────────────────────────────────────

Ajoute 2 modules supplémentaires dans la topbar de app.js :

1. Module "Caisse" (🛒) :
   - Un seul item sidebar : "Ouvrir la caisse"
   - Quand on clique, charge modules/caisse-pos.html dans un iframe plein écran dans la zone de contenu (width:100%, height:100%, border:none)
   - Le fichier caisse-pos.html existe déjà dans le dossier modules/

2. Module "Outils HCS" (🔧) :
   - Sidebar avec tous les outils agents existants, organisés en sections :
   
   Section "Opérations" :
   - Triage & Réception → modules/triage-dashboard.html
   - Commercial & Devis → modules/commercial-dashboard.html
   - Boutique Assistant → modules/boutique-assistant.html
   
   Section "Production" :
   - Planning Production → modules/planning-dashboard.html
   - Atelier Production → modules/atelier-production.html
   - DTF Atelier BN20 → modules/dtf-atelier-bn20-yannick.html
   - DTF Atelier USA → modules/dtf-atelier-usa.html
   - DTF Plaques Transfert → modules/dtf-plaques-transfert.html
   - SignMaster Guide → modules/signmaster-guide.html
   
   Section "Visuel & Contenu" :
   - Photos Produits → modules/admin-photos-produits.html
   - PicWish Pipeline → modules/picwish-pipeline.html
   - Content Generator → modules/content-generator.html
   
   Section "Gestion" :
   - Stock Dashboard → modules/stock-dashboard.html
   - Finance Dashboard → modules/finance-dashboard.html
   - Rapport P&L → modules/rapport-pl.html
   - Scanner OCR → modules/ocr-scanner.html
   
   Section "Supervision" :
   - Supervision → modules/supervision-dashboard.html
   - Routines → modules/routine-dashboard.html
   - Agent Vocal → modules/vocal-dashboard.html

   Chaque item charge le fichier HTML correspondant dans un iframe.


# ─────────────────────────────────────────────
# PROMPT 10 — DASHBOARD GLOBAL + FINITIONS
# ─────────────────────────────────────────────

1. Dashboard d'accueil (quand on clique sur le logo HCS dans la topbar) :
   - 8 KPI cards en grille :
     * 💰 CA du mois (somme factures payées du mois)
     * 📋 Commandes en cours (statut confirmé/en production/prêt)
     * 📝 Devis en attente (statut envoyé)
     * ⚠️ Alertes stock (produits sous le seuil minimum)
     * 🏭 OF en production (statut progress + waiting)
     * 🧾 Factures impayées (statut sent + partial)
     * 🏦 Trésorerie (solde compte 512 Banque + 531 Caisse)
     * 🎯 Pipeline CRM (total opportunités non-won/lost)
   - Graphique barres : CA des 30 derniers jours (par jour)
   - Section "Dernières activités" : 5 dernières écritures journal ou ventes
   - 6 boutons raccourcis : Nouveau devis, Nouvelle commande, Nouveau contact, Nouveau produit, Nouvel OF, Ouvrir caisse

2. Export CSV :
   - Ajouter un bouton "📥 Export CSV" dans la toolbar de chaque vue liste
   - Génère un fichier CSV avec les données de la table affichée
   - Téléchargement automatique

3. Export/Import JSON :
   - Dans un menu "⚙️ Admin" accessible depuis la topbar (icône engrenage, uniquement pour rôle admin)
   - Bouton "Exporter toute la base" → télécharge un fichier hcs-backup-DATE.json
   - Bouton "Importer une base" → upload d'un fichier JSON qui remplace les données
   - Bouton "Réinitialiser les données" → recharge le seed.js initial (avec confirmation)

4. Recherche globale (Ctrl+K) :
   - Modale de recherche qui apparaît au centre
   - Cherche dans : contacts, produits, devis, commandes, factures
   - Résultats regroupés par type avec icône
   - Clic sur un résultat → navigue vers l'élément

5. Vérification finale :
   - Vérifie que tous les modules se chargent sans erreur console
   - Vérifie que la navigation entre modules fonctionne
   - Vérifie que les données seed se chargent au premier lancement
   - Vérifie que le login fonctionne avec les 3 comptes
   - Vérifie que les rôles fonctionnent (vendeur voit moins de modules qu'admin)
