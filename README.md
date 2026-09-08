# CloudProfiles (Node.js / Express) — Guía de despliegue en AWS

Misma aplicación (Login/Registro, Mi Perfil, Panel Admin CRUD), esta vez con
backend en **Node.js + Express + EJS**, MySQL en Amazon RDS y **Amazon S3** para
las imágenes, corriendo sobre **Amazon EC2** (Amazon Linux).

---

## 0. Requisitos previos
- Cuenta de AWS (Academy Lab / Free Tier).
- Un par de llaves (.pem) para conectarte por SSH a EC2.

---

## 1. Crear el bucket S3

1. Consola AWS → **S3** → **Create bucket**.
2. Nombre único, ej. `cloudprofiles-imagenes-TUAPELLIDO`. Misma región que EC2/RDS.
3. **Block all public access**: mantenlo **activado** (bucket privado). Las
   imágenes se muestran con URLs firmadas (presigned URLs) generadas por el backend.
4. Actualiza `S3_BUCKET` y `S3_REGION` en tu archivo `.env`.

### (Opcional) Bucket público de solo lectura
Si prefieres no usar URLs firmadas, desactiva "Block public access" y agrega esta
Bucket Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::cloudprofiles-imagenes-TUAPELLIDO/*"
  }]
}
```

---

## 2. Crear el rol IAM para EC2

1. IAM → Roles → **Create role** → Trusted entity: **AWS service** → **EC2**.
2. Crea una política personalizada `CloudProfilesS3Policy`:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "CloudProfilesS3Access",
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::cloudprofiles-imagenes-TUAPELLIDO/*"
       },
       {
         "Sid": "CloudProfilesS3List",
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::cloudprofiles-imagenes-TUAPELLIDO"
       }
     ]
   }
   ```
3. Nombra el rol `CloudProfilesEC2Role` y adjunta la política.

> El SDK de AWS para Node (`@aws-sdk/client-s3`) toma las credenciales
> automáticamente del rol de la instancia — nunca se ponen Access Key / Secret
> Key en el código ni en el `.env`.

---

## 3. Crear la base de datos en Amazon RDS (MySQL)

1. RDS → **Create database** → Motor **MySQL** → plantilla **Free tier**.
2. Identificador: `cloudprofiles-db`. Usuario maestro `admin` + contraseña segura.
3. Conectividad: **Public access: No**. Crea el Security Group `cloudprofiles-rds-sg`.
4. Cuando esté disponible, copia el **endpoint** al `.env` (`DB_HOST`).
5. Importa el esquema (desde tu maquina o desde EC2, si ya tienes `mysql` client):
   ```bash
   mysql -h TU-ENDPOINT-RDS -u admin -p < sql/cloudprofiles.sql
   ```

### Security Group de RDS (`cloudprofiles-rds-sg`)
| Tipo | Puerto | Origen |
|------|--------|--------|
| MySQL/Aurora | 3306 | Security Group de EC2 (`cloudprofiles-ec2-sg`) — **no** `0.0.0.0/0` |

---

## 4. Lanzar la instancia EC2

1. EC2 → **Launch instance** → AMI **Amazon Linux 2023** → tipo `t2.micro`.
2. Selecciona/crea el par de llaves (.pem).
3. Security group nuevo `cloudprofiles-ec2-sg` (ver tabla abajo).
4. **Advanced details** → **IAM instance profile** → `CloudProfilesEC2Role`.
5. Lanza la instancia y copia su **IP pública**.

### Security Group de EC2 (`cloudprofiles-ec2-sg`)
| Tipo | Puerto | Origen |
|------|--------|--------|
| HTTP (app Node) | 80 | 0.0.0.0/0 |
| SSH | 22 | Tu IP — **nunca** `0.0.0.0/0` |

> La app corre en el puerto definido por `PORT` en `.env` (80 por defecto). En
> Amazon Linux, escuchar el puerto 80 sin privilegios de root requiere correr
> con `sudo` o (mejor) usar el gestor de procesos `pm2` como servicio.

---

## 5. Configurar el servidor y desplegar la app

Conéctate por SSH:
```bash
ssh -i tu-llave.pem ec2-user@TU-IP-PUBLICA
```

Instala Node.js 20 (LTS) y git:
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs git
node -v && npm -v
```

Sube el proyecto (opción A: ZIP entregado):
```bash
scp -i tu-llave.pem cloudprofiles-node.zip ec2-user@TU-IP-PUBLICA:~
ssh -i tu-llave.pem ec2-user@TU-IP-PUBLICA
unzip cloudprofiles-node.zip
cd cloudprofiles-node
```

Opción B (desde GitHub, si subiste el código a un repositorio):
```bash
git clone https://github.com/TU-USUARIO/cloudprofiles-node.git
cd cloudprofiles-node
```

Instala dependencias:
```bash
npm install
```

Crea y edita el archivo de variables de entorno:
```bash
cp .env.example .env
nano .env
```
(Actualiza `DB_HOST`, `DB_PASS`, `S3_BUCKET`, `S3_REGION`, `SESSION_SECRET`.)

Importa el esquema de base de datos (desde EC2, que sí puede llegar a RDS):
```bash
sudo dnf install -y mysql
mysql -h TU-ENDPOINT-RDS -u admin -p < sql/cloudprofiles.sql
```

Configura la contraseña real de la cuenta admin (una sola vez):
```bash
node setup_admin.js
```
Verás en consola el correo y la contraseña configurados
(`admin@cloudprofiles.com` / `Admin123` por defecto, editable en `.env`).

### Ejecutar la app de forma permanente con PM2
```bash
sudo npm install -g pm2
sudo pm2 start server.js --name cloudprofiles
sudo pm2 startup
sudo pm2 save
```

¡Listo! Abre `http://TU-IP-PUBLICA/` en el navegador.

> Alternativa sencilla sin PM2 (solo pruebas): `sudo node server.js` o cambia
> `PORT=3000` en `.env` y publica ese puerto en el Security Group.

---

## 6. Flujo de prueba (para tu documentación / capturas)

1. **Registro**: crea una cuenta con correo + contraseña + confirmación.
2. **Login**: inicia sesión → caes en "Mi perfil".
3. **Mi perfil**: sube una foto, completa nombre/apellido/teléfono/descripción.
   - Verifica en la consola S3 que apareció `perfiles/{id}/avatar.ext`.
4. Cierra sesión, entra como admin (`admin@cloudprofiles.com`).
5. **Panel admin**: tabla con todos los perfiles → Ver, Editar, Crear, Eliminar
   (elimina también la imagen en S3).
6. Prueba de carga básica: registra 5–10 cuentas seguidas y confirma que la
   tabla del admin las lista correctamente.

---

## 7. Estructura del proyecto

```
cloudprofiles-node/
├── config/
│   ├── db.js              (pool de conexiones MySQL - mysql2)
│   └── s3.js               (subir/eliminar/leer imágenes S3 - AWS SDK v3)
├── middleware/
│   └── auth.js             (sesión, requiereLogin, requiereAdmin)
├── routes/
│   ├── auth.js              (login, registro, logout)
│   ├── perfil.js             (Mi perfil)
│   └── admin.js               (CRUD completo)
├── views/
│   ├── login.ejs, registro.ejs, perfil.ejs
│   └── admin/ (index.ejs, form.ejs, ver.ejs)
├── public/
│   ├── css/style.css
│   └── img/default-avatar.svg
├── sql/cloudprofiles.sql
├── setup_admin.js           (configurar password admin - ejecutar 1 vez)
├── server.js
├── package.json
└── .env.example
```

## 8. Notas de seguridad implementadas
- RDS sin acceso público; solo el Security Group de EC2 llega al puerto 3306.
- EC2 solo expone 80 (HTTP) y 22 (SSH restringido a tu IP).
- Credenciales de S3 nunca en el código: EC2 usa un **IAM Role** (AWS SDK v3).
- Contraseñas de usuario cifradas con **bcryptjs**.
- Bucket S3 privado; imágenes servidas con URLs firmadas temporales.
- Sesiones de usuario manejadas con `express-session` (cookie firmada).
