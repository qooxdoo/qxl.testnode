const path = require("path");
const child_process = require("child_process");
const { performance } = require("perf_hooks");

qx.Class.define("qxl.testnode.LibraryApi", {
  extend: qx.tool.compiler.cli.api.LibraryApi,
  members: {
    async initialize(rootCmd) {
        rootCmd.addFlag(
          new qx.tool.cli.Flag("class").set({
            description: "only run tests of this class",
            type: "string"
          })
        );

        rootCmd.addFlag(
          new qx.tool.cli.Flag("method").set({
            description: "only run tests of this method", 
            type: "string"
          })
        );

        rootCmd.addFlag(
          new qx.tool.cli.Flag("diag").set({
            description: "show diagnostic output",
            type: "boolean",
            value: false
          })
        );

        rootCmd.addFlag(
          new qx.tool.cli.Flag("terse").set({
            description: "show only summary and errors",
            type: "boolean", 
            value: false
          })
        );
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
      let app = this.getTestApp("qxl.testnode.Application");
      if (!app) {
        qx.tool.compiler.Console.log("Please install qxl.testnode package!");
        return qx.Promise.resolve(false);
      }
      this.require("minimist");
      qx.tool.compiler.Console.log("TAP version 13");
      qx.tool.compiler.Console.log("# run unit tests via qxl.testnode");
      let target = app.maker.getTarget();
      let outputDir = target.getOutputDir();
      let boot = path.join(outputDir, app.name, "index.js");
      let args = [];
      args.push(boot);
      for (const arg of ["colorize", "verbose", "method", "class"]) {
        if (app.argv[arg]) {
          args.push(` --${arg}=${app.argv[arg]}`);
        }
      }
      return new qx.Promise((resolve, reject) => {
        let notOk = 0;
        let Ok = 0;
        let skipped = 0;
        if (app.argv.diag) {
          qx.tool.compiler.Console.log(`run node ${args}`);
        }
        let startTime = performance.now();
        let proc = child_process.spawn("node", args, {
          cwd: ".",
          shell: true,
        });

        proc.stdout.on("data", (data) => {
          let arr = data.toString().trim().split("\n");
          // value is serializable
          arr.forEach((val) => {
            if (val.match(/^\d+\.\.\d+$/)) {
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

              result.setExitCode(notOk);
            } else if (val.match(/^not ok /)) {
              notOk++;
              qx.tool.compiler.Console.log(val);
              result.setExitCode(notOk);
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
        proc.on("close", (code) => {
          resolve(code);
        });
        proc.on("error", () => {
          reject();
        });
      });
    },

    getTestApp(classname) {
      let command = this.getCompilerApi().getCommand();
      let maker = null;
      let app = null;
      command.getMakers().forEach((tmp) => {
        let apps = tmp
          .getApplications()
          .filter(
            (app) => app.getClassName() === classname && !app.isBrowserApp()
          );
        if (apps.length) {
          if (maker) {
            qx.tool.compiler.Console.print("qx.tool.cli.test.tooManyMakers");
            return null;
          }
          if (apps.length != 1) {
            qx.tool.compiler.Console.print(
              "qx.tool.cli.test.tooManyApplications"
            );
            return null;
          }
          maker = tmp;
          app = apps[0];
        }
      });
      if (!app) {
        qx.tool.compiler.Console.print("qx.tool.cli.test.noAppName");
        return null;
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
