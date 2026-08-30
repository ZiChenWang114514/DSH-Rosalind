# DSH-Rosalind contributor guide

The reference showcase snapshot is commit `f8c2ea83ac3b3b9258b160b80039dc3db37d76c4` from `rosalind-science-showcases`. Keep the 100-case catalogue reproducible and do not silently replace recorded results with live data.

Before changing a showcase, read its `README.md`, `showcase.json`, prompt, every referenced artifact, and provenance record. Keep source observations, computed results, scientific interpretation, limitations, and citations distinct in both code and UI.

DSH compatibility is fixed at `0.1.1-rc.2`. Register tools with `defineTool()` and `ctx.tools.register()`, provide explicit parameter and output schemas, and implement `output.render`, `presentCall`, and `presentResult`. Use Cordis lifecycle APIs and named UI slots; do not query or replace product DOM elements.

External paid services, GPU jobs, SSH/HPC work, and experimental ordering require a specific confirmation. Do not switch providers automatically after a service failure. Never commit credentials, private URLs, protected health information, or restricted biological data.

Run `npm run validate` before committing. Public releases also require a clean-profile DSH installation test and the Playwright checks documented in `docs/verification.md`.
