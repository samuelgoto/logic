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

function FOR(a, b) {
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
  
function L(...args) {
  return ["L", args, true];
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

function y(type = "free") {
  return ["y", type];
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
  return first(code)[1][0];
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

  it("if (P(a)) Q(b). => if (P(a)) Q(b).", () => {
    assertThat(normalize(new Parser().parse(`
      if (P(a)) {
        // hello
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

  it("for (let x: P(x)) Q(x). => let x: Q(x) if (P(x)).", () => {
    assertThat(normalize(new Parser().parse(`
      for (let x: P(x))
        Q(x). 
    `))).equalsTo([
      FORALL([P(x("every"))], Q(x("every")))
    ]);
  });

  it("for (let a: P(a)) { for (let b: Q(b)) R(a, b).} => let a, b: R(a, b) if (P(a) Q(b)).", () => {
    assertThat(normalize(new Parser().parse(`
      for (let a: P(a)) {
        for (let b: Q(b))
          R(a, b). 
      }
    `))).equalsTo([
      FORALL([Q(b("every")), P(a("every"))], R(a("every"), b("every")))
    ]);
  });

  it("for (let a: P(a)) {Q(a).} ? => let a: Q(a) if (P(a)).", () => {
    assertThat(normalize(new Parser().parse(`
      for (let a: P(a)) {
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

  it("Q(a) P(b)? => Q(a) P(b)?", () => {
    assertThat(normalize(new Parser().parse(`
      Q(a) P(b)?
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

  it("let s1: P(s1, a, b)?", () => {
    assertThat(normalize(new Parser().parse(`
      let s1: P(s1, a, b)?
    `))).equalsTo([
      QUERY(P(["s1", "free"], a(), b()))
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

  it("for (let x: U(x)) for (let y: U(y)) { P(x, y). Q(y, x). }", () => {
    assertThat(normalize(new Parser().parse(`
      for (let x: U(x)) {
        for (let y: U(y)) {
          P(x, y).
          Q(y, x).
        }
      }
    `))).equalsTo([
      FORALL([U(y("every")), U(x("every"))], P(x("every"), y("every"))),
      FORALL([U(y("every")), U(x("every"))], Q(y("every"), x("every")))
    ]);
  });

  it("for (let most x: P(x)) Q(x). => let most x: Q(x) if (P(x)).", () => {
    assertThat(normalize(new Parser().parse(`
      for (let most x: P(x))
        Q(x). 
    `))).equalsTo([
      FORALL([P(x("most"))], Q(x("most")))
    ]);
  });


});

describe("Push", () => {
  it("Partitioned", () => {
    const kb = new KB();
    kb.push([P()]);
    assertThat(kb.rules)
      .equalsTo({"P": [P()]});
    assertThat(unroll(kb.query(P())))
      .equalsTo([{}]);
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

  it("P(a, b, c). let s1: P(s1, b, c)?", () => {
    assertThat(stepback(q(`
      let s1: P(s1, b, c)?
    `), first(`
      P(a, b, c).
    `))).equalsTo([{"s1": a()}, []]);
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

  it("for (let x: P(x)) Q(x).  let x: P(x)?", () => {
    assertThat(stepback(q(`
      let x: Q(x)?
    `), first(`
      for (let x: P(x))
        Q(x).
    `))).equalsTo([{"x": x()}, [P(free("x"))]]);
  });

  it("for (let x: P(x) Q(x)) R(x).  let x: R(x)?", () => {
    assertThat(stepback(q(`
      let x: R(x)?
    `), first(`
      for (let x: P(x) Q(x))
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
      for (let x: U(x)) {
        either Q(x) or P(x).
      }
    `)))
      .equalsTo(undefined);
  });

  it("for (let x: U(x)) either P(x) or Q(x). let x: not P(x)?", () => {
    assertThat(stepback(q(`
      let y: not P(y)?
    `), first(`
      for (let x: U(x)) {
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
  
  it("for (let x: P(x)) Q(x). for (let y: P(y)) Q(y)?", () => {
    assertThat(stepback(q(`
      for (let y: P(y)) {
        Q(y).
      } ?
    `), first(`
      for (let x: P(x)) {
        Q(x).
      }
    `))).equalsTo([{}, []]);
  });
  
  it("for (let x: P(x)) Q(x). for (let y: P(y)) R(y)?", () => {
    assertThat(stepback(q(`
      for (let y: P(y)) {
        R(y).
      } ?
    `), first(`
      for (let x: P(x)) {
        Q(x).
      }
    `))).equalsTo(undefined);
  });

  it("for (let x: Q(x)) R(x). for (let y: P(y)) R(y)?", () => {
    assertThat(stepback(q(`
      for (let y: P(y)) {
        R(y).
      } ?
    `), first(`
      for (let x: Q(x)) {
        R(x).
      }
    `))).equalsTo([{x: ["y", "every"]}, [FORALL([P(["y", "every"])], Q(["y", "every"]))]]);
  });

  it("for (let x: P(x)) Q(x) R(x). for (let x: P(x)) Q(x)?", () => {
    assertThat(stepback(q(`
      for (let y: P(y)) {
        Q(y).
      } ?
    `), first(`
      for (let x: P(x)) {
        Q(x) R(x).
      }
    `))).equalsTo([{}, []]);
  });
  
  it("for (let x: P(x) Q(x)) R(x). for (let x: P(x) Q(x)) R(x)?", () => {
    assertThat(stepback(q(`
      for (let y: P(y) Q(y)) {
        R(y).
      } ?
    `), first(`
      for (let x: P(x) Q(x)) {
        R(x).
      }
    `)))
      .equalsTo([{}, []]);
  });
  
  it("for (let x: P(x)) R(x). for (let x: Q(x)) R(x). for (let x: P(x) Q(x)) R(x)?", () => {
    assertThat(stepback(q(`
      for (let y: P(y) Q(y)) {
        R(y).
      } ?
    `), first(`
      for (let x: P(x)) {
        R(x).
      }
      for (let x: Q(x)) {
        R(x).
      }
    `))).equalsTo([{x: ["y", "every"]}, [FORALL([Q(["y", "every"])], R(["y", "every"]))]]);
  });

  it("if (P(x)) Q(x). for (let y: P(y)) Q(y)?", () => {
    assertThat(stepback(q(`
      for (let y: P(y)) {
        Q(y).
      } ?
    `), first(`
      if (P(x)) {
        Q(x).
      }
    `))).equalsTo(undefined);
  });

  it("for (let x: P(x)) R(x). for (let x: Q(x)) R(x). for (let x: P(x) Q(x)) R(x)?", () => {
    assertThat(stepback(q(`
      for (let y: P(y)) {
        R(y).
      } ?
    `), first(`
      for (let x: Q(x)) {
        R(x).
      }
    `))).equalsTo([{x: ["y", "every"]}, [FORALL([P(["y", "every"])], Q(["y", "every"]))]]);
  });

  it("for (let x: U(x)) either P(x) or Q(x).", () => {
    assertThat(stepback(q(`
      let x: P(x)?
    `), first(`
      for (let x: U(x))
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

      for (let a: P(a)) Q(a).
      for (let a: P(a) Q(a)) R(a).
      for (let a: P(a)) {
        S(a) T(a).
      }
      for (let a: P(a)) {
        U(a).
        V(a).
      }
      if (T(d)) {
        for (let a: P(a)) {
          for (let b: Q(b)) {
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
  it("match(let x: Q(x), for (let y: P(y)) Q(y))", () => {
    const body = [["P", ["y"]]];
    const matches = match(
      ["Q", [free("x")], []],
      ["Q", [["y", "every"]], body]
    );
    assertThat(matches)
      .equalsTo({"y": ["x", "free"]});
    const result = apply(body, matches);
    assertThat(result)
      .equalsTo([["P", [["x", "free"]]]]);
  });

  it("let y: Q(y) == for (let x: P(x)) Q(x)", () => {
    const matches = match(Q(free("y")), FORALL([P(x())], Q(x())));
    assertThat(matches).equalsTo({"x": ["y", "free"]});
    const deps = apply([P(x())], matches);
    assertThat(deps).equalsTo([P(free("y"))]);
  });

  it("for (let x: P(x)) Q(x). == for (let y: P(y)) Q(y)?", () => {
    assertThat(match(
      FORALL([P(["y", "every"])], Q(["y", "every"])),
      FORALL([P(x("every"))], Q(x("every")))
    )).equalsTo({"x": ["y", "every"]});
  });
  
  it("Q(a). == for (let y: P(y)) Q(y)?", () => {
    assertThat(match(
      Q(a()),
      FORALL([P(x("every"))], Q(x("every")))
    )).equalsTo({"x": a()});
  });
  
  it("either P(a) or Q(a). let x: not Q(x)?", () => {
    assertThat(match(q(`
      let y: not Q(y)?
    `), first(`
      for (let x: U(x)) {
        either Q(x) or P(x).
      }
    `)))
      .equalsTo({x: ["y", "free"]});
  });

  it("let x: Q(x) if P(x) matches Q(a) if P(a).", () => {
    assertThat(match(
      IF([P(x("const"))], Q(x("const"))),
      FORALL([P(x("every"))], Q(x("every")))
    )).equalsTo({x: x("const")});
  });
  
  it("match(let x: Q(x), for (let most y: P(y)) Q(y))", () => {
    const body = [["P", ["y"]]];
    const matches = match(
      ["Q", [free("x")], []],
      ["Q", [["y", "most"]], body]
    );
    assertThat(matches)
      .equalsTo(false);
  });

  it("match(for (let x: P(x)) R(x), for (let y: P(y)) Q(y)) == false", () => {
    assertThat(match(
      FORALL([P(y("every"))], R(y("every"))),
      FORALL([P(x("every"))], Q(x("every")))
    )).equalsTo(false);
  });
});

describe("Query", () => {
  it("P(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P().
    `)).query(P()))).equalsTo([{}]);
  });

  it("P(). Q()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P().
    `)).query(Q()))).equalsTo([]);
  });

  it("P(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
    `)).query(["P", [free("x")]])))
      .equalsTo([{x: literal("a")}]);
  });

  it("P(a). P(b). let x: P(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
      P(b).
    `)).query(["P", [free("x")]])))
      .equalsTo([{x: literal("a")}, {x: literal("b")}]);
  });

  it("P(a, b). P(c, d). let x, y: P(x, y)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a, b).
      P(c, d).
    `)).query(["P", [free("x"), free("y")]])))
      .equalsTo([{x: literal("a"), y: literal("b")}, {x: literal("c"), y: literal("d")}]);
  });

  it("not P(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      not P().
    `)).query(["P", []]))).equalsTo([false]);
  });

  it("not P(). not P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      not P().
    `)).query(["P", [], false, []]))).equalsTo([{}]);
  });

  it("P(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
    `)).query(["P", [free("x")]])))
      .equalsTo([{"x": a()}]);
  });

  it("let y: not P(y)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: U(x)) {
        either P(x) or Q(x).
      }
      not Q(a).
      U(a).
    `)).query(NOT(P(["y", "free"])))))
      .equalsTo([]);
  });

  it("for (let x: P(x)) Q(x). P(a). let y: Q(y)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x)) 
        Q(x). 
      P(a). 
    `)).query(Q(free("y")))))
      .equalsTo([{"y": a()}]);
  });

});

describe("Select", function() {

  it("P(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("not P(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      not P().
    `)).select(first(`
      P()?
    `)))).equalsTo([false]);
  });

  it("P(). Q()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P().
    `)).select(first(`
      Q()?
    `)))).equalsTo([]);
  });
  
  it("P() Q(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P() Q().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("P() Q(). Q()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P() Q().
    `)).select(first(`
      Q()?
    `)))).equalsTo([{}]);
  });

  it("P() Q() R(). R()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P() Q() R().
    `)).select(first(`
      R()?
    `)))).equalsTo([{}]);
  });

  it("P() Q() R(). R()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P() Q() R().
    `)).select(first(`
      P() R()?
    `)))).equalsTo([{}]);
  });

  it("P() Q() R(). R()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P() Q() R().
    `)).select(first(`
      P() R()?
    `)))).equalsTo([{}]);
  });
  
  it("if (P()) Q(). Q()?", () => {
    assertThat(unroll(new KB().push(parse(`
      if (P()) 
        Q().
    `)).select(first(`
      Q()?
    `)))).equalsTo([]);
  });

  it("P(). if (P()) Q(). Q()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P().
      if (P()) 
        Q().
    `)).select(first(`
      Q()?
    `)))).equalsTo([{}]);
  });

  it("P(). if (P() Q()) R(). R()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P().
      if (P() Q()) 
        R().
    `)).select(first(`
      R()?
    `)))).equalsTo([]);
  });

  it("P(). Q(). if (P() Q()) R(). R()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P().
      Q().
      if (P() Q()) 
        R().
    `)).select(first(`
      R()?
    `)))).equalsTo([{}]);
  });

  it("P(). if (P()) Q() R(). R()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P().
      if (P()) 
        Q() R().
    `)).select(first(`
      R()?
    `)))).equalsTo([{}]);
  });

  it("P(). if (P()) {Q(). R().} R()?", () => {
    assertThat(unroll(new KB().push(parse(`
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
    assertThat(unroll(new KB().push(parse(`
      not P(a).
    `)).select(first(`
      P(a)?
    `)))).equalsTo([false]);
  });

  it("P(a). if (P(a)) Q(b). Q(b)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
      if (P(a))
        Q(b). 
    `)).select(first(`
      Q(b)?
    `)))).equalsTo([{}]);
  });

  it("if (P()) Q(). if (Q()) R(). P(). R()?", () => {
    assertThat(unroll(new KB().push(parse(`
      if (P()) 
        Q().
      if (Q()) 
        R().
      P().
    `)).select(first(`
      R()?
    `)))).equalsTo([{}]);
  });

  it("for (let a: P(a)) Q(a). P(u). Q(u)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let a: P(a)) {
        Q(a).
      }
      P(u).
    `)).select(first(`
      Q(u)?
    `)))).equalsTo([{}]);
  });

  it("for (let a: P(a)) Q(a). P(u). Q(v)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let a: P(a)) {
        Q(a).
      }
      P(u).
    `)).select(first(`
      Q(v)?
    `)))).equalsTo([]);
  });

  it("for (let a: P(a)) Q(a) R(a). P(u). R(u)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let a: P(a)) {
        Q(a) R(a).
      }
      P(u).
    `)).select(first(`
      R(u)?
    `)))).equalsTo([{}]);
  });

  it("for (let a: P(a)) Q(a). for (let a: Q(a)) R(a). P(u). R(u)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let a: P(a)) {
        Q(a).
      }
      for (let a: Q(a)) {
        R(a).
      }
      P(u).
    `)).select(first(`
      R(u)?
    `)))).equalsTo([{}]);
  });

  it("for (let a: P(a)) { for (let b: Q(b)) R(a, b) }. P(u). Q(v). R(u, v)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let a: P(a)) {
        for (let b: Q(b)) {
          R(a, b).
        }
      }
      P(u) Q(v).
    `)).select(first(`
      R(u, v)?
    `)))).equalsTo([{}]);
  });

  it("P(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
    `)).select(first(`
      let x: P(x)?
    `))))
      .equalsTo([{"x": a()}]);
  });

  it("P(a). let x: Q(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
    `)).select(first(`
      let x: Q(x)?
    `))))
      .equalsTo([]);
  });

  it("P(a, b). let x: P(x, b)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a, b).
    `)).select(first(`
      let x: P(x, b)?
    `))))
      .equalsTo([{"x": a()}]);
  });

  it("P(a, b). let x: P(a, x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a, b).
    `)).select(first(`
      let x: P(a, x)?
    `))))
      .equalsTo([{"x": b()}]);
  });

  it("P(a). P(b). let x: P(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
      P(b).
    `)).select(first(`
      let x: P(x)?
    `)))).equalsTo([{"x": a()}, {"x": b()}]);
  });

  it("P(a). Q(a). let x: P(x) Q(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
      Q(a).
    `)).select(first(`
      let x: P(x) Q(x)?
    `))))
      .equalsTo([{"x": a()}]);
  });
  
  it("P(a). Q(a). R(b). let x: P(x) Q(x) R(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
      Q(a).
      R(b).
    `)).select(first(`
      let x: P(x) Q(x) R(x)?
    `))))
      .equalsTo([]);
  });
  
  it("P(a). Q(a). R(a). let x: P(x) Q(x) R(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
      Q(a).
      R(a).
    `)).select(first(`
      let x: P(x) Q(x) R(x)?
    `))))
      .equalsTo([{x: literal("a")}]);
  });
  
  it("P(a). Q(b). let x: P(x) Q(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
      Q(b).
    `)).select(first(`
      let x: P(x) Q(x)?
    `))))
      .equalsTo([]);
  });
  
  it("P(a) Q(b). let x: P(x) Q(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a) Q(b).
    `)).select(first(`
      let x: P(x) Q(x)?
    `))))
      .equalsTo([]);
  });

  it("P(a, b). let x, y: P(x, y)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a, b).
    `)).select(first(`
      let x, y: P(x, y)?
    `))))
      .equalsTo([{"x": literal("a"), "y": literal("b")}]);
  });

  it("P(a). Q(b). let x, y: P(x) Q(y)?", () => {
    assertThat(unroll(new KB().push(parse(`
      P(a).
      Q(b).
    `)).select(first(`
      let x, y: P(x) Q(y)?
    `))))
      .equalsTo([{"x": literal("a"), "y": literal("b")}]);
  });

  it("for (let x: P(x)) Q(x). P(a). let x: Q(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x)) Q(x). 
      P(a).
    `)).select(first(`
      let y: Q(y)?
    `)))).equalsTo([{"y": a()}]);
  });

  it("for (let x: P(x) Q(x)) R(x). P(a). Q(a). let x: R(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x) Q(x)) R(x). 
      P(a).
      Q(a).
    `)).select(first(`
      let x: R(x)?
    `))))
      .equalsTo([{"x": a()}]);
  });

  it("for (let x: P(x)) Q(x). for (let x: Q(x)) R(x). P(a). let x: R(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x)) Q(x). 
      for (let x: Q(x)) R(x). 
      P(a).
    `)).select(first(`
      let x: R(x)?
    `))))
      .equalsTo([{"x": a()}]);
  });

  it("for (let x: P(x)) Q(x). for (let x: Q(x)) R(x). P(a). let x: R(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x)) Q(x). 
      for (let x: Q(x)) R(x). 
      P(a).
      P(b).
    `)).select(first(`
      let x: R(x)?
    `))))
      .equalsTo([{"x": a()}, {"x": b()}]);
  });

  it("let x: Q(x) S(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x)) Q(x). 
      for (let x: R(x)) S(x).
      P(a).
      R(a).
      Q(d) S(d).
    `)).select(first(`
      let x: Q(x) S(x)?
    `))))
      .equalsTo([{"x": literal("a")}, {"x": literal("d")}]);
  });
  
  it("for (let x: P(x)) Q(x). for (let x: R(x)) S(x). P(a). R(a). let x: Q(x) S(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x)) Q(x). 
      for (let x: R(x)) S(x). 
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
    assertThat(unroll(new KB().push(parse(`
      not P().
    `)).select(first(`
      P()?
    `)))).equalsTo([false]);
  });

  it("not P(). not P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      not P().
    `)).select(first(`
      not P()?
    `)))).equalsTo([{}]);
  });

  it("not P() Q(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      not P() Q().
    `)).select(first(`
      P()?
    `)))).equalsTo([false]);
  });

  it("not P() Q(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      not P() Q().
    `)).select(first(`
      Q()?
    `)))).equalsTo([false]);
  });

  it("not not P(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      not not P().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("if (P()) not Q(). P(). Q()?", () => {
    assertThat(unroll(new KB().push(parse(`
      if (P()) not Q().
      P().
    `)).select(first(`
      Q()?
    `)))).equalsTo([false]);
  });

  it("if (P(a) Q(b)) not Q(c). P(a). Q(b). Q(c)?", () => {
    assertThat(unroll(new KB().push(parse(`
      if (P(a) Q(b)) not Q(c).
      P(a).
      Q(b).
    `)).select(first(`
      Q(c)?
    `)))).equalsTo([false]);
  });

  it("for (let x: even(x)) not odd(x). even(u). odd(u)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: even(x))
        not odd(x).
      even(u).
    `)).select(first(`
      odd(u)?
    `)))).equalsTo([false]);
  });

  it("either P() or Q(). not Q(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      either P() or Q().
      not Q().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("either P() or Q(). not Q(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      either P() or Q().
      not Q().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("either P() Q() or R(). not R(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      either P() Q() or R().
      not R().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("either R() or P() Q(). not R(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      either R() or P() Q().
      not R().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("either P(a) or Q(a). not Q(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      either P(a) or Q(a).
      not Q(a).
    `)).select(first(`
      let x: P(x)?
    `)))).equalsTo([{"x": literal("a")}]);
  });

  it("for (let x: U(x)) either P(x) or Q(x). not Q(a). U(a). let x: P(x)?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: U(x)) {
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
    assertThat(unroll(new KB().push(parse(`
      either not P() or Q().
      not Q().
    `)).select(first(`
      not P()?
    `)))).equalsTo([{}]);
  });

  it("for (let x: R(x)) P(x) Q(x). P(c) Q(c)?", () => {
    assertThat(unroll(new KB().push(parse(`
    for (let x: R(x)) {
      P(x) Q(x).
    }
    R(c).
    `)).select(first(`
      P(c) Q(c)?
    `)))).equalsTo([{}]);
  });
  
  it("P() and Q(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P() and Q().
    `)).select(first(`
      P()?
    `)))).equalsTo([{}]);
  });

  it("P() and Q() and R(). P() and R()?", () => {
    assertThat(unroll(new KB().push(parse(`
      P() and Q() and R().
    `)).select(first(`
      P() and R()?
    `)))).equalsTo([{}]);
  });

  it("P() and Q() and R(). P()?", () => {
    assertThat(unroll(new KB().push(parse(`
      (P(a). Q(a).) and (U(b). V(b).).
    `)).select(first(`
      let x: P(x)?
    `)))).equalsTo([{"x": literal("a")}]);
  });

  it("if (P()) Q(). if (P()) Q()?", () => {
    assertThat(unroll(new KB().push(parse(`
      if (P()) Q(). 
    `)).select(first(`
      if (P()) { 
        Q(). 
      } ?
    `)))).equalsTo([{}]);
  });

  it("if (P(a)) Q(b). if (P(b)) Q(a)?", () => {
    assertThat(unroll(new KB().push(parse(`
      if (P(a)) Q(b). 
    `)).select(first(`
      if (P(b)) {
        Q(a). 
      } ?
    `)))).equalsTo([]);
  });

  it("if (P()) Q() R(). if (P()) Q()?", () => {
    assertThat(unroll(new KB().push(parse(`
      if (P()) Q() R(). 
    `)).select(first(`
      if (P()) {
        Q(). 
      } ?
    `)))).equalsTo([{}]);
  });

  it("if (P()) R(). if (Q()) R(). if (P() Q()) R()?", () => {
    assertThat(unroll(new KB().push(parse(`
      if (P()) R(). 
      if (Q()) R(). 
    `)).select(first(`
      if (P() Q()) {
        R(). 
      } ?
    `)))).equalsTo([{}]);
  });

  it("if (P()) Q(). if (Q()) R(). if (P()) R()?", () => {
    assertThat(unroll(new KB().push(parse(`
      if (P()) Q(). 
      if (Q()) R(). 
    `)).select(first(`
      if (P()) {
        R(). 
      } ?
    `)))).equalsTo([{}]);
  });

  it("for (let x: P(x)) { Q(x). } for (let y: P(y)) { Q(y). } ?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x)) Q(x).
    `)).query(
      FORALL([P(["y", "every"])], Q(["y", "every"])))))
      .equalsTo([{}]);
  });

  it("for (let x: P(x)) { Q(x). } for (let x: P(x)) { Q(x). } ?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x)) {
        Q(x).
      }
    `)).select(first(`
      for (let y: P(y)) {
        Q(y).
      } ?
    `)))).equalsTo([{}]);
  });

  it("for (let x: P(x)) { Q(x) R(x). } for (let x: P(x)) { R(x). } ?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x)) {
        Q(x) R(x).
      }
    `)).select(first(`
      for (let y: P(y)) {
        R(y).
      } ?
    `)))).equalsTo([{}]);
  });

  it("for (let x: P(x) Q(x)) { R(x). } for (let x: P(x) Q(x)) { R(x). } ?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x) Q(x)) {
        R(x).
      }
    `)).select(first(`
      for (let y: P(y) Q(y)) {
        R(y).
      } ?
    `)))).equalsTo([{}]);
  });

  it("for (let x: P(x)) { Q(x). } for (let x: Q(x)) { R(x). } for (let x: P(x)) { R(x). } ?", () => {
    assertThat(unroll(new KB().push(parse(`
      for (let x: P(x)) {
        Q(x).
      }
      for (let x: Q(x)) {
        R(x).
      }
    `)).select(first(`
      for (let y: P(y)) {
        R(y).
      } ?
    `)))).equalsTo([{}]);
  });

  it.skip("for (let x: P(x)) R(x). for (let y: P(y) Q(y)) R(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let x: P(x)) {
        R(x).
      }
      for (let y: P(y) Q(y)) {
        R(y).
      } ?
    `))).equalsTo([{}]);
  });
});

describe.skip("Tracing", () => {
  it("P(). P()?", () => {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      P().
    `))).equalsTo([]);
    kb.trace();
    assertThat(unroll(kb.read(`
      P()?
    `))).equalsTo([{}]);
    assertThat(kb.done()).equalsTo([
      ["Q", QUERY(P()), []]
    ]);
  });

  it("if (P()) Q(). Q()?", () => {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      if (P()) Q().
    `))).equalsTo([]);
    kb.trace();
    assertThat(unroll(kb.read(`
      Q()?
    `))).equalsTo([]);
    assertThat(kb.done()).equalsTo([
      ["Q", QUERY(Q()), []],
      ["Q", QUERY(P()), [QUERY(Q())]]
    ]);
  });

  it("if (P()) Q(). if (Q()) P(). Q()?", () => {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      if (P()) Q().
      if (Q()) P().
    `))).equalsTo([]);
    kb.trace();
    assertThat(unroll(kb.read(`
      Q()?
    `))).equalsTo([]);
    assertThat(kb.done()).equalsTo([
      ["Q", QUERY(Q()), []],
      ["Q", QUERY(P()), [QUERY(Q())]],
      ["C", QUERY(Q()), [QUERY(Q()), QUERY(P())]]
    ]);
  });

  it("for (let x: P(x)) Q(x). let y: Q(y)?", () => {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      for (let x: P(x)) Q(x).
      for (let x: Q(x)) P(x).
    `))).equalsTo([]);
    kb.trace();
    assertThat(unroll(kb.read(`
      let y: Q(y)?
    `))).equalsTo([]);
    assertThat(kb.done()).equalsTo([
      ["Q", QUERY(Q(free("y"))), []],
      ["Q", QUERY(P(free("y"))), [QUERY(Q(free("y")))]],
      ["C", QUERY(Q(free("y"))), [QUERY(Q(free("y"))), QUERY(P(free("y")))]],
    ]);
  });

  it("for (let x: P(x)) Q(x). let y: Q(y)?", () => {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      for (let x: U(x)) {
        for (let y: U(y)) {
          P(x, y).
          Q(y, x).
        }
      }
    `))).equalsTo([]);
    kb.trace();
    assertThat(unroll(kb.read(`
      let x, y: Q(x, y)?
    `))).equalsTo([]);
    assertThat(kb.done()).equalsTo([
      ["Q", QUERY(Q(x(), y())), []],
      ["Q", QUERY(U(x()), U(y())), [QUERY(Q(x(), y()))]],
    ]);
  });

  it("", () => {
    const kb = new KB();
    assertThat(unroll(kb.read(`
      for (let x: U(x)) {
        for (let y: U(y)) {
          if (P(x, y)) {
            Q(y, x).
          }
          if (Q(x, y)) {
            P(y, x).
          }
        }
      }
    `))).equalsTo([]);
    kb.trace();
    assertThat(unroll(kb.read(`
      let x, y: Q(x, y)?
    `))).equalsTo([]);
    assertThat(kb.done()).equalsTo([
      ["Q", QUERY(Q(x(), y())), []],
      ["Q", QUERY(P(y(), x()), U(x()), U(y())), [QUERY(Q(x(), y()))]],
      ["Q", QUERY(Q(x(), y()), U(y()), U(x())), [QUERY(Q(x(), y())), QUERY(P(y(), x()), U(x()), U(y()))]],
      ["C", QUERY(P(y(), x()), U(x()), U(y())), [QUERY(Q(x(), y())),
                                                 QUERY(P(y(), x()), U(x()), U(y())),
                                                 QUERY(Q(x(), y()), U(y()), U(x()))]],
    ]);
  });

  
});

