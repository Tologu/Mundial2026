// ====================================================================
// 0. GESTIÓN DE LOCAL STORAGE (PERSISTENCIA DE DATOS MULTI-USUARIO)
// ====================================================================

// --- REFERENCIA DE CONTRASEÑAS (solo para el desarrollador) ---
// Mundial2026  ->  78d84535
// Tomas2026    ->  bd9de6e7    Miguel2026   ->  851091c
// Sofia2026    ->  136ce531    Inma2026     ->  fcb3a3e8
// Manolo2026   ->  54fa0acd    Martina2026  ->  50897f8f
// Adri2026     ->  9add415d    Fuen2026     ->  ddd34d1b
// Isa2026      ->  a2b56118    Jose2026     ->  1e4188d0
// Maria2026    ->  7aa6775     Moi2026      ->  40c70d88
// Alba2026     ->  dcdce14d    Enrique2026  ->  48c76af2
// OvejaBandolera -> 29dae08e

/** Genera hash djb2 de una cadena (para comparación segura de contraseñas). */
function ph(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) ^ str.charCodeAt(i);
        h = h >>> 0;
    }
    return h.toString(16);
}

// --- Detección de Perfil y Configuración ---
let storageKey;
let passwordReiniciar;
const esPaginaPartidos = window.location.pathname.includes('partidos.html');
const CONTRASENA_CAMBIO_PERFIL = "29dae08e";
const REGEX_PERFIL = /perfil-(\w+)\.html/; // Compilar regex una sola vez

// Obtener la parte del nombre del archivo de la URL (ej: 'perfil-tomas')
const pathName = window.location.pathname;

// Agregar clase 'perfil-page' al body si estamos en un perfil (para deshabilitar responsive)
if (REGEX_PERFIL.test(pathName)) {
    document.documentElement.classList.add('perfil-page');
}

let pronosticosOficialesCache = null;

let firebaseDisponible = false;
let firebaseDb;

function inicializarFirebase() {
    try {
        if (!window.firebaseConfig) return;
        if (!window.firebase || !window.firebase.initializeApp) return;
        if (!window.firebase.firestore) return;

        if (!window.firebase.apps || window.firebase.apps.length === 0) {
            window.firebase.initializeApp(window.firebaseConfig);
        }
        firebaseDb = window.firebase.firestore();
        firebaseDisponible = true;
    } catch (e) {
        console.error(e);
        firebaseDisponible = false;
    }
}

inicializarFirebase();

async function firebaseLeerPronosticos(docId) {
    const snap = await firebaseDb.collection('pronosticos').doc(docId).get();
    const data = snap.exists ? snap.data() : {};
    return (data && data.pronosticos) ? data.pronosticos : {};
}

