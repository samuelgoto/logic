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
    } else if (op == "if" ||
               op == "for") {
      const [iffy, letty, [head], body] = statement;
      const vars = Object.fromEntries([letty] || []);
      Object.assign(scope, vars);
      const heady = head ? normalize([head], scope) : [];
      for (const part of normalize([body], scope)) {
        const p = clone(part);
        if (p[3]) {
          p[3].push(...heady);
        } else {
          p[3] = heady;
        }
        result.push(p);
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

function free([name, type]) {
  return type == "free" || type == "every";
}

function match(a, b) {
  if (a[0] != b[0]) {
    return false;
  }
  if (a[1].length != b[1].length) {
    return false;
  }

  //console.log(a);
  //console.log(b);
  
  const subs = {};
  for (let i = 0; i < a[1].length; i++) {
    const arg1 = a[1][i];
    const arg2 = b[1][i];
    const [name1, type1] = arg1;
    const [name2, type2] = arg2;

    if (free(arg2) && (free(arg1) || type1 == "const")) {
      subs[name2] = arg1;
      continue;
    }

    if (free(arg1) && (free(arg2) || type2 == "const")) {
      subs[name1] = arg2;
      continue;
    }

    if (type1 == type2 &&
        type1 != "const" &&
        type2 != "const") {
      // console.log("hi");
      // console.log(JSON.stringify(a[3]));
      // console.log(JSON.stringify(b[3]));
      const deps1 = a[3];
      const deps2 = b[3];
      if (deps1.length != deps2.length) {
        return false;
      }
      for (let i = 0; i < deps1.length; i++) {
        if (deps1[i][0] != deps2[i][0]) {
          // The names of the dependencies need to match.
          // TODO(goto): this is probably very brittle.
          return false;
        }
      }
      subs[name2] = arg1;
      continue;
    }

    // right monotonicity
    const right = {
      "most": "up",
      "many": "up",
      "every": "up",
      "some": "up",
      "at-least": "up",
      "more-than": "up",
    };

    // console.log(type1);
    if (type2 == "every" && right[type1] == "up") {
      subs[name2] = arg1;
      continue;
    }
    
    if (type1 != type2) {
      return false;
    }

    if (name1 != name2) {
      return false;
    }
  }
  return subs;
}

function clone(a) {
  return JSON.parse(JSON.stringify(a));
}

function apply(body, subs) {
  const result = clone(body);
  for (let part of result) {
    const [name, args] = part;
    for (let i = 0; i < args.length; i++) {
      const [name, type] = args[i];
      // console.log(name);
      if (subs[name]) {
        args[i] = subs[name];
      }
    }
  }
  return result;
}

function stepback(q, rule) {
  const matches = match(q, rule);

  if (!matches) {
    return undefined;
  }
  
  const [name, args, value = true, deps = []] = rule;
  const [ , , ask = true, conds = []] = q;

  const result = apply(deps, matches);
  
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
    if (conds.length > 0 && deps.length > 0) {
      // check if every binding matches in type
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
    //console.log(JSON.stringify(all));
    //console.log(JSON.stringify(q[3]));
    const [name, args, ask = true] = q;
    if (all.length > 0) {
      for (let part of all) {
        part[3] = q[3];
      }
      //console.log("hi");
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

function equals(a, b) {
  return JSON.stringify(a) == JSON.stringify(b);
}

function empty(a) {
  return Object.keys(a).length == 0;
}

function assign(a, b) {
  const result = clone(a);
  for (let key of Object.keys(result)) {
    if (b[key]) {
      result[key] = b[key];
    }
  }
  return result;
}

class KB {
  constructor(rules = {}) {
    this.rules = rules;
    this.cache = {};
  }
  log(entry) {
    if (this.tracing) {
      // console.log(entry);
      this.tracing.push(entry);
    }
  }
  trace() {
    this.tracing = [];
    return this;
  }
  done() {
    const result = this.tracing;
    delete this.tracing;
    return result;
  }
  *load(lines) {
    const q = [];
    // console.log(lines);
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
  *read(code) {
    const lines = normalize(new Parser().parse(code));
    yield * this.load(lines);
  }
  push(lines) {
    for (let line of lines) {
      const [name] = line;
      this.rules[name] = this.rules[name] || []
      this.rules[name].push(line);
    }
    return this;
  }
  *query(q, path, level) {
    const rules = this.rules[q[0]] || [];

    const bindings = [];
    
    for (let rule of rules) {

      const result = stepback(q, rule);

      if (result == undefined) {
        continue;
      }

      const [value, deps] = result;

      if (deps.length == 0) {
        // If this was a binding that we had already found, skip
        if (bindings.find((binding) => equals(binding, value))) {
          continue;
        }
        bindings.push(value);

        yield value;

        // console.log(value);
        
        if (empty(value)) {
          return;
        }
        continue;
      }

      const results = this.select(["?", deps], path, level);

      const free = q[1]
            .filter(([name, type]) => type == "free");

      const mapping = Object.fromEntries(
        Object.entries(value)
          .filter(([key, value]) => free.map(([name]) => name).includes(key)));

      const filter = Object.fromEntries(free);
      
      for (let result of results) {
        if (!value) {
          yield false;
          return;
        }

        // If this was a binding that we had already found, skip
        const merged = assign(filter, Object.assign(mapping, result));
        if (bindings.find((binding) => equals(binding, merged))) {
          continue;
        }
        bindings.push(merged);

        //console.log("query: ");
        //console.log(Object.assign(mapping, result));
        yield clone(Object.assign(mapping, result));

        if (empty(merged)) {
          return;
        }
      }
    }
  }
  resolve(line, result) {
    const key = JSON.stringify(line);
    this.cache[key] = this.cache[key] || [];
    this.cache[key].push(result);
    return result;
  }
  *select(line, path = [], level = 0) {
    const [op, body = []] = line;

    // Tests if the current line of investigation is
    // a subset of any past line of investigation.
    
    if (path.find(([, previous]) => {
      for (let part of previous) {
        const [, current] = line;
        if (!current.find((el) => equals(el, part))) {
          return false;
        }
      }
      return true;
    })) {
      this.log(["C", level, line]);
      return;
    }
    
    const hit = this.cache[JSON.stringify(line)];
    if (hit) {
      this.log(["H", level, line]);
      for (const entry of hit) {
        yield entry;
      }
      return;
    }
    
    this.log(["Q", level, line]);

    path.push(clone(line));

    const [head, ...tail] = body;

    // console.log(line);
    
    const query = clone(head);

    const free = Object.fromEntries(
      query[1].filter(([name, type]) => type == "free"));
    
    for (let q of this.query(query, clone(path), level + 1)) {
      // console.log(q);
      if (q == false) {
        yield this.resolve(line, false);
        return;
      }
      if (tail.length == 0) {
        //console.log(q);
        //console.log(JSON.stringify(line));
        //console.log(assign(free, q));
        //console.log("no tail");
        //console.log(free);
        //console.log(q);
        //console.log(assign(free, q));
        yield this.resolve(line, assign(free, q));
        continue;
      }
      const rest = apply(tail, q);
      for (let r of this.select(["?", rest], clone(path), level + 1)) {
        //console.log(JSON.stringify(line));
        //console.log(q);
        //console.log(r);
        //console.log(Object.assign(q, r));
      
        yield this.resolve(line, clone(Object.assign(q, r)));
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
