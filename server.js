const express = require('express');
const path = require('path');
const app = express();

const port = process.env.PORT || 8080;

// Headers de segurança básicos
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com https://use.fontawesome.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com https://use.fontawesome.com; img-src 'self' data: blob:; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline' 'unsafe-eval'; connect-src 'self';");
  next();
});

// Bloqueia acesso a arquivos/diretórios sensíveis ANTES do express.static
const SENSITIVE_PATTERNS = ['server.js', 'package.json', 'package-lock.json', '.gitignore', 'auditoria.md', 'AUDITORIA-PROTEIN-SYNTHESIS.md', 'prompts-redesign-protein-synthesis.md'];
app.use(function (req, res, next) {
  const reqPath = req.path.replace(/^\//, '');
  if (SENSITIVE_PATTERNS.includes(reqPath) || reqPath.startsWith('audit/') || reqPath.startsWith('.git/') || reqPath.startsWith('node_modules/')) {
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

// Serve arquivos estáticos (html, css, js, imagens) APÓS rotas e bloqueio
app.use(express.static(__dirname, {
  dotfiles: 'ignore',
  index: false
}));

app.listen(port, function () {
   console.log('Our app is running on http://localhost:' + port);
});
