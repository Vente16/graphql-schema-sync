import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const ports = [4101, 4102, 4103];

function probe(url) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ __typename }' })
  }).then(response => response.ok);
}

async function serversAreUp() {
  const results = await Promise.all(
    ports.map(async port => {
      try {
        return await probe(`http://localhost:${port}/graphql`);
      } catch {
        return false;
      }
    })
  );

  return results.every(Boolean);
}

async function waitForServers(maxAttempts = 40) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await serversAreUp()) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(
    'Demo GraphQL servers did not become ready. Try running "pnpm run demo:serve" manually.'
  );
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`
          )
        );
      }
    });
  });
}

async function main() {
  let serverProcess;
  let startedServer = false;

  const shutdown = () => {
    if (startedServer && serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
    }
  };

  process.on('SIGINT', () => {
    shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    shutdown();
    process.exit(0);
  });

  if (!(await serversAreUp())) {
    console.log('Starting demo GraphQL servers...');
    serverProcess = spawn('node', ['demo/server.mjs'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'inherit'],
      detached: false
    });
    startedServer = true;

    serverProcess.stdout.on('data', chunk => {
      process.stdout.write(chunk);
    });

    await waitForServers();
  } else {
    console.log('Demo GraphQL servers already running.');
  }

  console.log('Running schema sync...');
  await runCommand('pnpm', ['run', 'demo:generate']);

  console.log('');
  console.log('Demo complete. Generated files are in demo/generated/.');
  console.log('Playgrounds:');
  console.log('  develop    http://localhost:4101/graphql');
  console.log('  staging    http://localhost:4102/graphql');
  console.log('  production http://localhost:4103/graphql');

  if (startedServer) {
    console.log('');
    console.log('Demo servers are still running. Press Ctrl+C to stop them.');
    await new Promise(() => {});
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
