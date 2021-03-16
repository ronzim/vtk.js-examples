import "vtk.js/Sources/favicon";

import vtkOpenGLRenderWindow from "vtk.js/Sources/Rendering/OpenGL/RenderWindow";
import vtkResliceCursor from "vtk.js/Sources/Interaction/Widgets/ResliceCursor/ResliceCursor";
import vtkResliceCursorLineRepresentation from "vtk.js/Sources/Interaction/Widgets/ResliceCursor/ResliceCursorLineRepresentation";
import vtkResliceCursorWidget from "vtk.js/Sources/Interaction/Widgets/ResliceCursor/ResliceCursorWidget";
import vtkRenderer from "vtk.js/Sources/Rendering/Core/Renderer";
import vtkRenderWindow from "vtk.js/Sources/Rendering/Core/RenderWindow";
import vtkRenderWindowInteractor from "vtk.js/Sources/Rendering/Core/RenderWindowInteractor";

import { buildVtkVolume, loadSerieWithLarvitar } from "./utils";

loadSerieWithLarvitar(serie => {
  let _imageData = buildVtkVolume(serie);
  mpr(_imageData);
});

function mpr(imageData) {
  // Define ResliceCursor

  console.log(imageData);

  const resliceCursor = vtkResliceCursor.newInstance();
  resliceCursor.setImage(imageData);

  const renderWindows = [];
  const renderers = [];
  const GLWindows = [];
  const interactors = [];
  const resliceCursorWidgets = [];
  const resliceCursorRepresentations = [];

  for (let j = 0; j < 3; ++j) {
    const element = document.getElementById("viewer-" + (j + 2));
    console.log(element, j);

    renderWindows[j] = vtkRenderWindow.newInstance();
    renderers[j] = vtkRenderer.newInstance();
    renderers[j].getActiveCamera().setParallelProjection(true);
    renderWindows[j].addRenderer(renderers[j]);

    GLWindows[j] = vtkOpenGLRenderWindow.newInstance();
    GLWindows[j].setContainer(element);
    renderWindows[j].addView(GLWindows[j]);

    interactors[j] = vtkRenderWindowInteractor.newInstance();
    interactors[j].setView(GLWindows[j]);
    interactors[j].initialize();
    interactors[j].bindEvents(element);

    renderWindows[j].setInteractor(interactors[j]);

    resliceCursorWidgets[j] = vtkResliceCursorWidget.newInstance();
    resliceCursorRepresentations[
      j
    ] = vtkResliceCursorLineRepresentation.newInstance();
    resliceCursorWidgets[j].setWidgetRep(resliceCursorRepresentations[j]);
    resliceCursorRepresentations[j].getReslice().setInputData(imageData);
    resliceCursorRepresentations[j]
      .getCursorAlgorithm()
      .setResliceCursor(resliceCursor);

    resliceCursorWidgets[j].setInteractor(interactors[j]);
  }

  // X
  resliceCursorRepresentations[0]
    .getCursorAlgorithm()
    .setReslicePlaneNormalToXAxis();

  // Y
  resliceCursorRepresentations[1]
    .getCursorAlgorithm()
    .setReslicePlaneNormalToYAxis();

  // Z
  resliceCursorRepresentations[2]
    .getCursorAlgorithm()
    .setReslicePlaneNormalToZAxis();

  for (let k = 0; k < 3; k++) {
    resliceCursorWidgets[k].onInteractionEvent(() => {
      resliceCursorWidgets[0].render();
      resliceCursorWidgets[1].render();
      resliceCursorWidgets[2].render();
    });
    resliceCursorWidgets[k].setEnabled(true);

    renderers[k].resetCamera();
    renderWindows[k].render();
  }
}
