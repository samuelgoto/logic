const nearley = require("nearley");
const compile = require("nearley/lib/compile");
const generate = require("nearley/lib/generate");
const nearleyGrammar = require("nearley/lib/nearley-language-bootstrapped");

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

const grammar = build(`
      @builtin "whitespace.ne"
      @builtin "string.ne"

      @{%
        const op = ([a, ws1, op, ws2, b]) => [a, op, b];
      %}

      main -> (_ statement):* _ {% ([statements]) => statements.map(([ws, s]) => s ) %}

      statement -> expression _ "." {% ([prop, ws, dot]) =>  [prop, dot]%}

      statement -> "if" _ "(" _ expression _ ")" _ statement {% 
        ([iffy, ws1, p1, ws2, head, ws3, p2, ws4, body]) =>  ["if", head, body] 
      %}

      statement -> "if" _ "(" _ expression _ ")" _ statement _ "else" _ statement {% 
        ([iffy, ws1, p1, ws2, head, ws3, p2, ws4, body, ws5, elsy, ws6, tail]) =>  ["if", head, body, tail] 
      %}

      statement -> "{" (_ statement):* _ "}" {% ([c1, statements]) => statements.map(([ws, s]) => s ) %}

      statement -> expression _ "?" {% ([prop, ws, q]) => [prop, q] %}

      statement -> "for" _ "(" _ quantifier _ variable _ ")" _ statement {% 
        ([forall, ws1, p1, ws2, quantifier, ws3, args, ws4, p2, ws5, expr]) =>  [quantifier, args, expr] 
      %}

      quantifier -> "every" {% id %}
                 | "most" {% id %}
                 | "many" {% id %}
                 | "few" {% id %}
                 | "only" {% id %}

      expression -> implication {% id %}

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

      term -> constant {% id %}

      predicate -> [a-zA-Z]:+ {% ([body]) => body.join("")  %}

      args -> null
      args -> arg (_ "," _ arg):* {% ([arg, list]) => [arg, ...list.map(([ws1, comma, ws2, tail]) => tail)] %}
      arg -> variable {% id %} 
           | constant {% id %}

      variable -> [a-z] [a-zA-Z]:* {% ([head, body]) => head + body.join("")  %}
      constant -> [A-Z] [a-zA-Z]:* {% ([head, body]) => head + body.join("")  %}

    `);

class Parser {
  constructor() {
    this.parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  }
  parse(source) {
    const {results} = this.parser.feed(source);
    return results;
  }
}

module.exports = {
  Parser: Parser
};
