import initGS from '@privyid/ghostscript';

type GSModule = Awaited<ReturnType<typeof initGS>>;

let gsModule: GSModule | null = null;
let initPromise: Promise<GSModule> | null = null;

export async function initializeGhostscript(): Promise<GSModule> {
	if (gsModule) {
		return gsModule;
	}

	if (!initPromise) {
		initPromise = (async () => {
			try {
				console.log('Initializing GhostScript WASM module...');
				const module = await initGS();
				gsModule = module;
				console.log('GhostScript initialized successfully');
				return module;
			} catch (error) {
				console.error('Failed to initialize GhostScript:', error);
				throw error;
			}
		})();
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
	// Handle both ArrayBuffer and Uint8Array returns from FS.readFile
	const buffer = result.buffer ? (result.buffer as ArrayBuffer) : (result as unknown as ArrayBuffer);
	return new Uint8Array(buffer);
}
