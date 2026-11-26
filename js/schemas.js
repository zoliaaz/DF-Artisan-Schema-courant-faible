"use strict";
/* Module Électricien > Schémas interphone / portail : des appareils (blocs à bornes : repère et rôle de chaque borne)
   reliés par des liaisons (type de câble, longueur, fils de borne à borne). Deux vues du même schéma :
   synoptique (les appareils et les câbles) et multifilaire (chaque fil, de borne à borne, avec sa couleur).
   Alertes : plus de fils que de conducteurs dans le câble, longueur max de l'appareil dépassée, câble imposé par une
   borne (ex. coaxial d'une antenne Vigik), chute de tension (facultatif : courant et tension de la liaison).
   Enregistré dans la table « plans » (genre « schema ») ; modèles d'appareils et liste des câbles dans les
   paramètres (schemas.modeles, schemas.cables). */

/** couleurs normées des conducteurs, paire par paire (a, b) :
 *  SYT1 (UTE C 93-529) : jusqu'à 3 paires blanc/rouge, bleu/bleu clair, jaune/gris ; au-delà, conducteur a bleu clair,
 *  gris, orange, violet (change toutes les 7 paires), conducteur b blanc, bleu, jaune, marron, noir, rouge, vert ;
 *  PTT 298 : gris/blanc, bleu clair/rose, orange/jaune, violet/marron ;
 *  Cat 5e / 6 (TIA-568) : paire 1 bleu, 2 orange, 3 vert, 4 marron (blanc rayé de la couleur, puis la couleur) ;
 *  câbles d'énergie (HD 308) : marron, bleu (neutre), vert/jaune (terre), noir, gris ;
 *  multiconducteurs (DIN 47100) : blanc, marron, vert, jaune, gris, rose, bleu, rouge… (à vérifier selon le câble) */
function schCouleursSyt(paires) {
  if (paires <= 3) return ["blanc", "rouge", "bleu", "bleu clair", "jaune", "gris"].slice(0, 2 * paires);
  const A = ["bleu clair", "gris", "orange", "violet"],
    B = ["blanc", "bleu", "jaune", "marron", "noir", "rouge", "vert"];
  const out = [];
  for (let i = 0; i < paires; i++) out.push(A[Math.floor(i / 7) % 4], B[i % 7]);
  return out;
}
const SCH_298 = ["gris", "blanc", "bleu clair", "rose", "orange", "jaune", "violet", "marron"];
const SCH_CAT = ["blanc/bleu", "bleu", "blanc/orange", "orange", "blanc/vert", "vert", "blanc/marron", "marron"];
const SCH_DIN = ["blanc", "marron", "vert", "jaune", "gris", "rose", "bleu", "rouge", "noir", "violet"];
/** câbles proposés d'origine (modifiables : bouton « Câbles… », la liste modifiée va dans les paramètres) :
 *  conducteurs = nombre de fils utilisables, section en mm² (chute de tension), coax = câble coaxial (âme + tresse),
 *  paires = conducteurs groupés par paires (repérés P1a, P1b…), couleurs = couleur normée de chaque conducteur */
const SCH_CABLES_DEFAUT = [
  { id: "syt1", nom: "SYT1 1 paire 6/10", conducteurs: 2, section: 0.28, paires: true, couleurs: schCouleursSyt(1) },
  { id: "syt2", nom: "SYT1 2 paires 6/10", conducteurs: 4, section: 0.28, paires: true, couleurs: schCouleursSyt(2) },
  { id: "syt3", nom: "SYT1 3 paires 6/10", conducteurs: 6, section: 0.28, paires: true, couleurs: schCouleursSyt(3) },
  { id: "syt4", nom: "SYT1 4 paires 6/10", conducteurs: 8, section: 0.28, paires: true, couleurs: schCouleursSyt(4) },
  { id: "syt8", nom: "SYT1 8 paires 6/10", conducteurs: 16, section: 0.28, paires: true, couleurs: schCouleursSyt(8) },
  { id: "p2981", nom: "PTT 298 1 paire 5/10", conducteurs: 2, section: 0.2, paires: true, couleurs: SCH_298.slice(0, 2) },
  { id: "p2982", nom: "PTT 298 2 paires 5/10", conducteurs: 4, section: 0.2, paires: true, couleurs: SCH_298.slice(0, 4) },
  { id: "p2984", nom: "PTT 298 4 paires 5/10", conducteurs: 8, section: 0.2, paires: true, couleurs: SCH_298.slice() },
  { id: "bus2", nom: "Câble bus 2 fils 2×1 mm² torsadé", conducteurs: 2, section: 1 },
  { id: "mc6", nom: "Multiconducteur 6×0,22 mm²", conducteurs: 6, section: 0.22, couleurs: SCH_DIN.slice(0, 6) },
  { id: "mc8", nom: "Multiconducteur 8×0,22 mm²", conducteurs: 8, section: 0.22, couleurs: SCH_DIN.slice(0, 8) },
  { id: "r2v2", nom: "U1000 R2V 2×1,5 mm²", conducteurs: 2, section: 1.5, couleurs: ["marron", "bleu"] },
  { id: "r2v3", nom: "U1000 R2V 3G1,5 mm²", conducteurs: 3, section: 1.5, couleurs: ["marron", "bleu", "vert/jaune"] },
  { id: "r2v3b", nom: "U1000 R2V 3G2,5 mm²", conducteurs: 3, section: 2.5, couleurs: ["marron", "bleu", "vert/jaune"] },
  { id: "h07", nom: "H07RN-F 3G1,5 mm²", conducteurs: 3, section: 1.5, couleurs: ["marron", "bleu", "vert/jaune"] },
  { id: "coax", nom: "Coaxial 75 Ω", conducteurs: 2, section: 0.5, coax: true, couleurs: ["âme", "tresse"] },
  { id: "cat5", nom: "Cat 5e U/UTP", conducteurs: 8, section: 0.2, paires: true, couleurs: SCH_CAT.slice() },
  { id: "cat6", nom: "Cat 6 U/FTP", conducteurs: 8, section: 0.25, paires: true, couleurs: SCH_CAT.slice() },
];
/** couleurs de base des fils ; un fil à deux couleurs s'écrit « base/rayure » (ex. « blanc/bleu » : blanc rayé de
 *  bleu, « bleu/blanc » : bleu rayé de blanc, « vert/jaune ») : la 2e en tirets par-dessus */
const SCH_TEINTES = {
  blanc: "#ffffff",
  rouge: "#dc2626",
  bleu: "#1d4ed8",
  "bleu clair": "#7dd3fc",
  vert: "#16a34a",
  jaune: "#eab308",
  orange: "#f97316",
  marron: "#92400e",
  gris: "#9ca3af",
  noir: "#111827",
  violet: "#7c3aed",
  rose: "#f9a8d4",
  âme: "#b45309",
  tresse: "#9ca3af",
};
/** couleurs proposées pour un fil personnalisé : les teintes, rayées de blanc ou non, et vert/jaune */
const SCH_COULEURS_PERSO = [
  ...Object.keys(SCH_TEINTES).filter(k => k !== "âme" && k !== "tresse"),
  "vert/jaune",
  ...Object.keys(SCH_TEINTES)
    .filter(k => !["blanc", "âme", "tresse"].includes(k))
    .map(k => k + "/blanc"),
];
/** couleur d'un fil -> [teinte, rayure] (codes) */
const schTeintes = nom =>
  String(nom || "")
    .split("/")
    .map(x => SCH_TEINTES[x.trim()] || null);
/** libellé d'une couleur : « bleu rayé blanc » */
const schLibCouleur = nom => {
  const [a, b] = String(nom || "").split("/");
  return !nom ? "" : b ? (a === "vert" && b === "jaune" ? "vert/jaune" : a + " rayé " + b) : a;
};
/** état d'un appareil : couleur du cadre (existant, à remplacer, neuf, en panne) */
const SCH_ETATS = [
  ["neuf", "Neuf", "#16a34a"],
  ["existant", "Existant", "#64748b"],
  ["remplacer", "À remplacer", "#ea580c"],
  ["panne", "En panne", "#dc2626"],
];
/** sortes d'appareils : [clé, libellé, préfixe du repère] */
const SCH_CATEGORIES = [
  ["platine", "Platine de rue", "PL"],
  ["poste", "Poste intérieur", "PI"],
  ["alimentation", "Alimentation", "AL"],
  ["gache", "Gâche / serrure", "GA"],
  ["ventouse", "Ventouse", "VE"],
  ["bouton", "Bouton poussoir", "BP"],
  ["lecteur", "Lecteur Vigik / badges", "LV"],
  ["antenne", "Antenne", "AN"],
  ["centrale", "Centrale / module", "CE"],
  ["portail", "Motorisation portail", "MO"],
  ["securite", "Cellules, feu, sécurité", "SE"],
  ["boite", "Boîte de dérivation / bornier", "BD"],
  ["autre", "Autre", "X"],
];
/** modèles génériques d'origine (bornes à adapter selon la notice du fabricant) */
const SCH_MODELES_DEFAUT = [
  {
    id: "g-platine-bus",
    nom: "Platine de rue 2 fils (bus)",
    categorie: "platine",
    bornes: [
      ["L1", "Bus"],
      ["L2", "Bus"],
      ["S+", "Gâche"],
      ["S−", "Gâche"],
      ["BP", "Bouton de sortie"],
      ["BP", "Commun bouton"],
    ],
  },
  {
    id: "g-poste-bus",
    nom: "Poste intérieur 2 fils (bus)",
    categorie: "poste",
    bornes: [
      ["L1", "Bus"],
      ["L2", "Bus"],
    ],
  },
  {
    id: "g-platine-4n",
    nom: "Platine audio 4+n (fils)",
    categorie: "platine",
    bornes: [
      ["1", "Commun (−)"],
      ["2", "Micro"],
      ["3", "Haut-parleur"],
      ["4", "Alimentation +"],
      ["5", "Ouvre-porte"],
      ["A1", "Appel poste 1"],
    ],
  },
  {
    id: "g-poste-5",
    nom: "Combiné 5 fils (ancien)",
    categorie: "poste",
    bornes: [
      ["1", "Commun (−)"],
      ["2", "Micro"],
      ["3", "Haut-parleur"],
      ["5", "Ouvre-porte"],
      ["A", "Appel"],
    ],
  },
  {
    id: "g-alim",
    nom: "Alimentation 230 V / 12 V",
    categorie: "alimentation",
    bornes: [
      ["L", "Phase 230 V"],
      ["N", "Neutre 230 V"],
      ["+", "+12 V"],
      ["−", "0 V"],
    ],
  },
  {
    id: "g-gache",
    nom: "Gâche électrique",
    categorie: "gache",
    bornes: [
      ["1", "Gâche"],
      ["2", "Gâche"],
    ],
  },
  {
    id: "g-ventouse",
    nom: "Ventouse 12 V",
    categorie: "ventouse",
    bornes: [
      ["+", "+12 V"],
      ["−", "0 V"],
    ],
  },
  {
    id: "g-bp",
    nom: "Bouton poussoir de sortie",
    categorie: "bouton",
    bornes: [
      ["NO", "Contact"],
      ["C", "Commun"],
    ],
  },
  {
    id: "g-vigik",
    nom: "Lecteur Vigik",
    categorie: "lecteur",
    bornes: [
      ["+", "+12 V"],
      ["−", "0 V"],
      ["NO", "Relais"],
      ["C", "Commun relais"],
      ["ANT", "Antenne (âme)", "coax"],
      ["TR", "Antenne (tresse)", "coax"],
    ],
  },
  {
    id: "g-antenne",
    nom: "Antenne Vigik déportée",
    categorie: "antenne",
    bornes: [
      ["ANT", "Âme", "coax"],
      ["TR", "Tresse", "coax"],
    ],
  },
  {
    id: "g-portail",
    nom: "Motorisation portail",
    categorie: "portail",
    bornes: [
      ["L", "Phase 230 V"],
      ["N", "Neutre 230 V"],
      ["PE", "Terre"],
      ["START", "Commande ouverture"],
      ["COM", "Commun commandes"],
    ],
  },
  {
    id: "g-boite",
    nom: "Boîte de dérivation",
    categorie: "boite",
    bornes: [
      ["1", ""],
      ["2", ""],
      ["3", ""],
      ["4", ""],
    ],
  },
];
// (hauteurs en multiples de 10 : les bornes tombent sur la grille du routage des fils)
const SCH = { L: 170, HS: 60, HM_TETE: 40, HM_BORNE: 20, GRILLE: 10, RHO: 0.0225 };
const SCH_TENSIONS = ["12", "24"];

/** écran étroit (tablette en portrait, téléphone) : le panneau passe par-dessus le dessin */
const SCH_ETROIT = () => matchMedia("(max-width: 860px), (max-aspect-ratio: 4/5)").matches;
/** version autonome (page web sans DF artisan : schemas-web) : ni clients, ni devis, ni documentation */
const SCH_AUTONOME = () => !!window.SCHEMAS_AUTONOMES || typeof rattacherPlan !== "function";
const schId = () => "s" + Math.random().toString(36).slice(2, 9);
const schCables = () => {
  const c = (PARAMS.schemas || {}).cables;
  if (!(Array.isArray(c) && c.length)) return SCH_CABLES_DEFAUT;
  // (liste enregistrée avant les couleurs normées : celles d'origine pour les câbles d'origine qui n'en ont pas)
  return c.map(x => {
    const o = SCH_CABLES_DEFAUT.find(d => d.id === x.id);
    return o && !(x.couleurs && x.couleurs.length) ? { ...x, couleurs: o.couleurs, paires: o.paires } : x;
  });
};
const schCable = id => schCables().find(c => c.id === id) || null;
/** modèles enregistrés (paramètres schemas.modeles) : les vôtres, et les génériques modifiés (même id « g-… »,
 *  ils remplacent celui d'origine) ; schemas.masques : génériques supprimés de la liste */
const schModelesEnregistres = () => ((PARAMS.schemas || {}).modeles || []).filter(m => m && m.nom);
const schModelesPerso = () => schModelesEnregistres().filter(m => !String(m.id || "").startsWith("g-"));
const schModelesGeneriques = () => {
  const masques = new Set((PARAMS.schemas || {}).masques || []),
    modifies = schModelesEnregistres().filter(m => String(m.id || "").startsWith("g-"));
  return SCH_MODELES_DEFAUT.filter(m => !masques.has(m.id)).map(m => {
    const x = modifies.find(y => y.id === m.id);
    return x ? { ...x, modifie: true } : m;
  });
};
const schModele = id => schModelesPerso().find(m => m.id === id) || schModelesGeneriques().find(m => m.id === id) || null;
const schCat = k => SCH_CATEGORIES.find(c => c[0] === k) || SCH_CATEGORIES[SCH_CATEGORIES.length - 1];
const schEtat = k => SCH_ETATS.find(e => e[0] === k) || SCH_ETATS[0];
const schNum = v => {
  const n = nombre(v);
  return n > 0 ? n : 0;
};
const schFr = (x, d = 1) => Number(x).toLocaleString("fr-FR", { maximumFractionDigits: d });
async function schEnregistrerParams(cle, valeur) {
  if (typeof cle === "object") {
    // (plusieurs réglages d'un coup : { modeles, masques })
    PARAMS.schemas = Object.assign({}, PARAMS.schemas || {}, cle);
    majVersionParams(await api("PUT", "/api/parametres", { schemas: cle }));
    return;
  }
  PARAMS.schemas = Object.assign({}, PARAMS.schemas || {}, { [cle]: valeur });
  majVersionParams(await api("PUT", "/api/parametres", { schemas: { [cle]: valeur } }));
}
function schNouvellesDonnees() {
  // (uid : le même schéma reconnu d'un fichier à l'autre, entre DF artisan et la version web)
  return { uid: schId() + schId(), appareils: [], liaisons: [], groupes: [], vue: "synoptique", chute_max: 10 };
}

