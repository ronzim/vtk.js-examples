import * as _ from "lodash";
import vtkDataArray from "vtk.js/Sources/Common/Core/DataArray";
import vtkImageData from "vtk.js/Sources/Common/DataModel/ImageData";
import vtkGenericRenderWindow from "vtk.js/Sources/Rendering/Misc/GenericRenderWindow";
import vtkImageMapper from "vtk.js/Sources/Rendering/Core/ImageMapper";
import vtkImageSlice from "vtk.js/Sources/Rendering/Core/ImageSlice";
import vtkInteractorStyleImage from "vtk.js/Sources/Interaction/Style/InteractorStyleImage";
import ImageConstants from "vtk.js/Sources/Rendering/Core/ImageMapper/Constants";
const { SlicingMode } = ImageConstants;

let demoFiles = [];
let counter = 0;
let demoFileList = getDemoFileNames();

function getDemoFileNames() {
  let demoFileList = [];
  for (let i = 1; i < 25; i++) {
    let filename = "anon" + i;
    demoFileList.push(filename);
  }
  return demoFileList;
}

async function createFile(fileName, cb) {
  let response = await fetch("./demo/" + fileName);
  let data = await response.blob();
  let file = new File([data], fileName);
  demoFiles.push(file);
  counter++;
  if (counter == demoFileList.length) {
    cb();
  }
}

// init all larvitar
larvitar.initLarvitarStore();
larvitar.initializeImageLoader();
larvitar.initializeCSTools();
larvitar.larvitar_store.addViewport("viewer");

// load dicom and render
_.each(demoFileList, function(demoFile) {
  createFile(demoFile, () => {
    renderSerieCornerstone(renderSerieVtk);
  });
});

function renderSerieCornerstone(cb) {
  larvitar.resetImageParsing();
  larvitar.readFiles(demoFiles, function(seriesStack, err) {
    // render the first series of the study
    let seriesId = _.keys(seriesStack)[0];
    let serie = seriesStack[seriesId];
    console.log(serie);
    larvitar.renderImage(serie, "viewer");
    larvitar.addDefaultTools();
    larvitar.setToolActive(larvitar.larvitar_store.state.leftMouseHandler);
    console.log(larvitar.larvitar_store);
    if (cb) {
      cb(serie);
    }
  });
}

function renderSerieVtk(serie) {
  console.log(larvitar.cornerstone.imageCache.cachedImages);
  setTimeout(() => {
    let header = larvitar.buildHeader(serie);
    // TODO load and cache
    let data = larvitar.buildData(serie, false);
    let volume = buildVtkVolume(header, data);
    console.log(volume);
    setupVtkScene(volume);
  }, 1000);
}

function buildVtkVolume(header, data) {
  console.log(header, data);
  const dims = [
    header.volume.cols,
    header.volume.rows,
    header.volume.imageIds.length
  ];
  const numScalars = dims[0] * dims[1] * dims[2];

  if (numScalars < 1 || dims[1] < 2 || dims[1] < 2 || dims[2] < 2) {
    return;
  }

  const volume = vtkImageData.newInstance();
  const origin = header.volume.imagePosition;
  const spacing = header.volume.pixelSpacing.concat(
    header.volume.sliceThickness // TODO check
  );

  console.log(origin, spacing, numScalars);

  volume.setDimensions(dims);
  volume.setOrigin(origin);
  volume.setSpacing(spacing);

  const scalars = vtkDataArray.newInstance({
    name: "Scalars",
    values: data,
    numberOfComponents: 1
  });

  volume.getPointData().setScalars(scalars);

  volume.modified();

  return volume;
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

// fit to window
function fitToWindow(genericRenderWindow, dir) {
  const bounds = genericRenderWindow.getRenderer().computeVisiblePropBounds();
  const dim = [
    (bounds[1] - bounds[0]) / 2,
    (bounds[3] - bounds[2]) / 2,
    (bounds[5] - bounds[4]) / 2
  ];
  const w = genericRenderWindow.getContainer().clientWidth;
  const h = genericRenderWindow.getContainer().clientHeight;
  const r = w / h;

  let x;
  let y;
  if (dir === "x") {
    x = dim[1];
    y = dim[2];
  } else if (dir === "y") {
    x = dim[0];
    y = dim[2];
  } else if (dir === "z") {
    x = dim[0];
    y = dim[1];
  }
  if (r >= x / y) {
    // use width
    genericRenderWindow
      .getRenderer()
      .getActiveCamera()
      .setParallelScale(y + 1);
  } else {
    // use height
    genericRenderWindow
      .getRenderer()
      .getActiveCamera()
      .setParallelScale(x / r + 1);
  }
}
