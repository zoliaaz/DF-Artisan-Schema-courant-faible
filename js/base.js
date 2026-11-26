"use strict";
/* =====================================================================
   DF artisan — interface
   Une seule page : Devis / Clients / Catalogue / Paramètres.
   Toutes les données passent par le petit serveur local (serveur.py).
   ===================================================================== */

/* ---------------- outils ---------------- */
const $ = (s, el = document) => el.querySelector(s);

/** comme el.append(), mais ignore les valeurs vides (null, false…) */
function ajouterA(el, ...enfants) {
  for (const e of enfants.flat()) if (e !== null && e !== undefined && e !== false) el.append(e);
  return el;
}

function h(tag, attrs, ...enfants) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const e of enfants.flat()) {
    if (e === null || e === undefined || e === false) continue;
    el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return el;
}

async function api(methode, url, corps, options) {
  const init = { method: methode, headers: { "X-BatiDevis": "1" } };
  if (corps !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(corps);
  }
  if (options && options.keepalive) init.keepalive = true;
  let r;
  try {
    r = await fetch(url, init);
  } catch (e) {
    throw new Error("DF artisan ne répond plus : la fenêtre noire a-t-elle été fermée ? Relancez lancer.bat.");
  }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && data.verrou) {
    ecranConnexion();
    throw new Error("DF artisan est verrouillé : entrez le mot de passe.");
  }
  if (!r.ok) throw new Error(data.erreur || "Erreur " + r.status);
  return data;
}

/* ---------- mot de passe à l'ouverture (Paramètres > Général > Sécurité) ---------- */
/** champ mot de passe + bouton œil pour voir ce qu'on tape */
function avecOeil(input) {
  const b = h("button", { class: "oeil", type: "button", tabindex: "-1", title: "Afficher le mot de passe" });
  const maj = () => {
    const vu = input.type === "text";
    b.textContent = vu ? "🙈" : "👁";
    b.title = vu ? "Masquer le mot de passe" : "Afficher le mot de passe";
  };
  b.addEventListener("mousedown", e => e.preventDefault()); // garde le curseur dans le champ
  b.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
    maj();
    input.focus();
  });
  maj();
  return h("span", { class: "champ-mdp" }, input, b);
}
async function ecranConnexion() {
  if (document.getElementById("ecran-connexion")) return;
  let etat = {};
  try {
    etat = await (await fetch("/api/securite/etat")).json();
  } catch (e) {
    /* */
  }
  const envoyer = async (url, corps) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "X-BatiDevis": "1", "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erreur || "Erreur");
    location.reload();
  };
  const msg = h("p", { class: "erreur-connexion" });
  const mdp = h("input", { type: "password", placeholder: "Mot de passe", autocomplete: "current-password" });
  const code = h("input", { type: "text", placeholder: "Code de récupération (ex. K7QF-2MXP-…)", autocomplete: "off" });
  const n1 = h("input", { type: "password", placeholder: "Nouveau mot de passe (6 caractères ou plus)", autocomplete: "new-password" });
  const n2 = h("input", { type: "password", placeholder: "Le nouveau mot de passe, encore une fois", autocomplete: "new-password" });
  const zoneOubli = h(
    "div",
    { class: "cache", style: "display:flex;flex-direction:column;gap:8px" },
    h(
      "p",
      { class: "sous", style: "margin:0" },
      "Avec le code de récupération noté quand le mot de passe a été créé, choisissez-en un nouveau."
    ),
    code,
    avecOeil(n1),
    avecOeil(n2),
    h(
      "button",
      {
        class: "btn principal",
        type: "button",
        onclick: async () => {
          msg.textContent = "";
          if (n1.value !== n2.value) {
            msg.textContent = "Les deux nouveaux mots de passe ne sont pas pareils.";
            return;
          }
          try {
            await envoyer("/api/securite/recuperer", { code: code.value, nouveau: n1.value });
          } catch (e) {
            msg.textContent = e.message;
          }
        },
      },
      "Changer le mot de passe et ouvrir"
    )
  );
  const ouvrir = async () => {
    msg.textContent = "";
    try {
      await envoyer("/api/securite/connexion", { mot_de_passe: mdp.value });
    } catch (e) {
      msg.textContent = e.message;
      mdp.select();
    }
  };
  mdp.addEventListener("keydown", e => {
    if (e.key === "Enter") ouvrir();
  });
  const boite = h(
    "div",
    { id: "ecran-connexion" },
    h(
      "div",
      { class: "boite-connexion" },
      h("h2", {}, "DF artisan"),
      etat.nom_profil ? h("p", { class: "sous", style: "margin-top:-6px" }, "Profil : " + etat.nom_profil) : null,
      h("p", {}, "Les données sont protégées par un mot de passe."),
      h(
        "div",
        { style: "display:flex;gap:8px" },
        avecOeil(mdp),
        h("button", { class: "btn principal", type: "button", onclick: ouvrir }, "Ouvrir")
      ),
      h(
        "button",
        {
          class: "lien",
          type: "button",
          style: "margin-top:10px;align-self:flex-start",
          onclick: () => {
            zoneOubli.classList.toggle("cache");
            if (!zoneOubli.classList.contains("cache")) code.focus();
          },
        },
        "Mot de passe oublié ?"
      ),
      zoneOubli,
      msg
    )
  );
  document.body.append(boite);
  setTimeout(() => mdp.focus(), 50);
}

let toastTimer = null;
function toast(msg, erreur) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (erreur ? " erreur" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("cache"), erreur ? 6000 : 2500);
}
function erreur(e) {
  console.error(e);
  toast(e.message || String(e), true);
}

/** "1 234,5" / "12.3" / 12.3 -> 12.3 */
function nombre(v) {
  if (typeof v === "number") return v;
  const n = parseFloat(
    String(v || "")
      .replace(/[\s\u00a0\u202f€]/g, "")
      .replace(",", ".")
  );
  return isNaN(n) ? 0 : n;
}
/** arrondi au centime « commercial » sans les pièges des nombres à virgule (162,825 -> 162,83) */
/* Champs numériques : le point (pavé numérique) devient une virgule pendant la saisie */
function estChampNombre(el) {
  return el && el.tagName === "INPUT" && (el.classList.contains("nombre") || el.getAttribute("inputmode") === "decimal");
}
document.addEventListener(
  "keydown",
  e => {
    if (e.key !== "." || e.ctrlKey || e.metaKey || e.altKey || !estChampNombre(e.target)) return;
    e.preventDefault();
    const i = e.target,
      d = i.selectionStart,
      f = i.selectionEnd;
    i.value = i.value.slice(0, d) + "," + i.value.slice(f);
    i.setSelectionRange(d + 1, d + 1);
    i.dispatchEvent(new Event("input", { bubbles: true }));
  },
  true
);
// collé ou saisi autrement : on remplace aussi
document.addEventListener(
  "input",
  e => {
    const i = e.target;
    if (!estChampNombre(i) || !i.value.includes(".")) return;
    const pos = i.selectionStart;
    i.value = i.value.replace(/\./g, ",");
    try {
      i.setSelectionRange(pos, pos);
    } catch (er) {
      /* champ sans curseur */
    }
  },
  true
);

