const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const rootDir = __dirname;
const uploadsDir = path.join(rootDir, 'storage', 'uploads');
const imageDir = path.join(uploadsDir, 'images');
const videoDir = path.join(uploadsDir, 'videos');
const dataDir = path.join(rootDir, 'data');
const dbFile = path.join(dataDir, 'gallery.json');
const publicDir = path.join(rootDir, 'public');

const ensureDirectory = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const ensureStorage = () => {
  ensureDirectory(uploadsDir);
  ensureDirectory(imageDir);
  ensureDirectory(videoDir);
  ensureDirectory(dataDir);
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ albums: [], media: [] }, null, 2));
  }
};

ensureStorage();

const readGalleryData = () => {
  try {
    const raw = fs.readFileSync(dbFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return { albums: [], media: [] };
  }
};

const writeGalleryData = (data) => {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
};

const sanitizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isVideo = file.mimetype.startsWith('video/');
    cb(null, isVideo ? videoDir : imageDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path.basename(file.originalname || 'media', ext);
    const safeBase = base.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 80) || 'media';
    cb(null, `${Date.now()}-${uuidv4()}-${safeBase}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no soportado. Usa imagen o video.'));
    }
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(publicDir));

const normalizeMedia = (item) => ({
  ...item,
  type: item.type || (item.url && item.url.includes('/videos/') ? 'video' : 'image'),
  favorite: !!item.favorite,
  albumId: item.albumId || null,
  createdAt: item.createdAt || new Date().toISOString()
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Album J&J online' });
});

app.get('/api/albums', (req, res) => {
  const data = readGalleryData();
  res.json(data.albums || []);
});

app.post('/api/albums', (req, res) => {
  const name = sanitizeName(req.body.name);
  if (!name) {
    return res.status(400).json({ error: 'El nombre del álbum es obligatorio.' });
  }

  const data = readGalleryData();
  const albums = data.albums || [];
  const exists = albums.some((album) => album.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: 'Ya existe un álbum con ese nombre.' });
  }

  const album = {
    id: uuidv4(),
    name,
    description: sanitizeName(req.body.description || ''),
    createdAt: new Date().toISOString()
  };

  albums.push(album);
  data.albums = albums;
  writeGalleryData(data);
  res.status(201).json(album);
});

app.get('/api/media', (req, res) => {
  const data = readGalleryData();
  const items = (data.media || []).map(normalizeMedia);
  res.json(items);
});

app.post('/api/media/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Debes seleccionar una imagen o video.' });
  }

  const data = readGalleryData();
  const albumId = sanitizeName(req.body.albumId || '');
  const title = sanitizeName(req.body.title || path.parse(req.file.originalname).name || 'Sin título');
  const fileType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  const publicUrl = `/uploads/${fileType === 'video' ? 'videos' : 'images'}/${req.file.filename}`;

  const item = normalizeMedia({
    id: uuidv4(),
    title,
    type: fileType,
    url: publicUrl,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    albumId: albumId || null,
    favorite: false,
    createdAt: new Date().toISOString()
  });

  data.media.push(item);
  writeGalleryData(data);
  res.status(201).json(item);
});

app.post('/api/media/:id/favorite', (req, res) => {
  const data = readGalleryData();
  const media = (data.media || []).map((item) => {
    if (item.id === req.params.id) {
      return { ...item, favorite: !item.favorite };
    }
    return item;
  });

  data.media = media;
  writeGalleryData(data);
  res.json({ success: true, media });
});

app.delete('/api/media/:id', (req, res) => {
  const data = readGalleryData();
  const item = (data.media || []).find((entry) => entry.id === req.params.id);

  if (!item) {
    return res.status(404).json({ error: 'No se encontró el archivo.' });
  }

  const filePath = path.join(rootDir, item.url.replace(/^\//, ''));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  data.media = (data.media || []).filter((entry) => entry.id !== req.params.id);
  writeGalleryData(data);
  res.json({ success: true });
});

app.post('/api/media/:id/album', (req, res) => {
  const data = readGalleryData();
  const { albumId } = req.body;
  data.media = (data.media || []).map((item) => {
    if (item.id === req.params.id) {
      return { ...item, albumId: albumId || null };
    }
    return item;
  });
  writeGalleryData(data);
  res.json({ success: true });
});

app.get('/api/media/favorites', (req, res) => {
  const data = readGalleryData();
  const items = (data.media || []).filter((item) => item.favorite).map(normalizeMedia);
  res.json(items);
});

app.get('/api/media/album/:albumId', (req, res) => {
  const data = readGalleryData();
  const items = (data.media || []).filter((item) => item.albumId === req.params.albumId).map(normalizeMedia);
  res.json(items);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Archivo demasiado grande o formato no válido.' });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Error al procesar el archivo.' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
  console.log(`Carpeta de almacenamiento: ${uploadsDir}`);
});
