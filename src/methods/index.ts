import { configuration } from "./../../utils/regenerate";
import admin from "../../config/admin";
import { IConfig } from "../interfaces/index";
const fs = require("fs");
const path = require("path");
const keccak256 = require("keccak256");
const chalk = require("chalk");
const isLocal = true;
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const buildDir = path.join(basePath, "/build");
const { createCanvas, loadImage } = require(path.join(
  basePath,
  "../../node_modules/canvas"
));

type props = {
  address: string;
  collection: string;
  configuration: IConfig;
};

let debugLogs = true;
const zflag = /(z-?\d*,)/;
const DNA_DELIMITER = "*";
let metadataList = [];
let attributesList = [];

export const layersSetup = async ({
  address,
  collection,
  configuration,
}: props) => {
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

  const layers = (
    await admin
      .firestore()
      .collection("art-engine")
      .doc(address)
      .collection(collection)
      .get()
  ).docs.map((item) => item.data());

  return layers;
};

export const createDna = (_layers) => {
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
      layer.zindex ? layer.zIndex : "",
      configuration
    );
    const sortedLayers = sortLayers(layerSequence);
    dnaSequence = [...dnaSequence, [sortedLayers]];
  });
  const zSortDNA = sortByZ(dnaSequence.flat(2));
  let dnaStrand = zSortDNA.join(DNA_DELIMITER);
  return dnaStrand;
};

export function pickRandomElement(
  layer,
  dnaSequence,
  parentId,
  incompatibleDNA,
  forcedDNA,
  bypassDNA,
  zIndex,
  configuration
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
        zIndex,
        configuration
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
            zIndex,
            configuration
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

export const constructLayerToDna = (_dna: any = [], _layers = []) => {
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

const parseZIndex = (str) => {
  const z = zflag.exec(str);
  return z ? parseInt(z[0].match(/-?\d+/)[0]) : null;
};

/** File String sort by zFlag */
function sortByZ(dnastrings) {
  return dnastrings.sort((a, b) => {
    const indexA = parseZIndex(a);
    const indexB = parseZIndex(b);
    return indexA - indexB;
  });
}

const cleanDna = (_str) => {
  var dna = _str.split(":").shift();
  return dna;
};
/**
 * Sorting by index based on the layer.z property
 * @param {Array } layers selected Image layer objects array
 */
 export function sortZIndex(layers) {
  return layers.sort((a, b) => {
    const indexA = parseZIndex(a.zindex);
    const indexB = parseZIndex(b.zindex);
    return indexA - indexB;
  });
}


export const loadLayerImg = async (_layer) => {
  return new Promise(async (resolve) => {
    // selected elements is an array.
    const image = await loadImage(`${_layer.path}`).catch((err) =>
      console.log(chalk.redBright(`failed to load ${_layer.path}`, err))
    );
    resolve({ layer: _layer, loadedImage: image });
  });
};

export const paintLayers = (canvasContext, renderObjectArray, layerData) => {
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

const drawElement = (_renderObject, mainCanvas) => {
  const layerCanvas = createCanvas(
    configuration.format.width,
    configuration.format.height
  );
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
  return layerCanvas;
};

const saveImage = (_editionCount, address, collection,canvas) => {
  fs.writeFileSync(
    `${buildDir}/images/${address}/${collection}/${_editionCount}${
      configuration.outputJPEG ? ".jpg" : ".png"
    }`,
    canvas.toBuffer(`${configuration.outputJPEG ? "image/jpeg" : "image/png"}`)
  );
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

const extraAttributes = () => [
  // Optionally, if you need to overwrite one of your layers attributes.
  // You can include the same name as the layer, here, and it will overwrite
  //
  // {
  // trait_type: "Bottom lid",
  //   value: ` Bottom lid # ${Math.random() * 100}`,
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



export const outputFiles = (abstractedIndexes, layerData, address, collection,canvas) => {
  const { newDna, layerConfigIndex } = layerData;
  // Save the canvas buffer to file
  saveImage(abstractedIndexes[0], address, collection,canvas);

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
      `Created edition: ${abstractedIndexes[0]}, with DNA: ${hash(newDna)}`
    )
  );
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

export const filterDNAOptions = (_dna) => {
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

export const writeMetaData = (_data,address,collection) => {
  fs.writeFileSync(`${buildDir}/json/${address}/${collection}/_metadata.json`, _data);
};

export const writeDnaLog = (_data,address,collection) => {
  fs.writeFileSync(`${buildDir}/${address}/${collection}/_dna.json`, _data);
};

export function shuffle(array) {
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
  console.log({array});
  
  return array;
}

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