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
      if (subs[name]) {
        args[i] = subs[name];
      }
    }
  }
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
      const matches = equals(q, rule);
      if (!matches) {
        continue;
      }
      const [head, args, pos = true, body = []] = clone(rule);

      if (body.length == 0) {
        if (pos == (q[2] == undefined ? true : q[2])) {
          yield matches;
        } else {
          yield false;
        }
        continue;
      }

      apply(body, matches);

      const sillogism = Object.entries(matches).find(([key, value]) => {
        return rule[2][key] == "every" && q[2][value] == "every"
      });

      if (sillogism) {
        const grounded = body.filter(([name, args]) => args.find((arg) => {
          return matches[arg];
        }));
        if (grounded.length == 0) {
          yield Object.fromEntries(
            Object.entries(matches)
              .map(([key, value]) => [value, key]));
          return;
        }
      }
            
      const results = this.select(["?", body], path);
      const free = q[1]
            .filter(([name, type]) => type == "free")
            .map(([name]) => name);
      const mapping = Object.fromEntries(
        Object.entries(matches)
          .filter(([key, value]) => free.includes(key)));
      for (let result of results) {
        if (pos) {
          yield Object.assign(mapping, result);
        } else {
          yield false;
        }
      }
    }
  }
  *select(line, path = []) {
    const [op, body = []] = line;
    
    if (path.find((el) => JSON.stringify(el)==JSON.stringify(line))) {
      return;
    }

    path.push(line);

    const vars = {};
    
    const [head, ...tail] = body;

    const query = clone(head);

    for (let q of this.query(query, clone(path))) {
      const partial = clone(vars);
      const rest = clone(tail);
      if (q == false) {
        yield false;
        return;
      }
      if (rest.length == 0) {
        yield Object.assign(clone(partial), q);
        continue;
      }
      Object.assign(partial, q);
      apply(rest, partial);      
      for (let r of this.select(["?", rest], clone(path))) {
        yield Object.assign(clone(partial), r);
      }
    }
  }
}


module.exports = {
  preprocess: preprocess,
  equals: equals,
  KB: KB,
  clone: clone,
  apply: apply,
}
