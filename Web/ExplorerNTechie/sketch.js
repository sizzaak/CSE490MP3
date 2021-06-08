  

let pHtmlMsg;
let serialOptions = { baudRate: 115200  };
let serial;
let analogVal = 0;

const MOVE_CHANCE = 0.01;
const Z_MIN = -400;
const Z_MAX = 200;
const WALL_HEIGHT = 50;

let mazeWidth;
let mazeHeight;
let vertWalls = [];
let horiWalls = [];

let oldPositionString = "99,99";

let cameraX = 0;
let cameraY = 0;
let cameraZ = 30;
let centerX = 0;
let centerY = 50;
let centerZ = 30;
let upX = 0;
let upY = 0;
let upZ = -1;

const CAM_SCALE = 2;
const CENTER_DISTANCE = 50;
const COLLISION_STRENGTH = 1;

let thetaHori = 0;
let thetaVert = 0;

let deltaTheta = 0.005;
let deltaPos = 0.05;

let dungeonWallImg;
let dungeonFloorImg;

function preload() {
  dungeonWallImg = loadImage('assets/dungeon_wall.png');
  dungeonFloorImg = loadImage('assets/dungeon_floor.jpg');
}

function setup() {
  createCanvas(1000, 1000, WEBGL);

  // Setup Web Serial using serial.js
  serial = new Serial();
  serial.on(SerialEvents.CONNECTION_OPENED, onSerialConnectionOpened);
  serial.on(SerialEvents.CONNECTION_CLOSED, onSerialConnectionClosed);
  serial.on(SerialEvents.DATA_RECEIVED, onSerialDataReceived);
  serial.on(SerialEvents.ERROR_OCCURRED, onSerialErrorOccurred);

  // If we have previously approved ports, attempt to connect with them
  serial.autoConnectAndOpenPreviouslyApprovedPort(serialOptions);

  // Add in a lil <p> element to provide messages. This is optional
  pHtmlMsg = createP("Click anywhere on this page to open the serial connection dialog");

  perspective(PI / 3.0, width / height, 1, 1000);
}

function draw() {
  background(220);
  //requestPointerLock();

  // draw floor and ceiling
  noStroke();
  push();
  texture(dungeonFloorImg);
  plane(width, height);
  translate(0, 0, WALL_HEIGHT);
  plane(width, height, 10, 10);
  pop();
  translate(-width/2, -height/2, 0);

  texture(dungeonWallImg);
  
  // draw central sphere (why? cause why not)
  push();
  translate(width / 2, height / 2);
  sphere(20);
  pop();

  // draw vertical walls
  let cellWidth = width / mazeWidth;
  let cellHeight = height / mazeHeight;
  for (let i = 0; i <= mazeWidth; i++) {
    for (let j = 0; j < mazeHeight; j++) {
      if (parseInt(vertWalls[i][j])) {
        let x = i * cellWidth;
        let y = j * cellHeight;
        push();
        translate(x, y, 0);
        translate(0, cellHeight / 2, WALL_HEIGHT / 2); // center of plane
        rotateY(radians(90));
        rotateZ(radians(90));
        plane(cellHeight, WALL_HEIGHT);
        pop();
      }
    }
  }

  for (let i = 0; i <= mazeHeight; i++) {
    for (let j = 0; j < mazeWidth; j++) {
      if (parseInt(horiWalls[i][j])) {
        let x = j * cellWidth;
        let y = i * cellHeight;
        push();
        translate(x, y, 0);
        translate(cellWidth / 2, 0, WALL_HEIGHT / 2); // center of plane
        rotateX(radians(90));
        plane(cellWidth, WALL_HEIGHT);
        pop();
      }
    }
  }

  let forwardX = centerX - cameraX;
  let forwardY = centerY - cameraY;

  if (keyIsDown(65)) { // a - left
    playerMove(forwardY * deltaPos, -forwardX * deltaPos);
  }

  if (keyIsDown(68)) { // d - right
    playerMove(-forwardY * deltaPos, forwardX * deltaPos);
  }

  if (keyIsDown(87)) { // w - forward
    playerMove(forwardX * deltaPos, forwardY * deltaPos);
  }

  if (keyIsDown(83)) { // s - backward
    playerMove(-forwardX * deltaPos, -forwardY * deltaPos);
  }

  thetaHori += movedX * deltaTheta;
  if (!(thetaVert - movedY * deltaTheta > 1.5 && movedY < 0) && !(thetaVert - movedY * deltaTheta < -1.5 && movedY > 0))
    thetaVert -= movedY * deltaTheta;

  if (serial.isOpen()) {
    let positionString = floor((cameraX + width / 2) / cellWidth) + "," + floor((cameraY + height / 2) / cellHeight);
    if (positionString != oldPositionString) {
      //console.log(positionString);
      serial.writeLine(positionString);
      oldPositionString = positionString;
    }
  }
  
  setCenter(thetaHori, thetaVert);
  camera(cameraX, cameraY, cameraZ, centerX, centerY, centerZ, upX, upY, upZ);
}

