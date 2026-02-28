# Electron Desktop Wrapper

## Build & Run

1. Build frontend:
   ```bash
   cd ../FRONTEND
   npm run build
   ```
2. Start Electron app:
   ```bash
   cd ../ELECTRON
   npm install
   npm start
   ```
3. Build Windows installer:
   ```bash
   npm run build
   ```

## Auto-update
- Configure `publish.url` in `electron-builder.json` for cloud updates.

## Notes
- Electron loads the React frontend from `FRONTEND/dist`.
- Update `main.js` for advanced features (file system, offline sync).
