/**
 * MPR LIBRARY LOGIC
 * - init(data, elements) -> data is the mpr state (as data object below), elements are target HTMLelements
 * - update(data) -> function to call when an event is emitted (on rotate or thickness change)
 *
 * MPR EVENTS TO REMAP
 * onRotate
 * onThickness
 * onCrosshairPointSelected
 * onScrolled
 */

import vtkGenericRenderWindow from "vtk.js/Sources/Rendering/Misc/GenericRenderWindow";
import vtkCoordinate from "vtk.js/Sources/Rendering/Core/Coordinate";
import { quat, vec3, mat4 } from "gl-matrix";

// Use modified MPRSlice interactor
import vtkInteractorStyleMPRSlice from "./vue-mpr/vtkInteractorMPRSlice";
import vtkInteractorStyleMPRWindowLevel from "./vue-mpr/vtkInteractorStyleMPRWindowLevel";
import vtkInteractorStyleMPRCrosshairs from "./vue-mpr/vtkInteractorStyleMPRCrosshairs";

// import ViewportOverlay from "../ViewportOverlay/ViewportOverlay.vue";
// import MPRInteractor from "../ViewportOverlay/MPRInteractor.vue";
// import { createSub } from "../lib/createSub.js";

import vtkHttpDataSetReader from "vtk.js/Sources/IO/Core/HttpDataSetReader";
import vtkVolume from "vtk.js/Sources/Rendering/Core/Volume";
import vtkVolumeMapper from "vtk.js/Sources/Rendering/Core/VolumeMapper";

import vtkMatrixBuilder from "vtk.js/Sources/Common/Core/MatrixBuilder";
// import vtkMath from "vtk.js/Sources/Common/Core/Math";
import vtkPlane from "vtk.js/Sources/Common/DataModel/Plane";

import {
  BLEND_MIP,
  BLEND_MINIP,
  BLEND_AVG,
  BLEND_NONE
} from "./vue-mpr/consts";

// LOCAL utils
import { buildVtkVolume, loadSerieWithLarvitar } from "./utils";

function degrees2radians(degrees) {
  return (degrees * Math.PI) / 180;
}

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

const defaultTool = "crosshairs";

let global_data = {
  // PROPS :  moved to viewport data
  //   volumes: [],
  //   parallel: false,
  //   index: "top", // "top", "front", "side"
  sliceIntersection: [0, 0, 0],
  //   onCreated: () => {
  //     console.log("CREATED");
  //   },
  //   onDestroyed: () => {
  //     console.log("DESTROYED");
  //   },
  syncWindowLevels: true,
  volumes: [],
  views: {
    top: {
      color: "#F8B42C",
      slicePlaneNormal: [0, 0, 1],
      sliceViewUp: [0, -1, 0],
      slicePlaneXRotation: 0,
      slicePlaneYRotation: 0,
      viewRotation: 0,
      sliceThickness: 0.1,
      blendMode: "none",
      window: {
        width: 0,
        center: 0
      }
    },
    left: {
      color: "#A62CF8",
      slicePlaneNormal: [1, 0, 0],
      sliceViewUp: [0, 0, -1],
      slicePlaneXRotation: 0,
      slicePlaneYRotation: 0,
      viewRotation: 0,
      sliceThickness: 0.1,
      blendMode: "none",
      window: {
        width: 0,
        center: 0
      }
    },
    front: {
      color: "#2C92F8",
      slicePlaneNormal: [0, -1, 0],
      sliceViewUp: [0, 0, -1],
      slicePlaneXRotation: 0,
      slicePlaneYRotation: 0,
      viewRotation: 0,
      sliceThickness: 0.1,
      blendMode: "none",
      window: {
        width: 0,
        center: 0
      }
    }
  }
};

let viewportData = {
  top: {
    volumes: [],
    width: 300, // TODO set container.offsetWidth
    height: 300, // TODO set container.offsetHight
    renderer: null,
    parallel: false,
    index: "top", // "top", "front", "side"
    onCreated: () => {
      console.log("CREATED");
    },
    onDestroyed: () => {
      console.log("DESTROYED");
    },
    subs: {} // TODO
  },
  left: {
    volumes: [],
    width: 300, // TODO set container.offsetWidth
    height: 300, // TODO set container.offsetHight
    renderer: null,
    parallel: false,
    index: "top", // "top", "front", "side"
    onCreated: () => {
      console.log("CREATED");
    },
    onDestroyed: () => {
      console.log("DESTROYED");
    },
    subs: {} // TODO
  },
  front: {
    volumes: [],
    width: 300, // TODO set container.offsetWidth
    height: 300, // TODO set container.offsetHight
    renderer: null,
    parallel: false,
    index: "top", // "top", "front", "side"
    onCreated: () => {
      console.log("CREATED");
    },
    onDestroyed: () => {
      console.log("DESTROYED");
    },
    subs: {} // TODO
  }
};

