const express = require('express');
const router = express.Router();
const multer = require('multer');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { subirImagenS3, eliminarImagenS3, urlImagenS3 } = require('../config/s3');
const { requiereAdmin, tomarMensaje, setMensaje } = require('../middleware/auth');

const upload = multer({ dest: 'tmp_uploads/' });

const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ---------- LISTA (Read) ----------
router.get('/admin', requiereAdmin, async (req, res) => {
  const [usuarios] = await pool.query('SELECT * FROM usuarios ORDER BY fecha_registro DESC');
  res.render('admin/index', { usuarios, mensaje: tomarMensaje(req) });
});

// ---------- FORMULARIO CREAR ----------
router.get('/admin/nuevo', requiereAdmin, (req, res) => {
  res.render('admin/form', { usuario: null, mensaje: tomarMensaje(req) });
});

// ---------- FORMULARIO EDITAR ----------
router.get('/admin/editar/:id', requiereAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.params.id]);
  if (!rows[0]) {
    setMensaje(req, 'Perfil no encontrado.', 'error');
    return res.redirect('/admin');
  }
  res.render('admin/form', { usuario: rows[0], mensaje: tomarMensaje(req) });
});

// ---------- CREATE ----------
router.post('/admin/nuevo', requiereAdmin, upload.single('foto'), async (req, res) => {
  const { nombre, apellido, email, telefono, descripcion, rol, password } = req.body;
  const rolFinal = rol === 'admin' ? 'admin' : 'usuario';

  if (!validarEmail(email)) {
    setMensaje(req, 'Correo invalido.', 'error');
    return res.redirect('/admin/nuevo');
  }
  if (!password) {
    setMensaje(req, 'La contraseña es obligatoria para un nuevo perfil.', 'error');
    return res.redirect('/admin/nuevo');
  }

  const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existe.length > 0) {
    setMensaje(req, 'Ese correo ya esta en uso por otro perfil.', 'error');
    return res.redirect('/admin/nuevo');
  }

  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO usuarios (nombre, apellido, email, password, telefono, descripcion, rol) VALUES (?,?,?,?,?,?,?)',
    [nombre || '', apellido || '', email, hash, telefono || '', descripcion || '', rolFinal]
  );
  const nuevoId = result.insertId;

  if (req.file) {
    const nuevaKey = await subirImagenS3(req.file.path, nuevoId, req.file.originalname, req.file.mimetype);
    if (nuevaKey) await pool.query('UPDATE usuarios SET foto_perfil = ? WHERE id = ?', [nuevaKey, nuevoId]);
  }

  setMensaje(req, 'Perfil creado correctamente.', 'exito');
  res.redirect('/admin');
});

// ---------- UPDATE ----------
router.post('/admin/editar/:id', requiereAdmin, upload.single('foto'), async (req, res) => {
  const id = req.params.id;
  const { nombre, apellido, email, telefono, descripcion, rol, password } = req.body;
  const rolFinal = rol === 'admin' ? 'admin' : 'usuario';

  const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [id]);
  const usuario = rows[0];
  if (!usuario) {
    setMensaje(req, 'Perfil no encontrado.', 'error');
    return res.redirect('/admin');
  }

  if (!validarEmail(email)) {
    setMensaje(req, 'Correo invalido.', 'error');
    return res.redirect(`/admin/editar/${id}`);
  }

  const [dup] = await pool.query('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, id]);
  if (dup.length > 0) {
    setMensaje(req, 'Ese correo ya esta en uso por otro perfil.', 'error');
    return res.redirect(`/admin/editar/${id}`);
  }

  let fotoKey = usuario.foto_perfil;
  if (req.file) {
    const nuevaKey = await subirImagenS3(req.file.path, id, req.file.originalname, req.file.mimetype);
    if (nuevaKey) fotoKey = nuevaKey;
  }

  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE usuarios SET nombre=?, apellido=?, email=?, telefono=?, descripcion=?, rol=?, foto_perfil=?, password=? WHERE id=?',
      [nombre || '', apellido || '', email, telefono || '', descripcion || '', rolFinal, fotoKey, hash, id]
    );
  } else {
    await pool.query(
      'UPDATE usuarios SET nombre=?, apellido=?, email=?, telefono=?, descripcion=?, rol=?, foto_perfil=? WHERE id=?',
      [nombre || '', apellido || '', email, telefono || '', descripcion || '', rolFinal, fotoKey, id]
    );
  }

  setMensaje(req, 'Perfil actualizado correctamente.', 'exito');
  res.redirect('/admin');
});

// ---------- READ (detalle) ----------
router.get('/admin/ver/:id', requiereAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.params.id]);
  const usuario = rows[0];
  if (!usuario) {
    setMensaje(req, 'Perfil no encontrado.', 'error');
    return res.redirect('/admin');
  }
  const urlFoto = (await urlImagenS3(usuario.foto_perfil)) || '/img/default-avatar.svg';
  res.render('admin/ver', { usuario, urlFoto });
});

// ---------- DELETE ----------
router.post('/admin/eliminar/:id', requiereAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.params.id]);
  const usuario = rows[0];

  if (usuario && usuario.rol !== 'admin') {
    if (usuario.foto_perfil) await eliminarImagenS3(usuario.foto_perfil);
    await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    setMensaje(req, 'Perfil eliminado correctamente.', 'exito');
  } else {
    setMensaje(req, 'No se puede eliminar este perfil.', 'error');
  }
  res.redirect('/admin');
});

module.exports = router;
