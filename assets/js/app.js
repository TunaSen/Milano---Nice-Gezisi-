const CONFIG_PATH = "trip-data/site-config.json";
const ITINERARY_PATH = "trip-data/itinerary.json";

const state = {
  config: null,
  tree: [],
  places: []
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

function renderCards(containerId, items, renderItem) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (!items.length) {
    const template = document.getElementById("empty-state-template");
    container.appendChild(template.content.cloneNode(true));
    return;
  }
  for (const item of items) {
    container.appendChild(renderItem(item));
  }
}

function card(title, meta, contentHtml, chips = []) {
  const el = document.createElement("article");
  el.className = "card";
  el.innerHTML = `
    <h3>${title}</h3>
    <div class="meta">${meta || ""}</div>
    <div>${contentHtml || ""}</div>
    <div class="chips">${chips.map((chip) => `<span class="chip">${chip}</span>`).join("")}</div>
  `;
  return el;
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

function renderItinerary(items) {
  renderCards("itinerary", items, (item) =>
    card(
      item.title,
      `${item.date} - ${item.city}`,
      `<p>${item.note || ""}</p>`,
      item.tags || []
    )
  );
}

function renderFlights(items) {
  renderCards("flights", items, (item) => {
    const links = (item.documents || [])
      .map((doc) => {
        const href = toGitHubFileUrl(state.config, doc.path);
        return `<a href="${href}" target="_blank" rel="noreferrer">${doc.label}</a>`;
      })
      .join(" | ");
    return card(
      `${item.from} -> ${item.to}`,
      `${item.date} | ${item.transport}`,
      `<p>${item.note || ""}</p><p>${links}</p>`,
      [item.status || "Planlandi"]
    );
  });
}

function renderStays(items) {
  renderCards("stays", items, (item) =>
    card(
      item.placeName,
      `${item.city} | ${item.checkIn} - ${item.checkOut}`,
      `<p>${item.note || ""}</p><a href="${item.mapsUrl}" target="_blank" rel="noreferrer">Haritada ac</a>`,
      [item.type || "Konaklama"]
    )
  );
}

function renderPlaces(items) {
  renderCards("places", items, (item) =>
    card(
      item.name,
      `${item.city} | ${item.plannedDate || "Tarih eklenecek"}`,
      `<p>${item.description || ""}</p><a href="${item.mapsUrl}" target="_blank" rel="noreferrer">Konum</a>`,
      item.tags || []
    )
  );
}

function renderGallery() {
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";

  const photos = state.tree
    .filter((item) => item.type === "blob" && item.path.startsWith("media/places/") && isImageFile(item.path))
    .sort((a, b) => a.path.localeCompare(b.path));

  if (!photos.length) {
    const template = document.getElementById("empty-state-template");
    gallery.appendChild(template.content.cloneNode(true));
    return;
  }

  for (const photo of photos) {
    const wrapper = document.createElement("article");
    wrapper.className = "photo-card";
    const caption = photo.path.replace("media/places/", "");
    wrapper.innerHTML = `
      <a href="${toRawUrl(state.config, photo.path)}" target="_blank" rel="noreferrer">
        <img src="${toRawUrl(state.config, photo.path)}" alt="${caption}" loading="lazy" />
      </a>
      <div class="caption">${caption}</div>
    `;
    gallery.appendChild(wrapper);
  }
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

async function bootstrap() {
  try {
    state.config = await fetchJson(CONFIG_PATH);
    updateRepoBadge(state.config);

    const itineraryData = await fetchJson(ITINERARY_PATH);
    renderItinerary(itineraryData.items || []);

    state.tree = await loadRepoTree(state.config);
    const flights = await loadJsonListFromTree(state.config, /^trip-data\/flights\/.*\.json$/);
    const stays = await loadJsonListFromTree(state.config, /^trip-data\/stays\/.*\.json$/);
    const places = await loadJsonListFromTree(state.config, /^trip-data\/places\/.*\/place\.json$/);

    state.places = places;
    renderFlights(flights);
    renderStays(stays);
    renderPlaces(places);
    renderGallery();
  } catch (error) {
    console.error(error);
    const sections = ["flights", "stays", "places", "gallery"];
    for (const id of sections) {
      renderCards(id, [], () => null);
    }
    const badge = document.getElementById("repo-badge");
    badge.textContent = "Veriler yuklenirken hata olustu. site-config.json kontrol edin.";
  }
}

bootstrap();
