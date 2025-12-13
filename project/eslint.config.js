import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'public',
      'supabase',
      'scripts',
      'docs',
      '**/*.cjs',
      '**/*.mjs',
      '**/*.js',
      // Legacy/demo React shells that aren't used in production routing
      'src/AppClean.tsx',
      'src/AppMinimal.tsx',
      'src/AppProductionReady.tsx',
      'src/AppSimple.tsx',
      'src/AppSimpleFixed.tsx',
      'src/AppSimpleTest.tsx',
      'src/AppStable.tsx',
      'src/AppWorkingSimple.tsx',
      'src/App_temp_fixed.tsx',
      'src/App_clean.tsx',
      'src/MinimalApp.tsx',
      'src/SimpleWorkingApp.tsx',
      'src/UltraBasic.tsx',
      'src/UltraBasicFixed.tsx',
      'src/WorkingApp.tsx',
      // Legacy/unused marketplace & fundraiser variants
      'src/pages/Marketplace.tsx',
      'src/pages/MarketplacePage.tsx',
      'src/pages/MarketplacePage.backup.tsx',
      'src/pages/MarketplacePage.new.tsx',
      'src/pages/MarketplacePageBeautiful.tsx',
      'src/pages/FundraisersPageBeautiful.tsx',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
    },
  }
);