function centimes(x) {
  return Math.round(Number((x * 100).toFixed(6)));
}
function arrondi(x) {
  return centimes(x) / 100;
}
/** colonne réduite : les menus en icônes s'il y a la place (sinon le bouton ☰, qui les ouvre en liste) */
function majNavIcones() {
  const barre = document.querySelector(".barre-gauche");
  if (!barre) return;
  document.querySelectorAll("#nav button[data-section]").forEach(b => {
    if (!b.title) b.title = b.textContent.trim();
  });
  // (plan en mode tablette : la colonne réduite porte les outils du plan, qui ont la priorité → menus par ☰)
  const outilsDedans = !!barre.querySelector(".plan-outils-col");
  if (!document.body.classList.contains("gauche-repliee") || outilsDedans) {
    document.body.classList.remove("nav-icones");
    return;
  }
  if (!document.body.classList.contains("nav-icones")) document.body.classList.add("nav-icones");
  const enTrop =
    barre.scrollHeight > barre.clientHeight + 1 ||
    [...barre.children].reduce((t, e) => t + e.getBoundingClientRect().height, 0) > barre.clientHeight - 16;
  if (enTrop) document.body.classList.remove("nav-icones");
}
window.addEventListener("resize", () => majNavIcones());
/** bouton « Réduire » de la colonne bleue ; ses flèches s'inversent quand la colonne est à droite (plan, tablette, droitier) */
function majBoutonReplier() {
  majNavIcones();
  const b = $("#replier-gauche");
  if (!b) return;
  const r = document.body.classList.contains("gauche-repliee"),
    droite = document.body.classList.contains("plan-droitier");
  b.textContent = r ? (droite ? "«" : "»") : droite ? "Réduire »" : "« Réduire";
  b.title = r ? "Remettre la colonne du menu" : "Masquer cette colonne pour gagner de la place (le menu reste accessible par ☰)";
}
/** texte sans accents (casse gardée : ajouter .toLowerCase() pour comparer) ; utilisé par la recherche de l'étude et la comptabilité */
function sansAccents(t) {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function euros(x) {
  const n = arrondi(nombre(x));
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
/** affichage dans un champ : 205.6 -> "205,60", 1 -> "1" */
function versChamp(x, decimales) {
  if (x === null || x === undefined || x === "") return "";
  const n = nombre(x);
  if (decimales === undefined) return String(n).replace(".", ",");
  return n.toFixed(decimales).replace(".", ",");
}
function dateFr(iso) {
  if (!iso) return "";
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}
function debounce(f, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => f(...a), ms);
  };
}
function autoHauteur(ta) {
  if (!ta || ta.tagName !== "TEXTAREA") return;
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + 2 + "px";
}

function etatEnregistrement(txt) {
  $("#etat-enregistrement").textContent = txt || "";
}

/* ---------------- modale ---------------- */
const PILE_MODALES = []; // une fenêtre ouverte depuis une autre (ex. article depuis un sous-ouvrage)
function ouvrirModale(titre, corps, boutons, options) {
  const boite = $("#modale-boite");
  // (options.remplacer : la même fenêtre redessinée, pas une fenêtre par-dessus)
  if (!$("#modale").classList.contains("cache") && boite.childNodes.length && !(options && options.remplacer))
    PILE_MODALES.push({ noeuds: [...boite.childNodes], largeur: boite.style.width });
  boite.innerHTML = "";
  boite.style.width = (options && options.largeur) || "";
  ajouterA(
    boite,
    h("div", { class: "modale-haut" }, h("h3", {}, titre), h("button", { class: "icone", title: "Fermer", onclick: fermerModale }, "✕")),
    h("div", { class: "modale-corps" }, corps),
    boutons && boutons.length ? h("div", { class: "modale-pied" }, boutons) : null
  );
  $("#modale").classList.remove("cache");
  appuiFondModale = false;
  // (au doigt : pas de curseur d'office dans la 1re case, sinon le clavier de la tablette cache la fenêtre ;
  //  sauf pour une question à taper tout de suite — options.clavier)
  const premier = boite.querySelector("input, textarea, select");
  const tactile = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  if (premier && (!tactile || (options && options.clavier))) setTimeout(() => premier.focus(), 30);
}
let appuiFondModale = false;
/* questions dans une fenêtre de la page, à la place de prompt() et confirm() du navigateur
   (celles-ci font sortir du plein écran sur tablette) ; renvoient une promesse */
function demanderTexte(question, defaut) {
  return new Promise(ok => {
    let fini = false;
    const fin = v => {
      if (fini) return;
      fini = true;
      obs.disconnect();
      ok(v);
    };
    const champ = h("input", { type: "text", value: defaut ?? "", style: "width:100%;font-size:16px" });
    const valider = () => {
      fin(champ.value);
      fermerModale();
    };
    champ.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        valider();
      }
    });
    const lignes = String(question).split("\n");
    const corps = h("div", { class: "pile" }, ...lignes.map((l, i) => h("p", { style: "margin:" + (i ? "0" : "0 0 2px") }, l)), champ);
    ouvrirModale(
      "DF artisan",
      corps,
      [
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              fin(null);
              fermerModale();
            },
          },
          "Annuler"
        ),
        h("button", { class: "btn principal", onclick: valider }, "OK"),
      ],
      { largeur: "min(480px, 94vw)", clavier: true }
    );
    // (fenêtre fermée autrement : ✕, Échap, clic à côté → comme Annuler)
    const obs = new MutationObserver(() => {
      if (!corps.isConnected)
        setTimeout(() => {
          if (!corps.isConnected) fin(null);
        }, 0);
    });
    obs.observe($("#modale-boite"), { childList: true });
  });
}
function demanderOui(question) {
  return new Promise(ok => {
    let fini = false;
    const fin = v => {
      if (fini) return;
      fini = true;
      obs.disconnect();
      ok(v);
    };
    const corps = h(
      "div",
      {},
      ...String(question)
        .split("\n")
        .map(l => h("p", { style: "margin:0 0 4px" }, l))
    );
    const oui = h(
      "button",
      {
        class: "btn principal",
        onclick: () => {
          fin(true);
          fermerModale();
        },
      },
      "OK"
    );
    ouvrirModale(
      "DF artisan",
      corps,
      [
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              fin(false);
              fermerModale();
            },
          },
          "Annuler"
        ),
        oui,
      ],
      { largeur: "min(480px, 94vw)" }
    );
    setTimeout(() => oui.focus(), 30);
    const obs = new MutationObserver(() => {
      if (!corps.isConnected)
        setTimeout(() => {
          if (!corps.isConnected) fin(false);
        }, 0);
    });
    obs.observe($("#modale-boite"), { childList: true });
  });
}
function fermerModale() {
  const boite = $("#modale-boite");
  boite.innerHTML = "";
  const prec = PILE_MODALES.pop();
  if (prec) {
    boite.style.width = prec.largeur;
    prec.noeuds.forEach(n => boite.append(n));
    return;
  }
  $("#modale").classList.add("cache");
}
// clic à côté de la fenêtre : la ferme. Au doigt, l'appui qui a ouvert la fenêtre envoie après coup un « mousedown »
// là où était le doigt — souvent à côté de la fenêtre : il la refermait aussitôt. Il faut un vrai appui sur le fond.
$("#modale").addEventListener("pointerdown", e => {
  appuiFondModale = e.target.id === "modale";
});
$("#modale").addEventListener("mousedown", e => {
  if (e.target.id === "modale" && appuiFondModale) fermerModale();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#modale").classList.contains("cache")) fermerModale();
});

/* ---------------- état général ---------------- */
let PARAMS = null;
let sectionActive = "devis";
let avantDeQuitter = null; // fonction asynchrone : enregistre ce qui est en cours (devis) ou demande confirmation

