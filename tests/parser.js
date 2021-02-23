const assert = require("assert");
const {Parser} = require("../src/parser.js");

describe("Parser", function() {
  
  it.skip("nearley", function() {
    const grammar = build(`
      main -> "foo" | bar
    `);
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    const {results} = parser.feed("foo");
    assertThat(results).equalsTo([["foo"]]);
  });

  it.only("logic", function() {
    const results = new Parser().parse(`
      A. 
      B. 
      Aa. 
      Bb. 
      A || B.
      C && D.
      A || B && C.
      A && B || C.
      A => B.
      A && B => C.
      A => B && C.
      A || B => C.
      A => B || C.
      A && (B => C).
      (A => B) && (B => C).
      (A).
      A?
      (A => B) && (B => C)?
      a().
      a() && b() => c().
      a(b).
      a(b, c).
      a(B, C).
      forall(x) a(x).
      forall(x) a(x) && b(x).
      forall(x) a(x) => b(x).
      forall(x) forall(y) a(x, y, Z).
      (forall(x) a(x)) && (forall(y) b(y)).
    `);
    assertThat(results).equalsTo([[
      ["A", "."],
      ["B", "."],
      ["Aa", "."],
      ["Bb", "."],
      [["A", "||", "B"], "."],
      [["C", "&&", "D"], "."],
      [["A", "||", ["B", "&&", "C"]], "."],
      [[["A", "&&", "B"], "||", "C"], "."],
      [["A", "=>", "B"], "."],
      [[["A", "&&", "B"], "=>", "C"], "."],
      [["A", "=>", ["B", "&&", "C"]], "."],
      [[["A", "||", "B"], "=>", "C"], "."],
      [["A", "=>", ["B", "||", "C"]], "."],
      [["A", "&&", ["B", "=>", "C"]], "."],
      [[["A", "=>", "B"], "&&", ["B", "=>", "C"]], "."],
      ["A", "."],
      ["A", "?"],
      [[["A", "=>", "B"], "&&", ["B", "=>", "C"]], "?"],
      [["a", []], "."],
      [[[["a", []], "&&", ["b", []]], "=>", ["c", []]], "."],
      [["a", ["b"]], "."],
      [["a", ["b", "c"]], "."],
      [["a", ["B", "C"]], "."],
      [["forall", "x", ["a", ["x"]]], "."],
      [["forall", "x", [["a", ["x"]], "&&", ["b", ["x"]]]], "."],
      [["forall", "x", [["a", ["x"]], "=>", ["b", ["x"]]]], "."],
      [["forall", "x", ["forall", "y", ["a", ["x", "y", "Z"]]]], "."],
      [[["forall", "x", ["a", ["x"]]], "&&", ["forall", "y", ["b", ["y"]]]], "."],
    ]]);
  });

  function assertThat(x) {
    return {
      equalsTo(y) {
        assert.deepEqual(x, y);
      }
    }
  }
});
