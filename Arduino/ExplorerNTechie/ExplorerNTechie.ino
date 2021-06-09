// The following OLED setup taken from the ssd1306_128x64_i2c library example
// --------------------------------------------------------------------------
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <PushButton.h>

#define SCREEN_WIDTH 128 // OLED display width, in pixels
#define SCREEN_HEIGHT 64 // OLED display height, in pixels

// Declaration for an SSD1306 display connected to I2C (SDA, SCL pins)
// The pins for I2C are defined by the Wire-library. 
// On an arduino UNO:       A4(SDA), A5(SCL)
// On an arduino MEGA 2560: 20(SDA), 21(SCL)
// On an arduino LEONARDO:   2(SDA),  3(SCL), ...
#define OLED_RESET     4 // Reset pin # (or -1 if sharing Arduino reset pin)
#define SCREEN_ADDRESS 0x3D ///< See datasheet for Address; 0x3D for 128x64, 0x3C for 128x32
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
// ---------------

const int BUTTON_PIN = 10;

// Maze constants
const int MAZE_WIDTH = 15;
const int MAZE_HEIGHT = 15;
const int MAZE_X_CENTER = MAZE_WIDTH / 2;
const int MAZE_Y_CENTER = MAZE_HEIGHT / 2;
const int MAZE_LEFT = (SCREEN_WIDTH / 2) - (SCREEN_HEIGHT / 2);
const int MAZE_RIGHT = (SCREEN_WIDTH / 2) + (SCREEN_HEIGHT / 2);
const int MAZE_TOP = 0;
const int MAZE_BOTTOM = SCREEN_HEIGHT;
const int CELL_WIDTH = (MAZE_RIGHT - MAZE_LEFT) / MAZE_WIDTH;
const int CELL_HEIGHT = (MAZE_BOTTOM - MAZE_TOP) / MAZE_HEIGHT;

const int PUZZLE_COUNT = 3;

PushButton button(BUTTON_PIN);

bool vertWalls[MAZE_WIDTH+1][MAZE_HEIGHT];
bool horiWalls[MAZE_HEIGHT+1][MAZE_WIDTH];

int playerX = MAZE_WIDTH / 2;
int playerY = MAZE_HEIGHT / 2;

int nextPuzzleId = 0;
int puzzleX[PUZZLE_COUNT], puzzleY[PUZZLE_COUNT], puzzleDir[PUZZLE_COUNT], puzzleClear[PUZZLE_COUNT];

long startMillis;

void setup() {
  // The following OLED setup taken from the ssd1306_128x64_i2c library example
  // --------------------------------------------------------------------------
  Serial.begin(9600);
  //while (!Serial);
  
  // SSD1306_SWITCHCAPVCC = generate display voltage from 3.3V internally
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("SSD1306 allocation failed"));
    for(;;); // Don't proceed, loop forever
  }
  // --------------------------------------------------------------------------
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  randomSeed(analogRead(1));
  resetGame();
}

void loop() {
  display.clearDisplay();
  button.update();
  drawMaze();
  updatePlayerPosition();
  drawPlayer();
  int clears = 0;
  for (int i = 0; i < PUZZLE_COUNT; i++) {
    if (puzzleClear[i] == 0) {
      drawPuzzle(puzzleX[i], puzzleY[i], puzzleDir[i]);
    } else {
      clears++;
    }
  }
  if (clears == 3 && (millis() - startMillis > 1000)) {
    victory();
  }
  drawTime();
  display.display();
  delay(10);
}

