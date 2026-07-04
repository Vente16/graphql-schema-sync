import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { generateCompatSdl } from './generate-compat-sdl.js';
import { generateDefaults } from './generate-defaults.js';
import { generateCompatReport } from './generate-report.js';
import {
  generateCompatReportHtml,
  reportHtmlPath
} from './generate-report-html.js';
import { fetchAllSchemas } from './fetch-schema.js';
import { mergeSchemas } from './merge-schemas.js';
import { runCodegen } from './run-codegen.js';
import type { CompatSchema } from './types.js';
import { loadConfig, resolveEnvironments } from './config.js';

export interface GenerateOptions {
  configPath?: string;
  cwd?: string;
  skipCodegen?: boolean;
}

export interface GenerateResult {
  compatSchema: CompatSchema;
  outputFiles: {
    compatSchema: string;
    report: string;
    reportHtml: string;
    defaults: string;
    types?: string;
  };
}

async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function writeOutputFile(
  filePath: string,
  content: string
): Promise<void> {
  const absolutePath = resolve(filePath);
  await ensureParentDir(absolutePath);
  await writeFile(absolutePath, content, 'utf8');
}

export async function generate(
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(
    cwd,
    options.configPath ?? 'graphql-schema-sync.config.ts'
  );
  const config = await loadConfig(configPath);
  const environments = resolveEnvironments(config);

  console.log(`Fetching schemas from ${environments.length} environment(s)...`);
  const schemas = await fetchAllSchemas(environments);

  console.log('Merging schemas...');
  const compatSchema = mergeSchemas(schemas, config.baseEnvironment);

  const compatSchemaPath = resolve(cwd, config.output.compatSchema);
  const reportPath = resolve(cwd, config.output.report);
  const reportHtmlOutputPath = resolve(
    cwd,
    reportHtmlPath(config.output.report)
  );
  const defaultsPath = resolve(cwd, config.output.defaults);
  const typesPath = resolve(cwd, config.output.types);

  const compatSdl = generateCompatSdl(compatSchema);
  const report = generateCompatReport(compatSchema);
  const reportHtml = generateCompatReportHtml(report);
  const defaults = generateDefaults(compatSchema);

  await writeOutputFile(compatSchemaPath, compatSdl);
  await writeOutputFile(reportPath, JSON.stringify(report, null, 2));
  await writeOutputFile(reportHtmlOutputPath, reportHtml);
  await writeOutputFile(defaultsPath, defaults);

  console.log(`Wrote compatibility schema: ${compatSchemaPath}`);
  console.log(`Wrote compatibility report: ${reportPath}`);
  console.log(`Wrote compatibility report HTML: ${reportHtmlOutputPath}`);
  console.log(`Wrote defaults: ${defaultsPath}`);

  if (!options.skipCodegen) {
    console.log('Running GraphQL Code Generator...');
    await runCodegen({
      cwd,
      compatSchemaPath,
      typesPath,
      config
    });
    console.log(`Wrote TypeScript types: ${typesPath}`);
  }

  return {
    compatSchema,
    outputFiles: {
      compatSchema: compatSchemaPath,
      report: reportPath,
      reportHtml: reportHtmlOutputPath,
      defaults: defaultsPath,
      types: options.skipCodegen ? undefined : typesPath
    }
  };
}

export { loadConfig, resolveEnvironments } from './config.js';
export { fetchAllSchemas, fetchSchema } from './fetch-schema.js';
export { mergeSchemas, getSchemaDifferences } from './merge-schemas.js';
export { generateCompatSdl } from './generate-compat-sdl.js';
export {
  generateCompatReport,
  buildEnvironmentReport
} from './generate-report.js';
export {
  generateCompatReportHtml,
  reportHtmlPath
} from './generate-report-html.js';
export { generateDefaults } from './generate-defaults.js';
export { runCodegen } from './run-codegen.js';
export type * from './types.js';
