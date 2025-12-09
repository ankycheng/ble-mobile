# Pointer Stick

## Libraries Used

- **ArduinoBLE**: Bluetooth Low Energy communication for Arduino https://github.com/arduino-libraries/ArduinoBLE
- **MadgwickAHRS**: Orientation filter for IMU sensor fusion https://github.com/arduino-libraries/MadgwickAHRS
- **LSM6DS3**: Driver for the LSM6DS3 IMU sensor https://github.com/Seeed-Studio/Seeed_Arduino_LSM6DS3/
- **Wire**: I2C communication protocol

## Core Functions

- `updateIMU()`: Updates IMU readings and calculates device orientation using the Madgwick filter
- `updateTargetTower()`: Updates the target heading based on calibration data
- `startPattern()`: Initiates different vibration patterns for user feedback
- `update()`: Manages the vibration pattern execution and timing
- `loop()`: Main program loop handling BLE communication and sensor updates

## Bluetooth Characteristics

The device exposes the following BLE characteristics under the service UUID: "19B10010-E8F2-537E-4F6C-D104768A1214"

### IMU Characteristic (19B10011-E8F2-537E-4F6C-D104768A1214)
- Properties: Read, Notify
- Size: 12 bytes
- Function: Provides IMU sensor data

### Calibration Characteristic (49c29251-5fe3-4832-83dd-e736b673b0bf)
- Properties: Read, Write
- Type: Integer
- Function: Handles device calibration and sets the target angle for orientation

### Distance Characteristic (49c29252-5fe3-4832-83dd-e736b673b0bf)
- Properties: Read, Write
- Type: Byte
- Function: Controls vibration patterns based on distance feedback
- Patterns:
  - PATTERN_START (0x01): Single short vibration
  - PATTERN_WANDER (0x02): Double short vibration
  - PATTERN_NEAR (0x03): Single long vibration

### Reset Characteristic (49c29254-5fe3-4832-83dd-e736b673b0bf)
- Properties: Read, Write
- Type: Byte
- Function: Triggers device reset when value is set to 1

## Vibration Patterns

The device supports different vibration patterns for various states:
- Calibration: 5 quick flashes
- Wander Mode: Single short vibration, Double short vibration, Single long vibration 

## Related Repositories

- **Mobile App**: [BLE Mobile App](https://github.com/ankycheng/ble-mobile) - Mobile application for BLE communication with the Pointer Stick 