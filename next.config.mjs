/**
 * Exportación estática: el mismo build sirve para la app Android (Capacitor empaqueta `out/`)
 * y para la versión web.
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
