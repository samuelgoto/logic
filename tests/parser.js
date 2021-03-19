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

  it("either", function() {
    const results = new Parser().parse(`
      either A or B.

      either {
        A.
      } or {
        B.
      }
    `);
    assertThat(results).equalsTo([[
      ["either", "A", ["B", "."]],
      ["either", [["A", "."]], [["B", "."]]],
    ]]);
  });

  it("not", function() {
    const results = new Parser().parse(`
      not A.
      not {
        A.
        B.
      }
    `);
    assertThat(results).equalsTo([[
      ["not", ["A", "."]],
      ["not", [["A", "."], ["B", "."]]],
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
  
  it("A man admires a woman.", function() {
    const results = new Parser().parse(`
      man(a).
      woman(b).
      admires(s0, a, b).
    `);
    assertThat(results).equalsTo([[
      [["man", ["a"]], "."],
      [["woman", ["b"]], "."],
      [["admires", ["s0", "a", "b"]], "."],
    ]]);
  });

  it("A man who loves Mary fascinates Smith.", function() {
    const results = new Parser().parse(`
      man(a).
      Mary(b).
      Smith(c).
      love(s0, a, b).
      fascinate(s1, a, c).
    `);
    assertThat(results).equalsTo([[
      [["man", ["a"]], "."],
      [["Mary", ["b"]], "."],
      [["Smith", ["c"]], "."],
      [["love", ["s0", "a", "b"]], "."],
      [["fascinate", ["s1", "a", "c"]], "."],
    ]]);
  });

  it("Jones does not own a porsche.", function() {
    const results = new Parser().parse(`
      Jones(a).
      not {
        porsche(b).
        own(s0, a, b).
      }
    `);
    assertThat(results).equalsTo([[
      [["Jones", ["a"]], "."],
      ["not", [
        [["porsche", ["b"]], "."],
        [["own", ["s0", "a", "b"]], "."],
      ]]
    ]]);
  });

  it("Jones does not own a porsche which does not fascinate him.", function() {
    const results = new Parser().parse(`
      Jones(a).
      not {
        porsche(b).
        own(s0, a, b).
        not {
          fascinate(s1, b, a).
        }
      }
    `);
    assertThat(results).equalsTo([[
      [["Jones", ["a"]], "."],
      ["not", [
        [["porsche", ["b"]], "."],
        [["own", ["s0", "a", "b"]], "."],
        ["not", [
          [["fascinate", ["s1", "b", "a"]], "."],
        ]]
      ]]
    ]]);
  });

  it("Jones is a happy man.", function() {
    const results = new Parser().parse(`
      Jones(a).
      man(a).
      happy-man(a).
    `);
    assertThat(results).equalsTo([[
      [["Jones", ["a"]], "."],
      [["man", ["a"]], "."],
      [["happy-man", ["a"]], "."],
    ]]);
  });
  
  it("Jones loves every man.", function() {
    const results = new Parser().parse(`
      Jones(a).
      for (every b: man(b)) {
        love(s0, a, b).
      }
    `);
    assertThat(results).equalsTo([[
      [["Jones", ["a"]], "."],
      ["every", "b", ["man", ["b"]], [[["love", ["s0", "a", "b"]], "."]]],
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
