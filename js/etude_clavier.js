/* ---------- raccourcis clavier de l'étude ---------- */
const RACCOURCIS = [
  [
    "Ajouter (sous la ligne sélectionnée)",
    [
      ["Alt+C", "Depuis le catalogue (ouvrages et articles)"],
      ["Alt+L", "Lot"],
      ["Alt+T", "Ouvrage"],
      ["Alt+N", "Ligne libre"],
      ["Alt+X", "Texte"],
      ["Alt+I", "Lots, ouvrages ou lignes d'un autre devis"],
    ],
  ],
  [
    "Dans la composition de l'ouvrage sélectionnée",
    [
      ["Alt+M", "Main d'œuvre"],
      ["Alt+F", "Fourniture"],
      ["Alt+A", "Autre / sous-traitance"],
      ["Alt+Entrée", "Ouvrir / fermer la composition (ou le lot)"],
      ["Alt+Maj+↑ / ↓", "Monter / descendre l'élément où est le curseur"],
      ["Alt+Suppr", "Retirer l'élément où est le curseur"],
    ],
  ],
  [
    "Se déplacer",
    [
      ["↑ / ↓", "Même colonne, ligne précédente / suivante (dans une désignation : depuis sa première / dernière ligne)"],
      ["Alt+↑ / Alt+↓", "Ligne précédente / suivante"],
      ["Tab / Maj+Tab", "Case suivante / précédente"],
    ],
  ],
  [
    "Annuler",
    [
      ["Ctrl+Z", "Annuler la dernière action (ajout, suppression, déplacement, saisie…)"],
      ["Ctrl+Y", "Rétablir"],
    ],
  ],
  [
    "Ranger la ligne sélectionnée",
    [
      ["Alt+Maj+↑ / ↓", "Monter / descendre"],
      ["Alt+Maj+← / →", "Sortir du lot / mettre dans le lot au-dessus"],
      ["Alt+D", "Dupliquer"],
      ["Alt+O", "Mettre en option (ou l'enlever)"],
      ["Alt+Suppr", "Supprimer"],
    ],
  ],
  [
    "Mise en forme du texte",
    [
      ["Ctrl+B", "Gras"],
      ["Ctrl+I", "Italique"],
      ["Ctrl+U", "Souligné"],
      ["- puis espace", "Puce en début de ligne"],
    ],
  ],
  [
    "Menu et recherche",
    [
      ["Clic droit / touche Menu", "Menu de la ligne (toutes les actions, avec leurs raccourcis)"],
      ["Maj+F10", "Menu de la ligne (sans touche Menu)"],
      ["Ctrl+clic droit", "Menu habituel du navigateur (copier, orthographe)"],
      ["Ctrl+F", "Rechercher dans l'étude"],
      ["Échap", "Effacer la recherche"],
    ],
  ],
];
function fenetreRaccourcis() {
  ouvrirModale(
    "Raccourcis clavier de l'étude",
    ajouterA(
      h("div"),
      RACCOURCIS.map(([titre, liste]) =>
        h(
          "div",
          { style: "margin-bottom:12px" },
          h("h3", { style: "margin:0 0 4px" }, titre),
          h(
            "table",
            { class: "resultats raccourcis" },
            h(
              "tbody",
              {},
              liste.map(([t, lib]) => h("tr", {}, h("td", {}, h("kbd", {}, t)), h("td", {}, lib)))
            )
          )
        )
      ),
      h(
        "p",
        { class: "aide" },
        "Les raccourcis s'appliquent à la ligne sélectionnée (celle où se trouve le curseur, repérée par le trait bleu à gauche). Ils sont aussi indiqués au survol des boutons."
      )
    ),
    [
      h("button", { class: "btn", onclick: imprimerRaccourcis }, iconeImprimante(), "Imprimer la liste"),
      h("button", { class: "btn principal", onclick: fermerModale }, "Fermer"),
    ],
    { largeur: "min(620px, 94vw)" }
  );
}
/** la liste des raccourcis sur une feuille A4 (à garder à côté du clavier) */
function imprimerRaccourcis() {
  const e = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const corps = RACCOURCIS.map(
    ([titre, liste]) =>
      `<h2>${e(titre)}</h2><table>${liste.map(([t, lib]) => `<tr><td class="t"><kbd>${e(t)}</kbd></td><td>${e(lib)}</td></tr>`).join("")}</table>`
  ).join("");
  const w = window.open("", "_blank");
  if (!w) {
    toast("Le navigateur a bloqué la fenêtre d'impression.", true);
    return;
  }
  w.document
    .write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Raccourcis clavier de l'étude — DF artisan</title><style>
    @page { size: A4; margin: 12mm; } body { font: 10.5pt/1.3 Arial, sans-serif; color: #111; margin: 0; }
    h1 { font-size: 15pt; margin: 0 0 6px; } h2 { font-size: 11pt; margin: 10px 0 3px; break-after: avoid; }
    table { border-collapse: collapse; width: 100%; break-inside: avoid; } td { border-bottom: 1px solid #ddd; padding: 2px 6px; vertical-align: top; }
    td.t { white-space: nowrap; width: 1%; } kbd { font: 600 9.5pt Consolas, monospace; background: #f1f3f7; border: 1px solid #c9ced8; border-radius: 3px; padding: 0 4px; }
    p { font-size: 9pt; color: #555; }</style></head><body><h1>DF artisan — raccourcis clavier de l'étude</h1>${corps}
    <p>Les raccourcis s'appliquent à la ligne sélectionnée (celle où se trouve le curseur, repérée par le trait bleu à gauche).</p></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 300);
}
const dansEtude = () => sectionDocs() && DV.courant && !DV.vueTableau && DV.onglet === "etude";
["keydown", "keyup"].forEach(t =>
  document.addEventListener(
    t,
    e => {
      if (e.key === "Alt" && dansEtude()) e.preventDefault();
    },
    true
  )
);

/**
 * Commande de l'étude (raccourci Alt+…, ou menu clic droit). k : touche ("t", "ArrowUp", "Delete"…),
 * shift : Maj enfoncée, cible : élément où est le curseur (pour les éléments de composition). Renvoie true si fait.
 */
function commandeEtude(k, shift, cible) {
  if (DV.lectureSeule) return false;
  // facture émise : seulement dans la composition d'une tâche (achats)
  if (
    DV.factureEmise &&
    !(["m", "f", "a", "k", "u"].includes(String(k).toLowerCase()) || (cible && cible.closest && cible.closest(".composition-boite")))
  )
    return false;
  const tbody = DV.tbody;
  if (!tbody) return false;
  const i = DV.active;
  const ligne = i !== null && i !== undefined ? tbody.querySelector(`tr[data-i="${i}"]:not(.composition)`) : null;
  const cliquer = (zone, rc) => {
    const b = zone && zone.querySelector(`[data-rc="${rc}"]`);
    if (b && !b.disabled) {
      b.click();
      return true;
    }
    return false;
  };
  const refocus = () =>
    setTimeout(() => {
      if (DV.active !== null && DV.active !== undefined) focusLigne(DV.tbody, DV.active);
    }, 40);
  // curseur dans un élément de composition : Alt+Maj+↑/↓ et Alt+Suppr agissent sur cet élément
  const trComp = cible && cible.closest && cible.closest(".composition-boite tbody tr");
  if (trComp && ((shift && (k === "ArrowUp" || k === "ArrowDown")) || (!shift && k === "Delete"))) {
    const corpsComp = trComp.parentNode,
      rang = [...corpsComp.children].indexOf(trComp);
    const td = cible.closest("td");
    const cellule = td ? [...trComp.children].indexOf(td) : 2;
    const rc = k === "Delete" ? "suppr" : k === "ArrowUp" ? "haut" : "bas";
    const b = trComp.querySelector(`[data-rc="${rc}"]`);
    if (b && !b.disabled) {
      b.click();
      const nouveau = k === "Delete" ? Math.min(rang, corpsComp.children.length - 1) : rang + (k === "ArrowUp" ? -1 : 1);
      const tr2 = corpsComp.children[nouveau];
      const champ = tr2 && tr2.children[cellule] && tr2.children[cellule].querySelector("input, select");
      if (champ) champ.focus();
    } else if (b && b.disabled && estVerrouillee(DV.courant.lignes[i])) avertirVerrou();
    return true;
  }
  if (!shift && ["c", "l", "t", "n", "x", "i"].includes(k)) return cliquer(DV.zones && DV.zones.etude, k);
  if (!shift && ["m", "f", "a", "k", "u"].includes(k) && ligne && ligne.classList.contains("tache")) {
    const l = DV.courant.lignes[i];
    if (!DV.ouverts.has(l)) {
      DV.ouverts.add(l);
      DV.redessiner();
    }
    const fait = cliquer(DV.tbody.querySelector(`tr.composition[data-i="${i}"]`), k);
    // curseur dans le nouvel élément
    setTimeout(() => {
      const tr = DV.tbody.querySelector(`tr.composition[data-i="${i}"] tbody tr:last-child`);
      const inp = tr && (tr.querySelector('td[data-col="ref"] input, td[data-col="ref"] select') || tr.querySelector("input"));
      if (inp) inp.focus();
    }, 50);
    return fait;
  }
  if (!shift && k === "Enter" && ligne) {
    const b = ligne.querySelector(".icone.deplie");
    if (b) {
      b.click();
      refocus();
      return true;
    }
    return false;
  }
  if (!shift && (k === "ArrowUp" || k === "ArrowDown")) {
    const lignes = [...tbody.querySelectorAll("tr[data-i]:not(.composition)")].map(tr => Number(tr.dataset.i));
    const pos = lignes.indexOf(i);
    const c = pos < 0 ? lignes[0] : lignes[Math.max(0, Math.min(lignes.length - 1, pos + (k === "ArrowUp" ? -1 : 1)))];
    if (c !== undefined) {
      DV.active = c;
      focusLigne(tbody, c);
      return true;
    }
    return false;
  }
  if (shift && ligne && { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 }[k]) {
    const avant = DV.courant.lignes[i];
    const fait = cliquer(ligne, { ArrowUp: "haut", ArrowDown: "bas", ArrowLeft: "gauche", ArrowRight: "droite" }[k]);
    DV.active = DV.courant.lignes.indexOf(avant);
    refocus();
    return fait;
  }
  if (!shift && ligne && ["d", "o"].includes(k)) {
    const fait = cliquer(ligne, k);
    refocus();
    return fait;
  }
  if (!shift && ligne && k === "Delete") return cliquer(ligne, "suppr");
  return false;
}
document.addEventListener(
  "keydown",
  e => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (!dansEtude() || !$("#modale").classList.contains("cache") || MENU_CTX) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (commandeEtude(k, e.shiftKey, e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true
);
// Ctrl+F dans l'étude : la recherche de l'étude (au lieu de celle du navigateur)
document.addEventListener(
  "keydown",
  e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "f") return;
    if (!dansEtude() || !$("#modale").classList.contains("cache") || !DV.champFiltre) return;
    e.preventDefault();
    DV.champFiltre.focus();
    DV.champFiltre.select();
  },
  true
);

/* ---------------- menu contextuel (clic droit, touche Menu, Maj+F10) ---------------- */
let MENU_CTX = null; // menus ouverts (le menu principal puis ses sous-menus)
function fermerMenuContextuel(rendreFocus) {
  if (!MENU_CTX) return;
  let f = MENU_CTX.focus;
  const curseur = MENU_CTX.curseur,
    menus = MENU_CTX.menus;
  MENU_CTX = null;
  if (rendreFocus && !(f && f.isConnected && f !== document.body))
    f = DV.dernierChamp && DV.dernierChamp.isConnected ? DV.dernierChamp : null;
  if (!rendreFocus || !f) {
    menus.forEach(m => m.remove());
    return;
  }
  // Firefox : la case reprend le curseur AVANT que le menu disparaisse (sinon il part sur la page),
  // puis encore une fois juste après, au cas où le navigateur l'aurait déplacé entre-temps
  remettreCurseur(f, curseur);
  menus.forEach(m => m.remove());
  remettreCurseur(f, curseur);
  setTimeout(() => {
    if (!MENU_CTX && document.activeElement !== f && f.isConnected) remettreCurseur(f, curseur);
  }, 0);
  requestAnimationFrame(() => {
    if (!MENU_CTX && document.activeElement !== f && f.isConnected) remettreCurseur(f, curseur);
  });
}
/** position du curseur dans une case (texte ou désignation), pour la retrouver en fermant le menu */
function noterCurseur(el) {
  if (!el || el === document.body) return null;
  if (el.tagName === "INPUT" && el.selectionStart !== null) return { debut: el.selectionStart, fin: el.selectionEnd };
  const sel = getSelection();
  if (el.isContentEditable && sel.rangeCount && el.contains(sel.anchorNode)) return { plage: sel.getRangeAt(0).cloneRange() };
  return null;
}
function remettreCurseur(el, c) {
  el.focus({ preventScroll: true });
  try {
    if (el.tagName === "INPUT" && c && c.debut !== undefined) el.setSelectionRange(c.debut, c.fin);
    else if (el.isContentEditable) {
      let r = c && c.plage && el.contains(c.plage.startContainer) ? c.plage : null;
      if (!r) {
        r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
      }
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
  } catch (e) {
    /* case redessinée entre-temps */
  }
}
/** entrees : liste (ou fonction qui la donne) de { libelle, raccourci, action, sous: [...], desactive, danger, coche, garder, titre } ou "-" */
// onglet fermé dans Firefox : DF artisan s'arrête aussi si c'est réglé (Paramètres > Général : « Arrêter DF artisan
// quand son dernier onglet est fermé », décoché d'office), sauf si un autre onglet est ouvert
(() => {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const envoyer = (u, corps) =>
    fetch(u, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", "X-BatiDevis": "1" },
      body: JSON.stringify(corps),
    }).catch(() => {});
  const vie = () => {
    if (typeof PARAMS !== "undefined" && PARAMS && (PARAMS.general || {}).arret_onglet_ferme === true) envoyer("/api/vie", { id });
  };
  setTimeout(vie, 1500);
  setInterval(vie, 10000);
  window.addEventListener("pagehide", () => envoyer("/api/au-revoir", { id }));
})();
$("#quitter").addEventListener("click", async () => {
  if (avantDeQuitter && (await avantDeQuitter()) === false) return;
  if (!confirm("Fermer DF artisan ?")) return;
  try {
    await api("POST", "/api/quitter");
  } catch (e) {
    /* le serveur s'arrête */
  }
  document.body.innerHTML =
    '<div style="margin:80px auto;max-width:520px;font:16px system-ui;text-align:center"><h2>DF artisan est fermé</h2><p>Vous pouvez fermer cet onglet.<br>Pour le relancer : raccourci « DF artisan » du Bureau.</p></div>';
  setTimeout(() => window.close(), 300);
});
function ouvrirMenuContextuel(x, y, entrees) {
  const focusAvant = MENU_CTX ? MENU_CTX.focus : document.activeElement;
  fermerMenuContextuel();
  const etat = { menus: [], focus: focusAvant, curseur: MENU_CTX ? MENU_CTX.curseur : noterCurseur(focusAvant) };
  MENU_CTX = etat;
  const liste = typeof entrees === "function" ? entrees() : entrees;
  const construire = (elements, px, py, niveau) => {
    while (etat.menus.length > niveau) etat.menus.pop().remove();
    const m = h("div", { class: "menu-contextuel", role: "menu", onmousedown: ev => ev.preventDefault() });
    m.items = [];
    m.sel = -1;
    // le curseur reste dans la case pendant que le menu est ouvert (le clavier est lu au niveau de la page)
    m.activer = idx => {
      m.sel = idx;
      m.items.forEach((it, j) => it.b.classList.toggle("sel", j === idx));
    };
    elements.filter(Boolean).forEach(en => {
      if (en === "-") {
        m.append(h("div", { class: "sep" }));
        return;
      }
      if (en.titre) {
        m.append(h("div", { class: "titre" }, en.titre));
        return;
      }
      const b = h(
        "button",
        {
          type: "button",
          tabindex: "-1",
          class: "item" + (en.danger ? " danger" : ""),
          disabled: !!en.desactive,
          title: en.aide || "",
          onmousedown: ev => ev.preventDefault(),
        },
        h("span", { class: "coche" }, en.coche === undefined ? en.icone || "" : en.coche ? "✓" : ""),
        h("span", { class: "lib" }, en.libelle),
        en.raccourci ? h("kbd", {}, en.raccourci) : h("span"),
        h("span", { class: "fleche" }, en.sous ? "▸" : "")
      );
      const idx = m.items.length;
      const it = { b, en };
      it.ouvrir = () => {
        const r = b.getBoundingClientRect();
        return construire(en.sous, r.right - 3, r.top - 5, niveau + 1);
      };
      b.addEventListener("mouseenter", () => {
        m.activer(idx);
        if (en.sous && !en.desactive) it.ouvrir();
        else while (etat.menus.length > niveau + 1) etat.menus.pop().remove();
      });
      b.addEventListener("click", ev => {
        ev.stopPropagation();
        if (en.desactive) return;
        if (en.sous) {
          const sm = it.ouvrir();
          sm.activer(0);
          return;
        }
        if (en.garder) {
          en.action();
          ouvrirMenuContextuel(x, y, entrees);
          return;
        }
        fermerMenuContextuel(true);
        en.action();
      });
      m.items.push(it);
      m.append(b);
    });
    document.body.append(m);
    etat.menus.push(m);
    // dans l'écran
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(px, window.innerWidth - r.width - 6)) + "px";
    m.style.top = Math.max(4, Math.min(py, window.innerHeight - r.height - 6)) + "px";
    return m;
  };
  const m = construire(liste, x, y, 0);
  m.activer(m.items.findIndex(it => !it.en.desactive));
}
document.addEventListener(
  "mousedown",
  e => {
    if (MENU_CTX && !e.target.closest(".menu-contextuel")) fermerMenuContextuel();
  },
  true
);
// Échap : aussi au relâchement de la touche, et quel que soit l'endroit où est le curseur (Firefox)
window.addEventListener(
  "keyup",
  e => {
    if (e.key === "Escape" && MENU_CTX) {
      e.preventDefault();
      fermerMenuContextuel(true);
    }
  },
  true
);
window.addEventListener(
  "keydown",
  e => {
    if (e.key === "Escape" && MENU_CTX) {
      e.preventDefault();
      e.stopPropagation();
      fermerMenuContextuel(true);
    }
  },
  true
);
// Échap dans une case : le curseur y reste (Firefox le faisait sortir de la case, et les flèches faisaient défiler la page)
let dernierEchap = null;
const estCase = el => el && el.matches && (el.matches("input, textarea") || el.isContentEditable);
window.addEventListener(
  "keydown",
  e => {
    // (pas dans l'écran Plans : là, Échap rend la main au plan et à ses raccourcis)
    if (e.key !== "Escape" || !estCase(e.target) || e.target.closest(".plan-page")) return;
    const el = e.target.isContentEditable ? e.target.closest("[contenteditable=true]") || e.target : e.target;
    dernierEchap = { t: Date.now(), el, curseur: noterCurseur(el) };
    if ($("#modale").classList.contains("cache")) e.preventDefault(); // (dans une fenêtre, Échap la ferme toujours)
  },
  true
);
window.addEventListener(
  "keyup",
  e => {
    if (e.key === "Escape" && estCase(e.target) && $("#modale").classList.contains("cache")) e.preventDefault();
  },
  true
);
document.addEventListener(
  "focusout",
  e => {
    const d = dernierEchap;
    if (!d || e.target !== d.el || Date.now() - d.t > 600) return;
    if (e.relatedTarget) return; // la souris ou Tab vont vraiment ailleurs
    setTimeout(() => {
      if (
        d.el.isConnected &&
        (document.activeElement === document.body || !document.activeElement) &&
        $("#modale").classList.contains("cache")
      )
        remettreCurseur(d.el, d.curseur);
    }, 0);
  },
  true
);
window.addEventListener("blur", () => fermerMenuContextuel());
document.addEventListener(
  "wheel",
  e => {
    if (MENU_CTX && !e.target.closest(".menu-contextuel")) fermerMenuContextuel();
  },
  { passive: true }
);
document.addEventListener(
  "keydown",
  e => {
    if (!MENU_CTX) return;
    const m = MENU_CTX.menus[MENU_CTX.menus.length - 1];
    const actifs = m.items.map((it, j) => (it.en.desactive ? -1 : j)).filter(j => j >= 0);
    const pos = actifs.indexOf(m.sel);
    const k = e.key;
    if (k === "ArrowDown" || k === "ArrowUp") m.activer(actifs[(pos + (k === "ArrowDown" ? 1 : -1) + actifs.length) % actifs.length]);
    else if (k === "ArrowRight") {
      const it = m.items[m.sel];
      if (it && it.en.sous) it.ouvrir().activer(0);
    } else if (k === "ArrowLeft") {
      if (MENU_CTX.menus.length > 1) {
        MENU_CTX.menus.pop().remove();
        const p = MENU_CTX.menus[MENU_CTX.menus.length - 1];
        p.activer(p.sel);
      }
    } else if (k === "Enter" || k === " ") {
      const it = m.items[m.sel];
      if (it) it.b.click();
    } else if (k === "Escape") fermerMenuContextuel(true);
    else if (k === "Tab" || k === "ContextMenu" || (k === "F10" && e.shiftKey)) fermerMenuContextuel(true);
    else if (k.length === 1 && /\w/.test(k)) {
      // première lettre d'un libellé
      const j = m.items.findIndex((it, n) => !it.en.desactive && n > m.sel && it.en.libelle.toLowerCase().startsWith(k.toLowerCase()));
      const j2 = j >= 0 ? j : m.items.findIndex(it => !it.en.desactive && it.en.libelle.toLowerCase().startsWith(k.toLowerCase()));
      if (j2 >= 0) m.activer(j2);
    } else if (k.length === 1) {
      /* rien n'est tapé dans la case tant que le menu est ouvert */
    } else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  },
  true
);

/** menu de l'étude, comme celui de Batifree : ajouter, éditer la fiche, catalogue, ranger, supprimer (raccourcis écrits à droite) */
function entreesMenuEtude(cible) {
  const d = DV.courant;
  const i = DV.active;
  const l = i !== null && i !== undefined ? d.lignes[i] : null;
  const tr = l ? DV.tbody.querySelector(`tr[data-i="${i}"]:not(.composition)`) : null;
  const trComp = cible && cible.closest && cible.closest(".composition-boite tbody tr[data-k]");
  const verrou = estVerrouillee(l);
  const cmd = (k, shift) => () => commandeEtude(k, !!shift, cible);
  const bouton = (zone, rc) => zone && zone.querySelector(`[data-rc="${rc}"]`);
  const clic = (zone, rc) => () => {
    const b = bouton(zone, rc);
    if (b) b.click();
  };
  const ajouter = {
    libelle: "Ajouter",
    icone: "＋",
    sous: [
      { libelle: "Depuis le catalogue…", raccourci: "Alt+C", action: cmd("c") },
      { libelle: "Ouvrage", raccourci: "Alt+T", action: cmd("t") },
      { libelle: "Ligne libre", raccourci: "Alt+N", action: cmd("n") },
      { libelle: "Lot", raccourci: "Alt+L", action: cmd("l") },
      { libelle: "Texte", raccourci: "Alt+X", action: cmd("x") },
      "-",
      { libelle: "D'un autre devis…", raccourci: "Alt+I", action: cmd("i") },
      { libelle: "Nouvel article du catalogue…", action: () => fenetreVersArticle({}, a => inserer(ligneDepuisArticle(a), false)) },
    ],
  };
  const entrees = [ajouter];
  if (l && l.type === "tache")
    entrees.push({
      libelle: "Ajouter à la composition",
      icone: "＋",
      sous: [
        { libelle: "Article ou ouvrage du catalogue…", raccourci: "Alt+K", action: cmd("k") },
        { libelle: "Main d'œuvre", raccourci: "Alt+M", action: cmd("m") },
        { libelle: "Fourniture", raccourci: "Alt+F", action: cmd("f") },
        { libelle: "Ouvrage (sous-ouvrage)", raccourci: "Alt+U", action: cmd("u") },
        { libelle: "Autre / sous-traitance", raccourci: "Alt+A", action: cmd("a") },
      ],
    });
  // élément de composition sous la souris
  if (trComp) {
    const e = l && (l.composition || [])[Number(trComp.dataset.k)];
    entrees.push("-", { titre: "Élément : " + ((e && (e.designation || e.ref)) || "").slice(0, 40) });
    if (bouton(trComp, "fiche")) entrees.push({ libelle: "Éditer la fiche de l'article", icone: "✎", action: clic(trComp, "fiche") });
    if (bouton(trComp, "majart") && !bouton(trComp, "majart").classList.contains("cache"))
      entrees.push({ libelle: "Mettre à jour la fiche article (modifiée ici)", icone: "⤒", action: clic(trComp, "majart") });
    if (bouton(trComp, "cat"))
      entrees.push({
        libelle: "Créer l'article dans le catalogue…",
        icone: "⤓",
        desactive: bouton(trComp, "cat").disabled,
        action: clic(trComp, "cat"),
      });
    entrees.push(
      {
        libelle: "Monter l'élément",
        raccourci: "Alt+Maj+↑",
        desactive: !bouton(trComp, "haut") || bouton(trComp, "haut").disabled,
        action: clic(trComp, "haut"),
      },
      {
        libelle: "Descendre l'élément",
        raccourci: "Alt+Maj+↓",
        desactive: !bouton(trComp, "bas") || bouton(trComp, "bas").disabled,
        action: clic(trComp, "bas"),
      },
      {
        libelle: "Retirer l'élément",
        raccourci: "Alt+Suppr",
        danger: true,
        desactive: bouton(trComp, "suppr").disabled,
        action: clic(trComp, "suppr"),
      }
    );
    return entrees.concat(entreesDevisMenu()); // sur un élément : seulement ses actions (pas celles de la tâche)
  }
  if (!l) return entrees.concat(entreesDevisMenu());
  entrees.push("-");
  if (l.type === "tache")
    entrees.push({
      libelle: DV.ouverts.has(l) ? "Replier la composition" : "Ouvrir la composition",
      raccourci: "Alt+Entrée",
      action: cmd("Enter"),
    });
  if (l.type === "lot")
    entrees.push({ libelle: DV.lotsFermes.has(l) ? "Ouvrir le lot" : "Replier le lot", raccourci: "Alt+Entrée", action: cmd("Enter") });
  if (bouton(tr, "fiche"))
    entrees.push({
      libelle: l.type === "tache" ? "Éditer la fiche de l'ouvrage" : "Éditer la fiche de l'article",
      icone: "✎",
      action: clic(tr, "fiche"),
    });
  if (bouton(tr, "majart") && !bouton(tr, "majart").classList.contains("cache"))
    entrees.push({ libelle: "Mettre à jour la fiche article (modifiée ici)", icone: "⤒", action: clic(tr, "majart") });
  if (bouton(tr, "cat"))
    entrees.push({
      libelle: l.type === "tache" ? "Enregistrer comme ouvrage du catalogue…" : "Créer l'article dans le catalogue…",
      icone: "⤓",
      action: clic(tr, "cat"),
    });
  entrees.push(
    "-",
    { libelle: "Dupliquer", raccourci: "Alt+D", icone: "⧉", action: cmd("d") },
    l.type !== "texte"
      ? {
          libelle: l.option ? "Enlever l'option (compter dans le total)" : "Mettre en option",
          raccourci: "Alt+O",
          desactive: verrou,
          action: cmd("o"),
        }
      : null,
    {
      libelle: "Ranger",
      sous: [
        { libelle: "Monter", raccourci: "Alt+Maj+↑", action: cmd("ArrowUp", true) },
        { libelle: "Descendre", raccourci: "Alt+Maj+↓", action: cmd("ArrowDown", true) },
        { libelle: "Sortir du lot", raccourci: "Alt+Maj+←", action: cmd("ArrowLeft", true) },
        { libelle: "Mettre dans le lot au-dessus", raccourci: "Alt+Maj+→", action: cmd("ArrowRight", true) },
      ],
    },
    { libelle: "Déplacer dans le lot…", icone: "⇢", sous: entreesDeplacerLot(i) },
    { libelle: "Déplacer vers… (cliquer l'endroit)", icone: "⇅", action: () => deplacerVers(i) }
  );
  if (bouton(tr, "v"))
    entrees.push({
      libelle: verrou ? "Déverrouiller la ligne" : "Verrouiller la ligne",
      icone: verrou ? "🔓" : "🔒",
      action: clic(tr, "v"),
    });
  entrees.push("-", {
    libelle: l.type === "lot" ? "Supprimer le lot et son contenu" : "Supprimer",
    raccourci: "Alt+Suppr",
    danger: true,
    desactive: verrou,
    action: cmd("Delete"),
  });
  return entrees.concat(entreesDevisMenu());
}
/** déplacer une ligne, un lot avec son contenu, ou plusieurs éléments qui se suivent (« + suivante ») :
 *  on clique ensuite dans l'étude l'endroit où les mettre (haut d'une ligne : au-dessus ; bas : au-dessous ;
 *  bas d'un lot ouvert : au début de ce lot) ; Échap pour annuler */
function deplacerVers(i) {
  if (DV.lectureSeule) return;
  const L = DV.courant.lignes,
    tbody = DV.tbody;
  if (!L[i] || !tbody) return;
  if (DV.annulerDeplacement) DV.annulerDeplacement();
  const niv0 = L[i].niveau || 0,
    debut = i;
  let fin = finBloc(L, i),
    cible = null;
  const titre = l => (texteBrut(l.designation || "").split("\n")[0] || (l.type === "lot" ? "lot sans titre" : "ligne")).slice(0, 40);
  const barre = h("div", { class: "barre-deplacer" }),
    marque = h("div", { class: "marque-insertion" });
  const surligner = () =>
    tbody.querySelectorAll("tr[data-i]").forEach(tr => {
      const k = Number(tr.dataset.i);
      tr.classList.toggle("a-deplacer", k >= debut && k < fin);
    });
  const freres = () => {
    const r = [];
    for (let k = debut; k < fin; k = finBloc(L, k)) r.push(k);
    return r;
  };
  const majBarre = () => {
    const f = freres();
    barre.replaceChildren(
      h(
        "span",
        {},
        h("b", {}, "Déplacer " + (f.length > 1 ? f.length + " éléments" : "« " + titre(L[debut]) + " »")),
        " : cliquez l'endroit où le mettre (haut d'une ligne : au-dessus ; bas : au-dessous)."
      ),
      h(
        "button",
        {
          class: "btn petit",
          title: "Emporter aussi l'élément suivant (même niveau)",
          disabled: !(fin < L.length && (L[fin].niveau || 0) === niv0),
          onclick: () => {
            fin = finBloc(L, fin);
            majBarre();
          },
        },
        "+ suivante"
      ),
      h(
        "button",
        {
          class: "btn petit",
          disabled: f.length < 2,
          onclick: () => {
            fin = f[f.length - 1];
            majBarre();
          },
        },
        "− dernière"
      ),
      h("button", { class: "btn petit", onclick: () => finir() }, "Annuler (Échap)")
    );
    surligner();
  };
  const position = e => {
    const tr = e.target.closest && e.target.closest("tr[data-i]");
    if (!tr || !tbody.contains(tr)) return null;
    const k = Number(tr.dataset.i),
      l = L[k];
    if (!l || (k >= debut && k < fin)) return null;
    const r = tr.getBoundingClientRect(),
      bas = e.clientY > r.top + r.height / 2;
    if (!bas) return { pos: k, niv: l.niveau || 0, y: r.top, r };
    if (l.type === "lot" && !DV.lotsFermes.has(l)) return { pos: k + 1, niv: (l.niveau || 0) + 1, y: r.bottom, r };
    const f = finBloc(L, k),
      trf = f > k + 1 ? tbody.querySelector(`tr[data-i="${f - 1}"]`) : null,
      rb = trf ? trf.getBoundingClientRect() : r;
    return { pos: f, niv: l.niveau || 0, y: rb.bottom, r };
  };
  const survol = e => {
    cible = position(e);
    if (!cible || (cible.pos >= debut && cible.pos <= fin)) {
      cible = null;
      marque.style.display = "none";
      return;
    }
    const ret = 24 * cible.niv;
    Object.assign(marque.style, {
      display: "",
      top: cible.y - 2 + "px",
      left: cible.r.left + 40 + ret + "px",
      width: Math.max(60, cible.r.width - 60 - ret) + "px",
    });
  };
  const clic = e => {
    if (!barre.isConnected) return;
    if (e.target.closest && e.target.closest(".barre-deplacer")) return;
    e.preventDefault();
    e.stopPropagation();
    if (!cible) {
      toast("Cliquez une ligne de l'étude (hors de ce qui est déplacé), ou Échap.", true);
      return;
    }
    const bloc = L.slice(debut, fin),
      delta = cible.niv - niv0;
    if (!niveauxPermis(bloc, delta)) {
      toast(MSG_NIVEAUX, true);
      return;
    }
    let pos = cible.pos;
    L.splice(debut, bloc.length);
    if (pos > debut) pos -= bloc.length;
    bloc.forEach(l => {
      l.niveau = (l.niveau || 0) + delta;
    });
    L.splice(pos, 0, ...bloc);
    finir();
    DV.active = pos;
    modifie();
    DV.redessiner();
    focusLigne(DV.tbody, pos);
    toast(bloc.length > 1 ? bloc.length + " lignes déplacées." : "Déplacé.");
  };
  const touche = e => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finir();
    }
  };
  function finir() {
    barre.remove();
    marque.remove();
    DV.annulerDeplacement = null;
    tbody.removeEventListener("mousemove", survol);
    tbody.removeEventListener("click", clic, true);
    tbody.removeEventListener("mousedown", bloquer, true);
    document.removeEventListener("keydown", touche, true);
    tbody.querySelectorAll(".a-deplacer").forEach(tr => tr.classList.remove("a-deplacer"));
    tbody.classList.remove("en-deplacement");
  }
  const bloquer = e => {
    if (!(e.target.closest && e.target.closest(".barre-deplacer"))) {
      e.preventDefault();
    }
  };
  DV.annulerDeplacement = finir;
  tbody.addEventListener("mousemove", survol);
  tbody.addEventListener("click", clic, true);
  tbody.addEventListener("mousedown", bloquer, true);
  document.addEventListener("keydown", touche, true);
  tbody.classList.add("en-deplacement");
  marque.style.display = "none";
  document.body.append(barre, marque);
  majBarre();
}
/** déplace la ligne (ou le lot avec son contenu) à la fin d'un lot choisi ; cible null = hors des lots, à la fin */
function deplacerVersLot(i, cible) {
  const L = DV.courant.lignes;
  const fin = finBloc(L, i);
  const bloc = L.slice(i, fin);
  if (cible && bloc.includes(cible)) {
    toast("Un lot ne peut pas aller dans lui-même", true);
    return;
  }
  const base = bloc[0].niveau || 0;
  const niv = cible ? (cible.niveau || 0) + 1 : 0;
  if (!niveauxPermis(bloc, niv - base)) {
    toast(MSG_NIVEAUX, true);
    return;
  }
  L.splice(i, bloc.length);
  const j = cible ? L.indexOf(cible) : -1;
  const pos = cible ? finBloc(L, j) : L.length;
  bloc.forEach(l => {
    l.niveau = (l.niveau || 0) - base + niv;
  });
  L.splice(pos, 0, ...bloc);
  if (cible) DV.lotsFermes.delete(cible);
  DV.active = pos;
  modifie();
  DV.redessiner();
  focusLigne(DV.tbody, pos);
  toast(
    cible
      ? "Déplacé dans le lot « " + (texteBrut(cible.designation).split("\n")[0] || "sans titre").slice(0, 40) + " »"
      : "Déplacé hors des lots, à la fin"
  );
}
function entreesDeplacerLot(i) {
  const L = DV.courant.lignes;
  const fin = finBloc(L, i);
  const lots = L.map((l, k) => ({ l, k })).filter(x => x.l.type === "lot");
  const num = k => (DV.refs && DV.refs[k] && DV.refs[k].num && DV.refs[k].num.textContent) || "";
  return [
    ...lots.map(({ l, k }) => ({
      libelle:
        "\u00a0\u00a0\u00a0".repeat(l.niveau || 0) +
        (num(k) ? num(k) + "  " : "") +
        (texteBrut(l.designation).split("\n")[0] || "(lot sans titre)").slice(0, 50),
      desactive: k >= i && k < fin,
      action: () => deplacerVersLot(i, l),
    })),
    lots.length ? "-" : null,
    { libelle: "Hors des lots (à la fin du devis)", action: () => deplacerVersLot(i, null) },
  ].filter(Boolean);
}
/** fin du menu de l'étude : annuler / rétablir, dupliquer le devis */
function entreesDevisMenu() {
  return [
    "-",
    { libelle: "Annuler", icone: "↶", raccourci: "Ctrl+Z", desactive: !(DV.histo && DV.histo.avant.length), action: () => annulerEtude() },
    {
      libelle: "Rétablir",
      icone: "↷",
      raccourci: "Ctrl+Y",
      desactive: !(DV.histo && DV.histo.apres.length),
      action: () => retablirEtude(),
    },
    { libelle: "Dupliquer ce devis", icone: "⧉", action: () => dupliquerDevis(DV.courant.id).catch(erreur) },
  ];
}
let menuParClavier = 0;
// pas de menu du navigateur par-dessus le nôtre (touche Menu relâchée, clic droit dans le menu)
document.addEventListener(
  "contextmenu",
  e => {
    if ((e.target.closest && e.target.closest(".menu-contextuel")) || Date.now() - menuParClavier < 1000) e.preventDefault();
  },
  true
);
function menuLigneEtude(e) {
  if (DV.lectureSeule || (DV.factureEmise && !(e.target.closest && e.target.closest(".composition-boite")))) {
    if (e) e.preventDefault();
    return false;
  }
  if (e.ctrlKey) return; // Ctrl + clic droit : le menu habituel du navigateur (copier, orthographe…)
  e.preventDefault();
  if (Date.now() - menuParClavier < 400) return; // déjà ouvert par la touche Menu
  const caseCliquee = e.target.closest && e.target.closest("input, select, .champ-ligne");
  if (caseCliquee && document.activeElement !== caseCliquee && !caseCliquee.disabled) caseCliquee.focus({ preventScroll: true });
  const tr = e.target.closest && e.target.closest("tr[data-i]");
  if (tr) {
    const i = Number(tr.dataset.i);
    if (DV.active !== i) {
      DV.active = i;
      DV.tbody.querySelectorAll("tr.active").forEach(x => x.classList.remove("active"));
      DV.tbody.querySelectorAll(`tr[data-i="${i}"]`).forEach(x => x.classList.add("active"));
    }
  }
  let x = e.clientX,
    y = e.clientY;
  if (!x && !y) {
    const r = (e.target.getBoundingClientRect ? e.target : DV.tbody).getBoundingClientRect();
    x = r.left + 20;
    y = r.bottom;
  }
  ouvrirMenuContextuel(x, y, entreesMenuEtude(e.target));
}
document.addEventListener(
  "keydown",
  e => {
    if (!(e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) || MENU_CTX) return;
    if (!dansEtude() || !$("#modale").classList.contains("cache")) return;
    e.preventDefault();
    menuParClavier = Date.now();
    const el = document.activeElement && DV.tbody && DV.tbody.contains(document.activeElement) ? document.activeElement : null;
    const tr = el
      ? el.closest("tr[data-i]")
      : DV.active !== null && DV.active !== undefined
        ? DV.tbody.querySelector(`tr[data-i="${DV.active}"]`)
        : null;
    const r = (el || tr || DV.tbody).getBoundingClientRect();
    ouvrirMenuContextuel(r.left + 16, Math.min(r.bottom, r.top + 30), entreesMenuEtude(el || tr));
  },
  true
);

/* ---------- annuler / rétablir dans l'étude (Ctrl+Z, Ctrl+Y) ---------- */
// état des lignes retenu après chaque série de modifications (une pause d'une demi-seconde = une étape)
function cleEtat(lignes) {
  return JSON.stringify(lignes, (k, v) => (k === "ouvert" || k === "replie" ? undefined : v));
}
function initHisto() {
  const d = DV.courant;
  DV.histo = d ? { avant: [], apres: [], dernier: JSON.stringify(d.lignes), cle: cleEtat(d.lignes) } : null;
}
function noterEtat() {
  const d = DV.courant,
    H = DV.histo;
  if (!d || !H) return;
  const c = cleEtat(d.lignes);
  if (c === H.cle) {
    H.dernier = JSON.stringify(d.lignes);
    return;
  } // seulement l'affichage (lot replié…)
  H.avant.push(H.dernier);
  if (H.avant.length > 150) H.avant.shift();
  H.apres = [];
  H.dernier = JSON.stringify(d.lignes);
  H.cle = c;
  majBoutonsHisto();
}
/** boutons ↶ ↷ grisés quand il n'y a rien à annuler / rétablir */
function majBoutonsHisto() {
  const H = DV.histo;
  document.querySelectorAll("[data-histo]").forEach(b => {
    b.disabled = !H || !(b.dataset.histo === "annuler" ? H.avant.length || cleEtat(DV.courant.lignes) !== H.cle : H.apres.length);
  });
}
const noterEtatPlusTard = debounce(noterEtat, 500);
const majBoutonsHistoVite = debounce(majBoutonsHisto, 200);
function restaurerEtat(json) {
  const d = DV.courant,
    H = DV.histo;
  d.lignes = JSON.parse(json);
  H.dernier = json;
  H.cle = cleEtat(d.lignes);
  if (DV.active !== null && DV.active !== undefined && DV.active >= d.lignes.length)
    DV.active = d.lignes.length ? d.lignes.length - 1 : null;
  modifie();
  if (DV.redessiner) DV.redessiner();
}
function annulerEtude() {
  if (DV.lectureSeule) return false;
  const H = DV.histo;
  if (!H) return;
  noterEtat();
  if (!H.avant.length) {
    toast("Rien à annuler");
    return;
  }
  H.apres.push(H.dernier);
  restaurerEtat(H.avant.pop());
  majBoutonsHisto();
  toast("Action annulée (Ctrl+Y pour la rétablir)");
}
function retablirEtude() {
  if (DV.lectureSeule) return false;
  const H = DV.histo;
  if (!H) return;
  noterEtat();
  if (!H.apres.length) {
    toast("Rien à rétablir");
    return;
  }
  H.avant.push(H.dernier);
  restaurerEtat(H.apres.pop());
  majBoutonsHisto();
}
document.addEventListener(
  "keydown",
  e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const annuler = k === "z" && !e.shiftKey,
      retablir = k === "y" || (k === "z" && e.shiftKey);
    if (!annuler && !retablir) return;
    if (!dansEtude() || !$("#modale").classList.contains("cache") || MENU_CTX) return;
    if (e.target === DV.champFiltre) return; // la recherche garde son annulation habituelle
    e.preventDefault();
    e.stopPropagation();
    if (document.activeElement && document.activeElement.blur && DV.tbody && DV.tbody.contains(document.activeElement)) {
      // le champ en cours garde sinon son ancien texte à l'écran
      const garde = DV.active;
      document.activeElement.blur();
      DV.active = garde;
    }
    if (annuler) annulerEtude();
    else retablirEtude();
    majBoutonsHisto();
    setTimeout(() => {
      if (DV.active !== null && DV.active !== undefined) focusLigne(DV.tbody, DV.active);
    }, 40);
  },
  true
);

