/**
 * MPR LIBRARY LOGIC
 * - init(data, elements) -> data is the mpr state (as data object below), elements are target HTMLelements
 * - update(data) -> function to call when an event is emitted (on rotate or thickness change)
 *
 */

// ======================================
// Import just functions from our lib ===
// ======================================

import { MPRManager } from "./mprManager";
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

const targetElements = {
  top: {
    element: document.getElementById("viewer-2"),
    key: "top",
    height: 0, // ?
    width: 0 // ?
  },
  left: {
    element: document.getElementById("viewer-3"),
    key: "left"
  },
  front: {
    element: document.getElementById("viewer-4"),
    key: "front"
  }
};

// ================================
//        *** START ALL ***
// ================================

loadSerieWithLarvitar(serie => {
  // build vtk volume with larvitar
  const image = buildVtkVolume(serie);
  // run mpr
  let mpr = new MPRManager(targetElements, global_data);
  mpr.setImage(global_data, image);
  mpr.setTool("crosshair", global_data);
  // add keyoboard events to interact with mpr
  addEvents(mpr);
});

// =======================================
// TESTING EVENTS ========================
// Q,W,E,R,T,Y rotate 10 deg clockwise ===
// + shift rotate 10 deg ccw =============
// any other key reset views =============
// =======================================

function addEvents(mpr) {
  let stateUI = {
    top: { angle: { x: 0, y: 0 }, dist: 0 },
    left: { angle: { x: 0, y: 0 }, dist: 0 },
    front: { angle: { x: 0, y: 0 }, dist: 0 }
  };

  document.addEventListener("keypress", e => {
    console.log(e);
    let key, axis, action;

    switch (e.code) {
      case "KeyQ":
        action = "rotate";
        key = "top";
        axis = "x";
        break;
      case "KeyW":
        action = "rotate";
        key = "top";
        axis = "y";
        break;
      case "KeyE":
        action = "rotate";
        key = "left";
        axis = "x";
        break;
      case "KeyR":
        action = "rotate";
        key = "left";
        axis = "y";
        break;
      case "KeyT":
        action = "rotate";
        key = "front";
        axis = "x";
        break;
      case "KeyY":
        action = "rotate";
        key = "front";
        axis = "y";
        break;
      case "KeyA":
        action = "thickness";
        key = "top";
        axis = "x";
        break;
      case "KeyS":
        action = "thickness";
        key = "top";
        axis = "y";
        break;
      case "KeyD":
        action = "thickness";
        key = "left";
        axis = "x";
        break;
      case "KeyF":
        action = "thickness";
        key = "left";
        axis = "y";
        break;
      case "KeyG":
        action = "thickness";
        key = "front";
        axis = "x";
        break;
      case "KeyH":
        action = "thickness";
        key = "front";
        axis = "y";
        break;
    }

    if (key && axis && action == "rotate") {
      // MOVE BY +/- 10 deg
      let oldAngle = stateUI[key].angle[axis];
      let angle = e.shiftKey ? oldAngle - 10 : oldAngle + 10;
      console.log(key, axis, oldAngle, angle);
      mpr.onRotate(key, axis, angle, global_data);
      stateUI[key].angle[axis] = angle;
    } else if (key && axis && action == "thickness") {
      // MOVE BY +/- 10 px
      let oldDist = stateUI[key].dist;
      let dist = e.shiftKey ? oldDist - 10 : oldDist + 10;
      console.log(key, axis, oldDist, dist);
      mpr.onThickness(key, axis, dist, global_data);
      stateUI[key].dist = dist;
    } else {
      // RESET
      mpr.onRotate("top", "x", 0, global_data);
      mpr.onThickness("top", "x", 0, global_data);
      mpr.onRotate("top", "y", 0, global_data);
      mpr.onThickness("top", "y", 0, global_data);
      mpr.onRotate("left", "x", 0, global_data);
      mpr.onThickness("left", "x", 0, global_data);
      mpr.onRotate("left", "y", 0, global_data);
      mpr.onThickness("left", "y", 0, global_data);
      mpr.onRotate("front", "x", 0, global_data);
      mpr.onThickness("front", "x", 0, global_data);
      mpr.onRotate("front", "y", 0, global_data);
      mpr.onThickness("front", "y", 0, global_data);
      stateUI.top.angle.x = 0;
      stateUI.top.thickness.x = 0;
      stateUI.top.angle.y = 0;
      stateUI.top.thickness.y = 0;
      stateUI.left.angle.x = 0;
      stateUI.left.thickness.x = 0;
      stateUI.left.angle.y = 0;
      stateUI.left.thickness.y = 0;
      stateUI.front.angle.x = 0;
      stateUI.front.thickness.x = 0;
      stateUI.front.angle.y = 0;
      stateUI.front.thickness.y = 0;
    }
    console.log("resuting global_data", global_data);
  });
}
