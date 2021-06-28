const Assert = require("assert");
const {Parser} = require("../src/parser.js");
const {KB, stepback, normalize, match, apply, clone} = require("../src/solver.js");

function literal(a) {
  return [a, "const"];
}

function free(a) {
  return [a, "free"];
}

function IF(a, b) {
  return [...b, a]
}

function FORALL(a, b) {
  return [...b, a]
}

function NOT([name, args]) {
  return [name, args, false]
}

function QUERY(...args) {
  return ["?", args]
}

function P(...args) {
  return ["P", args, true];
}

function Q(...args) {
  return ["Q", args, true];
}
  
function R(...args) {
  return ["R", args, true];
}
  
function U(...args) {
  return ["U", args, true];
}

function S(...args) {
  return ["S", args, true];
}

function x(type = "free") {
  return ["x", type];
}

function a(type = "const") {
  return ["a", type];
}

function b(type = "const") {
  return ["b", type];
}

function parse(code) {
  return normalize(new Parser().parse(code));
}

function first(code) {
  return parse(code)[0];
}

function q(code) {
  //console.log(first(code));
  return first(code)[1][0];
  //const statements = first(code);
  // console.log(statements);
  // const result = statements[2][0];
  //result[2] = Object.fromEntries(statements[1].map((arg) => [arg, "some"]));
  // const result = ;
  // console.log(result);
  
  //return result;
}

function unroll(gen) {
  const result = [];
  for (let entry of gen) {
    result.push(entry);
  }
  return result;
}

