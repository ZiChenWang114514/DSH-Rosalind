# Verification

Release acceptance covers the scientific snapshot, host behavior, browser components, bundle format, DSH installation, and rendered interface.

## Scientific acceptance

`npm run validate:showcases` parses the 23 manifests and all 150 referenced files. It does not treat catalogue totals as scientific proof; the headline values are derived from the retained inputs and outputs.

| Case | Expected release value |
|---|---|
| Lambda cI | 714 coding bases, 237 translated residues, translation matches the annotation |
| Human RAS | 3 rows, 191 aligned columns, mean identity `0.9284467713787081`, recorded distances and NJ tree reproduced |
| FASTQ | 500 reads, 235,490 bases, Q30 `95.39768143020935%` |
| MDM2-p53 | 105 cross-chain atom contacts and 34 residue pairs |
| GFP | 225 protein residues, 1,866 atoms, 18 residues within 4 Å of the chromophore |
| Whole slide | 46,000 × 32,893 source image |
| Spatial expression | 684 observations, 18,078 genes, 684 exported rows |
| PD-L1 design | 20 candidates, 5 Top-5 rows, 25 ensemble predictions, first candidate `NB13_E104Q` |

Run the complete local suite:

```powershell
npm ci
npm run validate
npm run test:e2e
npm run pack:bundle
```

`npm run validate` includes catalogue parsing, exact scientific checks, TypeScript, unit and browser-component tests, documentation links, production builds, and DSH bundle-format inspection.

## DSH bundle acceptance

The production client must begin with `window.__ModuleLoader__.load`, use the package module ID, return its exports, and remain one file. The automated bundle check confirms the Cordis patch, required client packages, host and client outputs, declarations, and a first-load client budget of no more than 600 KB gzip.

For an installation check, build a tarball and add it to a DSH Web profile:

```powershell
npm run pack:bundle
$env:DSH_HOME = Join-Path $env:TEMP "dsh-rosalind-profile-$([guid]::NewGuid())"
$pnpmRoot = Join-Path $env:TEMP "dsh-rosalind-pnpm-$([guid]::NewGuid())"
$npmCache = Join-Path $env:TEMP "dsh-rosalind-npm-cache-$([guid]::NewGuid())"
$pnpmBin = Join-Path $pnpmRoot "node_modules\\.bin"
npm install --prefix $pnpmRoot --cache $npmCache pnpm@10.15.1
$env:Path = "$pnpmBin;$env:Path"
$archive = Get-ChildItem -Filter "zichenwang114514-dsh-rosalind-*.tgz" | Select-Object -First 1
dsh plugin --profile web add $archive.FullName
dsh --profile web --dump-config
dsh web --no-open
```

The composed config must contain `dsh-rosalind`, and the server must load the host and client module without a startup error. The temporary `DSH_HOME` and `pnpm` directory are test-only and may be removed after the server stops.

## Browser and visual acceptance

The release review captures the actual DSH Web page at 1280×800, 1440×900, and 2048×1320, plus a narrow desktop view. It checks:

- light and dark themes;
- catalogue search and seven-category filtering;
- project detail tabs and all three use modes;
- evidence rows and long scientific text;
- keyboard focus, Escape close, and visible focus rings;
- browser zoom at 200%;
- the composer prompt after **Add to conversation**;
- dedicated tool cards and provider settings;
- overflow, clipping, overlap, unreadable contrast, and accidental pointer blocking.

Reference screenshots from another product are used locally for proportion and rhythm only. Public screenshots and project artwork are generated from DSH-Rosalind itself.

### Clean-profile visual record

The `v0.2.0` candidate was installed from its tarball into a new DSH home and opened with `dsh web --port 3180 --no-open`. The packaged client registered successfully in the real blank-session hero and produced the following measured states:

| Scenario | Observed result |
|---|---|
| DSH dark theme | `color-scheme: dark`; workbench surface `rgba(31, 38, 35, 0.88)`; text `rgb(237, 241, 239)` |
| DSH light theme | `color-scheme: light`; workbench surface `rgba(255, 255, 255, 0.82)`; text `rgb(36, 43, 41)` |
| 1280 × 720 | Hero workbench `565 × 400` CSS pixels; internal vertical scrolling; no document-level horizontal overflow |
| 720 × 900 | Hero workbench `409 × 520` CSS pixels; one-column project list; no document-level horizontal overflow |
| 200% zoom equivalent (`720 × 450` CSS viewport) | Hero workbench `409 × 320` CSS pixels; search and filters remain reachable; no document-level horizontal overflow |

The corresponding screenshots are stored in [`docs/screenshots`](screenshots). They show the installed DSH page, rather than the standalone component preview.

## Continuous integration

GitHub Actions runs the full validation suite on Windows and Ubuntu. A separate Ubuntu job installs the fixed DSH version, builds the tarball, installs it into the Web profile, and inspects the composed profile. Browser tests run with the repository's Playwright configuration. Tests that may create external charges remain manual.