/* ---------- fichiers de schémas (.schemas.json) : DF artisan et la version web s'échangent leurs schémas ---------- */
/** enregistre en fichier les schémas (tous, ou ceux de la liste ids), avec les modèles d'appareils et les câbles */
async function exporterSchemasFichier(ids) {
  const choisis = (await api("GET", "/api/plans?genre=schema")).filter(p => !ids || ids.includes(p.id));
  if (!choisis.length) return toast("Aucun schéma à enregistrer.");
  const schemas = [];
  for (const q of choisis) {
    const x = await api("GET", "/api/plans/" + q.id);
    const d = x.donnees || {};
    if (!d.uid) {
      // (schéma d'avant les fichiers : il reçoit son identifiant, gardé pour les prochains échanges)
      d.uid = schId() + schId();
      await api("PUT", "/api/plans/" + x.id, { donnees: d });
    }
    schemas.push({ nom: x.nom, adresse: x.adresse || "", cree_le: x.cree_le, modifie_le: x.modifie_le, donnees: d });
  }
  const p = PARAMS.schemas || {};
  const contenu = JSON.stringify(
    {
      format: "schemas-interphone",
      version: 1,
      enregistre_le: new Date().toISOString(),
      parametres: { schemas: { modeles: p.modeles || [], cables: p.cables || [] } },
      schemas,
    },
    null,
    1
  );
  const nom = schemas.length === 1 ? schemas[0].nom.replace(/[\\/:*?"<>|]+/g, "-").trim() || "schema" : "mes-schemas";
  const a = h("a", {
    href: URL.createObjectURL(new Blob([contenu], { type: "application/json" })),
    download: nom + "-" + new Date().toISOString().slice(0, 10) + ".schemas.json",
  });
  document.body.append(a);
  a.click();
  a.remove();
  toast(schemas.length + " schéma(s) enregistré(s) dans le fichier.");
}
/** ouvre un fichier de schémas : un schéma déjà là (même identifiant) est remplacé par celui du fichier, après
 *  confirmation ; les autres sont ajoutés ; modèles et câbles du fichier complètent les vôtres (rien n'est remplacé) */
function importerSchemasFichier(apres) {
  const f = h("input", { type: "file", accept: ".json,application/json" });
  f.addEventListener("change", async () => {
    try {
      if (!f.files[0]) return;
      const x = JSON.parse(await f.files[0].text());
      if (x.format !== "schemas-interphone" || !Array.isArray(x.schemas)) throw new Error("Ce fichier n'est pas un fichier de schémas.");
      // schémas déjà là, par identifiant (et, pour les fichiers sans identifiant, par nom et date de création)
      const ici = [];
      for (const q of await api("GET", "/api/plans?genre=schema")) {
        const y = await api("GET", "/api/plans/" + q.id);
        ici.push({ id: y.id, uid: (y.donnees || {}).uid, nom: y.nom, cree_le: y.cree_le });
      }
      const correspond = s =>
        ici.find(y => (s.donnees || {}).uid && y.uid === s.donnees.uid) ||
        ici.find(y => !(s.donnees || {}).uid && y.nom === s.nom && y.cree_le === s.cree_le);
      const remplaces = x.schemas.filter(correspond);
      if (
        remplaces.length &&
        !(await demanderOui(
          `${x.schemas.length} schéma(s) dans le fichier : ${remplaces.length} déjà là (${remplaces.map(s => "« " + s.nom + " »").join(", ")}), remplacé(s) par la version du fichier ; ${x.schemas.length - remplaces.length} ajouté(s). Continuer ?`
        ))
      )
        return;
      for (const s of x.schemas) {
        const d = s.donnees || {};
        if (!d.uid) d.uid = schId() + schId();
        const y = correspond(s);
        if (y) await api("PUT", "/api/plans/" + y.id, { nom: s.nom, adresse: s.adresse || "", donnees: d });
        else await api("POST", "/api/plans", { genre: "schema", nom: s.nom || "Schéma", adresse: s.adresse || "", donnees: d });
      }
      // modèles et câbles du fichier : ajoutés à ceux d'ici s'ils n'y sont pas (même identifiant)
      const sf = (x.parametres || {}).schemas || {},
        si = PARAMS.schemas || {},
        maj = {};
      for (const cle of ["modeles", "cables"]) {
        const deja = si[cle] && si[cle].length ? si[cle] : cle === "cables" ? schCables() : [];
        const plus = (sf[cle] || []).filter(v => v && v.id && !deja.some(w => w.id === v.id));
        if (plus.length) maj[cle] = [...deja, ...plus];
      }
      if (Object.keys(maj).length) await schEnregistrerParams(maj);
      toast(`${x.schemas.length} schéma(s) ouvert(s) depuis le fichier.`);
      if (apres) apres();
    } catch (e) {
      erreur(e);
    }
  });
  f.click();
}
/** prochain repère libre d'une sorte d'appareil : PL1, PL2… */
function schRepere(D, categorie) {
  const pre = schCat(categorie)[2];
  let n = 0;
  for (const a of D.appareils) {
    const m = String(a.rep || "").match(/^([A-Z]+)(\d+)$/);
    if (m && m[1] === pre) n = Math.max(n, Number(m[2]));
  }
  return pre + (n + 1);
}
function schRepereLiaison(D) {
  let n = 0;
  for (const l of D.liaisons) {
    const m = String(l.rep || "").match(/^C(\d+)$/);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return "C" + (n + 1);
}
/** appareil fait depuis un modèle (d'origine ou à soi) */
function schAppareilDepuisModele(D, m, x, y) {
  return {
    id: schId(),
    modele: m.id || "",
    bornes_fixes: !!m.bornes_fixes,
    nom: m.nom,
    rep: schRepere(D, m.categorie),
    categorie: m.categorie || "autre",
    etat: "neuf",
    x,
    y,
    bornes: (m.bornes || []).map(b =>
      Array.isArray(b) ? { id: schId(), rep: b[0], role: b[1] || "", cable: b[2] || "", cote: b[3] || "" } : { ...b, id: schId() }
    ),
    longueurs: (m.longueurs || []).map(l => ({ ...l })),
    note: "",
  };
}

/* ---------- calculs : alertes d'une liaison ---------- */
/** longueur max d'un appareil pour ce câble (celle du câble, sinon « tous câbles ») */
function schLongueurMax(a, cableId) {
  const l = a.longueurs || [];
  const x = l.find(e => e.cable && e.cable === cableId && schNum(e.m)) || l.find(e => !e.cable && schNum(e.m));
  return x ? schNum(x.m) : 0;
}
/** chute de tension d'une liaison (aller et retour, cuivre) : null si courant, longueur ou section manquent */
function schChute(l) {
  const c = schCable(l.cable),
    L = schNum(l.longueur),
    I = schNum(l.courant),
    U = schNum(l.tension);
  if (!c || !L || !I || !(c.section > 0)) return null;
  const du = (2 * SCH.RHO * L * I) / c.section;
  return { du, pc: U ? (du / U) * 100 : null };
}
/* ---------- bouts d'une liaison : un appareil, ou un groupe (appareils au même endroit, un seul câble) ---------- */
const schGroupe = (D, id) => (D.groupes || []).find(g => g.id === id) || null;
const schGroupeDe = (D, appId) => (D.groupes || []).find(g => g.membres.includes(appId)) || null;
/** appareils d'un bout de liaison */
function schAppsBout(D, id) {
  const g = schGroupe(D, id);
  return (g ? g.membres : [id]).map(m => D.appareils.find(a => a.id === m)).filter(Boolean);
}
/** une borne d'un bout de liaison : { a (appareil), b (borne) } */
function schBorneBout(D, id, bid) {
  if (!bid) return null;
  for (const a of schAppsBout(D, id)) {
    const b = (a.bornes || []).find(x => x.id === bid);
    if (b) return { a, b };
  }
  return null;
}
/** nom court d'un bout : repère de l'appareil, ou nom du groupe */
function schRepBout(D, id) {
  const g = schGroupe(D, id);
  if (g) return g.nom || "Ensemble";
  const a = D.appareils.find(x => x.id === id);
  return a ? a.rep || a.nom || "?" : "?";
}
function schNomBout(D, id) {
  const g = schGroupe(D, id);
  if (g)
    return (
      (g.nom || "Ensemble") +
      " (" +
      schAppsBout(D, id)
        .map(a => a.rep)
        .join(", ") +
      ")"
    );
  const a = D.appareils.find(x => x.id === id);
  return a ? `${a.rep} ${a.nom}` : "?";
}
/** ce qui est « au même endroit » qu'un appareil ou un groupe : lui, son groupe, les appareils du groupe */
function schEndroit(D, id) {
  const g = schGroupe(D, id) || schGroupeDe(D, id);
  return new Set(g ? [g.id, ...g.membres] : [id]);
}
/** la liaison (le câble) entre deux endroits, s'il y en a une ; deux appareils d'un même groupe : seulement la leur */
function schLiaisonEntre(D, x, y) {
  const gx = schGroupe(D, x) || schGroupeDe(D, x),
    gy = schGroupe(D, y) || schGroupeDe(D, y);
  if (gx && gx === gy) return D.liaisons.find(l => (l.a === x && l.b === y) || (l.a === y && l.b === x)) || null;
  const ex = schEndroit(D, x),
    ey = schEndroit(D, y);
  return D.liaisons.find(l => (ex.has(l.a) && ey.has(l.b)) || (ey.has(l.a) && ex.has(l.b))) || null;
}
function schAlertesLiaison(D, l) {
  const c = schCable(l.cable),
    out = [];
  if (!schAppsBout(D, l.a).length || !schAppsBout(D, l.b).length) return out;
  const fils = (l.fils || []).filter(f => f.ba || f.bb);
  if (!c) out.push("Câble non choisi");
  else if (fils.length > c.conducteurs) out.push(`${fils.length} fils pour ${c.conducteurs} conducteurs dans le câble ${c.nom}`);
  const L = schNum(l.longueur);
  // (longueur max : chaque appareil d'où partent des fils ; sans fil, ceux des deux bouts)
  const concernes = new Set();
  for (const [bout, cle] of [
    [l.a, "ba"],
    [l.b, "bb"],
  ]) {
    const x = fils.map(f => schBorneBout(D, bout, f[cle])).filter(Boolean);
    for (const a of x.length ? x.map(y => y.a) : schAppsBout(D, bout)) concernes.add(a);
  }
  for (const ap of concernes) {
    const m = schLongueurMax(ap, l.cable);
    if (m && L > m) out.push(`${schFr(L)} m : plus que les ${schFr(m)} m admis par ${ap.rep || ap.nom}${c ? " en " + c.nom : ""}`);
  }
  // borne qui impose un câble (ex. coaxial d'une antenne) : une alerte par appareil
  const parApp = new Map();
  for (const f of fils)
    for (const x of [schBorneBout(D, l.a, f.ba), schBorneBout(D, l.b, f.bb)]) {
      if (!x || !x.b.cable || x.b.cable === l.cable) continue;
      const m = parApp.get(x.a) || {};
      (m[x.b.cable] = m[x.b.cable] || []).push(x.b.rep);
      parApp.set(x.a, m);
    }
  for (const [ap, parCable] of parApp)
    for (const [cid, reps] of Object.entries(parCable)) {
      const ci = schCable(cid);
      out.push(
        `${reps.length > 1 ? "Les bornes " + reps.join(", ") : "La borne " + reps[0]} de ${ap.rep} ${reps.length > 1 ? "demandent" : "demande"} du ${ci ? ci.nom : cid}`
      );
    }
  const ch = schChute(l);
  if (ch && ch.pc !== null && ch.pc > (schNum(D.chute_max) || 10))
    out.push(`Chute de tension ${schFr(ch.du, 2)} V (${schFr(ch.pc)} %) : plus de ${schFr(schNum(D.chute_max) || 10)} %`);
  return out;
}
/** nomenclature : câbles (longueur totale par type) et appareils (par modèle et état) */
function schNomenclature(D) {
  const cables = new Map();
  for (const l of D.liaisons) {
    const c = schCable(l.cable),
      k = c ? c.nom : "(câble non choisi)";
    const e = cables.get(k) || { nom: k, n: 0, m: 0, sans: 0 };
    e.n++;
    if (schNum(l.longueur)) e.m += schNum(l.longueur);
    else e.sans++;
    cables.set(k, e);
  }
  const apps = new Map();
  for (const a of D.appareils) {
    const k = (a.nom || "Appareil") + "\u0000" + (a.etat || "neuf");
    const e = apps.get(k) || { nom: a.nom || "Appareil", etat: a.etat || "neuf", n: 0, reps: [] };
    e.n++;
    e.reps.push(a.rep);
    apps.set(k, e);
  }
  // ensembles (groupes : cadre pointillé) et leurs modules
  const ensembles = (D.groupes || []).map(g => ({
    nom: g.nom || "Ensemble",
    modules: g.membres.map(id => D.appareils.find(a => a.id === id)).filter(Boolean),
  }));
  return { cables: [...cables.values()], appareils: [...apps.values()], ensembles: ensembles.filter(e => e.modules.length) };
}

/* ---------- dessin (SVG) ---------- */
function sv(tag, attrs, ...enfants) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
  for (const e of enfants.flat()) if (e !== null && e !== undefined && e !== false) el.append(e instanceof Node ? e : String(e));
  return el;
}
const schPos = (a, vue) => (vue === "multifilaire" ? { x: a.mx ?? a.x, y: a.my ?? a.y } : { x: a.x, y: a.y });
/** disposition d'un appareil en multifilaire : taille, bandes du haut et du bas, points de chaque borne (relatifs).
 *  Bornes libres (par défaut) : chaque borne a un point à gauche et un à droite, le tracé prend le meilleur.
 *  Bornes fixes (a.bornes_fixes) : chaque borne reste de son côté (b.cote : g, d, h, b), dans l'ordre de la liste,
 *  comme sur l'appareil réel. */
const SCH_COTES = [
  ["g", "Gauche"],
  ["d", "Droite"],
  ["h", "Haut"],
  ["b", "Bas"],
];
function schDispo(a) {
  const bs = a.bornes || [],
    pins = {};
  if (!a.bornes_fixes) {
    bs.forEach((b, k) => {
      const y = SCH.HM_TETE + k * SCH.HM_BORNE + SCH.HM_BORNE / 2;
      pins[b.id] = [
        { x: 0, y, dir: 1, cote: "g", rang: k },
        { x: SCH.L, y, dir: 0, cote: "d", rang: k },
      ];
    });
    return { w: SCH.L, h: SCH.HM_TETE + Math.max(1, bs.length) * SCH.HM_BORNE, haut: 0, fixe: false, pins };
  }
  const par = { g: [], d: [], h: [], b: [] };
  for (const b of bs) par[par[b.cote] ? b.cote : "d"].push(b);
  // (bornes du haut et du bas : repère et rôle écrits à la verticale, la bande a la hauteur du plus long)
  const bande = l =>
    l.length ? Math.min(130, Math.max(30, Math.ceil((Math.max(...l.map(b => schTexteVertical(b).length)) * 5.6 + 16) / 10) * 10)) : 0;
  const haut = bande(par.h),
    bas = bande(par.b),
    rangs = Math.max(1, par.g.length, par.d.length);
  const w = Math.max(SCH.L, Math.ceil((Math.max(par.h.length, par.b.length) * 30 + 30) / 10) * 10),
    h = haut + SCH.HM_TETE + rangs * SCH.HM_BORNE + bas;
  par.g.forEach((b, k) => (pins[b.id] = [{ x: 0, y: haut + SCH.HM_TETE + k * SCH.HM_BORNE + 10, dir: 1, cote: "g", rang: k }]));
  par.d.forEach((b, k) => (pins[b.id] = [{ x: w, y: haut + SCH.HM_TETE + k * SCH.HM_BORNE + 10, dir: 0, cote: "d", rang: k }]));
  par.h.forEach((b, k) => (pins[b.id] = [{ x: 20 + k * 30, y: 0, dir: 3, cote: "h", rang: k }]));
  par.b.forEach((b, k) => (pins[b.id] = [{ x: 20 + k * 30, y: h, dir: 2, cote: "b", rang: k }]));
  return { w, h, haut, bas, rangs, fixe: true, pins, par };
}
/** texte d'une borne du haut ou du bas (écrit à la verticale) : repère et rôle */
const schTexteVertical = b => (b.rep || "?") + (b.role ? "  " + schCourt(b.role, 20) : "");
const schLargeur = (a, vue) => (vue === "multifilaire" ? schDispo(a).w : SCH.L);
const schHauteur = (a, vue) => (vue === "multifilaire" ? schDispo(a).h : SCH.HS);
/** côté de chaque borne en multifilaire : vers les appareils auxquels elle est reliée (gauche ou droite) */
function schCotesBornes(D) {
  const cote = {};
  const centre = a => schPos(a, "multifilaire").x + schLargeur(a, "multifilaire") / 2;
  const parBorne = {};
  for (const l of D.liaisons)
    for (const f of l.fils || []) {
      const xa = schBorneBout(D, l.a, f.ba),
        xb = schBorneBout(D, l.b, f.bb);
      if (!xa || !xb) continue;
      (parBorne[f.ba] = parBorne[f.ba] || []).push(centre(xb.a) - centre(xa.a));
      (parBorne[f.bb] = parBorne[f.bb] || []).push(centre(xa.a) - centre(xb.a));
    }
  for (const [k, v] of Object.entries(parBorne)) cote[k] = v.reduce((s, x) => s + x, 0) < 0 ? "g" : "d";
  return cote;
}
/** point d'une borne (absolu) : son côté fixe, sinon celui vers les appareils reliés (cotes) */
function schPointBorne(a, b, cotes) {
  const p = schPos(a, "multifilaire"),
    ps = schDispo(a).pins[b.id] || [{ x: 0, y: 0, dir: 1 }];
  const q = ps.length > 1 ? ps[(cotes[b.id] || "d") === "g" ? 0 : 1] : ps[0];
  return { x: p.x + q.x, y: p.y + q.y, dir: q.dir, g: q.dir === 1 };
}
/** couleur d'un fil : la sienne s'il en a une (exception), sinon la couleur normée de son conducteur dans le câble */
const schCouleurFil = (l, f) => f.couleur || ((schCable(l.cable) || {}).couleurs || [])[f.cond] || "";
/** repère d'un conducteur dans le câble : P1a, P1b… pour un câble à paires, sinon 1, 2, 3… */
const schLibCond = (c, i) =>
  i === null || i === undefined || i < 0 ? "" : c && c.paires ? `P${Math.floor(i / 2) + 1}${i % 2 ? "b" : "a"}` : String(i + 1);
/** fond CSS d'une pastille de couleur (deux couleurs : moitié-moitié) */
const schFondCouleur = nom => {
  const [c1, c2] = schTeintes(nom);
  return !c1 ? "transparent" : c2 ? `linear-gradient(90deg, ${c1} 55%, ${c2} 55%)` : c1;
};
/** bord d'un cadre (x, y, w, h) vers un point */
function schBordRect(r, vers) {
  const cx = r.x + r.w / 2,
    cy = r.y + r.h / 2,
    dx = vers.x - cx,
    dy = vers.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const k = Math.min(Math.abs(r.w / 2 / (dx || 1e-9)), Math.abs(r.h / 2 / (dy || 1e-9)));
  return { x: cx + dx * k, y: cy + dy * k };
}
function schTrait(d, couleur, largeur, extra) {
  const [t1, t2] = schTeintes(couleur);
  const c1 = t1 || "#475569",
    c2 = t1 ? t2 : null;
  const g = sv("g", {});
  // (fil blanc : un liseré gris pour le voir sur le fond blanc)
  if (c1 === "#ffffff") g.append(sv("path", { d, stroke: "#94a3b8", "stroke-width": largeur + 2, fill: "none" }));
  g.append(sv("path", Object.assign({ d, stroke: c1, "stroke-width": largeur, fill: "none" }, extra || {})));
  if (c2) g.append(sv("path", { d, stroke: c2, "stroke-width": largeur, fill: "none", "stroke-dasharray": "6 6" }));
  return g;
}
/* ---------- routage des fils et des câbles : à angle droit, sur une grille de 10, comme les schémas des fabricants ----------
   Chaque trait cherche le chemin le moins coûteux (A*) : il contourne les appareils, évite de passer devant les bornes
   des autres, de suivre un autre trait, de croiser (coût), de faire des coudes (coût). Les fils posés sur une même
   borne forment un réseau : ils se rejoignent sur un même trait, avec un point de jonction. */
function schRouteur(boites) {
  const G = SCH.GRILLE,
    M = 300; // (marge autour des appareils pour contourner)
  let minx = Infinity,
    miny = Infinity,
    maxx = -Infinity,
    maxy = -Infinity;
  for (const b of boites) {
    minx = Math.min(minx, b.x);
    miny = Math.min(miny, b.y);
    maxx = Math.max(maxx, b.x + b.w);
    maxy = Math.max(maxy, b.y + b.h);
  }
  if (!boites.length) minx = miny = maxx = maxy = 0;
  const x0 = Math.floor((minx - M) / G) * G,
    y0 = Math.floor((miny - M) / G) * G;
  const W = Math.ceil((maxx + M - x0) / G) + 1,
    H = Math.ceil((maxy + M - y0) / G) + 1,
    N = W * H;
  const bloque = new Uint8Array(N),
    proche = new Uint8Array(N),
    reserve = new Int32Array(N), // (devant une borne : réservé au réseau de la borne ; -1 : toutes les bornes)
    occH = new Int32Array(N), // trait de i à i+1 : réseau + 1, -1 si plusieurs
    occV = new Int32Array(N), // trait de i à i+W
    passe = new Int32Array(N),
    coude = new Int32Array(N);
  const idx = (x, y) => Math.round((x - x0) / G) + Math.round((y - y0) / G) * W;
  const ix = i => x0 + (i % W) * G,
    iy = i => y0 + Math.floor(i / W) * G;
  const dans = (x, y) => x >= x0 && y >= y0 && x <= x0 + (W - 1) * G && y <= y0 + (H - 1) * G;
  for (const b of boites)
    for (let y = Math.round(b.y / G) * G - G; y <= b.y + b.h + G; y += G)
      for (let x = Math.round(b.x / G) * G - G; x <= b.x + b.w + G; x += G) {
        if (!dans(x, y)) continue;
        const i = idx(x, y);
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) bloque[i] = 1;
        else proche[i] = 1;
      }
  const marquerOcc = (tab, i, net) => (tab[i] = tab[i] === 0 || tab[i] === net + 1 ? net + 1 : -1);
  const DX = [1, -1, 0, 0],
    DY = [0, 0, 1, -1];
  /** devant une borne (1 pas vers l'extérieur) : les autres réseaux évitent d'y passer */
  function reserver(x, y, dir, net) {
    const xx = x + DX[dir] * G,
      yy = y + DY[dir] * G;
    if (dans(xx, yy)) {
      const i = idx(xx, yy);
      reserve[i] = reserve[i] && reserve[i] !== net + 1 ? -1 : net + 1;
    }
  }
  /** chemin (liste d'indices) d'un des départs [{x, y, dir (sens de sortie), cout}] à une des cibles (Set d'indices) */
  function chemin(departs, cibles, net) {
    if (!cibles.size) return null;
    let tx1 = Infinity,
      ty1 = Infinity,
      tx2 = -Infinity,
      ty2 = -Infinity;
    for (const c of cibles) {
      tx1 = Math.min(tx1, ix(c));
      tx2 = Math.max(tx2, ix(c));
      ty1 = Math.min(ty1, iy(c));
      ty2 = Math.max(ty2, iy(c));
    }
    const hEst = i => {
      const x = ix(i),
        y = iy(i);
      return ((x < tx1 ? tx1 - x : x > tx2 ? x - tx2 : 0) + (y < ty1 ? ty1 - y : y > ty2 ? y - ty2 : 0)) / G;
    };
    const g = new Float64Array(N * 4).fill(Infinity),
      prec = new Int32Array(N * 4).fill(-1);
    // tas binaire (f, état)
    const tf = [],
      ts = [];
    const pousser = (f, s) => {
      let k = tf.length;
      tf.push(f);
      ts.push(s);
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (tf[p] <= tf[k]) break;
        [tf[p], tf[k]] = [tf[k], tf[p]];
        [ts[p], ts[k]] = [ts[k], ts[p]];
        k = p;
      }
    };
    const tirer = () => {
      const s = ts[0],
        lf = tf.pop(),
        ls = ts.pop();
      if (tf.length) {
        tf[0] = lf;
        ts[0] = ls;
        let k = 0;
        for (;;) {
          const a = 2 * k + 1,
            b = a + 1;
          let m = k;
          if (a < tf.length && tf[a] < tf[m]) m = a;
          if (b < tf.length && tf[b] < tf[m]) m = b;
          if (m === k) break;
          [tf[m], tf[k]] = [tf[k], tf[m]];
          [ts[m], ts[k]] = [ts[k], ts[m]];
          k = m;
        }
      }
      return s;
    };
    const debut = new Set();
    for (const d of departs) {
      if (!dans(d.x, d.y)) continue;
      const i = idx(d.x, d.y),
        s = i * 4 + d.dir;
      debut.add(i);
      if ((d.cout || 0) < g[s]) {
        g[s] = d.cout || 0;
        pousser(g[s] + hEst(i), s);
      }
    }
    let fin = -1,
      tours = 0;
    while (tf.length) {
      const s = tirer(),
        i = s >> 2,
        pd = s & 3;
      if (++tours > 400000) break;
      if (cibles.has(i) && !debut.has(i)) {
        fin = s;
        break;
      }
      const gi = g[s];
      const cx = i % W,
        cy = (i - cx) / W;
      for (let d = 0; d < 4; d++) {
        if ((d ^ 1) === pd && d >> 1 === pd >> 1) continue; // (pas de demi-tour)
        const nx = cx + DX[d],
          ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = nx + ny * W;
        if (bloque[j] && !cibles.has(j)) continue;
        // (on ne sort d'un départ posé sur le bord d'un appareil que vers l'extérieur)
        if (bloque[i] && debut.has(i) && d !== pd) continue;
        let c = 1;
        if (d !== pd) {
          c += 2.5;
          if (passe[i] && passe[i] !== net + 1) c += 25; // (coude sur un autre trait : on croirait une jonction)
        }
        if (proche[j]) c += 0.6;
        if (reserve[j] && reserve[j] !== net + 1 && !cibles.has(j)) c += 14;
        const occ = d < 2 ? occH[Math.min(i, j)] : occV[Math.min(i, j)];
        if (occ && occ !== net + 1) c += 45; // (le long d'un autre trait : à éviter)
        if (passe[j] && passe[j] !== net + 1) c += coude[j] && coude[j] !== net + 1 ? 30 : 4; // (croisement)
        const ns = j * 4 + d,
          ng = gi + c;
        if (ng < g[ns]) {
          g[ns] = ng;
          prec[ns] = s;
          pousser(ng + hEst(j), ns);
        }
      }
    }
    if (fin < 0) return null;
    const out = [];
    for (let s = fin; s >= 0; s = prec[s]) out.push(s >> 2);
    return out.reverse();
  }
  function marquer(ch, net) {
    for (let k = 0; k < ch.length; k++) {
      const i = ch[k];
      marquerOcc(passe, i, net);
      if (k > 0) {
        const a = ch[k - 1];
        if (Math.abs(a - i) === 1) marquerOcc(occH, Math.min(a, i), net);
        else marquerOcc(occV, Math.min(a, i), net);
      }
      const tourne = k === 0 || k === ch.length - 1 || ch[k] - ch[k - 1] !== ch[k + 1] - ch[k];
      if (tourne) marquerOcc(coude, i, net);
    }
  }
  /** chemin -> points des coudes */
  const points = ch => {
    const pts = [];
    for (let k = 0; k < ch.length; k++) {
      if (k > 0 && k < ch.length - 1 && ch[k] - ch[k - 1] === ch[k + 1] - ch[k]) continue;
      pts.push({ x: ix(ch[k]), y: iy(ch[k]) });
    }
    return pts;
  };
  return { idx, ix, iy, dans, chemin, marquer, reserver, points };
}
const schD = pts => pts.map((p, k) => (k ? "L" : "M") + p.x + "," + p.y).join(" ");
/** plus long segment d'une liste de tracés (pour poser une étiquette), horizontal de préférence */
function schPlusLongSegment(traces) {
  let hz = null,
    vt = null;
  for (const pts of traces)
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1],
        b = pts[k],
        l = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      if (a.y === b.y) {
        if (!hz || l > hz.l) hz = { a, b, l, h: true };
      } else if (!vt || l > vt.l) vt = { a, b, l, h: false };
    }
  return hz && (hz.l >= 50 || !vt || hz.l >= vt.l / 3) ? hz : vt || hz;
}

