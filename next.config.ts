import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // !! ATENÇÃO !!
    // Isso permite que a Vercel publique o projeto mesmo com erros de tipagem do TypeScript.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora erros de formatação na hora de publicar
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;