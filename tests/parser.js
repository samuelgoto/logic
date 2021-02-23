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

  it.only("propositional logic", function() {
    const grammar = build(`
      @builtin "whitespace.ne"
      main -> (_ proposition _ "."):* _ {% ([propositions]) => propositions.map(([ws, constant]) => constant ) %}
      proposition -> disjunction {% id %}
      disjunction -> disjunction _ "||" _ conjunction {% ([a, ws1, op, ws2, b]) => [a, op, b] %}
                   | conjunction {% id %}
      conjunction -> conjunction _ "&&" _ constant {% ([a, ws1, op, ws2, b]) => [a, op, b] %}
                   | constant {% id %}
      constant -> [A-Z] [a-z]:* {% ([head, body]) => head + body.join("")  %}
    `);
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    const {results} = parser.feed(`
      Aa. 
      Bb. 
      A || B. 
      C && D.
    `);
    assertThat(results).equalsTo([[
      "Aa",
      "Bb",
      ["A", "||", "B"],
      ["C", "&&", "D"],
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
