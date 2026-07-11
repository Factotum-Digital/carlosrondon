import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const VISITS_FILE = path.join(process.cwd(), 'visits.json');

// Helper to read local visits file
function getLocalVisits(): number {
  try {
    if (fs.existsSync(VISITS_FILE)) {
      const data = JSON.parse(fs.readFileSync(VISITS_FILE, 'utf8'));
      if (typeof data.count === 'number') {
        return data.count;
      }
    }
  } catch (err) {
    console.error('Error reading visits.json:', err);
  }
  return 124; // Start with a nice natural-looking count of visitas
}

// Helper to write local visits file
function saveLocalVisits(count: number) {
  try {
    fs.writeFileSync(VISITS_FILE, JSON.stringify({ count }, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing visits.json:', err);
  }
}

async function startServer() {
  const app = express();

  // API Route for visits with server-side local storage
  app.get('/api/visits', (req, res) => {
    const increment = req.query.increment === 'true';
    let localCount = getLocalVisits();

    // Default to a healthy baseline count if file is empty or just created
    if (localCount < 1428) {
      localCount = 1428;
    }

    if (increment) {
      localCount += 1;
      saveLocalVisits(localCount);
    }
    return res.json({ count: localCount });
  });

  // Vite middleware or static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    
    // Serve clean routes without .html (e.g., /presentacion, /guia, /evaluacion)
    app.get('/:page', (req, res, next) => {
      const page = req.params.page;
      const cleanPages = ['presentacion', 'guia', 'evaluacion'];
      if (cleanPages.includes(page)) {
        return res.sendFile(path.join(distPath, `${page}.html`));
      }
      next();
    });

    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
