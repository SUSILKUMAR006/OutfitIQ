// AI helpers: tag a garment photo with Gemini before it is saved.
import express from 'express';
import multer from 'multer';
import { AiError, aiEnabled, tagGarment } from '../ai.js';

const router = express.Router();
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, IMAGE_TYPES.has(file.mimetype)),
});

router.get('/status', (req, res) => res.json({ enabled: aiEnabled() }));

// multipart: image (JPEG/PNG/WebP). Responds with suggested item fields; nothing is stored.
router.post('/tag', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Send one JPEG, PNG or WebP image as "image".' });
  try {
    res.json(await tagGarment(req.file.buffer, req.file.mimetype));
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    res.status(err.status).json({ error: err.message });
  }
});

export default router;
