#include <MadgwickAHRS.h>
#include <ArduinoBLE.h>
#include "LSM6DS3.h"
#include "Wire.h"

// Create a instance of class LSM6DS3
LSM6DS3 myIMU(I2C_MODE, 0x6A);

// initialize a Madgwick filter:
Madgwick filter;
const float sensorRate = 20.00;

unsigned long microsPerReading, microsPrevious;
// values for orientation:
float roll = 0.0;
float pitch = 0.0;
float heading = 0.0;
float towerHeading = 0.0;
int towerAngle = 0;
float northHeading = 0.0;
float headingDiff = 0.0;
bool isCalibrated = false;
float gyroShiftX = 0.0;
float gyroShiftY = 0.0;
float gyroShiftZ = 0.0;
int sampleNum = 300;
int vibrationPin = D10;

// ===== Direction detection settings =====
// diffAngle: The angle threshold to consider user facing "correct" direction
// If headingDiff <= diffAngle, the direction is considered correct
float diffAngle = 15.0;

// ===== Angular offset settings (adds path wandering) =====
// Instead of pointing exactly at target, we add a random offset
// This makes the "correct" direction drift, creating a meandering path
bool isHeadingShiftEnabled = true;
float headingShiftRange = 150.0;     // Normal offset range: -150° to +150°
float headingShiftAmount = 0.0;     // Current offset, regenerated after each vibration

// Timer control variables
// To set a timer beween available vibrations
bool isTimerEnabled = true;
unsigned long lastVibrationTime = 0;
unsigned long randomInterval = 0;
const unsigned long MIN_INTERVAL = 10000;   // Minimum interval between vibration checks (ms)
const unsigned long MAX_INTERVAL = 30000;   // Maximum interval between vibration checks (ms)

// State tracking for "waiting for correct direction" mode
bool isWaitingForCorrectDirection = false;

// ===== Target persistence settings =====
// Each target direction requires multiple vibrations before generating a new one
int vibrationCountForCurrentTarget = 0;       // How many times current target has been reached
const int VIBRATIONS_PER_TARGET = 2;          // Vibrations needed before new target
bool isFirstTarget = true;                    // First target is fully random (0-360°)

// ===== Leave-and-return detection =====
// After first vibration, user must leave target zone before second vibration can trigger
bool hasLeftTarget = false;                   // Has user left the target zone after first vibration?
float LEAVE_ANGLE_THRESHOLD = 60.0;           // Must turn away this many degrees to count as "left"
bool isWaitingForReturn = false;              // State: waiting for user to return after leaving

// ===== New target generation settings =====
float MIN_ANGLE_DIFFERENCE = 60.0;            // New target must differ from old by at least this much
float previousHeadingShift = 0.0;             // Store previous shift for comparison

// Pattern definitions
#define PATTERN_NONE -1
#define PATTERN_DISTANCE_ALERT 0
#define PATTERN_CALIBRATION 1
#define PATTERN_START 0x01
#define PATTERN_WANDER 0x02
#define PATTERN_NEAR 0x03

class PatternController {
private:
  int pin;
  unsigned long previousMillis;
  int state;
  bool isActive;
  int patternCount;
  int maxCount;
  unsigned long interval;
  int currentPattern;
  bool isVibrationMode;

  // Pattern-specific configurations
  static const int SHORT_DURATION = 200;        // 200ms for short pattern
  static const int LONG_DURATION = 1000;        // 1000ms for long pattern
  static const int PATTERN_INTERVAL = 300;      // 300ms between patterns
  static const int CALIBRATION_INTERVAL = 100;  // 100ms for calibration

public:
  PatternController(int outputPin, bool isVibration = false) {
    pin = outputPin;
    previousMillis = 0;
    state = LOW;
    isActive = false;
    patternCount = 0;
    currentPattern = PATTERN_NONE;
    isVibrationMode = isVibration;
    pinMode(pin, OUTPUT);
  }

  void startPattern(int pattern) {
    isActive = true;
    patternCount = 0;
    state = LOW;
    currentPattern = pattern;

    // Configure pattern parameters based on mode
    if (isVibrationMode) {
      switch (pattern) {
        case PATTERN_START:
          maxCount = 1;  // Single vibration
          interval = SHORT_DURATION;
          break;
        case PATTERN_WANDER:
          maxCount = 2;  // Double vibration
          interval = SHORT_DURATION;
          break;
        case PATTERN_NEAR:
          maxCount = 1;  // Single long vibration
          interval = LONG_DURATION;
          break;
        default:
          isActive = false;
          return;
      }
    } else {
      // LED patterns
      switch (pattern) {
        case PATTERN_DISTANCE_ALERT:
          maxCount = 3;  // Flash 3 times
          interval = SHORT_DURATION;
          break;
        case PATTERN_CALIBRATION:
          maxCount = 5;  // Flash 5 times
          interval = CALIBRATION_INTERVAL;
          break;
        default:
          isActive = false;
          return;
      }
    }

    previousMillis = millis();
    digitalWrite(pin, LOW);
  }

