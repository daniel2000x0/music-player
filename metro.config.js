// Learn more https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `expo-sqlite` usa WebAssembly en la web. Sin esto, Metro no resuelve
// `wa-sqlite.wasm` y el export/bundle web falla.
config.resolver.assetExts.push('wasm');

// SharedArrayBuffer (requerido por wa-sqlite) necesita estas cabeceras
// COEP/COOP también en el servidor de desarrollo.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
