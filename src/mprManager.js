// Use modified MPRSlice interactor
import vtkInteractorStyleMPRWindowLevel from "./vue-mpr/vtkInteractorStyleMPRWindowLevel";
import vtkInteractorStyleMPRCrosshairs from "./vue-mpr/vtkInteractorStyleMPRCrosshairs";
import vtkCoordinate from "vtk.js/Sources/Rendering/Core/Coordinate";
import vtkMatrixBuilder from "vtk.js/Sources/Common/Core/MatrixBuilder";
// import vtkMath from "vtk.js/Sources/Common/Core/Math";

import {
  getPlaneIntersection,
  getVolumeCenter,
  createVolumeActor
} from "./utils";

import { MPRView } from "./mprView";

/**
 * MPRManager class
 *
 * global_data is more or less the internal state (this),
 * plus some other internal variable as defaultTool ecc
 *
 * methods:
 *  - onCrosshairPointSelected
 *  - updateLevels
 *  - onScrolled
 *  - onRotate
 *  - onThickness
 *  - createVolumeActor
 *
 */

const defaultTool = "level";
const syncWindowLevels = true;
const VERBOSE = false;
export class MPRManager {
  constructor(global_data, image) {
    this.viewsArray = [
      {
        element: document.getElementById("viewer-2"),
        key: "top"
      },
      {
        element: document.getElementById("viewer-3"),
        key: "left"
      },
      {
        element: document.getElementById("viewer-4"),
        key: "front"
      }
    ];

    this.mprViews = {
      top: new MPRView("top"),
      left: new MPRView("left"),
      front: new MPRView("front")
    };

    this.initMPR(global_data, image);
  }

  initMPR(global_data, image) {
    let actor = createVolumeActor(image);
    global_data.volumes.push(actor);
    global_data.sliceIntersection = getVolumeCenter(actor.getMapper());

    Object.entries(global_data.views).forEach(([key, view]) => {
      // initView(global_data, key, view.element);
      this.mprViews[key].initView(global_data, key, view.element);
    });

    defaultTool == "level"
      ? this.setLevelTool(global_data)
      : this.setCrosshairTool(global_data);

    console.log("initialized", global_data);
  }

  setLevelTool(global_data) {
    Object.entries(global_data.views).forEach(([key]) => {
      const istyle = vtkInteractorStyleMPRWindowLevel.newInstance();
      istyle.setOnScroll(this.onScrolled);
      istyle.setOnLevelsChanged(levels => {
        this.updateLevels({ ...levels, srcKey: key }, global_data);
      });
      this.mprViews[key].setInteractor(istyle);
    });
  }

  setCrosshairTool(global_data) {
    let self = this;
    Object.entries(global_data.views).forEach(([key]) => {
      const istyle = vtkInteractorStyleMPRCrosshairs.newInstance();
      istyle.setOnScroll(() => {
        self.onScrolled();
      });
      istyle.setOnClickCallback(({ worldPos }) => {
        self.onCrosshairPointSelected({ worldPos, srcKey: key });
      });
      this.mprViews[key].setInteractor(istyle);
    });
  }

  onCrosshairPointSelected({ srcKey, worldPos }) {
    let components = this.viewsArray.map(v => v.key);
    components.forEach(key => {
      if (key !== srcKey) {
        // We are basically doing the same as getSlice but with the world coordinate
        // that we want to jump to instead of the camera focal point.
        // I would rather do the camera adjustment directly but I keep
        // doing it wrong and so this is good enough for now.
        // ~ swerik
        const renderWindow = this.mprViews[
          key
        ].genericRenderWindow.getRenderWindow();

        const istyle = renderWindow.getInteractor().getInteractorStyle();
        const sliceNormal = istyle.getSliceNormal();
        const transform = vtkMatrixBuilder
          .buildFromDegree()
          .identity()
          .rotateFromDirections(sliceNormal, [1, 0, 0]);

        const mutatedWorldPos = worldPos.slice();
        transform.apply(mutatedWorldPos);
        const slice = mutatedWorldPos[0];

        istyle.setSlice(slice);

        renderWindow.render();
      }

      const renderer = this.mprViews[key].genericRenderWindow.getRenderer();
      const wPos = vtkCoordinate.newInstance();
      wPos.setCoordinateSystemToWorld();
      wPos.setValue(worldPos);

      const displayPosition = wPos.getComputedDisplayValue(renderer);
    });
  }

