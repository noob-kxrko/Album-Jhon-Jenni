const galleryEl = document.getElementById('gallery');
const uploadForm = document.getElementById('uploadForm');
const albumForm = document.getElementById('albumForm');
const albumSelect = document.getElementById('albumSelect');
const albumChips = document.getElementById('albumChips');
const fileInput = document.getElementById('fileInput');
const mediaTitle = document.getElementById('mediaTitle');
const albumNameInput = document.getElementById('albumName');
const albumDescriptionInput = document.getElementById('albumDescription');
const themeToggle = document.getElementById('themeToggle');
const mediaTemplate = document.getElementById('mediaTemplate');

let state = {
  albums: [],
  media: [],
  selectedFilter: 'all',
  activeAlbum: 'all'
};

const applyTheme = () => {
  const savedTheme = localStorage.getItem('album-theme') || 'light';
  document.body.classList.toggle('dark', savedTheme === 'dark');
  themeToggle.textContent = savedTheme === 'dark' ? 'Modo claro' : 'Modo oscuro';
};

const saveTheme = () => {
  const dark = document.body.classList.contains('dark');
  localStorage.setItem('album-theme', dark ? 'dark' : 'light');
  themeToggle.textContent = dark ? 'Modo claro' : 'Modo oscuro';
};

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  saveTheme();
});

const fetchJson = async (url, options = {}) => {
  const requestOptions = { ...options };
  if (!(requestOptions.body instanceof FormData) && !requestOptions.headers?.['Content-Type']) {
    requestOptions.headers = {
      'Content-Type': 'application/json',
      ...requestOptions.headers
    };
  }

  const response = await fetch(url, requestOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Error al cargar la información.' }));
    throw new Error(errorData.error || 'Error al cargar la información.');
  }

  return response.json();
};

const loadAlbums = async () => {
  const albums = await fetchJson('/api/albums');
  state.albums = albums;

  const options = ['<option value="">Sin álbum</option>'];
  const chips = ['<button class="album-chip active" data-album="all" type="button">Todos</button>'];

  albums.forEach((album) => {
    options.push(`<option value="${album.id}">${album.name}</option>`);
    chips.push(`<button class="album-chip" data-album="${album.id}" type="button">${album.name}</button>`);
  });

  albumSelect.innerHTML = options.join('');
  albumChips.innerHTML = chips.join('');

  document.querySelectorAll('.album-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.activeAlbum = chip.dataset.album;
      document.querySelectorAll('.album-chip').forEach((item) => item.classList.toggle('active', item === chip));
      renderGallery();
    });
  });
};

const loadMedia = async () => {
  const media = await fetchJson('/api/media');
  state.media = media;
  renderGallery();
};

const emptyState = (message) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';
  wrapper.textContent = message;
  return wrapper;
};

const renderGallery = () => {
  const filteredMedia = state.media.filter((item) => {
    if (state.activeAlbum !== 'all' && item.albumId !== state.activeAlbum) return false;

    if (state.selectedFilter === 'favorites') return item.favorite;
    if (state.selectedFilter === 'videos') return item.type === 'video';
    if (state.selectedFilter === 'images') return item.type === 'image';

    return true;
  });

  galleryEl.innerHTML = '';

  if (!filteredMedia.length) {
    galleryEl.appendChild(emptyState('No hay contenido en esta vista aún.'));
    return;
  }

  filteredMedia.forEach((item) => {
    const node = mediaTemplate.content.firstElementChild.cloneNode(true);
    const preview = node.querySelector('.media-preview');
    const title = node.querySelector('h3');
    const badge = node.querySelector('.badge');
    const favoriteBtn = node.querySelector('.favorite-btn');
    const deleteBtn = node.querySelector('.delete-btn');
    const moveBtn = node.querySelector('.move-album-btn');

    title.textContent = item.title || 'Sin título';
    badge.textContent = item.type === 'video' ? 'Video' : 'Imagen';
    favoriteBtn.textContent = item.favorite ? '♥' : '♡';
    favoriteBtn.classList.toggle('is-favorite', !!item.favorite);

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.src = item.url;
      video.controls = true;
      video.muted = true;
      video.playsInline = true;
      preview.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.title || 'Foto';
      preview.appendChild(img);
    }

    favoriteBtn.addEventListener('click', async () => {
      await fetch(`/api/media/${item.id}/favorite`, { method: 'POST' });
      await loadMedia();
    });

    deleteBtn.addEventListener('click', async () => {
      if (!window.confirm('¿Deseas eliminar esta foto o video de tu álbum?')) return;
      await fetch(`/api/media/${item.id}`, { method: 'DELETE' });
      await loadMedia();
    });

    moveBtn.addEventListener('click', async () => {
      const albumOptions = state.albums.map((album) => `<option value="${album.id}">${album.name}</option>`).join('');
      const selection = window.prompt(`Elige el álbum de destino\n${albumOptions || 'No hay álbumes creados'}`, item.albumId || '');
      if (selection === null) return;
      await fetch(`/api/media/${item.id}/album`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: selection || null })
      });
      await loadMedia();
    });

    galleryEl.appendChild(node);
  });
};

document.querySelectorAll('.filter-btn').forEach((button) => {
  button.addEventListener('click', () => {
    state.selectedFilter = button.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach((item) => item.classList.toggle('active', item === button));
    renderGallery();
  });
});

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const files = [...fileInput.files];
  if (!files.length) {
    alert('Elige al menos una imagen o video.');
    return;
  }

  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', mediaTitle.value || file.name);
    if (albumSelect.value) {
      formData.append('albumId', albumSelect.value);
    }

    const response = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error al subir el archivo.' }));
      throw new Error(errorData.error || 'Error al subir el archivo.');
    }
  }

  uploadForm.reset();
  fileInput.value = '';
  mediaTitle.value = '';
  await loadMedia();
  await loadAlbums();
});

albumForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = albumNameInput.value.trim();
  if (!name) {
    alert('Escribe el nombre del álbum.');
    return;
  }

  await fetch('/api/albums', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description: albumDescriptionInput.value.trim()
    })
  });

  albumForm.reset();
  await loadAlbums();
  await loadMedia();
});

const init = async () => {
  applyTheme();
  await loadAlbums();
  await loadMedia();
};

init();