/* ---------- flèches ↑ / ↓ : passer d'une ligne de l'étude à l'autre (même colonne), comme un tableau ---------- */
function curseurAuBord(el, haut) {
  const sel = getSelection();
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) return true;
  const r = sel.getRangeAt(0).cloneRange();
  r.collapse(!haut ? false : true);
  // texte avant / après le curseur : sans retour à la ligne, et le curseur sur la première / dernière ligne affichée
  const tout = document.createRange();
  tout.selectNodeContents(el);
  const reste = document.createRange();
  if (haut) {
    reste.setStart(tout.startContainer, tout.startOffset);
    reste.setEnd(r.startContainer, r.startOffset);
  } else {
    reste.setStart(r.endContainer, r.endOffset);
    reste.setEnd(tout.endContainer, tout.endOffset);
  }
  const txt = reste.toString();
  if (!txt.trim()) return true;
  const rect = r.getClientRects()[0];
  if (!rect) return false;
  const box = el.getBoundingClientRect(),
    st = getComputedStyle(el);
  const lh = parseFloat(st.lineHeight) || 20;
  return haut
    ? rect.top - box.top - parseFloat(st.paddingTop) < lh * 0.8
    : box.bottom - parseFloat(st.paddingBottom) - rect.bottom < lh * 0.8;
}
function champDe(td) {
  if (!td) return null;
  return [...td.querySelectorAll("input, select, .champ-ligne")].find(x => !x.disabled && x.offsetParent !== null) || null;
}
document.addEventListener(
  "keydown",
  e => {
    if ((e.key !== "ArrowUp" && e.key !== "ArrowDown") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!dansEtude() || !$("#modale").classList.contains("cache") || MENU_CTX || !DV.tbody || !DV.tbody.contains(e.target)) return;
    const t = e.target;
    if (t.tagName === "SELECT") return;
    const liste = t.listeAuto && !t.listeAuto.classList.contains("cache") ? t.listeAuto : null;
    if (liste && liste.children.length) return; // choix dans la liste d'auto-complétion
    const haut = e.key === "ArrowUp";
    if (t.isContentEditable && !curseurAuBord(t, haut)) return;
    const td = t.closest("td"),
      tr = t.closest("tr");
    if (!td || !tr) return;
    const lignes = [...DV.tbody.querySelectorAll("tr[data-i]:not(.composition), .composition-boite tbody tr[data-k]:not(.hors-filtre)")];
    const pos = lignes.indexOf(tr);
    if (pos < 0) return;
    // (composition alignée sur l'étude : même colonne, d'un ouvrage à ses éléments et retour)
    const colonne = td.dataset.col;
    for (let p = pos + (haut ? -1 : 1); p >= 0 && p < lignes.length; p += haut ? -1 : 1) {
      const cible = lignes[p];
      let champ = champDe(cible.querySelector(`td[data-col="${colonne}"]`));
      if (!champ) champ = champDe(cible.querySelector('td[data-col="desig"]'));
      if (!champ) continue;
      e.preventDefault();
      // d'abord la ligne à l'écran, ensuite le curseur : le navigateur n'a plus besoin de faire défiler
      // lui-même (Firefox le faisait après nous : la ligne disparaissait un instant puis revenait)
      montrerLigne(cible);
      if (champ.isContentEditable) {
        // curseur au début (en descendant) ou à la fin (en montant), posé avant de donner le focus
        const r = document.createRange();
        r.selectNodeContents(champ);
        r.collapse(!haut);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
        champ.focus({ preventScroll: true });
        if (!champ.contains(getSelection().anchorNode)) {
          const s2 = getSelection();
          s2.removeAllRanges();
          s2.addRange(r);
        }
      } else {
        champ.focus({ preventScroll: true });
        if (champ.select && champ.tagName === "INPUT") champ.select();
      }
      return;
    }
  },
  true
);