  // depends on global_data AND this.mprViews
  // TODO refactoring DV: no need to have ww wc in global_data ?
  updateLevels({ windowCenter, windowWidth, srcKey }, global_data) {
    global_data.views[srcKey].window.center = windowCenter;
    global_data.views[srcKey].window.width = windowWidth;

    if (syncWindowLevels) {
      let components = this.viewsArray.map(v => v.key);
      Object.entries(components)
        .filter(key => key !== srcKey)
        .forEach(([i, key]) => {
          global_data.views[key].window.center = windowCenter;
          global_data.views[key].window.width = windowWidth;
          this.mprViews[key].genericRenderWindow
            .getInteractor()
            .getInteractorStyle()
            .setWindowLevel(windowWidth, windowCenter);
          this.mprViews[key].genericRenderWindow.getRenderWindow().render();
        });
    }
  }

  onScrolled() {
    let planes = [];
    let components = this.viewsArray.map(v => v.key);
    components.forEach(key => {
      const camera = this.mprViews[key].genericRenderWindow
        .getRenderer()
        .getActiveCamera();

      planes.push({
        position: camera.getFocalPoint(),
        normal: camera.getDirectionOfProjection()
        // this[viewportIndex].slicePlaneNormal
      });
    });
    const newPoint = getPlaneIntersection(...planes);
    if (!Number.isNaN(newPoint)) {
      //   global_data.sliceIntersection = newPoint; TODO return sliceIntersection
      if (VERBOSE) console.log("updating slice intersection", newPoint);
    }
  }

  // depends on global_data and viewsArray
  // (key, axis: x or y, ABSOLUTE angle in deg)
  onRotate(key, axis, angle, global_data) {
    // Match the source axis to the associated plane
    switch (key) {
      case "top":
        if (axis === "x") global_data.views.front.slicePlaneYRotation = angle;
        else if (axis === "y")
          global_data.views.left.slicePlaneYRotation = angle;
        break;
      case "left":
        if (axis === "x") global_data.views.top.slicePlaneXRotation = angle;
        else if (axis === "y")
          global_data.views.front.slicePlaneXRotation = angle;
        break;
      case "front":
        if (axis === "x") global_data.views.top.slicePlaneYRotation = angle;
        else if (axis === "y")
          global_data.views.left.slicePlaneXRotation = angle;
        break;
    }

    // dv: this was a watcher in mpr component, update all except myself ?

    let components = this.viewsArray.map(v => v.key);
    components.filter(c => c !== key).forEach(k => {
      this.mprViews[k].updateSlicePlane(global_data.views[k]);
    });

    if (VERBOSE) console.log("afterOnRotate", global_data);
  }

  // depends on global_data and this.mprViews
  onThickness(key, axis, thickness, global_data) {
    const shouldBeMIP = thickness > 1;
    let view;
    switch (key) {
      case "top":
        if (axis === "x") view = global_data.views.front;
        else if (axis === "y") view = global_data.views.left;
        break;
      case "left":
        if (axis === "x") view = global_data.views.top;
        else if (axis === "y") view = global_data.views.front;
        break;
      case "front":
        if (axis === "x") view = global_data.views.top;
        else if (axis === "y") view = global_data.views.left;
        break;
    }

    view.sliceThickness = thickness;
    // TODO: consts instead of magic strings
    if (shouldBeMIP && view.blendMode === "none") view.blendMode = "MIP";
    // else if(!shouldBeMIP) {
    //   view.blendMode = "none"
    // }

    // dv: ex-watcher mpr
    const istyle = this.mprViews[key].renderWindow
      .getInteractor()
      .getInteractorStyle();
    // set thickness if the current interactor has it (it should, but just in case)
    istyle.setSlabThickness && istyle.setSlabThickness(thickness);
    this.mprViews[key].updateBlendMode(thickness, "MIP");
  }
}
