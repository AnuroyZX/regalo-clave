# 🎄 Regalo Clave — Intercambio de regalos con nombres clave

Web pública para intercambios de regalos o cartas. Cada persona que se une a
un grupo recibe un **nombre clave secreto** (Papá Noel, Gatito Mimado...) y
solo descubre el nombre clave de la persona a la que le va a regalar.

- Crear grupo o unirse con un código de 6 letras
- Nombres clave únicos por grupo
- Cuentas opcionales con correo y contraseña para volver a tus grupos desde cualquier dispositivo
- Lista de deseos activable en la configuración del grupo
- Sorteo secreto del organizador (mínimo 3 personas, nadie se auto-regala)
- Revelación privada con tarjeta que se voltea
- Flujo por pasos con animaciones deslizantes y pantallas emergentes
- Ideas de regalo con foto, precio y descripción para agregar a la lista de deseos

## Cómo funciona por dentro

- Frontend estático: `index.html`, `styles.css`, `app.js`
- Servidor: una Netlify Function (`netlify/functions/api.js`) con los grupos,
  cuentas y sesiones guardados en Netlify Blobs. El servidor solo entrega a
  cada persona su propio amigo secreto: las parejas nunca salen en la vista pública.
- Restablecer contraseña por correo con Resend: configura `RESEND_API_KEY` y
  `RESEND_FROM` en las variables de entorno de Netlify.
- Protecciones: sorteo único, organizador por cuenta (no solo por dispositivo),
  solo enlaces http(s) en deseos, límite de intentos en login/registro/reset y
  revocación de sesiones al cambiar la contraseña.

## Despliegue

Conecta este repo en Netlify (importar desde GitHub). No necesita comando de
build: Netlify detecta `netlify/functions` y `netlify.toml` automáticamente.

## Desarrollo local

```bash
npm install
node test-api.mjs   # pruebas de la API con almacén en memoria
```