/* ---------- flèches ← / → : case précédente / suivante de la ligne (depuis le début / la fin du texte) ---------- */
function curseurDebutFin(el, gauche) {
  if (el.tagName === "SELECT") return true;
  if (el.tagName === "INPUT") {
    const v = el.value || "",
      a = el.selectionStart,
      b = el.selectionEnd;
    if (a === null) return true;
    if (a === 0 && b === v.length) return true; // tout est sélectionné (arrivée par les flèches)
    return a === b && (gauche ? a === 0 : a === v.length);
  }
  if (el.isContentEditable) {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return false;
    const r = sel.getRangeAt(0),
      reste = document.createRange();
    reste.selectNodeContents(el);
    if (gauche) reste.setEnd(r.startContainer, r.startOffset);
    else reste.setStart(r.endContainer, r.endOffset);
    return !reste.toString().length;
  }
  return false;
}
document.addEventListener(
  "keydown",
  e => {
    if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!dansEtude() || !$("#modale").classList.contains("cache") || MENU_CTX || !DV.tbody || !DV.tbody.contains(e.target)) return;
    const t = e.target,
      gauche = e.key === "ArrowLeft";
    if (!curseurDebutFin(t, gauche)) return;
    const tr = t.closest("tr");
    if (!tr) return;
    const champs = [...tr.querySelectorAll("input, select, .champ-ligne")].filter(
      x => x.closest("tr") === tr && !x.disabled && x.offsetParent !== null
    );
    const cible = champs[champs.indexOf(t) + (gauche ? -1 : 1)];
    if (!cible) return;
    e.preventDefault();
    cible.focus();
    if (cible.tagName === "INPUT") cible.select();
    else if (cible.isContentEditable) {
      const r = document.createRange();
      r.selectNodeContents(cible);
      r.collapse(!gauche);
      const s2 = getSelection();
      s2.removeAllRanges();
      s2.addRange(r);
    }
  },
  true
);

