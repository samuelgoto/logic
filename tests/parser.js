const assert = require("assert");
const nearley = require("nearley");
const compile = require("nearley/lib/compile");
const generate = require("nearley/lib/generate");
const nearleyGrammar = require("nearley/lib/nearley-language-bootstrapped");

describe("Parser", function() {

  function build(sourceCode) {
    // Parse the grammar source into an AST
    const grammarParser = new nearley.Parser(nearleyGrammar);
    grammarParser.feed(sourceCode);
    const grammarAst = grammarParser.results[0]; // TODO check for errors

    // Compile the AST into a set of rules
    const grammarInfoObject = compile(grammarAst, {});
    // Generate JavaScript code from the rules
    const grammarJs = generate(grammarInfoObject, "grammar");

    // Pretend this is a CommonJS environment to catch exports from the grammar.
    const module = { exports: {} };
    eval(grammarJs);

    return module.exports;
  }

  it("nearley", function() {
    const grammar = build(`
      main -> "foo" | bar
    `);
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    const {results} = parser.feed("foo");
    assertThat(results).equalsTo([["foo"]]);
  });

  it.only("logic", function() {
    const grammar = build(`
      @builtin "whitespace.ne"

      @{%
        const op = ([a, ws1, op, ws2, b]) => [a, op, b];
      %}

      main -> (_ sentence):* _ {% ([sentences]) => sentences.map(([ws, s]) => s ) %}

      sentence -> expression _ "." {% ([prop, ws, dot]) =>  [prop, dot]%}
      sentence -> expression _ "?" {% ([prop, ws, q]) => [prop, q] %}

      expression -> quantification {% id %}

      quantification -> "forall" _ "(" _ args _ ")" _ implication {% 
        ([forall, ws1, p1, ws2, args, ws3, p2, ws4, expr]) =>  ["forall", args, expr] 
      %}
                   | implication {% id %}

      implication -> implication _ "=>" _ disjunction {% op %}
                   | disjunction {% id %}

      disjunction -> disjunction _ "||" _ conjunction {% op %}
                   | conjunction {% id %}

      conjunction -> conjunction _ "&&" _ cluster {% op %}
                   | cluster {% id %}

      cluster -> "(" _ expression _ ")" {% ([p1, ws1, prop]) => prop %}
                   | terminal {% id %}

      terminal -> term {% id %}
      terminal -> predicate _ "(" _ args _ ")" {% ([pred, ws1, p1, ws2, args]) => [pred, args] %}

      term -> [a-zA-Z]:* {% ([body]) => body.join("")  %}

      predicate -> [a-zA-Z]:+ {% ([body]) => body.join("")  %}

      args -> null
      args -> arg (_ "," _ arg):* {% ([arg, list]) => [arg, ...list.map(([ws1, comma, ws2, tail]) => tail)] %}
      arg -> variable {% id %} 
           | constant {% id %}

      variable -> [a-z] [a-zA-Z]:* {% ([head, body]) => head + body.join("")  %}
      constant -> [A-Z] [a-zA-Z]:* {% ([head, body]) => head + body.join("")  %}

    `);
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    const {results} = parser.feed(`
      a. 
      b. 
      Aa. 
      Bb. 
      a || b.
      c && d.
      a || b && c.
      a && b || c.
      a => b.
      a && b => c.
      a => b && c.
      a || b => c.
      a => b || c.
      a && (b => c).
      (a => b) && (b => c).
      (a).
      a?
      (a => b) && (b => c)?
      a().
      a() && b() => c().
      a(b).
      a(b, c).
      a(B, C).
      forall(x) a(x).
      forall(x) a(x) && b(x).
      forall(x) a(x) => b(x).
      forall(x, y) a(x, y).
      forall(x, y, Z) a(x, y, Z).
    `);
    assertThat(results).equalsTo([[
      ["a", "."],
      ["b", "."],
      ["Aa", "."],
      ["Bb", "."],
      [["a", "||", "b"], "."],
      [["c", "&&", "d"], "."],
      [["a", "||", ["b", "&&", "c"]], "."],
      [[["a", "&&", "b"], "||", "c"], "."],
      [["a", "=>", "b"], "."],
      [[["a", "&&", "b"], "=>", "c"], "."],
      [["a", "=>", ["b", "&&", "c"]], "."],
      [[["a", "||", "b"], "=>", "c"], "."],
      [["a", "=>", ["b", "||", "c"]], "."],
      [["a", "&&", ["b", "=>", "c"]], "."],
      [[["a", "=>", "b"], "&&", ["b", "=>", "c"]], "."],
      ["a", "."],
      ["a", "?"],
      [[["a", "=>", "b"], "&&", ["b", "=>", "c"]], "?"],
      [["a", []], "."],
      [[[["a", []], "&&", ["b", []]], "=>", ["c", []]], "."],
      [["a", ["b"]], "."],
      [["a", ["b", "c"]], "."],
      [["a", ["B", "C"]], "."],
      [["forall", ["x"], ["a", ["x"]]], "."],
      [["forall", ["x"], [["a", ["x"]], "&&", ["b", ["x"]]]], "."],
      [["forall", ["x"], [["a", ["x"]], "=>", ["b", ["x"]]]], "."],
      [["forall", ["x", "y"], ["a", ["x", "y"]]], "."],
      [["forall", ["x", "y", "Z"], ["a", ["x", "y", "Z"]]], "."],
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
