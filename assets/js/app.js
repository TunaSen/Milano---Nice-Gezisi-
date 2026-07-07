const CONFIG_PATH = "trip-data/site-config.json";
const ITINERARY_PATH = "trip-data/itinerary.json";
const CITIES_PATH = "trip-data/cities.json";

const state = {
  config: null,
  tree: [],
  map: null,
  cityMeta: {},
  flights: [],
  stays: [],
  places: [],
  itinerary: [],
  routes: [],
  markers: {},
  polylines: {},
  photos: [],
  routeAnimator: null,
  movingMarker: null,
  timelineActiveEl: null
};

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`JSON okunamadi: ${path}`);
  }
  return response.json();
}

function toRawUrl(config, filePath) {
  const { owner, repo, branch } = config.github;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}

function toGitHubFileUrl(config, filePath) {
  const { owner, repo, branch } = config.github;
  return `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`;
}

function isImageFile(path) {
  return /\.(png|jpe?g|gif|webp)$/i.test(path);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDateKey(dateValue) {
  const raw = String(dateValue || "").slice(0, 10);
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return parsed;
}

function createSoftCard(title, metaText) {
  const wrapper = document.createElement("article");
  wrapper.className = "soft-card";
  const h3 = document.createElement("h3");
  h3.textContent = title;
  wrapper.appendChild(h3);
  if (metaText) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = metaText;
    wrapper.appendChild(meta);
  }
  return wrapper;
}

function setDetailHeader(title, subtitle) {
  document.getElementById("detail-title").textContent = title;
  document.getElementById("detail-subtitle").textContent = subtitle;
}

function renderEmptyInto(container) {
  const template = document.getElementById("empty-state-template");
  container.appendChild(template.content.cloneNode(true));
}

async function loadRepoTree(config) {
  const { owner, repo, branch } = config.github;
  if (!owner || owner === "YOUR_GITHUB_USERNAME") {
    return [];
  }
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error("GitHub API erisimi basarisiz.");
  }
  const data = await response.json();
  return Array.isArray(data.tree) ? data.tree : [];
}

async function loadJsonListFromTree(config, regex) {
  const files = state.tree
    .filter((item) => item.type === "blob" && regex.test(item.path))
    .map((item) => item.path)
    .sort();

  const results = [];
  for (const filePath of files) {
    try {
      const data = await fetchJson(toRawUrl(config, filePath));
      results.push({ ...data, _path: filePath });
    } catch (error) {
      console.warn("Dosya yuklenemedi:", filePath, error);
    }
  }
  return results;
}

function updateRepoBadge(config) {
  const badge = document.getElementById("repo-badge");
  const { owner, repo, branch } = config.github;
  if (!owner || owner === "YOUR_GITHUB_USERNAME") {
    badge.textContent = "site-config.json icinde GitHub owner alanini doldurun";
    return;
  }
  badge.textContent = `${owner}/${repo} @ ${branch}`;
}

function resolveCityKey(cityName) {
  const key = slugify(cityName);
  return state.cityMeta[key] ? key : null;
}

function cityName(cityKey) {
  return state.cityMeta[cityKey]?.name || cityKey;
}

function setActiveTimelineItem(element) {
  if (state.timelineActiveEl) {
    state.timelineActiveEl.classList.remove("is-active");
  }
  state.timelineActiveEl = element;
  if (state.timelineActiveEl) {
    state.timelineActiveEl.classList.add("is-active");
  }
}

function parseRouteText(value) {
  const text = String(value || "");
  if (!text.includes("->")) return null;
  const parts = text.split("->").map((part) => part.trim());
  if (parts.length !== 2) return null;
  const fromKey = resolveCityKey(parts[0]);
  const toKey = resolveCityKey(parts[1]);
  if (!fromKey || !toKey) return null;
  return { fromKey, toKey };
}

function findRouteForTimelineItem(item) {
  const routeFromCityField = parseRouteText(item.city);
  const routeFromTitle = parseRouteText(item.title);
  const target = routeFromCityField || routeFromTitle;
  if (!target) return null;

  const samePairRoutes = state.routes.filter(
    (route) => route.fromKey === target.fromKey && route.toKey === target.toKey
  );
  if (!samePairRoutes.length) return null;

  const bestByDate = samePairRoutes.find((route) => String(route.date).slice(0, 10) === String(item.date).slice(0, 10));
  return bestByDate || samePairRoutes[0];
}

function focusTimelineItem(item, cardElement) {
  const route = findRouteForTimelineItem(item);
  if (route) {
    setActiveTimelineItem(cardElement);
    selectRoute(route.id, true);
    return;
  }

  const cityKey = resolveCityKey(item.city);
  if (cityKey) {
    setActiveTimelineItem(cardElement);
    selectCity(cityKey, true);
  }
}

