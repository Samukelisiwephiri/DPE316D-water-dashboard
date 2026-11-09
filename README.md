# Embedded Intelligence Water-Tank Monitoring & Control Web Application

This repository contains the complete full-stack web application designed for monitoring and controlling edge-deployed water-tank systems driven by **ATmega328P** or **ESP32-S3** hardware platforms.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm or yarn

### Installation
1. Clone or extract this repository into your development directory.
2. Open VS Code in the project directory:
   ```bash
   cd embedded-water-tank-dashboard
   code .
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the local development server:
   ```bash
   npm run dev
   ```
5. Open your browser at `http://localhost:5173`.

## 🛠 Features & Modules
- **Real-Time Telemetry Dashboard**: Visual depth percentage indicator, dynamic tank volumetric calculations (Litres), health status badges.
- **Power & Battery Health Monitor**: Real-time SLA battery voltage reading based on a 27kΩ/12kΩ resistor divider calibration.
- **Automated & Manual Hysteresis Controls**: Dynamic refill start/stop thresholds and E-Stop lockouts.
- **Audit Logging**: Structured hardware event logging (`LOG_EVT_BOOT`, `LOG_EVT_AUTO_FILL_ON`, `LOG_EVT_ESTOP_ACTIVE`, `LOG_EVT_FILL_STOP`).
- **Hardware Time Sync**: Instant synchronization between host client time and DS1307 real-time clock hardware.
