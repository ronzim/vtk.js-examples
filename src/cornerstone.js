import * as _ from "lodash";
import vtkGenericRenderWindow from "vtk.js/Sources/Rendering/Misc/GenericRenderWindow";
import vtkImageMapper from "vtk.js/Sources/Rendering/Core/ImageMapper";
import vtkImageSlice from "vtk.js/Sources/Rendering/Core/ImageSlice";
import vtkInteractorStyleImage from "vtk.js/Sources/Interaction/Style/InteractorStyleImage";
import ImageConstants from "vtk.js/Sources/Rendering/Core/ImageMapper/Constants";
const { SlicingMode } = ImageConstants;

import { buildVtkVolume, fitToWindow, loadSerieWithLarvitar } from "./utils.js";

// example main code ------------------------------

loadSerieWithLarvitar(serie => {
  renderSerieCornerstone(serie, renderSerieVtk);
});

// -------------------------------------------------

function renderSerieCornerstone(serie, cb) {
  larvitar.renderImage(serie, "viewer");
  larvitar.addDefaultTools();
  larvitar.setToolActive(larvitar.larvitar_store.state.leftMouseHandler);

  if (cb) {
    cb(serie);
  }
}

function renderSerieVtk(serie) {
  let volume = buildVtkVolume(serie);
  setupVtkScene(volume);
}

function setupVtkScene(volume) {
  const container = document.getElementById("viewer-2");

  // We use the wrapper here to abstract out manual RenderWindow/Renderer/OpenGLRenderWindow setup
  const genericRenderWindow = vtkGenericRenderWindow.newInstance();
  genericRenderWindow.setContainer(container);
  genericRenderWindow.resize();
  genericRenderWindow.setBackground(0, 0, 0);

  const renderer = genericRenderWindow.getRenderer();
  const renderWindow = genericRenderWindow.getRenderWindow();
  const camera = renderer.getActiveCamera();

  // renderer camera to parallel projection
  camera.setParallelProjection(true);

  // --- Set up interactor style for image slicing
  // ACHTUNG! see https://github.com/Kitware/vtk-js/issues/1592

  const istyle = vtkInteractorStyleImage.newInstance();
  istyle.setInteractionMode("IMAGE_SLICING");
  renderWindow.getInteractor().setInteractorStyle(istyle);

  // --- Set up the slicing actor ---

  const actor = vtkImageSlice.newInstance();
  const mapper = vtkImageMapper.newInstance();

  mapper.setSliceAtFocalPoint(true); // This is not compatible with setSlice() (see ACTHUNG above)
  mapper.setSlicingMode(SlicingMode.K);
  // mapper.setSlice(11);

  // tell the actor which mapper to use
  actor.setMapper(mapper);

  // --- set up default window/level ---
  // TODO get from metadata
  actor.getProperty().setColorWindow(4093);
  actor.getProperty().setColorLevel(2046);

  // wire up the reader to the mapper
  mapper.setInputData(volume);

  // --- Add volume actor to scene ---
  renderer.addActor(actor);

  // --- Set camera to obtain same visualization as cornerstone viewport ---
  renderer.resetCamera();

  let cameraPosition = camera.getPosition();
  cameraPosition[2] *= -1;
  camera.setPosition(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
  let cameraUp = camera.getViewUp();
  cameraUp[1] *= -1;
  camera.setViewUp(cameraUp);
  camera.setClippingRange(-1000, 1000); // TODO compute proper clipping range

  // NOTES for camera
  // camera.roll(degrees) to rotate
  // camera.zoom(amount) to zoom

  // render the scene
  fitToWindow(genericRenderWindow, "z");
  renderWindow.render();

  window.renderer = renderer;
  window.actor = actor;
  window.mapper = mapper;
  window.genericRenderWindow = genericRenderWindow;
}
