export interface IConfig {
  description: string;
  baseUri: string;
  startIndex: number;
  format: { width: number; height: number; smoothing: true; weight: number };
  background: { generate: boolean; brightness: string };
  layerConfigurations: ILayerConfigurations[];
  shuffleLayerConfigurations: boolean;
  emptyLayerName: string;
  forcedCombinations: {};
  hashImages: boolean;
  preview: IPreviewCollage;
  preview_gif: IPreviewGIF;
  extraAttributes: any[];
  rarityDelimiter: string;
  useRootTraitType: boolean;
  outputJPEG: boolean;
  incompatible: {};
  traitValueOverrides: {};
  uniqueDnaTorrance:number;
}

export interface ILayerConfigurations {
  resetNameIndex?: any;
  growEditionSizeTo: number;
  namePrefix: string;
  layersOrder: { name: string }[];
}

export interface IPreviewCollage {
  thumbPerRow: number;
  thumbWidth: number;
  imageRatio: number;
  imageName: string;
}

export interface IPreviewGIF {
  numberOfImages: number;
  order: "ASC" | "DESC" | "MIXED"; // ASC, DESC, MIXED
  repeat: number;
  quality: number;
  delay: number;
  imageName: string;
}
