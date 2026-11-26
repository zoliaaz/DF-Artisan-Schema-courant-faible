/* =====================================================================
   DEVIS
   ===================================================================== */
// lots imbriqués : 5 niveaux (lot, sous-lot, sous-sous-lot, 4e, 5e) ; niveau 0 à 4
const NIVEAU_MAX = 5; // lignes : jusqu'au contenu d'un lot de 5e niveau
const NIVEAU_MAX_LOT = 4; // lots : 5 niveaux (0 à 4), un lot a toujours un niveau en dessous pour son contenu
/** le bloc (lot et son contenu) décalé de delta reste-t-il dans les niveaux permis ? */
function niveauxPermis(bloc, delta) {
  return bloc.every(l => {
    const n = (l.niveau || 0) + delta;
    return n >= 0 && n <= (l.type === "lot" ? NIVEAU_MAX_LOT : NIVEAU_MAX);
  });
}
const MSG_NIVEAUX = "Trop de niveaux : 5 niveaux de lot au maximum";
const COULEURS_LOTS_DEF = ["#1f3f8f", "#228b22", "#a0522d", "#7b3f9e", "#2f6f7a"];
const TAILLES_LOTS_DEF = [14, 13, 12, 11, 11];
const CATEGORIES_ARTICLE = { fourniture: "Fourniture", materiel: "Matériel / engin", sous_traitance: "Sous-traitance" };
const STATUTS = { brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé", annule: "Annulé" };
/** taux de TVA proposés dans les listes (Paramètres > Personnalisation devis / factures) */
let TAUX_TVA = [20, 10, 5.5, 0];
const TAUX_TVA_DEF = [20, 10, 5.5, 0];
/** liste des taux proposés, plus le taux déjà choisi s'il n'y est plus (il reste affiché tel quel) */
function tauxAvec(valeur) {
  const v = Number(valeur);
  return valeur === undefined || valeur === null || valeur === "" || !isFinite(v) || TAUX_TVA.includes(v) ? TAUX_TVA : TAUX_TVA.concat(v);
}
function lireTauxTva(liste) {
  const t = (Array.isArray(liste) ? liste : []).map(Number).filter(x => isFinite(x) && x >= 0 && x <= 100);
  const uniques = [...new Set(t)].sort((a, b) => b - a);
  return uniques.length ? uniques : TAUX_TVA_DEF.slice();
}

const DV = { courant: null, sale: false, enCours: null, liste: [], q: "" };

/* =====================================================================
   TABLEAUX (devis, clients, catalogue) : tri par colonne, colonnes au choix
   (clic droit sur l'en-tête), choix retenus dans les paramètres.
   ===================================================================== */
const enregistrerColonnes = debounce(async () => {
  const g = PARAMS.general || {};
  try {
    await api("PUT", "/api/parametres", { general: { colonnes: g.colonnes || {}, largeurs: g.largeurs || {}, tris: g.tris || {} } });
  } catch (e) {
    erreur(e);
  }
}, 400);
/** ⚙ dans l'en-tête d'un tableau : ouvre le choix des colonnes (le même que le clic droit sur les titres) */
function boutonColonnes() {
  const b = h(
    "button",
    { class: "outil-col outil-colonnes", type: "button", title: "Choisir et ranger les colonnes (aussi : clic droit sur les titres)" },
    "⚙"
  );
  ["mousedown", "click"].forEach(t => b.addEventListener(t, e => e.stopPropagation()));
  b.addEventListener("click", () => {
    const r = b.getBoundingClientRect();
    b.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: Math.max(10, r.right - 260), clientY: r.bottom + 2 })
    );
  });
  return b;
}

/**
 * opts : { id, colonnes: [{ cle, titre, val(l) -> texte ou élément, tri(l), classe, defaut }], tri: { cle, sens },
 *          classeLigne(l), clic(l), vide }
 */