/** cache du routage : refait seulement quand les places, les bornes ou les fils changent */
const SCH_CACHE = { cle: "", res: null, duree: 0 };
/** multifilaire : chaque fil de borne à borne, réseaux d'une même borne réunis avec un point de jonction */
function schRouterMultifilaire(D, cotes) {
  const cle =
    "m" +
    JSON.stringify([
      D.appareils.map(a => [a.id, a.mx ?? a.x, a.my ?? a.y, (a.bornes || []).map(b => b.id + (cotes[b.id] || "d"))]),
      D.liaisons.map(l => [l.id, l.a, l.b, (l.fils || []).map(f => [f.id, f.ba, f.bb])]),
      (D.groupes || []).map(g => [g.id, g.membres]),
    ]);
  if (SCH_CACHE.cle === cle) return SCH_CACHE.res;
  const t0 = performance.now();
  const boites = D.appareils.map(a => {
    const p = schPos(a, "multifilaire");
    const dp = schDispo(a);
    return { x: p.x, y: p.y, w: dp.w, h: dp.h };
  });
  const R = schRouteur(boites);
  // bornes : accessibles des deux côtés de l'appareil (comme un bornier : le fil arrive d'un côté, repart de
  // l'autre) ; pin[id] = [gauche, droite], chacun { x, y, dir (sens de sortie), i (point de la grille) }
  const pin = {},
    duPoint = new Map();
  for (const a of D.appareils) {
    const pa = schPos(a, "multifilaire"),
      dp = schDispo(a);
    (a.bornes || []).forEach(b => {
      // (bornes libres : le côté par défaut d'abord, un peu moins cher ; bornes fixes : leur seul côté)
      const prefG = (cotes[b.id] || "d") === "g";
      pin[b.id] = (dp.pins[b.id] || []).map(q => ({
        x: pa.x + q.x,
        y: pa.y + q.y,
        dir: q.dir,
        cote: q.cote,
        cout: dp.fixe ? 0 : (q.cote === "g") === prefG ? 0 : 1.5,
      }));
      for (const q of pin[b.id]) {
        q.i = R.idx(q.x, q.y);
        duPoint.set(q.i, { borne: b.id, cote: q.cote });
      }
    });
  }
  // réseaux : bornes reliées entre elles par des fils (même potentiel)
  const parent = {};
  const chef = k => (parent[k] === undefined || parent[k] === k ? (parent[k] = k) : (parent[k] = chef(parent[k])));
  const fils = [];
  for (const l of D.liaisons) {
    for (const f of l.fils || [])
      if (f.ba && f.bb && f.ba !== f.bb && pin[f.ba] && pin[f.bb] && schBorneBout(D, l.a, f.ba) && schBorneBout(D, l.b, f.bb)) {
        fils.push({ f, l });
        parent[chef(f.ba)] = chef(f.bb);
      }
  }
  const reseaux = new Map();
  for (const x of fils) {
    const k = chef(x.f.ba);
    if (!reseaux.has(k)) reseaux.set(k, []);
    reseaux.get(k).push(x);
  }
  const liste = [...reseaux.values()];
  liste.forEach((r, n) => {
    r.net = n;
    r.etendue = r.reduce((s, { f }) => s + Math.abs(pin[f.ba][0].x - pin[f.bb][0].x) + Math.abs(pin[f.ba][0].y - pin[f.bb][0].y), 0);
    for (const { f } of r) for (const q of [...pin[f.ba], ...pin[f.bb]]) R.reserver(q.x, q.y, q.dir, n);
  });
  // (les réseaux courts d'abord : ils prennent les chemins directs, les longs contournent)
  liste.sort((a, b) => a.etendue - b.etendue);
  const traces = {}; // id du fil -> points
  const jonctions = [],
    cotesUtilises = {}; // id de borne -> Set("g", "d") : côtés où arrivent des fils
  for (const r of liste) {
    const arbre = new Set(),
      dansArbre = new Set(),
      aretes = new Map();
    let reste = r.slice();
    const ajouter = ch => {
      for (let k = 0; k < ch.length; k++) {
        arbre.add(ch[k]);
        if (k) {
          const e = Math.min(ch[k], ch[k - 1]) + "-" + Math.max(ch[k], ch[k - 1]);
          aretes.set(e, [ch[k], ch[k - 1]]);
        }
      }
      R.marquer(ch, r.net);
    };
    while (reste.length) {
      // un fil dont une borne est déjà dans l'arbre (sinon le premier) : on relie l'autre borne à l'arbre
      let k = reste.findIndex(({ f }) => dansArbre.has(f.ba) !== dansArbre.has(f.bb));
      if (k < 0) k = reste.findIndex(({ f }) => !dansArbre.has(f.ba) && !dansArbre.has(f.bb));
      if (k < 0) {
        // (les deux bornes déjà reliées par ailleurs : rien à tracer de plus)
        for (const x of reste) traces[x.f.id] = null;
        break;
      }
      const { f } = reste.splice(k, 1)[0];
      let de = f.ba,
        vers = f.bb,
        cibles;
      if (dansArbre.has(f.ba) || dansArbre.has(f.bb)) {
        if (dansArbre.has(f.ba)) [de, vers] = [f.bb, f.ba];
        // (l'arbre, et les deux côtés des bornes déjà reliées : un fil peut repartir de l'autre côté d'une borne)
        cibles = new Set(arbre);
        for (const b of dansArbre) for (const q of pin[b]) cibles.add(q.i);
      } else cibles = new Set(pin[vers].map(q => q.i));
      const ch = R.chemin(pin[de], cibles, r.net);
      dansArbre.add(f.ba);
      dansArbre.add(f.bb);
      if (!ch) {
        traces[f.id] = null;
        continue;
      }
      for (const i of [ch[0], ch[ch.length - 1]]) {
        const u = duPoint.get(i);
        if (u) (cotesUtilises[u.borne] = cotesUtilises[u.borne] || new Set()).add(u.cote);
      }
      ajouter(ch);
      traces[f.id] = R.points(ch);
    }
    // points de jonction : là où 3 traits ou plus du réseau se rejoignent
    const degre = new Map();
    for (const [a, b] of aretes.values()) {
      degre.set(a, (degre.get(a) || 0) + 1);
      degre.set(b, (degre.get(b) || 0) + 1);
    }
    for (const [i, d] of degre) if (d >= 3 && !duPoint.has(i)) jonctions.push({ x: R.ix(i), y: R.iy(i) });
  }
  const res = { traces, jonctions, cotes: cotesUtilises };
  SCH_CACHE.duree = performance.now() - t0;
  SCH_CACHE.cle = cle;
  SCH_CACHE.res = res;
  return res;
}
/** synoptique : un trait par câble, d'un bord d'appareil à l'autre, à angle droit */
function schRouterSynoptique(D) {
  const cle =
    "s" +
    JSON.stringify([
      D.appareils.map(a => [a.id, a.x, a.y]),
      D.liaisons.map(l => [l.id, l.a, l.b]),
      (D.groupes || []).map(g => [g.id, g.membres]),
    ]);
  if (SCH_CACHE.cle === cle) return SCH_CACHE.res;
  const t0 = performance.now();
  const R = schRouteur(D.appareils.map(a => ({ x: a.x, y: a.y, w: SCH.L, h: SCH.HS })));
  const G = SCH.GRILLE;
  // départs possibles : tout le bord (sauf les coins), un peu plus cher loin du milieu du côté
  // (bout d'un câble : le cadre de l'appareil, ou celui du groupe — plusieurs appareils au même endroit)
  const bord = a => {
    const out = [];
    for (let x = a.x + 2 * G; x <= a.x + a.w - 2 * G; x += G) {
      const c = Math.abs(x - (a.x + a.w / 2)) / 40;
      out.push({ x, y: a.y, dir: 3, cout: c }, { x, y: a.y + a.h, dir: 2, cout: c });
    }
    for (let y = a.y + 2 * G; y <= a.y + a.h - 2 * G; y += G) {
      const c = Math.abs(y - (a.y + a.h / 2)) / 20;
      out.push({ x: a.x, y, dir: 1, cout: c }, { x: a.x + a.w, y, dir: 0, cout: c });
    }
    return out;
  };
  const liste = D.liaisons
    .map((l, n) => ({ l, n, A: schRectBout(D, l.a), B: schRectBout(D, l.b) }))
    .filter(x => x.A && x.B)
    .sort((u, v) => Math.abs(u.A.x - u.B.x) + Math.abs(u.A.y - u.B.y) - (Math.abs(v.A.x - v.B.x) + Math.abs(v.A.y - v.B.y)));
  const traces = {};
  for (const { l, n, A, B } of liste) {
    const cibles = new Set(bord(B).map(p => R.idx(p.x, p.y)));
    const ch = R.chemin(bord(A), cibles, n);
    if (!ch) {
      traces[l.id] = null;
      continue;
    }
    R.marquer(ch, n);
    traces[l.id] = R.points(ch);
  }
  const res = { traces, jonctions: [] };
  SCH_CACHE.duree = performance.now() - t0;
  SCH_CACHE.cle = cle;
  SCH_CACHE.res = res;
  return res;
}

/** cadre d'un bout de câble dans le synoptique : l'appareil, ou le cadre pointillé de son groupe */
function schRectBout(D, id) {
  const g = schGroupe(D, id);
  if (g) return schCadreGroupe(D, g, "synoptique");
  const a = D.appareils.find(x => x.id === id);
  return a ? { x: a.x, y: a.y, w: SCH.L, h: SCH.HS } : null;
}
/** cadre pointillé d'un groupe dans une vue : autour de ses appareils, avec la place du nom en haut */
function schCadreGroupe(D, g, vue) {
  const apps = (g.membres || []).map(id => D.appareils.find(a => a.id === id)).filter(Boolean);
  if (!apps.length) return null;
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;
  for (const a of apps) {
    const p = schPos(a, vue);
    x1 = Math.min(x1, p.x);
    y1 = Math.min(y1, p.y);
    x2 = Math.max(x2, p.x + schLargeur(a, vue));
    y2 = Math.max(y2, p.y + schHauteur(a, vue));
  }
  // (en multifilaire, de la place pour les pastilles des bornes ; marges en multiples de 10 : le cadre tombe sur la
  //  grille du tracé, un câble peut partir de son bord)
  const m = vue === "multifilaire" ? 20 : 10;
  return { x: x1 - m, y: y1 - m - 20, w: x2 - x1 + 2 * m, h: y2 - y1 + 2 * m + 20 };
}
const schSelApp = (sel, id) => !!sel && ((sel.type === "appareil" && sel.id === id) || (sel.type === "plusieurs" && sel.ids.includes(id)));
/** le schéma dans la vue demandée ; sel = objet choisi ({type, id}) ; pour l'impression : sans interaction */
function schDessiner(D, vue, sel, opt) {
  opt = opt || {};
  const svg = sv("svg", { class: "si-svg", xmlns: "http://www.w3.org/2000/svg" });
  const fond = sv("rect", { x: -5000, y: -5000, width: 10000, height: 10000, fill: "transparent", "data-fond": "1" });
  svg.append(fond);
  const gG = sv("g", {}),
    gL = sv("g", {}),
    gA = sv("g", {});
  svg.append(gG, gL, gA);
  const alertes = {};
  for (const l of D.liaisons) alertes[l.id] = schAlertesLiaison(D, l);
  // étiquettes des câbles : posées là où elles ne chevauchent ni un appareil ni une autre étiquette
  const occupees = D.appareils.map(a => {
    const p = schPos(a, vue);
    return { x1: p.x - 4, y1: p.y - 4, x2: p.x + schLargeur(a, vue) + 4, y2: p.y + schHauteur(a, vue) + 4 };
  });
  const libre = r => !occupees.some(q => r.x1 < q.x2 && r.x2 > q.x1 && r.y1 < q.y2 && r.y2 > q.y1);
  /** place d'une étiquette de largeur w sur les traits ; haut / bas : place au-dessus et au-dessous d'un trait horizontal
   *  (à droite d'un trait vertical : hauteur haut + bas) ; renvoie { x, y, h } (h : sur un trait horizontal, centrée) */
  const placerEtiquette = (traces, w, haut, bas) => {
    const segs = [];
    for (const pts of traces)
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1],
          b = pts[k];
        segs.push({ a, b, h: a.y === b.y, l: Math.abs(b.x - a.x) + Math.abs(b.y - a.y) });
      }
    segs.sort((u, v) => (v.h && v.l >= w + 6) - (u.h && u.l >= w + 6) || v.l - u.l);
    let premier = null;
    for (const sg of segs)
      for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) {
        const x = sg.a.x + (sg.b.x - sg.a.x) * t,
          y = sg.a.y + (sg.b.y - sg.a.y) * t;
        const r = sg.h
          ? { x1: x - w / 2, x2: x + w / 2, y1: y - haut, y2: y + bas }
          : { x1: x + 3, x2: x + 8 + w, y1: y - (haut + bas) / 2, y2: y + (haut + bas) / 2 };
        const c = { x, y, h: sg.h, r };
        if (!premier) premier = c;
        if (libre(r)) {
          occupees.push(r);
          return c;
        }
      }
    if (premier) occupees.push(premier.r);
    return premier;
  };
  let maxX = 400,
    maxY = 300,
    minX = 0,
    minY = 0;
  const etendre = (x, y) => {
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
  };
  if (vue === "multifilaire") {
    const cotes = schCotesBornes(D);
    // (pendant un glisser : tracé simple ; au lâcher : routage complet, mis en cache)
    const routage = opt.rapide ? null : schRouterMultifilaire(D, cotes);
    for (const l of D.liaisons) {
      if (!schAppsBout(D, l.a).length || !schAppsBout(D, l.b).length) continue;
      const choisi = sel && sel.type === "liaison" && sel.id === l.id;
      const c = schCable(l.cable);
      const g = sv("g", { class: "si-liaison" + (choisi ? " sel" : ""), "data-liaison": l.id });
      g.append(
        sv(
          "title",
          {},
          [l.rep, c ? c.nom : "câble non choisi", schNum(l.longueur) ? schFr(schNum(l.longueur)) + " m" : ""].filter(Boolean).join(" · ")
        )
      );
      const fils = (l.fils || []).filter(f => f.ba && f.bb);
      const traces = [];
      fils.forEach((f, i) => {
        // (bout d'un groupe : la borne est sur l'un de ses appareils)
        const xa = schBorneBout(D, l.a, f.ba),
          xb = schBorneBout(D, l.b, f.bb);
        if (!xa || !xb) return;
        const [A, ba, B, bb] = [xa.a, xa.b, xb.a, xb.b];
        let pts = routage ? routage.traces[f.id] : undefined;
        if (pts === null) return; // (borne déjà reliée par un autre fil du même réseau)
        if (!pts) {
          // tracé simple : sortie de borne, descente, entrée de borne
          const p1 = schPointBorne(A, ba, cotes),
            p2 = schPointBorne(B, bb, cotes);
          const DX = [20, -20, 0, 0],
            DY = [0, 0, 20, -20];
          const s1 = { x: p1.x + DX[p1.dir], y: p1.y + DY[p1.dir] },
            s2 = { x: p2.x + DX[p2.dir], y: p2.y + DY[p2.dir] };
          let xm = (s1.x + s2.x) / 2 + (i - (fils.length - 1) / 2) * 6;
          if (p1.g === p2.g && p1.dir < 2 && p2.dir < 2 && Math.abs(s1.x - s2.x) < 40)
            xm = p1.g ? Math.min(s1.x, s2.x) - 10 * (i + 1) : Math.max(s1.x, s2.x) + 10 * (i + 1);
          pts = [p1, s1, { x: xm, y: s1.y }, { x: xm, y: s2.y }, s2, p2];
        }
        const d = schD(pts);
        g.append(sv("path", { d, stroke: "transparent", "stroke-width": 9, fill: "none" }));
        g.append(schTrait(d, schCouleurFil(l, f), choisi ? 2.6 : 1.8));
        traces.push(pts);
        if (f.rep) {
          const sg = schPlusLongSegment([pts]);
          if (sg) g.append(sv("text", { x: (sg.a.x + sg.b.x) / 2 + 3, y: (sg.a.y + sg.b.y) / 2 - 3, class: "si-rep-fil" }, f.rep));
        }
        for (const q of pts) (etendre(q.x + 20, q.y + 20), etendre(q.x - 20, q.y - 20));
      });
      if (traces.length) {
        const al = alertes[l.id].length;
        const t = schAjuste(
          (al ? "⚠ " : "") +
            [l.rep, c ? c.nom : "", schNum(l.longueur) ? schFr(schNum(l.longueur)) + " m" : ""].filter(Boolean).join(" · "),
          240
        );
        const cls = "si-etiq" + (al ? " alerte" : "");
        const pe = placerEtiquette(traces, t.length * 5.9, 15, 0);
        if (pe)
          g.append(
            pe.h
              ? sv("text", { x: pe.x, y: pe.y - 5, class: cls, "text-anchor": "middle" }, t)
              : sv("text", { x: pe.x + 6, y: pe.y + 4, class: cls }, t)
          );
      }
      gL.append(g);
    }
    // points de jonction : plusieurs fils sur une même borne, réunis sur un même trait
    if (routage) for (const j of routage.jonctions) gL.append(sv("circle", { cx: j.x, cy: j.y, r: 3.2, class: "si-jonction" }));
    for (const a of D.appareils) {
      const p = schPos(a, vue),
        dp = schDispo(a),
        W = dp.w,
        H = dp.h,
        [, , coul] = schEtat(a.etat);
      const choisi = schSelApp(sel, a.id);
      const g = sv("g", { class: "si-app" + (choisi ? " sel" : ""), "data-app": a.id, transform: `translate(${p.x},${p.y})` });
      g.append(
        sv("rect", { width: W, height: H, rx: 4, fill: "#fff", stroke: coul, "stroke-width": choisi ? 3 : 2 }),
        sv("rect", { y: dp.haut, width: W, height: SCH.HM_TETE - 6, rx: 4, fill: coul, opacity: 0.14 }),
        sv("text", { x: 8, y: dp.haut + 14, class: "si-rep" }, a.rep || ""),
        sv("text", { x: 8, y: dp.haut + 25, class: "si-nom" }, schCourt(a.nom || "", Math.floor(W / 6)))
      );
      const pastille = (b, cx, cy) => [
        sv("circle", { cx, cy, r: 4.5, class: "si-pastille" + (opt.attente === b.id ? " attente" : "") }),
        // (zone de clic plus large que la pastille)
        sv(
          "circle",
          { cx, cy, r: 9, class: "si-pastille-prise", "data-borne": b.id, "data-app": a.id },
          sv("title", {}, (b.rep || "?") + (b.role ? " · " + b.role : ""))
        ),
      ];
      if (dp.fixe) {
        // bornes fixes : chacune de son côté, comme sur l'appareil
        const rangs = {};
        for (const [k, q] of Object.entries(dp.pins))
          if (q[0].cote === "g" || q[0].cote === "d") (rangs[q[0].rang] = rangs[q[0].rang] || {})[q[0].cote] = k;
        for (let r = 0; r < dp.rangs - 1; r++) {
          const y = dp.haut + SCH.HM_TETE + (r + 1) * SCH.HM_BORNE;
          g.append(sv("line", { x1: 4, x2: W - 4, y1: y, y2: y, stroke: "#eef0f3" }));
        }
        for (const b of a.bornes || []) {
          const q = (dp.pins[b.id] || [])[0];
          if (!q) continue;
          const deux = q.cote === "g" || q.cote === "d" ? Object.keys(rangs[q.rang] || {}).length > 1 : false;
          if (q.cote === "g" || q.cote === "d") {
            const gch = q.cote === "g";
            g.append(
              sv("text", { x: gch ? 10 : W - 10, y: q.y + 4, class: "si-borne", "text-anchor": gch ? "start" : "end" }, b.rep || "?"),
              sv(
                "text",
                deux
                  ? { x: gch ? 34 : W - 34, y: q.y + 4, class: "si-role", "text-anchor": gch ? "start" : "end" }
                  : { x: gch ? W - 8 : 8, y: q.y + 4, class: "si-role", "text-anchor": gch ? "end" : "start" },
                schCourt(b.role || "", deux ? Math.floor((W / 2 - 40) / 4.6) : 18)
              )
            );
          } else {
            // borne du haut ou du bas : repère (gras) et rôle à la verticale, lus de bas en haut
            const yy = q.cote === "h" ? 8 : H - 8,
              xx = q.x + 4;
            g.append(
              sv(
                "text",
                { x: xx, y: yy, transform: `rotate(-90 ${xx} ${yy})`, "text-anchor": q.cote === "h" ? "end" : "start", class: "si-role" },
                sv("tspan", { class: "si-borne" }, b.rep || "?"),
                b.role ? sv("tspan", {}, "  " + schCourt(b.role, 20)) : null
              )
            );
          }
          g.append(...pastille(b, q.x, q.y));
        }
      } else
        (a.bornes || []).forEach((b, i) => {
          const y = SCH.HM_TETE + i * SCH.HM_BORNE + SCH.HM_BORNE / 2;
          // côtés de la borne : ceux où arrivent des fils (les deux pour un bornier traversé), sinon le côté par défaut
          const u = routage && routage.cotes[b.id];
          const cotesB = u && u.size ? [...u] : [cotes[b.id] || "d"];
          const deux = cotesB.length > 1,
            gauche = cotesB[0] === "g";
          g.append(
            i < a.bornes.length - 1
              ? sv("line", { x1: 4, x2: W - 4, y1: y + SCH.HM_BORNE / 2, y2: y + SCH.HM_BORNE / 2, stroke: "#eef0f3" })
              : null
          );
          for (const cb of cotesB)
            g.append(
              sv(
                "text",
                { x: cb === "g" ? 10 : W - 10, y: y + 4, class: "si-borne", "text-anchor": cb === "g" ? "start" : "end" },
                b.rep || "?"
              )
            );
          g.append(
            sv(
              "text",
              deux
                ? { x: W / 2, y: y + 4, class: "si-role", "text-anchor": "middle" }
                : { x: gauche ? W - 8 : 8, y: y + 4, class: "si-role", "text-anchor": gauche ? "end" : "start" },
              schCourt(b.role || "", deux ? 20 : 18)
            )
          );
          for (const cb of cotesB) g.append(...pastille(b, cb === "g" ? 0 : W, y));
        });
      gA.append(g);
      etendre(p.x + W + 30, p.y + H + 30);
      etendre(p.x - 30, p.y - 10);
    }
  } else {
    // synoptique : câbles à angle droit, d'un bord d'appareil à l'autre, en contournant les appareils
    const routage = opt.rapide ? null : schRouterSynoptique(D);
    for (const l of D.liaisons) {
      const A = schRectBout(D, l.a),
        B = schRectBout(D, l.b);
      if (!A || !B) continue;
      let pts = routage && routage.traces[l.id];
      if (!pts) {
        const ca = { x: A.x + A.w / 2, y: A.y + A.h / 2 },
          cb = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
        pts = [schBordRect(A, cb), schBordRect(B, ca)];
      }
      const choisi = sel && sel.type === "liaison" && sel.id === l.id;
      const al = alertes[l.id].length,
        c = schCable(l.cable);
      const g = sv("g", { class: "si-liaison" + (choisi ? " sel" : ""), "data-liaison": l.id });
      g.append(
        sv(
          "title",
          {},
          [l.rep, c ? c.nom : "câble non choisi", schNum(l.longueur) ? schFr(schNum(l.longueur)) + " m" : ""].filter(Boolean).join(" · ")
        )
      );
      const d = schD(pts);
      for (const q of pts) (etendre(q.x + 20, q.y + 20), etendre(q.x - 20, q.y - 20));
      g.append(
        sv("path", { d, stroke: "transparent", "stroke-width": 12, fill: "none" }),
        sv("path", {
          d,
          stroke: al ? "#dc2626" : c && c.coax ? "#7c3aed" : "#334155",
          "stroke-width": choisi ? 3.5 : 2.2,
          fill: "none",
          "stroke-dasharray": c && c.coax ? "8 3" : null,
        })
      );
      const fils = (l.fils || []).filter(f => f.ba || f.bb).length;
      const t1 = [l.rep, c ? c.nom : "câble ?"].filter(Boolean).join(" · "),
        t2 = [schNum(l.longueur) ? schFr(schNum(l.longueur)) + " m" : "", fils ? fils + (c ? "/" + c.conducteurs : "") + " fils" : ""]
          .filter(Boolean)
          .join(" · ");
      // étiquette : au-dessus et au-dessous d'un trait horizontal, à droite d'un trait vertical, sans chevauchement
      const e1 = schAjuste((al ? "⚠ " : "") + t1, 240),
        e2 = schAjuste(t2, 240, 9.5);
      const pe = placerEtiquette([pts], Math.max(e1.length * 5.9, e2.length * 5.3), 16, t2 ? 16 : 2);
      const mx = pe.x,
        my = pe.y;
      g.append(
        sv(
          "text",
          pe.h
            ? { x: mx, y: my - 5, class: "si-etiq" + (al ? " alerte" : ""), "text-anchor": "middle" }
            : { x: mx + 6, y: my - 3, class: "si-etiq" + (al ? " alerte" : "") },
          e1
        ),
        t2
          ? sv(
              "text",
              pe.h ? { x: mx, y: my + 12, class: "si-etiq2", "text-anchor": "middle" } : { x: mx + 6, y: my + 10, class: "si-etiq2" },
              e2
            )
          : null
      );
      gL.append(g);
    }
    for (const a of D.appareils) {
      const p = schPos(a, vue),
        [, libEtat, coul] = schEtat(a.etat);
      const choisi = schSelApp(sel, a.id);
      const g = sv("g", { class: "si-app" + (choisi ? " sel" : ""), "data-app": a.id, transform: `translate(${p.x},${p.y})` });
      g.append(
        sv("rect", { width: SCH.L, height: SCH.HS, rx: 6, fill: "#fff", stroke: coul, "stroke-width": choisi ? 3.2 : 2.2 }),
        sv("rect", { width: 6, height: SCH.HS, rx: 3, fill: coul }),
        sv("text", { x: 14, y: 18, class: "si-rep" }, a.rep || ""),
        sv("text", { x: SCH.L - 8, y: 18, class: "si-cat", "text-anchor": "end" }, a.etat && a.etat !== "neuf" ? libEtat : ""),
        sv("text", { x: 14, y: 35, class: "si-nom" }, schCourt(a.nom || "", 26)),
        sv("text", { x: 14, y: 51, class: "si-cat" }, schCourt(schCat(a.categorie)[1], 30))
      );
      gA.append(g);
      etendre(p.x + SCH.L + 30, p.y + SCH.HS + 30);
      etendre(p.x - 30, p.y - 30);
    }
  }
  // groupes : cadre pointillé et nom, derrière les appareils (clic sur le cadre ou le nom : choisir, glisser)
  for (const gr of D.groupes || []) {
    const c = schCadreGroupe(D, gr, vue);
    if (!c) continue;
    const choisi = sel && sel.type === "groupe" && sel.id === gr.id;
    const g = sv("g", { class: "si-ensemble" + (choisi ? " sel" : ""), "data-groupe": gr.id });
    const nom = gr.nom || "Ensemble";
    g.append(
      sv("rect", { x: c.x, y: c.y, width: c.w, height: c.h, rx: 8, class: "si-cadre-prise" }),
      sv("rect", { x: c.x, y: c.y, width: c.w, height: c.h, rx: 8, class: "si-cadre" }),
      sv("rect", { x: c.x + 8, y: c.y - 8, width: nom.length * 6 + 12, height: 16, rx: 3, class: "si-cadre-fond" }),
      sv("text", { x: c.x + 14, y: c.y + 4, class: "si-cadre-nom" }, nom)
    );
    gG.append(g);
    etendre(c.x + c.w + 20, c.y + c.h + 20);
    etendre(c.x - 20, c.y - 20);
  }
  const zoom = opt.zoom || 1;
  let x0 = Math.min(0, minX),
    y0 = Math.min(0, minY);
  // (pendant un glisser : le cadre du dessin ne bouge pas, sinon tout se décale sous la souris)
  if (opt.cadre) [x0, y0, maxX, maxY] = opt.cadre;
  svg.setAttribute("viewBox", `${x0} ${y0} ${maxX - x0} ${maxY - y0}`);
  svg.setAttribute("width", Math.round((maxX - x0) * zoom));
  svg.setAttribute("height", Math.round((maxY - y0) * zoom));
  svg.dataset.x2 = maxX;
  svg.dataset.y2 = maxY;
  svg.dataset.x0 = x0;
  svg.dataset.y0 = y0;
  return svg;
}
/** replaceChildren sans les null (ils deviendraient le texte « null ») */
const remplirSi = (el, ...x) => el.replaceChildren(...x.flat(Infinity).filter(e => e !== null && e !== undefined && e !== false));
/** texte raccourci pour tenir dans une largeur (px, police de taille donnée) */
const schAjuste = (t, largeur, taille = 10.5) => schCourt(t, Math.max(6, Math.floor((largeur - 8) / (taille * 0.56))));
const schCourt = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

