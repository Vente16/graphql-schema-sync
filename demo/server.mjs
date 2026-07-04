import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSchema, graphql } from 'graphql';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(__dirname, 'schemas');

const environments = [
  { name: 'develop', port: 4101, file: 'develop.graphql' },
  { name: 'staging', port: 4102, file: 'staging.graphql' },
  { name: 'production', port: 4103, file: 'production.graphql' }
];

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function renderGraphiqlPage(environmentName) {
  const defaultQuery = `{
  __type(name: "Starship") {
    name
    fields {
      name
      type {
        name
        kind
        ofType {
          name
          kind
        }
      }
    }
  }
}`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>GraphiQL - ${environmentName}</title>
    <link rel="stylesheet" href="https://unpkg.com/graphiql@3.7.0/graphiql.min.css" />
    <style>
      body { margin: 0; }
      #graphiql { height: 100vh; }
    </style>
  </head>
  <body>
    <div id="graphiql">Loading GraphiQL...</div>
    <script
      crossorigin
      src="https://unpkg.com/react@18/umd/react.production.min.js"
    ></script>
    <script
      crossorigin
      src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"
    ></script>
    <script src="https://unpkg.com/graphiql@3.7.0/graphiql.min.js"></script>
    <script>
      const fetcher = GraphiQL.createFetcher({ url: '/graphql' });
      const root = ReactDOM.createRoot(document.getElementById('graphiql'));
      root.render(
        React.createElement(GraphiQL, {
          fetcher,
          defaultQuery: ${JSON.stringify(defaultQuery)},
        }),
      );
    </script>
  </body>
</html>`;
}

for (const env of environments) {
  const sdl = readFileSync(join(schemasDir, env.file), 'utf8');
  const schema = buildSchema(sdl);

  const server = createServer(async (req, res) => {
    const pathname = req.url?.split('?')[0];

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && (pathname === '/' || pathname === '/graphql')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderGraphiqlPage(env.name));
      return;
    }

    if (req.method !== 'POST' || pathname !== '/graphql') {
      res.writeHead(404);
      res.end('Not found. Open /graphql in your browser for GraphiQL.');
      return;
    }

    try {
      const body = JSON.parse(await readBody(req));
      const result = await graphql({
        schema,
        source: body.query,
        variableValues: body.variables
      });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: [{ message: String(error) }] }));
    }
  });

  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${env.port} is already in use (${env.name}). Stop the previous demo server with Ctrl+C, or run:\n` +
          `  lsof -ti tcp:${env.port} | xargs kill`
      );
      process.exit(1);
    }

    throw error;
  });

  server.listen(env.port, () => {
    console.log(
      `[${env.name}] playground http://localhost:${env.port}/graphql`
    );
  });
}

console.log('Demo GraphQL servers running. Press Ctrl+C to stop.');
