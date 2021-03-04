const path = require("path")
const child_process = require("child_process");

qx.Class.define("qxl.testnode.LibraryApi", {
  extend: qx.tool.cli.api.LibraryApi,
  members: {

    async initialize() {
      let yargs = qx.tool.cli.commands.Test.getYargsCommand;
      qx.tool.cli.commands.Test.getYargsCommand = () => {
        let args = yargs();
        args.builder.class = {
          describe: "only run tests of this class",
          type: "string"
        };
        args.builder.method = {
          describe: "only run tests of this method",
          type: "string"
        };
        args.builder.diag = {
          describe: "show diagnostic output",
          type: "boolean"
        };
        args.builder.terse = {
          describe: "show only summary and errors",
          type: "boolean"
        };
        return args;
      }
    },

    load: async function () {
      let command = this.getCompilerApi().getCommand();
      if (command instanceof qx.tool.cli.commands.Test) {
        command.addListener("runTests", this.__onRunTests, this);
      }
    },


    __onRunTests: function (data) {
      let result = data.getData();

      let app = this.getTestApp("qxl.testnode.Application");
      if (!app) {
        qx.tool.compiler.Console.print("Please install qxl.testnode package!");
        return qx.Promise.resolve(false);
      }
      this.require("minimist");
      qx.tool.compiler.Console.print("Run unit tests via qxl.testnode");
      let target = app.maker.getTarget();
      let outputDir = target.getOutputDir();
      let boot = path.join(outputDir, app.name, "index.js");
      let args = [];
      args.push(boot);
      if (app.argv.method) {
        args.push(` --method=${app.argv.method}`);
      }
      if (app.argv.class) {
        args.push(` --class=${app.argv.class}`);
      }
      return new qx.Promise((resolve, reject) => {
        let notOk = 0;
        let Ok = 0;
        if (app.argv.diag) {
              qx.tool.compiler.Console.log(`run node ${args}`);
        }
        let proc = child_process.spawn('node', args, {
          cwd: '.',
          shell: true
        });
        proc.stdout.on('data', (data) => {
          let arr = data.toString().trim().split("\n");
          // value is serializable
          arr.forEach(val => {
            if (val.match(/^\d+\.\.\d+$/)) {
              qx.tool.compiler.Console.info(`DONE testing ${Ok} ok, ${notOk} not ok`);
              result.setExitCode(notOk);
            } else if (val.match(/^not ok /)) {
              notOk++;
              qx.tool.compiler.Console.log(val);
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
        proc.stderr.on('data', (data) => {
          let val = data.toString().trim();
          console.error(val); 
        });
        proc.on('close', code => {
          resolve(code);
        });
        proc.on('error', () => {
          reject()
        });
      });
    },


    getTestApp: function (classname) {
      let command = this.getCompilerApi().getCommand();
      let maker = null;
      let app = null;
      command.getMakers().forEach(tmp => {
        let apps = tmp.getApplications().filter(app => (app.getClassName() === classname) && !app.isBrowserApp());
        if (apps.length) {
          if (maker) {
            qx.tool.compiler.Console.print("Found to many makers for app");
            return null;
          }
          if (apps.length != 1) {
            qx.tool.compiler.Console.print(`found to many apps for classname ${classname}`);
            return null;
          }
          maker = tmp;
          app = apps[0];
        }
      });
      if (!app) {
        qx.tool.compiler.Console.print(`no apps found for classname ${classname}`);
        return null;
      }
      return {
        name: app.getName(),
        argv: command.argv,
        environment: app.getEnvironment(),
        maker: maker
      }
    },
    _cnt: null,
    _failed: null
  }


});

module.exports = {
  LibraryApi: qxl.testnode.LibraryApi
};
