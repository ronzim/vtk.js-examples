import "vtk.js/Sources/favicon";

import vtkActor from "vtk.js/Sources/Rendering/Core/Actor";
import vtkAnnotatedCubeActor from "vtk.js/Sources/Rendering/Core/AnnotatedCubeActor";
import vtkDataArray from "vtk.js/Sources/Common/Core/DataArray";
import vtkImageData from "vtk.js/Sources/Common/DataModel/ImageData";
import vtkImageMapper from "vtk.js/Sources/Rendering/Core/ImageMapper";
import vtkImageReslice from "vtk.js/Sources/Imaging/Core/ImageReslice";
import vtkImageSlice from "vtk.js/Sources/Rendering/Core/ImageSlice";
import vtkInteractorStyleImage from "vtk.js/Sources/Interaction/Style/InteractorStyleImage";
//import vtkInteractorStyleImage from "./interactor";
import vtkInteractorStyleTrackballCamera from "vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera";
import vtkMapper from "vtk.js/Sources/Rendering/Core/Mapper";
import vtkOutlineFilter from "vtk.js/Sources/Filters/General/OutlineFilter";
import vtkOpenGLRenderWindow from "vtk.js/Sources/Rendering/OpenGL/RenderWindow";
import vtkOrientationMarkerWidget from "vtk.js/Sources/Interaction/Widgets/OrientationMarkerWidget";
import vtkRenderer from "vtk.js/Sources/Rendering/Core/Renderer";
import vtkRenderWindow from "vtk.js/Sources/Rendering/Core/RenderWindow";
import vtkRenderWindowInteractor from "vtk.js/Sources/Rendering/Core/RenderWindowInteractor";
import vtkResliceCursorWidget from "vtk.js/Sources/Widgets/Widgets3D/ResliceCursorWidget";
import vtkDistanceWidget from "vtk.js/Sources/Widgets/Widgets3D/DistanceWidget";
import vtkAngleWidget from "vtk.js/Sources/Widgets/Widgets3D/AngleWidget";
import vtkWidgetManager from "vtk.js/Sources/Widgets/Core/WidgetManager";
import vtkColorTransferFunction from "vtk.js/Sources/Rendering/Core/ColorTransferFunction";
import vtkPiecewiseFunction from "vtk.js/Sources/Common/DataModel/PiecewiseFunction";

import vtkSphereSource from "vtk.js/Sources/Filters/Sources/SphereSource";
import { CaptureOn } from "vtk.js/Sources/Widgets/Core/WidgetManager/Constants";

import { vec3 } from "gl-matrix";
import { SlabMode } from "vtk.js/Sources/Imaging/Core/ImageReslice/Constants";

import { xyzToViewType } from "vtk.js/Sources/Widgets/Widgets3D/ResliceCursorWidget/Constants";

import {
  buildVtkVolume,
  loadSerieWithLarvitar,
  createRGBStringFromRGBValues
} from "./utils";

import { controlPanel } from "./controlPanel";

// GLOBAL APP STATE

const viewColors = [
  [48 / 255, 0, 179 / 255], // sagittal
  [0, 179 / 255, 48 / 255], // coronal
  [179 / 255, 48 / 255, 0], // axial
  [0.5, 0.5, 0.5] // 3D
];

const showDebugActors = false;
const measureWidget = true;

const viewAttributes = [];
let RCwidget = null;
let view3D = null;

