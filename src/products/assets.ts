/**
 * Resolve a file under `public/` against Vite's configured base URL.
 *
 * Use this for every static asset referenced from a product definition (models, texture maps)
 * so the app keeps working when it is served from a sub-path, e.g. GitHub Pages at
 * `/ProductConfigurator/`. `BASE_URL` always ends with `/`, so a leading slash is stripped.
 */
export function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
