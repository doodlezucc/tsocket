import { build, emptyDir } from "@deno/dnt";
import denoPackage from "../deno.json" with { type: "json" };

const releaseVersion = denoPackage.version;

await emptyDir("./npm");

await build({
  entryPoints: ["./src/index.ts"],
  outDir: "./npm",
  shims: {
    deno: true,
  },
  importMap: "deno.json",
  compilerOptions: {
    lib: ["ESNext"],
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
