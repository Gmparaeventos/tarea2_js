/**
 * ============================================================
 * setup_admin.js
 * ------------------------------------------------------------
 * Ejecutar UNA SOLA VEZ despues de importar sql/cloudprofiles.sql:
 *
 *   node setup_admin.js
 *
 * Genera un hash seguro (bcryptjs) para la cuenta definida en
 * ADMIN_EMAIL / ADMIN_PASSWORD (archivo .env) y lo guarda en la BD.
 * ============================================================
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

(async () => {
  const email = process.env.ADMIN_EMAIL || 'admin@cloudprofiles.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin123';

  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    "UPDATE usuarios SET password = ? WHERE email = ?",
    [hash, email]
  );

  if (result.affectedRows > 0) {
    console.log('Contraseña del admin configurada correctamente.');
    console.log(`Correo: ${email}`);
    console.log(`Contraseña: ${password}`);
  } else {
    console.log('No se encontro la cuenta admin. Verifica que ejecutaste sql/cloudprofiles.sql primero.');
  }

  process.exit(0);
})();
