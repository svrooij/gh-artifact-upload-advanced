// core.js
import fs from "node:fs";
function getInput(name, options = {}) {
  const val = (process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] ?? "").trim();
  if (options.required && !val) {
    throw new Error(`Input required and not supplied: ${name}`);
  }
  return val;
}
function info(message) {
  process.stdout.write(`${message}
`);
}
function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}
`);
  } else {
    process.stdout.write(`::set-output name=${name}::${value}
`);
  }
}
function setFailed(message) {
  process.exitCode = 1;
  process.stderr.write(`::error::${message}
`);
}

// index.js
import fs2 from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
function resolveInputFilePath(rawPath, workspace) {
  const baseDir = path.resolve(workspace || process.env.GITHUB_WORKSPACE || process.cwd());
  const resolved = path.resolve(baseDir, rawPath);
  const relative = path.relative(baseDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}
function extractBackendIds(jwt) {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return [null, null];
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const scp = payload.scp || "";
    for (const scope of scp.split(" ")) {
      if (scope.startsWith("Actions.Results:")) {
        const segs = scope.split(":");
        if (segs.length >= 3) {
          return [segs[1], segs[2]];
        }
      }
    }
  } catch {
    return [null, null];
  }
  return [null, null];
}
function buildArtifactUrl({ serverUrl, repository, runId, artifactId }) {
  return `${serverUrl}/${repository}/actions/runs/${runId}/artifacts/${artifactId}`;
}
async function run() {
  const fileInput = getInput("file", { required: true });
  const mimeType = getInput("mime-type", { required: true });
  const artifactName = getInput("artifact-name", { required: true });
  const filePath = resolveInputFilePath(fileInput);
  if (!filePath) {
    throw new Error("The input file must be inside the repository workspace.");
  }
  const stats = fs2.statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`Input path is not a file: ${filePath}`);
  }
  const runtimeToken = process.env.ACTIONS_RUNTIME_TOKEN;
  const resultsUrl = process.env.ACTIONS_RESULTS_URL;
  if (!runtimeToken || !resultsUrl) {
    throw new Error("ACTIONS_RUNTIME_TOKEN and ACTIONS_RESULTS_URL are required in this runner context.");
  }
  const [runBackendId, jobBackendId] = extractBackendIds(runtimeToken);
  if (!runBackendId || !jobBackendId) {
    throw new Error("Unable to extract workflow backend IDs from runtime token.");
  }
  const origin = new URL(resultsUrl).origin;
  const authHeaders = {
    Authorization: "Bearer " + runtimeToken,
    "Content-Type": "application/json"
  };
  const createResp = await fetch(`${origin}/twirp/github.actions.results.api.v1.ArtifactService/CreateArtifact`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      workflow_run_backend_id: runBackendId,
      workflow_job_run_backend_id: jobBackendId,
      name: artifactName,
      version: 7,
      mime_type: mimeType
    })
  });
  if (!createResp.ok) {
    throw new Error(`CreateArtifact failed (${createResp.status}): ${await createResp.text()}`);
  }
  const { signed_upload_url: signedUploadUrl } = await createResp.json();
  const fileBytes = fs2.readFileSync(filePath);
  const sha256 = crypto.createHash("sha256").update(fileBytes).digest("hex");
  const blobResp = await fetch(signedUploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "x-ms-blob-type": "BlockBlob"
    },
    body: fileBytes
  });
  if (!blobResp.ok) {
    throw new Error(`Blob upload failed (${blobResp.status}): ${await blobResp.text()}`);
  }
  const finalizeResp = await fetch(`${origin}/twirp/github.actions.results.api.v1.ArtifactService/FinalizeArtifact`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      workflow_run_backend_id: runBackendId,
      workflow_job_run_backend_id: jobBackendId,
      name: artifactName,
      size: fileBytes.length.toString(),
      hash: `sha256:${sha256}`
    })
  });
  if (!finalizeResp.ok) {
    throw new Error(`FinalizeArtifact failed (${finalizeResp.status}): ${await finalizeResp.text()}`);
  }
  const { artifact_id: artifactId } = await finalizeResp.json();
  const artifactUrl = buildArtifactUrl({
    serverUrl: process.env.GITHUB_SERVER_URL || "https://github.com",
    repository: process.env.GITHUB_REPOSITORY,
    runId: process.env.GITHUB_RUN_ID,
    artifactId
  });
  info(`Uploaded artifact id=${artifactId}`);
  setOutput("artifact-url", artifactUrl);
}
var isEntryPoint = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isEntryPoint) {
  run().catch((error) => {
    setFailed(error.message);
  });
}
export {
  buildArtifactUrl,
  extractBackendIds,
  resolveInputFilePath,
  run
};
