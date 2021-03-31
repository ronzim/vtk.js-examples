/**
 * MPRView class
 *
 * viewportData is the internal state (this)
 *
 * methods:
 *  - initView
 *  - updateVolumesForRendering
 *  - updateSlicePlane
 *  - onResize
 *  - setLevelTool
 *  - setCrosshairTool
 *  - setInteractor
 *  - onCrosshairPointSelected ? must update other views -> need a just a setter for worldPos
 *  - updateLevels ? idem, just a setter for wwwl
 *  - updateBlendMode
 *
 *  - setter for height and width
 */

export class MPRView {
  constructor(key) {
    this.VERBOSE = true;
    this.key = key;
    this.volumes = [];
    this.width = 300; // TODO set container.offsetWidth
    this.height = 300; // TODO set container.offsetHight
    this.renderer = null;
    this.parallel = false; // TODO setter
    this.key = null; // "top", "front", "side"
    this.onCreated = null; // TODO
    this.onDestroyed = null; // TODO check on original code
  }
}
