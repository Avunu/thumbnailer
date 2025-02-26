import { workerLoader } from '../index';

const input = document.querySelector<HTMLInputElement>('#input');
const preview = document.querySelector<HTMLImageElement>('#preview');
const timer = document.querySelector<HTMLDivElement>('#timer');
const log = document.querySelector<HTMLDivElement>('#log');

function updateTimer(ms: number) {
  if (timer) timer.textContent = `Total time: ${ms}ms`;
}

function addLog(message: string) {
  if (log) log.innerHTML += `${message}<br>`;
  console.log(message);
}

// Initialize the thumbnailer
workerLoader.initialize()
  .then(() => addLog('Thumbnailer initialized successfully'))
  .catch(error => {
    console.error('Failed to initialize Thumbnailer:', error);
    addLog(`Initialization error: ${error}`);
  });

// Handle file input changes
input?.addEventListener('change', async () => {
  const file = input?.files?.[0];
  if (!file || !preview) return;

  try {
    if (log) log.innerHTML = '';
    addLog(`Processing file: ${file.name} (${file.type})`);
    const startTime = performance.now();

    const arrayBuffer = await file.arrayBuffer();
    const result = await workerLoader.createThumbnail({
      file: new Uint8Array(arrayBuffer),
      filename: file.name,
      mimeType: file.type,
      maxWidth: 500
    });
    
    const blob = new Blob([result.image], { type: result.mimeType });
    preview.src = URL.createObjectURL(blob);
    
    addLog(`Generated thumbnail: ${result.width}x${result.height} (${result.mimeType})`);

    const endTime = performance.now();
    updateTimer(Math.round(endTime - startTime));
  } catch (error) {
    console.error(error);
    addLog(`Error: ${error}`);
  }
});
