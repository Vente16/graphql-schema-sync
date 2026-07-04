/** @type {import('../dist/index.d.ts').SchemaSyncConfig} */
const config = {
  environments: {
    develop: {
      url: 'http://localhost:4101/graphql',
      priority: 1
    },
    staging: {
      url: 'http://localhost:4102/graphql',
      priority: 2
    },
    production: {
      url: 'http://localhost:4103/graphql',
      priority: 3
    }
  },
  baseEnvironment: 'develop',
  output: {
    compatSchema: './demo/generated/schema.compat.graphql',
    types: './demo/generated/graphql.ts',
    report: './demo/generated/compat-report.json',
    defaults: './demo/generated/defaults.ts'
  },
  codegen: {
    plugins: ['typescript'],
    config: {
      avoidOptionals: {
        field: false,
        object: false,
        inputValue: false,
        defaultValue: false
      },
      maybeValue: 'T | null | undefined',
      enumsAsTypes: true,
      skipTypename: true
    }
  }
};

export default config;
