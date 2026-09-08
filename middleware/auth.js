function requiereLogin(req, res, next) {
  if (!req.session.usuario) return res.redirect('/login');
  next();
}

function requiereAdmin(req, res, next) {
  if (!req.session.usuario) return res.redirect('/login');
  if (req.session.usuario.rol !== 'admin') return res.redirect('/perfil');
  next();
}

function redirigirSiLogueado(req, res, next) {
  if (req.session.usuario) {
    return res.redirect(req.session.usuario.rol === 'admin' ? '/admin' : '/perfil');
  }
  next();
}

/** Toma y limpia el mensaje flash guardado en sesión (exito/error). */
function tomarMensaje(req) {
  const msg = req.session.mensaje;
  delete req.session.mensaje;
  return msg || null;
}

function setMensaje(req, texto, tipo = 'info') {
  req.session.mensaje = { texto, tipo };
}

module.exports = { requiereLogin, requiereAdmin, redirigirSiLogueado, tomarMensaje, setMensaje };
