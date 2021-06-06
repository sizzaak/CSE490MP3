// The following OLED setup taken from the ssd1306_128x64_i2c library example
// --------------------------------------------------------------------------
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

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

const int MAZE_WIDTH = 19;
const int MAZE_HEIGHT = 19;
const int MAZE_X_CENTER = MAZE_WIDTH / 2;
const int MAZE_Y_CENTER = MAZE_HEIGHT / 2;

const int MAZE_LEFT = (SCREEN_WIDTH / 2) - (SCREEN_HEIGHT / 2);
const int MAZE_RIGHT = (SCREEN_WIDTH / 2) + (SCREEN_HEIGHT / 2);
const int MAZE_TOP = 0;
const int MAZE_BOTTOM = SCREEN_HEIGHT;
const int CELL_WIDTH = (MAZE_RIGHT - MAZE_LEFT) / MAZE_WIDTH;
const int CELL_HEIGHT = (MAZE_BOTTOM - MAZE_TOP) / MAZE_HEIGHT;

bool vertWalls[MAZE_WIDTH+1][MAZE_HEIGHT];
bool horiWalls[MAZE_HEIGHT+1][MAZE_WIDTH];

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
  randomSeed(analogRead(1));
  generateMaze();
}

void loop() {
  display.clearDisplay();
  drawMaze();
  display.display();
}

void generateMaze() {
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
