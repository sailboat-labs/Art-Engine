/* eslint-disable no-async-promise-executor */
/* eslint-disable no-useless-escape */
"use strict";

// import fs from "fs"
// import path from "path";
// import keccak256 from "keccak256";
// import chalk from "chalk";
const uuid = require("uuid-v4");

const fs = require("fs");
const path = require("path");
const keccak256 = require("keccak256");
const chalk = require("chalk");
const { v4: uuidv4 } = require("uuid");

// const isLocal = typeof process.pkg === "undefined";
const isLocal = true;
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);

import { firebaseApp } from "../config/firebase";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import admin from "../config/admin";
import { IConfig, IElement, ILayer, ILayerConfigurations } from "./interfaces";
import { storageRef } from "./config";

const { createCanvas, loadImage } = require(path.join(
  basePath,
  "/node_modules/canvas"
));

const firestore = getFirestore(firebaseApp);

const buildDir = path.join(basePath, "/build");
const layersDir = path.join(basePath, "/layers");

const extraAttributes = () => [
  // Optionally, if you need to overwrite one of your layers attributes.
  // You can include the same name as the layer, here, and it will overwrite
  //
  // {
  // trait_type: "Bottom lid",
  //   value: ` Bottom lid #${Math.random() * 100}`,
  // },
  // {
  //   display_type: "boost_number",
  //   trait_type: "Aqua Power",
  //   value: Math.random() * 100,
  // },
  // {
  //   display_type: "boost_number",
  //   trait_type: "Health",
  //   value: Math.random() * 100,
  // },
  // {
  //   display_type: "boost_number",
  //   trait_type: "Mana",
  //   value: Math.floor(Math.random() * 100),
  // },
];

//settings
const debugLogs = true;
export const configuration: IConfig = {
  description: "This is the description",
  baseUri: "ipfs://NewUriToReplace",
  startIndex: 0,
  format: {
    width: 512,
    height: 512,
    smoothing: true,
    weight: 1,
  },
  background: {
    generate: true,
    brightness: "100%",
  },
  layerConfigurations: [
    {
      growEditionSizeTo: 64,
      namePrefix: "Nozo", // Use to add a name to Metadata `name:`
      layersOrder: [
        { name: "Background" },
        { name: "Skin" },
        { name: "Outfits" },
        { name: "Eyes" },
        { name: "Mouths" },
        { name: "Beard" },
      ],
    },
  ],
  extraAttributes: [],
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
  rarityDelimiter: "#",
  useRootTraitType: true,
  outputJPEG: false,
  incompatible: {},
  uniqueDnaTorrance: 10000,
  traitValueOverrides: {},
};

let metadataList = [];
let attributesList = [];

const DNA_DELIMITER = "*";

const zflag = /(z-?\d*,)/;

export const buildSetup = ({ address, collection }) => {
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
  }
  if (!fs.existsSync(`${buildDir}/json`)) {
    fs.mkdirSync(path.join(buildDir, "/json"));
  }
  if (!fs.existsSync(`${buildDir}/images`)) {
    fs.mkdirSync(path.join(buildDir, "/images"));
  }

  if (!fs.existsSync(`${buildDir}/json/${address}`)) {
    fs.mkdirSync(path.join(buildDir, `/json/${address}`));
  }
  if (!fs.existsSync(`${buildDir}/images/${address}`)) {
    fs.mkdirSync(path.join(buildDir, `/images/${address}`));
  }

  if (fs.existsSync(`${buildDir}/json/${address}/${collection}`)) {
    fs.rmdirSync(`${buildDir}/json/${address}/${collection}`, {
      recursive: true,
    });
  }
  fs.mkdirSync(path.join(`${buildDir}/json/${address}`, `/${collection}`));

  if (fs.existsSync(`${buildDir}/images/${address}/${collection}`)) {
    fs.rmdirSync(`${buildDir}/images/${address}/${collection}`, {
      recursive: true,
    });
  }
  fs.mkdirSync(path.join(`${buildDir}/images/${address}`, `/${collection}`));
};

