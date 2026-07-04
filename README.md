# graphql-schema-sync

Sync GraphQL schemas across multiple environments and generate **compatibility-safe** TypeScript types for apps that switch GraphQL endpoints at runtime.

When `develop`, `staging`, and `production` drift apart, this library:

1. Introspects every environment
2. Merges schemas into a compatibility SDL
3. Marks fields as optional when they are missing in any environment
4. Adds availability comments per field
5. Runs `graphql-codegen` against the merged schema
6. Generates a JSON report and optional default normalizers

## The problem

Your app can point at different GraphQL URLs at runtime. If `develop` has fields that `staging` or `production` do not, generated types and hooks can lie to TypeScript and cause runtime errors.

Example:

**develop**

```graphql
type Starship {
  id: ID!
  name: String!
  length(unit: LengthUnit = METER): Float
}
```

**staging**

```graphql
type Starship {
  id: ID!
  length(unit: LengthUnit = METER): Float
}
```

**production**

```graphql
type Starship {
  id: ID!
}
```

After sync, the merged schema becomes environment-safe:

```graphql
type Starship {
  id: ID!

  """
  Available in: develop
  Missing in: staging, production
  """
  name: String

  """
  Available in: develop, staging
  Missing in: production
  """
  length(unit: LengthUnit = METER): Float
}
```

TypeScript types then treat `name` and `length` as optional when they are not present everywhere.

## Install

### Core (schema sync, reports, helpers)

Installs `graphql-schema-sync` plus its runtime dependencies (`graphql`, `commander`, `zod`). Codegen packages are **not** installed.

```bash
pnpm add -D graphql-schema-sync
```

Run without TypeScript/Apollo codegen:

```bash
pnpm graphql-schema-sync generate --skip-codegen
```

Outputs: `schema.compat.graphql`, `compat-report.json`, `compat-report.html`, and `defaults.ts`.

### With TypeScript + Apollo hooks (optional)

Add `@graphql-codegen/*` only if you want `graphql.tsx` with types and hooks:

```bash
pnpm add -D graphql-schema-sync \
  @graphql-codegen/cli \
  @graphql-codegen/typescript \
  @graphql-codegen/typescript-operations \
  @graphql-codegen/typescript-react-apollo
```

