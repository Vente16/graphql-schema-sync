import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import type { SchemaSyncConfig } from './types.js';

const require = createRequire(import.meta.url);

interface RunCodegenOptions {
  cwd: string;
  compatSchemaPath: string;
  typesPath: string;
  config: SchemaSyncConfig;
}

function resolveCodegenBin(): string {
  const packageJsonPath = require.resolve('@graphql-codegen/cli/package.json');
  const packageJson = require(packageJsonPath) as {
    bin?: string | Record<string, string>;
  };
  const binEntry =
    typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin?.['graphql-codegen'];

  if (!binEntry) {
    throw new Error(
      'Could not resolve graphql-codegen binary from @graphql-codegen/cli'
    );
  }

  return join(dirname(packageJsonPath), binEntry);
}

function buildCodegenConfig(
  options: RunCodegenOptions
): Record<string, unknown> {
  const plugins = options.config.codegen?.plugins ?? [
    'typescript',
    'typescript-operations',
    'typescript-react-apollo'
  ];
  const pluginConfig = options.config.codegen?.config ?? {
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
  };

  const documents = options.config.codegen?.documents;
  const generates: Record<string, unknown> = {
    [options.typesPath]: {
      plugins,
      config: pluginConfig
    }
  };

  const config: Record<string, unknown> = {
    schema: options.compatSchemaPath,
    generates
  };

  if (documents) {
    config.documents = documents;
  }

  return config;
}

async function writeTempCodegenConfig(
  cwd: string,
  config: Record<string, unknown>
): Promise<string> {
  const tempDir = join(cwd, '.graphql-schema-sync');
  await mkdir(tempDir, { recursive: true });
  const tempConfigPath = join(tempDir, 'codegen.cjs');
  const content = `module.exports = ${JSON.stringify(config, null, 2)};\n`;
  await writeFile(tempConfigPath, content, 'utf8');
  return tempConfigPath;
}

function runProcess(
  command: string,
  args: string[],
  cwd: string
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(
          new Error(`graphql-codegen exited with code ${code ?? 'unknown'}`)
        );
      }
    });
  });
}

export async function runCodegen(options: RunCodegenOptions): Promise<void> {
  const typesDir = dirname(resolve(options.typesPath));
  await mkdir(typesDir, { recursive: true });

  const codegenConfig = buildCodegenConfig(options);
  const tempConfigPath = await writeTempCodegenConfig(
    options.cwd,
    codegenConfig
  );

  try {
    const codegenBin = resolveCodegenBin();
    await runProcess(
      process.execPath,
      [codegenBin, '--config', tempConfigPath],
      options.cwd
    );
  } finally {
    await unlink(tempConfigPath).catch(() => undefined);
  }
}
