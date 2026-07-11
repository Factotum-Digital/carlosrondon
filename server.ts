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

  // API Route for visits with server-side proxy and local fallback
  app.get('/api/visits', async (req, res) => {
    const increment = req.query.increment === 'true';
    const externalUrl = increment
      ? 'https://api.counterapi.dev/v1/santiago_marino_metrologia_academic/page_visits/up'
      : 'https://api.counterapi.dev/v1/santiago_marino_metrologia_academic/page_visits/';

    try {
      // Use a timeout to abort the external request if the service is down or slow
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(externalUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: any = await response.json();
      if (data && typeof data.count === 'number') {
        saveLocalVisits(data.count);
        return res.json({ count: data.count });
      }
      throw new Error('Invalid response structure from counterapi');
    } catch (error) {
      console.warn('CounterAPI failed, falling back to local counter:', error);
      let localCount = getLocalVisits();
      if (increment) {
        localCount += 1;
        saveLocalVisits(localCount);
      }
      return res.json({ count: localCount });
    }
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