function mpr(image, viewports) {
  console.log(" --- MPR --- ");

  // INIT reslice widget

  RCwidget = vtkResliceCursorWidget.newInstance();
  console.log("RCwidget", RCwidget);
  const widgetState = RCwidget.getWidgetState();
  widgetState.setKeepOrthogonality(true);
  widgetState.setOpacity(0.6);
  widgetState.setSphereRadius(10);
  widgetState.setShowCenter(false);
  const initialPlanesState = { ...widgetState.getPlanes() };

  // INIT scenes

  for (let i = 0; i < 4; i++) {
    const element = document.getElementById(viewports[i]);

    const obj = {
      renderWindow: vtkRenderWindow.newInstance(),
      renderer: vtkRenderer.newInstance(),
      GLWindow: vtkOpenGLRenderWindow.newInstance(),
      interactor: vtkRenderWindowInteractor.newInstance(),
      widgetManager: vtkWidgetManager.newInstance()
    };

    obj.renderer.getActiveCamera().setParallelProjection(true);
    obj.renderer.setBackground(...viewColors[i]);
    obj.renderWindow.addRenderer(obj.renderer);
    obj.renderWindow.addView(obj.GLWindow);
    obj.renderWindow.setInteractor(obj.interactor);
    obj.GLWindow.setContainer(element);
    obj.interactor.setView(obj.GLWindow);
    obj.interactor.initialize();
    obj.interactor.bindEvents(element);
    obj.widgetManager.setRenderer(obj.renderer);

    if (i < 3) {
      // SETUP interactor style 2D (wwwl)
      const iStyle = vtkInteractorStyleImage.newInstance();
      obj.interactor.setInteractorStyle(iStyle);
      iStyle.setInteractionMode("IMAGE_2D");
      iStyle.setCurrentImageNumber(0); // must be set after interactor.setInteractorStyle
      obj.widgetInstance = obj.widgetManager.addWidget(
        RCwidget,
        xyzToViewType[i]
      );

      obj.widgetManager.enablePicking();
      // Use to update all renderers buffer when actors are moved
      obj.widgetManager.setCaptureOn(CaptureOn.MOUSE_MOVE);
    } else {
      // SETUP interactor style 3D (trackball)
      obj.interactor.setInteractorStyle(
        vtkInteractorStyleTrackballCamera.newInstance()
      );
    }

    // SETUP color and opacity transfer functions

    const rgb = vtkColorTransferFunction.newInstance();
    rgb.addRGBPoint(0, 0, 0, 0);
    rgb.addRGBPoint(2046, 1, 1, 1);

    const ofun = vtkPiecewiseFunction.newInstance();
    ofun.addPoint(0, 1);
    ofun.addPoint(150, 1);
    ofun.addPoint(180, 1);
    ofun.addPoint(2046, 1);

    // reslice actor and mapper

    obj.reslice = vtkImageReslice.newInstance();
    obj.reslice.setSlabMode(SlabMode.MEAN);
    obj.reslice.setSlabNumberOfSlices(1);
    obj.reslice.setTransformInputSampling(false);
    obj.reslice.setAutoCropOutput(true);
    obj.reslice.setOutputDimensionality(2);
    obj.resliceMapper = vtkImageMapper.newInstance();
    obj.resliceMapper.setInputConnection(obj.reslice.getOutputPort());
    obj.resliceActor = vtkImageSlice.newInstance();
    obj.resliceActor.getProperty().setColorWindow(4093);
    obj.resliceActor.getProperty().setColorLevel(2046);
    // obj.resliceActor.getProperty().setRGBTransferFunction(rgb);
    // obj.resliceActor.getProperty().setPiecewiseFunction(ofun);
    obj.resliceActor.setMapper(obj.resliceMapper);

    if (i < 3) {
      obj.reslice.setInputData(image);
      obj.renderer.addActor(obj.resliceActor);
    }

    // add spheres for debug
    addDebugSpheres(obj, viewColors[i], showDebugActors);

    if (i < 3) {
      viewAttributes.push(obj);
    } else {
      view3D = obj;
    }

    console.log("viewAttributes", viewAttributes);
    console.log("view3D", view3D);

    // SETUP orientation widget

    let axes = createReferenceAxes(viewColors);
    const orientationWidget = vtkOrientationMarkerWidget.newInstance({
      actor: axes,
      interactor: obj.renderWindow.getInteractor()
    });
    orientationWidget.setEnabled(true);
    orientationWidget.setViewportCorner(
      vtkOrientationMarkerWidget.Corners.BOTTOM_RIGHT
    );
    orientationWidget.setViewportSize(0.15);
    orientationWidget.setMinPixelSize(100);
    orientationWidget.setMaxPixelSize(300);
  }

  // END for cycle --- scenes initialized

  // add 2d slices to 3d
  populate3dScene(viewAttributes, view3D);

  // set image in reslice widget
  RCwidget.setImage(image);

  // Create image outline in 3D view
  create3dOutline(image, view3D);

  // Bind scenes events to each widget
  setupWidgetCallbacks(RCwidget, viewAttributes);

  view3D.renderer.resetCamera();
  view3D.renderer.resetCameraClippingRange();

  // HACK click on each view to force rendering the cubes
  viewports.forEach(id => {
    triggerMouseEvent(id, "mousedown");
    setTimeout(triggerMouseEvent, 25, id, "mouseup");
  });

  if (measureWidget) {
    setTimeout(() => {
      initWidget(image);
    }, 2000); // why ?
  }

  // set max number of slices to slider.
  const maxNumberOfSlices = vec3.length(image.getDimensions());
  document.getElementById("slabNumber").max = maxNumberOfSlices;

  // ----------------------------------------------------------------------------
  // Define panel interactions
  // ----------------------------------------------------------------------------
  function updateViews() {
    viewAttributes.forEach((obj, i) => {
      updateReslice({
        viewType: xyzToViewType[i],
        reslice: obj.reslice,
        actor: obj.resliceActor,
        renderer: obj.renderer,
        resetFocalPoint: true,
        keepFocalPointPosition: false,
        computeFocalPointOffset: true,
        sphereSources: obj.sphereSources,
        resetViewUp: true
      });
      obj.renderWindow.render();
    });
    view3D.renderer.resetCamera();
    view3D.renderer.resetCameraClippingRange();
  }

  const checkboxOrthogonality = document.getElementById("checkboxOrthogality");
  checkboxOrthogonality.addEventListener("change", ev => {
    widgetState.setKeepOrthogonality(checkboxOrthogonality.checked);
  });

  const checkboxRotation = document.getElementById("checkboxRotation");
  checkboxRotation.addEventListener("change", ev => {
    widgetState.setEnableRotation(checkboxRotation.checked);
  });

  const checkboxTranslation = document.getElementById("checkboxTranslation");
  checkboxTranslation.addEventListener("change", ev => {
    widgetState.setEnableTranslation(checkboxTranslation.checked);
  });

  const optionSlabModeMin = document.getElementById("slabModeMin");
  optionSlabModeMin.value = SlabMode.MIN;
  const optionSlabModeMax = document.getElementById("slabModeMax");
  optionSlabModeMax.value = SlabMode.MAX;
  const optionSlabModeMean = document.getElementById("slabModeMean");
  optionSlabModeMean.value = SlabMode.MEAN;
  const optionSlabModeSum = document.getElementById("slabModeSum");
  optionSlabModeSum.value = SlabMode.SUM;
  const selectSlabMode = document.getElementById("slabMode");
  selectSlabMode.addEventListener("change", ev => {
    viewAttributes.forEach(obj => {
      obj.reslice.setSlabMode(Number(ev.target.value));
    });
    updateViews();
  });

  const sliderSlabNumberofSlices = document.getElementById("slabNumber");
  sliderSlabNumberofSlices.addEventListener("change", ev => {
    const trSlabNumberValue = document.getElementById("slabNumberValue");
    trSlabNumberValue.innerHTML = ev.target.value;
    viewAttributes.forEach(obj => {
      obj.reslice.setSlabNumberOfSlices(ev.target.value);
    });
    updateViews();
  });

  const buttonReset = document.getElementById("buttonReset");
  buttonReset.addEventListener("click", () => {
    widgetState.setPlanes(initialPlanesState);
    widget.setCenter(
      widget
        .getWidgetState()
        .getImage()
        .getCenter()
    );
    updateViews();
  });
}

