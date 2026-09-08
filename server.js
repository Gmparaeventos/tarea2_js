require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const perfilRoutes = require('./routes/perfil');
const adminRoutes = require('./routes/admin');

const app = express();

// Carpeta temporal para subidas antes de mandarlas a S3
if (!fs.existsSync('tmp_uploads')) fs.mkdirSync('tmp_uploads');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'cambia_esta_clave',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 4 }, // 4 horas
}));

// Variable disponible en todas las vistas
app.use((req, res, next) => {
  res.locals.usuarioSesion = req.session.usuario || null;
  next();
});

app.get('/', (req, res) => {
  if (req.session.usuario) {
    return res.redirect(req.session.usuario.rol === 'admin' ? '/admin' : '/perfil');
  }
  res.redirect('/login');
});

app.use(authRoutes);
app.use(perfilRoutes);
app.use(adminRoutes);

app.use((req, res) => res.status(404).send('Pagina no encontrada'));

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`CloudProfiles (Node/Express) corriendo en el puerto ${PORT}`);
});
