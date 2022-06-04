// "use strict";

import admin from "../config/admin";

// const path = require("path");
// const isLocal = true;
// const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
// const { MODE } = require(path.join(basePath, "src/blendMode.js"));

// const buildDir = path.join(basePath, "/build");
// const layersDir = path.join(basePath, "/layers");

export const storageRef = admin.storage().bucket(`gs://minft-staging.appspot.com`);