void resetGame() {
  int16_t x1, y1, x2, y2;
  uint16_t textWidth1, textHeight1, textWidth2, textHeight2;
  char title1[] = "EXPLORER";
  char title2[] = "& TECHIE";
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE, SSD1306_BLACK);
  display.getTextBounds(title1, 0, 0, &x1, &y1, &textWidth1, &textHeight1);
  display.getTextBounds(title2, 0, 0, &x2, &y2, &textWidth2, &textHeight2);
  display.setCursor(SCREEN_WIDTH / 2 - textWidth2 / 2, SCREEN_HEIGHT / 2 - textHeight2 / 2);
  display.print(title2);
  display.setCursor(SCREEN_WIDTH / 2 - textWidth1 / 2, SCREEN_HEIGHT / 2 - textHeight2 / 2 - textHeight1);
  display.println(title1);

  char begin[] = "Press button to start";
  display.setTextSize(1);
  display.getTextBounds(begin, 0, 0, &x1, &y1, &textWidth1, &textHeight1);
  display.setCursor(SCREEN_WIDTH / 2 - textWidth1 / 2, 7 * SCREEN_HEIGHT / 8 - textHeight1 / 2);
  display.println(begin);
  display.display();
  while (!button.isClicked()) {
    button.update();
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE, SSD1306_BLACK);
  display.setCursor(0,0);
  display.println("Generating maze...");
  display.display();
  generateMaze();
  int emptyQuad = random(0,4);
  int id = 0;
  for (int i = 0; i < PUZZLE_COUNT + 1; i++) {
    if (i != emptyQuad) {
      puzzleClear[id] = 0;
      initializePuzzle(id, i+1);
      id++;
    }
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE, SSD1306_BLACK);
  display.setCursor(0,0);
  display.println("Waiting for serial connection...");
  display.display();
  while (!Serial);
  sendMaze();

  startMillis = millis();
}

void victory() {
  int16_t x1, y1, x2, y2;
  uint16_t textWidth1, textHeight1, textWidth2, textHeight2;
  char title1[] = "VICTORY!";
  char title2[] = "Time 00:00";
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE, SSD1306_BLACK);
  display.getTextBounds(title1, 0, 0, &x1, &y1, &textWidth1, &textHeight1);
  display.getTextBounds(title2, 0, 0, &x2, &y2, &textWidth2, &textHeight2);
  display.setCursor(SCREEN_WIDTH / 2 - textWidth2 / 2, SCREEN_HEIGHT / 2 - textHeight2 / 2);
  display.print("Time ");
  printTime();
  display.setCursor(SCREEN_WIDTH / 2 - textWidth1 / 2, SCREEN_HEIGHT / 2 - textHeight2 / 2 - textHeight1);
  display.println(title1);

  char restart[] = "Press to return";
  display.setTextSize(1);
  display.getTextBounds(restart, 0, 0, &x1, &y1, &textWidth1, &textHeight1);
  display.setCursor(SCREEN_WIDTH / 2 - textWidth1 / 2, 7 * SCREEN_HEIGHT / 8 - textHeight1 / 2);
  display.println(restart);
  display.display();
  while (!button.isClicked()) {
    button.update();
  }
  button.update();
  resetGame();
}

void generateMaze() {
  // clear out maze
  for (int i = 0; i <= MAZE_WIDTH; i++) {
    for (int j = 0; j < MAZE_HEIGHT; j++) {
      vertWalls[i][j] = false;
    }
  }
  for (int i = 0; i <= MAZE_HEIGHT; i++) {
    for (int j = 0; j < MAZE_WIDTH; j++) {
      horiWalls[i][j] = false;
    }
  }
  
  // add all border walls
  for (int i = 0; i < MAZE_WIDTH; i++) {
    horiWalls[0][i] = true;
    horiWalls[MAZE_HEIGHT][i] = true;
  }
  for (int i = 0; i < MAZE_HEIGHT; i++) {
    vertWalls[0][i] = true;
    vertWalls[MAZE_WIDTH][i] = true;
  }

  // add center walls
  vertWalls[MAZE_X_CENTER - 1][MAZE_Y_CENTER - 1] = true;
  vertWalls[MAZE_X_CENTER - 1][MAZE_Y_CENTER + 1] = true;
  vertWalls[MAZE_X_CENTER + 2][MAZE_Y_CENTER - 1] = true;
  vertWalls[MAZE_X_CENTER + 2][MAZE_Y_CENTER + 1] = true;
  horiWalls[MAZE_Y_CENTER - 1][MAZE_X_CENTER - 1] = true;
  horiWalls[MAZE_Y_CENTER - 1][MAZE_X_CENTER + 1] = true;
  horiWalls[MAZE_Y_CENTER + 2][MAZE_X_CENTER - 1] = true;
  horiWalls[MAZE_Y_CENTER + 2][MAZE_X_CENTER + 1] = true;

  // add one random wall at each vertex
  for (int i = 1; i < MAZE_WIDTH; i++) {
    for (int j = 1; j < MAZE_HEIGHT; j++) {
      bool valid = false;
      bool vert;
      int row;
      int segment;
      int counter = 0; // avoid infinite loop if no valid wall placement
      while (!valid && counter < 20) {
        int dir = random(4);
        switch(dir) {
          case 0:
            vert = true;
            row = i;
            segment = j-1;
            break;
          case 1:
            vert = true;
            row = i;
            segment = j;
            break;
          case 2:
            vert = false;
            row = j;
            segment = i-1;
            break;
          case 3:
            vert = false;
            row = j;
            segment = i;
            break;
        }
        valid = wallValid(vert, row, segment);
        counter++;
      }
      if (counter == 20) {
        continue;
      }
      if (vert) {
        vertWalls[row][segment] = true;
      } else {
        horiWalls[row][segment] = true;
      }
    }
  }

  // leave spaces in center
  vertWalls[MAZE_X_CENTER - 1][MAZE_Y_CENTER] = false;
  vertWalls[MAZE_X_CENTER + 0][MAZE_Y_CENTER] = false;
  vertWalls[MAZE_X_CENTER + 1][MAZE_Y_CENTER] = false;
  vertWalls[MAZE_X_CENTER + 2][MAZE_Y_CENTER] = false;
  horiWalls[MAZE_Y_CENTER - 1][MAZE_X_CENTER] = false;
  horiWalls[MAZE_Y_CENTER + 0][MAZE_X_CENTER] = false;
  horiWalls[MAZE_Y_CENTER + 1][MAZE_X_CENTER] = false;
  horiWalls[MAZE_Y_CENTER + 2][MAZE_X_CENTER] = false;
}