/* ---------- articles du catalogue utilisés dans le devis : la ligne a-t-elle été modifiée ? ---------- */
DV.articles = new Map();
async function chargerArticlesDevis(d) {
  const ids = new Set();
  for (const l of d.lignes || []) {
    if (l.article_id) ids.add(l.article_id);
    for (const e of l.composition || []) if (e.article_id) ids.add(e.article_id);
  }
  DV.articles = new Map();
  if (!ids.size) return;
  try {
    (await api("POST", "/api/articles/par-ids", { ids: [...ids] })).forEach(a => DV.articles.set(a.id, a));
  } catch (e) {
    /* sans importance */
  }
}
/** différences entre la ligne (ou l'élément) du devis et sa fiche article : [[libellé, catalogue, devis, clé]] */
function ecartsArticle(x) {
  const a = x && x.article_id && DV.articles.get(x.article_id);
  if (!a) return [];
  const out = [];
  if ((x.ref || "").trim() && (x.ref || "").trim() !== (a.ref || "").trim()) out.push(["Référence", a.ref, x.ref.trim(), "ref"]);
  if ((x.designation || "").trim() && (x.designation || "").trim() !== (a.designation || "").trim())
    out.push(["Désignation", texteBrut(a.designation), texteBrut(x.designation), "designation"]);
  if ((x.unite || "").trim() && (x.unite || "").trim() !== (a.unite || "").trim()) out.push(["Unité", a.unite, x.unite, "unite"]);
  if (
    x.prix_achat !== null &&
    x.prix_achat !== undefined &&
    x.prix_achat !== "" &&
    Math.abs(nombre(x.prix_achat) - nombre(a.prix_achat)) > 0.0049
  )
    out.push(["Prix d'achat", euros(a.prix_achat), euros(nombre(x.prix_achat)), "prix_achat"]);
  return out;
}
/** bouton « ⤒ fiche » : visible quand la fourniture a été modifiée dans le devis */
function boutonMajArticle(x) {
  const b = h("button", { class: "icone maj-fiche cache", type: "button", "data-rc": "majart" }, "⤒ fiche");
  const maj = () => {
    const ec = ecartsArticle(x);
    b.classList.toggle("cache", !ec.length);
    b.title = ec.length
      ? "Mettre à jour la fiche article du catalogue avec ce qui a changé ici : " + ec.map(c => c[0].toLowerCase()).join(", ")
      : "";
  };
  b.addEventListener("click", () => fenetreMajArticle(x, maj));
  b.ecouter = zone => {
    zone.addEventListener("input", () => setTimeout(maj));
    zone.addEventListener("change", () => setTimeout(maj));
  };
  setTimeout(maj);
  return b;
}
function fenetreMajArticle(x, apres) {
  const ec = ecartsArticle(x);
  const a = DV.articles.get(x.article_id);
  if (!ec.length || !a) {
    toast("La fiche article est déjà à jour");
    return;
  }
  const cases = ec.map(c => ({ c, cb: h("input", { type: "checkbox", checked: true }) }));
  const recalcul = h("input", { type: "checkbox", checked: true });
  ouvrirModale(
    "Mettre à jour la fiche article " + a.ref,
    h(
      "div",
      {},
      h(
        "table",
        { class: "resultats" },
        h("thead", {}, h("tr", {}, h("th"), h("th", {}, ""), h("th", {}, "Catalogue"), h("th", {}, "Devis (nouveau)"))),
        h(
          "tbody",
          {},
          cases.map(({ c, cb }) =>
            h(
              "tr",
              {},
              h("td", {}, cb),
              h("td", { style: "font-weight:500" }, c[0]),
              h("td", { class: "sous" }, c[1]),
              h("td", { style: "font-weight:600" }, c[2])
            )
          )
        )
      ),
      ec.some(c => c[3] === "prix_achat")
        ? h(
            "label",
            { class: "case", style: "margin-top:8px" },
            recalcul,
            `Recalculer le prix de vente de l'article (achat × marge de sa fiche ${versChamp(a.coef_marge || 1)})`
          )
        : null,
      h("p", { class: "aide" }, "Les autres devis ne changent pas. Les prochains devis prendront la fiche mise à jour.")
    ),
    [
      h("button", { class: "btn", onclick: fermerModale }, "Annuler"),
      h(
        "button",
        {
          class: "btn principal",
          onclick: async () => {
            const corps = { recalculer: recalcul.checked };
            cases
              .filter(z => z.cb.checked)
              .forEach(({ c }) => {
                corps[c[3]] = c[3] === "prix_achat" ? nombre(x.prix_achat) : c[3] === "ref" ? x.ref.trim() : x[c[3]];
              });
            if (Object.keys(corps).length < 2) {
              toast("Rien de coché", true);
              return;
            }
            try {
              const r = await api("POST", `/api/articles/${a.id}/depuis-devis`, corps);
              DV.articles.set(r.id, r);
              fermerModale();
              toast("Fiche article mise à jour : " + r.ref);
              if (apres) apres();
            } catch (er) {
              erreur(er);
            }
          },
        },
        "Mettre à jour la fiche"
      ),
    ],
    { largeur: "min(760px, 94vw)" }
  );
}

