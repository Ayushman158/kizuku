/**
 * app.json stays the source of truth. This only adds what the portfolio's web
 * build needs, and only when that build asks for it:
 *
 *   KIZUKU_WEB_BASE=/kizuku/live  serves the export from a sub-path of the site
 *
 * Unset — the dev server, Expo Go, a native build — the config is app.json,
 * unchanged.
 */
module.exports = ({ config }) => {
  const base = process.env.KIZUKU_WEB_BASE;
  if (!base) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl: base } };
};