void sendMaze() {
  Serial.print("MapData/WIDTH=");
  Serial.print(MAZE_WIDTH);
  Serial.print(",HEIGHT=");
  Serial.print(MAZE_HEIGHT);
  Serial.print("/");
  for (int i = 0; i <= MAZE_WIDTH; i++) {
    for (int j = 0; j < MAZE_HEIGHT; j++) {
      Serial.print(vertWalls[i][j]);
      if (j != MAZE_HEIGHT - 1) {
        Serial.print("-");
      }
    }
    if (i != MAZE_WIDTH) {
      Serial.print(",");
    }
  }
  Serial.print("/");
  for (int i = 0; i <= MAZE_HEIGHT; i++) {
    for (int j = 0; j < MAZE_WIDTH; j++) {
      Serial.print(horiWalls[i][j]);
      if (j != MAZE_WIDTH - 1) {
        Serial.print("-");
      }
    }
    if (i != MAZE_HEIGHT) {
      Serial.print(",");
    }
  }
  Serial.print("/");
  for (int i = 0; i < PUZZLE_COUNT; i++) {
    Serial.print(puzzleX[i]);
    Serial.print("-");
    Serial.print(puzzleY[i]);
    Serial.print("-");
    Serial.print(puzzleDir[i]);
    if (i != PUZZLE_COUNT - 1) {
      Serial.print(",");
    }
  }
  Serial.println();
}

void drawMaze() {
  // draw vertical walls
  for (int i = 0; i <= MAZE_WIDTH; i++) {
    for (int j = 0; j < MAZE_HEIGHT; j++) {
      if (vertWalls[i][j]) {
        int x = MAZE_LEFT + i * CELL_WIDTH;
        int y = MAZE_TOP + j * CELL_HEIGHT;
        display.drawFastVLine(x, y, CELL_HEIGHT+1, SSD1306_WHITE);
      }
    }
  }
  // draw horizontal walls
  for (int i = 0; i <= MAZE_HEIGHT; i++) {
    for (int j = 0; j < MAZE_WIDTH; j++) {
      if (horiWalls[i][j]) {
        int x = MAZE_LEFT + j * CELL_WIDTH;
        int y = MAZE_TOP + i * CELL_HEIGHT;
        display.drawFastHLine(x, y, CELL_WIDTH+1, SSD1306_WHITE);
      }
    }
  }
}

void updatePlayerPosition() {
  if (Serial.available() > 0) {
    String rcvdSerialData = Serial.readStringUntil('\n');

    // Convert to c string and use sscanf to parse values in format x,y
    char rcvdCstring[rcvdSerialData.length() + 1];
    strcpy(rcvdCstring, rcvdSerialData.c_str());
    int x, y, pc0, pc1, pc2;
    sscanf(rcvdCstring, "%d,%d,%d,%d,%d", &x,&y, &pc0, &pc1, &pc2);
    playerX = x;
    playerY = y;
    puzzleClear[0] = pc0;
    puzzleClear[1] = pc1;
    puzzleClear[2] = pc2;
  }
}

