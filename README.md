# gh-artifact-upload-advanced

A GitHub Action that uploads a **single file** directly as an Actions artifact with a custom MIME type.

Unlike `actions/upload-artifact`, this action uploads the raw file (not a ZIP wrapper) so HTML reports can open directly in the browser.

## Inputs

| Name | Required | Description |
| --- | --- | --- |
| `file` | ✅ | Path to the file to upload (must be inside the workspace). |
| `mime-type` | ✅ | MIME type for the uploaded artifact, e.g. `text/html`. |
| `artifact-name` | ✅ | Artifact name to show in the workflow run. |

## Outputs

| Name | Description |
| --- | --- |
| `artifact-url` | Absolute URL to the artifact in the current workflow run. |

## Usage

```yaml
name: Example

on:
  workflow_dispatch:

jobs:
  upload-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate report
        run: |
          mkdir -p reports
          cat <<'HTML' > reports/report.html
          <!doctype html>
          <html><body><h1>Interactive report</h1></body></html>
          HTML

      - name: Upload report
        id: upload
        uses: svrooij/gh-artifact-upload-advanced@v1
        with:
          file: reports/report.html
          mime-type: text/html
          artifact-name: report.html

      - name: Show URL
        run: echo "${{ steps.upload.outputs.artifact-url }}"
```

## Development

- Install dependencies: `npm ci`
- Run tests: `npm test`

## Included workflows

- `.github/workflows/test.yml`: Runs unit tests and a smoke test that executes the action.
- `.github/workflows/publish.yml`: Runs tests and creates a GitHub release when a `v*` tag is pushed.
