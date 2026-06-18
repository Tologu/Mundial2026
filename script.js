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

// Documento donde se guardan los comentarios (dentro de la colección 'pronosticos'
// para reutilizar exactamente las reglas de seguridad que ya funcionan)
const DOC_ID_TABLON = 'tablon';

async function firebasePublicarComentario(comentario, listaActual) {
    const lista = Array.isArray(listaActual) ? listaActual.slice() : [];
    lista.unshift(comentario);
    const recortada = lista.slice(0, 100);
    await firebaseGuardarPronosticos(DOC_ID_TABLON, { lista: recortada });
    return recortada;
}

async function firebaseEliminarComentario(id, listaActual) {
    const lista = (Array.isArray(listaActual) ? listaActual : []).filter((c) => c.id !== id);
    await firebaseGuardarPronosticos(DOC_ID_TABLON, { lista });
    return lista;
}

async function firebasePublicarRespuesta(parentId, respuesta, listaActual) {
    const lista = (Array.isArray(listaActual) ? listaActual : []).map((c) => {
        if (c.id !== parentId) return c;
        const respuestas = Array.isArray(c.respuestas) ? c.respuestas.slice() : [];
        respuestas.push(respuesta);
        return { ...c, respuestas };
    });
    await firebaseGuardarPronosticos(DOC_ID_TABLON, { lista });
    return lista;
}

async function firebaseEliminarRespuesta(parentId, respuestaId, listaActual) {
    const lista = (Array.isArray(listaActual) ? listaActual : []).map((c) => {
        if (c.id !== parentId) return c;
        const respuestas = (Array.isArray(c.respuestas) ? c.respuestas : []).filter((r) => r.id !== respuestaId);
        return { ...c, respuestas };
    });
    await firebaseGuardarPronosticos(DOC_ID_TABLON, { lista });
    return lista;
}

// Obtener el match del perfil
const perfilMatch = pathName.match(REGEX_PERFIL);
const perfilNombre = perfilMatch ? perfilMatch[1] : null;

