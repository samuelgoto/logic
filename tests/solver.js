const assert = require("assert");
const {Solver, atMostOne, or} = require("logic-solver");
const pl = require( "tau-prolog" );

describe("Solver", function() {

  class Interpreter {
    constructor() {
      this.session = pl.create();
    }
    consult(code) {
      const session = this.session;
      return new Promise((resolve, reject) => {
        session.consult(code, {
          success: resolve,
          error: reject
        });
      });
    }
    async query(code) {
      const session = this.session;
      await new Promise((resolve, reject) => {
        session.query(code, {
          success: resolve,
          error: reject
        });
      });

      let result = [];
      for await (let {links} of await this.answer()) {
        const keypairs = Object.entries(links).map(([key, value]) => [key, value.id]);
        // console.log(JSON.stringify(links, undefined, 2));
        result.push(Object.fromEntries(keypairs));
      }

      return result;
    }

    async *answer() {
      const session = this.session;
      const go = () => new Promise((resolve, reject) => {
        session.answer({
          success: (answer) => resolve(answer),
          fail: () => resolve(false),
          error: reject,
          limit: reject,
        });
      });

      do {
        try {
          const answer = await go();
          if (!answer) {
            return;
          }
          // console.log(answer);
          yield answer;
        } catch (e) {
          // console.log(JSON.stringify(e));
          return false;
        }
      } while (true);
    }
  }
  
  it("likes(sam, X)?", async () => {
    const prolog = new Interpreter();
    await prolog.consult(`
      likes(sam, salad).
      likes(dean, pie).
      likes(sam, apples).
      likes(dean, whiskey).
    `);
    assertThat(await prolog.query(`likes(sam, X).`))
      .equalsTo([{X: "salad"}, {X: "apples"}]);
    assertThat(await prolog.query(`likes(X, whiskey).`))
      .equalsTo([{X: "dean"}]);
    assertThat(await prolog.query(`likes(sam, salad).`))
      .equalsTo([{}]);
    assertThat(await prolog.query(`likes(sam, whiskey).`))
      .equalsTo([]);
  });
  
  it("mortal(socrates)?", async () => {
    const prolog = new Interpreter();
    await prolog.consult(`
      man(socrates).
      mortal(X) :- man(X).
    `);
    assertThat(await prolog.query(`mortal(socrates).`))
      .equalsTo([{}]);
    assertThat(await prolog.query(`mortal(foobar).`))
      .equalsTo([]);
    assertThat(await prolog.query(`imortal(socrates).`))
      .equalsTo([]);
  });

  it("likes(sam, dani)?", async () => {
    const prolog = new Interpreter();
    await prolog.consult(`
      loves(sam, dani).
      likes(sam, dani) :- loves(sam, dani).
    `);
    assertThat(await prolog.query(`likes(sam, dani).`))
      .equalsTo([{}]);
    assertThat(await prolog.query(`likes(sam, X).`))
      .equalsTo([{X: "dani"}]);
    assertThat(await prolog.query(`likes(X, dani).`))
      .equalsTo([{X: "sam"}]);
  });

  it("likes(sam, dani)?", async () => {
    const prolog = new Interpreter();
    await prolog.consult(`
      loves(sam, dani).
      likes(sam, dani) :- loves(sam, dani).
    `);
    assertThat(await prolog.query(`likes(sam, dani).`))
      .equalsTo([{}]);
    assertThat(await prolog.query(`likes(sam, X).`))
      .equalsTo([{X: "dani"}]);
    assertThat(await prolog.query(`likes(X, dani).`))
      .equalsTo([{X: "sam"}]);
  });

  it("every brazilian politician is terribly corrupt", async () => {
    const prolog = new Interpreter();
    await prolog.consult(`
      brazilian(foo).
      politician(foo).
      corrupt(X) :- brazilian(X), politician(X).
      terribly-corrupt(X) :- brazilian(X), politician(X).
    `);
    assertThat(await prolog.query(`corrupt(foo).`))
      .equalsTo([{}]);
    assertThat(await prolog.query(`terribly-corrupt(foo).`))
      .equalsTo([{}]);
    assertThat(await prolog.query(`terribly-corrupt(X).`))
      .equalsTo([{X: "foo"}]);
  });

  it("everything is awesome", async () => {
    const prolog = new Interpreter();
    await prolog.consult(`
      awesome(X).
    `);
    assertThat(await prolog.query(`awesome(anything).`))
      .equalsTo([{}]);
  });

  it("A farmer owns a donkey.", async () => {
    const prolog = new Interpreter();
    await prolog.consult(`
      farmer([1]).
      donkey([2]).
      owns([1], [2]).
    `);
    // Does a man on a donkey?
    assertThat(await prolog.query(`farmer(X1), donkey(X2), owns(X1, X2).`))
      .equalsTo([{X1: ".", "X2": "."}]);
  });

  it("Pedro owns a donkey.", async () => {
    const prolog = new Interpreter();
    await prolog.consult(`
        named([1], 'Pedro').
        owns([1],[2]).
        donkey([2]).
    `);
    // Who owns a donkey?
    assertThat(await prolog.query(`named(X1, X), donkey(X2), owns(X1, X2).`))
      .equalsTo([{X: "Pedro", X1: ".", "X2": "."}]);
  });


  it("Every old donkey is gray and furry.", async () => {
    const prolog = new Interpreter();
    await prolog.consult(`
        donkey(foo).
        old(foo).
        consequent(X) :- donkey(X), old(X).
        gray(X) :- consequent(X).
        furry(X) :- consequent(X).
    `);
    assertThat(await prolog.query(`gray(foo).`))
      .equalsTo([{}]);
  });

  it("basic", function() {
    // console.log(Solver);
    const solver = new Solver();
    // Don't invite both Alice and Bob
    solver.require(atMostOne("Alice", "Bob"));
    // Invite either Bob or Charlie
    solver.require(or("Bob", "Charlie"));
    var sol1 = solver.solve();
    assertThat(sol1.getTrueVars()).equalsTo(["Bob"]);
    var sol2 = solver.solveAssuming("Alice");
    assertThat(sol2.getTrueVars()).equalsTo(["Alice", "Charlie"]);
  });

  function assertThat(x) {
    return {
      equalsTo(y) {
        assert.deepEqual(x, y);
      }
    }
  }
});
