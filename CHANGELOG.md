# Changelog

## [1.1.0](https://github.com/iumalabs/sharesecret/compare/v1.0.0...v1.1.0) (2026-08-12)


### Features

* add interactive canvas grid background ([#21](https://github.com/iumalabs/sharesecret/issues/21)) ([7ea9a72](https://github.com/iumalabs/sharesecret/commit/7ea9a72fb5c25225b2485a88ba0f86b5da000a83))
* add QR code to the sealed result screen ([#29](https://github.com/iumalabs/sharesecret/issues/29)) ([909e2e0](https://github.com/iumalabs/sharesecret/commit/909e2e0e6d221db1956e2ccb86739f70db26156d)), closes [#27](https://github.com/iumalabs/sharesecret/issues/27)
* add Vault, a local history of created secrets ([#31](https://github.com/iumalabs/sharesecret/issues/31)) ([5c5c662](https://github.com/iumalabs/sharesecret/commit/5c5c6620b94317c04e85bc565c8cbdcef0a8e757)), closes [#26](https://github.com/iumalabs/sharesecret/issues/26)
* apply visual design (colors/type), theme switcher, How It Works page ([#6](https://github.com/iumalabs/sharesecret/issues/6)) ([0b29587](https://github.com/iumalabs/sharesecret/commit/0b2958732c4ce1ddc8564a33bc7a74b577c35350))
* core secret create/reveal API with PIN protection ([#3](https://github.com/iumalabs/sharesecret/issues/3)) ([cff3f60](https://github.com/iumalabs/sharesecret/commit/cff3f608a719affbe7ddd3af09d0e98f96819cd0))
* cron sweep for expired secrets ([#5](https://github.com/iumalabs/sharesecret/issues/5)) ([4505d7d](https://github.com/iumalabs/sharesecret/commit/4505d7d002fd454f897389a4803100de35efab15))
* scaffold Cloudflare Workers + Hono + React project ([#1](https://github.com/iumalabs/sharesecret/issues/1)) ([a3aad86](https://github.com/iumalabs/sharesecret/commit/a3aad861d11004329cbc3202964a2228d5861b01))
* settle on single theme (Neon Vault), add real logo mark + favicon ([#7](https://github.com/iumalabs/sharesecret/issues/7)) ([9e3664d](https://github.com/iumalabs/sharesecret/commit/9e3664da6729e6fc8c8fd269d0e22794802257f5))
* zero-knowledge React UI for creating and revealing secrets ([#4](https://github.com/iumalabs/sharesecret/issues/4)) ([2c1b49c](https://github.com/iumalabs/sharesecret/commit/2c1b49cadf1c3e9f086f634f8007de5db1c5aa5a))


### Bug Fixes

* add forward-navigation CTAs to dead-end reveal screens ([#51](https://github.com/iumalabs/sharesecret/issues/51)) ([c6775fd](https://github.com/iumalabs/sharesecret/commit/c6775fdf67bc4537cbc83ffae6759806d2b8acb8))
* add site footer, matching the design ([#16](https://github.com/iumalabs/sharesecret/issues/16)) ([3bcc06a](https://github.com/iumalabs/sharesecret/commit/3bcc06a7e90f702b7a027b3dc09a455858e2fc4d))
* align Send a secret / Open vault buttons on dead-end screens ([#55](https://github.com/iumalabs/sharesecret/issues/55)) ([66c3285](https://github.com/iumalabs/sharesecret/commit/66c3285f21e62a9f711006c53c9ce9b60c2dcd5c))
* auto-clear revealed secret from screen ([#28](https://github.com/iumalabs/sharesecret/issues/28)) ([edc8c82](https://github.com/iumalabs/sharesecret/commit/edc8c8290df1ff0e28741a6764ef369ea4a4dc32)), closes [#25](https://github.com/iumalabs/sharesecret/issues/25)
* **critical:** PBKDF2 iteration count exceeded workerd's platform cap ([#14](https://github.com/iumalabs/sharesecret/issues/14)) ([6932beb](https://github.com/iumalabs/sharesecret/commit/6932beb0756ad308d0c8564767c7e084bc508857))
* destruct countdown, progress bar, and manual burn on the revealed screen ([#50](https://github.com/iumalabs/sharesecret/issues/50)) ([7168ce4](https://github.com/iumalabs/sharesecret/commit/7168ce4b54cb036a55a4608489069216d10e9474))
* exclude CHANGELOG.md from deno fmt ([#63](https://github.com/iumalabs/sharesecret/issues/63)) ([5d6e8fa](https://github.com/iumalabs/sharesecret/commit/5d6e8fabb3c750cb841ed7502e933c934ddbf6a3))
* generate real AES-256 keys instead of AES-128, matching the copy ([#15](https://github.com/iumalabs/sharesecret/issues/15)) ([82c382f](https://github.com/iumalabs/sharesecret/commit/82c382faab0821341cdb4c121b33325c9cc080c5))
* give copy buttons visual feedback, matching the mockup ([#8](https://github.com/iumalabs/sharesecret/issues/8)) ([b331187](https://github.com/iumalabs/sharesecret/commit/b331187e7adbe0371f71c84e0ada4755d4628bdb))
* grid canvas resize robustness + Vault read-status color ([#43](https://github.com/iumalabs/sharesecret/issues/43)) ([aad93ce](https://github.com/iumalabs/sharesecret/commit/aad93ce174bd536f86f9dad5fa06fdfc901ad8cd))
* lay out the PIN value and Copy PIN button horizontally ([#56](https://github.com/iumalabs/sharesecret/issues/56)) ([b631af8](https://github.com/iumalabs/sharesecret/commit/b631af8f9ad454df27af9511c3e44373221bf314))
* **low:** give every RevealPage screen a real &lt;h1&gt; ([#20](https://github.com/iumalabs/sharesecret/issues/20)) ([97e0249](https://github.com/iumalabs/sharesecret/commit/97e0249a888d0546a283b05aa07c036d2b70dffc))
* match background grid to the mockup's canvas implementation ([#13](https://github.com/iumalabs/sharesecret/issues/13)) ([a2da9bc](https://github.com/iumalabs/sharesecret/commit/a2da9bc2f729608e8a86816f736cf8e9e7f84f28))
* match QR code colors to the dark theme ([#46](https://github.com/iumalabs/sharesecret/issues/46)) ([#49](https://github.com/iumalabs/sharesecret/issues/49)) ([b73ee4a](https://github.com/iumalabs/sharesecret/commit/b73ee4ae1a0b18bf7748991a52336494c822be42))
* **medium:** stop checkMessage from clobbering a failed key-import state ([#19](https://github.com/iumalabs/sharesecret/issues/19)) ([8714d2c](https://github.com/iumalabs/sharesecret/commit/8714d2ccabf912be68ee9cfcba2cce0448c09d90))
* pin Vite cacheDir under node_modules to silence Babel deopt warning ([#38](https://github.com/iumalabs/sharesecret/issues/38)) ([2551f04](https://github.com/iumalabs/sharesecret/commit/2551f0483afed019fafd5aba05063d9f640dac50))
* port grid background to WebGL2, fix preserveDrawingBuffer bug (SS-002 cont.) ([#37](https://github.com/iumalabs/sharesecret/issues/37)) ([330b3fd](https://github.com/iumalabs/sharesecret/commit/330b3fd8ddd187b16b31f3afc8a2201c421d2d09))
* raise grid background resting-state alpha for legibility ([#24](https://github.com/iumalabs/sharesecret/issues/24)) ([86be67d](https://github.com/iumalabs/sharesecret/commit/86be67d365edb137cd2c4b05b2d689438c769096)), closes [#23](https://github.com/iumalabs/sharesecret/issues/23)
* raise grid rest-alpha further, add ?grid-debug=1 verification mode ([#35](https://github.com/iumalabs/sharesecret/issues/35)) ([c428e6b](https://github.com/iumalabs/sharesecret/commit/c428e6b5e3721518d83a726075b228c609ff2e4c))
* remove Vault's broken "Open" link (fixes [#42](https://github.com/iumalabs/sharesecret/issues/42)) ([#45](https://github.com/iumalabs/sharesecret/issues/45)) ([eca4fb6](https://github.com/iumalabs/sharesecret/commit/eca4fb634c3c5a95a369c3bf4f177201ff67d860))
* root cause of the invisible grid -- negative z-index fails to composite ([#40](https://github.com/iumalabs/sharesecret/issues/40)) ([3ae2024](https://github.com/iumalabs/sharesecret/commit/3ae202451318eb02ae6c15013eae3aa8ae551409))
* sync grid shader tuning from design, drop Canvas 2D fallback for CSS ([#39](https://github.com/iumalabs/sharesecret/issues/39)) ([36dbfd3](https://github.com/iumalabs/sharesecret/commit/36dbfd396af14d9c2a5c2a9cfaec5ed013e45395))