/* ---------- devis : dupliquer, supprimer (menus de la liste et de l'étude) ---------- */
async function dupliquerDevis(id) {
  if (DV.courant && DV.courant.id === id) {
    if (!(await enregistrerAvant("de le dupliquer"))) return;
  } else await enregistrerDevis();
  const n = await api("POST", `/api/documents/${id}/dupliquer`);
  if (sectionActive !== "devis") await aller("devis");
  await ouvrirDevis(n.id, DV.fiche);
  toast("Copie créée : " + n.numero);
}
async function supprimerDevisListe(x) {
  if (!confirm(`Supprimer définitivement le devis ${x.numero} ?`)) return;
  await api("DELETE", "/api/documents/" + x.id);
  await DV.rechargerListe();
  toast("Devis " + x.numero + " supprimé");
}
function menuListeDevis(x, ev) {
  ouvrirMenuContextuel(ev.clientX, ev.clientY, [
    { titre: "Devis " + x.numero },
    { libelle: "Ouvrir", action: () => ouvrirDevis(x.id, DV.fiche).catch(erreur) },
    { libelle: "Dupliquer", icone: "⧉", action: () => dupliquerDevis(x.id).catch(erreur) },
    "-",
    { libelle: "Aperçu / Imprimer", action: () => apercu(x.id) },
    { libelle: "PDF", action: () => exporterPdf(x.id) },
    "-",
    { libelle: "Facture d'acompte…", action: () => fenetreAcompte(x).catch(erreur) },
    { libelle: "Facture de situation…", action: () => fenetreSituation(x).catch(erreur) },
    { libelle: "Facturer (total ou solde)", action: () => facturerDevis(x).catch(erreur) },
    "-",
    {
      libelle: "Supprimer",
      danger: true,
      desactive: x.statut === "accepte",
      aide: x.statut === "accepte" ? "Devis accepté : il ne peut pas être supprimé" : "",
      action: () => supprimerDevisListe(x).catch(erreur),
    },
  ]);
}

