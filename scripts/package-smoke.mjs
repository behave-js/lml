import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run package smoke through npm so npm_execpath is available");

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || `${command} failed`);
  }
  return result.stdout;
}

await access(fileURLToPath(new URL("../dist/src/index.js", import.meta.url)));
await access(fileURLToPath(new URL("../dist/src/index.d.ts", import.meta.url)));
await import(new URL("../dist/src/index.js", import.meta.url));

const work = await mkdtemp(join(tmpdir(), "lml-package-smoke-"));
const cache = join(work, "npm-cache");
const npmEnv = { ...process.env, npm_config_cache: cache };
try {
  const dryRun = run(
    process.execPath,
    [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts"],
    root,
    npmEnv,
  );
  const report = JSON.parse(dryRun)[0];
  const paths = new Set(report.files.map((file) => file.path));
  for (const required of ["dist/src/index.js", "dist/src/index.d.ts", "dist/spec/ast.js", "dist/spec/ast.d.ts"]) {
    if (!paths.has(required)) throw new Error(`Packed artifact is missing ${required}`);
  }
  for (const file of paths) {
    if (/^(src|spec|tests|wysiwyg)\//.test(file)) {
      throw new Error(`Packed artifact contains development source: ${file}`);
    }
  }

  const packed = JSON.parse(run(
    process.execPath,
    [npmCli, "pack", "--json", "--ignore-scripts", "--pack-destination", work],
    root,
    npmEnv,
  ))[0];
  const tarball = join(work, packed.filename);
  const consumer = join(work, "consumer");
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), JSON.stringify({ type: "module", private: true }));
  await writeFile(
    join(consumer, "index.mts"),
    'import { parseLml, parseAndJoin, parseMarkdownBlocks, validateLml, type Document, type HostNode, type PageAxisSize, type PageNode } from "lml";\nconst document: Document = parseLml("host { page(md:catalog, w: 960, h: 540) {} page(md:cart, w: 960, h: 540) {} }");\nif (document.root.kind !== "Host" || validateLml(document).length !== 0) throw new Error("Valid multi-page Host expected");\nconst host: HostNode = document.root;\nconst page: PageNode = host.children[0] as PageNode;\nif (page.ref !== "catalog") throw new Error("Page ref missing");\nif (!parseAndJoin("page(md:catalog) {}", "# catalog\\n## Page").slide) throw new Error("Page ref join failed");\nif (parseMarkdownBlocks("# title\\n## Hello").blocks[0]?.body !== "## Hello") throw new Error("Markdown block parsing failed");\nconst size: PageAxisSize = { kind: "Fraction", value: 1 };\nvoid size;\n',
  );
  await writeFile(
    join(consumer, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: "NodeNext", moduleResolution: "NodeNext" }, include: ["index.mts"] }),
  );
  run(
    process.execPath,
    [npmCli, "install", "--ignore-scripts", "--no-package-lock", "--no-audit", tarball],
    consumer,
    npmEnv,
  );
  run(
    process.execPath,
    [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "-p", "tsconfig.json"],
    consumer,
  );
  run(
    process.execPath,
    ["--input-type=module", "--eval", 'const m = await import("lml"); const d = m.parseLml("host { page(md:one,w:960,h:540){} page(md:two,w:960,h:540){} }"); if (d.root.kind !== "Host" || d.root.children[1].ref !== "two" || m.validateLml(d).length) process.exit(1);'],
    consumer,
  );
  console.log(`package smoke passed (${paths.size} files; ESM + types consumer)`);
} finally {
  await rm(work, { recursive: true, force: true });
}
