import type {
  CompatReport,
  EnvironmentMisses,
  EnvironmentOverview
} from './types.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderList(items: string[], emptyLabel: string): string {
  if (items.length === 0) {
    return `<p class="empty">${escapeHtml(emptyLabel)}</p>`;
  }

  return `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderMissedTypes(
  missedTypes: EnvironmentMisses['missedTypes']
): string {
  if (missedTypes.length === 0) {
    return '<p class="empty">No missing types</p>';
  }

  return missedTypes
    .map(type => {
      const details: string[] = [];

      if (type.missedFields?.length) {
        details.push(
          `<div><strong>missed fields:</strong> ${type.missedFields.map(field => `<code>${escapeHtml(field)}</code>`).join(', ')}</div>`
        );
      }

      if (type.missedEnumValues?.length) {
        details.push(
          `<div><strong>missed enum values:</strong> ${type.missedEnumValues.map(value => `<code>${escapeHtml(value)}</code>`).join(', ')}</div>`
        );
      }

      return `<li><code>${escapeHtml(type.name)}</code> <span class="kind">${escapeHtml(type.kind)}</span>${details.join('')}</li>`;
    })
    .join('');
}

function renderBaseEnvironment(
  name: string,
  overview: EnvironmentOverview
): string {
  return `
    <section class="env-card base">
      <header>
        <h2>${escapeHtml(name)}</h2>
        <span class="badge">base</span>
      </header>
      <div class="section-block">
        <h3>types</h3>
        ${renderList(overview.types, 'No types')}
      </div>
      <div class="section-block">
        <h3>queries</h3>
        ${renderList(overview.queries, 'No queries')}
      </div>
      <div class="section-block">
        <h3>mutations</h3>
        ${renderList(overview.mutations, 'No mutations')}
      </div>
      ${
        overview.subscriptions.length > 0
          ? `<div class="section-block"><h3>subscriptions</h3>${renderList(overview.subscriptions, 'No subscriptions')}</div>`
          : ''
      }
    </section>
  `;
}

function renderTargetEnvironment(
  name: string,
  misses: EnvironmentMisses
): string {
  return `
    <section class="env-card target">
      <header>
        <h2>${escapeHtml(name)}</h2>
        <span class="badge">compared to base</span>
      </header>
      <div class="section-block">
        <h3>missed types</h3>
        <ul class="missed-types">${renderMissedTypes(misses.missedTypes)}</ul>
      </div>
      <div class="section-block">
        <h3>missed queries</h3>
        ${renderList(misses.missedQueries, 'No missing queries')}
      </div>
      <div class="section-block">
        <h3>missed mutations</h3>
        ${renderList(misses.missedMutations, 'No missing mutations')}
      </div>
      ${
        misses.missedSubscriptions.length > 0
          ? `<div class="section-block"><h3>missed subscriptions</h3>${renderList(misses.missedSubscriptions, 'No missing subscriptions')}</div>`
          : ''
      }
    </section>
  `;
}

export function generateCompatReportHtml(report: CompatReport): string {
  const environmentCards = report.environments
    .map(environment => {
      const entry = report.byEnvironment[environment];

      if (entry.role === 'base') {
        return renderBaseEnvironment(environment, entry);
      }

      return renderTargetEnvironment(environment, entry);
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GraphQL Schema Sync Report</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, system-ui, sans-serif;
        line-height: 1.5;
      }
      body {
        margin: 0;
        background: #f4f6f8;
        color: #15202b;
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 1.8rem;
      }
      .meta {
        color: #5b6770;
        margin-bottom: 24px;
      }
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 28px;
      }
      .summary-card {
        background: white;
        border: 1px solid #d8dee4;
        border-radius: 12px;
        padding: 16px;
      }
      .summary-card strong {
        display: block;
        font-size: 1.4rem;
      }
      .env-grid {
        display: grid;
        gap: 20px;
      }
      .env-card {
        background: white;
        border: 1px solid #d8dee4;
        border-radius: 16px;
        padding: 20px;
      }
      .env-card.base {
        border-color: #7cc4ff;
        box-shadow: 0 0 0 1px rgba(56, 139, 253, 0.15);
      }
      .env-card.target {
        border-color: #f0b429;
        box-shadow: 0 0 0 1px rgba(240, 180, 41, 0.12);
      }
      .env-card header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }
      .env-card h2 {
        margin: 0;
        text-transform: lowercase;
      }
      .badge {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 4px 8px;
        border-radius: 999px;
        background: #eef2f6;
      }
      .section-block + .section-block {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #e6ebf0;
      }
      .section-block h3 {
        margin: 0 0 8px;
        font-size: 0.95rem;
        text-transform: lowercase;
      }
      ul {
        margin: 0;
        padding-left: 20px;
      }
      li + li {
        margin-top: 6px;
      }
      .missed-types li {
        list-style: disc;
      }
      .kind {
        color: #5b6770;
        font-size: 0.85rem;
      }
      .empty {
        margin: 0;
        color: #5b6770;
        font-style: italic;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 6px;
      }
      @media (prefers-color-scheme: dark) {
        body { background: #0f1419; color: #e7ecf0; }
        .summary-card, .env-card { background: #161b22; border-color: #30363d; }
        .badge { background: #21262d; }
        .section-block + .section-block { border-top-color: #30363d; }
        .meta, .kind, .empty { color: #9da7b3; }
        code { background: #21262d; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>GraphQL Schema Sync Report</h1>
      <p class="meta">
        Base environment: <strong>${escapeHtml(report.baseEnvironment)}</strong>
        · Generated: ${escapeHtml(report.generatedAt)}
      </p>
      <div class="summary">
        <div class="summary-card">
          <span>Types</span>
          <strong>${report.summary.totalTypes}</strong>
        </div>
        <div class="summary-card">
          <span>Types with differences</span>
          <strong>${report.summary.typesWithDifferences}</strong>
        </div>
        <div class="summary-card">
          <span>Field differences</span>
          <strong>${report.summary.fieldsWithDifferences}</strong>
        </div>
      </div>
      <div class="env-grid">
        ${environmentCards}
      </div>
    </main>
  </body>
</html>`;
}

function reportHtmlPath(reportPath: string): string {
  return reportPath.replace(/\.json$/i, '.html');
}

export { reportHtmlPath };
