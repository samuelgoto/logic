const {Parser} = require("./parser.js");

function isVar(arg) {
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

function preprocess([statements]) {
  const result = [];
  for (const statement of statements) {
    const [op] = statement;
    if (op == "?") {
      const [q, letty, body] = statement;
      statement[2] = preprocess([body]);
      result.push(statement);
    } else if (op == "if" || op == "every") {
      const [iffy, letty, [head], body] = statement;
      for (const part of preprocess([body])) {
        let vars = {};
        if (typeof letty == "string") {
          vars = {[letty]: op};
        }
        part[2] = Object.assign(vars, part[2]);
        if (part[3]) {
          part[3].push(...head);
        } else {
          part[3] = head;
        }
        result.push(part);
      }
    } else {
      result.push(...statement);
    }
  }
  return result;
}

class KB {
  constructor(kb = []) {
    this.kb = kb;
  }
  read(code) {
    const [program] = new Parser().parse(code);
    let result = [];
    load([program]);
    for (const line of program) {
      const [head, body] = line;
      if (head == "?") {
        let [heady, letty, query] = line;
        // console.log(query);
        result.push(this.query(query));
      } else {
        this.push(line);
      }
    }
    return result;
  }
  push(line) {
    // console.log(s);
    let [op] = line;
    if (op == "every" || op == "if") {
      this.kb.push(line);
    } else {
      for (let statement of line) {
        this.kb.push(statement);
      }
    }
    // this.kb.push(s);
    return true;
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

function equals(a, b) {
  if (a[0] != b[0]) {
    return false;
  }
  if (a[1].length != b[1].length) {
    return false;
  }
  const vars1 = b[2] || {};
  const vars2 = a[2] || {};
  const subs = {};
  for (let i = 0; i < a[1].length; i++) {
    if (vars1[b[1][i]]) {
      subs[b[1][i]] = a[1][i];
    } else if (vars2[a[1][i]]) {
      subs[a[1][i]] = b[1][i];
    } else if (a[1][i] != b[1][i]) {
      return false;
    }
  }
  return subs;
}

function clone(a) {
  return JSON.parse(JSON.stringify(a));
}

function apply(body, subs) {
  for (let part of body) {
    const [name, args] = part;
    for (let i = 0; i < args.length; i++) {
      if (subs[args[i]] &&
          subs[args[i]] != "some" &&
          subs[args[i]] != "every") {
        args[i] = subs[args[i]];
      }
    }
  }
}

class DB {
  constructor() {
    this.rules = [];
  }
  *read(code) {
    const lines = preprocess(new Parser().parse(code));
    for (let line of lines) {
      // console.log(line);
      const [op] = line;
      if (op == "?") {
        yield * this.select(line);
      } else {
        this.insert([line]);
        // yield true;
      }
    }
  }
  insert(lines) {
    this.rules.push(...lines);
    return this;
  }
  *query(q) {
    // console.log(q);
    for (let rule of this.rules) {
      const matches = equals(q, rule);
      if (matches) {
        const [head, args, letty = {}, body = []] = clone(rule);
        if (body.length == 0) {
          yield matches;
          continue;
        }
        
        apply(body, matches);
        const results = this.select(["?", Object.keys(q[2] || []), body]);
        for (let result of results) {
          yield Object.assign(q[2], result);
        }
      }
    }
  }
  *select(line) {
    const [op, letty, body = []] = line;
    
    const vars = Object.fromEntries(
      letty.map((arg) => [arg, "some"]));
    
    // console.log(`Select: ${JSON.stringify(line)}, vars: ${JSON.stringify(vars)}`);
    const [head, ...tail] = body;
    
    const query = clone(head);
    apply([query], vars);
    query[2] = vars;
    
    for (let q of this.query(query)) {
      const partial = clone(vars);
      const rest = clone(tail);
      // console.log(`${JSON.stringify(q)}, partial: ${JSON.stringify(partial)}`);
      if (rest.length == 0) {
        yield Object.assign(clone(partial), q);
        continue;
      }
      Object.assign(partial, q);
      apply(rest, partial);
      // console.log(`Querying ${JSON.stringify(rest)}`);
      for (let r of this.select(["?", letty.filter((x) => !q[x]), rest])) {
        // console.log(r);
        yield Object.assign(clone(partial), r);
      }
    }
  }
}


module.exports = {
  KB: KB,
  unify: unify,
  bind: bind,
  load: load,
  preprocess: preprocess,
  equals: equals,
  DB: DB,
  clone: clone,
  apply: apply,
}