// LOAD image and run mpr

loadSerieWithLarvitar(serie => {
  const viewports = ["viewer-2", "viewer-3", "viewer-4", "viewer-5"];
  const image = buildVtkVolume(serie);
  mpr(image, viewports);
});

// --------------------------------------------
// UTILS
// --------------------------------------------

function addDebugSpheres(obj, viewColor, show) {
  obj.sphereActors = [];
  obj.sphereSources = [];

  // Create sphere for each 2D views which will be displayed in 3D
  // Define origin, point1 and point2 of the plane used to reslice the volume
  for (let j = 0; j < 3; j++) {
    const sphere = vtkSphereSource.newInstance();
    sphere.setRadius(5);
    const mapper = vtkMapper.newInstance();
    mapper.setInputConnection(sphere.getOutputPort());
    const actor = vtkActor.newInstance();
    actor.setMapper(mapper);
    actor.getProperty().setColor(...viewColor);
    actor.setVisibility(show);
    obj.sphereActors.push(actor);
    obj.sphereSources.push(sphere);
  }
}

function createReferenceAxes(viewColors) {
  const axes = vtkAnnotatedCubeActor.newInstance();
  axes.setDefaultStyle({
    text: "+X",
    fontStyle: "bold",
    fontFamily: "Arial",
    fontColor: "black",
    fontSizeScale: res => res / 2,
    faceColor: createRGBStringFromRGBValues(viewColors[0]),
    faceRotation: 0,
    edgeThickness: 0.1,
    edgeColor: "black",
    resolution: 400
  });
  // axes.setXPlusFaceProperty({ text: '+X' });
  axes.setXPlusFaceProperty({
    text: "+X",
    faceColor: createRGBStringFromRGBValues(viewColors[0]),
    faceRotation: 90
  });
  axes.setXMinusFaceProperty({
    text: "-X",
    faceColor: createRGBStringFromRGBValues(viewColors[0]),
    faceRotation: 90,
    fontStyle: "italic"
  });
  axes.setYPlusFaceProperty({
    text: "+Y",
    faceColor: createRGBStringFromRGBValues(viewColors[1]),
    fontSizeScale: res => res / 4
  });
  axes.setYMinusFaceProperty({
    text: "-Y",
    faceColor: createRGBStringFromRGBValues(viewColors[1]),
    fontColor: "black"
  });
  axes.setZPlusFaceProperty({
    text: "+Z",
    faceColor: createRGBStringFromRGBValues(viewColors[2])
  });
  axes.setZMinusFaceProperty({
    text: "-Z",
    faceColor: createRGBStringFromRGBValues(viewColors[2]),
    faceRotation: 180
  });

  return axes;
}