// Mapa de configuración para todos los perfiles
const perfilesConfig = {
    // Tu perfil (partidos.html)
    partidos: { key: 'pronosticosMundial', password: '78d84535'  },
    
    // Perfiles de Jugadores
    tomas: { key: 'pronosticosMundial_Tomas', password: '4f3123f5' },
    miguel: { key: 'pronosticosMundial_Miguel', password: '851091c' },
    sofia: { key: 'pronosticosMundial_Sofia', password: '136ce531' },
    inma: { key: 'pronosticosMundial_Inma', password: 'fcb3a3e8' },
    manolo: { key: 'pronosticosMundial_Manolo', password: '54fa0acd' },
    martina: { key: 'pronosticosMundial_Martina', password: '50897f8f' },
    adri: { key: 'pronosticosMundial_Adri', password: '9add415d' },
    fuen: { key: 'pronosticosMundial_Fuen', password: 'ddd34d1b' },
    isa: { key: 'pronosticosMundial_Isa', password: 'a2b56118' },
    isabelc: { key: 'pronosticosMundial_IsabelC', password: 'fe7ee5d0' },
    jose: { key: 'pronosticosMundial_Jose', password: '1e4188d0' },
    maria: { key: 'pronosticosMundial_Maria', password: '7aa6775' },
    moi: { key: 'pronosticosMundial_Moi', password: '40c70d88' },
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
    'Isabel C.': 'isabelc',
    'Jose': 'jose',
    'María': 'maria',
    'Moi': 'moi'
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
    isabelc: 'isabelc',
    jose: 'jose',
    maria: 'maria',
    moi: 'moi'
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

// Devuelve la última ronda eliminatoria con equipos definidos en el cuadro oficial
function detectarUltimaRondaElimActiva(pronosticosOficiales) {
    const rondas = ['R32', 'R16', 'R8', 'R4', 'Final'];
    let ultima = null;
    for (const ronda of rondas) {
        if (obtenerEquiposPorRonda(pronosticosOficiales, ronda).size > 0) ultima = ronda;
    }
    return ultima;
}

// Calcula los puntos obtenidos por un jugador en una ronda eliminatoria concreta
function calcularPuntosPorRondaEspecifica(pronosticosOficiales, pronosticosPerfil, ronda) {
    const puntosRonda = { R32: 2, R16: 3, R8: 5, R4: 7, Final: 12 };
    const pts = puntosRonda[ronda] || 0;
    const soloFinal = ronda === 'Final';
    const oficiales = obtenerEquiposPorRonda(pronosticosOficiales, ronda, soloFinal);
    const jugador = obtenerEquiposPorRonda(pronosticosPerfil, ronda, soloFinal);
    let puntos = 0;
    oficiales.forEach(equipo => { if (jugador.has(equipo)) puntos += pts; });
    if (ronda === 'Final') {
        const campeonOficial = pronosticosOficiales['M104']?.ganador;
        const campeonJugador = pronosticosPerfil['M104']?.ganador;
        if (campeonOficial && campeonJugador && campeonOficial === campeonJugador) puntos += 8;
    }
    return puntos;
}

// Calcula los puntos por ronda para todas las fases eliminatorias
function calcularTodosPuntosPorRonda(pronosticosOficiales, pronosticosPerfil) {
    const resultado = {};
    for (const ronda of ['R32', 'R16', 'R8', 'R4', 'Final']) {
        resultado[ronda] = calcularPuntosPorRondaEspecifica(pronosticosOficiales, pronosticosPerfil, ronda);
    }
    return resultado;
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
        { ronda: 'R8',  puntos: 5 },
        { ronda: 'R4',  puntos: 7 },
        { ronda: 'Final', puntos: 12 }
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

    // 3) BONUS CAMPEÓN: +8 puntos si acertó el ganador de la Final (M104)
    const campeonOficial = pronosticosOficiales['M104']?.ganador;
    const campeonJugador = pronosticosPerfil['M104']?.ganador;
    if (campeonOficial && campeonJugador && campeonOficial === campeonJugador) {
        puntos += 8;
        aciertos += 1;
    }

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

// ====================================================================
// PRÓXIMO PARTIDO – helpers para la columna de índex
// ====================================================================

function obtenerListaPartidosGrupos() {
    // Orden cronológico real del Mundial 2026 (fase de grupos)
    return [
        // Jornada 1
        'México vs Sudáfrica',              // 11 Jun
        'Corea del Sur vs Rep. Checa',      // 12 Jun
        'Canadá vs Bosnia',                 // 12 Jun
        'Estados Unidos vs Paraguay',        // 13 Jun
        'Catar vs Suiza',                   // 13 Jun
        'Brasil vs Marruecos',              // 14 Jun
        'Haití vs Escocia',                 // 14 Jun
        'Australia vs Turquía',             // 14 Jun
        'Alemania vs Curazao',              // 14 Jun
        'Países Bajos vs Japón',            // 14 Jun
        'Costa de Marfil vs Ecuador',       // 15 Jun
        'Suecia vs Túnez',                  // 15 Jun
        'España vs Cabo Verde',             // 15 Jun
        'Bélgica vs Egipto',               // 15 Jun
        'Arabia Saudita vs Uruguay',        // 16 Jun
        'Irán vs Nueva Zelanda',            // 16 Jun
        'Francia vs Senegal',               // 16 Jun
        'Irak vs Noruega',                  // 17 Jun
        'Argentina vs Argelia',             // 17 Jun
        'Austria vs Jordania',              // 17 Jun
        'Portugal vs RD Congo',             // 17 Jun
        'Inglaterra vs Croacia',            // 17 Jun
        'Ghana vs Panamá',                  // 18 Jun
        'Uzbekistán vs Colombia',           // 18 Jun
        // Jornada 2
        'Rep. Checa vs Sudáfrica',          // 18 Jun
        'Suiza vs Bosnia',                  // 18 Jun
        'Canadá vs Catar',                  // 19 Jun
        'México vs Corea del Sur',          // 19 Jun
        'Estados Unidos vs Australia',      // 19 Jun
        'Escocia vs Marruecos',             // 20 Jun
        'Brasil vs Haití',                  // 20 Jun
        'Turquía vs Paraguay',              // 20 Jun
        'Países Bajos vs Suecia',           // 20 Jun
        'Alemania vs Costa de Marfil',      // 20 Jun
        'Ecuador vs Curazao',              // 21 Jun
        'Túnez vs Japón',                   // 21 Jun
        'España vs Arabia Saudita',         // 21 Jun
        'Bélgica vs Irán',                  // 21 Jun
        'Uruguay vs Cabo Verde',            // 22 Jun
        'Nueva Zelanda vs Egipto',          // 22 Jun
        'Argentina vs Austria',             // 22 Jun
        'Francia vs Irak',                  // 22 Jun
        'Noruega vs Senegal',               // 23 Jun
        'Jordania vs Argelia',              // 23 Jun
        'Portugal vs Uzbekistán',           // 23 Jun
        'Inglaterra vs Ghana',              // 23 Jun
        'Panamá vs Croacia',                // 24 Jun
        'Colombia vs RD Congo',             // 24 Jun
        // Jornada 3
        'Escocia vs Brasil',                // 24 Jun
        'Marruecos vs Haití',              // 24 Jun
        'Suiza vs Canadá',                  // 25 Jun
        'Bosnia vs Catar',                  // 25 Jun
        'Sudáfrica vs Corea del Sur',       // 25 Jun
        'Rep. Checa vs México',             // 25 Jun
        'Paraguay vs Australia',            // 26 Jun
        'Turquía vs Estados Unidos',        // 26 Jun
        'Túnez vs Países Bajos',            // 26 Jun
        'Japón vs Suecia',                  // 26 Jun
        'Ecuador vs Alemania',              // 26 Jun
        'Curazao vs Costa de Marfil',       // 26 Jun
        'Egipto vs Irán',                   // 27 Jun
        'Nueva Zelanda vs Bélgica',         // 27 Jun
        'Uruguay vs España',                // 27 Jun
        'Cabo Verde vs Arabia Saudita',     // 27 Jun
        'Senegal vs Irak',                  // 27 Jun
        'Noruega vs Francia',               // 27 Jun
        'Argelia vs Austria',               // 27 Jun
        'Jordania vs Argentina',            // 27 Jun
        'Croacia vs Ghana',                 // 27 Jun
        'Panamá vs Inglaterra',             // 27 Jun
        'RD Congo vs Uzbekistán',           // 27 Jun
        'Colombia vs Portugal',             // 27 Jun
    ];
}

function obtenerProximoPartidoClave(pronosticosOficiales) {
    for (const clave of obtenerListaPartidosGrupos()) {
        const dato = pronosticosOficiales[clave];
        if (!dato || typeof dato.local !== 'number') return clave;
    }
    // Fase eliminatoria: no mostrar próximo partido
    return null;
}

function obtenerTextoPronosticoProximo(pronosticoJugador, clave) {
    if (!pronosticoJugador) return '—';
    if (clave && clave.includes(' vs ')) {
        if (typeof pronosticoJugador.local === 'number' && typeof pronosticoJugador.visitante === 'number') {
            return `${pronosticoJugador.local}-${pronosticoJugador.visitante}`;
        }
        return '—';
    } else {
        if (pronosticoJugador.equipoLocal && pronosticoJugador.equipoVisitante) {
            return `${pronosticoJugador.equipoLocal} vs ${pronosticoJugador.equipoVisitante}`;
        }
        return '—';
    }
}

async function actualizarClasificacionIndex(useAsync = false) {
    const tabla = document.getElementById('tabla-clasificacion');
    if (!tabla) return;

    const pronosticosOficiales = useAsync
        ? await cargarPronosticosOficialesAsync()
        : cargarPronosticosPorClave(perfilesConfig.partidos.key);

    const claveProximo = obtenerProximoPartidoClave(pronosticosOficiales);

    // --- Aviso de último resultado confirmado ---
    const avisoEl = document.getElementById('ultimo-resultado-aviso');
    if (avisoEl) {
        // Si el torneo ha terminado (M104 tiene campeón), mostrar ganador de la porra al final
        // (se actualizará después de calcular clasificacion; dejar vacío por ahora)
        if (!pronosticosOficiales['M104']?.ganador) {
            let ultimoClave = null, ultimoTs = null, ultimoDato = null;
            Object.entries(pronosticosOficiales).forEach(([clave, dato]) => {
                if (!dato || !dato.timestamp) return;
                if (!ultimoTs || dato.timestamp > ultimoTs) {
                    ultimoTs = dato.timestamp;
                    ultimoClave = clave;
                    ultimoDato = dato;
                }
            });
            if (ultimoClave && ultimoDato && ultimoClave.includes(' vs ')) {
                const [loc, vis] = ultimoClave.split(' vs ');
                const textoPartido = `${loc} <strong>${ultimoDato.local}–${ultimoDato.visitante}</strong> ${vis}`;

                // Buscar acertantes exactos del último partido (solo fase de grupos)
                let textoAcertantes = '';
                if (typeof ultimoDato.local === 'number' &&
                    typeof ultimoDato.visitante === 'number') {
                    const acertantes = await (firebaseDisponible
                        ? obtenerAcertantesExactosAsync(ultimoClave)
                        : Promise.resolve(obtenerAcertantesExactos(ultimoClave)));
                    if (acertantes && acertantes.length > 0) {
                        const nombresOrdenados = [...acertantes].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
                        const nombres = nombresOrdenados.join(', ');
                        textoAcertantes = ` -- Acertantes exactos: <strong>${nombres}</strong>`;
                    }
                }

                const textoCompleto = `Última actualización: ${textoPartido}${textoAcertantes}`;
                if (textoAcertantes) {
                    avisoEl.innerHTML = `<span class="aviso-scroll">${textoCompleto}</span>`;
                } else {
                    avisoEl.innerHTML = textoCompleto;
                }
            } else {
                avisoEl.innerHTML = '';
            }
        }
    }

    let clasificacion;
    
    if (useAsync) {
        clasificacion = await Promise.all(
            Object.entries(PARTICIPANTES).map(async ([nombreVisible, slug]) => {
                const docId = DOC_ID_PARTICIPANTES[slug];
                const pronosticosJugador = docId ? await cargarPronosticosPorDocId(docId) : {};
                const { puntos, aciertos, exactos } = calcularPuntajePerfil(pronosticosOficiales, pronosticosJugador);
                const pronosticoProximo = claveProximo ? pronosticosJugador[claveProximo] : null;
                const puntosPorRonda = calcularTodosPuntosPorRonda(pronosticosOficiales, pronosticosJugador);
                return { nombreVisible, slug, puntos, aciertos, exactos, pronosticoProximo, puntosPorRonda, pronosticos: pronosticosJugador };
            })
        );
    } else {
        clasificacion = Object.entries(PARTICIPANTES).map(([nombreVisible, slug]) => {
            const config = perfilesConfig[slug];
            const pronosticosJugador = config ? cargarPronosticosPorClave(config.key) : {};
            const { puntos, aciertos, exactos } = calcularPuntajePerfil(pronosticosOficiales, pronosticosJugador);
            const pronosticoProximo = claveProximo ? pronosticosJugador[claveProximo] : null;
            const puntosPorRonda = calcularTodosPuntosPorRonda(pronosticosOficiales, pronosticosJugador);
            return { nombreVisible, slug, puntos, aciertos, exactos, pronosticoProximo, puntosPorRonda, pronosticos: pronosticosJugador };
        });
    }

    clasificacion.sort((a, b) => {
        if (a.puntos !== b.puntos) return b.puntos - a.puntos;
        if (a.aciertos !== b.aciertos) return b.aciertos - a.aciertos;
        if (a.exactos !== b.exactos) return b.exactos - a.exactos;
        return a.nombreVisible.localeCompare(b.nombreVisible, 'es', { sensitivity: 'base' });
    });

    const tbody = tabla.querySelector('tbody');
    if (!tbody) return;

    // ----------------------------------------------------------------
    // Flechas de movimiento (COMPARTIDAS y DETERMINISTAS)
    // ----------------------------------------------------------------
    // En lugar de depender de "la última visita" de cada móvil (localStorage), la flecha
    // compara el ranking ACTUAL contra el ranking que había ANTES de la TANDA de partidos
    // más reciente. Como esto se calcula a partir de los resultados oficiales (que son los
    // mismos para todos) y de sus timestamps, TODOS ven exactamente las mismas flechas.
    //
    // "Tanda" = grupo de partidos confirmados muy seguidos en el tiempo. Si entre dos
    // resultados pasa más de BATCH_GAP_MS, se considera que empieza una tanda nueva. Así,
    // si por la noche se confirman 3-4 partidos seguidos, al despertarse la flecha muestra
    // el movimiento NETO de toda la noche (frente al ranking previo a esa tanda).
    const BATCH_GAP_MS = 6 * 60 * 60 * 1000; // 6 horas

    // Mapa del ranking actual (slug -> posición)
    const currentRanking = {};
    clasificacion.forEach((item, idx) => { currentRanking[item.slug] = idx + 1; });

    // Timestamps (ms) de los resultados oficiales que tienen marca de tiempo
    const tsResultados = Object.values(pronosticosOficiales)
        .map(dato => (dato && dato.timestamp) ? new Date(dato.timestamp).getTime() : NaN)
        .filter(t => !isNaN(t))
        .sort((a, b) => a - b);

    // Inicio de la tanda más reciente: retrocedemos desde el último resultado mientras la
    // separación con el anterior sea <= BATCH_GAP_MS.
    let inicioTandaTs = Infinity;
    if (tsResultados.length > 0) {
        inicioTandaTs = tsResultados[tsResultados.length - 1];
        for (let i = tsResultados.length - 1; i > 0; i--) {
            if (tsResultados[i] - tsResultados[i - 1] <= BATCH_GAP_MS) {
                inicioTandaTs = tsResultados[i - 1];
            } else {
                break;
            }
        }
    }

    // Resultados oficiales ANTERIORES a la tanda actual (los sin timestamp se consideran
    // antiguos y entran siempre en la base de comparación).
    const oficialesAntesDeTanda = {};
    Object.entries(pronosticosOficiales).forEach(([clave, dato]) => {
        const ts = (dato && dato.timestamp) ? new Date(dato.timestamp).getTime() : NaN;
        if (isNaN(ts) || ts < inicioTandaTs) {
            oficialesAntesDeTanda[clave] = dato;
        }
    });

    // Ranking anterior (antes de la tanda). Si no hay resultados previos, no hay base de
    // comparación y las flechas quedan neutras.
    let rankingAnterior = {};
    if (Object.keys(oficialesAntesDeTanda).length > 0) {
        const clasifAnterior = clasificacion.map(item => {
            const { puntos, aciertos, exactos } = calcularPuntajePerfil(oficialesAntesDeTanda, item.pronosticos || {});
            return { slug: item.slug, nombreVisible: item.nombreVisible, puntos, aciertos, exactos };
        });
        clasifAnterior.sort((a, b) => {
            if (a.puntos !== b.puntos) return b.puntos - a.puntos;
            if (a.aciertos !== b.aciertos) return b.aciertos - a.aciertos;
            if (a.exactos !== b.exactos) return b.exactos - a.exactos;
            return a.nombreVisible.localeCompare(b.nombreVisible, 'es', { sensitivity: 'base' });
        });
        clasifAnterior.forEach((item, idx) => { rankingAnterior[item.slug] = idx + 1; });
    }

    // Actualizar cabecera de la columna Próximo partido (clase, no inline style: el inline anulaba el CSS móvil)
    const thProximo = tabla.querySelector('#th-proximo-partido');
    if (thProximo) {
        if (claveProximo) {
            thProximo.innerHTML = `Próximo partido<br><span class="proximo-match-sub">${claveProximo}</span>`;
            thProximo.classList.remove('col-proximo-oculta');
        } else {
            thProximo.classList.add('col-proximo-oculta');
        }
    }

    tbody.innerHTML = '';
    clasificacion.forEach((item, index) => {
        const posicion = index + 1;
        const fila = document.createElement('tr');
        const emojiPodio = posicion === 2 ? '🥈' : posicion === 3 ? '🥉' : '';
        const emojiCorona = posicion === 1 ? '<span class="emoji-corona">👑</span>' : '';

        // Calcular flecha de movimiento
        const todosACero = clasificacion.every(p => p.puntos === 0);
        const posAnterior = rankingAnterior[item.slug];
        let flechaHtml = '';
        if (todosACero || posAnterior === undefined || posAnterior === posicion) {
            flechaHtml = `<span class="flecha-ranking flecha-igual" title="Misma posición">–</span>`;
        } else if (posicion < posAnterior) {
            const diff = posAnterior - posicion;
            flechaHtml = `<span class="flecha-ranking flecha-sube" title="Subió ${diff} puesto${diff > 1 ? 's' : ''}">▲</span>`;
        } else {
            const diff = posicion - posAnterior;
            flechaHtml = `<span class="flecha-ranking flecha-baja" title="Bajó ${diff} puesto${diff > 1 ? 's' : ''}">▼</span>`;
        }

        if (posicion === 2) {
            fila.classList.add('puesto-plata');
        } else if (posicion === 3) {
            fila.classList.add('puesto-bronce');
        }

        // Último puesto
        const textoProximo = obtenerTextoPronosticoProximo(item.pronosticoProximo, claveProximo);
        const tdProximo = claveProximo
            ? `<td class="td-proximo${textoProximo === '—' ? ' td-proximo-vacio' : ''}">${textoProximo}</td>`
            : '';

        const premios = ['', '+20€', '+4€', '+2€'];
        const premioBadge = posicion <= 3 ? `<span class="premio-badge">${premios[posicion]}</span> ` : '';

        if (index === clasificacion.length - 1) {
            fila.classList.add('puesto-ultimo');
            fila.innerHTML = `
                <td>${premioBadge}${posicion}${flechaHtml} <span class="emoji-clown">🤡</span></td>
                <td><a href="perfil-${item.slug}.html" class="ultimo-puesto">${item.nombreVisible}</a></td>
                <td>${item.puntos} <span class="emoji-poop">💩</span></td>
                <td>${item.aciertos}</td>
                <td>${item.exactos}</td>
                ${tdProximo}
            `;
        } else {
            fila.innerHTML = `
                <td>${premioBadge}${posicion}${flechaHtml}${emojiCorona}${emojiPodio ? ` <span class="emoji-podio">${emojiPodio}</span>` : ''}</td>
                <td><a href="perfil-${item.slug}.html">${item.nombreVisible}</a></td>
                <td>${item.puntos}</td>
                <td>${item.aciertos}</td>
                <td>${item.exactos}</td>
                ${tdProximo}
            `;
        }
        tbody.appendChild(fila);
    });


    // Si el torneo terminó, mostrar ganador de la porra en el aviso
    if (avisoEl && pronosticosOficiales['M104']?.ganador && clasificacion.length > 0) {
        const ganador = clasificacion[0];
        const textoGanador = `🏆 ¡¡CAMPEÓN/ DE LA PORRA!! 🏆 ${ganador.nombreVisible.toUpperCase()} — ${ganador.puntos} PUNTOS · ${ganador.aciertos} ACIERTOS 🥳🎉`;
        avisoEl.innerHTML = `<span class="aviso-scroll">${textoGanador}</span>`;
    } else if (avisoEl && clasificacion.length > 0) {
        // Si estamos en fase eliminatoria, mostrar ranking de puntos de la ronda activa
        const rondaActiva = detectarUltimaRondaElimActiva(pronosticosOficiales);
        if (rondaActiva) {
            const nombresRonda = { R32: 'Dieciseisavos', R16: 'Octavos de Final', R8: 'Cuartos de Final', R4: 'Semifinales', Final: 'Final' };
            const rankingRonda = [...clasificacion]
                .sort((a, b) => (b.puntosPorRonda?.[rondaActiva] || 0) - (a.puntosPorRonda?.[rondaActiva] || 0));
            const textoRanking = rankingRonda
                .map((j, i) => `${i + 1}. ${j.nombreVisible} (${j.puntosPorRonda?.[rondaActiva] || 0}pts)`)
                .join(' · ');
            avisoEl.innerHTML = `<span class="aviso-scroll">📊 Puntos ${nombresRonda[rondaActiva]}: ${textoRanking}</span>`;
        }
    }

    // Revelar la tabla con fade-in (evita el flash de contenido estático)
    tabla.classList.add('tabla-lista');


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

        card.classList.remove('acierto-exacto', 'acierto-signo', 'acierto-nulo');

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
            return;
        }

        // Partido confirmado pero sin puntos
        card.classList.add('acierto-nulo');
        const badge = document.createElement('span');
        badge.className = 'badge-puntos badge-nulo';
        badge.textContent = '0';
        card.prepend(badge);
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

/**
 * Formatea un ISO timestamp a "DD/MM/YYYY HH:MM:SS" en hora local.
 */
function formatearTimestamp(isoString) {
    const d = new Date(isoString);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} a las ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Devuelve el HTML del círculo ℹ de timestamp para una card de partido.
 */
function infoTimestampHtml(ts) {
    if (!ts) return '';
    return `<button class="btn-info-timestamp" type="button" data-ts="${ts}" aria-label="Ver hora de confirmación">ℹ️<span class="tooltip-ts">📅 Grabado el ${formatearTimestamp(ts)}</span></button>`;
}

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
          const tsHtml = infoTimestampHtml(resultadoGuardado?.timestamp);


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
                ${tsHtml}
                ${esPaginaPartidos ? `<div class="flip-acertantes" data-partido="${nombrePartido}"><div class="flip-inner"><div class="flip-front">Acertantes Exactos</div><div class="flip-back"><div class="flip-back-content">Cargando...</div></div></div></div>` : ''}
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
        { id: 'ronda-r32', nombre: 'Dieciseisavos', funcion: generarDieciseisavos, ronda: 'R32' },
        { id: 'ronda-r16', nombre: 'Octavos', funcion: () => generarRonda('R16'), ronda: 'R16' },
        { id: 'ronda-r8', nombre: 'Cuartos', funcion: () => generarRonda('R8'), ronda: 'R8' },
        { id: 'ronda-r4', nombre: 'Semis', funcion: () => generarRonda('R4'), ronda: 'R4' },
        { id: 'ronda-final', nombre: 'FINAL', funcion: () => generarRonda('Final'), ronda: 'Final', esFinal: true },
    ];
    
    rondasEliminatorias.forEach(rondaData => {
        const buttonRonda = document.createElement('button');
        buttonRonda.className = 'tab-button' + (rondaData.esFinal ? ' tab-button-final' : '');
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
        if (esPaginaPartidos) {
            const passConfirmar = prompt('¿Estás tonto? Esto es solo para el administrador. Introduzca contraseña para confirmar resultado');
            if (passConfirmar === null) return;
            if (ph(passConfirmar) !== 'e7c503a2') {
                alert('Contraseña incorrecta. No se ha confirmado el resultado.');
                return;
            }
        }

        const golLocal = parseInt(inputLocal.value);
        const golVisitante = parseInt(inputVisitante.value);

        if (isNaN(golLocal) || isNaN(golVisitante) || golLocal < 0 || golVisitante < 0) {
            alert('Por favor, introduce puntuaciones válidas (números no negativos).');
            return;
        }

        pronosticosConfirmados[nombrePartido] = {
            local: golLocal,
            visitante: golVisitante,
            grupo: grupoNombre,
            timestamp: new Date().toISOString()
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

        // Inyectar o actualizar el círculo de info de timestamp en el DOM
        const tsExistente = partidoCard.querySelector('.btn-info-timestamp');
        if (tsExistente) tsExistente.remove();
        partidoCard.querySelector('.acciones').insertAdjacentHTML(
            'beforeend',
            infoTimestampHtml(pronosticosConfirmados[nombrePartido].timestamp)
        );

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


const combinacionesOficiales = {
  "ABCDEFGH": {74: "C", 77: "F", 79: "H", 80: "E", 81: "B", 82: "A", 85: "G", 87: "D"},
  "ABCDEFGI": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABCDEFGJ": {74: "D", 77: "F", 79: "C", 80: "J", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABCDEFGK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABCDEFGL": {74: "D", 77: "F", 79: "C", 80: "E", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDEFHI": {74: "C", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "E", 87: "D"},
  "ABCDEFHJ": {74: "C", 77: "F", 79: "H", 80: "E", 81: "B", 82: "A", 85: "J", 87: "D"},
  "ABCDEFHK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "E", 87: "D"},
  "ABCDEFHL": {74: "C", 77: "D", 79: "H", 80: "E", 81: "B", 82: "A", 85: "F", 87: "L"},
  "ABCDEFIJ": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABCDEFIK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "A", 85: "E", 87: "I"},
  "ABCDEFIL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "A", 85: "E", 87: "L"},
  "ABCDEFJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABCDEFJL": {74: "D", 77: "F", 79: "C", 80: "E", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCDEFKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "A", 85: "E", 87: "L"},
  "ABCDEGHI": {74: "C", 77: "D", 79: "H", 80: "I", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABCDEGHJ": {74: "C", 77: "D", 79: "H", 80: "J", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABCDEGHK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABCDEGHL": {74: "C", 77: "D", 79: "H", 80: "E", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDEGIJ": {74: "C", 77: "D", 79: "E", 80: "J", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABCDEGIK": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABCDEGIL": {74: "C", 77: "D", 79: "E", 80: "I", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDEGJK": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "J"},
  "ABCDEGJL": {74: "C", 77: "D", 79: "E", 80: "J", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDEGKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDEHIJ": {74: "C", 77: "D", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABCDEHIK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "E", 87: "I"},
  "ABCDEHIL": {74: "C", 77: "D", 79: "H", 80: "I", 81: "B", 82: "A", 85: "E", 87: "L"},
  "ABCDEHJK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABCDEHJL": {74: "C", 77: "D", 79: "H", 80: "E", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCDEHKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "E", 87: "L"},
  "ABCDEIJK": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABCDEIJL": {74: "C", 77: "D", 79: "E", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCDEIKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "A", 85: "I", 87: "L"},
  "ABCDEJKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCDFGHI": {74: "C", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "G", 87: "D"},
  "ABCDFGHJ": {74: "C", 77: "F", 79: "H", 80: "J", 81: "B", 82: "A", 85: "G", 87: "D"},
  "ABCDFGHK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "D"},
  "ABCDFGHL": {74: "D", 77: "F", 79: "C", 80: "H", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDFGIJ": {74: "D", 77: "F", 79: "C", 80: "J", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABCDFGIK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABCDFGIL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDFGJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "A", 85: "G", 87: "J"},
  "ABCDFGJL": {74: "D", 77: "F", 79: "C", 80: "J", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDFGKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDFHIJ": {74: "C", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "D"},
  "ABCDFHIK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "F", 87: "I"},
  "ABCDFHIL": {74: "C", 77: "D", 79: "H", 80: "I", 81: "B", 82: "A", 85: "F", 87: "L"},
  "ABCDFHJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "D"},
  "ABCDFHJL": {74: "D", 77: "F", 79: "C", 80: "H", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCDFHKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "F", 87: "L"},
  "ABCDFIJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABCDFIJL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCDFIKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "A", 85: "I", 87: "L"},
  "ABCDFJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCDGHIJ": {74: "C", 77: "D", 79: "H", 80: "J", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABCDGHIK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABCDGHIL": {74: "C", 77: "D", 79: "H", 80: "I", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDGHJK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "J"},
  "ABCDGHJL": {74: "C", 77: "D", 79: "H", 80: "J", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDGHKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDGIJK": {74: "D", 77: "G", 79: "C", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABCDGIJL": {74: "D", 77: "G", 79: "C", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCDGIKL": {74: "C", 77: "D", 79: "I", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCDGJKL": {74: "D", 77: "G", 79: "C", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCDHIJK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABCDHIJL": {74: "C", 77: "D", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCDHIKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "I", 87: "L"},
  "ABCDHJKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCDIJKL": {74: "C", 77: "D", 79: "I", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCEFGHI": {74: "C", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABCEFGHJ": {74: "C", 77: "F", 79: "H", 80: "J", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABCEFGHK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABCEFGHL": {74: "C", 77: "F", 79: "H", 80: "E", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCEFGIJ": {74: "C", 77: "F", 79: "E", 80: "J", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABCEFGIK": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABCEFGIL": {74: "C", 77: "F", 79: "E", 80: "I", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCEFGJK": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "J"},
  "ABCEFGJL": {74: "C", 77: "F", 79: "E", 80: "J", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCEFGKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCEFHIJ": {74: "C", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABCEFHIK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "E", 87: "I"},
  "ABCEFHIL": {74: "C", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "E", 87: "L"},
  "ABCEFHJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABCEFHJL": {74: "C", 77: "F", 79: "H", 80: "E", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCEFHKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "E", 87: "L"},
  "ABCEFIJK": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABCEFIJL": {74: "C", 77: "F", 79: "E", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCEFIKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "I", 87: "L"},
  "ABCEFJKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCEGHIJ": {74: "C", 77: "G", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABCEGHIK": {74: "C", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABCEGHIL": {74: "C", 77: "H", 79: "E", 80: "I", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCEGHJK": {74: "C", 77: "G", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABCEGHJL": {74: "C", 77: "G", 79: "H", 80: "E", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCEGHKL": {74: "C", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCEGIJK": {74: "C", 77: "G", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABCEGIJL": {74: "C", 77: "G", 79: "E", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCEGIKL": {74: "A", 77: "C", 79: "E", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "ABCEGJKL": {74: "C", 77: "G", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCEHIJK": {74: "C", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABCEHIJL": {74: "C", 77: "H", 79: "E", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCEHIKL": {74: "C", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "I", 87: "L"},
  "ABCEHJKL": {74: "C", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCEIJKL": {74: "A", 77: "C", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "ABCFGHIJ": {74: "C", 77: "F", 79: "H", 80: "J", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABCFGHIK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABCFGHIL": {74: "C", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCFGHJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "J"},
  "ABCFGHJL": {74: "C", 77: "F", 79: "H", 80: "J", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCFGHKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCFGIJK": {74: "F", 77: "G", 79: "C", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABCFGIJL": {74: "F", 77: "G", 79: "C", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCFGIKL": {74: "C", 77: "F", 79: "I", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCFGJKL": {74: "F", 77: "G", 79: "C", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCFHIJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABCFHIJL": {74: "C", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCFHIKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "I", 87: "L"},
  "ABCFHJKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCFIJKL": {74: "C", 77: "F", 79: "I", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCGHIJK": {74: "C", 77: "G", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABCGHIJL": {74: "C", 77: "G", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCGHIKL": {74: "C", 77: "H", 79: "I", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABCGHJKL": {74: "C", 77: "G", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCGIJKL": {74: "C", 77: "G", 79: "I", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABCHIJKL": {74: "C", 77: "H", 79: "I", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDEFGHI": {74: "D", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABDEFGHJ": {74: "D", 77: "F", 79: "H", 80: "J", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABDEFGHK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "E"},
  "ABDEFGHL": {74: "D", 77: "F", 79: "H", 80: "E", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABDEFGIJ": {74: "D", 77: "F", 79: "E", 80: "J", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABDEFGIK": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABDEFGIL": {74: "D", 77: "F", 79: "E", 80: "I", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABDEFGJK": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "J"},
  "ABDEFGJL": {74: "D", 77: "F", 79: "E", 80: "J", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABDEFGKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABDEFHIJ": {74: "D", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABDEFHIK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "E", 87: "I"},
  "ABDEFHIL": {74: "D", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "E", 87: "L"},
  "ABDEFHJK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABDEFHJL": {74: "D", 77: "F", 79: "H", 80: "E", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDEFHKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "E", 87: "L"},
  "ABDEFIJK": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABDEFIJL": {74: "D", 77: "F", 79: "E", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDEFIKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "I", 87: "L"},
  "ABDEFJKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDEGHIJ": {74: "D", 77: "G", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABDEGHIK": {74: "D", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABDEGHIL": {74: "D", 77: "H", 79: "E", 80: "I", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABDEGHJK": {74: "D", 77: "G", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABDEGHJL": {74: "D", 77: "G", 79: "H", 80: "E", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDEGHKL": {74: "D", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABDEGIJK": {74: "D", 77: "G", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABDEGIJL": {74: "D", 77: "G", 79: "E", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDEGIKL": {74: "A", 77: "D", 79: "E", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "ABDEGJKL": {74: "D", 77: "G", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDEHIJK": {74: "D", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABDEHIJL": {74: "D", 77: "H", 79: "E", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDEHIKL": {74: "D", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "I", 87: "L"},
  "ABDEHJKL": {74: "D", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDEIJKL": {74: "A", 77: "D", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "ABDFGHIJ": {74: "D", 77: "F", 79: "H", 80: "J", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABDFGHIK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABDFGHIL": {74: "D", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABDFGHJK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "J"},
  "ABDFGHJL": {74: "D", 77: "F", 79: "H", 80: "J", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABDFGHKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABDFGIJK": {74: "D", 77: "G", 79: "F", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABDFGIJL": {74: "D", 77: "G", 79: "F", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDFGIKL": {74: "D", 77: "F", 79: "I", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABDFGJKL": {74: "D", 77: "G", 79: "F", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDFHIJK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABDFHIJL": {74: "D", 77: "F", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDFHIKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "I", 87: "L"},
  "ABDFHJKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDFIJKL": {74: "D", 77: "F", 79: "I", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDGHIJK": {74: "D", 77: "G", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABDGHIJL": {74: "D", 77: "G", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDGHIKL": {74: "D", 77: "H", 79: "I", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABDGHJKL": {74: "D", 77: "G", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDGIJKL": {74: "D", 77: "G", 79: "I", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABDHIJKL": {74: "D", 77: "H", 79: "I", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABEFGHIJ": {74: "F", 77: "G", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABEFGHIK": {74: "F", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "I"},
  "ABEFGHIL": {74: "F", 77: "H", 79: "E", 80: "I", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABEFGHJK": {74: "F", 77: "G", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "E"},
  "ABEFGHJL": {74: "F", 77: "G", 79: "H", 80: "E", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABEFGHKL": {74: "F", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "G", 87: "L"},
  "ABEFGIJK": {74: "F", 77: "G", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABEFGIJL": {74: "F", 77: "G", 79: "E", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABEFGIKL": {74: "A", 77: "F", 79: "E", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "ABEFGJKL": {74: "F", 77: "G", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABEFHIJK": {74: "F", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABEFHIJL": {74: "F", 77: "H", 79: "E", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABEFHIKL": {74: "F", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "I", 87: "L"},
  "ABEFHJKL": {74: "F", 77: "H", 79: "E", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABEFIJKL": {74: "A", 77: "F", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "ABEGHIJK": {74: "A", 77: "G", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "I"},
  "ABEGHIJL": {74: "A", 77: "G", 79: "E", 80: "I", 81: "B", 82: "H", 85: "J", 87: "L"},
  "ABEGHIKL": {74: "A", 77: "H", 79: "E", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "ABEGHJKL": {74: "A", 77: "G", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "L"},
  "ABEGIJKL": {74: "A", 77: "G", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "ABEHIJKL": {74: "A", 77: "H", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "ABFGHIJK": {74: "F", 77: "G", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "I"},
  "ABFGHIJL": {74: "F", 77: "G", 79: "H", 80: "I", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABFGHIKL": {74: "A", 77: "F", 79: "H", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "ABFGHJKL": {74: "F", 77: "G", 79: "H", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABFGIJKL": {74: "F", 77: "G", 79: "I", 80: "K", 81: "B", 82: "A", 85: "J", 87: "L"},
  "ABFHIJKL": {74: "A", 77: "F", 79: "H", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "ABGHIJKL": {74: "A", 77: "G", 79: "H", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "ACDEFGHI": {74: "C", 77: "F", 79: "H", 80: "I", 81: "E", 82: "A", 85: "G", 87: "D"},
  "ACDEFGHJ": {74: "C", 77: "F", 79: "H", 80: "E", 81: "J", 82: "A", 85: "G", 87: "D"},
  "ACDEFGHK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "E", 82: "A", 85: "G", 87: "D"},
  "ACDEFGHL": {74: "C", 77: "D", 79: "H", 80: "E", 81: "F", 82: "A", 85: "G", 87: "L"},
  "ACDEFGIJ": {74: "D", 77: "F", 79: "C", 80: "I", 81: "J", 82: "A", 85: "G", 87: "E"},
  "ACDEFGIK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "A", 85: "G", 87: "I"},
  "ACDEFGIL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "E", 82: "A", 85: "G", 87: "L"},
  "ACDEFGJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "J", 82: "A", 85: "G", 87: "E"},
  "ACDEFGJL": {74: "D", 77: "F", 79: "C", 80: "E", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACDEFGKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "A", 85: "G", 87: "L"},
  "ACDEFHIJ": {74: "C", 77: "F", 79: "H", 80: "I", 81: "E", 82: "A", 85: "J", 87: "D"},
  "ACDEFHIK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "F", 82: "A", 85: "E", 87: "I"},
  "ACDEFHIL": {74: "C", 77: "D", 79: "H", 80: "I", 81: "F", 82: "A", 85: "E", 87: "L"},
  "ACDEFHJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "E", 82: "A", 85: "J", 87: "D"},
  "ACDEFHJL": {74: "C", 77: "D", 79: "H", 80: "E", 81: "F", 82: "A", 85: "J", 87: "L"},
  "ACDEFHKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "F", 82: "A", 85: "E", 87: "L"},
  "ACDEFIJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "A", 85: "J", 87: "I"},
  "ACDEFIJL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "E", 82: "A", 85: "J", 87: "L"},
  "ACDEFIKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "I", 82: "A", 85: "E", 87: "L"},
  "ACDEFJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "A", 85: "J", 87: "L"},
  "ACDEGHIJ": {74: "C", 77: "D", 79: "H", 80: "I", 81: "J", 82: "A", 85: "G", 87: "E"},
  "ACDEGHIK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "E", 82: "A", 85: "G", 87: "I"},
  "ACDEGHIL": {74: "C", 77: "D", 79: "H", 80: "I", 81: "E", 82: "A", 85: "G", 87: "L"},
  "ACDEGHJK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "J", 82: "A", 85: "G", 87: "E"},
  "ACDEGHJL": {74: "C", 77: "D", 79: "H", 80: "E", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACDEGHKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "E", 82: "A", 85: "G", 87: "L"},
  "ACDEGIJK": {74: "C", 77: "D", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "I"},
  "ACDEGIJL": {74: "C", 77: "D", 79: "E", 80: "I", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACDEGIKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "I", 82: "A", 85: "G", 87: "L"},
  "ACDEGJKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACDEHIJK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "E", 82: "A", 85: "J", 87: "I"},
  "ACDEHIJL": {74: "C", 77: "D", 79: "H", 80: "I", 81: "E", 82: "A", 85: "J", 87: "L"},
  "ACDEHIKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "I", 82: "A", 85: "E", 87: "L"},
  "ACDEHJKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "E", 82: "A", 85: "J", 87: "L"},
  "ACDEIJKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ACDFGHIJ": {74: "C", 77: "F", 79: "H", 80: "I", 81: "J", 82: "A", 85: "G", 87: "D"},
  "ACDFGHIK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "F", 82: "A", 85: "G", 87: "I"},
  "ACDFGHIL": {74: "C", 77: "D", 79: "H", 80: "I", 81: "F", 82: "A", 85: "G", 87: "L"},
  "ACDFGHJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "J", 82: "A", 85: "G", 87: "D"},
  "ACDFGHJL": {74: "D", 77: "F", 79: "C", 80: "H", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACDFGHKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "F", 82: "A", 85: "G", 87: "L"},
  "ACDFGIJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "J", 82: "A", 85: "G", 87: "I"},
  "ACDFGIJL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACDFGIKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "I", 82: "A", 85: "G", 87: "L"},
  "ACDFGJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACDFHIJK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "F", 82: "A", 85: "J", 87: "I"},
  "ACDFHIJL": {74: "C", 77: "D", 79: "H", 80: "I", 81: "F", 82: "A", 85: "J", 87: "L"},
  "ACDFHIKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "I", 82: "A", 85: "F", 87: "L"},
  "ACDFHJKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "F", 82: "A", 85: "J", 87: "L"},
  "ACDFIJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ACDGHIJK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "J", 82: "A", 85: "G", 87: "I"},
  "ACDGHIJL": {74: "C", 77: "D", 79: "H", 80: "I", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACDGHIKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "I", 82: "A", 85: "G", 87: "L"},
  "ACDGHJKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACDGIJKL": {74: "C", 77: "D", 79: "I", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACDHIJKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ACEFGHIJ": {74: "C", 77: "F", 79: "H", 80: "I", 81: "J", 82: "A", 85: "G", 87: "E"},
  "ACEFGHIK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "E", 82: "A", 85: "G", 87: "I"},
  "ACEFGHIL": {74: "C", 77: "F", 79: "H", 80: "I", 81: "E", 82: "A", 85: "G", 87: "L"},
  "ACEFGHJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "J", 82: "A", 85: "G", 87: "E"},
  "ACEFGHJL": {74: "C", 77: "F", 79: "H", 80: "E", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACEFGHKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "E", 82: "A", 85: "G", 87: "L"},
  "ACEFGIJK": {74: "C", 77: "F", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "I"},
  "ACEFGIJL": {74: "C", 77: "F", 79: "E", 80: "I", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACEFGIKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "I", 82: "A", 85: "G", 87: "L"},
  "ACEFGJKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACEFHIJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "E", 82: "A", 85: "J", 87: "I"},
  "ACEFHIJL": {74: "C", 77: "F", 79: "H", 80: "I", 81: "E", 82: "A", 85: "J", 87: "L"},
  "ACEFHIKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "I", 82: "A", 85: "E", 87: "L"},
  "ACEFHJKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "E", 82: "A", 85: "J", 87: "L"},
  "ACEFIJKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ACEGHIJK": {74: "C", 77: "H", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "I"},
  "ACEGHIJL": {74: "C", 77: "H", 79: "E", 80: "I", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACEGHIKL": {74: "C", 77: "H", 79: "E", 80: "K", 81: "I", 82: "A", 85: "G", 87: "L"},
  "ACEGHJKL": {74: "C", 77: "H", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACEGIJKL": {74: "C", 77: "G", 79: "E", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ACEHIJKL": {74: "C", 77: "H", 79: "E", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ACFGHIJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "J", 82: "A", 85: "G", 87: "I"},
  "ACFGHIJL": {74: "C", 77: "F", 79: "H", 80: "I", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACFGHIKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "I", 82: "A", 85: "G", 87: "L"},
  "ACFGHJKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACFGIJKL": {74: "C", 77: "F", 79: "I", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ACFHIJKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ACGHIJKL": {74: "C", 77: "G", 79: "H", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ADEFGHIJ": {74: "D", 77: "F", 79: "H", 80: "I", 81: "J", 82: "A", 85: "G", 87: "E"},
  "ADEFGHIK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "E", 82: "A", 85: "G", 87: "I"},
  "ADEFGHIL": {74: "D", 77: "F", 79: "H", 80: "I", 81: "E", 82: "A", 85: "G", 87: "L"},
  "ADEFGHJK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "J", 82: "A", 85: "G", 87: "E"},
  "ADEFGHJL": {74: "D", 77: "F", 79: "H", 80: "E", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ADEFGHKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "E", 82: "A", 85: "G", 87: "L"},
  "ADEFGIJK": {74: "D", 77: "F", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "I"},
  "ADEFGIJL": {74: "D", 77: "F", 79: "E", 80: "I", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ADEFGIKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "I", 82: "A", 85: "G", 87: "L"},
  "ADEFGJKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ADEFHIJK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "E", 82: "A", 85: "J", 87: "I"},
  "ADEFHIJL": {74: "D", 77: "F", 79: "H", 80: "I", 81: "E", 82: "A", 85: "J", 87: "L"},
  "ADEFHIKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "I", 82: "A", 85: "E", 87: "L"},
  "ADEFHJKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "E", 82: "A", 85: "J", 87: "L"},
  "ADEFIJKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ADEGHIJK": {74: "D", 77: "H", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "I"},
  "ADEGHIJL": {74: "D", 77: "H", 79: "E", 80: "I", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ADEGHIKL": {74: "D", 77: "H", 79: "E", 80: "K", 81: "I", 82: "A", 85: "G", 87: "L"},
  "ADEGHJKL": {74: "D", 77: "H", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ADEGIJKL": {74: "D", 77: "G", 79: "E", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ADEHIJKL": {74: "D", 77: "H", 79: "E", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ADFGHIJK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "J", 82: "A", 85: "G", 87: "I"},
  "ADFGHIJL": {74: "D", 77: "F", 79: "H", 80: "I", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ADFGHIKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "I", 82: "A", 85: "G", 87: "L"},
  "ADFGHJKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ADFGIJKL": {74: "D", 77: "F", 79: "I", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "ADFHIJKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "ADGHIJKL": {74: "D", 77: "G", 79: "H", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "AEFGHIJK": {74: "F", 77: "H", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "I"},
  "AEFGHIJL": {74: "F", 77: "H", 79: "E", 80: "I", 81: "J", 82: "A", 85: "G", 87: "L"},
  "AEFGHIKL": {74: "F", 77: "H", 79: "E", 80: "K", 81: "I", 82: "A", 85: "G", 87: "L"},
  "AEFGHJKL": {74: "F", 77: "H", 79: "E", 80: "K", 81: "J", 82: "A", 85: "G", 87: "L"},
  "AEFGIJKL": {74: "F", 77: "G", 79: "E", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "AEFHIJKL": {74: "F", 77: "H", 79: "E", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "AEGHIJKL": {74: "A", 77: "G", 79: "E", 80: "K", 81: "I", 82: "H", 85: "J", 87: "L"},
  "AFGHIJKL": {74: "F", 77: "G", 79: "H", 80: "K", 81: "I", 82: "A", 85: "J", 87: "L"},
  "BCDEFGHI": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "H", 85: "G", 87: "E"},
  "BCDEFGHJ": {74: "C", 77: "F", 79: "H", 80: "E", 81: "B", 82: "J", 85: "G", 87: "D"},
  "BCDEFGHK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "H", 85: "G", 87: "E"},
  "BCDEFGHL": {74: "D", 77: "F", 79: "C", 80: "E", 81: "B", 82: "H", 85: "G", 87: "L"},
  "BCDEFGIJ": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "J", 85: "G", 87: "E"},
  "BCDEFGIK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "E", 85: "G", 87: "I"},
  "BCDEFGIL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "E", 85: "G", 87: "L"},
  "BCDEFGJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "J", 85: "G", 87: "E"},
  "BCDEFGJL": {74: "D", 77: "F", 79: "C", 80: "E", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCDEFGKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "E", 85: "G", 87: "L"},
  "BCDEFHIJ": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "H", 85: "J", 87: "E"},
  "BCDEFHIK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "H", 85: "E", 87: "I"},
  "BCDEFHIL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "H", 85: "E", 87: "L"},
  "BCDEFHJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "H", 85: "J", 87: "E"},
  "BCDEFHJL": {74: "D", 77: "F", 79: "C", 80: "E", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BCDEFHKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "H", 85: "E", 87: "L"},
  "BCDEFIJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "E", 85: "J", 87: "I"},
  "BCDEFIJL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "E", 85: "J", 87: "L"},
  "BCDEFIKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "I", 85: "E", 87: "L"},
  "BCDEFJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "E", 85: "J", 87: "L"},
  "BCDEGHIJ": {74: "C", 77: "D", 79: "H", 80: "I", 81: "B", 82: "J", 85: "G", 87: "E"},
  "BCDEGHIK": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "H", 85: "G", 87: "I"},
  "BCDEGHIL": {74: "C", 77: "D", 79: "E", 80: "I", 81: "B", 82: "H", 85: "G", 87: "L"},
  "BCDEGHJK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "J", 85: "G", 87: "E"},
  "BCDEGHJL": {74: "C", 77: "D", 79: "H", 80: "E", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCDEGHKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "H", 85: "G", 87: "L"},
  "BCDEGIJK": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "J", 85: "G", 87: "I"},
  "BCDEGIJL": {74: "C", 77: "D", 79: "E", 80: "I", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCDEGIKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "BCDEGJKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCDEHIJK": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "I"},
  "BCDEHIJL": {74: "C", 77: "D", 79: "E", 80: "I", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BCDEHIKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "H", 85: "I", 87: "L"},
  "BCDEHJKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BCDEIJKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BCDFGHIJ": {74: "C", 77: "F", 79: "H", 80: "I", 81: "B", 82: "J", 85: "G", 87: "D"},
  "BCDFGHIK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "H", 85: "G", 87: "I"},
  "BCDFGHIL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "H", 85: "G", 87: "L"},
  "BCDFGHJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "J", 85: "G", 87: "D"},
  "BCDFGHJL": {74: "D", 77: "F", 79: "C", 80: "J", 81: "B", 82: "H", 85: "G", 87: "L"},
  "BCDFGHKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "H", 85: "G", 87: "L"},
  "BCDFGIJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "J", 85: "G", 87: "I"},
  "BCDFGIJL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCDFGIKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "BCDFGJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCDFHIJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "H", 85: "J", 87: "I"},
  "BCDFHIJL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BCDFHIKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "H", 85: "I", 87: "L"},
  "BCDFHJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BCDFIJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BCDGHIJK": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "J", 85: "G", 87: "I"},
  "BCDGHIJL": {74: "C", 77: "D", 79: "H", 80: "I", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCDGHIKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "BCDGHJKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCDGIJKL": {74: "C", 77: "D", 79: "I", 80: "K", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCDHIJKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BCEFGHIJ": {74: "C", 77: "F", 79: "H", 80: "I", 81: "B", 82: "J", 85: "G", 87: "E"},
  "BCEFGHIK": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "H", 85: "G", 87: "I"},
  "BCEFGHIL": {74: "C", 77: "F", 79: "E", 80: "I", 81: "B", 82: "H", 85: "G", 87: "L"},
  "BCEFGHJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "J", 85: "G", 87: "E"},
  "BCEFGHJL": {74: "C", 77: "F", 79: "H", 80: "E", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCEFGHKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "H", 85: "G", 87: "L"},
  "BCEFGIJK": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "J", 85: "G", 87: "I"},
  "BCEFGIJL": {74: "C", 77: "F", 79: "E", 80: "I", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCEFGIKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "BCEFGJKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCEFHIJK": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "I"},
  "BCEFHIJL": {74: "C", 77: "F", 79: "E", 80: "I", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BCEFHIKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "H", 85: "I", 87: "L"},
  "BCEFHJKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BCEFIJKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BCEGHIJK": {74: "C", 77: "G", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "I"},
  "BCEGHIJL": {74: "C", 77: "G", 79: "E", 80: "I", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BCEGHIKL": {74: "C", 77: "H", 79: "E", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "BCEGHJKL": {74: "C", 77: "G", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BCEGIJKL": {74: "C", 77: "G", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BCEHIJKL": {74: "C", 77: "H", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BCFGHIJK": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "J", 85: "G", 87: "I"},
  "BCFGHIJL": {74: "C", 77: "F", 79: "H", 80: "I", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCFGHIKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "BCFGHJKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCFGIJKL": {74: "C", 77: "F", 79: "I", 80: "K", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BCFHIJKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BCGHIJKL": {74: "C", 77: "G", 79: "H", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BDEFGHIJ": {74: "D", 77: "F", 79: "H", 80: "I", 81: "B", 82: "J", 85: "G", 87: "E"},
  "BDEFGHIK": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "H", 85: "G", 87: "I"},
  "BDEFGHIL": {74: "D", 77: "F", 79: "E", 80: "I", 81: "B", 82: "H", 85: "G", 87: "L"},
  "BDEFGHJK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "J", 85: "G", 87: "E"},
  "BDEFGHJL": {74: "D", 77: "F", 79: "H", 80: "E", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BDEFGHKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "H", 85: "G", 87: "L"},
  "BDEFGIJK": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "J", 85: "G", 87: "I"},
  "BDEFGIJL": {74: "D", 77: "F", 79: "E", 80: "I", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BDEFGIKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "BDEFGJKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BDEFHIJK": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "I"},
  "BDEFHIJL": {74: "D", 77: "F", 79: "E", 80: "I", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BDEFHIKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "H", 85: "I", 87: "L"},
  "BDEFHJKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BDEFIJKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BDEGHIJK": {74: "D", 77: "G", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "I"},
  "BDEGHIJL": {74: "D", 77: "G", 79: "E", 80: "I", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BDEGHIKL": {74: "D", 77: "H", 79: "E", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "BDEGHJKL": {74: "D", 77: "G", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BDEGIJKL": {74: "D", 77: "G", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BDEHIJKL": {74: "D", 77: "H", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BDFGHIJK": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "J", 85: "G", 87: "I"},
  "BDFGHIJL": {74: "D", 77: "F", 79: "H", 80: "I", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BDFGHIKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "BDFGHJKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BDFGIJKL": {74: "D", 77: "F", 79: "I", 80: "K", 81: "B", 82: "J", 85: "G", 87: "L"},
  "BDFHIJKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BDGHIJKL": {74: "D", 77: "G", 79: "H", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BEFGHIJK": {74: "F", 77: "G", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "I"},
  "BEFGHIJL": {74: "F", 77: "G", 79: "E", 80: "I", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BEFGHIKL": {74: "F", 77: "H", 79: "E", 80: "K", 81: "B", 82: "I", 85: "G", 87: "L"},
  "BEFGHJKL": {74: "F", 77: "G", 79: "E", 80: "K", 81: "B", 82: "H", 85: "J", 87: "L"},
  "BEFGIJKL": {74: "F", 77: "G", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BEFHIJKL": {74: "F", 77: "H", 79: "E", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "BEGHIJKL": {74: "B", 77: "G", 79: "E", 80: "K", 81: "I", 82: "H", 85: "J", 87: "L"},
  "BFGHIJKL": {74: "F", 77: "G", 79: "H", 80: "K", 81: "B", 82: "I", 85: "J", 87: "L"},
  "CDEFGHIJ": {74: "D", 77: "F", 79: "C", 80: "I", 81: "J", 82: "H", 85: "G", 87: "E"},
  "CDEFGHIK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "H", 85: "G", 87: "I"},
  "CDEFGHIL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "E", 82: "H", 85: "G", 87: "L"},
  "CDEFGHJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "J", 82: "H", 85: "G", 87: "E"},
  "CDEFGHJL": {74: "D", 77: "F", 79: "C", 80: "E", 81: "J", 82: "H", 85: "G", 87: "L"},
  "CDEFGHKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "H", 85: "G", 87: "L"},
  "CDEFGIJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "J", 85: "G", 87: "I"},
  "CDEFGIJL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "E", 82: "J", 85: "G", 87: "L"},
  "CDEFGIKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "I", 85: "G", 87: "L"},
  "CDEFGJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "J", 85: "G", 87: "L"},
  "CDEFHIJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "H", 85: "J", 87: "I"},
  "CDEFHIJL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "E", 82: "H", 85: "J", 87: "L"},
  "CDEFHIKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "I", 82: "H", 85: "E", 87: "L"},
  "CDEFHJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "H", 85: "J", 87: "L"},
  "CDEFIJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "E", 82: "I", 85: "J", 87: "L"},
  "CDEGHIJK": {74: "C", 77: "D", 79: "E", 80: "K", 81: "J", 82: "H", 85: "G", 87: "I"},
  "CDEGHIJL": {74: "C", 77: "D", 79: "E", 80: "I", 81: "J", 82: "H", 85: "G", 87: "L"},
  "CDEGHIKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "I", 82: "H", 85: "G", 87: "L"},
  "CDEGHJKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "J", 82: "H", 85: "G", 87: "L"},
  "CDEGIJKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "I", 82: "J", 85: "G", 87: "L"},
  "CDEHIJKL": {74: "C", 77: "D", 79: "E", 80: "K", 81: "I", 82: "H", 85: "J", 87: "L"},
  "CDFGHIJK": {74: "D", 77: "F", 79: "C", 80: "K", 81: "J", 82: "H", 85: "G", 87: "I"},
  "CDFGHIJL": {74: "D", 77: "F", 79: "C", 80: "I", 81: "J", 82: "H", 85: "G", 87: "L"},
  "CDFGHIKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "I", 82: "H", 85: "G", 87: "L"},
  "CDFGHJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "J", 82: "H", 85: "G", 87: "L"},
  "CDFGIJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "I", 82: "J", 85: "G", 87: "L"},
  "CDFHIJKL": {74: "D", 77: "F", 79: "C", 80: "K", 81: "I", 82: "H", 85: "J", 87: "L"},
  "CDGHIJKL": {74: "C", 77: "D", 79: "H", 80: "K", 81: "I", 82: "J", 85: "G", 87: "L"},
  "CEFGHIJK": {74: "C", 77: "F", 79: "E", 80: "K", 81: "J", 82: "H", 85: "G", 87: "I"},
  "CEFGHIJL": {74: "C", 77: "F", 79: "E", 80: "I", 81: "J", 82: "H", 85: "G", 87: "L"},
  "CEFGHIKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "I", 82: "H", 85: "G", 87: "L"},
  "CEFGHJKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "J", 82: "H", 85: "G", 87: "L"},
  "CEFGIJKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "I", 82: "J", 85: "G", 87: "L"},
  "CEFHIJKL": {74: "C", 77: "F", 79: "E", 80: "K", 81: "I", 82: "H", 85: "J", 87: "L"},
  "CEGHIJKL": {74: "C", 77: "G", 79: "E", 80: "K", 81: "I", 82: "H", 85: "J", 87: "L"},
  "CFGHIJKL": {74: "C", 77: "F", 79: "H", 80: "K", 81: "I", 82: "J", 85: "G", 87: "L"},
  "DEFGHIJK": {74: "D", 77: "F", 79: "E", 80: "K", 81: "J", 82: "H", 85: "G", 87: "I"},
  "DEFGHIJL": {74: "D", 77: "F", 79: "E", 80: "I", 81: "J", 82: "H", 85: "G", 87: "L"},
  "DEFGHIKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "I", 82: "H", 85: "G", 87: "L"},
  "DEFGHJKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "J", 82: "H", 85: "G", 87: "L"},
  "DEFGIJKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "I", 82: "J", 85: "G", 87: "L"},
  "DEFHIJKL": {74: "D", 77: "F", 79: "E", 80: "K", 81: "I", 82: "H", 85: "J", 87: "L"},
  "DEGHIJKL": {74: "D", 77: "G", 79: "E", 80: "K", 81: "I", 82: "H", 85: "J", 87: "L"},
  "DFGHIJKL": {74: "D", 77: "F", 79: "H", 80: "K", 81: "I", 82: "J", 85: "G", 87: "L"},
  "EFGHIJKL": {74: "F", 77: "G", 79: "E", 80: "K", 81: "I", 82: "H", 85: "J", 87: "L"},
};

function asignarTercerosASlots(tercerosMejores) {
    // Official FIFA Annex C lookup table (495 combinations)
    const grupos = tercerosMejores.map(t => t.grupo).sort().join('');
    const asignacion = combinacionesOficiales[grupos];
    if (!asignacion) {
        console.warn('Combinacion no encontrada en Annex C:', grupos);
        return {};
    }
    const porGrupo = {};
    tercerosMejores.forEach(t => porGrupo[t.grupo] = t.equipo);
    const resultado = {};
    for (const [slot, grupo] of Object.entries(asignacion)) {
        resultado[parseInt(slot)] = porGrupo[grupo] || null;
    }
    return resultado;
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

    // Comprobación simple para ver si la fase de grupos está completada
    if (Object.keys(pronosticosConfirmados).filter(k => k.includes(' vs ')).length < (12 * 6)) {
         return []; 
    }

    // Asignar los 8 mejores terceros a los slots respetando restricciones de grupo
    const terceroAsignado = asignarTercerosASlots(clasificados.terceros);

    const r32Partidos = [
        // Partido 73 – 2º Grupo A v 2º Grupo B 
        { llave: 73, equipo1: s['A'], equipo2: s['B'] }, 
        
        // Partido 74 – 1º Grupo E v 3º Grupo A/B/C/D/F
        { llave: 74, equipo1: p['E'], equipo2: terceroAsignado[74] || 'Tercero 1' },                               
        
        // Partido 75 – 1º Grupo F v 2º Grupo C 
        { llave: 75, equipo1: p['F'], equipo2: s['C'] },                               
        
        // Partido 76 – 1º Grupo C v 2º Grupo F 
        { llave: 76, equipo1: p['C'], equipo2: s['F'] }, 

        // Partido 77 – 1º Grupo I v 3º Grupo C/D/F/G/H
        { llave: 77, equipo1: p['I'], equipo2: terceroAsignado[77] || 'Tercero 2' },                               
        
        // Partido 78 – 2º Grupo E v 2º Grupo I 
        { llave: 78, equipo1: s['E'], equipo2: s['I'] },                               
        
        // Partido 79 – 1º Grupo A v 3º Grupo C/E/F/H/I
        { llave: 79, equipo1: p['A'], equipo2: terceroAsignado[79] || 'Tercero 3' },
        
        // Partido 80 – 1º Grupo L v 3º Grupo E/H/I/J/K
        { llave: 80, equipo1: p['L'], equipo2: terceroAsignado[80] || 'Tercero 4' },
        
        // Partido 81 – 1º Grupo D v 3º Grupo B/E/F/I/J
        { llave: 81, equipo1: p['D'], equipo2: terceroAsignado[81] || 'Tercero 5' },                               
        
        // Partido 82 – 1º Grupo G v 3º Grupo A/E/H/I/J
        { llave: 82, equipo1: p['G'], equipo2: terceroAsignado[82] || 'Tercero 6' },
        
        // Partido 83 – 2º Grupo K v 2º Grupo L 
        { llave: 83, equipo1: s['K'], equipo2: s['L'] },                               
        
        // Partido 84 – 1º Grupo H v 2º Grupo J 
        { llave: 84, equipo1: p['H'], equipo2: s['J'] },
        
        // Partido 85 – 1º Grupo B v 3º Grupo E/F/G/I/J
        { llave: 85, equipo1: p['B'], equipo2: terceroAsignado[85] || 'Tercero 7' },
        
        // Partido 86 – 1º Grupo J v 2º Grupo H 
        { llave: 86, equipo1: p['J'], equipo2: s['H'] },
        
        // Partido 87 – 1º Grupo K v 3º Grupo D/E/I/J/L
        { llave: 87, equipo1: p['K'], equipo2: terceroAsignado[87] || 'Tercero 8' },
        
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
            const mapaPuntosRonda = { R32: 2, R16: 3, R8: 5, R4: 7, Final: 12 };
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
                // Bonus campeón: +8 si acertó el ganador de la Final (M104)
                if (ronda === 'Final' && p.llave === 104) {
                    const pronOficial2 = (firebaseDisponible && pronosticosOficialesCache)
                        ? pronosticosOficialesCache
                        : cargarPronosticosPorClave(perfilesConfig.partidos.key);
                    const campeonOficial = pronOficial2['M104']?.ganador;
                    const campeonJugador = pronosticosConfirmados['M104']?.ganador;
                    if (campeonOficial && campeonJugador && campeonOficial === campeonJugador) {
                        puntosPartido += 8;
                    }
                }
            }

            const nombreLlave = p.nombreCompletoLlave; // M73, M89, M104, etc.
            const resultadoGuardado = pronosticosConfirmados[nombreLlave] || {};
            
            const ganadorElegido = resultadoGuardado.ganador; 
            const yaHayGanador = !!ganadorElegido; 

            const EQUIPO_1_TBD = p.equipo1 === 'TBD' || p.equipo1.includes('Tercero'); // Considerar Tercero X como TBD si no se ha resuelto
            const EQUIPO_2_TBD = p.equipo2 === 'TBD' || p.equipo2.includes('Tercero');
            const TBD_CLASS = (EQUIPO_1_TBD || EQUIPO_2_TBD) ? 'tbd-enfrentamiento' : '';

            let LLAVE_TITULO;
            let LLAVE_LABEL;
            if (ronda === 'Final') {
                if (p.llave === 104) {
                    LLAVE_TITULO = 'FINAL (M104)';
                    LLAVE_LABEL = `Final - FINAL (M104)`;
                } else {
                    LLAVE_TITULO = '3ER PUESTO (M103)';
                    LLAVE_LABEL = '3ER PUESTO (M103)';
                }
            } else {
                 LLAVE_TITULO = `PARTIDO M${p.llave}`;
                 LLAVE_LABEL = `${ronda} - PARTIDO M${p.llave}`;
            }
            
            // Clases para destacar el equipo elegido y deshabilitar si ya hay ganador
            const claseEquipo1 = (ganadorElegido === p.equipo1) ? 'elegido' : '';
            const claseEquipo2 = (ganadorElegido === p.equipo2) ? 'elegido' : '';
            const disabledClase = yaHayGanador ? 'deshabilitado' : '';
            const claseRonda = ronda === 'Final' ? (p.llave === 104 ? 'partido-final partido-campeon' : 'partido-tercero') : '';
            
            // Condición para deshabilitar los botones de elección
            const disableButtons = (EQUIPO_1_TBD || EQUIPO_2_TBD || yaHayGanador) ? 'disabled' : '';

            html += `
                <div class="partido-bracket ${TBD_CLASS} ${disabledClase} ${claseRonda}">
                    <span class="llave">${LLAVE_LABEL}</span>
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
                     ${resultadoGuardado.timestamp && yaHayGanador ? infoTimestampHtml(resultadoGuardado.timestamp) : ''}
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

    // Botón de reinicio de eliminatorias (solo en R32)
    if (ronda === 'R32' && partidos.length > 0) {
        html = `<div class="btn-reiniciar-elim-wrapper">
            <button type="button" class="btn-reiniciar-eliminatorias" id="btn-reiniciar-elim">
                🔄 Reiniciar eliminatorias
            </button>
        </div>` + html;
    }

    contenedor.innerHTML = html;

    // Listener del botón (se añade tras renderizar el DOM)
    const btnReinElim = contenedor.querySelector('#btn-reiniciar-elim');
    if (btnReinElim) {
        btnReinElim.addEventListener('click', reiniciarEliminatorias);
    }
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
        if (esPaginaPartidos) {
            const passConfirmar = prompt('meta contraseña para confirmar resultado');
            if (passConfirmar === null) return;
            if (ph(passConfirmar) !== 'e7c503a2') {
                alert('Contraseña incorrecta. No se ha confirmado el resultado.');
                return;
            }
        }

        const equipoGanador = boton.dataset.equipo;
        
        // 1. Guardar el ganador y el timestamp
        pronosticosConfirmados[llavePartido].ganador = equipoGanador;
        pronosticosConfirmados[llavePartido].timestamp = new Date().toISOString();
        
    } else if (esCambiar) {
        const pass = prompt("Introduce la contraseña para cambiar el ganador:");
        if (ph(pass) !== passwordReiniciar) {
            if (pass !== null) {
                alert("Contraseña incorrecta. No se ha modificado el ganador.");
            }
            return;
        }
        // 1. Eliminar el ganador y timestamp
        delete pronosticosConfirmados[llavePartido].ganador;
        delete pronosticosConfirmados[llavePartido].timestamp;
        
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
// 8b. TABLÓN DE COMENTARIOS (index.html)
// ====================================================================

const COMENTARIO_NOMBRE_KEY = 'comentario_nombre_mundial';
const COMENTARIOS_VISIBLES = 5;
let comentariosTablonCache = [];
let comentariosExpandido = false;

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function formatearFechaComentario(valor) {
    if (!valor) return '';
    const fecha = typeof valor.toDate === 'function' ? valor.toDate() : new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function nombresParticipantesOrdenados() {
    return Object.keys(PARTICIPANTES).sort((a, b) =>
        a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
}

function opcionesParticipantesHtml() {
    let seleccionado = '';
    try {
        const guardado = localStorage.getItem(COMENTARIO_NOMBRE_KEY);
        if (guardado && PARTICIPANTES[guardado]) seleccionado = guardado;
    } catch (e) { /* ignorar */ }

    const opciones = nombresParticipantesOrdenados()
        .map((n) => `<option value="${escaparHtml(n)}"${n === seleccionado ? ' selected' : ''}>${escaparHtml(n)}</option>`)
        .join('');
    return `<option value="">Tu nombre...</option>${opciones}`;
}

function renderRespuestaHtml(parentId, respuesta) {
    return `
        <article class="respuesta-item">
            <div class="comentario-meta">
                <span class="comentario-avatar comentario-avatar-sm">${escaparHtml((respuesta.nombre || '?').charAt(0).toUpperCase())}</span>
                <strong class="comentario-autor">${escaparHtml(respuesta.nombre)}</strong>
                <time class="comentario-fecha">${formatearFechaComentario(respuesta.createdAt)}</time>
                <button type="button" class="comentario-borrar respuesta-borrar" data-parent="${escaparHtml(parentId)}" data-id="${escaparHtml(respuesta.id || '')}" title="Eliminar respuesta" aria-label="Eliminar respuesta">🗑️</button>
            </div>
            <p class="comentario-texto">${escaparHtml(respuesta.texto)}</p>
        </article>
    `;
}

function renderComentarioHtml(comentario) {
    const id = escaparHtml(comentario.id || '');
    const respuestas = (Array.isArray(comentario.respuestas) ? comentario.respuestas.slice() : [])
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const respuestasHtml = respuestas.map((r) => renderRespuestaHtml(comentario.id || '', r)).join('');

    return `
        <article class="comentario-item">
            <div class="comentario-meta">
                <span class="comentario-avatar">${escaparHtml(comentario.nombre.charAt(0).toUpperCase())}</span>
                <strong class="comentario-autor">${escaparHtml(comentario.nombre)}</strong>
                <time class="comentario-fecha">${formatearFechaComentario(comentario.createdAt)}</time>
                <button type="button" class="comentario-borrar" data-id="${id}" title="Eliminar comentario" aria-label="Eliminar comentario">🗑️</button>
            </div>
            <p class="comentario-texto">${escaparHtml(comentario.texto)}</p>
            <div class="comentario-acciones-fila">
                <button type="button" class="comentario-responder" data-id="${id}">Responder</button>
            </div>
            ${respuestasHtml ? `<div class="comentario-respuestas">${respuestasHtml}</div>` : ''}
            <form class="form-respuesta" data-parent="${id}" hidden>
                <select class="respuesta-nombre" required>${opcionesParticipantesHtml()}</select>
                <input type="text" class="respuesta-texto" maxlength="500" placeholder="Escribe una respuesta..." required>
                <button type="submit" class="btn-respuesta-enviar">Responder</button>
            </form>
        </article>
    `;
}

function renderizarListaComentarios(comentarios) {
    const lista = document.getElementById('lista-comentarios');
    if (!lista) return;

    if (!comentarios.length) {
        comentariosExpandido = false;
        lista.innerHTML = '<p class="comentarios-vacio">Aún no hay comentarios. ¡Sé el primero en escribir!</p>';
        return;
    }

    const hayMas = comentarios.length > COMENTARIOS_VISIBLES;
    const visibles = comentariosExpandido ? comentarios : comentarios.slice(0, COMENTARIOS_VISIBLES);

    const itemsHtml = visibles.map(renderComentarioHtml).join('');

    let botonHtml = '';
    if (hayMas && !comentariosExpandido) {
        const restantes = comentarios.length - COMENTARIOS_VISIBLES;
        botonHtml = `<button type="button" class="comentario-cargar-mas">Cargar mensajes anteriores (${restantes})</button>`;
    } else if (hayMas && comentariosExpandido) {
        botonHtml = `<button type="button" class="comentario-cargar-mas" data-colapsar="1">Ocultar mensajes anteriores</button>`;
    }

    lista.innerHTML = itemsHtml + botonHtml;
}

function poblarSelectorComentarios(select) {
    if (!select) return;
    nombresParticipantesOrdenados().forEach((nombre) => {
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        select.appendChild(option);
    });

    try {
        const nombreGuardado = localStorage.getItem(COMENTARIO_NOMBRE_KEY);
        if (nombreGuardado && PARTICIPANTES[nombreGuardado]) {
            select.value = nombreGuardado;
        }
    } catch (e) { /* ignorar */ }
}

function ordenarComentarios(lista) {
    return (Array.isArray(lista) ? lista.slice() : [])
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function iniciarTablonComentarios() {
    const form = document.getElementById('form-comentario');
    const lista = document.getElementById('lista-comentarios');
    const selectNombre = document.getElementById('comentario-nombre');
    const textarea = document.getElementById('comentario-texto');
    const estado = document.getElementById('comentario-estado');
    const btnPublicar = form?.querySelector('.btn-comentario-publicar');

    if (!form || !lista || !selectNombre || !textarea || !btnPublicar) return;

    poblarSelectorComentarios(selectNombre);

    if (!firebaseDisponible) {
        lista.innerHTML = '<p class="comentarios-vacio">Firebase no disponible. No se pueden cargar los comentarios.</p>';
        btnPublicar.disabled = true;
        return;
    }

    // Escucha en tiempo real del documento del tablón
    firebaseDb.collection('pronosticos').doc(DOC_ID_TABLON)
        .onSnapshot(
            (snapshot) => {
                const data = snapshot.exists ? snapshot.data() : {};
                const listaGuardada = (data && data.pronosticos && Array.isArray(data.pronosticos.lista))
                    ? data.pronosticos.lista
                    : [];
                comentariosTablonCache = ordenarComentarios(listaGuardada);
                renderizarListaComentarios(comentariosTablonCache);
            },
            (error) => {
                console.error(error);
                lista.innerHTML = '<p class="comentarios-vacio">No se pudieron cargar los comentarios.</p>';
            }
        );

    // Clics dentro de la lista: cargar más, responder, borrar comentario, borrar respuesta
    lista.addEventListener('click', async (event) => {
        // Mostrar/ocultar mensajes anteriores
        const btnMas = event.target.closest('.comentario-cargar-mas');
        if (btnMas) {
            comentariosExpandido = !btnMas.dataset.colapsar;
            renderizarListaComentarios(comentariosTablonCache);
            return;
        }

        // Abrir/cerrar el formulario de respuesta
        const btnResponder = event.target.closest('.comentario-responder');
        if (btnResponder) {
            const item = btnResponder.closest('.comentario-item');
            const formResp = item?.querySelector('.form-respuesta');
            if (formResp) {
                formResp.hidden = !formResp.hidden;
                if (!formResp.hidden) formResp.querySelector('.respuesta-texto')?.focus();
            }
            return;
        }

        // Borrar respuesta (protegido por contraseña)
        const btnBorrarResp = event.target.closest('.respuesta-borrar');
        if (btnBorrarResp) {
            const parentId = btnBorrarResp.dataset.parent;
            const id = btnBorrarResp.dataset.id;
            if (!parentId || !id) return;
            const pass = prompt('Introduce la contraseña para eliminar la respuesta:');
            if (pass === null) return;
            if (pass !== 'Basurita') {
                alert('Contraseña incorrecta. No se ha eliminado la respuesta.');
                return;
            }
            btnBorrarResp.disabled = true;
            try {
                comentariosTablonCache = await firebaseEliminarRespuesta(parentId, id, comentariosTablonCache);
                renderizarListaComentarios(comentariosTablonCache);
            } catch (error) {
                console.error(error);
                alert('No se pudo eliminar la respuesta. Inténtalo de nuevo.');
                btnBorrarResp.disabled = false;
            }
            return;
        }

        // Borrar comentario (protegido por contraseña)
        const btn = event.target.closest('.comentario-borrar');
        if (btn) {
            const id = btn.dataset.id;
            if (!id) return;
            const pass = prompt('Introduce la contraseña para eliminar el comentario:');
            if (pass === null) return;
            if (pass !== 'Basurita') {
                alert('Contraseña incorrecta. No se ha eliminado el comentario.');
                return;
            }
            btn.disabled = true;
            try {
                comentariosTablonCache = await firebaseEliminarComentario(id, comentariosTablonCache);
                renderizarListaComentarios(comentariosTablonCache);
            } catch (error) {
                console.error(error);
                alert('No se pudo eliminar el comentario. Inténtalo de nuevo.');
                btn.disabled = false;
            }
        }
    });

    // Envío de respuestas a un comentario
    lista.addEventListener('submit', async (event) => {
        const formResp = event.target.closest('.form-respuesta');
        if (!formResp) return;
        event.preventDefault();

        const parentId = formResp.dataset.parent;
        const selectResp = formResp.querySelector('.respuesta-nombre');
        const inputResp = formResp.querySelector('.respuesta-texto');
        const btnEnviar = formResp.querySelector('.btn-respuesta-enviar');
        const nombre = selectResp ? selectResp.value.trim() : '';
        const texto = inputResp ? inputResp.value.trim() : '';
        const slug = PARTICIPANTES[nombre];

        if (!nombre || !slug) {
            alert('Elige tu nombre para responder.');
            return;
        }
        if (!texto) return;

        const nuevaRespuesta = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            nombre,
            slug,
            texto,
            createdAt: new Date().toISOString()
        };

        if (btnEnviar) btnEnviar.disabled = true;
        try {
            comentariosTablonCache = await firebasePublicarRespuesta(parentId, nuevaRespuesta, comentariosTablonCache);
            try {
                localStorage.setItem(COMENTARIO_NOMBRE_KEY, nombre);
            } catch (e) { /* ignorar */ }
            renderizarListaComentarios(comentariosTablonCache);
        } catch (error) {
            console.error(error);
            alert('No se pudo publicar la respuesta. Inténtalo de nuevo.');
            if (btnEnviar) btnEnviar.disabled = false;
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nombre = selectNombre.value.trim();
        const texto = textarea.value.trim();
        const slug = PARTICIPANTES[nombre];

        if (!nombre || !slug) {
            if (estado) estado.textContent = 'Elige tu nombre en la lista.';
            return;
        }
        if (!texto) {
            if (estado) estado.textContent = 'Escribe un comentario antes de publicar.';
            return;
        }

        btnPublicar.disabled = true;
        if (estado) estado.textContent = 'Publicando...';

        const nuevoComentario = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            nombre,
            slug,
            texto,
            createdAt: new Date().toISOString()
        };

        try {
            comentariosTablonCache = await firebasePublicarComentario(nuevoComentario, comentariosTablonCache);
            renderizarListaComentarios(comentariosTablonCache);
            textarea.value = '';
            try {
                localStorage.setItem(COMENTARIO_NOMBRE_KEY, nombre);
            } catch (e) { /* ignorar */ }
            if (estado) estado.textContent = 'Comentario publicado.';
        } catch (error) {
            console.error(error);
            if (estado) estado.textContent = 'No se pudo publicar el comentario. Inténtalo de nuevo.';
        } finally {
            btnPublicar.disabled = false;
        }
    });
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

        const btnInstrucciones = document.querySelector('.btn-instrucciones-header');
        const modalInstrucciones = document.getElementById('modal-instrucciones');
        const closeModalInstrucciones = document.querySelector('.close-modal-instrucciones');

        if (btnInstrucciones && modalInstrucciones) {
            const toggleInstrucciones = (show) => {
                if (show) {
                    modalInstrucciones.classList.remove('modal-hidden');
                } else {
                    modalInstrucciones.classList.add('modal-hidden');
                }
            };
            btnInstrucciones.addEventListener('click', () => toggleInstrucciones(true));
            if (closeModalInstrucciones) {
                closeModalInstrucciones.addEventListener('click', () => toggleInstrucciones(false));
            }
            modalInstrucciones.addEventListener('click', (event) => {
                if (event.target === modalInstrucciones) toggleInstrucciones(false);
            });
        }
        
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

        iniciarTablonComentarios();
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

    // Flip de acertantes exactos al hacer clic
    contenedorGrupos.addEventListener('click', async (event) => {
        const front = event.target.closest('.flip-front');
        const back = event.target.closest('.flip-back');

        if (front) {
            const card = front.closest('.flip-acertantes');
            if (!card) return;

            if (card.classList.contains('flipped')) {
                card.classList.remove('flipped');
                return;
            }

            const nombrePartido = card.dataset.partido;
            const backContent = card.querySelector('.flip-back-content');
            backContent.innerHTML = 'Cargando...';
            card.classList.add('flipped');

            try {
                const lista = await (firebaseDisponible
                    ? obtenerAcertantesExactosAsync(nombrePartido)
                    : Promise.resolve(obtenerAcertantesExactos(nombrePartido)));
                if (lista && lista.length) {
                    const listaOrdenada = [...lista].sort((a, b) => a.localeCompare(b, 'es', {sensitivity: 'base'}));
                    backContent.innerHTML = `<strong>(${listaOrdenada.length})</strong><br>${listaOrdenada.join(', ')}`;
                } else {
                    backContent.innerHTML = 'Ningún acertante exacto';
                }
            } catch (e) {
                backContent.innerHTML = 'Error';
            }
        } else if (back) {
            const card = back.closest('.flip-acertantes');
            if (card) card.classList.remove('flipped');
        }
    });


    
    // 3. Escuchar eventos en el contenedor principal (para ELIMINATORIAS - CLIC)
    contenedorGrupos.addEventListener('click', manejarPronosticoEliminatoria);

    // 4. Toggle de tooltips de timestamp al hacer clic
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-info-timestamp');
        if (btn) {
            const activo = btn.classList.contains('activo');
            document.querySelectorAll('.btn-info-timestamp.activo').forEach(b => b.classList.remove('activo'));
            if (!activo) btn.classList.add('activo');
        } else {
            document.querySelectorAll('.btn-info-timestamp.activo').forEach(b => b.classList.remove('activo'));
        }
    });

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
 * Reinicia solo los partidos de eliminatorias (M73-M104) sin tocar la fase de grupos.
 */
async function reiniciarEliminatorias() {
    const pass = prompt('Introduce la contraseña para reiniciar las eliminatorias:');
    if (pass === null) return;

    const hashEsperado = esPaginaPartidos ? 'e7c503a2' : passwordReiniciar;
    if (ph(pass) !== hashEsperado) {
        alert('Contraseña incorrecta. No se han reiniciado las eliminatorias.');
        return;
    }

    // Eliminar todos los partidos de eliminatorias (M73-M104)
    Object.keys(pronosticosConfirmados).forEach(k => {
        if (/^M\d+$/.test(k)) {
            delete pronosticosConfirmados[k];
        }
    });

    // Re-generar R32 (actualiza pronosticosConfirmados sin ganadores)
    const partidos = generarDieciseisavos();

    // Guardar de forma awaited para asegurar que Firebase confirma antes de seguir
    try {
        await guardarPronosticosAsync(docIdActual || DOC_ID_OFICIALES, pronosticosConfirmados);
    } catch (e) {
        console.error('Error guardando en Firebase:', e);
    }
    // Siempre actualizar localStorage también como respaldo
    localStorage.setItem(storageKey, JSON.stringify(pronosticosConfirmados));

    // Re-renderizar la vista sin recargar la página (el estado en memoria ya es correcto)
    renderizarRondaEliminatoria(partidos, 'R32');
    alert('Eliminatorias reiniciadas correctamente.');
}

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

        // Limpiar el historial de ranking para que todos muestren guion al recargar
        try {
            localStorage.removeItem('ranking_prev_mundial');
            localStorage.removeItem('ranking_curr_mundial');
            localStorage.removeItem('scores_hash_mundial');
        } catch (_) {}

        // Limpiar el aviso de última actualización
        const avisoEl = document.getElementById('ultimo-resultado-aviso');
        if (avisoEl) avisoEl.innerHTML = '';

        window.location.reload();
    } catch (e) {
        console.error(e);
        alert('No se pudieron reiniciar todos los pronósticos.');
    }
}