function init(data, key, element) {
  console.log("DATA", data);
  console.log("KEY", key);

  // store volumes and element in viewport data
  viewportData[key].volumes = data.volumes;
  viewportData[key].element = element;

  // cache the view vectors so we can apply the rotations without modifying the original value

  console.log("spn", [...data.views[key].slicePlaneNormal]);
  viewportData[key].cachedSlicePlane = [...data.views[key].slicePlaneNormal];
  viewportData[key].cachedSliceViewUp = [...data.views[key].sliceViewUp];

  viewportData[key].genericRenderWindow = vtkGenericRenderWindow.newInstance({
    background: [0, 0, 0]
  });

  viewportData[key].genericRenderWindow.setContainer(element);

  let widgets = [];

  viewportData[key].renderWindow = viewportData[
    key
  ].genericRenderWindow.getRenderWindow();
  viewportData[key].renderer = viewportData[
    key
  ].genericRenderWindow.getRenderer();

  if (viewportData[key].parallel) {
    viewportData[key].renderer.getActiveCamera().setParallelProjection(true);
  }

  // update view node tree so that vtkOpenGLHardwareSelector can access the vtkOpenGLRenderer instance.
  const oglrw = viewportData[key].genericRenderWindow.getOpenGLRenderWindow();
  oglrw.buildPass(true);

  const istyle = vtkInteractorStyleMPRSlice.newInstance();
  istyle.setOnScroll(data.onStackScroll); // TODO check this
  const inter = viewportData[key].renderWindow.getInteractor();
  inter.setInteractorStyle(istyle);

  /*
    // TODO: Use for maintaining clipping range for MIP
    const interactor = this.renderWindow.getInteractor();
    //const clippingRange = renderer.getActiveCamera().getClippingRange();

    interactor.onAnimation(() => {
      renderer.getActiveCamera().setClippingRange(...r);
    });*/

  //  TODO: assumes the volume is always set for this mounted state...Throw an error?
  console.log(viewportData[key].volumes);
  const istyleVolumeMapper = viewportData[key].volumes[0].getMapper();

  istyle.setVolumeMapper(istyleVolumeMapper);

  //start with the volume center slice
  const range = istyle.getSliceRange();
  // console.log('view mounted: setting the initial range', range)
  istyle.setSlice((range[0] + range[1]) / 2);

  // add the current volumes to the vtk renderer
  updateVolumesForRendering(key);

  console.log(data.views[key]);
  updateSlicePlane(data.views[key], key);

  // force the initial draw to set the canvas to the parent bounds.
  onResize(key);

  defaultTool == "level" ? setLevelTool(key) : setCrosshairTool(key);

  //   if (viewportData[key].onCreated) {
  /**
   * Note: The contents of this Object are
   * considered part of the API contract
   * we make with consumers of this component.
   */
  // viewportData[key]
  //   .onCreated
  // this was needed to give the possibility to render to the parent component
  // we should not need it anymore
  //     {
  //   genericRenderWindow: data.genericRenderWindow,
  //   widgetManager: data.widgetManager,
  //   container: data.$refs.container,
  //   widgets,
  //   volumes: [...data.volumes],
  //   _component: data
  // }
  //       ();
  //   }
}

/// START ALL

loadSerieWithLarvitar(serie => {
  const image = buildVtkVolume(serie);

  // TODO add in init function
  let actor = createVolume(image);
  global_data.volumes.push(actor);

  for (let view of viewsArray) {
    console.log(global_data);
    init(global_data, view.key, view.element, image);
  }
});

// UTILITY FUNCTIONS

function createVolume(contentData) {
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

  global_data.sliceIntersection = getVolumeCenter(volumeMapper); // TODO update on scroll

  return volumeActor;
}

