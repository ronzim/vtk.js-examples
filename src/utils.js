import vtkDataArray from "vtk.js/Sources/Common/Core/DataArray";
import vtkImageData from "vtk.js/Sources/Common/DataModel/ImageData";

export function buildVtkVolume(serie) {
  // TODO load and cache
  //   setTimeout(() => {
  let header = larvitar.buildHeader(serie);
  let data = larvitar.buildData(serie, false);

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
  //   }, 2000);
}

// fit to window
export function fitToWindow(genericRenderWindow, dir) {
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

export function loadSerieWithLarvitar(cb) {
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
      larvitar.resetImageParsing();
      larvitar.readFiles(demoFiles, function(seriesStack, err) {
        // return the first series of the study
        let seriesId = _.keys(seriesStack)[0];
        let serie = seriesStack[seriesId];

        // hack to avoid load and cache (render + timeout)
        larvitar.renderImage(serie, "viewer");
        if (cb) {
          setTimeout(cb, 2000, serie);
        }
      });
    });
  });
}
