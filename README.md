# 🏆 Porra Mundial 2026

Aplicación web para gestionar una **porra (quiniela) del Mundial de Fútbol 2026**: cada participante rellena sus pronósticos de la fase de grupos y su cuadro de eliminatorias, y la app calcula automáticamente los puntos y muestra una clasificación en tiempo real compartida entre todos.

Es un sitio **100% estático** (HTML + CSS + JavaScript) que usa **Firebase Firestore** como base de datos compartida, por lo que no necesita servidor propio.

---

## ✨ Funcionalidades

- **Clasificación en vivo** (`index.html`): tabla de posiciones con puntos, aciertos y aciertos exactos, ordenada automáticamente.
  - **Flechas de movimiento** (▲ ▼ –) que indican cómo se mueve cada participante respecto a la tanda de partidos anterior. Son **iguales para todos** porque se calculan a partir de los resultados oficiales y sus marcas de tiempo (no de la última visita de cada móvil).
  - **Empates**: quienes empatan a todo (puntos, aciertos y exactos) comparten el mismo puesto, comparten medalla/formato y **se reparten el premio** de ese puesto.
  - **Medallas y premios**: 👑 oro (20€), 🥈 plata (4€), 🥉 bronce (2€). El colista se marca con 🤡/💩.
  - **Columna "Próximo partido"** con el siguiente encuentro pendiente, en orden cronológico real (FIFA).
- **Resultados oficiales** (`partidos.html`): panel protegido por contraseña para introducir los marcadores reales y los cruces de eliminatorias. Cada resultado guarda su marca de tiempo.
- **Perfiles de participantes** (`perfil-<nombre>.html`): cada jugador rellena y edita sus pronósticos (protegido por contraseña).
- **Cuadro general** (`cuadro.html`): vista del bracket de eliminatorias.
- **Tablón de comentarios**: comentarios y respuestas en hilo, con borrado protegido, sincronizados en tiempo real vía Firestore.

---

## 🧮 Reglas de puntuación

### Fase de grupos
- **5 puntos** por acertar el resultado exacto.
- **2 puntos** por acertar el signo (gana local, gana visitante o empate).

### Eliminatorias (presencia por ronda)
Puntos por cada equipo que coincide entre el resultado oficial y tu cuadro:
- Dieciseisavos: **2 pts** por equipo
- Octavos: **3 pts** por equipo
- Cuartos: **5 pts** por equipo
- Semifinales: **7 pts** por equipo
- Final: **12 pts** por cada finalista acertado **+ 8 pts** extra si aciertas al campeón
- El partido por el 3.er y 4.º puesto no puntúa.

### Desempate
1. Mayor número de **aciertos**.
2. Si persiste, mayor número de **aciertos exactos**.
3. Si persiste en todo, **se reparte el premio** entre los empatados.

---

## 🗂️ Estructura del proyecto

```
├── index.html              # Clasificación + tablón de comentarios
├── partidos.html           # Introducción de resultados oficiales (admin)
├── cuadro.html             # Cuadro general de eliminatorias
├── perfil-<nombre>.html    # Pronósticos de cada participante
├── script.js               # Toda la lógica (cálculo, render, Firebase)
├── styles.css              # Estilos
├── firebase-config.js      # Configuración de Firebase (cliente)
└── world-cup.png           # Recursos gráficos
```

---

## 🛠️ Tecnología

- **HTML5 / CSS3 / JavaScript** (sin frameworks ni build).
- **Firebase Firestore** (SDK compat 10.7.1, cargado por CDN) como base de datos compartida.
- Si Firebase no está disponible, la app degrada a `localStorage` como respaldo local.

---

## 🚀 Cómo ejecutarlo en local

Al ser estático, basta con servir la carpeta con cualquier servidor estático. Por ejemplo:

```bash
# Python 3
python -m http.server 8000

# o con Node
npx serve .
```

Luego abre `http://localhost:8000/index.html` en el navegador.

> También funciona abriendo `index.html` directamente, pero usar un servidor local evita problemas con rutas y caché.

---

## ⚙️ Configuración de Firebase

La configuración del cliente está en `firebase-config.js`. Los datos se guardan en la colección `pronosticos` de Firestore, con documentos como:

- `oficiales` — resultados oficiales.
- Un documento por participante con sus pronósticos.
- `tablon` — comentarios del tablón.

> Las contraseñas de edición de perfiles y resultados son de uso privado y no se documentan aquí.

---

## 📌 Notas

- Los resultados y pronósticos se identifican por el **nombre del partido** (`Local vs Visitante`), no por su posición en la lista, de modo que reordenar el calendario no afecta a los datos ya guardados.
- El orden de los partidos sigue el **calendario cronológico oficial** del Mundial 2026.