/** paramètres enregistrés par un petit changement (sans recharger PARAMS) : version notée, pour la page Paramètres */
function majVersionParams(r) {
  if (PARAMS && r && r.maj_parametres) PARAMS.maj_parametres = r.maj_parametres;
  return r;
}
async function chargerParams() {
  PARAMS = await api("GET", "/api/parametres");
  appliquerAffichage();
}
/** paramètres d'affichage : raccourcis clavier écrits sur les boutons ou non */
/** ouvrage dans la liste : son titre, et ▸ pour voir sur place son détail (description) sans ouvrir la fiche */
function designationDepliable(titre, detail) {
  const t = texteBrut(String(titre || "").replace(/\s*\n\s*/g, " ")).trim();
  const d = String(detail || "")
    .replace(/\r/g, "")
    .trim();
  if (!d) return t;
  const contenu = h("span", { class: "texte-desig" }, t);
  const bouton = h("button", { class: "deplier", type: "button", title: "Voir le détail de l'ouvrage" }, "▸");
  const boite = h("span", { class: "desig-depliable" }, bouton, contenu);
  bouton.addEventListener("dblclick", e => e.stopPropagation());
  bouton.addEventListener("click", e => {
    e.stopPropagation();
    const td = boite.closest("td"),
      ouvert = !td.classList.contains("deplie");
    td.classList.toggle("deplie", ouvert);
    bouton.textContent = ouvert ? "▾" : "▸";
    bouton.title = ouvert ? "Replier" : "Voir le détail de l'ouvrage";
    if (ouvert) contenu.innerHTML = "<div><b>" + echapperHtml(t) + "</b></div>" + marquageVersHtml(d.replace(/^\s*[-•]\s+/gm, "• "));
    else contenu.textContent = t;
  });
  return boite;
}

/** champs à remplir (Paramètres > Réglages > Devis / Factures) : légèrement mis en évidence tant qu'ils sont vides */
const CHAMPS_A_REMPLIR = [
  ["client", "Client"],
  ["chantier_adresse", "Adresse du chantier"],
  ["interlocuteur", "Interlocuteur"],
  ["objet", "Objet"],
  ["ref_libre", "Réf. libre"],
  ["note_entete", "Introduction au-dessus du tableau"],
  ["debut_travaux", "Début des travaux", "devis"],
  ["duree_intervention", "Durée estimée", "devis"],
  ["date_travaux", "Date des travaux (début / fin / avancement)", "facture"],
];
function champsARemplir(fact) {
  return CHAMPS_A_REMPLIR.filter(c => !c[2] || c[2] === (fact ? "facture" : "devis"));
}
/** libellé d'un champ libre dans la liste « à remplir » : son nom (suit la saisie dans Paramètres > Champs libres) */
const libelleChampLibre = (i, nom) => `Champ libre ${i + 1} : ` + (String(nom || "").trim() || "(sans nom, pas utilisé)");
document.addEventListener("input", e => {
  const t = e.target;
  if (!t.classList || !t.classList.contains("nom-champ-libre")) return;
  document.querySelectorAll(`.nom-libre[data-i="${t.dataset.i}"]`).forEach(x => {
    x.textContent = libelleChampLibre(Number(t.dataset.i), t.value);
  });
});
function majARemplir(d, racine) {
  const voulus = new Set((PARAMS.devis || {})[estFact(d) ? "requis_facture" : "requis_devis"] || []);
  const valeur = cle =>
    cle === "client"
      ? d.client_id
      : /^libre\d$/.test(cle)
        ? (d.champs_libres || {})[cle]
        : cle === "note_entete"
          ? String(d.note_entete || "")
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
          : d[cle];
  racine.querySelectorAll("[data-champ]").forEach(el => {
    const cle = el.dataset.champ;
    const boite = el.closest("label.champ, div.champ") || el;
    boite.classList.toggle("a-remplir", voulus.has(cle) && !d.emise_le && !String(valeur(cle) ?? "").trim());
  });
}
function editeurARemplir(DV_, cle, fact) {
  const liste = (DV_[cle] = Array.isArray(DV_[cle]) ? DV_[cle].slice() : []);
  return h(
    "div",
    { class: "champ large" },
    h("span", {}, `Champs à remplir dans les ${fact ? "factures" : "devis"} (encadrés en jaune tant qu'ils sont vides)`),
    h(
      "div",
      { class: "cases-a-remplir" },
      champsARemplir(fact)
        .concat([0, 1, 2, 3, 4].map(i => ["libre" + (i + 1), null, i]))
        .map(([k, lib, i]) => {
          const cb = h("input", { type: "checkbox", checked: liste.includes(k) });
          cb.addEventListener("change", () => {
            const j = liste.indexOf(k);
            if (cb.checked && j < 0) liste.push(k);
            if (!cb.checked && j >= 0) liste.splice(j, 1);
            DV_[cle] = liste;
          });
          return h(
            "label",
            { class: "case" },
            cb,
            lib !== null ? lib : h("span", { class: "nom-libre", "data-i": i }, libelleChampLibre(i, (DV_.champs_libres || [])[i]))
          );
        })
    )
  );
}