async function firebaseGuardarPronosticos(docId, pronosticos) {
    await firebaseDb.collection('pronosticos').doc(docId).set(
        {
            pronosticos,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
    );
}

async function firebaseBorrarPronosticos(docId) {
    await firebaseDb.collection('pronosticos').doc(docId).delete();
}

// Obtener el match del perfil
const perfilMatch = pathName.match(REGEX_PERFIL);
const perfilNombre = perfilMatch ? perfilMatch[1] : null;

// Mapa de configuración para todos los perfiles
const perfilesConfig = {
    // Tu perfil (partidos.html)
    partidos: { key: 'pronosticosMundial', password: '78d84535'  },
    
    // Perfiles de Jugadores
    tomas: { key: 'pronosticosMundial_Tomas', password: 'bd9de6e7' },
    miguel: { key: 'pronosticosMundial_Miguel', password: '851091c' },
    sofia: { key: 'pronosticosMundial_Sofia', password: '136ce531' },
    inma: { key: 'pronosticosMundial_Inma', password: 'fcb3a3e8' },
    manolo: { key: 'pronosticosMundial_Manolo', password: '54fa0acd' },
    martina: { key: 'pronosticosMundial_Martina', password: '50897f8f' },
    adri: { key: 'pronosticosMundial_Adri', password: '9add415d' },
    fuen: { key: 'pronosticosMundial_Fuen', password: 'ddd34d1b' },
    isa: { key: 'pronosticosMundial_Isa', password: 'a2b56118' },
    jose: { key: 'pronosticosMundial_Jose', password: '1e4188d0' },
    maria: { key: 'pronosticosMundial_Maria', password: '7aa6775' },
    moi: { key: 'pronosticosMundial_Moi', password: '40c70d88' },
    alba: { key: 'pronosticosMundial_Alba', password: 'dcdce14d' },
    enrique: { key: 'pronosticosMundial_Enrique', password: '48c76af2' },
    // Añade más perfiles aquí si es necesario
};

const DOC_ID_OFICIALES = 'oficiales';

// Mapa global de participantes (nombre visible -> slug)
const PARTICIPANTES = {
    'Tomás': 'tomas',
    'Miguel': 'miguel',
    'Sofía': 'sofia',
    'Inma': 'inma',
    'Manolo': 'manolo',
    'Martina': 'martina',
    'Adri': 'adri',
    'Fuen': 'fuen',
    'Isa': 'isa',
    'Jose': 'jose',
    'María': 'maria',
    'Moi': 'moi',
    'Alba': 'alba',
    'Enrique': 'enrique'
};

const DOC_ID_PARTICIPANTES = {
    tomas: 'tomas',
    miguel: 'miguel',
    sofia: 'sofia',
    inma: 'inma',
    manolo: 'manolo',
    martina: 'martina',
    adri: 'adri',
    fuen: 'fuen',
    isa: 'isa',
    jose: 'jose',
    maria: 'maria',
    moi: 'moi',
    alba: 'alba',
    enrique: 'enrique'
};

function obtenerStorageKeyParaDocId(docId) {
    if (docId === DOC_ID_OFICIALES) return perfilesConfig.partidos.key;
    const config = perfilesConfig[docId];
    return config ? config.key : perfilesConfig.partidos.key;
}

function obtenerPasswordParaDocId(docId) {
    if (docId === DOC_ID_OFICIALES) return perfilesConfig.partidos.password;
    const config = perfilesConfig[docId];
    return config ? config.password : perfilesConfig.partidos.password;
}

let docIdActual = null;
let edicionHabilitada = true;

if (perfilNombre) {
    // Si la URL coincide con 'perfil-XXX.html'
    const config = perfilesConfig[perfilNombre];
    if (config) {
        storageKey = config.key;
        passwordReiniciar = config.password;
        docIdActual = DOC_ID_PARTICIPANTES[perfilNombre];
    } else {
        // Fallback si el nombre del perfil existe pero no está en la configuración
        console.error(`Configuración no encontrada para el perfil: ${perfilNombre}`);
        storageKey = perfilesConfig.partidos.key;
        passwordReiniciar = perfilesConfig.partidos.password;
    }
} else if (pathName.includes('partidos.html')) {
     // Configuración de "Mis Pronósticos"
     storageKey = perfilesConfig.partidos.key;
     passwordReiniciar = perfilesConfig.partidos.password;
     docIdActual = DOC_ID_OFICIALES;
} else {
    // Fallback por defecto (ej. si estamos en index.html, aunque no debería interactuar)
    storageKey = 'pronosticosMundial';
    passwordReiniciar = '78d84535';
}

/**
 * Carga los pronósticos guardados en localStorage para el perfil actual.
 * @returns {object} Los pronósticos cargados o un objeto vacío.
 */
function cargarPronosticos() {
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : {};
}

// Inicializar pronosticosConfirmados con los datos guardados
let pronosticosConfirmados = cargarPronosticos(); 

async function cargarPronosticosAsync(docId) {
    if (firebaseDisponible) {
        return await firebaseLeerPronosticos(docId);
    }
    return cargarPronosticos();
}

async function cargarPronosticosOficialesAsync() {
    if (pronosticosOficialesCache) return pronosticosOficialesCache;
    pronosticosOficialesCache = await cargarPronosticosPorDocId(DOC_ID_OFICIALES);
    return pronosticosOficialesCache;
}

async function guardarPronosticosAsync(docId, pronosticos) {
    if (firebaseDisponible) {
        await firebaseGuardarPronosticos(docId, pronosticos);
        return;
    }
    localStorage.setItem(storageKey, JSON.stringify(pronosticos));
}

async function borrarPronosticosAsync(docId) {
    if (firebaseDisponible) {
        await firebaseBorrarPronosticos(docId);
    }
    // Limpiar también localStorage (cache local) para cualquier docId
    const key = obtenerStorageKeyParaDocId(docId);
    localStorage.removeItem(key);
}

async function cargarPronosticosPorDocId(docId) {
    if (firebaseDisponible) {
        return await firebaseLeerPronosticos(docId);
    }
    const key = (docId === DOC_ID_OFICIALES)
        ? perfilesConfig.partidos.key
        : `pronosticosMundial_${docId.charAt(0).toUpperCase()}${docId.slice(1)}`;
    return cargarPronosticosPorClave(key);
}

// ====================================================================
// 0.1 UTILIDADES PARA PUNTUACIÓN ENTRE PERFILES (INDEX)
// ====================================================================

function cargarPronosticosPorClave(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : {};
}

function obtenerSignoResultado(golesLocal, golesVisitante) {
    if (golesLocal > golesVisitante) return 'L';
    if (golesLocal < golesVisitante) return 'V';
    return 'E';
}

// Devuelve el conjunto de equipos presentes en una ronda eliminatoria concreta
function obtenerEquiposPorRonda(pronosticos, ronda, soloFinal = false) {
    const set = new Set();
    Object.entries(pronosticos).forEach(([clave, dato]) => {
        if (dato.ronda !== ronda) return;
        if (soloFinal && clave !== 'M104') return; // solo la final, no 3er puesto
        const { equipoLocal, equipoVisitante } = dato;
        if (equipoLocal && equipoLocal !== 'TBD' && !equipoLocal.startsWith('Tercero')) {
            set.add(equipoLocal);
        }
        if (equipoVisitante && equipoVisitante !== 'TBD' && !equipoVisitante.startsWith('Tercero')) {
            set.add(equipoVisitante);
        }
    });
    return set;
}

function calcularPuntajePerfil(pronosticosOficiales, pronosticosPerfil) {
    let puntos = 0;
    let aciertos = 0;
    let exactos = 0;

    // 1) FASE DE GRUPOS: resultado exacto (5) o signo (2)
    Object.entries(pronosticosOficiales).forEach(([clave, oficial]) => {
        const jugador = pronosticosPerfil[clave];
        if (!jugador) return;

        if (clave.includes(' vs ')) {
            if (typeof oficial.local !== 'number' || typeof oficial.visitante !== 'number') return;
            if (typeof jugador.local !== 'number' || typeof jugador.visitante !== 'number') return;

            const esExacto = oficial.local === jugador.local && oficial.visitante === jugador.visitante;
            if (esExacto) {
                puntos += 5;
                aciertos += 1;
                exactos += 1;
                return;
            }

            const signoOficial = obtenerSignoResultado(oficial.local, oficial.visitante);
            const signoJugador = obtenerSignoResultado(jugador.local, jugador.visitante);
            if (signoOficial === signoJugador) {
                puntos += 2;
                aciertos += 1;
            }
        }
    });

    // 2) ELIMINATORIAS: presencia por ronda
    const rondasElim = [
        { ronda: 'R32', puntos: 2 },
        { ronda: 'R16', puntos: 3 },
        { ronda: 'R8',  puntos: 4 },
        { ronda: 'R4',  puntos: 5 },
        { ronda: 'Final', puntos: 6 }
    ];

    rondasElim.forEach(({ ronda, puntos: pts }) => {
        const soloFinal = ronda === 'Final';
        const oficiales = obtenerEquiposPorRonda(pronosticosOficiales, ronda, soloFinal);
        const jugador = obtenerEquiposPorRonda(pronosticosPerfil, ronda, soloFinal);

        oficiales.forEach(equipo => {
            if (jugador.has(equipo)) {
                puntos += pts;
                aciertos += 1;
            }
        });
    });


    return { puntos, aciertos, exactos };
}

async function obtenerAcertantesExactos(nombrePartido, useAsync = false) {
    const pronosticosOficiales = useAsync 
        ? await cargarPronosticosOficialesAsync() 
        : cargarPronosticosPorClave(perfilesConfig.partidos.key);
    
    const oficial = pronosticosOficiales[nombrePartido];
    if (!oficial || typeof oficial.local !== 'number' || typeof oficial.visitante !== 'number') {
        return [];
    }

    if (useAsync) {
        const resultados = await Promise.all(
            Object.entries(PARTICIPANTES).map(async ([nombreVisible, slug]) => {
                const docId = DOC_ID_PARTICIPANTES[slug];
                if (!docId) return null;
                const pronosticosJugador = await cargarPronosticosPorDocId(docId);
                const jug = pronosticosJugador[nombrePartido];
                if (!jug) return null;
                if (jug.local === oficial.local && jug.visitante === oficial.visitante) {
                    return nombreVisible;
                }
                return null;
            })
        );
        return resultados.filter(Boolean);
    } else {
        return Object.entries(PARTICIPANTES).reduce((acc, [nombreVisible, slug]) => {
            const configPerfil = perfilesConfig[slug];
            if (!configPerfil) return acc;
            const pronosticosJugador = cargarPronosticosPorClave(configPerfil.key);
            const jug = pronosticosJugador[nombrePartido];
            if (!jug) return acc;
            if (jug.local === oficial.local && jug.visitante === oficial.visitante) {
                acc.push(nombreVisible);
            }
            return acc;
        }, []);
    }
}

// Alias para compatibilidad hacia atrás
async function obtenerAcertantesExactosAsync(nombrePartido) {
    return obtenerAcertantesExactos(nombrePartido, true);
}

async function actualizarClasificacionIndex(useAsync = false) {
    const tabla = document.getElementById('tabla-clasificacion');
    if (!tabla) return;

    const pronosticosOficiales = useAsync
        ? await cargarPronosticosOficialesAsync()
        : cargarPronosticosPorClave(perfilesConfig.partidos.key);

    let clasificacion;
    
    if (useAsync) {
        clasificacion = await Promise.all(
            Object.entries(PARTICIPANTES).map(async ([nombreVisible, slug]) => {
                const docId = DOC_ID_PARTICIPANTES[slug];
                const pronosticosJugador = docId ? await cargarPronosticosPorDocId(docId) : {};
                const { puntos, aciertos } = calcularPuntajePerfil(pronosticosOficiales, pronosticosJugador);
                return { nombreVisible, slug, puntos, aciertos };
            })
        );
    } else {
        clasificacion = Object.entries(PARTICIPANTES).map(([nombreVisible, slug]) => {
            const config = perfilesConfig[slug];
            const pronosticosJugador = config ? cargarPronosticosPorClave(config.key) : {};
            const { puntos, aciertos } = calcularPuntajePerfil(pronosticosOficiales, pronosticosJugador);
            return { nombreVisible, slug, puntos, aciertos };
        });
    }

    clasificacion.sort((a, b) => {
        if (a.puntos !== b.puntos) return b.puntos - a.puntos;
        if (a.aciertos !== b.aciertos) return b.aciertos - a.aciertos;
        return a.nombreVisible.localeCompare(b.nombreVisible, 'es', { sensitivity: 'base' });
    });

    const tbody = tabla.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    clasificacion.forEach((item, index) => {
        const posicion = index + 1;
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${posicion}</td>
            <td><a href="perfil-${item.slug}.html">${item.nombreVisible}</a></td>
            <td>${item.puntos}</td>
            <td>${item.aciertos}</td>
        `;
        tbody.appendChild(fila);
    });
}

// Alias para compatibilidad hacia atrás
async function actualizarClasificacionIndexAsync() {
    return actualizarClasificacionIndex(true);
}

// ====================================================================
// 0.2 MARCADO DE ACIERTOS EN PERFILES (VISUAL)
// ====================================================================

async function marcarAciertosPerfil(useAsync = false) {
    if (!perfilNombre) return; // Solo para páginas de perfil

    const pronosticosOficiales = useAsync 
        ? await cargarPronosticosOficialesAsync()
        : (pronosticosOficialesCache || cargarPronosticosPorClave(perfilesConfig.partidos.key));

    const marcarPartido = (card, oficial, jugador) => {
        // Limpiar badge previa
        card.querySelector('.badge-puntos')?.remove();

        const equipoLocal = card.querySelector('.equipo-local')?.textContent?.trim();
        const equipoVisitante = card.querySelector('.equipo-visitante')?.textContent?.trim();
        if (!equipoLocal || !equipoVisitante) return;

        card.classList.remove('acierto-exacto', 'acierto-signo');

        if (!oficial || !jugador) return;
        if (typeof oficial.local !== 'number' || typeof oficial.visitante !== 'number') return;
        if (typeof jugador.local !== 'number' || typeof jugador.visitante !== 'number') return;

        const esExacto = oficial.local === jugador.local && oficial.visitante === jugador.visitante;
        if (esExacto) {
            card.classList.add('acierto-exacto');
            const badge = document.createElement('span');
            badge.className = 'badge-puntos badge-exacto';
            badge.textContent = '+5';
            card.prepend(badge);
            return;
        }

        const signoOficial = obtenerSignoResultado(oficial.local, oficial.visitante);
        const signoJugador = obtenerSignoResultado(jugador.local, jugador.visitante);
        if (signoOficial === signoJugador) {
            card.classList.add('acierto-signo');
            const badge = document.createElement('span');
            badge.className = 'badge-puntos badge-signo';
            badge.textContent = '+2';
            card.prepend(badge);
        }
    };

    document.querySelectorAll('.partido-card').forEach(card => {
        const equipoLocal = card.querySelector('.equipo-local')?.textContent?.trim();
        const equipoVisitante = card.querySelector('.equipo-visitante')?.textContent?.trim();
        if (!equipoLocal || !equipoVisitante) return;

        const nombrePartido = `${equipoLocal} vs ${equipoVisitante}`;
        const oficial = pronosticosOficiales[nombrePartido];
        const jugador = pronosticosConfirmados[nombrePartido];

        marcarPartido(card, oficial, jugador);
    });
}

// Alias para compatibilidad hacia atrás
async function marcarAciertosPerfilAsync() {
    return marcarAciertosPerfil(true);
}

/**
 * Guarda el objeto actual de pronósticos en localStorage.
 */
function guardarPronosticos() {
    guardarPronosticosAsync(docIdActual || DOC_ID_OFICIALES, pronosticosConfirmados).catch(e => {
        console.error(e);
        localStorage.setItem(storageKey, JSON.stringify(pronosticosConfirmados));
    });
}

// ====================================================================
// 1. ESTRUCTURA DE DATOS (ACTUALIZADA)
// ====================================================================

// Estructura de equipos por grupo
const gruposData = [
    { nombre: "A", equipos: ["México", "Sudáfrica", "Corea del Sur", "Rep. Checa"] },
    { nombre: "B", equipos: ["Canadá", "Bosnia", "Catar", "Suiza"] },
    { nombre: "C", equipos: ["Brasil", "Marruecos", "Haití", "Escocia"] },
    { nombre: "D", equipos: ["Estados Unidos", "Paraguay", "Australia", "Turquía"] },
    { nombre: "E", equipos: ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"] },
    { nombre: "F", equipos: ["Países Bajos", "Japón", "Suecia", "Túnez"] },
    { nombre: "G", equipos: ["Bélgica", "Egipto", "Irán", "Nueva Zelanda"] },
    { nombre: "H", equipos: ["España", "Cabo Verde", "Arabia Saudita", "Uruguay"] },
    { nombre: "I", equipos: ["Francia", "Senegal", "Irak", "Noruega"] },
    { nombre: "J", equipos: ["Argentina", "Argelia", "Austria", "Jordania"] },
    { nombre: "K", equipos: ["Portugal", "RD Congo", "Uzbekistán", "Colombia"] },
    { nombre: "L", equipos: ["Inglaterra", "Croacia", "Ghana", "Panamá"] },
];

// Calendario de partidos por grupo (solo enfrentamiento y jornada)
function obtenerPartidosDelGrupo(nombreGrupo) {
    const calendario = {
        "A": [
          { jornada: 1, local: "México", visitante: "Sudáfrica" }, { jornada: 1, local: "Corea del Sur", visitante: "Rep. Checa" },
          { jornada: 2, local: "Rep. Checa", visitante: "Sudáfrica" }, { jornada: 2, local: "México", visitante: "Corea del Sur" },
          { jornada: 3, local: "Rep. Checa", visitante: "México" }, { jornada: 3, local: "Sudáfrica", visitante: "Corea del Sur" }
        ],
        "B": [
          { jornada: 1, local: "Canadá", visitante: "Bosnia" }, { jornada: 1, local: "Catar", visitante: "Suiza" },
          { jornada: 2, local: "Suiza", visitante: "Bosnia" }, { jornada: 2, local: "Canadá", visitante: "Catar" },
          { jornada: 3, local: "Suiza", visitante: "Canadá" }, { jornada: 3, local: "Bosnia", visitante: "Catar" }
        ],
        "C": [
          { jornada: 1, local: "Brasil", visitante: "Marruecos" }, { jornada: 1, local: "Haití", visitante: "Escocia" },
          { jornada: 2, local: "Escocia", visitante: "Marruecos" }, { jornada: 2, local: "Brasil", visitante: "Haití" },
          { jornada: 3, local: "Escocia", visitante: "Brasil" }, { jornada: 3, local: "Marruecos", visitante: "Haití" }
        ],
        "D": [
          { jornada: 1, local: "Estados Unidos", visitante: "Paraguay" }, { jornada: 1, local: "Australia", visitante: "Turquía" },
          { jornada: 2, local: "Turquía", visitante: "Paraguay" }, { jornada: 2, local: "Estados Unidos", visitante: "Australia" },
          { jornada: 3, local: "Turquía", visitante: "Estados Unidos" }, { jornada: 3, local: "Paraguay", visitante: "Australia" }
        ],
        "E": [
          { jornada: 1, local: "Alemania", visitante: "Curazao" }, { jornada: 1, local: "Costa de Marfil", visitante: "Ecuador" },
          { jornada: 2, local: "Alemania", visitante: "Costa de Marfil" }, { jornada: 2, local: "Ecuador", visitante: "Curazao" },
          { jornada: 3, local: "Ecuador", visitante: "Alemania" }, { jornada: 3, local: "Curazao", visitante: "Costa de Marfil" }
        ],
        "F": [
          { jornada: 1, local: "Países Bajos", visitante: "Japón" }, { jornada: 1, local: "Suecia", visitante: "Túnez" },
          { jornada: 2, local: "Países Bajos", visitante: "Suecia" }, { jornada: 2, local: "Túnez", visitante: "Japón" },
          { jornada: 3, local: "Japón", visitante: "Suecia" }, { jornada: 3, local: "Túnez", visitante: "Países Bajos" }
        ],
        "G": [
          { jornada: 1, local: "Irán", visitante: "Nueva Zelanda" }, { jornada: 1, local: "Bélgica", visitante: "Egipto" },
          { jornada: 2, local: "Bélgica", visitante: "Irán" }, { jornada: 2, local: "Nueva Zelanda", visitante: "Egipto" },
          { jornada: 3, local: "Egipto", visitante: "Irán" }, { jornada: 3, local: "Nueva Zelanda", visitante: "Bélgica" }
        ],
        "H": [
          { jornada: 1, local: "España", visitante: "Cabo Verde" }, { jornada: 1, local: "Arabia Saudita", visitante: "Uruguay" },
          { jornada: 2, local: "España", visitante: "Arabia Saudita" }, { jornada: 2, local: "Uruguay", visitante: "Cabo Verde" },
          { jornada: 3, local: "Cabo Verde", visitante: "Arabia Saudita" }, { jornada: 3, local: "Uruguay", visitante: "España" }
        ],
        "I": [
          { jornada: 1, local: "Francia", visitante: "Senegal" }, { jornada: 1, local: "Irak", visitante: "Noruega" },
          { jornada: 2, local: "Francia", visitante: "Irak" }, { jornada: 2, local: "Noruega", visitante: "Senegal" },
          { jornada: 3, local: "Noruega", visitante: "Francia" }, { jornada: 3, local: "Senegal", visitante: "Irak" }
        ],
        "J": [
          { jornada: 1, local: "Argentina", visitante: "Argelia" }, { jornada: 1, local: "Austria", visitante: "Jordania" },
          { jornada: 2, local: "Argentina", visitante: "Austria" }, { jornada: 2, local: "Jordania", visitante: "Argelia" },
          { jornada: 3, local: "Argelia", visitante: "Austria" }, { jornada: 3, local: "Jordania", visitante: "Argentina" }
        ],
        "K": [
          { jornada: 1, local: "Portugal", visitante: "RD Congo" }, { jornada: 1, local: "Uzbekistán", visitante: "Colombia" },
          { jornada: 2, local: "Portugal", visitante: "Uzbekistán" }, { jornada: 2, local: "Colombia", visitante: "RD Congo" },
          { jornada: 3, local: "Colombia", visitante: "Portugal" }, { jornada: 3, local: "RD Congo", visitante: "Uzbekistán" }
        ],
        "L": [
          { jornada: 1, local: "Inglaterra", visitante: "Croacia" }, { jornada: 1, local: "Ghana", visitante: "Panamá" },
          { jornada: 2, local: "Inglaterra", visitante: "Ghana" }, { jornada: 2, local: "Panamá", visitante: "Croacia" },
          { jornada: 3, local: "Panamá", visitante: "Inglaterra" }, { jornada: 3, local: "Croacia", visitante: "Ghana" }
        ]
    };
    return calendario[nombreGrupo] || [];
}

// Estructura que define cómo se encadenan los partidos (Llave Ganadora -> Llave Siguiente)
// Basado en la nomenclatura Mxx del cuadro oficial del Mundial 2026.
const encadenamientoBracket = {
    // Dieciseisavos de Final (R32 - M73 a M88)
    // NOTA: No necesita mapeo aquí ya que usa los clasificados de grupo
    R32: {},
    
    // Octavos de Final (R16 - M89 a M96) - ACTUALIZADO
    R16: [
        // Ganador partido 74 v Ganador partido 77
        { llave: 89, equipo1Ganador: 'M74', equipo2Ganador: 'M77' }, 
        
        // Ganador partido 73 v Ganador partido 75
        { llave: 90, equipo1Ganador: 'M73', equipo2Ganador: 'M75' },
        
        // Ganador partido 76 v Ganador partido 78
        { llave: 91, equipo1Ganador: 'M76', equipo2Ganador: 'M78' },
        
        // Ganador partido 79 v Ganador partido 80
        { llave: 92, equipo1Ganador: 'M79', equipo2Ganador: 'M80' },
        
        // Ganador partido 83 v Ganador partido 84
        { llave: 93, equipo1Ganador: 'M83', equipo2Ganador: 'M84' },
        
        // Ganador partido 81 v Ganador partido 82
        { llave: 94, equipo1Ganador: 'M81', equipo2Ganador: 'M82' },
        
        // Ganador partido 86 v Ganador partido 88
        { llave: 95, equipo1Ganador: 'M86', equipo2Ganador: 'M88' },
        
        // Ganador partido 85 v Ganador partido 87
        { llave: 96, equipo1Ganador: 'M85', equipo2Ganador: 'M87' },
    ],
    
    // Cuartos de Final (R8 - M97 a M100) - ACTUALIZADO
    R8: [
        // Ganador partido 89 v Ganador partido 90
        { llave: 97, equipo1Ganador: 'M89', equipo2Ganador: 'M90' },
        
        // Ganador partido 93 v Ganador partido 94
        { llave: 98, equipo1Ganador: 'M93', equipo2Ganador: 'M94' },
        
        // Ganador partido 91 v Ganador partido 92
        { llave: 99, equipo1Ganador: 'M91', equipo2Ganador: 'M92' },
        
        // Ganador partido 95 v Ganador partido 96
        { llave: 100, equipo1Ganador: 'M95', equipo2Ganador: 'M96' },
    ],
    
    // Semifinales (R4 - M101 a M102) - ACTUALIZADO
    R4: [
        // Ganador partido 97 v Ganador partido 98
        { llave: 101, equipo1Ganador: 'M97', equipo2Ganador: 'M98' },
        
        // Ganador partido 99 v Ganador partido 100
        { llave: 102, equipo1Ganador: 'M99', equipo2Ganador: 'M100' },
    ],
    
    // Final y 3er Puesto (M103 y M104) - ACTUALIZADO
    Final: [
        // Partido 103 (3er Puesto): Perdedor M101 v Perdedor M102
        { llave: 103, nombre: '3er Puesto', equipo1Ganador: 'M101-P', equipo2Ganador: 'M102-P' }, 
        
        // Partido 104 (Final): Ganador M101 v Ganador M102
        { llave: 104, nombre: 'Final', equipo1Ganador: 'M101-G', equipo2Ganador: 'M102-G' },  
    ]
};

// 2. GENERACIÓN DE ESTRUCTURA Y PESTAÑAS (TABS)
// ====================================================================

function generarEstructuraPartidos() {
    const contenedorGrupos = document.getElementById("contenedor-grupos");
    const contenedorTabs = document.getElementById("group-tabs");

    // Sub-contenedores para grupos y eliminatorias
    const tabsGruposDiv = document.createElement('div');
    tabsGruposDiv.className = 'tabs-grupos';
    const tabsElimDiv = document.createElement('div');
    tabsElimDiv.className = 'tabs-eliminatorias';
    contenedorTabs.appendChild(tabsGruposDiv);
    contenedorTabs.appendChild(tabsElimDiv);

    // 1. GENERAR PESTAÑAS Y CONTENIDO DE GRUPOS
    gruposData.forEach((grupo, index) => {
        const idGrupo = `grupo-${grupo.nombre.toLowerCase()}`;
        
        // Crear botón de pestaña (Tab)
        const button = document.createElement('button');
        button.className = 'tab-button';
        button.innerHTML = `Grupo ${grupo.nombre}<span class="tab-equipos">${grupo.equipos.join(' · ')}</span>`;
        button.dataset.target = idGrupo;
        
        // Crear contenido del grupo (Section)
        const section = document.createElement('section');
        section.className = 'grupo';
        section.id = idGrupo;
        
        let htmlContent = `<h3>Grupo ${grupo.nombre}</h3>`;
        
        const partidosDelGrupo = obtenerPartidosDelGrupo(grupo.nombre); 

        partidosDelGrupo.forEach(p => {
          const nombrePartido = `${p.local} vs ${p.visitante}`;
          const resultadoGuardado = pronosticosConfirmados[nombrePartido];
          const valorLocal = resultadoGuardado ? resultadoGuardado.local : '';
          const valorVisitante = resultadoGuardado ? resultadoGuardado.visitante : '';
          const btnConfirmarDisabled = (resultadoGuardado) ? 'disabled' : '';
          const btnCambiarDisabled = (resultadoGuardado) ? '' : 'disabled';
          const checkConfirmadoHtml = esPaginaPartidos
            ? `<span class="confirmado-check ${resultadoGuardado ? 'visible' : ''}" aria-hidden="true">✔</span>`
            : '';


          htmlContent += `
            <div class="partido-card">
              <div class="info-partido">
                  <span class="jornada">Jornada ${p.jornada}</span>
              </div>
              <div class="equipos">
                <span class="equipo-local">${p.local}</span>
                <input type="number" class="marcador" min="0" placeholder="0" value="${valorLocal}">
                <span class="vs">vs</span>
                <input type="number" class="marcador" min="0" placeholder="0" value="${valorVisitante}">
                <span class="equipo-visitante">${p.visitante}</span>
              </div>
              <div class="acciones">
                ${checkConfirmadoHtml}<button class="btn-confirmar" ${btnConfirmarDisabled}>Confirmar</button>
                <button class="btn-cambiar" ${btnCambiarDisabled}>Cambiar</button>
                ${esPaginaPartidos ? `<button class="btn-acertantes-exactos" data-partido="${nombrePartido}">Acertantes Exactos</button>` : ''}
              </div>
            </div>
          `;
        });

        section.innerHTML = htmlContent;
        
        tabsGruposDiv.appendChild(button);
        contenedorGrupos.appendChild(section);

        // Activar el primer grupo (Grupo A) por defecto al cargar
        if (index === 0) {
            button.classList.add('active');
            section.classList.add('active');
        }
    });

    // 2. GENERAR PESTAÑAS DE RONDAS ELIMINATORIAS
    const rondasEliminatorias = [
        { id: 'ronda-r32', nombre: '🏆 Dieciseisavos', funcion: generarDieciseisavos, ronda: 'R32' },
        { id: 'ronda-r16', nombre: '⏩ Octavos', funcion: () => generarRonda('R16'), ronda: 'R16' },
        { id: 'ronda-r8', nombre: '⭐ Cuartos', funcion: () => generarRonda('R8'), ronda: 'R8' },
        { id: 'ronda-r4', nombre: '✨ Semis', funcion: () => generarRonda('R4'), ronda: 'R4' },
        { id: 'ronda-final', nombre: '🥇 Final', funcion: () => generarRonda('Final'), ronda: 'Final' },
    ];
    
    rondasEliminatorias.forEach(rondaData => {
        const buttonRonda = document.createElement('button');
        buttonRonda.className = 'tab-button';
        buttonRonda.textContent = rondaData.nombre;
        buttonRonda.dataset.target = rondaData.id;
        tabsElimDiv.appendChild(buttonRonda);

        const sectionRonda = document.createElement('section');
        sectionRonda.className = 'grupo';
        sectionRonda.id = rondaData.id;
        // Creamos un div específico para el contenido del bracket de cada ronda
        sectionRonda.innerHTML = `<h3>${rondaData.nombre}</h3><div id="bracket-contenido-${rondaData.ronda}"></div>`;
        contenedorGrupos.appendChild(sectionRonda);
    });


    // 3. LÓGICA DE CAMBIO DE PESTAÑA (Event Listener)
    contenedorTabs.addEventListener('click', (event) => {
        if (event.target.classList.contains('tab-button')) {
            const targetId = event.target.dataset.target;

            // Desactivar todos los botones y grupos
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.grupo').forEach(group => group.classList.remove('active'));

            // Activar el botón clicado y el contenido correspondiente
            event.target.classList.add('active');
            document.getElementById(targetId).classList.add('active');
            
            // Si es una pestaña de eliminatoria, renderizamos el bracket
            const rondaActiva = rondasEliminatorias.find(r => r.id === targetId);
            if (rondaActiva) {
                 const partidos = rondaActiva.funcion();
                 // Pasamos el contenedor específico y el nombre de la ronda
                 renderizarRondaEliminatoria(partidos, rondaActiva.ronda); 
            }
        }
    });

    // Después de renderizar la estructura, marcar aciertos en perfiles
    if (firebaseDisponible) {
        marcarAciertosPerfilAsync().catch(e => console.error(e));
    } else {
        marcarAciertosPerfil();
    }

    // Renderizar clasificaciones iniciales de grupos (una vez existe el DOM)
    gruposData.forEach(grupo => {
        const clasificacionInicial = calcularClasificacion(grupo.nombre, grupo.equipos, pronosticosConfirmados);
        renderizarClasificacion(grupo, clasificacionInicial);
    });
}


// ====================================================================
// 3. FUNCIÓN DE CÁLCULO DE CLASIFICACIÓN

// ====================================================================

function calcularClasificacion(nombreGrupo, equiposGrupo, resultados) {
    const clasificacion = equiposGrupo.map(equipo => ({
        equipo: equipo,
        pj: 0, pg: 0, pe: 0, pp: 0,
        gf: 0, gc: 0, dg: 0,
        ptos: 0
    }));

    // Procesar los resultados del grupo
    Object.entries(resultados).forEach(([clavePartido, marcador]) => {
        if (!clavePartido.includes(' vs ')) return;
        if (!marcador || marcador.grupo !== nombreGrupo) return;
        if (typeof marcador.local !== 'number' || typeof marcador.visitante !== 'number') return;

        const [equipoLocal, equipoVisitante] = clavePartido.split(' vs ').map(s => s.trim());
        const local = clasificacion.find(e => e.equipo === equipoLocal);
        const visitante = clasificacion.find(e => e.equipo === equipoVisitante);
        if (!local || !visitante) return;

        const gl = marcador.local;
        const gv = marcador.visitante;

        local.pj += 1;
        visitante.pj += 1;

        local.gf += gl;
        local.gc += gv;
        visitante.gf += gv;
        visitante.gc += gl;

        if (gl > gv) {
            local.pg += 1;
            visitante.pp += 1;
            local.ptos += 3;
        } else if (gl < gv) {
            visitante.pg += 1;
            local.pp += 1;
            visitante.ptos += 3;
        } else {
            local.pe += 1;
            visitante.pe += 1;
            local.ptos += 1;
            visitante.ptos += 1;
        }
    });

    clasificacion.forEach(e => {
        e.dg = e.gf - e.gc;
    });

    // Ordenar: Puntos > Diferencia de Goles > Goles a Favor
    clasificacion.sort((a, b) => {
        if (a.ptos !== b.ptos) return b.ptos - a.ptos;
        if (a.dg !== b.dg) return b.dg - a.dg;
        return b.gf - a.gf;
    });

    return clasificacion;
}


function calcularMejoresTercerosParaResultados(resultados) {
    const tercerosLugares = [];

    gruposData.forEach(grupo => {
        const clasificacionGrupo = calcularClasificacion(grupo.nombre, grupo.equipos, resultados);
        if (clasificacionGrupo.length >= 3) {
            const tercerLugar = clasificacionGrupo[2];
            tercerosLugares.push({
                grupo: grupo.nombre,
                equipo: tercerLugar.equipo,
                ptos: tercerLugar.ptos,
                dg: tercerLugar.dg,
                gf: tercerLugar.gf,
                pj: tercerLugar.pj
            });
        }
    });

    // Clasificar: Ptos > DG > GF > PJ
    tercerosLugares.sort((a, b) => {
        if (a.ptos !== b.ptos) return b.ptos - a.ptos;
        if (a.dg !== b.dg) return b.dg - a.dg;
        if (a.gf !== b.gf) return b.gf - a.gf;
        return a.pj - b.pj;
    });

    return tercerosLugares.slice(0, 8);
}


function calcularMejoresTerceros() {
    return calcularMejoresTercerosParaResultados(pronosticosConfirmados);
}


function generarHtmlMejoresTerceros(terceros, titulo) {
    let html = `
        <div class="mejores-terceros-panel" hidden>
            <h4>${titulo}</h4>
            <table class="tabla-clasificacion-grupo tabla-mejores-terceros">
                <thead>
                    <tr>
                        <th>#</th><th>Grupo</th><th>Equipo</th><th>Ptos</th><th>DG</th><th>GF</th><th>PJ</th>
                    </tr>
                </thead>
                <tbody>
    `;

    terceros.forEach((t, idx) => {
        html += `
            <tr>
                <td><strong>${idx + 1}</strong></td>
                <td>${t.grupo}</td>
                <td class="equipo-nombre">${t.equipo}</td>
                <td><strong>${t.ptos}</strong></td>
                <td>${t.dg}</td>
                <td>${t.gf}</td>
                <td>${t.pj}</td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    return html;
}

// ====================================================================
// 4. FUNCIÓN DE RENDERIZADO DE LA CLASIFICACIÓN
// ====================================================================

/**
 * Crea y añade la tabla de clasificación al grupo correspondiente en el DOM.
 */
function renderizarClasificacion(grupoData, clasificacion) {
    const grupoElement = document.getElementById(`grupo-${grupoData.nombre.toLowerCase()}`);
    
    // Eliminar tabla anterior si existe
    let tablaExistente = grupoElement.querySelector('.tabla-clasificacion-grupo');
    if (tablaExistente) {
        tablaExistente.remove();
    }
    
    let html = `
        <table class="tabla-clasificacion-grupo">
            <thead>
                <tr>
                    <th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th>
                    <th>GF</th><th>GC</th><th>DG</th><th>Ptos</th>
                </tr>
            </thead>
            <tbody>
    `;

    clasificacion.forEach((e, index) => {
        let claseFila = '';
        if (index === 0 || index === 1) {
            claseFila = 'pasa-directo'; 
        } else if (index === 2) {
            claseFila = 'candidato-tercero'; 
        } else if (index === 3) {
             claseFila = 'eliminado'; 
        }
        
        html += `
            <tr class="${claseFila}">
                <td class="equipo-nombre">${e.equipo}</td>
                <td>${e.pj}</td><td>${e.pg}</td><td>${e.pe}</td><td>${e.pp}</td>
                <td>${e.gf}</td><td>${e.gc}</td><td>${e.dg}</td>
                <td><strong>${e.ptos}</strong></td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    
    grupoElement.insertAdjacentHTML('beforeend', html);

    // Botón y panel de mejores terceros (solo en partidos.html y perfiles)
    if (esPaginaPartidos || perfilNombre) {
        const wrapperExistente = grupoElement.querySelector('.mejores-terceros-wrapper');
        if (wrapperExistente) {
            wrapperExistente.remove();
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'mejores-terceros-wrapper';

        const textoBtn = perfilNombre ? 'Tus mejores terceros' : 'Los mejores terceros';
        const tituloPanel = perfilNombre
            ? 'Tus 8 mejores terceros (según tus pronósticos)'
            : 'Los 8 mejores terceros (de los 12 grupos)';

        const terceros = calcularMejoresTercerosParaResultados(pronosticosConfirmados);
        wrapper.innerHTML = `
            <button type="button" class="btn-mejores-terceros">${textoBtn}</button>
            ${generarHtmlMejoresTerceros(terceros, tituloPanel)}
        `;

        grupoElement.appendChild(wrapper);

        const btn = wrapper.querySelector('.btn-mejores-terceros');
        const panel = wrapper.querySelector('.mejores-terceros-panel');
        if (btn && panel) {
            btn.addEventListener('click', () => {
                const estaOculto = panel.hasAttribute('hidden');
                if (estaOculto) {
                    panel.removeAttribute('hidden');
                } else {
                    panel.setAttribute('hidden', '');
                }
            });
        }
    }
}


function manejarPronostico(event) {
    const boton = event.target;
    if (boton.classList.contains('btn-acertantes-exactos')) {
        const nombrePartido = boton.dataset.partido;
        (firebaseDisponible ? obtenerAcertantesExactosAsync(nombrePartido) : Promise.resolve(obtenerAcertantesExactos(nombrePartido)))
            .then(lista => {
                const mensaje = lista.length
                    ? `Acertantes exactos (${lista.length}):\n- ${lista.join('\n- ')}`
                    : 'Nadie ha acertado este resultado exacto todavía.';
                alert(mensaje);
            })
            .catch(e => {
                console.error(e);
                alert('No se pudieron calcular los acertantes exactos.');
            });
        return;
    }

    if (!boton.classList.contains('btn-confirmar') && !boton.classList.contains('btn-cambiar')) return;

    const partidoCard = boton.closest('.partido-card');
    if (!partidoCard) return;

    const inputLocal = partidoCard.querySelector('.equipos .marcador:nth-child(2)');
    const inputVisitante = partidoCard.querySelector('.equipos .marcador:nth-child(4)');
    const btnConfirmar = partidoCard.querySelector('.btn-confirmar');
    const btnCambiar = partidoCard.querySelector('.btn-cambiar');
    const checkConfirmado = partidoCard.querySelector('.confirmado-check');
    if (!inputLocal || !inputVisitante || !btnConfirmar || !btnCambiar) return;

    const equipoLocal = partidoCard.querySelector('.equipo-local')?.textContent?.trim();
    const equipoVisitante = partidoCard.querySelector('.equipo-visitante')?.textContent?.trim();
    if (!equipoLocal || !equipoVisitante) return;

    const nombrePartido = `${equipoLocal} vs ${equipoVisitante}`;

    const grupoElementId = partidoCard.closest('.grupo')?.id;
    if (!grupoElementId || !grupoElementId.startsWith('grupo-')) return;

    const grupoNombre = grupoElementId.replace('grupo-', '').toUpperCase();
    const grupoEncontrado = gruposData.find(g => g.nombre === grupoNombre);

    if (boton.classList.contains('btn-confirmar')) {
        const golLocal = parseInt(inputLocal.value);
        const golVisitante = parseInt(inputVisitante.value);

        if (isNaN(golLocal) || isNaN(golVisitante) || golLocal < 0 || golVisitante < 0) {
            alert('Por favor, introduce puntuaciones válidas (números no negativos).');
            return;
        }

        pronosticosConfirmados[nombrePartido] = {
            local: golLocal,
            visitante: golVisitante,
            grupo: grupoNombre
        };

            // Si estamos en partidos.html y es la final, guardar el ganador en los oficiales
            if (esPaginaPartidos && nombrePartido && grupoNombre === 'FINAL') {
                let ganador = null;
                if (golLocal > golVisitante) ganador = equipoLocal;
                else if (golLocal < golVisitante) ganador = equipoVisitante;
                // Si hay empate, no hay campeón
                if (ganador) {
                    pronosticosConfirmados[nombrePartido].ganador = ganador;
                } else {
                    delete pronosticosConfirmados[nombrePartido].ganador;
                }
            }

        inputLocal.disabled = true;
        inputVisitante.disabled = true;
        btnConfirmar.disabled = true;
        btnCambiar.disabled = false;
        if (checkConfirmado) checkConfirmado.classList.add('visible');

        guardarPronosticos();
    } else if (boton.classList.contains('btn-cambiar')) {
        const pass = prompt('Introduce la contraseña para modificar este pronóstico:');
        if (ph(pass) !== passwordReiniciar) {
            if (pass !== null) {
                alert('Contraseña incorrecta. No se ha modificado el pronóstico.');
            }
            return;
        }

        inputLocal.disabled = false;
        inputVisitante.disabled = false;
        btnConfirmar.disabled = false;
        btnCambiar.disabled = true;
        if (checkConfirmado) checkConfirmado.classList.remove('visible');

        delete pronosticosConfirmados[nombrePartido];

        guardarPronosticos();
    }

    if (grupoEncontrado) {
        const clasificacionActualizada = calcularClasificacion(grupoNombre, grupoEncontrado.equipos, pronosticosConfirmados);
        renderizarClasificacion({ nombre: grupoNombre }, clasificacionActualizada);
    }

    // Recalcular marcado de aciertos en perfiles
    if (firebaseDisponible) {
        marcarAciertosPerfilAsync().catch(e => console.error(e));
    } else {
        marcarAciertosPerfil();
    }
}


function obtenerClasificados() {
    const clasificados = { primeros: [], segundos: [], terceros: [] };
    const mejoresTerceros = calcularMejoresTerceros(); 
    const nombresMejoresTerceros = mejoresTerceros.map(t => t.equipo);

    gruposData.forEach(grupo => {
        const clasificacionGrupo = calcularClasificacion(grupo.nombre, grupo.equipos, pronosticosConfirmados);
        if (clasificacionGrupo.length >= 4) {
            clasificados.primeros.push({ equipo: clasificacionGrupo[0].equipo, grupo: grupo.nombre });
            clasificados.segundos.push({ equipo: clasificacionGrupo[1].equipo, grupo: grupo.nombre });

            const tercerLugar = clasificacionGrupo[2].equipo;
            if (nombresMejoresTerceros.includes(tercerLugar)) {
                const dataTercero = mejoresTerceros.find(t => t.equipo === tercerLugar);
                clasificados.terceros.push(dataTercero);
            }
        }
    });
    // Ordenar los terceros para la asignación simplificada
    clasificados.terceros.sort((a, b) => {
        if (a.ptos !== b.ptos) return b.ptos - a.ptos;
        if (a.dg !== b.dg) return b.dg - a.dg;
        return b.gf - a.gf;
    });

    return clasificados;
}


/**
 * Genera el bracket de dieciseisavos (M73 a M88) usando los clasificados de grupo.
 * **ACTUALIZADO** con el nuevo calendario de 16avos.
 * @returns {object[]} Lista de 16 partidos de la R32.
 */
function generarDieciseisavos() {
    const clasificados = obtenerClasificados();
    const p = {}; clasificados.primeros.forEach(c => p[c.grupo] = c.equipo); 
    const s = {}; clasificados.segundos.forEach(c => s[c.grupo] = c.equipo); 
    const tercerosPorOrden = clasificados.terceros.map(t => t.equipo); 

    // Comprobación simple para ver si la fase de grupos está completada
    if (Object.keys(pronosticosConfirmados).filter(k => k.includes(' vs ')).length < (12 * 6)) {
         return []; 
    }
    
    const r32Partidos = [
        // Partido 73 – 2º Grupo A v 2º Grupo B 
        { llave: 73, equipo1: s['A'], equipo2: s['B'] }, 
        
        // Partido 74 – 1º Grupo E v 3º Grupo A/B/C/D/F (Tercero 1)
        { llave: 74, equipo1: p['E'], equipo2: tercerosPorOrden[0] || 'Tercero 1' },                               
        
        // Partido 75 – 1º Grupo F v 2º Grupo C 
        { llave: 75, equipo1: p['F'], equipo2: s['C'] },                               
        
        // Partido 76 – 1º Grupo C v 2º Grupo F 
        { llave: 76, equipo1: p['C'], equipo2: s['F'] }, 


        // Partido 77 – 1º Grupo I v 3º Grupo C/D/F/G/H (Tercero 2)
        { llave: 77, equipo1: p['I'], equipo2: tercerosPorOrden[1] || 'Tercero 2' },                               
        
        // Partido 78 – 2º Grupo E v 2º Grupo I 
        { llave: 78, equipo1: s['E'], equipo2: s['I'] },                               
        
        // Partido 79 – 1º Grupo A v 3º Grupo C/E/F/H/I (Tercero 3)
        { llave: 79, equipo1: p['A'], equipo2: tercerosPorOrden[2] || 'Tercero 3' },
        
        // Partido 80 – 1º Grupo L v 3º Grupo E/H/I/J/K (Tercero 4)
        { llave: 80, equipo1: p['L'], equipo2: tercerosPorOrden[3] || 'Tercero 4' },
        
        // Partido 81 – 1º Grupo D v 3º Grupo B/E/F/I/J (Tercero 5)
        { llave: 81, equipo1: p['D'], equipo2: tercerosPorOrden[4] || 'Tercero 5' },                               
        
        // Partido 82 – 1º Grupo G v 3º Grupo A/E/H/I/J (Tercero 6)
        { llave: 82, equipo1: p['G'], equipo2: tercerosPorOrden[5] || 'Tercero 6' },
        
        // Partido 83 – 2º Grupo K v 2º Grupo L 
        { llave: 83, equipo1: s['K'], equipo2: s['L'] },                               
        
        // Partido 84 – 1º Grupo H v 2º Grupo J 
        { llave: 84, equipo1: p['H'], equipo2: s['J'] },
        
        // Partido 85 – 1º Grupo B v 3º Grupo E/F/G/I/J (Tercero 7)
        { llave: 85, equipo1: p['B'], equipo2: tercerosPorOrden[6] || 'Tercero 7' },
        
        // Partido 86 – 1º Grupo J v 2º Grupo H 
        { llave: 86, equipo1: p['J'], equipo2: s['H'] },
        
        // Partido 87 – 1º Grupo K v 3º Grupo D/E/I/J/L (Tercero 8)
        { llave: 87, equipo1: p['K'], equipo2: tercerosPorOrden[7] || 'Tercero 8' },
        
        // Partido 88 – 2º Grupo D v 2º Grupo G 
        { llave: 88, equipo1: s['D'], equipo2: s['G'] },   
    ];

    r32Partidos.forEach(p => {
        const nombreLlave = `M${p.llave}`;
        const datosActuales = pronosticosConfirmados[nombreLlave] || {};
        
        const equiposHanCambiado = datosActuales.equipoLocal !== p.equipo1 || datosActuales.equipoVisitante !== p.equipo2;

        if (equiposHanCambiado) {
             // Reiniciar la llave si los equipos clasificados cambian
             pronosticosConfirmados[nombreLlave] = {
                 equipoLocal: p.equipo1, 
                 equipoVisitante: p.equipo2,
                 ronda: 'R32'
             };
        } else {
            // Mantener los datos existentes si los equipos son los mismos
            pronosticosConfirmados[nombreLlave] = {
                ...datosActuales,
                equipoLocal: p.equipo1, 
                equipoVisitante: p.equipo2,
                ronda: 'R32'
            };
        }
    });

    guardarPronosticos();
    return r32Partidos.map(p => ({ 
        llave: p.llave, 
        nombreCompletoLlave: `M${p.llave}`, 
        equipo1: p.equipo1,
        equipo2: p.equipo2
    }));
}


function generarRonda(ronda) {
    const configRonda = encadenamientoBracket[ronda];
    if (!Array.isArray(configRonda)) return [];

    const obtenerGanador = (llaveBase) => {
        const data = pronosticosConfirmados[llaveBase];
        return data && data.ganador ? data.ganador : null;
    };

    const obtenerPerdedor = (llaveBase) => {
        const data = pronosticosConfirmados[llaveBase];
        if (!data) return null;
        if (!data.ganador) return null;
        if (!data.equipoLocal || !data.equipoVisitante) return null;

        if (data.ganador === data.equipoLocal) return data.equipoVisitante;
        if (data.ganador === data.equipoVisitante) return data.equipoLocal;
        return null;
    };

    const resolverReferenciaEquipo = (ref) => {
        if (!ref) return 'TBD';

        if (ref.endsWith('-G')) {
            const llaveBase = ref.replace('-G', '');
            return obtenerGanador(llaveBase) || 'TBD';
        }

        if (ref.endsWith('-P')) {
            const llaveBase = ref.replace('-P', '');
            return obtenerPerdedor(llaveBase) || 'TBD';
        }

        return obtenerGanador(ref) || 'TBD';
    };

    const partidos = configRonda.map(p => {
        const nombreLlave = `M${p.llave}`;
        const equipo1 = resolverReferenciaEquipo(p.equipo1Ganador);
        const equipo2 = resolverReferenciaEquipo(p.equipo2Ganador);

        const datosActuales = pronosticosConfirmados[nombreLlave] || {};
        const equiposHanCambiado = datosActuales.equipoLocal !== equipo1 || datosActuales.equipoVisitante !== equipo2;

        if (equiposHanCambiado) {
            pronosticosConfirmados[nombreLlave] = {
                equipoLocal: equipo1,
                equipoVisitante: equipo2,
                ronda
            };
        } else {
            pronosticosConfirmados[nombreLlave] = {
                ...datosActuales,
                equipoLocal: equipo1,
                equipoVisitante: equipo2,
                ronda
            };
        }

        return {
            llave: p.llave,
            nombreCompletoLlave: nombreLlave,
            equipo1,
            equipo2
        };
    });

    guardarPronosticos();
    return partidos;
}


// ====================================================================
// 7. RENDERIZADO DE RONDAS ELIMINATORIAS
// ====================================================================

/**
 * Renderiza cualquier ronda eliminatoria (R32, R16, R8, etc.) en el DOM.
 */
function renderizarRondaEliminatoria(partidos, ronda) {
    const contenedor = document.getElementById(`bracket-contenido-${ronda}`); 
    if (!contenedor) return; 

    let html = '';
    
    const totalPartidosFaseGrupos = 12 * 6;
    const partidosConfirmados = Object.keys(pronosticosConfirmados).filter(k => k.includes(' vs ')).length;
    const faltantes = totalPartidosFaseGrupos - partidosConfirmados;
    
    if (partidos.length === 0 && ronda === 'R32' && faltantes > 0) {
        html = `<p>Faltan **${faltantes}** resultados de grupos para generar los Dieciseisavos (R32).</p>`;
    } else if (partidos.length === 0 && ronda !== 'R32') {
         html = `<p>Faltan resultados de la ronda anterior para generar los ${ronda}.</p>`;
    } else {
        html = '<div class="ronda-eliminatoria">';

        // Preparar datos de puntos por presencia en ronda (solo en perfiles)
        let equiposOficialRonda = null;
        let equiposJugadorRonda = null;
        let puntosRonda = 0;
        if (perfilNombre) {
            const pronOficial = (firebaseDisponible && pronosticosOficialesCache)
                ? pronosticosOficialesCache
                : cargarPronosticosPorClave(perfilesConfig.partidos.key);
            const soloFinal = ronda === 'Final';
            equiposOficialRonda = obtenerEquiposPorRonda(pronOficial, ronda, soloFinal);
            equiposJugadorRonda = obtenerEquiposPorRonda(pronosticosConfirmados, ronda, soloFinal);
            const mapaPuntosRonda = { R32: 2, R16: 3, R8: 4, R4: 5, Final: 6 };
            puntosRonda = mapaPuntosRonda[ronda] || 0;
        }
        
        partidos.forEach(p => {
            // Calcular puntos de presencia de equipos en esta llave (solo perfiles)
            let puntosPartido = 0;
            if (perfilNombre && equiposOficialRonda && equiposJugadorRonda && puntosRonda > 0) {
                [p.equipo1, p.equipo2].forEach(eq => {
                    if (!eq || eq === 'TBD' || eq.startsWith('Tercero')) return;
                    if (equiposOficialRonda.has(eq) && equiposJugadorRonda.has(eq)) {
                        puntosPartido += puntosRonda;
                    }
                });
            }

            const nombreLlave = p.nombreCompletoLlave; // M73, M89, M104, etc.
            const resultadoGuardado = pronosticosConfirmados[nombreLlave] || {};
            
            const ganadorElegido = resultadoGuardado.ganador; 
            const yaHayGanador = !!ganadorElegido; 

            const EQUIPO_1_TBD = p.equipo1 === 'TBD' || p.equipo1.includes('Tercero'); // Considerar Tercero X como TBD si no se ha resuelto
            const EQUIPO_2_TBD = p.equipo2 === 'TBD' || p.equipo2.includes('Tercero');
            const TBD_CLASS = (EQUIPO_1_TBD || EQUIPO_2_TBD) ? 'tbd-enfrentamiento' : '';

            let LLAVE_TITULO;
            if (ronda === 'Final') {
                LLAVE_TITULO = (p.llave === 104) ? 'FINAL (M104)' : '3ER PUESTO (M103)';
            } else {
                 LLAVE_TITULO = `PARTIDO M${p.llave}`;
            }
            
            // Clases para destacar el equipo elegido y deshabilitar si ya hay ganador
            const claseEquipo1 = (ganadorElegido === p.equipo1) ? 'elegido' : '';
            const claseEquipo2 = (ganadorElegido === p.equipo2) ? 'elegido' : '';
            const disabledClase = yaHayGanador ? 'deshabilitado' : '';
            
            // Condición para deshabilitar los botones de elección
            const disableButtons = (EQUIPO_1_TBD || EQUIPO_2_TBD || yaHayGanador) ? 'disabled' : '';

            html += `
                <div class="partido-bracket ${TBD_CLASS} ${disabledClase}">
                    <span class="llave">${ronda} - ${LLAVE_TITULO}</span>
                    <div class="enfrentamiento-clic">
                        <button 
                            class="btn-equipo-ganador ${claseEquipo1}" 
                            data-llave="${nombreLlave}" 
                            data-equipo="${p.equipo1}"
                            ${disableButtons}>
                            ${p.equipo1}
                        </button>
                        
                        <span class="vs-eliminatoria">VS</span>
                        
                        <button 
                            class="btn-equipo-ganador ${claseEquipo2}" 
                            data-llave="${nombreLlave}" 
                            data-equipo="${p.equipo2}"
                            ${disableButtons}>
                            ${p.equipo2}
                        </button>
                    </div>
                     ${perfilNombre && puntosPartido > 0 ? 
                        `<div class="puntos-ronda">+${puntosPartido}</div>`
                       : ''}
                     ${yaHayGanador && !EQUIPO_1_TBD && !EQUIPO_2_TBD ? 
                        `<div class="acciones-elim">
                            <button class="btn-cambiar-elim-clic" data-llave="${nombreLlave}">Cambiar Ganador</button>
                         </div>` 
                         : ''}
                </div>
            `;
        });
        
        html += '</div>';
    }

    contenedor.innerHTML = html;
}


// ====================================================================
// 8. MANEJO DE EVENTOS (Eliminatorias - Clic de Avance) - CORREGIDO
// ====================================================================

function manejarPronosticoEliminatoria(event) {
    const boton = event.target;
    
    const esConfirmar = boton.classList.contains('btn-equipo-ganador');
    const esCambiar = boton.classList.contains('btn-cambiar-elim-clic');
    
    if (!esConfirmar && !esCambiar) return;

    const llavePartido = boton.dataset.llave; // Ej: M73, M99, M104

    // LÓGICA ROBUSTA PARA DETERMINAR LA RONDA POR RANGO DE LLAVE
    const numeroLlave = parseInt(llavePartido.replace('M', ''));
    
    let ronda;
    
    if (numeroLlave >= 73 && numeroLlave <= 88) {
        ronda = 'R32';
    } else if (numeroLlave >= 89 && numeroLlave <= 96) {
        ronda = 'R16';
    } else if (numeroLlave >= 97 && numeroLlave <= 100) {
        ronda = 'R8'; 
    } else if (numeroLlave >= 101 && numeroLlave <= 102) {
        ronda = 'R4';
    } else if (numeroLlave >= 103 && numeroLlave <= 104) {
        ronda = 'Final';
    }
    
    if (!ronda) return; 

    if (!pronosticosConfirmados[llavePartido]) return; 

    if (esConfirmar) {
        const equipoGanador = boton.dataset.equipo;
        
        // 1. Guardar el ganador
        pronosticosConfirmados[llavePartido].ganador = equipoGanador;
        
    } else if (esCambiar) {
        const pass = prompt("Introduce la contraseña para cambiar el ganador:");
        if (ph(pass) !== passwordReiniciar) {
            if (pass !== null) {
                alert("Contraseña incorrecta. No se ha modificado el ganador.");
            }
            return;
        }
        // 1. Eliminar el ganador
        delete pronosticosConfirmados[llavePartido].ganador;
        
        // También aseguramos que no quede ningún marcador remanente si lo hubiera
        delete pronosticosConfirmados[llavePartido].local;
        delete pronosticosConfirmados[llavePartido].visitante;
    }
    
    // 2. Persistencia
    guardarPronosticos(); 
    
    // 3. Re-renderizar la ronda actual (para actualizar el estado visual)
    const partidosActuales = (ronda === 'R32') ? generarDieciseisavos() : generarRonda(ronda);
    renderizarRondaEliminatoria(partidosActuales, ronda);
    
    // 4. Re-renderizar la siguiente ronda (propagación del ganador)
    const siguienteRonda = {
        R32: 'R16', R16: 'R8', R8: 'R4', R4: 'Final', Final: null
    };
    if (siguienteRonda[ronda]) {
        const nextRondaName = siguienteRonda[ronda];
        const nextRondaPartidos = generarRonda(nextRondaName);
        
        // Renderizar solo si la pestaña de la siguiente ronda está activa/visible
        const nextRondaTabId = `ronda-${nextRondaName.toLowerCase()}`;
        if (document.getElementById(nextRondaTabId)?.classList.contains('active')) {
             renderizarRondaEliminatoria(nextRondaPartidos, nextRondaName);
        }
    }
}


// ====================================================================
// 9. INICIALIZACIÓN
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    const tablaClasificacion = document.getElementById('tabla-clasificacion');

    // Si estamos en la página de clasificación, calculamos puntos y mostramos reglas
    if (tablaClasificacion) {
        if (firebaseDisponible) {
            actualizarClasificacionIndex(true).catch(e => {
                console.error(e);
                actualizarClasificacionIndex();
            });
        } else {
            actualizarClasificacionIndex();
        }

        const btnReglas = document.querySelector('.btn-reglas-header');
        const modalReglas = document.getElementById('modal-reglas');
        const closeModal = document.querySelector('.close-modal');
        
        if (btnReglas && modalReglas) {
            const toggleModal = (show) => {
                if (show) {
                    modalReglas.classList.remove('modal-hidden');
                } else {
                    modalReglas.classList.add('modal-hidden');
                }
            };

            btnReglas.addEventListener('click', () => toggleModal(true));
            
            if (closeModal) {
                closeModal.addEventListener('click', () => toggleModal(false));
            }
            
            // Usar delegación: escuchar en el modal en lugar de window
            modalReglas.addEventListener('click', (event) => {
                if (event.target === modalReglas) {
                    toggleModal(false);
                }
            });
        }

        // Botón de reinicio total (en index.html)
        const btnReiniciarTotal = document.getElementById('btn-reiniciar-app-total');
        if (btnReiniciarTotal) {
            btnReiniciarTotal.addEventListener('click', reiniciarTodo);
        }
        return;
    }

    const contenedorGrupos = document.getElementById('contenedor-grupos');
    const contenedorTabs = document.getElementById('group-tabs');

    // Si no existen contenedores (p.ej. página sin estructura de pronósticos), salimos.
    if (!contenedorGrupos || !contenedorTabs) return;

    const inicializarPronosticosUI = async () => {
        // Perfil = carga del docId del perfil, edición bajo contraseña
        if (perfilNombre) {
            docIdActual = DOC_ID_PARTICIPANTES[perfilNombre] || docIdActual;
            edicionHabilitada = true;
            pronosticosConfirmados = await cargarPronosticosAsync(docIdActual);
            await cargarPronosticosOficialesAsync();
            generarEstructuraPartidos();
            if (firebaseDisponible) {
                await marcarAciertosPerfil(true);
            } else {
                await marcarAciertosPerfil();
            }
            return;
        }

        // partidos.html = oficiales (edición bajo contraseña)
        if (esPaginaPartidos) {
            docIdActual = DOC_ID_OFICIALES;
            edicionHabilitada = true;
            storageKey = obtenerStorageKeyParaDocId(docIdActual);
            passwordReiniciar = obtenerPasswordParaDocId(docIdActual);
            pronosticosConfirmados = await cargarPronosticosAsync(docIdActual);
            pronosticosOficialesCache = pronosticosConfirmados;
            generarEstructuraPartidos();
            return;
        }

        // fallback: modo local
        pronosticosConfirmados = cargarPronosticos();
        edicionHabilitada = true;
        generarEstructuraPartidos();
    };

    inicializarPronosticosUI().catch(e => {
        console.error(e);
        alert('Error inicializando la app. Revisa la consola.');
    });
    
    // 2. Escuchar eventos en el contenedor principal (para Confirmar/Cambiar de GRUPOS)
    contenedorGrupos.addEventListener('click', manejarPronostico);
    
    // 3. Escuchar eventos en el contenedor principal (para ELIMINATORIAS - CLIC)
    contenedorGrupos.addEventListener('click', manejarPronosticoEliminatoria);

    // 4. Manejo del botón de reinicio
    const btnReiniciar = document.getElementById('btn-reiniciar-app');
    if (btnReiniciar) {
        btnReiniciar.addEventListener('click', reiniciarPronosticos);
    }
});

// ====================================================================
// 10. FUNCIÓN DE REINICIO TOTAL DE LA APP (Con Contraseña DINÁMICA)
// ====================================================================

/**
 * Borra los pronósticos del perfil actual guardados en localStorage y recarga la página.
 */
function reiniciarPronosticos() {
    // Usamos la variable global 'passwordReiniciar'
    const password = prompt(`Introduce la contraseña para reiniciar los resultados de ${storageKey.replace('pronosticosMundial_', '').replace('pronosticosMundial', 'este perfil')}:`);
    
    if (ph(password) === passwordReiniciar) {
        borrarPronosticosAsync(docIdActual || DOC_ID_OFICIALES)
            .then(() => {
                alert(`¡Todos los pronósticos de este perfil han sido reiniciados! La página se recargará ahora.`);
                window.location.reload();
            })
            .catch(e => {
                console.error(e);
                alert('No se pudieron reiniciar los pronósticos.');
            });
    } else if (password !== null) {
        alert("Contraseña incorrecta. El reinicio ha sido cancelado.");
    }
}

/**
 * Reinicia TODOS los pronósticos de todos los perfiles y la página oficial.
 */
async function reiniciarTodo() {
    const password = prompt('Introduce la contraseña maestra para reiniciar TODOS los pronósticos:');
    
    if (!password) return; // Cancelado por el usuario
    
    const passwordMaestra = '29dae08e'; // Contraseña maestra (hash)
    
    if (ph(password) !== passwordMaestra) {
        alert("Contraseña incorrecta. El reinicio ha sido cancelado.");
        return;
    }

    try {
        // Reiniciar pronósticos oficiales (partidos.html)
        await borrarPronosticosAsync(DOC_ID_OFICIALES);
        
        // Reiniciar pronósticos de todos los perfiles
        const participantes = Object.keys(DOC_ID_PARTICIPANTES);
        for (const participante of participantes) {
            const docId = DOC_ID_PARTICIPANTES[participante];
            if (docId) {
                await borrarPronosticosAsync(docId);
            }
        }
        
        alert('¡TODOS los pronósticos han sido reiniciados! La página se recargará ahora.');
        window.location.reload();
    } catch (e) {
        console.error(e);
        alert('No se pudieron reiniciar todos los pronósticos.');
    }
}