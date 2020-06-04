/* ************************************************************************

   Copyright: Henner Kollmann 2020

   License:
     MIT: https://opensource.org/licenses/MIT
     See the LICENSE file in the project's top-level directory for details.

   Authors:
   * Henner Kollmann (hkollmann) Henner.Kollmann@gmx.de

************************************************************************ */
const path = require("path");
const fs = require("fs");      

/**
 * This is the main application class of your custom application "qxl.testnode".
 *
 * If you have added resources to your app, remove the first '@' in the
 * following line to make use of them.
 * @asset(qxl/testnode/*)
 *
 */
qx.Class.define("qxl.testnode.Application",
  {
    extend: qx.application.Basic,
    members:
    {
      main: async function () {
        if (qx.core.Environment.get("runtime.name") == "rhino") {
          qx.log.Logger.register(qx.log.appender.RhinoConsole);
        } else if (qx.core.Environment.get("runtime.name") == "node.js") {
          qx.log.Logger.register(qx.log.appender.NodeConsole);
        }
        let argv = window.minimist(process.argv.slice(2));        
        await this.runTest(argv);
        return this._fail;
      },

      runTest: async function (argv) {
        this._cnt = 0;
        this._fail = 0;
        this._failed = {};

        let namespace = qx.core.Environment.get("testnode.testNameSpace") || "qx.test";
        this.loader = new qx.dev.unit.TestLoaderBasic();
        this.loader.setTestNamespace(namespace);
        let clazzes = this.loader.getSuite().getTestClasses();
        if (argv.class) {
          let matcher = new RegExp(argv.class);
          this.info("# running only test classes that match " + matcher);
          clazzes = clazzes.filter(clazz => clazz.getName().match(matcher));
        }

        let pChain = new qx.Promise(resolve => resolve(true));
        clazzes.forEach(
          clazz => {
            pChain = pChain.then(() =>
              this.runAll(argv, clazz)
                .then(() => {
                  this.info(`# done testing ${clazz.getName()}.`);
                })
            );
          }
        );

        return pChain.then(() => {
          this.info(`1..${this._cnt}`);
        });
      },

      runAll: function (argv, clazz) {
        let that = this;
        this.info(`# start testing ${clazz.getName()}.`);
        let methods = clazz.getTestMethods();
        if (argv.method) {
          let matcher = new RegExp(argv.method);
          this.info("# running only test methods that match " + matcher);
          methods = methods.filter(method => method.getName().match(matcher));
        }

        return new qx.Promise(resolve => {
          let testResult = new qx.dev.unit.TestResult();
          let methodNameIndex = -1;
          let next = () => {
            methodNameIndex++;
            if (methodNameIndex < methods.length) {
              that.loader.runTests(
                testResult,
                clazz.getName(),
                methods[methodNameIndex].getName()
              );
            } else {
              resolve();
            }
          };
          let showExceptions = arr => {
            arr.forEach(item => {
              if (item.test.getFullName) {
                let test = item.test.getFullName();
                that._failed[test] = true;
                that._cnt++;
                that._fail++;
                let message = String(item.exception);
                if (item.exception) {
                  if (item.exception.message) {
                    message = item.exception.message;
                    this.info(`not ok ${that._cnt} - ${test} - ${message}`);
                  } else {
                    this.error("# " + item.exception);
                  }
                }
              } else {
                this.error("Unexpected Error - ", item);
              }
            });
            setTimeout(next, 0);
          };
          testResult.addListener("startTest", evt => {
            this.info("# start " + evt.getData().getFullName());
          });
          testResult.addListener("wait", evt => {
            this.info("# wait " + evt.getData().getFullName());
          });
          testResult.addListener("endMeasurement", evt => {
            this.info("# endMeasurement " + evt.getData()[0].test.getFullName());
          });
          testResult.addListener("endTest", evt => {
            let test = evt.getData().getFullName();
            if (!that._failed[test]) {
              that._cnt++;
              this.info(`ok ${that._cnt} - ` + test);
            }
            setTimeout(next, 0);
          });
          testResult.addListener("failure", evt => showExceptions(evt.getData()));
          testResult.addListener("error", evt => showExceptions(evt.getData()));
          testResult.addListener("skip", evt => {
            that._cnt++;
            let test = evt.getData()[0].test.getFullName();
            that._failed[test] = true;
            this.info(`ok ${that._cnt} - # SKIP ${test}`);
          });
          next();
        });
      },
      _cnt: null,
      _fail: null,
      _failed: null

    }
  });