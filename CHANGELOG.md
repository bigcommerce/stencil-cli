### Draft

### 4.0.0 (2022-04-11)

-   Added support for node 14 and drop node 10

### 3.13.0 (2022-04-08)

-   feat: strf-9718 Add OAuth token to headers ([903](https://github.com/bigcommerce/stencil-cli/pull/903))

### 3.12.0 (2022-03-29)

-   feat: allow .css-files imports within SCSS files ([882](https://github.com/bigcommerce/stencil-cli/pull/882))
-   bump paper version ([897](https://github.com/bigcommerce/stencil-cli/pull/897))

### 3.11.0 (2022-03-10)

-   feat: strf-9440 Stencil Bundle: fail on scss failure compilation ([884](https://github.com/bigcommerce/stencil-cli/pull/884))

### 3.10.1 (2022-02-24)

-   fix: when there's no regions on the page ([878](https://github.com/bigcommerce/stencil-cli/pull/878))
-   fix: STRF-9667 Storefront fallback logic works incorrectly on store with Stencil CLI ([877](https://github.com/bigcommerce/stencil-cli/pull/877))

### 3.10.0 (2022-02-08)

-   fix(storefront): bctheme-1000 handle regular css in stencil ([845](https://github.com/bigcommerce/stencil-cli/pull/845))
-   chore: bump paper to 3.0.0 ([868](https://github.com/bigcommerce/stencil-cli/pull/868))

### 3.9.2 (2022-01-31)

-   chore: bump paper to latest ([863](https://github.com/bigcommerce/stencil-cli/pull/863))

### 3.9.1 (2022-01-25)

-   fix: strf-9612 Fix stencil pull when there is 1 channel ([859](https://github.com/bigcommerce/stencil-cli/pull/859))

### 3.9.0 (2022-01-21)

-   fix: return channel id as an iterable when a store only has a single storefront ([849](https://github.com/bigcommerce/stencil-cli/pull/849))
-   feat: warn npm users if npm is above 7 version ([846](https://github.com/bigcommerce/stencil-cli/pull/846))

### 3.8.5 (2022-01-18)

-   fix(storefront): strf-9594 loosed frontmatter refex ([841](https://github.com/bigcommerce/stencil-cli/pull/841))

### 3.8.4 (2022-01-13)

-   fix: `stencil init` command including `apiHost` option is now recognized ([830](https://github.com/bigcommerce/stencil-cli/pull/830))
-   feat: `stencil push` command allows to push a theme to multiple channels ([825](https://github.com/bigcommerce/stencil-cli/pull/825))

### 3.8.3 (2022-01-12)

-   fix: add activate sass engine name logic ([837](https://github.com/bigcommerce/stencil-cli/pull/837))

### 3.8.2 (2022-01-11)

-   fix: strf-9600 bump stencil styles version ([832](https://github.com/bigcommerce/stencil-cli/pull/832))

### 3.8.1 (2022-01-10)

-   fix: Updated package.json to use colors 1.4.0 ([827](https://github.com/bigcommerce/stencil-cli/pull/827))

### 3.8.0 (2021-12-30)

-   build(deps): bump axios from 0.21.4 to 0.24.0 ([821](https://github.com/bigcommerce/stencil-cli/pull/821))
-   fix: strf-9581 Update cheerio version ([819](https://github.com/bigcommerce/stencil-cli/pull/819))
-   fix: strf-9581 Remove gulp tasks, that are not used anymore ([817](https://github.com/bigcommerce/stencil-cli/pull/817))

### 3.7.1 (2021-12-20)

-   fix: strf-9576 Fix graphql queries ([810](https://github.com/bigcommerce/stencil-cli/pull/810))
-   fix: strf-9553 bundled lang.json has lowercase lang keys ([808](https://github.com/bigcommerce/stencil-cli/pull/808))

### 3.7.0 (2021-12-08)

-   fix: strf-9535 Add fallback for shopper language default ([804](https://github.com/bigcommerce/stencil-cli/pull/804))
-   feat: strf-9245 Warn user if shopper default language file is missing or has missing keys ([802](https://github.com/bigcommerce/stencil-cli/pull/802))
-   Bump paper to rc52

Note: BREAKING CHANGE!
In order to get stencil cli working with this version, new Stencil CLI token should be created

### 3.6.5 (2021-11-22)

-   fix: strf-4307 Frontmatter/yaml validation and trailing symbols checks ([798](https://github.com/bigcommerce/stencil-cli/pull/798))

### 3.6.4 (2021-11-5)

-   fix: strf-9474 Removed "git+" prefix from package-lock ([794](https://github.com/bigcommerce/stencil-cli/pull/794))

### 3.6.3 (2021-10-22)

-   Bump paper to rc51
-   fix: strf-8846 Send stencil-cli header to storefront api ([789](https://github.com/bigcommerce/stencil-cli/pull/789))

### 3.6.2 (2021-10-06)

-   feat: Add overwrite option to download command ([785](https://github.com/bigcommerce/stencil-cli/pull/785))

### 3.6.1 (2021-10-04)

-   fix: strf-9375 Fix custom release tag selection ([f41d6dd44fb](https://github.com/bigcommerce/stencil-cli/commit/f41d6dd44fb))

### 3.6.0 (2021-09-28)

-   feat: strf-9332 added timeout parameter for stencil bundle command ([9c762fa0aa1](https://github.com/bigcommerce/stencil-cli/commit/9c762fa0aa1))
-   feat: strf-9040 Support dart-sass as primary engine for css rendering ([514ea778eda](https://github.com/bigcommerce/stencil-cli/commit/514ea778eda))

### 3.5.2 (2021-09-17)

-   fix: strf-9356 Support npm 7 for stencil cli ([d67747d5384](https://github.com/bigcommerce/stencil-cli/commit/d67747d5384))

### 3.5.1 (2021-09-15)

-   fix: strf-9345: Fallback to API_HOST constant in the absense of a provided one ([d138536c8](https://github.com/bigcommerce/stencil-cli/commit/d138536c8))

### 3.5.0 (2021-09-15)

-   fix: STRF-9351 Stop sending "X-Forwarded-..." headers as it causes remote store to redirect ([36f5663da](https://github.com/bigcommerce/stencil-cli/commit/36f5663da))
-   feat: strf-9303 Replaced jsonlint with parse-json ([b5f16db85](https://github.com/bigcommerce/stencil-cli/commit/b5f16db85))
-   feat: strf-9345: Log api host ([51b08a9b2](https://github.com/bigcommerce/stencil-cli/commit/51b08a9b2))
-   feat: strf-9345 Infer apiHost from storeUrl ([5b132e90b6](https://github.com/bigcommerce/stencil-cli/commit/5b132e90b6))
-   feat: strf-9319 Github Release for stencil-cli ([22949011](https://github.com/bigcommerce/stencil-cli/commit/22949011))

### 3.4.2 (2021-08-17)

-   fix: strf-9257 Added check if theme version exists and release method refactoring ([a520a55](https://github.com/bigcommerce/stencil-cli/commit/a520a55))

### 3.4.1 (2021-08-09)

-   fix: merc-8038 Added check to ensure we are not looping over undefined object ([bcd2401](https://github.com/bigcommerce/stencil-cli/commit/bcd2401))

## 3.4.0 (2021-07-27)

-   feat: merc-7830 support for region translations ([a6bc312](https://github.com/bigcommerce/stencil-cli/commit/a6bc312))
-   feat: merc-7797 added feature to render widgets ([40c410b](https://github.com/bigcommerce/stencil-cli/commit/40c410b))
-   feat: merc-7834 validate theme variation translations ([219dc60](https://github.com/bigcommerce/stencil-cli/commit/219dc60))

## 3.3.0 (2021-06-14)

-   feat: strf-9087 Prompt user to select channel id if multiple storefronts are enabled ([85d773](https://github.com/bigcommerce/stencil-cli/commit/85d773))

## <small>3.2.1 (2021-05-24)</small>

-   refactor: move API requests from commands to themeApiClient ([06f8d61](https://github.com/bigcommerce/stencil-cli/commit/06f8d61))
-   feat: remove old unused field staplerUrl from local server ([a3ec69f](https://github.com/bigcommerce/stencil-cli/commit/a3ec69f))
-   fix: (STRF-9087) set upstream=storefront to support multiple channels in start command ([3f6b8ed](https://github.com/bigcommerce/stencil-cli/commit/3f6b8ed))
-   fix: Typo fix at StencilConfigManager.js([4c2a04d](https://github.com/bigcommerce/stencil-cli/commit/4c2a04d))

## 3.2.0 (2021-03-22)

-   feat: strf-7651 - update push command to take into account multiple channels ([7582e7c](https://github.com/bigcommerce/stencil-cli/commit/7582e7c))
-   feat: strf-8282 - update pull command to take into account multiple channels ([00b4571](https://github.com/bigcommerce/stencil-cli/commit/00b4571))
-   feat: strf-8282 - use sites instead of channels API ([bf16215](https://github.com/bigcommerce/stencil-cli/commit/bf16215))
-   feat: strf-9071 - update download command to support multiple channels ([d6a9f94](https://github.com/bigcommerce/stencil-cli/commit/d6a9f94))

## <small>3.1.1 (2021-03-10)</small>

-   fix: (STRF-9019) wrong reading from stream breaks stencil-download command ([eb9b082](https://github.com/bigcommerce/stencil-cli/commit/eb9b082))
-   fix: broken changelog.md after stencil release command ([ec4a72a](https://github.com/bigcommerce/stencil-cli/commit/ec4a72a))

## 3.1.0 (2021-01-15)

-   fix:(STRF-8909) theme variation not applied with activate flag (#679) ([6830f15](https://github.com/bigcommerce/stencil-cli/commit/6830f15))
-   fix: (strf-8745) move common headers inside sendApiRequest and refactor NetworkUtils ([21a3522](https://github.com/bigcommerce/stencil-cli/commit/21a3522))
-   fix: (strf-8840) add missing rejectUnauthorized parameter to the API requests ([5ee6138](https://github.com/bigcommerce/stencil-cli/commit/5ee6138))
-   fix: add handling cases when redirect link is already stripped in normalizeRedirectUrl ([88fee5d](https://github.com/bigcommerce/stencil-cli/commit/88fee5d))
-   fix(stencil-push): (STRF-8913) increase maxBodyLength in NetworkUtils.sendApiRequest ([f2e3918](https://github.com/bigcommerce/stencil-cli/commit/f2e3918))
-   fix(stencil-release): (STRF-6905) add updating version in package-lock.json ([8f9ff79](https://github.com/bigcommerce/stencil-cli/commit/8f9ff79))
-   fix(stencil-release): fix typo in the code ([e6dfbc3](https://github.com/bigcommerce/stencil-cli/commit/e6dfbc3))
-   fix(stencil-release): fix uploading broken bundle archive to github ([0271ed4](https://github.com/bigcommerce/stencil-cli/commit/0271ed4))
-   refactor: (strf-8745) replace fetch with axios ([946a012](https://github.com/bigcommerce/stencil-cli/commit/946a012))
-   refactor: (strf-8747) move code dealing with .stencil file into a separate class ([7b371e8](https://github.com/bigcommerce/stencil-cli/commit/7b371e8))
-   feat: (strf-8747) split .stencil file into 2 configs ([6f3d2dc](https://github.com/bigcommerce/stencil-cli/commit/6f3d2dc))
-   feat: increase coverage threshold ([9dfa78c](https://github.com/bigcommerce/stencil-cli/commit/9dfa78c))

## <small>3.0.3 (2020-10-19)</small>

-   fix: (strf-8746) make local server parse binary data responses right ([39dacd8](https://github.com/bigcommerce/stencil-cli/commit/39dacd8))

## <small>3.0.2 (2020-10-13)</small>

-   fix: (strf-8740) fix a typo in StencilStart.assembleTemplates() ([7f58d48](https://github.com/bigcommerce/stencil-cli/commit/7f58d48))
-   fix: add missed linting step to github actions ([19b4012](https://github.com/bigcommerce/stencil-cli/commit/19b4012))
-   fix: add missed test coverage check to github actions ([39d137d](https://github.com/bigcommerce/stencil-cli/commit/39d137d))
-   fix: fix linting problems on Windows ([bcdfaa4](https://github.com/bigcommerce/stencil-cli/commit/bcdfaa4))
-   feat: (strf-8740) cover StencilStart.assembleTemplates() with tests ([0adf1f8](https://github.com/bigcommerce/stencil-cli/commit/0adf1f8))
-   refactor: (strf-8740) move recursiveReadDir to fsUtils ([f2e2724](https://github.com/bigcommerce/stencil-cli/commit/f2e2724))

## <small>3.0.1 (2020-10-08)</small>

-   fix: (strf-8734) fix a typo in renderer.module -> getTemplatePath() ([de5a91b](https://github.com/bigcommerce/stencil-cli/commit/de5a91b))
-   fix: add file list to package file to ignore tests and cli release code ([de4468f](https://github.com/bigcommerce/stencil-cli/commit/de4468f))

## 3.0.0 (2020-10-06)

-   fix: (strf-5280) Multiple themes - Changes to config.json not reflected ([0b28309](https://github.com/bigcommerce/stencil-cli/commit/0b28309))
-   fix: (strf-8705) fix broken headers and cookies in local server ([1dc8afd](https://github.com/bigcommerce/stencil-cli/commit/1dc8afd))
-   fix: apply various PR fixes ([c5d964b](https://github.com/bigcommerce/stencil-cli/commit/c5d964b))
-   fix: fix lint errors in lib/stencil-init.js ([a2e7383](https://github.com/bigcommerce/stencil-cli/commit/a2e7383))
-   fix: fix lint errors in lib/stencil-init.spec.js ([0b2b328](https://github.com/bigcommerce/stencil-cli/commit/0b2b328))
-   fix: inquirer.prompt is not called when not necessary ([beeca29](https://github.com/bigcommerce/stencil-cli/commit/beeca29))
-   fix: make running tests in verbose mode ([8bdd3d4](https://github.com/bigcommerce/stencil-cli/commit/8bdd3d4))
-   fix: reverts change to mock test answers ([ea9c76e](https://github.com/bigcommerce/stencil-cli/commit/ea9c76e))
-   fix: strf-8574 Bump version of "archiver" to fix security issues ([42f4528](https://github.com/bigcommerce/stencil-cli/commit/42f4528))
-   fix: strf-8574 Bump versions of npm modules to fix security issues ([2587d0a](https://github.com/bigcommerce/stencil-cli/commit/2587d0a))
-   fix: strf-8574, bump "hapi" and its modules to fix security issues ([b520daa](https://github.com/bigcommerce/stencil-cli/commit/b520daa))
-   fix: strf-8574, bump version of "@hapi/lab" to fix security issues ([44872f2](https://github.com/bigcommerce/stencil-cli/commit/44872f2))
-   fix: strf-8574, bump version of "github" package to fix security issues ([1013e3a](https://github.com/bigcommerce/stencil-cli/commit/1013e3a))
-   fix: strf-8574, bump version of "inquirer" to fix security issues ([474c9af](https://github.com/bigcommerce/stencil-cli/commit/474c9af))
-   fix: strf-8574, remove redundant dependency "hoek" ([9aeb3c1](https://github.com/bigcommerce/stencil-cli/commit/9aeb3c1))
-   fix(stencil-init.spec.js): fixed a broken test ([66ab50d](https://github.com/bigcommerce/stencil-cli/commit/66ab50d))
-   refactor: (strf-8608) make fsUtils async ([bcab218](https://github.com/bigcommerce/stencil-cli/commit/bcab218))
-   refactor: (strf-8672) fix ESLint & Prettier errors and refactor some code ([300de1e](https://github.com/bigcommerce/stencil-cli/commit/300de1e))
-   refactor: move printErrorMessages() from theme-api-client.js to cliCommon.js ([d2c259b](https://github.com/bigcommerce/stencil-cli/commit/d2c259b))
-   refactor: move tests to GitHub Actions, remove Travis and AppVeyor ([18c6ff9](https://github.com/bigcommerce/stencil-cli/commit/18c6ff9))
-   refactor: moved common constants to constants.js ([a205c5b](https://github.com/bigcommerce/stencil-cli/commit/a205c5b))
-   refactor: moved StencilStart class to a separate file ([fdcdd82](https://github.com/bigcommerce/stencil-cli/commit/fdcdd82))
-   refactor: replace Promises with async/await in stencil-start ([9492a42](https://github.com/bigcommerce/stencil-cli/commit/9492a42))
-   refactor: strf-8606; removed unused modules "good", "good-console" ([1db7f5a](https://github.com/bigcommerce/stencil-cli/commit/1db7f5a))
-   refactor: use fs.existsSync instead of Fs.statSync hack ([e097e36](https://github.com/bigcommerce/stencil-cli/commit/e097e36))
-   refactor(.eslintrc): update .eslinrc to allow newer JS syntax ([f132275](https://github.com/bigcommerce/stencil-cli/commit/f132275))
-   refactor(/bin/stencil-start): rearrange some variables ([e8edabb](https://github.com/bigcommerce/stencil-cli/commit/e8edabb))
-   refactor(/lib/release.js): use async/await instead of callbacks ([720fbb1](https://github.com/bigcommerce/stencil-cli/commit/720fbb1))
-   refactor(stencil-init): improve code style and test coverage ([4ac65ff](https://github.com/bigcommerce/stencil-cli/commit/4ac65ff))
-   refactor(stencil-start): refactored the module to OOP style ([2ae5b0c](https://github.com/bigcommerce/stencil-cli/commit/2ae5b0c))
-   refactor(tests): move tests from /bin to /lib ([930922f](https://github.com/bigcommerce/stencil-cli/commit/930922f))
-   feat: (strf-8608) bump recent updates in npm packages ([e50e231](https://github.com/bigcommerce/stencil-cli/commit/e50e231))
-   feat: (strf-8608) deleted unused npm dependencies ([1f64ad9](https://github.com/bigcommerce/stencil-cli/commit/1f64ad9))
-   feat: (strf-8608) replace "request" with "node-fetch" ([e758b01](https://github.com/bigcommerce/stencil-cli/commit/e758b01))
-   feat: (strf-8608) replaced lab+code+sinon with jest ([71e952f](https://github.com/bigcommerce/stencil-cli/commit/71e952f))
-   feat: (strf-8608) update "front-matter" ([a0aa6fd](https://github.com/bigcommerce/stencil-cli/commit/a0aa6fd))
-   feat: (strf-8608) update "simple-git" ([7153455](https://github.com/bigcommerce/stencil-cli/commit/7153455))
-   feat: (strf-8608) update "tarjan-graph" ([4a27ee6](https://github.com/bigcommerce/stencil-cli/commit/4a27ee6))
-   feat: (strf-8608) updated some npm dependencies ([9059210](https://github.com/bigcommerce/stencil-cli/commit/9059210))
-   feat: (strf-8625) support Node 12.x ([1449751](https://github.com/bigcommerce/stencil-cli/commit/1449751))
-   feat: (strf-8630) fix template engine values ([0af2cb5](https://github.com/bigcommerce/stencil-cli/commit/0af2cb5))
-   feat: (strf-8671) replace "wreck" with "node-fetch" ([6dcdd9b](https://github.com/bigcommerce/stencil-cli/commit/6dcdd9b))
-   feat: (strf-8672) improve ESLint config and add prettier ([a8b78c8](https://github.com/bigcommerce/stencil-cli/commit/a8b78c8))
-   feat: (strf-8673) update "commander" ([dc3bf29](https://github.com/bigcommerce/stencil-cli/commit/dc3bf29))
-   feat: (strf-8674) update "async" npm package ([9f64096](https://github.com/bigcommerce/stencil-cli/commit/9f64096))
-   feat: (strf-8684) update 'tmp' package ([b1e932c](https://github.com/bigcommerce/stencil-cli/commit/b1e932c))
-   feat: bump paper to rc30, release 2.2.0 ([6945a3c](https://github.com/bigcommerce/stencil-cli/commit/6945a3c))
-   feat: bump paper to rc31 ([b958744](https://github.com/bigcommerce/stencil-cli/commit/b958744))
-   feat: init no longer prompts when cli option is present ([a9fee29](https://github.com/bigcommerce/stencil-cli/commit/a9fee29))
-   feat: make init command more suitable for automation ([ab9b919](https://github.com/bigcommerce/stencil-cli/commit/ab9b919))
-   feat: strf-8589, drop JSPM support ([c39c67b](https://github.com/bigcommerce/stencil-cli/commit/c39c67b))
-   feat: update "stencil pull" to use configurations API, improving performance ([2b142fc](https://github.com/bigcommerce/stencil-cli/commit/2b142fc))
-   feat: update cli to use template engine based on the value stored in ([f9ea0a9](https://github.com/bigcommerce/stencil-cli/commit/f9ea0a9))
-   feat(docs): add project structure and best practices ([251c1ff](https://github.com/bigcommerce/stencil-cli/commit/251c1ff))
-   Add npm cache ([ad50756](https://github.com/bigcommerce/stencil-cli/commit/ad50756))
-   Resolve Schema Translation Error Logging ([7e668df](https://github.com/bigcommerce/stencil-cli/commit/7e668df))
-   STRF-8582 Bump stencil-styles version ([6611284](https://github.com/bigcommerce/stencil-cli/commit/6611284))
-   Update test badges ([0fdafcf](https://github.com/bigcommerce/stencil-cli/commit/0fdafcf))
-   test: updates integration and unit tests ([9e6131d](https://github.com/bigcommerce/stencil-cli/commit/9e6131d))
-   test: use better naming of methods and constants ([506be68](https://github.com/bigcommerce/stencil-cli/commit/506be68))
-   chore: remove json schema since it has been replaced by ajv ([80911e5](https://github.com/bigcommerce/stencil-cli/commit/80911e5))

<a name="2.1.1"></a>

## <small>2.1.1 (2020-06-12)</small>

-feat: bump paper ([91acd1c](https://github.com/bigcommerce/stencil-cli/commit/91acd1c))
-feat: watch storefront config file ([e7b43d9](https://github.com/bigcommerce/stencil-cli/commit/e7b43d9))

<a name="2.1.0"></a>

## 2.1.0 (2020-04-27)

-   feat: added re-integration script with new command download ([dc6df02](https://github.com/bigcommerce/stencil-cli/commit/dc6df02))

<a name="2.0.0"></a>

## 2.0.0 (2020-03-24)

-   fix: address chrome cookie SameSite issue ([5938ce1](https://github.com/bigcommerce/stencil-cli/commit/5938ce1))
-   feat: add schema validation to bundle process ([b86d440](https://github.com/bigcommerce/stencil-cli/commit/b86d440))
-   feat: bump paper ([f1d2b5a](https://github.com/bigcommerce/stencil-cli/commit/f1d2b5a))
-   feat: deprecate theme editor ([c0466dc](https://github.com/bigcommerce/stencil-cli/commit/c0466dc))
-   feat(translate): added the translationsSchema.json file into a bundle ([ba04cd6](https://github.com/bigcommerce/stencil-cli/commit/ba04cd6))
-   feat(translate): added validation for schemaTranslations.json ([fccafe2](https://github.com/bigcommerce/stencil-cli/commit/fccafe2))
-   feat(translate): fixed regarding reviewers notes ([0a1f43d](https://github.com/bigcommerce/stencil-cli/commit/0a1f43d))

<a name="1.23.1"></a>

## <small>1.23.1 (2020-02-18)</small>

-   fix: add hapi as a direct dependency to lock down hapi version ([3b9a258](https://github.com/bigcommerce/stencil-cli/commit/3b9a258))

<a name="1.23.0"></a>

## 1.23.0 (2020-02-17)

-   fix: move code to dev dependency ([f1fd570](https://github.com/bigcommerce/stencil-cli/commit/f1fd570))
-   fix: remove less dependency and ref since it is not supported or used ([c586dd8](https://github.com/bigcommerce/stencil-cli/commit/c586dd8))
-   fix: tunnel issues and add support for tunnel names ([820fa4d](https://github.com/bigcommerce/stencil-cli/commit/820fa4d))
-   fix: update readme to reflect node 8 is no longer supported ([6e793a9](https://github.com/bigcommerce/stencil-cli/commit/6e793a9))
-   feat: drop node 8 support ([5aa1624](https://github.com/bigcommerce/stencil-cli/commit/5aa1624))
-   feat: move lab to dev deps and update it to 14.3.3 ([0f57631](https://github.com/bigcommerce/stencil-cli/commit/0f57631))
-   feat: remove hapi as a direct dependecy ([3164fbc](https://github.com/bigcommerce/stencil-cli/commit/3164fbc))
-   feat: update browser sync to use latest master ([0916991](https://github.com/bigcommerce/stencil-cli/commit/0916991))
-   feat: update colors dependency ([b488557](https://github.com/bigcommerce/stencil-cli/commit/b488557))
-   feat: upgrade lodash dependency ([640c61d](https://github.com/bigcommerce/stencil-cli/commit/640c61d))
-   feat(dependencies): update eslint to the latest and fix lint errors ([5a2fd85](https://github.com/bigcommerce/stencil-cli/commit/5a2fd85))

<a name="1.22.0"></a>

## 1.22.0 (2020-02-10)

-   feat(dependencies): remove compression as a dependency ([2c02e9e](https://github.com/bigcommerce/stencil-cli/commit/2c02e9e))
-   feat(dependencies): remove decompress-zip as a dependency ([34c7fde](https://github.com/bigcommerce/stencil-cli/commit/34c7fde))
-   feat(dependencies): remove express as a dependecy since it is not used ([ba1c2c5](https://github.com/bigcommerce/stencil-cli/commit/ba1c2c5))
-   feat(dependencies): remove gulp git, sass, sass-lint dependency ([14dceeb](https://github.com/bigcommerce/stencil-cli/commit/14dceeb))
-   feat(dependencies): remove install as a dependency since it is not used ([1c2549c](https://github.com/bigcommerce/stencil-cli/commit/1c2549c))
-   feat(dependencies): remove npm as a dependency ([4733649](https://github.com/bigcommerce/stencil-cli/commit/4733649))
-   feat(dependencies): remove script-loader as a direct dependecy ([9a2b817](https://github.com/bigcommerce/stencil-cli/commit/9a2b817))
-   feat(dependencies): update dev dependency ([d5bdfe3](https://github.com/bigcommerce/stencil-cli/commit/d5bdfe3))

<a name="1.21.6"></a>

## <small>1.21.6 (2020-02-04)</small>

-   Add feature to allow pulling live config files (#550) ([43558fc](https://github.com/bigcommerce/stencil-cli/commit/43558fc))
-   fix: add account_payment_methods_v2 to theme config schema ([373a485](https://github.com/bigcommerce/stencil-cli/commit/373a485))
-   feat(dependencies): remove dateformat as a direct dependecy ([6044e91](https://github.com/bigcommerce/stencil-cli/commit/6044e91))

<a name="1.21.5"></a>

## <small>1.21.5 (2020-01-30)</small>

-   feat: add flag to auto-delete oldest theme during push ([ea93793](https://github.com/bigcommerce/stencil-cli/commit/ea93793))
-   feat: bump paper to 3.0.0-rc.27 ([86e4f74](https://github.com/bigcommerce/stencil-cli/commit/86e4f74))
-   fix: more detailed theme variation error ([96e3a30](https://github.com/bigcommerce/stencil-cli/commit/96e3a30))
-   fix: schema.json formatting ([73c8a26](https://github.com/bigcommerce/stencil-cli/commit/73c8a26))

<a name="1.21.4"></a>

## <small>1.21.4 (2019-12-20)</small>

<a name="1.21.3"></a>

## <small>1.21.3 (2019-12-20)</small>

-   fix: avoid caching of storefront api responses ([9974a07](https://github.com/bigcommerce/stencil-cli/commit/9974a07))
-   fix: correcting url for deploy issues docs ([44ef5e9](https://github.com/bigcommerce/stencil-cli/commit/44ef5e9))
-   fix: fix origin sent with graphql requests (#541) ([8f3f02c](https://github.com/bigcommerce/stencil-cli/commit/8f3f02c))

<a name="1.21.2"></a>

## <small>1.21.2 (2019-11-15)</small>

-   fix: bump stencil-styles to 1.2.0 ([97389b9](https://github.com/bigcommerce/stencil-cli/commit/97389b9))

<a name="1.21.1"></a>

## <small>1.21.1 (2019-10-22)</small>

-   fix: update paper to 3.0.0-rc.26 ([32ef114](https://github.com/bigcommerce/stencil-cli/commit/32ef114))

<a name="1.21.0"></a>

## 1.21.0 (2019-10-14)

-   Adding Support for Node 10 (#525) ([3013fb4](https://github.com/bigcommerce/stencil-cli/commit/3013fb4))

<a name="1.20.3"></a>

## <small>1.20.3 (2019-10-10)</small>

-   feat: strf-7393 make cli work with paper 3.x branch ([7ba9688](https://github.com/bigcommerce/stencil-cli/commit/7ba9688))

<a name="1.20.2"></a>

## <small>1.20.2 (2019-09-12)</small>

-   fix: bump paper to 2.0.19 ([670a7ad](https://github.com/bigcommerce/stencil-cli/commit/670a7ad))
-   Revert "Merge pull request #500 from bc-williamkwon/changePaperBranch" ([3e195e8](https://github.com/bigcommerce/stencil-cli/commit/3e195e8))
-   Revert "Merge pull request #506 from bookernath/paper-rc.20" ([5ada1b4](https://github.com/bigcommerce/stencil-cli/commit/5ada1b4))

<a name="1.20.1"></a>

## <small>1.20.1 (2019-09-05)</small>

-   Revert "Merge pull request #491 from bookernath/browser-sync-master" ([020ca91](https://github.com/bigcommerce/stencil-cli/commit/020ca91))

<a name="1.20.0"></a>

## 1.20.0 (2019-08-16)

-   feat: accept url and token as arguments on stencil init ([b69a9fe](https://github.com/bigcommerce/stencil-cli/commit/b69a9fe))

<a name="1.19.0"></a>

## 1.19.0 (2019-08-07)

-   fix: bump paper to 3.0.0-rc20 ([e9c7691](https://github.com/bigcommerce/stencil-cli/commit/e9c7691))
-   feat: strf-7175 bump paper to 3.0.0-rc.19 ([eb5ef78](https://github.com/bigcommerce/stencil-cli/commit/eb5ef78))

<a name="1.18.0"></a>

## 1.18.0 (2019-08-01)

-   feat: bump paper to 2.0.18 ([fa71b05](https://github.com/bigcommerce/stencil-cli/commit/fa71b05))
-   feat: remove client id from required fields ([0cbc093](https://github.com/bigcommerce/stencil-cli/commit/0cbc093))
-   fix: strf-7023 move browser-sync back to master ([c3db4db](https://github.com/bigcommerce/stencil-cli/commit/c3db4db))

<a name="1.17.0"></a>

## 1.17.0 (2019-07-15)

-   feat: update stencil-paper to add getImageSrcset helper ([892fbfd](https://github.com/bigcommerce/stencil-cli/commit/892fbfd))
-   Update README ([73898c0](https://github.com/bigcommerce/stencil-cli/commit/73898c0))

<a name="1.16.0"></a>

## 1.16.0 (2019-06-04)

-   Remove Node 6 from Travis ([1cab37f](https://github.com/bigcommerce/stencil-cli/commit/1cab37f))
-   fix: strf-6383 add check for template size for stencil bundling ([f674c05](https://github.com/bigcommerce/stencil-cli/commit/f674c05))
-   fix: update engines for node in package.json ([70ae9a3](https://github.com/bigcommerce/stencil-cli/commit/70ae9a3))
-   feat: strf-6687 update stencil-paper to add font-display support ([3af5562](https://github.com/bigcommerce/stencil-cli/commit/3af5562))

<a name="1.15.9"></a>

## <small>1.15.9 (2019-04-03)</small>

-   fix: added browser-sync to package-lock (#454) ([dcc4795](https://github.com/bigcommerce/stencil-cli/commit/dcc4795))
-   Revert "feat: Add support for base_url and secure_base_url" (#453) ([74d1122](https://github.com/bigcommerce/stencil-cli/commit/74d1122))

<a name="1.15.8"></a>

## <small>1.15.8 (2019-04-02)</small>

-   ci: updated paper to 2.0.12 (#451) ([5e83f64](https://github.com/bigcommerce/stencil-cli/commit/5e83f64))
-   docs: Update stencil cli installation link ([834fee2](https://github.com/bigcommerce/stencil-cli/commit/834fee2))
-   feat: Add support for base_url and secure_base_url ([cc3ca08](https://github.com/bigcommerce/stencil-cli/commit/cc3ca08))

<a name="1.15.7"></a>

## <small>1.15.7 (2019-03-26)</small>

<a name="1.15.6"></a>

## <small>1.15.6 (2019-03-07)</small>

-   fix: added bump of package-lock.json to gulp release task (#448) ([f2c423b](https://github.com/bigcommerce/stencil-cli/commit/f2c423b))
-   fix: revert paper_2.0.11 pr (#445) ([adf424f](https://github.com/bigcommerce/stencil-cli/commit/adf424f))
-   docs: updated paper to 2.0.11 + checked package-lock (#446) ([54ddad0](https://github.com/bigcommerce/stencil-cli/commit/54ddad0))
-   docs(release): releasing 1.15.6 ([0bb0eb1](https://github.com/bigcommerce/stencil-cli/commit/0bb0eb1))
-   Docs: upgraded paper (#441) ([26b3937](https://github.com/bigcommerce/stencil-cli/commit/26b3937))
-   feat(theme): add csrf protection to the list of valid features ([fe4b795](https://github.com/bigcommerce/stencil-cli/commit/fe4b795))

<a name="1.15.5"></a>

## <small>1.15.5 (2019-02-05)</small>

-   fix: added fix for scss compilation issue ([e6a20a2](https://github.com/bigcommerce/stencil-cli/commit/e6a20a2))
-   fix(cp): STRF-5614 Add enhanced_ecommerce to theme config schema. ([58c6fb9](https://github.com/bigcommerce/stencil-cli/commit/58c6fb9))
-   feat: changelog generator (#431) ([9e6e225](https://github.com/bigcommerce/stencil-cli/commit/9e6e225))
-   Increase timeout for build worker process to be ready ([794e796](https://github.com/bigcommerce/stencil-cli/commit/794e796))
-   log push errors to the console ([a9aca72](https://github.com/bigcommerce/stencil-cli/commit/a9aca72))
-   PROJECT-1897: Card Management - List, Delete, Edit, Add Cards ([44022a0](https://github.com/bigcommerce/stencil-cli/commit/44022a0))
-   Proper error handling for bundle task ([a4dc6c9](https://github.com/bigcommerce/stencil-cli/commit/a4dc6c9))
-   update paper npm version ([d5f78a4](https://github.com/bigcommerce/stencil-cli/commit/d5f78a4))
-   Update README ([298beaa](https://github.com/bigcommerce/stencil-cli/commit/298beaa))
-   upgrade paper package to 2.0.10 ([b4ec832](https://github.com/bigcommerce/stencil-cli/commit/b4ec832))

<a name="1.15.4"></a>

## <small>1.15.4 (2018-12-17)</small>

-   fix(cp): STRF-5614 Add enhanced_ecommerce to theme config schema. ([58c6fb9](https://github.com/bigcommerce/stencil-cli/commit/58c6fb9))

<a name="1.15.3"></a>

## <small>1.15.3 (2018-12-11)</small>

-   upgrade paper package to 2.0.10 ([b4ec832](https://github.com/bigcommerce/stencil-cli/commit/b4ec832))
-   Proper error handling for bundle task ([a4dc6c9](https://github.com/bigcommerce/stencil-cli/commit/a4dc6c9))
-   PROJECT-1897: Card Management - List, Delete, Edit, Add Cards ([44022a0](https://github.com/bigcommerce/stencil-cli/commit/44022a0))
-   Increase timeout for build worker process to be ready ([794e796](https://github.com/bigcommerce/stencil-cli/commit/794e796))
-   log push errors to the console ([a9aca72](https://github.com/bigcommerce/stencil-cli/commit/a9aca72))
-   update paper npm version ([d5f78a4](https://github.com/bigcommerce/stencil-cli/commit/d5f78a4))
-   Point to http instead of https for stencil editor sdk. ([0a9acf6](https://github.com/bigcommerce/stencil-cli/commit/0a9acf6))
-   Update README ([298beaa](https://github.com/bigcommerce/stencil-cli/commit/298beaa))
-   Deprecate support for node 4.x ([e5c3e96](https://github.com/bigcommerce/stencil-cli/commit/e5c3e96))
-   Deprecate support for node 4.x ([1ead058](https://github.com/bigcommerce/stencil-cli/commit/1ead058))
-   Bundle all webpack files + release 1.15.0 ([537bb93](https://github.com/bigcommerce/stencil-cli/commit/537bb93))
-   STRF-4889: Fix error message for upload limit ([95ba66b](https://github.com/bigcommerce/stencil-cli/commit/95ba66b))
-   Update paper & bump version ([9217d6f](https://github.com/bigcommerce/stencil-cli/commit/9217d6f))
-   adding -a and --activate flags to stencil push ([5f2ceb8](https://github.com/bigcommerce/stencil-cli/commit/5f2ceb8))
-   Update README.md to include min versions of Node ([cf9798c](https://github.com/bigcommerce/stencil-cli/commit/cf9798c))
-   trailing comma on output ([0d77cd6](https://github.com/bigcommerce/stencil-cli/commit/0d77cd6))
-   ability to locally save bundled theme after push ([f9610d0](https://github.com/bigcommerce/stencil-cli/commit/f9610d0))