function create3dOutline(image, view3D) {
  const outline = vtkOutlineFilter.newInstance();
  outline.setInputData(image);
  const outlineMapper = vtkMapper.newInstance();
  outlineMapper.setInputData(outline.getOutputData());
  const outlineActor = vtkActor.newInstance();
  outlineActor.setMapper(outlineMapper);
  view3D.renderer.addActor(outlineActor);
}

function populate3dScene(viewAttributes, view3D) {
  viewAttributes.forEach(obj => {
    console.log("add", obj.resliceActor);
    view3D.renderer.addActor(obj.resliceActor);
    obj.sphereActors.forEach(actor => {
      obj.renderer.addActor(actor);
      view3D.renderer.addActor(actor);
    });
  });
}

function updateReslice(
  interactionContext = {
    viewType: "",
    reslice: null,
    actor: null,
    renderer: null,
    resetFocalPoint: false, // Reset the focal point to the center of the display image
    keepFocalPointPosition: false, // Defines if the focal point position is kepts (same display distance from reslice cursor center)
    computeFocalPointOffset: false, // Defines if the display offset between reslice center and focal point has to be
    // computed. If so, then this offset will be used to keep the focal point position during rotation.
    spheres: null
  }
) {
  console.log(" --- UPDATE RESLICE --- ");

  console.log(interactionContext);

  const obj = RCwidget.updateReslicePlane(
    interactionContext.reslice,
    interactionContext.viewType
  );

  if (obj.modified) {
    // Get returned modified from setter to know if we have to render
    interactionContext.actor.setUserMatrix(
      interactionContext.reslice.getResliceAxes()
    );
    interactionContext.sphereSources[0].setCenter(...obj.origin);
    interactionContext.sphereSources[1].setCenter(...obj.point1);
    interactionContext.sphereSources[2].setCenter(...obj.point2);
  }

  RCwidget.updateCameraPoints(
    interactionContext.renderer,
    interactionContext.viewType,
    interactionContext.resetFocalPoint,
    interactionContext.keepFocalPointPosition,
    interactionContext.computeFocalPointOffset
  );
  view3D.renderWindow.render();

  return obj.modified;
}

