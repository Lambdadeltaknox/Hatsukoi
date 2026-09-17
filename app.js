
const root = document.documentElement;
const audio = document.getElementById("Song");
const fileInput = document.getElementById("FileInput");
const folderInput = document.getElementById("FolderInput");

const menuBtn = document.getElementById("MenuBtn"); 
const optionsMenu = document.getElementById("OptionsMenu");

const playPauseButton = document.getElementById("PlayPauseBtn");
const backButton = document.getElementById("BackBtn");
const nextButton = document.getElementById("NextBtn");

const progressBar = document.getElementById("ProgressBar");
const progressfill = document.getElementById("ProgressFill");

const currenttimetext = document.getElementById("CurrentTime");
const totaldurationtext = document.getElementById("TotalDuration");

const title = document.getElementById("Title");
const name = document.getElementById("Name");
const localPlayerMeta = document.querySelector(".local-player-meta");

const bartitle = document.getElementById("BarTitle");
const barartist = document.getElementById("BarArtist");

const playicon = document.querySelector(".icon-play");
const pauseicon = document.querySelector(".icon-pause");

const artworkCard = document.getElementById("ArtworkCard");

const coverArt = document.getElementById("CoverArt");
const barCover = document.getElementById("BarCover");

const volumeBtn = document.getElementById("VolumeBtn");
const volumeBar = document.getElementById("VolumeBar");
const volumeOnIcon = document.querySelector(".icon-volume-on");
const volumeOffIcon = document.querySelector(".icon-volume-off");

const bgInput = document.getElementById("BgInput");
const themeGrid = document.getElementById("ThemeGrid");
const themeSwatches = themeGrid ? Array.from(themeGrid.querySelectorAll(".theme-swatch")) : [];
const menuResetBgBtn = document.getElementById("MenuResetBgBtn");
const playerPage = document.getElementById("local-player-page");

const playlistBtn = document.getElementById("PlaylistBtn");
const playlistMenu = document.getElementById("PlaylistMenu");
const playlistList = document.getElementById("PlaylistList");
const clearPlaylistBtn = document.getElementById("ClearPlaylistBtn");

const dropZone = document.getElementById("DropZone");

const clearPlaylistModal = document.getElementById("ClearPlaylistModal");
const cancelClearPlaylistBtn = document.getElementById("CancelClearPlaylist");
const confirmClearPlaylistBtn = document.getElementById("ConfirmClearPlaylist");

const shuffleBtn = document.getElementById("shuffle-btn");
const repeatBtn = document.getElementById("repeat-btn");

const playlistSearchInput = document.getElementById("PlaylistSearchInput");
const playlistSearchClear = document.getElementById("PlaylistSearchClear");
const playlistSortSelect = document.getElementById("PlaylistSortSelect");
const playlistStatsEl = document.getElementById("PlaylistStats");

const toastContainer = document.getElementById("ToastContainer");

// Título original de la pestaña, para restaurarlo cuando no hay canción sonando.
const DEFAULT_TITLE = document.title;

// Aplica un fade-out breve antes de actualizar carátula/título, y fade-in al terminar.
// updateFn debe contener las asignaciones reales (textContent, src, etc.).
function crossfadeNowPlaying(updateFn) {
    coverArt.classList.add("is-changing");
    localPlayerMeta.classList.add("is-changing");

    setTimeout(() => {
        updateFn();
        coverArt.classList.remove("is-changing");
        localPlayerMeta.classList.remove("is-changing");
    }, 200); // debe coincidir con la duración del transition en CSS (0.2s)
}

// ---------------------------------------------------------------------
// Sistema de notificaciones (toasts)
// ---------------------------------------------------------------------
// Función reutilizable para avisos cortos y no bloqueantes: errores de
// reproducción/carga, resultados de búsqueda, cambios de shuffle/repeat,
// orden de la lista, etc. Se construye una sola vez acá y de ahí en
// adelante cualquier parte de la app solo la llama.
function mostrarNotificacion(mensaje, tipo) {
    if (!toastContainer) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = "app-toast" + (tipo === "error" ? " app-toast-error" : "");
    toast.setAttribute("role", tipo === "error" ? "alert" : "status");
    toast.textContent = mensaje;

    toastContainer.appendChild(toast);

    requestAnimationFrame(function () {
        toast.classList.add("visible");
    });

    setTimeout(function () {
        toast.classList.remove("visible");
        toast.addEventListener("transitionend", function () {
            toast.remove();
        }, { once: true });

        // Respaldo por si la transición no llega a dispararse (ej. pestaña
        // en segundo plano): igual se quita el toast tras un momento.
        setTimeout(function () {
            toast.remove();
        }, 400);
    }, 3200);
}

// ---------------------------------------------------------------------
// Menu de opciones / Playlist: coordinación y accesibilidad de teclado
// ---------------------------------------------------------------------
// Los paneles se registran en un solo "gestor de menús" en vez de repetir
// la misma lógica de apertura/cierre por cada botón nuevo que se agregue
// a futuro. Reglas de UX:
// - En pantallas angostas, abrir uno cierra los demás (no caben dos).
// - En escritorio pueden convivir abiertos (el CSS ya contempla ese caso).
// - Se cierran con click/tap afuera (backdrop) o con Escape.
// - El foco se mueve al primer elemento del panel al abrir, y vuelve al
//   botón que lo abrió al cerrar. Mientras uno está abierto, Tab no se
//   escapa hacia el contenido de atrás (focus trap).
const isNarrowScreen = () => window.matchMedia("(max-width: 768px)").matches;

const menuBackdrop = document.createElement("div");
menuBackdrop.className = "menu-backdrop";
document.body.appendChild(menuBackdrop);

function getFocusable(container) {
    return Array.from(
        container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
        return !el.disabled && el.offsetParent !== null;
    });
}

// Registro central de menús: agregar uno nuevo a futuro es solo sumar
// { panel, trigger } acá, sin tocar el resto de la lógica.
const menuRegistry = [
    { panel: optionsMenu, trigger: menuBtn },
    { panel: playlistMenu, trigger: playlistBtn }
];

function findOpenMenu() {
    return menuRegistry.find(function (m) {
        return m.panel.classList.contains("open");
    });
}

function anyMenuOpen() {
    return menuRegistry.some(function (m) {
        return m.panel.classList.contains("open");
    });
}

function closeMenu(entry) {
    if (!entry || !entry.panel.classList.contains("open")) {
        return;
    }

    entry.panel.classList.remove("open");
    entry.panel.setAttribute("aria-hidden", "true");
    entry.trigger.setAttribute("aria-expanded", "false");

    if (!anyMenuOpen()) {
        menuBackdrop.classList.remove("visible");
    }

    entry.trigger.focus();
}

function closeAllMenus() {
    menuRegistry.forEach(closeMenu);
}

