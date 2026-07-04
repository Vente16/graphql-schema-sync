export default {
  environments: {},
  baseEnvironment: 'develop',
  output: {
    compatSchema: './generated/schema.compat.graphql',
    types: './generated/graphql.ts',
    report: './generated/compat-report.json',
    defaults: './generated/defaults.ts'
  }
};