function tableauDonnees(opts) {
  PARAMS.general = PARAMS.general || {};
  PARAMS.general.colonnes = PARAMS.general.colonnes || {};
  const toutes = opts.colonnes;
  const parCle = Object.fromEntries(toutes.map(c => [c.cle, c]));
  const choix = () => {
    PARAMS.general = PARAMS.general || {};
    PARAMS.general.colonnes = PARAMS.general.colonnes || {}; // (paramètres rechargés entre-temps)
    const ch = (PARAMS.general.colonnes[opts.id] || []).filter(k => parCle[k]);
    return ch.length ? ch : toutes.filter(c => c.defaut !== false).map(c => c.cle);
  };
  // tri retenu d'une fois sur l'autre (paramètres)
  const triRetenu = ((PARAMS.general || {}).tris || {})[opts.id];
  let tri = Object.assign({}, triRetenu && parCle[triRetenu.cle] ? triRetenu : opts.tri || { cle: toutes[0].cle, sens: 1 });
  const retenirTri = () => {
    PARAMS.general.tris = PARAMS.general.tris || {};
    PARAMS.general.tris[opts.id] = { cle: tri.cle, sens: tri.sens };
    enregistrerColonnes();
  };
  let lignes = [];
  let selection = null; // ligne sélectionnée (un clic) quand elle s'ouvre par double-clic
  // double-clic pour ouvrir, sauf réglage « simple clic » (Paramètres > Réglages > Valeurs par défaut diverses)
  const dbl = () => !!opts.doubleClic && !(PARAMS.general || {}).ouvrir_simple_clic;
  // cases à cocher en première colonne (opts.selection) : actions sur plusieurs lignes
  const choisis = new Set();
  const dec = opts.selection ? 1 : 0;
  const signalerSelection = () => {
    if (opts.surSelection) opts.surSelection(choisis.size);
  };
  const table = h("table", { class: "tableau-devis tableau-donnees" });
  const menu = h("div", { class: "menu-colonnes cache" });
  const el = h("div", { class: "boite-tableau" }, table, menu);

  const fermerMenu = () => menu.classList.add("cache");
  document.addEventListener("mousedown", e => {
    if (!menu.contains(e.target)) fermerMenu();
  });
  const ouvrirMenu = (x, y) => {
    const visibles = choix();
    const ordre = visibles.concat(toutes.map(c => c.cle).filter(k => !visibles.includes(k)));
    menu.innerHTML = "";
    const appliquer = liste => {
      PARAMS.general.colonnes[opts.id] = liste;
      enregistrerColonnes();
      dessiner();
      ouvrirMenu(x, y);
    };
    ajouterA(
      menu,
      h("div", { class: "titre" }, "Colonnes affichées"),
      ordre.map(k => {
        const c = parCle[k],
          vis = visibles.includes(k),
          i = visibles.indexOf(k);
        const cb = h("input", { type: "checkbox", checked: vis });
        cb.addEventListener("change", () => {
          const v = choix().slice();
          if (cb.checked) v.push(k);
          else if (v.length > 1) v.splice(v.indexOf(k), 1);
          appliquer(v);
        });
        return h(
          "div",
          { class: "ligne-menu" },
          h("label", {}, cb, " " + c.titre),
          vis
            ? h(
                "span",
                {},
                h(
                  "button",
                  {
                    class: "icone",
                    title: "Vers la gauche",
                    disabled: i === 0,
                    onclick: () => {
                      const v = choix().slice();
                      [v[i - 1], v[i]] = [v[i], v[i - 1]];
                      appliquer(v);
                    },
                  },
                  "↑"
                ),
                h(
                  "button",
                  {
                    class: "icone",
                    title: "Vers la droite",
                    disabled: i === visibles.length - 1,
                    onclick: () => {
                      const v = choix().slice();
                      [v[i + 1], v[i]] = [v[i], v[i + 1]];
                      appliquer(v);
                    },
                  },
                  "↓"
                )
              )
            : null
        );
      }),
      h(
        "div",
        { class: "pied-menu" },
        h(
          "button",
          {
            class: "btn petit",
            onclick: () => {
              delete PARAMS.general.colonnes[opts.id];
              enregistrerColonnes();
              dessiner();
              fermerMenu();
            },
          },
          "Colonnes par défaut"
        )
      )
    );
    menu.classList.remove("cache");
    const r = el.getBoundingClientRect();
    menu.style.left = Math.max(0, Math.min(x - r.left, r.width - 260)) + "px";
    menu.style.top = y - r.top + "px";
  };

  const valeurTri = (c, l) => (c.tri ? c.tri(l) : l[c.cle]) ?? "";
  function dessiner() {
    const cols = choix().map(k => parCle[k]);
    const c = parCle[tri.cle];
    const liste = c
      ? lignes.slice().sort((a, b) => {
          const x = valeurTri(c, a),
            y = valeurTri(c, b);
          return (
            (typeof x === "number" && typeof y === "number"
              ? x - y
              : String(x).localeCompare(String(y), "fr", { numeric: true, sensitivity: "base" })) * tri.sens
          );
        })
      : lignes;
    table.innerHTML = "";
    // largeurs des colonnes réglées à la souris (bord droit des titres), retenues dans les paramètres
    PARAMS.general.largeurs = PARAMS.general.largeurs || {};
    const larg = PARAMS.general.largeurs[opts.id] || null;
    table.classList.toggle("fixe", !!larg);
    // largeur du tableau = somme des colonnes (il peut être plus étroit que la page, sans défilement)
    const majLargeurTable = l => {
      table.style.width = l ? cols.reduce((t, col) => t + (l[col.cle] || 120), 0) + 32 * dec + "px" : "";
    };
    majLargeurTable(larg);
    const colgroup = h(
      "colgroup",
      {},
      dec ? h("col", { style: "width:32px" }) : null,
      cols.map(col => h("col", { style: larg ? `width:${larg[col.cle] || 120}px` : "" }))
    );
    let ignorerClic = false;
    const poignee = (col, k) => {
      const p = h("span", { class: "poignee", title: "Glisser pour élargir ou rétrécir · double-clic : largeurs automatiques" });
      p.addEventListener("click", e => e.stopPropagation());
      p.addEventListener("dblclick", e => {
        e.stopPropagation();
        delete PARAMS.general.largeurs[opts.id];
        enregistrerColonnes();
        dessiner();
      });
      p.addEventListener("mousedown", e => {
        e.preventDefault();
        e.stopPropagation();
        // on fige d'abord toutes les largeurs actuelles, puis on règle celle-ci
        const ths = [...tete.children].slice(dec);
        const l = (PARAMS.general.largeurs[opts.id] = Object.assign({}, PARAMS.general.largeurs[opts.id] || {}));
        ths.forEach((th, i) => {
          l[cols[i].cle] = l[cols[i].cle] || Math.round(th.getBoundingClientRect().width);
        });
        ths.forEach((th, i) => {
          colgroup.children[i + dec].style.width = l[cols[i].cle] + "px";
        });
        table.classList.add("fixe");
        majLargeurTable(l);
        const x0 = e.clientX,
          w0 = l[col.cle];
        document.body.classList.add("redimension");
        const bouger = ev => {
          l[col.cle] = Math.max(40, Math.round(w0 + ev.clientX - x0));
          colgroup.children[k + dec].style.width = l[col.cle] + "px";
          majLargeurTable(l);
        };
        const lacher = () => {
          document.removeEventListener("mousemove", bouger);
          document.removeEventListener("mouseup", lacher);
          document.body.classList.remove("redimension");
          ignorerClic = true;
          setTimeout(() => {
            ignorerClic = false;
          }, 50);
          enregistrerColonnes();
        };
        document.addEventListener("mousemove", bouger);
        document.addEventListener("mouseup", lacher);
      });
      return p;
    };
    const tete = h(
      "tr",
      { title: "Clic : trier · clic droit : choisir les colonnes · bord droit : largeur" },
      cols.map((col, k) =>
        h(
          "th",
          {
            class: (col.classe || "") + (col.cle === tri.cle ? " trie" : ""),
            onclick: () => {
              if (ignorerClic) return;
              tri = { cle: col.cle, sens: tri.cle === col.cle ? -tri.sens : col.decroissant ? -1 : 1 };
              retenirTri();
              dessiner();
            },
          },
          h(
            "span",
            { class: "titre-col" },
            col.titre,
            col.cle === tri.cle ? h("span", { class: "fleche-tri" }, tri.sens > 0 ? " ▲" : " ▼") : null,
            col.outil
              ? (() => {
                  const o = col.outil();
                  ["click", "mousedown"].forEach(t => o.addEventListener(t, e => e.stopPropagation()));
                  return o;
                })()
              : null
          ),
          poignee(col, k)
        )
      )
    );
    if (dec) {
      const tout = h("input", {
        type: "checkbox",
        title: "Tout cocher / tout décocher (lignes affichées)",
        checked: liste.length > 0 && liste.every(l => choisis.has(l.id)),
      });
      tout.addEventListener("click", e => e.stopPropagation());
      tout.addEventListener("change", () => {
        liste.forEach(l => (tout.checked ? choisis.add(l.id) : choisis.delete(l.id)));
        dessiner();
        signalerSelection();
      });
      tete.prepend(h("th", { class: "col-choix" }, tout));
    }
    tete.addEventListener("contextmenu", e => {
      e.preventDefault();
      ouvrirMenu(e.clientX, e.clientY);
    });
    if (tete.lastElementChild) {
      tete.lastElementChild.classList.add("avec-outil-colonnes");
      tete.lastElementChild.append(boutonColonnes());
    }
    const corps = h("tbody");
    for (const l of liste) {
      const caseChoix = dec
        ? h(
            "td",
            { class: "col-choix" },
            (() => {
              const cb = h("input", { type: "checkbox", checked: choisis.has(l.id) });
              cb.addEventListener("click", e => e.stopPropagation());
              cb.addEventListener("change", () => {
                cb.checked ? choisis.add(l.id) : choisis.delete(l.id);
                cb.closest("tr").classList.toggle("choisie", cb.checked);
                signalerSelection();
              });
              return cb;
            })()
          )
        : null;
      // opts.doubleClic : un clic sélectionne la ligne, le double-clic l'ouvre
      const selectionner = tr => {
        corps.querySelectorAll("tr.selectionnee").forEach(x => x.classList.remove("selectionnee"));
        tr.classList.add("selectionnee");
        selection = l.id;
      };
      corps.append(
        h(
          "tr",
          {
            class:
              (opts.classeLigne ? opts.classeLigne(l) : "") +
              (choisis.has(l.id) ? " choisie" : "") +
              (dbl() && selection === l.id ? " selectionnee" : ""),
            onclick: e => {
              if (e.target.closest(".col-choix")) return;
              if (dbl()) {
                if (!e.target.closest("select, button, input, a")) selectionner(e.currentTarget);
                return;
              }
              opts.clic && opts.clic(l);
            },
            ondblclick: e => {
              if (!dbl() || e.target.closest(".col-choix, select, button, input, a")) return;
              getSelection().removeAllRanges();
              opts.clic && opts.clic(l);
            },
            oncontextmenu: ev => {
              if (dbl()) selectionner(ev.currentTarget);
              if (opts.menu && !ev.ctrlKey) {
                ev.preventDefault();
                opts.menu(l, ev);
              }
            },
          },
          caseChoix,
          cols.map(col => {
            const v = col.val ? col.val(l) : l[col.cle];
            const td = h("td", { class: col.classe || "" }, v === null || v === undefined ? "" : v);
            if (typeof v === "string" && v.length > 12) td.title = v; // texte complet au survol (colonne étroite)
            return td;
          })
        )
      );
    }
    if (!liste.length)
      corps.append(
        h(
          "tr",
          {},
          h(
            "td",
            { colspan: cols.length + dec, class: "sous", style: "text-align:center;padding:18px;cursor:default" },
            opts.vide || "Rien à afficher."
          )
        )
      );
    table.append(colgroup, h("thead", {}, tete), corps);
    requestAnimationFrame(collerTitres);
  }
  // titres des colonnes toujours visibles, sous l'en-tête de la page (qui reste en haut)
  function collerTitres() {
    const f = el.closest(".fiche"),
      e = f && f.querySelector(":scope > .entete-fiche");
    if (!f || !e) return;
    const maj = () => f.style.setProperty("--haut-entete", Math.max(0, e.offsetHeight - 16) + "px");
    maj();
    if (!e.dataset.observe && window.ResizeObserver) {
      e.dataset.observe = "1";
      new ResizeObserver(maj).observe(e);
    }
  }
  return {
    el,
    maj: l => {
      lignes = l || [];
      const ids = new Set(lignes.map(x => x.id));
      [...choisis].forEach(i => {
        if (!ids.has(i)) choisis.delete(i);
      }); // (lignes disparues)
      dessiner();
      signalerSelection();
    },
    lignes: () => lignes,
    selection: () => [...choisis],
    viderSelection: () => {
      choisis.clear();
      dessiner();
      signalerSelection();
    },
    trier: (cle, sens) => {
      tri = { cle, sens };
      retenirTri();
      dessiner();
    },
    tri: () => Object.assign({}, tri),
  };
}

