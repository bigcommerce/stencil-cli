# Contributing to Stencil CLI

Thanks for showing interest in contributing!

The following is a set of guidelines for contributing to the Stencil CLI. These are just guidelines, not rules.
Use your best judgment, and feel free to propose changes to this document in a pull request.

At the moment some parts of the project may be outdated and not follow these recommendations.
They should be gradually refactored with time.

By contributing to Stencil CLI, you agree that your contributions will be licensed as listed under the
[README.md](https://github.com/bigcommerce/stencil-cli/blob/master/README.md).

#### Table of Contents

[Stencil Documentation](https://stencil.bigcommerce.com/docs)

[How Can I Contribute?](#how-can-i-contribute)

-   [Your First Code Contribution](#your-first-code-contribution)
-   [Pull Requests](#pull-requests)
-   [Release stencil-cli](#release-stencil-cli)

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

In order to release stencil-cli you should first use the `Squash and merge` option on GitHub, This step is important
for generating the `CHANGELOG.md` file with the PR link attached (if not using `Squash and merge`, the changes will
be logged only with links to the commits). After the changes are merged to master, pull the latest to your local
environment, run `gulp release` and follow the prompts.

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

### Project best practices

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
