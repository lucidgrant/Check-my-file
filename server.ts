/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Check MyFile — Serveur Full-Stack Express avec intégration Vite & API de correction
 */

import express, { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { processFixRequest } from './server/fixService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isDev = process.env.NODE_ENV !== 'production';

  // Support des gros fichiers PDF encodés en Base64 (jusqu'à 100 Mo)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Endpoint de vérification de santé
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      engine: 'Check MyFile Prepress Engine',
      version: '2.2.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Endpoint de correction déterministe
  app.post('/api/fix', async (req: Request, res: Response) => {
    try {
      const { pdfBase64, fileName, profileId, fixerIds, confirmations } = req.body;

      if (!pdfBase64 || !profileId || !fixerIds || !Array.isArray(fixerIds) || fixerIds.length === 0) {
        return res.status(400).json({
          success: false,
          refusalReason: 'Paramètres manquants : pdfBase64, profileId et fixerIds sont requis.',
        });
      }

      const result = await processFixRequest({
        pdfBase64,
        fileName: fileName || 'document.pdf',
        profileId,
        fixerIds,
        confirmations,
      });

      return res.json(result);
    } catch (err: any) {
      console.error('[API /api/fix Error]', err);
      return res.status(500).json({
        success: false,
        refusalReason: `Erreur interne du serveur de correction : ${err?.message || err}`,
      });
    }
  });

  if (isDev) {
    // Mode Développement : monter Vite middlewareMode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Mode Production : servir les fichiers statiques de dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Check MyFile] Server running on http://0.0.0.0:${PORT} (devMode=${isDev})`);
  });
}

startServer().catch((err) => {
  console.error('[Server Startup Failure]', err);
  process.exit(1);
});