describe("Normalize", () => {
  it("P(a). => P(a).", () => {
    assertThat(normalize(new Parser().parse(`
      P(a).
    `))).equalsTo([
      P(a()),
    ]);
  });

  it("P(a) Q(b). => P(a). Q(b).", () => {
    assertThat(normalize(new Parser().parse(`
      P(a) Q(b).
    `))).equalsTo([
      P(a()),
      Q(b()),
    ]);
  });
  
  it("P(a). Q(b). => P(a). Q(b).", () => {
    assertThat(normalize(new Parser().parse(`
      P(a).
      Q(b).
    `))).equalsTo([
      P(a()),
      Q(b()),
    ]);
  });

  it("if (P(a)) Q(b). => if (P(a)) Q(b).", () => {
    assertThat(normalize(new Parser().parse(`
      if (P(a)) {
        Q(b).
      }
    `))).equalsTo([
      IF([P(a())], Q(b()))
    ]);
  });

  it("if (P(a) Q(a)) R(a). => if (P(a) Q(a)) R(a).", () => {
    assertThat(normalize(new Parser().parse(`
      if (P(a) Q(a)) {
        R(a).
      }
    `))).equalsTo([
      IF([P(a()), Q(a())], R(a()))
    ]);
  });

  it("if (P(a)) Q(a) R(a). => Q(a) if (P(a)). R(a) if (P(a))", () => {
    assertThat(normalize(new Parser().parse(`
      if (P(a)) {
        Q(a) R(a).
      }
    `))).equalsTo([
      IF([P(a())], Q(a())),
      IF([P(a())], R(a()))
    ]);
  });

  it("if (P() Q()) {R(). S().} => if (P() Q()) R(). if (P() Q()) S(). ", () => {
    assertThat(normalize(new Parser().parse(`
      if (P() Q()) {
        R().
        S().
      }
    `))).equalsTo([
      IF([P(), Q()], R()),
      IF([P(), Q()], S())
    ]);
  });

  it("if (P()) { if (Q()) R(). } => if (Q() P()) R().", () => {
    assertThat(normalize(new Parser().parse(`
      if (P()) {
        if (Q()) {
          R().
        }
      }
    `))).equalsTo([
      IF([Q(), P()], R())
    ]);
  });

  it("if (P()) { if (Q()) if (R()) {S()}. } => if (R() Q() P()) S().", () => {
    assertThat(normalize(new Parser().parse(`
      if (P()) {
        if (Q()) {
          if (R()) {
            S().
          }
        }
      }
    `))).equalsTo([
      IF([R(), Q(), P()], S())
    ]);
  });

  it("for (let every x: P(x)) Q(x). => let every x: Q(x) if (P(x)).", () => {
    assertThat(normalize(new Parser().parse(`
      for (let every x: P(x))
        Q(x). 
    `))).equalsTo([
      FORALL([P(x("every"))], Q(x("every")))
    ]);
  });

  it("for (let every a: P(a)) { for (let every b: Q(b)) R(a, b).} => let every a, b: R(a, b) if (P(a) Q(b)).", () => {
    assertThat(normalize(new Parser().parse(`
      for (let every a: P(a)) {
        for (let every b: Q(b))
          R(a, b). 
      }
    `))).equalsTo([
      FORALL([Q(b("every")), P(a("every"))], R(a("every"), b("every")))
    ]);
  });

  it("for (let every a: P(a)) {Q(a).} ? => let every a: Q(a) if (P(a)).", () => {
    assertThat(normalize(new Parser().parse(`
      for (let every a: P(a)) {
        Q(a). 
      } ?
    `))).equalsTo([
      QUERY(FORALL([P(a("every"))], Q(a("every"))))
    ]);
  });

  it("P(a)? => P(a)?", () => {
    assertThat(normalize(new Parser().parse(`
      P(a)?
    `))).equalsTo([
      QUERY(P(a()))
    ]);
  });

  it("Q(a) P(b)? => Q(a) P(b)?", () => {
    assertThat(normalize(new Parser().parse(`
      Q(a) P(b)?
    `))).equalsTo([
      QUERY(Q(a()), P(b()))
    ]);
  });

  it("{ Q(a). P(b). }? => Q(a) P(b)?", () => {
    assertThat(normalize(new Parser().parse(`
      {
        Q(a). 
        P(b).
      } ?
    `))).equalsTo([
      QUERY(Q(a()), P(b()))
    ]);
  });

  it("let x: P(x)? => let x: P(x)?", () => {
    assertThat(normalize(new Parser().parse(`
      let x: P(x)?
    `))).equalsTo([
      QUERY(P(x()))
    ]);
  });

  it("not P(). => not P().", () => {
    assertThat(normalize(new Parser().parse(`
      not P().
    `))).equalsTo([
      NOT(P())
    ]);
  });

  it("not P(a). => not P(a).", () => {
    assertThat(normalize(new Parser().parse(`
      not P(a).
    `))).equalsTo([
      NOT(P(literal("a")))
    ]);
  });

  it("not P() Q(). => not P(). Q().", () => {
    assertThat(normalize(new Parser().parse(`
      not P() Q().
    `))).equalsTo([
      NOT(P()),
      NOT(Q())
    ]);
  });

  it("not (P() Q()). => not P(). not Q().", () => {
    assertThat(normalize(new Parser().parse(`
      not (P() Q()).
    `))).equalsTo([
      NOT(P()),
      NOT(Q())
    ]);
  });

  it("not (P(a) Q(b)). => not P(a). not Q(b).", () => {
    assertThat(normalize(new Parser().parse(`
      not (P(a) Q(b)).
    `))).equalsTo([
      NOT(P(a())),
      NOT(Q(b()))
    ]);
  });

  it("not not P(). => P().", () => {
    assertThat(normalize(new Parser().parse(`
      not not P().
    `))).equalsTo([
      P()
    ]);
  });

  it("not not not P(). => not P().", () => {
    assertThat(normalize(new Parser().parse(`
      not not not P().
    `))).equalsTo([
      NOT(P())
    ]);
  });

  it("not not (P() Q()). => P(). Q().", () => {
    assertThat(normalize(new Parser().parse(`
      not not (P() Q()).
    `))).equalsTo([
      P(),
      Q()
    ]);
  });

  it("if (P()) not Q(). => not Q() if (P()).", () => {
    assertThat(normalize(new Parser().parse(`
      if (P()) not Q().
    `))).equalsTo([
      IF([P()], NOT(Q()))
    ]);
  });

  it("either (P()) or Q(). => P() if not Q(). Q() if not P().", () => {
    assertThat(normalize(new Parser().parse(`
      either (P()) or Q().
    `))).equalsTo([
      IF([NOT(Q())], P()),
      IF([NOT(P())], Q()),
    ]);
  });

  it("either (P(a)) or Q(b). => P(a) if not Q(b). Q(b) if not P(a).", () => {
    assertThat(normalize(new Parser().parse(`
      either (P(a)) or Q(b).
    `))).equalsTo([
      IF([NOT(Q(literal("b")))], P(literal("a"))),
      IF([NOT(P(literal("a")))], Q(literal("b"))),
    ]);
  });

  it("either P() Q() or R(). => P() if not R(). Q() if not R(). R() if not P() Q().", () => {
    assertThat(normalize(new Parser().parse(`
      either P() Q() or R().
    `))).equalsTo([
      IF([NOT(R())], P()),
      IF([NOT(R())], Q()),
      IF([NOT(P()), NOT(Q())], R()),
    ]);
  });
  
  it("either R() or P() Q(). => R() if not P() Q(). P() if not R(). Q() if not R().", () => {
    assertThat(normalize(new Parser().parse(`
      either R() or P() Q().
    `))).equalsTo([
      IF([NOT(P()), NOT(Q())], R()),
      IF([NOT(R())], P()),
      IF([NOT(R())], Q()),
    ]);
  });
});