function renderTimeline() {
  const container = document.getElementById("timeline");
  container.innerHTML = "";
  const items = [...state.itinerary].sort((a, b) => parseDateKey(a.date) - parseDateKey(b.date));
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const card = document.createElement("article");
    card.className = "timeline-item";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.style.animationDelay = `${i * 80}ms`;
    card.innerHTML = `
      <div class="date">${item.date}</div>
      <div class="title">${item.title}</div>
      <div class="meta">${item.city}</div>
    `;
    card.addEventListener("click", () => focusTimelineItem(item, card));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        focusTimelineItem(item, card);
      }
    });
    container.appendChild(card);
  }
}

function transportColor(mode) {
  const normalized = String(mode || "").toLowerCase();
  if (normalized.includes("ucak")) return "#6db8ff";
  if (normalized.includes("otobus")) return "#6dffcf";
  if (normalized.includes("araba")) return "#ffc76d";
  return "#c09bff";
}

function initMap() {
  if (!window.L) {
    throw new Error("Leaflet yuklenemedi.");
  }

  state.map = L.map("trip-map", {
    zoomControl: true,
    minZoom: 3
  }).setView([44.5, 10.0], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(state.map);
}

function renderCityMarkers() {
  Object.entries(state.cityMeta).forEach(([cityKey, meta]) => {
    const marker = L.marker(meta.coords, {
      icon: L.divIcon({
        className: "city-pin-wrap",
        html: '<div class="city-marker"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      })
    }).addTo(state.map);

    marker.bindTooltip(`<span class="route-label">${meta.name}</span>`, {
      permanent: true,
      direction: "top",
      offset: [0, -8]
    });

    marker.on("click", () => selectCity(cityKey, true));
    state.markers[cityKey] = marker;
  });
}

function buildRoutesFromFlights() {
  state.routes = state.flights
    .map((flight, index) => {
      const fromKey = resolveCityKey(flight.from);
      const toKey = resolveCityKey(flight.to);
      if (!fromKey || !toKey) return null;
      return {
        id: `route-${index}-${fromKey}-${toKey}`,
        fromKey,
        toKey,
        mode: flight.transport,
        date: flight.date,
        note: flight.note,
        documents: flight.documents || [],
        source: flight
      };
    })
    .filter(Boolean)
    .sort((a, b) => parseDateKey(a.date) - parseDateKey(b.date));
}

function renderRouteLines() {
  state.routes.forEach((route) => {
    const fromCoords = state.cityMeta[route.fromKey].coords;
    const toCoords = state.cityMeta[route.toKey].coords;
    const polyline = L.polyline([fromCoords, toCoords], {
      color: transportColor(route.mode),
      weight: 4,
      opacity: 0.8
    }).addTo(state.map);

    polyline.bindTooltip(
      `<span class="route-label">${cityName(route.fromKey)} -> ${cityName(route.toKey)} (${route.mode})</span>`
    );

    polyline.on("click", () => selectRoute(route.id, true));
    state.polylines[route.id] = polyline;
  });
}

function clearRouteAnimation() {
  if (state.routeAnimator) {
    clearInterval(state.routeAnimator);
    state.routeAnimator = null;
  }
  if (state.movingMarker) {
    state.map.removeLayer(state.movingMarker);
    state.movingMarker = null;
  }
}

function animateAlongRoute(route) {
  clearRouteAnimation();
  const from = state.cityMeta[route.fromKey].coords;
  const to = state.cityMeta[route.toKey].coords;
  const icon = L.divIcon({
    className: "moving-dot-wrap",
    html: '<div class="moving-dot"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
  state.movingMarker = L.marker(from, { icon }).addTo(state.map);
  let progress = 0;
  state.routeAnimator = setInterval(() => {
    progress += 0.02;
    if (progress > 1) {
      progress = 0;
    }
    const lat = from[0] + (to[0] - from[0]) * progress;
    const lng = from[1] + (to[1] - from[1]) * progress;
    state.movingMarker.setLatLng([lat, lng]);
  }, 70);
}

function makeLink(href, text) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.textContent = text;
  return a;
}

function renderRouteDetail(route) {
  const container = document.getElementById("detail-content");
  container.innerHTML = "";
  setDetailHeader(
    `${cityName(route.fromKey)} -> ${cityName(route.toKey)}`,
    `${route.date} | ${route.mode}`
  );

  const top = createSoftCard("Yolculuk Bilgisi", route.note || "Not eklenmedi.");
  const chips = document.createElement("div");
  chips.className = "chips";
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = route.source.status || "Planlandi";
  chips.appendChild(chip);
  top.appendChild(chips);
  container.appendChild(top);

  const docCard = createSoftCard("Bilet ve Belgeler", "");
  if (!route.documents.length) {
    docCard.appendChild(document.createTextNode("Belge eklenmemis."));
  } else {
    const list = document.createElement("div");
    list.className = "list-grid";
    route.documents.forEach((doc) => {
      const link = makeLink(toGitHubFileUrl(state.config, doc.path), doc.label || doc.path);
      list.appendChild(link);
    });
    docCard.appendChild(list);
  }
  container.appendChild(docCard);
}

function renderCityDetail(cityKey) {
  const container = document.getElementById("detail-content");
  container.innerHTML = "";

  const city = state.cityMeta[cityKey];
  setDetailHeader(city.name, city.description || "Sehir detaylari");

  const cityFlights = state.flights.filter((flight) => {
    const fromKey = resolveCityKey(flight.from);
    const toKey = resolveCityKey(flight.to);
    return fromKey === cityKey || toKey === cityKey;
  });
  const cityStays = state.stays.filter((stay) => resolveCityKey(stay.city) === cityKey);
  const cityPlaces = state.places.filter((place) => resolveCityKey(place.city) === cityKey);
  const cityPhotos = state.photos.filter((photo) => photo.cityKey === cityKey);

  const intro = createSoftCard("Sehir Ozeti", city.summary || "Bu sehir icin ozet not ekleyebilirsin.");
  if (Array.isArray(city.highlights) && city.highlights.length) {
    const chips = document.createElement("div");
    chips.className = "chips";
    city.highlights.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = item;
      chips.appendChild(chip);
    });
    intro.appendChild(chips);
  }
  container.appendChild(intro);

  const transportCard = createSoftCard("Ulasim", "");
  if (!cityFlights.length) {
    transportCard.appendChild(document.createTextNode("Bu sehir icin ulasim kaydi yok."));
  } else {
    const list = document.createElement("div");
    list.className = "list-grid";
    cityFlights.forEach((item) => {
      const row = document.createElement("div");
      row.className = "soft-card";
      row.innerHTML = `
        <strong>${item.from} -> ${item.to}</strong>
        <div class="meta">${item.date} | ${item.transport}</div>
        <div>${item.note || ""}</div>
      `;
      if (item.documents?.length) {
        const links = document.createElement("div");
        links.className = "list-grid";
        item.documents.forEach((doc) => {
          links.appendChild(makeLink(toGitHubFileUrl(state.config, doc.path), doc.label || "Belge"));
        });
        row.appendChild(links);
      }
      list.appendChild(row);
    });
    transportCard.appendChild(list);
  }
  container.appendChild(transportCard);

  const stayCard = createSoftCard("Konaklama", "");
  if (!cityStays.length) {
    stayCard.appendChild(document.createTextNode("Konaklama kaydi yok."));
  } else {
    const list = document.createElement("div");
    list.className = "list-grid";
    cityStays.forEach((item) => {
      const row = document.createElement("div");
      row.className = "soft-card";
      row.innerHTML = `
        <strong>${item.placeName}</strong>
        <div class="meta">${item.checkIn} -> ${item.checkOut}</div>
        <div>${item.note || ""}</div>
      `;
      if (item.mapsUrl) {
        row.appendChild(makeLink(item.mapsUrl, "Haritada ac"));
      }
      list.appendChild(row);
    });
    stayCard.appendChild(list);
  }
  container.appendChild(stayCard);

  const placeCard = createSoftCard("Gezilecek Yerler", "");
  if (!cityPlaces.length) {
    placeCard.appendChild(document.createTextNode("Yer kaydi yok."));
  } else {
    const list = document.createElement("div");
    list.className = "list-grid";
    cityPlaces.forEach((item) => {
      const row = document.createElement("div");
      row.className = "soft-card";
      const chips = (item.tags || [])
        .map((tag) => `<span class="chip">${tag}</span>`)
        .join("");
      row.innerHTML = `
        <strong>${item.name}</strong>
        <div class="meta">${item.plannedDate || "Tarih eklenecek"}</div>
        <div>${item.description || ""}</div>
        <div class="chips">${chips}</div>
      `;
      if (item.mapsUrl) {
        row.appendChild(makeLink(item.mapsUrl, "Konum"));
      }
      list.appendChild(row);
    });
    placeCard.appendChild(list);
  }
  container.appendChild(placeCard);

  const photoCard = createSoftCard("Sehir Fotograflari", "");
  if (!cityPhotos.length) {
    photoCard.appendChild(document.createTextNode("Bu sehir icin henuz fotograf yok."));
  } else {
    const gallery = document.createElement("div");
    gallery.className = "gallery-grid";
    cityPhotos.forEach((photo) => {
      const card = document.createElement("article");
      card.className = "photo-card";
      const imgLink = toRawUrl(state.config, photo.path);
      card.innerHTML = `
        <a href="${imgLink}" target="_blank" rel="noreferrer">
          <img src="${imgLink}" alt="${photo.caption}" loading="lazy" />
        </a>
        <div class="caption">${photo.caption}</div>
      `;
      gallery.appendChild(card);
    });
    photoCard.appendChild(gallery);
  }
  container.appendChild(photoCard);
}

function selectCity(cityKey, fitMap = false) {
  clearRouteAnimation();
  Object.values(state.polylines).forEach((line) => line.setStyle({ weight: 4, opacity: 0.7 }));
  renderCityDetail(cityKey);
  if (fitMap) {
    state.map.flyTo(state.cityMeta[cityKey].coords, 8, { duration: 0.8 });
  }
}

function selectRoute(routeId, fitMap = false) {
  const route = state.routes.find((item) => item.id === routeId);
  if (!route) return;
  Object.entries(state.polylines).forEach(([id, line]) => {
    line.setStyle({
      weight: id === routeId ? 7 : 3,
      opacity: id === routeId ? 1 : 0.45
    });
  });
  animateAlongRoute(route);
  renderRouteDetail(route);
  if (fitMap) {
    const bounds = state.polylines[routeId].getBounds();
    state.map.fitBounds(bounds.pad(0.4));
  }
}

function collectPhotosFromTree() {
  state.photos = state.tree
    .filter((item) => item.type === "blob" && item.path.startsWith("media/places/") && isImageFile(item.path))
    .map((item) => {
      const clean = item.path.replace("media/places/", "");
      const parts = clean.split("/");
      return {
        path: item.path,
        cityKey: parts[0],
        placeSlug: parts[1],
        caption: clean
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

function renderAllPhotos() {
  const gallery = document.getElementById("all-photos");
  gallery.innerHTML = "";
  if (!state.photos.length) {
    renderEmptyInto(gallery);
    return;
  }
  state.photos.forEach((photo) => {
    const wrapper = document.createElement("article");
    wrapper.className = "photo-card";
    const src = toRawUrl(state.config, photo.path);
    wrapper.innerHTML = `
      <a href="${src}" target="_blank" rel="noreferrer">
        <img src="${src}" alt="${photo.caption}" loading="lazy" />
      </a>
      <div class="caption">${photo.caption}</div>
    `;
    gallery.appendChild(wrapper);
  });
}

function normalizeCities(citiesJson) {
  const map = {};
  Object.entries(citiesJson || {}).forEach(([key, value]) => {
    if (!Array.isArray(value.coords) || value.coords.length !== 2) return;
    map[slugify(key)] = {
      ...value,
      name: value.name || key,
      coords: value.coords
    };
  });
  return map;
}

function renderFailState(message) {
  setDetailHeader("Hata", message);
  const detail = document.getElementById("detail-content");
  detail.innerHTML = "";
  const errorCard = createSoftCard("Veriler yuklenemedi", message);
  detail.appendChild(errorCard);
  const gallery = document.getElementById("all-photos");
  gallery.innerHTML = "";
  renderEmptyInto(gallery);
}

async function bootstrap() {
  try {
    state.config = await fetchJson(CONFIG_PATH);
    updateRepoBadge(state.config);

    const [itineraryData, cityData] = await Promise.all([fetchJson(ITINERARY_PATH), fetchJson(CITIES_PATH)]);
    state.itinerary = itineraryData.items || [];
    state.cityMeta = normalizeCities(cityData);
    renderTimeline();

    state.tree = await loadRepoTree(state.config);
    state.flights = await loadJsonListFromTree(state.config, /^trip-data\/flights\/.*\.json$/);
    state.stays = await loadJsonListFromTree(state.config, /^trip-data\/stays\/.*\.json$/);
    state.places = await loadJsonListFromTree(state.config, /^trip-data\/places\/.*\/place\.json$/);
    collectPhotosFromTree();

    initMap();
    renderCityMarkers();
    buildRoutesFromFlights();
    renderRouteLines();
    renderAllPhotos();

    const defaultCity = resolveCityKey("Milan") || Object.keys(state.cityMeta)[0];
    if (defaultCity) {
      selectCity(defaultCity, true);
    }
  } catch (error) {
    console.error(error);
    renderFailState("site-config, cities veya GitHub API ayarlarini kontrol et.");
  }
}

bootstrap();