void drawPlayer() {
  int x = MAZE_LEFT + playerX * CELL_WIDTH;
  int y = MAZE_TOP + playerY * CELL_HEIGHT;
  display.fillCircle(x + CELL_WIDTH / 2, y + CELL_HEIGHT / 2, 1, SSD1306_WHITE);
}

// quad - quadrant, 1-4 starting in topleft and going clockwise
void initializePuzzle(int id, int quad) {
  if (quad == 1 || quad == 4) {
    puzzleX[id] = random(0, MAZE_WIDTH / 2 - 1);
  } else {
    puzzleX[id] = random(MAZE_WIDTH / 2 + 1, MAZE_WIDTH);
  }
  if (quad == 1 || quad == 2) {
    puzzleY[id] = random(0, MAZE_HEIGHT / 2 - 1);
  } else {
    puzzleY[id] = random(MAZE_HEIGHT / 2 + 1, MAZE_HEIGHT);
  }
  
  int dir;
  bool valid = false;
  while (!valid) {
    dir = random(1, 5);
    if (dir == 1) { // check above wall exists
      valid = horiWalls[puzzleY[id]][puzzleX[id]];
    } else if (dir == 2) { // check right wall exists
      valid = vertWalls[puzzleX[id] + 1][puzzleY[id]];
    } else if (dir == 3) { // check below wall exists
      valid = horiWalls[puzzleY[id] + 1][puzzleX[id]];
    } else if (dir == 4) { // check left wall exists
      valid = vertWalls[puzzleX[id]][puzzleY[id]];
    }
  }
  puzzleDir[id] = dir;
}

void drawPuzzle(int xCell, int yCell, int direction) {
  // direction: 1 - up, 2 - right, 3 - down, 4 - left
  if (millis() % 1000 < 500) {
    int x = MAZE_LEFT + xCell * CELL_WIDTH;
    int y = MAZE_TOP + yCell * CELL_HEIGHT;
    if (direction == 1) {
      display.fillRect(x, y, CELL_WIDTH, CELL_HEIGHT / 2, SSD1306_WHITE);
    } else if (direction == 2) {
      display.fillRect(x + CELL_WIDTH / 2, y, CELL_WIDTH / 2, CELL_HEIGHT, SSD1306_WHITE);
    } else if (direction == 3) {
      display.fillRect(x, y + CELL_HEIGHT / 2, CELL_WIDTH, CELL_HEIGHT / 2, SSD1306_WHITE);
    } else if (direction == 4) {
      display.fillRect(x, y, CELL_WIDTH / 2, CELL_HEIGHT, SSD1306_WHITE);
    }
  }
}

void drawTime() {
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE, SSD1306_BLACK);
  display.setCursor(0,0);
  display.println("Time:");
  printTime();
}

void printTime() {
  long currentMillis = millis() - startMillis;
  long totalSeconds = currentMillis / 1000;
  int seconds = totalSeconds % 60;
  int minutes = totalSeconds / 60;
  if (minutes < 10) {
    display.print(0);
  }
  display.print(minutes);
  display.print(":");
  if (seconds < 10) {
    display.print(0);
  }
  display.println(seconds);
}

// The wall is valid if and only if it does not make either bordering cell surrounded by
// more than 2 walls, thus creating a dead end
bool wallValid(bool vert, int row, int segment) {
  if (vert) {
    int n = 0;

    // count left side walls
    if (vertWalls[row - 1][segment])
      n++;
    if (horiWalls[segment][row - 1])
      n++;
    if (horiWalls[segment + 1][row - 1])
      n++;
    if (n > 1)
      return false;

    n = 0;
    // count right side walls
    if (vertWalls[row + 1][segment])
      n++;
    if (horiWalls[segment][row])
      n++;
    if (horiWalls[segment + 1][row])
      n++;
    if (n > 1)
      return false;
  } else {
    int n = 0;

    // count above walls
    if (horiWalls[row - 1][segment])
      n++;
    if (vertWalls[segment][row - 1])
      n++;
    if (vertWalls[segment + 1][row - 1])
      n++;
    if (n > 1)
      return false;
    
    n = 0;
    // count below walls
    if (horiWalls[row + 1][segment])
      n++;
    if (vertWalls[segment][row])
      n++;
    if (vertWalls[segment + 1][row])
      n++;
    if (n > 1)
      return false;
  }
  return true;
}
