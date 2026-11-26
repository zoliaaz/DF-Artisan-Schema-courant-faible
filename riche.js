"use strict";
/* Textes mis en forme (mentions, conclusion, encadré TVA…), communs à DF artisan et à l'éditeur de mise en page.
   Le texte reste enregistré en texte simple, avec des marques :
     **gras**   [u]souligné[/u]   [i]italique[/i]   [couleur=#ff0000]couleur[/couleur]   [taille=110]110 %[/taille] ([grand] = 125 %, [petit] = 85 %)
     [centre] ou [droite] en début de ligne : ligne centrée ou alignée à droite (à gauche sans marque)
   (ligneMarquageVersHtml et echapperHtml viennent de app.js ou d'impression.js) */
function elRiche(tag, attrs, ...enfants) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
  for (const e of enfants.flat())
    if (e !== null && e !== undefined && e !== "") el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  return el;
}
const COULEURS_TEXTE = [
  ["#000000", "Noir"],
  ["#ff0000", "Rouge"],
  ["#1d4ed8", "Bleu"],
  ["#15803d", "Vert"],
  ["#c2410c", "Orange"],
];
function marquageVersHtml(t) {
  return String(t || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(l => {
      const [a, reste] = alignementLigne(l);
      return "<div" + (a ? ` style="text-align:${a}"` : "") + ">" + (ligneMarquageVersHtml(reste) || "<br>") + "</div>";
    })
    .join("");
}
/** [centre] / [droite] en début de ligne -> ["center"|"right"|"", reste de la ligne] */
function alignementLigne(l) {
  const m = String(l).match(/^\[(centre|droite)\]/);
  return m ? [m[1] === "centre" ? "center" : "right", String(l).slice(m[0].length)] : ["", String(l)];
}
/** icône des boutons d'alignement (4 traits) */
function iconeAlignement(a) {
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 14 12");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "12");
  [
    [14, 1],
    [9, 4.5],
    [14, 8],
    [9, 11.5],
  ].forEach(([l, y]) => {
    const x1 = a === "left" ? 0 : a === "right" ? 14 - l : (14 - l) / 2;
    const ln = document.createElementNS(ns, "line");
    ln.setAttribute("x1", x1);
    ln.setAttribute("x2", x1 + l);
    ln.setAttribute("y1", y);
    ln.setAttribute("y2", y);
    ln.setAttribute("stroke", "currentColor");
    ln.setAttribute("stroke-width", "1.6");
    svg.append(ln);
  });
  return svg;
}
/** aligne les lignes (blocs) touchées par la sélection : "left", "center" ou "right" */
function alignerBlocs(zone, a, plage) {
  const s = getSelection();
  zone.focus();
  if (plage) {
    s.removeAllRanges();
    s.addRange(plage);
  }
  if (!s.rangeCount || !zone.contains(s.anchorNode)) return;
  // du texte hors de tout bloc (1re ligne tapée dans une zone vide…) : il est mis dans un bloc
  const estBloc = n => n.nodeType === 1 && /^(DIV|P)$/.test(n.tagName);
  if ([...zone.childNodes].some(n => !estBloc(n) && !(n.nodeType === 3 && !n.nodeValue.trim()))) {
    const [d, f] = positionsTexte(zone, s.getRangeAt(0));
    let paquet = null;
    for (const n of [...zone.childNodes]) {
      if (estBloc(n)) {
        paquet = null;
        continue;
      }
      if (!paquet) {
        paquet = document.createElement("div");
        zone.insertBefore(paquet, n);
      }
      paquet.append(n);
    }
    // sélection remise au même endroit (début : dans le bloc suivant plutôt qu'en fin du précédent)
    const textes = [],
      marche = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
    for (let t = marche.nextNode(); t; t = marche.nextNode()) textes.push(t);
    if (textes.length) {
      let n = 0,
        deb = null,
        fin = null;
      const dernier = textes[textes.length - 1];
      for (const t of textes) {
        const l = t.nodeValue.length;
        if (!deb && (d < n + l || t === dernier)) deb = [t, Math.max(0, Math.min(d - n, l))];
        if (deb && !fin && (f <= n + l || t === dernier)) fin = [t, Math.max(0, Math.min(f - n, l))];
        n += l;
      }
      const r = document.createRange();
      r.setStart(...deb);
      if (d === f) r.collapse(true);
      else r.setEnd(...fin);
      s.removeAllRanges();
      s.addRange(r);
    }
  }
  const r = s.getRangeAt(0);
  const blocs = [...zone.querySelectorAll("div, p")].filter(b => !b.querySelector("div, p") && r.intersectsNode(b));
  if (!blocs.length) return;
  blocs.forEach(b => {
    b.style.textAlign = a === "left" ? "" : a;
    b.removeAttribute("align");
    if (!b.getAttribute("style")) b.removeAttribute("style");
  });
  zone.dispatchEvent(new Event("input", { bubbles: true }));
}
function versHex(c) {
  const m = String(c || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return "#" + [m[1], m[2], m[3]].map(x => Number(x).toString(16).padStart(2, "0")).join("");
  return /^#[0-9a-f]{3,6}$/i.test(c || "") ? c.toLowerCase() : "";
}
function htmlVersMarquage(racine) {
  const runs = []; // [texte, format] ; texte "\n" = retour à la ligne
  const fin = () => (runs.length ? runs[runs.length - 1][0] : "\n");
  const nl = () => runs.push(["\n", null]);
  const parcourir = (n, f) => {
    if (n.nodeType === 3) {
      if (n.nodeValue) {
        if (f.al && fin() === "\n") runs.push(["[" + f.al + "]", null]);
        runs.push([n.nodeValue.replace(/ /g, " "), f]);
      }
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (tag === "BR") {
      nl();
      return;
    }
    const st = n.style || {};
    const g = Object.assign({}, f);
    if (tag === "B" || tag === "STRONG" || /^(bold|[6-9]00)$/.test(st.fontWeight || "")) g.b = true;
    if (st.fontWeight === "normal" || st.fontWeight === "400") g.b = false;
    if (tag === "U" || /underline/.test(st.textDecoration || "") || /underline/.test(st.textDecorationLine || "")) g.u = true;
    if (tag === "I" || tag === "EM" || st.fontStyle === "italic") g.i = true;
    const coul = versHex(st.color || (tag === "FONT" ? n.getAttribute("color") : ""));
    if (coul) g.c = coul === "#000000" ? "" : coul;
    // taille en % de la taille normale (100 = normale)
    const fs = st.fontSize || "",
      em = fs.match(/^([\d.]+)em$/);
    let t = null;
    if (em) t = Math.round(parseFloat(em[1]) * 100);
    else if (/^(x+-large|larger|large)$/.test(fs)) t = 125;
    else if (fs === "medium") t = 100;
    else if (/^(small|smaller)$/.test(fs)) t = 85;
    else if (/^x+-small$/.test(fs)) t = 80;
    if (tag === "FONT" && n.getAttribute("size")) {
      const z = Number(n.getAttribute("size"));
      t = z >= 5 ? 125 : z === 4 ? 110 : z === 3 ? 100 : z === 2 ? 85 : 80;
    }
    if (t !== null) g.t = t;
    const bloc = tag === "DIV" || tag === "P" || tag === "LI";
    const al = (st.textAlign || n.getAttribute("align") || "").toLowerCase();
    if (bloc && al) g.al = al === "center" ? "centre" : al === "right" || al === "end" ? "droite" : "";
    if (bloc && runs.length && fin() !== "\n") nl();
    if (bloc && g.al) runs.push(["[" + g.al + "]", null]);
    if (bloc && n.classList.contains("li-puce")) runs.push(["- ", null]);
    n.childNodes.forEach(x => parcourir(x, g));
    if (bloc && n.nextSibling && fin() !== "\n") nl();
  };
  racine.childNodes.forEach(x => parcourir(x, {}));
  let out = "";
  for (const [t, f] of runs) {
    if (t === "\n" || !f) {
      out += t;
      continue;
    }
    let s = t;
    if (f.b) s = "**" + s + "**";
    if (f.i) s = "[i]" + s + "[/i]";
    if (f.u) s = "[u]" + s + "[/u]";
    if (f.t && f.t !== 100)
      s = f.t === 125 ? "[grand]" + s + "[/grand]" : f.t === 85 ? "[petit]" + s + "[/petit]" : `[taille=${f.t}]` + s + "[/taille]";
    if (f.c) s = `[couleur=${f.c}]` + s + "[/couleur]";
    out += s;
  }
  // fusion des marques collées : **a****b** -> **ab**
  for (let k = 0; k < 3; k++) out = out.replace(/\*\*\*\*/g, "").replace(/\[\/(u|i|grand|petit)\]\[\1\]/g, "");
  return out.replace(/\n$/, "");
}
/** zone de texte mise en forme ; s'utilise comme un textarea (propriété value, évènement input) */
/** position (en caractères) du début et de la fin d'une sélection dans une zone, et l'inverse */
function positionsTexte(zone, r) {
  const avant = document.createRange();
  avant.selectNodeContents(zone);
  avant.setEnd(r.startContainer, r.startOffset);
  const d = avant.toString().length;
  return [d, d + r.toString().length];
}
function selectionnerTexte(zone, debut, fin) {
  const r = document.createRange();
  let n = 0,
    ok1 = false;
  const marche = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
  for (let t = marche.nextNode(); t; t = marche.nextNode()) {
    const l = t.nodeValue.length;
    if (!ok1 && debut <= n + l) {
      r.setStart(t, debut - n);
      ok1 = true;
    }
    if (ok1 && fin <= n + l) {
      r.setEnd(t, fin - n);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      return;
    }
    n += l;
  }
}
/** liste « Taille » des barres de mise en forme : taille du texte sélectionné, en % de la taille normale */
const TAILLES_TEXTE = [
  [80, "Très petit (80 %)"],
  [90, "Petit (90 %)"],
  [100, "Normale"],
  [110, "Un peu grand (110 %)"],
  [125, "Grand (125 %)"],
  [150, "Très grand (150 %)"],
];
function choixTaille(zone, apres) {
  let plage = null; // la sélection dans le texte (la liste prend le curseur quand on l'ouvre)
  document.addEventListener("selectionchange", () => {
    const s = getSelection();
    if (s.rangeCount && zone.contains(s.anchorNode)) plage = s.getRangeAt(0).cloneRange();
  });
  const sel = elRiche(
    "select",
    { class: "choix-taille", title: "Taille du texte sélectionné" },
    elRiche("option", { value: "" }, "Taille"),
    ...TAILLES_TEXTE.map(([t, l]) => elRiche("option", { value: t }, l))
  );
  sel.addEventListener("mousedown", e => e.stopPropagation());
  sel.addEventListener("change", () => {
    const t = Number(sel.value);
    sel.value = "";
    if (!t) return;
    zone.focus();
    if (plage) {
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(plage);
    }
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("fontSize", false, "7");
    const nouveaux = [];
    zone.querySelectorAll('font[size="7"]').forEach(f => {
      // la nouvelle taille remplace celle qu'avait déjà le texte choisi
      f.querySelectorAll("[style]").forEach(x => {
        x.style.fontSize = "";
      });
      f.querySelectorAll("font[size]").forEach(x => x.removeAttribute("size"));
      const sp = elRiche("span", { style: `font-size:${t / 100}em` });
      sp.append(...f.childNodes);
      f.replaceWith(sp);
      nouveaux.push(sp);
    });
    // le texte choisi reste sélectionné (pour changer encore sa taille, ou le mettre en gras…)
    let debut = null,
      fin = null;
    if (nouveaux.length) {
      const r = document.createRange();
      r.setStartBefore(nouveaux[0]);
      r.setEndAfter(nouveaux[nouveaux.length - 1]);
      [debut, fin] = positionsTexte(zone, r);
    }
    if (apres) apres();
    if (debut !== null) selectionnerTexte(zone, debut, fin);
  });
  return sel;
}
function zoneRiche(placeholder) {
  const zone = elRiche("div", { class: "editeur-riche", contenteditable: "true", "data-placeholder": placeholder || "" });
  const racine = elRiche("div", { class: "riche" });
  let derniere = null;
  const majVide = () => zone.classList.toggle("vide", !zone.innerText.trim());
  zone.addEventListener("input", majVide);
  zone.addEventListener("focus", () => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "div");
    } catch (er) {
      /* */
    }
  });
  zone.addEventListener("paste", e => {
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
  });
  document.addEventListener("selectionchange", () => {
    const s = getSelection();
    if (s.rangeCount && zone.contains(s.anchorNode)) derniere = s.getRangeAt(0).cloneRange();
  });
  const cmd = (c, v) => {
    zone.focus();
    if (derniere) {
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(derniere);
    }
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(c, false, v);
    zone.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const bouton = (titre, contenu, action) => {
    const b = elRiche("button", { class: "icone", type: "button", title: titre }, contenu);
    b.addEventListener("mousedown", e => {
      e.preventDefault();
      action();
    });
    return b;
  };
  racine.append(
    elRiche(
      "div",
      { class: "barre-riche" },
      bouton("Gras (sélection)", elRiche("b", {}, "G"), () => cmd("bold")),
      bouton("Italique", elRiche("i", {}, "I"), () => cmd("italic")),
      bouton("Souligné", elRiche("u", {}, "S"), () => cmd("underline")),
      elRiche("span", { class: "sep" }),
      ...COULEURS_TEXTE.map(([c, nom]) =>
        bouton("Couleur : " + nom, elRiche("span", { class: "pastille", style: "background:" + c }), () => cmd("foreColor", c))
      ),
      elRiche("span", { class: "sep" }),
      choixTaille(zone, () => {
        racine.value = racine.value;
        zone.dispatchEvent(new Event("input", { bubbles: true }));
      }),
      elRiche("span", { class: "sep" }),
      bouton("Aligner à gauche", iconeAlignement("left"), () => alignerBlocs(zone, "left", derniere)),
      bouton("Centrer", iconeAlignement("center"), () => alignerBlocs(zone, "center", derniere)),
      bouton("Aligner à droite", iconeAlignement("right"), () => alignerBlocs(zone, "right", derniere)),
      elRiche("span", { class: "sep" }),
      bouton("Retirer la mise en forme", "⌫", () => cmd("removeFormat"))
    ),
    zone
  );
  Object.defineProperty(racine, "value", {
    get: () => htmlVersMarquage(zone),
    set: v => {
      zone.innerHTML = marquageVersHtml(v);
      majVide();
    },
  });
  racine.insererTexte = txt => {
    zone.focus();
    if (derniere) {
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(derniere);
    }
    document.execCommand("insertText", false, txt);
  };
  racine.focus = () => zone.focus();
  return racine;
}
