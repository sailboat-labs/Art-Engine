import { buildSetup, startCreating } from './src/main';
// #!/usr/bin/env node
// "use strict";

// import path from "path";
// // const isLocal = typeof process.pkg === "undefined";
// const isLocal = true;
// const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);

// // const fs = require("fs");
// import fs from "fs"
// // const { Command } = require("commander");
// import { Command } from "commander";
// const program = new Command();
// // const chalk = require("chalk");
// import chalk from "chalk";
// import { buildSetup, startCreating } from "./src/main";




// program
//   .name("generate")

//   .option("-c, --continue <dna>", "Continues generatino using a _dna.json file")
//   .action((options) => {
//     console.log(chalk.green("generator started"), options.continue);
//     options.continue
//       ? console.log(
//         chalk.bgCyanBright("\n continuing generation using _dna.json file \n")
//       )
//       : null;
//     buildSetup();
//     let dna = null;
//     // if (options.continue) {
//     //   const storedGenomes = JSON.parse(fs.readFileSync(options.continue));
//     //   dna = new Set(storedGenomes);
//     //   console.log({ dna });
//     // }

//     startCreating(dna);
//   });

// program.parse();




// configure environment variables

const express = require("express");
const cors = require("cors");

// create base express application
const app = express();

// configure application middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const port = process.env.PORT || 7210;
(async () => {
  // register routes

  app.listen(port, () => {
    console.log(`🚀 Application running on port ${port}`);
    buildSetup()
    let dna = null
    startCreating(dna)
  });
})();

