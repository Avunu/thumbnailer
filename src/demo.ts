// Use the global thumbnailGen object instead of importing directly

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

// Disable file input until thumbnailer is ready
if (input) input.disabled = true;

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  addLog('Waiting for thumbnailer to initialize...');
  
  const checkInterval = setInterval(() => {
    if (typeof window.thumbnailGen !== 'undefined') {
      clearInterval(checkInterval);
      
      addLog('Thumbnailer object found in global scope');
      
      window.thumbnailGen.ready
        .then(() => {
          addLog('Thumbnailer is ready to use');
          if (input) input.disabled = false;
        })
        .catch((error: any) => {
          console.error('Thumbnailer initialization failed:', error);
          addLog(`Initialization error: ${error instanceof Error ? error.message : String(error)}`);
        });
    }
  }, 100);
});

// Handle file input changes
input?.addEventListener('change', async () => {
  const file = input?.files?.[0];
  if (!file || !preview || !window.thumbnailGen) return;

  try {
    if (log) log.innerHTML = '';
    addLog(`Processing file: ${file.name} (${file.type})`);
    const startTime = performance.now();

    const arrayBuffer = await file.arrayBuffer();
    const result = await window.thumbnailGen.createThumbnail({
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
    addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
});
