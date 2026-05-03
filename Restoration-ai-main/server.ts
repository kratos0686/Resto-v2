import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';

dotenv.config();

// ── Firebase Admin init ───────────────────────────────────────────────────────
function initFirebaseAdmin() {
  if (admin.apps.length > 0) return;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    try {
      const sa = JSON.parse(
        Buffer.from(saJson, 'base64').toString('utf8')
      );
      admin.initializeApp({ credential: admin.credential.cert(sa) });
      console.log('Firebase Admin: service account (base64)');
      return;
    } catch {
      try {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(saJson)) });
        console.log('Firebase Admin: service account (raw JSON)');
        return;
      } catch (e) { console.error('Firebase Admin parse failed', e); }
    }
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  console.log('Firebase Admin: Application Default Credentials');
}
initFirebaseAdmin();

// ── Auth middleware ───────────────────────────────────────────────────────────
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(header.slice(7).trim());
    res.locals.user = { uid: decoded.uid, email: decoded.email ?? '' };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
  }
}

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
  const spaFallbackLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
  app.use('/api', apiLimiter);

  // ── PostgreSQL ────────────────────────────────────────────────────────────
  let pool: Pool | null = null;
  if (process.env.DATABASE_HOST && process.env.DATABASE_USER && process.env.DATABASE_PASSWORD && process.env.DATABASE_NAME) {
    pool = new Pool({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    });
    console.log('PostgreSQL pool initialised.');
  } else {
    console.warn('No DATABASE_* vars — skipping PostgreSQL.');
  }

  // ── Cloud Storage ─────────────────────────────────────────────────────────
  let storage: Storage | null = null;
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (bucketName) {
    storage = new Storage();
    console.log('GCS bucket:', bucketName);
  }

  // ── Firestore ─────────────────────────────────────────────────────────────
  const db = admin.firestore();

  async function getCompanyId(uid: string): Promise<string> {
    try {
      const snap = await db.collection('users').doc(uid).get();
      if (snap.exists) return (snap.data()?.companyId as string) || 'default-company';
    } catch { /* fall through */ }
    return 'default-company';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/api/health', async (_req, res) => {
    let dbStatus: string = 'disconnected';
    if (pool) { try { await pool.query('SELECT 1'); dbStatus = 'connected'; } catch { dbStatus = 'error'; } }
    let fsStatus: string;
    try { await db.collection('_health').doc('ping').set({ ts: Date.now() }); fsStatus = 'connected'; } catch { fsStatus = 'error'; }
    res.json({ status: 'ok', database: dbStatus, firestore: fsStatus, storage: storage ? 'configured' : 'missing_config' });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECTS
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/api/projects', requireAuth, async (_req, res) => {
    try {
      const companyId = await getCompanyId(res.locals.user.uid);
      const snap = await db.collection('projects').where('companyId', '==', companyId).orderBy('startDate', 'desc').get();
      res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch projects.' }); }
  });

  app.post('/api/projects', requireAuth, async (req, res) => {
    try {
      const { uid } = res.locals.user as { uid: string };
      const companyId = await getCompanyId(uid);
      const body = req.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Body required.' });
      const now = new Date().toISOString();
      const doc: Record<string, unknown> = {
        ...body,
        companyId,
        createdBy: uid,
        startDate: body.startDate ?? now,
        rooms: body.rooms ?? [],
        roomScans: body.roomScans ?? [],
        equipment: body.equipment ?? [],
        tasks: body.tasks ?? [],
        milestones: body.milestones ?? [],
        lineItems: body.lineItems ?? [],
        totalCost: body.totalCost ?? 0,
        invoiceStatus: body.invoiceStatus ?? 'Draft',
        complianceChecks: body.complianceChecks ?? { asbestos: 'not_tested', aiChecklist: [] },
        progress: body.progress ?? 0,
        riskLevel: body.riskLevel ?? 'low',
      };
      const ref = await db.collection('projects').add(doc);
      return res.status(201).json({ id: ref.id, ...doc });
    } catch (err) { console.error(err); return res.status(500).json({ error: 'Failed to create project.' }); }
  });

  app.get('/api/projects/:id', requireAuth, async (req, res) => {
    try {
      const companyId = await getCompanyId(res.locals.user.uid);
      const snap = await db.collection('projects').doc(req.params.id).get();
      if (!snap.exists) return res.status(404).json({ error: 'Project not found.' });
      if (snap.data()!.companyId !== companyId) return res.status(403).json({ error: 'Forbidden.' });
      res.json({ id: snap.id, ...snap.data() });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch project.' }); }
  });

  app.patch('/api/projects/:id', requireAuth, async (req, res) => {
    try {
      const companyId = await getCompanyId(res.locals.user.uid);
      const ref = db.collection('projects').doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Project not found.' });
      if (snap.data()!.companyId !== companyId) return res.status(403).json({ error: 'Forbidden.' });
      const updates = { ...req.body, updatedAt: new Date().toISOString() };
      delete updates.id; delete updates.companyId; delete updates.createdBy;
      await ref.update(updates);
      const updated = await ref.get();
      res.json({ id: updated.id, ...updated.data() });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update project.' }); }
  });

  app.delete('/api/projects/:id', requireAuth, async (req, res) => {
    try {
      const companyId = await getCompanyId(res.locals.user.uid);
      const ref = db.collection('projects').doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Project not found.' });
      if (snap.data()!.companyId !== companyId) return res.status(403).json({ error: 'Forbidden.' });
      await ref.update({ status: 'archived', archivedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to archive project.' }); }
  });

  // ── Media ─────────────────────────────────────────────────────────────────

  app.post('/api/projects/:id/media', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!storage || !bucketName) return res.status(503).json({ error: 'Storage not configured.' });
    try {
      const companyId = await getCompanyId(res.locals.user.uid);
      const pSnap = await db.collection('projects').doc(req.params.id).get();
      if (!pSnap.exists || pSnap.data()!.companyId !== companyId) return res.status(403).json({ error: 'Forbidden.' });
      const safe = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `projects/${req.params.id}/${Date.now()}-${safe}`;
      await storage.bucket(bucketName).file(fileName).save(req.file.buffer, { contentType: req.file.mimetype, resumable: false });
      res.json({ url: `https://storage.googleapis.com/${bucketName}/${fileName}` });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Upload failed.' }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // USERS
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/api/users/me', requireAuth, async (_req, res) => {
    try {
      const snap = await db.collection('users').doc(res.locals.user.uid).get();
      if (!snap.exists) return res.status(404).json({ error: 'User not found.' });
      res.json({ id: snap.id, ...snap.data() });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
  });

  app.post('/api/users', requireAuth, async (req, res) => {
    try {
      const { uid, email } = res.locals.user as { uid: string; email: string };
      const ref = db.collection('users').doc(uid);
      const snap = await ref.get();
      if (snap.exists) return res.json({ id: snap.id, ...snap.data() });
      const user = {
        id: uid, email: email || req.body.email || '',
        name: req.body.name || 'Unknown User',
        role: req.body.role || 'Technician',
        companyId: req.body.companyId || 'default-company',
        permissions: req.body.permissions || [],
        createdAt: new Date().toISOString(),
      };
      await ref.set(user);
      res.status(201).json(user);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
  });

  app.patch('/api/users/:id/permissions', requireAuth, async (req, res) => {
    try {
      const callerSnap = await db.collection('users').doc(res.locals.user.uid).get();
      if (!['CompanyAdmin', 'SuperAdmin'].includes(callerSnap.data()?.role)) {
        return res.status(403).json({ error: 'Insufficient permissions.' });
      }
      const { permissions } = req.body as { permissions: string[] };
      if (!Array.isArray(permissions)) return res.status(400).json({ error: '"permissions" must be an array.' });
      const targetRef = db.collection('users').doc(req.params.id);
      if (!(await targetRef.get()).exists) return res.status(404).json({ error: 'User not found.' });
      await targetRef.update({ permissions });
      const updated = await targetRef.get();
      res.json({ id: updated.id, ...updated.data() });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // COMPANIES
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/api/companies', requireAuth, async (_req, res) => {
    try {
      const caller = (await db.collection('users').doc(res.locals.user.uid).get()).data();
      if (caller?.role !== 'SuperAdmin') return res.status(403).json({ error: 'Forbidden.' });
      const snap = await db.collection('companies').get();
      res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
  });

  app.post('/api/companies', requireAuth, async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      if (!body.name) return res.status(400).json({ error: '"name" required.' });
      const company = {
        name: body.name,
        subscriptionPlan: body.subscriptionPlan ?? 'Basic',
        maxUsers: body.maxUsers ?? 5,
        isActive: body.isActive ?? true,
        createdAt: new Date().toISOString(),
      };
      const ref = await db.collection('companies').add(company);
      res.status(201).json({ id: ref.id, ...company });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
  });

  app.get('/api/companies/:id/users', requireAuth, async (req, res) => {
    try {
      const caller = (await db.collection('users').doc(res.locals.user.uid).get()).data();
      if (caller?.role !== 'SuperAdmin' && caller?.companyId !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      const snap = await db.collection('users').where('companyId', '==', req.params.id).get();
      res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FRONTEND SERVING
  // ══════════════════════════════════════════════════════════════════════════

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', spaFallbackLimiter, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server on http://localhost:${PORT}`));
}

startServer().catch(console.error);
