import { renderBanner } from './banner-renderer';

declare global {
  interface Window {
    cmpRenderBanner: typeof renderBanner;
  }
}

window.cmpRenderBanner = renderBanner;
