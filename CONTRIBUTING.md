# Contributing

Thank you for improving DSH-Rosalind. The project values reproducible scientific records, direct DSH contracts, accessible interface behavior, and focused changes.

## Development setup

```powershell
git clone https://github.com/ZiChenWang114514/DSH-Rosalind.git
cd DSH-Rosalind
npm ci
npm run validate
```

Use Node.js 20 or newer. DSH integration work must be checked with `@deepseek-ai/dsh@0.1.1-rc.2`.

## Changing a showcase

Read the case README, manifest, teaching prompt, every referenced input and output, preview, and provenance record before editing. Keep source observations, computed results, scientific interpretation, limitations, and citations in their dedicated fields. Do not replace retained results with current network responses.

Add compact, public, redistributable fixtures only. Do not commit credentials, private URLs, protected health information, restricted biological data, large raw inputs, model weights, or paid-service responses whose terms prohibit redistribution.

After editing the catalogue, run:

```powershell
npm run generate
npm run validate:showcases
npm test
```

## Changing the DSH integration

Use Cordis lifecycle methods and named slots. Host tools use `defineTool()` and `ctx.tools.register()`, typed parameter and output schemas, native rendering, call and result presentation, session ownership, and cooperative cancellation. Client code may not query product DOM selectors.

New network, paid, GPU, SSH/HPC, download, or external-write behavior must show the selected provider and action clearly. Paid and remote activity requires specific confirmation. A service failure should retain the selected service in the run record and provide a useful diagnostic.

## Pull request checks

Before submitting a PR:

```powershell
npm run validate
npm run test:e2e
npm run pack:bundle
git diff --check
```

For visible changes, attach light and dark screenshots at a documented viewport and describe keyboard and 200% zoom checks. For scientific changes, state which retained file supports each changed result and which command recomputed it.
