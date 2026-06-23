import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

// Flags hardcoded color literals in CSS-property-keyed style object entries.
// Only checks plain string values (not template literals), targeting the most
// common CSS color properties. Box-shadow and similar are intentionally excluded
// because shadow rgba values are design-level and not theme-swappable.
const COLOR_PATTERN = /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/

const COLOR_PROPERTIES = new Set([
  'color', 'background', 'backgroundColor',
  'fill', 'stroke',
  'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'outlineColor', 'caretColor', 'textDecorationColor',
])

const noHardcodedColors = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded color values in style props; use theme variables instead.',
    },
    messages: {
      hardcodedColor:
        'Hardcoded color "{{value}}" — use a theme variable (e.g. t.pop, t.ink, t.danger) instead.',
    },
  },
  create(context) {
    return {
      Property(node) {
        const keyName =
          node.key.type === 'Identifier' ? node.key.name
          : node.key.type === 'Literal' ? String(node.key.value)
          : null
        if (!keyName || !COLOR_PROPERTIES.has(keyName)) return

        const val = node.value
        if (val.type === 'Literal' && typeof val.value === 'string' && COLOR_PATTERN.test(val.value)) {
          context.report({ node: val, messageId: 'hardcodedColor', data: { value: val.value } })
        }
      },
    }
  },
}

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'db/migrations/**', 'public/**'] },

  // TypeScript recommended rules (scoped to .ts/.tsx by the plugin itself)
  ...tseslint.configs.recommended,

  // React + custom rules for frontend source
  {
    files: ['src/**/*.{ts,tsx}', 'shared/**/*.ts'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      local: { rules: { 'no-hardcoded-colors': noHardcodedColors } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Only flag > and } which are genuine JSX syntax characters; ' and " are fine prose
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Ignore _ -prefixed vars/args (TypeScript convention for intentionally unused params)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'local/no-hardcoded-colors': 'error',
    },
  },

  // Shared / functions: TypeScript only, no React
  {
    files: ['functions/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
