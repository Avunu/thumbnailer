// Global ambient type declarations
// This file has no imports/exports, so TypeScript automatically includes it globally

// WASM module declarations
declare module '*.wasm' {
  const src: string;
  export default src;
}

// UTIF.js library declarations
declare module '../vendor/utif/UTIF.js' {
  interface IFD {
    width?: number;
    height?: number;
    data?: ArrayBuffer;
    [key: string]: any;
  }

  namespace UTIF {
    function decode(buffer: ArrayBuffer): IFD[];
    function decodeImage(buffer: ArrayBuffer, ifd: IFD): void;
    function toRGBA8(ifd: IFD): Uint8Array;
  }

  export = UTIF;
}

// Extend the global Window interface
declare global {
  interface Window {
    thumbnailGen: import('./types').ThumbnailerInterface;
  }
}
