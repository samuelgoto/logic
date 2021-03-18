const assert = require("assert");
const {Solver, atMostOne, or} = require("logic-solver");


describe("Solver", function() {
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