describe("forward", () => {
  it.skip("if (P()) Q(). if (Q()) R(). => if (P()) R().", () => {
    const rules = normalize(new Parser().parse(`
      if (P()) Q().
      if (Q()) R().
    `));
    assertThat(rules).equalsTo([
      IF([P()], Q()),
      IF([Q()], R()),
    ]);
    for (let [name1, args1, value1 = true, deps1 = []] of rules) {
      for (let [name2, args2, value2 = true, deps2 = []] of rules) {
        const [[name2, args2]] = deps2;
        if (name1 == name2 && JSON.stringify(args1) == JSON.stringify(args2)) {
        }
      }
    }
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

  it("P(A). Q(A). let a: P(a) Q(a) ?", function() {
    assertThat(unroll(new KB().read(`
      P(A). Q(A).
      let a: P(a) Q(a)?
    `))).equalsTo([{"a": literal("A")}]);
  });

  it("P(A). P(A). let a: P(a)?", function() {
    assertThat(unroll(new KB().read(`
      P(A). P(A).
      let a: P(a)?
    `))).equalsTo([{"a": literal("A")}]);
  });

  it("if (Q(A)) P(A). if (Q(A)) P(A). let a: P(a)?", function() {
    assertThat(unroll(new KB().read(`
      if (Q(A)) P(A). 
      if (Q(B)) P(A).
      Q(A).
      Q(B).
      let a: P(a)?
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

  it("P(u). for (let a: P(a)) Q(a). let x: Q(x)?", function() {
    assertThat(unroll(new KB().read(`
      for (let a: P(a)) 
        Q(a).
      P(u).
      let x: Q(x)?
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("for (let a: P(a)) Q(a). P(u). U(u). U(x) Q(x)?", function() {
    assertThat(unroll(new KB().read(`
      for (let a: P(a)) 
        Q(a).

      P(u). 
      U(u).

      let x: U(x) Q(x)?
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("for (let a: man(a)) mortal(a). Socrates(u). man(u). Socrates(v) mortal(v)?", function() {
    assertThat(unroll(new KB().read(`
      // Every man is mortal.
      for (let a: man(a)) 
        mortal(a).

      // There is a man u, whose name is Socrates.
      Socrates(u). 
      man(u).

      // Is there a man u, whose name is Socrates and who is mortal?
      let x: Socrates(x) mortal(x)?
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("for (let a: P(a)) Q(a). for (every a: Q(a)) R(a). P(u). R(v)?", function() {
    assertThat(unroll(new KB().read(`
      for (let a: P(a)) 
        Q(a).
      for (let a: Q(a)) 
        R(a).
      P(u).
      let x: R(x)?
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("for (let a: P(a)) { Q(a). R(a).} P(u). R(v)?", function() {
    assertThat(unroll(new KB().read(`
      for (let a: P(a)) { 
        Q(a). 
        R(a). 
      }

      P(u).

      let x: R(x)?
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("for (let a: P(a) Q(a)) R(a). P(u). Q(u). R(v)?", function() {
    assertThat(unroll(new KB().read(`
      for (let a: P(a) Q(a)) 
        R(a).

      P(u). R(u).

      let x: R(x)?
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("for (every a: {P(a). Q(a).}) R(a). P(u). Q(u). R(v)?", function() {
    assertThat(unroll(new KB().read(`
      for (let a: {
        P(a). 
        Q(a).
      }) {
        R(a).
      }

      P(u). 
      R(u).

      let x: R(x)?
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("let x: Socrates(x) animal(x)?", function() {
    assertThat(unroll(new KB().read(`
      for (let a: man(a)) 
        human(a).

      for (let a: human(a)) 
        animal(a).

      man(u).
      Socrates(u).

      let x: Socrates(x) animal(x)?
    `))).equalsTo([{"x": literal("u")}]);
  });

  it("if (P()) Q(). P(). Q()?", function() {
    assertThat(unroll(new KB().read(`
      if (P()) {
        Q().
      }
      P().
      Q()?
    `))).equalsTo([{}]);
  });

  it("if (P()) Q(). Q()?", function() {
    assertThat(unroll(new KB().read(`
      if (P()) {
        Q().
      }
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
      for (let a: greek(a) man(a))
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
      for (let a: greek(a) philosopher(a)) {
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
      for (let a: P(a)) {
        for (let b: Q(b)) {
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

  it("if ({ for (let x: man(x)) mortal(x). }) Q(). for (let x: man(x)) mortal(x). Q()?", function() {
    assertThat(unroll(new KB().read(`
      if ({ 
        for (let x: man(x)) {
          mortal(x).
        }
      }) {
        Q().
      }
      for (let x: man(x)) {
        mortal(x).
      }
      Q()?
    `))).equalsTo([{}]);
  });

  it("for (let x: P(x)) Q(x). for (let y: P(y)) Q(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let x: P(x)) {
        Q(x).
      }
      for (let y: P(y)) {
        Q(y).
      } ?
    `))).equalsTo([{}]);
  });

  it("for (let x: P(x)) Q(u, x). for (let y: P(y)) Q(u, y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let x: P(x)) {
        Q(u, x).
      }
      for (let y: P(y)) {
        Q(u, y).
      } ?
    `))).equalsTo([{}]);
  });

  it("if (either P() or Q()) R(). P(). not Q(). R()?", function() {
    assertThat(unroll(new KB().read(`
      if (either P() or Q()) {
        R().
      }
      P().
      not Q().
      R()?
    `))).equalsTo([]);
  });

  it("if (either P() or Q()) R(). either P() or Q(). R()?", function() {
    assertThat(unroll(new KB().read(`
      if (either P() or Q()) {
        R().
      }
      either P() or Q().
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

  it.skip("P(). not Q(). either P() or Q()?", function() {
    assertThat(unroll(new KB().read(`
      P().
      not Q().
      either P() or Q()?
    `))).equalsTo([]);
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

  it("P(). P(). P()?", function() {
    assertThat(unroll(new KB().read(`
      P().
      P().
      P()?
    `))).equalsTo([{}]);
  });

  it("not P(). not P(). P()?", function() {
    assertThat(unroll(new KB().read(`
      not P().
      not P().
      P()?
    `))).equalsTo([false]);
  });

  it("if (P()) Q(). if (P()) Q(). Q()?", function() {
    assertThat(unroll(new KB().read(`
      if (P()) Q().
      if (P()) Q().
      P().
      Q()?
    `))).equalsTo([{}]);
  });

  it("coloring", function() {
    // Based on the following puzzle
    // https://www.cpp.edu/~jrfisher/www/prolog_tutorial/2_1.html
    assertThat(unroll(new KB().read(`
      node(a1).
      node(a2).
      node(a3).
      node(a4).
      node(a5).

      edge(a1, a2).
      edge(a1, a3).
      edge(a1, a4).
      edge(a1, a5).
      edge(a2, a3).
      edge(a2, a4).
      edge(a3, a4).
      edge(a4, a5).

      for (let x: node(x)) {
        for (let y: node(y)) {
          if (edge(x, y)) {
            edge(y, x).
          }
        }
      }

      color(a1, red, a).
      color(a2, blue, a).
      color(a3, green, a).
      color(a4, yellow, a).
      color(a5, blue, a).

      coloring(a).

      let n: edge(a3, n)?
    `))).equalsTo([{
      n: literal("a4")
    }, {
      n: literal("a1")
    }, {
      n: literal("a2")
    }]);
  });

  it("let x, y: Q(x, y)?", () => {
    assertThat(unroll(new KB().read(`
      for (let x: U(x)) {
        for (let y: U(y)) {
          for (let z: U(z)) {
            if (P(z, x) P(z, y)) 
              Q(x, y).
          }        
        }
      }
      U(u) U(a) U(b).
      P(u, a) P(u, b).
      U(v) P(v, a) P(v, b).
      let x, y: Q(x, y)?
    `))).equalsTo([{
      "x": literal("a"),
      "y": literal("b"),
    }, {
      "x": literal("b"),
      "y": literal("a"),
    }]);
  });


  it("let x, y: L(x) Q(x, y))?", () => {
    const kb = new KB();    
    assertThat(unroll(kb.read(`
      for (let x: U(x)) {
        for (let y: U(y)) {
          Q(x, y).
        }
      }
      U(u) U(v).
      L(u).
      let x, y: L(x) Q(x, y)?
    `))).equalsTo([{
      "x": literal("u"),
      "y": literal("u"),
    }, {
      "x": literal("u"),
      "y": literal("v"),
    }]);
  });
  
  it("kinship", function() {
    const kb = new KB();
    assertThat(unroll(kb.read(`

      for (let x: person(x)) {
        for (let y: person(y)) {

          // Every father is a male parent
          if (father(x, y)) {
            male(x) parent(x, y).
          }

          // Every mother is a female parent
          if (mother(x, y)) {
            female(x) parent(x, y).
          }

          // Every male parent is a father
          if (parent(x, y) male(x)) {
            father(x, y).
          }
          // Every female parent is a mother
          if (parent(x, y) female(x)) {
            mother(x, y).
          }

          // If A is a parent of B then B is a child of A
          if (parent(x, y)) {
            child(y, x).
          }

          // Every son is a male child
          if (son(x, y)) {
            male(x) child(x, y).
          }

          if (male(x) child(x, y)) {
            son(x, y).
          }

          // Every daughter is a female child
          if (daughter(x, y)) {
            female(x) child(x, y).
          }

          if (female(x) child(x, y)) {
            daughter(x, y).
          }

          // If A is an ancestor of B then B is a descendent of A
          if (ancestor(x, y)) {
            descedent(y, x).
          }

          if (parent(x, y)) {
            // Every parent is an ancestor
            ancestor(x, y).

            // Every parent is an ancestor of its descendents
            for (let z: person(z)) {
              if (ancestor(y, z)) {
                ancestor(x, z).
              }
            }
          }

          // If there is a person z who is a parent of x and y
          // then x and y are siblings
          for (let z: person(z)) {
            if (parent(z, x) parent(z, y)) {
              sibling(x, y).
            }
          }
 
          if (sibling(x, y)) {
            sibling(y, x).

            if (male(x)) {
              brother(x, y).
            }

            if (female(x)) {
              sister(x, y).
            }
          }

          if (brother(x, y)) {
            male(x) sibling(x, y).
          }

          if (sister(x, y)) {
            female(x) sibling(x, y).
          }
        }
      }
    `))).equalsTo([
    ]);

    assertThat(unroll(kb.read(`
      Sam(u) person(u).
      Dani(v) person(v).

      Leo(p) person(p) male(p).
      Anna(q) person(q) female(q).
      Arthur(r) person(r) male(r).

      father(u, p).
      father(u, q).
      father(u, r).

      mother(v, p).
      mother(v, q).
      mother(v, r).
    `))).equalsTo([]);

    const child = (...args) => ["child", args, true];
    const parent = (...args) => ["parent", args, true];
    const father = (...args) => ["father", args, true];
    const mother = (...args) => ["mother", args, true];
    const person = (...args) => ["person", args, true];
    const male = (...args) => ["male", args, true];
    const female = (...args) => ["female", args, true];
    const u = () => ["u", "const"];
    const p = () => ["p", "const"];
    const q = () => ["q", "const"];

    // Who is a child of u?
    kb.trace();
    assertThat(unroll(kb.read(`
      let x: child(x, u)?
    `))).equalsTo([{
      "x": literal("p")
    }, {
      "x": literal("q")
    }, {
      "x": literal("r")
    }]);
    
    const log = kb.done();
    assertThat(log[0]).equalsTo(["Q", 0, QUERY(child(x(), u()))]);
    assertThat(log[1]).equalsTo(["Q", 1, QUERY(parent(u(), x()), person(x()), person(u()))]);
    assertThat(log[2]).equalsTo(["Q", 2, QUERY(father(u(), x()), person(x()), person(u()))]);
    assertThat(log[3]).equalsTo(["C", 3, QUERY(parent(u(), x()), male(u()), person(x()), person(u()))]);
    assertThat(log[9]).equalsTo(["H", 2, QUERY(person(q()), person(u()))]);

    assertThat(log.length).equalsTo(19);

    // Is Leo Sam's child?
    assertThat(unroll(kb.read(`
      let x, y: Leo(x) Sam(y) child(x, y)?
    `))).equalsTo([{
      "x": literal("p"),
      "y": literal("u"),
    }]);

    // Is Anna Sam's daughter?
    assertThat(unroll(kb.read(`
      let x, y: Anna(x) Sam(y) daughter(x, y)?
    `))).equalsTo([{
      "x": literal("q"),
      "y": literal("u"),
    }]);

    // Is Arthur Sam's son?
    assertThat(unroll(kb.read(`
      let x, y: Arthur(x) Sam(y) son(x, y)?
    `))).equalsTo([{
      "x": literal("r"),
      "y": literal("u"),
     }]);

    // is Sam a male?
    assertThat(unroll(kb.read(`
      let x: Sam(x) male(x)?
    `))).equalsTo([{
      "x": literal("u")
    }]);

    // Who does Leo descend from?
    assertThat(unroll(kb.read(`
      let x, l: Leo(l) descedent(l, x)?
    `))).equalsTo([{
      "l": literal("p"),
      "x": literal("u")
    }, {
      "l": literal("p"),
      "x": literal("v")
    }]);

    // are Leo and Anna siblings?
    assertThat(unroll(kb.read(`
      let x, y: Leo(x) Anna(y) sibling(x, y)?
    `))).equalsTo([{
      "x": literal("p"),
      "y": literal("q"),       
    }]);

    // what are the pairs of siblings?
    assertThat(unroll(kb.read(`
      let x, y: sibling(x, y)?
    `))).equalsTo([{
      "x": literal("p"),
      "y": literal("q"),      
    }, {
      "x": literal("p"),
      "y": literal("r"),      
    }, {
      "x": literal("q"),
      "y": literal("p"),      
    }, {
      "x": literal("q"),
      "y": literal("r"),      
    }, {
      "x": literal("r"),
      "y": literal("p"),      
    }, {
      "x": literal("r"),
      "y": literal("q"),      
    }]);

    // who are Anna's brothers?
    assertThat(unroll(kb.read(`
      let x, y: brother(x, q)?
    `))).equalsTo([{
      "x": literal("p"),
    }, {
      "x": literal("r"),
    }]);

    assertThat(unroll(kb.read(`
      let x, y: Anna(x) brother(y, x)?
    `))).equalsTo([{
      "x": literal("q"),
      "y": literal("p"),
    }, {
      "x": literal("q"),
      "y": literal("r"),
    }]);
  });

  it("P(a). let x: P(s1)?", function() {
    assertThat(unroll(new KB().read(`
      P(a).
      let s1: P(s1)?
    `))).equalsTo([{s1: literal("a")}]);
  });
  
});


describe("Generalized Quantifiers", () => {
  it("for (let most x: P(x)) Q(x). P(a). Q(a)?", function() {
    assertThat(unroll(new KB().read(`
      for (let most x: P(x)) {
        Q(x).
      }
      P(a).
      Q(a)?
    `))).equalsTo([]);
  });

  it("for (let many x: P(x)) Q(x). P(a). Q(a)?", function() {
    assertThat(unroll(new KB().read(`
      for (let many x: P(x)) {
        Q(x).
      }
      P(a).
      Q(a)?
    `))).equalsTo([]);
  });

  it("for (let few x: P(x)) Q(x). P(a). Q(a)?", function() {
    assertThat(unroll(new KB().read(`
      for (let few x: P(x)) {
        Q(x).
      }
      P(a).
      Q(a)?
    `))).equalsTo([]);
  });

  it("for (let at-least(3) x: P(x)) Q(x). P(a). Q(a)?", function() {
    assertThat(unroll(new KB().read(`
      for (let at-least(3) x: P(x)) {
        Q(x).
      }
      P(a).
      Q(a)?
    `))).equalsTo([]);
  });

  it("for (let at-most(3) x: P(x)) Q(x). P(a). Q(a)?", function() {
    assertThat(unroll(new KB().read(`
      for (let at-most(3) x: P(x)) {
        Q(x).
      }
      P(a).
      Q(a)?
    `))).equalsTo([]);
  });

  it("for (let more-than(3) x: P(x)) Q(x). P(a). Q(a)?", function() {
    assertThat(unroll(new KB().read(`
      for (let more-than(3) x: P(x)) {
        Q(x).
      }
      P(a).
      Q(a)?
    `))).equalsTo([]);
  });

  it("for (let fewer-than(3) x: P(x)) Q(x). P(a). Q(a)?", function() {
    assertThat(unroll(new KB().read(`
      for (let fewer-than(3) x: P(x)) {
        Q(x).
      }
      P(a).
      Q(a)?
    `))).equalsTo([]);
  });

  it("for (let exactly(3) x: P(x)) Q(x). P(a). Q(a)?", function() {
    assertThat(unroll(new KB().read(`
      for (let at-most(3) x: P(x)) {
        Q(x).
      }
      P(a).
      Q(a)?
    `))).equalsTo([]);
  });
});

describe("Syllogisms", () => {

  it("for (let most x: P(x)) Q(x). == for (let most y: P(y)) Q(y)?", () => {
    assertThat(match(
      FORALL([P(y("most"))], Q(y("most"))),
      FORALL([P(x("most"))], Q(x("most")))
    )).equalsTo({"x": ["y", "most"]});
  });
  
  it("for (let most x: P(x)) Q(x). for (let most y: P(y)) Q(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let most x: P(x)) {
        Q(x).
      }
      for (let most y: P(y)) {
        Q(y).
      } ?
    `))).equalsTo([{}]);
  });

  it("for (let most x: P(x)) Q(x). for (let y: P(y)) Q(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let most x: P(x)) {
        Q(x).
      }
      for (let y: P(y)) {
        Q(y).
      } ?
    `))).equalsTo([]);
  });

  it("for (let x: P(x)) Q(x). for (let most y: P(y)) Q(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let x: P(x)) {
        Q(x).
      }
      for (let most y: P(y)) {
        Q(y).
      } ?
    `))).equalsTo([{}]);
  });

  it("for (let most x: P(x)) Q(x). for (let most y: P(y)) R(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let most x: P(x)) {
        Q(x).
      }
      for (let most y: P(y)) {
        R(y).
      } ?
    `))).equalsTo([]);
  });

  it("for (let few x: P(x)) Q(x). for (let few y: P(y)) Q(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let few x: P(x)) {
        Q(x).
      }
      for (let few  y: P(y)) {
        Q(y).
      } ?
    `))).equalsTo([{}]);
  });

  it("for (let few x: P(x)) Q(x) R(x). for (let few y: P(y)) R(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let few x: P(x)) {
        Q(x) R(x).
      }
      for (let few  y: P(y)) {
        R(y).
      } ?
    `))).equalsTo([{}]);
  });

  it("for (let most x: P(x) Q(x)) R(x). for (let most y: P(y)) R(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let most x: P(x) Q(x)) {
        R(x).
      }
      for (let most y: P(y)) {
        R(y).
      } ?
    `))).equalsTo([]);
  });

  it("for (let most x: P(x)) Q(x). => let most x: Q(x) if (P(x)).", () => {
    assertThat(normalize(new Parser().parse(`
      for (let most x: P(x))
        Q(x). 
    `))).equalsTo([
      FORALL([P(x("most"))], Q(x("most")))
    ]);
  });
  
  it("match(for (let most x: P(x)) R(x), for (let y: P(y)) R(y))", () => {
    assertThat(match(
      FOR([P(x("most"))], R(x("most"))),
      FOR([Q(y("every"))], R(y("every")))
    )).equalsTo({"y": ["x", "most"]});
  });

  it("match(for (let most x: P(x)) R(x), for (let y: Q(y)) R(y))", () => {
    assertThat(match(
      FOR([P(x("most"))], R(x("most"))),
      FOR([Q(y("every"))], R(y("every")))
    )).equalsTo({"y": ["x", "most"]});
  });
  
  it("match(for (let most x: P(x)) R(x), for (let most y: Q(y)) R(y))", () => {
    assertThat(match(
      FOR([P(x("most"))], R(x("most"))),
      FOR([Q(y("most"))], R(y("most")))
    )).equalsTo(false);
  });

  it("for (let x: Q(x)) R(x). for (let most x: P(x)) R(x)?", () => {
    assertThat(stepback(q(`
      for (let most y: P(y)) {
        R(y).
      } ?
    `), first(`
      for (let x: Q(x)) {
        R(x).
      }
    `))).equalsTo([{x: ["y", "most"]}, [FOR([P(["y", "most"])], Q(["y", "most"]))]]);
  });

  it("for (let most x: Q(x)) R(x). for (let most y: P(y)) R(y)?", () => {
    assertThat(stepback(q(`
      for (let most y: P(y)) {
        R(y).
      } ?
    `), first(`
      for (let most x: Q(x)) {
        R(x).
      }
    `))).equalsTo(undefined);
  });

  it("for (let most x: P(x)) Q(x). for (let x: Q(x)) R(x). for (let most y: P(y)) R(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let most x: P(x)) {
        Q(x).
      }
      for (let x: Q(x)) {
        R(x).
      }
      for (let most y: P(y)) {
        R(y).
      } ?
    `))).equalsTo([{}]);
  });

  it("for (let most x: P(x)) Q(x). for (let most x: Q(x)) R(x). for (let most y: P(y)) R(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let most x: P(x)) {
        Q(x).
      }
      for (let most x: Q(x)) {
        R(x).
      }
      for (let most y: P(y)) {
        R(y).
      } ?
    `))).equalsTo([]);
  });

  it("for (let many x: P(x)) Q(x). for (let x: Q(x)) R(x). for (let many y: P(y)) R(y)?", function() {
    assertThat(unroll(new KB().read(`
      for (let many x: P(x)) {
        Q(x).
      }
      for (let x: Q(x)) {
        R(x).
      }
      for (let many y: P(y)) {
        R(y).
      } ?
    `))).equalsTo([{}]);
  });

  it("for (let at-least(1) x: P(x)) Q(x). for (let x: Q(x)) R(x). for (let at-least(1) y: P(y)) R(y)?", function() {
    // TODO(goto): we should check for the cardinality too.
    assertThat(unroll(new KB().read(`
      for (let at-least(1) x: P(x)) {
        Q(x).
      }
      for (let x: Q(x)) {
        R(x).
      }
      for (let at-least(1) y: P(y)) {
        R(y).
      } ?
    `))).equalsTo([{}]);
  });

  it("for (let more-than(1) x: P(x)) Q(x). for (let x: Q(x)) R(x). for (let more-than(1) y: P(y)) R(y)?", function() {
    // TODO(goto): we should check for the cardinality too.
    assertThat(unroll(new KB().read(`
      for (let more-than(1) x: P(x)) {
        Q(x).
      }
      for (let x: Q(x)) {
        R(x).
      }
      for (let more-than(1) y: P(y)) {
        R(y).
      } ?
    `))).equalsTo([{}]);
  });


});


describe("Planning", () => {
  it("function f() { Q() } Q()!", () => {
    assertThat(new Parser().parse(`
      function f() {
        Q().
      }
      Q()!
    `)).equalsTo([[
      ["^", "f",
       [],
       [[], [[
         ["Q", []]
       ]]]
      ],
      ["!", 
       [], [[
         ["Q", []]
       ]]
      ]
    ]]);
  });
});

function assertThat(x) {
  return {
    equalsTo(y) {
      Assert.deepEqual(x, y);
    }
  }
}
