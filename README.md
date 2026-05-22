# Comparador de Prestaciones 2026

App Vite + React para buscar, comparar y simular aumentos de prestaciones/precios por prestador.

## Datos compilados

- 33 archivos Excel tomados como únicos.
- 282.747 registros normalizados.
- 19 prestadores.
- La base está comprimida en `public/data/prestaciones.json.gz` para que GitHub permita subirla desde la web.
- Ningún archivo supera los 25 MB.

## Uso local

```bash
npm install
npm run dev
```

## Publicar en GitHub desde navegador

1. Descomprimir el ZIP.
2. Entrar a la carpeta descomprimida.
3. Seleccionar y arrastrar a GitHub **solamente estos archivos y carpetas**:
   - `index.html`
   - `package.json`
   - `.gitignore`
   - `README.md`
   - `src/`
   - `public/`
4. No subir ZIPs viejos, carpetas `node_modules`, `dist`, CSV o JSON grandes.
5. Commit changes.

## Deploy en Vercel

1. Vercel > New Project.
2. Importar el repositorio de GitHub.
3. Framework Preset: Vite.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Deploy.
