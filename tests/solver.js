const Assert = require("assert");
const {Parser} = require("../src/parser.js");

function isVar(arg) {
  //return arg.match(/[a-z]+/);
  return arg[0] == "@";
}

function arrayEquals(a, b) {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }

  const result = {};
  
  for (var i = 0; i < a.length; ++i) {
    if (a[i] == b[i]) {
      continue;
    } else if (isVar(a[i])) {
      if (result[a[i]] && result[a[i]] != b[i]) {
        // conflict
        return false;
      }
      result[a[i]] = b[i];
    } else if (isVar(b[i])) {
      if (result[b[i]] && result[b[i]] != a[i]) {
        // conflict
        return false;
      }
      result[b[i]] = a[i];
    } else if (a[i] !== b[i]) {
      // constant conflict
      return false;
    }
  }

  return result;
}

function unify(a, b) {
  if (a[0] != b[0]) {
    return false;
  }
  return arrayEquals(a[1], b[1]);
}

function bind([name, args], bindings) {
  let result = [];
  for (let arg of args) {
    result.push(bindings[arg] || arg);
  }
  return [name, result];
}

describe("REPL", function() {
  class KB {
    constructor(kb = []) {
      this.kb = kb;
    }
    read(code) {
      const [program] = new Parser().parse(code);
      let result;
      load([program]);
      for (const line of program) {
        const [head, body] = line;
        if (head == "?") {
          let [heady, letty, query] = line;
          result = this.query(query);
        } else {
          let [op] = line;
          if (op == "every") {
            this.push(line);
          } else {
            for (let statement of line) {
              this.push(statement);
            }
          }
        }
      }
      return result;
    }
    push(s) {
      // console.log(s);
      this.kb.push(s);
    }
    entails(q) {
      //console.log("question");
      //console.log(q);
      for (const s of this.kb) {
        //console.log(s);
        const binding = unify(q, s);
        if (binding) {
          // console.log(binding);
          // console.log(s);
          let result = Object.fromEntries(
            Object.entries(binding)
              .map(([key, value]) => [key.substring(1), value])
          );
          // console.log(result);
          return result;
          // return binding;
        }
      }

      for (const s of this.kb) {
        const [op, vars, head, body] = s;
        // console.log(s);
        // console.log(s);
        if (op == "every") {
          // console.log(body);
          for (let part of body) {
            // console.log(q);
            const match = new KB(part).entails(q);
            if (!match) {
              continue;
            }
            // console.log("match!");
            // console.log(head);
            // console.log(match);
            let vars = Object.fromEntries(
              Object.entries(match)
                .map(([key, value]) => [value, `@${value}`])
            );
            //console.log(vars);
            // console.log(head.map((s) => bind(s, vars)));
            let result = this.query(head.map((s) => bind(s, vars)));
            if (result) {
              //console.log(q);
              //console.log(match);
              //console.log(result);
              // console.log(result);
              return Object.fromEntries(
                Object.entries(match)
                  .map(([key, value]) => [key, result[value]])
                  .filter(([key, value]) => key != value)
              );
            }
          }
        }
      }
    }
    query(list) {
      //console.log(list);
      //for (let q of list) {
      //  q[1] = q[1].map(x => `@${x}`);
      //}
      const result = {};
      for (const q of list) {
        // console.log(q);
        const vars = bind(q, result);
        // console.log(vars);
        let binding = this.entails(vars);
        if (!binding) {
          // console.log("hi");
          return undefined;
        }
        // console.log(result);
        Object.assign(result, Object.fromEntries(Object.entries(binding).map(([key, value]) => [`@${key}`, value])));
        // Object.assign(result, binding);
        // console.log(result);
      }
      // console.log(result);
      return Object.fromEntries(Object.entries(result).map(([key, value]) => [key.substring(1), value]));
      // return result;
    }
  }

  function load([lines]) {
    for (let line of lines) {
      rewrite(line);
    }
    return lines;
  }

  function rewrite(line) {
    const [op, args, head, body] = line;
    if (op == "?" || op == "every") {
      const mapping = {};
      for (const arg of args) {
        mapping[arg] = `@${arg}`;
      }
      for (const expression of head) {
        const [name, args] = expression;
        expression[1] = args.map((arg) => mapping[arg] || arg)
      }
      for (const statement of body || []) {
        for (const expression of statement) {
          const [name, args] = expression;
          expression[1] = args.map((arg) => mapping[arg] || arg)
        }
      }
      return;
    }
  }

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
  
  it("for (every a: P(a)) Q(a). => for (every a: P(@a)) Q(@a)", () => {
    assertThat(load(new Parser().parse(`
      for (every a: P(a)) Q(a).
    `))).equalsTo([
      ["every", "a", [["P", ["@a"]]], [[["Q", ["@a"]]]]]
    ]);
  });
  
  it("for (every a: P(a, b)) Q(a, c). => for (every a: P(@a, b)) Q(@a, c)", () => {
    assertThat(load(new Parser().parse(`
      for (every a: P(a, b)) Q(a, c).
    `))).equalsTo([
      ["every", "a", [["P", ["@a", "b"]]], [[["Q", ["@a", "c"]]]]]
    ]);
  });
  
  it("let a: P(a)? => let a: P(@a)?", () => {
    assertThat(load(new Parser().parse(`
      let a: P(a)?
    `))).equalsTo([
      ["?", ["a"], [["P", ["@a"]]]],
    ]);
  });

  it("P(a). for (every a: P(a)) Q(a). let x: Q(x)?", () => {
    assertThat(load(new Parser().parse(`
      P(a). 
      for (every a: P(a)) Q(a). 
      let x: Q(x)?
    `))).equalsTo([
      [["P", ["a"]]],
      ["every", "a", [["P", ["@a"]]], [[["Q", ["@a"]]]]],
      ["?", ["x"], [["Q", ["@x"]]]],
    ]);
  });

  it("P(). P()?", function() {
    const kb = new KB();
    assertThat(kb.read("P().")).equalsTo(undefined);
    assertThat(kb.read("P()?")).equalsTo({});
  });
    
  it("P()?", function() {
    const kb = new KB();
    assertThat(kb.read("P()?")).equalsTo(undefined);
  });
    
  it("P(). Q()?", function() {
    const kb = new KB();
    assertThat(kb.read("P().")).equalsTo(undefined);
    assertThat(kb.read("Q()?")).equalsTo(undefined);
  });
    
  it("P(). Q(). P()?", function() {
    const kb = new KB();
    assertThat(kb.read("P(). Q().")).equalsTo(undefined);
    assertThat(kb.read("P()?")).equalsTo({});
  });
    
  it("P(). Q(). Q()?", function() {
    const kb = new KB();
    assertThat(kb.read("P(). Q().")).equalsTo(undefined);
    assertThat(kb.read("Q()?")).equalsTo({});
  });
  
  it("P(A). P(A)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A).")).equalsTo(undefined);
    assertThat(kb.read("P(A)?")).equalsTo({});
  });
  
  it("P(A). P(B)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A).")).equalsTo(undefined);
    assertThat(kb.read("P(B)?")).equalsTo(undefined);
  });
    
  it("P(A, B). P(A, B)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A, B).")).equalsTo(undefined);
    assertThat(kb.read("P(A, B)?")).equalsTo({});
  });
  
  it("P(). P()?", function() {
    const kb = new KB();
    assertThat(kb.read("P().")).equalsTo(undefined);
    assertThat(kb.read("P()?")).equalsTo({});
  });
  
  it("P(). Q(). P() Q()?", function() {
    const kb = new KB();
    assertThat(kb.read("P(). Q().")).equalsTo(undefined);
    assertThat(kb.read("P() Q()?")).equalsTo({});
  });
  
  it("P(). Q(). P() R()?", function() {
    const kb = new KB();
    assertThat(kb.read("P(). Q().")).equalsTo(undefined);
    assertThat(kb.read("P() R()?")).equalsTo(undefined);
  });
  
  it("P(A). Q(B). P(A) Q(B)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A). Q(B).")).equalsTo(undefined);
    assertThat(kb.read("P(A) Q(B)?")).equalsTo({});
  });
  
  it("P(A). Q(B). P(A) R(B)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A). Q(B).")).equalsTo(undefined);
    assertThat(kb.read("P(A) R(B)?")).equalsTo(undefined);
  });

  it("P(u). P(x)?", function() {
    assertThat(new KB().read(`
      P(u).
      let x: P(x)?
    `)).equalsTo({"x": "u"});
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

  it("P(A). P(a)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A).")).equalsTo(undefined);
    assertThat(kb.read("let a: P(a)?")).equalsTo({"a": "A"});
  });

  it("P(A, B). P(a, b)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A, B).")).equalsTo(undefined);
    assertThat(kb.read("let a, b: P(a, b)?")).equalsTo({"a": "A", "b": "B"});
  });

  it("P(A, B). P(A, b)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A, B).")).equalsTo(undefined);
    assertThat(kb.read("let b: P(A, b)?")).equalsTo({"b": "B"});
  });

  it("P(A). Q(A). P(a) Q(a)?", function() {
    assertThat(new KB().read(`
      P(A). Q(A).
      let a: P(a) Q(a)?
    `)).equalsTo({"a": "A"});
  });

  it("P(a). Q(a). P(b) Q(b)?", function() {
    assertThat(new KB().read(`
      P(a). Q(a).
      let b: P(b) Q(b)?
    `)).equalsTo({"b": "a"});
  });

  it("P(a). Q(c). P(b) Q(b)?", function() {
    assertThat(new KB().read(`
      P(a). Q(c).
      P(b) Q(b)?
    `)).equalsTo(undefined);
  });

  it("P(A). P(a) Q(a)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A).")).equalsTo(undefined);
    assertThat(kb.read("let a: P(a) Q(a)?")).equalsTo(undefined);
  });

  it("P(A). Q(B). P(a) Q(a)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A). Q(B).")).equalsTo(undefined);
    assertThat(kb.read("let a: P(a) Q(a)?")).equalsTo(undefined);
  });

  it("P(A). Q(B). P(a) Q(b)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A). Q(B).")).equalsTo(undefined);
    assertThat(kb.read("let a, b: P(a) Q(b)?")).equalsTo({"a": "A", "b": "B"});
  });

  it("Sam(u). Dani(v). loves(u, v). Sam(a) Dani(b) loves(a, b)?", function() {
    const kb = new KB();
    assertThat(kb.read("Sam(u). Dani(v). loves(u, v).")).equalsTo(undefined);
    // Does Sam love Dani?
    assertThat(kb.read("let a, b: Sam(a) Dani(b) loves(a, b)?"))
      .equalsTo({"a": "u", "b": "v"});
  });

  it("Sam(u). Dani(v). loves(u, v). Sam(a) loves(a, b) ?", function() {
    const kb = new KB();
    assertThat(kb.read("Sam(u). Dani(v). loves(u, v).")).equalsTo(undefined);
    // Who does Sam love?
    assertThat(kb.read("let a, b: Sam(a) loves(a, b)?"))
      .equalsTo({"a": "u", "b": "v"});
  });

  it("Sam(u). Dani(v). loves(u, v). Sam(a) loves(a, b) ?", function() {
    const kb = new KB();
    assertThat(kb.read("Sam(u). Dani(v). loves(u, v).")).equalsTo(undefined);
    // Who loves Dani?
    assertThat(kb.read("let a, b: Dani(b) loves(a, b)?"))
      .equalsTo({"a": "u", "b": "v"});
  });

  it("P(u). for (every a: P(a)) Q(a). Q(v)?", function() {
    assertThat(new KB().read(`
      for (every a: P(a)) Q(a).
      P(u).
      let v: Q(v)?
    `)).equalsTo({"v": "u"});
  });

  it.skip("for (every a: P(a)) Q(a). P(u). U(u). U(x) Q(x)?", function() {
    assertThat(new KB().read(`
      for (every a: P(a)) Q(a).
      P(u). U(u).
      let x: U(x) Q(x)?
    `)).equalsTo({"x": "u"});
  });

  it.skip("for (every a: man(a)) mortal(a). Socrates(u). man(u). Socrates(v) mortal(v)?", function() {
    assertThat(new KB().read(`
      // Every man is mortal.
      for (every a: man(a)) mortal(a).

      // There is a man u, whose name is Socrates.
      Socrates(u). man(u).

      // Is there a man v, whose name is Socrates and who is mortal?
      Socrates(v) mortal(v)?
    `)).equalsTo({"v": "u"});
  });

  it.skip("for (every a: P(a)) Q(a). for (every a: Q(a)) R(a). P(u). R(v)?", function() {
    assertThat(new KB().read(`
      for (every a: P(a)) Q(a).
      for (every a: Q(a)) R(a).
      P(u).
      R(v)?
    `)).equalsTo({"v": "v"});
  });

  it.skip("for (every a: P(a)) { Q(a). R(a).} P(u). R(v)?", function() {
    assertThat(new KB().read(`
      for (every a: P(a)) { Q(a). R(a). }
      P(u).
      R(v)?
    `)).equalsTo({"v": "u"});
  });

  it.skip("for (every a: {P(a). Q(a).}) R(a). P(u). Q(u). R(v)?", function() {
    assertThat(new KB().read(`
      for (every a: {P(a). Q(a).}) R(a).
      P(x). R(y).
      R(v)?
    `)).equalsTo({"v": "y"});
  });

  function assertThat(x) {
    return {
      equalsTo(y) {
        Assert.deepEqual(x, y);
      }
    }
  }
});

