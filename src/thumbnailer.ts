import { workerLoader } from './index';

class Thumbnailer {
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  async init() {
    try {
      // Initialize the thumbnailer worker
      await workerLoader.initialize();
      this.initialized = true;
      if (this.initialized && window.thumbnailGen) {
        console.log('Thumbnailer initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize thumbnailer:', error);
    }
  }
}

// Initialize the thumbnailer when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Thumbnailer();
});

export default Thumbnailer;
