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
      a().
      A().
      b(). 
      aB(). 
      a-b(). 
      c() && d().
      a() && b() && c().
      (a()).
    `);
    assertThat(results).equalsTo([[
      [["a", []], "."],
      [["A", []], "."],
      [["b", []], "."],
      [["aB", []], "."],
      [["a-b", []], "."],
      [[["c", []], "&&", ["d", []]], "."],
      [[[["a", []], "&&", ["b", []]], "&&", ["c", []]], "."],
      [["a", []], "."],
    ]]);
  });

  it("predicates", function() {
    const results = new Parser().parse(`
      a().
      a() && b() => c().
      a(b).
      a(b, c).
      a(b, c).
      a("b").
      a(1).
    `);
    assertThat(results).equalsTo([[
      [["a", []], "."],
      [[[["a", []], "&&", ["b", []]], "=>", ["c", []]], "."],
      [["a", ["b"]], "."],
      [["a", ["b", "c"]], "."],
      [["a", ["b", "c"]], "."],
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
          a(x, y).

      for (every x) 
        a(x, c).

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
      ["every", "x", [], ["every", "y", [], [["a", ["x", "y"]], "."]]],
      // (forall(x) a(x)) && (forall(y) b(y)).
      //[[["forall", "x", ["a", ["x"]]], "&&", ["forall", "y", ["b", ["y"]]]], "."],
      ["every", "x", [], [["a", ["x", "c"]], "."]],
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
      if (a())
        b(). 

      if (a(b, c))
        d(e).

      if (a() && b())
        c() && d(). 

      if (a()) {
        b().
      }

      if (a()) {
        b().
        c().
      }

      if (a()) {
        b().
      } else {
        c().
      }

      if (let a: foo(a)) {
        bar(a).
      }

      if (let a, b: foo(a)) {
        bar(a, b).
      }
    `);
    assertThat(results).equalsTo([[
      ["if", [], ["a", []], [["b", []], "."]],
      ["if", [], ["a", ["b", "c"]], [["d", ["e"]], "."]],
      ["if", [], [["a", []], "&&", ["b", []]], [[["c", []], "&&", ["d", []]], "."]],
      ["if", [], ["a", []], [[["b", []], "."]]],
      ["if", [], ["a", []], [[["b", []], "."], [["c", []], "."]]],
      ["if", [], ["a", []], [[["b", []], "."]], [[["c", []], "."]]],
      ["if", ["a"], ["foo", ["a"]], [[["bar", ["a"]], "."]]],
      ["if", ["a", "b"], ["foo", ["a"]], [[["bar", ["a", "b"]], "."]]],
    ]]);
  });

  it("either", function() {
    const results = new Parser().parse(`
      either a() or b().

      either {
        a().
      } or {
        b().
      }
    `);
    assertThat(results).equalsTo([[
      ["either", ["a", []], [["b", []], "."]],
      ["either", [[["a", []], "."]], [[["b", []], "."]]],
    ]]);
  });

  it("not", function() {
    const results = new Parser().parse(`
      not a().
      not {
        a().
        b().
      }
    `);
    assertThat(results).equalsTo([[
      ["not", [["a", []], "."]],
      ["not", [[["a", []], "."], [["b", []], "."]]],
    ]]);
  });

  it("comments", function() {
    const results = new Parser().parse(`
      // this is a comment
      if (a())
        b(). // another comment
      // this is another comment
    `);
    assertThat(results).equalsTo([[
      "// this is a comment",
      ["if", [], ["a", []], [["b", []], "."]],
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
      do () {
        hello().
      } ?
    `);
    assertThat(results).equalsTo([[
      ["!", ["hello", []]],
      ["!", [[["hello", []], "."]]],
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

  it("Socrates(u). mortal(u)?", function() {
    const results = new Parser().parse(`
      // most basic logical program
      for (all x: man(x)) mortal(x).
      Socrates(u).
      man(u).
      mortal(u)? 
    `);
    assertThat(results).equalsTo([[
      "// most basic logical program",
      ["all", "x", ["man", ["x"]], [["mortal", ["x"]], "."]],
      [["Socrates", ["u"]], "."],
      [["man", ["u"]], "."],
      ["?", ["mortal", ["u"]]],
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

  it("If a man loves Mary then Smith likes the woman.", function() {
    const results = new Parser().parse(`
      Smith(a).
      Mary(b).
      if (let s0, c, b: man(c) && love(s0, c, b)) {
        woman(d).
        like(s1, a, d).
      }
    `);
    assertThat(results).equalsTo([[
      [["Smith", ["a"]], "."],
      [["Mary", ["b"]], "."],
      ["if", ["s0", "c", "b"], [["man", ["c"]], "&&", ["love", ["s0", "c", "b"]]], [
        [["woman", ["d"]], "."],
        [["like", ["s1", "a", "d"]], "."]
      ]],
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
