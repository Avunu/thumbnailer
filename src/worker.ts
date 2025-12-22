import { initializeGhostscript, renderPageAsImage } from './ghostscript'
import type { ResolutionUnit, ThumbnailResult, WorkerRequest, WorkerResponse, UTIFModule } from './types'
// @ts-ignore - Importing untyped JS library, will type-assert below
import UTIFImport from '../vendor/utif/UTIF.js';
import ExifReader from 'exifreader';

const UTIF = UTIFImport as unknown as UTIFModule;

// Initialize immediately
initializeGhostscript().then(() => {
  // Send ready message only after initialization is complete
  self.postMessage({ type: 'ready', id: 'worker' });
}).catch(error => {
  console.error('Failed to initialize ghostscript:', error);
  self.postMessage({
    type: 'error',
    id: 'worker',
    error: 'Failed to initialize worker: ' + error.message
  });
});

// Handle incoming messages
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, id, payload } = event.data
  const response: WorkerResponse = { type: 'error', id, error: 'Unknown error' }

  try {
    switch (type) {
      case 'createThumbnail':
        if (!payload) throw new Error('No payload provided')
        response.type = 'result'
        response.payload = await createThumbnail(
          payload.file,
          payload.mimeType,
          payload.maxWidth
        )
        break

      default:
        throw new Error(`Unknown request type: ${type}`)
    }
  } catch (error) {
    response.type = 'error'
    response.error = error instanceof Error ? error.message : String(error)
    console.error('Worker error:', response.error);
  }

  self.postMessage(response)
}

function isPostScriptType(mimeType: string): boolean {
  const psTypes = [
    'application/postscript',
    'application/ps',
    'application/x-eps',
    'application/x-postscript',
    'application/x-postscript-not-eps',
    'application/x-ps',
    'application/pdf',
    'image/eps',
    'image/x-eps',
    'text/postscript'
  ]
  return psTypes.includes(mimeType)
}

function isTiffType(mimeType: string): boolean {
  const tiffTypes = [
    'application/tif',
    'application/tiff',
    'application/x-tif',
    'application/x-tiff',
    'image/tif',
    'image/tiff',
    'image/tiff-fx',
    'image/x-tif',
    'image/x-tiff',
  ]
  return tiffTypes.includes(mimeType)
}

async function extractMetadata(data: Uint8Array, mimeType: string): Promise<{ xResolution?: number, yResolution?: number, resolutionUnit?: ResolutionUnit }> {
  const metadata: { xResolution?: number, yResolution?: number, resolutionUnit?: ResolutionUnit } = {};
  
  try {
    // Load tags with ExifReader
    const tags = await ExifReader.load(data.buffer, {async: true});
    
    if (tags) {
      // Extract resolution info from tags
      if (tags['XResolution']?.value) {
        const value = tags['XResolution'].value;
        if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
          metadata.xResolution = value[0] / value[1];
        } else if (typeof value === 'number') {
          metadata.xResolution = value;
        }
      }
      
      if (tags['YResolution']?.value) {
        const value = tags['YResolution'].value;
        if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
          metadata.yResolution = value[0] / value[1];
        } else if (typeof value === 'number') {
          metadata.yResolution = value;
        }
      }
      
      if (tags['ResolutionUnit']?.value) {
        const unit = tags['ResolutionUnit'].value;
        metadata.resolutionUnit = unit === 2 ? 'inch' : unit === 3 ? 'cm' : 'none';
      }
    }
  } catch (error) {
    console.warn(`Failed to extract metadata for ${mimeType}:`, error);
  }
  
  return metadata;
}

async function convertTiffToJpeg(data: Uint8Array): Promise<{ jpegData: Uint8Array, metadata: { xResolution?: number, yResolution?: number, resolutionUnit?: ResolutionUnit } }> {
  try {
    // Decode TIFF file
    const ifds = UTIF.decode(data.buffer as ArrayBuffer);
    if (!ifds || ifds.length === 0) {
      throw new Error('Failed to decode TIFF: No image data found');
    }

    // Extract resolution metadata
    const metadata = await extractMetadata(data, 'image/tiff');
    
    // Try to decode the image and catch any errors
    try {
      UTIF.decodeImage(data.buffer as ArrayBuffer, ifds[0]);
    } catch (err) {
      console.error('Error decoding TIFF image:', err);
      throw new Error('Failed to decode TIFF image data');
    }

    // Check if image data was actually decoded
    if (!ifds[0].data) {
      throw new Error('No pixel data found in TIFF');
    }

    // Convert to RGBA
    const rgba = UTIF.toRGBA8(ifds[0]);
    if (!rgba || rgba.length === 0) {
      throw new Error('Failed to convert TIFF to RGBA format');
    }

    // Create canvas and draw RGBA data
    const width = ifds[0].width as number;
    const height = ifds[0].height as number;

    if (!width || !height || width <= 0 || height <= 0) {
      throw new Error(`Invalid TIFF dimensions: ${width}x${height}`);
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not create canvas context for TIFF conversion');
    }

    // Put image data
    const imageData = new ImageData(new Uint8ClampedArray(rgba.buffer as ArrayBuffer), width, height);
    ctx.putImageData(imageData, 0, 0);

    // Convert to JPEG blob
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    const jpegData = new Uint8Array(await blob.arrayBuffer());

    return { jpegData, metadata };
  } catch (error) {
    console.error('TIFF conversion error:', error);
    throw new Error(`Failed to convert TIFF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function createImageFromData(data: Uint8Array, mimeType: string): Promise<ImageBitmap> {
  const blob = new Blob([data as BlobPart], { type: mimeType })
  return await createImageBitmap(blob)
}

function calculateAspectRatio(srcWidth: number, srcHeight: number, targetWidth: number): { width: number, height: number } {
  const ratio = targetWidth / srcWidth
  return {
    width: targetWidth,
    height: Math.round(srcHeight * ratio)
  }
}

async function createThumbnail(
  data: Uint8Array,
  mimeType: string,
  maxWidth: number,
): Promise<ThumbnailResult> {
  let sourceBitmap: ImageBitmap;
  let metadata = await extractMetadata(data, mimeType);

  // Convert TIFF/PostScript to JPEG if needed
  if (isPostScriptType(mimeType)) {
    const jpegData = await renderPageAsImage(data);
    sourceBitmap = await createImageFromData(jpegData, 'image/jpeg');
    metadata = await extractMetadata(jpegData, 'image/jpeg');
    mimeType = 'image/jpeg';
  } else if (isTiffType(mimeType)) {
    const { jpegData, metadata: tiffMetadata } = await convertTiffToJpeg(data);
    sourceBitmap = await createImageFromData(jpegData, 'image/jpeg');
    metadata = tiffMetadata;
    mimeType = 'image/jpeg';
  } else {
    sourceBitmap = await createImageFromData(data, mimeType);
    
    metadata = await extractMetadata(data, mimeType);
  }

  // Calculate dimensions based on target width only
  const { width, height } = calculateAspectRatio(
    sourceBitmap.width,
    sourceBitmap.height,
    maxWidth
  );

  // Create destination canvas and resize
  const destCanvas = new OffscreenCanvas(width, height);
  const ctx = destCanvas.getContext('2d')!;
  ctx.drawImage(sourceBitmap, 0, 0, width, height);

  // Convert to JPEG blob
  const blob = await destCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  const buffer = await blob.arrayBuffer();

  return {
    image: new Uint8Array(buffer),
    mimeType: 'image/jpeg',
    sourceWidth: sourceBitmap.width,
    sourceHeight: sourceBitmap.height,
    width,
    height,
    ...metadata // Include resolution metadata in the result
  };
}
