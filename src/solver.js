const {Parser} = require("./parser.js");

function normalize(statements, scope = {}) {
  const result = [];
  for (const statement of statements) {
    const [op] = statement;
    if (op == "?") {
      const [q, letty, body] = statement;
      const vars = {};
      if (letty) {
        if (Array.isArray(letty)) {
          for (let arg of letty) {
            vars[arg] = "free";
          }
        } else {
          vars[letty] = "free";
        }
      }
      result.push([q, normalize(body, Object.assign(scope, vars))]);
    } else if (op == "not") {
      const [not, head] = statement;
      for (const part of normalize([[head]], scope)) {
        const [name, args, value = true] = part;
        part[2] = !value;
        result.push(part);
      }
    } else if (op == "either") {
      const [either, letty, head, body] = statement;
      const left = normalize([[head]], scope);
      const right = normalize([[body]], scope);
      for (const part of left) {
        const rule = clone(part);
        rule[3] = clone(right);
        for (let el of rule[3]) {
          el[2] = false;
        }
        result.push(rule);
      }
      for (const part of right) {
        const rule = clone(part);
        rule[3] = clone(left);
        for (let el of rule[3]) {
          el[2] = false;
        }
        result.push(rule);
      }
    } else if (op == "if" || op == "every") {
      const [iffy, letty, [head], body] = statement;
      const vars = {};
      if (letty) {
        vars[letty] = "every";
      }
      const heady = normalize([head], Object.assign(scope, vars));
      for (const part of normalize([body], scope)) {
        if (part[3]) {
          part[3].push(...heady);
        } else {
          part[3] = heady;
        }
        result.push(part);
      }
    } else if (Array.isArray(statement[0])) {
      const conjunction = normalize(statement, scope);
      result.push(...conjunction);
    } else {
      const [name, args] = statement;
      const vars = args.map((x) =>
        scope[x] ? [x, scope[x]] : [x, "const"]
      );
      result.push([name, vars, true]);
    }
  }
  return result;
}

function match(a, b) {
  if (a[0] != b[0]) {
    return false;
  }
  if (a[1].length != b[1].length) {
    return false;
  }
  const subs = {};
  for (let i = 0; i < a[1].length; i++) {
    if (b[1][i][1] != "const") {
      subs[b[1][i][0]] = a[1][i];
      continue;
    }

    if (a[1][i][1] != "const") {
      subs[a[1][i][0]] = b[1][i];
      continue;
    }

    if (a[1][i][1] != b[1][i][1]) {
      return false;
    }

    if (a[1][i][0] != b[1][i][0]) {
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
      const [name, type] = args[i];
      // console.log(name);
      if (subs[name]) {
        args[i] = subs[name];
      }
    }
  }
}

function stepback(q, rule) {
  const matches = match(q, rule);

  if (!matches) {
    return undefined;
  }
  
  const [name, args, value = true, deps = []] = rule;
  const [ , , ask = true, conds = []] = q;

  const result = clone(deps);
  apply(result, matches);
  
  if (ask != value) {
    // If the query's polarity disagrees with the
    // rule's polarity, then return false conditionally
    // if there aren't any free variables and return
    // undefined if there are.
    const free = Object.entries(matches)
          .filter(([key, [name, type]]) => type == "free")
          .length > 0;
    return free ? undefined : [false, result];
  }

  if (conds.length == 0) {
    return [matches, result];
  }

  {
    // If both the query and the rule are conditionals,
    // check if every binding matches in type
    if (conds.length > 0 && deps.length > 0) {
      for (let [a, [, expected]] of Object.entries(matches)) {
        for (let [b, type] of q[1]) {
          if (a == b && expected != type) {
            // Make sure that the quantifiers of the variables are
            // the same.
            return undefined;
          }
        }
      }
    }
    
    const all = result.filter((p) => !conds.find((q) => {
      return JSON.stringify(p) == JSON.stringify(q);
    }));
    const [name, args, ask = true] = q;
    if (all.length > 0) {
      for (let part of all) {
        part[3] = q[3];
      }
      return [matches, all];
    }
    const left = conds.filter((p) => !result.find((q) => {
      return JSON.stringify(p) == JSON.stringify(q);
    }));
    if (left.length == 0) {
      return [{}, []];
    }
    return [matches, [[name, args, ask, left]]];
  }
}

class KB {
  constructor() {
    this.rules = [];
  }
  *read(code) {
    const lines = normalize(new Parser().parse(code));
    const q = [];
    for (let line of lines) {
      const [op] = line;
      if (op == "?") {
        q.push(line);
      } else {
        this.push([line]);
      }
    }

    if (q.length > 0) {
      yield * this.select(q[q.length - 1]);
    }
  }
  push(lines) {
    this.rules.push(...lines);
    return this;
  }
  *query(q, path) {
    for (let rule of this.rules) {

      const result = stepback(q, rule);

      if (result == undefined) {
        continue;
      }

      const [value, deps] = result;

      if (deps.length == 0) {
        yield value;
        continue;
      }
      
      const results = this.select(["?", deps], path);

      const free = q[1]
            .filter(([name, type]) => type == "free")
            .map(([name]) => name);

      const mapping = Object.fromEntries(
        Object.entries(value)
          .filter(([key, value]) => free.includes(key)));

      for (let result of results) {
        if (!value) {
          yield false;
          continue;
        }
        yield Object.assign(mapping, result);
      }
    }
  }
  *select(line, path = []) {
    const [op, body = []] = line;
    
    if (path.find((el) => JSON.stringify(el)==JSON.stringify(line))) {
      return;
    }

    path.push(line);

    const [head, ...tail] = body;

    const query = clone(head);

    for (let q of this.query(query, clone(path))) {

      const partial = {};
      if (q == false) {
        yield false;
        return;
      }
      if (tail.length == 0) {
        yield Object.assign(partial, q);
        continue;
      }
      const rest = clone(tail);
      Object.assign(partial, q);
      apply(rest, partial);
      for (let r of this.select(["?", rest], clone(path))) {
        yield Object.assign(clone(partial), r);
      }
    }
  }
}


module.exports = {
  stepback: stepback,
  normalize: normalize,
  match: match,
  KB: KB,
  clone: clone,
  apply: apply,
}
