import initGS from '@privyid/ghostscript'

let gsModule: Awaited<ReturnType<typeof initGS>> | null = null

export async function initializeGhostscript() {
  if (!gsModule) {
    gsModule = await initGS({
      print() {},
      printErr() {}
    })
  }
  return gsModule
}

export async function renderPageAsImage(
  input: Uint8Array,
  pageNumber: number = 1,
  resolution: number = 150
): Promise<Uint8Array> {
  const gs = await initializeGhostscript()
  
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
    './input'
  ]

  gs.FS.writeFile('./input', input)
  await gs.callMain(args)
  const result = gs.FS.readFile('./output', { encoding: 'binary' })
  return new Uint8Array(result.buffer || result)
}