/** couleurs des lignes des listes selon l'état (Paramètres > Réglages > Couleurs des listes) */
const COULEURS_ETATS = [
  ["devis", "envoye", "Devis envoyé", "#a5d8ff"],
  ["devis", "accepte", "Devis accepté", "#9be7b0"],
  ["devis", "refuse", "Devis refusé", "#ffb3b3"],
  ["devis", "annule", "Devis annulé", "#dcdfe4"],
  ["devis", "brouillon", "Devis brouillon", "#ffffff"],
  ["fact", "apayer", "Facture envoyée (à payer)", "#a5d8ff"],
  ["fact", "partielle", "Facture payée en partie", "#ffe08a"],
  ["fact", "retard", "Facture en retard", "#ffb3b3"],
  ["fact", "payee", "Facture payée", "#9be7b0"],
  ["fact", "avoir", "Avoir", "#d4c8ff"],
  ["fact", "annulee", "Facture annulée (avoir)", "#dcdfe4"],
  ["fact", "brouillon", "Facture brouillon", "#ffffff"],
];
function appliquerCouleursEtats() {
  const perso = (PARAMS.general || {}).couleurs_etats || {};
  for (const [t, k, , def] of COULEURS_ETATS) document.documentElement.style.setProperty(`--c-${t}-${k}`, perso[t + "_" + k] || def);
}
function editeurCouleursEtats(G) {
  const perso = (G.couleurs_etats = Object.assign({}, G.couleurs_etats || {}));
  const apercu = (t, k) =>
    document.documentElement.style.setProperty(
      `--c-${t}-${k}`,
      perso[t + "_" + k] || COULEURS_ETATS.find(x => x[0] === t && x[1] === k)[3]
    );
  const cases = COULEURS_ETATS.map(([t, k, lib, def]) => {
    const inp = h("input", { type: "color", value: perso[t + "_" + k] || def });
    inp.addEventListener("input", () => {
      perso[t + "_" + k] = inp.value;
      apercu(t, k);
    });
    return h("label", { class: "couleur-etat", style: `background:var(--c-${t}-${k})` }, inp, h("span", {}, lib));
  });
  return h(
    "div",
    { class: "large" },
    h("div", { class: "grille-couleurs-etats" }, cases),
    h(
      "div",
      { style: "display:flex;gap:10px;align-items:center;margin-top:8px" },
      h(
        "button",
        {
          class: "btn petit",
          type: "button",
          onclick: () => {
            for (const k of Object.keys(perso)) delete perso[k];
            COULEURS_ETATS.forEach(([t, k, , def], i) => {
              cases[i].querySelector("input").value = def;
              apercu(t, k);
            });
          },
        },
        "Couleurs d'origine"
      ),
      h("span", { class: "aide" }, "Fond des lignes dans les listes des devis et des factures. Enregistrez les paramètres pour les garder.")
    )
  );
}
/** apparence de l'écran (Paramètres > Réglages > Apparence) : « clair » (d'origine) ou « contrasté » (cadres nets, titres en bandeau) */
const APPARENCES = [
  ["contraste", "Contrasté : cadres bien délimités, titres en bandeau"],
  ["clair", "Clair (d'origine)"],
];
function apparenceChoisie() {
  const v = (PARAMS.general || {}).apparence;
  return v === "clair" || v === "origine" ? "clair" : "contraste";
}
function appliquerApparence(v) {
  v = v || apparenceChoisie();
  document.body.classList.toggle("apparence-bandeaux", v !== "clair" && v !== "origine");
  appliquerTeinte();
}
/** couleur de l'interface (colonne de gauche, boutons, liens) : Paramètres > Général > Apparence */
const TEINTE_DEF = "#2d4ea2";
function appliquerTeinte(c) {
  c = c || ((PARAMS && PARAMS.general) || {}).couleur_theme || TEINTE_DEF;
  if (!/^#[0-9a-f]{6}$/i.test(c)) c = TEINTE_DEF;
  const n = parseInt(c.slice(1), 16),
    rgb = [n >> 16, (n >> 8) & 255, n & 255];
  const doux =
    "#" +
    rgb
      .map(x =>
        Math.round(x * 0.1 + 255 * 0.9)
          .toString(16)
          .padStart(2, "0")
      )
      .join("");
  const R = document.documentElement.style;
  R.setProperty("--accent", c);
  R.setProperty("--accent-doux", doux);
}
/** fenêtre de comparaison : les deux apparences sur le même devis, un bouton pour choisir */
function fenetreApparence(choisir) {
  const actuelle = apparenceChoisie();
  const carte = (k, titre, texte) =>
    h(
      "div",
      { class: "carte-apparence" + (k === actuelle ? " actuelle" : "") },
      h("div", { class: "titre" }, titre, k === actuelle ? h("span", { class: "puce" }, "choix actuel") : null),
      h("img", { src: `apparence-${k}.jpg`, alt: titre }),
      h("p", { class: "aide" }, texte),
      h(
        "button",
        {
          class: "btn" + (k === actuelle ? "" : " principal"),
          type: "button",
          onclick: () => {
            choisir(k);
            fermerModale();
          },
        },
        "Choisir « " + titre + " »"
      )
    );
  ouvrirModale(
    "Apparence de l'écran",
    h(
      "div",
      { class: "comparaison-apparence" },
      carte("clair", "Clair", "Fond presque blanc, cadres discrets (l'apparence d'origine)."),
      carte(
        "contraste",
        "Contrasté",
        "Fond gris, chaque zone dans un cadre blanc bien délimité, titres des cadres en bandeau ; l'introduction et la conclusion ont aussi leur cadre."
      )
    ),
    [h("button", { class: "btn", onclick: fermerModale }, "Fermer")],
    { largeur: "min(1460px, 96vw)" }
  );
}
function appliquerAffichage() {
  appliquerApparence();
  appliquerCouleursEtats();
  TAUX_TVA = lireTauxTva((PARAMS.devis || {}).taux_tva);
  document.body.classList.toggle("sans-raccourcis", (PARAMS.general || {}).afficher_raccourcis === false);
  appliquerAffichageEtude(PARAMS.devis || {});
  if (typeof glAppliquerCouleurs === "function") glAppliquerCouleurs();
  majModuleElectricien();
}

/** au moins un module du groupe Électricien coché (plans, tableaux, éclairement, schémas interphone/portail) */
const modulesElecActifs = G => !!(G && (G.module_electricien || G.module_eclairage || G.module_etiquettes || G.module_schemas));
/** module « Électricien » (Paramètres > Général) : plans et/ou étude d'éclairement, ouverts par l'éclair à côté du nom */
function majModuleElectricien(G) {
  G = G || PARAMS.general || {};
  document.body.classList.toggle("avec-electricien", modulesElecActifs(G));
  document.body.classList.toggle("avec-plans", !!G.module_electricien);
  // éclair jaune, sauf si la couleur de la colonne est déjà proche du jaune : alors blanc ou foncé selon sa clarté
  const b = document.getElementById("bouton-electricien");
  if (!b) return;
  const fond = getComputedStyle(document.querySelector(".barre-gauche")).backgroundColor.match(/\d+(\.\d+)?/g) || [45, 78, 162];
  const [r, g, bl] = fond.map(Number);
  const proche = Math.hypot(r - 250, g - 204, bl - 21) < 150,
    clair = 0.299 * r + 0.587 * g + 0.114 * bl > 150;
  b.style.color = proche ? (clair ? "#1f2430" : "#fff") : "#facc15";
  majNavElectricien(G);
}
/** petites icônes du module Électricien (plan, tableau électrique, éclairement) */
const ICONES_ELEC = {
  plans:
    '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M2.5 2.5h15v15h-15z"/><path d="M2.5 9.5h7v8M9.5 2.5v4M13 9.5h4.5"/></svg>',
  tableaux:
    '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="1.5" width="10" height="17" rx="1.5"/><rect x="7.5" y="6" width="5" height="8" rx="1" fill="currentColor"/><path d="M10 1.5v-0M10 18.5v0"/></svg>',
  // (tableau électrique : un coffret, deux rangées de modules)
  etiquettes:
    '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="1.8" y="1.8" width="16.4" height="16.4" rx="2"/><path d="M4.5 5.5h11v3.5h-11zM4.5 11h11v3.5h-11z" stroke-width="1.2"/><path d="M8.2 5.5v3.5M11.8 5.5v3.5M8.2 11v3.5M11.8 11v3.5" stroke-width="1.1"/></svg>',
  eclairage:
    '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 1.8a5.6 5.6 0 0 0-3.3 10.1c.7.5 1.1 1.3 1.1 2.1v.6h4.4V14c0-.8.4-1.6 1.1-2.1A5.6 5.6 0 0 0 10 1.8z"/><path d="M8 17h4M8.7 19h2.6"/></svg>',
};
// (schémas : deux appareils reliés par un câble)
ICONES_ELEC.schemas =
  '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="1.5" y="4" width="6" height="12" rx="1"/><rect x="12.5" y="4" width="6" height="12" rx="1"/><path d="M7.5 8h5M7.5 12h5"/></svg>';
const iconeElec = cle => {
  const s = document.createElement("span");
  s.className = "icone-elec";
  s.innerHTML = ICONES_ELEC[cle] || "";
  return s;
};
/** les entrées du module Électricien : [section, libellé, libellé court (colonne de gauche), nouveau, aide du +] */
function entreesElectricien(G) {
  G = G || PARAMS.general || {};
  return [
    G.module_electricien ? ["plans", "Plans d'implantation", "Plans", () => nouveauPlan({}).catch(erreur), "Nouveau plan"] : null,
    G.module_etiquettes
      ? [
          "etiquettes",
          "Tableaux électriques (bêta)",
          "Tableaux",
          () => nouvellesEtiquettes({}, true).catch(erreur),
          "Nouveau tableau électrique",
        ]
      : null,
    G.module_eclairage
      ? [
          "eclairage",
          "Études d'éclairement",
          "Éclairement",
          () => nouvelleEtudeEclairage({}, true).catch(erreur),
          "Nouvelle étude d'éclairement",
        ]
      : null,
    G.module_schemas
      ? ["schemas", "Schémas interphone / portail (alpha)", "Schémas", () => nouveauSchema({}, true).catch(erreur), "Nouveau schéma"]
      : null,
  ].filter(Boolean);
}
function menuElectricien(bouton) {
  const r = bouton.getBoundingClientRect();
  // une ligne par module, avec son icône ; le « + » au bout de la ligne en crée un nouveau
  ouvrirMenuContextuel(r.left, r.bottom + 4, [
    { titre: "Module Électricien" },
    ...entreesElectricien().map(([sec, lib, , nouveau, aide]) => ({
      icone: iconeElec(sec),
      action: () => aller(sec),
      libelle: h(
        "span",
        { style: "display:flex;align-items:center;gap:10px;width:100%" },
        h("span", { style: "flex:1" }, lib),
        h(
          "span",
          {
            class: "menu-plus",
            role: "button",
            title: aide,
            onclick: e => {
              e.stopPropagation();
              fermerMenuContextuel(true);
              nouveau();
            },
          },
          "+"
        )
      ),
    })),
  ]);
}
/** option : les entrées du module dans la colonne de gauche, à la suite des autres menus (Paramètres > Général) */
function majNavElectricien(G) {
  G = G || PARAMS.general || {};
  let bloc = document.getElementById("nav-electricien");
  if (bloc) bloc.remove();
  if (!G.electricien_dans_menu) return;
  const lignes = entreesElectricien(G);
  if (!lignes.length) return;
  bloc = h(
    "div",
    { id: "nav-electricien" },
    h("div", { class: "nav-sep" }),
    ...lignes.map(([sec, , lib, nouveau, aide]) => {
      const b = h("button", { "data-section": sec, class: "nav-elec" }, iconeElec(sec), " " + lib);
      b.addEventListener("click", () => {
        RETOUR = null;
        document.body.classList.remove("menu-ouvert");
        aller(sec);
      });
      return h(
        "div",
        { class: "nav-ligne" },
        b,
        h(
          "button",
          {
            class: "nav-plus",
            title: aide,
            onclick: () => {
              document.body.classList.remove("menu-ouvert");
              nouveau();
            },
          },
          "+"
        )
      );
    }),
    h("div", { class: "nav-sep" })
  );
  const nav = document.getElementById("nav"),
    regl = nav.querySelector('button[data-section="reglages"]');
  nav.insertBefore(bloc, regl ? regl.closest(".nav-ligne") : null);
}
$("#bouton-electricien").addEventListener("click", e => {
  e.stopPropagation();
  document.body.classList.remove("menu-ouvert");
  menuElectricien(e.currentTarget);
});

/* ---------- plein écran (navigateur sans ses barres) : bouton de la colonne de gauche, et dans les plans ---------- */
function pleinEcranActif() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
/* choisir un fichier ou prendre une photo fait sortir du plein écran (appareil photo, explorateur) :
   au retour, on essaie d'y revenir, sinon un bouton propose d'y revenir d'un appui */
let pleinAvantFichier = false;
document.addEventListener(
  "click",
  e => {
    if (e.target && e.target.matches && e.target.matches("input[type=file]")) pleinAvantFichier = pleinEcranActif();
  },
  true
);
const retourPleinEcran = () => {
  if (!pleinAvantFichier || pleinEcranActif()) return;
  pleinAvantFichier = false;
  const el = document.documentElement;
  const bouton = () => {
    const b = h(
      "button",
      {
        class: "btn principal retour-plein-ecran",
        onclick: () => {
          b.remove();
          try {
            (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
          } catch (e) {
            /* */
          }
        },
      },
      "⛶ Revenir en plein écran"
    );
    document.body.append(b);
    setTimeout(() => b.remove(), 15000);
  };
  try {
    const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    if (r && r.catch) r.catch(bouton);
  } catch (e) {
    bouton();
  }
};
document.addEventListener(
  "change",
  e => {
    if (e.target && e.target.matches && e.target.matches("input[type=file]")) setTimeout(retourPleinEcran, 50);
  },
  true
);
window.addEventListener("focus", () => setTimeout(retourPleinEcran, 400)); // (fichier non choisi : retour quand même)
function basculerPleinEcran() {
  const el = document.documentElement;
  try {
    if (pleinEcranActif()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  } catch (e) {
    toast("Plein écran impossible dans ce navigateur (essayez la touche F11).", true);
  }
}
function majPleinEcran() {
  const actif = pleinEcranActif();
  document.querySelectorAll(".bouton-plein-ecran-texte, #bouton-plein-ecran .reseau-texte").forEach(e => {
    e.textContent = actif ? "Quitter le plein écran" : "Plein écran";
  });
  document.body.classList.toggle("plein-ecran", actif);
}
$("#bouton-plein-ecran").addEventListener("click", basculerPleinEcran);
// (bouton montré seulement sur tablette : écran tactile, ou appareil connecté au PC par le réseau — voir body.distant)
try {
  document.body.classList.toggle("tactile", matchMedia("(pointer: coarse)").matches);
} catch (e) {
  /* */
}
document.addEventListener("fullscreenchange", majPleinEcran);
document.addEventListener("webkitfullscreenchange", majPleinEcran);

/* ---------- accès depuis les autres appareils du réseau local (tablette…) : bouton de la colonne de gauche ---------- */
let RESEAU = { actif: false, adresses: [] };
async function majReseau(etat) {
  try {
    RESEAU = etat || (await api("GET", "/api/reseau"));
  } catch (e) {
    return;
  }
  document.body.classList.toggle("distant", !!RESEAU.distant); // (sur la tablette : ni ce bouton ni « Quitter »)
  const b = $("#bouton-reseau");
  b.classList.toggle("cache", !!RESEAU.distant);
  b.classList.toggle("actif", !!RESEAU.actif);
  b.querySelector(".reseau-texte").textContent = RESEAU.actif ? "Tablette : accès ouvert" : "Tablette : accès fermé";
}
function fenetreReseau() {
  const corps = h("div", { class: "pile" });
  const boutons = [];
  const dessiner = () => {
    corps.replaceChildren(
      RESEAU.actif
        ? h(
            "div",
            {},
            h(
              "p",
              { style: "margin-top:0" },
              h("b", {}, "L'accès est ouvert."),
              " Sur la tablette (sur le même réseau que ce PC : sa box, en Wi-Fi), visez le QR code avec l'appareil photo, ou ouvrez le navigateur et tapez :"
            ),
            ...RESEAU.adresses.map((u, i) =>
              h(
                "div",
                { class: "reseau-ligne" },
                (RESEAU.qr || [])[i]
                  ? h("div", { class: "reseau-qr", title: "QR code de l'adresse : appareil photo de la tablette", html: RESEAU.qr[i] })
                  : null,
                h(
                  "div",
                  {},
                  (() => {
                    const [g, nom] = (RESEAU.connexions || [])[i] || [];
                    const lib = g === "wifi" ? "📶 Wi-Fi" : g === "cable" ? "🔌 Câble réseau (RJ45)" : "Réseau local";
                    return h(
                      "div",
                      { class: "reseau-genre", title: nom ? "Connexion de Windows : " + nom : "" },
                      lib + (nom ? " — " + nom : "")
                    );
                  })(),
                  h("p", { class: "reseau-adresse" }, u)
                )
              )
            ),
            h(
              "p",
              { class: "aide" },
              (RESEAU.mot_de_passe
                ? "La tablette demande le mot de passe DF artisan. "
                : "Pensez à fermer l'accès quand vous avez fini. ") +
                "Depuis la tablette, ce qui agit sur le PC lui-même (fenêtres de choix de fichier, ouverture de fichiers, quitter, réglages de sécurité, profils) n'est pas possible. L'accès se referme tout seul quand DF artisan est relancé."
            ),
            h(
              "p",
              { class: "aide" },
              "Rien ne s'affiche sur la tablette ? Au premier essai, Windows peut demander d'autoriser Python dans son pare-feu : acceptez pour les réseaux privés seulement."
            )
          )
        : h(
            "div",
            {},
            h(
              "p",
              { style: "margin-top:0" },
              "Ouvrir l'accès permet d'utiliser DF artisan depuis une tablette ou un téléphone branché sur le même Wi-Fi que ce PC. Les données restent sur ce PC, qui doit rester allumé avec DF artisan lancé."
            ),
            h(
              "p",
              { class: "aide" },
              RESEAU.mot_de_passe
                ? "La tablette devra donner le mot de passe DF artisan."
                : "Sans mot de passe DF artisan, tout appareil de votre réseau peut entrer tant que l'accès est ouvert : ouvrez-le seulement le temps de vous en servir, chez vous."
            ),
            h("p", { class: "aide" }, "Sur un Wi-Fi public (hôtel, gare…), laissez l'accès fermé : la connexion n'est pas chiffrée.")
          )
    );
    boutons.forEach(b => b.remove());
  };
  dessiner();
  const basculer = async () => {
    try {
      await majReseau(await api("POST", "/api/reseau", { actif: !RESEAU.actif }));
      fermerModale();
      toast(RESEAU.actif ? "Accès des autres appareils ouvert" : "Accès des autres appareils fermé");
      if (RESEAU.actif) fenetreReseau();
    } catch (e) {
      erreur(e);
    }
  };
  ouvrirModale(
    "Accès depuis une tablette",
    corps,
    [
      h("button", { class: "btn", onclick: fermerModale }, "Fermer"),
      RESEAU.actif
        ? h("button", { class: "btn danger", onclick: basculer }, "Fermer l'accès")
        : h("button", { class: "btn principal", onclick: basculer }, "Ouvrir l'accès"),
    ].filter(Boolean),
    { largeur: "min(560px, 94vw)" }
  );
}
$("#bouton-reseau").addEventListener("click", () => majReseau().then(fenetreReseau));
majReseau();

/** étude des devis et factures, à l'écran seulement (l'impression ne change pas) : couleurs, police, taille ;
 *  et la 1re ligne des ouvrages en gras (écran et impression) */
const COULEURS_ETUDE = [
  ["etude_c_ouvrage", "Ouvrages", "#1d4ed8"],
  ["etude_c_article", "Articles et fournitures", "#15803d"],
  ["etude_c_mo", "Main d'œuvre (composition)", "#92400e"],
  ["etude_c_ligne", "Lignes libres", "#1f2430"],
  ["etude_c_texte", "Textes", "#555555"],
];
function appliquerAffichageEtude(D) {
  const st = document.documentElement.style;
  COULEURS_ETUDE.forEach(([k, , def]) => st.setProperty("--" + k.replace(/_/g, "-"), D[k] || def));
  st.setProperty("--etude-police", D.etude_police || "inherit");
  st.setProperty("--etude-taille", (Number(D.etude_taille) || 14) + "px");
  document.body.classList.toggle("etude-police-perso", !!D.etude_police);
  document.body.classList.toggle("etude-taille-perso", !!Number(D.etude_taille));
  document.body.classList.toggle("ouvrage-1re-ligne-gras", !!D.premiere_ligne_gras);
}

/** devis ouvert depuis une autre fiche (ouvrage, client) : bouton « ← Retour » en haut du devis */
let RETOUR = null; // { devisId, libelle, action }
async function ouvrirDevisAvecRetour(devisId, libelle, action) {
  RETOUR = { devisId, libelle, action };
  await aller("devis", devisId);
}
function boutonRetour(d) {
  if (!RETOUR || RETOUR.devisId !== d.id) return null;
  const r = RETOUR;
  const lib = r.libelle.length > 32 ? r.libelle.slice(0, 30) + "…" : r.libelle;
  return h(
    "button",
    {
      class: "btn petit",
      title: "Revenir : " + r.libelle,
      onclick: () => {
        RETOUR = null;
        r.action();
      },
    },
    "← " + lib
  );
}
let allerEnCours = null; // (page en train de s'afficher : un 2e clic sur le même menu ne l'affiche pas deux fois)
async function aller(section, arg) {
  let cle;
  try {
    cle = section + "|" + JSON.stringify(arg || null);
  } catch (e) {
    cle = section + "|" + Math.random(); // (argument non sérialisable : jamais regroupé)
  }
  if (allerEnCours && allerEnCours.cle === cle) return allerEnCours.promesse;
  const promesse = allerVraiment(section, arg);
  allerEnCours = { cle, promesse };
  try {
    return await promesse;
  } finally {
    if (allerEnCours && allerEnCours.promesse === promesse) allerEnCours = null;
  }
}
async function allerVraiment(section, arg) {
  if (avantDeQuitter) {
    const ok = await avantDeQuitter();
    if (ok === false) return;
  }
  avantDeQuitter = null;
  sectionActive = section;
  document.querySelectorAll("#nav button[data-section]").forEach(b => b.classList.toggle("actif", b.dataset.section === section)); // (avec les entrées du module Électricien ajoutées)
  const zone = $("#contenu");
  zone.innerHTML = "";
  etatEnregistrement("");
  try {
    await SECTIONS[section](zone, arg);
  } catch (e) {
    erreur(e);
  }
}
document.querySelectorAll("#nav button[data-section]").forEach(b =>
  b.addEventListener("click", () => {
    RETOUR = null;
    document.body.classList.remove("menu-ouvert");
    aller(b.dataset.section);
  })
);
// colonne de gauche masquable (petits écrans) : elle devient un menu déroulant derrière ☰, à côté du nom
(() => {
  const lire = () => {
    try {
      return localStorage.getItem("batidevis_gauche") === "repliee";
    } catch (e) {
      return false;
    }
  };
  const ecrire = v => {
    try {
      localStorage.setItem("batidevis_gauche", v ? "repliee" : "");
    } catch (e) {
      /* */
    }
  };
  document.body.classList.toggle("gauche-repliee", lire());
  $("#replier-gauche").addEventListener("click", () => {
    const r = !document.body.classList.contains("gauche-repliee");
    document.body.classList.toggle("gauche-repliee", r);
    document.body.classList.remove("menu-ouvert");
    ecrire(r);
    majBoutonReplier();
  });
  majBoutonReplier();
  $("#bouton-menu").addEventListener("click", e => {
    e.stopPropagation();
    document.body.classList.toggle("menu-ouvert");
  });
  document.addEventListener("mousedown", e => {
    if (!e.target.closest(".barre-gauche")) document.body.classList.remove("menu-ouvert");
  });
})();
// « + Nouveau » en face de chaque menu
document.querySelectorAll("#nav .nav-plus").forEach(b =>
  b.addEventListener("click", async () => {
    const s = b.dataset.nouveau;
    if (s === "devis") {
      await aller("devis");
      nouveauDevis(DV.fiche).catch(erreur);
    } else if (s === "factures") {
      await aller("factures");
      nouvelleFactureLibre().catch(erreur);
    } else if (s === "plans") {
      nouveauPlan({}).catch(erreur);
    } else if (s === "clients") {
      await aller("clients");
      if (CL.ouvrir) CL.ouvrir(null);
    } else if (s === "catalogue") {
      // que créer : article, ouvrage, lot ou taux de main d'œuvre
      const r = b.getBoundingClientRect();
      const creer = quoi =>
        (async () => {
          await aller("catalogue");
          if (CAT.nouveau) await CAT.nouveau(quoi);
        })().catch(erreur);
      ouvrirMenuContextuel(r.right + 4, r.top, [
        { titre: "Nouveau dans le catalogue" },
        { libelle: "Article", action: () => creer("articles") },
        { libelle: "Ouvrage", action: () => creer("ouvrages") },
        { libelle: "Lot (plusieurs lignes ensemble)", action: () => creer("lots") },
        { libelle: "Taux de main d'œuvre", action: () => creer("mo") },
      ]);
    }
    document.body.classList.remove("menu-ouvert");
  })
);

/** confirmation avant d'abandonner une fiche modifiée et non enregistrée */
function gardeFiche(estSale) {
  return async () => !estSale() || confirm("Des modifications ne sont pas enregistrées. Les abandonner ?");
}

/* ---------------- champs {{...}} ---------------- */
function boutonChamps(cible) {
  const zone = h("span", { class: "champs-aide" });
  const liste = h("div", { class: "liste-champs cache" });
  let groupe = "";
  for (const c of PARAMS.champs) {
    if (c.groupe !== groupe) {
      groupe = c.groupe;
      liste.append(h("div", { class: "groupe" }, groupe));
    }
    liste.append(
      h(
        "div",
        {
          class: "ch",
          title: c.exemple ? "Exemple : " + c.exemple : "",
          onmousedown: e => {
            e.preventDefault();
            const ta = cible();
            const txt = "{{" + c.nom + "}}";
            if (ta.insererTexte) {
              ta.insererTexte(txt);
              liste.classList.add("cache");
              return;
            }
            const d = ta.selectionStart ?? ta.value.length,
              f = ta.selectionEnd ?? ta.value.length;
            ta.value = ta.value.slice(0, d) + txt + ta.value.slice(f);
            ta.selectionStart = ta.selectionEnd = d + txt.length;
            ta.dispatchEvent(new Event("input", { bubbles: true }));
            liste.classList.add("cache");
            ta.focus();
          },
        },
        h("code", {}, txt0(c.nom)),
        h("span", {}, c.libelle)
      )
    );
  }
  zone.append(
    h(
      "button",
      {
        class: "btn petit",
        type: "button",
        title: "Insérer une valeur du document (montant, client…)",
        onclick: () => liste.classList.toggle("cache"),
      },
      "Insérer un champ ▾"
    ),
    liste
  );
  document.addEventListener("mousedown", e => {
    if (!zone.contains(e.target)) liste.classList.add("cache");
  });
  return zone;
}
function txt0(nom) {
  return "{{" + nom + "}}";
}

/* ---------------- auto-complétion générique ---------------- */
function autoComplete(input, chercher, choisir, options) {
  // (la liste flotte par-dessus la page, posée sous le champ : jamais coupée par un cadre qui défile, comme la
  //  composition d'un ouvrage ; au moins 380 px de large ; au-dessus du champ s'il n'y a pas la place dessous)
  const box = h("div", { class: "auto-liste flottante cache" });
  input.listeAuto = box;
  let items = [],
    sel = -1;
  const placer = () => {
    if (!input.isConnected) return cacher();
    const r = input.getBoundingClientRect();
    const larg = Math.min(Math.max(r.width, (options && options.largeurMin) || 380), window.innerWidth - 16);
    box.style.width = larg + "px";
    box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - larg - 8)) + "px";
    const haut = Math.min(box.scrollHeight, 280);
    box.style.top = (r.bottom + 2 + haut > window.innerHeight && r.top - 2 - haut > 0 ? r.top - 2 - haut : r.bottom + 2) + "px";
  };
  const montrer = () => {
    if (!box.isConnected) document.body.append(box);
    box.classList.remove("cache");
    placer();
    window.addEventListener("scroll", placer, true);
    window.addEventListener("resize", placer);
  };
  const cacher = () => {
    box.classList.add("cache");
    box.remove();
    window.removeEventListener("scroll", placer, true);
    window.removeEventListener("resize", placer);
  };
  const afficher = async () => {
    try {
      items = await chercher(input.value.trim());
    } catch (e) {
      erreur(e);
      return;
    }
    box.innerHTML = "";
    sel = -1;
    items.forEach((it, i) =>
      box.append(
        h(
          "div",
          {
            onmousedown: ev => {
              ev.preventDefault();
              valider(i);
            },
          },
          it.libelle,
          it.detail ? h("small", {}, "  " + it.detail) : null
        )
      )
    );
    if (options && options.creer && input.value.trim()) {
      box.append(
        h(
          "div",
          {
            onmousedown: ev => {
              ev.preventDefault();
              cacher();
              options.creer(input.value.trim());
            },
          },
          h("b", {}, "+ "),
          options.creerLibelle(input.value.trim())
        )
      );
    }
    if (box.children.length && document.activeElement === input) montrer();
    else cacher();
  };
  const valider = i => {
    cacher();
    if (items[i]) choisir(items[i].valeur);
  };
  const lent = debounce(afficher, 150);
  input.addEventListener("input", lent);
  if (!(options && options.surFocus === false)) input.addEventListener("focus", afficher);
  input.addEventListener("blur", () => setTimeout(cacher, 150));
  input.addEventListener("keydown", e => {
    const n = box.children.length;
    if (e.key === "ArrowDown" && n) {
      sel = (sel + 1) % n;
      e.preventDefault();
    } else if (e.key === "ArrowUp" && n) {
      sel = (sel - 1 + n) % n;
      e.preventDefault();
    } else if (e.key === "Enter" && sel >= 0) {
      e.preventDefault();
      box.children[sel].dispatchEvent(new MouseEvent("mousedown"));
      return;
    } else if (e.key === "Tab" && !e.shiftKey && input.value.trim()) {
      // Tab pour passer à la case suivante : l'élément choisi dans la liste, ou la référence tapée exactement, est pris
      if (sel >= 0 && box.isConnected && items[sel]) {
        valider(sel);
        return;
      }
      const q = input.value.trim().toLowerCase();
      (async () => {
        let its;
        try {
          its = await chercher(input.value.trim());
        } catch (er) {
          return;
        }
        if (input.value.trim().toLowerCase() !== q) return;
        const exact = its.filter(it => String((it.valeur && it.valeur.ref) || it.cle || it.libelle || "").toLowerCase() === q);
        if (exact.length === 1) {
          items = its;
          cacher();
          choisir(exact[0].valeur);
        }
      })();
      return;
    } else if (e.key === "Enter" && input.value.trim()) {
      // Entrée sans rien choisir dans la liste : la référence tapée exactement, ou le seul résultat, est pris ;
      // sinon la liste s'ouvre sur le 1er (Entrée de nouveau pour le prendre)
      e.preventDefault();
      const q = input.value.trim().toLowerCase();
      (async () => {
        let its;
        try {
          its = await chercher(input.value.trim());
        } catch (er) {
          return erreur(er);
        }
        if (input.value.trim().toLowerCase() !== q) return; // (on a continué de taper)
        const cle = it => String((it.valeur && it.valeur.ref) || it.cle || it.libelle || "").toLowerCase();
        const exact = its.filter(it => cle(it) === q);
        const pris = exact.length === 1 ? exact[0] : its.length === 1 ? its[0] : null;
        if (pris) {
          items = its;
          cacher();
          choisir(pris.valeur);
          return;
        }
        if (!its.length) return;
        await afficher();
        sel = 0;
        [...box.children].forEach((c, i) => c.classList.toggle("sel", i === sel));
      })();
      return;
    } else return;
    [...box.children].forEach((c, i) => c.classList.toggle("sel", i === sel));
    const c = box.children[sel];
    if (c) c.scrollIntoView({ block: "nearest" });
  });
}

/** code postal <-> ville : liste des communes (et des villes de vos clients) ; la ville se remplit toute seule */
function lierCpVille(cp, ville, apres) {
  const signaler = () => {
    [cp, ville].forEach(i => i.dispatchEvent(new Event("change", { bubbles: true })));
    if (apres) apres(cp.value, ville.value);
  };
  const remplir = x => {
    cp.value = x.cp;
    ville.value = x.ville;
    signaler();
  };
  const liste = async (cle, q) =>
    (await api("GET", "/api/communes?" + cle + "=" + encodeURIComponent(q))).map(x => ({ libelle: x.cp + "  " + x.ville, valeur: x }));
  autoComplete(cp, async q => (q.replace(/\D/g, "").length >= 2 ? liste("cp", q) : []), remplir);
  autoComplete(ville, async q => (q.trim().length >= 2 && document.activeElement === ville ? liste("ville", q) : []), remplir);
  // code postal complet et une seule commune : la ville vide est remplie directement
  cp.addEventListener(
    "input",
    debounce(async () => {
      const v = cp.value.replace(/\D/g, "");
      if (v.length !== 5 || ville.value.trim()) return;
      try {
        const noms = [...new Set((await api("GET", "/api/communes?cp=" + v)).filter(x => x.cp === v).map(x => x.ville))];
        if (noms.length === 1 && !ville.value.trim()) {
          ville.value = noms[0];
          signaler();
        }
      } catch (e) {
        /* sans importance */
      }
    }, 350)
  );
}

/* ---------- carte : itinéraire depuis l'entreprise vers une adresse (Google Maps ou OpenStreetMap, nouvel onglet) ---------- */
function adressePourCarte(texte) {
  // (adresse de chantier : « Nom de la résidence » sur la 1re ligne, puis la rue : la 1re ligne sans chiffre est laissée de côté)
  let l = String(texte || "")
    .split(/\n|,\s*/)
    .map(x => x.trim())
    .filter(Boolean);
  if (l.length > 1 && !/\d/.test(l[0]) && l.slice(1).some(x => /\d/.test(x))) l = l.slice(1);
  return l.join(", ");
}
function ouvrirCarte(site, destination, itineraire) {
  const e = (PARAMS && PARAMS.entreprise) || {};
  const depart = adressePourCarte([e.adresse, [e.cp, e.ville].filter(Boolean).join(" ")].filter(Boolean).join(", "));
  const q = encodeURIComponent;
  let url;
  if (site === "osm")
    url =
      itineraire && depart
        ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&from=${q(depart)}&to=${q(destination)}`
        : `https://www.openstreetmap.org/search?query=${q(destination)}`;
  else
    url = itineraire
      ? `https://www.google.com/maps/dir/?api=1${depart ? "&origin=" + q(depart) : ""}&destination=${q(destination)}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${q(destination)}`;
  window.open(url, "_blank", "noopener");
  try {
    localStorage.setItem("dfa_carte", site);
  } catch (er) {
    /* */
  }
}
/** petit bouton « 🗺 » à côté d'une adresse : itinéraire ou carte (lireAdresse() donne l'adresse au moment du clic) */
function boutonItineraire(lireAdresse) {
  return h(
    "button",
    {
      type: "button",
      class: "btn-carte",
      title: "Itinéraire depuis l'entreprise (nouvel onglet du navigateur) — Google Maps ou OpenStreetMap : Paramètres > Réglages",
      onclick: ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const dest = adressePourCarte(lireAdresse());
        if (!dest) {
          toast("L'adresse est vide.", true);
          return;
        }
        // (Paramètres > Réglages : Google Maps, OpenStreetMap, ou le menu à chaque fois)
        const reglage = ((PARAMS && PARAMS.general) || {}).carte || "google";
        if (reglage !== "demander") {
          ouvrirCarte(reglage, dest, true);
          return;
        }
        let pref = "google";
        try {
          pref = localStorage.getItem("dfa_carte") || "google";
        } catch (er) {
          /* */
        }
        const r = ev.currentTarget.getBoundingClientRect();
        const choix = [
          ["google", "Google Maps"],
          ["osm", "OpenStreetMap"],
        ].sort(a => (a[0] === pref ? -1 : 1));
        ouvrirMenuContextuel(r.left, r.bottom + 2, [
          ...choix.map(([s, n]) => ({ libelle: "Itinéraire — " + n, action: () => ouvrirCarte(s, dest, true) })),
          "-",
          ...choix.map(([s, n]) => ({ libelle: "Voir sur la carte — " + n, action: () => ouvrirCarte(s, dest, false) })),
        ]);
      },
    },
    "🗺 Itinéraire"
  );
}