/**
 * Callback function by serial.js when there is an error on web serial
 * 
 * @param {} eventSender 
 */
 function onSerialErrorOccurred(eventSender, error) {
  console.log("onSerialErrorOccurred", error);
  pHtmlMsg.html(error);
}

/**
 * Callback function by serial.js when web serial connection is opened
 * 
 * @param {} eventSender 
 */
function onSerialConnectionOpened(eventSender) {
  console.log("onSerialConnectionOpened");
  pHtmlMsg.html("Serial connection opened successfully");
}

/**
 * Callback function by serial.js when web serial connection is closed
 * 
 * @param {} eventSender 
 */
function onSerialConnectionClosed(eventSender) {
  console.log("onSerialConnectionClosed");
  pHtmlMsg.html("onSerialConnectionClosed");
}

/**
 * Callback function serial.js when new web serial data is received
 * 
 * @param {*} eventSender 
 * @param {String} newData new data received over serial
 */
function onSerialDataReceived(eventSender, newData) {
  console.log("onSerialDataReceived", newData);
  pHtmlMsg.html("onSerialDataReceived: " + newData);
  analogVal = newData;
  let dataSplit = newData.split("/");
  console.log(dataSplit);

  if (dataSplit[0] == "MapData") {
    // find width and height
    let widthAndHeight = dataSplit[1].split(",");
    mazeWidth = widthAndHeight[0].split("=")[1];
    mazeHeight = widthAndHeight[1].split("=")[1];

    // parse walls
    vertWallsString = dataSplit[2].split(",");
    horiWallsString = dataSplit[3].split(",");
    for (let i = 0; i <= mazeWidth; i++) {
      vertWalls[i] = vertWallsString[i].split("-");
    }
    for (let i = 0; i <= mazeHeight; i++) {
      horiWalls[i] = horiWallsString[i].split("-");
    }

    console.log(mazeWidth);
    console.log(mazeHeight);
    console.log(vertWalls);
    console.log(horiWalls);
  }
}

/**
 * Called automatically by the browser through p5.js when mouse clicked
 */
function mouseClicked() {
  if (!serial.isOpen()) {
    serial.connectAndOpen(null, serialOptions);
  }
}

/**
 * Adjust camera position by the given amounts if no collision is detected
 * @param {number} xChange 
 * @param {number} yChange 
 */
function playerMove(xChange, yChange) {
  let cellWidth = width / mazeWidth;
  let cellHeight = height / mazeHeight;
  let potentialX = cameraX + xChange;
  let potentialY = cameraY + yChange;

  let newCellX = floor((width / 2 + potentialX + xChange * COLLISION_STRENGTH) / cellWidth);
  let newCellY = floor((height / 2 + potentialY + yChange * COLLISION_STRENGTH) / cellHeight);
  let oldCellX = floor((width / 2 + cameraX) / cellWidth);
  let oldCellY = floor((height / 2 + cameraY) / cellHeight);

  if (newCellX != oldCellX) { // check for vertical wall collision
    if (parseInt(vertWalls[max(oldCellX, newCellX)][oldCellY])) {
      return;
    }
  }
  if (newCellY != oldCellY) { // check for horizontal wall collision
    if (parseInt(horiWalls[max(oldCellY, newCellY)][oldCellX])) {
      return;
    }
  }

  cameraX = potentialX;
  cameraY = potentialY;
}

/**
 * Orient the camera based on given angles
 * @param {number} angleHori 
 * @param {number} angleVert 
 */
function setCenter(angleHori, angleVert) {
  centerX = cameraX + CENTER_DISTANCE * cos(angleHori) * cos(angleVert);
  centerY = cameraY + CENTER_DISTANCE * sin(angleHori) * cos(angleVert);
  centerZ = cameraZ + CENTER_DISTANCE * sin(angleVert);
}
