import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeSequence, DISEASE_CATALOG } from './src/api/bioinformatics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '256kb' }));

const port = process.env.PORT || 8080;

// Headers de segurança básicos
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com https://use.fontawesome.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com https://use.fontawesome.com; img-src 'self' data: blob:; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://formspree.io;");
  next();
});

// Bloqueia acesso a arquivos/diretórios sensíveis ANTES do express.static
const SENSITIVE_PATTERNS = ['server.js', 'package.json', 'package-lock.json', '.gitignore', 'auditoria.md', 'AUDITORIA-PROTEIN-SYNTHESIS.md', 'prompts-redesign-protein-synthesis.md'];
app.use(function (req, res, next) {
  const reqPath = req.path.replace(/^\//, '');
  if (SENSITIVE_PATTERNS.includes(reqPath) || reqPath.startsWith('audit/') || reqPath.startsWith('src/') || reqPath.startsWith('.git/') || reqPath.startsWith('node_modules/')) {
    return res.status(404).end();
  }
  next();
});

app.get('/', function (req, res) {
   res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', function (req, res) {
   res.sendFile(path.join(__dirname, 'index.html'));
});

// Modo Beta — nova geração modular e em camadas de visualização
app.get(['/beta', '/beta.html'], function (req, res) {
   res.sendFile(path.join(__dirname, 'beta.html'));
});

// API REST v1 — motor bioinformático e catálogo científico
app.get('/api/v1/health', function (req, res) {
  res.json({ ok: true, version: '2.0.0-beta', engine: 'bioinformatics-v1' });
});

app.get('/api/v1/catalog/diseases', function (req, res) {
  res.json({ items: DISEASE_CATALOG });
});

app.post('/api/v1/analyze', function (req, res) {
  const sequence = req.body && typeof req.body.sequence === 'string' ? req.body.sequence : '';
  if (!sequence.trim()) {
    return res.status(400).json({ error: 'Sequência vazia ou inválida.' });
  }
  if (sequence.length > 15000) {
    return res.status(413).json({ error: 'Sequência excede o limite de 15.000 caracteres.' });
  }
  return res.json(analyzeSequence(sequence));
});

// Serve arquivos estáticos (html, css, js, imagens) APÓS rotas e bloqueio
app.use(express.static(__dirname, {
  dotfiles: 'ignore',
  index: false
}));

app.listen(port, function () {
   console.log('Our app is running on http://localhost:' + port);
});
