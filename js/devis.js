/* ---------- structure en lots (mêmes règles que le serveur) ---------- */
const CHIFFRES = ["ligne", "tache"];
/** unité par défaut des fournitures (Paramètres > Réglages) */
const uniteFourniture = () => ((PARAMS && PARAMS.devis) || {}).unite_fourniture_defaut || "U";
/** facture de situation : % d'avancement cumulé de la ligne (null = ligne entière) */
const aAvancement = l => l && l.avancement !== null && l.avancement !== undefined && l.avancement !== "";
/** quantité facturée : sur une situation, la part réalisée (quantité × avancement) */
function qteEffective(l) {
  return aAvancement(l) ? Math.round(((nombre(l.quantite) * nombre(l.avancement)) / 100) * 10000) / 10000 : nombre(l.quantite);
}
function totalLigne(l) {
  return CHIFFRES.includes(l.type) ? centimes(qteEffective(l) * nombre(l.prix_unitaire)) / 100 : 0;
}
const estSituation = d => !!d && d.type === "facture" && d.genre === "situation";

function normaliserNiveaux(lignes) {
  const pile = [];
  for (const l of lignes) {
    let n = Math.max(0, Math.min(Number(l.niveau) || 0, l.type === "lot" ? NIVEAU_MAX_LOT : NIVEAU_MAX));
    while (pile.length && pile[pile.length - 1] >= n) pile.pop();
    const maxi = pile.length ? pile[pile.length - 1] + 1 : 0;
    n = Math.min(n, maxi);
    l.niveau = n;
    if (l.type === "lot") pile.push(n);
  }
}
/** fin (exclue) du bloc commençant en i : un lot emmène tout son contenu */
function finBloc(lignes, i) {
  if (lignes[i].type !== "lot") return i + 1;
  let j = i + 1;
  while (j < lignes.length && (lignes[j].niveau || 0) > (lignes[i].niveau || 0)) j++;
  return j;
}
function prixComposition(comp) {
  let deb = 0,
    vente = 0,
    heures = 0;
  for (const e of comp || []) {
    const q = nombre(e.quantite);
    deb += q * nombre(e.prix_achat);
    vente += centimes(q * nombre(e.prix_vente)) / 100; // chaque ligne arrondie, comme Batifree
    if (e.type === "main_oeuvre") heures += q;
  }
  return { debourse: arrondi(deb), vente: arrondi(vente), heures: Math.round(heures * 1e4) / 1e4 };
}
/** heures : affichées « 1h30 », saisies « 1h30 », « 1:30 », « 1,30 » (= 1 h 30, pas 1,3 h), « 45min », « 2 » */
function formatHeures(x) {
  x = nombre(x);
  const signe = x < 0 ? "-" : "";
  x = Math.abs(x);
  let hh = Math.floor(x + 1e-9),
    mm = Math.round((x - hh) * 60);
  if (mm === 60) {
    hh++;
    mm = 0;
  }
  return signe + hh + "h" + (mm ? String(mm).padStart(2, "0") : "");
}
function lireHeures(t) {
  const s = String(t ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!s) return 0;
  let m = s.match(/^(\d+)(?:h|:|,|\.)(\d{1,2})?(?:m|mn|min)?$/);
  if (m) {
    let mm = m[2] === undefined ? 0 : Number(m[2].length === 1 ? m[2] + "0" : m[2]);
    if (mm >= 60) return null;
    return Math.round((Number(m[1]) + mm / 60) * 1e6) / 1e6;
  }
  if ((m = s.match(/^(\d+)$/))) return Number(m[1]);
  if ((m = s.match(/^(\d+)(?:m|mn|min)$/))) return Math.round((Number(m[1]) / 60) * 1e6) / 1e6;
  return null;
}
function champHeures(valeur, change, attrs) {
  const i = h(
    "input",
    Object.assign(
      { type: "text", class: "heures", value: formatHeures(valeur), title: "En heures et minutes : 1h30, 1:30 ou 1,30 (= 1 h 30) ; 45min" },
      attrs || {}
    )
  );
  i.addEventListener("input", () => {
    const v = lireHeures(i.value);
    i.classList.toggle("invalide", v === null);
    if (v !== null) change(v);
  });
  i.addEventListener("blur", () => {
    const v = lireHeures(i.value);
    if (v !== null) i.value = formatHeures(v);
  });
  return i;
}

function tauxMO() {
  return (PARAMS.catalogue && PARAMS.catalogue.main_oeuvre) || [];
}
function tauxDe(code) {
  const t = tauxMO().find(x => String(x.code) === String(code));
  return t ? nombre(t.taux) : tauxMO()[0] ? nombre(tauxMO()[0].taux) : 0;
}

/* ---------- dessin de la fiche devis ---------- */
function dessinerDevis(fiche) {
  const d = DV.courant;
  d.echeancier = Array.isArray(d.echeancier) ? d.echeancier : [];
  if (!["client", "etude", "analyse", "achats"].includes(DV.onglet)) DV.onglet = "etude";
  fiche.innerHTML = "";

  const statut = h(
    "select",
    {
      onchange: e => {
        const avant = d.statut;
        d.statut = e.target.value;
        // devis accepté : prix verrouillés (on peut toujours ajouter des lignes, ou déverrouiller une ligne)
        if (d.statut === "accepte" && avant !== "accepte") {
          d.lignes.forEach(l => verrouillerLigne(l, true));
          toast("Devis accepté : prix des lignes verrouillés 🔒 (ajout de lignes et déverrouillage manuel possibles)");
        } else if (
          avant === "accepte" &&
          d.lignes.some(estVerrouillee) &&
          confirm("Le devis n'est plus accepté. Déverrouiller toutes ses lignes ?")
        ) {
          d.lignes.forEach(l => verrouillerLigne(l, false));
        }
        modifie();
        if (DV.redessiner) DV.redessiner();
      },
    },
    Object.entries(STATUTS).map(([k, v]) => h("option", { value: k, selected: d.statut === k }, v))
  );
  const onglets = h("div", { class: "sous-onglets" });
  const corps = h("div");
  DV.zones = construireZoneDevis();
  const autre = h("div");
  corps.append(DV.zones.client, DV.zones.etude, autre);
  const montrer = async o => {
    DV.onglet = o;
    [...onglets.children].forEach(b => b.classList.toggle("actif", b.dataset.o === o));
    DV.zones.client.classList.toggle("cache", o !== "client");
    DV.zones.etude.classList.toggle("cache", o !== "etude");
    DV.zones.barre.classList.toggle("cache", o !== "etude");
    DV.zones.histo.classList.toggle("cache", o !== "etude");
    autre.innerHTML = "";
    if (o === "client" || o === "etude") return;
    if (autoEnregistrement()) await enregistrerDevis();
    autre.append(h("p", { class: "sous" }, "Calcul…"));
    try {
      const z = o === "analyse" ? await zoneAnalyse(d) : await zoneAchats(d);
      autre.innerHTML = "";
      // sans enregistrement automatique : l'analyse et les achats portent sur la version enregistrée
      if (DV.sale)
        autre.append(
          h(
            "div",
            { class: "bandeau-verrou" },
            "⚠ Modifications non enregistrées : ces chiffres sont ceux de la dernière version enregistrée (Ctrl+S pour enregistrer, puis revenez sur cet onglet)."
          )
        );
      autre.append(z);
    } catch (e) {
      erreur(e);
    }
  };
  DV.montrerOnglet = montrer;
  for (const [o, lib] of [
    ["client", "Client et conclusion"],
    ["etude", "Étude"],
    ["analyse", "Analyse"],
    ["achats", "Achats"],
  ]) {
    onglets.append(h("button", { "data-o": o, onclick: () => montrer(o) }, lib));
  }
  const F = estFact(d),
    L = DV.lectureSeule || DV.factureEmise;
  document.title = (F ? libelleFact(d) : "Devis " + d.numero) + " — DF artisan";
  const etat = F ? etatFacture(d) : null;
  const entete = h(
    "div",
    { class: "entete-fiche entete-devis" + (L ? " lecture-seule" : "") },
    boutonRetour(d),
    d.origine === "batifree"
      ? h(
          "span",
          {
            class: "puce origine-batifree",
            title: estFact(d)
              ? "Facture reprise de Batifree (ancien logiciel) : elle a été faite et envoyée avec Batifree ; la reprise (mise en forme, postes) peut différer un peu de l'original."
              : "Devis repris de Batifree (ancien logiciel) : vérifiez-le avant de vous en resservir, la reprise peut comporter des erreurs (mise en forme, TVA, postes…).",
          },
          estFact(d) ? "⚠ Reprise de Batifree" : "⚠ Repris de Batifree"
        )
      : d.origine === "import"
        ? h(
            "span",
            {
              class: "puce origine-batifree",
              title: "Importé depuis un classeur Excel (autre logiciel) : vérifiez-le avant de vous en resservir.",
            },
            "⚠ Importé"
          )
        : null,
    F
      ? h(
          "span",
          { class: "titre-facture" },
          h("b", {}, d.emise_le ? libelleFact(d) : libelleFact(d).replace(" (brouillon)", "")),
          h("span", { class: "puce etat-fact " + etat }, ETATS_FACTURE[etat])
        )
      : h(
          "span",
          { style: "display:flex;gap:8px;align-items:center" },
          h("b", { class: "numero-entete", title: "Numéro du devis" }, d.numero || ""),
          h("span", { style: "width:130px" }, statut)
        ),
    onglets,
    h("span", { class: "espace" }),
    L ? null : DV.zones.histo,
    L ? null : boutonActionsLignes(),
    autoEnregistrement() || L
      ? null
      : h(
          "button",
          {
            class: "btn principal",
            "data-enregistrer": true,
            title: "Enregistrer (Ctrl+S)",
            onclick: () =>
              enregistrerDevis()
                .then(() => toast("Enregistré"))
                .catch(erreur),
          },
          "Enregistrer"
        ),
    F && !d.emise_le
      ? h(
          "button",
          {
            class: "btn principal",
            title: "Attribue le numéro (FAC…) : la facture ne pourra plus être modifiée",
            onclick: () => validerFacture().catch(erreur),
          },
          d.type === "avoir" ? "✓ Valider l'avoir" : "✓ Valider la facture"
        )
      : null,
    F && d.emise_le && d.type === "facture"
      ? h("button", { class: "btn", onclick: () => fenetreReglements(d).catch(erreur) }, "Règlements…")
      : null,
    F && d.emise_le && d.type === "facture"
      ? h(
          "button",
          {
            class: "btn",
            title: "Une facture validée ne se modifie plus : la corriger, ou faire un avoir",
            onclick: () => fenetreCorriger(d),
          },
          "Corriger…"
        )
      : null,
    F ? null : boutonFacturer(d),
    h(
      "button",
      {
        class: "btn principal",
        title:
          F && d.emise_le
            ? "PDF Factur-X : la facture et ses données (à déposer sur votre plateforme de facturation)"
            : "Créer le PDF directement (mêmes pages que l'aperçu)",
        onclick: () => exporterPdf(d.id),
      },
      "PDF"
    ),
    h("button", { class: "btn", onclick: () => apercu(d.id) }, F ? "Aperçu" : "Aperçu / Imprimer"),
    // document libre (attestation, formulaire…) rempli avec ce devis ou cette facture et son client
    d.id && boutonDocumentLibreFiche()
      ? h(
          "button",
          {
            class: "btn",
            title:
              "Imprimer un document libre (attestation, formulaire… : Catalogue > Documents) rempli avec ce " + (F ? "document" : "devis"),
            onclick: () =>
              fenetreDocumentLibre(
                F ? { facture: d.id, client: d.client_id, devis: d.origine_id || undefined } : { devis: d.id, client: d.client_id }
              ).catch(erreur),
          },
          "📄 Document…"
        )
      : null,
    F && d.emise_le ? null : h("button", { class: "btn danger", onclick: () => supprimerDevis(fiche).catch(erreur) }, "Supprimer"),
    DV.zones.barre
  );
  fiche.append(entete, corps);
  if (L) rendreLectureSeule(corps, d);
  // titres du tableau de l'étude fixes sous l'en-tête (qui reste en haut avec la recherche)
  const hauteur = () => fiche.style.setProperty("--haut-entete", Math.max(0, entete.offsetHeight - 16) + "px");
  if (window.ResizeObserver) new ResizeObserver(hauteur).observe(entete);
  hauteur();
  montrer(DV.onglet);
  majBoutonsHisto();
}

