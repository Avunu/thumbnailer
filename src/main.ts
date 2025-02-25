import type { WorkerRequest, WorkerResponse } from './types'
import Pica from 'pica'

// Use existing worker if available
if (!window.gsWorker) {
  throw new Error('GhoulScript worker not initialized')
}

const worker = window.gsWorker
const pendingRequests = new Map<string, (response: WorkerResponse) => void>()

// Handle worker responses
worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
  const { id } = event.data
  const resolver = pendingRequests.get(id)
  if (resolver) {
    pendingRequests.delete(id)
    resolver(event.data)
  }
}

async function sendWorkerRequest(request: WorkerRequest): Promise<WorkerResponse> {
  return new Promise((resolve) => {
    pendingRequests.set(request.id, resolve)
    worker.postMessage(request)
  })
}

function generateRequestId(): string {
  return Math.random().toString(36).slice(2)
}

// Initialize GhoulScript when the page loads
sendWorkerRequest({
  type: 'initialize',
  id: generateRequestId()
}).catch(error => {
  console.error('Failed to initialize Ghostscript:', error)
  addLog(`Initialization error: ${error}`)
})

const input = document.querySelector<HTMLInputElement>('#input')
const preview = document.querySelector<HTMLImageElement>('#preview')
const timer = document.querySelector<HTMLDivElement>('#timer')
const log = document.querySelector<HTMLDivElement>('#log')
const pica = new Pica()

function updateTimer(ms: number) {
  if (timer) timer.textContent = `Total time: ${ms}ms`
}

function addLog(message: string) {
  if (log) log.innerHTML += `${message}<br>`
}

// Helper function to check if file is PostScript-type
function isPostScriptType(type: string): boolean {
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
  return psTypes.includes(type)
}

// Helper function to convert image to canvas
async function createImageCanvas(imageBlob: Blob): Promise<HTMLCanvasElement> {
  const img = new Image()
  const canvas = document.createElement('canvas')
  
  return new Promise((resolve) => {
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(img.src)
      resolve(canvas)
    }
    img.src = URL.createObjectURL(imageBlob)
  })
}


input?.addEventListener('change', async () => {
  const file = input?.files?.[0]

  if (file && preview) {
    try {
      if (log) log.innerHTML = '' // Clear previous logs
      const startTime = performance.now()
      let sourceCanvas: HTMLCanvasElement

      if (isPostScriptType(file.type)) {
        addLog('Processing PostScript file...')
        const t0 = performance.now()
        
        try {
          const arrayBuffer = await file.arrayBuffer()
          const buffer = new Uint8Array(arrayBuffer)
          const response = await sendWorkerRequest({
            type: 'process',
            id: generateRequestId(),
            payload: buffer
          })
          
          if (response.type === 'error') {
            throw new Error(response.error)
          }
          
          sourceCanvas = await createImageCanvas(
            new Blob([response.payload!], { type: 'image/jpeg' })
          )
        } catch (error) {
          addLog(`GhoulScript error: ${error}`)
          throw error
        }
        
        const t1 = performance.now()
        addLog(`PostScript conversion: ${Math.round(t1 - t0)}ms`)
      } else {
        addLog('Processing image file...')
        const t0 = performance.now()
        
        sourceCanvas = await createImageCanvas(file)
        
        const t1 = performance.now()
        addLog(`Image loading: ${Math.round(t1 - t0)}ms`)
      }

      addLog('Resizing image...')
      const t2 = performance.now()

      const destCanvas = document.createElement('canvas')
      destCanvas.width = 500
      destCanvas.height = 500

      const resizedCanvas = await pica.resize(sourceCanvas, destCanvas)
      const blob = await pica.toBlob(resizedCanvas, 'image/jpeg', 0.90)
      preview.src = URL.createObjectURL(blob)

      const t3 = performance.now()
      addLog(`Pica resize: ${Math.round(t3 - t2)}ms`)

      const endTime = performance.now()
      updateTimer(Math.round(endTime - startTime))

    } catch (error) {
      console.error(error)
      addLog(`Error: ${error}`)
    }
  }
})