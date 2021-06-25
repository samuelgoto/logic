const {Parser} = require("./parser.js");

function preprocess(statements) {
  const result = [];
  for (const statement of statements) {
    const [op] = statement;
    if (op == "?") {
      const [q, letty, body] = statement;
      statement[2] = preprocess(body);
      result.push(statement);
    } else if (op == "not") {
      const [not, head] = statement;
      for (const part of preprocess([[head]])) {
        part[2] = {};
        part[3] = [];
        part[4] = !(part[4] == undefined ? true : part[4]);
        result.push(part);
      }
    } else if (op == "either") {
      const [either, letty, head, body] = statement;
      // console.log("hi");
      for (const part of preprocess([[head]])) {
        const rule = clone(part);
        rule[2] = {};
        // rule[3] = ["not", [body]];
        rule[3] = clone(body);
        for (let el of rule[3]) {
          el[4] = false;
        }
        result.push(rule);
      }
      for (const part of preprocess([[body]])) {
        const rule = clone(part);
        rule[2] = {};
        rule[3] = clone(head);
        for (let el of rule[3]) {
          el[4] = false;
        }
        result.push(rule);
      }
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
    } else if (Array.isArray(statement[0])) {
      const conjunction = preprocess(statement);
      result.push(...conjunction);
    } else {
      result.push(statement);
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
      // console.log(matches);
      const [head, args, letty = {}, body = [], pos = true] = clone(rule);
      // console.log(q);
      if (body.length == 0) {
        if (pos == (q[4] == undefined ? true : q[4])) {
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
        // console.log(body);
        // console.log(q);
        if (grounded.length == 0) {
          yield Object.fromEntries(
            Object.entries(matches)
              .map(([key, value]) => [value, key]));
          return;
        }
      }
            
      let letties = Object.keys(q[2])
          .filter((x) => matches[x] == x ? true : !matches[x]);
      const results = this.select(["?", letties, body], path);
      for (let result of results) {
        const mapping = Object.fromEntries(
          Object.entries(matches)
            .filter(([key, value]) => q[2][key]));
        yield pos ? Object.assign(Object.assign(q[2], mapping), result) : false;
      }
    }
  }
  *select(line, path = []) {
    const [op, letty, body = []] = line;
    
    if (path.find((el) => JSON.stringify(el)==JSON.stringify(line))) {
      return;
    }

    path.push(line);

    const vars = Object.fromEntries(
      letty.map((arg) => [arg, "some"]));
    
    // console.log(line);
    
    const [head, ...tail] = body;
    
    const query = clone(head);
    apply([query], vars);
    query[2] = Object.assign(vars, head[2]);

    // console.log(query);
    //console.log(vars);
    //console.log(head);

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
      for (let r of this.select(["?", letty.filter((x) => !q[x]), rest], clone(path))) {
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