const getRarityWeight = (_path) => {
  // check if there is an extension, if not, consider it a directory
  const exp = /#(\d*)/;
  const weight = exp.exec(_path);
  const weightNumber = weight ? Number(weight[1]) : null;
  if (!weightNumber || isNaN(weightNumber)) {
    return "required";
  }
  return weightNumber;
};

const cleanDna = (_str) => {
  var dna = _str.split(":").shift();
  return dna;
};

const cleanName = (_str) => {
  const hasZ = zflag.test(_str);

  const zRemoved = _str.replace(zflag, "");

  const extension = /\.[0-9a-zA-Z]+$/;
  const hasExtension = extension.test(zRemoved);
  let nameWithoutExtension = hasExtension ? zRemoved.slice(0, -4) : zRemoved;
  var nameWithoutWeight = nameWithoutExtension
    .split(configuration.rarityDelimiter)
    .shift();
  return nameWithoutWeight;
};

const parseQueryString = (filename, layer, sublayer) => {
  const query = /\?(.*)\./;
  const querystring = query.exec(filename);
  if (!querystring) {
    return getElementOptions(layer, sublayer);
  }

  const layerstyles: any = querystring[1].split("&").reduce((r, setting) => {
    const keyPairs = setting.split("=");
    return { ...r, [keyPairs[0]]: keyPairs[1] };
  }, []);

  return {
    blendmode: layerstyles.blend
      ? layerstyles.blend
      : getElementOptions(layer, sublayer).blendmode,
    opacity: layerstyles.opacity
      ? layerstyles.opacity / 100
      : getElementOptions(layer, sublayer).opacity,
  };
};

/**
 * Given some input, creates a sha256 hash.
 * @param {Object} input
 */
const hash = (input: any) => {
  // const hashable = typeof input === Buffer ? input : JSON.stringify(input);
  const hashable = JSON.stringify(input);
  return keccak256(hashable).toString("hex");
};

/**
 * Get't the layer options from the parent, or grandparent layer if
 * defined, otherwise, sets default options.
 *
 * @param {Object} layer the parent layer object
 * @param {String} sublayer Clean name of the current layer
 * @returns {blendmode, opaticty} options object
 */
const getElementOptions = (layer, sublayer) => {
  let blendmode = "source-over";
  let opacity = 1;
  if (layer.sublayerOptions?.[sublayer]) {
    const options = layer.sublayerOptions[sublayer];
    options.blend !== undefined ? (blendmode = options.blend) : null;
    options.opacity !== undefined ? (opacity = options.opacity) : null;
  } else {
    // inherit parent blend mode
    blendmode = layer.blend != undefined ? layer.blend : "source-over";
    opacity = layer.opacity != undefined ? layer.opacity : 1;
  }
  return { blendmode, opacity };
};

const parseZIndex = (str) => {
  const z = zflag.exec(str);
  return z ? parseInt(z[0].match(/-?\d+/)[0]) : null;
};

const getTraitValueFromPath = (element, lineage) => {
  // If the element is a required png. then, the trait property = the parent path
  // if the element is a non-required png. black%50.png, then element.name is the value and the parent Dir is the prop
  if (element.weight !== "required") {
    return element.name;
  } else if (element.weight === "required") {
    // if the element is a png that is required, get the traitValue from the parent Dir
    return element.sublayer ? true : cleanName(lineage[lineage.length - 2]);
  }
};

/**
 * Checks the override object for trait overrides
 * @param {String} trait The default trait value from the path-name
 * @returns String trait of either overridden value of raw default.
 */
const processTraitOverrides = (trait) => {
  return configuration.traitValueOverrides[trait]
    ? configuration.traitValueOverrides[trait]
    : trait;
};

