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

      expression -> implication {% id %}

      implication -> implication _ "=>" _ disjunction {% op %}
                   | disjunction {% id %}

      disjunction -> disjunction _ "||" _ conjunction {% op %}
                   | conjunction {% id %}

      conjunction -> conjunction _ "&&" _ cluster {% op %}
                   | cluster {% id %}

      cluster -> "(" _ expression _ ")" {% ([p1, ws1, prop]) => prop %}
                   | terminal {% id %}

      terminal -> constant {% id %}
      terminal -> predicate _ "(" _ ")" {% ([pred]) => [pred] %}

      constant -> [A-Z] [a-z]:* {% ([head, body]) => head + body.join("")  %}

      predicate -> [a-z]:+ {% ([body]) => body.join("")  %}

    `);
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    const {results} = parser.feed(`
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
      A?
      (A => B) && (B => C)?
      a().
      a() && b() => c().
    `);
    assertThat(results).equalsTo([[
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
      ["A", "?"],
      [[["A", "=>", "B"], "&&", ["B", "=>", "C"]], "?"],
      [["a"], "."],
      [[[["a"], "&&", ["b"]], "=>", ["c"]], "."],
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
