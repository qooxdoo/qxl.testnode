# qxl.nodetest
Qooxdoo tests with node 

## Adding an testnode to your own code
```
$ npx qx package update
$ npx qx package install qooxdoo/qxl.testnode
```

Now edit the `"myapp.test.*"` entry in your `compile.json` file to point to the
test classes in your own application.

```
$ npx qx test
```

This will run all of your tests in an node enviroment.


## Developing testnode
Clone this repo and compile it:

```
    $ git clone https://github.com/qooxdoo/qxl.testnode
    $ cd qxl.testnode
```
