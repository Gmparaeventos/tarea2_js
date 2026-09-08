-- ============================================
-- CloudProfiles (version Node/Express) - Base de Datos
-- Motor: MySQL (Amazon RDS)
-- ============================================

CREATE DATABASE IF NOT EXISTS cloudprofiles
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cloudprofiles;

CREATE TABLE IF NOT EXISTS usuarios (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    nombre              VARCHAR(100) NOT NULL DEFAULT '',
    apellido            VARCHAR(100) NOT NULL DEFAULT '',
    email               VARCHAR(150) NOT NULL UNIQUE,
    password            VARCHAR(255) NOT NULL,
    telefono            VARCHAR(20)  DEFAULT '',
    descripcion         TEXT,
    foto_perfil         VARCHAR(500) DEFAULT NULL,
    rol                 ENUM('usuario','admin') NOT NULL DEFAULT 'usuario',
    fecha_registro      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                         ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- La cuenta admin se crea/actualiza ejecutando: node setup_admin.js
-- (genera el hash con bcryptjs y lo inserta o actualiza en esta tabla)
INSERT INTO usuarios (nombre, apellido, email, password, telefono, descripcion, rol)
VALUES (
  'Administrador',
  'CloudProfiles',
  'admin@cloudprofiles.com',
  'PENDIENTE',
  '000000000',
  'Cuenta administrativa del sistema CloudProfiles',
  'admin'
)
ON DUPLICATE KEY UPDATE email = email;