Then run the full generate (see [Quick start](#quick-start)) without `--skip-codegen`.

Also works with npm or yarn:

```bash
npm install -D graphql-schema-sync
```

## Quick start

Create `graphql-schema-sync.config.ts`:

```ts
import type { SchemaSyncConfig } from 'graphql-schema-sync';

const config: SchemaSyncConfig = {
  environments: {
    develop: {
      url: 'https://dev-api.example.com/graphql',
      priority: 1
    },
    staging: {
      url: 'https://staging-api.example.com/graphql',
      priority: 2
    },
    production: {
      url: 'https://prod-api.example.com/graphql',
      priority: 3
    }
  },
  baseEnvironment: 'develop',
  output: {
    compatSchema: './generated/schema.compat.graphql',
    types: './generated/graphql.tsx',
    report: './generated/compat-report.json',
    defaults: './generated/defaults.ts'
  },
  codegen: {
    documents: 'src/**/*.graphql',
    plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
    config: {
      withHooks: true
    }
  }
};

export default config;
```

You can also use simple URL strings:

```ts
environments: {
  develop: 'https://dev-api.example.com/graphql',
  staging: 'https://staging-api.example.com/graphql',
}
```

Run (with codegen packages installed):

```bash
pnpm graphql-schema-sync generate
```

Core-only install — use `--skip-codegen` as shown in [Install](#install).

Or from `package.json`:

```json
{
  "scripts": {
    "generate:graphql": "graphql-schema-sync generate"
  }
}
```

## Outputs

| File                              | Purpose                                                   |
| --------------------------------- | --------------------------------------------------------- |
| `generated/schema.compat.graphql` | Merged compatibility schema with environment comments     |
| `generated/graphql.tsx`           | TypeScript types + Apollo hooks from `graphql-codegen`    |
| `generated/compat-report.json`    | Machine-readable diff report                              |
| `generated/compat-report.html`    | Visual per-environment report (types, queries, mutations) |
| `generated/defaults.ts`           | Default values and `normalize*` helpers                   |

Open `compat-report.html` in your browser for the clearest view. The JSON report now groups results per environment:

```json
{
  "byEnvironment": {
    "develop": {
      "role": "base",
      "types": ["LengthUnit", "Starship"],
      "queries": ["starship"],
      "mutations": []
    },
    "staging": {
      "role": "target",
      "missedTypes": [
        { "name": "Starship", "kind": "OBJECT", "missedFields": ["name"] }
      ],
      "missedQueries": [],
      "missedMutations": []
    }
  }
}
```

## Defaults, normalizers, and request helpers

The library does **not** mutate hook responses automatically. Instead it generates helpers in `defaults.ts`.

### Response fields (after the server responds)

```ts
export const StarshipDefaults = {
  name: '',
  length: null
} as const;

export function normalizeStarship<T extends Record<string, unknown>>(
  value?: T | null
) {
  return {
    ...(value ?? {}),
    name: value?.name ?? StarshipDefaults.name,
    length: value?.length ?? StarshipDefaults.length
  };
}
```

Use them at the boundary:

```ts
const starship = normalizeStarship(data?.starship);
```

### Operation args (before the server receives the request)

When args differ between environments, `defaults.ts` also generates:

```ts
export type GraphqlEnvironment = 'develop' | 'staging' | 'production';

export function isOperationAvailable(
  environment: GraphqlEnvironment,
  parentType: 'Query' | 'Mutation' | 'Subscription',
  fieldName: string
): boolean;

export function filterOperationArgs(
  environment: GraphqlEnvironment,
  parentType: 'Query' | 'Mutation' | 'Subscription',
  fieldName: string,
  args: Record<string, unknown>
): Record<string, unknown>;
```

Example — dev has `getQueryData(age: Int!, name: String!)`, staging only has `age`:

```ts
import { useGetQueryDataQuery } from './generated/graphql';
import {
  filterOperationArgs,
  isOperationAvailable,
  type GraphqlEnvironment
} from './generated/defaults';

function useGetQueryData(
  environment: GraphqlEnvironment,
  age: number,
  name?: string
) {
  const skip = !isOperationAvailable(environment, 'Query', 'getQueryData');

  return useGetQueryDataQuery({
    skip,
    variables: filterOperationArgs(environment, 'Query', 'getQueryData', {
      age,
      name
    })
  });
}
```

Important: your `.graphql` document can declare the **full base-environment shape**. With the Apollo compat link, unsupported fields and args are removed automatically at runtime. Without it, keep documents to the intersection of all environments:

```graphql
# Only declare args that exist in every environment
query GetQueryData($age: Int!) {
  getQueryData(age: $age) {
    id
  }
}
```

Use `filterOperationArgs` when you build variables in TypeScript. For dev-only args, either use a separate operation document or guard the call with `isOperationAvailable`.

### Runtime environment switching (Apollo Client)

`filterOperationArgs` only strips **variables**. If your query document still requests fields or args that staging does not support, the server will reject the request. After `graphql-schema-sync generate`, `defaults.ts` also exports `adaptDocumentForEnvironment()` which rewrites the GraphQL document AST for the active environment — removing unsupported root operations, args, and selection fields.

Wire it with an Apollo Link so every request is adapted when the user changes environment:

```ts
import { ApolloClient, HttpLink, InMemoryCache, from } from '@apollo/client';
import { createEnvironmentCompatLink } from 'graphql-schema-sync/apollo';
import {
  environmentCompatHelpers,
  normalizeMovie,
  type GraphqlEnvironment
} from './graphql/generated/defaults';

let currentEnvironment: GraphqlEnvironment = 'development';

export function setGraphqlEnvironment(environment: GraphqlEnvironment) {
  currentEnvironment = environment;
  client.setLink(
    from([
      compatLink,
      new HttpLink({ uri: getEndpointForEnvironment(environment) })
    ])
  );
  void client.resetStore();
}

const compatLink = createEnvironmentCompatLink({
  getEnvironment: () => currentEnvironment,
  helpers: environmentCompatHelpers
});

export const client = new ApolloClient({
  link: from([
    compatLink,
    new HttpLink({ uri: getEndpointForEnvironment(currentEnvironment) })
  ]),
  cache: new InMemoryCache()
});
```

### Switching environments

Call `setGraphqlEnvironment('staging')` from your UI — use the **exact** keys from your config (`staging`, not `Staging`). The example above updates the HTTP link, resets the cache, and refetches with the compat link so fields like `description` and `rating` are stripped or padded for staging.

The compat link keeps `id` (and `__typename` when present) on object selections so Apollo's cache can normalize results. Skipped root operations (e.g. `getMovie` on staging) return `{ getMovie: null }` instead of `{ data: null }` to avoid cache write errors.

After each successful response, the Apollo link pads missing fields with `null` using `typeFieldAvailability` from your generated helpers — no extra runtime import in `defaults.ts`.

### Troubleshooting Apollo cache error 13

If you see console errors like **`Missing field 'language' while writing result`** when switching to staging, Apollo is writing your **development query shape** against **staging data**. That means the compat link is not padding responses. Check:

1. **`environmentCompatHelpers` is passed** — not just `adaptDocumentForEnvironment` alone
2. **Compat link is before `HttpLink`** — `from([compatLink, httpLink])`
3. **Regenerated `defaults.ts`** after updating `graphql-schema-sync`
4. **Cleared Vite cache** — `rm -rf node_modules/.vite`
5. **`client.resetStore()`** when switching environments

For **responses**, still normalize at the boundary:

```ts
const movies = data?.getMovies?.map(normalizeMovie) ?? [];
```

Write queries against your **base environment** (the richest schema). The link adapts them downward for older environments automatically.

Optional: install `@apollo/client` only if you use the Apollo link. The runtime adapter lives in `graphql-schema-sync/runtime` if you use another client.

## Programmatic API

```ts
import { generate } from 'graphql-schema-sync';

await generate({
  configPath: './graphql-schema-sync.config.ts'
});
```

## CLI

```bash
graphql-schema-sync generate
graphql-schema-sync generate --config ./graphql-schema-sync.config.ts
graphql-schema-sync generate --skip-codegen
```

## Config reference

```ts
interface SchemaSyncConfig {
  environments: Record<
    string,
    | string
    | {
        url: string;
        priority?: number;
        headers?: Record<string, string>;
      }
  >;
  baseEnvironment: string;
  output: {
    compatSchema: string;
    types: string;
    report: string;
    defaults: string;
  };
  headers?: Record<string, string>;
  codegen?: {
    documents?: string | string[];
    plugins?: string[];
    config?: Record<string, unknown>;
  };
}
```

### Notes

- `baseEnvironment` is used as the source of truth for field definitions when a field exists there.
- Fields missing in any environment are made nullable in the merged schema.
- A field is only required in generated types if it is non-null in **every** environment.
- Per-environment headers are supported for auth during introspection.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and pull request guidelines.

Please report bugs using the [issue template](.github/ISSUE_TEMPLATE/bug_report.md).

## License

[MIT](LICENSE) — see [LICENSE](LICENSE) for details.

See also [CHANGELOG.md](CHANGELOG.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