const layersSetup = async (address, collection, layerOrder) => {
  console.log("fetching layers");

  // const layers = layersOrder.map((layerObj, index) => {
  //   return {
  //     id: index,
  //     name: layerObj.name,
  //     blendmode:
  //       layerObj["blend"] != undefined ? layerObj["blend"] : "source-over",
  //     opacity: layerObj["opacity"] != undefined ? layerObj["opacity"] : 1,
  //     elements: getElements(`${layersDir}/${layerObj.name}/`, layerObj),``
  //     ...(layerObj.display_type !== undefined && {
  //       display_type: layerObj.display_type,
  //     }),
  //     bypassDNA:
  //       layerObj.options?.["bypassDNA"] !== undefined
  //         ? layerObj.options?.["bypassDNA"]
  //         : false,
  //   };
  // });

  // const _layers = (
  //   await admin
  //     .firestore()
  //     .collection("art-engine")
  //     .doc("users")
  //     .collection(address)
  //     .doc(collection)
  //     .collection("layers")
  //     .get()
  // ).docs.map((item) => item.data()) as ILayer[];

  const elements = (
    await admin
      .firestore()
      .collection("art-engine")
      .doc("users")
      .collection(address)
      .doc(collection)
      .collection("elements")
      .get()
  ).docs.map((item) => item.data()) as IElement[];

  const layers = layerOrder.map((layer: ILayer, layerIndex) => {
    return {
      id: layerIndex,
      name: layer.name,
      blendmode: layer.blendmode,
      opacity: layer.opacity,
      elements: elements
        .filter(
          (element) => element.trait.toLowerCase() == layer.name.toLowerCase()
        )
        .map((element, index) => {
          return {
            sublayer: element.sublayer,
            weight: index + 1,
            blendmode: element.blendmode,
            opacity: element.opacity,
            id: index,
            name: element.name,
            filename: `${layer.name}#${padLeft(index + 1)}.png`,
            path: element.path,
            zindex: element.zindex,
            trait: element.trait,
            traitValue: element.traitValue,
          };
        }),
      bypassDNA: layer.bypassDNA,
    };
  });

  return layers;
};

function padLeft(n) {
  return (n < 10 ? "00" : n < 100 ? "0" : "") + n;
}

async function uploadFile(path, filename, address, collection, canvas) {
  const metadata = {
    metadata: {
      // This line is very important. It's to create a download token.
      firebaseStorageDownloadTokens: uuid(),
    },
    contentType: "image/png",
    cacheControl: "public, max-age=31536000",
  };

  // Uploads a local file to the bucket
  const image = await storageRef.upload(path, {
    // Support for HTTP requests made with `Accept-Encoding: gzip`
    gzip: true,
    metadata: metadata,
    public: true,
    destination: `art-engine/${address}/${collection}/output/${filename}`,
  });

  const file = storageRef.file(
    `art-engine/${address}/${collection}/output/${filename}`
  );

  

  await admin
  .firestore()
  .collection("art-engine")
  .doc("users")
  .collection(address)
  .doc(collection)
  .collection("generated")
    .doc(filename?.toString())
    .set({
      filename,
      url: file.publicUrl(),
      createdOn: new Date().toISOString(),
    });
}

const saveImage = async (_editionCount, address, collection, canvas) => {
  fs.writeFileSync(
    `${buildDir}/images/${address}/${collection}/${_editionCount}${
      configuration.outputJPEG ? ".jpg" : ".png"
    }`,
    canvas.toBuffer(`${configuration.outputJPEG ? "image/jpeg" : "image/png"}`)
  );

  // console.log({ dataUrl });

  await uploadFile(
    `${buildDir}/images/${address}/${collection}/${_editionCount}${
      configuration.outputJPEG ? ".jpg" : ".png"
    }`,
    _editionCount,
    address,
    collection,
    canvas
  );

  // await admin
  //       .firestore()
  //       .collection("deletedCompanies")
  //       .doc(company.id)
  //       .set({ ...company, ...{ deletedAt: new Date().toISOString() } });
};

const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  let pastel = `hsl(${hue}, 100%, ${configuration.background.brightness})`;
  return pastel;
};

const drawBackground = (canvasContext) => {
  canvasContext.fillStyle = genColor();
  canvasContext.fillRect(
    0,
    0,
    configuration.format.width,
    configuration.format.height
  );
};