/* ---------- liste des schémas ---------- */
async function sectionSchemas(zone, arg) {
  if (arg && arg.id) return ouvrirSchema(zone, arg.id, arg);
  const liste = await api("GET", "/api/plans?genre=schema");
  const fiche = h("div", { class: "fiche" });
  zone.append(fiche);
  fiche.append(
    entetePage(
      h(
        "span",
        {},
        "Schémas interphone / portail ",
        h("span", { class: "puce-beta", title: "Module en cours d'écriture : à essayer, pas encore pour un vrai chantier" }, "ALPHA")
      ),
      h("button", { class: "btn principal", onclick: () => nouveauSchema({}, true).catch(erreur) }, "+ Nouveau schéma"),
      h("button", { class: "btn", onclick: () => fenetreCablesSchema() }, "Câbles…"),
      h("button", { class: "btn", onclick: () => fenetreModelesSchema() }, "Modèles d'appareils…"),
      SCH_AUTONOME()
        ? null
        : [
            h(
              "button",
              {
                class: "btn",
                title:
                  "Tous les schémas, vos modèles d'appareils et vos câbles dans un fichier : sauvegarde, ou pour la version web (tablette)",
                onclick: () => exporterSchemasFichier().catch(erreur),
              },
              "💾 Exporter…"
            ),
            h(
              "button",
              {
                class: "btn",
                title: "Ouvrir un fichier de schémas (.schemas.json), par exemple fait sur la tablette avec la version web",
                onclick: () => importerSchemasFichier(() => aller("schemas")),
              },
              "📂 Importer…"
            ),
          ],
      h("span", { class: "espace" }),
      h("span", { class: "sous" }, liste.length + " schéma(s)")
    ),
    liste.length
      ? h(
          "table",
          { class: "resultats" },
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              (SCH_AUTONOME() ? ["Schéma", "Adresse", "Modifié le"] : ["Schéma", "Client", "Devis", "Adresse", "Modifié le"]).map(t =>
                h("th", {}, t)
              )
            )
          ),
          h(
            "tbody",
            {},
            liste.map(p =>
              h(
                "tr",
                { class: "cliquable", onclick: () => aller("schemas", { id: p.id }) },
                h("td", {}, h("b", {}, p.nom || "Schéma")),
                SCH_AUTONOME() ? null : h("td", {}, p.client_nom || ""),
                SCH_AUTONOME()
                  ? null
                  : h("td", {}, p.document_numero ? p.document_numero + (p.document_objet ? " · " + p.document_objet : "") : ""),
                h("td", { class: "sous" }, (p.adresse || "").split("\n")[0]),
                h("td", { class: "sous" }, dateFr((p.modifie_le || "").slice(0, 10)))
              )
            )
          )
        )
      : h(
          "p",
          { class: "aide" },
          "Aucun schéma. « + Nouveau schéma » pour dessiner une installation d'interphone, de contrôle d'accès ou de portail : les appareils et leurs bornes, les câbles et leur longueur, puis chaque fil de borne à borne."
        )
  );
}
async function nouveauSchema(vals, rattacher) {
  const p = await api("POST", "/api/plans", Object.assign({ genre: "schema", nom: "Schéma", donnees: schNouvellesDonnees() }, vals));
  await aller("schemas", { id: p.id, rattacher });
}

/* ---------- câbles et modèles (paramètres) ---------- */
function fenetreCablesSchema(apres) {
  let liste = schCables().map(c => ({ ...c, couleurs: (c.couleurs || []).slice() }));
  const corps = h("div", {});
  const dessiner = () => {
    corps.replaceChildren(
      h(
        "p",
        { class: "aide", style: "margin-top:0" },
        "Conducteurs : nombre de fils utilisables (alerte quand une liaison en demande plus). Section : pour la chute de tension. Couleurs : la couleur normée de chaque conducteur dans l'ordre (paire par paire : a puis b), séparées par des virgules ; deux couleurs : « blanc/bleu » = blanc rayé de bleu. Couleurs connues : " +
          Object.keys(SCH_TEINTES).join(", ") +
          "."
      ),
      h(
        "table",
        { class: "si-table" },
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            ["Câble", "Cond.", "Section mm²", "Paires", "Coaxial", "Couleurs normées des conducteurs, dans l'ordre", ""].map(t =>
              h("th", {}, t)
            )
          )
        ),
        h(
          "tbody",
          {},
          liste.map((c, i) => {
            const nom = h("input", { type: "text", value: c.nom, style: "width:15em" });
            nom.addEventListener("input", () => (c.nom = nom.value));
            const n = h("input", { type: "text", inputmode: "numeric", value: c.conducteurs, style: "width:3.5em" });
            n.addEventListener("input", () => (c.conducteurs = Math.max(0, Math.round(nombre(n.value)))));
            const s = h("input", { type: "text", inputmode: "decimal", value: versChamp(c.section || 0), style: "width:4.5em" });
            s.addEventListener("input", () => (c.section = nombre(s.value)));
            const pa = h("input", { type: "checkbox", checked: !!c.paires, title: "Conducteurs groupés par paires (P1a, P1b…)" });
            pa.addEventListener("change", () => (c.paires = pa.checked));
            const co = h("input", { type: "checkbox", checked: !!c.coax });
            co.addEventListener("change", () => (c.coax = co.checked));
            const cl = h("input", { type: "text", value: (c.couleurs || []).join(", "), style: "width:16em" });
            cl.addEventListener(
              "input",
              () =>
                (c.couleurs = cl.value
                  .split(",")
                  .map(x => x.trim())
                  .filter(Boolean))
            );
            return h(
              "tr",
              {},
              h("td", {}, nom),
              h("td", {}, n),
              h("td", {}, s),
              h("td", { style: "text-align:center" }, pa),
              h("td", { style: "text-align:center" }, co),
              h("td", {}, cl),
              h(
                "td",
                {},
                h(
                  "button",
                  {
                    class: "icone",
                    title: "Retirer ce câble de la liste",
                    onclick: () => {
                      liste.splice(i, 1);
                      dessiner();
                    },
                  },
                  "✕"
                )
              )
            );
          })
        )
      ),
      h(
        "div",
        { style: "display:flex;gap:8px;margin-top:8px" },
        h(
          "button",
          {
            class: "btn petit",
            onclick: () => {
              liste.push({ id: schId(), nom: "Nouveau câble", conducteurs: 2, section: 0.5 });
              dessiner();
            },
          },
          "+ Câble"
        ),
        h(
          "button",
          {
            class: "btn petit",
            onclick: () => {
              liste = SCH_CABLES_DEFAUT.map(c => ({ ...c, couleurs: (c.couleurs || []).slice() }));
              dessiner();
            },
          },
          "Liste d'origine"
        )
      )
    );
  };
  dessiner();
  ouvrirModale(
    "Câbles des schémas",
    corps,
    [
      h("button", { class: "btn", onclick: fermerModale }, "Annuler"),
      h(
        "button",
        {
          class: "btn principal",
          onclick: async () => {
            try {
              await schEnregistrerParams(
                "cables",
                liste.filter(c => c.nom.trim())
              );
              fermerModale();
              toast("Câbles enregistrés");
              if (apres) apres();
            } catch (e) {
              erreur(e);
            }
          },
        },
        "Enregistrer"
      ),
    ],
    { largeur: "820px" }
  );
}
function fenetreModelesSchema() {
  // copie de travail : vos modèles, génériques modifiés, génériques masqués
  let enreg = schModelesEnregistres().map(m => ({ ...m }));
  let masques = new Set((PARAMS.schemas || {}).masques || []);
  const corps = h("div", {});
  const ligneModele = (m, generique) => {
    const modifie = generique && enreg.find(x => x.id === m.id);
    const vu = modifie || m;
    const nom = h("input", { type: "text", value: vu.nom, style: "width:16em" });
    nom.addEventListener("input", () => {
      // (renommer un générique : il devient un générique modifié)
      let x = enreg.find(y => y.id === m.id);
      if (!x) enreg.push((x = JSON.parse(JSON.stringify(m))));
      x.nom = nom.value;
    });
    const bornes = (vu.bornes || []).map(b => (Array.isArray(b) ? b[0] : b.rep)).join(" ");
    return h(
      "tr",
      {},
      h("td", {}, nom),
      h("td", { class: "sous" }, schCat(vu.categorie)[1]),
      h("td", { class: "sous", style: "max-width:14em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", title: bornes }, bornes),
      h("td", { class: "sous" }, generique ? (modifie ? "générique modifié" : "générique") : "à vous"),
      h(
        "td",
        { style: "white-space:nowrap" },
        modifie
          ? h(
              "button",
              {
                class: "icone",
                title: "Revenir au modèle générique d'origine",
                onclick: () => {
                  enreg = enreg.filter(x => x.id !== m.id);
                  dessiner();
                },
              },
              "↺"
            )
          : null,
        h(
          "button",
          {
            class: "icone",
            title: generique ? "Retirer ce modèle générique de la liste" : "Supprimer ce modèle",
            onclick: () => {
              enreg = enreg.filter(x => x.id !== m.id);
              if (generique) masques.add(m.id);
              dessiner();
            },
          },
          "✕"
        )
      )
    );
  };
  const dessiner = () => {
    const perso = enreg.filter(m => !String(m.id || "").startsWith("g-"));
    const generiques = SCH_MODELES_DEFAUT.filter(m => !masques.has(m.id));
    corps.replaceChildren(
      h(
        "p",
        { class: "aide", style: "margin-top:0" },
        "Modifier les bornes d'un modèle : posez-le dans un schéma, réglez l'appareil (bornes, côtés, longueurs max), puis « Enregistrer comme modèle » en cochant « Remplacer le modèle ». Les génériques se modifient ou se retirent de la liste ; « Rétablir » les remet comme à l'origine."
      ),
      h(
        "table",
        { class: "si-table" },
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            ["Modèle", "Sorte", "Bornes", "", ""].map(t => h("th", {}, t))
          )
        ),
        h(
          "tbody",
          {},
          perso.map(m => ligneModele(m, false)),
          generiques.map(m => ligneModele(m, true))
        )
      ),
      masques.size ? h("p", { class: "sous" }, `${masques.size} modèle(s) générique(s) retiré(s) de la liste.`) : null,
      h(
        "div",
        { class: "si-boutons" },
        h(
          "button",
          {
            class: "btn petit",
            title: "Remet tous les modèles génériques d'origine (vos modèles restent)",
            onclick: () => {
              masques = new Set();
              enreg = enreg.filter(m => !String(m.id || "").startsWith("g-"));
              dessiner();
            },
          },
          "Rétablir les modèles génériques"
        )
      )
    );
  };
  dessiner();
  ouvrirModale(
    "Modèles d'appareils",
    corps,
    [
      h("button", { class: "btn", onclick: fermerModale }, "Annuler"),
      h(
        "button",
        {
          class: "btn principal",
          onclick: async () => {
            try {
              await schEnregistrerParams({ modeles: enreg.filter(m => (m.nom || "").trim()), masques: [...masques] });
              fermerModale();
              toast("Modèles enregistrés");
            } catch (e) {
              erreur(e);
            }
          },
        },
        "Enregistrer"
      ),
    ],
    { largeur: "min(820px, 96vw)" }
  );
}