/** en-tête d'une page de liste : titre, recherche alignée, filtres, boutons */
function entetePage(titre, recherche, ...autres) {
  return h("div", { class: "entete-fiche entete-liste" }, h("h2", {}, titre), recherche, ...autres);
}
/* ---------- champs de recherche : une petite croix à droite pour effacer la recherche ---------- */
function ajouterCroixRecherche(i) {
  if (i.dataset.croix || !i.parentNode) return;
  i.dataset.croix = "1";
  const actif = document.activeElement === i;
  const boite = h("span", { class: "boite-recherche" });
  // la place prise par le champ passe à la boîte (largeur, flex)
  ["width", "flex", "maxWidth", "minWidth"].forEach(k => {
    if (i.style[k]) {
      boite.style[k] = i.style[k];
      i.style[k] = "";
    }
  });
  i.parentNode.insertBefore(boite, i);
  const croix = h(
    "button",
    {
      type: "button",
      class: "croix-recherche",
      title: "Effacer la recherche",
      tabindex: "-1",
      onmousedown: e => e.preventDefault(),
      onclick: () => {
        i.value = "";
        i.dispatchEvent(new Event("input", { bubbles: true }));
        i.dispatchEvent(new Event("search", { bubbles: true }));
        maj();
        i.focus();
      },
    },
    "×"
  );
  boite.append(i, croix);
  const maj = () => croix.classList.toggle("cache", !i.value);
  i.addEventListener("input", maj);
  maj();
  if (actif) i.focus();
}
new MutationObserver(() => document.querySelectorAll('input[type="search"]:not([data-croix])').forEach(ajouterCroixRecherche)).observe(
  document.body,
  { childList: true, subtree: true }
);

