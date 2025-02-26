# Thumbnailer

A JavaScript library for generating thumbnails from various file formats including PDF, PostScript, and common image formats.

## Features

- Generate thumbnails from PDF and PostScript files using Ghostscript
- Support for common image formats (JPEG, PNG, GIF, WebP, etc.)
- Web Worker-based processing for non-blocking operations
- Consistent aspect ratio preservation

## Installation

```bash
npm install thumbnailer
```

## Usage

### Basic Usage

```javascript
import { workerLoader } from 'thumbnailer';

// Initialize the worker
await workerLoader.initialize();

// Create a thumbnail
const fileData = new Uint8Array(await fetch('example.pdf').then(r => r.arrayBuffer()));
const thumbnail = await workerLoader.createThumbnail({
  file: fileData,
  filename: 'example.pdf',
  mimeType: 'application/pdf',
  maxWidth: 300
});

// Use the thumbnail
const blob = new Blob([thumbnail.image], { type: thumbnail.mimeType });
const imageUrl = URL.createObjectURL(blob);
document.getElementById('preview').src = imageUrl;
```

### API Reference

#### `workerLoader.initialize()`

Initializes the worker and prepares it for processing files.

Returns: `Promise<void>`

#### `workerLoader.createThumbnail(options)`

Creates a thumbnail from the provided file.

Parameters:
- `options` (Object):
  - `file` (Uint8Array): The file data as a binary array
  - `filename` (string): Filename with extension
  - `mimeType` (string): MIME type of the file
  - `maxWidth` (number): Maximum width for the generated thumbnail

Returns: `Promise<ThumbnailResult>` where `ThumbnailResult` is:
```typescript
{
  image: Uint8Array; // Thumbnail image data
  mimeType: string;  // Output MIME type (typically 'image/jpeg')
  width: number;     // Thumbnail width
  height: number;    // Thumbnail height
}
```

## Development

### Setup

```bash
git clone https://github.com/yourusername/thumbnailer.git
cd thumbnailer
npm install
```

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build library for production
- `npm run build:demo` - Build demo app
- `npm run preview` - Preview production build locally

## License

MIT
