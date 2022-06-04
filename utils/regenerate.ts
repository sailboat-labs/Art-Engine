"use strict";

import { IConfig } from "../src/interfaces";

/**
 * The regeneration util uses the output _dna.json file to "continue" the same
 * uniqueness check the main generator uses when running the inital generation.
 *
 * This util takes an id number and generates an _additional_ unique DNA sequence,
 * and replaces the existing image and json files of the same id.
 *
 * It is assumed that the item is being regenerated because of an issue with
 * the DNA (picked traits), and that DNA is left in the _dna.json file so
 * (while changes are low) that item is not recreated again.
 */

const isLocal = true
const path = require("path");
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const fs = require("fs");
const { Command } = require("commander");
const program = new Command();
const { createCanvas } = require("canvas");

const chalk = require("chalk");

const jsonDir = `${basePath}/build/json`;
const imageDir = `${basePath}/build/images`;
const dnaFilePath = `${basePath}/build/_dna.json`;
const metadataFilePath = `${basePath}/build/json/_metadata.json`;


export const configuration: IConfig = {
  description: "This is the description",
  baseUri: "ipfs://NewUriToReplace",
  startIndex: 0,
  format: {
    width: 1024,
    height: 1024,
    smoothing: true,
    weight:1
  },
  background: {
    generate: true,
    brightness: "100%",
  },
  layerConfigurations: [
    {
      growEditionSizeTo: 4,
      namePrefix: "NZMX Club", // Use to add a name to Metadata `name:`
      layersOrder: [
        { name: "Background" },
        { name: "Skin" },
        { name: "Eyes" },
        { name: "Clothes" },
        { name: "Head Accessory" },
        { name: "Bling" },
      ],
    },
  ],
  extraAttributes:[],
  shuffleLayerConfigurations: true,
  emptyLayerName: "NONE",
  forcedCombinations: {},
  hashImages: true,
  preview: {
    thumbPerRow: 8,
    thumbWidth: 1000,
    imageRatio: 1,
    imageName: "preview.png",
  },
  preview_gif: {
    numberOfImages: 64,
    order: "ASC", // ASC, DESC, MIXED
    repeat: 1,
    quality: 200,
    delay: 500,
    imageName: "preview.gif",
  },
  rarityDelimiter:"#",
  useRootTraitType:true,
  outputJPEG:false,
  incompatible:{},
  uniqueDnaTorrance:10000,
  traitValueOverrides:{
    
  }
};



const {
  createDna,
  DNA_DELIMITER,
  isDnaUnique,
  paintLayers,
  layersSetup,
  constructLayerToDna,
  loadLayerImg,
  addMetadata,
  postProcessMetadata,
} = require(path.join(basePath, "/src/main.ts"));

let failedCount = 0;
let attributesList = [];
const canvas = createCanvas(configuration.format.width, configuration.format.height);
const ctxMain = canvas.getContext("2d");

const getDNA = () => {
  const flat = JSON.parse(fs.readFileSync(dnaFilePath));
  return flat.map((dnaStrand) => dnaStrand.split(DNA_DELIMITER));
  // .filter((item) => /^[0-9]{1,6}.json/g.test(item));
};

const createItem = (layers) => {
  let newDna = createDna(layers);
  const existingDna = getDNA();
  if (isDnaUnique(existingDna, newDna)) {
    return { newDna, layerImages: constructLayerToDna(newDna, layers) };
  } else {
    failedCount++;
    createItem(layers);
    if (failedCount >= configuration.uniqueDnaTorrance) {
      console.log(
        chalk.redBright(
          `You need more layers or elements to create a new, unique item`
        )
      );
      process.exit();
    }
  }
};

const outputFiles = (_id, layerData, options) => {
  const { newDna, abstractedIndexes } = layerData;

  // Save the image
  fs.writeFileSync(
    `${imageDir}/${_id}${configuration.outputJPEG ? ".jpg" : ".png"}`,
    canvas.toBuffer(`${configuration.outputJPEG ? "image/jpeg" : "image/png"}`)
  );

  const { _imageHash, _prefix, _offset } = postProcessMetadata(layerData);

  const metadata = addMetadata(newDna, abstractedIndexes[0], {
    _prefix,
    _offset,
    _imageHash,
  });

  options.debug ? console.log({ metadata }) : null;
  // save the metadata json
  fs.writeFileSync(`${jsonDir}/${_id}.json`, JSON.stringify(metadata, null, 2));
  console.log(chalk.bgGreenBright.black(`Recreated item: ${_id}`));
  //TODO: update and output _metadata.json

  const originalMetadata = JSON.parse(fs.readFileSync(metadataFilePath));
  const updatedMetadata = [...originalMetadata];
  const editionIndex = _id - configuration.startIndex;
  updatedMetadata[editionIndex] = metadata;
  fs.writeFileSync(metadataFilePath, JSON.stringify(updatedMetadata, null, 2));
};

const regenerateItem = (_id, options) => {
  // get the dna lists
  // FIgure out which layer config set it's from
  const layerEdition = configuration.layerConfigurations.reduce((acc, config) => {
    return [...acc, config.growEditionSizeTo];
  }, []);
  const layerConfigIndex = layerEdition.findIndex(
    (editionCount) => _id <= editionCount
  );

  const layers = layersSetup(configuration.layerConfigurations[layerConfigIndex].layersOrder);

  const { newDna, layerImages } = createItem(layers);
  options.debug ? console.log({ newDna }) : null;

  // regenerate an image using main functions
  const allImages = layerImages.reduce((images, layer) => {
    return [...images, ...layer.selectedElements];
  }, []);

  const loadedElements = allImages.reduce((acc, layer) => {
    return [...acc, loadLayerImg(layer)];
  }, []);

  Promise.all(loadedElements).then((renderObjectArray) => {
    const layerData = {
      newDna,
      layerConfigIndex,
      abstractedIndexes: [_id],
      _background: configuration.background,
    };
    // paint layers to global canvas context.. no return value
    paintLayers(ctxMain, renderObjectArray, layerData);
    outputFiles(_id, layerData, options);

    // update the _dna.json
    const existingDna = getDNA();
    const existingDnaFlat = existingDna.map((dna) => dna.join(DNA_DELIMITER));

    const updatedDnaList = [...existingDnaFlat];
    // find the correct entry and update it
    const dnaIndex = _id - configuration.startIndex;
    updatedDnaList[dnaIndex] = newDna;

    options.debug
      ? console.log(
          chalk.redBright(`replacing old DNA:\n`, existingDnaFlat[dnaIndex])
        )
      : null;
    options.debug
      ? console.log(
          chalk.greenBright(`\nWith new DNA:\n`, updatedDnaList[dnaIndex])
        )
      : null;

    fs.writeFileSync(
      path.join(dnaFilePath),
      JSON.stringify(updatedDnaList, null, 2)
    );
  });
};

program
  .argument("<id>")
  .option("-d, --debug", "display some debugging")
  .action((id, options, command) => {
    options.debug
      ? console.log(chalk.greenBright.inverse(`Regemerating #${id}`))
      : null;

    regenerateItem(id, options);
  });

program.parse();