describe("Stepback", () => {
  it("P(). P()?", () => {
    assertThat(stepback(q(`
      P()?
    `), first(`
      P().
    `))).equalsTo([{}, []]);
  });

  it("P(a). P(a)?", () => {
    assertThat(stepback(q(`
      P(a)?
    `), first(`
      P(a).
    `))).equalsTo([{}, []]);
  });

  it("P(a, b). P(a, b)?", () => {
    assertThat(stepback(q(`
      P(a, b)?
    `), first(`
      P(a, b).
    `))).equalsTo([{}, []]);
  });

  it("P(). Q()?", () => {
    assertThat(stepback(q(`
      Q()?
    `), first(`
      P().
    `))).equalsTo(undefined);
  });

  it("P(a). P(b)?", () => {
    assertThat(stepback(q(`
      P(b)?
    `), first(`
      P(a).
    `))).equalsTo(undefined);
  });

  
  it("if (Q(a)) P(a). P(a)?", () => {
    assertThat(stepback(q(`
      P(a)?
    `), first(`
      if (Q(a)) P(a).
    `))).equalsTo([{}, [Q(a())]]);
  });

  it("if (P(a) Q(a)) R(a). R(a)?", () => {
    assertThat(stepback(q(`
      R(a)?
    `), first(`
      if (P(a) Q(a)) R(a).
    `))).equalsTo([{}, [P(a()), Q(a())]]);
  });

  it("not P(). P()?", () => {
    assertThat(stepback(q(`
      P()?
    `), first(`
      not P().
    `))).equalsTo([false, []]);
  });

  it("P(a). let x: P(x)?", () => {
    assertThat(stepback(q(`
      let x: P(x)?
    `), first(`
      P(a).
    `))).equalsTo([{"x": a()}, []]);
  });

  it("P(). not P()?", () => {
    assertThat(stepback(first(`
      P().
    `), q(`
      not P()?
    `))).equalsTo([false, []]);
  });

  it("either P() or Q(). not P()?", () => {
    assertThat(stepback(q(`
      not P()?
    `), first(`
      either P() or Q().
    `))).equalsTo([false, [NOT(Q())]]);
  });

  it("for (let every x: P(x)) Q(x).  let x: P(x)?", () => {
    assertThat(stepback(q(`
      let x: Q(x)?
    `), first(`
      for (let every x: P(x))
        Q(x).
    `))).equalsTo([{"x": x()}, [P(free("x"))]]);
  });

  it("for (let every x: P(x) Q(x)) R(x).  let x: R(x)?", () => {
    assertThat(stepback(q(`
      let x: R(x)?
    `), first(`
      for (let every x: P(x) Q(x))
        R(x).
    `))).equalsTo([{"x": x()}, [P(free("x")), Q(free("x"))]]);
  });

  it("either P(a) or Q(a). not Q(a). let x: P(x)?", () => {
    assertThat(stepback(q(`
      let x: P(x)?
    `), first(`
      either P(a) or Q(a).
      not Q(a).
    `))).equalsTo([{"x": a()}, [NOT(Q(a()))]]);
  });

  it("either not P() or Q(). not P()?", () => {
    assertThat(stepback(q(`
      not P()?
    `), first(`
      either not P() or Q().
    `))).equalsTo([{}, [NOT(Q())]]);
  });

  it("either P(a) or Q(a). let x: not Q(x)?", () => {
    assertThat(stepback(q(`
      let y: not Q(y)?
    `), first(`
      for (let every x: U(x)) {
        either Q(x) or P(x).
      }
    `)))
      .equalsTo(undefined);
  });

  it("for (let every x: U(x)) either P(x) or Q(x). let x: not P(x)?", () => {
    assertThat(stepback(q(`
      let y: not P(y)?
    `), first(`
      for (let every x: U(x)) {
        either P(x) or Q(x).
      }
      not Q(a).
      U(a).
    `)))
      .equalsTo(undefined);
  });

  it("not P(). P()?", () => {
    assertThat(stepback(q(`
      P()?
    `), first(`
      not P().
    `))).equalsTo([false, []]);
  });
  
  it("if (P()) Q(). if (P()) Q()?", () => {
    assertThat(stepback(q(`
      if (P()) {
        Q().
      } ?
    `), first(`
      if (P()) Q().
    `))).equalsTo([{}, []]);
  });
  
  it("if (P()) Q(). if (P()) Q()?", () => {
    assertThat(stepback(q(`
      if (R()) {
        Q().
      } ?
    `), first(`
      if (P()) Q().
    `))).equalsTo([{}, [IF([R()], P())]]);
  });
  
  it("if (P()) Q() R(). if (P()) Q()?", () => {
    assertThat(stepback(q(`
      if (P()) {
        Q().
      } ?
    `), first(`
      if (P()) Q() R().
    `))).equalsTo([{}, []]);
  });
  
  it("if (P() Q()) R(). if (P() Q()) R()?", () => {
    assertThat(stepback(q(`
      if (P() Q()) {
        R().
      } ?
    `), first(`
      if (P() Q()) R().
    `))).equalsTo([{}, []]);
  });
  
  it("if (P()) R(). if (P() Q()) R()?", () => {
    assertThat(stepback(q(`
      if (P() Q()) {
        R().
      } ?
    `), first(`
      if (P()) R().
    `))).equalsTo([{}, [IF([Q()], R())]]);
  });
  
  it("if (P()) Q(). if (Q()) R(). if (P()) R()?", () => {
    assertThat(stepback(q(`
      if (P()) {
        R().
      } ?
    `), first(`
      if (Q()) {
        R().
      }
      if (P()) {
        Q().
      }
    `))).equalsTo([{}, [IF([P()], Q())]]);
  });
  
  it("for (let every x: P(x)) Q(x). for (let every y: P(y)) Q(y)?", () => {
    assertThat(stepback(q(`
      for (let every y: P(y)) {
        Q(y).
      } ?
    `), first(`
      for (let every x: P(x)) {
        Q(x).
      }
    `))).equalsTo([{}, []]);
  });
  
  it("for (let every x: P(x)) Q(x) R(x). for (let every x: P(x)) Q(x)?", () => {
    assertThat(stepback(q(`
      for (let every y: P(y)) {
        Q(y).
      } ?
    `), first(`
      for (let every x: P(x)) {
        Q(x) R(x).
      }
    `))).equalsTo([{}, []]);
  });
  
  it("for (let every x: P(x) Q(x)) R(x). for (let every x: P(x) Q(x)) R(x)?", () => {
    assertThat(stepback(q(`
      for (let every y: P(y) Q(y)) {
        R(y).
      } ?
    `), first(`
      for (let every x: P(x) Q(x)) {
        R(x).
      }
    `)))
      .equalsTo([{}, []]);
  });
  
  it("for (let every x: P(x)) R(x). for (let every x: Q(x)) R(x). for (let every x: P(x) Q(x)) R(x)?", () => {
    assertThat(stepback(q(`
      for (let every y: P(y) Q(y)) {
        R(y).
      } ?
    `), first(`
      for (let every x: P(x)) {
        R(x).
      }
      for (let every x: Q(x)) {
        R(x).
      }
    `))).equalsTo([{x: ["y", "every"]}, [FORALL([Q(["y", "every"])], R(["y", "every"]))]]);
  });

  it("if (P(x)) Q(x). for (let every x: P(x)) Q(x)?", () => {
    assertThat(stepback(q(`
      for (let every y: P(y)) {
        Q(y).
      } ?
    `), first(`
      if (P(x)) {
        Q(x).
      }
    `))).equalsTo(undefined);
  });

  it("for (let every x: U(x)) either P(x) or Q(x).", () => {
    assertThat(stepback(q(`
      let x: P(x)?
    `), first(`
      for (let every x: U(x))
        either P(x) or Q(x).
    `))).equalsTo([{x: x()}, [NOT(Q(x())), U(x())]]);
  });
});

