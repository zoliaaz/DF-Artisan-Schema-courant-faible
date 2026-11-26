/* Schémas interphone / portail — version autonome du module de DF artisan.
 * Pas de serveur : les appels api(…) de base.js / schemas.js sont servis ici, et les schémas sont gardés dans le
 * navigateur (IndexedDB, sinon stockage local), avec enregistrement / ouverture en fichier. Le reste du code est
 * celui de DF artisan, recopié tel quel par outils/fabriquer_schemas_web.py. */
"use strict";

const STOCKAGE = (() => {
  const ouvrir = () =>
    new Promise((ok, ko) => {
      const r = indexedDB.open("schemas-interphone", 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("plans", { keyPath: "id" });
        r.result.createObjectStore("divers");
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
  let base = null,
    sansIdb = false;
  const op = async (magasin, mode, f) => {
    const t = (base || (base = await ouvrir())).transaction(magasin, mode),
      s = t.objectStore(magasin);
    return new Promise((ok, ko) => {
      const r = f(s);
      t.oncomplete = () => ok(r && r.result);
      t.onerror = () => ko(t.error);
      t.onabort = () => ko(t.error || new Error("Enregistrement impossible (stockage du navigateur plein ?)"));
    });
  };
  // repli : page ouverte par un double-clic (file://) dans un navigateur qui y refuse IndexedDB → stockage local
  const lireLS = cle => {
    try {
      return JSON.parse(localStorage.getItem("schemas-interphone-" + cle) || "{}");
    } catch (e) {
      return {};
    }
  };
  const ecrireLS = (cle, v) => {
    try {
      localStorage.setItem("schemas-interphone-" + cle, JSON.stringify(v));
    } catch (e) {
      throw new Error("Plus de place pour enregistrer dans ce navigateur : enregistrez vos schémas en fichier.");
    }
  };
  const repli = {
    tous: async () => Object.values(lireLS("plans")),
    lire: async id => lireLS("plans")[id],
    ecrire: async p => ecrireLS("plans", { ...lireLS("plans"), [p.id]: p }),
    effacer: async id => {
      const t = lireLS("plans");
      delete t[id];
      ecrireLS("plans", t);
    },
    lireDivers: async cle => lireLS("divers")[cle],
    ecrireDivers: async (cle, v) => ecrireLS("divers", { ...lireLS("divers"), [cle]: v }),
  };
  const idb = {
    tous: () => op("plans", "readonly", s => s.getAll()),
    lire: id => op("plans", "readonly", s => s.get(id)),
    ecrire: p => op("plans", "readwrite", s => s.put(p)),
    effacer: id => op("plans", "readwrite", s => s.delete(id)),
    lireDivers: cle => op("divers", "readonly", s => s.get(cle)),
    ecrireDivers: (cle, v) => op("divers", "readwrite", s => s.put(v, cle)),
  };
  const choisir = async () => {
    if (sansIdb) return repli;
    try {
      if (!window.indexedDB) throw new Error();
      base = base || (await ouvrir());
      return idb;
    } catch (e) {
      sansIdb = true;
      return repli;
    }
  };
  const via =
    nom =>
    async (...a) =>
      (await choisir())[nom](...a);
  return Object.fromEntries(["tous", "lire", "ecrire", "effacer", "lireDivers", "ecrireDivers"].map(n => [n, via(n)]));
})();

const maintenantISO = () => {
  const d = new Date(),
    z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
};
const PARAMS_DEFAUT = {
  general: { module_electricien: true, module_schemas: true, raccourcis_boutons: true },
  entreprise: {},
  schemas: {},
  plans: {},
  catalogue: {},
  devis: {},
  factures: {},
};
const fusion = (a, b) => {
  // comme le serveur : les objets se complètent, le reste remplace
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) fusion(a[k], v);
    else if (v === null) delete a[k];
    else a[k] = v;
  }
  return a;
};
const lireParams = async () => fusion(JSON.parse(JSON.stringify(PARAMS_DEFAUT)), (await STOCKAGE.lireDivers("parametres")) || {});
const sansDonnees = p => {
  const l = { ...p };
  delete l.donnees;
  return l;
};
const nouvelId = async () => {
  const n = ((await STOCKAGE.lireDivers("dernier_id")) || 0) + 1;
  await STOCKAGE.ecrireDivers("dernier_id", n);
  return n;
};

/** les appels au serveur de DF artisan, servis dans le navigateur */
api = async function (methode, url, corps) {
  // eslint-disable-line no-global-assign
  const u = new URL(url, location.href),
    chemin = u.pathname.replace(/^.*?(\/api\/)/, "/api/"),
    q = Object.fromEntries(u.searchParams);
  let m;
  if (chemin === "/api/parametres") {
    if (methode === "GET") return lireParams();
    await STOCKAGE.ecrireDivers("parametres", fusion((await STOCKAGE.lireDivers("parametres")) || {}, corps || {}));
    return lireParams();
  }
  if (chemin === "/api/plans" && methode === "GET") {
    const l = (await STOCKAGE.tous()).filter(p => !q.genre || (p.genre || "schema") === q.genre);
    return l.sort((a, b) => (b.modifie_le || "").localeCompare(a.modifie_le || "")).map(sansDonnees);
  }
  if (chemin === "/api/plans" && methode === "POST") {
    const p = {
      id: await nouvelId(),
      nom: (corps && corps.nom) || "Schéma",
      genre: "schema",
      adresse: (corps && corps.adresse) || "",
      client_id: null,
      document_id: null,
      client_nom: "",
      document_numero: "",
      donnees: (corps && corps.donnees) || {},
      cree_le: maintenantISO(),
      modifie_le: maintenantISO(),
    };
    await STOCKAGE.ecrire(p);
    return p;
  }
  if ((m = chemin.match(/^\/api\/plans\/(\d+)$/))) {
    const id = Number(m[1]),
      p = await STOCKAGE.lire(id);
    if (!p) throw new Error("Schéma introuvable.");
    if (methode === "GET") return p;
    if (methode === "DELETE") {
      await STOCKAGE.effacer(id);
      return { ok: true };
    }
    for (const k of ["nom", "adresse", "donnees"]) if (corps && k in corps) p[k] = corps[k];
    p.modifie_le = maintenantISO();
    await STOCKAGE.ecrire(p);
    return p;
  }
  if ((m = chemin.match(/^\/api\/plans\/(\d+)\/dupliquer$/))) {
    const p = await STOCKAGE.lire(Number(m[1]));
    const n = {
      ...JSON.parse(JSON.stringify(p)),
      id: await nouvelId(),
      nom: p.nom + " (copie)",
      cree_le: maintenantISO(),
      modifie_le: maintenantISO(),
    };
    await STOCKAGE.ecrire(n);
    return n;
  }
  if (/^\/api\/(clients|documents)(\/|$)/.test(chemin)) return methode === "GET" && !/\/\d+$/.test(chemin) ? [] : {};
  if (chemin === "/api/sante") return { ok: true };
  throw new Error("Pas disponible dans la version autonome des schémas.");
};

/* ---------- enregistrer / ouvrir des fichiers de schémas : exporterSchemasFichier / importerSchemasFichier de
   schemas.js, les mêmes que dans DF artisan (les fichiers passent de l'un à l'autre) ---------- */
/* ---------- démarrage ---------- */
const SECTIONS = { schemas: (z, a) => sectionSchemas(z, a) };
document.querySelectorAll("#nav button[data-section]").forEach(b =>
  b.addEventListener("click", () => {
    document.body.classList.remove("menu-ouvert");
    aller("schemas");
  })
);
document.getElementById("nouveau-schema").addEventListener("click", () => nouveauSchema({}, false).catch(erreur));
document.getElementById("exporter").addEventListener("click", () => exporterSchemasFichier().catch(erreur));
document.getElementById("importer").addEventListener("click", () =>
  importerSchemasFichier(async () => {
    await chargerParams();
    aller("schemas");
  })
);
// retours (bugs, idées) : la page « issues » du dépôt GitHub qui publie le module ; ailleurs, le lien est caché
(() => {
  const l = document.getElementById("lien-retours"),
    m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname || "");
  if (!l) return;
  if (!m) return void (l.style.display = "none");
  const premier = location.pathname.split("/").filter(Boolean)[0] || "",
    depot = premier && !premier.includes(".") ? premier : m[1] + ".github.io";
  l.href = "https://github.com/" + m[1] + "/" + depot + "/issues";
})();
// installer comme une application (Android, Chrome, Edge : la demande du navigateur ; sinon, la marche à suivre)
let demandeInstallation = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  demandeInstallation = e;
});
(() => {
  const b = document.getElementById("installer-appli");
  if ((window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true) b.style.display = "none";
  b.addEventListener("click", async () => {
    if (demandeInstallation) {
      demandeInstallation.prompt();
      demandeInstallation = null;
      return;
    }
    ouvrirModale(
      "Installer l'application",
      h(
        "ul",
        { style: "margin:0;padding-left:20px;line-height:1.6" },
        h("li", {}, h("b", {}, "Android (Chrome) : "), "menu ⋮, puis « Installer l'application » (ou « Ajouter à l'écran d'accueil »)."),
        h("li", {}, h("b", {}, "iPhone, iPad (Safari) : "), "bouton Partager, puis « Sur l'écran d'accueil »."),
        h("li", {}, h("b", {}, "Ordinateur (Chrome, Edge) : "), "l'icône d'installation à droite de la barre d'adresse.")
      ),
      [h("button", { class: "btn principal", onclick: fermerModale }, "Fermer")]
    );
  });
})();
// nouveautés (nouveautes.md, à côté de la page) ; un point tant que celles de cette version n'ont pas été vues
(() => {
  const b = document.getElementById("nouveautes"),
    v = window.VERSION_SCHEMAS || "";
  let vue = "";
  try {
    vue = localStorage.getItem("schemas-nouveautes-vues") || "";
  } catch {
    /* */
  }
  if (v && vue !== v) b.classList.add("non-vu");
  b.addEventListener("click", async () => {
    let t = "";
    try {
      const r = await fetch("nouveautes.md", { cache: "no-cache" });
      if (r.ok) t = await r.text();
    } catch {
      /* */
    }
    const esc = x => x.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const corps = h("div", { class: "nouveautes-liste" });
    corps.innerHTML = t.trim()
      ? t
          .split(/\n\s*\n/)
          .map(p =>
            /^##\s/.test(p)
              ? "<h2>" + esc(p.replace(/^##\s+/, "")) + "</h2>"
              : "<ul>" +
                p
                  .split("\n")
                  .map(x => "<li>" + esc(x.replace(/^\s*[-*]\s+/, "")) + "</li>")
                  .join("") +
                "</ul>"
          )
          .join("")
      : "<p>Liste des nouveautés indisponible (voir le fichier nouveautes.md du dossier).</p>";
    ouvrirModale("Nouveautés" + (v ? " — version " + v : ""), corps, [
      h("button", { class: "btn principal", onclick: fermerModale }, "Fermer"),
    ]);
    b.classList.remove("non-vu");
    try {
      if (v) localStorage.setItem("schemas-nouveautes-vues", v);
    } catch {
      /* */
    }
  });
})();
// nouvelle version en ligne : version.json comparé à celle de la page ; bandeau « Recharger » (schémas gardés)
(() => {
  const v = window.VERSION_SCHEMAS;
  if (!v || location.protocol === "file:") return;
  let bandeau = null;
  const verifier = async () => {
    if (bandeau) return;
    try {
      const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
      const n = r.ok ? (await r.json()).version : "";
      if (!n || n === v) return;
      bandeau = h(
        "div",
        { class: "bandeau-maj", role: "status" },
        h("span", {}, "🔄 Une nouvelle version des schémas est disponible (" + n + ")."),
        h("button", { class: "btn principal petit", onclick: () => setTimeout(() => location.reload(), 1200) }, "Recharger la page"),
        h("span", { class: "sous" }, "Vos schémas sont gardés."),
        h("button", { class: "btn petit", title: "Plus tard", onclick: () => bandeau.classList.add("cache") }, "✕")
      );
      document.body.append(bandeau);
    } catch {
      /* (hors connexion : rien) */
    }
  };
  setTimeout(verifier, 3000);
  setInterval(verifier, 30 * 60 * 1000);
})();
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
(async () => {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    await chargerParams();
    await aller("schemas");
  } catch (e) {
    erreur(e);
  }
})();
