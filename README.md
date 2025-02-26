# Thumbnailer

A WordPress plugin that makes a JavaScript thumbnail generation library available on selected pages.

## Purpose

This plugin loads the Thumbnailer JavaScript library on specific WordPress posts/pages that you configure. Once loaded, the library can be called by other scripts via its API to generate thumbnails from various file formats including PDF, PostScript, and common image formats.

## Features

- Selectively load the Thumbnailer library on specific WordPress posts/pages
- Easy configuration through WordPress admin interface
- Makes the AGPL worker available for client-side thumbnail generation
- Non-blocking thumbnail processing via Web Workers

## WordPress Plugin Usage

1. Install and activate the plugin
2. Go to Settings > Thumbnailer
3. Enter the comma-separated IDs of posts/pages where you want the Thumbnailer to be available
4. Save your settings

## JavaScript API

Once the Thumbnailer script is loaded on a page, you can use it in your JavaScript as follows:

```javascript
// Check if thumbnailer is available
if (window.workerLoader) {
  // Initialize the worker
  await window.workerLoader.initialize();

  // Create a thumbnail
  const fileData = new Uint8Array(await fetch('example.pdf').then(r => r.arrayBuffer()));
  const thumbnail = await window.workerLoader.createThumbnail({
    file: fileData,
    filename: 'example.pdf',
    mimeType: 'application/pdf',
    maxWidth: 300
  });

  // Use the thumbnail
  const blob = new Blob([thumbnail.image], { type: thumbnail.mimeType });
  const imageUrl = URL.createObjectURL(blob);
  document.getElementById('preview').src = imageUrl;
}
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
git clone https://github.com/Avunu/thumbnailer.git
cd thumbnailer
npm install
```

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build library for production
- `npm run build:demo` - Build demo app
- `npm run build:wp` - Build WordPress plugin
- `npm run build:all` - Build both demo app and WordPress plugin
- `npm run build:zip` - Build and zip WordPress plugin
- `npm run preview` - Preview production build locally

## License

The Thumbnailer WordPress plugin and underlying JavaScript worker is licensed under AGPL.
