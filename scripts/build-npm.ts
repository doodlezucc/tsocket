import { build, emptyDir } from "@deno/dnt";
import denoPackage from "../deno.json" with { type: "json" };

const releaseVersion = denoPackage.version;

await emptyDir("./npm");

await build({
  entryPoints: [
    "./src/net/index.ts",
    {
      name: "./client",
      path: "./src/client/index.ts",
    },
  ],
  outDir: "./npm",
  shims: {
    deno: "dev",
  },
  importMap: "deno.json",
  mappings: {
    // "npm:zod" would be better, but currently doesn't produce a
    // peer dependency in dnt's generated "package.json".
    // https://github.com/denoland/dnt/issues/433
    "https://esm.sh/zod@^3.24.1": {
      name: "zod",
      version: "^3.24.1",
      peerDependency: true,
    },
  },
  compilerOptions: {
    lib: ["ESNext", "DOM"],
  },
  package: {
    // package.json properties
    name: "tsocket",
    version: releaseVersion,
    description:
      "A type-safe, versatile implementation of remote procedure calls (RPC).",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/doodlezucc/tsocket.git",
    },
    bugs: {
      url: "https://github.com/doodlezucc/tsocket/issues",
    },
  },
});

await Deno.copyFile("LICENSE", "./npm/LICENSE");
await Deno.copyFile("README.md", "./npm/README.md");