describe("Normalize", () => {
  function print(statements) {
    const result = [];
    let arg = ([name, type]) => type == "const" ? name : `${type} ${name}`;
    for (let [name, args, letty, iffy] of statements) {
      const line = [];
      if (Object.keys(letty || {}).length > 0) {
        line.push("let ");
        line.push(Object.entries(letty).map(([name, quantifier]) => `${quantifier} ${name}`).join(", "));
        line.push(": ");
      }
      line.push(`${name}(${args.map(arg).join(", ")})`);
      if (iffy) {
        line.push(" ");
        line.push("if (");
        line.push(iffy.map(([name, args]) => `${name}(${args.map(arg).join(", ")})`).join(" "));
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
    assertThat(trim(print(normalize(new Parser().parse(`
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
      Q(every a) if (P(every a)).
      R(every a) if (P(every a) Q(every a)).
      S(every a) if (P(every a)).
      T(every a) if (P(every a)).
      U(every a) if (P(every a)).
      V(every a) if (P(every a)).
      S(every a, every b) if (R(c) Q(every b) P(every a) T(d)).
    `));
  });

});

describe("Match", () => {
  it("match(let x: Q(x), for (let every y: P(y)) Q(y))", () => {
    const body = [["P", ["y"]]];
    const matches = match(
      ["Q", [free("x")], []],
      ["Q", [["y", "every"]], body]
    );
    assertThat(matches)
      .equalsTo({"y": ["x", "free"]});
    apply(body, matches);
    assertThat(body)
      .equalsTo([["P", [["x", "free"]]]]);
  });

  it("let y: Q(y) == for (let every x: P(x)) Q(x)", () => {
    const matches = match(Q(free("y")), FORALL([P(x())], Q(x())));
    assertThat(matches).equalsTo({"x": ["y", "free"]});
    const deps = [P(x())];
    apply(deps, matches);
    assertThat(deps).equalsTo([P(free("y"))]);
  });

  it("for (let every x: P(x)) Q(x). == for (let every y: P(y)) Q(y)?", () => {
    assertThat(match(
      FORALL([P(["y", "every"])], Q(["y", "every"])),
      FORALL([P(x("every"))], Q(x("every")))
    )).equalsTo({"x": ["y", "every"]});
  });
  
  it("Q(a). == for (let every y: P(y)) Q(y)?", () => {
    assertThat(match(
      Q(a()),
      FORALL([P(x("every"))], Q(x("every")))
    )).equalsTo({"x": a()});
  });
  
  it("either P(a) or Q(a). let x: not Q(x)?", () => {
    assertThat(match(q(`
      let y: not Q(y)?
    `), first(`
      for (let every x: U(x)) {
        either Q(x) or P(x).
      }
    `)))
      .equalsTo({x: ["y", "free"]});
  });

  it("let every x: Q(x) if P(x) matches Q(a) if P(a).", () => {
    assertThat(match(
      IF([P(x("const"))], Q(x("const"))),
      FORALL([P(x("every"))], Q(x("every")))
    )).equalsTo({x: x("const")});
  });
  
});

describe("Query", () => {
  it("P(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
    `)).query(P()))).equalsTo([{}]);
  });

  it("P(). Q()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
    `)).query(Q()))).equalsTo([]);
  });

  it("P(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
    `)).query(["P", [free("x")]])))
      .equalsTo([{x: literal("a")}]);
  });

  it("P(a). P(b). let x: P(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      P(b).
    `)).query(["P", [free("x")]])))
      .equalsTo([{x: literal("a")}, {x: literal("b")}]);
  });

  it("P(a, b). P(c, d). let x, y: P(x, y)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a, b).
      P(c, d).
    `)).query(["P", [free("x"), free("y")]])))
      .equalsTo([{x: literal("a"), y: literal("b")}, {x: literal("c"), y: literal("d")}]);
  });

  it("not P(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      not P().
    `)).query(["P", []]))).equalsTo([false]);
  });

  it("not P(). not P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      not P().
    `)).query(["P", [], false, []]))).equalsTo([{}]);
  });

  it("P(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
    `)).query(["P", [free("x")]])))
      .equalsTo([{"x": a()}]);
  });

  it("let y: not P(y)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: U(x)) {
        either P(x) or Q(x).
      }
      not Q(a).
      U(a).
    `)).query(NOT(P(["y", "free"])))))
      .equalsTo([]);
  });

  it("for (let every x: P(x)) Q(x). P(a). let y: Q(y)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) 
        Q(x). 
      P(a). 
    `)).query(Q(free("y")))))
      .equalsTo([{"y": a()}]);
  });

});

