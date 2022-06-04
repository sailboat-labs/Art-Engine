import { createCanvas } from "canvas";
import { IConfig } from "./interfaces";
import {
  constructLayerToDna,
  createDna,
  filterDNAOptions,
  layersSetup,
  loadLayerImg,
  outputFiles,
  paintLayers,
  shuffle,
  sortZIndex,
  writeDnaLog,
  writeMetaData,
} from "./methods";

export const generateTokens = async ({ address, collection }) => {
  const configuration: IConfig = {
    address,
    collection,
    description: "This is the description",
    baseUri: "ipfs://NewUriToReplace",
    startIndex: 0,
    format: {
      width: 1024,
      height: 1024,
      smoothing: true,
      weight: 1,
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

  let dnaList: any = new Set();
  let layerConfigIndex = 0;
  let editionCount = 1; //used for the growEditionSize while loop, not edition number
  let failedCount = 0;
  let abstractedIndexes = [];
  let debugLogs = true;
  const DNA_DELIMITER = "*";
  let metadataList = [];
  let attributesList = [];

  const canvas = createCanvas(
    configuration.format.width,
    configuration.format.height
  );
  const ctxMain = canvas.getContext("2d");
  ctxMain.imageSmoothingEnabled = configuration.format.smoothing;

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
    const layers: any = await layersSetup({
      address,
      collection,
      configuration,
    });

    while (
      editionCount <=
      configuration.layerConfigurations[layerConfigIndex].growEditionSizeTo
    ) {
      let newDna = createDna(layers);
      console.log({ newDna });

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

        await Promise.all(loadedElements).then((renderObjectArray) => {
          const layerData = {
            newDna,
            layerConfigIndex,
            abstractedIndexes,
            _background: configuration.background,
          };
          paintLayers(ctxMain, renderObjectArray, layerData);
          outputFiles(
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

  writeMetaData(JSON.stringify(metadataList, null, 2), address, collection);
  writeDnaLog(JSON.stringify([...dnaList], null, 2), address, collection);
};