function openMenu(entry) {
    if (isNarrowScreen()) {
        menuRegistry.forEach(function (m) {
            if (m !== entry) {
                closeMenu(m);
            }
        });
    }

    entry.panel.classList.add("open");
    entry.panel.setAttribute("aria-hidden", "false");
    entry.trigger.setAttribute("aria-expanded", "true");
    menuBackdrop.classList.add("visible");

    const focusables = getFocusable(entry.panel);
    if (focusables.length) {
        focusables[0].focus();
    }
}

function toggleMenu(entry) {
    if (entry.panel.classList.contains("open")) {
        closeMenu(entry);
    } else {
        openMenu(entry);
    }
}

menuRegistry.forEach(function (entry) {
    entry.panel.setAttribute("aria-hidden", "true");
    entry.trigger.setAttribute("aria-expanded", "false");
    entry.trigger.addEventListener("click", function () {
        toggleMenu(entry);
    });
});

menuBackdrop.addEventListener("click", closeAllMenus);

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        const open = findOpenMenu();
        if (open) {
            closeMenu(open);
        }
        return;
    }

    // Focus trap: mientras un panel está abierto, Tab no debe salir de él.
    if (e.key === "Tab") {
        const open = findOpenMenu();
        if (!open) {
            return;
        }

        const focusables = getFocusable(open.panel);
        if (focusables.length === 0) {
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
});

function setActiveThemeSwatch(themeValue) {
    themeSwatches.forEach(function (swatch) {
        swatch.classList.toggle("active", swatch.dataset.theme === themeValue);
    });
}

themeSwatches.forEach(function (swatch) {
    swatch.addEventListener("click", function () {
        const theme = swatch.dataset.theme;
        root.setAttribute("data-theme", theme);
        setActiveThemeSwatch(theme);

        // En pantallas angostas el panel tapa casi toda la vista previa;
        // cerrarlo al elegir tema deja ver el resultado de inmediato.
        if (isNarrowScreen()) {
            const optionsEntry = menuRegistry.find(function (m) { return m.panel === optionsMenu; });
            closeMenu(optionsEntry);
        }
    });
});

setActiveThemeSwatch(root.getAttribute("data-theme") || "dark");

// ---------------------------------------------------------------------
// Anuncio accesible de "reproduciendo ahora" para lectores de pantalla
// ---------------------------------------------------------------------
const nowPlayingAnnouncer = document.createElement("div");
nowPlayingAnnouncer.className = "sr-only";
nowPlayingAnnouncer.setAttribute("role", "status");
nowPlayingAnnouncer.setAttribute("aria-live", "polite");
document.body.appendChild(nowPlayingAnnouncer);

function announceNowPlaying(trackTitle, artist) {
    nowPlayingAnnouncer.textContent = artist
        ? `Reproduciendo: ${trackTitle} — ${artist}`
        : `Reproduciendo: ${trackTitle}`;
}

// Escapa texto antes de insertarlo como HTML (nombres de archivo o tags
// pueden traer caracteres como < o & que romperían el innerHTML).
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// ---------------------------------------------------------------------
// Playlist
// ---------------------------------------------------------------------

let playlist = [];
let currentIndex = -1;
let currentAudioURL = null;

function trackLabel(file) {
    // Quita la extensión del nombre para mostrar un titulo mas limpio
    return file.name.replace(/\.[^/.]+$/, "");
}

// Cada canción de la playlist es un objeto (no solo el File): así, cuando
// ya se leyeron sus tags una vez, quedan guardados acá mismo y reordenar,
// quitar canciones o volver a mostrar la lista no dispara una relectura
// del archivo ni recrea la carátula de nuevo.
function createTrackEntry(file) {
    return {
        file: file,
        title: null,
        artist: null,
        coverURL: null,
        metadataLoaded: false,
        duration: null
    };
}

// Obtiene la duración de un archivo sin depender de jsmediatags (no la
// trae) ni de reproducirlo: se carga solo la metadata en un <audio>
// temporal y se descarta apenas se lee la duración. Igual que con los
// tags, si ya se conoce no se vuelve a leer nada.
function fetchTrackDuration(entry, onDone) {
    if (entry.duration !== null) {
        onDone();
        return;
    }

    const tempURL = URL.createObjectURL(entry.file);
    const tempAudio = new Audio();
    tempAudio.preload = "metadata";

    const finish = function (value) {
        entry.duration = value;
        URL.revokeObjectURL(tempURL);
        onDone();
    };

    tempAudio.addEventListener("loadedmetadata", function () {
        finish(isFinite(tempAudio.duration) ? tempAudio.duration : 0);
    });
    tempAudio.addEventListener("error", function () {
        finish(0);
    });

    tempAudio.src = tempURL;
}

// Lee los tags de un archivo una sola vez y los deja cacheados en la
// entrada correspondiente. Si ya estaban cargados, no vuelve a leer nada.
function fetchTrackMetadata(entry, onDone) {
    if (entry.metadataLoaded) {
        onDone();
        return;
    }

    jsmediatags.read(entry.file, {
        onSuccess: function (tag) {
            const tags = tag.tags;

            entry.title = tags.title || null;
            entry.artist = tags.artist || null;

            if (tags.picture) {
                const picture = tags.picture;
                const bytes = new Uint8Array(picture.data);
                const blob = new Blob([bytes], { type: picture.format });
                entry.coverURL = URL.createObjectURL(blob);
            }

            entry.metadataLoaded = true;
            onDone();
        },

        onError: function (error) {
            // Se marca como "cargado" igual para no reintentar en cada render.
            entry.metadataLoaded = true;
            console.error("Error al leer metadatos:", error);
            onDone();
        }
    });
}

// Pinta la portada/título en el hero y la barra inferior ("now playing").
// animate=true usa el crossfade suave; false lo aplica de inmediato
// (por ejemplo, al cargar la pista por primera vez, antes de tener foto).
function renderNowPlaying(entry, animate) {
    const label = trackLabel(entry.file);
    const displayTitle = entry.title || label;
    const displayArtist = entry.artist || (playlist.length > 1
        ? `Pista ${currentIndex + 1} de ${playlist.length}`
        : "Archivo local");

    const apply = function () {
        title.textContent = displayTitle;
        bartitle.textContent = displayTitle;
        name.textContent = displayArtist;
        barartist.textContent = entry.artist || "Archivo local";

        coverArt.classList.remove("has-art");
        coverArt.removeAttribute("src");
        barCover.removeAttribute("src");

        if (entry.coverURL) {
            coverArt.src = entry.coverURL;
            barCover.src = entry.coverURL;
            coverArt.classList.add("has-art");
        }

        document.title = entry.artist
            ? `${displayTitle} — ${entry.artist}`
            : displayTitle;
    };

    if (animate) {
        crossfadeNowPlaying(apply);
    } else {
        apply();
    }

    announceNowPlaying(displayTitle, entry.artist);
}

