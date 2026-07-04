#!/usr/bin/env node
import { Command } from 'commander';
import { generate } from './index.js';

const program = new Command();

program
  .name('graphql-schema-sync')
  .description(
    'Sync GraphQL schemas across environments and generate compatibility types'
  )
  .version('1.0.0');

program
  .command('generate')
  .description(
    'Fetch schemas, merge compatibility SDL, and run graphql-codegen'
  )
  .option(
    '-c, --config <path>',
    'Path to config file',
    'graphql-schema-sync.config.ts'
  )
  .option('--skip-codegen', 'Only generate compat schema, report, and defaults')
  .action(async (options: { config: string; skipCodegen?: boolean }) => {
    try {
      const result = await generate({
        configPath: options.config,
        skipCodegen: options.skipCodegen
      });

      const diffCount = result.compatSchema.types.reduce((count, type) => {
        const fieldDiffs =
          type.fields?.filter(field => field.availability.missingIn.length > 0)
            .length ?? 0;
        return count + fieldDiffs;
      }, 0);

      console.log('');
      console.log('Done.');
      console.log(`Environment differences found in ${diffCount} field(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`graphql-schema-sync failed: ${message}`);
      process.exitCode = 1;
    }
  });

program.parse();
