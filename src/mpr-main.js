/**
 * MPR LIBRARY LOGIC
 * - init(data, elements) -> data is the mpr state (as data object below), elements are target HTMLelements
 * - update(data) -> function to call when an event is emitted (on rotate or thickness change)
 *
 */

// ======================================
// Import just functions from our lib ===
// ======================================

import { onRotate, onThickness, initMPR } from "./mprManager";
import { buildVtkVolume, loadSerieWithLarvitar } from "./utils";

// ======================================
// Define viewports and global state ====
// ======================================

let global_data = {
  sliceIntersection: [0, 0, 0],
  syncWindowLevels: true,
  volumes: [],
  views: {
    top: {
      key: "top",
      element: document.getElementById("viewer-2"),
      color: "#F8B42C",
      slicePlaneNormal: [0, 0, 1],
      sliceViewUp: [0, -1, 0],
      slicePlaneXRotation: 0,
      slicePlaneYRotation: 0,
      viewRotation: 0,
      sliceThickness: 0.1,
      blendMode: "MIP",
      window: {
        width: 0,
        center: 0
      }
    },
    left: {
      key: "left",
      element: document.getElementById("viewer-3"),
      color: "#A62CF8",
      slicePlaneNormal: [1, 0, 0],
      sliceViewUp: [0, 0, -1],
      slicePlaneXRotation: 0,
      slicePlaneYRotation: 0,
      viewRotation: 0,
      sliceThickness: 0.1,
      blendMode: "MIP",
      window: {
        width: 0,
        center: 0
      }
    },
    front: {
      key: "front",
      element: document.getElementById("viewer-4"),
      color: "#2C92F8",
      slicePlaneNormal: [0, -1, 0],
      sliceViewUp: [0, 0, -1],
      slicePlaneXRotation: 0,
      slicePlaneYRotation: 0,
      viewRotation: 0,
      sliceThickness: 0.1,
      blendMode: "MIP",
      window: {
        width: 0,
        center: 0
      }
    }
  }
};

// ================================
//        *** START ALL ***
// ================================

loadSerieWithLarvitar(serie => {
  // build vtk volume with larvitar
  const image = buildVtkVolume(serie);
  // run mpr
  initMPR(global_data, image);
});

// =======================================
// TESTING EVENTS ========================
// Q,W,E,R,T,Y rotate 10 deg clockwise ===
// + shift rotate 10 deg ccw =============
// any other key reset views =============
// =======================================

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
    onRotate(key, axis, angle, global_data);
    stateUI[key][axis] = angle;
  } else {
    // RESET
    onRotate("top", "x", 0, global_data);
    onRotate("top", "y", 0, global_data);
    onRotate("left", "x", 0, global_data);
    onRotate("left", "y", 0, global_data);
    onRotate("front", "x", 0, global_data);
    onRotate("front", "y", 0, global_data);
    stateUI.top.x = 0;
    stateUI.top.y = 0;
    stateUI.left.x = 0;
    stateUI.left.y = 0;
    stateUI.front.x = 0;
    stateUI.front.y = 0;
  }
  console.log("resuting global_data", global_data);
});

window.onRotate = onRotate;
window.onThickness = (a, b, c) => onThickness(a, b, c, global_data);
