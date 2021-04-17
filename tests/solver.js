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
          // console.log(query);
          result = this.query(query);
        } else {
          let [op] = line;
          if (op == "every" || op == "if") {
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
      //console.log(`Question?`);
      //console.log(q);
      for (const s of this.kb) {
        const binding = unify(q, s);
        if (binding) {
          let result = Object.fromEntries(
            Object.entries(binding)
              .map(([key, value]) => [key.substring(1), value])
          );
          //console.log("hi");
          //console.log(result);
          return result;
        }
      }

      for (const s of this.kb) {
        const [op, vars, head, body] = s;
        if (op == "every" || op == "if") {
          for (let part of body) {
            // console.log(q);
            const match = new KB(part).entails(q);
            if (!match) {
              continue;
            }
            //console.log(match);
            let vars = Object.fromEntries(
              Object.entries(match)
                .map(([key, value]) => [`@${key}`, value])
            );
            // console.log(vars);
            // console.log(match);
            // const dep = head;
            // console.log(head);
            // console.log(head);
            // const dep = head.map((s) => bind(s, vars));
            const dep = head.map(
              (statement) => statement.map(
                (s) => bind(s, vars)));
            let result = this.query(dep);
            if (result) {
              const merged = Object.assign(match, result);
              for (let [key, value] of Object.entries(merged)) {
                const arg = value.substring(1);
                if (result[arg]) {
                  merged[key] = result[arg];
                }
              }
              let [name, args] = q;
              const bindings = {};
              for (let arg of args) {
                // console.log(arg);
                if (arg[0] == "@" && merged[arg.substring(1)]) {
                  // console.log(arg.substring(1));
                  bindings[arg.substring(1)] = merged[arg.substring(1)];
                }
              }
              // console.log(result);
              //console.log(merged);
              //console.log(q);
              //console.log(bindings);
              return bindings;
            }
          }
        }
      }
    }
    query(block) {
      // console.log(statement);
      const result = {};
      for (const statement of block) {
        for (const term of statement) {
          const vars = bind(term, result);
          let binding = this.entails(vars);
          if (!binding) {
            return undefined;
          }
          Object.assign(result, Object.fromEntries(Object.entries(binding).map(([key, value]) => [`@${key}`, value])));
        }
      }
      return Object.fromEntries(Object.entries(result).map(([key, value]) => [key.substring(1), value]));
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
      // console.log(head);
      for (const statement of head) {
        for (const expression of statement) {
          const [name, args] = expression;
          expression[1] = args.map((arg) => mapping[arg] || arg)
        }
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
    assertThat(kb.read("P()?")).equalsTo(undefined);
  });
    
  it("P(). P()?", function() {
    const kb = new KB();
    assertThat(kb.read("P().")).equalsTo(undefined);
    assertThat(kb.read("P()?")).equalsTo({});
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

  it("P(A). let a: P(a)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A).")).equalsTo(undefined);
    assertThat(kb.read("let a: P(a)?")).equalsTo({"a": "A"});
  });

  it("P(A, B). let a, b: P(a, b)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A, B).")).equalsTo(undefined);
    assertThat(kb.read("let a, b: P(a, b)?")).equalsTo({"a": "A", "b": "B"});
  });

  it("P(A, B). let b: P(A, b)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A, B).")).equalsTo(undefined);
    assertThat(kb.read("let b: P(A, b)?")).equalsTo({"b": "B"});
  });

  it("P(A). Q(A). let a: P(a) Q(a)?", function() {
    assertThat(new KB().read(`
      P(A). Q(A).
      let a: P(a) Q(a)?
    `)).equalsTo({"a": "A"});
  });

  it("P(A). Q(A). let a: {P(a). Q(a).} ?", function() {
    assertThat(new KB().read(`
      P(A). Q(A).
      let a: {
        P(a). 
        Q(a).
      } ?
    `)).equalsTo({"a": "A"});
  });

  it("P(a). Q(a). let b: P(b) Q(b)?", function() {
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

  it("P(A). let a: P(a) Q(a)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A).")).equalsTo(undefined);
    assertThat(kb.read("let a: P(a) Q(a)?")).equalsTo(undefined);
  });

  it("P(A). Q(B). let a: P(a) Q(a)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A). Q(B).")).equalsTo(undefined);
    assertThat(kb.read("let a: P(a) Q(a)?")).equalsTo(undefined);
  });

  it("P(A). Q(B). let a, b: P(a) Q(b)?", function() {
    const kb = new KB();
    assertThat(kb.read("P(A). Q(B).")).equalsTo(undefined);
    assertThat(kb.read("let a, b: P(a) Q(b)?")).equalsTo({"a": "A", "b": "B"});
  });

  it("Sam(u) Dani(v) loves(u, v). let a, b: Sam(a) Dani(b) loves(a, b)?", function() {
    const kb = new KB();
    assertThat(kb.read(`
      // There is a u named Sam and a v named Dani. u loves v.
      Sam(u) Dani(v) loves(u, v).

      // Is there an "a" Sam who loves a "b" named Dani?
      let a, b: Sam(a) Dani(b) loves(a, b)?
    `)).equalsTo({"a": "u", "b": "v"});
  });

  it("Sam(u) Dani(v) loves(u, v). let a, b: Sam(a) loves(a, b) ?", function() {
    const kb = new KB();
    assertThat(kb.read(`
      Sam(u) Dani(v) loves(u, v). 

      // Who does Sam love?
      let a, b: Sam(a) loves(a, b)?
    `)).equalsTo({"a": "u", "b": "v"});
  });

  it("Sam(u) Dani(v) loves(u, v). let a, b: Sam(a) loves(a, b) ?", function() {
    const kb = new KB();
    assertThat(kb.read(`
      Sam(u) loves(u, v) Dani(v).
      // Who loves Dani?
      let a, b: Dani(b) loves(a, b)?
    `)).equalsTo({"a": "u", "b": "v"});
  });

  it("P(u). for (let every a: P(a)) Q(a). let x: Q(x)?", function() {
    assertThat(new KB().read(`
      for (let every a: P(a)) 
        Q(a).
      P(u).
      let x: Q(x)?
    `)).equalsTo({"x": "u"});
  });

  it("for (let every a: P(a)) Q(a). P(u). U(u). U(x) Q(x)?", function() {
    assertThat(new KB().read(`
      for (let every a: P(a)) 
        Q(a).

      P(u). 
      U(u).

      let x: U(x) Q(x)?
    `)).equalsTo({"x": "u"});
  });

  it("for (let every a: man(a)) mortal(a). Socrates(u). man(u). Socrates(v) mortal(v)?", function() {
    assertThat(new KB().read(`
      // Every man is mortal.
      for (let every a: man(a)) 
        mortal(a).

      // There is a man u, whose name is Socrates.
      Socrates(u). 
      man(u).

      // Is there a man u, whose name is Socrates and who is mortal?
      let x: Socrates(x) mortal(x)?
    `)).equalsTo({"x": "u"});
  });

  it("for (let every a: P(a)) Q(a). for (every a: Q(a)) R(a). P(u). R(v)?", function() {
    assertThat(new KB().read(`
      for (let every a: P(a)) 
        Q(a).
      for (let every a: Q(a)) 
        R(a).
      P(u).
      let x: R(x)?
    `)).equalsTo({"x": "u"});
  });

  it("for (let every a: P(a)) { Q(a). R(a).} P(u). R(v)?", function() {
    assertThat(new KB().read(`
      for (let every a: P(a)) { 
        Q(a). 
        R(a). 
      }

      P(u).

      let x: R(x)?
    `)).equalsTo({"x": "u"});
  });

  it("for (let every a: P(a) Q(a)) R(a). P(u). Q(u). R(v)?", function() {
    assertThat(new KB().read(`
      for (let every a: P(a) Q(a)) 
        R(a).

      P(u). R(u).

      let x: R(x)?
    `)).equalsTo({"x": "u"});
  });

  it("for (every a: {P(a). Q(a).}) R(a). P(u). Q(u). R(v)?", function() {
    assertThat(new KB().read(`
      for (let every a: {
        P(a). 
        Q(a).
      }) {
        R(a).
      }

      P(u). 
      R(u).

      let x: R(x)?
    `)).equalsTo({"x": "u"});
  });

  it("let x: Socrates(x) animal(x)?", function() {
    assertThat(new KB().read(`
      for (let every a: man(a)) 
        human(a).

      for (let every a: human(a)) 
        animal(a).

      man(u).
      Socrates(u).

      let x: Socrates(x) animal(x)?
    `)).equalsTo({"x": "u"});
  });

  it("if (P()) Q(). P(). Q()?", function() {
    assertThat(new KB().read(`
      if (P()) 
        Q().
      P().
      Q()?
    `)).equalsTo({});
  });

  it("if (P()) Q(). Q()?", function() {
    assertThat(new KB().read(`
      if (P()) 
        Q().
      Q()?
    `)).equalsTo(undefined);
  });

  it("if (P() Q()) R(). P(). Q(). R()?", function() {
    assertThat(new KB().read(`
      if (P() Q()) 
        R().
      P(). Q().
      R()?
    `)).equalsTo({});
  });

  it("if (P(a) Q(b)) R(c). P(a). Q(b). let x: R(x)?", function() {
    assertThat(new KB().read(`
      if (P(a) Q(b)) 
        R(c).
      P(a). Q(b).
      let x: R(x)?
    `)).equalsTo({x: "c"});
  });

  it("if (P(a) Q(b)) R(c). P(a). Q(b). let x: R(x)?", function() {
    assertThat(new KB().read(`
      Jones(u).
      Mary(v).

      // If Jones loves Mary, Jones marries her.
      if (loves(u, v)) 
        marry(u, v).

      // Jones loves Mary.
      loves(u, v).

      // Who does Jones marry?
      let x, y: Jones(x) marry(x, y)?
    `)).equalsTo({x: "u", y: "v"});
  });

  function assertThat(x) {
    return {
      equalsTo(y) {
        Assert.deepEqual(x, y);
      }
    }
  }
});

