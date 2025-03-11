import initGS from '@privyid/ghostscript';

let gsModule: Awaited<ReturnType<typeof initGS>> | null = null;
let initPromise: Promise<any> | null = null;

export async function initializeGhostscript() {
  if (gsModule) {
    return gsModule;
  }

  if (!initPromise) {
    initPromise = new Promise(async (resolve, reject) => {
      try {
        console.log('Initializing GhostScript WASM module...');
        const module = await initGS();
        gsModule = module;
        console.log('GhostScript initialized successfully');
        resolve(module);
      } catch (error) {
        console.error('Failed to initialize GhostScript:', error);
        reject(error);
      }
    });
  }

  return initPromise;
}

export async function renderPageAsImage(
  input: Uint8Array,
  pageNumber: number = 1,
  resolution: number = 150
): Promise<Uint8Array> {
  const gs = await initializeGhostscript();

  const args = [
    '-dQUIET',
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    '-sDEVICE=jpeg',
    `-sPageList=${pageNumber}`,
    `-r${resolution}`,
    '-dJPEGQ=90',
    '-dQFactor=0.90',
    '-dTextAlphaBits=4',
    '-dGraphicsAlphaBits=4',
    '-dDOINTERPOLATE',
    '-dMaxBitmap=500000000',
    '-sOutputFile=./output',
    './input',
  ];

  gs.FS.writeFile('./input', input);
  await gs.callMain(args);
  const result = gs.FS.readFile('./output', { encoding: 'binary' });
  return new Uint8Array(result.buffer || result);
}