/* documents libres (attestations, formulaires…) : fonction désactivable (Paramètres > Réglages), sans perdre les modèles */
function documentsLibresActifs() {
  return ((PARAMS && PARAMS.catalogue) || {}).documents_libres_actif !== false;
}
function boutonDocumentLibreFiche() {
  return documentsLibresActifs() && ((PARAMS && PARAMS.catalogue) || {}).documents_libres_bouton !== false;
}

/* fenêtre à part (mode application, sans barre d'adresse) : numéro de version dans le titre de la fenêtre */
(function versionDansTitre() {
  let fenetre = false;
  try {
    fenetre = new URLSearchParams(location.search).has("fenetre") || matchMedia("(display-mode: standalone)").matches;
  } catch (e) {
    /* */
  }
  if (!fenetre || location.protocol === "file:") return;
  fetch("/api/sante", { cache: "no-store" })
    .then(r => r.json())
    .then(s => {
      if (!s || !s.version) return;
      const suffixe = " — v" + s.version;
      const maj = () => {
        if (!document.title.endsWith(suffixe)) document.title = document.title.replace(/ — v[\d.]+$/, "") + suffixe;
      };
      maj();
      const t = document.querySelector("title");
      if (t) new MutationObserver(maj).observe(t, { childList: true, characterData: true, subtree: true });
    })
    .catch(() => {});
})();

/** imprimante dessinée (à la place de l'émoji 🖨, peu lisible), devant le texte d'un bouton d'impression */
const SVG_IMPRIMANTE =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z" fill="#fff"/><path d="M9.5 17h5M9.5 19h3.5"/><circle cx="17.5" cy="11.8" r=".9" fill="currentColor" stroke="none"/></svg>';
// petite étiquette des documents repris d'un autre logiciel (Batifree, import Excel)
function tagOrigine(d) {
  if (d.origine === "batifree") return h("span", { class: "tag-batifree", title: "Repris de Batifree : erreurs possibles" }, "Batifree");
  if (d.origine === "import") return h("span", { class: "tag-batifree", title: "Importé depuis un classeur Excel" }, "Importé");
  return null;
}

function iconeImprimante() {
  const s = document.createElement("span");
  s.className = "icone-imprimante";
  s.innerHTML = SVG_IMPRIMANTE;
  return s;
}