// Actualiza el título/artista/carátula de un ítem ya renderizado en la
// playlist, usando lo que haya cacheado en su entrada.
function syncPlaylistItemDOM(entry) {
    const index = playlist.indexOf(entry);
    if (index === -1) {
        return;
    }

    const item = playlistList.querySelector(`[data-index="${index}"]`);
    if (!item) {
        return;
    }

    const itemTitle = item.querySelector(".title");
    const itemArtist = item.querySelector(".artist");
    const itemCover = item.querySelector(".playlist-cover");

    itemTitle.textContent = entry.title || trackLabel(entry.file);
    itemArtist.textContent = entry.artist || "Archivo local";
    itemArtist.classList.remove("is-loading");

    if (entry.coverURL) {
        itemCover.src = entry.coverURL;
    }
}

// Dispara (o reutiliza) la lectura de metadata de un ítem de la playlist,
// y refresca tanto ese ítem como el hero si es la pista que está sonando.
function loadPlaylistMetadata(entry, item) {
    fetchTrackMetadata(entry, function () {
        syncPlaylistItemDOM(entry);

        if (playlist[currentIndex] === entry) {
            renderNowPlaying(entry, true);
        }
    });

    // Independiente de los tags: la duración se va sumando al contador
    // total a medida que cada canción "aparece" en pantalla, en vez de
    // leer todos los archivos de golpe al cargar la lista.
    fetchTrackDuration(entry, function () {
        updatePlaylistStats();
    });
}

// Índice que se está arrastrando actualmente en la lista (drag & drop para reordenar)
let dragFromIndex = null;

// Observador que carga la metadata (título/artista/carátula) de cada item
// solo cuando entra al viewport del panel. En listas grandes, leer los tags
// de cientos de archivos de golpe congela la interfaz; así solo se leen
// los que el usuario realmente está por ver. Se crea una sola vez (no en
// cada render) porque su "root" (.playlist-scroll) ya existe en el HTML.
const playlistObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (obsEntry) {
        if (!obsEntry.isIntersecting) {
            return;
        }
        const idx = Number(obsEntry.target.dataset.index);
        const entry = playlist[idx];
        if (entry) {
            loadPlaylistMetadata(entry, obsEntry.target);
        }
        playlistObserver.unobserve(obsEntry.target);
    });
}, {
    root: playlistList.closest(".playlist-scroll") || null,
    rootMargin: "300px 0px",
    threshold: 0.01
});

