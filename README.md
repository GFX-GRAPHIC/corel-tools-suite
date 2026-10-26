# Corel Tools Suite

<div align="center">

![Corel Tools Suite Banner](https://raw.githubusercontent.com/GFX-GRAPHIC/corel-tools-suite/master/public/logo.png)

### Enterprise Desktop Automation & Production Suite for CorelDRAW
**Developed by GFX Graphic Software Studio**

[![Latest Release](https://img.shields.io/badge/Release-v1.1.4-007acc?style=for-the-badge&logo=github)](https://github.com/GFX-GRAPHIC/corel-tools-suite/releases/tag/v1.1.4)
[![Platform](https://img.shields.io/badge/Platform-Windows%20x64-00a8e8?style=for-the-badge&logo=windows)](https://github.com/GFX-GRAPHIC/corel-tools-suite/releases)
[![CorelDRAW](https://img.shields.io/badge/CorelDRAW-2019%20|%202020%20|%202021%20|%202022%20|%202024-00b4d8?style=for-the-badge&logo=coreldraw)](https://github.com/GFX-GRAPHIC/corel-tools-suite)
[![Engine](https://img.shields.io/badge/Engine-C%23%20FastCom%20IDispatch-512bd4?style=for-the-badge&logo=c-sharp)](https://github.com/GFX-GRAPHIC/corel-tools-suite)
[![License](https://img.shields.io/badge/License-Proprietary-gold?style=for-the-badge)](https://github.com/GFX-GRAPHIC/corel-tools-suite)

[Download Portable v1.1.4](https://github.com/GFX-GRAPHIC/corel-tools-suite/releases/download/v1.1.4/Corel.Tools.Suite.1.1.4.Portable.exe) | [Download Setup Installer](https://github.com/GFX-GRAPHIC/corel-tools-suite/releases/download/v1.1.4/Corel.Tools.Suite.Setup.1.1.4.exe) | [Changelog](https://github.com/GFX-GRAPHIC/corel-tools-suite/releases)

</div>

---

## Overview

**Corel Tools Suite** is an industrial-grade desktop application engineered to eliminate repetitive manual workflows in graphic production, digital printing, and sportswear sublimation manufacturing. 

Powered by a custom native C# COM Interop engine (`FastCom`) and an Electron interface, the suite communicates directly with active CorelDRAW instances in real time, delivering high-speed execution (< 15 seconds for 60 patterned jersey layouts vs 6+ minutes manual placement).

---

## Key Modules & Features

### 1. Jersey Apparel Sublimation Auto-Layout
- **Lightning Fast Card Duplication**: Generates 60+ jersey production layouts in under 15 seconds.
- **Deep PowerClip & Nested Subgroup Traversal**: Detects and updates text inside PowerClips, curves, groups, and multi-piece layouts (front, back, left/right sleeves, collar, pants, and label tags).
- **Unlimited Duplicate Variable Replacement**: Matches and updates multiple instances of the same variable across the entire pattern (e.g. number 10 on back, front, and pants; size L on sleeves, collar, and neck label).
- **Proportional Auto-Resize by Size Chart**: Automatically resizes patterned cards according to standard size charts (XS, S, M, L, XL, XXL, 3XL, 4XL, 5XL, Children sizes) while maintaining design aspect ratio.
- **Smart Text Fitting & True Alignment**: Proportional width limits with automatic font casing (UPPERCASE, Title Case, lowercase, Sentence case) and true mathematical coordinate centering.
- **Auto Convert to Curves**: One-click automatic vector curve conversion before sending to RIP print queues.

### 2. Variable Data & Certificate Merger
- Automated bulk text replacement and credential generation from Excel/CSV or manual list input.
- Real-time live preview with column mapping and auto-detection.

### 3. High-Speed CorelDRAW COM Engine (`FastCom`)
- Bypasses standard OLE reflection overhead by utilizing direct Win32 IDispatch vtable binding.
- Zero freeze, asynchronous task management, and automatic process recovery.

### 4. Batch CDR Converter & Utility Tools
- Fast vector export pipeline to PDF, EPS, SVG, and high-resolution raster formats.
- Batch color profile validation and pre-flight checks.

---

## Performance Comparison

| Metric | Manual CorelDRAW Workflow | Corel Tools Suite v1.1.4 |
| :--- | :--- | :--- |
| **60 Jersey Patterns Layout** | ~6 to 10 Minutes | **< 15 Seconds** |
| **Number & Size Replacement** | Manual copy-paste per shape | **100% Automated Instant Match** |
| **PowerClip Text Updates** | Must enter each PowerClip container | **Direct Native Traversal** |
| **Font Missing / Curve Conversion** | Manual select & Ctrl+Q per card | **Automated Batch Post-Process** |
| **Error Rate** | Prone to human typographic errors | **0% Discrepancy from Data Source** |

---

## Technical Stack & Architecture

```
+-----------------------------------------------------------+
|               Modern Desktop Interface                    |
|             (HTML5 Canvas / CSS3 / Vanilla JS)             |
+-----------------------------------------------------------+
                             |
                             v  (IPC Bridge)
+-----------------------------------------------------------+
|                     Electron Host                         |
|               (Node.js Runtime / Secure IPC)              |
+-----------------------------------------------------------+
                             |
                             v  (PowerShell Fast Pipeline)
+-----------------------------------------------------------+
|                C# FastCom Interop Library                 |
|       (Direct Win32 IDispatch Invoke / DISPID Cache)      |
+-----------------------------------------------------------+
                             |
                             v  (Native COM)
+-----------------------------------------------------------+
|                  CorelDRAW Application                    |
|       (Versions: 2019, 2020, 2021, 2022, 2023, 2024)      |
+-----------------------------------------------------------+
```

---

## Installation & Requirements

### System Requirements
- **Operating System:** Windows 10 / Windows 11 (64-bit)
- **CorelDRAW Installed:** CorelDRAW 2019, 2020, 2021, 2022, or 2024 (64-bit)
- **RAM:** Minimum 4 GB (8 GB recommended for heavy vector files)
- **Privileges:** Standard user or Administrator

### Quick Start
1. Download the latest release from [Releases Page](https://github.com/GFX-GRAPHIC/corel-tools-suite/releases).
2. Choose between:
   - **Portable Version (`Corel.Tools.Suite.1.1.4.Portable.exe`):** No installation required. Double click and run instantly.
   - **Setup Installer (`Corel.Tools.Suite.Setup.1.1.4.exe`):** Full system installation with start menu shortcuts and auto-updater.
3. Open your CorelDRAW document with your master design template.
4. Launch Corel Tools Suite, select your pattern, map variables, and click **Tata Pola di CorelDRAW**.

---

## Enterprise Support & Custom Development

Corel Tools Suite is engineered by **GFX Graphic Software Studio**. We build custom software solutions, CAD/vector automation plugins, and enterprise ERP/POS systems for the printing and manufacturing industries.

- **Developer:** GFX Graphic Software Division
- **GitHub:** [@GFX-GRAPHIC](https://github.com/GFX-GRAPHIC)
- **Inquiries:** Custom automation, plugin development, and enterprise licensing available upon request.

---

<div align="center">

Copyright (c) 2026 GFX Graphic Software Studio. All rights reserved.

</div>