const addMetadata = (_dna, _edition, _prefixData) => {
  let dateTime = Date.now();
  const { _prefix, _offset, _imageHash } = _prefixData;

  const combinedAttrs = [...attributesList, ...extraAttributes()];
  const cleanedAttrs = combinedAttrs.reduce((acc, current) => {
    const x = acc.find((item) => item.trait_type === current.trait_type);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, []);

  let tempMetadata = {
    dna: hash(_dna),
    name: `${_prefix ? _prefix + " " : ""}#${_edition - _offset}`,
    description: configuration.description,
    image: `${configuration.baseUri}/${_edition}${
      configuration.outputJPEG ? ".jpg" : ".png"
    }`,
    ...(configuration.hashImages === true && { imageHash: _imageHash }),
    edition: _edition,
    date: dateTime,
    attributes: cleanedAttrs,
    compiler: "Sailboat Labs NFT Generator",
  };
  metadataList.push(tempMetadata);
  attributesList = [];
  return tempMetadata;
};

const addAttributes = (_element) => {
  let selectedElement = _element.layer;
  const layerAttributes = {
    trait_type: _element.layer.trait,
    value: selectedElement.traitValue,
    ...(_element.layer.display_type !== undefined && {
      display_type: _element.layer.display_type,
    }),
  };
  if (
    attributesList.some(
      (attr) => attr.trait_type === layerAttributes.trait_type
    )
  )
    return;
  attributesList.push(layerAttributes);
};

const loadLayerImg = async (_layer) => {
  return new Promise(async (resolve) => {
    // selected elements is an array.
    const image = await loadImage(`${_layer.path}`).catch((err) =>
      console.log(chalk.redBright(`failed to load ${_layer.path}`, err))
    );
    resolve({ layer: _layer, loadedImage: image });
  });
};

const drawElement = (_renderObject, mainCanvas) => {
  const layerCanvas = createCanvas(
    configuration.format.width,
    configuration.format.height
  );
  try {
    const layerctx = layerCanvas.getContext("2d");
    layerctx.imageSmoothingEnabled = configuration.format.smoothing;

    layerctx.drawImage(
      _renderObject.loadedImage,
      0,
      0,
      configuration.format.width,
      configuration.format.height
    );

    addAttributes(_renderObject);
    mainCanvas.drawImage(
      layerCanvas,
      0,
      0,
      configuration.format.width,
      configuration.format.height
    );
  } catch (error) {
    console.log(error);
  }
  return layerCanvas;
};

const constructLayerToDna = (_dna: any = [], _layers = []) => {
  const dna = _dna.split(DNA_DELIMITER);
  let mappedDnaToLayers = _layers.map((layer, index) => {
    let selectedElements = [];
    const layerImages = dna.filter(
      (element) => element.split(".")[0] == layer.id
    );
    layerImages.forEach((img) => {
      const indexAddress = cleanDna(img);

      //

      const indices = indexAddress.toString().split(".");
      // const firstAddress = indices.shift();
      const lastAddress = indices.pop(); // 1
      // recursively go through each index to get the nested item
      let parentElement = indices.reduce((r, nestedIndex) => {
        if (!r[nestedIndex]) {
          throw new Error("wtf");
        }
        return r[nestedIndex].elements;
      }, _layers); //returns string, need to return

      selectedElements.push(parentElement[lastAddress]);
    });
    // If there is more than one item whose root address indicies match the layer ID,
    // continue to loop through them an return an array of selectedElements

    return {
      name: layer.name,
      blendmode: layer.blendmode,
      opacity: layer.opacity,
      selectedElements: selectedElements,
      ...(layer.display_type !== undefined && {
        display_type: layer.display_type,
      }),
    };
  });
  return mappedDnaToLayers;
};

/**
 * In some cases a DNA string may contain optional query parameters for options
 * such as bypassing the DNA isUnique check, this function filters out those
 * items without modifying the stored DNA.
 *
 * @param {String} _dna New DNA string
 * @returns new DNA string with any items that should be filtered, removed.
 */
const filterDNAOptions = (_dna) => {
  const filteredDNA = _dna.split(DNA_DELIMITER).filter((element) => {
    const query = /(\?.*$)/;
    const querystring = query.exec(element);
    if (!querystring) {
      return true;
    }
    const options: any = querystring[1].split("&").reduce((r, setting) => {
      const keyPairs = setting.split("=");
      return { ...r, [keyPairs[0]]: keyPairs[1] };
    }, []);

    return options.bypassDNA;
  });

  return filteredDNA.join(DNA_DELIMITER);
};

/**
 * Cleaning function for DNA strings. When DNA strings include an option, it
 * is added to the filename with a ?setting=value query string. It needs to be
 * removed to properly access the file name before Drawing.
 *
 * @param {String} _dna The entire newDNA string
 * @returns Cleaned DNA string without querystring parameters.
 */
const removeQueryStrings = (_dna) => {
  const query = /(\?.*$)/;
  return _dna.replace(query, "");
};

// expecting to return an array of strings for each _layer_ that is picked,
// should be a flattened list of all things that are picked randomly AND reqiured
/**
 *
 * @param {Object} layer The main layer, defined in config.layerConfigurations
 * @param {Array} dnaSequence Strings of layer to object mappings to nesting structure
 * @param {Number*} parentId nested parentID, used during recursive calls for sublayers
 * @param {Array*} incompatibleDNA Used to store incompatible layer names while building DNA
 * @param {Array*} forcedDNA Used to store forced layer selection combinations names while building DNA
 * @param {Int} zIndex Used in the dna string to define a layers stacking order
 *  from the top down
 * @returns Array DNA sequence
 */
function pickRandomElement(
  layer,
  dnaSequence,
  parentId,
  incompatibleDNA,
  forcedDNA,
  bypassDNA,
  zIndex
) {
  let totalWeight = 0;
  // Does this layer include a forcedDNA item? ya? just return it.
  const forcedPick = layer.elements.find((element) =>
    forcedDNA.includes(element.name)
  );
  if (forcedPick) {
    debugLogs
      ? console.log(chalk.yellowBright(`Force picking ${forcedPick.name}/n`))
      : null;
    let dnaString = `${parentId}.${forcedPick.id}:${forcedPick.zindex}${forcedPick.filename}${bypassDNA}`;
    return dnaSequence.push(dnaString);
  }

  if (incompatibleDNA.includes(layer.name) && layer.sublayer) {
    debugLogs
      ? console.log(
          `Skipping incompatible sublayer directory, ${layer.name}`,
          layer.name
        )
      : null;
    return dnaSequence;
  }

  const compatibleLayers = layer.elements.filter(
    (layer) => !incompatibleDNA.includes(layer.name)
  );
  if (compatibleLayers.length === 0) {
    debugLogs
      ? console.log(
          chalk.yellow(
            "No compatible layers in the directory, skipping",
            layer.name
          )
        )
      : null;
    return dnaSequence;
  }

  compatibleLayers.forEach((element) => {
    // If there is no weight, it's required, always include it
    // If directory has %, that is % chance to enter the dir
    if (element.weight == "required" && !element.sublayer) {
      let dnaString = `${parentId}.${element.id}:${element.zindex}${element.filename}${bypassDNA}`;
      dnaSequence.unshift(dnaString);
      return;
    }
    // when the current directory is a required folder
    // and the element in the loop is another folder
    if (element.weight == "required" && element.sublayer) {
      const next = pickRandomElement(
        element,
        dnaSequence,
        `${parentId}.${element.id}`,
        incompatibleDNA,
        forcedDNA,
        bypassDNA,
        zIndex
      );
    }
    if (element.weight !== "required") {
      totalWeight += element.weight;
    }
  });
  // if the entire directory should be ignored…

  // number between 0 - totalWeight
  const currentLayers = compatibleLayers.filter((l) => l.weight !== "required");

  let random = Math.floor(Math.random() * totalWeight);

  for (var i = 0; i < currentLayers.length; i++) {
    // subtract the current weight from the random weight until we reach a sub zero value.
    // Check if the picked image is in the incompatible list
    random -= currentLayers[i].weight;

    // e.g., directory, or, all files within a directory
    if (random < 0) {
      // Check for incompatible layer configurations and only add incompatibilities IF
      // chosing _this_ layer.
      if (configuration.incompatible[currentLayers[i].name]) {
        debugLogs
          ? console.log(
              `Adding the following to incompatible list`,
              ...configuration.incompatible[currentLayers[i].name]
            )
          : null;
        incompatibleDNA.push(
          ...configuration.incompatible[currentLayers[i].name]
        );
      }
      // Similar to incompaticle, check for forced combos
      if (configuration.forcedCombinations[currentLayers[i].name]) {
        debugLogs
          ? console.log(
              chalk.bgYellowBright.black(
                `\nSetting up the folling forced combinations for ${currentLayers[i].name}: `,
                ...configuration.forcedCombinations[currentLayers[i].name]
              )
            )
          : null;
        forcedDNA.push(
          ...configuration.forcedCombinations[currentLayers[i].name]
        );
      }
      // if there's a sublayer, we need to concat the sublayers parent ID to the DNA srting
      // and recursively pick nested required and random elements
      if (currentLayers[i].sublayer) {
        return dnaSequence.concat(
          pickRandomElement(
            currentLayers[i],
            dnaSequence,
            `${parentId}.${currentLayers[i].id}`,
            incompatibleDNA,
            forcedDNA,
            bypassDNA,
            zIndex
          )
        );
      }

      // none/empty layer handler
      if (currentLayers[i].name === configuration.emptyLayerName) {
        return dnaSequence;
      }
      let dnaString = `${parentId}.${currentLayers[i].id}:${currentLayers[i].zindex}${currentLayers[i].filename}${bypassDNA}`;
      return dnaSequence.push(dnaString);
    }
  }
}

/**
 * given the nesting structure is complicated and messy, the most reliable way to sort
 * is based on the number of nested indecies.
 * This sorts layers stacking the most deeply nested grandchildren above their
 * immediate ancestors
 * @param {[String]} layers array of dna string sequences
 */
const sortLayers = (layers) => {
  const nestedsort = layers.sort((a, b) => {
    const addressA = a.split(":")[0];
    const addressB = b.split(":")[0];
    return addressA.length - addressB.length;
  });

  let stack = { front: [], normal: [], end: [] };
  stack = nestedsort.reduce((acc, layer) => {
    const zindex = parseZIndex(layer);
    if (!zindex)
      return { ...acc, normal: [...(acc.normal ? acc.normal : []), layer] };
    // move negative z into `front`
    if (zindex < 0)
      return { ...acc, front: [...(acc.front ? acc.front : []), layer] };
    // move positive z into `end`
    if (zindex > 0)
      return { ...acc, end: [...(acc.end ? acc.end : []), layer] };
    // make sure front and end are sorted
    // contat everything back to an ordered array
  }, stack);

  return sortByZ(stack.front).concat(stack.normal).concat(sortByZ(stack.end));
};

/** File String sort by zFlag */
function sortByZ(dnastrings) {
  return dnastrings.sort((a, b) => {
    const indexA = parseZIndex(a);
    const indexB = parseZIndex(b);
    return indexA - indexB;
  });
}

/**
 * Sorting by index based on the layer.z property
 * @param {Array } layers selected Image layer objects array
 */
function sortZIndex(layers) {
  return layers.sort((a, b) => {
    const indexA = parseZIndex(a.zindex);
    const indexB = parseZIndex(b.zindex);
    return indexA - indexB;
  });
}

const createDna = async (_layers) => {
  let dnaSequence = [];
  let incompatibleDNA = [];
  let forcedDNA = [];

  _layers.forEach((layer) => {
    const layerSequence = [];
    pickRandomElement(
      layer,
      layerSequence,
      layer.id,
      incompatibleDNA,
      forcedDNA,
      layer.bypassDNA ? "?bypassDNA=true" : "",
      layer.zindex ? layer.zIndex : ""
    );
    const sortedLayers = sortLayers(layerSequence);
    dnaSequence = [...dnaSequence, [sortedLayers]];
  });
  const zSortDNA = sortByZ(dnaSequence.flat(2));
  let dnaStrand = zSortDNA.join(DNA_DELIMITER);
  return dnaStrand;
};

const writeMetaData = (_data) => {
  fs.writeFileSync(`${buildDir}/json/_metadata.json`, _data);
};

const writeDnaLog = (_data) => {
  fs.writeFileSync(`${buildDir}/_dna.json`, _data);
};

const saveMetaDataSingleFile = (_editionCount, address, collection) => {
  let metadata = metadataList.find((meta) => meta.edition == _editionCount);
  debugLogs
    ? console.log(
        `Writing metadata for ${_editionCount}: ${JSON.stringify(metadata)}`
      )
    : null;
  fs.writeFileSync(
    `${buildDir}/json/${address}/${collection}/${_editionCount}.json`,
    JSON.stringify(metadata, null, 2)
  );
};

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

/**
 * Paints the given renderOjects to the main canvas context.
 *
 * @param {Array} renderObjectArray Array of render elements to draw to canvas
 * @param {Object} layerData data passed from the current iteration of the loop or configured dna-set
 *
 */
const paintLayers = (canvasContext, renderObjectArray, layerData) => {
  debugLogs ? console.log("\nClearing canvas") : null;
  canvasContext.clearRect(
    0,
    0,
    configuration.format.width,
    configuration.format.height
  );

  const { abstractedIndexes, _background } = layerData;

  renderObjectArray.forEach((renderObject) => {
    // one main canvas
    // each render Object should be a solo canvas
    // append them all to main canbas
    canvasContext.globalAlpha = renderObject.layer.opacity;
    canvasContext.globalCompositeOperation = renderObject.layer.blendmode;
    canvasContext.drawImage(
      drawElement(renderObject, canvasContext),
      0,
      0,
      configuration.format.weight,
      configuration.format.height
    );
  });

  if (_background.generate) {
    canvasContext.globalCompositeOperation = "destination-over";
    drawBackground(canvasContext);
  }
  debugLogs
    ? console.log("Editions left to create: ", abstractedIndexes)
    : null;
};

const postProcessMetadata = (layerData, address, collection) => {
  const { abstractedIndexes, layerConfigIndex } = layerData;
  // Metadata options
  const savedFile = fs.readFileSync(
    `${buildDir}/images/${address}/${collection}/${abstractedIndexes[0]}${
      configuration.outputJPEG ? ".jpg" : ".png"
    }`
  );
  const _imageHash = hash(savedFile);

  // if there's a prefix for the current configIndex, then
  // start count back at 1 for the name, only.
  const _prefix = configuration.layerConfigurations[layerConfigIndex].namePrefix
    ? configuration.layerConfigurations[layerConfigIndex].namePrefix
    : null;
  // if resetNameIndex is turned on, calculate the offset and send it
  // with the prefix
  let _offset = 0;
  if (configuration.layerConfigurations[layerConfigIndex].resetNameIndex) {
    _offset =
      configuration.layerConfigurations[layerConfigIndex - 1].growEditionSizeTo;
  }

  return {
    _imageHash,
    _prefix,
    _offset,
  };
};

const outputFiles = async (
  abstractedIndexes,
  layerData,
  address,
  collection,
  canvas
) => {
  const { newDna, layerConfigIndex } = layerData;
  // Save the canvas buffer to file
  await saveImage(abstractedIndexes[0], address, collection, canvas);

  const { _imageHash, _prefix, _offset } = postProcessMetadata(
    layerData,
    address,
    collection
  );

  addMetadata(newDna, abstractedIndexes[0], {
    _prefix,
    _offset,
    _imageHash,
  });

  saveMetaDataSingleFile(abstractedIndexes[0], address, collection);
  console.log(
    chalk.cyan(
      `Created edition: ${abstractedIndexes[0]} ${
        debugLogs ? `, with DNA: ${hash(newDna)}` : ""
      }`
    )
  );
};

type payloadProps = {
  address: string;
  collection: string;
  layersOrder: { name: string }[];
};

async function clearCollectionImages(address, collection) {
  // Get a new write batch
  var batch = admin.firestore().batch();


  await admin
    .firestore()
    .collection(`/art-engine/users/${address}/${collection}/generated`)
    .listDocuments()
    .then((val) => {
      val.map((val) => {
        batch.delete(val);
      });
      console.log(
        `Output Images Cleared: /art-engine/${address}/${collection}/output/images`
      );

      batch.commit();
    });
}

export const startCreating = async ({
  address,
  collection,
  layersOrder,
}: payloadProps) => {
  let dnaList: any = new Set();

  const canvas = createCanvas(
    configuration.format.width,
    configuration.format.height
  );

  const ctxMain = canvas.getContext("2d");
  ctxMain.imageSmoothingEnabled = configuration.format.smoothing;

  await clearCollectionImages(address, collection);

  // if (storedDNA) {
  //   console.log(`using stored dna of ${storedDNA.size}`);
  //   dnaList = storedDNA;
  // }
  let layerConfigIndex = 0;
  let editionCount = 1; //used for the growEditionSize while loop, not edition number
  let failedCount = 0;
  let abstractedIndexes = [];
  for (
    let i = configuration.startIndex;
    i <=
    configuration.startIndex +
      configuration.layerConfigurations[
        configuration.layerConfigurations.length - 1
      ].growEditionSizeTo;
    i++
  ) {
    abstractedIndexes.push(i);
  }
  if (configuration.shuffleLayerConfigurations) {
    abstractedIndexes = shuffle(abstractedIndexes);
  }
  debugLogs
    ? console.log("Editions left to create: ", abstractedIndexes)
    : null;
  while (layerConfigIndex < configuration.layerConfigurations.length) {
    const layers: any = await layersSetup(address, collection, layersOrder);

    while (
      editionCount <=
      configuration.layerConfigurations[layerConfigIndex].growEditionSizeTo
    ) {
      let newDna = await createDna(layers);
      debugLogs && console.log({ newDna });

      // console.log({dnaList});

      const isDnaUnique = !dnaList.has(newDna);

      if (isDnaUnique) {
        let results = constructLayerToDna(newDna, layers);
        debugLogs ? console.log("DNA:", newDna.split(DNA_DELIMITER)) : null;
        let loadedElements = [];
        // reduce the stacked and nested layer into a single array
        const allImages = results.reduce((images, layer) => {
          return [...images, ...layer.selectedElements];
        }, []);
        sortZIndex(allImages).forEach((layer) => {
          loadedElements.push(loadLayerImg(layer));
        });

        await Promise.all(loadedElements).then(async (renderObjectArray) => {
          const layerData = {
            newDna,
            layerConfigIndex,
            abstractedIndexes,
            _background: configuration.background,
          };
          paintLayers(ctxMain, renderObjectArray, layerData);
          await outputFiles(
            abstractedIndexes,
            layerData,
            address,
            collection,
            canvas
          );
        });

        dnaList.add(filterDNAOptions(newDna));
        editionCount++;
        abstractedIndexes.shift();
      } else {
        // console.log(chalk.bgRed("DNA exists!"));
        failedCount++;
        // console.log(failedCount);

        if (failedCount >= configuration.uniqueDnaTorrance) {
          console.log(
            `You need more layers or elements to grow your edition to ${configuration.layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
          );
          // eslint-disable-next-line no-process-exit
          process.exit();
        }
      }
    }
    layerConfigIndex++;
  }
  writeMetaData(JSON.stringify(metadataList, null, 2));
  writeDnaLog(JSON.stringify([...dnaList], null, 2));
};

module.exports = {
  addAttributes,
  addMetadata,
  buildSetup,
  constructLayerToDna,
  createDna,
  DNA_DELIMITER,
  hash,
  layersSetup,
  loadLayerImg,
  paintLayers,
  parseQueryString,
  postProcessMetadata,
  startCreating,
};
