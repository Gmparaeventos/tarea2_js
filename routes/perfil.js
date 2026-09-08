const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const { subirImagenS3, eliminarImagenS3, urlImagenS3 } = require('../config/s3');
const { requiereLogin, tomarMensaje, setMensaje } = require('../middleware/auth');

const upload = multer({ dest: 'tmp_uploads/' });

router.get('/perfil', requiereLogin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.session.usuario.id]);
  const usuario = rows[0];
  if (!usuario) return res.redirect('/logout');

  const urlFoto = (await urlImagenS3(usuario.foto_perfil)) || '/img/default-avatar.svg';
  res.render('perfil', { usuario, urlFoto, mensaje: tomarMensaje(req) });
});

router.post('/perfil', requiereLogin, upload.single('foto'), async (req, res) => {
  const id = req.session.usuario.id;
  const { nombre, apellido, telefono, descripcion } = req.body;

  const [rows] = await pool.query('SELECT foto_perfil FROM usuarios WHERE id = ?', [id]);
  let fotoKey = rows[0] ? rows[0].foto_perfil : null;

  if (req.file) {
    const permitidas = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    if (permitidas.includes(ext)) {
      const nuevaKey = await subirImagenS3(req.file.path, id, req.file.originalname, req.file.mimetype);
      if (nuevaKey) fotoKey = nuevaKey;
      else setMensaje(req, 'No se pudo subir la imagen a S3.', 'error');
    } else {
      setMensaje(req, 'Formato de imagen no permitido.', 'error');
    }
  }

  await pool.query(
    'UPDATE usuarios SET nombre=?, apellido=?, telefono=?, descripcion=?, foto_perfil=? WHERE id=?',
    [nombre || '', apellido || '', telefono || '', descripcion || '', fotoKey, id]
  );

  if (!req.session.mensaje) setMensaje(req, 'Perfil actualizado correctamente.', 'exito');
  res.redirect('/perfil');
});

router.post('/perfil/eliminar-foto', requiereLogin, async (req, res) => {
  const id = req.session.usuario.id;
  const [rows] = await pool.query('SELECT foto_perfil FROM usuarios WHERE id = ?', [id]);
  const fotoKey = rows[0] ? rows[0].foto_perfil : null;

  if (fotoKey) {
    await eliminarImagenS3(fotoKey);
    await pool.query('UPDATE usuarios SET foto_perfil = NULL WHERE id = ?', [id]);
    setMensaje(req, 'Imagen eliminada.', 'exito');
  }
  res.redirect('/perfil');
});

module.exports = router;
