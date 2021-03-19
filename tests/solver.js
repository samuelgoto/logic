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