function champRecherche(valeur, placeholder, quandChange) {
  const i = h("input", { type: "search", class: "recherche", placeholder, value: valeur || "" });
  i.addEventListener(
    "input",
    debounce(() => quandChange(i.value.trim()), 200)
  );
  return i;
}

/** menus Devis et Factures : même fiche (étude, client et conclusion), listes différentes */
const sectionDocs = () => sectionActive === "devis" || sectionActive === "factures";
async function sectionDevis(zone, idAOuvrir) {
  const fiche = h("div", { class: "fiche" });
  zone.append(fiche);
  DV.fiche = fiche;
  DV.section = "devis";
  DV.afficherListe = afficherTableauDevis;
  DV.rechargerListe = async () => {
    DV.liste = await api("GET", "/api/documents?type=devis&q=" + encodeURIComponent(DV.q));
    if (DV.vueTableau && DV.tableau) DV.majTableau();
  };
  DV.modeles = await api("GET", "/api/modeles?type=devis");
  DV.typeModeles = "devis";
  avantDeQuitter = () => avantDeChangerDeDevis();
  // menu « Devis » : le tableau de tous les devis ; un devis précis s'il est demandé
  if (idAOuvrir) await ouvrirDevis(idAOuvrir, fiche);
  else await afficherTableauDevis(fiche);
}

/* tableau de tous les devis (comme l'explorateur de Batifree), une couleur par état */
async function afficherTableauDevis(fiche) {
  fiche = fiche || DV.fiche;
  if (!(await avantDeChangerDeDevis())) return;
  DV.vueTableau = true;
  DV.courant = null;
  DV.filtreEtat = DV.filtreEtat || "";
  DV.liste = await api("GET", "/api/documents?type=devis&q=" + encodeURIComponent(DV.q));
  fiche.innerHTML = "";
  const t = tableauDonnees({
    id: "devis",
    tri: { cle: "date_doc", sens: -1 },
    colonnes: [
      {
        cle: "numero",
        titre: "N°",
        val: d => ajouterA(h("span"), h("b", {}, d.numero), tagOrigine(d)),
        decroissant: true,
      },
      {
        cle: "date_doc",
        titre: "Date",
        val: d => dateFr(d.date_doc),
        decroissant: true,
        outil: () =>
          h(
            "button",
            {
              class: "outil-col" + (DV.periode && DV.periode.type ? " actif" : ""),
              type: "button",
              title: "Trier par date, choisir une période",
              onclick: e =>
                menuDates(
                  e.currentTarget,
                  DV,
                  () => DV.tableau,
                  () => DV.majTableau()
                ),
            },
            "⚙"
          ),
      },
      { cle: "client_nom", titre: "Client" },
      { cle: "ref_libre", titre: "Réf. libre" },
      { cle: "chantier_adresse", titre: "Chantier", val: d => (d.chantier_adresse || "").split("\n")[0], classe: "sous" },
      { cle: "objet", titre: "Objet" },
      { cle: "interlocuteur", titre: "Interlocuteur", defaut: false },
      { cle: "client_ville", titre: "Ville du client", defaut: false },
      { cle: "total_ht", titre: "HT", val: d => euros(d.total_ht), classe: "d", decroissant: true },
      {
        cle: "total_tva",
        titre: "TVA",
        val: d => euros((d.total_ttc || 0) - (d.total_ht || 0)),
        tri: d => (d.total_ttc || 0) - (d.total_ht || 0),
        classe: "d",
        defaut: false,
      },
      { cle: "total_ttc", titre: "TTC", val: d => euros(d.total_ttc), classe: "d", decroissant: true },
      { cle: "cree_le", titre: "Créé le", val: d => dateFr(d.cree_le), classe: "sous", defaut: false, decroissant: true },
      { cle: "modifie_le", titre: "Mis à jour", val: d => dateFr(d.modifie_le), classe: "sous", decroissant: true },
      { cle: "statut", titre: "État", val: d => choixEtatListe(d) },
    ],
    classeLigne: d => "etat-" + d.statut,
    doubleClic: true,
    clic: d => ouvrirDevis(d.id, fiche).catch(erreur),
    menu: (d, ev) => menuListeDevis(d, ev),
    vide: DV.q
      ? "Aucun devis ne correspond à la recherche."
      : "Aucun devis. Cliquez sur « + Nouveau » à côté de Devis, dans la colonne de gauche.",
  });
  DV.tableau = t;
  const resume = h("span", { class: "sous" });
  // période choisie (menu ⚙ du titre « Date ») : rappelée dans la barre, ✕ pour la retirer
  const etiquettePeriode = h("span", { class: "etiquette-periode cache" });
  const majEtiquette = () => {
    const p = DV.periode || {};
    etiquettePeriode.classList.toggle("cache", !p.type);
    if (!p.type) return;
    const [du, au] = bornesPeriode(p);
    const lib =
      p.type === "perso" && du && !au
        ? "Depuis le " + dateFr(du)
        : p.type === "perso" && !du && au
          ? "Jusqu'au " + dateFr(au)
          : p.type === "perso"
            ? (du ? dateFr(du) : "…") + " – " + (au ? dateFr(au) : "…")
            : (PERIODES.find(x => x[0] === p.type) || [])[1];
    etiquettePeriode.title = (du ? dateFr(du) : "…") + " – " + (au ? dateFr(au) : "…") + " (choisie avec ⚙ dans le titre « Date »)";
    etiquettePeriode.replaceChildren(
      h("span", {}, lib || "Toutes les dates"),
      h(
        "button",
        {
          class: "icone",
          type: "button",
          title: "Retirer la période",
          onclick: () => {
            DV.periode = { type: "" };
            DV.majTableau();
          },
        },
        "✕"
      )
    );
  };
  DV.majTableau = () => {
    majEtiquette();
    const [du, au] = bornesPeriode(DV.periode);
    const liste = DV.liste.filter(
      d =>
        (!DV.filtreEtat || d.statut === DV.filtreEtat) &&
        (!du || (d.date_doc || "") >= du) &&
        (!au || (d.date_doc || "").slice(0, 10) <= au)
    );
    t.maj(liste);
    resume.textContent = `${liste.length} devis · ${euros(liste.reduce((s, d) => s + Number(d.total_ht || 0), 0))} HT`;
  };
  const filtres = h(
    "div",
    { class: "sous-onglets" },
    [["", "Tous"], ...Object.entries(STATUTS)].map(([k, v]) =>
      h(
        "button",
        {
          class: DV.filtreEtat === k ? "actif" : "",
          onclick: e => {
            DV.filtreEtat = k;
            filtres.querySelectorAll("button").forEach(b => b.classList.remove("actif"));
            e.currentTarget.classList.add("actif");
            DV.majTableau();
          },
        },
        v
      )
    )
  );
  const recherche = champRecherche(DV.q, "Rechercher (n°, client, objet, réf., ville)…", async q => {
    DV.q = q;
    await DV.rechargerListe();
  });
  fiche.append(
    entetePage("Tous les devis", recherche, filtres, etiquettePeriode, h("span", { class: "espace" }), resume),
    t.el,
    h(
      "p",
      { class: "aide" },
      "Double-clic sur une ligne : ouvrir le devis (un clic la sélectionne) · clic droit sur une ligne : dupliquer, imprimer, supprimer… · clic sur un titre : trier (ex. « Date ») · clic droit sur les titres : choisir et ranger les colonnes · l'état se change directement dans sa colonne."
    )
  );
  DV.majTableau();
  setTimeout(() => recherche.focus(), 30);
}

