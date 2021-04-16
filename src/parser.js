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
      @builtin "number.ne"

      @{%
        const op = ([a, ws1, op, ws2, b]) => [a, op, b];
      %}

      main -> (_ line):* _ {% ([lines]) => lines.map(([ws, s]) => s ).filter((line) => typeof line != "string") %}

      line -> "//" [^\\n]:* [\\n] {% ([start, comment]) => "//" + comment.join("") %}
      line -> statement {% id %}
      line -> question {% id %}
      line -> command {% id %}
    
      command -> terminal (__ terminal):* _ "!" {% 
        ([head, tail = []]) => ["!", [head, ...tail.map(([ws1, expression]) => expression)]]  
      %}
      # command -> "do" _ "(" _ ")" _ block {% ([question, ws1, p1, ws2, p2, ws3, statement]) => ["!", statement] %}

      question -> declaration _ "?" {% 
        ([[vars, expression]]) => ["?", vars, expression]
      %}

      # question -> "do" _ "(" _ (letty _):? ")" _ block _ "?" {% ([question, ws1, p1, ws2, letty, p2, ws3, statement]) => ["?", letty ? letty[0] : [], statement] %}

      statement ->  expression _ "." {% ([expression, ws, dot]) =>  expression %}

      statement -> "if" _ head _ block {% 
        ([iffy, ws1, head, ws2, body]) =>  ["if", head[0], head[1], body] 
      %}

      statement -> "if" _ head _ block _ "else" _ block {% 
        ([iffy, ws1, head, ws2, body, ws3, elsy, ws4, tail]) =>  ["if", head[0], head[1], body, tail] 
      %}

      letty -> "let" _ variable (_ "," _ variable):* {% 
        ([letty, ws1, arg, args = []]) => [arg, ...args.map(([ws2, comma, ws3, b]) => b)] 
      %}

      statement -> "either" _ head  _ "or" _ block {% 
        ([either, ws1, head, ws2, or, ws3, body]) =>  ["either", head[0], head[1], body] 
      %}

      declaration -> (letty _ ":" _):? condition {% ([letty, condition]) => [letty ? letty[0] : [], condition]%}
      condition -> expression {% id %}
           | block {% id %}

      head -> "(" _ declaration _ ")" {% ([p1, ws1, declaration]) => declaration %}

      statement -> "not" _ block {% 
        ([not, ws1, body]) =>  ["not", body] 
      %}

      block -> "{" (_ statement):* _ "}" {% ([c1, statements]) => statements.map(([ws, s]) => s ) %}
      block -> statement {% ([statement]) => [statement] %}

      statement -> "for" _ "(" _ quantifier _ variable _ ":" _ condition _ ")" _ block {% 
        ([forall, ws1, p1, ws2, quantifier, ws3, arg, ws4, col, ws5, head, ws6, p2, ws7, tail]) =>  [quantifier, arg, head, tail] 
      %}

      quantifier -> "every" {% id %}
                 | "all" {% id %}
                 | "most" {% id %}
                 | "many" {% id %}
                 | "few" {% id %}
                 | "only" {% id %}

      expression -> conjunction {% id %}

      conjunction -> terminal (__ terminal):* {% 
        ([t1, conjunction = []]) => [t1, ...conjunction.map(([ws1, t]) => t)] 
      %}

      terminal -> predicate _ "(" _ args _ ")" {% ([pred, ws1, p1, ws2, args]) => [pred, args] %}

      term -> constant {% id %}

      predicate -> [a-zA-Z\\-\\_]:+ {% ([body]) => body.join("")  %}

      args -> null
      args -> arg (_ "," _ arg):* {% ([arg, list]) => [arg, ...list.map(([ws1, comma, ws2, tail]) => tail)] %}
      arg -> variable {% id %} 
           | constant {% id %}

      variable -> [a-z] [a-zA-Z0-9]:* {% ([head, body]) => head + body.join("")  %}
      constant -> dqstring {% ([str]) => "'" + str + "'" %}
                | sqstring {% ([str]) => "'" + str + "'" %}
                | int {% id %}
                | [A-Z] [a-zA-Z0-9]:* {% ([head, body]) => head + body.join("")  %}
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
