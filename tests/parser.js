const assert = require("assert");
const {Parser} = require("../src/parser.js");

describe("Parser", function() {
  it("expressions", function() {
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
    ]]);
  });

  it("for", () => {
    const results = new Parser().parse(`
      for (every x) 
        a(x).

      for (every x) 
        a(x) && b(x).

      for (every x) 
        a(x) => b(x).

      for (every x) 
        for (every y) 
          a(x, y, Z).

      for (every x) 
        a(x, C).

      for (every x) {
        a(x).
      }

      for (most x) {
        a(x).
      }

      for (few x)
        a(x).

      for (only x)
        a(x).
    `);
    assertThat(results).equalsTo([[
      ["every", "x", [["a", ["x"]], "."]],
      ["every", "x", [[["a", ["x"]], "&&", ["b", ["x"]]], "."]],
      ["every", "x", [[["a", ["x"]], "=>", ["b", ["x"]]], "."]],
      ["every", "x", ["every", "y", [["a", ["x", "y", "Z"]], "."]]],
      // (forall(x) a(x)) && (forall(y) b(y)).
      //[[["forall", "x", ["a", ["x"]]], "&&", ["forall", "y", ["b", ["y"]]]], "."],
      ["every", "x", [["a", ["x", "C"]], "."]],
      ["every", "x", [[["a", ["x"]], "."]]],
      ["most", "x", [[["a", ["x"]], "."]]],
      ["few", "x", [["a", ["x"]], "."]], 
      ["only", "x", [["a", ["x"]], "."]], 
   ]]);
  });
  
  it("if", function() {
    const results = new Parser().parse(`
      if (A)
        B. 
      if (a(b, c))
        d(e).
      if (A && B)
        C && D. 
      if (A) {
        B.
      }
      if (A) {
        B.
        C.
      }
      if (A) {
        B.
      } else {
        C.
      }
    `);
    assertThat(results).equalsTo([[
      ["if", "A", ["B", "."]],
      ["if", ["a", ["b", "c"]], [["d", ["e"]], "."]],
      ["if", ["A", "&&", "B"], [["C", "&&", "D"], "."]],
      ["if", "A", [["B", "."]]],
      ["if", "A", [["B", "."], ["C", "."]]],
      ["if", "A", [["B", "."]], [["C", "."]]],
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