  void update() {
    if (!isActive)
      return;

    unsigned long currentMillis = millis();

    if (currentMillis - previousMillis >= interval) {
      previousMillis = currentMillis;

      if (state == LOW) {
        state = HIGH;
        digitalWrite(pin, state);

        // For double vibration pattern, set next interval
        if (isVibrationMode && currentPattern == PATTERN_WANDER && patternCount == 0) {
          interval = PATTERN_INTERVAL;
        }
      } else {
        state = LOW;
        digitalWrite(pin, state);
        patternCount++;

        if (patternCount >= maxCount) {
          stop();
        } else {
          // Reset interval for next cycle
          if (isVibrationMode) {
            interval = (currentPattern == PATTERN_WANDER) ? SHORT_DURATION : interval;
          }
        }
      }
    }
  }

  void stop() {
    isActive = false;
    digitalWrite(pin, LOW);
    currentPattern = PATTERN_NONE;
  }

  bool isRunning() {
    return isActive;
  }

  int getCurrentPattern() {
    return currentPattern;
  }
};

// Create controller instances
PatternController calibrateCtrl(vibrationPin, true);
PatternController vibrationCtrl(vibrationPin, true);

// Define service and characteristic UUIDs
BLEService imuService("19B10010-E8F2-537E-4F6C-D104768A1214");
BLECharacteristic imuCharacteristic("19B10011-E8F2-537E-4F6C-D104768A1214", BLERead | BLENotify, 12);
BLEIntCharacteristic calibrationCharacteristic("49c29251-5fe3-4832-83dd-e736b673b0bf", BLERead | BLEWrite);
BLEByteCharacteristic distanceCharacteristic("49c29252-5fe3-4832-83dd-e736b673b0bf", BLERead | BLEWrite);
BLEByteCharacteristic resetCharacteristic("49c29254-5fe3-4832-83dd-e736b673b0bf", BLERead | BLEWrite);

void setup() {
  Serial.begin(9600);

  Wire.begin();

  // Initialize IMU
  myIMU.settings.gyroSampleRate = sensorRate;
  myIMU.settings.accelSampleRate = sensorRate;
  Serial.println(myIMU.settings.accelSampleRate);

  if (myIMU.begin() != 0) {
    Serial.println("IMU Device error");
  } else {
    Serial.println("IMU Device OK!");
  }

  // start the filter to run at the sample rate:
  filter.begin(sensorRate);

  // Initialize BLE
  if (!BLE.begin()) {
    Serial.println("Starting BLE failed!");
    while (1)
      ;
  }

  // Set up BLE peripheral
  BLE.setLocalName("IMU Sensor");
  BLE.setAdvertisedService(imuService);

  // Add characteristic to the service
  imuService.addCharacteristic(imuCharacteristic);
  imuService.addCharacteristic(calibrationCharacteristic);
  imuService.addCharacteristic(distanceCharacteristic);
  imuService.addCharacteristic(resetCharacteristic);

  calibrationCharacteristic.writeValue(0);
  distanceCharacteristic.writeValue(0);
  resetCharacteristic.writeValue(0);

  // Add service
  BLE.addService(imuService);

  // Start advertising
  BLE.advertise();
  Serial.println("Bluetooth device active, waiting for connections...");

  pinMode(LED_BUILTIN, OUTPUT);

  // Initialize random seed for better randomness each boot
  randomSeed(analogRead(A0) + micros());
  generateNewHeadingShift();

  microsPerReading = 1000000 / sensorRate;
  microsPrevious = micros();

  while (!isCalibrated) {
    BLE.poll();
    updateIMU();
    // Keep built-in LED flashing
    digitalWrite(LED_BUILTIN, HIGH);
    delay(50);
    digitalWrite(LED_BUILTIN, LOW);
    delay(50);

    if (calibrationCharacteristic.written()) {
      digitalWrite(LED_BUILTIN, HIGH);
      delay(50);
      for (int i = 0; i < sampleNum; i++) {
        gyroShiftX += myIMU.readFloatGyroX();
        gyroShiftY += myIMU.readFloatGyroY();
        gyroShiftZ += myIMU.readFloatGyroZ();
        delay(10);
      }
      gyroShiftX /= sampleNum;
      gyroShiftY /= sampleNum;
      gyroShiftZ /= sampleNum;

      // Indication after calibration is complete:
      // 1. Quick flash of built-in LED
      for (int i = 0; i < 5; i++) {
        digitalWrite(LED_BUILTIN, HIGH);
        delay(100);
        digitalWrite(LED_BUILTIN, LOW);
        delay(100);
      }

      // 2. Start vibration for calibration completion
      calibrateCtrl.startPattern(PATTERN_CALIBRATION);

      updateTargetTower();
    }
  }

  // Configure WDT.
  NRF_WDT->CONFIG = 0x01;    // Configure WDT to run when CPU is asleep
  NRF_WDT->CRV = 98305;      // 3 secs CRV = timeout * 32768 + 1
  NRF_WDT->RREN = 0x01;      // Enable the RR[0] reload register
  NRF_WDT->TASKS_START = 1;  // Start WDT

  Serial.println("booting up");
}

