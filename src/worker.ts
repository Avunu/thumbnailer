import { initializeGhostscript, renderPageAsImage } from './ghostscript'
import type { WorkerRequest, WorkerResponse } from './types'

let isInitialized = false

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

async function createImageFromData(data: Uint8Array, mimeType: string): Promise<ImageBitmap> {
  const blob = new Blob([data], { type: mimeType })
  return await createImageBitmap(blob)
}

function calculateAspectRatio(srcWidth: number, srcHeight: number, targetWidth: number): {width: number, height: number} {
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
): Promise<{ image: Uint8Array; width: number; height: number; mimeType: string }> {
  let sourceBitmap: ImageBitmap

  // Convert PostScript to JPEG if needed
  if (isPostScriptType(mimeType)) {
    const jpegData = await renderPageAsImage(data)
    sourceBitmap = await createImageFromData(jpegData, 'image/jpeg')
    mimeType = 'image/jpeg'
  } else {
    sourceBitmap = await createImageFromData(data, mimeType)
  }

  // Calculate dimensions based on target width only
  const { width, height } = calculateAspectRatio(
    sourceBitmap.width,
    sourceBitmap.height,
    maxWidth
  )

  // Create destination canvas and resize
  const destCanvas = new OffscreenCanvas(width, height)
  const ctx = destCanvas.getContext('2d')!
  ctx.drawImage(sourceBitmap, 0, 0, width, height)
  
  // Convert to JPEG blob
  const blob = await destCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
  const buffer = await blob.arrayBuffer()

  return {
    image: new Uint8Array(buffer),
    width,
    height,
    mimeType: 'image/jpeg'
  }
}

// Handle incoming messages
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, id, payload } = event.data
  const response: WorkerResponse = { type: 'error', id, error: 'Unknown error' }

  try {
    switch (type) {
      case 'initialize':
        await initializeGhostscript()
        isInitialized = true
        response.type = 'initialized'
        break

      case 'createThumbnail':
        if (!isInitialized) throw new Error('Worker not initialized')
        if (!payload) throw new Error('No payload provided')
        
        response.type = 'thumbnail'
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
  }

  self.postMessage(response)
}

// Notify that we're ready
self.postMessage({ type: 'initialized', id: 'worker', payload: null })