function setupWidgetCallbacks(widget, viewAttributes) {
  // cycle on 2D scenes, bind events on each widget
  viewAttributes.forEach((obj, i) => {
    const reslice = obj.reslice;
    const viewType = xyzToViewType[i];

    // No need to update plane nor refresh when interaction
    // is on current view. Plane can't be changed with interaction on current
    // view. Refreshs happen automatically with `animation`.
    // Note: Need to refresh also the current view because of adding the mouse wheel
    // to change slicer
    viewAttributes.forEach(v => {
      // Interactions in other views may change current plane
      v.widgetInstance.onInteractionEvent(
        // computeFocalPointOffset: Boolean which defines if the offset between focal point and
        // reslice cursor display center has to be recomputed (while translation is applied)
        // canUpdateFocalPoint: Boolean which defines if the focal point can be updated because
        // the current interaction is a rotation
        ({ computeFocalPointOffset, canUpdateFocalPoint }) => {
          const activeViewType = widget.getWidgetState().getActiveViewType();
          const keepFocalPointPosition =
            activeViewType !== viewType && canUpdateFocalPoint;
          updateReslice({
            viewType,
            reslice,
            actor: obj.resliceActor,
            renderer: obj.renderer,
            resetFocalPoint: false,
            keepFocalPointPosition,
            computeFocalPointOffset,
            sphereSources: obj.sphereSources
          });
        }
      );
    });

    updateReslice({
      viewType,
      reslice,
      actor: obj.resliceActor,
      renderer: obj.renderer,
      resetFocalPoint: true, // At first initilization, center the focal point to the image center
      keepFocalPointPosition: false, // Don't update the focal point as we already set it to the center of the image
      computeFocalPointOffset: true, // Allow to compute the current offset between display reslice center and display focal point
      sphereSources: obj.sphereSources
    });
    obj.renderWindow.render();
  });
}

function triggerMouseEvent(elementId, eventType) {
  let element = document.getElementById(elementId);
  let clickEvent = document.createEvent("MouseEvents");
  clickEvent.initEvent(eventType, true, true);
  element.dispatchEvent(clickEvent);
}

// EXAMPLE of distance widget
window.initWidget = function initWidget(image) {
  console.log("init widget", image);
  console.log(vtkDistanceWidget);
  const distWidget = vtkDistanceWidget.newInstance();
  // const distWidget = vtkAngleWidget.newInstance();
  let bounds = image.getBounds();
  distWidget.placeWidget(bounds);
  distWidget.getManipulator().setNormal(1, 0, 0);
  distWidget
    .getManipulator()
    .setOrigin(
      bounds[1],
      (bounds[3] + bounds[2]) / 2,
      (bounds[5] + bounds[4]) / 2
    );

  let instance = viewAttributes[0].widgetManager.addWidget(distWidget);

  distWidget.getWidgetState().onModified(() => {
    console.log("DISTANCE", distWidget.getDistance());
    instance
      .getWidgetState()
      .getHandleList()
      .forEach(h => h.setScale1(10));
    // console.log("DISTANCE", distWidget.getAngle());
  });

  view3D.widgetManager.addWidget(distWidget);
  viewAttributes[0].widgetManager.grabFocus(distWidget);
  window.widget = distWidget;
  window.widgetManager = viewAttributes[0].widgetManager;
  window.widgetInstance = instance;
};
