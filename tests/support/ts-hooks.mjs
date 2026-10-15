// Module hooks that let node --test import the app's TypeScript directly:
// .ts files are transpiled with the project's own TypeScript, "@/" resolves
// to src/, "server-only" becomes an empty module, and "next/headers" is
// replaced by tests/support/next-headers.mjs. Types aren't checked here;
// npx tsc --noEmit does that.

import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const SRC = new URL("../../src/", import.meta.url);
const EMPTY_MODULE = "data:text/javascript,export {};";
const NEXT_HEADERS = new URL("./next-headers.mjs", import.meta.url).href;
const SUFFIXES = ["", ".ts", ".tsx", "/index.ts"];

function findSource(url) {
  for (const suffix of SUFFIXES) {
    const candidate = new URL(url.href + suffix);

    try {
      if (statSync(candidate).isFile()) {
        return candidate.href;
      }
    } catch {
      // Try the next suffix.
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: EMPTY_MODULE, shortCircuit: true };
  }

  if (specifier === "next/headers") {
    return { url: NEXT_HEADERS, shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const url = findSource(new URL(specifier.slice(2), SRC));

    if (url) {
      return { url, shortCircuit: true };
    }
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith(SRC.href)) {
    const url = findSource(new URL(specifier, context.parentURL));

    if (url) {
      return { url, shortCircuit: true };
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    // Packages without an exports map, such as next, need the extension
    // under ESM: "next/server" is next/server.js.
    if (error?.code === "ERR_MODULE_NOT_FOUND" && /^[@\w]/.test(specifier) && !specifier.endsWith(".js")) {
      return nextResolve(`${specifier}.js`, context);
    }

    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && /\.tsx?$/.test(url)) {
    const { outputText } = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      fileName: fileURLToPath(url),
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });

    return { format: "module", source: outputText, shortCircuit: true };
  }

  return nextLoad(url, context);
}