/* raccourcis de mise en forme dans les zones de texte : Ctrl+B / Ctrl+I / Ctrl+U
   (Firefox ouvre sinon le panneau des marque-pages avec Ctrl+B) */
document.addEventListener(
  "keydown",
  e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const k = e.key.toLowerCase();
    const cmd = { b: "bold", i: "italic", u: "underline" }[k];
    if (!cmd) return;
    const zone = e.target && e.target.closest && e.target.closest("[contenteditable=true]");
    if (!zone) return;
    e.preventDefault();
    try {
      document.execCommand("styleWithCSS", false, false);
    } catch (er) {
      /* */
    }
    document.execCommand(cmd, false, null);
    zone.dispatchEvent(new Event("input", { bubbles: true }));
  },
  true
);

/* ---------------- mise à jour depuis le fichier .zip téléchargé ---------------- */
async function fenetreMiseAJour() {
  let r;
  try {
    r = await api("GET", "/api/mise-a-jour");
  } catch (e) {
    erreur(e);
    return;
  }
  const installer = async chemin => {
    let v;
    try {
      v = (await api("GET", "/api/mise-a-jour")).trouvees.find(x => x.chemin === chemin);
    } catch (e) {
      v = null;
    }
    if (
      v &&
      !v.plus_recente &&
      !confirm(`La version ${v.version} n'est pas plus récente que celle installée (${r.version}). L'installer quand même ?`)
    )
      return;
    try {
      if (!(await avantDeChangerDeDevis())) return;
    } catch (e) {
      /* */
    }
    ouvrirModale(
      "Mise à jour de DF artisan",
      h("div", {}, h("p", { id: "etat-maj" }, "Installation… (vos données ne sont pas touchées, la base est sauvegardée avant)")),
      []
    );
    let res;
    try {
      res = await api("POST", "/api/mise-a-jour/installer", { chemin });
    } catch (e) {
      fermerModale();
      erreur(e);
      return;
    }
    const etat = $("#etat-maj");
    if (etat) etat.textContent = `Version ${res.version} installée (${res.fichiers} fichiers). Redémarrage de DF artisan…`;
    // l'ancienne version s'arrête, la nouvelle démarre : on attend qu'elle réponde, puis on recharge la page
    const debut = Date.now();
    const attendre = async () => {
      try {
        const s = await fetch("/api/sante", { cache: "no-store" }).then(x => x.json());
        if (s.version === res.version) {
          location.reload();
          return;
        }
      } catch (e) {
        /* pas encore relancé */
      }
      if (Date.now() - debut > 30000) {
        if (etat)
          etat.textContent =
            "La nouvelle version ne répond pas : fermez la fenêtre noire DF artisan et relancez-le avec le raccourci du Bureau.";
        return;
      }
      setTimeout(attendre, 700);
    };
    setTimeout(attendre, 1200);
  };
  const liste = r.trouvees.length
    ? h(
        "table",
        { class: "resultats" },
        h(
          "tbody",
          {},
          r.trouvees.map(x =>
            h(
              "tr",
              { class: x.plus_recente ? "" : "sous" },
              h(
                "td",
                { style: "font-weight:600;white-space:nowrap" },
                "Version " + x.version,
                x.plus_recente ? h("span", { class: "puce accepte", style: "margin-left:8px" }, "plus récente") : null
              ),
              h("td", {}, x.fichier, h("div", { class: "sous", style: "font-size:12px" }, x.dossier + " · " + x.date)),
              h(
                "td",
                { style: "text-align:right" },
                h("button", { class: "btn" + (x.plus_recente ? " principal" : ""), onclick: () => installer(x.chemin) }, "Installer")
              )
            )
          )
        )
      )
    : h("p", { class: "sous" }, "Aucun fichier BatiDevis…zip dans Téléchargements ni sur le Bureau.");
  ouvrirModale(
    "Mettre à jour DF artisan",
    h(
      "div",
      {},
      h("p", { style: "margin-top:0" }, `Version installée : `, h("b", {}, r.version)),
      h(
        "p",
        {},
        "Téléchargez le fichier BatiDevis-v….zip (sans le décompresser), puis installez-le ici. DF artisan redémarre tout seul ; vos devis, clients, catalogue et paramètres ne sont pas touchés (une sauvegarde est faite avant)."
      ),
      liste
    ),
    [
      h("button", { class: "btn", onclick: fermerModale }, "Fermer"),
      h(
        "button",
        {
          class: "btn",
          onclick: async () => {
            try {
              const c = await api("POST", "/api/choisir-fichier", { type: "zip" });
              if (c.chemin) installer(c.chemin);
            } catch (e) {
              erreur(e);
            }
          },
        },
        "Choisir un autre fichier…"
      ),
    ],
    { largeur: "min(760px, 94vw)" }
  );
}
/** au démarrage : une version plus récente attend dans Téléchargements ? Un bouton apparaît dans la colonne de gauche. */
async function verifierMiseAJour() {
  try {
    const r = await api("GET", "/api/mise-a-jour");
    const n = r.trouvees.find(x => x.plus_recente);
    const zone = $("#mise-a-jour");
    if (!zone) return;
    zone.innerHTML = "";
    if (n)
      zone.append(
        h(
          "button",
          { class: "bouton-maj", title: n.chemin, onclick: () => fenetreMiseAJour() },
          "⟳ Version " + n.version + " disponible",
          h("small", {}, "cliquer pour installer")
        )
      );
  } catch (e) {
    /* sans importance */
  }
}
window.addEventListener("focus", () => verifierMiseAJour());
