/* ************************************************************************

   Copyright: Henner Kollmann 2020

   License:
     MIT: https://opensource.org/licenses/MIT
     See the LICENSE file in the project's top-level directory for details.

   Authors:
   * Henner Kollmann (hkollmann) Henner.Kollmann@gmx.de

************************************************************************ */
/**
 * This class demonstrates how to define unit tests for your application.
 *
 * Execute <code>qx test</code> to generate a testrunner application
 * and open it from <tt>test/index.html</tt>
 *
 * The methods that contain the tests are instance methods with a
 * <code>test</code> prefix. You can create an arbitrary number of test
 * classes like this one. They can be organized in a regular class hierarchy,
 * i.e. using deeper namespaces and a corresponding file structure within the
 * <tt>test</tt> folder.
 */
qx.Class.define("qxl.testnode.test.DemoTest", {
  extend: qx.dev.unit.TestCase,

  include: [qx.dev.unit.MRequirementsBasic],

  members: {
    /*
    ---------------------------------------------------------------------------
      TESTS
    ---------------------------------------------------------------------------
    */

    /**
     * Here are some simple tests
     */
    testSimple() {
      this.assertEquals(4, 3 + 1, "This should never fail!");
      this.assertFalse(false, "Can false be true?!");
    },

    /**
     * Here are some more advanced tests
     */
    testAdvanced() {
      var a = 3;
      var b = a;
      this.assertIdentical(a, b, "A rose by any other name is still a rose");
      this.assertInRange(
        3,
        1,
        10,
        "You must be kidding, 3 can never be outside [1,10]!"
      );
    },

    hasNodeJs() {
      return qx.core.Environment.get("runtime.name") == "node.js";
    },

    testNodeJs() {
      this.require(["nodeJs"]);
      // test node stuff
    },

    async testAsync() {
      return new Promise(function (resolve) {
        setTimeout(function () {
          // We fulfill the promise !
          resolve();
        }, Math.random() * 2000 + 1000);
      });
    },
  },
});
