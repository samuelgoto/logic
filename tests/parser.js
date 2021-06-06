const assert = require("assert");
const {Parser} = require("../src/parser.js");

describe("Parser", function() {

  it("hello().", function() {
    const results = new Parser().parse(`
      hello().
    `);
    assertThat(results).equalsTo([[
      [["hello", []]],
    ]]);
  });

  it("propositions", function() {
    const results = new Parser().parse(`
      // Simple propositions start with letters.
      a().

      // They can start with capital letters too.
      A().
      b(). 

      // Or mixed characters
      aB(). 

      // - is allowed to between characters
      a-b(). 

      // names can start with _
      __a(). 

      // names can't start with _
      // -a(). 

      // names can't start with @
      // @a(). 
    `);
    assertThat(results).equalsTo([[
      [["a", []]],
      [["A", []]],
      [["b", []]],
      [["aB", []]],
      [["a-b", []]],
      [["__a", []]],
    ]]);
  });

  it("predicates", function() {
    const results = new Parser().parse(`
      // Predicates can have zero arguments.
      a().

      // Or one argument.
      a(b).

      // Or two.
      a(b, c).

      // Or really any arbitrary number of arguments.
      a(b, c, d).

      // The arguments can be constants like strings ...
      a("b").

      // or numbers.
      a(1).

      // or Symbols.
      a(Foo).

      // Or all of them.
      a(b, "b", 1, B).
    `);
    assertThat(results).equalsTo([[
      [["a", []]],
      [["a", ["b"]]],
      [["a", ["b", "c"]]],
      [["a", ["b", "c", "d"]]],
      [["a", ["'b'"]]],
      [["a", [1]]],
      [["a", ["Foo"]]],
      [["a", ["b", "'b'", 1, "B"]]],
    ]]);
  });

  it("a = b.", function() {
    assertThat(new Parser().parse(`
      a = b.
    `)).equalsTo([[
      [["=", ["a", "b"]]],
    ]]);
  });

  it("a > b.", function() {
    assertThat(new Parser().parse(`
      a > b.
    `)).equalsTo([[
      [[">", ["a", "b"]]],
    ]]);
  });

  it("a < b.", function() {
    assertThat(new Parser().parse(`
      a < b.
    `)).equalsTo([[
      [["<", ["a", "b"]]],
    ]]);
  });

  it("a <= b.", function() {
    assertThat(new Parser().parse(`
      a <= b.
    `)).equalsTo([[
      [["<=", ["a", "b"]]],
    ]]);
  });

  it("a >= b.", function() {
    assertThat(new Parser().parse(`
      a >= b.
    `)).equalsTo([[
      [[">=", ["a", "b"]]],
    ]]);
  });

  it("a > __b__.", function() {
    assertThat(new Parser().parse(`
      a > __b__.
    `)).equalsTo([[
      [[">", ["a", "__b__"]]],
    ]]);
  });

  it("a() b().", function() {
    const results = new Parser().parse(`
      a() b().
    `);
    assertThat(results).equalsTo([[
      [["a", []], ["b", []]],
    ]]);
  });

  it("a() and b().", function() {
    const results = new Parser().parse(`
      a() and b().
    `);
    assertThat(results).equalsTo([[
      [[["a", []]], [["b", []]]],
    ]]);
  });

  it("not a() and b().", function() {
    const results = new Parser().parse(`
      not a() and b().
    `);
    assertThat(results).equalsTo([[
      [["not", [["a", []]]], [["b", []]]],
    ]]);
  });

  it("not a() and b().", function() {
    const results = new Parser().parse(`
      a() and not b().
    `);
    assertThat(results).equalsTo([[
      [[["a", []]], ["not", [["b", []]]]],
    ]]);
  });

  it("(a().) and (b().).", function() {
    const results = new Parser().parse(`
      a() and b().
    `);
    assertThat(results).equalsTo([[
      [[["a", []]], [["b", []]]],
    ]]);
  });

  it("for (let every x: b(x)) a(x).", () => {
    assertThat(new Parser().parse(`
      // Basic quantifiers take a head and a tail.
      for (let every x: b(x)) 
        a(x).
    `)).equalsTo([[
      ["every", "x", [
        [["b", ["x"]]]
      ], [
        [["a", ["x"]]]
      ]],
    ]]);
  });

  it("for (let every x: b(x)) for (let every y: b(y)) a(x, y).", () => {
    assertThat(new Parser().parse(`
      // You can nest quantifiers.
      for (let every x: b(x)) 
        for (let every y: b(y))
          a(x, y).
    `)).equalsTo([[
      ["every", "x", [
        [["b", ["x"]]]
      ], [
        ["every", "y", [
          [["b", ["y"]]]
        ], [
          [["a", ["x", "y"]]]
        ]]]],
    ]]);
  });

  it("for (let every x: b(x)) a(x, c).", () => {
    assertThat(new Parser().parse(`
      // Quantifiers take in the body an arbitrary predicate.
      for (let every x: b(x)) 
        a(x, c).
    `)).equalsTo([[
      ["every", "x", [
        [["b", ["x"]]]
      ], [
        [["a", ["x", "c"]]]
      ]],
    ]]);
  });

  it("for (let most x: b(x)) a(x).", () => {
    assertThat(new Parser().parse(`
      for (let most x: b(x)) 
        a(x).
    `)).equalsTo([[
      ["most", "x", [
        [["b", ["x"]]]
      ], [
        [["a", ["x"]]]
      ]],
    ]]);
  });

  it("for (let few x: b(x)) a(x).", () => {
    assertThat(new Parser().parse(`
      for (let few x: b(x)) 
        a(x).
    `)).equalsTo([[
      ["few", "x", [
        [["b", ["x"]]]
      ], [
        [["a", ["x"]]]
      ]],
    ]]);
  });

  it("for (let only x: b(x)) a(x).", () => {
    assertThat(new Parser().parse(`
      for (let only x: b(x)) 
        a(x).
    `)).equalsTo([[
      ["only", "x", [
        [["b", ["x"]]]
      ], [
        [["a", ["x"]]]
      ]],
    ]]);
  });
  
  it("for (let at-least(3) x: b(x)) a(x).", () => {
    assertThat(new Parser().parse(`
      for (let at-least(3) x: b(x)) 
        a(x).
    `)).equalsTo([[
      ["at-least(3)", "x", [
        [["b", ["x"]]]
      ], [
        [["a", ["x"]]]
      ]],
    ]]);
  });

  it("for (let at-most(3) x: b(x)) a(x).", () => {
    assertThat(new Parser().parse(`
      for (let at-most(3) x: b(x)) 
        a(x).
    `)).equalsTo([[
      ["at-most(3)", "x", [
        [["b", ["x"]]]
      ], [
        [["a", ["x"]]]
      ]],
    ]]);
  });

  it("for (let exactly(3) x: b(x)) a(x).", () => {
    assertThat(new Parser().parse(`
      for (let exactly(3) x: b(x)) 
        a(x).
    `)).equalsTo([[
      ["exactly(3)", "x", [
        [["b", ["x"]]]
      ], [
        [["a", ["x"]]]
      ]],
    ]]);
  });

  it("for (let every x: a(x) b(x)) {c(x). d(x).}", () => {
    assertThat(new Parser().parse(`
      for (let every x: a(x) b(x)) {
        c(x).
        d(x).
      }
    `)).equalsTo([[
      ["every", "x", [
        [["a", ["x"]], ["b", ["x"]]]
      ], [
        [["c", ["x"]]],
        [["d", ["x"]]]
      ]], 
    ]]);
  });

  it("for (let every x: {a(x). b(x).}) { c(x). d(x).}", () => {
    assertThat(new Parser().parse(`
      for (let every x: {
        a(x).
        b(x).
      }) { 
        c(x).
        d(x).
      }
    `)).equalsTo([[
      ["every", "x", [
        [["a", ["x"]]],
        [["b", ["x"]]]
      ], [
        [["c", ["x"]]],
        [["d", ["x"]]]
      ]]
    ]]);
  });

  it("if (a()) b().", () => {
    assertThat(new Parser().parse(`
      if (a())
        b(). 
    `)).equalsTo([[
      ["if", [], [
        [["a", []]]
      ], [
        [["b", []]]
      ]],
    ]]);
  });

  it("if (a() b()) c().", () => {
    assertThat(new Parser().parse(`
      if (a() b())
        c(). 
    `)).equalsTo([[
      ["if", [], [
        [["a", []], ["b", []]]
      ], [
        [["c", []]]
      ]],
    ]]);
  });

  it("if ({a()}) {b().}", () => {
    assertThat(new Parser().parse(`
      if ({
        a().
      }) {
        b(). 
      }
    `)).equalsTo([[
      ["if", [], [
        [["a", []]]
      ], [
        [["b", []]]
      ]],
    ]]);
  });

  it("if (a(b, c)) d(e).", () => {
    assertThat(new Parser().parse(`
      if (a(b, c))
        d(e).
    `)).equalsTo([[
      ["if", [], [
        [["a", ["b", "c"]]]
      ], [
        [["d", ["e"]]]
      ]],
    ]]);
  });

  it("if (a() b()) c() d().", () => {
    assertThat(new Parser().parse(`
      if (a() b())
        c() d(). 
      
    `)).equalsTo([[
      ["if", [], [
        [["a", []], ["b", []]]
      ], [
        [["c", []], ["d", []]]
      ]],
    ]]);
  });

  it("if (a()) { b(). }", () => {
    assertThat(new Parser().parse(`
      if (a()) {
        b(). 
      }
    `)).equalsTo([[
      ["if", [], [
        [["a", []]]
      ], [
        [["b", []]]
      ]],
    ]]);
  });

  it("if (a()) { b(). c(). }", () => {
    assertThat(new Parser().parse(`
      if (a()) {
        b(). 
        c(). 
      }
    `)).equalsTo([[
      ["if", [], [
        [["a", []]]
      ], [
        [["b", []]],
        [["c", []]]
      ]],
    ]]);
  });

  it("if (a()) { b(). } else { c(). }", () => {
    assertThat(new Parser().parse(`
      if (a()) {
        b(). 
      } else {
        c().
      }
    `)).equalsTo([[
      ["if", [], [
        [["a", []]]
      ], [
        [["b", []]]
      ], [
        [["c", []]]
      ]],
    ]]);
  });

  it("if (a()) b(). else c().", () => {
    assertThat(new Parser().parse(`
      if (a())
        b(). 
      else
        c().
    `)).equalsTo([[
      ["if", [], [
        [["a", []]]
      ], [
        [["b", []]]
      ], [
        [["c", []]]
      ]],
    ]]);
  });

  it("if (let a: foo(a)) { bar(a). }", () => {
    assertThat(new Parser().parse(`
      if (let a: foo(a)) {
        bar(a).
      }
    `)).equalsTo([[
      ["if", ["a"], [
        [["foo", ["a"]]]
      ], [
        [["bar", ["a"]]]
      ]],
    ]]);
  });

  it("if (let a, b: foo(a, b)) { bar(b). }", () => {
    assertThat(new Parser().parse(`
      if (let a, b: foo(a, b)) {
        bar(b).
      }
    `)).equalsTo([[
      ["if", ["a", "b"], [
        [["foo", ["a", "b"]]]
      ], [
        [["bar", ["b"]]]
      ]],
    ]]);
  });

  it("either (a()) or b().", () => {
    assertThat(new Parser().parse(`
      either (a()) or b().
    `)).equalsTo([[
      ["either", [], [
        ["a", []]
      ], [
        ["b", []]
      ]],
    ]]);
  });

  it("either (a()) or (b().).", () => {
    assertThat(new Parser().parse(`
      either (a()) or (
        b().
      ).
    `)).equalsTo([[
      ["either", [], [
        ["a", []]
      ], [
        [["b", []]]
      ]],
    ]]);
  });

  it("either (a().) or (b().).", () => {
    assertThat(new Parser().parse(`
      either (
        a().
      ) or (
        b(). 
      ).
    `)).equalsTo([[
      ["either", [], [
        [["a", []]]
      ], [
        [["b", []]]
      ]],
    ]]);
  });

  it.skip("either (let u: a(u)) or { b(). }", () => {
    assertThat(new Parser().parse(`
      either (let u: a(u)) or { 
        b(). 
      }
    `)).equalsTo([[
      ["either", ["u"], [
        [["a", ["u"]]]
      ], [
        [["b", []]]
      ]],
    ]]);
  });

  it("not a().", function() {
    const results = new Parser().parse(`
      not a().
    `);
    assertThat(results).equalsTo([[
      ["not", [["a", []]]],
    ]]);
  });

  it("not (a() b()).", function() {
    const results = new Parser().parse(`
      not (a() b()).
    `);
    assertThat(results).equalsTo([[
      ["not", [["a", []], ["b", []]]],
    ]]);
  });

  it("not a() b().", function() {
    const results = new Parser().parse(`
      not a() b().
    `);
    assertThat(results).equalsTo([[
      ["not", [["a", []], ["b", []]]],
    ]]);
  });

  it("not a()?", function() {
    const results = new Parser().parse(`
      not a()?
    `);
    assertThat(results).equalsTo([[
      ["?", [], [["not", [["a", []]]]]],
    ]]);
  });

  it("(a().).", function() {
    assertThat(new Parser("statement").parse(`(a().).`))
      .equalsTo([
        [[["a", []]]]
      ]);
  });

  it("not a()", function() {
    assertThat(new Parser("expression").parse(`not a()`))
      .equalsTo([
        ["not", [["a", []]]]
      ]);
    assertThat(new Parser("expression").parse(`not not a()`))
      .equalsTo([
        ["not", ["not", [["a", []]]]]
      ]);
    assertThat(new Parser("expression").parse(`(a())`))
      .equalsTo([
        [["a", []]]
      ]);
    assertThat(new Parser("expression").parse(`((a()))`))
      .equalsTo([
        [["a", []]]
      ]);
    assertThat(new Parser("expression").parse(`(a() b())`))
      .equalsTo([
        [["a", []], ["b", []]]
      ]);
    assertThat(new Parser("expression").parse(`(a(). (b()).)`))
      .equalsTo([
        [[["a", []]], [["b", []]]]
      ]);
    assertThat(new Parser("expression").parse(`(a(). not b().)`))
      .equalsTo([
        [[["a", []]], ["not", [["b", []]]]]
      ]);
  });

  it("// comments", function() {
    const results = new Parser().parse(`
      // this is a comment
      if (a())
        b(). // another comment
      // this is another comment
    `);
    assertThat(results).equalsTo([[
      // "// this is a comment",
      ["if", [], [[["a", []]]], [[["b", []]]]],
      // "// another comment",
      // "// this is another comment",
    ]]);
  });
  
  it("hello()?", function() {
    const results = new Parser().parse(`
      hello()?
    `);
    assertThat(results).equalsTo([[
      ["?", [], [[["hello", []]]]],
    ]]);
  });

  it("let x: a(x)?", function() {
    const results = new Parser().parse(`
      let x: a(x)?
    `);
    assertThat(results).equalsTo([[
      ["?", ["x"], [[["a", ["x"]]]]],
    ]]);
  });

  it("hello() world()?", function() {
    const results = new Parser().parse(`
      hello() world()?
    `);
    assertThat(results).equalsTo([[
      ["?", [], [[["hello", []], ["world", []]]]],
    ]]);
  });

  it("hello()!", function() {
    const results = new Parser().parse(`
      hello()!
    `);
    assertThat(results).equalsTo([[
      ["!", [["hello", []]]],
    ]]);
  });

  it("hello() world()!", function() {
    const results = new Parser().parse(`
      hello() world()!
    `);
    assertThat(results).equalsTo([[
      ["!", [["hello", []], ["world", []]]],
    ]]);
  });

  it("print('hello world')!", function() {
    const results = new Parser().parse(`
      // prints hello world
      print("hello world")!
    `);
    assertThat(results).equalsTo([[
      // "// prints hello world",
      ["!", [["print", ["'hello world'"]]]],
    ]]);
  });

  it("Socrates(u). mortal(u)?", function() {
    const results = new Parser().parse(`
      // most basic logical program
      for (let all x: man(x)) mortal(x).
      Socrates(u).
      man(u).
      mortal(u)? 
    `);
    assertThat(results).equalsTo([[
      // "// most basic logical program",
      ["all", "x", [[["man", ["x"]]]], [[["mortal", ["x"]]]]],
      [["Socrates", ["u"]]],
      [["man", ["u"]]],
      ["?", [], [[["mortal", ["u"]]]]],
    ]]);
  });
  
  it("A man admires a woman.", function() {
    const results = new Parser().parse(`
      man(a).
      woman(b).
      admires(s0, a, b).
    `);
    assertThat(results).equalsTo([[
      [["man", ["a"]]],
      [["woman", ["b"]]],
      [["admires", ["s0", "a", "b"]]],
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
      [["man", ["a"]]],
      [["Mary", ["b"]]],
      [["Smith", ["c"]]],
      [["love", ["s0", "a", "b"]]],
      [["fascinate", ["s1", "a", "c"]]],
    ]]);
  });

  it("Jones does not own a porsche.", function() {
    const results = new Parser().parse(`
      Jones(a).
      not porsche(b) own(s0, a, b).
    `);
    assertThat(results).equalsTo([[
      [["Jones", ["a"]]],
      ["not", 
        [["porsche", ["b"]], ["own", ["s0", "a", "b"]]],
      ]]]);
  });

  it("Jones does not own a porsche which does not fascinate him.", function() {
    const results = new Parser().parse(`
      Jones(a).
      not (
        porsche(b). 
        own(s0, a, b).
        not fascinate(s1, b, a).
      ).
    `);
    assertThat(results).equalsTo([[
      [["Jones", ["a"]]],
      ["not", [
        [["porsche", ["b"]]],
        [["own", ["s0", "a", "b"]]],
        ["not", [["fascinate", ["s1", "b", "a"]]]]
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
      [["Jones", ["a"]]],
      [["man", ["a"]]],
      [["happy-man", ["a"]]],
    ]]);
  });

  it("If a man loves Mary then Smith likes the woman.", function() {
    const results = new Parser().parse(`
      Smith(a).
      Mary(b).
      if (let s0, c, b: man(c) love(s0, c, b)) {
        woman(d).
        like(s1, a, d).
      }
    `);
    assertThat(results).equalsTo([[
      [["Smith", ["a"]]],
      [["Mary", ["b"]]],
      ["if", ["s0", "c", "b"], [
        [["man", ["c"]], ["love", ["s0", "c", "b"]]]
      ], [
        [["woman", ["d"]]],
        [["like", ["s1", "a", "d"]]]
      ]],
    ]]);
  });
  
  it("Jones loves every man.", function() {
    const results = new Parser().parse(`
      Jones(a).
      for (let every b: man(b)) {
        love(s0, a, b).
      }
      love(s, a, u)?
    `);
    assertThat(results).equalsTo([[
      [["Jones", ["a"]]],
      ["every", "b", [[["man", ["b"]]]], [[["love", ["s0", "a", "b"]]]]],
      ["?", [], [[["love", ["s", "a", "u"]]]]],
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