void loop() {
  BLE.poll();
  if (distanceCharacteristic.written()) {
    byte value = distanceCharacteristic.value();
    vibrationCtrl.startPattern(value);
  }

  // Check if reset is requested
  if (resetCharacteristic.written()) {
    if (resetCharacteristic.value() == 1) {
      // Trigger watchdog reset by not feeding it
      while (1) {
        // Wait for watchdog to reset
        delay(5000);
      }
    }
  }

  // Update both controllers
  vibrationCtrl.update();
  calibrateCtrl.update();

  // update target destination
  if (calibrationCharacteristic.written()) {
    updateTargetTower();
    randomInterval = 0;
  }

  updateIMU();

  // LED indicator: always shows direction status (independent of vibration)
  // LED ON (LOW) = facing correct direction, LED OFF (HIGH) = wrong direction
  if (headingDiff <= diffAngle) {
    digitalWrite(LED_BUILTIN, LOW);   // LED ON when correct
  } else {
    digitalWrite(LED_BUILTIN, HIGH);  // LED OFF when wrong
  }

  // ===== Vibration trigger logic =====
  // Flow: Timer -> Wait for target -> Vibrate #1 -> Wait to leave -> Wait to return -> Vibrate #2 -> New target
  
  if (isTimerEnabled) {
    bool timerFired = (millis() - lastVibrationTime >= randomInterval);
    
    // STATE 1: Timer fired, waiting for user to face target (first vibration)
    if (timerFired && !isWaitingForCorrectDirection && !isWaitingForReturn) {
      // Enter waiting state for correct direction
      isWaitingForCorrectDirection = true;
      Serial.println("Timer fired! Waiting for correct direction...");
    }
    
    // STATE 2: Waiting for first vibration (user faces target)
    if (isWaitingForCorrectDirection && !isWaitingForReturn && headingDiff <= diffAngle) {
      vibrationCtrl.startPattern(0x02);
      Serial.println("First vibration! Now leave the target zone...");
      
      // Increment vibration counter
      vibrationCountForCurrentTarget++;
      Serial.print("Vibration count: ");
      Serial.print(vibrationCountForCurrentTarget);
      Serial.print("/");
      Serial.println(VIBRATIONS_PER_TARGET);
      
      // Check if we've reached required vibrations
      if (vibrationCountForCurrentTarget >= VIBRATIONS_PER_TARGET) {
        // Target complete! Generate new target and restart timer
        Serial.println("Target complete! Generating new target...");
        generateNewHeadingShift();
        isWaitingForCorrectDirection = false;
        isWaitingForReturn = false;
        hasLeftTarget = false;
        lastVibrationTime = millis();
        randomInterval = random(MIN_INTERVAL, MAX_INTERVAL + 1);
        Serial.print("Next timer interval: ");
        Serial.println(randomInterval);
      } else {
        // Need more vibrations - enter leave-and-return mode (no timer)
        isWaitingForCorrectDirection = false;
        isWaitingForReturn = true;
        hasLeftTarget = false;
        Serial.print("Must leave target by ");
        Serial.print(LEAVE_ANGLE_THRESHOLD);
        Serial.println(" degrees, then return.");
      }
    }
    
    // STATE 3: Waiting for user to leave target zone
    if (isWaitingForReturn && !hasLeftTarget) {
      if (headingDiff > LEAVE_ANGLE_THRESHOLD) {
        hasLeftTarget = true;
        Serial.println("Left target zone! Now return to trigger next vibration...");
      }
    }
    
    // STATE 4: User has left, waiting for return (second vibration)
    if (isWaitingForReturn && hasLeftTarget && headingDiff <= diffAngle) {
      vibrationCtrl.startPattern(0x02);
      Serial.println("Returned to target! Vibrate!");
      
      // Increment vibration counter
      vibrationCountForCurrentTarget++;
      Serial.print("Vibration count: ");
      Serial.print(vibrationCountForCurrentTarget);
      Serial.print("/");
      Serial.println(VIBRATIONS_PER_TARGET);
      
      // Check if we've reached required vibrations
      if (vibrationCountForCurrentTarget >= VIBRATIONS_PER_TARGET) {
        // Target complete! Generate new target and restart timer
        Serial.println("Target complete! Generating new target...");
        generateNewHeadingShift();
        isWaitingForCorrectDirection = false;
        isWaitingForReturn = false;
        hasLeftTarget = false;
        lastVibrationTime = millis();
        randomInterval = random(MIN_INTERVAL, MAX_INTERVAL + 1);
        Serial.print("Next timer interval: ");
        Serial.println(randomInterval);
      } else {
        // Need more vibrations - reset leave state
        hasLeftTarget = false;
        Serial.println("Need more vibrations - leave and return again!");
      }
    }
  } else {
    // Timer disabled mode: always vibrate when correct
    if (headingDiff <= diffAngle) {
      vibrationCtrl.startPattern(0x02);
    }
  }

  NRF_WDT->RR[0] = WDT_RR_RR_Reload;
}