function marquerChoisi() {
  /* (ancienne liste de gauche) */
}

/** état d'un devis modifiable directement dans la liste */
function choixEtatListe(d) {
  const sel = h(
    "select",
    { class: "puce choix-etat " + d.statut, title: "Changer l'état du devis" },
    Object.entries(STATUTS).map(([k, v]) => h("option", { value: k, selected: d.statut === k }, v))
  );
  ["click", "mousedown", "contextmenu"].forEach(t => sel.addEventListener(t, e => e.stopPropagation()));
  sel.addEventListener("change", async () => {
    const avant = d.statut,
      apres = sel.value;
    const corps = { statut: apres };
    if (
      avant === "accepte" &&
      apres !== "accepte" &&
      confirm(`Le devis ${d.numero} n'est plus accepté. Déverrouiller les prix de toutes ses lignes ?`)
    )
      corps.deverrouiller = true;
    try {
      await api("PUT", "/api/documents/" + d.id, corps);
      d.statut = apres;
      toast(`Devis ${d.numero} : ${STATUTS[apres]}` + (apres === "accepte" ? " — prix des lignes verrouillés 🔒" : ""));
      DV.majTableau();
    } catch (e) {
      sel.value = avant;
      erreur(e);
    }
  });
  return sel;
}

/** période (devis, et bientôt factures) : mois, trimestre, année, ou dates choisies */
const PERIODES = [
  ["", "Toutes les dates"],
  ["mois", "Ce mois-ci"],
  ["mois-1", "Le mois dernier"],
  ["trimestre", "Ce trimestre"],
  ["annee", "Cette année"],
  ["annee-1", "L'année dernière"],
  ["exercice", "Exercice en cours"],
  ["exercice-1", "Exercice précédent"],
  ["12mois", "Les 12 derniers mois"],
  ["perso", "Période…"],
];
/** mois de début de l'exercice comptable (1 = janvier), réglé dans Paramètres > Réglages */
const moisExercice = () => Math.min(12, Math.max(1, Number(((PARAMS || {}).entreprise || {}).debut_exercice) || 1));
function bornesPeriode(p) {
  p = p || {};
  const iso = x => x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  const t = new Date(),
    a = t.getFullYear(),
    m = t.getMonth();
  switch (p.type) {
    case "mois":
      return [iso(new Date(a, m, 1)), iso(new Date(a, m + 1, 0))];
    case "mois-1":
      return [iso(new Date(a, m - 1, 1)), iso(new Date(a, m, 0))];
    case "trimestre": {
      const q = Math.floor(m / 3) * 3;
      return [iso(new Date(a, q, 1)), iso(new Date(a, q + 3, 0))];
    }
    case "annee":
      return [a + "-01-01", a + "-12-31"];
    case "annee-1":
      return [a - 1 + "-01-01", a - 1 + "-12-31"];
    case "exercice":
    case "exercice-1": {
      const m0 = moisExercice() - 1,
        debut = (m >= m0 ? a : a - 1) - (p.type === "exercice-1" ? 1 : 0);
      return [iso(new Date(debut, m0, 1)), iso(new Date(debut + 1, m0, 0))];
    }
    case "12mois":
      return [iso(new Date(a - 1, m, t.getDate() + 1)), iso(t)];
    case "perso":
      return [p.du || "", p.au || ""];
    default:
      return ["", ""];
  }
}
/** menu ⚙ du titre « Date » : ordre de tri et période */
function menuDates(bouton, etat, tableau, maj) {
  document.querySelectorAll(".menu-dates").forEach(m => m.remove());
  etat.periode = etat.periode || { type: "" };
  const t = tableau(),
    tri = t.tri();
  const menu = h("div", { class: "menu-dates" });
  const fermer = () => {
    menu.remove();
    document.removeEventListener("mousedown", dehors, true);
  };
  const dehors = e => {
    if (!menu.contains(e.target) && e.target !== bouton) fermer();
  };
  const item = (lib, actif, action) =>
    h("button", { type: "button", class: "item" + (actif ? " actif" : ""), onclick: action }, (actif ? "✓ " : "") + lib);
  const du = h("input", { type: "date", value: etat.periode.du || "" }),
    au = h("input", { type: "date", value: etat.periode.au || "" });
  const appliquerDates = () => {
    etat.periode = { type: "perso", du: du.value, au: au.value };
    maj();
  };
  du.addEventListener("change", appliquerDates);
  au.addEventListener("change", appliquerDates);

  ajouterA(
    menu,
    h("div", { class: "titre" }, "Trier"),
    item("Plus récents d'abord", tri.cle === "date_doc" && tri.sens < 0, () => {
      t.trier("date_doc", -1);
      fermer();
    }),
    item("Plus anciens d'abord", tri.cle === "date_doc" && tri.sens > 0, () => {
      t.trier("date_doc", 1);
      fermer();
    }),
    h("div", { class: "titre" }, "Période"),
    // exercice commençant en janvier = l'année civile : « Cette année » ; sinon « Exercice en cours » à la place
    PERIODES.filter(([k]) => k !== "perso" && (moisExercice() === 1 ? !k.startsWith("exercice") : !k.startsWith("annee"))).map(([k, v]) =>
      item(v, (etat.periode.type || "") === k, () => {
        etat.periode = { type: k };
        maj();
        fermer();
      })
    ),
    h(
      "div",
      {
        class: "dates-perso" + (etat.periode.type === "perso" ? " actif" : ""),
        title: "« au » vide : depuis cette date, sans date de fin",
      },
      h("span", {}, "Du"),
      du,
      h("span", {}, "au"),
      au
    )
  );
  document.body.append(menu);
  const r = bouton.getBoundingClientRect();
  menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 10) + "px";
  menu.style.top = r.bottom + 4 + "px";
  setTimeout(() => document.addEventListener("mousedown", dehors, true), 0);
}

