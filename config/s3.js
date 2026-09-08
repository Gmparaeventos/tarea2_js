require('dotenv').config();
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');

// No se pasan credenciales: en EC2 el SDK las toma automaticamente
// del IAM Role asignado a la instancia (ver README).
const s3 = new S3Client({ region: process.env.S3_REGION });

const BUCKET = process.env.S3_BUCKET;

/**
 * Sube un archivo local a S3 en perfiles/{idUsuario}/avatar.ext
 * Devuelve el key guardado, o null si falla.
 */
async function subirImagenS3(rutaArchivoTmp, idUsuario, nombreOriginal, mimeType) {
  const ext = nombreOriginal.split('.').pop().toLowerCase();
  const key = `perfiles/${idUsuario}/avatar.${ext}`;
  try {
    const body = fs.readFileSync(rutaArchivoTmp);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: mimeType,
    }));
    return key;
  } catch (err) {
    console.error('Error subiendo a S3:', err.message);
    return null;
  } finally {
    fs.unlink(rutaArchivoTmp, () => {});
  }
}

/** Elimina un objeto de S3 dado su key. */
async function eliminarImagenS3(key) {
  if (!key) return true;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err) {
    console.error('Error eliminando de S3:', err.message);
    return false;
  }
}

/** Genera una URL firmada temporal (bucket privado) o null si no hay imagen. */
async function urlImagenS3(key, minutos = 30) {
  if (!key) return null;
  try {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return await getSignedUrl(s3, cmd, { expiresIn: minutos * 60 });
  } catch (err) {
    console.error('Error generando URL firmada:', err.message);
    return null;
  }
}

module.exports = { subirImagenS3, eliminarImagenS3, urlImagenS3 };
