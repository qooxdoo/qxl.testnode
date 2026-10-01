const path = require("path");
const child_process = require("child_process");
const { performance } = require("perf_hooks");

qx.Class.define("qxl.testnode.LibraryApi", {
  extend: qx.tool.compiler.cli.api.LibraryApi,
  members: {
    initialize(cmd) {
      if (cmd.getName() !== "test") {
        return;
      }
      if (!cmd.getFlag("class")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("class").set({
            description: "only run tests of this class",
            type: "string"
          })
        );
      }

      if (!cmd.getFlag("method")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("method").set({
            description: "only run tests of this method",
            type: "string"
          })
        );
      }

      if (!cmd.getFlag("diag")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("diag").set({
            description: "show diagnostic output",
            type: "boolean",
            value: false
          })
        );
      }

      if (!cmd.getFlag("terse")) {
        cmd.addFlag(
          new qx.tool.cli.Flag("terse").set({
            description: "show only summary and errors",
            type: "boolean",
            value: false
          })
        );
      }
    },

    async load() {
      let compiler = this.getCompilerApi(); 
      let command = compiler.getCommand();
      if (command instanceof qx.tool.compiler.cli.commands.Test) {
        command.addListener("runTests", this.__onRunTests, this);
      }
    },

    __onRunTests(data) {
      let result = data.getData();
      let app;
      try {
        app = this.getTestApp("qxl.testnode.Application");
      } catch (e) {
        qx.tool.compiler.Console.error(e.message);
        result.setExitCode(253);
        return qx.Promise.resolve(false);
      }
      if (!app) {
        // no testnode app in the groups selected with --app-group
        return qx.Promise.resolve(false);
      }
      qx.tool.compiler.Console.log("TAP version 13");
      qx.tool.compiler.Console.log("# run unit tests via qxl.testnode");
      let target = app.maker.getTarget();
      let outputDir = target.getOutputDir();
      let boot = path.join(outputDir, app.name, "index.js");
      let args = [];
      args.push(boot);
      for (const arg of ["colorize", "verbose", "method", "class"]) {
        if (app.argv[arg]) {
          args.push(`--${arg}=${app.argv[arg]}`);
        }
      }
      return new qx.Promise((resolve, reject) => {
        let notOk = 0;
        let Ok = 0;
        let skipped = 0;
        let planSeen = false;
        if (app.argv.diag) {
          qx.tool.compiler.Console.log(`run node ${args}`);
        }
        let startTime = performance.now();
        // no shell: the arguments reach node unchanged, so a --class or
        // --method regular expression like "Test(A|B)" works
        let proc = child_process.spawn("node", args, {
          cwd: "."
        });

        proc.stdout.on("data", (data) => {
          let arr = data.toString().trim().split("\n");
          // value is serializable
          arr.forEach((val) => {
            if (val.match(/^\d+\.\.\d+$/)) {
              planSeen = true;
              let endTime = performance.now();
              let timeDiff = endTime - startTime;
              qx.tool.compiler.Console.info(
                `DONE testing ${Ok} ok, ${notOk} not ok, ${skipped} skipped - [${timeDiff.toFixed(
                  0
                )} ms]`
              );
              result[app.name] = {
                notOk: notOk,
                ok: Ok,
              };
            } else if (val.match(/^not ok /)) {
              notOk++;
              qx.tool.compiler.Console.log(val);
            } else if (val.includes("# SKIP")) {
              skipped++;
              if (!app.argv.terse) {
                qx.tool.compiler.Console.log(val);
              }
            } else if (val.match(/^ok\s/)) {
              Ok++;
              if (!app.argv.terse) {
                qx.tool.compiler.Console.log(val);
              }
            } else if (val.match(/^#/) && app.argv.diag) {
              qx.tool.compiler.Console.log(val);
            } else if (app.argv.verbose) {
              qx.tool.compiler.Console.log(val);
            }
          });
        });
        proc.stderr.on("data", (data) => {
          let val = data.toString().trim();
          qx.tool.compiler.Console.error(val);
        });
        proc.on("close", (code, signal) => {
          if (!planSeen) {
            // the test process died (uncaught exception, process.exit(),
            // signal) or never started: not all tests ran
            qx.tool.compiler.Console.error(
              `The test process ended before all tests had run (exit code ${code}, signal ${signal})`
            );
            // same code as qxl.testtapper uses for an exception during test
            result.setExitCode(253);
          } else if (notOk > 0) {
            result.setExitCode(notOk);
          }
          resolve();
        });
        proc.on("error", (err) => {
          // "close" follows; rejecting here would keep qx test from exiting
          qx.tool.compiler.Console.error(`Cannot run the test process: ${err}`);
        });
      });
    },

    /**
     * The groups of an application from compile.json. qooxdoo 8.0 beta
     * keeps them only in the application's config entry; newer compilers
     * also copy them into Application.getGroup().
     */
    __getAppGroups(app) {
      let groups = typeof app.getGroup == "function" ? app.getGroup() : null;
      if (!groups) {
        let appConfigs =
          this.getCompilerApi().getConfiguration().applications || [];
        let appConfig = appConfigs.find(
          (c) => c.app === app || (c.name && c.name === app.getName())
        );
        groups = appConfig?.group;
      }
      if (typeof groups == "string") {
        groups = [groups];
      }
      return groups || [];
    },

    getTestApp(classname) {
      let command = this.getCompilerApi().getCommand();
      let maker = null;
      let app = null;
      let argvAppGroups = command.argv["app-group"]
        ? command.argv["app-group"].split(",").map(s => s.trim())
        : null;
      for (const tmp of command.getMakers()) {
        let apps = tmp
          .getApplications()
          .filter(
            (app) => app.getClassName() === classname && !app.isBrowserApp()
          );
        if (argvAppGroups) {
          apps = apps.filter(app => {
            let groups = this.__getAppGroups(app);
            return argvAppGroups.some(g => groups.includes(g));
          });
        }
        if (apps.length) {
          if (maker) {
            throw new Error(
              "Cannot run tests: the testnode application is in more than one target"
            );
          }
          if (apps.length != 1) {
            throw new Error(
              "Cannot run tests: there is more than one testnode application, select one with --app-group"
            );
          }
          maker = tmp;
          app = apps[0];
        }
      }
      if (!app) {
        if (argvAppGroups) {
          return null;
        }
        throw new Error("Please install qxl.testnode package!");
      }
      return {
        name: app.getName(),
        argv: command.argv,
        environment: app.getEnvironment(),
        maker: maker,
      };
    },
    _cnt: null,
    _failed: null,
  },
});

module.exports = {
  LibraryApi: qxl.testnode.LibraryApi,
};
