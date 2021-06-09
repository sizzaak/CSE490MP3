console.log('ml5 version:', ml5.version);

let pHtmlMsg;
let serialOptions = { baudRate: 115200  };
let serial;
let analogVal = 0;

const MOVE_CHANCE = 0.01;
const Z_MIN = -400;
const Z_MAX = 200;
const WALL_HEIGHT = 50;

const PUZZLE_COUNT = 3;

let mazeWidth;
let mazeHeight;
let vertWalls = [];
let horiWalls = [];
let cellWidth;
let cellHeight;

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
let againstRockImg, againstPaperImg, againstScissorsImg;
let correctGreyImg, correctGreenImg, completeImg;


let predictions = [];
let video;

let handpose;

let puzzles = [];

function preload() {
  dungeonWallImg = loadImage('assets/dungeon_wall.png');
  dungeonFloorImg = loadImage('assets/dungeon_floor.jpg');
  againstRockImg = loadImage('assets/against_rock.png');
  againstPaperImg = loadImage('assets/against_paper.png');
  againstScissorsImg = loadImage('assets/against_scissors.png');
  correctGreyImg = loadImage('assets/correct_grey.png');
  correctGreenImg = loadImage('assets/correct_green.png');
  completeImg = loadImage('assets/complete.png');
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

  for (let i = 0; i < PUZZLE_COUNT; i++) {
    puzzles[i] = {row: 6, column: 6, direction: "up", state: "rock", leftToBeat: 1};
  }
  puzzles[0] = {row: 8, column: 6, direction: "down", state: "rock", leftToBeat: 1};
  puzzles[1] = {row: 6, column: 6, direction: "left", state: "paper", leftToBeat: 1};
  puzzles[2] = {row: 6, column: 8, direction: "right", state: "scissors", leftToBeat: 1};

  perspective(PI / 3.0, width / height, 1, 1000);

  video = createCapture(VIDEO);
  handpose = ml5.handpose(video, modelLoaded);

  handpose.on('predict', results => {
    predictions = results;
  });
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

  drawPuzzle(puzzles[0]);
  drawPuzzle(puzzles[1]);
  drawPuzzle(puzzles[2]);
  
  // draw central sphere (why? cause why not)
  push();
  texture(againstRockImg);
  translate(width / 2, height / 2, WALL_HEIGHT / 2);
  box(cellWidth / 4, cellWidth / 10, WALL_HEIGHT / 2);
  pop();

  // draw vertical walls
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

  let playerCellX = floor((cameraX + width / 2) / cellWidth);
  let playerCellY = floor((cameraY + height / 2) / cellHeight);
  if (serial.isOpen()) {
    let positionString = playerCellX + "," + playerCellY;
    if (positionString != oldPositionString) {
      //console.log(positionString);
      serial.writeLine(positionString);
      oldPositionString = positionString;
    }
  }
  
  setCenter(thetaHori, thetaVert);

  let currentPose = "No pose";
  if (predictions.length > 0) {
    let annotations = predictions[0]["annotations"];
    let thumbtip = annotations["thumb"][3];
    let palmbase = annotations["palmBase"][0];
    let pointertip = annotations["indexFinger"][3];
    let middletip = annotations["middleFinger"][3];
    let ringtip = annotations["ringFinger"][3];
    let pinkytip = annotations["pinky"][3];
    let pointerknuckle = annotations["indexFinger"][0];
    let middleknuckle = annotations["middleFinger"][0];
    let ringknuckle = annotations["ringFinger"][0];
    let pinkyknuckle = annotations["pinky"][0];
    
    let ispointerextended = (distance3d(pointertip, palmbase) > 1.2 * distance3d(pointerknuckle, palmbase));
    let ismiddleextended = (distance3d(middletip, palmbase) > 1.2 * distance3d(middleknuckle, palmbase));
    let isringextended = (distance3d(ringtip, palmbase) > 1.2 * distance3d(ringknuckle, palmbase));
    let ispinkyextended = (distance3d(pinkytip, palmbase) > 1.2 * distance3d(pinkyknuckle, palmbase));
    console.log(ispointerextended + " " + ismiddleextended + " " + isringextended + " " + ispinkyextended);
    
    if (ispointerextended && ismiddleextended && !isringextended && !ispinkyextended) {
      currentPose = "Scissors!";
    } else if (ispointerextended && ismiddleextended && isringextended && ispinkyextended) {
      currentPose = "Paper!";
    } else if (!ispointerextended && !ismiddleextended && !isringextended && !ispinkyextended) {
      currentPose = "Rock!";
    }
    
  }
  if (frameCount % 100 == 0) {
    console.log(currentPose);
  }
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

    cellWidth = width / mazeWidth;
    cellHeight = height / mazeHeight;

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

function drawPuzzle(puzzle) {
  push();
  if (puzzle.state == "rock") {
    texture(againstRockImg);
  } else if (puzzle.state == "scissors") {
    texture (againstScissorsImg);
  } else if (puzzle.state == "paper") {
    texture (againstPaperImg);
  }

  translate(puzzle.column * cellWidth + cellWidth / 2, puzzle.row * cellHeight + cellHeight / 2, WALL_HEIGHT / 2);
  if (puzzle.direction == "up") {
    translate(0, -cellHeight / 2 + cellHeight / 20 + 1, 0);
    rotateY(radians(90));
    box(WALL_HEIGHT / 2, cellHeight / 10, cellHeight / 4);
  } else if (puzzle.direction == "down") {
    translate(0, cellHeight / 2 - cellHeight / 20 - 1, 0);
    rotateY(radians(180));
    box(cellHeight / 4, cellHeight / 10, WALL_HEIGHT / 2);
  } else if (puzzle.direction == "left") {
    translate(-cellWidth / 2 + cellWidth / 20 + 1, 0, 0);
    rotateX(radians(180));
    box(cellWidth / 10, cellWidth / 4, WALL_HEIGHT / 2);
  } else if (puzzle.direction == "right") {
    translate(cellWidth / 2 - cellWidth / 20 - 1, 0, 0);
    rotateX(radians(270));
    box(cellWidth / 10, WALL_HEIGHT / 2, cellWidth / 4);
  }
  pop();
}

function distance3d(point1, point2) {
  distance = sqrt(sq(point2[0] - point1[0]) + sq(point2[1] - point1[1]) + sq(point2[2] - point1[2]));
  return distance;
}

function modelLoaded() {
  console.log('Model Loaded!');
}