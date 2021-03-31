// Use modified MPRSlice interactor
import vtkInteractorStyleMPRWindowLevel from "./vue-mpr/vtkInteractorStyleMPRWindowLevel";
import vtkInteractorStyleMPRCrosshairs from "./vue-mpr/vtkInteractorStyleMPRCrosshairs";
import vtkCoordinate from "vtk.js/Sources/Rendering/Core/Coordinate";
import vtkMatrixBuilder from "vtk.js/Sources/Common/Core/MatrixBuilder";
// import vtkMath from "vtk.js/Sources/Common/Core/Math";
import vtkVolume from "vtk.js/Sources/Rendering/Core/Volume";
import vtkVolumeMapper from "vtk.js/Sources/Rendering/Core/VolumeMapper";

import {
  degrees2radians,
  getPlaneIntersection,
  getVolumeCenter
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

const viewsArray = [
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

let viewportData = {
  top: new MPRView("top"),
  left: new MPRView("left"),
  front: new MPRView("front")
};

export function initMPR(global_data, image) {
  let actor = createVolumeActor(image);
  global_data.volumes.push(actor);
  global_data.sliceIntersection = getVolumeCenter(actor.getMapper());

  Object.entries(global_data.views).forEach(([key, view]) => {
    // initView(global_data, key, view.element);
    viewportData[key].initView(global_data, key, view.element);
  });
}

function setLevelTool(key) {
  const istyle = vtkInteractorStyleMPRWindowLevel.newInstance();
  istyle.setOnScroll(onScrolled);
  istyle.setOnLevelsChanged(levels => {
    updateLevels({ ...levels, srcKey: key });
  });
  setInteractor(key, istyle);
}

function setCrosshairTool(key) {
  const istyle = vtkInteractorStyleMPRCrosshairs.newInstance();
  istyle.setOnScroll(onScrolled);
  istyle.setOnClickCallback(({ worldPos }) => {
    onCrosshairPointSelected({ worldPos, srcKey: key });
  });
  setInteractor(key, istyle);
}

// depends on viewportData
function setInteractor(key, istyle) {
  const renderWindow = viewportData[key].genericRenderWindow.getRenderWindow();
  // We are assuming the old style is always extended from the MPRSlice style
  const oldStyle = renderWindow.getInteractor().getInteractorStyle();

  renderWindow.getInteractor().setInteractorStyle(istyle);
  // NOTE: react-vtk-viewport's code put this here, so we're copying it. Seems redundant?
  istyle.setInteractor(renderWindow.getInteractor());

  // Make sure to set the style to the interactor itself, because reasons...?!
  const inter = renderWindow.getInteractor();
  inter.setInteractorStyle(istyle);

  // Copy previous interactors styles into the new one.
  if (istyle.setSliceNormal && oldStyle.getSliceNormal()) {
    // if (VERBOSE) console.log("setting slicenormal from old normal");
    istyle.setSliceNormal(oldStyle.getSliceNormal(), oldStyle.getViewUp());
  }
  if (istyle.setSlabThickness && oldStyle.getSlabThickness()) {
    istyle.setSlabThickness(oldStyle.getSlabThickness());
  }
  istyle.setVolumeMapper(viewportData[key].volumes[0]);

  // set current slice (fake) to make distance widget working
  // istyle.setCurrentImageNumber(0);
}

function onCrosshairPointSelected({ srcKey, worldPos }) {
  let components = viewsArray.map(v => v.key);
  components.forEach(key => {
    if (key !== srcKey) {
      // We are basically doing the same as getSlice but with the world coordinate
      // that we want to jump to instead of the camera focal point.
      // I would rather do the camera adjustment directly but I keep
      // doing it wrong and so this is good enough for now.
      // ~ swerik
      const renderWindow = viewportData[
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

    const renderer = viewportData[key].genericRenderWindow.getRenderer();
    const wPos = vtkCoordinate.newInstance();
    wPos.setCoordinateSystemToWorld();
    wPos.setValue(worldPos);

    const displayPosition = wPos.getComputedDisplayValue(renderer);
  });
}

// depends on global_data AND viewportData
// TODO refactoring DV: no need to have ww wc in global_data ?
function updateLevels({ windowCenter, windowWidth, srcKey }) {
  //   global_data.views[srcKey].window.center = windowCenter;
  //   global_data.views[srcKey].window.width = windowWidth;

  if (syncWindowLevels) {
    let components = viewsArray.map(v => v.key);
    Object.entries(components)
      .filter(key => key !== srcKey)
      .forEach(([i, key]) => {
        // global_data.views[key].window.center = windowCenter;
        // global_data.views[key].window.width = windowWidth;
        viewportData[key].genericRenderWindow
          .getInteractor()
          .getInteractorStyle()
          .setWindowLevel(windowWidth, windowCenter);
        viewportData[key].genericRenderWindow.getRenderWindow().render();
      });
  }
}

// depends on viewsArray AND viewportData AND global_data
function onScrolled() {
  let planes = [];
  let components = viewsArray.map(v => v.key);
  components.forEach(key => {
    const camera = viewportData[key].genericRenderWindow
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
export function onRotate(key, axis, angle, global_data) {
  // Match the source axis to the associated plane
  switch (key) {
    case "top":
      if (axis === "x") global_data.views.front.slicePlaneYRotation = angle;
      else if (axis === "y") global_data.views.left.slicePlaneYRotation = angle;
      break;
    case "left":
      if (axis === "x") global_data.views.top.slicePlaneXRotation = angle;
      else if (axis === "y")
        global_data.views.front.slicePlaneXRotation = angle;
      break;
    case "front":
      if (axis === "x") global_data.views.top.slicePlaneYRotation = angle;
      else if (axis === "y") global_data.views.left.slicePlaneXRotation = angle;
      break;
  }

  // dv: this was a watcher in mpr component, update all except myself ?

  let components = viewsArray.map(v => v.key);
  components.filter(c => c !== key).forEach(k => {
    updateSlicePlane(global_data.views[k], k);
  });

  if (VERBOSE) console.log("afterOnRotate", global_data);
}

// depends on global_data and viewportData
export function onThickness(key, axis, thickness, global_data) {
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
  const istyle = viewportData[key].renderWindow
    .getInteractor()
    .getInteractorStyle();
  // set thickness if the current interactor has it (it should, but just in case)
  istyle.setSlabThickness && istyle.setSlabThickness(thickness);
  updateBlendMode(key, thickness, "MIP");
}

export function createVolumeActor(contentData) {
  const volumeActor = vtkVolume.newInstance();
  const volumeMapper = vtkVolumeMapper.newInstance();
  volumeMapper.setSampleDistance(1);
  volumeActor.setMapper(volumeMapper);

  volumeMapper.setInputData(contentData);

  // FIXME: custom range mapping
  const rgbTransferFunction = volumeActor
    .getProperty()
    .getRGBTransferFunction(0);
  rgbTransferFunction.setMappingRange(500, 3000);

  // update slice min/max values for interface
  // Crate imageMapper for I,J,K planes
  // const dataRange = data
  //   .getPointData()
  //   .getScalars()
  //   .getRange();
  // const extent = data.getExtent();
  // this.window = {
  //   min: 0,
  //   max: dataRange[1] * 2,
  //   value: dataRange[1]
  // };
  // this.level = {
  //   min: -dataRange[1],
  //   max: dataRange[1],
  //   value: (dataRange[0] + dataRange[1]) / 2
  // };
  // this.updateColorLevel();
  // this.updateColorWindow();

  // TODO: find the volume center and set that as the slice intersection point.
  // TODO: Refactor the MPR slice to set the focal point instead of defaulting to volume center

  return volumeActor;
}

// depends on viewportData
function updateBlendMode(key, thickness, blendMode) {
  if (thickness >= 1) {
    switch (blendMode) {
      case "MIP":
        viewportData[key].volumes[0]
          .getMapper()
          .setBlendModeToMaximumIntensity();
        break;
      case "MINIP":
        viewportData[key].volumes[0]
          .getMapper()
          .setBlendModeToMinimumIntensity();
        break;
      case "AVG":
        viewportData[key].volumes[0]
          .getMapper()
          .setBlendModeToAverageIntensity();
        break;
      case "none":
      default:
        viewportData[key].volumes[0].getMapper().setBlendModeToComposite();
        break;
    }
  } else {
    viewportData[key].volumes[0].getMapper().setBlendModeToComposite();
  }
  viewportData[key].renderWindow.render();
}
