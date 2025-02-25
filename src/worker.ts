import { initializeGhostscript, renderPageAsImage } from './ghostscript'
import type { WorkerRequest, WorkerResponse } from './types'

let isInitialized = false

async function initialize(): Promise<void> {
  if (!isInitialized) {
    await initializeGhostscript()
    isInitialized = true
  }
}

async function processPostScript(buffer: Uint8Array): Promise<Uint8Array> {
  if (!isInitialized) {
    throw new Error('GhostScript not initialized')
  }
  return await renderPageAsImage(buffer)
}

// Handle incoming messages
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, id, payload } = event.data
  const response: WorkerResponse = { type: 'error', id, error: 'Unknown error' }

  try {
    switch (type) {
      case 'initialize':
        await initialize()
        response.type = 'initialized'
        break

      case 'process':
        if (!payload) throw new Error('No data provided')
        response.type = 'processed'
        response.payload = await processPostScript(payload)
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
