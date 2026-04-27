import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const envPath = join(root, ".vercel", ".env.production.local");
const outputStaticPath = join(root, ".vercel", "output", "static");
const projectPath = join(root, ".vercel", "project.json");
const supabaseConfigPath = join(root, "supabase", "config.toml");
const requiredEnvNames = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PROJECT_ID",
];

const mode = process.argv[2] ?? "deploy";

const fail = (message) => {
  console.error(`\n[deploy guard] ${message}`);
  process.exit(1);
};

const info = (message) => {
  console.log(`[deploy guard] ${message}`);
};

const run = (command, args) => {
  const executable =
    process.platform === "win32" && command === "npx" ? "npx.cmd" : command;

  info(`running: ${command} ${args.join(" ")}`);
  const result = spawnSync(executable, args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    fail(`command failed: ${command} ${args.join(" ")}`);
  }
};

const parseDotEnv = (content) => {
  const env = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env.set(match[1], value);
  }

  return env;
};

const getSupabaseProjectId = () => {
  if (!existsSync(supabaseConfigPath)) {
    fail("missing supabase/config.toml; cannot validate production project id.");
  }

  const config = readFileSync(supabaseConfigPath, "utf8");
  const match = config.match(/project_id\s*=\s*"([^"]+)"/);
  if (!match?.[1]) {
    fail("supabase/config.toml does not define project_id.");
  }

  return match[1];
};

const getProductionAlias = () => {
  if (!existsSync(projectPath)) {
    fail("missing .vercel/project.json; run `npx vercel link` first.");
  }

  const project = JSON.parse(readFileSync(projectPath, "utf8"));
  if (!project.projectName) {
    fail(".vercel/project.json does not define projectName.");
  }

  return `https://${project.projectName}.vercel.app`;
};

const isEmptyLike = (value) =>
  value == null ||
  value.trim() === "" ||
  ["undefined", "null", "<project-ref>", "<supabase-publishable-key>"].includes(
    value.trim(),
  );

const validateProductionEnv = () => {
  if (!existsSync(envPath)) {
    fail(`missing ${envPath}; run \`npx vercel pull --yes --environment=production\`.`);
  }

  const env = parseDotEnv(readFileSync(envPath, "utf8"));
  const projectId = getSupabaseProjectId();

  for (const name of requiredEnvNames) {
    const value = env.get(name);
    if (isEmptyLike(value)) {
      fail(`${name} is empty in .vercel/.env.production.local.`);
    }
  }

  const envProjectId = env.get("VITE_SUPABASE_PROJECT_ID");
  if (envProjectId !== projectId) {
    fail(
      `VITE_SUPABASE_PROJECT_ID is ${envProjectId}, expected ${projectId} from supabase/config.toml.`,
    );
  }

  const supabaseUrl = env.get("VITE_SUPABASE_URL");
  const expectedUrl = `https://${projectId}.supabase.co`;
  if (supabaseUrl !== expectedUrl) {
    fail(`VITE_SUPABASE_URL is ${supabaseUrl}, expected ${expectedUrl}.`);
  }

  const publishableKey = env.get("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (publishableKey.length < 100) {
    fail("VITE_SUPABASE_PUBLISHABLE_KEY looks too short.");
  }

  info("production Supabase env is present and matches supabase/config.toml.");
  return { projectId, expectedUrl };
};

const getBundlePath = () => {
  const assetsPath = join(outputStaticPath, "assets");
  if (!existsSync(assetsPath)) {
    fail("missing .vercel/output/static/assets; run `npx vercel build --prod` first.");
  }

  const bundles = readdirSync(assetsPath)
    .filter((name) => /^index-.*\.js$/.test(name))
    .sort();

  if (bundles.length !== 1) {
    fail(`expected exactly one index JS bundle, found ${bundles.length}.`);
  }

  return join(assetsPath, bundles[0]);
};

const validatePrebuiltOutput = () => {
  const { projectId, expectedUrl } = validateProductionEnv();
  const bundlePath = getBundlePath();
  const bundle = readFileSync(bundlePath, "utf8");

  if (!bundle.includes(projectId)) {
    fail(`prebuilt bundle does not contain Supabase project id ${projectId}.`);
  }

  if (!bundle.includes(expectedUrl)) {
    fail(`prebuilt bundle does not contain Supabase URL ${expectedUrl}.`);
  }

  info(`prebuilt bundle contains ${projectId} and ${expectedUrl}.`);
};

const validatePublishedAlias = async () => {
  const { projectId, expectedUrl } = validateProductionEnv();
  const alias = getProductionAlias();
  const htmlResponse = await fetch(alias);

  if (!htmlResponse.ok) {
    fail(`${alias} returned HTTP ${htmlResponse.status}.`);
  }

  const html = await htmlResponse.text();
  const bundleMatch = html.match(/\/assets\/index-[^" ]+\.js/);
  if (!bundleMatch?.[0]) {
    fail(`${alias} HTML does not reference the Vite index bundle.`);
  }

  const bundleUrl = new URL(bundleMatch[0], alias).toString();
  const bundleResponse = await fetch(bundleUrl);
  if (!bundleResponse.ok) {
    fail(`${bundleUrl} returned HTTP ${bundleResponse.status}.`);
  }

  const bundle = await bundleResponse.text();
  if (!bundle.includes(projectId) || !bundle.includes(expectedUrl)) {
    fail(`${bundleUrl} does not contain the expected Supabase production env.`);
  }

  info(`${alias} is live and serving a bundle with the expected Supabase env.`);
};

if (mode === "--verify-env") {
  validateProductionEnv();
  process.exit(0);
}

if (mode === "--verify-output") {
  validatePrebuiltOutput();
  process.exit(0);
}

if (mode !== "deploy") {
  fail(`unknown mode: ${mode}`);
}

run("npx", ["--yes", "vercel", "pull", "--yes", "--environment=production"]);
validateProductionEnv();
run("npx", ["--yes", "vercel", "build", "--prod"]);
validatePrebuiltOutput();
run("npx", ["--yes", "vercel", "deploy", "--prebuilt", "--prod", "--yes"]);
await validatePublishedAlias();