// Construye el elemento DOM de un ítem de playlist a partir de su entrada
// cacheada. Si ya tiene metadata, se pinta directo (sin "Cargando…" ni
// relectura); si no, se muestra un placeholder y se observa para leerla
// perezosamente cuando entre en pantalla.
function createPlaylistItemElement(entry, index) {
    const item = document.createElement("div");

    item.classList.add("playlist-track", "entering");
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.draggable = true;
    item.dataset.index = index;
    item.classList.toggle("playing", index === currentIndex);

    const label = trackLabel(entry.file);
    const displayTitle = escapeHtml(entry.title || label);
    const displayArtist = escapeHtml(entry.metadataLoaded ? (entry.artist || "Archivo local") : "Cargando…");
    const coverAttr = entry.coverURL ? ` src="${entry.coverURL}"` : "";
    const artistClass = entry.metadataLoaded ? "artist" : "artist is-loading";

    item.innerHTML = `
        <img class="playlist-cover"${coverAttr}>

        <div class="track-item-details">
        <div class="title">${displayTitle}</div>
        <div class="${artistClass}">${displayArtist}</div>
        </div>

        <button type="button" class="playlist-track-remove" title="Quitar de la lista" aria-label="Quitar de la lista">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;

    if (!entry.metadataLoaded) {
        playlistObserver.observe(item);
    }

    return item;
}

// Agrega ítems nuevos al final de la lista ya existente, sin reconstruir
// los que ya estaban (conserva su metadata cargada, su carátula y el
// scroll actual del panel).
function appendPlaylistItems(entries, startIndex) {
    entries.forEach(function (entry, offset) {
        const item = createPlaylistItemElement(entry, startIndex + offset);
        playlistList.appendChild(item);
    });

    requestAnimationFrame(function () {
        entries.forEach(function (entry, offset) {
            const item = playlistList.querySelector(`[data-index="${startIndex + offset}"]`);
            if (item) {
                item.classList.remove("entering");
            }
        });
    });

    updatePlaylistStats();
    applyPlaylistFilter();
}

// Reconstruye la lista completa. Se usa solo para la transición entre el
// estado vacío y el estado con canciones (y viceversa) — para altas,
// bajas o reordenamientos normales se manipula el DOM directamente
// (ver appendPlaylistItems / actuallyRemove / reorderPlaylist) para no
// perder metadata ya cargada ni el scroll del usuario.
// Igual que formatTime, pero para la duración TOTAL de la lista, que
// fácilmente puede pasar de una hora (formatTime está pensado para una
// sola canción y no muestra horas).
function formatTotalDuration(seconds) {
    const totalSecs = Math.floor(seconds || 0);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// Repinta el contador de canciones y la duración total. La duración de
// cada canción se sabe recién cuando su metadata se cargó (ver
// fetchTrackDuration/loadPlaylistMetadata), así que esto se recalcula
// cada vez que una nueva duración llega, no solo al agregar/quitar.
function updatePlaylistStats() {
    if (!playlistStatsEl) {
        return;
    }

    if (playlist.length === 0) {
        playlistStatsEl.textContent = "";
        return;
    }

    const totalSeconds = playlist.reduce(function (sum, entry) {
        return sum + (entry.duration || 0);
    }, 0);

    const label = playlist.length === 1 ? "canción" : "canciones";
    playlistStatsEl.textContent = `${playlist.length} ${label} · ${formatTotalDuration(totalSeconds)}`;
}

function renderPlaylist() {
    playlistList.innerHTML = "";

    if (playlist.length === 0) {
        playlistList.innerHTML = `
            <div class="playlist-empty">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="16" r="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <p>No hay canciones en la fila</p>
                <button type="button" id="EmptyAddBtn">Agregar canciones</button>
            </div>
        `;

        document.getElementById("EmptyAddBtn").addEventListener("click", function () {
             fileInput.click();
        });
        updatePlaylistStats();
        return;
    }

    playlist.forEach(function (entry, index) {
        playlistList.appendChild(createPlaylistItemElement(entry, index));
    });

    requestAnimationFrame(function () {
        playlistList.querySelectorAll(".entering").forEach(function (el) {
            el.classList.remove("entering");
        });
    });

    updatePlaylistStats();
    applyPlaylistFilter();
}

// --- Delegación de eventos: un solo listener por tipo en el contenedor,
// en vez de reatar listeners nuevos en cada ítem cada vez que se
// renderiza. Además de rendir mejor en listas grandes, esto es lo que
// permite quitar/mover un ítem del DOM directamente (ver más abajo) sin
// que los demás pierdan su comportamiento. Siempre se lee el índice
// actual desde dataset.index, nunca de una variable capturada al crear
// el ítem, así que sigue siendo correcto aunque la lista se reordene.
playlistList.addEventListener("click", function (e) {
    const item = e.target.closest(".playlist-track");
    if (!item) {
        return;
    }

    const removeBtn = e.target.closest(".playlist-track-remove");
    const index = Number(item.dataset.index);

    if (removeBtn) {
        e.stopPropagation();
        removeFromPlaylist(index);
        return;
    }

    loadTrack(index, true);
});

playlistList.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") {
        return;
    }
    const item = e.target.closest(".playlist-track");
    if (!item) {
        return;
    }
    e.preventDefault();
    loadTrack(Number(item.dataset.index), true);
});

playlistList.addEventListener("dragstart", function (e) {
    const item = e.target.closest(".playlist-track");
    if (!item) {
        return;
    }
    dragFromIndex = Number(item.dataset.index);
    item.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(dragFromIndex));
});

playlistList.addEventListener("dragend", function (e) {
    const item = e.target.closest(".playlist-track");
    if (item) {
        item.classList.remove("dragging");
    }
    dragFromIndex = null;
});

playlistList.addEventListener("dragover", function (e) {
    const item = e.target.closest(".playlist-track");
    if (!item) {
        return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const rect = item.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const isTopHalf = e.clientY < midpoint;

    item.classList.toggle("drag-over-top", isTopHalf);
    item.classList.toggle("drag-over-bottom", !isTopHalf);
});

playlistList.addEventListener("dragleave", function (e) {
    const item = e.target.closest(".playlist-track");
    if (item) {
        item.classList.remove("drag-over-top", "drag-over-bottom");
    }
});

playlistList.addEventListener("drop", function (e) {
    const item = e.target.closest(".playlist-track");
    if (!item) {
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    item.classList.remove("drag-over-top", "drag-over-bottom");

    const toIndex = Number(item.dataset.index);
    const fromIndex = dragFromIndex !== null
        ? dragFromIndex
        : Number(e.dataTransfer.getData("text/plain"));

    reorderPlaylist(fromIndex, toIndex);
});

// Actualiza solo el resaltado de la canción actual, sin volver a
// renderizar toda la lista (evita releer metadata innecesariamente
// cada vez que cambia la pista).
function updatePlaylistHighlight() {
    const items = playlistList.querySelectorAll(".playlist-track");
    items.forEach(function(item){
        const isPlaying = Number(item.dataset.index) === currentIndex;
        item.classList.toggle("playing", isPlaying);

        // En listas largas, mantiene la pista actual visible sin que el
        // usuario tenga que buscarla manualmente en el scroll.
        if (isPlaying) {
            item.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    });
}

// Reindexa dataset.index de los ítems ya en el DOM después de mover o
// quitar uno, sin reconstruir nada más.
function reindexPlaylistItems() {
    const items = playlistList.querySelectorAll(".playlist-track");
    items.forEach(function (item, i) {
        item.dataset.index = i;
    });
}

// Mueve una canción de una posición a otra dentro de la lista. Mueve el
// nodo real en el DOM (insertBefore) en vez de reconstruir todo: así no
// se pierden las carátulas ya cargadas ni la posición del scroll.
function reorderPlaylist(fromIndex, toIndex) {
    if (Number.isNaN(fromIndex) || fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
        return;
    }
    if (fromIndex >= playlist.length || toIndex >= playlist.length) {
        return;
    }

    const [moved] = playlist.splice(fromIndex, 1);
    playlist.splice(toIndex, 0, moved);

    invalidateShuffleOrder();

    if (currentIndex === fromIndex) {
        currentIndex = toIndex;
    } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
        currentIndex--;
    } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
        currentIndex++;
    }

    const nodes = Array.from(playlistList.children);
    const movedItem = nodes[fromIndex];
    const targetItem = nodes[toIndex];

    if (movedItem && targetItem) {
        if (toIndex > fromIndex) {
            playlistList.insertBefore(movedItem, targetItem.nextSibling);
        } else {
            playlistList.insertBefore(movedItem, targetItem);
        }
    }

    reindexPlaylistItems();
    updatePlaylistHighlight();
}

// Quita una sola canción de la lista, animando la salida antes de tocar el array
function removeFromPlaylist(index) {
    const item = playlistList.querySelector(`[data-index="${index}"]`);

    if (item) {
        item.classList.add("removing");
        setTimeout(() => actuallyRemove(index), 200);
    } else {
        actuallyRemove(index);
    }
}

// Saca la canción del array y del DOM, y reacomoda el estado del reproductor.
// Solo quita el nodo puntual (item.remove()) y reindexa el resto: nunca
// reconstruye toda la lista, así los demás ítems conservan su metadata,
// su carátula ya cargada y el scroll del panel.
function actuallyRemove(index) {
    if (index < 0 || index >= playlist.length) {
        return;
    }

    const wasCurrent = index === currentIndex;
    const wasPlaying = wasCurrent && !audio.paused;

    const [removedEntry] = playlist.splice(index, 1);
    if (removedEntry && removedEntry.coverURL) {
        URL.revokeObjectURL(removedEntry.coverURL);
    }

    invalidateShuffleOrder();

    if (playlist.length === 0) {
        currentIndex = -1;
        stopPlaybackAndReset();
        renderPlaylist();
        return;
    }

    const item = playlistList.querySelector(`[data-index="${index}"]`);
    if (item) {
        item.remove();
    }
    reindexPlaylistItems();
    updatePlaylistStats();

    if (wasCurrent) {
        currentIndex = Math.min(index, playlist.length - 1);
        loadTrack(currentIndex, wasPlaying);
    } else {
        if (index < currentIndex) {
            currentIndex--;
        }
        updatePlaylistHighlight();
    }
}

// ---------------------------------------------------------------------
// Buscador dentro de la playlist
// ---------------------------------------------------------------------
// Filtra los ítems ya renderizados con CSS (mostrar/ocultar), no
// reconstruye la lista: se apoya en data-index y en el título/artista
// que ya están en el DOM de cada ítem.
let currentSearchTerm = "";
let searchHadNoResults = false;

function applyPlaylistFilter() {
    const term = currentSearchTerm.trim().toLowerCase();
    const items = playlistList.querySelectorAll(".playlist-track");
    let visibleCount = 0;

    items.forEach(function (item) {
        const index = Number(item.dataset.index);
        const entry = playlist[index];
        if (!entry) {
            return;
        }

        const haystack = (
            (entry.title || trackLabel(entry.file)) + " " + (entry.artist || "")
        ).toLowerCase();

        const matches = term === "" || haystack.includes(term);
        item.classList.toggle("filtered-out", !matches);

        if (matches) {
            visibleCount++;
        }
    });

    // Avisa solo al pasar de "hay resultados" a "no hay resultados", para
    // no repetir el mismo toast en cada tecla mientras el usuario escribe.
    if (term !== "" && playlist.length > 0 && visibleCount === 0) {
        if (!searchHadNoResults) {
            mostrarNotificacion(`Sin resultados para "${currentSearchTerm.trim()}"`);
            searchHadNoResults = true;
        }
    } else {
        searchHadNoResults = false;
    }
}

if (playlistSearchInput) {
    playlistSearchInput.addEventListener("input", function () {
        currentSearchTerm = playlistSearchInput.value;
        if (playlistSearchClear) {
            playlistSearchClear.classList.toggle("visible", currentSearchTerm.length > 0);
        }
        applyPlaylistFilter();
    });
}

if (playlistSearchClear) {
    playlistSearchClear.addEventListener("click", function () {
        playlistSearchInput.value = "";
        currentSearchTerm = "";
        playlistSearchClear.classList.remove("visible");
        applyPlaylistFilter();
        playlistSearchInput.focus();
    });
}

// ---------------------------------------------------------------------
// Ordenar la playlist
// ---------------------------------------------------------------------
// Ordena el array real y vuelve a pintar. Como la canción actual es un
// objeto (no un índice suelto), se la ubica de nuevo por referencia
// después de ordenar en vez de asumir que sigue en la misma posición.
function sortPlaylist(mode) {
    if (mode !== "name" && mode !== "artist") {
        return;
    }
    if (playlist.length < 2) {
        return;
    }

    const currentEntry = currentIndex >= 0 ? playlist[currentIndex] : null;

    const getKey = function (entry) {
        if (mode === "artist") {
            return (entry.artist || trackLabel(entry.file)).toLowerCase();
        }
        return (entry.title || trackLabel(entry.file)).toLowerCase();
    };

    playlist.sort(function (a, b) {
        return getKey(a).localeCompare(getKey(b), "es");
    });

    if (currentEntry) {
        currentIndex = playlist.indexOf(currentEntry);
    }

    invalidateShuffleOrder();
    renderPlaylist();
    updatePlaylistHighlight();

    mostrarNotificacion(
        mode === "artist" ? "Lista ordenada por artista" : "Lista ordenada por nombre"
    );
}

if (playlistSortSelect) {
    playlistSortSelect.addEventListener("change", function () {
        sortPlaylist(playlistSortSelect.value);
    });
}

// Vacía la lista por completo (abre modal de confirmación)
function clearPlaylist() {
    if (playlist.length === 0) {
        return;
    }

    clearPlaylistModal.classList.add("open");
    clearPlaylistModal.setAttribute("aria-hidden", "false");

    // Foco al botón Cancelar por defecto (opción menos destructiva)
    cancelClearPlaylistBtn.focus();
}

// Borrado real: solo se llama desde el botón "Vaciar" del modal
function performClearPlaylist() {
    playlist.forEach(function (entry) {
        if (entry.coverURL) {
            URL.revokeObjectURL(entry.coverURL);
        }
    });

    playlist = [];
    currentIndex = -1;
    invalidateShuffleOrder();
    stopPlaybackAndReset();
    renderPlaylist();

    clearPlaylistModal.classList.remove("open");
    clearPlaylistModal.setAttribute("aria-hidden", "true");
}

// Cancelar: solo cierra, no toca la playlist
function cancelClearPlaylist() {
    clearPlaylistModal.classList.remove("open");
    clearPlaylistModal.setAttribute("aria-hidden", "true");

    // Devolver el foco al botón de la papelera
    if (clearPlaylistBtn) {
        clearPlaylistBtn.focus();
    }
}

// --- Conexión del modal con sus botones y formas de cerrarlo ---
confirmClearPlaylistBtn.addEventListener("click", performClearPlaylist);
cancelClearPlaylistBtn.addEventListener("click", cancelClearPlaylist);

// Click afuera de la tarjeta (sobre el fondo oscuro) cancela, igual que
// los demás paneles de la app.
clearPlaylistModal.addEventListener("click", function (e) {
    if (e.target === clearPlaylistModal) {
        cancelClearPlaylist();
    }
});

// Escape cancela si el modal está abierto.
document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && clearPlaylistModal.classList.contains("open")) {
        cancelClearPlaylist();
    }
});

// Deja el reproductor en su estado inicial (sin canciones)
function stopPlaybackAndReset() {
    audio.pause();

    if (currentAudioURL) {
        URL.revokeObjectURL(currentAudioURL);
        currentAudioURL = null;
    }
    audio.removeAttribute("src");
    audio.load();

    title.textContent = "No hay canciones";
    name.textContent = "Elige uno o varios archivos de tu equipo para empezar";
    bartitle.textContent = "";
    barartist.textContent = "";
    coverArt.classList.remove("has-art");
    coverArt.removeAttribute("src");
    barCover.removeAttribute("src");
    progressfill.style.width = "0%";
    currenttimetext.textContent = "0:00";
    totaldurationtext.textContent = "0:00";
    setPlayingIcon(false);
    document.title = DEFAULT_TITLE;
}

if (clearPlaylistBtn) {
    clearPlaylistBtn.addEventListener("click", clearPlaylist);
}

function loadTrack(index, autoplay) {
    if (index < 0 || index >= playlist.length) {
        return;
    }

    currentIndex = index;
    const entry = playlist[currentIndex];
    const file = entry.file;

    // Si el shuffle está activo y la pista se cargó por selección manual
    // (clic en la lista) en vez de por Siguiente/Anterior, hay que ubicar
    // la posición dentro del orden aleatorio para que Siguiente/Anterior
    // sigan avanzando desde ahí correctamente.
    if (shuffleEnabled) {
        if (shuffleOrder.length !== playlist.length) {
            buildShuffleOrder();
        } else {
            const pos = shuffleOrder.indexOf(currentIndex);
            if (pos > -1) {
                shufflePosition = pos;
            }
        }
    }

    if (currentAudioURL) {
        URL.revokeObjectURL(currentAudioURL);
    }
    //URL temporal (evita gasto de memoria)
    currentAudioURL = URL.createObjectURL(file);
    audio.src = currentAudioURL;

    // Pinta de inmediato con lo que ya haya en caché (o el nombre del
    // archivo como fallback); si todavía no se leyeron los tags, los
    // busca y vuelve a pintar con un crossfade cuando lleguen.
    renderNowPlaying(entry, false);

    if (!entry.metadataLoaded) {
        fetchTrackMetadata(entry, function () {
            if (playlist[currentIndex] === entry) {
                renderNowPlaying(entry, true);
            }
            syncPlaylistItemDOM(entry);
        });
    }

    progressfill.style.width = "0%";
    currenttimetext.textContent = "0:00";
    totaldurationtext.textContent = "0:00";

    updatePlaylistHighlight();

    if (autoplay) {
        audio.play().catch(() => {
            // El navegador puede bloquear el autoplay; no pasa nada,
            // el usuario puede darle play manualmente.
        });
    }
}

fileInput.addEventListener("change", function () {
    if (!fileInput.files || fileInput.files.length === 0) {
        return;
    }



    addToPlaylist(fileInput.files);

    fileInput.value = "";
});

folderInput.addEventListener("change", function () {
    if (!folderInput.files || folderInput.files.length === 0) return;

    const audioFiles = Array.from(folderInput.files).filter(function (file) {
        return file.type.startsWith("audio/");
    });

    if (audioFiles.length === 0) return;

    addToPlaylist(audioFiles);

    folderInput.value = "";
});

// ---------------------------------------------------------------------
// Drag & drop de archivos (arrastrar canciones desde el explorador)
// ---------------------------------------------------------------------
if (dropZone) {
    let dragCounter = 0;

    ["dragenter", "dragover"].forEach(function(eventName){
        dropZone.addEventListener(eventName, function(e){
            e.preventDefault();
            e.stopPropagation();

            if (eventName === "dragenter") {
                dragCounter++;
            }

            playerPage.classList.add("local-player-dropping");
        });
    });

    dropZone.addEventListener("dragleave", function(e){
        e.preventDefault();
        e.stopPropagation();

        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            playerPage.classList.remove("local-player-dropping");
        }
    });

    dropZone.addEventListener("drop", function(e){
        e.preventDefault();
        e.stopPropagation();

        droppedFiles = [];
    
        dragCounter = 0;
        playerPage.classList.remove("local-player-dropping");

        const items = e.dataTransfer.items;

        const promises = [];

        console.log(items);

        for (const item of items){

            const entry = item.webkitGetAsEntry();

            if (entry) {
                promises.push(
                    readEntry(entry)
                );
            }

            console.log(entry);
        }

        Promise.all(promises).then(function(){
           if (droppedFiles.length > 0){
            addToPlaylist(droppedFiles);
           } 
        })
        .catch(function(error){
            console.error("Fallo al leer los achivos dropeados:", error);
            mostrarNotificacion("No se pudieron leer los archivos soltados.", "error");
        });

    });
}

//Array temporal para archivos/carpetas arrastradas
let droppedFiles = [];

function readEntry(entry){
//Si (la entrada. es un archivo)
    if (entry.isFile){

    
    return new Promise(function(resolve){

    //se encarga de obtener el archivo "real"
        entry.file(function(file){
        //si Archivo = Audio
            if (file.type.startsWith("audio/")) {

            //guarda en array temporal, .push empuja la posicion dentro del array (ej: file1, file2, etc...)
                droppedFiles.push(file);
            }

         //avisa cuando termina de procesar archivos y finaliza   
            resolve();
        });
    });
    }

   // Si (LaEntrada. Es un fichero) 
    if (entry.isDirectory){
        //define constante reader = entry(el fichero). crateReader()(mira dentro del fichero) 
    return new Promise(function(resolve){
    
        const reader = entry.createReader();

    //.readEntries lee los elementos de la carpeta guardados en "reader" y al terminar de leerlos:
    //function(entries) entrega los elemntos a "entries"
        reader.readEntries(function(entries) {

        //entries carga los datos y "forEach" entrega uno por uno a "child entry" mediante vueltas
        //childEntry representa uno de esos elementos en cada vuelta
            const promises = entries.map(function(childEntry){
            //readEntry lee la entrada y la ingresa en childEntry el cual se transforma temporalmente en Entry
               return readEntry(childEntry);
            });
            Promise.all(promises).then(function(){
                resolve()
            });
        });
    });

    }
}

function addToPlaylist(files){
    const wasEmpty = playlist.length === 0;

    // Evita agregar dos veces la misma canción (mismo nombre, tamaño y
    // fecha de modificación) si ya está en la lista.
    const uniqueFiles = Array.from(files).filter(function (file) {
        const alreadyExists = playlist.some(function (existingEntry) {
            return (
                existingEntry.file.name === file.name
                && existingEntry.file.size === file.size
                && existingEntry.file.lastModified === file.lastModified
            );
        });
        return !alreadyExists;
    });

    const newEntries = uniqueFiles.map(createTrackEntry);
    const startIndex = playlist.length;

    playlist.push(...newEntries);
    invalidateShuffleOrder();

    if (wasEmpty) {
        // Pasa del estado vacío al estado con canciones: acá sí hace
        // falta reconstruir el contenedor de la playlist.
        renderPlaylist();
        loadTrack(0, false);
    } else {
        // Ya había canciones: solo se agregan los nuevos ítems al final,
        // sin tocar (ni volver a leer metadata de) los que ya estaban.
        appendPlaylistItems(newEntries, startIndex);
    }
}

// ---------------------------------------------------------------------
// Play / Pause
// ---------------------------------------------------------------------
function setPlayingIcon(isPlaying) {
    playicon.style.display = isPlaying ? "none" : "block";
    pauseicon.style.display = isPlaying ? "block" : "none";
    playPauseButton.title = isPlaying ? "Pausar" : "Reproducir";
    playPauseButton.setAttribute("aria-label", isPlaying ? "Pausar" : "Reproducir");
    artworkCard.classList.toggle("is-playing", isPlaying);
}

playPauseButton.addEventListener("click", function () {
    if (!audio.src) {
        return;
    }

    playPauseButton.classList.add("pulse");
    setTimeout(() => playPauseButton.classList.remove("pulse"), 150);

    if (audio.paused) { 
        audio.play().catch((error) => {
            console.error("Error al reproducir el audio:", error);
            mostrarNotificacion("No se pudo reproducir el archivo.", "error");
        });
    } else {
        audio.pause();
    }
});

audio.addEventListener("play", () => setPlayingIcon(true));
audio.addEventListener("pause", () => setPlayingIcon(false));

// Atajo global de teclado: barra espaciadora reproduce/pausa desde
// cualquier parte de la página, no solo cuando el botón ya tiene el foco
// (un <button> nativo solo reacciona al espacio si está enfocado; sin
// este listener, la tecla no hacía nada hasta que el usuario le daba
// clic al botón una vez primero).
document.addEventListener("keydown", function (e) {
    if (e.code !== "Space" && e.key !== " ") {
        return;
    }

    const active = document.activeElement;
    const tag = active ? active.tagName : "";
    const isTypingField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (active && active.isContentEditable);
    const isOwnButton = tag === "BUTTON" || (active && active.getAttribute && active.getAttribute("role") === "button");

    // Si el foco está en un campo de texto o en cualquier botón/ítem que ya
    // maneja su propio espacio (incluido este mismo botón), no interferir:
    // se deja que ese elemento reciba la tecla normalmente.
    if (isTypingField || isOwnButton) {
        return;
    }

    e.preventDefault();
    playPauseButton.click();
});

// Atajo global de teclado: "M" silencia/reactiva el sonido desde cualquier
// parte de la página, igual que el espacio para play/pause (sin esto, la
// tecla no hacía nada; solo funcionaba el clic directo en VolumeBtn).
document.addEventListener("keydown", function (e) {
    if (e.key !== "m" && e.key !== "M") {
        return;
    }

    const active = document.activeElement;
    const tag = active ? active.tagName : "";
    const isTypingField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (active && active.isContentEditable);

    if (isTypingField) {
        return;
    }

    volumeBtn.click();
});

// ---------------------------------------------------------------------
// Shuffle & Repeat
// ---------------------------------------------------------------------
// Shuffle NO desordena el array real de la playlist (eso rompería el
// orden visual de la lista); en vez de eso se genera un orden de
// reproducción aparte (shuffleOrder: una lista de índices) que se
// recalcula cada vez que se activa o cuando la playlist cambia de
// tamaño. shufflePosition indica en qué punto de ese orden estamos.
let shuffleEnabled = false;
let shuffleOrder = [];
let shufflePosition = 0;

// Repeat cicla entre ninguno -> todos -> una sola, y se revisa al
// terminar la canción (evento "ended", más abajo).
let repeatMode = "none"; // "none" | "all" | "one"

function invalidateShuffleOrder() {
    shuffleOrder = [];
}

function buildShuffleOrder() {
    const indices = playlist.map(function (_, i) { return i; });

    // Fisher-Yates
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = indices[i];
        indices[i] = indices[j];
        indices[j] = tmp;
    }

    // La canción que ya está sonando queda primera en el nuevo orden,
    // para no saltar de golpe a otra pista justo al activar el shuffle.
    if (currentIndex >= 0) {
        const pos = indices.indexOf(currentIndex);
        if (pos > -1) {
            indices.splice(pos, 1);
            indices.unshift(currentIndex);
        }
    }

    shuffleOrder = indices;
    shufflePosition = 0;
}

function setShuffle(enabled) {
    shuffleEnabled = enabled;
    if (shuffleBtn) {
        shuffleBtn.classList.toggle("active", enabled);
        shuffleBtn.setAttribute("aria-pressed", String(enabled));
    }
    if (enabled) {
        buildShuffleOrder();
    }
}

if (shuffleBtn) {
    shuffleBtn.addEventListener("click", function () {
        setShuffle(!shuffleEnabled);
        mostrarNotificacion(shuffleEnabled ? "Orden aleatorio activado" : "Orden aleatorio desactivado");
    });
}

const REPEAT_LABELS = {
    none: "Repetir",
    all: "Repetir toda la lista",
    one: "Repetir canción actual"
};

function applyRepeatButtonState() {
    if (!repeatBtn) {
        return;
    }
    repeatBtn.classList.toggle("active", repeatMode !== "none");
    repeatBtn.classList.toggle("repeat-one", repeatMode === "one");
    repeatBtn.title = REPEAT_LABELS[repeatMode];
    repeatBtn.setAttribute("aria-label", REPEAT_LABELS[repeatMode]);
}

if (repeatBtn) {
    repeatBtn.addEventListener("click", function () {
        repeatMode = repeatMode === "none" ? "all" : (repeatMode === "all" ? "one" : "none");
        applyRepeatButtonState();

        const messages = {
            none: "Repetición desactivada",
            all: "Repitiendo toda la lista",
            one: "Repitiendo la canción actual"
        };
        mostrarNotificacion(messages[repeatMode]);
    });
    applyRepeatButtonState();
}

// Siguiente/anterior según shuffle esté activo o no. Si la playlist
// cambió de tamaño desde la última vez (canciones agregadas/quitadas),
// el orden guardado ya no sirve y se recalcula acá mismo.
function getNextIndex() {
    if (playlist.length === 0) {
        return -1;
    }
    if (shuffleEnabled) {
        if (shuffleOrder.length !== playlist.length) {
            buildShuffleOrder();
        }
        shufflePosition = (shufflePosition + 1) % shuffleOrder.length;
        return shuffleOrder[shufflePosition];
    }
    return (currentIndex + 1) % playlist.length;
}

function getPrevIndex() {
    if (playlist.length === 0) {
        return -1;
    }
    if (shuffleEnabled) {
        if (shuffleOrder.length !== playlist.length) {
            buildShuffleOrder();
        }
        shufflePosition = (shufflePosition - 1 + shuffleOrder.length) % shuffleOrder.length;
        return shuffleOrder[shufflePosition];
    }
    return (currentIndex - 1 + playlist.length) % playlist.length;
}

// ---------------------------------------------------------------------
// Anterior / Siguiente
// ---------------------------------------------------------------------
backButton.addEventListener("click", function () {
    if (playlist.length === 0) {
        return;
    }

    // Si llevamos mas de 3 segundos de la cancion, "Anterior" reinicia
    // la pista actual (comportamiento estandar de reproductores).
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }

    const wasPlaying = !audio.paused;
    loadTrack(getPrevIndex(), wasPlaying);
});

nextButton.addEventListener("click", function () {
    if (playlist.length === 0) {
        return;
    }

    const wasPlaying = !audio.paused;
    loadTrack(getNextIndex(), wasPlaying);
});

// Cuando termina una pista, decide qué sigue según repeat/shuffle
audio.addEventListener("ended", function () {
    if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(function () {});
        return;
    }

    if (playlist.length <= 1) {
        if (repeatMode === "all" && playlist.length === 1) {
            audio.currentTime = 0;
            audio.play().catch(function () {});
            return;
        }
        setPlayingIcon(false);
        return;
    }

    const isLastInSequence = shuffleEnabled
        ? shufflePosition >= shuffleOrder.length - 1
        : currentIndex >= playlist.length - 1;

    if (isLastInSequence && repeatMode === "none") {
        setPlayingIcon(false);
        return;
    }

    loadTrack(getNextIndex(), true);
});

// ---------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------
function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) {
        return "0:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Accesibilidad de teclado: la barra de progreso se comporta como un slider
progressBar.setAttribute("role", "slider");
progressBar.setAttribute("tabindex", "0");
progressBar.setAttribute("aria-label", "Progreso de la canción");
progressBar.setAttribute("aria-valuemin", "0");

progressBar.addEventListener("keydown", function (e) {
    if (!audio.duration) {
        return;
    }

    const smallStep = 5;
    const bigStep = 15;

    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        audio.currentTime = Math.min(audio.duration, audio.currentTime + smallStep);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - smallStep);
    } else if (e.key === "PageUp") {
        e.preventDefault();
        audio.currentTime = Math.min(audio.duration, audio.currentTime + bigStep);
    } else if (e.key === "PageDown") {
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - bigStep);
    } else if (e.key === "Home") {
        e.preventDefault();
        audio.currentTime = 0;
    } else if (e.key === "End") {
        e.preventDefault();
        audio.currentTime = audio.duration;
    }
});

audio.addEventListener("loadedmetadata", function () {
    totaldurationtext.textContent = formatTime(audio.duration);
    progressBar.setAttribute("aria-valuemax", Math.floor(audio.duration));

    // Ya que el audio principal cargó su duración, se aprovecha para la
    // pista actual en vez de crear un <audio> temporal aparte (ver
    // fetchTrackDuration) solo para leer lo mismo dos veces.
    const currentEntry = playlist[currentIndex];
    if (currentEntry && currentEntry.duration === null) {
        currentEntry.duration = isFinite(audio.duration) ? audio.duration : 0;
        updatePlaylistStats();
    }
});

audio.addEventListener("timeupdate", function () {
    if (audio.duration) {
        const progressPercent = (audio.currentTime / audio.duration) * 100;
        progressfill.style.width = progressPercent + "%";
        currenttimetext.textContent = formatTime(audio.currentTime);

        progressBar.setAttribute("aria-valuenow", Math.floor(audio.currentTime));
        progressBar.setAttribute(
            "aria-valuetext",
            formatTime(audio.currentTime) + " de " + formatTime(audio.duration)
        );
    }
});

function seekFromClientX(clientX) {
    if (!audio.duration) {
        return;
    }
    const rect = progressBar.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = ratio * audio.duration;
    progressfill.style.width = (ratio * 100) + "%";
}

let isSeeking = false;

progressBar.addEventListener("pointerdown", function (e) {
    if (!audio.duration) {
        return;
    }
    isSeeking = true;
    progressBar.classList.add("seeking");
    progressBar.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
});

progressBar.addEventListener("pointermove", function (e) {
    if (isSeeking) {
        seekFromClientX(e.clientX);
    }
});

progressBar.addEventListener("pointerup", function () {
    isSeeking = false;
    progressBar.classList.remove("seeking");
});

progressBar.addEventListener("pointercancel", function () {
    isSeeking = false;
    progressBar.classList.remove("seeking");
});

// ---------------------------------------------------------------------
// Volumen
// ---------------------------------------------------------------------
let lastVolume = 1;
audio.volume = 1;
volumeBar.style.setProperty("--volume-level", "100%");

function updateVolumeUI() {
    const isMuted = audio.muted || audio.volume === 0;
    const pct = isMuted ? 0 : audio.volume * 100;
    volumeBar.style.setProperty("--volume-level", pct + "%");
    volumeBtn.title = isMuted ? "Activar sonido" : "Silenciar";
    volumeBtn.setAttribute("aria-label", volumeBtn.title);
    volumeOnIcon.style.display = isMuted ? "none" : "block";
    volumeOffIcon.style.display = isMuted ? "block" : "none";
    volumeBar.setAttribute("aria-valuenow", Math.round(pct));
}

// Accesibilidad de teclado: la barra de volumen también es un slider
volumeBar.setAttribute("role", "slider");
volumeBar.setAttribute("tabindex", "0");
volumeBar.setAttribute("aria-label", "Volumen");
volumeBar.setAttribute("aria-valuemin", "0");
volumeBar.setAttribute("aria-valuemax", "100");

volumeBar.addEventListener("keydown", function (e) {
    const step = 0.05;

    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        audio.volume = Math.min(1, audio.volume + step);
        audio.muted = false;
        lastVolume = audio.volume;
        updateVolumeUI();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        audio.volume = Math.max(0, audio.volume - step);
        audio.muted = audio.volume === 0;
        if (audio.volume > 0) {
            lastVolume = audio.volume;
        }
        updateVolumeUI();
    } else if (e.key === "Home") {
        e.preventDefault();
        audio.volume = 0;
        audio.muted = true;
        updateVolumeUI();
    } else if (e.key === "End") {
        e.preventDefault();
        audio.volume = 1;
        audio.muted = false;
        lastVolume = 1;
        updateVolumeUI();
    }
});

function setVolumeFromClientX(clientX) {
    const rect = volumeBar.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    audio.volume = ratio;
    audio.muted = ratio === 0;
    if (ratio > 0) {
        lastVolume = ratio;
    }
    updateVolumeUI();
}

let isAdjustingVolume = false;

volumeBar.addEventListener("pointerdown", function (e) {
    isAdjustingVolume = true;
    volumeBar.classList.add("seeking");
    volumeBar.setPointerCapture(e.pointerId);
    setVolumeFromClientX(e.clientX);
});

volumeBar.addEventListener("pointermove", function (e) {
    if (isAdjustingVolume) {
        setVolumeFromClientX(e.clientX);
    }
});

volumeBar.addEventListener("pointerup", function () {
    isAdjustingVolume = false;
    volumeBar.classList.remove("seeking");
});

volumeBar.addEventListener("pointercancel", function () {
    isAdjustingVolume = false;
    volumeBar.classList.remove("seeking");
});

volumeBtn.addEventListener("click", function () {
    if (audio.muted || audio.volume === 0) {
        audio.muted = false;
        audio.volume = lastVolume || 1;
    } else {
        lastVolume = audio.volume || 1;
        audio.muted = true;
    }
    updateVolumeUI();
});

updateVolumeUI();

// ---------------------------------------------------------------------
// Fondo personalizado (imagen elegida por el usuario)
// ---------------------------------------------------------------------
let currentBgURL = null;

bgInput.addEventListener("change", function () {
    const file = bgInput.files[0];
    if (!file) {
        return;
    }

    if (currentBgURL) {
        URL.revokeObjectURL(currentBgURL);
    }

    currentBgURL = URL.createObjectURL(file);
    playerPage.style.setProperty("--local-player-bg-image", `url(${currentBgURL})`);
    playerPage.classList.add("has-custom-bg");
});

function resetBackground() {
    playerPage.classList.remove("has-custom-bg");
    playerPage.style.removeProperty("--local-player-bg-image");
    
    if (currentBgURL) {
        URL.revokeObjectURL(currentBgURL);
        currentBgURL = null;
    }

    bgInput.value = "";
}

menuResetBgBtn.addEventListener("click", resetBackground);

// ---------------------------------------------------------------------
// Estado inicial de la playlist
// ---------------------------------------------------------------------
// El HTML trae un placeholder simple (sin JS) por si algo falla al cargar,
// pero renderPlaylist() ya sabe pintar el estado vacío "de verdad" (ícono +
// botón "Agregar canciones"). Lo llamamos una vez al iniciar para que esa
// versión completa se vea desde el primer momento, no solo después de
// vaciar la lista manualmente.
renderPlaylist();