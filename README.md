# 🎄 Regalo Clave — Intercambio de regalos con nombres clave

Web pública para intercambios de regalos o cartas. Cada persona que se une a
un grupo recibe un **nombre clave secreto** (Papá Noel, Gatito Mimado...) y
solo descubre el nombre clave de la persona a la que le va a regalar.

- Crear grupo o unirse con un código de 6 letras
- Nombres clave únicos por grupo + código personal secreto por persona
- Lista de deseos activable en la configuración del grupo
- Sorteo secreto del organizador (mínimo 3 personas, nadie se auto-regala)
- Revelación privada con tarjeta que se voltea
- Flujo por pasos con animaciones deslizantes y pantallas emergentes
- Ideas de regalo con enlaces de afiliado + espacio patrocinado

## Cómo funciona por dentro

- Frontend estático: `index.html`, `styles.css`, `app.js`
- Servidor: una Netlify Function (`netlify/functions/api.js`) con los grupos
  guardados en Netlify Blobs. El servidor solo entrega a cada persona su
  propio amigo secreto: las parejas nunca salen en la vista pública.

## Despliegue

Conecta este repo en Netlify (importar desde GitHub). No necesita comando de
build: Netlify detecta `netlify/functions` y `netlify.toml` automáticamente.

## Desarrollo local

```bash
npm install
node /tmp/test-api.mjs   # pruebas de la API con almacén en memoria
```
