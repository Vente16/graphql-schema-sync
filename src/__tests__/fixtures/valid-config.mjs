export default {
  environments: {
    develop: 'http://localhost:4101/graphql',
    staging: 'http://localhost:4102/graphql'
  },
  baseEnvironment: 'develop',
  output: {
    compatSchema: './generated/schema.compat.graphql',
    types: './generated/graphql.ts',
    report: './generated/compat-report.json',
    defaults: './generated/defaults.ts'
  }
};
