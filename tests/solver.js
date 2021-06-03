const Assert = require("assert");
const {Parser} = require("../src/parser.js");
const {KB, unify, bind, load, preprocess, equals, apply, clone} = require("../src/solver.js");

describe("REPL", function() {
  it("P(a). => P(a).", () => {
    assertThat(preprocess(new Parser().parse(`
      P(a).
    `))).equalsTo([
      ["P", ["a"]],
    ]);
  });

  it("P(a) Q(b). => P(a). Q(b).", () => {
    assertThat(preprocess(new Parser().parse(`
      P(a) Q(b).
    `))).equalsTo([
      ["P", ["a"]],
      ["Q", ["b"]],
    ]);
  });
  
  it("P(a). Q(b). => P(a). Q(b).", () => {
    assertThat(preprocess(new Parser().parse(`
      P(a).
      Q(b).
    `))).equalsTo([
      ["P", ["a"]],
      ["Q", ["b"]],
    ]);
  });

  it("if (P(a)) Q(b). => if (P(a)) Q(b).", () => {
    assertThat(preprocess(new Parser().parse(`
      if (P(a)) {
        Q(b).
      }
    `))).equalsTo([
      ["Q", ["b"], {}, [["P", ["a"]]]] 
    ]);
  });

  it("if (P(a) Q(a)) R(a). => if (P(a) Q(a)) R(a).", () => {
    assertThat(preprocess(new Parser().parse(`
      if (P(a) Q(a)) {
        R(a).
      }
    `))).equalsTo([
      ["R", ["a"], {}, [["P", ["a"]], ["Q", ["a"]]]]
    ]);
  });

  it("if (P(a)) Q(a) R(a). => Q(a) if (P(a)). R(a) if (P(a))", () => {
    assertThat(preprocess(new Parser().parse(`
      if (P(a)) {
        Q(a) R(a).
      }
    `))).equalsTo([
      ["Q", ["a"], {}, [["P", ["a"]]]],
      ["R", ["a"], {}, [["P", ["a"]]]]
    ]);
  });

  it("if (P() Q()) {R(). S().} => if (P() Q()) R(). if (P() Q()) S(). ", () => {
    assertThat(preprocess(new Parser().parse(`
      if (P() Q()) {
        R().
        S().
      }
    `))).equalsTo([
      ["R", [], {}, [["P", []], ["Q", []]]],
      ["S", [], {}, [["P", []], ["Q", []]]],
    ]);
  });

  it("if (P()) { if (Q()) R(). } => if (Q() P()) R().", () => {
    assertThat(preprocess(new Parser().parse(`
      if (P()) {
        if (Q()) {
          R().
        }
      }
    `))).equalsTo([
      ["R", [], {}, [["Q", []], ["P", []]]],
    ]);
  });

  it("if (P()) { if (Q()) if (R()) {S()}. } => if (R() Q() P()) S().", () => {
    assertThat(preprocess(new Parser().parse(`
      if (P()) {
        if (Q()) {
          if (R()) {
            S().
          }
        }
      }
    `))).equalsTo([
      ["S", [], {}, [["R", []], ["Q", []], ["P", []]]],
    ]);
  });

  it("for (let every a: P(a)) Q(a). => let every a: Q(a) if (P(a)).", () => {
    assertThat(preprocess(new Parser().parse(`
      for (let every a: P(a))
        Q(a). 
    `))).equalsTo([
      ["Q", ["a"], {"a": "every"}, [["P", ["a"]]]],
    ]);
  });

  it("for (let every a: P(a)) { for (let every b: Q(b)) R(a, b).} => let every a, b: R(a, b) if (P(a) Q(b)).", () => {
    assertThat(preprocess(new Parser().parse(`
      for (let every a: P(a)) {
        for (let every b: Q(b))
          R(a, b). 
      }
    `))).equalsTo([
      ["R", ["a", "b"], {"a": "every", "b": "every"}, [["Q", ["b"]], ["P", ["a"]]]],
    ]);
  });

  function print(statements) {
    const result = [];
    for (let [name, args, letty, iffy] of statements) {
      const line = [];
      if (Object.keys(letty || {}).length > 0) {
        line.push("let ");
        line.push(Object.entries(letty).map(([name, quantifier]) => `${quantifier} ${name}`).join(", "));
        line.push(": ");
      }
      line.push(`${name}(${args.join(", ")})`);
      if (iffy) {
        line.push(" ");
        line.push("if (");
        line.push(iffy.map(([name, args]) => `${name}(${args.join(", ")})`).join(" "));
        line.push(")");
      }
      line.push(`.`);
      result.push(line.join(""));
    }
    return result.join("\n");
  }

  function trim(code) {
    return code.split("\n").map(x => x.trim()).join("\n").trim();
  }
  
  it("unrollling", () => {
    assertThat(trim(print(preprocess(new Parser().parse(`
      P(a).
      P(b) Q(b).

      if (P(c)) Q(c).
      if (P(d) Q(d)) R(d).
      if (P(e)) Q(e) R(e).

      if (P(f)) {
        if (Q(f)) {
          R(f).
        }
      }

      for (let every a: P(a)) Q(a).
      for (let every a: P(a) Q(a)) R(a).
      for (let every a: P(a)) {
        S(a) T(a).
      }
      for (let every a: P(a)) {
        U(a).
        V(a).
      }
      if (T(d)) {
        for (let every a: P(a)) {
          for (let every b: Q(b)) {
            if (R(c))
              S(a, b).
          }
        }
      }
    `))))).equalsTo(trim(`
      P(a).
      P(b).
      Q(b).
      Q(c) if (P(c)).
      R(d) if (P(d) Q(d)).
      Q(e) if (P(e)).
      R(e) if (P(e)).
      R(f) if (Q(f) P(f)).
      let every a: Q(a) if (P(a)).
      let every a: R(a) if (P(a) Q(a)).
      let every a: S(a) if (P(a)).
      let every a: T(a) if (P(a)).
      let every a: U(a) if (P(a)).
      let every a: V(a) if (P(a)).
      let every a, every b: S(a, b) if (R(c) Q(b) P(a) T(d)).
    `));
  });
  
  it("P(a)? => P(a)?", () => {
    assertThat(preprocess(new Parser().parse(`
      P(a)?
    `))).equalsTo([
      ["?", [], [["P", ["a"]]]],
    ]);
  });

  it("Q(a) P(b)? => Q(a) P(b)?", () => {
    assertThat(preprocess(new Parser().parse(`
      Q(a) P(b)?
    `))).equalsTo([
      ["?", [], [["Q", ["a"]], ["P", ["b"]]]],
    ]);
  });

  it("{ Q(a). P(b). }? => Q(a) P(b)?", () => {
    assertThat(preprocess(new Parser().parse(`
      {
        Q(a). 
        P(b).
      } ?
    `))).equalsTo([
      ["?", [], [["Q", ["a"]], ["P", ["b"]]]],
    ]);
  });

  it("let x: P(x)? => let x: P(x)?", () => {
    assertThat(preprocess(new Parser().parse(`
      let x: P(x)?
    `))).equalsTo([
      ["?", ["x"], [["P", ["x"]]]],
    ]);
  });

  function parse(code) {
    return preprocess(new Parser().parse(code));
  }

  function first(code) {
    return parse(code)[0];
  }

  function unroll(gen) {
    const result = [];
    for (let entry of gen) {
      result.push(entry);
    }
    return result;
  }
  
  it("P(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
    `)).query(["P", []]))).equalsTo([{}]);
  });

  it("P(). Q()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
    `)).query(["Q", []]))).equalsTo([]);
  });

  it("P(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
    `)).query(["P", ["x"], {"x": "some"}])))
      .equalsTo([{x: "a"}]);
  });

  it("P(a). P(b). let x: P(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      P(b).
    `)).query(["P", ["x"], {"x": "some"}])))
      .equalsTo([{x: "a"}, {x: "b"}]);
  });

  it("P(a, b). P(c, d). let x, y: P(x, y)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a, b).
      P(c, d).
    `)).query(["P", ["x", "y"], {"x": "some", "y": "some"}])))
      .equalsTo([{x: "a", y: "b"}, {x: "c", y: "d"}]);
  });

  it("P(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("P(). Q()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
    `)).select(first(`
      Q()?
    `)))).equalsTo([]);
  });
  
  it("P() Q(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P() Q().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("P() Q(). Q()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P() Q().
    `)).select(first(`
      Q()?
    `)))).equalsTo([{}]);
  });

  it("P() Q() R(). R()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P() Q() R().
    `)).select(first(`
      R()?
    `)))).equalsTo([{}]);
  });

  it("P() Q() R(). R()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P() Q() R().
    `)).select(first(`
      P() R()?
    `)))).equalsTo([{}]);
  });

  it("P() Q() R(). R()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P() Q() R().
    `)).select(first(`
      {
        P().
        R().
      } ?
    `)))).equalsTo([{}]);
  });

  it("P() => P()", () => {
    assertThat(load(new Parser().parse(`
      P().
      P() Q().
      P(a) Q(b).
      P(a, b) Q(c, d).
    `))).equalsTo([
      [["P", []]],
      [["P", []], ["Q", []]],
      [["P", ["a"]], ["Q", ["b"]]],
      [["P", ["a", "b"]], ["Q", ["c", "d"]]],
    ]);
  });
  
  it("if (P()) Q(). Q()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      if (P()) 
        Q().
    `)).select(first(`
      Q()?
    `)))).equalsTo([]);
  });

  it("P(). if (P()) Q(). Q()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
      if (P()) 
        Q().
    `)).select(first(`
      Q()?
    `)))).equalsTo([{}]);
  });

  it("P(). if (P() Q()) R(). R()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
      if (P() Q()) 
        R().
    `)).select(first(`
      R()?
    `)))).equalsTo([]);
  });

  it("P(). Q(). if (P() Q()) R(). R()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
      Q().
      if (P() Q()) 
        R().
    `)).select(first(`
      R()?
    `)))).equalsTo([{}]);
  });

  it("P(). if (P()) Q() R(). R()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
      if (P()) 
        Q() R().
    `)).select(first(`
      R()?
    `)))).equalsTo([{}]);
  });

  it("P(). if (P()) {Q(). R().} R()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
      if (P()) {
        Q(). 
        R().
      }
    `)).select(first(`
      R()?
    `)))).equalsTo([{}]);
  });

  it("P(a). if (P(a)) Q(b). Q(b)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      if (P(a))
        Q(b). 
    `)).select(first(`
      Q(b)?
    `)))).equalsTo([{}]);
  });

  it("if (P()) Q(). if (Q()) R(). P(). R()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      if (P()) 
        Q().
      if (Q()) 
        R().
      P().
    `)).select(first(`
      R()?
    `)))).equalsTo([{}]);
  });

  it("for (let every a: P(a)) Q(a). P(u). Q(u)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every a: P(a)) {
        Q(a).
      }
      P(u).
    `)).select(first(`
      Q(u)?
    `)))).equalsTo([{}]);
  });

  it("for (let every a: P(a)) Q(a). P(u). Q(v)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every a: P(a)) {
        Q(a).
      }
      P(u).
    `)).select(first(`
      Q(v)?
    `)))).equalsTo([]);
  });

  it("for (let every a: P(a)) Q(a) R(a). P(u). R(u)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every a: P(a)) {
        Q(a) R(a).
      }
      P(u).
    `)).select(first(`
      R(u)?
    `)))).equalsTo([{}]);
  });

  it("for (let every a: P(a)) Q(a). for (let every a: Q(a)) R(a). P(u). R(u)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every a: P(a)) {
        Q(a).
      }
      for (let every a: Q(a)) {
        R(a).
      }
      P(u).
    `)).select(first(`
      R(u)?
    `)))).equalsTo([{}]);
  });

  it("for (let every a: P(a)) { for (let every b: Q(b)) R(a, b) }. P(u). Q(v). R(u, v)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every a: P(a)) {
        for (let every b: Q(b)) {
          R(a, b).
        }
      }
      P(u) Q(v).
    `)).select(first(`
      R(u, v)?
    `)))).equalsTo([{}]);
  });

  it("P(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
    `)).query(["P", ["x"], {x: "some"}])))
      .equalsTo([{"x": "a"}]);
  });

  it("P(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
    `)).select(first(`
      let x: P(x)?
    `))))
      .equalsTo([{"x": "a"}]);
  });

  it("P(a). let x: Q(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
    `)).select(first(`
      let x: Q(x)?
    `))))
      .equalsTo([]);
  });

  it("P(a, b). let x: P(x, b)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a, b).
    `)).select(first(`
      let x: P(x, b)?
    `))))
      .equalsTo([{"x": "a"}]);
  });

  it("P(a, b). let x: P(a, x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a, b).
    `)).select(first(`
      let x: P(a, x)?
    `))))
      .equalsTo([{"x": "b"}]);
  });

  it("P(a). P(b). let x: P(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      P(b).
    `)).select(first(`
      let x: P(x)?
    `)))).equalsTo([{"x": "a"}, {"x": "b"}]);
  });

  it("P(a). Q(a). let x: P(x) Q(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      Q(a).
    `)).select(first(`
      let x: P(x) Q(x)?
    `))))
      .equalsTo([{"x": "a"}]);
  });
  
  it("P(a). Q(a). R(b). let x: P(x) Q(x) R(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      Q(a).
      R(b).
    `)).select(first(`
      let x: P(x) Q(x) R(x)?
    `))))
      .equalsTo([]);
  });
  
  it("P(a). Q(a). R(a). let x: P(x) Q(x) R(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      Q(a).
      R(a).
    `)).select(first(`
      let x: P(x) Q(x) R(x)?
    `))))
      .equalsTo([{x: "a"}]);
  });
  
  it("P(a). Q(b). let x: P(x) Q(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      Q(b).
    `)).select(first(`
      let x: P(x) Q(x)?
    `))))
      .equalsTo([]);
  });
  
  it("P(a) Q(b). let x: P(x) Q(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a) Q(b).
    `)).select(first(`
      let x: P(x) Q(x)?
    `))))
      .equalsTo([]);
  });

  it("P(a, b). let x, y: P(x, y)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a, b).
    `)).select(first(`
      let x, y: P(x, y)?
    `))))
      .equalsTo([{"x": "a", "y": "b"}]);
  });

  it("P(a). Q(b). let x, y: P(x) Q(y)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      Q(b).
    `)).select(first(`
      let x, y: P(x) Q(y)?
    `))))
      .equalsTo([{"x": "a", "y": "b"}]);
  });

  it("equals(let x: Q(x), for (let every y: P(y)) Q(y))", () => {
    const body = [["P", ["y"]]];
    const matches = equals(
      ["Q", ["x"], {x: "some"}, []],
      ["Q", ["y"], {y: "every"}, body]);
    assertThat(matches)
      .equalsTo({y: "x"});
    apply(body, matches);
    assertThat(body)
      .equalsTo([["P", ["x"]]]);

  });
  
  it("for (let every x: P(x)) Q(x). P(a). let x: Q(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) Q(x). 
      P(a).
    `)).select(first(`
      let x: Q(x)?
    `)))).equalsTo([{"x": "a"}]);
  });

  it("for (let every x: P(x) Q(x)) R(x). P(a). Q(a). let x: R(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x) Q(x)) R(x). 
      P(a).
      Q(a).
    `)).select(first(`
      let x: R(x)?
    `))))
      .equalsTo([{"x": "a"}]);
  });

  it("for (let every x: P(x)) Q(x). for (let every x: Q(x)) R(x). P(a). let x: R(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) Q(x). 
      for (let every x: Q(x)) R(x). 
      P(a).
    `)).select(first(`
      let x: R(x)?
    `))))
      .equalsTo([{"x": "a"}]);
  });

  it("for (let every x: P(x)) Q(x). for (let every x: Q(x)) R(x). P(a). let x: R(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) Q(x). 
      for (let every x: Q(x)) R(x). 
      P(a).
      P(b).
    `)).select(first(`
      let x: R(x)?
    `))))
      .equalsTo([{"x": "a"}, {"x": "b"}]);
  });

  it("for (let every x: P(x)) Q(x). for (let every x: R(x)) S(x). P(a). R(a). let x: Q(x) S(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) Q(x). 
      for (let every x: R(x)) S(x). 
      P(a).
      R(a).
      P(b).
      R(c).
      Q(d) S(d).
      Q(e).
      S(f).
      S(g) Q(g).
    `)).select(first(`
      let x: Q(x) S(x)?
    `))))
      .equalsTo([{"x": "a"}, {"x": "d"}, {"x": "g"}]);
  });

  it("for (let every a: P(a)) Q(a). => for (every a: P(@a)) Q(@a)", () => {
    assertThat(load(new Parser().parse(`
      for (let every a: P(a)) 
        Q(a).
    `))).equalsTo([
      ["every", "a", [[["P", ["@a"]]]], [[["Q", ["@a"]]]]]
    ]);
  });
  
  it("for (let every a: P(a, b)) Q(a, c). => for (every a: P(@a, b)) Q(@a, c)", () => {
    assertThat(load(new Parser().parse(`
      for (let every a: P(a, b)) 
        Q(a, c).
    `))).equalsTo([
      ["every", "a", [[["P", ["@a", "b"]]]], [[["Q", ["@a", "c"]]]]]
    ]);
  });
  
  it("for (let every a: P(a) Q(a)) R(a). => for (every a: P(@a) Q(@a)) R(@a)", () => {
    assertThat(load(new Parser().parse(`
      for (let every a: P(a) Q(a)) 
        R(a).
    `))).equalsTo([
      ["every", "a", [[["P", ["@a"]], ["Q", ["@a"]]]], [[["R", ["@a"]]]]]
    ]);
  });
  
  it("for (let every a: {P(a). Q(a).}) R(a). => for (every a: {P(@a). Q(@a).}) R(@a)", () => {
    assertThat(load(new Parser().parse(`
      for (let every a: {
        P(a). 
        Q(a).
      }) {
        R(a).
      }
    `))).equalsTo([
      ["every", "a", [[["P", ["@a"]]], [["Q", ["@a"]]]], [[["R", ["@a"]]]]]
    ]);
  });
  
  it("let a: P(a)? => let a: P(@a)?", () => {
    assertThat(load(new Parser().parse(`
      let a: P(a)?
    `))).equalsTo([
      ["?", ["a"], [[["P", ["@a"]]]]],
    ]);
  });

  it("P(a). for (every a: P(a)) Q(a). let x: Q(x)?", () => {
    assertThat(load(new Parser().parse(`
      P(a). 
      for (let every a: P(a)) 
        Q(a). 
      let x: Q(x)?
    `))).equalsTo([
      [["P", ["a"]]],
      ["every", "a", [[["P", ["@a"]]]], [[["Q", ["@a"]]]]],
      ["?", ["x"], [[["Q", ["@x"]]]]],
    ]);
  });

  it("P()?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P()?"))).equalsTo([]);
  });
    
  it("P(). P()?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P()."))).equalsTo([]);
    assertThat(unroll(kb.read("P()?"))).equalsTo([{}]);
  });
    
  it("P(). Q()?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P()."))).equalsTo([]);
    assertThat(unroll(kb.read("Q()?"))).equalsTo([]);
  });
    
  it("P(). Q(). P()?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(). Q()."))).equalsTo([]);
    assertThat(unroll(kb.read("P()?"))).equalsTo([{}]);
  });
    
  it("P(). Q(). Q()?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(). Q()."))).equalsTo([]);
    assertThat(unroll(kb.read("Q()?"))).equalsTo([{}]);
  });
  
  it("P(A). P(A)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A)."))).equalsTo([]);
    assertThat(unroll(kb.read("P(A)?"))).equalsTo([{}]);
  });
  
  it("P(A). P(B)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A)."))).equalsTo([]);
    assertThat(unroll(kb.read("P(B)?"))).equalsTo([]);
  });
    
  it("P(A, B). P(A, B)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A, B)."))).equalsTo([]);
    assertThat(unroll(kb.read("P(A, B)?"))).equalsTo([{}]);
  });
  
  it("P(). P()?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P()."))).equalsTo([]);
    assertThat(unroll(kb.read("P()?"))).equalsTo([{}]);
  });
  
  it("P(). Q(). P() Q()?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(). Q()."))).equalsTo([]);
    assertThat(unroll(kb.read("P() Q()?"))).equalsTo([{}]);
  });
  
  it("P(). Q(). P() R()?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(). Q()."))).equalsTo([]);
    assertThat(unroll(kb.read("P() R()?"))).equalsTo([]);
  });
  
  it("P(A). Q(B). P(A) Q(B)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A). Q(B)."))).equalsTo([]);
    assertThat(unroll(kb.read("P(A) Q(B)?"))).equalsTo([{}]);
  });
  
  it("P(A). Q(B). P(A) R(B)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A). Q(B)."))).equalsTo([]);
    assertThat(unroll(kb.read("P(A) R(B)?"))).equalsTo([]);
  });

  it("P(u). P(x)?", function() {
    assertThat(unroll(new KB().read(`
      P(u).
      let x: P(x)?
    `))).equalsTo([{"x": "u"}]);
  });
  
  it("P() + P() = P()", () => {
    assertThat(unify(["P", []], ["P", []])).equalsTo({});
    assertThat(bind(["P", []], {})).equalsTo(["P", []]);
  });

  it("P() + Q() = false", () => {
    assertThat(unify(["P", []], ["Q", []])).equalsTo(false);
  });

  it("P(A) + P() = false", () => {
    assertThat(unify(["P", ["A"]], ["P", []])).equalsTo(false);
  });

  it("P() + P(A) = false", () => {
    assertThat(unify(["P", []], ["P", ["A"]])).equalsTo(false);
  });

  it("P(A) + P(A) = {}", () => {
    assertThat(unify(["P", ["A"]], ["P", ["A"]])).equalsTo({});
    assertThat(bind(["P", ["A"]], {})).equalsTo(["P", ["A"]]);
  });
  
  it("P(A, B) + P(A, B) = {}", () => {
    assertThat(unify(["P", ["A", "B"]], ["P", ["A", "B"]])).equalsTo({});
    assertThat(bind(["P", ["A", "B"]], {})).equalsTo(["P", ["A", "B"]]);
  });
  
  it("P(@a) + P(A) = {}", () => {
    assertThat(unify(["P", ["@a"]], ["P", ["A"]])).equalsTo({"@a": "A"});
    assertThat(bind(["P", ["@a"]], {"@a": "A"})).equalsTo(["P", ["A"]], {"@a": "A"});
  });
  
  it("P(@a) + P(@b) = {}", () => {
    assertThat(unify(["P", ["@a"]], ["P", ["@b"]])).equalsTo({"@a": "@b"});
    assertThat(bind(["P", ["@a"]], {"@a": "@b"})).equalsTo(["P", ["@b"]], {"@a": "@b"});
  });
  
  it("P(A) + P(@a) = {}", () => {
    assertThat(unify(["P", ["A"]], ["P", ["@a"]])).equalsTo({"@a": "A"});
    assertThat(bind(["P", ["A"]], {"@a": "A"})).equalsTo(bind(["P", ["@a"]], {"@a": "A"}));
  });
  
  it("P(A, @b) + P(A, B) = {}", () => {
    assertThat(unify(["P", ["A", "@b"]], ["P", ["A", "B"]])).equalsTo({"@b": "B"});
    assertThat(bind(["P", ["A", "@b"]], {"@b": "B"})).equalsTo(bind(["P", ["A", "B"]], {"@b": "B"}));
  });
  
  it("P(A, B) + P(A, b) = {}", () => {
    assertThat(unify(["P", ["A", "B"]], ["P", ["A", "@b"]])).equalsTo({"@b": "B"});
    assertThat(bind(["P", ["A", "B"]], {"@b": "B"})).equalsTo(bind(["P", ["A", "@b"]], {"@b": "B"}));
  });
  
  it("P(@a, @b) + P(A, B) = {}", () => {
    assertThat(unify(["P", ["@a", "@b"]], ["P", ["A", "B"]])).equalsTo({"@a": "A", "@b": "B"});
    assertThat(bind(["P", ["@a", "@b"]], {"@a": "A", "@b": "B"}))
      .equalsTo(bind(["P", ["A", "B"]], {"@a": "A", "@b": "B"}));
  });
  
  it("P(@a, @a) + P(A, A) = {}", () => {
    assertThat(unify(["P", ["@a", "@a"]], ["P", ["A", "A"]])).equalsTo({"@a": "A"});
    assertThat(bind(["P", ["@a", "@a"]], {"@a": "A"}))
      .equalsTo(bind(["P", ["A", "A"]], {"@a": "A"}));
  });
  
  it("P(@a, @a) + P(A, B) = {}", () => {
    assertThat(unify(["P", ["@a", "@a"]], ["P", ["A", "B"]])).equalsTo(false);
  });

  it("P(A). let a: P(a)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A)."))).equalsTo([]);
    assertThat(unroll(kb.read("let a: P(a)?"))).equalsTo([{"a": "A"}]);
  });

  it("P(A, B). let a, b: P(a, b)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A, B)."))).equalsTo([]);
    assertThat(unroll(kb.read("let a, b: P(a, b)?"))).equalsTo([{"a": "A", "b": "B"}]);
  });

  it("P(A, B). let b: P(A, b)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A, B)."))).equalsTo([]);
    assertThat(unroll(kb.read("let b: P(A, b)?"))).equalsTo([{"b": "B"}]);
  });

  it("P(A). Q(A). let a: P(a) Q(a)?", function() {
    assertThat(unroll(new KB().read(`
      P(A). Q(A).
      let a: P(a) Q(a)?
    `))).equalsTo([{"a": "A"}]);
  });

  it("P(A). Q(A). let a: {P(a). Q(a).} ?", function() {
    assertThat(unroll(new KB().read(`
      P(A). Q(A).
      let a: {
        P(a). 
        Q(a).
      } ?
    `))).equalsTo([{"a": "A"}]);
  });

  it("P(a). Q(a). let b: P(b) Q(b)?", function() {
    assertThat(unroll(new KB().read(`
      P(a). Q(a).
      let b: P(b) Q(b)?
    `))).equalsTo([{"b": "a"}]);
  });

  it("P(a). Q(c). P(b) Q(b)?", function() {
    assertThat(unroll(new KB().read(`
      P(a). Q(c).
      P(b) Q(b)?
    `))).equalsTo([]);
  });

  it("P(A). let a: P(a) Q(a)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A)."))).equalsTo([]);
    assertThat(unroll(kb.read("let a: P(a) Q(a)?"))).equalsTo([]);
  });

  it("P(A). Q(B). let a: P(a) Q(a)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A). Q(B)."))).equalsTo([]);
    assertThat(unroll(kb.read("let a: P(a) Q(a)?"))).equalsTo([]);
  });

  it("P(A). Q(B). let a, b: P(a) Q(b)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A). Q(B)."))).equalsTo([]);
    assertThat(unroll(kb.read("let a, b: P(a) Q(b)?"))).equalsTo([{"a": "A", "b": "B"}]);
  });

  it("Sam(u) Dani(v) loves(u, v). let a, b: Sam(a) Dani(b) loves(a, b)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      // There is a u named Sam and a v named Dani. u loves v.
      Sam(u) Dani(v) loves(u, v).

      // Is there an "a" Sam who loves a "b" named Dani?
      let a, b: Sam(a) Dani(b) loves(a, b)?
    `))).equalsTo([{"a": "u", "b": "v"}]);
  });

  it("Sam(u) Dani(v) loves(u, v). let a, b: Sam(a) loves(a, b) ?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      Sam(u) Dani(v) loves(u, v). 

      // Who does Sam love?
      let a, b: Sam(a) loves(a, b)?
    `))).equalsTo([{"a": "u", "b": "v"}]);
  });

  it("Sam(u) Dani(v) loves(u, v). let a, b: Sam(a) loves(a, b) ?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      Sam(u) loves(u, v) Dani(v).
      // Who loves Dani?
      let a, b: Dani(b) loves(a, b)?
    `))).equalsTo([{"a": "u", "b": "v"}]);
  });

  it("P(u). for (let every a: P(a)) Q(a). let x: Q(x)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: P(a)) 
        Q(a).
      P(u).
      let x: Q(x)?
    `))).equalsTo([{"x": "u"}]);
  });

  it("for (let every a: P(a)) Q(a). P(u). U(u). U(x) Q(x)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: P(a)) 
        Q(a).

      P(u). 
      U(u).

      let x: U(x) Q(x)?
    `))).equalsTo([{"x": "u"}]);
  });

  it("for (let every a: man(a)) mortal(a). Socrates(u). man(u). Socrates(v) mortal(v)?", function() {
    assertThat(unroll(new KB().read(`
      // Every man is mortal.
      for (let every a: man(a)) 
        mortal(a).

      // There is a man u, whose name is Socrates.
      Socrates(u). 
      man(u).

      // Is there a man u, whose name is Socrates and who is mortal?
      let x: Socrates(x) mortal(x)?
    `))).equalsTo([{"x": "u"}]);
  });

  it("for (let every a: P(a)) Q(a). for (every a: Q(a)) R(a). P(u). R(v)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: P(a)) 
        Q(a).
      for (let every a: Q(a)) 
        R(a).
      P(u).
      let x: R(x)?
    `))).equalsTo([{"x": "u"}]);
  });

  it("for (let every a: P(a)) { Q(a). R(a).} P(u). R(v)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: P(a)) { 
        Q(a). 
        R(a). 
      }

      P(u).

      let x: R(x)?
    `))).equalsTo([{"x": "u"}]);
  });

  it("for (let every a: P(a) Q(a)) R(a). P(u). Q(u). R(v)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: P(a) Q(a)) 
        R(a).

      P(u). R(u).

      let x: R(x)?
    `))).equalsTo([{"x": "u"}]);
  });

  it("for (every a: {P(a). Q(a).}) R(a). P(u). Q(u). R(v)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: {
        P(a). 
        Q(a).
      }) {
        R(a).
      }

      P(u). 
      R(u).

      let x: R(x)?
    `))).equalsTo([{"x": "u"}, {"x": "u"}]);
  });

  it("let x: Socrates(x) animal(x)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: man(a)) 
        human(a).

      for (let every a: human(a)) 
        animal(a).

      man(u).
      Socrates(u).

      let x: Socrates(x) animal(x)?
    `))).equalsTo([{"x": "u"}]);
  });

  it("if (P()) Q(). P(). Q()?", function() {
    assertThat(unroll(new KB().read(`
      if (P()) 
        Q().
      P().
      Q()?
    `))).equalsTo([{}]);
  });

  it("if (P()) Q(). Q()?", function() {
    assertThat(unroll(new KB().read(`
      if (P()) 
        Q().
      Q()?
    `))).equalsTo([]);
  });

  it("if (P() Q()) R(). P(). Q(). R()?", function() {
    assertThat(unroll(new KB().read(`
      if (P() Q()) 
        R().
      P(). Q().
      R()?
    `))).equalsTo([{}]);
  });

  it("if (P(a)) Q(c). P(a). let x: Q(x)?", function() {
    assertThat(unroll(new KB().read(`
      if (P(a)) 
        Q(c).
      P(a).
      let x: Q(x)?
    `))).equalsTo([{x: "c"}]);
  });

  it("if (P(a) Q(b)) R(c). P(a). Q(b). let x: R(x)?", function() {
    assertThat(unroll(new KB().read(`
      if (P(a) Q(b)) 
        R(c).
      P(a). Q(b).
      let x: R(x)?
    `))).equalsTo([{x: "c"}]);
  });

  it("if (P(a) Q(b)) R(c). P(a). Q(b). let x: R(x)?", function() {
    assertThat(unroll(new KB().read(`
      Jones(u).
      Mary(v).

      // If Jones loves Mary, Jones marries her.
      if (loves(u, v)) 
        marry(u, v).

      // Jones loves Mary.
      loves(u, v).

      // Who does Jones marry?
      let x, y: Jones(x) marry(x, y)?
    `))).equalsTo([{x: "u", y: "v"}]);
  });

  it("let x: Socrates(x) mortal(x)?", function() {
    assertThat(unroll(new KB().read(`
      // Every greek man is mortal
      for (let every a: greek(a) man(a))
        mortal(a).

      // Socrate is a greek man
      Socrates(u).
      greek(u).
      man(u).
 
      // Is Socrates mortal?
      let x: Socrates(x) mortal(x)?
    `))).equalsTo([{"x": "u"}]);
  });

  it("let x: Socrates(x) good-influence(x)?", function() {
    assertThat(unroll(new KB().read(`
      // Every greek philosopher is a good-influence.
      for (let every a: greek(a) philosopher(a)) {
        influence(a).
        good-influence(a).
      }

      // Socrate is a greek man
      Socrates(u).
      greek(u).
      philosopher(u).
 
      // Is Socrates a good influence?
      let x: Socrates(x) good-influence(x)?
    `))).equalsTo([{"x": "u"}]);
  });

  it("let x, y: Sam(x) Leo(y) parent(x, y)?", function() {
    assertThat(unroll(new KB().read(`
      Sam(u).
      Leo(v).
      man(u).
      parent(u, v).
 
      // Is there a Sam who is a parent of a Leo?
      let x, y: Sam(x) Leo(y) parent(x, y)?
    `))).equalsTo([{"x": "u", "y": "v"}]);
  });

  it("let x, y: R(x, y)?", function() {
    assertThat(unroll(new KB().read(`
      // Nested quantifiers
      for (let every a: P(a)) {
        for (let every b: Q(b)) {
          R(a, b).
        }
      }

      P(u).
      Q(v).
 
      // Are there x, y such that R(x, y)?
      let x, y: R(x, y)?
    `))).equalsTo([{"x": "u", "y": "v"}]);
  });

  function assertThat(x) {
    return {
      equalsTo(y) {
        Assert.deepEqual(x, y);
      }
    }
  }
});

