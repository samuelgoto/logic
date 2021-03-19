const assert = require("assert");
const {Parser} = require("../src/parser.js");

describe("Parser", function() {

  it("statements", function() {
    const results = new Parser().parse(`
      hello().
    `);
    assertThat(results).equalsTo([[
      [["hello", []], "."],
    ]]);
  });

  it("propositions", function() {
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
    ]]);
  });

  it("predicates", function() {
    const results = new Parser().parse(`
      a().
      a() && b() => c().
      a(b).
      a(b, c).
      a(B, C).
      a("b").
      a(1).
    `);
    assertThat(results).equalsTo([[
      [["a", []], "."],
      [[[["a", []], "&&", ["b", []]], "=>", ["c", []]], "."],
      [["a", ["b"]], "."],
      [["a", ["b", "c"]], "."],
      [["a", ["B", "C"]], "."],
      [["a", ["'b'"]], "."],
      [["a", [1]], "."],
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

      for (every x: b(x))
        a(x).

      for (every x: a(x) && b(x))
        c(x) && d(x).

      for (every x: a(x) && b(x)) {
        c(x).
        d(x).
      }
    `);
    assertThat(results).equalsTo([[
      ["every", "x", [], [["a", ["x"]], "."]],
      ["every", "x", [], [[["a", ["x"]], "&&", ["b", ["x"]]], "."]],
      ["every", "x", [], [[["a", ["x"]], "=>", ["b", ["x"]]], "."]],
      ["every", "x", [], ["every", "y", [], [["a", ["x", "y", "Z"]], "."]]],
      // (forall(x) a(x)) && (forall(y) b(y)).
      //[[["forall", "x", ["a", ["x"]]], "&&", ["forall", "y", ["b", ["y"]]]], "."],
      ["every", "x", [], [["a", ["x", "C"]], "."]],
      ["every", "x", [], [[["a", ["x"]], "."]]],
      ["most", "x", [], [[["a", ["x"]], "."]]],
      ["few", "x", [], [["a", ["x"]], "."]], 
      ["only", "x", [], [["a", ["x"]], "."]], 
      ["every", "x", ["b", ["x"]], [["a", ["x"]], "."]], 
      ["every", "x", [["a", ["x"]], "&&", ["b", ["x"]]], [[["c", ["x"]], "&&", ["d", ["x"]]], "."]],
      ["every", "x", [["a", ["x"]], "&&", ["b", ["x"]]], [[["c", ["x"]], "."], [["d", ["x"]], "."]]], 
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

  it("comments", function() {
    const results = new Parser().parse(`
      // this is a comment
      if (A)
        B. // another comment
      // this is another comment
    `);
    assertThat(results).equalsTo([[
      "// this is a comment",
      ["if", "A", ["B", "."]],
      "// another comment",
      "// this is another comment",
    ]]);
  });
  
  it("questions", function() {
    const results = new Parser().parse(`
      hello()?
      question () {
        hello().
      } ?
    `);
    assertThat(results).equalsTo([[
      ["?", ["hello", []]],
      ["?", [[["hello", []], "."]]],
    ]]);
  });

  it("commands", function() {
    const results = new Parser().parse(`
      hello()!
    `);
    assertThat(results).equalsTo([[
      ["!", ["hello", []]],
    ]]);
  });

  it("print('hello world')!", function() {
    const results = new Parser().parse(`
      // prints hello world
      print("hello world")!
    `);
    assertThat(results).equalsTo([[
      "// prints hello world",
      ["!", ["print", ["'hello world'"]]],
    ]]);
  });

  it("mortal(Socrates)?", function() {
    const results = new Parser().parse(`
      // most basic logical program
      for (all x: man(x)) mortal(x).
      man(Socrates).
      mortal(Socrates)? 
    `);
    assertThat(results).equalsTo([[
      "// most basic logical program",
      ["all", "x", ["man", ["x"]], [["mortal", ["x"]], "."]],
      [["man", ["Socrates"]], "."],
      ["?", ["mortal", ["Socrates"]]],
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