describe("Select", function() {

  it("P(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("not P(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      not P().
    `)).select(first(`
      P()?
    `)))).equalsTo([false]);
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

  it("not P(a). P(a)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      not P(a).
    `)).select(first(`
      P(a)?
    `)))).equalsTo([false]);
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
    `)).select(first(`
      let x: P(x)?
    `))))
      .equalsTo([{"x": a()}]);
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
      .equalsTo([{"x": a()}]);
  });

  it("P(a, b). let x: P(a, x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a, b).
    `)).select(first(`
      let x: P(a, x)?
    `))))
      .equalsTo([{"x": b()}]);
  });

  it("P(a). P(b). let x: P(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      P(b).
    `)).select(first(`
      let x: P(x)?
    `)))).equalsTo([{"x": a()}, {"x": b()}]);
  });

  it("P(a). Q(a). let x: P(x) Q(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      Q(a).
    `)).select(first(`
      let x: P(x) Q(x)?
    `))))
      .equalsTo([{"x": a()}]);
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
      .equalsTo([{x: literal("a")}]);
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
      .equalsTo([{"x": literal("a"), "y": literal("b")}]);
  });

  it("P(a). Q(b). let x, y: P(x) Q(y)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P(a).
      Q(b).
    `)).select(first(`
      let x, y: P(x) Q(y)?
    `))))
      .equalsTo([{"x": literal("a"), "y": literal("b")}]);
  });

  it("for (let every x: P(x)) Q(x). P(a). let x: Q(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) Q(x). 
      P(a).
    `)).select(first(`
      let y: Q(y)?
    `)))).equalsTo([{"y": a()}]);
  });

  it("for (let every x: P(x) Q(x)) R(x). P(a). Q(a). let x: R(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x) Q(x)) R(x). 
      P(a).
      Q(a).
    `)).select(first(`
      let x: R(x)?
    `))))
      .equalsTo([{"x": a()}]);
  });

  it("for (let every x: P(x)) Q(x). for (let every x: Q(x)) R(x). P(a). let x: R(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) Q(x). 
      for (let every x: Q(x)) R(x). 
      P(a).
    `)).select(first(`
      let x: R(x)?
    `))))
      .equalsTo([{"x": a()}]);
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
      .equalsTo([{"x": a()}, {"x": b()}]);
  });

  it("let x: Q(x) S(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) Q(x). 
      for (let every x: R(x)) S(x).
      P(a).
      R(a).
      Q(d) S(d).
    `)).select(first(`
      let x: Q(x) S(x)?
    `))))
      .equalsTo([{"x": literal("a")}, {"x": literal("d")}]);
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
      .equalsTo([{"x": literal("a")}, {"x": literal("d")}, {"x": literal("g")}]);
  });

  it("not P(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      not P().
    `)).select(first(`
      P()?
    `)))).equalsTo([false]);
  });

  it("not P(). not P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      not P().
    `)).select(first(`
      not P()?
    `)))).equalsTo([{}]);
  });

  it("not P() Q(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      not P() Q().
    `)).select(first(`
      P()?
    `)))).equalsTo([false]);
  });

  it("not P() Q(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      not P() Q().
    `)).select(first(`
      Q()?
    `)))).equalsTo([false]);
  });

  it("not not P(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      not not P().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("if (P()) not Q(). P(). Q()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      if (P()) not Q().
      P().
    `)).select(first(`
      Q()?
    `)))).equalsTo([false]);
  });

  it("if (P(a) Q(b)) not Q(c). P(a). Q(b). Q(c)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      if (P(a) Q(b)) not Q(c).
      P(a).
      Q(b).
    `)).select(first(`
      Q(c)?
    `)))).equalsTo([false]);
  });

  it("for (let x: even(x)) not odd(x). even(u). odd(u)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: even(x))
        not odd(x).
      even(u).
    `)).select(first(`
      odd(u)?
    `)))).equalsTo([false]);
  });

  it("either P() or Q(). not Q(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      either P() or Q().
      not Q().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("either P() or Q(). not Q(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      either P() or Q().
      not Q().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("either P() Q() or R(). not R(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      either P() Q() or R().
      not R().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("either R() or P() Q(). not R(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      either R() or P() Q().
      not R().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("either P(a) or Q(a). not Q(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      either P(a) or Q(a).
      not Q(a).
    `)).select(first(`
      let x: P(x)?
    `)))).equalsTo([{"x": literal("a")}]);
  });

  it("for (let every x: U(x)) either P(x) or Q(x). not Q(a). U(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: U(x)) {
        either P(x) or Q(x).
      }
      not Q(a).
      U(a).
      not Q(b).
      U(b).
      not Q(c).
      U(d).
      not Q(e).
      U(e).
    `)).select(first(`
      let x: P(x)?
    `)))).equalsTo([{"x": literal("a")}, {"x": literal("b")}, {"x": literal("e")}]);
  });

  it("either not P() or Q(). not Q(). not P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      either not P() or Q().
      not Q().
    `)).select(first(`
      not P()?
    `)))).equalsTo([{}]);
  });

  it("for (let every x: R(x)) P(x) Q(x). P(c) Q(c)?", () => {
    assertThat(unroll(new KB().insert(parse(`
    for (let every x: R(x)) {
      P(x) Q(x).
    }
    R(c).
    `)).select(first(`
      P(c) Q(c)?
    `)))).equalsTo([{}]);
  });
  
  it("P() and Q(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P() and Q().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("P() and Q() and R(). P() and R()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      P() and Q() and R().
    `)).select(first(`
      P() and R()?
    `)))).equalsTo([{}]);
  });

  it("P() and Q() and R(). P()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      (P(a). Q(a).) and (U(b). V(b).).
    `)).select(first(`
      let x: P(x)?
    `)))).equalsTo([{"x": literal("a")}]);
  });

  it("if (P()) Q(). if (P()) Q()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      if (P()) Q(). 
    `)).select(first(`
      if (P()) { 
        Q(). 
      } ?
    `)))).equalsTo([{}]);
  });

  it("if (P(a)) Q(b). if (P(b)) Q(a)?", () => {
    assertThat(unroll(new KB().insert(parse(`
      if (P(a)) Q(b). 
    `)).select(first(`
      if (P(b)) {
        Q(a). 
      } ?
    `)))).equalsTo([]);
  });

  it("if (P()) Q() R(). if (P()) Q()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      if (P()) Q() R(). 
    `)).select(first(`
      if (P()) {
        Q(). 
      } ?
    `)))).equalsTo([{}]);
  });

  it("if (P()) R(). if (Q()) R(). if (P() Q()) R()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      if (P()) R(). 
      if (Q()) R(). 
    `)).select(first(`
      { if (P() Q()) R(). }?
    `)))).equalsTo([{}, {}]);
  });

  it("if (P()) Q(). if (Q()) R(). if (P()) R()?", () => {
    assertThat(unroll(new KB().insert(parse(`
      if (P()) Q(). 
      if (Q()) R(). 
    `)).select(first(`
      if (P()) {
        R(). 
      } ?
    `)))).equalsTo([{}]);
  });

  it("for (let every x: P(x)) { Q(x). } for (let every y: P(y)) { Q(y). } ?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) Q(x).
    `)).query(
      FORALL([P(["y", "every"])], Q(["y", "every"])))))
      .equalsTo([{}]);
  });

  it("for (let every x: P(x)) { Q(x). } for (let every x: P(x)) { Q(x). } ?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) {
        Q(x).
      }
    `)).select(first(`
      for (let every y: P(y)) {
        Q(y).
      } ?
    `)))).equalsTo([{}]);
  });

  it("for (let every x: P(x)) { Q(x) R(x). } for (let every x: P(x)) { R(x). } ?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) {
        Q(x) R(x).
      }
    `)).select(first(`
      for (let every y: P(y)) {
        R(y).
      } ?
    `)))).equalsTo([{}]);
  });

  it("for (let every x: P(x) Q(x)) { R(x). } for (let every x: P(x) Q(x)) { R(x). } ?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x) Q(x)) {
        R(x).
      }
    `)).select(first(`
      for (let every y: P(y) Q(y)) {
        R(y).
      } ?
    `)))).equalsTo([{}]);
  });

  it("for (let every x: P(x)) { Q(x). } for (let every x: Q(x)) { R(x). } for (let every x: P(x)) { R(x). } ?", () => {
    assertThat(unroll(new KB().insert(parse(`
      for (let every x: P(x)) {
        Q(x).
      }
      for (let every x: Q(x)) {
        R(x).
      }
    `)).select(first(`
      for (let every y: P(y)) {
        R(y).
      } ?
    `)))).equalsTo([{}]);
  });
  
});

