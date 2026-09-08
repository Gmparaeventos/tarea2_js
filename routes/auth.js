const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { redirigirSiLogueado, tomarMensaje, setMensaje } = require('../middleware/auth');

const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ---------- LOGIN ----------
router.get('/login', redirigirSiLogueado, (req, res) => {
  res.render('login', { mensaje: tomarMensaje(req) });
});

router.post('/login', redirigirSiLogueado, async (req, res) => {
  const { email, password } = req.body;

  if (!validarEmail(email) || !password) {
    setMensaje(req, 'Ingresa un correo valido y tu contraseña.', 'error');
    return res.redirect('/login');
  }

  const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
  const usuario = rows[0];

  if (usuario && await bcrypt.compare(password, usuario.password)) {
    req.session.usuario = { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol };
    return res.redirect(usuario.rol === 'admin' ? '/admin' : '/perfil');
  }

  setMensaje(req, 'Correo o contraseña incorrectos.', 'error');
  res.redirect('/login');
});

// ---------- REGISTRO ----------
router.get('/registro', redirigirSiLogueado, (req, res) => {
  res.render('registro', { mensaje: tomarMensaje(req) });
});

router.post('/registro', redirigirSiLogueado, async (req, res) => {
  const { email, password, confirmar_password } = req.body;

  if (!validarEmail(email)) {
    setMensaje(req, 'Ingresa un correo electronico valido.', 'error');
    return res.redirect('/registro');
  }
  if (!password || password.length < 6) {
    setMensaje(req, 'La contraseña debe tener al menos 6 caracteres.', 'error');
    return res.redirect('/registro');
  }
  if (password !== confirmar_password) {
    setMensaje(req, 'Las contraseñas no coinciden.', 'error');
    return res.redirect('/registro');
  }

  const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existe.length > 0) {
    setMensaje(req, 'Ese correo ya esta registrado.', 'error');
    return res.redirect('/registro');
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO usuarios (nombre, apellido, email, password, rol) VALUES ('', '', ?, ?, 'usuario')",
    [email, hash]
  );

  setMensaje(req, 'Cuenta creada correctamente. Ya puedes iniciar sesion.', 'exito');
  res.redirect('/login');
});

// ---------- LOGOUT ----------
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
