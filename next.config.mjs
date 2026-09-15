/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We intentionally use plain <img> instead of next/image for saved-item
  // thumbnails: those images live on arbitrary third-party domains supplied
  // by users at runtime, so a static remotePatterns allowlist isn't workable.
  // See README "Architecture Decisions" for the full rationale.
  images: {
    unoptimized: true,
  },
  eslint: {
    // Linting is run separately in CI via `npm run lint`.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
