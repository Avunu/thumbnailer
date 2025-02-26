import type { WorkerRequest, WorkerResponse } from './types'

if (!window.gsWorker) {
  throw new Error('GhoulScript worker not initialized')
}

const worker = window.gsWorker
const pendingRequests = new Map<string, (response: WorkerResponse) => void>()
const input = document.querySelector<HTMLInputElement>('#input')
const preview = document.querySelector<HTMLImageElement>('#preview')
const timer = document.querySelector<HTMLDivElement>('#timer')
const log = document.querySelector<HTMLDivElement>('#log')

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

sendWorkerRequest({
  type: 'initialize',
  id: generateRequestId()
}).catch(error => {
  console.error('Failed to initialize Ghostscript:', error)
  addLog(`Initialization error: ${error}`)
})

function updateTimer(ms: number) {
  if (timer) timer.textContent = `Total time: ${ms}ms`
}

function addLog(message: string) {
  if (log) log.innerHTML += `${message}<br>`
}

input?.addEventListener('change', async () => {
  const file = input?.files?.[0]
  if (!file || !preview) return

  try {
    if (log) log.innerHTML = ''
    const startTime = performance.now()

    const arrayBuffer = await file.arrayBuffer()
    const response = await sendWorkerRequest({
      type: 'createThumbnail',
      id: generateRequestId(),
      payload: {
        file: new Uint8Array(arrayBuffer),
        filename: file.name,
        mimeType: file.type,
        maxWidth: 500
      }
    })

    if (response.type === 'error') {
      throw new Error(response.error)
    }

    const blob = new Blob([response.payload!.image], { type: response.payload!.mimeType })
    preview.src = URL.createObjectURL(blob)

    const endTime = performance.now()
    updateTimer(Math.round(endTime - startTime))

  } catch (error) {
    console.error(error)
    addLog(`Error: ${error}`)
  }
})