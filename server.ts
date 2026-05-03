import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // --- Database Setup ---
  let pool: Pool | null = null;
  if (process.env.DATABASE_HOST && process.env.DATABASE_USER && process.env.DATABASE_PASSWORD && process.env.DATABASE_NAME) {
    pool = new Pool({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    });
    console.log('PostgreSQL connection pool initialized.');
  } else {
    console.warn('Missing database environment variables. Running without DB connection.');
  }

  // --- Cloud Storage Setup ---
  let storage: Storage | null = null;
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (bucketName) {
    storage = new Storage();
    console.log(`Google Cloud Storage initialized for bucket: ${bucketName}`);
  } else {
    console.warn('Missing GCS_BUCKET_NAME environment variable. Running without Cloud Storage.');
  }

  // --- Mock Data ---
  const mockProjects: Record<string, unknown>[] = [
    {
      id: 'proj-1',
      client: 'Smith Residence',
      address: '123 Oak St, Springfield',
      status: 'active',
      currentStage: 'Mitigation',
      riskLevel: 'high',
      waterCategory: 'Category 3',
      lossClass: 'Class 2',
      summary: 'Water damage from burst pipe in kitchen.',
      rooms: [
        {
          id: 'room-1',
          name: 'Kitchen',
          dimensions: { length: 15, width: 12, height: 9 },
          readings: [],
          photos: [],
          status: 'wet'
        }
      ],
      roomScans: [],
      equipment: [],
      tasks: [],
      dryingLogs: [],
      complianceChecks: {
        asbestos: 'not_tested',
        aiChecklist: []
      }
    }
  ];

  // --- API Routes ---
  app.get('/api/health', async (req, res) => {
    let dbStatus = 'disconnected';
    if (pool) {
      try {
        await pool.query('SELECT 1');
        dbStatus = 'connected';
      } catch {
        dbStatus = 'error';
      }
    }
    
    res.json({ 
      status: 'ok', 
      database: dbStatus,
      storage: storage ? 'configured' : 'missing_config'
    });
  });

  app.get('/api/projects', async (req, res) => {
    res.json(mockProjects);
  });

  app.get('/api/projects/:id', async (req, res) => {
    const project = mockProjects.find(p => p.id === req.params.id);
    if (project) {
      res.json(project);
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  });

  app.post('/api/projects', async (req, res) => {
    const newProject = {
      id: `proj-${Date.now()}`,
      ...req.body
    };
    mockProjects.push(newProject);
    res.status(201).json(newProject);
  });

  app.delete('/api/projects/:id', async (req, res) => {
    const index = mockProjects.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
      mockProjects.splice(index, 1);
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  });

  app.patch('/api/projects/:id', async (req, res) => {
    const index = mockProjects.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
      mockProjects[index] = { ...mockProjects[index], ...req.body };
      res.json(mockProjects[index]);
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  });

  // API route for uploading media to Cloud Storage
  app.post('/api/projects/:id/media', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!storage || !bucketName) {
      return res.status(503).json({ error: 'Cloud Storage not configured' });
    }

    try {
      const projectId = req.params.id;
      const fileName = `projects/${projectId}/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(fileName);

      await file.save(req.file.buffer, {
        contentType: req.file.mimetype,
        resumable: false,
      });

      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      res.json({ url: publicUrl });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  // --- Vite Middleware (Development) or Static Serving (Production) ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express v5 uses *all instead of * for catch-all routes
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
