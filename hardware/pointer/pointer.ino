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
float headingShiftRange = 45.0;     // Normal offset range: -45° to +45°
float headingShiftAmount = 0.0;     // Current offset, regenerated after each vibration

// Wrong direction offset: sometimes point to completely wrong direction
// This prevents users from easily figuring out the true target direction
const int PROB_WRONG_DIRECTION = 40;      // 40% chance to use wrong direction offset
const int WRONG_OFFSET_MIN = 120;         // Minimum wrong offset (degrees)
const int WRONG_OFFSET_MAX = 180;         // Maximum wrong offset (degrees)

// Timer control variables
// To set a timer beween available vibrations
bool isTimerEnabled = true;
unsigned long lastVibrationTime = 0;
unsigned long randomInterval = 0;
const unsigned long MIN_INTERVAL = 10000;   // Minimum interval between vibration checks (ms)
const unsigned long MAX_INTERVAL = 30000;   // Maximum interval between vibration checks (ms)

// ===== Vibration trigger settings =====
// Two-phase vibration logic:
// Phase 1: When timer fires, there's a chance to vibrate regardless of direction
// Phase 2: If phase 1 didn't trigger, wait for user to face correct direction

// Probability to vibrate regardless of direction when timer fires
const int PROB_UNCONDITIONAL = 30;  // 30% chance to vibrate no matter what

// State tracking for "waiting for correct direction" mode
bool isWaitingForCorrectDirection = false;

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

  // Two-phase vibration trigger logic
  // Phase 1: Timer fires -> 30% unconditional vibration
  // Phase 2: If no vibration, wait for user to face correct direction
  
  if (isTimerEnabled) {
    bool timerFired = (millis() - lastVibrationTime >= randomInterval);
    
    // Phase 1: Timer just fired
    if (timerFired && !isWaitingForCorrectDirection) {
      if (random(0, 100) < PROB_UNCONDITIONAL) {
        // Unconditional vibration triggered
        vibrationCtrl.startPattern(0x02);
        Serial.println("Unconditional vibrate!");
        
        // Reset timer and generate new random values
        lastVibrationTime = millis();
        randomInterval = random(MIN_INTERVAL, MAX_INTERVAL + 1);
        Serial.print("Next interval: ");
        Serial.println(randomInterval);
        generateNewHeadingShift();
      } else {
        // Enter waiting state for correct direction
        isWaitingForCorrectDirection = true;
        Serial.println("Waiting for correct direction...");
      }
    }
    
    // Phase 2: Waiting for correct direction
    if (isWaitingForCorrectDirection && headingDiff <= diffAngle) {
      vibrationCtrl.startPattern(0x02);
      Serial.println("Correct direction found! Vibrate!");
      
      // Reset everything
      isWaitingForCorrectDirection = false;
      lastVibrationTime = millis();
      randomInterval = random(MIN_INTERVAL, MAX_INTERVAL + 1);
      Serial.print("Next interval: ");
      Serial.println(randomInterval);
      generateNewHeadingShift();
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

// Generate new heading shift amount with chance of wrong direction
void generateNewHeadingShift() {
  if (random(0, 100) < PROB_WRONG_DIRECTION) {
    // Wrong direction: offset by 120°-180° (nearly opposite)
    int wrongOffset = random(WRONG_OFFSET_MIN, WRONG_OFFSET_MAX + 1);
    headingShiftAmount = (random(0, 2) == 0) ? wrongOffset : -wrongOffset;
    Serial.print("WRONG direction offset: ");
  } else {
    // Normal offset within range
    headingShiftAmount = random(-headingShiftRange, headingShiftRange + 1);
    Serial.print("Normal offset: ");
  }
  Serial.println(headingShiftAmount);
}