import { deepStrictEqual } from "assert";
import { it } from "vitest";
import type { TypeSpecScope } from "../src/grammar.js";
import { tokenize } from "./utils.js";

export type MetaScope = `meta.${string}.tsp`;
export type TokenScope = TypeSpecScope | MetaScope;

interface Token {
  text: string;
  scope: TokenScope;
}

function createToken(text: string, scope: TokenScope): Token {
  return { text, scope };
}

const Token = {
  keywords: {
    other: (text: string) => createToken(text, "keyword.other.tsp"),
  },

  meta: (text: string, meta: string) => createToken(text, `meta.${meta}.tsp`),

  punctuation: {
    colon: createToken(":", "punctuation.separator.key-value.mapping.yaml"),
  },

  values: {
    numeric: (text: string) => createToken(text, "constant.numeric.tsp"),
    string: (text: string) =>
      createToken(text, "string.unquoted.plain.out.yaml"),
  },
} as const;

it("NAME: <string>", async () => {
  const tokens = await tokenize(`NAME: abc`);
  deepStrictEqual(tokens, [
    Token.keywords.other("NAME"),
    Token.punctuation.colon,
    Token.values.string("abc"),
  ]);
});

it("DIMENSION: <integer>", async () => {
  const tokens = await tokenize(`NAME: 123`);
  deepStrictEqual(tokens, [
    Token.keywords.other("NAME"),
    Token.punctuation.colon,
    Token.values.numeric("123"),
  ]);
});

it("COMMENT: multi word", async () => {
  const tokens = await tokenize(`COMMENT: multi word`);
  deepStrictEqual(tokens, [
    Token.keywords.other("COMMENT"),
    Token.punctuation.colon,
    Token.values.string("multi word"),
  ]);
});
