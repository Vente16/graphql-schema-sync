import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    runtime: 'src/runtime.ts',
    apollo: 'src/apollo-link.ts'
  },
  format: ['esm', 'cjs'],
  dts: {
    compilerOptions: {
      ignoreDeprecations: '6.0'
    }
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node18',
  shims: true
});
