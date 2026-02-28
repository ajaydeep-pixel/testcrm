# Installer & Packaging Guide

## Build Windows Installer
1. Ensure frontend build exists:
   ```bash
   cd FRONTEND
   npm run build
   ```
2. Install Electron dependencies:
   ```bash
   cd ELECTRON
   npm install
   ```
3. Build installer:
   ```bash
   cd ELECTRON
   npm run build
   ```

## Auto-Update
- Configure `publish.url` in `electron-builder.json` for cloud updates.

## Notes
- Installer will package backend, frontend, and Electron wrapper.
- For advanced features, update `main.js` in ELECTRON.
