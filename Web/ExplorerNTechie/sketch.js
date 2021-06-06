  
// This is a basic web serial template for p5.js. Please see:
// https://makeabilitylab.github.io/physcomp/communication/p5js-serial
// 
// By Jon E. Froehlich
// @jonfroehlich
// http://makeabilitylab.io/
//


let pHtmlMsg;
let serialOptions = { baudRate: 115200  };
let serial;
let analogVal = 0;

let boxesPos = [];
const BOXES_COUNT = 10;
const MOVE_CHANCE = 0.01;
const Z_MIN = -400;
const Z_MAX = 200;
const WALL_HEIGHT = 100;

let mazeWidth;
let mazeHeight;
let vertWalls = [];
let horiWalls = [];

let playerX;
let playerY;
let oldPositionString = "99,99";

function setup() {
  createCanvas(400, 400, WEBGL);

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

  // Setup random positions for boxes
  for (var i = 0; i < BOXES_COUNT; i++) {
    x = random(-width / 2, width / 2);
    y = random(-height / 2, height / 2);
    z = random(Z_MIN, Z_MAX);
    boxesPos[i] = {x: x, y: y, z: z};
  }

  playerX = width / 2;
  playerY = height / 2;
}

function draw() {
  background(220);
  translate(-width/2, -height/2, 0);
  
  // draw the player (TEMPORARY)
  push();
  translate(playerX, playerY);
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
        plane(WALL_HEIGHT, cellHeight);
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

  if (keyIsDown(65)) { // a
    playerX -= 5;
  }

  if (keyIsDown(68)) { // d
    playerX += 5;
  }

  if (keyIsDown(87)) { // w
    playerY -= 5;
  }

  if (keyIsDown(83)) { // s
    playerY += 5;
  }

  if (serial.isOpen()) {
    let positionString = floor(playerX / cellWidth) + "," + floor(playerY / cellHeight)
    if (positionString != oldPositionString) {
      console.log(positionString);
      serial.writeLine(positionString);
      oldPositionString = positionString;
    }
  }
  /*
  // draw horizontal walls
  for (let i = 0; i <= mazeHeight; i++) {
    for (let j = 0; j < mazeWidth; j++) {
      if (horiWalls[i][j]) {
        let x = MAZE_LEFT + j * CELL_WIDTH;
        let y = MAZE_TOP + i * cellHeight;
        display.drawFastHLine(x, y, CELL_WIDTH+1, SSD1306_WHITE);
      }
    }
  }
  */

  // Set camera z position based on arduino input
  //let zpos = map(analogVal, 0, 1, 500, 50);
  camera(0, 0, 500);
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
