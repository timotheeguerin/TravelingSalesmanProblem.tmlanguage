import { deepStrictEqual } from "assert";
import { describe, it } from "vitest";
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
    eof: createToken("EOF", "keyword.eof.tsp"),
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

describe("specification section", () => {
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
});

describe("data section", () => {
  it("single section without EOF", async () => {
    const tokens = await tokenize(`
NODE_COORD_SECTION
1 0 101
2 0 106   
`);
    deepStrictEqual(tokens, [
      Token.keywords.other("NODE_COORD_SECTION"),
      Token.values.numeric("1"),
      Token.values.numeric("0"),
      Token.values.numeric("101"),
      Token.values.numeric("2"),
      Token.values.numeric("0"),
      Token.values.numeric("106"),
    ]);
  });

  it("single section with EOF", async () => {
    const tokens = await tokenize(`
NODE_COORD_SECTION
1 0 101
2 0 106
EOF
`);
    deepStrictEqual(tokens, [
      Token.keywords.other("NODE_COORD_SECTION"),
      Token.values.numeric("1"),
      Token.values.numeric("0"),
      Token.values.numeric("101"),
      Token.values.numeric("2"),
      Token.values.numeric("0"),
      Token.values.numeric("106"),
      Token.keywords.eof,
    ]);
  });

  it("multiple section with EOF", async () => {
    const tokens = await tokenize(`
NODE_COORD_SECTION
1 0 101
2 0 106
EOF
NODE_COORD_SECTION
1 0 101
2 0 106
EOF
`);
    deepStrictEqual(tokens, [
      Token.keywords.other("NODE_COORD_SECTION"),
      Token.values.numeric("1"),
      Token.values.numeric("0"),
      Token.values.numeric("101"),
      Token.values.numeric("2"),
      Token.values.numeric("0"),
      Token.values.numeric("106"),
      Token.keywords.eof,
      Token.keywords.other("NODE_COORD_SECTION"),
      Token.values.numeric("1"),
      Token.values.numeric("0"),
      Token.values.numeric("101"),
      Token.values.numeric("2"),
      Token.values.numeric("0"),
      Token.values.numeric("106"),
      Token.keywords.eof,
    ]);
  });
});
