import { readFile } from "fs/promises";
import { createRequire } from "module";
import { dirname, resolve } from "path";
import vscode_oniguruma from "vscode-oniguruma";
import vscode_textmate, {
  type IOnigLib,
  type StateStack,
} from "vscode-textmate";
import type { TypeSpecScope } from "../src/grammar.js";
import { fileURLToPath } from "url";

const { parseRawGrammar, Registry } = vscode_textmate;
const { createOnigScanner, createOnigString, loadWASM } = vscode_oniguruma;

export type MetaScope = `meta.${string}.tsp`;
export type TokenScope = TypeSpecScope | MetaScope;

interface Token {
  text: string;
  scope: TokenScope;
}

function createToken(text: string, scope: TokenScope): Token {
  return { text, scope };
}

async function createOnigLib(): Promise<IOnigLib> {
  const require = createRequire(import.meta.url);
  const onigWasm = await readFile(
    `${dirname(require.resolve("vscode-oniguruma"))}/onig.wasm`
  );

  await loadWASM(onigWasm.buffer);

  return {
    createOnigScanner: (sources) => createOnigScanner(sources),
    createOnigString,
  };
}

const registry = new Registry({
  onigLib: createOnigLib(),
  loadGrammar: async () => {
    const data = await readFile(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../grammars/TravelingSalesmanProblem.tmLanguage"
      ),
      "utf-8"
    );
    return parseRawGrammar(data);
  },
});

const excludedScopes = ["source.tsp"];

export async function tokenize(input: string | Input): Promise<Token[]> {
  if (typeof input === "string") {
    input = Input.fromText(input);
  }

  const tokens: Token[] = [];
  let previousStack: StateStack | null = null;
  const grammar = await registry.loadGrammar("source.tsp");

  if (grammar === null) {
    throw new Error("Unexpected null grammar");
  }

  for (let lineIndex = 0; lineIndex < input.lines.length; lineIndex++) {
    const line = input.lines[lineIndex];

    const lineResult = grammar.tokenizeLine(line, previousStack);
    previousStack = lineResult.ruleStack;

    if (lineIndex < input.span.startLine || lineIndex > input.span.endLine) {
      continue;
    }

    for (const token of lineResult.tokens) {
      if (
        (lineIndex === input.span.startLine &&
          token.startIndex < input.span.startIndex) ||
        (lineIndex === input.span.endLine &&
          token.endIndex > input.span.endIndex)
      ) {
        continue;
      }

      const text = line.substring(token.startIndex, token.endIndex);
      const scope = token.scopes[token.scopes.length - 1];

      if (!excludeScope(scope)) {
        tokens.push(createToken(text, scope as TokenScope));
      }
    }

    for (let i = 0; i < tokens.length - 2; i++) {
      // For some reason we get strings as three tokens from API, combine them.
      // Inspect tokens in VS Code shows only one token as expected and as combined here.
      if (tokens[i].text === '"' && tokens[i + 2].text === '"') {
        tokens[i].text = '"' + tokens[i + 1].text + '"';
        tokens.splice(i + 1, 2);
      }
    }
  }

  return tokens;
}

function excludeScope(scope: string) {
  return excludedScopes.includes(scope) || scope.startsWith("meta.");
}

interface Span {
  startLine: number;
  startIndex: number;
  endLine: number;
  endIndex: number;
}

class Input {
  private constructor(public lines: string[], public span: Span) {}

  public static fromText(text: string) {
    // ensure consistent line-endings irrelevant of OS
    text = text.replace("\r\n", "\n");
    const lines = text.split("\n");

    return new Input(lines, {
      startLine: 0,
      startIndex: 0,
      endLine: lines.length - 1,
      endIndex: lines[lines.length - 1].length,
    });
  }
}
