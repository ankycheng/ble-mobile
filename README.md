# Dowsing Rod (Stick)

A web-based application for tracking cell towers using BLE and GPS. Works with a custom Arduino pointing device to guide users toward cell tower locations through haptic feedback.

## Table of Contents

- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Hardware Component](#hardware-component)
  - [BLE Interface](#ble-interface)
  - [Wander Mode Design](#wander-mode-design)
- [Usage & Development](#usage--development)
  - [Running the Server](#running-the-server)
  - [UI Controls](#ui-controls)
  - [Tower Data Format](#tower-data-format)
- [Dependencies](#dependencies)
- [Notes](#notes)

## Key Features

- Real-time tower tracking with GPS and compass
- BLE connectivity with Arduino pointing device
- Multiple tower selection modes (Closest/Random)
- Tower list switching (test data/favorites)
- Dev mode with console output
- PWA support for offline use

## Project Structure

```
.
├── index.html          # Main application entry point
├── manifest.json       # PWA manifest
├── sw.js              # Service worker for offline support
├── server.py          # Development server
├── css/style.css      # Application styling
├── js/
│   ├── sketch.js      # Main p5.js application logic
│   ├── ble-handler.js # BLE communication
│   ├── gps-handler.js # GPS functionality
│   ├── compass.js     # Compass/orientation
│   ├── ui-components.js
│   ├── wander-mode.js # (currently disabled on web)
│   ├── utils.js
│   └── wake-lock.js
├── libs/              # p5.js, p5.ble.js
├── data/              # Tower databases (JSON)
└── hardware/pointer/  # Arduino firmware
```

## Hardware Component

Arduino-based pointing device providing haptic feedback. See [`hardware/pointer/README.md`](hardware/pointer/README.md) for detailed hardware documentation.

### BLE Interface

**Service UUID**: `19B10010-E8F2-537E-4F6C-D104768A1214`

| Characteristic | UUID | Function |
|----------------|------|----------|
| Calibration | `49c29251-...` | Sets target angle |
| Distance | `49c29252-...` | Controls vibration patterns |
| Reset | `49c29254-...` | Triggers device reset |

### Wander Mode Design

The Arduino firmware implements a **non-deterministic navigation system** - transforming the device from a precise compass into a "dowsing rod" that guides through intuition and uncertainty.

**Design Philosophy**: Instead of exact directions, the system intentionally introduces randomness to create a meandering, exploratory journey where users can't easily determine the true target direction.

#### Direction Offset System

| Parameter | Value | Description |
|-----------|-------|-------------|
| First Target | 0°-360° | Completely random direction |
| Subsequent Targets | ±150° | Random offset from true direction |
| Min Angle Difference | 60° | New target must differ from previous by at least this |
| Vibrations Per Target | 2 | Must find same direction twice before new target |

#### Vibration Trigger Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WANDER MODE LOOP                                │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │   Wait Random 10-30 seconds   │◄─────────────────┐
                   └───────────────────────────────┘                  │
                                   │                                  │
                                   ▼ Timer fires                      │
                   ┌───────────────────────────────┐                  │
                   │   Wait for user to face       │                  │
                   │   target direction (±15°)     │                  │
                   └───────────────────────────────┘                  │
                                   │                                  │
                                   ▼ User faces direction             │
                   ┌───────────────────────────────┐                  │
                   │      VIBRATE! (#1)            │                  │
                   └───────────────────────────────┘                  │
                                   │                                  │
                                   ▼                                  │
                   ┌───────────────────────────────┐                  │
                   │   Wait for user to LEAVE      │                  │
                   │   target zone (>60°)          │  No timer wait   │
                   └───────────────────────────────┘                  │
                                   │                                  │
                                   ▼ User leaves zone                 │
                   ┌───────────────────────────────┐                  │
                   │   Wait for user to RETURN     │                  │
                   │   to target direction (±15°)  │                  │
                   └───────────────────────────────┘                  │
                                   │                                  │
                                   ▼ User returns                     │
                   ┌───────────────────────────────┐                  │
                   │      VIBRATE! (#2)            │                  │
                   └───────────────────────────────┘                  │
                                   │                                  │
                                   ▼                                  │
                   ┌───────────────────────────────┐                  │
                   │   Generate NEW target offset  │                  │
                   │   (differs by ≥60° from prev) │──────────────────┘
                   └───────────────────────────────┘
```

#### Vibration Patterns

| Pattern | Code | Duration | Use Case |
|---------|------|----------|----------|
| START | `0x01` | 200ms | Session start |
| WANDER | `0x02` | 200ms × 2 | Normal exploration |
| NEAR | `0x03` | 1000ms | Close to target (Currently disabled) |

#### Configuration Constants

```cpp
// Direction detection
float diffAngle = 15.0;                    // Angle tolerance for "correct" direction

// Offset generation
float headingShiftRange = 150.0;           // Normal offset range (±150°)
float MIN_ANGLE_DIFFERENCE = 60.0;         // New target must differ from previous

// Target persistence
const int VIBRATIONS_PER_TARGET = 2;       // Vibrations needed before new target
float LEAVE_ANGLE_THRESHOLD = 60.0;        // Must leave by this much before return

// Timer
const unsigned long MIN_INTERVAL = 10000;  // 10 sec min between target cycles
const unsigned long MAX_INTERVAL = 30000;  // 30 sec max between target cycles
```

## Usage & Development

### Running the Server

```bash
python server.py
```

Runs on `http://localhost:5566` with build timestamp injection.

### UI Controls

| Button | Function |
|--------|----------|
| Dev Mode / User Mode | Toggle debug features (console, green pointer) |
| Connect to Arduino | Establish BLE connection |
| Reset Device | Trigger watchdog reset |
| Calibrate | Align rod's north with compass UI north (sync true north for session) |
| Closest / Random Mode | Tower selection strategy |
| All Towers / Favorites | Switch tower data source |
| Enable Compass | iOS orientation permission |
| Update Heading | Send new target (tower) heading to rod (Dev Mode only) |

### Tower Data Format

Tower databases in `data/` directory (`test_data.json`, `favorites.json`, `newyork.json`, `phoenix.json`):

```json
{
  "towers": [
    { "radio": "LTE", "cell": "unique_id", "lat": 40.7128, "lon": -74.0060, "name": "optional" }
  ]
}
```

## Dependencies

**Web**: p5.js, p5.ble.js

**Arduino**: ArduinoBLE, MadgwickAHRS, LSM6DS3 (Seeed)

## Notes

- **Permissions**: GPS/Location, Bluetooth, Device Orientation (iOS requires button tap)
- **Wake Lock**: Screen stays on during active tracking
- **State Persistence**: Dev mode, tower mode, and list selection saved to localStorage
- **Compass Display**: Red arrow = north, green line = target tower (dev mode)
