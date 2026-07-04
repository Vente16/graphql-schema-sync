export default {
  environments: {
    develop: 'http://localhost:4101/graphql'
  },
  baseEnvironment: 'staging',
  output: {
    compatSchema: './generated/schema.compat.graphql',
    types: './generated/graphql.ts',
    report: './generated/compat-report.json',
    defaults: './generated/defaults.ts'
  }
};