void updateIMU() {
  unsigned long microsNow;
  microsNow = micros();
  if (microsNow - microsPrevious >= microsPerReading) {
    float xAcc = myIMU.readFloatAccelX();
    float yAcc = myIMU.readFloatAccelY();
    float zAcc = myIMU.readFloatAccelZ();
    float xGyro = myIMU.readFloatGyroX() - gyroShiftX;
    float yGyro = myIMU.readFloatGyroY() - gyroShiftY;
    float zGyro = myIMU.readFloatGyroZ() - gyroShiftZ;

    filter.updateIMU(xGyro, yGyro, zGyro, xAcc, yAcc, zAcc);

    roll = filter.getRoll();
    pitch = filter.getPitch();
    heading = filter.getYaw();

    // IMU's degree increment is opposite from the browser
    heading = 360.0 - heading;

    
    float currentTowerHeading = towerHeading;
    
    // Add a random shift amount if enabled
    if (isHeadingShiftEnabled) {
      currentTowerHeading += headingShiftAmount;
      // make sure currentTowerHeading is between 0 and 360
      while (currentTowerHeading < 0) currentTowerHeading += 360;
      while (currentTowerHeading >= 360) currentTowerHeading -= 360;
    }
    
    // Calculate heading difference with wrap-around handling
    headingDiff = abs(heading - currentTowerHeading);
    if (headingDiff > 180) {
      headingDiff = 360 - headingDiff;
    }

    microsPrevious = microsNow;
  }
}

void updateTargetTower() {
  uint16_t angleToTower = calibrationCharacteristic.value();
  isCalibrated = true;
  northHeading = heading;
  towerAngle = angleToTower;
  towerHeading = (360 + int(northHeading) + angleToTower) % 360;
}

// Generate new heading shift amount
// First target: fully random direction (0-360°)
// Subsequent targets: offset within headingShiftRange (±150°), ensuring MIN_ANGLE_DIFFERENCE from previous
void generateNewHeadingShift() {
  // Save previous shift for comparison
  previousHeadingShift = headingShiftAmount;
  
  if (isFirstTarget) {
    // First target after calibration: completely random direction
    headingShiftAmount = random(0, 360);
    isFirstTarget = false;
    Serial.print("FIRST TARGET (random 0-360): ");
  } else {
    // Normal offset within range, but ensure minimum difference from previous
    int attempts = 0;
    const int maxAttempts = 50;  // Prevent infinite loop
    float newShift;
    
    do {
      newShift = random(-headingShiftRange, headingShiftRange + 1);
      attempts++;
      
      // Calculate angular difference (handle wrap-around)
      float diff = abs(newShift - previousHeadingShift);
      if (diff > 180) diff = 360 - diff;
      
      // Accept if difference is large enough or we've tried too many times
      if (diff >= MIN_ANGLE_DIFFERENCE || attempts >= maxAttempts) {
        break;
      }
    } while (true);
    
    headingShiftAmount = newShift;
    
    if (attempts >= maxAttempts) {
      Serial.print("Normal offset (max attempts reached): ");
    } else {
      Serial.print("Normal offset (diff=");
      float finalDiff = abs(headingShiftAmount - previousHeadingShift);
      if (finalDiff > 180) finalDiff = 360 - finalDiff;
      Serial.print(finalDiff);
      Serial.print("): ");
    }
  }
  Serial.println(headingShiftAmount);
  
  // Reset vibration counter for new target
  vibrationCountForCurrentTarget = 0;
}