/* ---------- éditeur d'un schéma ---------- */
async function ouvrirSchema(zone, id, arg) {
  if (!document.getElementById("si-css")) document.head.append(h("style", { id: "si-css" }, SCH_CSS_SVG));
  const p = await api("GET", "/api/plans/" + id);
  const D = Object.assign(schNouvellesDonnees(), p.donnees || {});
  // (places sur la grille : les bornes tombent sur celle du routage des fils)
  const surGrille = v => (typeof v === "number" ? Math.round(v / SCH.GRILLE) * SCH.GRILLE : v);
  for (const a of D.appareils) for (const k of ["x", "y", "mx", "my"]) if (a[k] !== undefined) a[k] = surGrille(a[k]);
  // (schémas d'avant les couleurs normées : la couleur choisie devient le conducteur du câble qui a cette couleur)
  for (const l of D.liaisons) {
    const c = schCable(l.cable),
      pris = new Set();
    for (const f of l.fils || []) {
      if (f.cond !== undefined) {
        pris.add(f.cond);
        continue;
      }
      const i = ((c && c.couleurs) || []).findIndex((x, k) => x === f.couleur && !pris.has(k));
      if (i >= 0) {
        f.cond = i;
        f.couleur = "";
      } else {
        let k = 0;
        while (pris.has(k)) k++;
        f.cond = k;
      }
      pris.add(f.cond);
    }
  }
  let panneauVu = !SCH_ETROIT(),
    dernierSel = "",
    page = null; // (la page de l'éditeur, faite plus bas)
  const majPanneau = () => page && page.classList.toggle("sans-panneau", !panneauVu);
  if (!D.uid) D.uid = schId() + schId(); // (schéma d'avant les fichiers : son identifiant d'échange)
  let attente = null; // borne cliquée, en attente de la 2e borne du fil : { app, borne }
  let sel = null,
    relier = null, // mode « relier » : null, ou { a: id du 1er appareil | null }
    zoom = 1,
    dernierCable = "syt2";
  const statut = h("span", { class: "sous" });
  let minuterie = null,
    enCours = Promise.resolve();
  const enregistrer = () => {
    clearTimeout(minuterie);
    enCours = enCours.then(() =>
      api("PUT", "/api/plans/" + p.id, { donnees: D, _modifie_le: p.modifie_le })
        .then(r => {
          p.modifie_le = r.modifie_le;
          statut.textContent = "Enregistré ✓";
        })
        .catch(e => {
          statut.textContent = "Non enregistré";
          erreur(e);
        })
    );
    return enCours;
  };
  // annuler / rétablir (Ctrl+Z, Ctrl+Y) : copies successives du schéma
  const histo = [JSON.stringify(D)];
  let posHisto = 0;
  const changer = (garderPanneau = false) => {
    const j = JSON.stringify(D);
    if (j !== histo[posHisto]) {
      histo.splice(posHisto + 1);
      histo.push(j);
      if (histo.length > 80) histo.shift();
      posHisto = histo.length - 1;
    }
    clearTimeout(minuterie);
    statut.textContent = "…";
    minuterie = setTimeout(enregistrer, 900);
    dessiner();
    if (!garderPanneau) panneau();
    else majAlertes();
  };
  const revenir = k => {
    const n = posHisto + k;
    if (n < 0 || n >= histo.length) return;
    posHisto = n;
    const o = JSON.parse(histo[n]);
    for (const c of Object.keys(D)) delete D[c];
    Object.assign(D, o);
    if (!selValable()) sel = null;
    clearTimeout(minuterie);
    statut.textContent = "…";
    minuterie = setTimeout(enregistrer, 900);
    dessiner();
    panneau();
  };
  avantDeQuitter = async () => {
    if (statut.textContent === "…") await enregistrer();
    return true;
  };
  const appareil = id => D.appareils.find(x => x.id === id);
  const groupe = id => (D.groupes || []).find(x => x.id === id);
  const groupeDe = id => (D.groupes || []).find(g => g.membres.includes(id));
  const selValable = () =>
    !sel ||
    (sel.type === "plusieurs"
      ? sel.ids.every(id => appareil(id))
      : (sel.type === "appareil" ? D.appareils : sel.type === "groupe" ? D.groupes || [] : D.liaisons).some(x => x.id === sel.id));
  /** commence le glisser de plusieurs appareils ensemble (groupe, sélection) */
  const glisserApps = (ids, pt, e) => {
    glisse = {
      apps: ids
        .map(appareil)
        .filter(Boolean)
        .map(a => {
          const p0 = schPos(a, D.vue);
          return { a, x0: p0.x, y0: p0.y };
        }),
      depart: pt,
      bouge: false,
    };
    zoneDessin.setPointerCapture(e.pointerId);
  };
  const liaison = id => D.liaisons.find(x => x.id === id);

  /* --- zone de dessin --- */
  const zoneDessin = h("div", { class: "si-zone", tabindex: "0" });
  const aideZone = h("div", { class: "si-aide-zone" });
  function dessiner() {
    const avant = zoneDessin.querySelector("svg");
    const svg = schDessiner(D, D.vue, sel, {
      zoom,
      cadre: glisse && glisse.bouge && avant ? ["x0", "y0", "x2", "y2"].map(k => Number(avant.dataset[k])) : null,
      rapide: !!(glisse && glisse.bouge && SCH_CACHE.duree > 40), // (routage complet en direct s'il est rapide)
      attente: attente && attente.borne,
    });
    zoneDessin.replaceChildren(svg);
    aideZone.textContent = attente
      ? "Cliquez sur l'autre borne du fil (Échap : annuler)"
      : relier
        ? relier.a
          ? "Cliquez sur le 2e appareil (Échap : annuler)"
          : "Cliquez sur le 1er appareil à relier (Échap : annuler)"
        : D.vue === "multifilaire"
          ? "Fil : cliquez une borne puis l'autre (ou tirez de l'une à l'autre). Glissez un appareil pour le déplacer. Maj + clic : choisir plusieurs appareils."
          : "Glissez les appareils pour les placer. Cliquez sur un câble pour le régler. Maj + clic : choisir plusieurs appareils (Grouper).";
    zoneDessin.classList.toggle("relier", !!relier);
    // (au doigt, l'aide permanente est cachée : seulement « cliquez sur l'autre borne… » ; le reste est dans « ? »)
    aideZone.classList.toggle("info", !relier && !attente);
    if (!D.appareils.length)
      zoneDessin.append(
        h("div", { class: "si-vide" }, "Commencez par « + Appareil » : un modèle, ou un bloc générique avec le nombre de bornes voulu.")
      );
  }
  const versSvg = e => {
    const svg = zoneDessin.querySelector("svg");
    const r = svg.getBoundingClientRect(),
      vb = svg.viewBox.baseVal;
    return { x: vb.x + ((e.clientX - r.left) / r.width) * vb.width, y: vb.y + ((e.clientY - r.top) / r.height) * vb.height };
  };
  let glisse = null;
  // deux doigts : pincer pour zoomer (le point entre les doigts reste en place)
  const doigts = new Map();
  let pince = null,
    pinceImage = 0;
  const zoomerAutour = (nz, cx, cy) => {
    const svg0 = zoneDessin.querySelector("svg"),
      r0 = svg0.getBoundingClientRect(),
      vb = svg0.viewBox.baseVal;
    const P = { x: vb.x + ((cx - r0.left) / r0.width) * vb.width, y: vb.y + ((cy - r0.top) / r0.height) * vb.height };
    zoom = Math.max(0.4, Math.min(2.5, nz));
    dessiner();
    const svg1 = zoneDessin.querySelector("svg"),
      r1 = svg1.getBoundingClientRect(),
      vb1 = svg1.viewBox.baseVal;
    zoneDessin.scrollLeft += r1.left + ((P.x - vb1.x) / vb1.width) * r1.width - cx;
    zoneDessin.scrollTop += r1.top + ((P.y - vb1.y) / vb1.height) * r1.height - cy;
  };
  zoneDessin.addEventListener(
    "pointerdown",
    e => {
      if (e.pointerType !== "touch") return;
      doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (doigts.size === 2) {
        // (le 2e doigt arrête ce que faisait le 1er : glisser, tirer un fil)
        if (glisse && glisse.trait) glisse.trait.remove();
        if (glisse && glisse.bouge) changer(true);
        glisse = null;
        const [a, b] = [...doigts.values()];
        pince = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: zoom };
        e.stopImmediatePropagation();
      }
    },
    true
  );
  zoneDessin.addEventListener(
    "pointermove",
    e => {
      if (!doigts.has(e.pointerId)) return;
      doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pince || doigts.size < 2) return;
      e.stopImmediatePropagation();
      const [a, b] = [...doigts.values()];
      const nz = pince.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / pince.d0);
      cancelAnimationFrame(pinceImage);
      pinceImage = requestAnimationFrame(() => zoomerAutour(nz, (a.x + b.x) / 2, (a.y + b.y) / 2));
    },
    true
  );
  const finDoigt = e => {
    doigts.delete(e.pointerId);
    if (doigts.size < 2) pince = null;
  };
  zoneDessin.addEventListener("pointerup", finDoigt, true);
  zoneDessin.addEventListener("pointercancel", finDoigt, true);
  zoneDessin.addEventListener("pointerdown", e => {
    if (e.button !== 0 || pince) return;
    const pastille = e.target.closest("[data-borne]");
    const gA = e.target.closest("[data-app]");
    const gL = e.target.closest("[data-liaison]");
    const pt = versSvg(e);
    if (relier) {
      // (un appareil, ou le cadre d'un groupe : le câble part alors du groupe)
      const gGrR = e.target.closest("[data-groupe]");
      if (!gA && !gGrR) return;
      const idA = gA ? gA.dataset.app : gGrR.dataset.groupe;
      if (!relier.a) relier.a = idA;
      else if (relier.a !== idA && schEndroit(D, relier.a).has(idA) && (schGroupe(D, relier.a) || schGroupe(D, idA))) {
        toast("Ce groupe et cet appareil sont au même endroit : reliez deux appareils du groupe, ou le groupe à un autre appareil.", true);
        return;
      } else if (schEndroit(D, relier.a).has(idA) && relier.a !== idA && !schLiaisonEntre(D, relier.a, idA)) {
        // (deux appareils d'un même groupe : leur propre câble)
        const l = nouvelleLiaison(relier.a, idA);
        relier = null;
        sel = { type: "liaison", id: l.id };
        changer();
        return;
      } else if (relier.a !== idA) {
        // (déjà reliés : on reprend ce câble, les fils s'y ajoutent ; un 2e câble : bouton dans la liaison)
        const deja = schLiaisonEntre(D, relier.a, idA);
        const l = deja || nouvelleLiaison(relier.a, idA);
        if (deja) toast(`Déjà reliés par ${deja.rep || "un câble"} : ajoutez-y les fils.`);
        relier = null;
        sel = { type: "liaison", id: l.id };
        changer();
        return;
      }
      dessiner();
      return;
    }
    if (pastille && D.vue === "multifilaire") {
      // 2e borne d'un fil commencé par un clic : le fil est posé
      if (attente) {
        const at = attente;
        attente = null;
        if (at.borne === pastille.dataset.borne) {
          dessiner();
          return;
        }
        if (at.app !== pastille.dataset.app) {
          e.preventDefault();
          ajouterFil(at.app, at.borne, pastille.dataset.app, pastille.dataset.borne);
          return;
        }
      }
      // tirer un fil depuis une borne (ou, sans bouger, cliquer : la borne attend la 2e)
      e.preventDefault();
      const svg = zoneDessin.querySelector("svg");
      const c = pastille;
      const x0 = Number(c.getAttribute("cx")),
        y0 = Number(c.getAttribute("cy"));
      const a = appareil(c.dataset.app),
        pa = schPos(a, "multifilaire");
      const trait = sv("line", { x1: pa.x + x0, y1: pa.y + y0, x2: pt.x, y2: pt.y, class: "si-fil-tire" });
      svg.append(trait);
      glisse = { fil: { app: a.id, borne: c.dataset.borne }, trait, cx: e.clientX, cy: e.clientY };
      zoneDessin.setPointerCapture(e.pointerId);
      return;
    }
    if (attente) {
      attente = null;
      dessiner();
    }
    if (gA) {
      const id = gA.dataset.app;
      // Maj (ou Ctrl) + clic : ajouter à la sélection ou l'en retirer (pour grouper, déplacer, supprimer ensemble)
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const ids = sel && sel.type === "plusieurs" ? sel.ids.slice() : sel && sel.type === "appareil" ? [sel.id] : [];
        const i = ids.indexOf(id);
        if (i >= 0) ids.splice(i, 1);
        else ids.push(id);
        sel = ids.length > 1 ? { type: "plusieurs", ids } : ids.length ? { type: "appareil", id: ids[0] } : null;
        dessiner();
        panneau();
        return;
      }
      if (sel && sel.type === "plusieurs" && sel.ids.includes(id)) {
        glisserApps(sel.ids, pt, e);
        return;
      }
      sel = { type: "appareil", id };
      glisserApps([id], pt, e);
      zoneDessin.querySelectorAll(".si-app.sel,.si-liaison.sel,.si-ensemble.sel").forEach(x => x.classList.remove("sel"));
      gA.classList.add("sel");
      panneau();
      return;
    }
    if (gL) {
      sel = { type: "liaison", id: gL.dataset.liaison };
      dessiner();
      panneau();
      return;
    }
    const gGr = e.target.closest("[data-groupe]");
    if (gGr) {
      const gr = groupe(gGr.dataset.groupe);
      sel = { type: "groupe", id: gr.id };
      glisserApps(gr.membres, pt, e);
      dessiner();
      panneau();
      return;
    }
    // au doigt, sur le fond : faire défiler le dessin (la page ne défile pas toute seule dans le dessin)
    if (e.pointerType === "touch") {
      glisse = { pan: true, x: e.clientX, y: e.clientY, sl: zoneDessin.scrollLeft, st: zoneDessin.scrollTop };
      zoneDessin.setPointerCapture(e.pointerId);
    }
    if (sel) {
      sel = null;
      dessiner();
      panneau();
    }
  });
  zoneDessin.addEventListener("pointermove", e => {
    if (!glisse) return;
    if (glisse.pan) {
      zoneDessin.scrollLeft = glisse.sl - (e.clientX - glisse.x);
      zoneDessin.scrollTop = glisse.st - (e.clientY - glisse.y);
      return;
    }
    const pt = versSvg(e);
    if (glisse.fil) {
      glisse.trait.setAttribute("x2", pt.x);
      glisse.trait.setAttribute("y2", pt.y);
      return;
    }
    const g = SCH.GRILLE;
    let bouge = false;
    // (le même pas pour tous, en multiples de la grille : l'ensemble garde sa forme)
    const ddx = Math.round((pt.x - glisse.depart.x) / g) * g,
      ddy = Math.round((pt.y - glisse.depart.y) / g) * g;
    for (const { a, x0, y0 } of glisse.apps) {
      const x = x0 + ddx,
        y = y0 + ddy;
      const [kx, ky] = D.vue === "multifilaire" ? ["mx", "my"] : ["x", "y"];
      if (a[kx] === x && a[ky] === y) continue;
      a[kx] = x;
      a[ky] = y;
      bouge = true;
    }
    if (!bouge) return;
    glisse.bouge = true;
    dessiner();
  });
  const finGlisse = e => {
    if (!glisse) return;
    const g = glisse;
    glisse = null;
    if (g.fil) {
      g.trait.remove();
      if (Math.hypot(e.clientX - g.cx, e.clientY - g.cy) < 5) {
        attente = g.fil;
        dessiner();
        return;
      }
      const cible = document.elementFromPoint(e.clientX, e.clientY);
      const c = cible && cible.closest && cible.closest("[data-borne]");
      if (c && c.dataset.app !== g.fil.app) ajouterFil(g.fil.app, g.fil.borne, c.dataset.app, c.dataset.borne);
      else if (c) toast("Reliez deux bornes de deux appareils différents.", true);
      return;
    }
    if (g.bouge) changer(true);
  };
  zoneDessin.addEventListener("pointerup", finGlisse);
  zoneDessin.addEventListener("pointercancel", finGlisse);
  zoneDessin.addEventListener("dblclick", e => {
    if (e.target.closest("[data-app]") || e.target.closest("[data-liaison]")) return;
    menuAjout(e.clientX, e.clientY, versSvg(e));
  });
  zoneDessin.addEventListener("contextmenu", e => {
    const gA = e.target.closest("[data-app]"),
      gL = e.target.closest("[data-liaison]");
    e.preventDefault();
    if (gA) {
      const a = appareil(gA.dataset.app);
      sel = { type: "appareil", id: a.id };
      dessiner();
      panneau();
      ouvrirMenuContextuel(e.clientX, e.clientY, [
        { titre: (a.rep || "") + " " + (a.nom || "") },
        {
          libelle: "Relier à un autre appareil…",
          action: () => {
            relier = { a: a.id };
            dessiner();
          },
        },
        { libelle: "Dupliquer", action: () => dupliquerAppareil(a) },
        ...entreesGroupe(a),
        { libelle: "Enregistrer comme modèle…", action: () => enregistrerModele(a) },
        "-",
        { libelle: "Supprimer", danger: true, action: () => supprimerSel() },
      ]);
    } else if (gL) {
      sel = { type: "liaison", id: gL.dataset.liaison };
      dessiner();
      panneau();
      ouvrirMenuContextuel(e.clientX, e.clientY, [
        { libelle: "Relier les bornes de même repère", action: () => autoFils(liaison(sel.id)) },
        "-",
        { libelle: "Supprimer la liaison", danger: true, action: () => supprimerSel() },
      ]);
    } else menuAjout(e.clientX, e.clientY, versSvg(e));
  });
  zoneDessin.addEventListener("keydown", e => {
    if (e.target !== zoneDessin) return;
    if ((e.key === "Delete" || e.key === "Backspace") && sel) {
      e.preventDefault();
      supprimerSel();
    } else if (e.key === "Escape" && relier) {
      relier = null;
      dessiner();
    }
  });
  const clavier = e => {
    if (!document.body.contains(zoneDessin)) {
      document.removeEventListener("keydown", clavier, true);
      return;
    }
    const dansChamp = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || "");
    if ((e.ctrlKey || e.metaKey) && !dansChamp && (e.key === "z" || e.key === "y" || e.key === "Z")) {
      e.preventDefault();
      e.stopPropagation();
      revenir(e.key === "y" || (e.key === "Z" && e.shiftKey) ? 1 : -1);
    } else if (e.key === "?" && !dansChamp && !document.querySelector("#modale:not(.cache)")) {
      e.preventDefault();
      aideSchema();
    } else if (e.key === "Escape" && (relier || attente)) {
      relier = attente = null;
      dessiner();
    }
  };
  document.addEventListener("keydown", clavier, true);

  /* --- actions --- */
  const placeLibre = () => {
    // à droite du dernier appareil, en ligne de 4
    const n = D.appareils.length;
    return { x: 40 + (n % 4) * (SCH.L + 130), y: 40 + Math.floor(n / 4) * 160 };
  };
  function ajouterAppareil(m, pos) {
    const q = pos || placeLibre();
    const x = Math.round(q.x / SCH.GRILLE) * SCH.GRILLE,
      y = Math.round(q.y / SCH.GRILLE) * SCH.GRILLE;
    const a = schAppareilDepuisModele(D, m, x, y);
    D.appareils.push(a);
    sel = { type: "appareil", id: a.id };
    changer();
    zoneDessin.focus();
  }
  async function blocGenerique(pos) {
    const t = await demanderTexte("Nombre de bornes du bloc générique :", "4");
    if (t === null || t === undefined) return;
    const n = Math.max(0, Math.min(60, Math.round(nombre(t))));
    ajouterAppareil(
      {
        nom: "Appareil",
        categorie: "autre",
        bornes: Array.from({ length: n }, (_, i) => [String(i + 1), ""]),
      },
      pos
    );
  }
  function entreesModeles(pos) {
    const perso = schModelesPerso();
    return [
      { libelle: "Bloc générique (nombre de bornes)…", action: () => blocGenerique(pos).catch(erreur) },
      "-",
      perso.length ? { titre: "Mes modèles" } : null,
      ...perso.map(m => ({ libelle: m.nom, action: () => ajouterAppareil(m, pos) })),
      perso.length ? "-" : null,
      { titre: "Modèles génériques (bornes à adapter selon la notice)" },
      ...schModelesGeneriques().map(m => ({ libelle: m.nom + (m.modifie ? " ✎" : ""), action: () => ajouterAppareil(m, pos) })),
      "-",
      { libelle: "Modèles d'appareils…", action: () => fenetreModelesSchema() },
    ];
  }
  function menuAjout(x, y, pos) {
    ouvrirMenuContextuel(x, y, [
      { titre: "Ajouter un appareil ici" },
      ...entreesModeles(pos ? { x: pos.x - SCH.L / 2, y: pos.y - 20 } : null),
    ]);
  }
  function nouvelleLiaison(a, b) {
    const l = { id: schId(), a, b, rep: schRepereLiaison(D), cable: dernierCable, longueur: "", courant: "", tension: "", fils: [] };
    D.liaisons.push(l);
    return l;
  }
  /** premier conducteur libre du câble (sa couleur normée suit) */
  const condSuivant = l => {
    const pris = new Set((l.fils || []).map(f => f.cond));
    let i = 0;
    while (pris.has(i)) i++;
    return i;
  };
  /** fil de la borne ba (appareil A) à la borne bb (appareil B) : dans la liaison A–B (créée s'il n'y en a pas) */
  function ajouterFil(A, ba, B, bb) {
    // un seul câble entre deux endroits : un appareil d'un groupe (même endroit qu'un autre) reprend le câble qui
    // part déjà du groupe vers l'autre appareil, dont le bout devient le groupe
    let l = schLiaisonEntre(D, A, B);
    if (!l) l = nouvelleLiaison(A, B);
    const sens = l.a === A || l.b === B ? true : l.a === B || l.b === A ? false : schEndroit(D, A).has(l.a);
    const [cA, cB] = sens ? ["a", "b"] : ["b", "a"];
    const gA = schGroupeDe(D, A),
      gB = schGroupeDe(D, B);
    if (!(gA && gA === gB))
      for (const [cle, app, gr] of [
        [cA, A, gA],
        [cB, B, gB],
      ])
        if (l[cle] !== app && gr && !schGroupe(D, l[cle])) l[cle] = gr.id;
    const [fa, fb] = sens ? [ba, bb] : [bb, ba];
    if (l.fils.some(f => f.ba === fa && f.bb === fb)) {
      toast("Ce fil existe déjà.");
      return;
    }
    l.fils.push({ id: schId(), ba: fa, bb: fb, cond: condSuivant(l), couleur: "", rep: "" });
    sel = { type: "liaison", id: l.id };
    changer();
  }
  /** relie les bornes qui portent le même repère des deux côtés (L1–L1, +–+…) */
  function autoFils(l) {
    // (bout d'un groupe : les bornes de tous ses appareils)
    const A = { bornes: schAppsBout(D, l.a).flatMap(a => a.bornes || []) },
      B = { bornes: schAppsBout(D, l.b).flatMap(a => a.bornes || []) };
    const norm = s =>
      String(s || "")
        .trim()
        .toLowerCase()
        .replace("−", "-");
    let n = 0;
    const prisB = new Set();
    for (const ba of A.bornes || []) {
      if (!ba.rep) continue;
      const bb = (B.bornes || []).find(x => !prisB.has(x.id) && norm(x.rep) === norm(ba.rep));
      if (!bb) continue;
      prisB.add(bb.id);
      if (l.fils.some(f => f.ba === ba.id || f.bb === bb.id)) continue;
      l.fils.push({ id: schId(), ba: ba.id, bb: bb.id, cond: condSuivant(l), couleur: "", rep: "" });
      n++;
    }
    toast(n ? n + " fil(s) ajouté(s)" : "Aucune borne de même repère à relier");
    if (n) changer();
  }
  function dupliquerAppareil(a) {
    const b = JSON.parse(JSON.stringify(a));
    b.id = schId();
    b.rep = schRepere(D, a.categorie);
    b.bornes.forEach(x => (x.id = schId()));
    b.x = a.x + 30;
    b.y = a.y + 30;
    if (a.mx !== undefined) {
      b.mx = a.mx + 30;
      b.my = a.my + 30;
    }
    D.appareils.push(b);
    sel = { type: "appareil", id: b.id };
    changer();
  }
  /** l'appareil (bornes, côtés, longueurs max) devient un modèle : nouveau, ou à la place de celui d'où il vient
   *  (un générique modifié remplace celui d'origine dans la liste ; « Modèles d'appareils… » pour revenir en arrière) */
  function enregistrerModele(a) {
    const source = a.modele ? schModele(a.modele) : null;
    const nom = h("input", { type: "text", value: a.nom || (source ? source.nom : ""), style: "width:100%" });
    // (remplacer coché d'office si l'appareil porte encore le nom de son modèle)
    const remplacer = h("input", { type: "checkbox", checked: !!source && source.nom === a.nom });
    ouvrirModale(
      "Enregistrer comme modèle",
      h(
        "div",
        {},
        h("label", { class: "si-ligne" }, h("span", {}, "Nom du modèle"), nom),
        source
          ? h(
              "label",
              { class: "case" },
              remplacer,
              ` Remplacer le modèle « ${source.nom} »${String(source.id).startsWith("g-") ? " (générique)" : ""}`
            )
          : null,
        h(
          "p",
          { class: "aide" },
          "Le modèle garde les bornes (repère, rôle, câble imposé, côté), les longueurs max et la sorte d'appareil."
        )
      ),
      [
        h("button", { class: "btn", onclick: fermerModale }, "Annuler"),
        h(
          "button",
          {
            class: "btn principal",
            onclick: async () => {
              const n = nom.value.trim();
              if (!n) return toast("Donnez un nom au modèle.", true);
              const id = source && remplacer.checked ? source.id : schId();
              const m = {
                id,
                nom: n,
                categorie: a.categorie,
                bornes_fixes: !!a.bornes_fixes,
                bornes: (a.bornes || []).map(b => ({ rep: b.rep, role: b.role, cable: b.cable || "", cote: b.cote || "" })),
                longueurs: (a.longueurs || []).filter(l => schNum(l.m)).map(l => ({ cable: l.cable || "", m: schNum(l.m) })),
              };
              try {
                await schEnregistrerParams("modeles", [...schModelesEnregistres().filter(x => x.id !== id), m]);
                a.modele = id;
                changer(true);
                fermerModale();
                toast("Modèle « " + m.nom + " » enregistré : proposé dans « + Appareil »");
              } catch (e) {
                erreur(e);
              }
            },
          },
          "Enregistrer"
        ),
      ]
    );
    setTimeout(() => nom.select(), 50);
  }
  function supprimerSel() {
    if (!sel) return;
    if (sel.type === "appareil" || sel.type === "plusieurs") {
      const ids = new Set(sel.type === "plusieurs" ? sel.ids : [sel.id]);
      const bornes = new Set(D.appareils.filter(x => ids.has(x.id)).flatMap(x => (x.bornes || []).map(b => b.id)));
      D.appareils = D.appareils.filter(x => !ids.has(x.id));
      for (const l of D.liaisons) l.fils = (l.fils || []).filter(f => !bornes.has(f.ba) && !bornes.has(f.bb));
      for (const g of D.groupes || []) g.membres = g.membres.filter(id => !ids.has(id));
      D.groupes = (D.groupes || []).filter(g => g.membres.length);
      const restants = new Set([...D.appareils.map(x => x.id), ...D.groupes.map(g => g.id)]);
      D.liaisons = D.liaisons.filter(l => restants.has(l.a) && restants.has(l.b));
    } else if (sel.type === "groupe") {
      // (Suppr sur un cadre : dégrouper ; chaque appareil reprend ses fils dans un câble à lui)
      const g = groupe(sel.id);
      if (g) for (const id of g.membres.slice()) sortirDuGroupe(id);
      D.groupes = (D.groupes || []).filter(x => x.id !== sel.id);
    } else D.liaisons = D.liaisons.filter(l => l.id !== sel.id);
    sel = null;
    changer();
  }
  /* --- groupes : plusieurs appareils dans un cadre pointillé (ex. modules d'une platine de rue) --- */
  /** un appareil quitte son groupe : ses fils dans les câbles du groupe passent dans un câble à lui (même type,
   *  même longueur) ; un câble qui n'avait que ses fils devient le sien */
  function sortirDuGroupe(appId) {
    const g = groupeDe(appId),
      a = appareil(appId);
    if (!g || !a) return;
    const siennes = new Set((a.bornes || []).map(b => b.id));
    for (const l of D.liaisons.slice())
      for (const [cle, k] of [
        ["a", "ba"],
        ["b", "bb"],
      ]) {
        if (l[cle] !== g.id) continue;
        const siens = l.fils.filter(f => siennes.has(f[k])),
          reste = l.fils.filter(f => !siennes.has(f[k]));
        if (!siens.length) {
          if (g.membres.length === 1) l[cle] = appId; // (dernier appareil du groupe : les câbles sans fil lui reviennent)
          continue;
        }
        if (!reste.length) {
          l[cle] = appId;
          continue;
        }
        l.fils = reste;
        D.liaisons.push({ ...JSON.parse(JSON.stringify(l)), id: schId(), rep: schRepereLiaison(D), fils: siens, [cle]: appId });
      }
    g.membres = g.membres.filter(x => x !== appId);
  }
  function grouper(ids) {
    D.groupes = D.groupes || [];
    // (un appareil n'est que dans un groupe : il quitte l'ancien)
    for (const id of ids) sortirDuGroupe(id);
    D.groupes = D.groupes.filter(g => g.membres.length);
    let n = 1;
    while (D.groupes.some(g => g.nom === "Ensemble " + n)) n++;
    const g = { id: schId(), nom: "Ensemble " + n, membres: ids.slice() };
    D.groupes.push(g);
    sel = { type: "groupe", id: g.id };
    changer();
    const i = cote.querySelector("input");
    if (i) i.select();
  }
  function retirerDuGroupe(id) {
    sortirDuGroupe(id);
    D.groupes = (D.groupes || []).filter(g => g.membres.length);
    changer();
  }
  function entreesGroupe(a) {
    const gr = groupeDe(a.id),
      autres = (D.groupes || []).filter(g => g !== gr);
    return [
      autres.length
        ? {
            libelle: "Ajouter au groupe",
            sous: autres.map(g => ({
              libelle: g.nom || "Ensemble",
              action: () => {
                retirerDuGroupe(a.id);
                g.membres.push(a.id);
                changer();
              },
            })),
          }
        : null,
      gr ? { libelle: "Retirer du groupe « " + (gr.nom || "Ensemble") + " »", action: () => retirerDuGroupe(a.id) } : null,
    ];
  }

  /* --- panneau de droite : réglages de l'objet choisi, ou résumé --- */
  const cote = h("div", { class: "si-panneau" });
  let majAlertes = () => {};
  const ligne = (lib, el) => h("label", { class: "si-ligne" }, h("span", {}, lib), el);
  const texte = (obj, cle, attrs, apres) => {
    const i = h("input", Object.assign({ type: "text", value: obj[cle] ?? "" }, attrs || {}));
    i.addEventListener("input", () => {
      obj[cle] = i.value;
      if (apres) apres();
      changer(true);
    });
    return i;
  };
  const choixCable = (val, avecVide, change) => {
    const s = h(
      "select",
      {},
      avecVide ? h("option", { value: "" }, avecVide) : null,
      schCables().map(c => h("option", { value: c.id, selected: c.id === val }, c.nom))
    );
    if (!avecVide && !schCable(val)) s.prepend(h("option", { value: "", selected: true }, "— choisir —"));
    s.addEventListener("change", () => change(s.value));
    return s;
  };
  function panneau() {
    // panneau de droite : sur un écran étroit (tablette en portrait), il passe par-dessus le bas du dessin ; il
    // s'ouvre quand on choisit un objet, se referme quand on touche le fond ; « ▤ Réglages » l'ouvre ou le ferme
    const cle = sel ? sel.type + (sel.id || (sel.ids || []).join()) : "";
    if (cle !== dernierSel) {
      if (sel) panneauVu = true;
      else if (SCH_ETROIT()) panneauVu = false;
      dernierSel = cle;
    }
    majPanneau();
    if (!sel) return panneauResume();
    if (sel.type === "appareil") return panneauAppareil(appareil(sel.id));
    if (sel.type === "plusieurs") return panneauPlusieurs();
    if (sel.type === "groupe") return panneauGroupe(groupe(sel.id));
    return panneauLiaison(liaison(sel.id));
  }
  const lienApp = (a, plus) =>
    h(
      "p",
      {
        class: "cliquable si-lien",
        onclick: () => {
          sel = { type: "appareil", id: a.id };
          dessiner();
          panneau();
        },
      },
      `${a.rep || ""} ${a.nom || ""}`,
      plus || null
    );
  function panneauPlusieurs() {
    majAlertes = () => {};
    const apps = sel.ids.map(appareil).filter(Boolean);
    remplirSi(
      cote,
      h("h3", {}, apps.length + " appareils choisis"),
      apps.map(a => lienApp(a)),
      h("p", { class: "aide" }, "Maj + clic sur un appareil : l'ajouter ou le retirer. Glissez l'un d'eux pour les déplacer ensemble."),
      h(
        "div",
        { class: "si-boutons" },
        h(
          "button",
          {
            class: "btn petit principal",
            title: "Un cadre pointillé autour, avec un nom (ex. les modules d'une platine)",
            onclick: () => grouper(sel.ids),
          },
          "Grouper"
        ),
        h("button", { class: "btn petit danger", onclick: () => supprimerSel() }, "Supprimer")
      )
    );
  }
  function panneauGroupe(g) {
    if (!g) return panneauResume();
    majAlertes = () => {};
    remplirSi(
      cote,
      h("h3", {}, "Groupe"),
      ligne("Nom", texte(g, "nom", { style: "width:100%" })),
      h("h3", {}, "Modules"),
      g.membres
        .map(appareil)
        .filter(Boolean)
        .map(a =>
          lienApp(
            a,
            h(
              "button",
              {
                class: "icone",
                title: "Retirer du groupe",
                onclick: ev => {
                  ev.stopPropagation();
                  retirerDuGroupe(a.id);
                },
              },
              "✕"
            )
          )
        ),
      h(
        "p",
        { class: "aide" },
        "Glissez le cadre pour déplacer tout l'ensemble. Ajouter un appareil : clic droit dessus > Ajouter au groupe."
      ),
      h(
        "div",
        { class: "si-boutons" },
        h("button", { class: "btn petit", title: "Retire le cadre, les appareils restent", onclick: () => supprimerSel() }, "Dégrouper")
      )
    );
  }
  function panneauResume() {
    const N = schNomenclature(D);
    const alertes = D.liaisons.flatMap(l => schAlertesLiaison(D, l).map(a => [l, a]));
    const chute = h("input", { type: "text", inputmode: "decimal", value: versChamp(schNum(D.chute_max) || 10), style: "width:4em" });
    chute.addEventListener("input", () => {
      D.chute_max = nombre(chute.value);
      changer(true);
    });
    majAlertes = () => {};
    remplirSi(
      cote,
      h("h3", {}, "Schéma"),
      alertes.length
        ? h(
            "div",
            { class: "si-alertes" },
            alertes.map(([l, a]) =>
              h(
                "p",
                {
                  class: "cliquable",
                  onclick: () => {
                    sel = { type: "liaison", id: l.id };
                    dessiner();
                    panneau();
                  },
                },
                "⚠ " + (l.rep ? l.rep + " : " : "") + a
              )
            )
          )
        : D.liaisons.length
          ? h("p", { class: "si-ok" }, "✓ Aucune alerte")
          : null,
      h("h3", {}, "Câbles"),
      N.cables.length
        ? h(
            "table",
            { class: "si-table" },
            h(
              "tbody",
              {},
              N.cables.map(c =>
                h(
                  "tr",
                  {},
                  h("td", {}, c.nom),
                  h("td", { style: "text-align:right;white-space:nowrap" }, schFr(c.m) + " m"),
                  h("td", { class: "sous" }, c.n + " liaison(s)" + (c.sans ? ", " + c.sans + " sans longueur" : ""))
                )
              )
            )
          )
        : h(
            "p",
            { class: "aide" },
            "Aucune liaison. « 🔗 Relier » puis deux appareils, ou en multifilaire : tirez d'une borne à une autre."
          ),
      h("h3", {}, "Appareils"),
      N.appareils.length
        ? h(
            "table",
            { class: "si-table" },
            h(
              "tbody",
              {},
              N.appareils.map(a =>
                h(
                  "tr",
                  {},
                  h("td", { style: "text-align:right" }, a.n + " ×"),
                  h("td", {}, a.nom),
                  h("td", {}, h("span", { class: "si-puce", style: "background:" + schEtat(a.etat)[2] }), " " + schEtat(a.etat)[1]),
                  h("td", { class: "sous" }, a.reps.join(", "))
                )
              )
            )
          )
        : null,
      N.ensembles.length ? h("h3", {}, "Ensembles") : null,
      N.ensembles.map(e => h("p", { class: "si-lien" }, h("b", {}, e.nom), " : " + e.modules.map(a => a.rep + " " + a.nom).join(", "))),
      h("h3", {}, "Réglages"),
      ligne("Chute de tension admise", h("span", {}, chute, " %")),
      h(
        "p",
        { class: "aide" },
        "Chute de tension : indiquez le courant et la tension d'une liaison (ex. alimentation d'une gâche en 12 V). Longueurs max : dans chaque appareil, selon sa notice."
      ),
      h(
        "div",
        { class: "si-legende" },
        SCH_ETATS.map(([, l, c]) => h("span", {}, h("span", { class: "si-puce", style: "background:" + c }), l))
      )
    );
  }
  function panneauAppareil(a) {
    if (!a) return panneauResume();
    majAlertes = () => {};
    const cat = h(
      "select",
      {},
      SCH_CATEGORIES.map(([k, l]) => h("option", { value: k, selected: k === a.categorie }, l))
    );
    cat.addEventListener("change", () => {
      a.categorie = cat.value;
      changer(true);
    });
    const etat = h(
      "select",
      {},
      SCH_ETATS.map(([k, l]) => h("option", { value: k, selected: k === (a.etat || "neuf") }, l))
    );
    etat.addEventListener("change", () => {
      a.etat = etat.value;
      changer(true);
    });
    const note = h("textarea", { rows: 2, style: "width:100%" }, a.note || "");
    note.addEventListener("input", () => {
      a.note = note.value;
      changer(true);
    });
    const bornes = h(
      "table",
      { class: "si-table si-bornes" },
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          // (largeurs fixes : le tableau tient dans un panneau étroit, sur tablette)
          [["Repère", "17%"], ["Rôle", ""], a.bornes_fixes ? ["Côté", "18%"] : null, ["Câble imposé", "22%"], ["", "44px"]]
            .filter(Boolean)
            .map(([t, w]) => h("th", w ? { style: "width:" + w } : {}, t))
        )
      ),
      h(
        "tbody",
        {},
        (a.bornes || []).map((b, i) =>
          h(
            "tr",
            {},
            h("td", {}, texte(b, "rep", { style: "width:100%" })),
            h("td", {}, texte(b, "role", { style: "width:100%" })),
            a.bornes_fixes
              ? h(
                  "td",
                  {},
                  (() => {
                    const sc = h(
                      "select",
                      { title: "Côté de la borne sur l'appareil (dans l'ordre de la liste)" },
                      SCH_COTES.map(([k, lib]) => h("option", { value: k, selected: k === (b.cote || "d") }, lib))
                    );
                    sc.addEventListener("change", () => {
                      b.cote = sc.value;
                      changer(true);
                    });
                    return sc;
                  })()
                )
              : null,
            h(
              "td",
              {},
              choixCable(b.cable || "", "—", v => {
                b.cable = v;
                changer(true);
              })
            ),
            h(
              "td",
              { style: "white-space:nowrap" },
              h(
                "button",
                {
                  class: "icone",
                  title: "Monter",
                  disabled: i === 0,
                  onclick: () => {
                    a.bornes.splice(i - 1, 0, a.bornes.splice(i, 1)[0]);
                    changer();
                  },
                },
                "↑"
              ),
              h(
                "button",
                {
                  class: "icone",
                  title: "Supprimer la borne (et ses fils)",
                  onclick: () => {
                    a.bornes.splice(i, 1);
                    for (const l of D.liaisons) l.fils = l.fils.filter(f => f.ba !== b.id && f.bb !== b.id);
                    changer();
                  },
                },
                "✕"
              )
            )
          )
        )
      )
    );
    const longueurs = h(
      "table",
      { class: "si-table" },
      h(
        "tbody",
        {},
        (a.longueurs || []).map((l, i) =>
          h(
            "tr",
            {},
            h(
              "td",
              {},
              choixCable(l.cable || "", "Tous câbles", v => {
                l.cable = v;
                changer(true);
              })
            ),
            h("td", { style: "white-space:nowrap" }, texte(l, "m", { inputmode: "decimal", style: "width:4.5em" }), " m"),
            h(
              "td",
              {},
              h(
                "button",
                {
                  class: "icone",
                  title: "Retirer",
                  onclick: () => {
                    a.longueurs.splice(i, 1);
                    changer();
                  },
                },
                "✕"
              )
            )
          )
        )
      )
    );
    // (liaisons de l'appareil, et celles de son groupe d'où part un de ses fils)
    const gr = groupeDe(a.id);
    const liaisons = D.liaisons.filter(l => l.a === a.id || l.b === a.id || (gr && (l.a === gr.id || l.b === gr.id)));
    remplirSi(
      cote,
      h("h3", {}, "Appareil ", h("span", { class: "si-puce", style: "background:" + schEtat(a.etat)[2] })),
      ligne("Nom", texte(a, "nom", { style: "width:100%" })),
      ligne("Repère", texte(a, "rep", { style: "width:6em" })),
      ligne("Sorte", cat),
      ligne("État", etat),
      groupeDe(a.id)
        ? h(
            "p",
            {
              class: "cliquable si-lien",
              onclick: () => {
                sel = { type: "groupe", id: groupeDe(a.id).id };
                dessiner();
                panneau();
              },
            },
            "Dans le groupe « " + (groupeDe(a.id).nom || "Ensemble") + " »"
          )
        : null,
      h("h3", {}, "Bornes"),
      (() => {
        // bornes fixes : chacune de son côté, comme sur l'appareil réel (sinon le tracé choisit le côté)
        const cf = h("input", { type: "checkbox", checked: !!a.bornes_fixes });
        cf.addEventListener("change", () => {
          if (cf.checked) {
            const cotes = schCotesBornes(D);
            for (const b of a.bornes || []) if (!b.cote) b.cote = cotes[b.id] || "d";
          }
          a.bornes_fixes = cf.checked;
          changer();
        });
        return h(
          "label",
          {
            class: "case",
            title: "Chaque borne reste de son côté (gauche, droite, haut, bas), dans l'ordre de la liste, comme sur l'appareil",
          },
          cf,
          " Bornes à leur place réelle (côté fixe)"
        );
      })(),
      bornes,
      h(
        "div",
        { class: "si-boutons" },
        h(
          "button",
          {
            class: "btn petit",
            onclick: () => {
              a.bornes.push({ id: schId(), rep: String(a.bornes.length + 1), role: "", cable: "" });
              changer();
              const ins = cote.querySelectorAll(".si-bornes tbody tr:last-child input");
              if (ins[0]) ins[0].select();
            },
          },
          "+ Borne"
        )
      ),
      h("h3", {}, "Longueur max (notice)"),
      (a.longueurs || []).length ? longueurs : h("p", { class: "aide" }, "Ex. 100 m en SYT 1 paire, 300 m en câble bus 2×1 mm²."),
      h(
        "div",
        { class: "si-boutons" },
        h(
          "button",
          {
            class: "btn petit",
            onclick: () => {
              (a.longueurs = a.longueurs || []).push({ cable: "", m: "" });
              changer();
            },
          },
          "+ Longueur max"
        )
      ),
      liaisons.length ? h("h3", {}, "Liaisons") : null,
      liaisons.map(l => {
        const ici = l.a === a.id || (gr && l.a === gr.id),
          autre = schNomBout(D, ici ? l.b : l.a),
          c = schCable(l.cable);
        return h(
          "p",
          {
            class: "cliquable si-lien",
            onclick: () => {
              sel = { type: "liaison", id: l.id };
              dessiner();
              panneau();
            },
          },
          `${l.rep || "—"} → ${autre} (${c ? c.nom : "câble ?"})`
        );
      }),
      h("h3", {}, "Note"),
      note,
      h(
        "div",
        { class: "si-boutons" },
        h(
          "button",
          {
            class: "btn petit",
            onclick: () => {
              relier = { a: a.id };
              dessiner();
              zoneDessin.focus();
            },
          },
          "🔗 Relier à…"
        ),
        h("button", { class: "btn petit", onclick: () => dupliquerAppareil(a) }, "Dupliquer"),
        h("button", { class: "btn petit", onclick: () => enregistrerModele(a) }, "Enregistrer comme modèle…"),
        h("button", { class: "btn petit danger", onclick: () => supprimerSel() }, "Supprimer")
      )
    );
  }
  function panneauLiaison(l) {
    if (!l) return panneauResume();
    // (un bout peut être un groupe : ses bornes sont celles de tous ses appareils, repérées « PL1 L1 »)
    const A = { rep: schRepBout(D, l.a), nom: schNomBout(D, l.a), apps: schAppsBout(D, l.a) },
      B = { rep: schRepBout(D, l.b), nom: schNomBout(D, l.b), apps: schAppsBout(D, l.b) };
    const boiteAlertes = h("div", {});
    const chute = h("p", { class: "sous" });
    majAlertes = () => {
      const al = schAlertesLiaison(D, l);
      const c = schCable(l.cable);
      const fils = (l.fils || []).filter(f => f.ba || f.bb).length;
      remplirSi(
        boiteAlertes,
        c ? h("p", { class: "sous" }, `${fils} fil(s) utilisé(s) sur ${c.conducteurs} conducteurs`) : null,
        al.length
          ? h(
              "div",
              { class: "si-alertes" },
              al.map(a => h("p", {}, "⚠ " + a))
            )
          : h("p", { class: "si-ok" }, "✓ Aucune alerte")
      );
      const ch = schChute(l);
      chute.textContent = ch
        ? `Chute de tension : ${schFr(ch.du, 2)} V${ch.pc !== null ? " (" + schFr(ch.pc) + " %)" : ""}, câble ${c ? schFr(c.section, 2) + " mm²" : ""} aller et retour`
        : "";
    };
    const optBornes = (bout, val) => [
      h("option", { value: "" }, "—"),
      ...bout.apps.flatMap(ap =>
        (ap.bornes || []).map(b =>
          h(
            "option",
            { value: b.id, selected: b.id === val, title: b.role || "" },
            (bout.apps.length > 1 ? ap.rep + " " : "") + (b.rep || "?") + (b.role ? " (" + b.role + ")" : "")
          )
        )
      ),
    ];
    const cab = schCable(l.cable);
    const optConds = val => [
      h("option", { value: "" }, "—"),
      ...Array.from({ length: Math.max(cab ? cab.conducteurs : 0, (val ?? -1) + 1) }, (_, i) =>
        h(
          "option",
          { value: i, selected: i === val },
          schLibCond(cab, i) + (cab && cab.couleurs && cab.couleurs[i] ? " " + schLibCouleur(cab.couleurs[i]) : "")
        )
      ),
    ];
    const optCouleurs = val => [
      h("option", { value: "" }, "normée"),
      h(
        "optgroup",
        { label: "Couleur personnalisée" },
        SCH_COULEURS_PERSO.map(k => h("option", { value: k, selected: k === val }, schLibCouleur(k)))
      ),
    ];
    const fils = h(
      "table",
      { class: "si-table si-fils" },
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          [A.rep || "A", B.rep || "B", "Cond.", "Couleur", "Rep.", ""].map(t => h("th", {}, t))
        )
      ),
      h(
        "tbody",
        {},
        l.fils.map((f, i) => {
          const sa = h("select", {}, optBornes(A, f.ba)),
            sb = h("select", {}, optBornes(B, f.bb)),
            sk = h("select", { title: "Conducteur du câble (sa couleur normée)" }, optConds(f.cond)),
            sc = h("select", { title: "Couleur : normée (celle du conducteur) ou personnalisée" }, optCouleurs(f.couleur));
          sa.addEventListener("change", () => {
            f.ba = sa.value;
            changer(true);
          });
          sb.addEventListener("change", () => {
            f.bb = sb.value;
            changer(true);
          });
          const pastille = h("span", { class: "si-couleur" });
          const majPastille = () => {
            pastille.style.background = schFondCouleur(schCouleurFil(l, f));
            pastille.title = schLibCouleur(schCouleurFil(l, f));
          };
          majPastille();
          sk.addEventListener("change", () => {
            f.cond = sk.value === "" ? null : Number(sk.value);
            majPastille();
            changer(true);
          });
          sc.addEventListener("change", () => {
            f.couleur = sc.value;
            majPastille();
            changer(true);
          });
          return h(
            "tr",
            {},
            h("td", {}, sa),
            h("td", {}, sb),
            h("td", {}, sk),
            h("td", { style: "white-space:nowrap" }, pastille, sc),
            h("td", {}, texte(f, "rep", { style: "width:3.5em" })),
            h(
              "td",
              {},
              h(
                "button",
                {
                  class: "icone",
                  title: "Supprimer le fil",
                  onclick: () => {
                    l.fils.splice(i, 1);
                    changer();
                  },
                },
                "✕"
              )
            )
          );
        })
      )
    );
    const tension = texte(l, "tension", { inputmode: "decimal", style: "width:4em", list: "si-tensions" }, () => majAlertes());
    remplirSi(
      cote,
      h("h3", {}, "Liaison"),
      h("p", { class: "si-lien" }, `${A.nom}  ↔  ${B.nom}`),
      ligne("Repère", texte(l, "rep", { style: "width:6em" })),
      ligne(
        "Câble",
        choixCable(l.cable, null, v => {
          l.cable = v;
          dernierCable = v;
          // (couleurs d'origine du câble pour les fils qui n'en ont pas)
          // (chaque fil garde son conducteur : sa couleur devient celle du nouveau câble)
          changer();
        })
      ),
      ligne(
        "Longueur",
        h(
          "span",
          {},
          texte(l, "longueur", { inputmode: "decimal", style: "width:5em" }, () => majAlertes()),
          " m"
        )
      ),
      h("h3", {}, "Fils"),
      l.fils.length
        ? fils
        : h("p", { class: "aide" }, "Aucun fil : « + Fil », « Même repère », ou en multifilaire tirez d'une borne à l'autre."),
      h(
        "div",
        { class: "si-boutons" },
        h(
          "button",
          {
            class: "btn petit",
            onclick: () => {
              l.fils.push({ id: schId(), ba: "", bb: "", cond: condSuivant(l), couleur: "", rep: "" });
              changer();
            },
          },
          "+ Fil"
        ),
        h(
          "button",
          { class: "btn petit", title: "Relie L1–L1, +–+… : les bornes de même repère des deux côtés", onclick: () => autoFils(l) },
          "Même repère"
        )
      ),
      boiteAlertes,
      h("h3", {}, "Chute de tension (facultatif)"),
      ligne(
        "Courant",
        h(
          "span",
          {},
          texte(l, "courant", { inputmode: "decimal", style: "width:4em" }, () => majAlertes()),
          " A"
        )
      ),
      ligne("Tension", h("span", {}, tension, " V")),
      h(
        "datalist",
        { id: "si-tensions" },
        SCH_TENSIONS.map(t => h("option", { value: t }))
      ),
      chute,
      (() => {
        // plusieurs câbles entre les deux mêmes appareils : les réunir en un seul (fils repris)
        // (aussi les câbles d'un autre appareil du même groupe : même endroit, un seul câble suffit)
        const ga = schGroupe(D, l.a) || schGroupeDe(D, l.a),
          gb = schGroupe(D, l.b) || schGroupeDe(D, l.b),
          interne = ga && ga === gb,
          ea = schEndroit(D, l.a),
          eb = schEndroit(D, l.b);
        const autres = D.liaisons.filter(
          x =>
            x !== l &&
            ((x.a === l.a && x.b === l.b) ||
              (x.a === l.b && x.b === l.a) ||
              (!interne && ((ea.has(x.a) && eb.has(x.b)) || (eb.has(x.a) && ea.has(x.b)))))
        );
        if (!autres.length) return null;
        return h(
          "div",
          {},
          h("p", { class: "aide" }, `Ces appareils sont aussi reliés par ${autres.map(x => x.rep || "?").join(", ")}.`),
          h(
            "button",
            {
              class: "btn petit",
              title: "Un seul câble entre ces deux appareils, avec tous les fils",
              onclick: () => {
                for (const x of autres) {
                  const memeSens = x.a === l.a || x.b === l.b || (!(x.a === l.b || x.b === l.a) && ea.has(x.a));
                  for (const f of x.fils || []) {
                    const [fa, fb] = memeSens ? [f.ba, f.bb] : [f.bb, f.ba];
                    if (!l.fils.some(g => g.ba === fa && g.bb === fb)) l.fils.push({ ...f, ba: fa, bb: fb });
                  }
                  if (!schNum(l.longueur) && schNum(x.longueur)) l.longueur = x.longueur;
                }
                D.liaisons = D.liaisons.filter(x => !autres.includes(x));
                // (un bout dont les fils partent de plusieurs appareils du groupe devient le groupe)
                for (const [cle, k, gr] of [
                  ["a", "ba", ga],
                  ["b", "bb", gb],
                ])
                  if (!interne && gr && l[cle] !== gr.id && l.fils.some(f => !schBorneBout(D, l[cle], f[k]))) l[cle] = gr.id;
                changer();
              },
            },
            "Réunir en un seul câble"
          )
        );
      })(),
      h(
        "div",
        { class: "si-boutons" },
        h(
          "button",
          {
            class: "btn petit",
            title: "Un 2e câble entre ces deux appareils (ex. un coaxial en plus du SYT)",
            onclick: () => {
              const n = nouvelleLiaison(l.a, l.b);
              sel = { type: "liaison", id: n.id };
              changer();
            },
          },
          "+ Autre câble entre eux"
        ),
        h("button", { class: "btn petit danger", onclick: () => supprimerSel() }, "Supprimer la liaison")
      )
    );
    majAlertes();
  }

  /* --- impression : synoptique, multifilaire, nomenclature, avec cartouche --- */
  /* --- impression : choix des pages et du format (A4, A3, A3 en 2 A4, grand sur plusieurs A4 à coller) --- */
  function imprimer() {
    const o = Object.assign({ syn: true, multi: true, nomen: true, format: "a4l", cols: "auto", rows: "auto" }, D.impression || {});
    const corps = h("div", { class: "si-imp" });
    let vueApercu = null;
    const boutonsApercu = h("div", { class: "si-imp-ligne si-groupe", style: "gap:0" });
    const apercu = h("div", { class: "si-imp-apercu" }),
      info = h("p", { class: "sous", style: "margin:6px 0 0" });
    const caseP = (cle, lib) => {
      const c = h("input", { type: "checkbox", checked: !!o[cle] });
      c.addEventListener("change", () => {
        o[cle] = c.checked;
        rendre();
      });
      return h("label", { class: "case" }, c, " " + lib);
    };
    const selF = h(
      "select",
      { style: "width:auto" },
      Object.entries(SCH_FORMATS).map(([k, [, , lib]]) => h("option", { value: k, selected: k === o.format }, lib))
    );
    const choixN = (cle, lib) => {
      const s = h(
        "select",
        { style: "width:auto" },
        h("option", { value: "auto" }, "auto"),
        [1, 2, 3, 4, 5, 6].map(n => h("option", { value: n }, n))
      );
      s.value = String(o[cle]);
      s.addEventListener("change", () => {
        o[cle] = s.value === "auto" ? "auto" : Number(s.value);
        rendre();
      });
      return h("label", { style: "display:inline-flex;gap:6px;align-items:center" }, lib + " ", s);
    };
    const blocMulti = h(
      "div",
      { class: "si-imp-ligne" },
      choixN("cols", "Feuilles en largeur"),
      choixN("rows", "en hauteur"),
      h("span", { class: "sous" }, "(auto : texte lisible, environ 2,7 mm)")
    );
    selF.addEventListener("change", () => {
      o.format = selF.value;
      rendre();
    });
    function rendre() {
      blocMulti.style.display = o.format === "multi" ? "" : "none";
      const choisies = [o.syn && "synoptique", o.multi && "multifilaire"].filter(Boolean);
      if (!choisies.includes(vueApercu)) vueApercu = choisies[0] || null;
      const vue = vueApercu;
      boutonsApercu.replaceChildren(
        ...(choisies.length > 1
          ? choisies.map(v =>
              h(
                "button",
                {
                  class: "btn petit" + (v === vue ? " actif" : ""),
                  onclick: () => {
                    vueApercu = v;
                    rendre();
                  },
                },
                v === "synoptique" ? "Aperçu du synoptique" : "Aperçu du multifilaire"
              )
            )
          : [])
      );
      if (!vue) {
        apercu.replaceChildren(h("p", { class: "aide" }, o.nomen ? "Nomenclature seule (A4 portrait)." : "Aucune page choisie."));
        info.textContent = "";
        return;
      }
      const m = schMiseEnPage(D, vue, o);
      const f = schFeuilleSvg(D, p, vue, vue === "synoptique" ? "Synoptique" : "Schéma multifilaire", m, 1, 1);
      // traits de découpe des feuilles A4 sur l'aperçu
      let decoupe = "";
      for (let c = 1; c < m.cols; c++)
        decoupe += `<line x1="${c * (m.tw - 10) + 5}" y1="0" x2="${c * (m.tw - 10) + 5}" y2="${m.H}" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="4 3"/>`;
      for (let r = 1; r < m.rows; r++)
        decoupe += `<line x1="0" y1="${r * (m.th - 10) + 5}" x2="${m.W}" y2="${r * (m.th - 10) + 5}" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="4 3"/>`;
      apercu.innerHTML = f.replace("</svg>\n<!--fin-->", decoupe + "</svg>");
      // (aperçu : la feuille entière dans 780 × 400 px)
      const sv0 = apercu.firstElementChild,
        k = Math.min(780 / m.W, 400 / m.H);
      sv0.style.width = Math.round(m.W * k) + "px";
      sv0.style.height = Math.round(m.H * k) + "px";
      const nb = m.cols * m.rows;
      info.textContent =
        `Feuille ${Math.round(m.W)} × ${Math.round(m.H)} mm` +
        (m.tuiles ? (nb > 1 ? ` · ${nb} feuilles A4 à coller (1 cm de recouvrement)` : " · 1 feuille A4") : "") +
        ` · texte du dessin ≈ ${schFr(m.texte, 1)} mm` +
        (m.texte < 1.8 ? " : petit, prenez un format plus grand" : "");
    }
    corps.append(
      h(
        "div",
        { class: "si-imp-ligne" },
        h("b", {}, "Pages : "),
        caseP("syn", "Synoptique"),
        caseP("multi", "Multifilaire"),
        caseP("nomen", "Nomenclature")
      ),
      h("div", { class: "si-imp-ligne" }, h("b", {}, "Format : "), selF),
      blocMulti,
      boutonsApercu,
      apercu,
      info
    );
    rendre();
    ouvrirModale(
      "Imprimer le schéma",
      corps,
      [
        h("button", { class: "btn", onclick: fermerModale }, "Annuler"),
        h(
          "button",
          {
            class: "btn principal",
            onclick: () => {
              if (!o.syn && !o.multi && !o.nomen) return toast("Choisissez au moins une page.", true);
              D.impression = { ...o };
              changer(true);
              fermerModale();
              imprimerSchema(o);
            },
          },
          "Imprimer"
        ),
      ],
      { largeur: "min(860px, 96vw)" }
    );
  }
  function imprimerSchema(o) {
    const N = schNomenclature(D);
    const alertes = D.liaisons.flatMap(l => schAlertesLiaison(D, l).map(a => (l.rep ? l.rep + " : " : "") + a));
    const lesFils = D.liaisons.flatMap(l => {
      const c = schCable(l.cable);
      return (l.fils || []).map(f => {
        const xa = schBorneBout(D, l.a, f.ba),
          xb = schBorneBout(D, l.b, f.bb);
        return `<tr><td>${echapperHtml(l.rep || "")}</td><td>${echapperHtml(c ? c.nom : "")}</td><td>${echapperHtml(xa ? xa.a.rep + " " + xa.b.rep : "?")}</td><td>${echapperHtml(xb ? xb.a.rep + " " + xb.b.rep : "?")}</td><td>${echapperHtml([schLibCond(c, f.cond), schLibCouleur(schCouleurFil(l, f))].filter(Boolean).join(" · "))}</td><td>${echapperHtml(f.rep || "")}</td></tr>`;
      });
    });
    const vues = [o.syn && ["synoptique", "Synoptique"], o.multi && ["multifilaire", "Schéma multifilaire"]].filter(Boolean);
    const total = vues.length + (o.nomen ? 1 : 0);
    const tailles = new Map(); // (une page nommée par taille de feuille : mm « l h » -> nom)
    const nomPage = (l, ht) => {
      const k = l + "mm " + ht + "mm";
      if (!tailles.has(k)) tailles.set(k, "f" + tailles.size);
      return tailles.get(k);
    };
    const pages = [];
    vues.forEach(([vue, titre], k) => {
      const m = schMiseEnPage(D, vue, o);
      const f = schFeuilleSvg(D, p, vue, titre, m, k + 1, total).replace("\n<!--fin-->", "");
      if (!m.tuiles) {
        pages.push(`<section class="page" style="page:${nomPage(m.W, m.H)};width:${m.W}mm;height:${m.H}mm">${f}</section>`);
        return;
      }
      // feuilles A4 à coller : chacune montre sa part de la grande feuille, 1 cm en commun avec la voisine
      const portrait = m.tw < m.th;
      const [pl, ph] = portrait ? [210, 297] : [297, 210];
      const contenu = f.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
      let n = 0;
      for (let r = 0; r < m.rows; r++)
        for (let c = 0; c < m.cols; c++) {
          n++;
          const tx = c * (m.tw - 10),
            ty = r * (m.th - 10);
          let marques =
            m.cols * m.rows > 1
              ? `<text x="${tx + 2}" y="${ty + 3.5}" font-size="2.6" font-family="Arial" fill="#666">Feuille ${n} / ${m.cols * m.rows} (ligne ${r + 1}, colonne ${c + 1})</text>`
              : "";
          if (c < m.cols - 1)
            marques += `<line x1="${tx + m.tw - 0.2}" y1="${ty}" x2="${tx + m.tw - 0.2}" y2="${ty + m.th}" stroke="#666" stroke-width="0.3" stroke-dasharray="2 1.5"/><text x="${tx + m.tw - 1.5}" y="${ty + m.th - 2}" font-size="2.5" text-anchor="end" font-family="Arial">✂ couper ici</text>`;
          if (c > 0)
            marques += `<line x1="${tx + 10}" y1="${ty}" x2="${tx + 10}" y2="${ty + m.th}" stroke="#dc2626" stroke-width="0.3" stroke-dasharray="2 1.5"/><text x="${tx + 11}" y="${ty + m.th - 2}" font-size="2.5" font-family="Arial" fill="#dc2626">← bord de la feuille de gauche ici</text>`;
          if (r < m.rows - 1)
            marques += `<line x1="${tx}" y1="${ty + m.th - 0.2}" x2="${tx + m.tw}" y2="${ty + m.th - 0.2}" stroke="#666" stroke-width="0.3" stroke-dasharray="2 1.5"/><text x="${tx + m.tw - 2}" y="${ty + m.th - 1.5}" font-size="2.5" text-anchor="end" font-family="Arial">✂ couper ici</text>`;
          if (r > 0)
            marques += `<line x1="${tx}" y1="${ty + 10}" x2="${tx + m.tw}" y2="${ty + 10}" stroke="#dc2626" stroke-width="0.3" stroke-dasharray="2 1.5"/><text x="${tx + m.tw - 2}" y="${ty + 13}" font-size="2.5" text-anchor="end" font-family="Arial" fill="#dc2626">↑ bord de la feuille du dessus ici</text>`;
          pages.push(
            `<section class="page tuile" style="page:${nomPage(pl, ph)};width:${pl}mm;height:${ph}mm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${tx} ${ty} ${m.tw} ${m.th}" style="width:${m.tw}mm;height:${m.th}mm;display:block">${contenu}${marques}</svg></section>`
          );
        }
    });
    if (o.nomen) {
      const E2 = PARAMS.entreprise || {};
      const qui = [p.client_nom, p.document_numero && "Devis " + p.document_numero, (p.adresse || "").replace(/\n/g, ", ")]
        .filter(Boolean)
        .join(" · ");
      pages.push(`<section class="page nomen" style="page:${nomPage(210, 297)};width:210mm;height:297mm"><h1>Nomenclature</h1><div class="contenu">
        <h2>Câbles</h2><table class="liste"><tr><th>Câble</th><th>Longueur totale</th><th>Liaisons</th></tr>${N.cables
          .map(
            c =>
              `<tr><td>${echapperHtml(c.nom)}</td><td>${schFr(c.m)} m${c.sans ? " (+ " + c.sans + " sans longueur)" : ""}</td><td>${c.n}</td></tr>`
          )
          .join("")}</table>
        <h2>Appareils</h2><table class="liste"><tr><th>Qté</th><th>Appareil</th><th>État</th><th>Repères</th></tr>${N.appareils
          .map(
            a =>
              `<tr><td>${a.n}</td><td>${echapperHtml(a.nom)}</td><td>${schEtat(a.etat)[1]}</td><td>${echapperHtml(a.reps.join(", "))}</td></tr>`
          )
          .join("")}</table>
        ${N.ensembles.length ? `<h2>Ensembles</h2><table class="liste"><tr><th>Ensemble</th><th>Modules</th></tr>${N.ensembles.map(e => `<tr><td>${echapperHtml(e.nom)}</td><td>${echapperHtml(e.modules.map(a => a.rep + " " + a.nom).join(", "))}</td></tr>`).join("")}</table>` : ""}
        ${lesFils.length ? `<h2>Fils</h2><table class="liste"><tr><th>Liaison</th><th>Câble</th><th>De</th><th>À</th><th>Conducteur, couleur</th><th>Repère</th></tr>${lesFils.join("")}</table>` : ""}
        ${alertes.length ? `<h2>Alertes</h2>${alertes.map(a => `<p class="alerte">⚠ ${echapperHtml(a)}</p>`).join("")}` : ""}
        <p class="legende">${SCH_ETATS.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("")}</p></div>
        <table class="cartouche"><tr><td class="ent"><b>${echapperHtml(E2.nom || "")}</b><br>${echapperHtml([E2.telephone, E2.email].filter(Boolean).join(" · "))}</td>
        <td><b>${echapperHtml(p.nom || "Schéma")}</b> — Nomenclature<br>${echapperHtml(qui)}</td>
        <td class="date">${new Date().toLocaleDateString("fr-FR")}<br>Page ${total} / ${total}</td></tr></table></section>`);
    }
    const w = window.open("", "_blank");
    if (!w) {
      toast("Autorisez les fenêtres surgissantes pour imprimer.", true);
      return;
    }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${echapperHtml(p.nom || "Schéma")}</title><style>
      html, body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      ${[...tailles].map(([k, n]) => `@page ${n} { size: ${k}; margin: 0; }`).join("\n")}
      .page { box-sizing: border-box; overflow: hidden; page-break-after: always; break-after: page; } .page:last-child { page-break-after: auto; break-after: auto; }
      .page > svg { display: block; width: 100%; height: 100%; } .tuile { padding: 5mm; } .tuile > svg { width: auto; height: auto; }
      .nomen { padding: 10mm 12mm; display: flex; flex-direction: column; } .nomen .contenu { flex: 1; min-height: 0; overflow: hidden; }
      h1 { font-size: 16px; margin: 0 0 6px; } h2 { font-size: 13px; margin: 10px 0 4px; }
      table.liste { border-collapse: collapse; font-size: 11px; } table.liste td, table.liste th { border: 1px solid #999; padding: 2px 6px; text-align: left; }
      .cartouche { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; } .cartouche td { border: 1.5px solid #333; padding: 4px 8px; vertical-align: top; }
      .cartouche .ent { width: 30%; } .cartouche .date { width: 15%; text-align: right; }
      .alerte { color: #b45309; font-size: 12px; margin: 2px 0; } .legende span { margin-right: 14px; font-size: 11px; } .legende i { display: inline-block; width: 10px; height: 10px; margin-right: 4px; border-radius: 2px; }
      ${SCH_CSS_SVG}
      @media screen { body { background: #9ca3af; } .page { background: #fff; margin: 10px auto; box-shadow: 0 2px 8px rgba(0,0,0,.3); } }
    </style></head><body>${pages.join("")}<script>setTimeout(() => window.print(), 400);<\/script></body></html>`);
    w.document.close();
  }

  /* --- en-tête et barre d'outils --- */
  const nomE = h("input", {
    type: "text",
    class: "si-nom-schema",
    value: p.nom || "",
    style: "font-weight:600;flex:0 1 320px;min-width:160px",
  });
  nomE.addEventListener("change", () =>
    api("PUT", "/api/plans/" + p.id, { nom: nomE.value })
      .then(r => {
        p.modifie_le = r.modifie_le;
        p.nom = nomE.value;
      })
      .catch(erreur)
  );
  const infos = h("span", { class: "sous si-infos" });
  const majInfos = () => {
    infos.textContent =
      [p.client_nom, p.document_numero && "devis " + p.document_numero, (p.adresse || "").split("\n")[0]].filter(Boolean).join(" · ") ||
      (SCH_AUTONOME() ? "sans adresse" : "rattaché à aucun client ni devis");
  };
  majInfos();
  // (version autonome : ni clients ni devis, seulement l'adresse du chantier)
  const rattacher = SCH_AUTONOME()
    ? async () => {
        const t = await demanderTexte("Adresse du chantier :", p.adresse || "");
        if (t === null || t === undefined) return;
        const r = await api("PUT", "/api/plans/" + p.id, { adresse: t });
        p.adresse = t;
        p.modifie_le = r.modifie_le;
        majInfos();
      }
    : () => rattacherPlan(p, "Rattacher le schéma", majInfos);
  const boutonsVue = ["synoptique", "multifilaire"].map(v =>
    h(
      "button",
      {
        class: "btn" + (D.vue === v ? " actif" : ""),
        "data-vue": v,
        onclick: () => {
          D.vue = v;
          boutonsVue.forEach(b => b.classList.toggle("actif", b.dataset.vue === v));
          // (1re ouverture du multifilaire : les appareils gardent la place du synoptique, un peu plus espacés)
          if (v === "multifilaire")
            for (const a of D.appareils)
              if (a.mx === undefined) {
                a.mx = Math.round((a.x * 1.15) / SCH.GRILLE) * SCH.GRILLE;
                a.my = Math.round((a.y * 1.6) / SCH.GRILLE) * SCH.GRILLE;
              }
          changer(true);
        },
      },
      v === "synoptique" ? "Synoptique" : "Multifilaire"
    )
  );
  const boutonZoom = (t, k, aide) =>
    h(
      "button",
      {
        class: "btn petit si-zoom",
        title: aide,
        onclick: () => {
          zoom = k ? Math.max(0.4, Math.min(2.5, zoom * k)) : 1;
          dessiner();
        },
      },
      t
    );
  page = h(
    "div",
    { class: "fiche si-page" },
    h(
      "div",
      { class: "entete-fiche" },
      // (sur tablette : la barre tient sur une ligne, libellés courts — voir style.css « si-long »)
      h(
        "button",
        { class: "btn", title: "Retour à la liste des schémas", onclick: () => aller("schemas") },
        "←",
        h("span", { class: "si-long" }, " Schémas")
      ),
      nomE,
      h("span", { class: "puce-beta", title: "Module en cours d'écriture : à essayer, pas encore pour un vrai chantier" }, "ALPHA"),
      infos,
      h(
        "button",
        { class: "btn petit", onclick: () => rattacher().catch(erreur) },
        SCH_AUTONOME()
          ? "Adresse…"
          : [h("span", { class: "si-long" }, "Client, devis, adresse…"), h("span", { class: "si-court" }, "Client…")]
      ),
      h("span", { class: "espace" }),
      statut,
      h(
        "button",
        { class: "btn", title: "Imprimer", onclick: imprimer },
        h("span", { class: "si-court" }, "🖨"),
        h("span", { class: "si-long" }, "Imprimer…")
      ),
      h(
        "button",
        {
          class: "btn si-menu",
          title: "Exporter, dupliquer, supprimer",
          onclick: e => {
            const r = e.currentTarget.getBoundingClientRect();
            ouvrirMenuContextuel(r.right - 200, r.bottom + 4, [
              {
                libelle: "💾 Exporter ce schéma (fichier)",
                action: async () => {
                  try {
                    await enregistrer();
                    await exporterSchemasFichier([p.id]);
                  } catch (er) {
                    erreur(er);
                  }
                },
              },
              {
                libelle: "⧉ Dupliquer",
                action: async () => {
                  try {
                    await enregistrer();
                    const n = await api("POST", `/api/plans/${p.id}/dupliquer`, {});
                    aller("schemas", { id: n.id });
                  } catch (er) {
                    erreur(er);
                  }
                },
              },
              "-",
              {
                libelle: "🗑 Supprimer…",
                danger: true,
                action: async () => {
                  if (!(await demanderOui("Supprimer ce schéma ?"))) return;
                  clearTimeout(minuterie);
                  avantDeQuitter = null;
                  await api("DELETE", "/api/plans/" + p.id);
                  aller("schemas");
                },
              },
            ]);
          },
        },
        "☰"
      )
    ),
    h(
      "div",
      { class: "si-outils" },
      h(
        "button",
        {
          class: "btn principal",
          onclick: e => {
            const r = e.currentTarget.getBoundingClientRect();
            ouvrirMenuContextuel(r.left, r.bottom + 4, entreesModeles(null));
          },
        },
        "+ Appareil ▾"
      ),
      h(
        "button",
        {
          class: "btn",
          title: "Cliquez ensuite sur les deux appareils à relier par un câble",
          onclick: () => {
            relier = relier ? null : { a: null };
            dessiner();
            zoneDessin.focus();
          },
        },
        "🔗 Relier"
      ),
      h("span", { class: "si-groupe" }, boutonsVue),
      boutonZoom("−", 1 / 1.25, "Réduire"),
      boutonZoom("100 %", 0, "Taille normale"),
      boutonZoom("+", 1.25, "Agrandir"),
      h("button", { class: "btn petit", title: "Annuler (Ctrl+Z)", onclick: () => revenir(-1) }, "↶"),
      h("button", { class: "btn petit", title: "Rétablir (Ctrl+Y)", onclick: () => revenir(1) }, "↷"),
      h("span", { class: "espace" }),
      h("button", { class: "btn petit", onclick: () => fenetreCablesSchema(() => (dessiner(), panneau())) }, "Câbles…"),
      h(
        "button",
        {
          class: "btn petit si-bascule-panneau",
          title: "Afficher ou masquer le panneau des réglages (plus de place pour le dessin)",
          onclick: () => {
            panneauVu = !page.classList.contains("sans-panneau") ? false : true;
            majPanneau();
          },
        },
        "▤ Réglages"
      ),
      h(
        "button",
        { class: "btn bouton-aide-plan si-aide", title: "Mode d'emploi et raccourcis clavier (touche ?)", onclick: () => aideSchema() },
        "?"
      ),
      aideZone
    ),
    h("div", { class: "si-grille" }, zoneDessin, cote)
  );
  zone.append(page);
  // (le dessin va jusqu'au bas de la fenêtre : la page ne défile pas, la barre d'outils reste visible)
  const ajusterHauteur = () => {
    if (!document.body.contains(zoneDessin)) return window.removeEventListener("resize", ajusterHauteur);
    const haut = zoneDessin.getBoundingClientRect().top + (document.scrollingElement || document.documentElement).scrollTop;
    zoneDessin.style.height = Math.max(260, window.innerHeight - haut - 30) + "px";
    cote.style.maxHeight = SCH_ETROIT() ? "" : zoneDessin.style.height;
  };
  window.addEventListener("resize", ajusterHauteur);
  dessiner();
  panneau();
  requestAnimationFrame(ajusterHauteur);
  if (arg && arg.rattacher) rattacher().catch(erreur);
}
/* ---------- impression : formats et feuille dessinée en mm ---------- */
/** [largeur, hauteur (mm), libellé] ; a3x2 : A3 sur deux A4 à coller (surface imprimable, 1 cm en commun),
 *  multi : grande feuille sur plusieurs A4 à coller */
const SCH_FORMATS = {
  a4l: [297, 210, "A4 paysage"],
  a4p: [210, 297, "A4 portrait"],
  a3l: [420, 297, "A3 paysage"],
  a3p: [297, 420, "A3 portrait"],
  a3x2: [390, 287, "A3 en 2 feuilles A4 (à coller)"],
  multi: [0, 0, "Grand : sur plusieurs feuilles A4 (à coller)"],
};
const SCH_MM_LISIBLE = 0.26; // (mm par point du dessin : texte de 10,5 points ≈ 2,7 mm)
/** taille de la feuille d'une vue : { W, H, tuiles, cols, rows, tw, th, texte (hauteur du texte du dessin, mm) } */
function schMiseEnPage(D, vue, o) {
  const s = schDessiner(D, vue, null, {});
  const [, , vw, vh] = s.getAttribute("viewBox").split(" ").map(Number);
  const zone = (W, H) => [W - 16, H - 46]; // (marges, titre et cartouche)
  let W,
    H,
    tuiles = false,
    cols = 1,
    rows = 1,
    tw = 0,
    th = 0;
  if (o.format === "a3x2") {
    [W, H] = SCH_FORMATS.a3x2;
    tuiles = true;
    cols = 2;
    tw = 200;
    th = 287;
  } else if (o.format === "multi") {
    tuiles = true;
    tw = 287;
    th = 200;
    const besoinW = vw * SCH_MM_LISIBLE + 16,
      besoinH = vh * SCH_MM_LISIBLE + 46;
    cols = o.cols === "auto" ? Math.min(6, Math.max(1, Math.ceil((besoinW - 10) / (tw - 10)))) : Number(o.cols) || 1;
    rows = o.rows === "auto" ? Math.min(6, Math.max(1, Math.ceil((besoinH - 10) / (th - 10)))) : Number(o.rows) || 1;
    W = cols * tw - (cols - 1) * 10;
    H = rows * th - (rows - 1) * 10;
  } else [W, H] = SCH_FORMATS[o.format] || SCH_FORMATS.a4l;
  const [zw, zh] = zone(W, H);
  const k = Math.min(zw / vw, zh / vh);
  return { W, H, tuiles, cols, rows, tw, th, texte: 10.5 * k };
}
/** la feuille d'une vue en SVG (unités : mm) : titre, dessin ajusté, cartouche */
function schFeuilleSvg(D, p, vue, titre, m, n, total) {
  const { W, H } = m;
  const s = schDessiner(D, vue, null, {});
  s.querySelectorAll("[data-fond]").forEach(x => x.remove());
  const vb = s.getAttribute("viewBox");
  const E2 = PARAMS.entreprise || {};
  const qui = [p.client_nom, p.document_numero && "Devis " + p.document_numero, (p.adresse || "").replace(/\n/g, ", ")]
    .filter(Boolean)
    .join(" · ");
  const ch = 18,
    cy = H - 8 - ch,
    c1 = 8 + (W - 16) * 0.3,
    c2 = 8 + (W - 16) * 0.85;
  const t = (x, y, txt, plus) => `<text x="${x}" y="${y}" font-family="Arial" ${plus || 'font-size="3"'}>${echapperHtml(txt)}</text>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:${W}mm;height:${H}mm;background:#fff">` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>` +
    t(8, 14, titre, 'font-size="5.5" font-weight="700"') +
    `<svg class="si-svg" x="8" y="18" width="${W - 16}" height="${cy - 22}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${s.innerHTML}</svg>` +
    `<g fill="none" stroke="#333" stroke-width="0.4"><rect x="8" y="${cy}" width="${W - 16}" height="${ch}"/><line x1="${c1}" y1="${cy}" x2="${c1}" y2="${cy + ch}"/><line x1="${c2}" y1="${cy}" x2="${c2}" y2="${cy + ch}"/></g>` +
    t(10, cy + 6, E2.nom || "", 'font-size="3.4" font-weight="700"') +
    t(10, cy + 11, [E2.telephone, E2.email].filter(Boolean).join(" · ")) +
    t(c1 + 2, cy + 6, (p.nom || "Schéma") + " — " + titre, 'font-size="3.4" font-weight="700"') +
    t(c1 + 2, cy + 11, qui) +
    t(W - 10, cy + 6, new Date().toLocaleDateString("fr-FR"), 'font-size="3" text-anchor="end"') +
    t(W - 10, cy + 11, `Page ${n} / ${total}`, 'font-size="3" text-anchor="end"') +
    "</svg>\n<!--fin-->"
  );
}
/** mode d'emploi du module (bouton « ? » et touche ?), comme celui des plans */
function aideSchema() {
  const P = [
    [
      "Appareils",
      [
        "« + Appareil » : un modèle générique, un de vos modèles, ou un bloc générique avec le nombre de bornes voulu. Aussi par double-clic ou clic droit dans le dessin, à l'endroit voulu.",
        "Cliquez sur un appareil pour le régler à droite : nom, repère, sorte, état (neuf, existant, à remplacer, en panne), bornes (repère, rôle, câble imposé), longueur max selon la notice.",
        "« Enregistrer comme modèle… » : l'appareil et ses bornes, pour vos prochains schémas.",
        "Les bornes des modèles génériques sont des exemples : adaptez-les à la notice du fabricant.",
      ],
    ],
    [
      "Câbles et fils",
      [
        "« 🔗 Relier » puis les deux appareils : un câble (C1, C2…). S'ils sont déjà reliés, le câble existant est repris.",
        "Dans le câble : type, longueur, puis les fils (« + Fil », ou « Même repère » : L1–L1, +–+… d'un coup).",
        "En multifilaire : cliquez une borne, puis l'autre (ou tirez de l'une à l'autre) pour poser un fil.",
        "Un 2e câble entre deux appareils (ex. un coaxial en plus) : « + Autre câble entre eux ». Plusieurs câbles : « Réunir en un seul câble ».",
        "« Câbles… » : la liste des câbles (conducteurs, section, couleurs des fils).",
      ],
    ],
    [
      "Vues et tracé",
      [
        "Synoptique : les appareils et les câbles. Multifilaire : chaque fil, de borne à borne. Les appareils se placent séparément dans chaque vue.",
        "Le tracé est automatique, à angle droit, en contournant les appareils. Plusieurs fils sur une même borne : un trait avec un point de jonction, ou une borne traversée (affichée des deux côtés).",
        "Groupes : Maj + clic sur plusieurs appareils, puis « Grouper » : un cadre pointillé avec un nom. Glisser le cadre déplace l'ensemble.",
      ],
    ],
    [
      "Alertes et impression",
      [
        "En rouge : plus de fils que de conducteurs, longueur max dépassée, câble différent de celui demandé par une borne, chute de tension (si courant et tension sont indiqués).",
        "Sans rien de choisi, le panneau de droite donne les alertes, le métré des câbles et la liste des appareils.",
        "« Imprimer… » : synoptique, multifilaire et nomenclature, en A4 paysage, avec un cartouche.",
      ],
    ],
    [
      "Clavier et souris",
      [
        "Glisser : déplacer un appareil (grille de 10). Maj + clic : choisir plusieurs appareils.",
        "Suppr : effacer l'objet choisi (sur un cadre de groupe : dégrouper).",
        "Ctrl+Z / Ctrl+Y : annuler / rétablir. Échap : annuler un fil ou une liaison en cours.",
        "− / 100 % / + : taille du dessin. ? : ce mode d'emploi.",
      ],
    ],
  ];
  ouvrirModale(
    "Schémas interphone / portail : mode d'emploi",
    h(
      "div",
      { class: "si-aide-texte" },
      h("p", { class: "aide", style: "margin-top:0" }, "Module en cours d'écriture (alpha) : à essayer, le dessin peut encore changer."),
      // (flatMap : h() n'aplatit qu'un niveau de listes)
      P.flatMap(([t, l]) => [
        h("h4", {}, t),
        h(
          "ul",
          {},
          l.map(x => h("li", {}, x))
        ),
      ]),
      SCH_AUTONOME()
        ? null
        : h(
            "p",
            { style: "margin:8px 0 0" },
            h(
              "a",
              { href: "aide/index.html#schémas-interphone--portail-alpha", target: "_blank" },
              "📖 Documentation complète du module Schémas"
            )
          )
    ),
    [h("button", { class: "btn principal", onclick: fermerModale }, "Fermer")],
    { largeur: "min(720px, 94vw)" }
  );
}
/** styles du dessin (repris tels quels dans la page d'impression) */
const SCH_CSS_SVG = `
  .si-svg text { font-family: Arial, sans-serif; }
  .si-rep { font-size: 12px; font-weight: 700; fill: #1f2430; } .si-nom { font-size: 11px; fill: #1f2430; }
  .si-cat { font-size: 9.5px; fill: #687082; } .si-borne { font-size: 10.5px; font-weight: 700; fill: #1f2430; }
  .si-role { font-size: 9px; fill: #687082; } .si-pastille { fill: #fff; stroke: #334155; stroke-width: 1.4; }
  .si-etiq { font-size: 10.5px; fill: #1f2430; paint-order: stroke; stroke: #fff; stroke-width: 3px; }
  .si-etiq.alerte { fill: #dc2626; font-weight: 700; } .si-etiq2 { font-size: 9.5px; fill: #687082; paint-order: stroke; stroke: #fff; stroke-width: 3px; }
  .si-jonction { fill: #1f2430; } .si-pastille-prise { fill: transparent; cursor: crosshair; }
  @media (pointer: coarse) { .si-pastille-prise { r: 14px; } .si-pastille { r: 6px; } }
  .si-pastille.attente { fill: #facc15; stroke: #b45309; stroke-width: 2; }
  .si-cadre { fill: none; stroke: #475569; stroke-width: 1.4; stroke-dasharray: 7 5; }
  .si-cadre-prise { fill: none; stroke: transparent; stroke-width: 12; }
  .si-cadre-fond { fill: #fff; } .si-cadre-nom { font-size: 11px; font-weight: 700; fill: #475569; }
  .si-ensemble.sel .si-cadre { stroke: #2d4ea2; stroke-width: 2.4; } .si-ensemble.sel .si-cadre-nom { fill: #2d4ea2; }
  .si-rep-fil { font-size: 8.5px; fill: #334155; paint-order: stroke; stroke: #fff; stroke-width: 2.5px; }
`;