async function nouveauDevis(fiche, _e, _p, clientId) {
  if (!(await avantDeChangerDeDevis())) return;
  const d = await api("POST", "/api/documents", { client_id: clientId || null });
  DV.onglet = "client";
  await ouvrirDevis(d.id, fiche || DV.fiche);
  setTimeout(() => {
    const i = $("#champ-client");
    if (i && !clientId) i.focus();
  }, 50);
}

/** champs libres du devis (nommés dans Paramètres > Réglages) : utilisables dans les textes par {{libre1}}…
    Le devis garde le nom du champ au moment où il a été rempli : si le champ est renommé ou retiré plus tard,
    la valeur reste (et s'imprime toujours) et l'ancien nom est indiqué. */
function cadreChampsLibres(d) {
  const noms = ((PARAMS.devis || {}).champs_libres || []).slice(0, 5);
  d.champs_libres = d.champs_libres && typeof d.champs_libres === "object" ? d.champs_libres : {};
  const L = d.champs_libres;
  L.noms = L.noms && typeof L.noms === "object" ? L.noms : {};
  const lignes = [];
  for (let i = 0; i < 5; i++) {
    const cle = "libre" + (i + 1),
      actuel = String(noms[i] || "").trim(),
      valeur = String(L[cle] || ""),
      ancien = String(L.noms[cle] || "").trim();
    if (!actuel && !valeur.trim()) continue;
    // devis rempli avant ce changement : on garde le nom d'alors
    if (valeur.trim() && !ancien && actuel) L.noms[cle] = actuel;
    const note = !valeur.trim()
      ? null
      : !actuel
        ? h(
            "span",
            {
              class: "note-champ",
              title:
                "Ce champ n'existe plus dans les Paramètres : la valeur reste dans ce devis et s'imprime toujours là où {{" +
                cle +
                "}} est utilisé.",
            },
            "champ retiré des Paramètres"
          )
        : ancien && ancien !== actuel
          ? h(
              "span",
              { class: "note-champ", title: "Le champ a été renommé dans les Paramètres après que ce devis a été rempli." },
              "rempli sous « " + ancien + " »"
            )
          : null;
    const i2 = h("input", {
      type: "text",
      value: valeur,
      placeholder: "{{" + cle + "}}",
      title: "Utilisable dans les textes avec {{" + cle + "}}",
      "data-champ": cle,
    });
    i2.addEventListener("input", () => {
      L[cle] = i2.value;
      if (i2.value.trim()) L.noms[cle] = actuel || ancien;
      else delete L.noms[cle];
      modifie();
    });
    lignes.push(h("label", { class: "champ" }, h("span", {}, actuel || ancien || "Champ libre " + (i + 1), note), i2));
  }
  if (!lignes.length) return null;
  return h(
    "div",
    { class: "encadre champs-libres" },
    h("div", { class: "titre-cadre" }, "Champs libres"),
    h("div", { class: "pile" }, lignes)
  );
}
/** liste de choix sous un champ, ouverte dès qu'on clique dedans (filtrée en tapant ; flèches et Entrée) */
function listeSousChamp(input, valeurs, choisir) {
  const liste = h("div", { class: "liste-sous-champ cache" });
  let actif = -1;
  const visibles = () => {
    const q = input.value.trim().toLowerCase(),
      v = valeurs() || [];
    if (v.some(x => x.toLowerCase() === q)) return v; // déjà choisi : toute la liste, pour en changer
    const f = v.filter(x => !q || x.toLowerCase().includes(q));
    return f.length ? f : v; // champ déjà rempli : on montre quand même toute la liste
  };
  const dessiner = () => {
    const v = visibles();
    liste.replaceChildren(
      ...v.map((x, i) => {
        const it = h("div", { class: "item" + (i === actif ? " actif" : "") }, x);
        it.addEventListener("mousedown", e => {
          e.preventDefault();
          choisir(x);
          fermer();
        });
        return it;
      })
    );
    liste.classList.toggle("cache", !v.length);
  };
  let minuterie = null;
  const fermer = () => {
    clearTimeout(minuterie);
    liste.classList.add("cache");
    actif = -1;
  };
  input.addEventListener("focus", () => {
    clearTimeout(minuterie);
    actif = -1;
    dessiner();
  });
  input.addEventListener("click", () => {
    if (liste.classList.contains("cache")) dessiner();
  });
  input.addEventListener("input", () => {
    actif = -1;
    dessiner();
  });
  input.addEventListener("blur", () => {
    clearTimeout(minuterie);
    minuterie = setTimeout(fermer, 100);
  });
  input.addEventListener("keydown", e => {
    if (liste.classList.contains("cache")) return;
    const v = visibles();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      actif = Math.min(v.length - 1, actif + 1);
      dessiner();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      actif = Math.max(0, actif - 1);
      dessiner();
    } else if (e.key === "Enter" && actif >= 0) {
      e.preventDefault();
      choisir(v[actif]);
      fermer();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fermer();
    }
  });
  return liste;
}
/** fenêtre : chercher un client, puis choisir son adresse ou celle d'un de ses contacts (pour l'adresse du chantier) */
function choisirAdresseClient(choisir) {
  const recherche = h("input", { type: "search", placeholder: "Nom, ville, code postal…", style: "width:100%" });
  const zone = h("div", { style: "max-height:55vh;overflow:auto;margin-top:8px" });
  const adresse = x => [(x.adresse || "").replace(/\n/g, ", "), [x.cp, x.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const montrerClient = async c => {
    const cl = await api("GET", "/api/clients/" + c.id);
    const choix = [
      [cl.nom_affiche || c.nom_affiche, adresse(cl)],
      ...(cl.contacts || []).filter(k => k.adresse || k.ville).map(k => [k.nom || cl.nom_affiche, adresse(k)]),
    ].filter(x => x[1]);
    // une seule adresse (client sans contact) : prise directement
    if (choix.length === 1) {
      choisir(choix[0][0] + "\n" + choix[0][1]);
      fermerModale();
      return;
    }
    zone.replaceChildren(
      h("button", { class: "btn petit", onclick: () => chercher() }, "← Autres clients"),
      h("p", { class: "sous" }, (cl.nom_affiche || "") + " : choisissez l'adresse du chantier"),
      choix.length
        ? h(
            "table",
            { class: "resultats" },
            h(
              "tbody",
              {},
              choix.map(([nom, rue]) =>
                h(
                  "tr",
                  {
                    class: "cliquable",
                    onclick: () => {
                      choisir(nom + "\n" + rue);
                      fermerModale();
                    },
                  },
                  h("td", {}, h("b", {}, nom)),
                  h("td", {}, rue)
                )
              )
            )
          )
        : h("p", { class: "aide" }, "Ce client n'a pas d'adresse.")
    );
  };
  const chercher = debounce(async () => {
    const l = await api("GET", "/api/clients?q=" + encodeURIComponent(recherche.value.trim()));
    zone.replaceChildren(
      l.length
        ? h(
            "table",
            { class: "resultats" },
            h(
              "tbody",
              {},
              l
                .slice(0, 80)
                .map(c =>
                  h(
                    "tr",
                    { class: "cliquable", onclick: () => montrerClient(c).catch(erreur) },
                    h("td", {}, h("b", {}, c.nom_affiche || c.nom || "")),
                    h("td", { class: "sous" }, [c.cp, c.ville].filter(Boolean).join(" "))
                  )
                )
            )
          )
        : h("p", { class: "aide" }, "Aucun client trouvé.")
    );
  }, 200);
  recherche.addEventListener("input", chercher);
  ouvrirModale(
    "Adresse du chantier : prendre celle d'un client",
    [recherche, zone],
    [h("button", { class: "btn", onclick: fermerModale }, "Annuler")],
    { largeur: "640px" }
  );
  chercher();
}
async function ouvrirDevis(id, fiche) {
  if (!(await avantDeChangerDeDevis())) return;
  DV.vueTableau = false;
  const d = await api("GET", "/api/documents/" + id);
  await chargerArticlesDevis(d);
  // conclusions proposées : celles des devis, des factures, des factures d'acompte ou des avoirs
  const typeModeles = typeConclusion(d);
  if (DV.typeModeles !== typeModeles || !DV.modeles) {
    DV.modeles = await api("GET", "/api/modeles?type=" + typeModeles);
    DV.typeModeles = typeModeles;
  }
  // facture émise : ce qui est facturé ne change plus ; seuls les achats (composition des tâches) se corrigent, pour l'analyse.
  // avoir émis : rien ne change.
  DV.factureEmise = d.type === "facture" && !!d.emise_le;
  DV.lectureSeule = d.type === "avoir" && !!d.emise_le;
  DV.courant = d;
  initHisto();
  DV.sale = false;
  DV.active = null;
  DV.filtre = "";
  DV.onglet = DV.ongletSuivant || "client"; // un devis s'ouvre toujours sur « Client et conclusion »
  DV.ongletSuivant = null;
  marquerChoisi(id);
  dessinerDevis(fiche);
  etatEnregistrement("");
}

const sauverPlusTard = debounce(() => enregistrerDevis().catch(erreur), 1200);
/** devis enregistrés tout seuls (par défaut), ou seulement avec « Enregistrer » / Ctrl+S (Paramètres > Réglages) */
const autoEnregistrement = () => ((PARAMS || {}).devis || {}).enregistrement_auto !== false;
function modifie() {
  if (DV.majARemplir) setTimeout(DV.majARemplir);
  if (DV.lectureSeule) {
    const d = DV.courant;
    toast(
      `${libelleFact(d)} est ${accordFact(d, "émise")} : non modifiable${d.type === "facture" ? " (pour la corriger : un avoir)" : ""}.`,
      true
    );
    return;
  }
  DV.sale = true;
  noterEtatPlusTard();
  if (typeof majBoutonsHistoVite === "function") majBoutonsHistoVite();
  if (autoEnregistrement()) {
    etatEnregistrement("Modifications en cours…");
    sauverPlusTard();
  } else etatEnregistrement("● Non enregistré (Ctrl+S)");
}
/** question à trois réponses : 1, 2 ou 3 (3 = annuler) */
function questionTrois(texte, b1, b2, b3) {
  return new Promise(res => {
    const fin = v => {
      fermerModale();
      res(v);
    };
    ouvrirModale("Modifications non enregistrées", h("p", { style: "margin:0" }, texte), [
      h("button", { class: "btn", onclick: () => fin(3) }, b3),
      h("button", { class: "btn", onclick: () => fin(2) }, b2),
      h("button", { class: "btn principal", onclick: () => fin(1) }, b1),
    ]);
    setTimeout(() => {
      const b = $("#modale-boite .modale-pied .principal");
      if (b) b.focus();
    }, 40);
  });
}
/** avant de quitter le devis ouvert (autre devis, liste, autre menu) : true = on peut continuer */
async function avantDeChangerDeDevis() {
  if (!DV.courant || !DV.sale) return true;
  if (autoEnregistrement()) {
    await enregistrerDevis();
    return true;
  }
  const r = await questionTrois(
    `Le devis ${DV.courant.numero} a des modifications non enregistrées.`,
    "Enregistrer",
    "Ne pas enregistrer",
    "Annuler"
  );
  if (r === 1) {
    await enregistrerDevis();
    return true;
  }
  if (r === 2) {
    DV.sale = false;
    etatEnregistrement("");
    return true;
  }
  return false;
}
/** avant une action qui lit le devis enregistré (aperçu, PDF, copie…) */
async function enregistrerAvant(action) {
  if (!DV.courant || !DV.sale) return true;
  if (autoEnregistrement()) {
    await enregistrerDevis();
    return true;
  }
  const r = await questionTrois(
    `Le devis a des modifications non enregistrées. Les enregistrer avant ${action} ?`,
    "Enregistrer",
    "Continuer sans enregistrer",
    "Annuler"
  );
  if (r === 1) {
    await enregistrerDevis();
    return true;
  }
  return r === 2;
}

async function enregistrerDevis(options) {
  if (!DV.courant || !DV.sale) return;
  if (DV.enCours) await DV.enCours;
  const d = DV.courant;
  const corps = {
    date_doc: d.date_doc,
    client_id: d.client_id,
    objet: d.objet,
    chantier_adresse: d.chantier_adresse,
    statut: d.statut,
    validite_jours: d.validite_jours,
    autoliquidation: !!d.autoliquidation,
    mention_gratuit: !!d.mention_gratuit,
    note_entete: d.note_entete,
    texte_conditions: d.texte_conditions,
    texte_libre: d.texte_libre,
    echeancier: d.echeancier || [],
    debut_travaux: d.debut_travaux || "",
    duree_intervention: d.duree_intervention || "",
    modele_id: d.modele_id || null,
    mention_tva_reduite: !!d.mention_tva_reduite,
    tva_reduite_auto: d.tva_reduite_auto === 0 ? 0 : 1,
    tva_defaut: d.tva_defaut ?? null,
    ref_libre: d.ref_libre || "",
    interlocuteur: d.interlocuteur || "",
    champs_libres: d.champs_libres || {},
    temps_passe: d.temps_passe ?? null,
    temps_devis: d.temps_devis ?? null,
    trajets: d.trajets ?? null,
    trajet_duree: d.trajet_duree ?? null,
    postes: d.postes || [],
    ...(estFact(d)
      ? { date_echeance: d.date_echeance || "", date_travaux: d.date_travaux || "", nature_operation: d.nature_operation || "" }
      : {}),
    lignes: d.lignes.map(l => ({
      type: l.type,
      niveau: l.niveau || 0,
      option: !!l.option,
      ref: l.ref || "",
      designation: l.designation,
      unite: l.unite,
      quantite: l.quantite,
      prix_unitaire: l.prix_unitaire,
      tva: l.tva,
      prix_achat: l.prix_achat,
      article_id: l.article_id,
      ouvrage_id: l.ouvrage_id,
      composition: l.type === "tache" ? l.composition || [] : null,
      prix_impose: !!l.prix_impose,
      ouvert: !!l.ouvert,
      replie: !!l.replie,
      verrouille: !!l.verrouille,
      avancement: aAvancement(l) ? nombre(l.avancement) : null,
      avancement_prec: aAvancement(l) ? nombre(l.avancement_prec) : null,
    })),
  };
  if (estFact(d)) delete corps.statut; // (l'état d'une facture change seulement en la validant)
  if (DV.factureEmise)
    Object.keys(corps).forEach(k => {
      if (!["lignes", "temps_passe", "temps_devis", "trajets", "trajet_duree"].includes(k)) delete corps[k];
    });
  corps._modifie_le = d.modifie_le || null; // (refusé si enregistré entre-temps dans un autre onglet)
  DV.sale = false;
  etatEnregistrement("Enregistrement…");
  DV.enCours = api("PUT", "/api/documents/" + d.id, corps, options)
    .then(res => {
      etatEnregistrement("Enregistré ✓");
      d.modifie_le = res.modifie_le;
      const item = DV.liste.find(x => x.id === d.id);
      if (item) {
        Object.assign(item, {
          total_ttc: res.totaux.total_ttc,
          total_ht: res.totaux.total_ht,
          objet: res.objet,
          client_nom: res.client_nom,
          statut: res.statut,
          date_doc: res.date_doc,
          ref_libre: res.ref_libre,
          chantier_adresse: res.chantier_adresse,
          modifie_le: res.modifie_le,
        });
        const el = document.querySelector(`.liste .element[data-id="${d.id}"]`);
        if (el) {
          el.querySelector(".l1 span:last-child").textContent = euros(res.totaux.total_ttc);
          const l2 = el.querySelectorAll(".l2");
          l2[0].textContent = (res.client_nom || "— sans client —") + (res.ref_libre ? " · " + res.ref_libre : "");
          l2[1].textContent = res.objet || "";
          el.querySelector(".l3 span").textContent = dateFr(res.date_doc);
          const puce = el.querySelector(".puce");
          puce.className = "puce " + res.statut;
          puce.textContent = STATUTS[res.statut] || res.statut;
        }
      }
    })
    .catch(e => {
      DV.sale = true;
      etatEnregistrement("⚠ Non enregistré");
      throw e;
    })
    .finally(() => {
      DV.enCours = null;
    });
  return DV.enCours;
}
window.addEventListener("beforeunload", e => {
  if (!DV.sale) return;
  if (autoEnregistrement()) enregistrerDevis({ keepalive: true });
  else {
    e.preventDefault();
    e.returnValue = "";
  } // (le navigateur demande de confirmer la fermeture)
});
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (sectionDocs()) enregistrerDevis().catch(erreur);
    else {
      const b = document.querySelector("[data-enregistrer]");
      if (b) b.click();
    }
  }
});