function getVolumeCenter(volumeMapper) {
  const bounds = volumeMapper.getBounds();
  return [
    (bounds[0] + bounds[1]) / 2.0,
    (bounds[2] + bounds[3]) / 2.0,
    (bounds[4] + bounds[5]) / 2.0
  ];
}

// TODO
function onResize(key) {
  // TODO: debounce for performance reasons?
  viewportData[key].genericRenderWindow.resize();

  const [width, height] = [
    viewportData[key].element.offsetWidth,
    viewportData[key].element.offsetHeight
  ];
  viewportData[key].width = width;
  viewportData[key].height = height;
}

function updateVolumesForRendering(key) {
  viewportData[key].renderer.removeAllVolumes();
  let volumes = viewportData[key].volumes;
  if (volumes && volumes.length) {
    volumes.forEach(volume => {
      if (!volume.isA("vtkVolume")) {
        console.warn("Data to <Vtk2D> is not vtkVolume data");
      } else {
        viewportData[key].renderer.addVolume(volume);
      }
    });
  }
  viewportData[key].renderWindow.render();
}

function updateSlicePlane(viewData, key) {
  // cached things are in viewport data
  let cachedSlicePlane = viewportData[key].cachedSlicePlane;
  let cachedSliceViewUp = viewportData[key].cachedSliceViewUp;
  console.log(viewData);
  // TODO: optimize so you don't have to calculate EVERYTHING every time?

  // rotate around the vector of the cross product of the plane and viewup as the X component
  let sliceXRotVector = [];
  vec3.cross(sliceXRotVector, viewData.sliceViewUp, viewData.slicePlaneNormal);
  vec3.normalize(sliceXRotVector, sliceXRotVector);

  // rotate the viewUp vector as the Y component
  let sliceYRotVector = viewData.sliceViewUp;

  // const yQuat = quat.create();
  // quat.setAxisAngle(yQuat, input.sliceViewUp, degrees2radians(viewData.slicePlaneYRotation));
  // quat.normalize(yQuat, yQuat);

  // Rotate the slicePlaneNormal using the x & y rotations.
  // const planeQuat = quat.create();
  // quat.add(planeQuat, xQuat, yQuat);
  // quat.normalize(planeQuat, planeQuat);

  // vec3.transformQuat(viewData.cachedSlicePlane, viewData.slicePlaneNormal, planeQuat);

  const planeMat = mat4.create();
  mat4.rotate(
    planeMat,
    planeMat,
    degrees2radians(viewData.slicePlaneYRotation),
    sliceYRotVector
  );
  mat4.rotate(
    planeMat,
    planeMat,
    degrees2radians(viewData.slicePlaneXRotation),
    sliceXRotVector
  );

  console.log(cachedSlicePlane, viewData.slicePlaneNormal, planeMat);

  vec3.transformMat4(cachedSlicePlane, viewData.slicePlaneNormal, planeMat);

  // Rotate the viewUp in 90 degree increments
  const viewRotQuat = quat.create();
  // Use - degrees since the axis of rotation should really be the direction of projection, which is the negative of the plane normal
  quat.setAxisAngle(
    viewRotQuat,
    cachedSlicePlane,
    degrees2radians(-viewData.viewRotation)
  );
  quat.normalize(viewRotQuat, viewRotQuat);

  // rotate the ViewUp with the x and z rotations
  const xQuat = quat.create();
  quat.setAxisAngle(
    xQuat,
    sliceXRotVector,
    degrees2radians(viewData.slicePlaneXRotation)
  );
  quat.normalize(xQuat, xQuat);
  const viewUpQuat = quat.create();
  quat.add(viewUpQuat, xQuat, viewRotQuat);
  vec3.transformQuat(cachedSliceViewUp, viewData.sliceViewUp, viewRotQuat);

  // update the view's slice
  const renderWindow = viewportData[key].genericRenderWindow.getRenderWindow();
  const istyle = renderWindow.getInteractor().getInteractorStyle();
  if (istyle && istyle.setSliceNormal) {
    istyle.setSliceNormal(cachedSlicePlane, cachedSliceViewUp);
  }

  renderWindow.render();
}