/* ---------- petit traitement de texte (zone d'introduction) ---------- */
function echapperHtml(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function versHtmlRiche(v) {
  // ancienne remarque en texte simple : elle était imprimée en rouge gras, on garde cet aspect
  if (!v) return "";
  if (/<(b|strong|i|em|u|br|div|p|span|font)\b/i.test(v)) return v;
  return `<span style="color:#ff0000;font-weight:bold">${echapperHtml(v).replace(/\n/g, "<br>")}</span>`;
}
function editeurRiche(valeur, change, placeholder) {
  const zone = h("div", { class: "editeur-riche", contenteditable: "true", "data-placeholder": placeholder || "" });
  zone.innerHTML = versHtmlRiche(valeur);
  const lire = () => {
    const t = zone.innerText.trim();
    return t ? "<div>" + zone.innerHTML + "</div>" : "";
  };
  const maj = () => {
    zone.classList.toggle("vide", !zone.innerText.trim());
    change(lire());
  };
  zone.addEventListener("input", maj);
  // collage : texte seul (évite d'importer la mise en forme d'un autre logiciel)
  zone.addEventListener("paste", e => {
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
  });
  const cmd = (c, v) => {
    zone.focus();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(c, false, v);
    maj();
  };
  const bouton = (titre, contenu, action) =>
    h(
      "button",
      {
        class: "icone",
        type: "button",
        title: titre,
        onmousedown: e => {
          e.preventDefault();
          action();
        },
      },
      contenu
    );
  const barre = h(
    "div",
    { class: "barre-riche" },
    bouton("Gras (sélection)", h("b", {}, "G"), () => cmd("bold")),
    bouton("Italique", h("i", {}, "I"), () => cmd("italic")),
    bouton("Souligné", h("u", {}, "S"), () => cmd("underline")),
    h("span", { class: "sep" }),
    COULEURS_TEXTE.map(([c, nom]) =>
      bouton("Couleur : " + nom, h("span", { class: "pastille", style: "background:" + c }), () => cmd("foreColor", c))
    ),
    h("span", { class: "sep" }),
    choixTaille(zone, maj),
    h("span", { class: "sep" }),
    bouton("Aligner à gauche", iconeAlignement("left"), () => alignerBlocs(zone, "left")),
    bouton("Centrer", iconeAlignement("center"), () => alignerBlocs(zone, "center")),
    bouton("Aligner à droite", iconeAlignement("right"), () => alignerBlocs(zone, "right")),
    h("span", { class: "sep" }),
    bouton("Retirer la mise en forme", "⌫", () => cmd("removeFormat"))
  );
  setTimeout(() => zone.classList.toggle("vide", !zone.innerText.trim()));
  return h("div", { class: "riche" }, barre, zone);
}

/* ---------- textes mis en forme (conclusion, mentions…) ----------
   Le texte reste enregistré en texte simple, avec des marques :
     **gras**   [u]souligné[/u]   [i]italique[/i]   [couleur=#ff0000]couleur[/couleur]   [grand]plus grand[/grand]
   « - » en début de ligne = puce ; les {{champs}} et la règle « ligne vide si champ vide » continuent de marcher. */
const RE_MARQUE = /(\*\*|\[\/?(?:u|i|grand|petit)\]|\[couleur=#[0-9a-fA-F]{3,6}\]|\[\/couleur\]|\[taille=\d{2,3}\]|\[\/taille\])/;
function ligneMarquageVersHtml(ligne) {
  ligne = String(ligne).replace(/^\[(centre|droite)\]/, "");
  const pile = [];
  let out = "";
  const ouvre = {
    "**": "<b>",
    "[u]": "<u>",
    "[i]": "<i>",
    "[grand]": '<span style="font-size:1.25em">',
    "[petit]": '<span style="font-size:0.85em">',
  };
  const ferme = {
    "**": "</b>",
    "[u]": "</u>",
    "[i]": "</i>",
    "[grand]": "</span>",
    "[petit]": "</span>",
    couleur: "</span>",
    taille: "</span>",
  };
  for (const m of String(ligne).split(RE_MARQUE)) {
    if (!m) continue;
    if (m === "**") {
      if (pile.includes("**")) {
        while (pile.length) {
          const t = pile.pop();
          out += ferme[t];
          if (t === "**") break;
        }
      } else {
        pile.push("**");
        out += ouvre["**"];
      }
    } else if (/^\[(u|i|grand|petit)\]$/.test(m)) {
      pile.push(m);
      out += ouvre[m];
    } else if (/^\[\/(u|i|grand|petit)\]$/.test(m)) {
      const t = "[" + m.slice(2);
      if (pile.includes(t))
        while (pile.length) {
          const x = pile.pop();
          out += ferme[x];
          if (x === t) break;
        }
    } else if (m.startsWith("[couleur=")) {
      pile.push("couleur");
      out += `<span style="color:${m.slice(9, -1)}">`;
    } else if (m.startsWith("[taille=")) {
      pile.push("taille");
      out += `<span style="font-size:${Number(m.slice(8, -1)) / 100}em">`;
    } else if (m === "[/taille]") {
      if (pile.includes("taille"))
        while (pile.length) {
          const x = pile.pop();
          out += ferme[x];
          if (x === "taille") break;
        }
    } else if (m === "[/couleur]") {
      if (pile.includes("couleur"))
        while (pile.length) {
          const x = pile.pop();
          out += ferme[x];
          if (x === "couleur") break;
        }
    } else out += echapperHtml(m);
  }
  while (pile.length) out += ferme[pile.pop()];
  return out;
}
/** désignation d'une ligne de l'étude : le gras s'affiche en gras, les puces en puces
    (enregistré comme avant : **gras**, « - » en début de ligne) ; s'utilise comme un textarea */
const RE_PUCE = /^\s*[-•]\s+/;
function champLigne(placeholder) {
  const z = h("div", { class: "champ-ligne", contenteditable: "true", "data-placeholder": placeholder || "" });
  const majVide = () => z.classList.toggle("vide", !z.innerText.trim() && !z.querySelector(".li-puce"));
  const versHtml = t =>
    String(t || "")
      .replace(/\r/g, "")
      .split("\n")
      .map(l =>
        RE_PUCE.test(l)
          ? '<div class="li-puce">' + (ligneMarquageVersHtml(l.replace(RE_PUCE, "")) || "<br>") + "</div>"
          : "<div>" + (ligneMarquageVersHtml(l) || "<br>") + "</div>"
      )
      .join("");
  const blocCourant = () => {
    const sel = getSelection();
    if (!sel.rangeCount || !z.contains(sel.anchorNode)) return null;
    let n = sel.anchorNode;
    if (n === z) n = z.childNodes[Math.min(sel.anchorOffset, z.childNodes.length - 1)];
    if (n && n.nodeType === 3) n = n.parentNode;
    const b = n && n.closest ? n.closest("div") : null;
    return b && b !== z && z.contains(b) ? b : null;
  };
  const debutDeBloc = b => {
    const sel = getSelection();
    if (!sel.isCollapsed) return false;
    const r = document.createRange();
    r.selectNodeContents(b);
    r.setEnd(sel.anchorNode, sel.anchorOffset);
    return r.toString() === "";
  };
  const signaler = () => z.dispatchEvent(new Event("input", { bubbles: true }));
  z.addEventListener("focus", () => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "div");
      document.execCommand("styleWithCSS", false, false);
    } catch (er) {
      /* */
    }
  });
  z.addEventListener("paste", e => {
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
  });
  z.addEventListener("keydown", e => {
    const b = blocCourant();
    if (!b || !b.classList.contains("li-puce")) return;
    // Entrée sur une puce vide, ou retour arrière au début d'une puce : on sort de la liste
    if ((e.key === "Enter" && !b.textContent.trim()) || (e.key === "Backspace" && debutDeBloc(b))) {
      e.preventDefault();
      b.classList.remove("li-puce");
      signaler();
    }
  });
  z.addEventListener("input", e => {
    // « - » + espace en début de ligne : devient une puce
    let b = blocCourant();
    if (!b && z.firstChild && z.firstChild.nodeType === 3) {
      document.execCommand("formatBlock", false, "div");
      b = blocCourant();
    }
    if (b && !b.classList.contains("li-puce") && /^[-•][\s\u00a0]/.test(b.textContent)) {
      const t = (function premierTexte(n) {
        if (n.nodeType === 3) return n.nodeValue ? n : null;
        for (const x of n.childNodes) {
          const r = premierTexte(x);
          if (r) return r;
        }
        return null;
      })(b);
      if (t && /^[-•][\s\u00a0]/.test(t.nodeValue)) {
        t.nodeValue = t.nodeValue.slice(2);
        b.classList.add("li-puce");
        if (!b.textContent) b.innerHTML = "<br>";
        const r = document.createRange();
        r.setStart(t.nodeValue ? t : b, 0);
        r.collapse(true);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }
    majVide();
  });
  Object.defineProperty(z, "value", {
    get: () => htmlVersMarquage(z),
    set: v => {
      z.innerHTML = versHtml(v);
      majVide();
    },
  });
  z.basculerGras = () => {
    z.focus();
    const sel = getSelection();
    if (sel.isCollapsed) {
      // pas de sélection : toute la 1re ligne
      const b = z.firstElementChild || z;
      const r = document.createRange();
      r.selectNodeContents(b);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    document.execCommand("bold");
    signaler();
  };
  z.basculerPuces = () => {
    z.focus();
    const sel = getSelection();
    const blocs = [...z.querySelectorAll("div")].filter(
      b => !b.querySelector("div") && sel.rangeCount && sel.getRangeAt(0).intersectsNode(b)
    );
    if (!blocs.length) return;
    const toutes = blocs.every(b => b.classList.contains("li-puce"));
    blocs.forEach(b => b.classList.toggle("li-puce", !toutes));
    signaler();
  };
  return z;
}

/** lignes chiffrées à TVA réduite (10 % ou 5,5 %) */
/** validation d'une facture avec des lignes à 10 % / 5,5 % (travaux dans un logement de plus de 2 ans) : ce sont des
    prestations de services, matériel fourni compris (BOFiP BOI-TVA-LIQ-30-20-90-20, § 1 et § 40) : rappel du type d'opération */
function avertTvaReduite(d) {
  const av = [];
  if (d.autoliquidation || (PARAMS.facture || {}).avert_tva_reduite === false) return av;
  const red = (d.lignes || []).filter(l => CHIFFRES.includes(l.type) && !l.option && [10, 5.5].includes(nombre(l.tva)));
  if (!red.length) return av;
  const taux = [...new Set(red.map(l => String(nombre(l.tva)).replace(".", ",") + " %"))].join(" et ");
  const nat = d.nature_operation || "";
  if (nat !== "services")
    av.push(
      `Lignes à ${taux} avec le type d'opération « ${nat ? (NATURES.find(n => n[0] === nat) || [0, nat])[1] : "non choisi"} » : les taux réduits s'appliquent à des travaux, c'est-à-dire à une prestation de services, matériel fourni compris (BOFiP BOI-TVA-LIQ-30-20-90-20, § 1 et § 40). Vérifiez le type d'opération (onglet « Client et conclusion »).`
    );
  return av;
}
function aTvaReduite(lignes) {
  return lignes.some(l => CHIFFRES.includes(l.type) && [10, 5.5].includes(nombre(l.tva)));
}

/** Deux onglets : « Client et conclusion » (en-tête, textes, mentions) et « Étude » (les lignes) */
function construireZoneDevis() {
  const d = DV.courant;
  const zClient = h("div");
  const zEtude = h("div");

  // ================= onglet Client et conclusion =================
  const champClient = h("input", {
    type: "text",
    id: "champ-client",
    placeholder: "Tapez un nom pour chercher ou créer un client",
    value: d.client_nom || "",
    "data-champ": "client",
  });
  const lienClient = h("div", { class: "adresse-client" });
  const alerteIdent = h("div", { class: "aide alerte" });
  const majLienClient = () => {
    const c = d.client;
    lienClient.innerHTML = "";
    if (c) {
      const adr = [c.adresse, [c.cp, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ").replace(/\n/g, ", ");
      ajouterA(
        lienClient,
        h("b", {}, "Adresse client : "),
        adr,
        " ",
        boutonItineraire(() => adr)
      );
    }
    const manque = c && c.type === "professionnel" ? [!c.siren && "SIREN", !c.tva_intra && "n° TVA"].filter(Boolean) : [];
    alerteIdent.textContent = manque.length
      ? `⚠ Client professionnel : ${manque.join(" et ")} non renseigné${manque.length > 1 ? "s" : ""}`
      : "";
    alerteIdent.append(
      manque.length
        ? h(
            "button",
            {
              class: "btn petit",
              style: "margin-left:8px",
              onclick: e => {
                e.preventDefault();
                fenetreClient(c, cl => choisirClient(cl));
              },
            },
            "Compléter la fiche"
          )
        : ""
    );
  };
  const choisirClient = cl => {
    d.client_id = cl.id;
    d.client = cl;
    d.client_nom = cl.nom_affiche;
    champClient.value = cl.nom_affiche;
    majLienClient();
    majAdresses();
    if (DV.majInterlocuteurs) DV.majInterlocuteurs();
    majBoutonFiche();
    modifie();
  };
  majLienClient();
  const boutonFicheClient = h(
    "button",
    {
      class: "icone",
      type: "button",
      title: "Modifier la fiche du client (adresse, téléphone, SIREN, contacts…)",
      onclick: () => {
        if (d.client_id) fenetreClient({ id: d.client_id }, cl => choisirClient(cl));
      },
    },
    "✎ fiche"
  );
  const majBoutonFiche = () => boutonFicheClient.classList.toggle("cache", !d.client_id);
  majBoutonFiche();
  const blocClient = h(
    "div",
    { class: "champ double" },
    h("span", { class: "titre-client" }, "Client", boutonFicheClient),
    champClient,
    lienClient,
    alerteIdent
  );
  autoComplete(
    champClient,
    async q =>
      (await api("GET", "/api/clients?q=" + encodeURIComponent(q))).slice(0, 15).map(c => ({
        libelle: c.nom_affiche,
        detail: [c.cp, c.ville].filter(Boolean).join(" ") + (c.code ? "  · " + c.code : ""),
        valeur: c,
      })),
    choisirClient,
    { creer: nom => fenetreClient({ nom }, cl => choisirClient(cl)), creerLibelle: nom => `Créer le client « ${nom} »` }
  );
  champClient.addEventListener("blur", () =>
    setTimeout(() => {
      if (champClient.value !== (d.client_nom || "") && !$(".modale:not(.cache)")) champClient.value = d.client_nom || "";
    }, 200)
  );

  const entree = (libelle, cle, attrs, classe) => {
    const i = h("input", Object.assign({ type: "text", value: d[cle] ?? "", "data-champ": cle }, attrs || {}));
    i.addEventListener("input", () => {
      d[cle] = i.type === "number" ? nombre(i.value) : i.value;
      modifie();
    });
    return h("label", { class: "champ " + (classe || "") }, h("span", {}, libelle), i);
  };
  // adresse du chantier : saisie, ou choisie parmi les contacts / adresses du client
  const champChantier = h("textarea", {
    rows: 2,
    placeholder: "Nom (résidence…) sur la 1re ligne, adresse sur la 2e",
    "data-champ": "chantier_adresse",
  });
  champChantier.value = d.chantier_adresse || "";
  champChantier.addEventListener("input", () => {
    d.chantier_adresse = champChantier.value;
    autoHauteur(champChantier);
    modifie();
  });
  setTimeout(() => autoHauteur(champChantier));
  const choixAdresse = h("select", { class: "cache", style: "margin-top:4px" });
  choixAdresse.addEventListener("change", () => {
    if (!choixAdresse.value) return;
    d.chantier_adresse = champChantier.value = choixAdresse.value;
    choixAdresse.value = "";
    autoHauteur(champChantier);
    modifie();
  });
  let adresseClient = ""; // (itinéraire : l'adresse du client quand il n'y a pas d'adresse de chantier)
  const majAdresses = async () => {
    choixAdresse.classList.add("cache");
    adresseClient = "";
    if (!d.client_id) return;
    try {
      const cl = await api("GET", "/api/clients/" + d.client_id);
      adresseClient = [cl.adresse, [cl.cp, cl.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      const adr = (cl.contacts || [])
        .filter(k => k.adresse || k.ville)
        .map(k => {
          const rue = [(k.adresse || "").replace(/\n/g, ", "), [k.cp, k.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
          return [k.nom, rue].filter(Boolean).join("\n"); // nom sur la 1re ligne, adresse sur la 2e
        })
        .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
      choixAdresse.innerHTML = "";
      ajouterA(
        choixAdresse,
        h("option", { value: "" }, `Choisir une adresse du client (${adr.length})…`),
        adr.map(a => h("option", { value: a }, a.replace("\n", " — ")))
      );
      choixAdresse.classList.toggle("cache", !adr.length);
    } catch (er) {
      /* sans importance */
    }
  };
  majAdresses();
  // adresse d'un autre client (ex. le syndic est le client, le chantier est chez un de ses copropriétaires)
  const boutonAutreClient = h(
    "button",
    {
      class: "btn petit",
      type: "button",
      title: "Prendre l'adresse d'un client de la liste (ou d'un de ses contacts)",
      onclick: () =>
        choisirAdresseClient(a => {
          d.chantier_adresse = champChantier.value = a;
          autoHauteur(champChantier);
          modifie();
        }),
    },
    "📋 Adresse d'un client…"
  );
  const blocChantier = h(
    "div",
    { class: "champ" },
    h(
      "span",
      { style: "display:flex;justify-content:space-between;align-items:center;gap:8px" },
      h("span", { class: "lib-champ" }, "Adresse du chantier"),
      h(
        "span",
        { style: "display:flex;gap:6px;align-items:center" },
        // itinéraire vers le chantier (sinon vers l'adresse du client)
        boutonItineraire(() => champChantier.value.trim() || adresseClient),
        boutonAutreClient
      )
    ),
    champChantier,
    choixAdresse
  );
  blocClient.classList.remove("double"); // (garder la classe « auto » de la liste de choix)

  // interlocuteur : un contact du client, ou saisi à la main
  const champInterloc = h("input", {
    type: "text",
    value: d.interlocuteur || "",
    placeholder: "Contact chez le client (facultatif)",
    autocomplete: "off",
    "data-champ": "interlocuteur",
  });
  champInterloc.addEventListener("input", () => {
    d.interlocuteur = champInterloc.value;
    modifie();
  });
  // les contacts du client s'affichent dès qu'on clique dans le champ
  let interlocuteurs = [];
  const listeInterloc = listeSousChamp(
    champInterloc,
    () => interlocuteurs,
    v => {
      d.interlocuteur = champInterloc.value = v;
      modifie();
    }
  );
  const majInterlocuteurs = async () => {
    interlocuteurs = [];
    champInterloc.placeholder = "Contact chez le client (facultatif)";
    if (!d.client_id) return;
    try {
      const cl = await api("GET", "/api/clients/" + d.client_id);
      interlocuteurs = (cl.contacts || []).filter(k => k.nom).map(k => k.nom + (k.fonction ? " (" + k.fonction + ")" : ""));
      if (interlocuteurs.length)
        champInterloc.placeholder = `${interlocuteurs.length} contact(s) chez ce client : cliquez pour choisir, ou tapez un nom`;
    } catch (er) {
      /* sans importance */
    }
  };
  majInterlocuteurs();
  DV.majInterlocuteurs = majInterlocuteurs;

  const note = editeurRiche(
    d.note_entete || "",
    v => {
      d.note_entete = v;
      modifie();
    },
    "Ex. Il y aura une remise sur la facture en fonction du matériel fourni par le client."
  );
  note.setAttribute("data-champ", "note_entete");

  // devis et factures liés à ce dossier (copie, devis d'origine ; plus tard les factures) : dans une fenêtre
  const boutonAssocies = h(
    "button",
    { class: "btn petit toujours-actif", type: "button", onclick: () => fenetreAffaire(d).catch(erreur) },
    "Affaires associées…"
  );
  // (petit éclair à côté, dans le ton du texte : un plan, une étude d'éclairement ou un tableau est rattaché au devis)
  const eclairAssocies = h("span", { class: "eclair-associes", style: "display:none" });
  eclairAssocies.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M13.5 2 4.5 13.5h6L9.5 22l9-12h-6z" fill="currentColor"/></svg>';
  {
    const G = PARAMS.general || {},
      dvId = estFact(d) ? d.origine_id : d.id;
    if (dvId && modulesElecActifs(G))
      api("GET", "/api/plans?document_id=" + dvId)
        .then(l => {
          if (!l.length) return;
          const n = g => l.filter(x => (x.genre || "plan") === g).length;
          const t = [
            [n("plan"), "un plan", "plans"],
            [n("eclairage"), "une étude d'éclairement", "études d'éclairement"],
            [n("etiquettes"), "un tableau électrique", "tableaux électriques"],
            [n("schema"), "un schéma", "schémas"],
          ]
            .filter(([k]) => k)
            .map(([k, un, plus]) => (k > 1 ? k + " " + plus : un));
          eclairAssocies.title =
            "Contient " + (t.length > 1 ? t.slice(0, -1).join(", ") + " et " + t[t.length - 1] : t[0]) + " (Affaires associées…)";
          eclairAssocies.style.display = "";
        })
        .catch(() => {});
  }
  const fmtDateHeure = v => (v ? dateFr(v) + (v.length > 10 ? " à " + v.slice(11, 16) : "") : "");

  const autoliq = h("input", { type: "checkbox", checked: !!d.autoliquidation });
  autoliq.addEventListener("change", () => {
    d.autoliquidation = autoliq.checked ? 1 : 0;
    modifie();
    DV.recalculer();
  });
  const gratuit = h("input", { type: "checkbox", checked: !!d.mention_gratuit });
  gratuit.addEventListener("change", () => {
    d.mention_gratuit = gratuit.checked ? 1 : 0;
    modifie();
  });
  const tvaReduite = h("input", { type: "checkbox", checked: !!d.mention_tva_reduite });
  const caseTvaReduite = h(
    "label",
    { class: "case", title: "Encadré que le client certifie en signant (remplace l'attestation). Texte dans Paramètres > Devis." },
    tvaReduite,
    "Mention TVA réduite"
  );
  // la case passe en orange tant qu'il y a des lignes à 10 % / 5,5 % sans la mention
  // facture : la case se coche toute seule (facture sans devis avec des lignes à 10 %) tant qu'on n'y a pas touché
  const factAuto = d.type === "facture" && d.origine !== "batifree" && d.origine !== "import";
  if (factAuto)
    caseTvaReduite.title =
      "Cochée toute seule pour une facture sans devis qui a des lignes à 10 % (le devis signé porte déjà la mention). Vous pouvez la cocher ou la décocher : elle ne change alors plus toute seule.";
  DV.majTvaReduite = () => {
    if (factAuto) {
      if (d.tva_reduite_auto !== 0) {
        d.mention_tva_reduite = !d.origine_id && d.lignes.some(l => CHIFFRES.includes(l.type) && !l.option && nombre(l.tva) === 10) ? 1 : 0;
        tvaReduite.checked = !!d.mention_tva_reduite;
      }
      return;
    }
    const oubli = aTvaReduite(d.lignes) && !d.mention_tva_reduite;
    caseTvaReduite.classList.toggle("a-cocher", oubli);
  };
  tvaReduite.addEventListener("change", () => {
    d.mention_tva_reduite = tvaReduite.checked ? 1 : 0;
    if (factAuto) d.tva_reduite_auto = 0;
    DV.majTvaReduite();
    modifie();
  });
  // facture reprise de Batifree déjà émise : les mentions étaient dans le modèle de Batifree, elles se corrigent ici
  if (d.origine === "batifree" && d.emise_le) {
    const mentions = async (champ, cb) => {
      try {
        await api("POST", `/api/documents/${d.id}/mentions-batifree`, { [champ]: cb.checked ? 1 : 0 });
        toast("Mention corrigée (facture reprise de Batifree)");
        await ouvrirDevis(d.id, DV.fiche);
      } catch (er) {
        erreur(er);
        cb.checked = !cb.checked;
      }
    };
    for (const [cb, champ] of [
      [autoliq, "autoliquidation"],
      [tvaReduite, "mention_tva_reduite"],
    ]) {
      cb.classList.add("toujours-actif");
      cb.addEventListener(
        "change",
        e => {
          e.stopImmediatePropagation();
          mentions(champ, cb);
        },
        true
      );
    }
  }

  const totauxClient = h("div", { class: "totaux" });
  const cadrePrix = h(
    "div",
    { class: "encadre cadre-prix" },
    h("div", { class: "titre-cadre" }, "Prix et mentions"),
    h(
      "div",
      { class: "prix-et-cases" },
      totauxClient,
      h(
        "div",
        { class: "cases-mentions" },
        h(
          "label",
          { class: "case", title: "Sous-traitance BTP : la TVA n'est pas facturée, elle est due par votre client" },
          autoliq,
          "Autoliquidation de TVA"
        ),
        estFact(d) ? null : h("label", { class: "case" }, gratuit, "Mention « Devis gratuit »"),
        caseTvaReduite,
        h(
          "button",
          {
            class: "btn petit",
            type: "button",
            style: "margin-top:6px",
            title: "Remise, plus-value, frais, arrondi du total (comme le bouton « Postes (+/-) » de Batifree)",
            onclick: () => fenetrePostes(d),
          },
          "Postes (+/-) / arrondi…"
        )
      )
    )
  );

  if (d.origine === "batifree")
    zClient.append(
      h(
        "div",
        { class: "bandeau-batifree" },
        estFact(d)
          ? "⚠ Facture reprise de Batifree (ancien logiciel de facturation) : l'original est celui fait avec Batifree. La reprise peut différer un peu (mise en forme, postes) ; ses montants sont comparés à ceux de Batifree."
          : "⚠ Devis repris de Batifree (ancien logiciel de facturation) : la reprise peut comporter des erreurs. Vérifiez les textes, la TVA et les totaux avant de le renvoyer ou de le dupliquer."
      )
    );
  else if (d.origine === "import")
    zClient.append(
      h(
        "div",
        { class: "bandeau-batifree" },
        estFact(d)
          ? "⚠ Facture importée depuis Excel : l'original est celui fait avec votre ancien logiciel. Elle n'est pas envoyée à la plateforme et n'a pas de Factur-X."
          : "⚠ Devis importé depuis Excel : vérifiez les textes, la TVA et les totaux avant de le renvoyer ou de le dupliquer."
      )
    );
  zClient.append(
    h(
      "div",
      { class: "cadres-dossier" },
      h(
        "div",
        { class: "pile" },
        cadreClientChantier(d, blocClient, blocChantier, champChantier),
        h("div", { class: "champ" }, h("span", {}, "Introduction au-dessus du tableau (facultatif)"), note)
      ),
      h(
        "div",
        { class: "pile" },
        h(
          "div",
          { class: "encadre" },
          h(
            "div",
            { class: "titre-cadre titre-avec-infos" },
            "Dossier", // (le n° est déjà en haut de la fiche)
            h(
              "span",
              { class: "infos-dossier" },
              estFact(d) && !d.emise_le
                ? "Le numéro est attribué à la validation · créé le " + fmtDateHeure(d.cree_le)
                : estFact(d)
                  ? "Émise le " + fmtDateHeure(d.emise_le)
                  : "Créé le " + fmtDateHeure(d.cree_le) + " · mis à jour le " + fmtDateHeure(d.modifie_le)
            ),
            boutonAssocies,
            eclairAssocies
          ),
          estFact(d) ? lienOrigine(d) : null,
          h(
            "div",
            { class: "pile" },
            h(
              "div",
              { class: "deux" },
              entree("Date", "date_doc", { type: "date" }),
              entree("Réf. libre", "ref_libre", { placeholder: "ex. n° de commande, bâtiment…" })
            ),
            entree("Objet", "objet", { placeholder: "Ex. Création de l'alimentation de la pompe du puits" }),
            h("label", { class: "champ", style: "position:relative" }, h("span", {}, "Interlocuteur"), champInterloc, listeInterloc)
          )
        ),
        cadrePrix
      )
    )
  );

  const zoneTexte = (libelle, cle, aide) => {
    const ta = zoneRiche();
    ta.value = d[cle] || "";
    ta.addEventListener("input", () => {
      d[cle] = ta.value;
      modifie();
    });
    return {
      ta,
      el: h(
        "div",
        { style: "margin-top:10px" },
        h(
          "div",
          { style: "display:flex;justify-content:space-between;align-items:end;margin-bottom:3px" },
          h("span", { class: "sous", style: "font-weight:500" }, libelle),
          boutonChamps(() => ta)
        ),
        ta,
        aide ? h("p", { class: "aide" }, aide) : null
      ),
    };
  };
  const conclusion = zoneTexte(
    "Texte de la conclusion",
    "texte_conditions",
    "Sélectionnez du texte pour le mettre en gras, souligné, en couleur… Les {{champs}} sont remplacés à l'impression ; une ligne dont les champs sont vides (durée non saisie…) n'est pas imprimée. « - » en début de ligne = puce."
  );
  const complement = zoneTexte("Texte complémentaire (facultatif)", "texte_libre");

  const choixModele = h(
    "select",
    {},
    h("option", { value: "" }, "— choisir une conclusion —"),
    (DV.modeles || []).map(m => h("option", { value: m.id, selected: m.id === d.modele_id }, m.nom))
  );
  const zoneEch = h("div", { class: "echeancier" });
  choixModele.addEventListener("change", () => {
    const m = (DV.modeles || []).find(x => String(x.id) === choixModele.value);
    if (!m) return;
    const actuel = (DV.modeles || []).find(x => x.id === d.modele_id);
    const retouche = d.texte_conditions && d.texte_conditions.trim() && (!actuel || d.texte_conditions !== actuel.contenu);
    if (
      retouche &&
      d.texte_conditions !== m.contenu &&
      !confirm(`Vous avez modifié le texte de la conclusion. Le remplacer par « ${m.nom} » ?`)
    ) {
      choixModele.value = d.modele_id || "";
      return;
    }
    d.modele_id = m.id;
    d.texte_conditions = m.contenu;
    conclusion.ta.value = m.contenu;
    autoHauteur(conclusion.ta);
    if (Array.isArray(m.echeancier)) {
      d.echeancier = JSON.parse(JSON.stringify(m.echeancier));
      dessinerEcheancier(zoneEch);
    }
    if (m.autoliquidation !== null && m.autoliquidation !== undefined) {
      d.autoliquidation = m.autoliquidation ? 1 : 0;
      autoliq.checked = !!d.autoliquidation;
    }
    modifie();
    DV.recalculer();
  });
  dessinerEcheancier(zoneEch);

  // les champs utilisés par les textes sont à côté du texte correspondant
  const F = estFact(d);
  zClient.append(
    h(
      "div",
      { class: "bas-devis grille-conclusion", style: "margin-top:18px" },
      h(
        "div",
        {},
        h("h3", { style: "margin-top:0" }, "Conclusion et mentions"),
        h(
          "div",
          { style: "display:flex;gap:14px;flex-wrap:wrap;align-items:center" },
          h("label", { class: "champ", style: "min-width:280px" }, h("span", {}, "Modèle de conclusion"), choixModele)
        ),
        F
          ? null
          : h(
              "div",
              { style: "margin-top:10px" },
              h("span", { class: "sous", style: "font-weight:500" }, "Échéancier de paiement"),
              zoneEch
            )
      ),
      cadreChampsLibres(d) || h("div"),
      conclusion.el,
      // les champs utilisés par la conclusion, à côté d'elle
      F
        ? champsFacture(d, entree)
        : h(
            "div",
            { class: "champs-texte" },
            entree("Début des travaux", "debut_travaux", { placeholder: "ex. fin mars" }),
            entree("Durée estimée", "duree_intervention", { placeholder: "ex. 5 à 7 h" }),
            entree("Validité (jours)", "validite_jours", { type: "number", min: 0 })
          ),
      complement.el,
      h("div")
    )
  );

  // ================= onglet Étude =================
  const corpsTable = h("tbody");
  // colonnes de l'étude : largeur réglable à la souris (bord droit du titre), la désignation prend le reste
  const largEtude = () => {
    PARAMS.general = PARAMS.general || {};
    PARAMS.general.largeurs = PARAMS.general.largeurs || {};
    return PARAMS.general.largeurs.etude || {};
  };
  // (colonne des boutons : jamais plus étroite que ses boutons, croix comprise ; même valeur que le CSS de th.act)
  const MINI_ACT = 196;
  const thEtude = (cle, classe, titre, aide) => {
    const th = h("th", { class: classe, title: aide || "" }, titre);
    const w = largEtude()[cle];
    if (w) th.style.width = (cle === "act" ? Math.max(w, MINI_ACT) : w) + "px";
    if (cle !== "desig") {
      // la colonne des boutons (tout à droite) se règle par son bord gauche
      const sens = cle === "act" ? -1 : 1;
      const p = h("span", {
        class: "poignee" + (sens < 0 ? " a-gauche" : ""),
        title: "Glisser pour élargir ou rétrécir la colonne · double-clic : largeur d'origine",
      });
      p.addEventListener("dblclick", e => {
        e.stopPropagation();
        const l = Object.assign({}, largEtude());
        delete l[cle];
        PARAMS.general.largeurs.etude = l;
        th.style.width = "";
        enregistrerColonnes();
      });
      p.addEventListener("mousedown", e => {
        e.preventDefault();
        const x0 = e.clientX,
          w0 = th.getBoundingClientRect().width;
        document.body.classList.add("redimension");
        const bouger = ev => {
          th.style.width = Math.max(cle === "act" ? MINI_ACT : 36, Math.round(w0 + sens * (ev.clientX - x0))) + "px";
        };
        const lacher = () => {
          document.removeEventListener("mousemove", bouger);
          document.removeEventListener("mouseup", lacher);
          document.body.classList.remove("redimension");
          PARAMS.general.largeurs.etude = Object.assign({}, largEtude(), { [cle]: Math.round(th.getBoundingClientRect().width) });
          enregistrerColonnes();
        };
        document.addEventListener("mousemove", bouger);
        document.addEventListener("mouseup", lacher);
      });
      th.append(p);
    }
    return th;
  };
  // colonnes au choix : clic droit sur les titres
  const thead = h("thead", {
    title: "Clic droit : choisir les colonnes (temps de main d'œuvre, déboursé…) · bord droit d'un titre : largeur",
  });
  DV.dessinerEntete = () => {
    thead.innerHTML = "";
    thead.append(
      h(
        "tr",
        {},
        h("th", { class: "num" }, "N°"),
        colonnesEtude().map(c => thEtude(c.cle, c.classe, c.titre, c.aide)),
        ajouterA(
          thEtude(
            "act",
            "act",
            "",
            "Boutons de la ligne : glisser le bord pour réduire la colonne (les actions restent dans le clic droit)"
          ),
          boutonColonnes()
        )
      )
    );
  };
  DV.dessinerEntete();
  thead.addEventListener("contextmenu", e => {
    e.preventDefault();
    menuColonnesEtude(e.clientX, e.clientY);
  });
  corpsTable.addEventListener("contextmenu", e => menuLigneEtude(e));
  corpsTable.addEventListener("focusin", e => {
    if (e.target.matches && e.target.matches("input, select, .champ-ligne")) DV.dernierChamp = e.target;
  });

  // recherche dans l'étude : ne montre que les lignes concernées (désignation, référence, fournitures des tâches)
  const champFiltre = h("input", {
    type: "search",
    class: "recherche-etude",
    placeholder: "Rechercher dans l'étude (désignation, réf., fournitures)…  Ctrl+F",
    value: DV.filtre || "",
  });
  const infoFiltre = h("span", { class: "sous" });
  champFiltre.addEventListener(
    "input",
    debounce(() => {
      DV.filtre = champFiltre.value.trim();
      dessinerLignes(corpsTable);
      DV.recalculer();
    }, 150)
  );
  champFiltre.addEventListener("keydown", e => {
    if (e.key === "Escape" && champFiltre.value) {
      e.preventDefault();
      e.stopPropagation();
      DV.effacerFiltre();
    }
  });
  DV.champFiltre = champFiltre;
  DV.effacerFiltre = () => {
    if (!DV.filtre && !champFiltre.value) return;
    champFiltre.value = "";
    DV.filtre = "";
    dessinerLignes(corpsTable);
    DV.recalculer();
  };
  DV.majFiltre = f => {
    infoFiltre.textContent = f ? `${f.trouvees.size} ligne(s) trouvée(s) · Échap pour tout revoir` : "";
    zEtude.classList.toggle("filtre-actif", !!f);
    barre.classList.toggle("filtre-actif", !!f);
  };
  const bandeauVerrou = h("div", { class: "bandeau-verrou cache" });
  DV.majBandeauVerrou = () => {
    if (DV.lectureSeule || DV.factureEmise) {
      bandeauVerrou.classList.add("cache");
      return;
    } // (facture émise : son propre bandeau)
    const n = d.lignes.filter(estVerrouillee).length;
    bandeauVerrou.classList.toggle("cache", !n && d.statut !== "accepte");
    bandeauVerrou.textContent =
      d.statut === "accepte"
        ? `🔒 Devis accepté : les prix des lignes sont verrouillés (${n} ligne(s)) pour ne pas changer la facture. Les compositions restent modifiables (matériel non posé, achat moins cher : le bilan suit, pas le prix). Vous pouvez ajouter des lignes (avenant) ; pour modifier une ligne, cliquez sur son cadenas.`
        : `🔒 ${n} ligne(s) verrouillée(s) : cliquez sur un cadenas pour la modifier, ou « Toutes les lignes ▾ » pour tout déverrouiller.`;
  };
  DV.majBandeauVerrou();
  // la recherche est dans l'en-tête du devis : toujours visible
  // totaux du devis à droite de la recherche (toujours visibles en haut de l'étude)
  const totauxEtude = h("div", { class: "totaux-ligne" });
  const barre = h("div", { class: "barre-etude" }, champFiltre, infoFiltre, totauxEtude);
  zEtude.append(bandeauVerrou, h("table", { class: "lignes etude" }, thead, corpsTable));

  const defUnite = (PARAMS.devis && PARAMS.devis.unite_defaut) || "FF";
  // TVA des nouvelles lignes : celle choisie pour ce devis / cette facture, sinon celle des Paramètres
  const defTva = () => d.tva_defaut ?? (PARAMS.devis && PARAMS.devis.tva_defaut) ?? 20;
  const tvaDoc = l => {
    // ajouts du catalogue (ouvrages, articles, lots) : à la TVA choisie pour ce document
    if (d.tva_defaut === null || d.tva_defaut === undefined) return l;
    const f = x => {
      if (CHIFFRES.includes(x.type)) x.tva = d.tva_defaut;
      return x;
    };
    return Array.isArray(l) ? l.map(f) : f(l);
  };
  const choixTvaDoc = h(
    "select",
    {
      title: "TVA des lignes ajoutées ensuite (ouvrages, lignes libres, catalogue). « Paramètres » : celle des Paramètres > Devis.",
    },
    h("option", { value: "" }, `Paramètres (${String((PARAMS.devis && PARAMS.devis.tva_defaut) ?? 20).replace(".", ",")} %)`),
    tauxAvec(d.tva_defaut).map(t => h("option", { value: t }, String(t).replace(".", ",") + " %"))
  );
  choixTvaDoc.value = d.tva_defaut ?? "";
  // (juste la largeur du choix affiché, pas celle du plus long de la liste : évite une 2e ligne pour rien)
  const largeurTva = () => {
    const o = choixTvaDoc.options[choixTvaDoc.selectedIndex];
    const c = document.createElement("canvas").getContext("2d");
    c.font = getComputedStyle(choixTvaDoc).font || "14px sans-serif";
    choixTvaDoc.style.width = Math.ceil(c.measureText(o ? o.text : "").width) + 38 + "px";
  };
  requestAnimationFrame(largeurTva);
  choixTvaDoc.addEventListener("change", () => {
    d.tva_defaut = choixTvaDoc.value === "" ? null : nombre(choixTvaDoc.value);
    largeurTva();
    modifie();
  });
  zEtude.append(
    h(
      "div",
      {
        class: "ajouts collante",
        title:
          "Les ajouts se placent sous la ligne sélectionnée (dans le lot si c'est un lot). Clic droit ou touche Menu sur une ligne : toutes les actions.",
      },
      h(
        "button",
        {
          class: "btn principal",
          "data-rc": "c",
          title: "Raccourci : Alt+C",
          onclick: () =>
            fenetreCatalogue(
              l => inserer(tvaDoc(l), false),
              undefined,
              lignes => insererPlusieurs(tvaDoc(lignes))
            ),
        },
        "+ Depuis le catalogue",
        h("kbd", { class: "rc" }, "Alt+C")
      ),
      h(
        "button",
        {
          class: "btn",
          "data-rc": "l",
          title: "Raccourci : Alt+L",
          onclick: () => inserer({ type: "lot", designation: "", quantite: 1 }, true),
        },
        "+ Lot",
        h("kbd", { class: "rc" }, "Alt+L")
      ),
      h(
        "button",
        {
          class: "btn",
          "data-rc": "t",
          title: "Raccourci : Alt+T",
          onclick: () =>
            inserer(
              { type: "tache", designation: "", unite: defUnite, quantite: 1, prix_unitaire: 0, tva: defTva(), composition: [] },
              true,
              true
            ),
        },
        "+ Ouvrage",
        h("kbd", { class: "rc" }, "Alt+T")
      ),
      h(
        "button",
        {
          class: "btn",
          "data-rc": "n",
          title: "Raccourci : Alt+N",
          onclick: () => inserer({ type: "ligne", designation: "", unite: defUnite, quantite: 1, prix_unitaire: 0, tva: defTva() }, true),
        },
        "+ Ligne libre",
        h("kbd", { class: "rc" }, "Alt+N")
      ),
      h(
        "button",
        { class: "btn", "data-rc": "x", title: "Raccourci : Alt+X", onclick: e => choisirTexteEtude(e.currentTarget) },
        "+ Texte",
        h("kbd", { class: "rc" }, "Alt+X")
      ),
      h(
        "button",
        {
          class: "btn",
          "data-rc": "i",
          title: "Copier des lots, ouvrages ou lignes d'un autre devis · Raccourci : Alt+I",
          onclick: () => fenetreAutreDevis(),
        },
        "+ D'un autre devis",
        h("kbd", { class: "rc" }, "Alt+I")
      ),
      h("button", { class: "btn", title: "Liste des raccourcis clavier", onclick: () => fenetreRaccourcis() }, "⌨ Raccourcis"),
      boutonCorrecteur(),
      h(
        "label",
        { class: "champ-ligne-tva", style: "display:inline-flex;align-items:center;gap:5px;font-size:13px" },
        "TVA des ajouts :",
        choixTvaDoc
      ),
      h(
        "span",
        {
          class: "aide",
          style: "align-self:center",
          title:
            "Les ajouts se placent sous la ligne sélectionnée (dans le lot si c'est un lot). Clic droit ou touche Menu sur une ligne : toutes les actions.",
        },
        "Les ajouts se placent sous la ligne sélectionnée (dans le lot si c'est un lot). Clic droit ou touche Menu sur une ligne : toutes les actions."
      )
    )
  );

  DV.appliquerCalcul = t => {
    appliquerCalcul(t, totauxEtude);
    afficherTotaux(totauxClient, t);
    DV.majTvaReduite();
  };
  DV.recalculer = debounce(async () => {
    try {
      const t = await api("POST", "/api/calcul", {
        lignes: d.lignes,
        autoliquidation: !!d.autoliquidation,
        echeancier: d.echeancier,
        postes: d.postes || [],
      });
      DV.appliquerCalcul(t);
    } catch (e) {
      erreur(e);
    }
  }, 150);
  DV.redessiner = () => {
    normaliserNiveaux(d.lignes);
    dessinerLignes(corpsTable);
    DV.majBandeauVerrou();
    DV.recalculer();
  };

  dessinerLignes(corpsTable);
  DV.recalculer();
  // hauteur des zones de texte une fois l'onglet visible
  const ajuster = () => zClient.querySelectorAll("textarea").forEach(autoHauteur);
  new MutationObserver(() => {
    if (!zClient.classList.contains("cache")) ajuster();
  }).observe(zClient, { attributes: true, attributeFilter: ["class"] });
  setTimeout(ajuster);
  // annuler / rétablir (Ctrl+Z / Ctrl+Y), en haut à côté de « Toutes les lignes »
  const histo = h(
    "span",
    { class: "boutons-histo" },
    h(
      "button",
      { class: "btn icone-histo", "data-histo": "annuler", title: "Annuler la dernière action · Ctrl+Z", onclick: () => annulerEtude() },
      "↶"
    ),
    h("button", { class: "btn icone-histo", "data-histo": "retablir", title: "Rétablir · Ctrl+Y", onclick: () => retablirEtude() }, "↷")
  );
  // champs à remplir mis en évidence (Paramètres) : au départ, puis à chaque modification
  DV.majARemplir = () => majARemplir(d, zClient);
  setTimeout(DV.majARemplir);
  return { client: zClient, etude: zEtude, barre, histo };
}

/* ---------- échéancier ---------- */
function dessinerEcheancier(zone, cible, quandChange) {
  // cible : l'objet qui porte l'échéancier (le devis en cours, ou un modèle de conclusion)
  const d = cible || DV.courant;
  if (!Array.isArray(d.echeancier)) d.echeancier = [];
  zone.innerHTML = "";
  const acomptes = d.echeancier.filter(e => !e.solde);
  let solde = d.echeancier.find(e => e.solde);
  const maj =
    quandChange ||
    (() => {
      modifie();
      DV.recalculer();
    });
  acomptes.forEach(e => {
    const pct = h("input", { type: "text", class: "nombre", inputmode: "decimal", value: versChamp(e.pct), style: "width:64px" });
    pct.addEventListener("input", () => {
      e.pct = nombre(pct.value);
      maj();
    });
    const lib = h("input", { type: "text", value: e.libelle || "", placeholder: "ex. avant le début des travaux" });
    lib.addEventListener("input", () => {
      e.libelle = lib.value;
      maj();
    });
    zone.append(
      h(
        "div",
        { class: "ech-ligne" },
        h("span", {}, "Acompte de"),
        pct,
        h("span", {}, "%"),
        lib,
        h(
          "button",
          {
            class: "icone danger",
            title: "Retirer cet acompte",
            onclick: () => {
              d.echeancier.splice(d.echeancier.indexOf(e), 1);
              if (!d.echeancier.some(x => !x.solde)) d.echeancier = [];
              dessinerEcheancier(zone, cible, quandChange);
              maj();
            },
          },
          "✕"
        )
      )
    );
  });
  if (acomptes.length) {
    if (!solde) {
      solde = { solde: true, libelle: "à la réception" };
      d.echeancier.push(solde);
    }
    const lib = h("input", { type: "text", value: solde.libelle || "" });
    lib.addEventListener("input", () => {
      solde.libelle = lib.value;
      maj();
    });
    zone.append(h("div", { class: "ech-ligne" }, h("span", {}, "Solde"), lib));
  } else {
    zone.append(h("p", { class: "aide", style: "margin:4px 0" }, "Pas d'acompte : paiement en une fois."));
  }
  zone.append(
    h(
      "button",
      {
        class: "btn petit",
        onclick: () => {
          const s = d.echeancier.filter(x => x.solde);
          const a = d.echeancier.filter(x => !x.solde);
          a.push({ pct: 30, libelle: a.length ? "au cours des travaux" : "avant le début des travaux" });
          d.echeancier = a.concat(s.length ? s : [{ solde: true, libelle: "à la réception" }]);
          dessinerEcheancier(zone, cible, quandChange);
          maj();
        },
      },
      "+ Acompte"
    )
  );
}

/* ---------- application des calculs du serveur ---------- */
function appliquerCalcul(t, zoneTotaux) {
  const d = DV.courant;
  (DV.refs || []).forEach((r, i) => {
    if (!r || !d.lignes[i]) return;
    const l = d.lignes[i];
    if (r.num) {
      r.num.textContent = t.numeros[i] || "";
      r.num.classList.toggle("long", (t.numeros[i] || "").split(".").length > 3);
    }
    if (l.type === "tache" && !l.prix_impose && t.prix_lignes[i] !== undefined && document.activeElement !== r.pu) {
      l.prix_unitaire = t.prix_lignes[i];
      if (r.pu) r.pu.value = versChamp(l.prix_unitaire, 2);
    }
    if (r.tot) {
      if (l.type === "lot") {
        const q = (t.quantites_lots || {})[i] ?? 1;
        r.tot.textContent = q === 0 ? "non compté" : t.totaux_lots[i] ? euros(t.totaux_lots[i]) : "";
        if (r.puLot) r.puLot.textContent = q !== 1 && t.totaux_lots_unitaires ? euros(t.totaux_lots_unitaires[i]) : "";
      } else if (CHIFFRES.includes(l.type)) r.tot.textContent = euros(totalLigne(l));
    }
    if (r.tr) r.tr.classList.toggle("est-option", !!t.options[i]);
  });
  afficherTotauxLigne(zoneTotaux, t);
  majColonnesCalculees();
}

/** étude : les totaux sur une seule ligne (le détail est dans l'onglet Client et conclusion) */
function afficherTotauxLigne(zone, t) {
  // en haut de l'étude, à droite de la recherche : juste le total HT (net) et le TTC
  zone.innerHTML = "";
  const bloc = (lib, val, cls) => h("span", { class: "bloc " + (cls || "") }, h("span", { class: "lib" }, lib), h("b", {}, val));
  ajouterA(zone, bloc("Total HT", euros(t.total_ht)), bloc("Total TTC", euros(t.total_ttc), "fort"));
}

function afficherTotaux(zone, t) {
  zone.innerHTML = "";
  const ligne = (a, b, cls) => zone.append(h("div", { class: "t " + (cls || "") }, h("span", {}, a), h("span", {}, b)));
  if (t.postes && t.postes.length) {
    ligne("Total HT", euros(t.total_lignes_ht));
    for (const p of t.postes)
      ligne((p.designation || "Poste") + (p.mode === "pct" ? ` (${String(p.pct).replace(".", ",")} %)` : ""), euros(p.montant), "discret");
    ligne("Total HT net", euros(t.total_ht));
  } else ligne("Total HT", euros(t.total_ht));
  for (const v of t.detail_tva) ligne(`TVA ${String(v.taux).replace(".", ",")} % sur ${euros(v.base)}`, euros(v.montant), "discret");
  ligne("Total TVA", euros(t.total_tva));
  ligne("Total TTC", euros(t.total_ttc), "fort");
  if (t.echeances && t.echeances.length) {
    zone.append(h("div", { style: "height:6px" }));
    for (const e of t.echeances) ligne(e.solde ? "Solde" : `Acompte ${String(e.pct).replace(".", ",")} %`, euros(e.montant), "discret");
  }
  if (t.total_options_ht) ligne("Options (hors total)", euros(t.total_options_ht) + " HT", "discret option-total");
}

/* ---------- postes (+/-) du pied : remises, plus-values, frais, arrondi ---------- */
function fenetrePostes(d) {
  const postes = JSON.parse(JSON.stringify(d.postes || []));
  const tvaDef = () => {
    // TVA la plus présente dans le devis
    const bases = {};
    d.lignes
      .filter(l => CHIFFRES.includes(l.type))
      .forEach(l => {
        bases[l.tva] = (bases[l.tva] || 0) + totalLigne(l);
      });
    const k = Object.keys(bases).sort((a, b) => bases[b] - bases[a])[0];
    return k !== undefined ? nombre(k) : ((PARAMS.devis && PARAMS.devis.tva_defaut) ?? 20);
  };
  const corps = h("tbody");
  const resume = h("div", { class: "totaux", style: "min-width:300px" });
  let dernier = null;
  const calculer = debounce(async () => {
    try {
      dernier = await api("POST", "/api/calcul", {
        lignes: d.lignes,
        autoliquidation: !!d.autoliquidation,
        echeancier: d.echeancier,
        postes,
      });
      afficherTotaux(resume, dernier);
      // montant calculé des postes en %
      corps.querySelectorAll("tr[data-k]").forEach(tr => {
        const p = postes[tr.dataset.k],
          c = (dernier.postes || []).find((x, i) => i === Number(tr.dataset.k));
        if (p && (p.mode === "pct" || p.prorata || p.plafond) && c) tr.querySelector(".montant").value = versChamp(c.montant, 2);
      });
    } catch (e) {
      erreur(e);
    }
  }, 200);
  const dessiner = () => {
    corps.innerHTML = "";
    postes.forEach((p, k) => {
      const des = h("input", { type: "text", value: p.designation || "", placeholder: "ex. Remise commerciale, Frais de déplacement…" });
      des.addEventListener("input", () => {
        p.designation = des.value;
      });
      // situation : remise du devis ou acompte déduit au prorata de l'avancement (montant calculé)
      const auProrata = !!(p.prorata || p.plafond);
      const mode = h("select", { disabled: auProrata }, h("option", { value: "montant" }, "Montant"), h("option", { value: "pct" }, "%"));
      mode.value = p.mode === "pct" ? "pct" : "montant";
      const montant = h("input", {
        type: "text",
        class: "nombre montant",
        inputmode: "decimal",
        value: versChamp(p.montant || 0, 2),
        disabled: p.mode === "pct" || auProrata,
        title: p.plafond
          ? "Acompte déduit en entier, dans la limite de ce que facture cette situation"
          : auProrata
            ? "Calculé au prorata de l'avancement des travaux"
            : "",
      });
      const pct = h("input", {
        type: "text",
        class: "nombre",
        inputmode: "decimal",
        value: versChamp(p.pct || 0, 2),
        disabled: p.mode !== "pct",
      });
      mode.addEventListener("change", () => {
        p.mode = mode.value;
        dessiner();
        calculer();
      });
      montant.addEventListener("input", () => {
        p.montant = nombre(montant.value);
        p.arrondi = false;
        calculer();
      });
      pct.addEventListener("input", () => {
        p.pct = nombre(pct.value);
        calculer();
      });
      const tva = h(
        "select",
        {},
        tauxAvec(p.tva ?? 20).map(t => h("option", { value: t }, "TVA " + String(t).replace(".", ",") + " %"))
      );
      tva.value = p.tva ?? 20;
      tva.addEventListener("change", () => {
        p.tva = nombre(tva.value);
        calculer();
      });
      corps.append(
        h(
          "tr",
          { "data-k": k },
          h("td", {}, des),
          h("td", { style: "width:100px" }, mode),
          h("td", { style: "width:120px" }, montant),
          h("td", { style: "width:90px" }, pct),
          h("td", { style: "width:130px" }, tva),
          h(
            "td",
            { class: "act" },
            h(
              "button",
              {
                class: "icone danger",
                title: "Supprimer",
                onclick: () => {
                  postes.splice(k, 1);
                  dessiner();
                  calculer();
                },
              },
              "✕"
            )
          )
        )
      );
    });
    if (!postes.length)
      corps.append(
        h(
          "tr",
          {},
          h(
            "td",
            { colspan: 6, class: "sous", style: "padding:10px" },
            "Aucun poste. Un montant négatif est une remise (ex. -50), positif une plus-value ou des frais."
          )
        )
      );
  };
  // arrondir le total HT ou TTC : un poste « Arrondi » fait l'écart
  const arrondir = async () => {
    if (!dernier) return;
    const cible = h("input", { type: "text", class: "nombre", inputmode: "decimal", style: "width:140px" });
    const choix = h("select", {}, h("option", { value: "ttc" }, "Total TTC"), h("option", { value: "ht" }, "Total HT"));
    const sansArrondi = postes.filter(p => !p.arrondi);
    const base = await api("POST", "/api/calcul", {
      lignes: d.lignes,
      autoliquidation: !!d.autoliquidation,
      echeancier: d.echeancier,
      postes: sansArrondi,
    });
    // toujours vers le bas : le client ne paie jamais plus que le calcul
    const majCible = () => {
      cible.value = versChamp(Math.floor((choix.value === "ttc" ? base.total_ttc : base.total_ht) + 1e-9), 2);
    };
    choix.addEventListener("change", majCible);
    majCible();
    ouvrirModale(
      "Arrondir le total",
      h(
        "div",
        { class: "pile" },
        h(
          "div",
          { style: "display:flex;gap:10px;align-items:center" },
          choix,
          h("span", {}, "voulu :"),
          cible,
          h("span", { class: "sous" }, `(actuellement ${euros(choix.value === "ttc" ? base.total_ttc : base.total_ht)})`)
        ),
        h(
          "p",
          { class: "aide" },
          "L'arrondi se fait toujours vers le bas (le client ne paie jamais plus que le calcul). Un poste « Arrondi » est ajouté (ou remplacé) pour faire l'écart."
        )
      ),
      [
        h("button", { class: "btn", onclick: fermerModale }, "Annuler"),
        h(
          "button",
          {
            class: "btn principal",
            onclick: async () => {
              try {
                const voulu = nombre(cible.value);
                const actuel = choix.value === "ttc" ? base.total_ttc : base.total_ht;
                if (voulu > actuel + 0.001) {
                  toast(`L'arrondi se fait vers le bas : indiquez un montant inférieur ou égal à ${euros(actuel)}`, true);
                  return;
                }
                const t = tvaDef();
                let ecart =
                  choix.value === "ht"
                    ? arrondi(voulu - base.total_ht)
                    : arrondi((voulu - base.total_ttc) / (1 + (d.autoliquidation ? 0 : t) / 100));
                // TTC : on ajuste au centime près pour tomber juste malgré l'arrondi de la TVA
                // TTC : on cherche au centime l'écart qui tombe juste ; sinon le plus proche EN DESSOUS du montant voulu
                if (choix.value === "ttc") {
                  let meilleur = null;
                  for (const essai of [ecart, ecart - 0.01, ecart + 0.01, ecart - 0.02, ecart + 0.02, ecart - 0.03]) {
                    const r = await api("POST", "/api/calcul", {
                      lignes: d.lignes,
                      autoliquidation: !!d.autoliquidation,
                      echeancier: d.echeancier,
                      postes: [...sansArrondi, { designation: "Arrondi", montant: arrondi(essai), tva: t }],
                    });
                    if (r.total_ttc <= voulu + 0.001 && (!meilleur || r.total_ttc > meilleur.ttc))
                      meilleur = { ecart: arrondi(essai), ttc: r.total_ttc };
                    if (Math.abs(r.total_ttc - voulu) < 0.005) break;
                  }
                  if (meilleur) ecart = meilleur.ecart;
                }
                if (ecart > 0) ecart = 0;
                postes.splice(0, postes.length, ...sansArrondi);
                if (ecart) postes.push({ designation: "Arrondi", mode: "montant", montant: ecart, pct: 0, tva: t, arrondi: true });
                fermerModale();
                dessiner();
                calculer();
              } catch (e) {
                erreur(e);
              }
            },
          },
          "OK"
        ),
      ]
    );
    setTimeout(() => {
      cible.focus();
      cible.select();
    }, 50);
  };
  dessiner();
  calculer();
  ouvrirModale(
    "Postes (+/-) : remises, plus-values, frais, arrondi",
    h(
      "div",
      {},
      h(
        "table",
        { class: "lignes" },
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", {}, "Désignation (imprimée sous le total HT)"),
            h("th", {}, "En"),
            h("th", {}, "Montant HT"),
            h("th", {}, "%"),
            h("th", {}, "TVA"),
            h("th")
          )
        ),
        corps
      ),
      h(
        "div",
        { style: "display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-top:10px" },
        h(
          "div",
          { style: "display:flex;gap:8px" },
          h(
            "button",
            {
              class: "btn",
              onclick: () => {
                postes.push({ designation: "", mode: "montant", montant: 0, pct: 0, tva: tvaDef() });
                dessiner();
                corps.querySelector("tr:last-child input").focus();
              },
            },
            "+ Poste"
          ),
          h("button", { class: "btn", onclick: () => arrondir().catch(erreur) }, "Arrondir…")
        ),
        resume
      )
    ),
    [
      h("button", { class: "btn", onclick: fermerModale }, "Annuler"),
      h(
        "button",
        {
          class: "btn principal",
          onclick: () => {
            d.postes = postes.filter(p => (p.designation || "").trim() || nombre(p.montant) || nombre(p.pct));
            fermerModale();
            modifie();
            DV.recalculer();
            toast(d.postes.length ? `${d.postes.length} poste(s) (+/-)` : "Aucun poste (+/-)");
          },
        },
        "OK"
      ),
    ],
    { largeur: "min(980px, 96vw)" }
  );
}

function focusLigne(tbody, i) {
  setTimeout(() => {
    const tr = tbody.querySelector(`tr[data-i="${i}"]`);
    const ta = tr && tr.querySelector(".champ-ligne, textarea");
    if (ta) {
      ta.focus({ preventScroll: true });
      montrerLigne(tr);
    }
  }, 30);
}
/** fait défiler pour voir la ligne entière, sous l'en-tête fixe et les titres des colonnes (pas cachée dessous) */
function montrerLigne(tr) {
  const fiche = tr && tr.closest(".fiche");
  if (!fiche) return;
  const zone = fiche.getBoundingClientRect();
  const entete = fiche.querySelector(".entete-fiche"),
    titres = fiche.querySelector("table.lignes.etude > thead th"); // (les titres sont fixes, pas le thead)
  const haut =
    Math.max(
      zone.top,
      entete ? entete.getBoundingClientRect().bottom : zone.top,
      titres ? titres.getBoundingClientRect().bottom : zone.top
    ) + 4;
  const bas = zone.bottom - 40; // marge en bas : Firefox ne cherche pas à redéfiler derrière (tremblement)
  const r = tr.getBoundingClientRect();
  if (r.top < haut) fiche.scrollTop -= haut - r.top;
  else if (r.bottom > bas) fiche.scrollTop += Math.min(r.bottom - bas, r.top - haut); // le haut de la ligne reste visible
}

/** Boutons G (gras) et • (puces) sous une zone de texte de désignation */
function outilsTexte(ta) {
  if (ta.basculerGras)
    return h(
      "div",
      { class: "outils-texte" },
      h(
        "button",
        {
          class: "icone",
          type: "button",
          title: "Gras (la sélection, ou la 1re ligne) · Ctrl+B",
          onmousedown: e => {
            e.preventDefault();
            ta.basculerGras();
          },
        },
        h("b", {}, "G")
      ),
      h(
        "button",
        {
          class: "icone",
          type: "button",
          title: "Liste à puces (lignes sélectionnées) · ou tapez « - » + espace en début de ligne",
          onmousedown: e => {
            e.preventDefault();
            ta.basculerPuces();
          },
        },
        "• liste"
      )
    );
  const entourer = () => {
    const d = ta.selectionStart,
      f = ta.selectionEnd;
    if (d === f) {
      // pas de sélection : toute la première ligne
      const fin = ta.value.indexOf("\n");
      const premiere = fin < 0 ? ta.value : ta.value.slice(0, fin);
      const reste = fin < 0 ? "" : ta.value.slice(fin);
      const deja = /^\*\*.*\*\*$/.test(premiere);
      ta.value = (deja ? premiere.slice(2, -2) : "**" + premiere + "**") + reste;
    } else {
      const sel = ta.value.slice(d, f);
      const deja = /^\*\*.*\*\*$/s.test(sel);
      ta.value = ta.value.slice(0, d) + (deja ? sel.slice(2, -2) : "**" + sel + "**") + ta.value.slice(f);
    }
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const puces = () => {
    const v = ta.value;
    let d = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
    let f = v.indexOf("\n", ta.selectionEnd);
    if (f < 0) f = v.length;
    const bloc = v.slice(d, f).split("\n");
    const toutes = bloc.every(l => /^\s*[-•]\s/.test(l));
    const nouveau = bloc.map(l => (toutes ? l.replace(/^\s*[-•]\s/, "") : l.trim() ? "- " + l.replace(/^\s*[-•]\s/, "") : l)).join("\n");
    ta.value = v.slice(0, d) + nouveau + v.slice(f);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return h(
    "div",
    { class: "outils-texte" },
    h(
      "button",
      {
        class: "icone",
        type: "button",
        title: "Mettre en gras (la sélection, ou la 1re ligne)",
        onmousedown: e => {
          e.preventDefault();
          entourer();
        },
      },
      h("b", {}, "G")
    ),
    h(
      "button",
      {
        class: "icone",
        type: "button",
        title: "Liste à puces (lignes sélectionnées)",
        onmousedown: e => {
          e.preventDefault();
          puces();
        },
      },
      "• liste"
    )
  );
}

/* ---------- insertion / déplacement ---------- */
function positionInsertion() {
  const d = DV.courant;
  let pos = d.lignes.length,
    niveau = 0;
  const a = DV.active;
  if (a !== null && a !== undefined && d.lignes[a]) {
    const act = d.lignes[a];
    pos = finBloc(d.lignes, a);
    niveau = act.type === "lot" ? (act.niveau || 0) + 1 : act.niveau || 0;
  } else if (d.lignes.length) {
    // par défaut : à la fin, dans le dernier lot ouvert s'il y en a un
    const der = d.lignes[d.lignes.length - 1];
    niveau = der.type === "lot" ? (der.niveau || 0) + 1 : der.niveau || 0;
  }
  return { pos, niveau: Math.min(niveau, NIVEAU_MAX) };
}
/** plusieurs lignes (copiées d'un autre devis) : leurs niveaux sont décalés pour se placer sous la ligne sélectionnée */
function insererPlusieurs(nouvelles) {
  if (!nouvelles.length) return;
  const d = DV.courant;
  if (DV.effacerFiltre) DV.effacerFiltre();
  const { pos, niveau } = positionInsertion();
  const mini = Math.min(...nouvelles.map(l => l.niveau || 0));
  nouvelles.forEach(l => {
    l.niveau = Math.min(NIVEAU_MAX, (l.niveau || 0) - mini + niveau);
  });
  d.lignes.splice(pos, 0, ...nouvelles);
  DV.active = pos;
  modifie();
  DV.redessiner();
}
function inserer(l, focus, ouvrir) {
  const d = DV.courant;
  if (DV.effacerFiltre) DV.effacerFiltre();
  const { pos, niveau } = positionInsertion();
  l.niveau = niveau;
  d.lignes.splice(pos, 0, l);
  if (ouvrir) DV.ouverts.add(l);
  DV.active = pos;
  modifie();
  DV.redessiner();
  if (focus) focusLigne(document.querySelector("table.lignes tbody"), pos);
}

function deplacerBloc(i, sens) {
  const d = DV.courant,
    L = d.lignes;
  const fin = finBloc(L, i);
  const bloc = L.slice(i, fin);
  if (sens < 0) {
    if (i === 0) return;
    L.splice(i, bloc.length);
    L.splice(i - 1, 0, ...bloc);
    DV.active = i - 1;
  } else {
    if (fin >= L.length) return;
    L.splice(i, bloc.length);
    L.splice(i + 1, 0, ...bloc);
    DV.active = i + 1;
  }
  modifie();
  DV.redessiner();
}
function decaler(i, delta) {
  const L = DV.courant.lignes;
  const fin = finBloc(L, i);
  const n0 = L[i].niveau || 0;
  if (n0 + delta < 0) return;
  if (!niveauxPermis(L.slice(i, fin), delta)) {
    toast(MSG_NIVEAUX, true);
    return;
  }
  for (let k = i; k < fin; k++) L[k].niveau = Math.max(0, Math.min(NIVEAU_MAX, (L[k].niveau || 0) + delta));
  modifie();
  DV.redessiner();
}

/** tâches dépliées / lots repliés : retenus dans chaque ligne du devis (donc à la prochaine ouverture) */
function etatAffichage(cle) {
  return {
    has: l => !!(l && l[cle]),
    add: l => {
      if (l && !l[cle]) {
        l[cle] = 1;
        modifie();
      }
    },
    delete: l => {
      if (l && l[cle]) {
        l[cle] = 0;
        modifie();
      }
    },
  };
}
DV.ouverts = etatAffichage("ouvert");
DV.lotsFermes = etatAffichage("replie");

/* ---------- colonnes de l'étude : clic droit sur les titres pour en ajouter ou en enlever ---------- */
const COLONNES_ETUDE = [
  { cle: "ref", titre: "Réf.", classe: "ref" },
  { cle: "desig", titre: "Désignation", classe: "", fixe: true },
  { cle: "u", titre: "U", classe: "u" },
  { cle: "q", titre: "Qté", classe: "q" },
  {
    cle: "mo",
    titre: "Temps MO",
    classe: "mo",
    defaut: false,
    aide: "Temps de main d'œuvre pour une unité (ouvrages) : modifiable sur la ligne quand l'ouvrage a un seul taux de main d'œuvre",
  },
  {
    cle: "mo_tot",
    titre: "Temps total",
    classe: "mo",
    defaut: false,
    aide: "Temps de main d'œuvre × quantité (et pour tout le contenu d'un lot)",
  },
  {
    cle: "mat",
    titre: "Matériel",
    classe: "pu",
    defaut: false,
    aide: "Matériel d'une unité, au prix d'achat : fournitures de la composition (ouvrages) ou prix d'achat de l'article",
  },
  {
    cle: "mat_tot",
    titre: "Total matériel",
    classe: "pu",
    defaut: false,
    aide: "Matériel × quantité, au prix d'achat (et pour tout le contenu d'un lot)",
  },
  {
    cle: "deb",
    titre: "Achat U",
    classe: "pu",
    fixe: true,
    aide: "Prix d'achat d'une unité : article ou élément de composition ; ouvrage : son déboursé (achats + main d'œuvre, sans marge)",
  },
  { cle: "coef", titre: "Coef", classe: "coefl", fixe: true, aide: "Coefficient : prix de vente ÷ prix d'achat (ouvrage : ÷ déboursé)" },
  { cle: "pu", titre: "P.U. HT", classe: "pu" },
  { cle: "tot", titre: "Total HT", classe: "tot" },
  { cle: "tva", titre: "TVA", classe: "tva" },
];
/** facture de situation : avancement saisi en quantité faite (cumulée) ou en % cumulé ; colonnes au choix (avant le total) */
const COLONNES_SITUATION = [
  {
    cle: "qf",
    titre: "Qté faite",
    classe: "av",
    aide: "Quantité réalisée à ce jour (cumulée) : la ligne est facturée pour cette part ; la situation précédente est déduite. Sur un lot : met tout son contenu au même % d'avancement.",
  },
  {
    cle: "av",
    titre: "Avanc.",
    classe: "av",
    aide: "Avancement cumulé des travaux (%) : la ligne est facturée pour cette part ; la situation précédente est déduite. Sur un lot : met tout son contenu au même %.",
  },
];
function colonnesSituation() {
  const ch = ((PARAMS.general || {}).colonnes || {}).situation;
  const v = COLONNES_SITUATION.filter(c => (Array.isArray(ch) && ch.length ? ch.includes(c.cle) : c.cle === "av"));
  return v.length ? v : [COLONNES_SITUATION[1]];
}
function colonnesEtude() {
  const ch = ((PARAMS.general || {}).colonnes || {}).etude;
  const cols = COLONNES_ETUDE.filter(c => c.fixe || (Array.isArray(ch) && ch.length ? ch.includes(c.cle) : c.defaut !== false));
  if (estSituation(DV.courant)) {
    const i = cols.findIndex(c => c.cle === "tot");
    cols.splice(i >= 0 ? i : cols.length, 0, ...colonnesSituation());
  }
  return cols;
}
function menuColonnesEtude(x, y) {
  const entrees = () => [
    { titre: "Colonnes de l'étude" },
    ...COLONNES_ETUDE.filter(c => !c.fixe).map(c => ({
      libelle: c.titre,
      coche: colonnesEtude().some(v => v.cle === c.cle),
      garder: true,
      aide: c.aide,
      action: () => {
        PARAMS.general = PARAMS.general || {};
        PARAMS.general.colonnes = PARAMS.general.colonnes || {};
        const v = colonnesEtude()
          .map(k => k.cle)
          .filter(k => k !== "desig" && k !== "av" && k !== "qf");
        const i = v.indexOf(c.cle);
        if (i >= 0) v.splice(i, 1);
        else v.push(c.cle);
        PARAMS.general.colonnes.etude = v.length ? v : ["tot"];
        enregistrerColonnes();
        if (DV.dessinerEntete) DV.dessinerEntete();
        DV.redessiner();
      },
    })),
    ...(estSituation(DV.courant)
      ? [
          "-",
          { titre: "Situation : avancement saisi en" },
          ...COLONNES_SITUATION.map(c => ({
            libelle: c.cle === "qf" ? "Quantité faite" : "Pourcentage (%)",
            coche: colonnesSituation().some(v => v.cle === c.cle),
            garder: true,
            aide: c.aide,
            action: () => {
              PARAMS.general = PARAMS.general || {};
              PARAMS.general.colonnes = PARAMS.general.colonnes || {};
              const v = colonnesSituation().map(k => k.cle);
              const i = v.indexOf(c.cle);
              if (i >= 0) v.splice(i, 1);
              else v.push(c.cle);
              PARAMS.general.colonnes.situation = v.length ? v : [c.cle === "av" ? "qf" : "av"]; // (au moins une des deux)
              enregistrerColonnes();
              if (DV.dessinerEntete) DV.dessinerEntete();
              DV.redessiner();
            },
          })),
        ]
      : []),
    "-",
    {
      libelle: "Colonnes par défaut",
      action: () => {
        if (PARAMS.general && PARAMS.general.colonnes) delete PARAMS.general.colonnes.etude;
        enregistrerColonnes();
        if (DV.dessinerEntete) DV.dessinerEntete();
        DV.redessiner();
      },
    },
  ];
  ouvrirMenuContextuel(x, y, entrees);
}

/* ---------- recherche dans l'étude (désignations, références, fournitures des compositions) ---------- */
function texteBrut(t) {
  return String(t || "").replace(/\*\*|\[(centre|droite)\]|\[\/?(u|i|grand|petit|couleur|taille)(=[^\]]*)?\]/gi, "");
}
/** null = pas de recherche ; sinon { lignes: Set des indices visibles, trouvees: Set, elements: Map indice -> Set des éléments trouvés } */
function filtreEtude(lignes, q) {
  const mots = sansAccents(q).toLowerCase().split(/\s+/).filter(Boolean);
  if (!mots.length) return null;
  const correspond = t => {
    const s = sansAccents(t).toLowerCase();
    return mots.every(m => s.includes(m));
  };
  const visibles = new Set(),
    trouvees = new Set(),
    elements = new Map();
  const pile = []; // lots englobants
  lignes.forEach((l, i) => {
    while (pile.length && (lignes[pile[pile.length - 1]].niveau || 0) >= (l.niveau || 0)) pile.pop();
    const lotTrouve = pile.some(p => trouvees.has(p) && lignes[p].type === "lot");
    let ok = correspond(texteBrut(l.designation) + " " + (l.ref || ""));
    if (l.type === "tache") {
      const el = new Set();
      (l.composition || []).forEach((e, k) => {
        if (correspond((e.ref || "") + " " + (e.designation || ""))) el.add(k);
      });
      if (el.size) {
        elements.set(i, el);
        ok = true;
      }
    }
    if (ok) {
      trouvees.add(i);
      visibles.add(i);
      pile.forEach(p => visibles.add(p));
    } else if (lotTrouve) visibles.add(i); // contenu d'un lot dont le titre correspond
    if (l.type === "lot") pile.push(i);
  });
  return { lignes: visibles, trouvees, elements };
}

/* ---------- verrou des prix (devis accepté) ---------- */
const VERROUILLABLES = ["lot", "tache", "ligne"];
function estVerrouillee(l) {
  return !!(l && l.verrouille && VERROUILLABLES.includes(l.type));
}
function verrouillerLigne(l, oui) {
  if (!VERROUILLABLES.includes(l.type)) return;
  l.verrouille = oui ? 1 : 0;
  if (oui && l.type === "tache") l.prix_impose = 1; // le prix de vente ne suit plus la composition
}
function avertirVerrou() {
  toast("Ligne verrouillée (devis accepté) : cliquez sur son cadenas 🔒 pour la modifier", true);
}
/** copie de lignes (dupliquer, autre devis) : rien de verrouillé, compositions fermées */
function copierLignes(lignes) {
  return JSON.parse(JSON.stringify(lignes)).map(l => {
    delete l.id;
    l.verrouille = 0;
    l.ouvert = 0;
    return l;
  });
}

/** cumul d'une valeur par unité (heures, matériel) : × quantité pour une ligne, tout le contenu pour un lot (lots imbriqués comptés) */
function cumulLigne(lignes, i, parUnite) {
  const l = lignes[i];
  if (l.type !== "lot") {
    const u = parUnite(l);
    return u ? u * qteEffective(l) : 0;
  }
  let tot = 0;
  const fin = finBloc(lignes, i),
    n = l.niveau || 0;
  for (let j = i + 1; j < fin; ) {
    if ((lignes[j].niveau || 0) === n + 1) {
      tot += cumulLigne(lignes, j, parUnite);
      j = finBloc(lignes, j);
    } else j++;
  }
  const q = l.quantite === null || l.quantite === undefined || l.quantite === "" ? 1 : nombre(l.quantite);
  return tot * q;
}
const heuresLigne = (lignes, i) => cumulLigne(lignes, i, l => (l.type === "tache" ? prixComposition(l.composition).heures : 0));
/** matériel d'une unité au prix d'achat : fournitures de la composition, ou prix d'achat d'un article (null = pas de matériel) */
function materielLigne(l) {
  if (l.type === "tache") {
    const f = (l.composition || []).filter(e => e.type === "fourniture");
    return f.length ? arrondi(f.reduce((t, e) => t + nombre(e.quantite) * nombre(e.prix_achat), 0)) : null;
  }
  if (l.type === "ligne" && l.prix_achat !== null && l.prix_achat !== undefined && l.prix_achat !== "") return nombre(l.prix_achat);
  return null;
}
const materielTotal = (lignes, i) => cumulLigne(lignes, i, l => materielLigne(l) || 0);
function deboursLigne(l) {
  if (l.type === "tache") return prixComposition(l.composition).debourse;
  if (l.type === "ligne" && l.prix_achat !== null && l.prix_achat !== undefined && l.prix_achat !== "") return nombre(l.prix_achat);
  return null;
}
/** temps de main d'œuvre saisi sur la ligne de la tâche : un seul taux, sinon on passe par la composition */
function elementsMO(l) {
  return (l.composition || []).filter(e => e.type === "main_oeuvre");
}
function changerTempsMO(l, v) {
  l.composition = l.composition || [];
  let mo = elementsMO(l);
  if (!mo.length) {
    const code = (PARAMS.catalogue && PARAMS.catalogue.code_mo_defaut) || (tauxMO()[0] && tauxMO()[0].code) || "";
    l.composition.unshift({
      type: "main_oeuvre",
      code_mo: code,
      ref: code,
      designation: "Main d'œuvre",
      unite: "h",
      quantite: 0,
      prix_achat: tauxDe(code),
      prix_vente: tauxDe(code),
    });
    mo = elementsMO(l);
  }
  mo[0].quantite = v;
}

/* ---------- facture de situation : % d'avancement ---------- */
/** % d'avancement cumulé d'une ligne : entre celui de la situation précédente et 100 */
function bornerAvancement(l, v) {
  return Math.min(100, Math.max(nombre(l.avancement_prec), v));
}
function champAvancement(l, apres) {
  const prec = nombre(l.avancement_prec);
  const i = h("input", {
    type: "text",
    class: "nombre",
    inputmode: "decimal",
    value: versChamp(arrondiAv(l.avancement)),
    title: prec ? `Avancement cumulé (%) · situation précédente : ${versChamp(prec)} %` : "Avancement cumulé des travaux (%)",
  });
  i.addEventListener("input", () => {
    l.avancement = bornerAvancement(l, nombre(i.value));
    apres();
    modifie();
    DV.recalculer();
  });
  i.addEventListener("blur", () => {
    i.value = versChamp(arrondiAv(l.avancement));
  });
  const el = h(
    "span",
    { class: "avancement" },
    i,
    h("span", { class: "pct" }, "%"),
    prec ? h("span", { class: "prec", title: "Situation précédente" }, versChamp(prec) + " %") : null
  );
  el.maj = () => {
    if (document.activeElement !== i) i.value = versChamp(arrondiAv(l.avancement));
  };
  return el;
}
const arrondiAv = v => Math.round(nombre(v) * 100) / 100;
/** quantité faite (cumulée) : saisie en quantité, enregistrée en % de la quantité de la ligne */
function champQteFaite(l, apres) {
  const q = nombre(l.quantite);
  const qte = () => Math.round(((q * nombre(l.avancement)) / 100) * 10000) / 10000;
  const qPrec = Math.round(((q * nombre(l.avancement_prec)) / 100) * 10000) / 10000;
  const i = h("input", {
    type: "text",
    class: "nombre",
    inputmode: "decimal",
    value: versChamp(qte()),
    disabled: !q,
    title:
      `Quantité réalisée à ce jour, sur ${versChamp(q)} ${l.unite || ""}` + (qPrec ? ` · situation précédente : ${versChamp(qPrec)}` : ""),
  });
  i.addEventListener("input", () => {
    if (!q) return;
    l.avancement = bornerAvancement(l, (nombre(i.value) / q) * 100);
    apres();
    modifie();
    DV.recalculer();
  });
  i.addEventListener("blur", () => {
    i.value = versChamp(qte());
  });
  const el = h(
    "span",
    { class: "avancement" },
    i,
    h("span", { class: "pct" }, "/ " + versChamp(q)),
    qPrec ? h("span", { class: "prec qte", title: "Situation précédente" }, versChamp(qPrec)) : null
  );
  el.maj = () => {
    if (document.activeElement !== i) i.value = versChamp(qte());
  };
  return el;
}
/** sur un lot : tout son contenu au même % */
function champAvancementLot(d, i) {
  const contenu = () => d.lignes.slice(i + 1, finBloc(d.lignes, i)).filter(x => CHIFFRES.includes(x.type));
  const vals = [...new Set(contenu().map(x => nombre(x.avancement)))];
  const c = h("input", {
    type: "text",
    class: "nombre",
    inputmode: "decimal",
    value: vals.length === 1 ? versChamp(vals[0]) : "",
    placeholder: vals.length > 1 ? "…" : "",
    title: "Mettre tout le contenu du lot à ce % d'avancement",
  });
  c.addEventListener("change", () => {
    if (c.value.trim() === "") return;
    contenu().forEach(x => {
      x.avancement = bornerAvancement(x, nombre(c.value));
    });
    modifie();
    DV.redessiner();
  });
  return h("span", { class: "avancement" }, c, h("span", { class: "pct" }, "%"));
}

/* ---------- un lot du devis vers le catalogue (Catalogue > Lots) ---------- */
async function fenetreLotVersCatalogue(d, i) {
  const lot = d.lignes[i],
    n0 = (lot.niveau || 0) + 1;
  const contenu = copierLignes(d.lignes.slice(i + 1, finBloc(d.lignes, i))).map(l =>
    Object.assign(l, { niveau: Math.max(0, (l.niveau || 0) - n0), avancement: null, avancement_prec: null })
  );
  if (!contenu.length) {
    toast("Ce lot est vide : ajoutez-y des lignes avant de l'enregistrer dans le catalogue", true);
    return;
  }
  const titre = h("input", {
    type: "text",
    value: texteBrut(lot.designation || "")
      .split("\n")[0]
      .trim(),
  });
  const ref = h("input", { type: "text", placeholder: "ex. L-TAB" });
  const famille = h("input", { type: "text", placeholder: "facultatif" });
  const existants = await api("GET", "/api/lots");
  const pareil = () => existants.find(x => x.designation.trim().toLowerCase() === titre.value.trim().toLowerCase());
  const info = h("p", { class: "aide" });
  const majInfo = () => {
    const p = pareil();
    info.textContent = p
      ? `Un lot « ${p.designation} » existe déjà dans le catalogue : il sera remplacé par celui-ci.`
      : `${contenu.filter(l => CHIFFRES.includes(l.type)).length} ligne(s) chiffrée(s) seront enregistrées avec leurs prix ; à l'insertion, les articles et ouvrages du catalogue prendront leur prix du jour.`;
  };
  titre.addEventListener("input", majInfo);
  majInfo();
  ouvrirModale(
    "Enregistrer le lot dans le catalogue",
    h(
      "div",
      {},
      h(
        "div",
        { class: "grille" },
        h("label", { class: "champ large" }, h("span", {}, "Titre du lot"), titre),
        h("label", { class: "champ" }, h("span", {}, "Référence"), ref),
        h("label", { class: "champ double" }, h("span", {}, "Famille"), famille)
      ),
      info
    ),
    [
      h("button", { class: "btn", onclick: fermerModale }, "Annuler"),
      h(
        "button",
        {
          class: "btn principal",
          onclick: async () => {
            try {
              const p = pareil();
              const corps = {
                designation: titre.value.trim(),
                ref: ref.value.trim() || (p ? p.ref : ""),
                famille: famille.value.trim() || (p ? p.famille : ""),
                quantite: 1,
                lignes: contenu,
              };
              await api(p ? "PUT" : "POST", "/api/lots" + (p ? "/" + p.id : ""), corps);
              fermerModale();
              toast(`Lot « ${corps.designation} » enregistré dans le catalogue (Catalogue > Lots)`);
            } catch (e) {
              erreur(e);
            }
          },
        },
        "Enregistrer"
      ),
    ],
    { largeur: "min(620px, 94vw)" }
  );
}

/* ---------- lignes ---------- */
function dessinerLignes(tbody) {
  const d = DV.courant;
  tbody.innerHTML = "";
  DV.tbody = tbody;
  DV.refs = [];
  const cols = colonnesEtude();
  const filtre = filtreEtude(d.lignes, DV.filtre || "");
  if (DV.majFiltre) DV.majFiltre(filtre);
  const accepte = d.statut === "accepte";
  let cacheJusqua = -1; // lignes d'un lot replié
  /** cellules dans l'ordre des colonnes affichées ; « etendre » : la désignation s'étale sur les colonnes vides qui la suivent (lots, textes) */
  const rangee = (cellules, etendre) => {
    cols.forEach(c => {
      if (cellules[c.cle]) cellules[c.cle].dataset.col = c.cle;
    });
    if (!etendre) return cols.map(c => cellules[c.cle] || h("td", { class: c.classe }));
    // lot, texte : la désignation s'étale jusqu'à la première colonne qui a quelque chose (Réf. comprise)
    const iDesig = cols.findIndex(c => c.cle === "desig");
    let stop = cols.length;
    for (let k = iDesig + 1; k < cols.length; k++)
      if (cellules[cols[k].cle]) {
        stop = k;
        break;
      }
    cellules.desig.colSpan = stop;
    return [cellules.desig, ...cols.slice(stop).map(c => cellules[c.cle] || h("td", { class: c.classe }))];
  };
  d.lignes.forEach((l, i) => {
    const refs = {};
    DV.refs[i] = refs;
    if (filtre) {
      if (!filtre.lignes.has(i)) return;
    } else {
      if (i < cacheJusqua) return;
      if (l.type === "lot" && DV.lotsFermes.has(l)) cacheJusqua = finBloc(d.lignes, i);
    }
    const verrou = estVerrouillee(l);
    const retrait = "padding-left:" + (6 + (l.niveau || 0) * 24) + "px";
    const ta = champLigne({ lot: "Titre du lot", tache: "Désignation de l'ouvrage", texte: "Texte (sans prix)" }[l.type] || "Désignation");
    ta.value = l.designation || "";
    ta.addEventListener("input", () => {
      l.designation = ta.value;
      modifie();
    });

    const optionBtn =
      l.type === "texte"
        ? null
        : h(
            "button",
            {
              class: "icone opt" + (l.option ? " actif" : ""),
              "data-rc": "o",
              title:
                (l.option
                  ? "En option : cliquer pour l'inclure dans le total (option acceptée)"
                  : "Mettre en option (prix affiché, hors total)") + " · Alt+O",
              onclick: () => {
                if (verrou) return avertirVerrou();
                l.option = l.option ? 0 : 1;
                modifie();
                DV.redessiner();
              },
            },
            "opt"
          );
    // cadenas du devis accepté : montré sur les lignes verrouillées, ou sur toutes une fois le devis accepté
    const boutonVerrou =
      VERROUILLABLES.includes(l.type) && (verrou || accepte)
        ? h(
            "button",
            {
              class: "icone verrou" + (verrou ? " actif" : ""),
              "data-rc": "v",
              title: verrou
                ? "Prix verrouillés (devis accepté) : quantité, prix de vente et TVA ne changent pas (la composition reste modifiable pour le bilan). Cliquer pour déverrouiller cette ligne."
                : "Ligne modifiable. Cliquer pour la verrouiller (prix figés comme le reste du devis accepté).",
              onclick: () => {
                if (
                  verrou &&
                  !confirm(
                    "Déverrouiller cette ligne ?\n\nSes prix pourront de nouveau être modifiés : pensez à la facture si elle est déjà faite."
                  )
                )
                  return;
                verrouillerLigne(l, !verrou);
                modifie();
                DV.redessiner();
              },
            },
            verrou ? "🔒" : "🔓"
          )
        : null;
    const actions = h(
      "td",
      { class: "act" },
      boutonVerrou,
      optionBtn,
      h(
        "button",
        {
          class: "icone",
          "data-rc": "vers",
          title:
            "Déplacer… : puis cliquer l'endroit où le mettre dans l'étude (un lot part avec son contenu ; « + suivante » pour emporter aussi les lignes d'après)",
          onclick: () => deplacerVers(i),
        },
        "⇅"
      ),
      h("button", { class: "icone", "data-rc": "haut", title: "Monter · Alt+Maj+↑", onclick: () => deplacerBloc(i, -1) }, "↑"),
      h("button", { class: "icone", "data-rc": "bas", title: "Descendre · Alt+Maj+↓", onclick: () => deplacerBloc(i, 1) }, "↓"),
      h(
        "button",
        { class: "icone", "data-rc": "gauche", title: "Sortir du lot (vers la gauche) · Alt+Maj+←", onclick: () => decaler(i, -1) },
        "←"
      ),
      h(
        "button",
        {
          class: "icone",
          "data-rc": "droite",
          title: "Mettre dans le lot au-dessus (vers la droite) · Alt+Maj+→",
          onclick: () => decaler(i, 1),
        },
        "→"
      ),
      h(
        "button",
        {
          class: "icone",
          "data-rc": "d",
          title: "Dupliquer · Alt+D",
          onclick: () => {
            const fin = finBloc(d.lignes, i);
            d.lignes.splice(fin, 0, ...copierLignes(d.lignes.slice(i, fin)));
            modifie();
            DV.redessiner();
          },
        },
        "⧉"
      ),
      h(
        "button",
        {
          class: "icone danger",
          "data-rc": "suppr",
          title: "Supprimer · Alt+Suppr",
          onclick: () => {
            const fin = finBloc(d.lignes, i);
            if (d.lignes.slice(i, fin).some(estVerrouillee)) return avertirVerrou();
            if (fin - i > 1 && !confirm("Supprimer ce lot et tout son contenu ?")) return;
            d.lignes.splice(i, fin - i);
            DV.active = null;
            modifie();
            DV.redessiner();
          },
        },
        "✕"
      )
    );

    const numTexte = h("span", { class: "n" });
    const num = h("td", { class: "num" }, numTexte);
    refs.num = numTexte;
    const marquerActive = () => {
      DV.active = i;
      tbody.querySelectorAll("tr.active").forEach(x => x.classList.remove("active"));
      tbody.querySelectorAll(`tr[data-i="${i}"]`).forEach(x => x.classList.add("active"));
    };
    const classesTr =
      (filtre && filtre.trouvees.has(i) ? " trouve" : "") + (verrou ? " verrouillee" : "") + (DV.active === i ? " active" : "");

    if (l.type === "lot" || l.type === "texte") {
      const tot = h("td", { class: "tot" });
      refs.tot = l.type === "lot" ? tot : null;
      let infoFerme = null;
      if (l.type === "lot" && !filtre) {
        const ferme = DV.lotsFermes.has(l);
        num.prepend(
          h(
            "button",
            {
              class: "icone deplie",
              title: ferme ? "Ouvrir le lot" : "Replier le lot",
              onclick: () => {
                if (DV.lotsFermes.has(l)) DV.lotsFermes.delete(l);
                else DV.lotsFermes.add(l);
                dessinerLignes(tbody);
                DV.recalculer();
              },
            },
            ferme ? "▸" : "▾"
          )
        );
        if (ferme) infoFerme = h("div", { class: "resume-tache" }, `lot replié · ${finBloc(d.lignes, i) - i - 1} ligne(s)`);
      }
      const coul =
        l.type === "lot"
          ? ((PARAMS.devis && PARAMS.devis.couleurs_lots) || [])[l.niveau || 0] ||
            COULEURS_LOTS_DEF[Math.min(l.niveau || 0, NIVEAU_MAX_LOT)]
          : "";
      const cellules = {
        desig: h(
          "td",
          { style: retrait, class: "desig niv-" + (l.niveau || 0) },
          ta,
          l.type === "texte" ? outilsTexte(ta) : null,
          l.option && l.type === "lot" ? h("span", { class: "badge-option" }, "option") : null,
          infoFerme
        ),
      };
      if (l.type === "lot") {
        // quantité du lot (ex. 3 logements identiques) : son contenu est compté autant de fois
        const qteLot = () => (l.quantite === null || l.quantite === undefined || l.quantite === "" ? 1 : nombre(l.quantite));
        const q = h("input", {
          type: "text",
          class: "nombre",
          inputmode: "decimal",
          value: versChamp(qteLot()),
          disabled: verrou,
          title: verrou
            ? "Verrouillé (devis accepté)"
            : "Quantité du lot : tout son contenu est multiplié (ex. 3 logements identiques) ; 0 = lot non compté",
        });
        q.addEventListener("input", () => {
          l.quantite = q.value.trim() === "" ? 1 : Math.max(0, nombre(q.value));
          modifie();
          DV.recalculer();
        });
        q.addEventListener("blur", () => {
          q.value = versChamp(qteLot());
        });
        cellules.q = h("td", { class: "q" }, q);
        cellules.pu = refs.puLot = h("td", { class: "pu pu-lot", title: "Montant pour une unité du lot" });
        cellules.tot = tot;
        cellules.mo_tot = refs.moTot = h("td", { class: "mo calcule" });
        cellules.mat_tot = refs.matTot = h("td", { class: "pu calcule" });
        cellules.tva = h("td", { class: "tva" });
        if (estSituation(d)) {
          cellules.av = h("td", { class: "av" }, champAvancementLot(d, i));
          cellules.qf = h("td", { class: "av" }, champAvancementLot(d, i));
        }
      }
      // lot : l'enregistrer dans le catalogue (lot tout fait, à réutiliser dans d'autres devis)
      if (l.type === "lot")
        actions.insertBefore(
          h(
            "button",
            {
              class: "icone",
              "data-rc": "cat",
              title: "Enregistrer ce lot et ses lignes dans le catalogue (Catalogue > Lots), pour le réutiliser dans d'autres devis",
              onclick: () => fenetreLotVersCatalogue(d, i),
            },
            "⤓"
          ),
          actions.querySelector('[data-rc="haut"]')
        );
      const tr = h(
        "tr",
        {
          class: l.type + (DV.lotsFermes.has(l) && !filtre ? " replie" : "") + classesTr,
          "data-i": i,
          onfocusin: marquerActive,
          onmousedown: marquerActive,
          style: coul ? "--couleur-lot:" + coul : "",
        },
        num,
        rangee(cellules, true),
        actions
      );
      refs.tr = tr;
      tbody.append(tr);
      return;
    }

    const tot = h("td", { class: "tot" }, euros(totalLigne(l)));
    refs.tot = tot;
    const num_ = (cle, classe, decimales, surSaisie) => {
      const i2 = h("input", { type: "text", class: "nombre", inputmode: "decimal", value: versChamp(l[cle], decimales), disabled: verrou });
      i2.addEventListener("input", () => {
        l[cle] = nombre(i2.value);
        if (surSaisie) surSaisie();
        tot.textContent = euros(totalLigne(l));
        modifie();
        DV.recalculer();
      });
      i2.addEventListener("blur", () => {
        i2.value = versChamp(l[cle], decimales);
      });
      return { td: h("td", { class: classe }, i2), input: i2 };
    };
    const champRef = h("input", { type: "text", class: "ref", value: l.ref || "", placeholder: l.type === "tache" ? "Réf." : "" });
    champRef.addEventListener("input", () => {
      l.ref = champRef.value;
      modifie();
    });
    // (unités proposées en tapant : notre liste plutôt que celle du navigateur, qui gardait une marge à droite)
    const unite = h("input", { type: "text", value: l.unite || "", disabled: verrou, autocomplete: "off" });
    unite.addEventListener("input", () => {
      l.unite = unite.value;
      modifie();
    });
    autoComplete(
      unite,
      async q =>
        UNITES_COURANTES.filter(u => q && u.toLowerCase().startsWith(q.toLowerCase()) && u !== q).map(u => ({ libelle: u, valeur: u })),
      u => {
        unite.value = l.unite = u;
        modifie();
      },
      { largeurMin: 90, surFocus: false }
    );
    // un taux hors liste (ex. 5 % repris de Batifree) reste affiché tel quel, pour ne pas le changer sans le voir
    const tauxListe = TAUX_TVA.includes(nombre(l.tva)) ? TAUX_TVA : [...TAUX_TVA, nombre(l.tva)];
    const tva = h(
      "select",
      {
        class: TAUX_TVA.includes(nombre(l.tva)) ? "" : "tva-inhabituelle",
        title: TAUX_TVA.includes(nombre(l.tva)) ? "" : "Taux inhabituel (repris tel quel)",
        disabled: verrou,
      },
      tauxListe.map(t => h("option", { value: t, selected: nombre(l.tva) === t }, String(t).replace(".", ",") + " %"))
    );
    tva.addEventListener("change", () => {
      l.tva = nombre(tva.value);
      modifie();
      DV.recalculer();
    });
    const q = num_("quantite", "q");
    const pu = num_(
      "prix_unitaire",
      "pu",
      2,
      l.type === "tache"
        ? () => {
            l.prix_impose = 1;
            majImpose();
          }
        : null
    );
    refs.pu = pu.input;

    let zoneComp = null,
      majImpose = () => {};
    if (l.type === "ligne" && l.article_id)
      actions.insertBefore(
        h(
          "button",
          {
            class: "icone",
            "data-rc": "fiche",
            title: "Ouvrir la fiche de l'article dans le catalogue",
            onclick: () =>
              fenetreArticle(l.article_id, a => {
                if (estVerrouillee(l)) {
                  toast("Article enregistré. La ligne du devis est verrouillée : ses prix ne changent pas.");
                  return;
                }
                if (
                  !confirm(
                    `Article ${a.ref} enregistré dans le catalogue.\n\nReprendre sa désignation, son unité et ses prix dans cette ligne du devis ?`
                  )
                )
                  return;
                Object.assign(l, {
                  ref: a.ref,
                  designation: a.designation,
                  unite: a.unite,
                  prix_unitaire: a.prix_vente,
                  prix_achat: a.prix_achat,
                });
                modifie();
                DV.redessiner();
              }),
          },
          "✎"
        ),
        actions.lastElementChild
      );
    const outils = outilsTexte(ta);
    const desig = h("td", { style: retrait, class: "desig niv-" + (l.niveau || 0) }, ta, outils);
    const placerCatalogue = b => ajouterA(outils, h("span", { class: "sep-outils" }), b);
    let achatCoefArticle = null;
    if (l.type === "ligne" && !l.article_id) {
      // ligne libre : l'envoyer au catalogue comme article (ce qui est déjà rempli est repris)
      placerCatalogue(
        h(
          "button",
          {
            class: "icone",
            type: "button",
            "data-rc": "cat",
            title: "Créer un article du catalogue avec cette ligne (référence, désignation, unité, prix)",
            onclick: () =>
              fenetreVersArticle(
                {
                  ref: l.ref,
                  designation: l.designation,
                  unite: l.unite,
                  prix_achat: l.prix_achat,
                  prix_vente: l.prix_unitaire,
                  tva: l.tva,
                  fournisseur: l.fournisseur,
                },
                a => {
                  Object.assign(l, { article_id: a.id, ref: a.ref, prix_achat: a.prix_achat, fournisseur: a.fournisseur });
                  modifie();
                  DV.redessiner();
                }
              ),
          },
          "⤓ catalogue"
        )
      );
      outils.classList.add("avec-resume");
    }
    if (l.type === "ligne" && (l.article_id || (l.prix_achat !== null && l.prix_achat !== undefined && l.prix_achat !== ""))) {
      // article : prix d'achat x coef de marge = prix de vente ; 🔒 pour que la marge générale n'y touche pas
      const achat = h("input", {
        type: "text",
        class: "nombre mini achat-ligne",
        inputmode: "decimal",
        value: versChamp(l.prix_achat || 0, 2),
        title: "Prix d'achat HT",
        disabled: verrou && !DV.factureEmise,
      });
      const coef = h("input", {
        type: "text",
        class: "nombre mini",
        inputmode: "decimal",
        title: "Coefficient de marge : vente = achat × coef",
        disabled: verrou,
      });
      const majCoef = () => {
        const pa = nombre(l.prix_achat);
        coef.value = pa > 0 ? versChamp(Math.round((nombre(l.prix_unitaire) / pa) * 1000) / 1000) : "";
      };
      majCoef();
      const majPu = () => {
        pu.input.value = versChamp(l.prix_unitaire, 2);
        tot.textContent = euros(totalLigne(l));
        modifie();
        DV.recalculer();
      };
      achat.addEventListener("input", () => {
        const k = nombre(coef.value);
        l.prix_achat = nombre(achat.value);
        // (facture validée : le prix de vente ne change pas, seul le prix d'achat est corrigé pour l'analyse)
        if (!l.prix_impose && !DV.factureEmise && k > 0) {
          l.prix_unitaire = arrondi(l.prix_achat * k);
          majPu();
        } else {
          majCoef();
          modifie();
        }
      });
      coef.addEventListener("input", () => {
        const k = nombre(coef.value);
        if (k > 0) {
          l.prix_unitaire = arrondi(nombre(l.prix_achat) * k);
          majPu();
        }
      });
      coef.addEventListener("blur", majCoef);
      pu.input.addEventListener("input", majCoef);
      const cadenasL = h("button", { class: "icone cadenas", disabled: verrou });
      const majCadenas = () => {
        cadenasL.textContent = l.prix_impose ? "🔒 prix figé" : "🔓";
        cadenasL.title = l.prix_impose
          ? "Prix figé : la marge appliquée à toutes les lignes ne le change pas, ni un nouveau prix d'achat. Cliquer pour libérer."
          : "Cliquer pour figer le prix de vente de cette ligne";
        cadenasL.classList.toggle("actif", !!l.prix_impose);
      };
      cadenasL.addEventListener("click", () => {
        l.prix_impose = l.prix_impose ? 0 : 1;
        majCadenas();
        modifie();
      });
      majCadenas();
      const majFicheL = l.article_id ? boutonMajArticle(l) : null;
      if (majFicheL) refs.majFiche = majFicheL;
      // (achat et coef : dans les colonnes Achat U et Coef de l'étude ; le cadenas reste sous la désignation)
      achatCoefArticle = { achat, coef };
      ajouterA(outils, h("span", { class: "sep-outils" }), cadenasL, majFicheL);
      outils.classList.add("avec-resume");
    }
    const cellules = {
      ref: h("td", { class: "ref" }, champRef),
      desig,
      u: h("td", { class: "u" }, unite),
      q: q.td,
      pu: pu.td,
      tot,
      tva: h("td", { class: "tva" }, tva),
    };
    if (estSituation(d)) {
      // % et quantité faite : l'un met l'autre à jour
      const champs = {};
      const apres = src => {
        tot.textContent = euros(totalLigne(l));
        Object.entries(champs).forEach(([k, f]) => {
          if (k !== src) f.maj();
        });
      };
      champs.av = champAvancement(l, () => apres("av"));
      champs.qf = champQteFaite(l, () => apres("qf"));
      cellules.av = h("td", { class: "av" }, champs.av);
      cellules.qf = h("td", { class: "av" }, champs.qf);
    }
    // colonnes en plus (clic droit sur les titres)
    cellules.deb = refs.deb = h("td", { class: "pu calcule" });
    cellules.mat = refs.mat = h("td", { class: "pu calcule" });
    cellules.mat_tot = refs.matTot = h("td", { class: "pu calcule" });
    cellules.coef = refs.coef = h("td", { class: "coefl calcule" });
    if (achatCoefArticle) {
      // article : prix d'achat et coefficient se tapent dans leurs colonnes
      cellules.deb = h("td", { class: "pu" }, achatCoefArticle.achat);
      cellules.coef = h("td", { class: "coefl coef-article" }, achatCoefArticle.coef);
      refs.deb = refs.coef = null;
    }
    if (l.type === "tache") {
      cellules.mo_tot = refs.moTot = h("td", { class: "mo calcule" });
      const plusieurs = elementsMO(l).length > 1;
      if (plusieurs)
        cellules.mo = refs.moTxt = h("td", {
          class: "mo calcule",
          title: "Plusieurs taux de main d'œuvre : à modifier dans la composition",
        });
      else {
        const champMO = champHeures(
          prixComposition(l.composition).heures,
          v => {
            changerTempsMO(l, v);
            majImpose();
            modifie();
            DV.recalculer();
            if (DV.ouverts.has(l)) {
              const z = tbody.querySelector(`tr.composition[data-i="${i}"]`);
              if (z && z.majDepuisLigne) z.majDepuisLigne();
            }
          },
          { class: "heures nombre" }
        );
        refs.mo = champMO;
        cellules.mo = h("td", { class: "mo" }, champMO);
      }
    }
    if (l.type === "tache") {
      const ouvert = DV.ouverts.has(l) || !!(filtre && filtre.elements.has(i));
      const resume = h("span", { class: "resume-tache" });
      // prix figé : le prix de vente ne bouge plus quand on change la composition (ex. prix d'achat
      // corrigé après une demande de prix) ; seul le bilan de rentabilité change
      const cadenas = h("button", {
        class: "icone cadenas",
        disabled: verrou,
        onclick: () => {
          l.prix_impose = l.prix_impose ? 0 : 1;
          modifie();
          majImpose();
          DV.recalculer();
        },
      });
      const versCatalogue = h(
        "button",
        {
          class: "icone",
          "data-rc": "cat",
          title: l.ouvrage_id
            ? "Enregistrer cet ouvrage dans le catalogue (nouvel ouvrage, ou mise à jour de l'ouvrage d'origine)"
            : "Enregistrer cet ouvrage comme ouvrage du catalogue",
          onclick: () => fenetreTacheVersCatalogue(l),
        },
        "⤓ catalogue"
      );
      const ficheOuvrage = l.ouvrage_id
        ? h(
            "button",
            {
              class: "icone",
              "data-rc": "fiche",
              title: "Ouvrir la fiche de l'ouvrage dans le catalogue",
              onclick: () =>
                fenetreOuvrage(
                  l.ouvrage_id,
                  o => {
                    if (estVerrouillee(l)) {
                      toast("Ouvrage enregistré. L'ouvrage du devis est verrouillé : elle ne change pas.");
                      return;
                    }
                    if (
                      !confirm(
                        `Ouvrage ${o.ref} enregistré dans le catalogue.\n\nReprendre aussi ces modifications dans cet ouvrage du devis ?\n(Sinon l'ouvrage garde sa désignation, sa composition et son prix actuels.)`
                      )
                    )
                      return;
                    Object.assign(l, {
                      ref: o.ref,
                      designation: "**" + o.designation + "**" + (o.description ? "\n" + o.description : ""),
                      unite: o.unite,
                      tva: o.tva,
                      composition: JSON.parse(JSON.stringify(o.composition || [])),
                      prix_impose: o.prix_force !== null && o.prix_force !== undefined ? 1 : 0,
                      prix_unitaire: o.prix,
                    });
                    modifie();
                    DV.redessiner();
                  },
                  { titre: o => `Ouvrage ${o.ref} du catalogue`, message: "Ouvrage enregistré dans le catalogue" }
                ),
            },
            "✎"
          )
        : null;
      majImpose = () => {
        const p = prixComposition(l.composition);
        resume.textContent = `${(l.composition || []).length} élément(s) · ${formatHeures(p.heures)} · déboursé ${euros(p.debourse)}`;
        cadenas.textContent = l.prix_impose ? "🔒 prix figé" : "🔓 prix calculé";
        cadenas.title = verrou
          ? "Devis accepté : prix verrouillé"
          : l.prix_impose
            ? "Prix de vente figé : il ne change pas si vous modifiez la composition. Cliquer pour revenir au prix calculé."
            : "Le prix de vente suit la composition. Cliquer pour le figer (ex. avant de corriger un prix d'achat).";
        cadenas.classList.toggle("actif", !!l.prix_impose);
        pu.input.classList.toggle("impose", !!l.prix_impose);
        if (refs.mo && document.activeElement !== refs.mo) refs.mo.value = formatHeures(p.heures);
      };
      if (!filtre || !filtre.elements.has(i))
        num.prepend(
          h(
            "button",
            {
              class: "icone deplie",
              title: ouvert ? "Replier la composition" : "Voir et modifier la composition (main d'œuvre, fournitures)",
              onclick: () => {
                if (DV.ouverts.has(l)) DV.ouverts.delete(l);
                else DV.ouverts.add(l);
                DV.redessiner();
              },
            },
            ouvert ? "▾" : "▸"
          )
        );
      // sur la même ligne que G / • liste, séparé par un trait, pour gagner de la place
      ajouterA(outils, h("span", { class: "sep-outils" }), resume, cadenas, versCatalogue);
      outils.classList.add("avec-resume");
      if (ficheOuvrage) actions.insertBefore(ficheOuvrage, actions.lastElementChild);
      majImpose();
      if (ouvert)
        zoneComp = editeurComposition(
          l,
          () => {
            majImpose();
            modifie();
            DV.recalculer();
          },
          { verrou: false, trouves: filtre ? filtre.elements.get(i) || new Set() : null, colonnes: cols.map(c => c.cle) }
        );
    }
    const tr = h(
      "tr",
      {
        class: l.type + (l.type === "ligne" && l.article_id ? " fourni" : "") + classesTr,
        "data-i": i,
        onfocusin: marquerActive,
        onmousedown: marquerActive,
      },
      num,
      rangee(cellules, false),
      actions
    );
    if (refs.majFiche) refs.majFiche.ecouter(tr);
    refs.tr = tr;
    tbody.append(tr);
    if (zoneComp) {
      // (la composition s'étend sur toutes les colonnes : ses éléments sont alignés sur celles de l'étude)
      const trc = h("tr", { class: "composition", "data-i": i }, h("td", { colspan: cols.length + 2, class: "comp-cellule" }, zoneComp));
      trc.majDepuisLigne = zoneComp.majDepuisLigne;
      tbody.append(trc);
    }
  });
  if (!d.lignes.length) {
    tbody.append(
      h(
        "tr",
        {},
        h(
          "td",
          { colspan: cols.length + 2, style: "text-align:center;color:var(--discret);padding:18px" },
          "Aucune ligne. Ajoutez un ouvrage ou un article du catalogue, un lot, un ouvrage vide ou une ligne libre."
        )
      )
    );
  } else if (filtre && !filtre.lignes.size) {
    tbody.append(
      h(
        "tr",
        {},
        h(
          "td",
          { colspan: cols.length + 2, style: "text-align:center;color:var(--discret);padding:18px" },
          `Aucune ligne ne contient « ${DV.filtre} ».`
        )
      )
    );
  }
  if (!$("#unites"))
    document.body.append(
      h(
        "datalist",
        { id: "unites" },
        ["FF", "U", "ml", "m²", "h", "Ens", "Forfait"].map(u => h("option", { value: u }))
      )
    );
  majColonnesCalculees();
  if (DV.factureEmise) restreindreEtude(tbody);
  alignerCompositions();
  const t = tbody.closest("table");
  if (t && !t.observeur && window.ResizeObserver) {
    // (largeur d'une colonne changée, fenêtre redimensionnée : les compositions suivent)
    t.observeur = new ResizeObserver(() => alignerCompositions());
    t.observeur.observe(t);
  }
}
/** compositions ouvertes : leurs colonnes prennent exactement les largeurs de celles de l'étude */
function alignerCompositions() {
  const t = DV.tbody && DV.tbody.closest("table");
  if (!t) return;
  const ths = [...t.querySelectorAll("thead tr:first-child > th")];
  if (!ths.length) return;
  const larg = ths.map(th => th.getBoundingClientRect().width);
  t.querySelectorAll("table.lignes.comp").forEach(tc => {
    let cg = tc.querySelector(":scope > colgroup");
    if (!cg) {
      cg = h("colgroup");
      tc.prepend(cg);
    }
    if (cg.children.length !== larg.length) {
      cg.innerHTML = "";
      larg.forEach(() => cg.append(h("col")));
    }
    [...cg.children].forEach((c, k) => {
      c.style.width = larg[k] + "px";
    });
    tc.style.width = larg.reduce((a, b) => a + b, 0) + "px";
  });
}
/** unités proposées dans l'étude */
const UNITES_COURANTES = ["FF", "U", "ml", "m", "m²", "m³", "h", "Ens", "Forfait", "kg", "lot", "jour"];
/** type d'un élément de composition : icône et nom */
const TYPES_ELEMENT = {
  main_oeuvre: ["✋", "Main d'œuvre"],
  fourniture: ["📦", "Fourniture"],
  autre: ["⋯", "Autre / sous-traitance"],
};
/** facture émise : dans l'étude, seule la composition des tâches (achats) reste modifiable */
function restreindreEtude(tbody) {
  // (pas les rangées du tableau de la composition, qui est lui-même dans une rangée tr.composition)
  [...tbody.children]
    .filter(tr => !tr.classList.contains("composition"))
    .forEach(tr => {
      // (sauf le prix d'achat d'un article : matériel réellement payé)
      tr.querySelectorAll("input, select, textarea").forEach(e => {
        e.disabled = !e.classList.contains("achat-ligne");
      });
      tr.querySelectorAll("[contenteditable]").forEach(e => e.setAttribute("contenteditable", "false"));
      tr.querySelectorAll("button").forEach(b => {
        if (!b.classList.contains("deplie")) b.style.display = "none";
      });
    });
}

/** colonnes calculées (temps, déboursé, coef) : mises à jour à chaque calcul */
function majColonnesCalculees() {
  const d = DV.courant;
  if (!d || !DV.refs) return;
  DV.refs.forEach((r, i) => {
    const l = d.lignes[i];
    if (!r || !l) return;
    if (r.moTot) {
      const hrs = heuresLigne(d.lignes, i);
      r.moTot.textContent = hrs ? formatHeures(hrs) : "";
    }
    if (r.moTxt) r.moTxt.textContent = formatHeures(prixComposition(l.composition).heures);
    if (r.mo && document.activeElement !== r.mo) r.mo.value = formatHeures(prixComposition(l.composition).heures);
    if (r.deb) {
      const db = deboursLigne(l);
      r.deb.textContent = db === null ? "" : euros(db);
    }
    if (r.mat) {
      const m = materielLigne(l);
      r.mat.textContent = m === null ? "" : euros(m);
    }
    if (r.matTot) {
      const m = materielTotal(d.lignes, i);
      r.matTot.textContent = m ? euros(m) : "";
    }
    if (r.coef) {
      const db = deboursLigne(l);
      r.coef.textContent = db > 0 ? versChamp(Math.round((nombre(l.prix_unitaire) / db) * 100) / 100) : "";
    }
  });
}

/* ---------- menu « Toutes les lignes » : actions groupées ---------- */
function menuDeroulant(bouton, elements) {
  const menu = h("div", { class: "menu-deroulant cache" });
  const fermer = () => menu.classList.add("cache");
  document.addEventListener("mousedown", e => {
    if (!menu.contains(e.target) && e.target !== bouton) fermer();
  });
  bouton.addEventListener("click", () => {
    menu.innerHTML = "";
    for (const el of elements()) {
      if (el === "-") {
        menu.append(h("div", { class: "sep" }));
        continue;
      }
      if (el.titre) {
        menu.append(h("div", { class: "titre" }, el.titre));
        continue;
      }
      menu.append(
        h(
          "button",
          {
            type: "button",
            onclick: () => {
              fermer();
              el.action();
            },
          },
          el.libelle
        )
      );
    }
    menu.classList.toggle("cache");
  });
  return h("span", { class: "boite-menu" }, bouton, menu);
}
function boutonActionsLignes() {
  const d = () => DV.courant;
  const chiffrees = () => d().lignes.filter(l => CHIFFRES.includes(l.type) && !estVerrouillee(l));
  const nbVerrou = () => d().lignes.filter(estVerrouillee).length;
  const sauf = () => (nbVerrou() ? ` (les ${nbVerrou()} ligne(s) verrouillée(s) 🔒 ne changent pas)` : "");
  const apres = () => {
    modifie();
    DV.redessiner();
  };
  return menuDeroulant(
    h("button", { class: "btn", type: "button", title: "Actions sur toutes les lignes du devis" }, "Toutes les lignes ▾"),
    () => [
      ...(estSituation(d())
        ? [
            { titre: "Situation" },
            {
              libelle: "Avancement de toutes les lignes…",
              action: () => {
                const v = prompt(
                  "Avancement cumulé des travaux pour toutes les lignes (%) :\n(une ligne ne descend pas sous le % de la situation précédente)",
                  ""
                );
                if (v === null || !v.trim()) return;
                chiffrees().forEach(l => {
                  l.avancement = bornerAvancement(l, nombre(v));
                });
                apres();
                toast(`Avancement à ${versChamp(Math.min(100, nombre(v)))} % sur toutes les lignes`);
              },
            },
            "-",
          ]
        : []),
      { titre: "TVA de toutes les lignes" },
      ...TAUX_TVA.map(t => ({
        libelle: "Passer toutes les lignes à " + String(t).replace(".", ",") + " %",
        action: () => {
          const n = chiffrees().length;
          if (!confirm(`Mettre les ${n} ligne(s) chiffrée(s) à ${String(t).replace(".", ",")} % de TVA ?${sauf()}`)) return;
          chiffrees().forEach(l => {
            l.tva = t;
          });
          apres();
          toast(`TVA à ${String(t).replace(".", ",")} % sur ${n} ligne(s)`);
        },
      })),
      "-",
      { titre: "Prix de vente" },
      {
        libelle: "Marge fourniture sur toutes les lignes…",
        action: () => {
          const def = (PARAMS.catalogue && PARAMS.catalogue.coef_marge_defaut) || 1.3;
          const v = prompt(
            "Coefficient de marge sur le matériel (vente = achat × coef).\nLes lignes et ouvrages au prix figé (🔒) ne changent pas.",
            versChamp(def)
          );
          if (v === null) return;
          const k = nombre(v);
          if (!(k > 0)) {
            toast("Coefficient invalide", true);
            return;
          }
          const r = appliquerMargeFourniture(d(), k);
          apres();
          toast(
            `Marge × ${versChamp(k)} appliquée à ${r.n} fourniture(s)` + (r.figees ? ` · ${r.figees} élément(s) figé(s) inchangé(s)` : "")
          );
        },
      },
      {
        libelle: "🔒 Figer tous les prix de vente",
        action: () => {
          const t = d().lignes.filter(l => l.type === "tache" && !estVerrouillee(l));
          t.forEach(l => {
            l.prix_impose = 1;
          });
          apres();
          toast(`${t.length} ouvrage(s) figé(s) : vous pouvez corriger les prix d'achat sans changer le devis`);
        },
      },
      {
        libelle: "🔓 Revenir aux prix calculés",
        action: () => {
          if (
            !confirm(
              "Recalculer le prix de vente de tous les ouvrages depuis leur composition ? Les prix que vous avez imposés seront perdus." +
                sauf()
            )
          )
            return;
          d()
            .lignes.filter(l => l.type === "tache" && !estVerrouillee(l))
            .forEach(l => {
              l.prix_impose = 0;
            });
          apres();
        },
      },
      "-",
      { titre: "Verrou (devis accepté)" },
      {
        libelle: "🔒 Verrouiller toutes les lignes",
        action: () => {
          d().lignes.forEach(l => verrouillerLigne(l, true));
          apres();
          toast("Lignes verrouillées : quantités, prix de vente et TVA ne changent plus");
        },
      },
      {
        libelle: "🔓 Déverrouiller toutes les lignes",
        action: () => {
          if (!nbVerrou()) {
            toast("Aucune ligne verrouillée");
            return;
          }
          if (
            !confirm(
              `Déverrouiller les ${nbVerrou()} ligne(s) ?\n\nLeurs prix pourront de nouveau être modifiés : pensez à la facture si elle est déjà faite.`
            )
          )
            return;
          d().lignes.forEach(l => verrouillerLigne(l, false));
          apres();
        },
      },
      "-",
      { titre: "Affichage" },
      {
        libelle: "▸ Replier tous les lots",
        action: () => {
          d()
            .lignes.filter(l => l.type === "lot")
            .forEach(l => DV.lotsFermes.add(l));
          DV.redessiner();
        },
      },
      {
        libelle: "▾ Ouvrir tous les lots",
        action: () => {
          d().lignes.forEach(l => DV.lotsFermes.delete(l));
          DV.redessiner();
        },
      },
      {
        libelle: "Replier toutes les compositions",
        action: () => {
          d().lignes.forEach(l => DV.ouverts.delete(l));
          DV.redessiner();
        },
      },
    ]
  );
}

/* ---------- enregistrer une tâche du devis dans le catalogue ---------- */
async function fenetreTacheVersCatalogue(l) {
  const titre = (l.designation || "")
    .split("\n")[0]
    .replace(/\*\*|\[\/?(u|i|grand|petit)\]|\[couleur=#[0-9a-f]+\]|\[\/couleur\]|\[taille=\d+\]|\[\/taille\]/gi, "")
    .trim();
  const ref = h("input", { type: "text", value: l.ref || "" });
  const famille = h("input", { type: "text", list: "familles-ouvrage", placeholder: "ex. Électricité > Prises" });
  const motCle = h("input", { type: "text" });
  let origine = null;
  if (l.ouvrage_id) {
    try {
      origine = await api("GET", "/api/ouvrages/" + l.ouvrage_id);
    } catch (e) {
      origine = null;
    }
  }
  if (origine) {
    famille.value = origine.famille || "";
    motCle.value = origine.mot_cle || "";
  }
  if (!$("#familles-ouvrage")) {
    api("GET", "/api/familles?genre=ouvrage")
      .then(f => remplirListeFamilles(f, "ouvrage"))
      .catch(() => {});
  }
  const envoyer = async majOrigine => {
    try {
      if (!ref.value.trim()) {
        toast("Indiquez une référence", true);
        ref.focus();
        return;
      }
      const o = await api("POST", "/api/ouvrages/depuis-tache", {
        ligne: l,
        ref: ref.value.trim(),
        famille: famille.value.trim(),
        mot_cle: motCle.value.trim(),
        ouvrage_id: origine && origine.id,
        mettre_a_jour: !!majOrigine,
      });
      l.ouvrage_id = o.id;
      l.ref = o.ref;
      modifie();
      DV.redessiner();
      fermerModale();
      toast((majOrigine ? "Ouvrage mis à jour : " : "Ouvrage ajouté au catalogue : ") + o.ref);
    } catch (e) {
      erreur(e);
    }
  };
  ouvrirModale(
    "Enregistrer l'ouvrage dans le catalogue",
    h(
      "div",
      { class: "pile" },
      h("p", {}, h("b", {}, titre || "(sans titre)")),
      h(
        "div",
        { class: "grille" },
        h("label", { class: "champ" }, h("span", {}, "Référence de l'ouvrage"), ref),
        h("label", { class: "champ" }, h("span", {}, "Famille"), famille),
        h("label", { class: "champ" }, h("span", {}, "Mot-clé"), motCle)
      ),
      h(
        "p",
        { class: "aide" },
        "La désignation, le détail, l'unité, la TVA et la composition sont repris. Les fournitures liées à un article prendront le prix de leur fiche article ; les autres éléments gardent le prix de vente de l'ouvrage." +
          (l.prix_impose ? " Le prix figé est repris comme prix imposé de l'ouvrage." : "")
      ),
      origine
        ? h(
            "p",
            { class: "aide" },
            `Cet ouvrage vient de l'ouvrage ${origine.ref} : vous pouvez le mettre à jour, ou créer un nouvel ouvrage (avec une autre référence).`
          )
        : null
    ),
    [
      h("button", { class: "btn", onclick: fermerModale }, "Annuler"),
      origine
        ? h(
            "button",
            {
              class: "btn",
              onclick: () => {
                if (confirm(`Remplacer l'ouvrage ${origine.ref} du catalogue par cet ouvrage ? (Les devis déjà faits ne changent pas.)`))
                  envoyer(true);
              },
            },
            "Mettre à jour " + origine.ref
          )
        : null,
      h("button", { class: "btn principal", onclick: () => envoyer(false) }, "Créer l'ouvrage"),
    ].filter(Boolean),
    { largeur: "min(640px, 94vw)" }
  );
  if (origine && ref.value === origine.ref) ref.value = "";
  setTimeout(() => ref.focus(), 30);
}

/** coefficient de marge affiché (vente ÷ achat), ou celui de la tâche Batifree */
function coefAffiche(e) {
  if (e.fg || e.bn) return versChamp(Math.round(nombre(e.fg || 1) * nombre(e.bn || 1) * 1000) / 1000);
  const pa = nombre(e.prix_achat),
    pv = nombre(e.prix_vente);
  return pa > 0 ? versChamp(Math.round((pv / pa) * 1000) / 1000) : "";
}
/** marge fourniture appliquée à tout le devis : lignes d'articles et fournitures des tâches, sauf prix figés */
function appliquerMargeFourniture(d, coef) {
  let n = 0,
    figees = 0;
  for (const l of d.lignes) {
    if (estVerrouillee(l)) {
      figees++;
      continue;
    }
    if (l.type === "tache") {
      const four = (l.composition || []).filter(e => e.type === "fourniture");
      if (!four.length) continue;
      if (l.prix_impose) {
        figees++;
        continue;
      }
      four.forEach(e => {
        if (e.marge_figee) {
          figees++;
          return;
        }
        e.fg = e.fg || 1;
        e.bn = coef / e.fg;
        e.prix_vente = venteCoefs(e.prix_achat, e.fg, e.bn);
        n++;
      });
    } else if (l.type === "ligne" && nombre(l.prix_achat) > 0) {
      if (l.prix_impose) {
        figees++;
        continue;
      }
      l.prix_unitaire = arrondi(nombre(l.prix_achat) * coef);
      n++;
    }
  }
  return { n, figees };
}

/* ---------- composition d'une tâche ---------- */
const SOUS_OUVERTS = new Set(); // sous-ouvrages dépliés dans les compositions (le temps de la session)
function editeurComposition(l, change, opts) {
  opts = opts || {};
  l.composition = l.composition || [];
  // colonnes de l'étude (la composition s'aligne dessus) : chaque cellule a son rôle (data-role), rangé à sa colonne
  const COLS = opts.colonnes || ["ref", "desig", "u", "q", "deb", "coef", "pu", "tot"];
  const alignerRangee = tr => {
    const parRole = {};
    for (const td of [...tr.children]) parRole[td.dataset.role || ""] = td;
    tr.innerHTML = "";
    for (const role of ["num", ...COLS, "act"]) {
      const td = parRole[role] || h("td");
      td.dataset.col = role;
      tr.append(td);
    }
    return tr;
  };
  const corps = h("tbody");
  const pied = h("div", { class: "pied-comp" });
  const majPied = () => {
    const p = prixComposition(l.composition);
    pied.innerHTML = "";
    pied.append(
      h("span", {}, `Déboursé ${euros(p.debourse)}`),
      h("span", {}, `Prix de vente ${euros(p.vente)}`),
      h("span", {}, `Temps ${formatHeures(p.heures)}`)
    );
  };
  /* sous-ouvrage : ouvrage du catalogue ajouté à la composition ; ses éléments restent des éléments ordinaires (prix,
   * analyse, achats, factures inchangés) mais gardent sous_id, sous_ref, sous_designation, sous_unite, sous_quantite
   * et qte_base (quantité pour 1 unité du sous-ouvrage) : une ligne d'en-tête donne la quantité du sous-ouvrage, qui
   * recalcule tous ses éléments (ex. pose de moulure : 12 m -> moulure, pointes, colle). */
  const elementsSous = id => l.composition.filter(x => x.sous_id === id);
  /** ouvrage du catalogue (ex. pose de moulure au m) -> sous-ouvrage : ses éléments groupés sous une ligne d'en-tête */
  const ajouterSousOuvrage = o => {
    if (opts.verrou) return avertirVerrou();
    const sid = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    SOUS_OUVERTS.add(sid);
    const desig = String(o.designation || "")
      .split("\n")[0]
      .replace(/\*\*/g, "");
    for (const e of o.composition || [])
      l.composition.push(
        Object.assign(JSON.parse(JSON.stringify(e)), {
          sous_id: sid,
          sous_ref: o.ref || "",
          sous_designation: desig,
          sous_unite: o.unite || "",
          sous_quantite: 1,
          qte_base: nombre(e.quantite),
        })
      );
    ouvrageEnAttente = false;
    dessiner();
    majPied();
    change();
    // (le curseur dans sa quantité, prête à être tapée)
    const q = corps.querySelector(`input[data-sous-qte="${sid}"]`);
    if (q) {
      q.focus();
      q.select();
    }
  };
  // « + Ouvrage » : une ligne pour chercher l'ouvrage du catalogue par sa référence ou son nom (comme une fourniture)
  let ouvrageEnAttente = false;
  const ligneChercheOuvrage = () => {
    const champ = h("input", { type: "text", placeholder: "Chercher un ouvrage (réf., désignation)…", "data-cherche-ouvrage": "1" });
    const tr = h(
      "tr",
      { class: "sous-ouvrage-tete attente" },
      h("td", { colspan: 2 }, h("span", { class: "genre ouvrage" }, "Sous-ouvrage")),
      h("td", { colspan: COLS.length - 1 }, champ),
      h(
        "td",
        { class: "act" },
        h(
          "button",
          {
            class: "icone danger",
            title: "Annuler",
            onclick: () => {
              ouvrageEnAttente = false;
              dessiner();
            },
          },
          "✕"
        )
      )
    );
    autoComplete(
      champ,
      async q =>
        (await api("GET", "/api/ouvrages?q=" + encodeURIComponent(q)))
          .slice(0, 20)
          .map(o => ({ libelle: o.designation, detail: o.ref + " — " + euros(o.prix) + " / " + (o.unite || "u"), valeur: o })),
      o => ajouterSousOuvrage(o)
    );
    champ.addEventListener("keydown", ev => {
      if (ev.key === "Escape") {
        ouvrageEnAttente = false;
        dessiner();
      }
    });
    return tr;
  };
  // (replié par défaut ; ouvert juste après l'ajout, ou par ▸ sur sa ligne d'en-tête ; retenu le temps de la session)
  const sousOuvert = id => SOUS_OUVERTS.has(id);
  const enteteSous = e => {
    const id = e.sous_id;
    const q = h("input", {
      type: "text",
      class: "nombre",
      inputmode: "decimal",
      value: versChamp(e.sous_quantite),
      title: "Quantité du sous-ouvrage : toutes ses quantités suivent",
      "data-sous-qte": id,
    });
    const totalSous = () => euros(elementsSous(id).reduce((t, x) => t + centimes(nombre(x.quantite) * nombre(x.prix_vente)), 0) / 100);
    const tot = h("td", { "data-role": "tot", class: "tot" }, totalSous());
    q.addEventListener("change", () => {
      const v = nombre(q.value);
      if (!(v > 0)) {
        q.value = versChamp(e.sous_quantite);
        return toast("Une quantité plus grande que 0.", true);
      }
      for (const x of elementsSous(id)) {
        x.sous_quantite = v;
        x.quantite = Math.round(nombre(x.qte_base) * v * 10000) / 10000;
      }
      dessiner();
      majPied();
      change();
    });
    const ouvert = sousOuvert(id);
    // (par unité du sous-ouvrage : achat, coefficient moyen, vente)
    const els = elementsSous(id),
      parU = f => els.reduce((t, x) => t + nombre(x.qte_base) * nombre(x[f]), 0),
      achatU = parU("prix_achat"),
      venteU = parU("prix_vente");
    return alignerRangee(
      h(
        "tr",
        { class: "sous-ouvrage-tete" + (ouvert ? " ouvert" : "") },
        h(
          "td",
          { "data-role": "num" },
          h(
            "button",
            {
              class: "icone deplie-sous",
              title: ouvert ? "Replier le sous-ouvrage" : "Voir ses éléments",
              onclick: () => {
                if (ouvert) SOUS_OUVERTS.delete(id);
                else SOUS_OUVERTS.add(id);
                dessiner();
              },
            },
            ouvert ? "▾" : "▸"
          )
        ),
        h("td", { "data-role": "ref", class: "sous-ref" }, e.sous_ref || ""),
        h(
          "td",
          {
            "data-role": "desig",
            class: "sous-desig",
            title: els.length + " élément(s), quantités pour 1 " + (e.sous_unite || "unité"),
          },
          e.sous_designation || "",
          " ",
          h("span", { class: "genre ouvrage" }, "sous-ouvrage")
        ),
        h("td", { "data-role": "u", class: "u" }, e.sous_unite || ""),
        h("td", { "data-role": "q", class: "q" }, q),
        h("td", { "data-role": "deb", class: "pu calcule" }, euros(achatU)),
        h("td", { "data-role": "coef", class: "coef calcule" }, achatU > 0 ? versChamp(Math.round((venteU / achatU) * 100) / 100) : ""),
        h("td", { "data-role": "pu", class: "pu calcule" }, euros(venteU)),
        tot,
        h(
          "td",
          { "data-role": "act", class: "act", style: "white-space:nowrap" },
          h(
            "button",
            {
              class: "icone",
              title: "Dégrouper : ses éléments restent, comme des éléments ordinaires",
              onclick: () => {
                for (const x of elementsSous(id))
                  for (const c of ["sous_id", "sous_ref", "sous_designation", "sous_unite", "sous_quantite", "qte_base"]) delete x[c];
                dessiner();
                change();
              },
            },
            "⇲"
          ),
          h(
            "button",
            {
              class: "icone danger",
              title: "Retirer le sous-ouvrage et tous ses éléments",
              onclick: () => {
                l.composition = l.composition.filter(x => x.sous_id !== id);
                dessiner();
                majPied();
                change();
              },
            },
            "✕"
          )
        )
      )
    );
  };
  const dessiner = () => {
    corps.innerHTML = "";
    l.composition.forEach((e, k) => {
      if (e.sous_id && (k === 0 || l.composition[k - 1].sous_id !== e.sous_id)) corps.append(enteteSous(e));
      if (e.sous_id && !sousOuvert(e.sous_id) && !(opts.trouves && opts.trouves.has(k))) {
        if (corps.lastElementChild && corps.lastElementChild.classList.contains("sous-ouvrage-tete"))
          corps.lastElementChild.classList.add("fin-sous");
        return; // (sous-ouvrage replié)
      }
      const totalV = h("td", { "data-role": "tot", class: "tot" }, euros(centimes(nombre(e.quantite) * nombre(e.prix_vente)) / 100));
      const maj = () => {
        // (élément d'un sous-ouvrage : on tape sa quantité pour 1 unité du sous-ouvrage, la quantité réelle suit)
        if (e.sous_id) e.quantite = Math.round(nombre(e.qte_base) * nombre(e.sous_quantite) * 10000) / 10000;
        totalV.textContent = euros(centimes(nombre(e.quantite) * nombre(e.prix_vente)) / 100);
        majPied();
        change();
      };
      // type : une icône (✋ main d'œuvre, 📦 fourniture, ⋯ autre) ; clic : menu pour le changer
      const type = { value: e.type };
      const changerType = () => {
        e.type = type.value;
        if (e.type === "main_oeuvre") {
          e.code_mo = e.code_mo || (PARAMS.catalogue && PARAMS.catalogue.code_mo_defaut) || "";
          e.prix_achat = e.prix_vente = tauxDe(e.code_mo);
          e.unite = "h";
          e.ref = e.code_mo;
          e.designation = e.designation || "Main d'œuvre";
        }
        dessiner();
        majPied();
        change();
      };
      const boutonType = h(
        "button",
        {
          type: "button",
          class: "icone type-element",
          "data-type": e.type,
          title: (TYPES_ELEMENT[e.type] || TYPES_ELEMENT.autre)[1] + " — cliquer pour changer le type",
          onclick: ev => {
            const r = ev.currentTarget.getBoundingClientRect();
            ouvrirMenuContextuel(r.left, r.bottom + 2, [
              { titre: "Type de l'élément" },
              ...Object.entries(TYPES_ELEMENT).map(([t, [ic, lib]]) => ({
                libelle: ic + "  " + lib + (t === e.type ? "  ✓" : ""),
                action: () => {
                  if (t === e.type) return;
                  type.value = t;
                  changerType();
                },
              })),
            ]);
          },
        },
        (TYPES_ELEMENT[e.type] || TYPES_ELEMENT.autre)[0]
      );
      let refCell;
      if (e.type === "main_oeuvre") {
        const sel = h(
          "select",
          {},
          tauxMO()
            .filter(t => !t.archive || t.code === e.code_mo)
            .map(t => h("option", { value: t.code }, `${t.code} (${versChamp(t.taux, 2)} €/h)`))
        );
        sel.value = e.code_mo || "";
        sel.addEventListener("change", () => {
          e.code_mo = e.ref = sel.value;
          e.prix_achat = tauxDe(sel.value);
          e.prix_vente = e.fg ? venteCoefs(e.prix_achat, e.fg, e.bn) : e.prix_achat;
          dessiner();
          majPied();
          change();
        });
        refCell = h("td", {}, sel);
      } else {
        const ref = h("input", { type: "text", value: e.ref || "", placeholder: e.type === "fourniture" ? "Chercher…" : "" });
        ref.addEventListener("input", () => {
          e.ref = ref.value;
          change();
        });
        refCell = h("td", {}, ref);
        if (e.type === "fourniture") {
          autoComplete(
            ref,
            async q =>
              (await api("GET", "/api/articles?limite=20&q=" + encodeURIComponent(q))).articles.map(a => ({
                libelle: a.designation,
                detail: a.ref + " — achat " + euros(a.prix_achat) + " / vente " + euros(a.prix_vente),
                valeur: a,
              })),
            a => {
              Object.assign(e, {
                article_id: a.id,
                ref: a.ref,
                designation: a.designation,
                unite: a.unite,
                prix_achat: a.prix_achat,
                prix_vente: e.fg ? venteCoefs(a.prix_achat, e.fg, e.bn) : a.prix_vente,
                fournisseur: a.fournisseur,
              });
              dessiner();
              majPied();
              change();
              // (la ligne est redessinée : le curseur va dans la quantité de cet élément, prête à être tapée)
              const qte = corps.querySelector(`tr[data-k="${k}"] td[data-col="q"] input`);
              if (qte) {
                qte.focus();
                qte.select();
              }
            }
          );
        }
      }
      const txt = (cle, attrs) => {
        const i = h("input", Object.assign({ type: "text", value: e[cle] ?? "" }, attrs || {}));
        i.addEventListener("input", () => {
          e[cle] = i.value;
          change();
        });
        return i;
      };
      const champs = {};
      const nb = (cle, ro) => {
        const i = h("input", {
          type: "text",
          class: "nombre",
          inputmode: "decimal",
          value: versChamp(e[cle], cle === "quantite" || cle === "qte_base" ? undefined : 2),
          disabled: !!ro,
        });
        i.addEventListener("input", () => {
          e[cle] = nombre(i.value);
          // tâche Batifree : la vente suit le prix d'achat (coefficients de la tâche)
          if (cle === "prix_achat" && e.fg && champs.prix_vente) {
            e.prix_vente = venteCoefs(e.prix_achat, e.fg, e.bn);
            champs.prix_vente.value = versChamp(e.prix_vente, 2);
          }
          if (champs.coef && document.activeElement !== champs.coef) champs.coef.value = coefAffiche(e);
          maj();
        });
        champs[cle] = i;
        return i;
      };
      // fourniture saisie à la main : l'envoyer au catalogue comme article (ce qui est rempli est repris)
      const versArticle =
        e.type !== "main_oeuvre" && !e.article_id
          ? h(
              "button",
              {
                class: "icone",
                "data-rc": "cat",
                title: "Créer un article du catalogue avec cet élément (référence, désignation, unité, prix)",
                onclick: () =>
                  fenetreVersArticle(
                    {
                      ref: e.ref,
                      designation: e.designation,
                      unite: e.unite,
                      prix_achat: e.prix_achat,
                      prix_vente: e.prix_vente,
                      fournisseur: e.fournisseur,
                    },
                    a => {
                      Object.assign(e, { article_id: a.id, ref: a.ref, fournisseur: a.fournisseur });
                      dessiner();
                      change();
                    }
                  ),
              },
              "⤓"
            )
          : null;
      const modifierArticle =
        e.type !== "main_oeuvre" && e.article_id
          ? h(
              "button",
              {
                class: "icone",
                "data-rc": "fiche",
                title: "Ouvrir la fiche de l'article (pour la corriger)",
                onclick: () =>
                  fenetreArticle(e.article_id, a => {
                    if (opts.verrou) {
                      toast("Article enregistré. L'ouvrage est verrouillé (devis accepté) : elle ne change pas.");
                      return;
                    }
                    Object.assign(e, {
                      ref: a.ref,
                      designation: a.designation,
                      unite: a.unite,
                      prix_achat: a.prix_achat,
                      fournisseur: a.fournisseur,
                      prix_vente: e.fg ? venteCoefs(a.prix_achat, e.fg, e.bn) : a.prix_vente,
                    });
                    dessiner();
                    majPied();
                    change();
                  }),
              },
              "✎"
            )
          : null;
      const trouve = opts.trouves ? opts.trouves.has(k) : null;
      const majFiche = e.type !== "main_oeuvre" && e.article_id ? boutonMajArticle(e) : null;
      corps.append(
        h(
          "tr",
          {
            class:
              "el-" + e.type + (e.sous_id ? " dans-sous" : "") + (trouve === true ? " trouve" : trouve === false ? " hors-filtre" : ""),
            "data-k": k,
          },
          h("td", { "data-role": "num", class: "type-el" }, boutonType),
          ((refCell.dataset.role = "ref"), refCell),
          h("td", { "data-role": "desig", class: "desig-el" }, txt("designation")),
          h("td", { "data-role": "u", class: "u" }, txt("unite")),
          e.sous_id
            ? h(
                "td",
                {
                  "data-role": "q",
                  class: "q",
                  title: `Quantité pour 1 ${e.sous_unite || "unité"} du sous-ouvrage ; en tout : × ${versChamp(e.sous_quantite)}`,
                },
                e.type === "main_oeuvre"
                  ? champHeures(e.qte_base, v => {
                      e.qte_base = v;
                      maj();
                    })
                  : nb("qte_base"),
                h("small", { class: "par-unite" }, "/" + (e.sous_unite || "u"))
              )
            : h(
                "td",
                { "data-role": "q", class: "q" },
                e.type === "main_oeuvre"
                  ? champHeures(e.quantite, v => {
                      e.quantite = v;
                      maj();
                    })
                  : nb("quantite")
              ),
          h("td", { "data-role": "deb", class: "pu" }, nb("prix_achat", e.type === "main_oeuvre")),
          h(
            "td",
            { "data-role": "coef", class: "coef" },
            e.type === "main_oeuvre"
              ? null
              : (() => {
                  // coefficient de marge : vente = achat x coef (la vente suit ensuite le prix d'achat)
                  const c = h("input", {
                    type: "text",
                    class: "nombre",
                    inputmode: "decimal",
                    value: coefAffiche(e),
                    title: "Coefficient de marge : vente = achat × coef",
                  });
                  c.addEventListener("input", () => {
                    const k = nombre(c.value);
                    if (!(k > 0)) return;
                    e.fg = 1;
                    e.bn = k;
                    e.prix_vente = venteCoefs(e.prix_achat, 1, k);
                    champs.prix_vente.value = versChamp(e.prix_vente, 2);
                    maj();
                  });
                  c.addEventListener("blur", () => {
                    c.value = coefAffiche(e);
                  });
                  champs.coef = c;
                  return c;
                })()
          ),
          h("td", { "data-role": "pu", class: "pu" }, nb("prix_vente", e.type === "main_oeuvre")),
          totalV,
          ajouterA(
            h("td", { "data-role": "act", class: "act", style: "white-space:nowrap" }),
            h(
              "button",
              {
                class: "icone",
                "data-rc": "haut",
                title: "Monter · Alt+Maj+↑",
                disabled: k === 0,
                onclick: () => {
                  const c = l.composition;
                  [c[k - 1], c[k]] = [c[k], c[k - 1]];
                  dessiner();
                  change();
                },
              },
              "↑"
            ),
            h(
              "button",
              {
                class: "icone",
                "data-rc": "bas",
                title: "Descendre · Alt+Maj+↓",
                disabled: k === l.composition.length - 1,
                onclick: () => {
                  const c = l.composition;
                  [c[k + 1], c[k]] = [c[k], c[k + 1]];
                  dessiner();
                  change();
                },
              },
              "↓"
            ),
            e.type === "fourniture"
              ? h(
                  "button",
                  {
                    class: "icone cadenas" + (e.marge_figee ? " actif" : ""),
                    title: e.marge_figee
                      ? "Marge figée : « Marge fourniture sur toutes les lignes » ne la change pas. Cliquer pour libérer."
                      : "Figer la marge de cette fourniture (elle ne suivra pas la marge appliquée à toutes les lignes)",
                    onclick: () => {
                      e.marge_figee = e.marge_figee ? 0 : 1;
                      dessiner();
                      change();
                    },
                  },
                  e.marge_figee ? "🔒" : "🔓"
                )
              : null,
            majFiche,
            versArticle,
            modifierArticle,
            h(
              "button",
              {
                class: "icone danger",
                "data-rc": "suppr",
                title: "Retirer · Alt+Suppr",
                onclick: () => {
                  l.composition.splice(k, 1);
                  dessiner();
                  majPied();
                  change();
                },
              },
              "✕"
            )
          )
        )
      );
      alignerRangee(corps.lastElementChild);
      // (fin d'un sous-ouvrage : trait un peu plus marqué avant la ligne suivante)
      if (e.sous_id && (k === l.composition.length - 1 || l.composition[k + 1].sous_id !== e.sous_id))
        corps.lastElementChild.classList.add("fin-sous");
      if (majFiche) majFiche.ecouter(corps.lastElementChild);
    });
    if (ouvrageEnAttente && !opts.verrou) corps.append(ligneChercheOuvrage());
    // devis accepté : la composition se lit, mais ne se modifie plus (sauf l'ouverture des fiches)
    if (opts.verrou)
      corps.querySelectorAll("input, select, button").forEach(x => {
        if (!["fiche"].includes(x.dataset.rc)) x.disabled = true;
      });
    if (!l.composition.length && !ouvrageEnAttente)
      corps.append(
        h(
          "tr",
          {},
          h(
            "td",
            { colspan: COLS.length + 2, class: "sous", style: "padding:6px 8px" },
            "Composition vide : ajoutez la main d'œuvre et les fournitures."
          )
        )
      );
  };
  const ajout = e => {
    if (opts.verrou) return avertirVerrou();
    l.composition.push(e);
    dessiner();
    majPied();
    change();
  };
  const codeDef = (PARAMS.catalogue && PARAMS.catalogue.code_mo_defaut) || (tauxMO()[0] && tauxMO()[0].code) || "";
  dessiner();
  majPied();
  // (pas de ligne de titres : les colonnes sont celles de l'étude, juste au-dessus ; largeurs : alignerCompositions)
  const tableComp = h("table", { class: "lignes comp alignee" }, corps);
  const boite = h(
    "div",
    { class: "composition-boite" + (opts.verrou ? " verrouillee" : "") },
    tableComp,
    h(
      "div",
      { class: "ajouts" },
      h(
        "button",
        {
          class: "btn petit",
          "data-rc": "k",
          title: "Chercher des articles ou des ouvrages dans le catalogue et les ajouter à la composition · Alt+K",
          onclick: () =>
            fenetreCatalogue(
              it => {
                if (it.type === "tache") return ajouterSousOuvrage(it); // (ouvrage : sous-ouvrage)
                ajout({
                  type: "fourniture",
                  article_id: it.article_id,
                  ref: it.ref || "",
                  designation: it.designation || "",
                  unite: it.unite || uniteFourniture(),
                  quantite: 1,
                  prix_achat: it.prix_achat ?? 0,
                  prix_vente: it.prix_unitaire ?? 0,
                  fournisseur: it.fournisseur || "",
                });
              },
              "",
              null,
              { pourComposition: true }
            ),
        },
        "+ Depuis le catalogue",
        h("kbd", { class: "rc" }, "Alt+K")
      ),
      h(
        "button",
        {
          class: "btn petit",
          "data-rc": "m",
          title: "Alt+M",
          onclick: () =>
            ajout({
              type: "main_oeuvre",
              code_mo: codeDef,
              ref: codeDef,
              designation: "Main d'œuvre",
              unite: "h",
              quantite: 1,
              prix_achat: tauxDe(codeDef),
              prix_vente: tauxDe(codeDef),
            }),
        },
        "+ Main d'œuvre",
        h("kbd", { class: "rc" }, "Alt+M")
      ),
      h(
        "button",
        {
          class: "btn petit",
          "data-rc": "f",
          title: "Alt+F",
          onclick: () =>
            ajout({ type: "fourniture", ref: "", designation: "", unite: uniteFourniture(), quantite: 1, prix_achat: 0, prix_vente: 0 }),
        },
        "+ Fourniture",
        h("kbd", { class: "rc" }, "Alt+F")
      ),
      h(
        "button",
        {
          class: "btn petit",
          "data-rc": "u",
          title: "Ajouter un ouvrage du catalogue comme sous-ouvrage (ex. pose de moulure au m) · Alt+U",
          onclick: () => {
            if (opts.verrou) return avertirVerrou();
            ouvrageEnAttente = true;
            dessiner();
            const c = corps.querySelector("input[data-cherche-ouvrage]");
            if (c) c.focus();
          },
        },
        "+ Ouvrage",
        h("kbd", { class: "rc" }, "Alt+U")
      ),
      h(
        "button",
        {
          class: "btn petit",
          "data-rc": "a",
          title: "Alt+A",
          onclick: () => ajout({ type: "autre", ref: "", designation: "", unite: "", quantite: 1, prix_achat: 0, prix_vente: 0 }),
        },
        "+ Autre",
        h("kbd", { class: "rc" }, "Alt+A")
      ),
      pied,
      opts.verrou ? h("span", { class: "aide" }, "🔒 Devis accepté : composition verrouillée") : null
    )
  );
  if (opts.verrou)
    boite.querySelectorAll(".ajouts button").forEach(b => {
      b.disabled = true;
    });
  // temps de main d'œuvre changé sur la ligne de la tâche
  boite.majDepuisLigne = () => {
    dessiner();
    majPied();
  };
  return boite;
}

/* ---------- catalogue (fenêtre d'ajout) ---------- */
function fenetreCatalogue(ajouterLigne, genreInitial, ajouterLot, opts) {
  opts = opts || {}; // pourComposition : articles et ouvrages seulement (ajout à la composition d'un ouvrage)
  let genre = genreInitial || "";
  const recherche = h("input", { type: "search", placeholder: "Rechercher (référence, désignation, famille, mot-clé…)", style: "flex:1" });
  // familles en arbre : « Électricité », puis « Électricité > Prises »… (choisir un niveau montre aussi ses sous-familles)
  const choixFamille = h("select", { style: "max-width:300px" });
  const chargerFamilles = async () => {
    const garde = choixFamille.value;
    choixFamille.style.display = genre === "texte" ? "none" : ""; // (modèles de texte : pas de familles du catalogue)
    if (genre === "texte") return;
    const f = await api("GET", "/api/familles?genre=" + genre);
    const toutes = new Set();
    f.forEach(x => {
      const p = x.split(" > ");
      p.forEach((_, i) => toutes.add(p.slice(0, i + 1).join(" > ")));
    });
    choixFamille.innerHTML = "";
    ajouterA(
      choixFamille,
      h("option", { value: "" }, "Toutes les familles"),
      [...toutes]
        .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }))
        .map(x => {
          const n = x.split(" > ").length - 1;
          return h("option", { value: x }, "\u00a0\u00a0\u00a0".repeat(n) + (n ? "› " : "") + x.split(" > ").pop());
        })
    );
    choixFamille.value = toutes.has(garde) ? garde : "";
  };
  chargerFamilles().catch(() => {});
  // (lots du catalogue : seulement quand on ajoute dans un devis)
  const filtres = h(
    "div",
    { class: "sous-onglets" },
    [
      ["", "Tout"],
      ["ouvrage", "Ouvrages"],
      ["article", "Articles"],
      ...(ajouterLot
        ? [
            ["lot", "Lots"],
            ["texte", "Textes"],
          ]
        : []),
    ].map(([g, lib]) =>
      h(
        "button",
        {
          type: "button",
          class: g === genre ? "actif" : "",
          onclick: e => {
            genre = g;
            filtres.querySelectorAll("button").forEach(b => b.classList.remove("actif"));
            e.currentTarget.classList.add("actif");
            chargerFamilles().then(chercher).catch(erreur);
          },
        },
        lib
      )
    )
  );
  const res = h("tbody");
  const info = h(
    "p",
    { class: "aide" },
    opts.pourComposition
      ? "Cliquez sur un article ou un ouvrage pour l'ajouter à la composition (un ouvrage devient un sous-ouvrage : sa quantité, sur sa ligne d'en-tête, recalcule tous ses éléments). Vous pouvez en ajouter plusieurs à la suite."
      : "Cliquez sur une ligne pour l'ajouter au devis. Vous pouvez en ajouter plusieurs à la suite. ▸ : voir le détail d'un ouvrage sans l'ajouter."
  );
  const chercher = async () => {
    if (genre === "texte") {
      // modèles de texte (Catalogue > Textes) : une ligne « Texte » sans prix
      const textes = await api("GET", "/api/textes?q=" + encodeURIComponent(recherche.value.trim()));
      res.replaceChildren(
        ...textes.map(t =>
          h(
            "tr",
            {
              class: "cliquable",
              onclick: () => {
                ajouterLigne({ type: "texte", designation: t.texte || "" });
                toast("Ajouté : " + t.titre);
              },
            },
            h("td", {}, h("span", { class: "genre texte" }, "Texte")),
            h("td", {}, t.famille || ""),
            h(
              "td",
              {},
              h("b", {}, t.titre),
              h(
                "div",
                { class: "sous", style: "white-space:pre-line" },
                (t.texte || "").replace(/\*\*|\[\/?[a-z]+(=[^\]]*)?\]/gi, "").slice(0, 200)
              )
            ),
            h("td", {}),
            h("td", {})
          )
        )
      );
      if (!textes.length)
        res.append(h("tr", {}, h("td", { colspan: 5, class: "sous" }, "Aucun modèle de texte. Catalogue > Textes pour en créer.")));
      return;
    }
    const liste = (
      await api(
        "GET",
        "/api/catalogue/recherche?q=" +
          encodeURIComponent(recherche.value.trim()) +
          "&genre=" +
          genre +
          "&famille=" +
          encodeURIComponent(choixFamille.value)
      )
    ).filter(it => it.genre !== "lot" || ajouterLot);
    res.innerHTML = "";
    for (const it of liste) {
      res.append(
        h(
          "tr",
          {
            class: "cliquable",
            onclick: async () => {
              if (it.genre === "lot") {
                try {
                  ajouterLot(await api("GET", `/api/lots/${it.id}/lignes`));
                  toast("Lot ajouté : " + it.designation);
                } catch (e) {
                  erreur(e);
                }
                return;
              }
              const l =
                it.genre === "ouvrage"
                  ? {
                      type: "tache",
                      ref: it.ref,
                      designation: "**" + it.designation + "**" + (it.description ? "\n" + it.description : ""),
                      unite: it.unite,
                      quantite: 1,
                      prix_unitaire: it.prix,
                      tva: it.tva,
                      ouvrage_id: it.id,
                      composition: JSON.parse(JSON.stringify(it.composition || [])),
                      prix_impose: it.prix_impose ? 1 : 0,
                    }
                  : {
                      type: "ligne",
                      ref: it.ref,
                      designation: it.designation,
                      unite: it.unite,
                      quantite: 1,
                      prix_unitaire: it.prix,
                      tva: it.tva,
                      prix_achat: it.prix_achat,
                      article_id: it.id,
                      fournisseur: it.fournisseur,
                    };
              ajouterLigne(l);
              toast("Ajouté : " + it.designation);
            },
          },
          h(
            "td",
            {},
            h("span", { class: "genre " + it.genre }, it.genre === "ouvrage" ? "Ouvrage" : it.genre === "lot" ? "Lot" : "Article")
          ),
          h("td", {}, it.ref),
          h(
            "td",
            {},
            it.genre === "ouvrage" ? designationDepliable(it.designation, it.description) : it.designation,
            it.genre === "lot" ? h("small", { class: "sous" }, `  ${it.nb_lignes} ligne(s)`) : null,
            it.fournisseur ? h("small", { class: "sous" }, "  " + it.fournisseur) : null,
            it.famille ? h("small", { class: "sous" }, "  · " + it.famille) : null
          ),
          h("td", {}, it.unite),
          h("td", { class: "prix" }, euros(it.prix))
        )
      );
    }
    if (!liste.length) res.append(h("tr", {}, h("td", { colspan: 5, class: "sous" }, "Rien trouvé.")));
  };
  recherche.addEventListener(
    "input",
    debounce(() => chercher().catch(erreur), 200)
  );
  choixFamille.addEventListener("change", () => chercher().catch(erreur));
  ouvrirModale(
    opts.pourComposition ? "Ajouter à la composition" : genre === "ouvrage" ? "Bibliothèque d'ouvrages" : "Ajouter depuis le catalogue",
    h(
      "div",
      {},
      h("div", { style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap" }, filtres, recherche, choixFamille),
      info,
      h(
        "table",
        { class: "resultats" },
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", {}, ""),
            h("th", {}, "Réf."),
            h("th", {}, "Désignation"),
            h("th", {}, "U"),
            h("th", { class: "prix" }, "Prix HT")
          )
        ),
        res
      )
    ),
    [
      h(
        "button",
        {
          class: "btn",
          title: "Créer un article qui n'est pas encore dans le catalogue, et l'ajouter au devis",
          onclick: () =>
            fenetreVersArticle({}, a => {
              ajouterLigne(ligneDepuisArticle(a));
            }),
        },
        "+ Nouvel article…"
      ),
      h("button", { class: "btn principal", onclick: fermerModale }, "Terminé"),
    ],
    { largeur: "min(1000px, 96vw)" }
  );
  chercher().catch(erreur);
  setTimeout(() => recherche.focus(), 30);
}

/* ---------- onglets Analyse et Achats ---------- */
async function zoneAnalyse(d) {
  const a = await api("GET", `/api/documents/${d.id}/analyse`);
  const z = h("div", { class: "analyse" });
  const carte = (lib, val, sous) =>
    h(
      "div",
      { class: "carte" },
      h("div", { class: "lib-carte" }, lib),
      h("div", { class: "val" }, val),
      sous ? h("div", { class: "sous" }, sous) : null
    );
  const pct = (x, tot) => (tot ? Math.round((x / tot) * 1000) / 10 : 0);
  const pctTxt = (x, tot) => String(pct(x, tot)).replace(".", ",") + " %";
  const gauche = h("div", { class: "analyse-chiffres" });
  const sansPA = a.vente_sans_debourse || 0;
  const margeF = a.benefice; // ce qui reste du prix de vente après fournitures, main d'œuvre et autres achats
  const tva = a.tva || 0,
    ttc = a.vente_ht + tva;
  // répartition sur le prix TTC (avec la TVA) ou HT (sans) : retenu dans ce navigateur
  let enHt = false;
  try {
    enHt = localStorage.getItem("dfa_analyse_ht") === "1";
  } catch (e) {
    /* */
  }
  const dessiner = () => {
    const base = enHt ? a.vente_ht : ttc,
      du = enHt ? " du HT" : " du TTC";
    const caseHt = h("input", { type: "checkbox", checked: !enHt });
    caseHt.addEventListener("change", () => {
      enHt = !caseHt.checked;
      try {
        localStorage.setItem("dfa_analyse_ht", enHt ? "1" : "0");
      } catch (e) {
        /* */
      }
      dessinerTout();
    });
    gauche.replaceChildren(
      h(
        "div",
        { style: "display:flex;align-items:baseline;gap:14px;flex-wrap:wrap" },
        h("h3", { style: "margin-top:0" }, "Ventilation du prix de vente"),
        h(
          "label",
          { class: "case", title: "Coché : la répartition se fait sur le prix TTC (TVA comprise). Décoché : sur le prix HT, sans la TVA." },
          caseHt,
          "En TTC (avec la TVA)"
        )
      ),
      h(
        "div",
        { class: "cartes" },
        carte("Fournitures", euros(a.fourniture), "prix d'achat · " + pctTxt(a.fourniture, base) + du),
        carte(
          "Marge sur fournitures",
          euros(margeF),
          (a.fourniture
            ? "coef. " +
              String(Math.round((1 + margeF / a.fourniture) * 100) / 100).replace(".", ",") +
              " · " +
              pctTxt(margeF, a.fourniture) +
              " du prix d'achat · "
            : "") +
            pctTxt(margeF, base) +
            du
        ),
        carte(
          "Main d'œuvre",
          euros(a.main_oeuvre),
          `${formatHeures(a.heures)} · ${pctTxt(a.main_oeuvre, base)}${du}` +
            (sansPA ? ` · dont ${euros(sansPA)} de lignes sans prix d'achat` : "")
        ),
        a.autre ? carte("Autre / sous-traitance", euros(a.autre), pctTxt(a.autre, base) + du) : null,
        enHt ? null : carte("TVA", euros(tva), pctTxt(tva, ttc) + du),
        enHt
          ? carte("Prix de vente HT", euros(a.vente_ht), "TTC : " + euros(ttc))
          : carte("Prix de vente TTC", euros(ttc), "HT : " + euros(a.vente_ht))
      ),
      h("h3", {}, "Totaux"),
      h(
        "div",
        { class: "cartes" },
        carte("Heures prévues", formatHeures(a.heures)),
        carte("Coût horaire main d'œuvre", euros(a.taux_moyen) + " / h", "taux des lignes de main d'œuvre, sans la marge sur fournitures"),
        carte("Déboursé", euros(a.debourse), "fournitures + main d'œuvre" + (a.autre ? " + autres achats" : ""))
      ),
      blocRentabilite(d, a),
      h(
        "p",
        { class: "aide" },
        "Les lignes en option (proposées au client mais pas comptées dans le total du devis) ne sont pas comptées ici. Les fournitures sont comptées au prix d'achat, la main d'œuvre au taux horaire."
      )
    );
  };
  let graph = null;
  const dessinerTout = () => {
    dessiner();
    const g2 = graphiquesAnalyse(a, enHt);
    if (graph) graph.replaceWith(g2);
    graph = g2;
  };
  dessinerTout();
  z.append(gauche, graph);
  return z;
}

/** à droite de l'analyse : anneau du prix TTC et barres verticales du prix de vente (achats + marge) */
const COUL_ANALYSE = { f: "#d0654e", m: "#2d6cb5", a: "#e3a008", b: "#2e9e5b", s: "#9a6fb0", t: "#8a94a6" };
function graphiquesAnalyse(a, sansTva) {
  const ns = "http://www.w3.org/2000/svg";
  const el = (tag, attrs) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const pctTxt = (x, tot) => (tot ? (Math.round((x / tot) * 1000) / 10).toString().replace(".", ",") + " %" : "0 %");
  // anneau : de quoi est fait le prix de vente TTC
  const tva = sansTva ? 0 : a.tva || 0;
  const tout = [
    ["f", "Fournitures", a.fourniture],
    ["b", "Marge sur fournitures", a.benefice],
    ["m", "Main d'œuvre", a.main_oeuvre],
    ["a", "Autre", a.autre],
    ["t", "TVA", tva],
  ].filter(p => p[2] > 0);
  const parts = tout;
  const tot = parts.reduce((t, p) => t + p[2], 0);
  const svg = el("svg", { viewBox: "0 0 120 120", width: "140", height: "140", class: "anneau" });
  const R = 46,
    C = 2 * Math.PI * R;
  svg.append(el("circle", { cx: 60, cy: 60, r: R, fill: "none", stroke: "#eceef2", "stroke-width": 20 }));
  let deja = 0;
  for (const [k, lib, v] of parts) {
    const long = (v / tot) * C;
    const arc = el("circle", {
      cx: 60,
      cy: 60,
      r: R,
      fill: "none",
      stroke: COUL_ANALYSE[k],
      "stroke-width": 20,
      "stroke-dasharray": `${long} ${C - long}`,
      "stroke-dashoffset": -deja,
      transform: "rotate(-90 60 60)",
    });
    const t = el("title", {});
    t.textContent = `${lib} : ${euros(v)} (${pctTxt(v, tot)})`;
    arc.append(t);
    svg.append(arc);
    deja += long;
  }
  const centre = el("text", { x: 60, y: 57, "text-anchor": "middle", class: "anneau-lib" });
  centre.textContent = sansTva ? "HT" : "TTC";
  const centre2 = el("text", { x: 60, y: 72, "text-anchor": "middle", class: "anneau-val" });
  centre2.textContent = euros(a.vente_ht + tva).replace(/,\d\d/, "");
  svg.append(centre, centre2);
  const legende = h(
    "div",
    { class: "legende" },
    parts.map(([k, lib, v]) =>
      h(
        "div",
        {},
        h("span", { class: "pastille", style: "background:" + COUL_ANALYSE[k] }),
        h("span", { class: "lib" }, lib),
        h("b", {}, pctTxt(v, tot))
      )
    )
  );
  // barres verticales : de quoi est fait le prix de vente
  const barres = [
    ["f", "Fournitures", a.fourniture],
    ["b", "Marge fourn.", a.benefice],
    ["m", "Main d'œuvre", a.main_oeuvre],
  ].concat(a.autre ? [["a", "Autre", a.autre]] : []);
  const max = Math.max(1, ...barres.map(b => Math.abs(b[2] || 0)));
  const zoneBarres = h(
    "div",
    { class: "barres-v" },
    barres.map(([k, lib, v]) =>
      h(
        "div",
        { class: "col", title: `${lib} : ${euros(v || 0)} (${pctTxt(v || 0, a.vente_ht)} du prix de vente)` },
        h("div", { class: "valeur" }, euros(v || 0).replace(/,\d\d/, "")),
        h(
          "div",
          { class: "piste" },
          h("div", {
            class: "barre" + ((v || 0) < 0 ? " negatif" : ""),
            style: `height:${Math.round((Math.abs(v || 0) / max) * 100)}%;background:${(v || 0) < 0 ? "#b42318" : COUL_ANALYSE[k]}`,
          })
        ),
        h("div", { class: "lib" }, lib),
        h("div", { class: "pct" }, pctTxt(v || 0, a.vente_ht))
      )
    )
  );
  return h(
    "div",
    { class: "analyse-graphiques" },
    h(
      "div",
      { class: "carte" },
      h("div", { class: "titre-graph" }, sansTva ? "Répartition du prix de vente HT" : "Répartition du prix de vente TTC"),
      h("div", { class: "anneau-boite" }, svg, legende)
    ),
    h(
      "div",
      { class: "carte" },
      h("div", { class: "titre-graph" }, "Prix de vente HT : " + euros(a.vente_ht)),
      zoneBarres,
      h("div", { class: "sous", style: "margin-top:6px" }, "% : part du prix de vente")
    )
  );
}

/** prix d'achat d'une fourniture, corrigé pour tout le devis (lignes et compositions), sans toucher au prix de vente */
function champPrixAchat(d, m, r, totalMat) {
  const i = h("input", {
    type: "text",
    class: "nombre",
    inputmode: "decimal",
    value: versChamp(m.prix_achat, 2),
    style: "width:90px;text-align:right",
  });
  const cle = x => (x.ref || "").trim() || (x.designation || "").trim();
  const k = cle(m);
  i.addEventListener("change", async () => {
    const pa = nombre(i.value);
    let n = 0;
    for (const l of d.lignes) {
      if (l.type === "tache")
        for (const e of l.composition || []) {
          if (e.type === "fourniture" && cle(e) === k) {
            e.prix_achat = pa;
            n++;
          }
        }
      else if (
        l.type === "ligne" &&
        (l.article_id || (l.prix_achat !== null && l.prix_achat !== undefined && l.prix_achat !== "")) &&
        cle(l) === k
      ) {
        l.prix_achat = pa;
        n++;
      }
    }
    m.prix_achat = pa;
    m.total = arrondi(pa * m.quantite);
    i.closest("tr").querySelector(".total-mat").textContent = euros(m.total);
    totalMat.textContent = euros(r.materiel.reduce((s, x) => s + nombre(x.total), 0));
    i.value = versChamp(pa, 2);
    modifie();
    try {
      if (autoEnregistrement()) await enregistrerDevis();
      toast(`Prix d'achat corrigé (${n} endroit(s) du devis)`);
    } catch (e) {
      erreur(e);
    }
  });
  return i;
}

/** onglet Achats : taux horaire d'un code de main d'œuvre, changé dans les compositions de ce devis */
function champTauxMO(d, m, tot) {
  const i = h("input", {
    type: "text",
    class: "nombre",
    inputmode: "decimal",
    value: versChamp(m.taux, 2),
    style: "width:80px;text-align:right",
  });
  i.addEventListener("change", async () => {
    const t = nombre(i.value);
    let n = 0;
    for (const l of d.lignes) {
      if (l.type !== "tache") continue;
      for (const e of l.composition || []) {
        if (e.type !== "main_oeuvre" || (e.code_mo || e.ref) !== m.code) continue;
        e.prix_achat = t;
        e.prix_vente = e.fg ? venteCoefs(t, e.fg, e.bn) : t;
        n++;
      }
    }
    m.taux = t;
    m.total = arrondi(t * nombre(m.quantite));
    tot.textContent = euros(m.total);
    i.value = versChamp(t, 2);
    modifie();
    if (DV.recalculer) DV.recalculer();
    try {
      if (autoEnregistrement()) await enregistrerDevis();
      toast(`Main d'œuvre ${m.code} à ${versChamp(t, 2)} €/h (${n} endroit(s) du devis)`);
    } catch (e) {
      erreur(e);
    }
  });
  return i;
}

/** bilan de rentabilité : marge brute (vente - fournitures - autres achats) rapportée au temps passé */
function blocRentabilite(d, a) {
  const tauxReel = h("div", { class: "val" });
  const sousReel = h("div", { class: "sous" });
  // (taux horaire réel : marge brute ÷ (temps d'intervention + temps du relevé et de la réalisation du devis))
  const totalTrajets = h("div", { class: "sous" });
  const maj = () => {
    const ti = nombre(d.temps_passe),
      td = nombre(d.temps_devis),
      tt = nombre(d.trajets) * nombre(d.trajet_duree),
      t = ti + td + tt;
    totalTrajets.textContent = tt > 0 ? `= ${formatHeures(tt)} de trajets, comptés dans le taux réel` : "nombre × durée d'un aller-retour";
    tauxReel.textContent = ti > 0 ? euros(a.marge_brute / t) + " / h" : "—";
    sousReel.textContent =
      ti > 0
        ? `${euros(a.marge_brute)} ÷ ${formatHeures(t)}` +
          (td > 0 || tt > 0
            ? ` (${formatHeures(ti)} d'intervention` +
              (td > 0 ? ` + ${formatHeures(td)} de devis` : "") +
              (tt > 0 ? ` + ${formatHeures(tt)} de trajets` : "") +
              ")"
            : "") +
          (a.heures ? ` · intervention ${ti > a.heures ? "+" : ""}${formatHeures(ti - a.heures)} par rapport au prévu` : "")
        : "saisissez le temps passé";
  };
  const champDevis = champHeures(
    d.temps_devis ?? "",
    v => {
      d.temps_devis = v || null;
      modifie();
      maj();
    },
    { placeholder: "ex. 1h30", style: "width:110px;font-size:16px" }
  );
  if (d.temps_devis === null || d.temps_devis === undefined || d.temps_devis === "") champDevis.value = "";
  // (trajets : leur nombre et la durée d'un aller-retour)
  const nbTrajets = h("input", {
    type: "text",
    class: "nombre",
    inputmode: "decimal",
    value: d.trajets ? versChamp(d.trajets) : "",
    placeholder: "nb",
    title: "Nombre de trajets (allers-retours) pour ce chantier",
    style: "width:52px;font-size:16px;text-align:right",
  });
  nbTrajets.addEventListener("change", () => {
    const v = nombre(nbTrajets.value);
    d.trajets = v > 0 ? v : null;
    nbTrajets.value = v > 0 ? versChamp(v) : "";
    modifie();
    maj();
  });
  const dureeTrajet = champHeures(
    d.trajet_duree ?? "",
    v => {
      d.trajet_duree = v || null;
      modifie();
      maj();
    },
    { placeholder: "A/R ex. 0h40", style: "width:96px;font-size:16px", title: "Durée d'un aller-retour" }
  );
  if (d.trajet_duree === null || d.trajet_duree === undefined || d.trajet_duree === "") dureeTrajet.value = "";
  const champ = champHeures(
    d.temps_passe ?? "",
    v => {
      d.temps_passe = v || null;
      modifie();
      maj();
    },
    { placeholder: "ex. 12h30", style: "width:110px;font-size:16px" }
  );
  if (d.temps_passe === null || d.temps_passe === undefined || d.temps_passe === "") champ.value = "";
  maj();
  const carte = (lib, val, sous) =>
    h(
      "div",
      { class: "carte" },
      h("div", { class: "lib-carte" }, lib),
      val,
      sous ? (typeof sous === "string" ? h("div", { class: "sous" }, sous) : sous) : null
    );
  return h(
    "div",
    {},
    h("h3", {}, "Rentabilité"),
    h(
      "div",
      { class: "cartes" },
      carte(
        "Marge brute",
        h("div", { class: "val" }, euros(a.marge_brute)),
        h(
          "div",
          { class: "sous" },
          `= prix de vente ${euros(a.vente_ht)} − fournitures ${euros(a.fourniture)}` +
            (a.autre ? ` − autres achats ${euros(a.autre)}` : ""),
          h("br"),
          `soit main d'œuvre ${euros(a.main_oeuvre)} + marge sur fournitures ${euros(a.benefice)}`,
          a.vente_sans_debourse
            ? h("span", { style: "display:block" }, `(main d'œuvre dont ${euros(a.vente_sans_debourse)} de lignes sans prix d'achat)`)
            : null
        )
      ),
      carte(
        "Taux horaire prévu",
        h("div", { class: "val" }, a.heures ? euros(a.taux_horaire_prevu) + " / h" : "—"),
        a.heures ? `marge brute (marge matériel comprise) ÷ ${formatHeures(a.heures)} prévues` : "pas d'heures dans le devis"
      ),
      carte("Temps passé", h("div", {}, champ), "heures d'intervention réellement passées (1h30, 1:30…)"),
      carte("Relevé et devis", h("div", {}, champDevis), "temps du relevé et de la réalisation du devis, compté dans le taux réel"),
      carte("Trajets", h("div", { style: "display:flex;gap:6px;align-items:center" }, nbTrajets, "×", dureeTrajet), totalTrajets),
      carte("Taux horaire réel", tauxReel, sousReel)
    )
  );
}

async function zoneAchats(d) {
  const r = await api("GET", `/api/documents/${d.id}/achats`);
  const z = h("div");
  const totalMat = h("td", { class: "prix", style: "font-weight:600" }, euros(r.total_materiel));
  z.append(
    h(
      "div",
      { class: "entete-fiche" },
      h("h3", { style: "margin:0" }, "Matériel à commander"),
      h("span", { class: "espace" }),
      r.materiel.length
        ? h(
            "button",
            {
              class: "btn",
              title: "Reporter les prix d'achat de ce devis dans le catalogue (articles), ou y créer les fournitures absentes",
              onclick: async () => {
                if (await enregistrerAvant("de mettre à jour le catalogue")) fenetreAchatsVersCatalogue(d);
              },
            },
            "⤓ Mettre à jour le catalogue…"
          )
        : null,
      h("button", { class: "btn principal", onclick: () => window.open("/achats.html?id=" + d.id, "_blank") }, "Imprimer le récapitulatif")
    )
  );
  if (!r.materiel.length) z.append(h("p", { class: "sous" }, "Aucune fourniture dans ce devis (hors options)."));
  else
    z.append(
      triableParTitres(
        h(
          "table",
          { class: "resultats achats-materiel" },
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              h("th", {}, "Code"),
              h("th", {}, "Désignation"),
              h("th", {}, "U"),
              h("th", { class: "prix" }, "Prix achat U"),
              h("th", { class: "prix" }, "Qté"),
              h("th", { class: "prix" }, "Total"),
              h("th", {}, "Fournisseur")
            )
          ),
          h(
            "tbody",
            {},
            r.materiel.map(m =>
              h(
                "tr",
                {},
                h("td", {}, m.ref),
                h("td", {}, m.designation),
                h("td", {}, m.unite),
                h("td", { class: "prix" }, champPrixAchat(d, m, r, totalMat)),
                h("td", { class: "prix" }, versChamp(m.quantite)),
                h("td", { class: "prix total-mat" }, euros(m.total)),
                h("td", {}, m.fournisseur)
              )
            )
          ),
          h(
            "tfoot",
            {},
            h("tr", {}, h("td", { colspan: 5, style: "text-align:right;font-weight:600" }, "Total matériel"), totalMat, h("td"))
          )
        )
      )
    );
  if (r.materiel.length)
    z.append(
      h(
        "p",
        { class: "aide" },
        "Prix d'achat corrigeables (ex. après une demande de prix au fournisseur) : le prix de vente du devis ne change pas, seuls la marge et l'onglet Analyse sont mis à jour. Le catalogue n'est modifié qu'avec le bouton « Mettre à jour le catalogue »."
      )
    );
  if (r.autres.length) {
    z.append(
      h("h3", {}, "Autres (sous-traitance…)"),
      h(
        "table",
        { class: "resultats" },
        h(
          "tbody",
          {},
          r.autres.map(m =>
            h(
              "tr",
              {},
              h("td", {}, m.designation),
              h("td", { class: "prix" }, versChamp(m.quantite)),
              h("td", { class: "prix" }, euros(m.total))
            )
          )
        )
      )
    );
  }
  if (r.main_oeuvre.length) {
    z.append(
      h("h3", {}, "Main d'œuvre"),
      h(
        "table",
        { class: "resultats" },
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", {}, "Taux"),
            h("th", { class: "prix" }, "€ / h"),
            h("th", { class: "prix" }, "Heures"),
            h("th", { class: "prix" }, "Total")
          )
        ),
        h(
          "tbody",
          {},
          r.main_oeuvre.map(m => {
            const tot = h("td", { class: "prix" }, euros(m.total));
            return h(
              "tr",
              {},
              h("td", {}, m.code),
              h("td", { class: "prix" }, champTauxMO(d, m, tot)),
              h("td", { class: "prix" }, formatHeures(m.quantite)),
              tot
            );
          })
        )
      )
    );
    z.append(
      h(
        "p",
        { class: "aide" },
        "Taux horaire corrigeable pour ce devis seulement (le catalogue ne change pas) : le prix des ouvrages suit, sauf ceux au prix figé 🔒 ou verrouillés (devis accepté, facture validée), dont seule la marge change."
      )
    );
  }
  z.append(
    h(
      "p",
      { class: "aide" },
      "Les lignes en option (pas comptées dans le total du devis) ne sont pas comptées. Quantités = quantité de la composition × quantité de l'ouvrage."
    )
  );
  return z;
}

async function exporterPdf(id, sansPrix) {
  try {
    if (!(await enregistrerAvant("de créer le PDF"))) return;
    toast("Création du PDF…");
    toast("Choisissez où enregistrer le PDF (la fenêtre peut être derrière le navigateur)…");
    // ouvrir le PDF : tout de suite, après avoir demandé, ou pas (Paramètres > Général > PDF)
    const choix = (PARAMS.general || {}).ouvrir_pdf || "ouvrir";
    const r = await api("POST", `/api/documents/${id}/pdf`, { sans_prix: !!sansPrix, ouvrir: choix === "ouvrir" });
    if (r.annule) {
      toast("PDF annulé");
      return;
    }
    const nom = r.chemin.split(/[\\/]/).pop();
    if (r.facturx_erreur) toast("PDF créé, mais SANS Factur-X (problème noté dans erreurs.log, envoyez-le moi) : " + nom, true);
    else toast("PDF créé" + (r.facturx ? " (Factur-X)" : "") + " : " + nom);
    if (choix === "demander") demanderOuvrirPdf(r.chemin, r.facturx);
  } catch (e) {
    erreur(e);
  }
}

function demanderOuvrirPdf(chemin, facturx) {
  const nom = chemin.split(/[\\/]/).pop();
  ouvrirModale(
    "PDF créé",
    h(
      "div",
      {},
      h("p", { style: "margin-top:0" }, "Le PDF" + (facturx ? " Factur-X" : "") + " est enregistré :"),
      h("p", {}, h("b", {}, nom)),
      h("p", { class: "sous" }, chemin)
    ),
    [
      h("button", { class: "btn", onclick: fermerModale }, "Ne pas l'ouvrir"),
      h(
        "button",
        {
          class: "btn principal",
          onclick: async () => {
            fermerModale();
            try {
              await api("POST", "/api/pdf/ouvrir", { chemin });
            } catch (e) {
              erreur(e);
            }
          },
        },
        "Ouvrir le PDF"
      ),
    ],
    { largeur: "min(520px, 94vw)" }
  );
}

async function apercu(id) {
  if (!(await enregistrerAvant("l'aperçu"))) return;
  window.open("/impression.html?id=" + id, "_blank");
}

async function supprimerDevis(fiche) {
  const d = DV.courant;
  if (estFact(d)) {
    if (d.emise_le) {
      toast(`${libelleFact(d)} est ${accordFact(d, "émise")} : non supprimable.`, true);
      return;
    }
    if (!confirm(`Supprimer ce brouillon de ${d.type === "avoir" ? "l'avoir" : "facture"} ?`)) return;
  } else if (d.statut === "accepte") {
    toast(`Le devis ${d.numero} est accepté : il ne peut pas être supprimé (changez d'abord son état si c'est une erreur).`, true);
    return;
  }
  if (!estFact(d) && !confirm(`Supprimer définitivement le devis ${d.numero} ?`)) return;
  await api("DELETE", "/api/documents/" + d.id);
  DV.sale = false;
  DV.courant = null;
  await DV.afficherListe(fiche);
  toast((estFact(d) ? libelleFact(d) : "Devis " + d.numero) + " supprimé");
}
