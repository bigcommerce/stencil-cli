# Contributing to Stencil CLI

Thanks for showing interest in contributing!

The following is a set of guidelines for contributing to the Stencil CLI. These are just guidelines, not rules.
Use your best judgment, and feel free to propose changes to this document in a pull request.

At the moment some parts of the project may be outdated and not follow these recommendations.
They should be gradually refactored with time.

By contributing to Stencil CLI, you agree that your contributions will be licensed as listed under the
[README.md](https://github.com/bigcommerce/stencil-cli/blob/master/README.md).

## Table of Contents

[Stencil Documentation](https://stencil.bigcommerce.com/docs)

[How Can I Contribute?](#how-can-i-contribute)

-   [Your First Code Contribution](#your-first-code-contribution)
-   [Pull Requests](#pull-requests)
-   [Release stencil-cli](#release-stencil-cli)

[Set up the development environment](#set-up-the-development-environment)

-   [Using a bash/zsh function](#using-a-bashzsh-function)
-   [Without using a bash/zsh function](#without-using-a-bashzsh-function)

[Debugging locally](#debugging-locally)

-   [Creating a function/alias for debugging](#creating-a-functionalias-for-debugging)
-   [Using the Chrome NodeJS Debugger](#using-the-chrome-nodejs-debugger)
-   [Using the VSCode Debugger](#using-the-vscode-debugger)

[Styleguides](#styleguides)

-   [Git Commit Messages](#git-commit-messages)
-   [JavaScript Styleguide](#javascript-styleguide)
-   [Project best practices](#project-best-practices)

[Implementation details](#implementation-details)

-   [Project structure](#project-structure)

## How Can I Contribute?

### Your First Code Contribution

Unsure where to begin contributing to Stencil CLI? Check our [forums](https://forum.bigcommerce.com/s/group/0F91300000029tpCAA),
[Github issues](https://github.com/bigcommerce/stencil-cli/issues), or our
[stackoverflow](https://stackoverflow.com/questions/tagged/bigcommerce) tag.

### Pull Requests

-   Fill in [the required template](https://github.com/bigcommerce/stencil-cli/pull/new/master)
-   Include screenshots and animated GIFs in your pull request whenever possible.
-   End files with a newline.

### Release stencil-cli

In order to release stencil-cli you should create a release PR to master branch with updated `CHANGELOG.md` and versions. After PR is merged, you should go to https://github.com/bigcommerce/stencil-cli/releases/new, create a tag and describe the release. Click `Publish` and Github Actions will publish new version to npm.

## Styleguides

### Git Commit Messages

-   Commit message should follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0-beta.2/) structure
-   Use the present tense ("Add feature" not "Added feature")
-   Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
-   Limit the first line to 72 characters or less
-   Reference pull requests and external links liberally

### JavaScript Styleguide

All JS code must adhere to [AirBnB Javascript Styleguide](https://github.com/airbnb/javascript),
except rules overridden in our .eslintrc.

Additionally:

-   Prefer async/await to callbacks.
-   Class dependencies with side effects (e.g. "fs" has side effects, "lodash" - hasn't) should be
    explicitly passed to the constructor so that they can be easily mocked in unit tests.
-   Mark private class fields and methods with an underscore (e.g. user.\_password) and @private JSDoc tag
    and avoid using them in other entities (while our current Node version doesn't support native private fields).

## Set up the development environment

The easiest method to develop on your local `stencil-cli` fork is to create a function in your `.zshrc` or `.bash_profile`. This will allow you to run your local fork of stencil-cli against a theme without needing to use `npm link` or executing the stencil-cli scripts in the `bin` directory by their absolute path. This is not required, but can make things much easier.

### Using a bash/zsh function

1.  Create your own fork of the `bigcommerce/stencil-cli` GitHub repository
2.  In your terminal, browse to your chosen directory and `git clone` your stencil-cli fork. Keep this directory in mind.
3.  Depending on the type of terminal you're using, run the following command:
    -   **zsh**: `open ~/.zshrc`
    -   **bash**: `open ~/.bash_profile`
4.  This will open the file in a text editor. _At the very bottom_ of the file, add the following code: \
    (**NOTE:** you must replace the `/path/to/` with the appropriate target directory to your stencil-cli `/bin` folder.)

    ```
    # function for local stencil-cli fork development (stencilDev)
    function stencilDev() {
        node $HOME/path/to/stencil-cli/bin/stencil.js $@
    }
    ```

5.  Save the file, close it, and restart your terminal.

Now, you will be able to use `stencilDev` as a command to run your local version of stencil-cli from any theme directory.

**Example:**

```
cd path/to/cornerstone

stencilDev start
```

### Without using a bash/zsh function

If you do not follow the steps above, you can run your local version of stencil-cli directly by running the `stencil.js` file from node.

**Example:**

```
cd path/to/cornerstone

node /path/to/stencil-cli/bin/stencil.js start
```

## Debugging locally

Using the Node debugger is a crucial part of local development and can give you a better idea of how requests are routed through stencil-cli, which code gets executed, and where things might be going wrong.

In order for debugging to be a possibility, you will need to add the `--inspect` flag when launching the `bin/stencil.js` file. Again, we can make things a bit easier with a bash/zsh function.

### Creating a function/alias for debugging

1. Repeat steps 1-3 from the [Using a bash/zsh function](#using-a-bashzsh-function) section.
2. At the bottom of your terminal environment file (`.zshrc` / `.bash_profile`), add the following code:
    ```
    # stencil debug function
    function stencilDevDebug() {
        node --inspect $HOME/path/to/stencil-cli/bin/stencil.js $@
    }
    ```
3. Save, exit, and restart your terminal

This will create a new function for you to use when you want to debug your local fork of stencil-cli.

**Example:**

```
cd path/to/cornerstone

stencilDevDebug start
```

### Using the Chrome NodeJS Debugger

To use the Chrome Debugger, you should have already executed `stencilDevDebug start` in a theme directory of your choice. This will have started the stencil-cli process with the node inspector attached.

1. Open `localhost:3000` in your Google Chrome browser
2. Right click, and click on **Inspect** to open the Chrome devtools window
3. In the DevTools panel at the top left, click on the NodeJS icon (green cube). This will open the Chrome NodeJS Debugger
4. In the NodeJS Devtools window, you can then use the **Sources** tab to set breakpoints in your code.

### Using the VSCode Debugger

1. Create a `.vscode` directory in your `stencil-cli` folder
2. Create a new `launch.json` file in the `.vscode` directory, and paste the following code:
    ```
    {
        "version": "0.2.0",
        "configurations": [
            {
            "name": "Attach to Stencil Process ID",
            "processId": "${command:PickProcess}",
            "request": "attach",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "type": "node"
            }
        ]
    }
    ```
3. Save the file
4. Run `stencilDevDebug start` in the theme directory of your choice
5. In VSCode, open the **Run and Debug** panel
6. In the dropdown, select the `Attach to Stencil Process ID` debug launcher and click the green arrow to start debugging
7. A dropdown for the process ID will now display at the top of VSCode, select the Node Process that is attached to the debugging port (typically port 9230)

VSCode will now appropriately detect your stencil-cli breakpoints when browsing your store locally.

## Project best practices

**CLI commands:**

Entry point is located at `/bin`. The file with entry point should only read the CLI arguments and
call a corresponding CLI-command-class with the implementation located at `/lib`. CLI-command-class uses
dependency injection throughout constructor, the main method runs other methods-tasks. Tasks are aimed to be pure and
use context (this) only for external dependencies (logger, fs, etc).

Shared logic and tasks should be moved out from the CLI-command-classes to separate service classes.

E.g.: [stencil-init](/bin/stencil-init).

**Local server:**

Hapi server plugins located at `/server/plugins` should have controller logic only. Business logic should be moved out to
common entities located at `/lib`.

## Implementation details

### Project structure

```
.
├── .github                  Templates for github documents
├── bin                      Entry points for CLI commands
├── server                   Local server
├── tasks                    Gulp tasks
├── test                     Common entities and helpers used for tests
├── lib                      Source code for all other entities
└── constants.js             Common constants
```
