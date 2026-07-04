import type { SchemaSyncConfig } from './src/types.js';

const config: SchemaSyncConfig = {
  environments: {
    develop: {
      url: 'https://dev-api.example.com/graphql',
      priority: 1
    },
    staging: {
      url: 'https://staging-api.example.com/graphql',
      priority: 2
    },
    production: {
      url: 'https://prod-api.example.com/graphql',
      priority: 3
    }
  },
  baseEnvironment: 'develop',
  output: {
    compatSchema: './generated/schema.compat.graphql',
    types: './generated/graphql.tsx',
    report: './generated/compat-report.json',
    defaults: './generated/defaults.ts'
  },
  codegen: {
    documents: 'src/**/*.graphql',
    plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
    config: {
      withHooks: true,
      avoidOptionals: {
        field: false,
        object: false,
        inputValue: false,
        defaultValue: false
      },
      maybeValue: 'T | null',
      enumsAsTypes: false,
      skipTypename: false,
      scalars: {
        JSON: { input: 'any', output: 'any' },
        Void: { input: 'any', output: 'any' }
      }
    }
  }
};

export default config;