describe("REPL", () => {
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
    `))).equalsTo([{"x": literal("u")}]);
  });
  
  it("P(A). let a: P(a)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A)."))).equalsTo([]);
    assertThat(unroll(kb.read("let a: P(a)?"))).equalsTo([{"a": literal("A")}]);
  });

  it("P(A, B). let a, b: P(a, b)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A, B)."))).equalsTo([]);
    assertThat(unroll(kb.read("let a, b: P(a, b)?")))
      .equalsTo([{
        "a": literal("A"),
        "b": literal("B")
      }]);
  });

  it("P(A, B). let b: P(A, b)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read("P(A, B)."))).equalsTo([]);
    assertThat(unroll(kb.read("let b: P(A, b)?"))).equalsTo([{"b": literal("B")}]);
  });

  it("P(A). Q(A). let a: P(a) Q(a)?", function() {
    assertThat(unroll(new KB().read(`
      P(A). Q(A).
      let a: P(a) Q(a)?
    `))).equalsTo([{"a": literal("A")}]);
  });

  it("P(A). Q(A). let a: (P(a) Q(a))?", function() {
    assertThat(unroll(new KB().read(`
      P(A). Q(A).
      let a: (P(a) Q(a))?
    `))).equalsTo([{"a": literal("A")}]);
  });

  it("P(A). Q(A). let a: {P(a). Q(a).} ?", function() {
    assertThat(unroll(new KB().read(`
      P(A). Q(A).
      let a: {
        P(a). 
        Q(a).
      } ?
    `))).equalsTo([{"a": literal("A")}]);
  });

  it("P(a). Q(a). let b: P(b) Q(b)?", function() {
    assertThat(unroll(new KB().read(`
      P(a). Q(a).
      let b: P(b) Q(b)?
    `))).equalsTo([{"b": literal("a")}]);
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
    assertThat(unroll(kb.read("let a, b: P(a) Q(b)?")))
      .equalsTo([{
        "a": literal("A"),
        "b": literal("B")
      }]);
  });

  it("Sam(u) Dani(v) loves(u, v). let a, b: Sam(a) Dani(b) loves(a, b)?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      // There is a u named Sam and a v named Dani. u loves v.
      Sam(u) Dani(v) loves(u, v).

      // Is there an "a" Sam who loves a "b" named Dani?
      let a, b: Sam(a) Dani(b) loves(a, b)?
    `))).equalsTo([{
      "a": literal("u"),
      "b": literal("v")
    }]);
  });

  it("Sam(u) Dani(v) loves(u, v). let a, b: Sam(a) loves(a, b) ?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      Sam(u) Dani(v) loves(u, v). 

      // Who does Sam love?
      let a, b: Sam(a) loves(a, b)?
    `))).equalsTo([{"a": literal("u"), "b": literal("v")}]);
  });

  it("Sam(u) Dani(v) loves(u, v). let a, b: Sam(a) loves(a, b) ?", function() {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      Sam(u) loves(u, v) Dani(v).
      // Who loves Dani?
      let a, b: Dani(b) loves(a, b)?
    `))).equalsTo([{"a": literal("u"), "b": literal("v")}]);
  });

  it("P(u). for (let every a: P(a)) Q(a). let x: Q(x)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: P(a)) 
        Q(a).
      P(u).
      let x: Q(x)?
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("for (let every a: P(a)) Q(a). P(u). U(u). U(x) Q(x)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: P(a)) 
        Q(a).

      P(u). 
      U(u).

      let x: U(x) Q(x)?
    `))).equalsTo([{"x": literal("u")}]);
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
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("for (let every a: P(a)) Q(a). for (every a: Q(a)) R(a). P(u). R(v)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: P(a)) 
        Q(a).
      for (let every a: Q(a)) 
        R(a).
      P(u).
      let x: R(x)?
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("for (let every a: P(a)) { Q(a). R(a).} P(u). R(v)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: P(a)) { 
        Q(a). 
        R(a). 
      }

      P(u).

      let x: R(x)?
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("for (let every a: P(a) Q(a)) R(a). P(u). Q(u). R(v)?", function() {
    assertThat(unroll(new KB().read(`
      for (let every a: P(a) Q(a)) 
        R(a).

      P(u). R(u).

      let x: R(x)?
    `))).equalsTo([{"x": literal("u")}]);
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
    `))).equalsTo([{"x": literal("u")}, {"x": literal("u")}]);
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
    `))).equalsTo([{"x": literal("u")}]);
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
    `))).equalsTo([{x: literal("c")}]);
  });

  it("if (P(a) Q(b)) R(c). P(a). Q(b). let x: R(x)?", function() {
    assertThat(unroll(new KB().read(`
      if (P(a) Q(b)) 
        R(c).
      P(a). Q(b).
      let x: R(x)?
    `))).equalsTo([{x: literal("c")}]);
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
    `))).equalsTo([{x: literal("u"), y: literal("v")}]);
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
    `))).equalsTo([{"x": literal("u")}]);
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
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("let x, y: Sam(x) Leo(y) parent(x, y)?", function() {
    assertThat(unroll(new KB().read(`
      Sam(u).
      Leo(v).
      man(u).
      parent(u, v).
 
      // Is there a Sam who is a parent of a Leo?
      let x, y: Sam(x) Leo(y) parent(x, y)?
    `))).equalsTo([{"x": literal("u"), "y": literal("v")}]);
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
    `))).equalsTo([{"x": literal("u"), "y": literal("v")}]);
  });


  it("if (not P()) Q(). not P(). Q()?", function() {
    assertThat(unroll(new KB().read(`
      if (not P()) {
        Q().
      }
      not P().
      Q()?
    `))).equalsTo([{}]);
  });

  it("if (not not P()) Q(). P(). Q()?", function() {
    assertThat(unroll(new KB().read(`
      if (not not P()) {
        Q().
      }
      P().
      Q()?
    `))).equalsTo([{}]);
  });

  it("if ({ P(). }) Q(). P(). Q()?", function() {
    assertThat(unroll(new KB().read(`
      if ({ P(). }) {
        Q().
      }
      P().
      Q()?
    `))).equalsTo([{}]);
  });

  it.skip("if ({ for (let every x: girl(x)) likes(u, x). }) Q(). P(). Q()?", function() {
    assertThat(unroll(new KB().read(`
      // If u likes every girl then Q.
      if ({ 
        for (let every x: girl(x)) {
          likes(u, x).
        }
      }) {
        Q().
      }
      // u does like every girl.
      for (let every x: girl(x)) {
        likes(u, x).
      }
      Q()?
    `))).equalsTo([{}]);
  });

  
  it.skip("if (either P() or Q()) R(). P(). R()?", function() {
    assertThat(unroll(new KB().read(`
      if (either P() or Q()) {
        R().
      }
      P().
      not Q().
      R()?
    `))).equalsTo([{}]);
  });

  it("not not P(). P()?", function() {
    assertThat(unroll(new KB().read(`
      not not P().
      P()?
    `))).equalsTo([{}]);
  });

  it("not not not P(). not P()?", function() {
    assertThat(unroll(new KB().read(`
      not not not P().
      not P()?
    `))).equalsTo([{}]);
  });

  it.skip("either P() or Q(). Q(). P()?", function() {
    assertThat(unroll(new KB().read(`
      either P() or Q().
      Q().
      P()?
    `))).equalsTo([false]);
  });

  it.skip("either P() or Q(). Q(). not P()?", function() {
    assertThat(unroll(new KB().read(`
      either P() or Q().
      Q().
      not P()?
    `))).equalsTo([{}]);
  });
  
});


function assertThat(x) {
  return {
    equalsTo(y) {
      Assert.deepEqual(x, y);
    }
  }
}
