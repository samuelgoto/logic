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
    
      command -> terminal _ "!" {% ([expression]) => ["!", expression]  %}
      command -> "do" _ "(" _ ")" _ statement _ "?" {% ([question, ws1, p1, ws2, p2, ws3, statement]) => ["!", statement] %}

      question -> terminal _ "?" {% ([expression]) => ["?", expression]  %}
      question -> "question" _ "(" _ ")" _ statement _ "?" {% ([question, ws1, p1, ws2, p2, ws3, statement]) => ["?", statement] %}

      statement ->  terminal _ "." {% ([expression, ws, dot]) =>  expression %}

      statement -> "if" _ "(" _ (letty _):? expression _ ")" _ statement {% 
        ([iffy, ws1, p1, ws2, letty, head, ws3, p2, ws4, body]) =>  ["if", letty ? letty[0] : [], head, body] 
      %}

      statement -> "if" _ "(" _ (letty _):? expression _ ")" _ statement _ "else" _ statement {% 
        ([iffy, ws1, p1, ws2, letty, head, ws3, p2, ws4, body, ws5, elsy, ws6, tail]) =>  ["if", letty ? letty[0] : [], head, body, tail] 
      %}

      letty -> "let" _ variable (_ "," _ variable):* _ ":" {% 
        ([letty, ws1, arg, args = []]) => [arg, ...args.map(([ws2, comma, ws3, b]) => b)] 
      %}

      statement -> "either" _ head  _ "or" _ statement {% 
        ([either, ws1, head, ws2, or, ws3, body]) =>  ["either", head, body] 
      %}

      head -> "(" _ (letty _):? condition _ ")" {% ([p1, ws1, letty, condition]) => [letty ? letty[0] : [], condition] %}
      condition -> expression {% id %}
           | block {% id %}


      statement -> "not" _ statement {% 
        ([not, ws1, body]) =>  ["not", body] 
      %}

      statement -> block {% id %}
      block -> "{" (_ statement):* _ "}" {% ([c1, statements]) => statements.map(([ws, s]) => s ) %}

      statement -> "for" _ "(" _ quantifier _ variable _ ":" _ expression _ ")" _ statement {% 
        ([forall, ws1, p1, ws2, quantifier, ws3, arg, ws4, col, ws5, head, ws6, p2, ws7, tail]) =>  [quantifier, arg, head, tail] 
      %}

      quantifier -> "every" {% id %}
                 | "all" {% id %}
                 | "most" {% id %}
                 | "many" {% id %}
                 | "few" {% id %}
                 | "only" {% id %}

      expression -> conjunction {% id %}

      conjunction -> terminal (_ "&&" _ terminal):* {% 
        ([t1, conjunction = []]) => [t1, ...conjunction.map(([ws1, op, ws2, t]) => t)] 
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
