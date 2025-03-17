# BLE Mobile Tower Tracker

A web-based application for tracking and interacting with cell towers using BLE (Bluetooth Low Energy) and GPS capabilities. This application allows users to locate, track, and manage cell tower information with various interactive modes.

## Project Structure

```
.
├── index.html          # Main application entry point
├── style.css          # Application styling
├── sketch.js          # Main p5.js application logic
├── ble-handler.js     # BLE communication handling
├── gps-handler.js     # GPS functionality
├── compass.js         # Compass and orientation features
├── ui-components.js   # UI element definitions
├── wander-mode.js     # Wander mode functionality
├── utils.js           # Utility functions
├── wake-lock.js       # Screen wake lock functionality
├── favorites.json     # User's favorite tower locations
├── newyork.json      # New York tower database
├── phoenix.json      # Phoenix tower database
└── icons/            # Application icons
```

## Key Features

- Real-time tower tracking
- BLE device connectivity
- GPS location services
- Multiple operation modes (Closest, All Towers, Wander)
- Favorite towers management
- Compass orientation
- Development mode for testing

## UI Controls

The application provides several UI controls accessible through buttons:

1. **Dev Mode**: Toggle development mode for testing
2. **Connect to Arduino**: Establish BLE connection
3. **Reset Device**: Reset the current device connection
4. **Calibrate**: Calibrate the compass and sensors
5. **Closest Mode**: Focus on nearest tower
6. **All Towers**: View all available towers
7. **Enable Compass**: Toggle compass functionality
8. **Wander Mode**: Enable free exploration mode

## Tower Data Management

### File Paths and Data Sources

1. **Tower Databases**:
   - `newyork.json`: Contains tower data for New York area
   - `phoenix.json`: Contains tower data for Phoenix area
   - Format:
     ```json
     {
       "towers": [
         {
           "radio": "LTE/5G",
           "cell": "unique_id",
           "lat": "latitude",
           "lon": "longitude"
         }
       ]
     }
     ```

2. **Favorites List**:
   - Located in `favorites.json`
   - Structure:
     ```json
     {
       "towers": [
         {
           "radio": "tower_type",
           "cell": "cell_id",
           "lat": "latitude",
           "lon": "longitude",
           "name": "custom_name"
         }
       ]
     }
     ```

## Location Information Display

The application shows real-time information about:
- Current GPS position
- Tower radio type
- Cell ID
- Tower location (latitude/longitude)
- Distance to tower
- Angle to tower
- Debug link to OpenCellID

## Development and Testing

1. Use Dev Mode for testing and debugging
2. The application includes test data in `test_data.json`
3. Service worker implementation is available in `sw.js` for offline capabilities

## Dependencies

- p5.js: Main visualization library
- p5.ble.js: BLE communication library
- Custom modules for GPS, compass, and UI handling

## Notes

- The application requires GPS and Bluetooth permissions
- Compass calibration may be needed for accurate readings
- Different modes (Closest, All Towers, Wander) affect how towers are displayed and tracked
- Favorite towers can be managed through the favorites.json file