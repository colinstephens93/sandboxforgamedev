# Owner's real tune data

The owner's tune is an EFILive `.ctz` file, `LLy_DSP5_Hiss_OptHvyDDHPRace_LBZ_Reg_10-6-16.ctz`. Its header
(readable without decryption) says:

- Vehicle: VIN decodes to a 2005 Silverado 2500HD 4WD crew cab with the LLY (VIN position 8 = 2, position 10 = 5)
- Engine computer operating system: 5160005
- Tool: FlashScan V2, V8 software; created 2015-02-18, modified 2016-10-06
- A five-position switchable (DSP5) tune. Positions and horsepower over stock, confirmed by the owner:
  Heavy Tow +30, Light Tow +60, Economy +120, Street +175, Race +230
- Written for an LLY with the **LBZ fuel pressure regulator** swapped onto the CP3 pump (confirmed by the owner)

The tune tables themselves are encrypted inside the file, so the game cannot read them directly, and the
`.ctz` is deliberately not stored in this repo (it also contains device serial and license numbers).

## How to supply the numbers

From EFILive's tuning tool, for each of the five tune positions, copy these tables with their row and column
labels into a spreadsheet and save each as CSV in this folder:

- main fuel quantity (injection quantity vs pedal and rpm)
- main injection timing
- rail pressure target
- boost and turbo vane position targets
- smoke limiter (fuel limit vs boost or airflow)
- torque limiters
- Allison shift points, line pressure and converter lockup

Most useful of all: dyno sheets and datalogs (exported to CSV) for stock and for each position.