function updateBlendMode(thickness) {
  if (thickness >= 1) {
    switch (this.blendMode) {
      case BLEND_MIP:
        this.volumes[0].getMapper().setBlendModeToMaximumIntensity();
        break;
      case BLEND_MINIP:
        this.volumes[0].getMapper().setBlendModeToMinimumIntensity();
        break;
      case BLEND_AVG:
        this.volumes[0].getMapper().setBlendModeToAverageIntensity();
        break;
      case BLEND_NONE:
      default:
        this.volumes[0].getMapper().setBlendModeToComposite();
        break;
    }
  } else {
    this.volumes[0].getMapper().setBlendModeToComposite();
  }
  this.renderWindow.render();
}

// TODO setInteractor ? (see original code)
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
    // console.log("setting slicenormal from old normal");
    istyle.setSliceNormal(oldStyle.getSliceNormal(), oldStyle.getViewUp());
  }
  if (istyle.setSlabThickness && oldStyle.getSlabThickness()) {
    istyle.setSlabThickness(oldStyle.getSlabThickness());
  }
  istyle.setVolumeMapper(viewportData[key].volumes[0]);
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
  istyle.setOnClickCallback(({ worldPos }) =>
    onCrosshairPointSelected({ worldPos, srcKey: key })
  );
  setInteractor(key, istyle);
}

// TODO refactoring DV: no need to have ww wc in global_data ?
function updateLevels({ windowCenter, windowWidth, srcKey }) {
  global_data.views[srcKey].window.center = windowCenter;
  global_data.views[srcKey].window.width = windowWidth;

  if (global_data.syncWindowLevels) {
    let components = viewsArray.map(v => v.key);
    Object.entries(components)
      .filter(key => key !== srcKey)
      .forEach(([i, key]) => {
        global_data.views[key].window.center = windowCenter;
        global_data.views[key].window.width = windowWidth;
        viewportData[key].genericRenderWindow
          .getInteractor()
          .getInteractorStyle()
          .setWindowLevel(windowWidth, windowCenter);
        viewportData[key].genericRenderWindow.getRenderWindow().render();
      });
  }
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
    global_data.sliceIntersection = newPoint;
    console.log("updating slice intersection", newPoint);
  }
}

/**
 * Planes are of type `{position:[x,y,z], normal:[x,y,z]}`
 * returns an [x,y,z] array, or NaN if they do not intersect.
 */
const getPlaneIntersection = (plane1, plane2, plane3) => {
  try {
    let line = vtkPlane.intersectWithPlane(
      plane1.position,
      plane1.normal,
      plane2.position,
      plane2.normal
    );
    if (line.intersection) {
      const { l0, l1 } = line;
      const intersectionLocation = vtkPlane.intersectWithLine(
        l0,
        l1,
        plane3.position,
        plane3.normal
      );
      if (intersectionLocation.intersection) {
        return intersectionLocation.x;
      }
    }
  } catch (err) {
    console.log("some issue calculating the plane intersection", err);
  }
  return NaN;
};

// (key, axis: x or y, ABSOLUTE angle in deg)
function onRotate(key, axis, angle) {
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
}

// TESTING EVENTS

let stateUI = {
  top: { x: 0, y: 0 },
  left: { x: 0, y: 0 },
  front: { x: 0, y: 0 }
};

document.addEventListener("keypress", e => {
  console.log(e);
  let key, axis;

  switch (e.code) {
    case "KeyQ":
      key = "top";
      axis = "x";
      break;
    case "KeyW":
      key = "top";
      axis = "y";
      break;
    case "KeyE":
      key = "left";
      axis = "x";
      break;
    case "KeyR":
      key = "left";
      axis = "y";
      break;
    case "KeyT":
      key = "front";
      axis = "x";
      break;
    case "KeyY":
      key = "front";
      axis = "y";
      break;
  }

  if (key && axis) {
    // MOVE BY +/- 10 deg
    let oldAngle = stateUI[key][axis];
    let angle = e.shiftKey ? oldAngle - 10 : oldAngle + 10;
    console.log(key, axis, oldAngle, angle);
    onRotate(key, axis, angle);
    stateUI[key][axis] = angle;
  } else {
    // RESET
    onRotate("top", "x", 0);
    onRotate("top", "y", 0);
    onRotate("left", "x", 0);
    onRotate("left", "y", 0);
    onRotate("front", "x", 0);
    onRotate("front", "y", 0);
    stateUI.top.x = 0;
    stateUI.top.y = 0;
    stateUI.left.x = 0;
    stateUI.left.y = 0;
    stateUI.front.x = 0;
    stateUI.front.y = 0;
  }
});

window.onRotate = onRotate;
