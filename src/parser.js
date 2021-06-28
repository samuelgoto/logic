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

const grammar = () => build(`
      @builtin "whitespace.ne"
      @builtin "string.ne"
      @builtin "number.ne"

      @{%
        const op = ([a, ws1, op, ws2, b]) => [a, op, b];
      %}

      main -> (_ line):* _ {% ([lines]) => lines.map(([ws, s]) => s ).filter((line) => typeof line != "string") %}

      line -> statement {% id %}
      line -> question {% id %}
      line -> command {% id %}
    
      command -> terminal (__ terminal):* _ "!" {% 
        ([head, tail = []]) => ["!", [head, ...tail.map(([ws1, expression]) => expression)]]  
      %}

      question -> declaration _ "?" {% 
        ([[vars, expression]]) => ["?", vars, expression]
      %}

      declaration -> (letty _ ":" _):? expression {% ([letty, condition]) => [letty ? letty[0] : [], [condition]]%}
      declaration -> iffy {% ([iffy]) => [[], [iffy]] %}
      declaration -> loop {% ([loop]) => [[], [loop]] %}

      statement -> "//" [^\\n]:* [\\n] {% ([start, comment]) => "//" + comment.join("") %}

      statement ->  expression _ "." {% ([expression, ws, dot]) =>  expression %}

      head -> "(" _ condition _ ")" {% ([p1, ws1, condition]) => [[], condition] %}

      statement -> iffy {% id %}
      statement -> loop {% id %}

      iffy -> "if" _ head _ block {% 
        ([iffy, ws1, head, ws2, body]) =>  ["if", head[0], head[1], body] 
      %}

      iffy -> "if" _ head _ block _ "else" _ block {% 
        ([iffy, ws1, head, ws2, body, ws3, elsy, ws4, tail]) =>  ["if", head[0], head[1], body, tail] 
      %}

      letty -> "let" _ variable (_ "," _ variable):* {% 
        ([letty, ws1, arg, args = []]) => [arg, ...args.map(([ws2, comma, ws3, b]) => b)] 
      %}

      condition -> expression {% ([expression]) => [expression] %}
           | block {% id %}

      block -> "{" (_ statement):* _ "}" {% ([c1, statements]) => 
        statements.map(([ws, s]) => s ).filter((statement) => typeof statement != "string") 
      %}
      block -> statement {% ([statement]) => [statement] %}

      # ([lines]) => lines.map(([ws, s]) => s ).filter((line) => typeof line != "string")

      loop -> "for" _ "(" _ "let" _ (quantifier _):? variable _ ":" _ condition _ ")" _ block {% 
        ([forall, ws1, p1, ws2, letty, ws3, quantifier, arg, ws5, col, ws6, head, ws7, p2, ws8, tail]) =>  [quantifier ? quantifier[0] : "every", arg, head, tail] 
      %}

      quantifier -> "every" {% id %}
                 | "all" {% id %}
                 | "most" {% id %}
                 | "many" {% id %}
                 | "few" {% id %}
                 | "only" {% id %}
                 | "at-least(" _ [0-9]:+ _ ")" {% ([op, ws, number]) => op + number.join("") + ")" %}
                 | "at-most(" _ [0-9]:+ _ ")" {% ([op, ws, number]) => op + number.join("") + ")" %}
                 | "more-than(" _ [0-9]:+ _ ")" {% ([op, ws, number]) => op + number.join("") + ")" %}
                 | "fewer-than(" _ [0-9]:+ _ ")" {% ([op, ws, number]) => op + number.join("") + ")" %}
                 | "exactly(" _ [0-9]:+ _ ")" {% ([op, ws, number]) => op + number.join("") + ")" %}

      expression -> disjunction {% id %}

      disjunction -> "either" _ disjunction _ "or" _ conjunction {% 
          ([either, ws1, head, ws2, or, ws3, tail]) => ["either", [], head, tail]
        %}
                  | conjunction {% id %}

      conjunction -> conjunction _ "and" _ negation {% 
          ([left, ws1, and, ws2, right]) => [left, right]
        %}
                  | negation {% id %}

      negation -> "not" _ negation {% ([not, ws, group]) => ["not", group] %}
               | group {% id %}

      group -> "(" _ expression _ ")" {% ([p1, ws1, group]) => group %}
             | "(" (_ statement):* _ ")" {% ([c1, statements]) => statements.map(([ws, s]) => s ) %}
             | list {% id %}

      list -> terminal (__ terminal):* {% 
        ([t1, list = []]) => [t1, ...list.map(([ws1, t]) => t)] 
      %}

      terminal -> predicate _ "(" _ args _ ")" {% ([pred, ws1, p1, ws2, args]) => [pred, args] %}

      terminal -> arg _ ("=" | ">" | "<" | ">=" | "<=") _ arg {% ([arg1, ws1, [op], ws2, arg2]) => [op, [arg1, arg2]] %}

      term -> constant {% id %}

      predicate -> [a-zA-Z\\_] [a-zA-Z\\-\\_]:* {% ([head, body]) => head + body.join("")  %}

      args -> null
      args -> arg (_ "," _ arg):* {% ([arg, list]) => [arg, ...list.map(([ws1, comma, ws2, tail]) => tail)] %}
      arg -> variable {% id %} 
           | constant {% id %}

      variable -> [a-z\\_] [a-zA-Z0-9\\-\\_]:* {% ([head, body]) => head + body.join("")  %}
      constant -> dqstring {% ([str]) => "'" + str + "'" %}
                | sqstring {% ([str]) => "'" + str + "'" %}
                | int {% id %}
                | [A-Z] [a-zA-Z0-9]:* {% ([head, body]) => head + body.join("")  %}
    `);

class Parser {
  constructor(start) {
    // console.log(nearley.Grammar.fromCompiled(grammar()));
    // console.log(start);
    const compiled = grammar();
    if (start) {
      compiled.ParserStart = start;
    }    
    this.parser = new nearley.Parser(nearley.Grammar.fromCompiled(compiled));
  }
  parse(source) {
    const {results} = this.parser.feed(source);
    return results;
  }
}

module.exports = {
  Parser: Parser
};
