import type { ExportFormat, FeatureFlags } from '@itsjust/core';

export const toolConfig = {
  id: 'jwt-builder',
  name: 'JWT Builder',
  category: 'Developer',
  description:
    'Build and sign JSON Web Tokens locally in the browser with configurable header, payload claims and HS256/HS384/HS512 signing for debugging and testing.',
  version: '1.0.0',
  exportFormats: ['json'] as ExportFormat[],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  } satisfies FeatureFlags,
  theme: {
    accent: '#6366f1',
    accentHover: '#4f46e5',
    accentSubtle: 'rgba(99, 102, 241, 0.1)',
    brand: 'JWT Builder',
    icon: '🔑',
  },
};

export default toolConfig;
