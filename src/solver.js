const {Parser} = require("./parser.js");

function preprocess(statements, scope = {}) {
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
      result.push([q, preprocess(body, Object.assign(scope, vars))]);
    } else if (op == "not") {
      const [not, head] = statement;
      for (const part of preprocess([[head]], scope)) {
        const [name, args, value = true] = part;
        part[2] = !value;
        result.push(part);
      }
    } else if (op == "either") {
      const [either, letty, head, body] = statement;
      const left = preprocess([[head]], scope);
      const right = preprocess([[body]], scope);
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
      const heady = preprocess(head, Object.assign(scope, vars));
      for (const part of preprocess([body], scope)) {
        if (part[3]) {
          part[3].push(...heady);
        } else {
          part[3] = heady;
        }
        result.push(part);
      }
    } else if (Array.isArray(statement[0])) {
      const conjunction = preprocess(statement, scope);
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

function equals(a, b) {
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

function stepback(rule, q) {
  const matches = equals(q, rule);

  if (!matches) {
    return undefined;
  }
  
  const [name, args, value = true, deps = []] = rule;
  const [ , , ask = true, conds = []] = q;

  const result = clone(deps);
  apply(result, matches);

  if (conds.length > 0) {
    const all = result.filter((p) => !conds.find((q) => {
      return JSON.stringify(p) == JSON.stringify(q);
    }));
    //console.log(JSON.stringify(result));
    //console.log(JSON.stringify(conds));
    //console.log(JSON.stringify(all));
    if (all.length > 0) {
      return undefined;
    }
    const left = conds.filter((p) => !result.find((q) => {
      return JSON.stringify(p) == JSON.stringify(q);
    }));
    if (left.length == 0) {
      return [matches, []];
    }
    const [name, args, ask = true] = q;
    return [matches, [[name, args, ask, left]]];
  }
  
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

  return [matches, result];
}

class KB {
  constructor() {
    this.rules = [];
  }
  *read(code) {
    const lines = preprocess(new Parser().parse(code));
    const q = [];
    for (let line of lines) {
      const [op] = line;
      if (op == "?") {
        q.push(line);
      } else {
        this.insert([line]);
      }
    }

    if (q.length > 0) {
      yield * this.select(q[q.length - 1]);
    }
  }
  insert(lines) {
    this.rules.push(...lines);
    return this;
  }
  *query(q, path) {
    for (let rule of this.rules) {

      const result = stepback(rule, q);

      if (result == undefined) {
        continue;
      }

      const [value, deps] = result;

      if (deps.length == 0) {
        yield value;
        continue;
      }

      // console.log(JSON.stringify(deps));

      // apply();
      
      const results = this.select(["?", deps], path);

      const free = q[1]
            .filter(([name, type]) => type == "free")
            .map(([name]) => name);
      const mapping = Object.fromEntries(
        Object.entries(value)
          .filter(([key, value]) => free.includes(key)));

      for (let result of results) {
        //console.log("Got a result for:");
        //console.log(JSON.stringify(q));
        //console.log(JSON.stringify(rule));
        //console.log(JSON.stringify(deps));
        //console.log(JSON.stringify(value));
        //console.log(JSON.stringify(result));
        if (!value) {
          yield false;
          continue;
        }
        
        //if (value) {
        //console.log("hi");
        //console.log(Object.assign(mapping, result));
        yield Object.assign(mapping, result);
        //} else {
        // console.log(value);
        // console.log(result);
        // yield result;
        //  yield false;
        //}

        // break;
      }
    }
  }
  *select(line, path = []) {
    const [op, body = []] = line;
    
    if (path.find((el) => JSON.stringify(el)==JSON.stringify(line))) {
      return;
    }

    path.push(line);

    //console.log("Q: " + JSON.stringify(line));
    
    const [head, ...tail] = body;

    const query = clone(head);

    //console.log("> Q: " + JSON.stringify(query));
    for (let q of this.query(query, clone(path))) {

      //console.log("< Q: " + JSON.stringify(query));
      //console.log("< A: " + JSON.stringify(q));
      
      const partial = {};
      if (q == false) {
        yield false;
        return;
      }
      if (tail.length == 0) {
        // console.log("hello");
        yield Object.assign(partial, q);
        continue;
      }
      const rest = clone(tail);
      Object.assign(partial, q);
      apply(rest, partial);
      //console.log("<< Q:" + JSON.stringify(rest));
      for (let r of this.select(["?", rest], clone(path))) {
        //console.log(JSON.stringify(line));
        //console.log(JSON.stringify(q));
        //console.log(JSON.stringify(partial));
        //console.log("Yes! " + JSON.stringify(r));
        //console.log(Object.assign(clone(partial), r));
        yield Object.assign(clone(partial), r);
      }
    }
  }
}


module.exports = {
  stepback: stepback,
  preprocess: preprocess,
  equals: equals,
  KB: KB,
  clone: clone,
  apply: apply,
}
