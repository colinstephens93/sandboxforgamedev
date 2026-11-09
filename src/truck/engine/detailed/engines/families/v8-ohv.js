import * as THREE from 'three';
import {
  bolt,
  box,
  createGear,
  createPulley,
  createScrollVolute,
  createSpring,
  cylinder,
  cylinderBetween,
  decal,
  extrudeShape,
  lerp,
  makeLabelTexture,
  mergeStaticMeshes,
  mesh,
  roundedBox,
  roundedRectShape,
  tube,
  torus,
  addBoltAt,
} from '../../utils.js';
import { kinematicsFor } from './v8-ohv-kinematics.js';
import { DEG, camshaftAngleDeg, mod, wrapSignedDeg } from '../../kinematics.js';
import { telemetryValues, vaneAtRpm } from '../../core/telemetry.js';
import { createResourceDisposer } from '../../core/resources.js';

const TAU = Math.PI * 2;
const DECK_Y = 306;
const VALVE_TIP_Y = 443;
const CAM_Y = 150;
const CAM_BASE_RADIUS = 23.5;
const ROLLER_RADIUS = 9.5;
const LOBE_LIFT = 8.0;
const MAIN_JOURNAL_Z = [277, 131, 0, -131, -277];
// Past this much fade (opacity about 0.67) clicks go through the castings to the parts inside.
const XRAY_PICK_THRESHOLD = 0.35;

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function labelLines(lines, opts) {
  return makeLabelTexture(lines, { width: 1024, height: 256, ...opts });
}

export class EngineBuilder {
  constructor(materials, entry) {
    this.entry = entry;
    this.kinematics = kinematicsFor(entry);
    this.m = materials;
    this.root = new THREE.Group();
    this.root.name = entry.identity.sceneName;
    this.parts = new Map();
    this.assemblies = new Map();
    this.explodeGroups = [];
    this.dynamicGroups = [];
    this.shellMaterials = [];
    this.exhaustDetailMeshes = [];
    this.pistons = [];
    this.rods = [];
    this.crankSpin = null;
    this.camSpin = null;
    this.accessoryPulleys = [];
    this.turboWheels = [];
    this.turboActuator = null;
    this.glowingInjectors = [];
    this.glowPlugs = [];
    this.combustionFlashes = [];
    this.injectionCones = [];
    this.shellMeshes = [];
    this.coverLabels = [];
    this.cutawayTarget = 0;
    this.cutawayAmount = 0;
    this.explodeTarget = 0;
    this.explodeAmount = 0;
    this.elapsed = 0;
    this._lastCutawaySign = -1;
    this._shellRoot = null;
    this._buildMaterials();
  }

  _buildMaterials() {
    const m = this.m;
    const block = m.castIronBlock.clone();
    block.color.setHex(this.entry.look.palette.block);
    block.name = 'cutaway-block';
    const blockDark = m.castIronBlockDark.clone();
    blockDark.color.setHex(this.entry.look.palette.blockDark);
    blockDark.name = 'cutaway-block-dark';
    const head = m.castAluminumHead.clone();
    head.color.setHex(this.entry.look.palette.head);
    head.name = 'cutaway-head';
    const cover = m.castAluminumHead.clone();
    cover.color.setHex(this.entry.look.palette.cover);
    cover.roughness = 0.76;
    cover.metalness = 0.04;
    cover.envMapIntensity = 0.32;
    cover.bumpScale = 1.1;
    cover.name = 'cutaway-cover';
    const liner = m.nitridedSteel.clone();
    liner.color.setHex(this.entry.look.palette.liner);
    liner.name = 'cutaway-liner';

    const defs = [
      { mat: block, min: 0.045, name: 'block' },
      { mat: blockDark, min: 0.035, name: 'blockDark' },
      { mat: head, min: 0.075, name: 'head' },
      { mat: cover, min: 0.022, name: 'cover' },
      { mat: liner, min: 0.04, name: 'liner' },
    ];
    for (const d of defs) {
      d.mat.userData.cutaway = true;
      d.mat.transparent = false;
      d.mat.depthWrite = true;
      this.shellMaterials.push(d);
    }
    this.mats = {
      ...m,
      blockShell: block,
      blockShellDark: blockDark,
      headShell: head,
      coverShell: cover,
      linerShell: liner,
    };
  }

  /* -----------------------------------------------------------------------
     Assembly / selectable-part registry
  ----------------------------------------------------------------------- */
  makeAssembly(name, offset = [0, 0, 0], rotationZ = 0) {
    const g = new THREE.Group();
    g.name = `assembly-${name}`;
    g.rotation.z = rotationZ;
    this.root.add(g);
    this.assemblies.set(name, g);
    if (offset.some((v) => v !== 0)) {
      this.explodeGroups.push({
        name,
        object: g,
        base: new THREE.Vector3(0, 0, 0),
        offset: new THREE.Vector3(...offset),
      });
    }
    return g;
  }

  createPart(parent, id) {
    const g = new THREE.Group();
    g.name = `part-${id}`;
    g.userData.partId = id;
    parent.add(g);
    if (!this.parts.has(id)) this.parts.set(id, []);
    this.parts.get(id).push(g);
    return g;
  }

  markDynamic(obj) {
    obj.userData.dynamic = true;
    this.dynamicGroups.push(obj);
    return obj;
  }

  _mergePartRoots() {
    // Merge inside moving subassemblies first, then merge the static shell of
    // every selectable component. This keeps draw calls manageable at 60 fps.
    for (const g of this.dynamicGroups) mergeStaticMeshes(g);
    for (const [, roots] of this.parts) {
      for (const r of roots) mergeStaticMeshes(r);
    }
  }

  build() {
    this._buildBlock();
    this._buildRotatingAssembly();
    this._buildCamshaft();
    this._buildMainCaps();
    this._buildHeadsAndValvetrain();
    this._buildOilPan();
    this._buildOilFilter();
    this._buildFrontDrive();
    this._buildExhaustManifolds();
    this._buildTurbo();
    this._buildIntake();
    this._buildFuelSystem();
    this._buildEGR();
    this._buildAncillaries();
    this._buildEngineMounts();
    this._mergePartRoots();
    // Moving internals are only rendered when the castings are X-rayed or the
    // engine is exploded. This keeps the assembled hero view fast.
    this.internalPartIds = [
      'main-caps',
      'camshaft',
      'timing-gears',
      'valves',
      'lifters',
      'pushrods',
      'rockers',
      'valve-bridges',
      ...this.kinematics.cylinders.map((c) => `piston-${c.number}`),
      ...this.kinematics.cylinders.map((c) => `rod-${c.number}`),
    ];
    this.internalGroups = [];
    for (const id of this.internalPartIds) {
      for (const root of this.parts.get(id) || []) this.internalGroups.push(root);
    }
    // Hardware and plaques fitted to the valve covers would otherwise float
    // opaquely when the covers fade for cutaway inspection.
    this.coverDetailMeshes = [];
    for (const coverRoot of this.parts.get('valve-covers') || []) {
      coverRoot.traverse((o) => {
        if (!o.isMesh) return;
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        if (mat !== this.mats.coverShell) {
          this.coverDetailMeshes.push(o);
        }
      });
    }
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = true;
      const part = (() => {
        let p = o;
        while (p) {
          if (p.userData?.partId) return p.userData.partId;
          p = p.parent;
        }
        return '';
      })();
      const internal = this.internalPartIds.includes(part) || /^(piston|rod)-\d$/.test(part);
      o.castShadow = o.castShadow && !o.material?.transparent && !internal;
    });
    return this;
  }

  dispose() {
    if (!this._disposeResources) this._disposeResources = createResourceDisposer([this.root], this.m);
    this._disposeResources();
    this.parts.clear();
    this.assemblies.clear();
  }

  /* -----------------------------------------------------------------------
     Block / long block
  ----------------------------------------------------------------------- */
  _buildBlock() {
    const m = this.mats;
    const asm = this.makeAssembly('block');
    const block = this.createPart(asm, 'block');
    block.userData.partId = 'block';

    // Main crankcase and deep skirt.
    block.add(
      roundedBox(344, 235, 640, 16, m.blockShell, {
        position: [0, -110, 0],
        segments: 3,
      }),
    );
    block.add(
      roundedBox(366, 74, 640, 12, m.blockShellDark, {
        position: [0, -222, 0],
        segments: 2,
      }),
    );
    block.add(
      roundedBox(316, 112, 596, 12, m.blockShell, {
        position: [0, 38, 0],
        segments: 2,
      }),
    );
    // Valley floor and front/rear closure.
    block.add(
      roundedBox(258, 56, 590, 9, m.blockShellDark, {
        position: [0, 82, 0],
        segments: 2,
      }),
    );
    block.add(
      roundedBox(336, 290, 32, 8, m.blockShell, {
        position: [0, -101, 309],
        segments: 2,
      }),
    );
    block.add(
      roundedBox(348, 314, 28, 8, m.blockShell, {
        position: [0, -91, -309],
        segments: 2,
      }),
    );

    // Two canted cylinder bank castings.
    for (const c of [this.kinematics.cylinders[0], this.kinematics.cylinders[1]]) {
      const bank = new THREE.Group();
      bank.rotation.z = c.bankRotationDeg * DEG;
      block.add(bank);
      bank.add(
        roundedBox(218, 248, 584, 18, m.blockShell, {
          position: [0, 186, 0],
          segments: 3,
        }),
      );
      // outer water-jacket ribs
      const outward = c.bank === 'R' ? -1 : 1;
      for (let i = 0; i < 7; i++) {
        const z = -238 + i * 80;
        bank.add(
          roundedBox(22, 154, 17, 3, m.blockShellDark, {
            position: [outward * 112, 147, z],
            segments: 1,
            rotation: [0, 0, outward * 0.05],
          }),
        );
      }
      // deck surface with a slightly raised fire ring
      bank.add(
        roundedBox(204, 13, 568, 3, m.blockShellDark, {
          position: [0, DECK_Y - 2, 0],
          segments: 1,
        }),
      );
      // side lifting eyes
      const lift = new THREE.Group();
      lift.position.set(outward * 100, 304, -248);
      lift.rotation.z = outward * 0.24;
      lift.add(
        roundedBox(48, 24, 18, 7, m.blockShellDark, {
          segments: 1,
          position: [outward * 16, 7, 0],
        }),
      );
      lift.add(
        cylinder(9, 9, 24, m.blackOxide, {
          radial: 18,
          rotation: [Math.PI / 2, 0, 0],
          position: [outward * 34, 8, 0],
        }),
      );
      block.add(lift);
    }

    // Cast ribs along the crankcase flanks.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const z = -235 + i * 94;
        block.add(
          roundedBox(15, 140, 21, 4, m.blockShellDark, {
            position: [side * 172, -119, z],
            segments: 1,
            rotation: [0, 0, side * 0.025],
          }),
        );
      }
      // horizontal oil gallery / casting rail
      block.add(
        roundedBox(22, 26, 500, 4, m.blockShellDark, {
          position: [side * 178, -24, 6],
          segments: 1,
        }),
      );
      // freeze plugs
      for (const z of [-185, 80, 226]) {
        block.add(
          cylinder(18, 19, 6, m.brass, {
            radial: 24,
            rotation: [0, 0, Math.PI / 2],
            position: [side * 173.6, -48, z],
          }),
        );
      }
      // external bolt bosses
      for (const z of [-250, 250]) {
        for (let j = 0; j < 2; j++) {
          addBoltAt(block, [side * 171, -92 + j * 48, z], [side, 0, 0], 7, m.boltSteel);
        }
      }
    }

    // Lower skirt diagonal webs.
    for (const side of [-1, 1]) {
      for (const z of [-212, 212]) {
        block.add(
          roundedBox(20, 110, 36, 4, m.blockShellDark, {
            position: [side * 178, -178, z],
            segments: 1,
            rotation: [0, 0, side * 0.18],
          }),
        );
      }
    }

    // Cylinder bores, liners, deck fire rings and coolant passages.
    const linerMat = m.linerShell;
    const gasketMat = m.copper;
    const boreMat = m.darkSteel;
    for (const c of this.kinematics.cylinders) {
      const bankRoot = new THREE.Group();
      bankRoot.rotation.z = c.bankRotationDeg * DEG;
      block.add(bankRoot);
      const boreGroup = new THREE.Group();
      boreGroup.position.set(0, 0, c.z);
      bankRoot.add(boreGroup);

      const liner = mesh(
        new THREE.CylinderGeometry(57.6, 58.6, 204, 40, 1, true),
        linerMat,
        { castShadow: false, receiveShadow: true },
      );
      liner.position.y = (DECK_Y + 92) / 2;
      liner.material.side = THREE.DoubleSide;
      boreGroup.add(liner);

      const inner = mesh(
        new THREE.CylinderGeometry(52.2, 52.2, 199, 40, 1, true),
        m.nitridedSteel,
        { castShadow: false, receiveShadow: true },
      );
      inner.position.y = (DECK_Y + 92) / 2;
      inner.material.side = THREE.BackSide;
      boreGroup.add(inner);

      // Siamesed jacket ribs
      for (let i = 0; i < 5; i++) {
        const ring = torus(60.5, 2.7, m.blockShellDark, {
          rotation: [Math.PI / 2, 0, 0],
          position: [0, 142 + i * 32, 0],
          tubularSeg: 40,
          radialSeg: 6,
          castShadow: false,
        });
        boreGroup.add(ring);
      }

      const fireRing = torus(53.5, 2.8, gasketMat, {
        rotation: [Math.PI / 2, 0, 0],
        position: [0, DECK_Y + 6, 0],
        tubularSeg: 48,
        radialSeg: 8,
        castShadow: false,
      });
      boreGroup.add(fireRing);
      const chamfer = torus(54.6, 3.5, boreMat, {
        rotation: [Math.PI / 2, 0, 0],
        position: [0, DECK_Y + 8.5, 0],
        tubularSeg: 48,
        radialSeg: 6,
        castShadow: false,
      });
      boreGroup.add(chamfer);
    }

    // Valley lifter bores and cam bearing saddles - visible in cutaway.
    for (let i = 0; i < 5; i++) {
      const z = MAIN_JOURNAL_Z[i] * 0.72;
      block.add(
        roundedBox(84, 48, 36, 7, m.blockShellDark, {
          position: [0, CAM_Y, z],
          segments: 1,
        }),
      );
      block.add(
        torus(28.5, 4.8, m.machinedAluminum, {
          position: [0, CAM_Y, z + 17],
          tubularSeg: 32,
          radialSeg: 6,
          castShadow: false,
        }),
      );
    }

    // Main oil gallery, pressure sensor, and dipstick (passenger side).
    block.add(
      cylinderBetween([-140, -16, 270], [-140, -16, 260], 9, m.darkSteel, { radial: 12 }),
    );
    const dip = new THREE.Group();
    dip.position.set(-198, -10, 185);
    const diptube = cylinder(5.5, 5.5, 190, m.darkSteel, {
      radial: 12,
      position: [0, 30, 0],
      castShadow: false,
    });
    dip.add(diptube);
    dip.add(
      cylinder(12, 12, 18, m.amber, {
        radial: 18,
        position: [0, 127, 0],
        rotation: [0.1, 0, -0.2],
      }),
    );
    dip.add(
      torus(9, 3, m.amber, {
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 139, 0],
        tubularSeg: 18,
        radialSeg: 6,
      }),
    );
    block.add(dip);

    // Rear block / bellhousing flange (large central void for the flywheel).
    const flangeShape = roundedRectShape(430, 438, 34);
    const flangeHole = new THREE.Path();
    flangeHole.absarc(0, 0, 197, 0, Math.PI * 2, true);
    flangeShape.holes.push(flangeHole);
    const flange = extrudeShape(flangeShape, 22, m.blockShell, {
      bevel: true,
      bevelSize: 2,
      bevelThickness: 2,
      castShadow: true,
      receiveShadow: true,
    });
    flange.position.set(0, 12, -314);
    block.add(flange);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      addBoltAt(
        block,
        [Math.cos(a) * 203, 12 + Math.sin(a) * 203, -327],
        [0, 0, -1],
        7,
        m.boltSteel,
      );
    }
    // Reinforcing gussets to the bellhousing.
    for (const side of [-1, 1]) {
      for (const z of [-286]) {
        block.add(
          roundedBox(30, 130, 45, 5, m.blockShellDark, {
            position: [side * 166, -85, z],
            segments: 1,
            rotation: [0, 0, side * 0.38],
          }),
        );
      }
    }

    // Block identification / GM casting marks.
    const blockLabel = labelLines(
      [
        this.entry.look.decals.block[0],
        this.entry.look.decals.block[1],
      ],
      { width: 1024, height: 300, padding: 52, background: 'transparent' },
    );
    const plate = decal(block, blockLabel, 158, 46, [177.4, -6, 128], [0, Math.PI / 2, 0], {
      roughness: 0.85,
    });
    plate.material.opacity = 0.7;
    const serial = makeLabelTexture(
      [
        this.entry.look.decals.serialPlate[0],
        this.entry.look.decals.serialPlate[1],
      ],
      { width: 640, height: 220, background: '#181a17', border: true, accent: '#9f8554', padding: 30 },
    );
    decal(block, serial, 96, 33, [177.8, -78, 128], [0, Math.PI / 2, 0], { roughness: 0.5 });

    // Casting flash / chamfer line around the deep skirt.
    block.add(
      roundedBox(372, 8, 636, 3, m.blockShellDark, {
        position: [0, -258, 0],
        segments: 1,
        castShadow: false,
      }),
    );
  }

  /* -----------------------------------------------------------------------
     Crankshaft, rods, pistons
  ----------------------------------------------------------------------- */
  _buildRotatingAssembly() {
    const m = this.mats;
    const asm = this.makeAssembly('rotating', this.entry.explode.offsets.rotating);
    const crankPart = this.createPart(asm, 'crank');
    const spin = new THREE.Group();
    this.markDynamic(spin);
    this.crankSpin = spin;
    crankPart.add(spin);

    // Main journals and noses.
    for (let i = 0; i < MAIN_JOURNAL_Z.length; i++) {
      const z = MAIN_JOURNAL_Z[i];
      const journal = cylinder(35, 35, 48, m.nitridedSteel, {
        radial: 32,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, z],
      });
      spin.add(journal);
      // oil hole
      spin.add(
        cylinder(4, 4, 38.6, m.blackOxide, {
          radial: 10,
          rotation: [0, 0, Math.PI / 2],
          position: [18, 18, z],
          castShadow: false,
        }),
      );
    }
    // Front snout / crank gear and rear flange.
    spin.add(
      cylinder(29, 33, 94, m.nitridedSteel, {
        radial: 28,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, 290],
      }),
    );
    const crankGear = createGear(50, 22, 25, m.darkSteel);
    crankGear.position.set(0, 0, 247);
    this.createPart(spin, 'timing-gears').add(crankGear);
    spin.add(
      cylinder(76, 76, 20, m.nitridedSteel, {
        radial: 40,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, -288],
      }),
    );

    // Four cross-plane throws, each with paired rod journals.
    for (let i = 0; i < this.kinematics.stationZ.length; i++) {
      const c = this.kinematics.cylinders.find((cc) => cc.station === i);
      const phase = (this.kinematics.crankReferenceDeg - c.throwOffset) * DEG;
      const throwGroup = new THREE.Group();
      throwGroup.position.z = this.kinematics.stationZ[i];
      throwGroup.rotation.z = phase;
      spin.add(throwGroup);

      const journal = cylinder(31, 31, 108, m.nitridedSteel, {
        radial: 30,
        rotation: [Math.PI / 2, 0, 0],
        position: [49.5, 0, 0],
      });
      throwGroup.add(journal);
      // Journal oil drillings.
      for (const dz of [-24, 24]) {
        throwGroup.add(
          cylinder(3.6, 3.6, 22, m.blackOxide, {
            radial: 8,
            rotation: [0, 0, Math.PI / 2],
            position: [49.5, 18, dz],
            castShadow: false,
          }),
        );
      }
      // Paired webs and profiled counterweights.
      for (const side of [-1, 1]) {
        const web = new THREE.Group();
        web.position.z = this.kinematics.stationZ[side > 0 ? 1 : 2];
        const arm = roundedBox(153, 47, 25, 15, m.forgedSteel, {
          position: [-30, 0, 0],
          segments: 2,
        });
        web.add(arm);
        const weight = cylinder(91, 91, 29, m.forgedSteel, {
          radial: 32,
          rotation: [Math.PI / 2, 0, 0],
          position: [-49, 0, 0],
        });
        web.add(weight);
        throwGroup.add(web);
      }
      // Main web shoulders between journals.
      for (const side of [-1, 1]) {
        const zWeb = side * 82;
        spin.add(
          roundedBox(138, 30, 22, 12, m.forgedSteel, {
            position: [16, 0, this.kinematics.stationZ[i] + zWeb],
            rotation: [0, 0, phase],
            segments: 2,
          }),
        );
      }
    }

    // Front damper / poly-V pulley.
    // The damper sits outboard of the gear cover on the crank snout.
    spin.add(
      cylinder(25, 29, 62, m.nitridedSteel, {
        radial: 24,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, 356],
      }),
    );
    const damper = new THREE.Group();
    damper.position.z = 386;
    const hub = cylinder(41, 41, 44, m.machinedAluminum, {
      radial: 32,
      rotation: [Math.PI / 2, 0, 0],
    });
    damper.add(hub);
    const inertia = cylinder(92, 92, 33, m.forgedSteel, {
      radial: 56,
      rotation: [Math.PI / 2, 0, 0],
    });
    damper.add(inertia);
    damper.add(
      cylinder(95, 95, 5, m.machinedAluminum, {
        radial: 56,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, 17],
      }),
    );
    const grooveMat = m.blackOxide;
    for (let i = 0; i < 7; i++) {
      damper.add(
        cylinder(92.5, 92.5, 1.8, grooveMat, {
          radial: 56,
          rotation: [Math.PI / 2, 0, 0],
          position: [0, 0, -8 + i * 4.2],
          castShadow: false,
        }),
      );
    }
    // Central crank bolt and damper face detail.
    damper.add(
      cylinder(22, 22, 15, m.machinedAluminum, {
        radial: 6,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, 24],
      }),
    );
    damper.add(
      torus(38, 3.6, m.blackOxide, {
        rotation: [0, 0, 0],
        position: [0, 0, 20],
        tubularSeg: 32,
        radialSeg: 6,
        castShadow: false,
      }),
    );
    // TDC / timing scale
    const timing = labelLines(
      [this.entry.look.decals.timingCover[0]],
      { width: 1024, height: 128, padding: 20 },
    );
    decal(damper, timing, 114, 14.2, [0, 85, 21.2], [0, 0, 0], { roughness: 0.7 });
    spin.add(damper);

    // Flywheel / dyno coupling surface.
    const flywheelPart = this.createPart(asm, 'flywheel');
    const flywheel = new THREE.Group();
    this.markDynamic(flywheel);
    flywheel.position.z = -318;
    flywheelPart.add(flywheel);
    flywheel.add(
      cylinder(158, 158, 24, m.forgedSteel, {
        radial: 64,
        rotation: [Math.PI / 2, 0, 0],
      }),
    );
    flywheel.add(
      torus(160, 8.2, m.darkSteel, {
        position: [0, 0, -2],
        tubularSeg: 72,
        radialSeg: 8,
      }),
    );
    for (let i = 0; i < 58; i++) {
      const a = (i / 58) * TAU;
      flywheel.add(
        box(7, 12, 20, m.forgedSteel, {
          position: [Math.cos(a) * 165, Math.sin(a) * 165, 0],
          rotation: [0, 0, a],
          castShadow: false,
        }),
      );
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      addBoltAt(
        flywheel,
        [Math.cos(a) * 61, Math.sin(a) * 61, -16],
        [0, 0, -1],
        7,
        m.boltSteel,
      );
    }
    flywheel.add(
      cylinder(38, 47, 30, m.machinedAluminum, {
        radial: 28,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, -26],
        castShadow: true,
      }),
    );
    flywheel.add(
      cylinder(22, 22, 12, m.darkSteel, {
        radial: 20,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, -48],
      }),
    );
    this.flywheel = flywheel;

    // Pistons and fracture-split rods live with the rotating assembly so they
    // remain physically joined when the crank group is exploded.
    for (const c of this.kinematics.cylinders) {
      const bankRoot = new THREE.Group();
      bankRoot.rotation.z = c.bankRotationDeg * DEG;
      asm.add(bankRoot);
      const pistonPart = this.createPart(asm, `piston-${c.number}`);
      // Part groups need to live under the bank-rotated coordinate system.
      asm.remove(pistonPart);
      bankRoot.add(pistonPart);
      pistonPart.userData.cylinder = c.number;
      const pistonMotion = new THREE.Group();
      this.markDynamic(pistonMotion);
      pistonPart.add(pistonMotion);
      this._buildPiston(pistonMotion, c);

      const rodPart = this.createPart(asm, `rod-${c.number}`);
      asm.remove(rodPart);
      bankRoot.add(rodPart);
      rodPart.userData.cylinder = c.number;
      const rodMotion = new THREE.Group();
      this.markDynamic(rodMotion);
      rodPart.add(rodMotion);
      this._buildRod(rodMotion);

      this.pistons.push({ cylinder: c, root: pistonMotion, part: pistonPart, bankRoot });
      this.rods.push({ cylinder: c, root: rodMotion, part: rodPart });
    }
    for (const item of this.pistons) this._mergeRigidGroup(item.root);
    for (const item of this.rods) this._mergeRigidGroup(item.root);

    this.rotatingDynamics = { asm, spin, flywheel };
  }

  _buildPiston(parent, c) {
    const m = this.mats;
    const profile = [
      [0, -62],
      [43, -62],
      [51.4, -49],
      [51.6, -9],
      [51.6, 19],
      [51, 38],
      [50, 47],
      [42, 52],
      [37, 49],
      [33, 41],
      [28, 32],
      [20, 27],
      [10, 28],
      [0, 30],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const pistonGeo = new THREE.LatheGeometry(profile, 48);
    const bodyMaterial = m.castAluminumHead;
    parent.add(mesh(pistonGeo, bodyMaterial, { castShadow: true, receiveShadow: true }));
    // ring grooves and rings
    const ringMat = m.darkSteel;
    for (let i = 0; i < 3; i++) {
      parent.add(
        cylinder(51.9, 51.9, 3.1, ringMat, {
          radial: 48,
          position: [0, 35 - i * 7.4, 0],
          castShadow: false,
        }),
      );
    }
    // combustion bowl lip highlight / soot
    const soot = mesh(
      new THREE.LatheGeometry(
        [
          [0, 30],
          [10, 28],
          [20, 27],
          [27, 31],
          [32, 39],
          [36, 45],
          [43, 47],
          [50, 47],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        48,
      ),
      m.carbon,
      { castShadow: false, receiveShadow: true },
    );
    parent.add(soot);
    // wrist pin and circlips
    parent.add(
      cylinder(15.5, 15.5, 99, m.polishedSteel, {
        radial: 24,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, 0],
      }),
    );
    for (const side of [-1, 1]) {
      parent.add(
        torus(13.7, 1.4, m.blackOxide, {
          position: [0, 0, side * 50],
          tubularSeg: 24,
          radialSeg: 5,
          castShadow: false,
        }),
      );
    }
    // skirt oil squirt notch
    parent.add(
      roundedBox(22, 18, 8, 2, m.castAluminumHead, {
        position: [0, -47, 49],
        segments: 1,
        castShadow: false,
      }),
    );
  }

  _buildRod(parent) {
    const m = this.mats;
    const rod = new THREE.Group();
    parent.add(rod);
    // big end eye
    rod.add(
      mesh(
        new THREE.TorusGeometry(37.5, 12.5, 10, 30),
        m.forgedSteel,
        { castShadow: true, receiveShadow: true },
      ),
    );
    rod.add(
      torus(31.5, 2.1, m.polishedSteel, {
        tubularSeg: 28,
        radialSeg: 6,
        castShadow: false,
      }),
    );
    // I-beam shank
    const shank = new THREE.Group();
    rod.add(shank);
    shank.add(
      roundedBox(25, 150, 12, 5, m.forgedSteel, {
        position: [0, 94, 0],
        segments: 2,
      }),
    );
    shank.add(
      roundedBox(12, 144, 21, 4, m.forgedSteel, {
        position: [0, 94, 0],
        segments: 1,
      }),
    );
    for (const side of [-1, 1]) {
      shank.add(
        roundedBox(8, 148, 4, 2, m.forgedSteel, {
          position: [side * 10, 94, 11.4],
          segments: 1,
          castShadow: false,
        }),
      );
    }
    // small end eye
    rod.add(
      torus(24.5, 9.5, m.forgedSteel, {
        position: [0, 184, 0],
        tubularSeg: 26,
        radialSeg: 8,
      }),
    );
    rod.add(
      torus(16.5, 2.1, m.polishedSteel, {
        position: [0, 184, 0],
        tubularSeg: 24,
        radialSeg: 5,
        castShadow: false,
      }),
    );
    // fracture split cap line
    rod.add(
      box(78, 1.4, 19, m.blackOxide, {
        position: [0, 0, 6.8],
        castShadow: false,
      }),
    );
    for (const side of [-1, 1]) {
      const bolt = new THREE.Group();
      bolt.position.set(side * 27, -32, 0);
      bolt.add(
        cylinder(8.5, 8.5, 7, m.boltSteel, {
          radial: 6,
          rotation: [Math.PI / 2, 0, 0],
          position: [0, 0, 20],
        }),
      );
      bolt.add(
        cylinder(6, 6, 7, m.boltSteel, {
          radial: 6,
          rotation: [Math.PI / 2, 0, 0],
          position: [0, 0, -20],
        }),
      );
      rod.add(bolt);
    }
    rod.add(
      roundedBox(28, 8, 18, 2, m.machinedAluminum, {
        position: [0, 85, 0],
        segments: 1,
        castShadow: false,
      }),
    );
    parent.add(rod);
    return rod;
  }

  _buildMainCaps() {
    const m = this.mats;
    const asm = this.makeAssembly('main-caps', this.entry.explode.offsets['main-caps']);
    const caps = this.createPart(asm, 'main-caps');
    for (let i = 0; i < MAIN_JOURNAL_Z.length; i++) {
      const z = MAIN_JOURNAL_Z[i];
      const cap = new THREE.Group();
      cap.position.set(0, 0, z);
      caps.add(cap);
      const half = mesh(
        new THREE.TorusGeometry(50, 24, 10, 26, Math.PI),
        m.castIronCap,
        { rotation: [0, 0, Math.PI], castShadow: true, receiveShadow: true },
      );
      cap.add(half);
      cap.add(
        mesh(
          new THREE.TorusGeometry(35.6, 3.2, 8, 26, Math.PI),
          m.brass,
          { rotation: [0, 0, Math.PI], position: [0, 0, 0], castShadow: false },
        ),
      );
      for (const side of [-1, 1]) {
        cap.add(
          roundedBox(44, 72, 50, 5, m.castIronCap, {
            position: [side * 55, -50, 0],
            segments: 2,
          }),
        );
        cap.add(
          roundedBox(18, 16, 66, 3, m.castIronCap, {
            position: [side * 66, -74, 0],
            segments: 1,
          }),
        );
        addBoltAt(cap, [side * 60, -43, 26], [0, 0, 1], 8, m.boltSteel);
        addBoltAt(cap, [side * 60, -43, -26], [0, 0, -1], 8, m.boltSteel);
        addBoltAt(cap, [side * 72, -77, 27], [0, 0, 1], 6.5, m.boltSteel);
        addBoltAt(cap, [side * 72, -77, -27], [0, 0, -1], 6.5, m.boltSteel);
      }
      cap.add(
        roundedBox(133, 23, 53, 4, m.castIronCap, {
          position: [0, -69, 0],
          segments: 1,
        }),
      );
      const capLabel = labelLines(
        [{ ...this.entry.look.labelStyles.capNumeral, text: `MAIN 0${i + 1}` }],
        { width: 512, height: 160, padding: 18 },
      );
      decal(cap, capLabel, 40, 12.5, [-22, -55, 27.2], [0, 0, 0], { roughness: 0.8 });
    }
  }

  /* -----------------------------------------------------------------------
     Camshaft and OHV timing
  ----------------------------------------------------------------------- */
  _prepareValveRows() {
    if (this.valveRows) return this.valveRows;
    const kinematics = this.kinematics;
    const rows = [];
    for (const c of kinematics.cylinders) {
      for (const type of ['intake', 'exhaust']) {
        const timing = kinematics.valveTiming[type];
        const zRocker = c.z + (type === 'intake' ? -20 : 20);
        const halfWidthCam = (timing.duration / 4) * DEG;
        const peakCrankDeg = c.fireAngle + timing.center;
        const camPeakRad = (peakCrankDeg * DEG) / 2;
        const bankAxisRad = c.bankAxisDeg * DEG;
        const valleySign = c.bank === 'R' ? 1 : -1;
        rows.push({
          cylinder: c,
          type,
          timing,
          z: zRocker,
          halfWidthCam,
          peakCrankDeg,
          lobeRotation: bankAxisRad - camPeakRad,
          bankAxisRad,
          valleySign,
          xValve: valleySign * (type === 'intake' ? 20 : -46),
          xPivot: valleySign * (type === 'intake' ? 54 : 28),
          xPush: valleySign * 78,
          pushArm: type === 'intake' ? 24 : 50,
          valveArm: type === 'intake' ? 34 : 74,
        });
      }
    }
    this.valveRows = rows;
    return rows;
  }

  _lobeProfileRadius(angle, halfWidth) {
    let a = wrapSignedDeg((angle * 180) / Math.PI, 360) * DEG;
    if (Math.abs(a) >= halfWidth) return CAM_BASE_RADIUS;
    return CAM_BASE_RADIUS + LOBE_LIFT * Math.cos((Math.PI * a) / (2 * halfWidth)) ** 2;
  }

  _makeLobeGeometry(halfWidth) {
    const shape = new THREE.Shape();
    const steps = 128;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * TAU;
      const r = this._lobeProfileRadius(a, halfWidth);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, 11.5, 0, TAU, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 15,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.9,
      bevelThickness: 0.9,
      curveSegments: 72,
    });
    geo.translate(0, 0, -7.5);
    return geo;
  }

  _buildCamshaft() {
    const m = this.mats;
    const asm = this.makeAssembly('camshaft', this.entry.explode.offsets.camshaft);
    const part = this.createPart(asm, 'camshaft');
    part.position.y = CAM_Y;
    const spin = new THREE.Group();
    this.markDynamic(spin);
    this.camSpin = spin;
    part.add(spin);
    const rows = this._prepareValveRows();

    // Main shaft and five bearing journals.
    spin.add(
      cylinder(17, 17, 592, m.nitridedSteel, {
        radial: 26,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, 0],
      }),
    );
    for (const z of [-260, -130, 0, 130, 260]) {
      spin.add(
        cylinder(28.5, 28.5, 30, m.machinedAluminum, {
          radial: 30,
          rotation: [Math.PI / 2, 0, 0],
          position: [0, 0, z],
        }),
      );
    }
    // Precision cam lobes.
    for (const row of rows) {
      const lobe = mesh(this._makeLobeGeometry(row.halfWidthCam), m.nitridedSteel, {
        castShadow: true,
        receiveShadow: true,
      });
      lobe.position.z = row.z;
      lobe.rotation.z = row.lobeRotation;
      spin.add(lobe);
      row.lobeMesh = lobe;
      // Laser-etched cylinder/valve index on the lobe flank.
      const idText = `${row.cylinder.number}${row.type === 'intake' ? 'I' : 'E'}`;
      const tex = labelLines(
        [{ ...this.entry.look.labelStyles.valveIndex, text: idText }],
        { width: 256, height: 128, padding: 8 },
      );
      decal(lobe, tex, 16, 8, [CAM_BASE_RADIUS - 5, 0, 8.1], [0, 0, 0], {
        roughness: 0.55,
      });
    }
    // Cam timing gear - exactly half the crank speed.
    const camGear = createGear(100, 23, 50, m.darkSteel);
    camGear.position.set(0, 0, 247);
    this.createPart(spin, 'timing-gears').add(camGear);
    spin.add(
      cylinder(24, 24, 48, m.machinedAluminum, {
        radial: 26,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, 268],
      }),
    );
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      addBoltAt(
        spin,
        [Math.cos(a) * 31, Math.sin(a) * 31, 285],
        [0, 0, 1],
        7,
        m.boltSteel,
      );
    }
  }

  /* -----------------------------------------------------------------------
     Heads, 32-valve OHV valvetrain, covers, injectors
  ----------------------------------------------------------------------- */
  _buildHeadsAndValvetrain() {
    this._prepareValveRows();
    const rows = this.valveRows;
    this.headAssemblies = {};
    this.coverAssemblies = {};
    this.injectors = [];
    this.injectorPoints = {};
    this.glowPlugs = [];
    this.combustionFlashes = [];
    this.injectionCones = [];

    for (const bank of ['R', 'L']) {
      const bankRotation = this.entry.layout.banks.find((bankSpec) => bankSpec.id === bank).rotationDeg;
      const rotation = bankRotation * DEG;
      const offset = this.entry.explode.offsets[`head-${bank}`];
      const asm = this.makeAssembly(`head-${bank}`, offset, rotation);
      this.headAssemblies[bank] = asm;
      const headPart = this.createPart(asm, bank === 'R' ? 'cylinder-head-right' : 'cylinder-head-left');
      this._buildHeadCastings(asm, headPart, bank, rows.filter((r) => r.cylinder.bank === bank));

      const valvePart = this.createPart(asm, 'valves');
      const lifterPart = this.createPart(asm, 'lifters');
      const pushPart = this.createPart(asm, 'pushrods');
      const rockerPart = this.createPart(asm, 'rockers');
      const bridgePart = this.createPart(asm, 'valve-bridges');
      this._buildValvetrain(asm, bank, rows.filter((r) => r.cylinder.bank === bank), {
        valvePart,
        lifterPart,
        pushPart,
        rockerPart,
        bridgePart,
      });
      this._buildInjectors(asm, bank, rows.filter((r) => r.cylinder.bank === bank));
      this._buildCombustionGlow(asm, bank, headPart);
      this._buildGlowPlugs(asm, bank, headPart);

      const coverOffset = this.entry.explode.offsets[`cover-${bank}`];
      const coverAsm = this.makeAssembly(`cover-${bank}`, coverOffset, rotation);
      this.coverAssemblies[bank] = coverAsm;
      const coverPart = this.createPart(coverAsm, 'valve-covers');
      this._buildValveCover(coverPart, bank);
    }
  }

  _buildHeadCastings(asm, headPart, bank, bankRows) {
    const m = this.mats;
    const valleySign = bank === 'R' ? 1 : -1;
    // Composite head gasket.
    asm.add(
      roundedBox(205, 4.2, 578, 3, m.copper, {
        position: [0, DECK_Y + 2.2, 0],
        segments: 1,
        castShadow: false,
      }),
    );
    // Main aluminum head casting, styled with an upper rocker rail.
    headPart.add(
      roundedBox(198, 90, 572, 12, m.headShell, {
        position: [0, 354, 0],
        segments: 3,
      }),
    );
    headPart.add(
      roundedBox(174, 21, 566, 7, m.headShell, {
        position: [0, 399, 0],
        segments: 2,
      }),
    );
    headPart.add(
      roundedBox(204, 40, 568, 9, m.headShell, {
        position: [0, 315, 0],
        segments: 2,
      }),
    );
    // Intake-side and exhaust-side port faces.
    for (const c of this.kinematics.cylinders) {
      if (c.bank !== bank) continue;
      // inboard intake port boss
      headPart.add(
        cylinder(27, 31, 26, m.headShell, {
          radial: 26,
          rotation: [0, 0, Math.PI / 2],
          position: [valleySign * 102, 362, c.z],
        }),
      );
      headPart.add(
        roundedBox(12, 68, 74, 6, m.machinedAluminum, {
          position: [valleySign * 108, 356, c.z],
          segments: 2,
          castShadow: false,
        }),
      );
      // outboard exhaust port flange
      headPart.add(
        cylinder(31, 35, 22, m.headShell, {
          radial: 26,
          rotation: [0, 0, Math.PI / 2],
          position: [-valleySign * 102, 354, c.z],
        }),
      );
      headPart.add(
        roundedBox(11, 80, 82, 5, m.castIronExhaust, {
          position: [-valleySign * 109, 354, c.z],
          segments: 1,
          castShadow: false,
        }),
      );
      // injector boss on the valley side of the head
      const injBoss = new THREE.Group();
      injBoss.position.set(valleySign * 94, 422, c.z);
      injBoss.add(
        cylinder(19, 23, 25, m.headShell, {
          radial: 22,
          position: [0, -16, 0],
          rotation: [0, 0, valleySign * 0.22],
        }),
      );
      headPart.add(injBoss);
      // 6 head studs around each bore
      for (const side of [-1, 1]) {
        for (const dz of [-42, 42]) {
          if ((side === 1) !== (dz === -42)) {
            addBoltAt(
              headPart,
              [side * 75, 401.8, c.z + dz * 1.32],
              [0, 1, 0],
              5.4,
              m.boltSteel,
            );
          }
        }
      }
    }
    // External cast ribs on the exhaust side.
    for (let i = 0; i < 8; i++) {
      headPart.add(
        roundedBox(12, 50, 18, 3, m.headShell, {
          position: [-valleySign * 101, 329, -244 + i * 69],
          segments: 1,
          castShadow: false,
        }),
      );
    }
    // Rocker pedestal bosses and oil drain rails.
    for (const z of [-238, -108, 26, 156, 264]) {
      headPart.add(
        roundedBox(124, 24, 36, 5, m.headShell, {
          position: [0, 407, z],
          segments: 2,
        }),
      );
    }
    headPart.add(
      tube(
        [
          [valleySign * 70, 406, -255],
          [valleySign * 70, 410, 0],
          [valleySign * 70, 406, 255],
        ],
        7,
        m.darkSteel,
        { segments: 26, radial: 9, castShadow: false },
      ),
    );
    // Sixteen valve guides / spring seats remain part of the casting.
    for (const row of bankRows) {
      for (const dz of [-17, 17]) {
        headPart.add(
          cylinder(11, 13, 32, m.machinedAluminum, {
            radial: 18,
            position: [row.xValve, 385, row.cylinder.z + dz],
            castShadow: false,
          }),
        );
        headPart.add(
          torus(15.5, 3.4, m.machinedAluminum, {
            rotation: [Math.PI / 2, 0, 0],
            position: [row.xValve, 405, row.cylinder.z + dz],
            tubularSeg: 20,
            radialSeg: 6,
            castShadow: false,
          }),
        );
      }
      // pushrod guide sleeve
      headPart.add(
        cylinder(12.5, 13.5, 28, m.machinedAluminum, {
          radial: 18,
          position: [row.xPush, 405, row.z],
          castShadow: false,
        }),
      );
    }
    // Front and rear covers / cam thrust plates.
    headPart.add(
      roundedBox(160, 87, 10, 5, m.headShell, {
        position: [0, 352, 287],
        segments: 2,
      }),
    );
    headPart.add(
      roundedBox(160, 87, 10, 5, m.headShell, {
        position: [0, 352, -287],
        segments: 2,
      }),
    );
    for (let i = 0; i < 9; i++) {
      addBoltAt(
        headPart,
        [-78 + i * 19.5, 352, 294],
        [0, 0, 1],
        5,
        m.boltSteel,
      );
    }
    // Casting inscription.
    const tex = labelLines(
      [
        this.entry.look.decals.head[0],
        this.entry.look.bankLabels.head[bank],
      ],
      { width: 1024, height: 220, padding: 26 },
    );
    decal(
      headPart,
      tex,
      120,
      26,
      [-valleySign * 100.5, 338, 195],
      [0, valleySign > 0 ? Math.PI / 2 : -Math.PI / 2, 0],
      { roughness: 0.8 },
    );
  }

  _buildValvetrain(asm, bank, bankRows, parts) {
    const m = this.mats;
    const valleySign = bank === 'R' ? 1 : -1;
    const camLocalX = valleySign * (CAM_Y / Math.SQRT2);
    const lifterBaseY = CAM_Y / Math.SQRT2 + CAM_BASE_RADIUS + ROLLER_RADIUS;

    // Two rocker shafts per head.
    for (const type of ['intake', 'exhaust']) {
      const x = valleySign * (type === 'intake' ? 54 : 28);
      const shaftLen = 566;
      parts.rockerPart.add(
        cylinder(8.5, 8.5, shaftLen, m.polishedSteel, {
          radial: 20,
          rotation: [Math.PI / 2, 0, 0],
          position: [x, 456, 0],
        }),
      );
      for (const z of [-270, -136, 0, 136, 270]) {
        parts.rockerPart.add(
          roundedBox(28, 46, 22, 3, m.castAluminum, {
            position: [x, 438, z],
            segments: 1,
            castShadow: false,
          }),
        );
      }
    }

    for (const row of bankRows) {
      const c = row.cylinder;
      const typeIsIntake = row.type === 'intake';
      // Mechanical roller lifter.
      const lifter = new THREE.Group();
      lifter.position.set(camLocalX, lifterBaseY, row.z);
      this.markDynamic(lifter);
      parts.lifterPart.add(lifter);
      lifter.add(
        roundedBox(28, 77, 25, 6, m.forgedSteel, {
          position: [0, 45, 0],
          segments: 2,
        }),
      );
      lifter.add(
        cylinder(10.5, 10.5, 18, m.polishedSteel, {
          radial: 20,
          rotation: [0, 0, Math.PI / 2],
          position: [0, 4, 0],
        }),
      );
      lifter.add(
        torus(12, 2, m.blackOxide, {
          rotation: [0, Math.PI / 2, 0],
          position: [0, 5, 0],
          tubularSeg: 18,
          radialSeg: 5,
          castShadow: false,
        }),
      );
      lifter.add(
        cylinder(8, 10, 9, m.machinedAluminum, {
          radial: 16,
          position: [0, 88, 0],
        }),
      );
      lifter.add(
        roundedBox(44, 12, 8, 2, m.darkSteel, {
          position: [0, 28, 18],
          segments: 1,
          castShadow: false,
        }),
      );

      // Pushrod, one per bridged valve pair.
      const rodGroup = new THREE.Group();
      this.markDynamic(rodGroup);
      parts.pushPart.add(rodGroup);
      const baseLength = 222;
      const rodCore = cylinder(4.7, 4.7, baseLength, m.forgedSteel, {
        radial: 14,
        position: [0, baseLength / 2, 0],
      });
      const ballBottom = mesh(new THREE.SphereGeometry(7.2, 12, 8), m.polishedSteel, {
        position: [0, 1, 0],
      });
      const ballTop = mesh(new THREE.SphereGeometry(6.6, 12, 8), m.polishedSteel, {
        position: [0, baseLength - 1, 0],
      });
      rodGroup.add(rodCore, ballBottom, ballTop);
      rodGroup.add(
        cylinder(6, 6, 24, m.darkSteel, {
          radial: 14,
          position: [0, baseLength - 20, 0],
          castShadow: false,
        }),
      );
      rodGroup.add(
        cylinder(6.2, 6.2, 14, m.darkSteel, {
          radial: 14,
          position: [0, 20, 0],
          castShadow: false,
        }),
      );

      // Rocker arm.
      const rocker = new THREE.Group();
      rocker.position.set(row.xPivot, 456, row.z);
      this.markDynamic(rocker);
      parts.rockerPart.add(rocker);
      const dxPush = row.xPush - row.xPivot;
      const dxValve = row.xValve - row.xPivot;
      const zToBridge = c.z - row.z;
      const armLen = Math.abs(dxValve - dxPush) + 26;
      const hub = cylinder(14.5, 14.5, 36, m.forgedSteel, {
        radial: 26,
        rotation: [Math.PI / 2, 0, 0],
      });
      rocker.add(hub);
      const armCenter = (dxPush + dxValve) / 2;
      rocker.add(
        roundedBox(armLen, 15, 19, 5, m.forgedSteel, {
          position: [armCenter, 1, zToBridge * 0.55],
          segments: 2,
        }),
      );
      // pushrod cup and adjuster
      rocker.add(
        cylinder(8.5, 10, 13, m.forgedSteel, {
          radial: 18,
          position: [dxPush, 6, 0],
        }),
      );
      rocker.add(
        cylinder(4.8, 4.8, 21, m.blackOxide, {
          radial: 12,
          position: [dxPush, 17, 0],
        }),
      );
      rocker.add(
        cylinder(10, 10, 5, m.boltSteel, {
          radial: 6,
          position: [dxPush, 28, 0],
          castShadow: false,
        }),
      );
      // wide pad, roller tip and bridge contact
      rocker.add(
        roundedBox(19, 8, Math.abs(zToBridge) + 32, 3, m.polishedSteel, {
          position: [dxValve, -4, zToBridge],
          segments: 2,
        }),
      );
      rocker.add(
        cylinder(7.5, 7.5, 22, m.machinedAluminum, {
          radial: 18,
          rotation: [Math.PI / 2, 0, 0],
          position: [dxValve, -4, zToBridge + 1],
        }),
      );
      // stamped rocker identification
      const rt = labelLines(
        [{ ...this.entry.look.labelStyles.rockerMark, text: typeIsIntake ? 'I' : 'E' }],
        { width: 128, height: 128, padding: 10 },
      );
      decal(rocker, rt, 13, 13, [armCenter + 5, 8.2, zToBridge * 0.55], [-Math.PI / 2, 0, 0], {
        roughness: 0.8,
      });

      // Bridge and two valves.
      const bridge = new THREE.Group();
      bridge.position.set(row.xValve, VALVE_TIP_Y, c.z);
      this.markDynamic(bridge);
      parts.bridgePart.add(bridge);
      bridge.add(
        roundedBox(25, 8, 53, 2.4, m.forgedSteel, {
          position: [0, 4, 0],
          segments: 2,
        }),
      );
      bridge.add(
        roundedBox(15, 8, 15, 2, m.machinedAluminum, {
          position: [0, 10, 0],
          segments: 1,
          castShadow: false,
        }),
      );
      bridge.add(
        cylinder(5.2, 5.2, 13, m.blackOxide, {
          radial: 6,
          position: [0, 17, 0],
          castShadow: false,
        }),
      );
      for (const dz of [-17, 17]) {
        bridge.add(
          cylinder(5.2, 5.2, 8, m.polishedSteel, {
            radial: 14,
            position: [0, -1, dz],
          }),
        );
      }

      const rowValves = [];
      for (const dz of [-17, 17]) {
        const valveZ = c.z + dz;
        const valveGroup = new THREE.Group();
        valveGroup.position.set(row.xValve, VALVE_TIP_Y, valveZ);
        this.markDynamic(valveGroup);
        parts.valvePart.add(valveGroup);
        // valve stem and tulip head
        valveGroup.add(
          cylinder(4.2, 4.2, 136, m.polishedSteel, {
            radial: 16,
            position: [0, -68, 0],
          }),
        );
        const headGeo = new THREE.LatheGeometry(
          [
            [0, -140],
            [10, -142],
            [19.2, -137],
            [20.7, -133],
            [18, -130],
            [6, -128],
            [0, -127],
          ].map(([x, y]) => new THREE.Vector2(x, y)),
          28,
        );
        const valveMaterial = typeIsIntake ? m.polishedSteel : m.heatShield;
        valveGroup.add(mesh(headGeo, valveMaterial, { castShadow: true, receiveShadow: true }));
        valveGroup.add(
          cylinder(14, 15.5, 7, m.machinedAluminum, {
            radial: 22,
            position: [0, -11, 0],
          }),
        );
        valveGroup.add(
          torus(10.2, 2.3, m.blackOxide, {
            rotation: [Math.PI / 2, 0, 0],
            position: [0, -16, 0],
            tubularSeg: 20,
            radialSeg: 5,
            castShadow: false,
          }),
        );
        // spring is separately compressed
        const springGroup = new THREE.Group();
        springGroup.position.set(row.xValve, 388, valveZ);
        this.markDynamic(springGroup);
        const spring = createSpring(13, 47, 1.8, 6.5, m.darkSteel);
        springGroup.add(spring);
        parts.valvePart.add(springGroup);
        rowValves.push({
          motion: valveGroup,
          springGroup,
          spring,
          springBaseLength: 47,
        });
      }
      row.valves = rowValves;
      row.lifter = lifter;
      row.lifterBaseY = lifterBaseY;
      row.pushrod = rodGroup;
      row.pushrodBaseLength = baseLength;
      row.rocker = rocker;
      row.bridge = bridge;
      row.camContact = 0;
      row.currentValveLift = 0;
    }

    // Oil troughs and valve-bridge guide pins.
    parts.bridgePart.add(
      tube(
        [
          [valleySign * 24, 399, -255],
          [valleySign * 24, 402, 0],
          [valleySign * 24, 399, 255],
        ],
        5,
        m.darkSteel,
        { segments: 20, radial: 7, castShadow: false },
      ),
    );

    // Each follower assembly is rigid: bake its sub-meshes into one local
    // geometry so a 32-valve head does not pay dozens of draw calls per row.
    for (const row of bankRows) {
      this._mergeRigidGroup(row.lifter, m.nitridedSteel);
      this._mergeRigidGroup(row.pushrod, m.polishedSteel);
      this._mergeRigidGroup(row.rocker, m.forgedSteel);
      this._mergeRigidGroup(row.bridge, m.forgedSteel);
      for (const v of row.valves) this._mergeRigidGroup(v.motion, m.polishedSteel);
    }
  }

  _mergeRigidGroup(group, material = null) {
    if (!group) return;
    group.traverse((o) => {
      if (!o.isMesh) return;
      if (Array.isArray(o.material)) return;
      if (o.material?.transparent) return; // preserve etched labels
      if (material) o.material = material;
      o.castShadow = false;
      o.receiveShadow = true;
    });
    mergeStaticMeshes(group);
  }

  _buildCombustionGlow(asm, bank, headPart) {
    const radial = makeGlowSpriteTexture();
    for (const c of this.kinematics.cylinders) {
      if (c.bank !== bank) continue;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: radial,
          color: this.entry.look.effects.combustionGlow,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: true,
        }),
      );
      sprite.position.set(0, DECK_Y - 14, c.z);
      sprite.scale.set(42, 42, 1);
      asm.add(sprite);
      const coneMat = this.m.injection.clone();
      coneMat.opacity = 0;
      const cone = mesh(
        new THREE.ConeGeometry(5.5, 25, 14, 1, true),
        coneMat,
        {
          position: [0, DECK_Y - 20, c.z],
          castShadow: false,
          receiveShadow: false,
        },
      );
      cone.rotation.x = Math.PI;
      asm.add(cone);
      this.combustionFlashes.push({ c, sprite, cone, coneMat });
    }
  }

  _buildInjectors(asm, bank, rows) {
    const m = this.mats;
    const valleySign = bank === 'R' ? 1 : -1;
    const part = this.createPart(asm, 'injectors');
    for (const row of rows.filter((r) => r.type === 'intake')) {
      const c = row.cylinder;
      const inj = new THREE.Group();
      part.add(inj);
      const top = new THREE.Vector3(valleySign * 102, 428, c.z);
      const tip = new THREE.Vector3(valleySign * 12, DECK_Y - 2, c.z);
      const bodyTop = new THREE.Vector3(valleySign * 86, 397, c.z);
      inj.add(
        cylinderBetween(bodyTop, tip, 9, m.forgedSteel, {
          radial: 16,
        }),
      );
      inj.add(
        cylinderBetween(top, bodyTop, 12, m.darkSteel, {
          radial: 18,
        }),
      );
      inj.add(
        cylinder(17, 17, 22, m.blackOxide, {
          radial: 6,
          position: [valleySign * 102, 437, c.z],
          rotation: [0, 0, -valleySign * 0.22],
        }),
      );
      // Bosch solenoid connector stack
      inj.add(
        roundedBox(28, 22, 22, 4, m.blackPlastic, {
          position: [valleySign * 102, 453, c.z],
          segments: 2,
        }),
      );
      inj.add(
        cylinder(7, 7, 12, m.brass, {
          radial: 6,
          position: [valleySign * 88, 440, c.z],
          rotation: [0, 0, Math.PI / 2],
          castShadow: false,
        }),
      );
      // high-pressure inlet fitting
      inj.add(
        cylinderBetween(
          [valleySign * 102, 437, c.z],
          [valleySign * 124, 463, c.z],
          5.5,
          m.copper,
          { radial: 12 },
        ),
      );
      const glowMat = new THREE.MeshBasicMaterial({
        color: this.entry.look.effects.injectorGlow,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      inj.add(
        cylinder(16.5, 16.5, 1.8, glowMat, {
          radial: 22,
          position: [valleySign * 102, 459.5, c.z],
          castShadow: false,
          receiveShadow: false,
        }),
      );
      const micro = labelLines(
        [
          this.entry.look.decals.injectors[0],
          this.entry.look.decals.injectors[1],
        ],
        { width: 512, height: 200, padding: 12 },
      );
      decal(inj, micro, 25, 10, [valleySign * 102, 463.6, c.z + 11.2], [0, 0, 0], {
        roughness: 0.65,
      });
      // spray nozzle glow at the tip
      const nozzleMat = m.injection.clone();
      nozzleMat.opacity = 0;
      inj.add(
        cylinder(8, 3.5, 18, nozzleMat, {
          radial: 14,
          position: [valleySign * 8, DECK_Y - 9, c.z],
          castShadow: false,
          receiveShadow: false,
        }),
      );
      this.injectors.push({ cylinder: c, group: inj, glowMat, nozzleMat, tip });
      // Store the fitting position in engine-root coordinates for the fuel lines.
      const rot = c.bankRotationDeg * DEG;
      const lx = valleySign * 124;
      const ly = 463;
      this.injectorPoints[c.number] = new THREE.Vector3(
        lx * Math.cos(rot) - ly * Math.sin(rot),
        lx * Math.sin(rot) + ly * Math.cos(rot),
        c.z,
      );
    }
  }

  _buildGlowPlugs(asm, bank, headPart) {
    const m = this.mats;
    const outboardSign = bank === 'R' ? -1 : 1;
    const glowPart = this.createPart(asm, 'glow-plugs');
    for (const c of this.kinematics.cylinders) {
      if (c.bank !== bank) continue;
      const g = new THREE.Group();
      g.position.set(outboardSign * 105, 336, c.z);
      g.rotation.z = outboardSign * 0.38;
      const mat = m.glowPlug.clone();
      g.add(
        cylinder(8.5, 6.4, 50, mat, {
          radial: 14,
          rotation: [0, 0, Math.PI / 2],
          position: [0, 0, 0],
        }),
      );
      g.add(
        cylinder(10, 10, 15, m.brass, {
          radial: 6,
          rotation: [0, 0, Math.PI / 2],
          position: [32, 0, 0],
        }),
      );
      g.add(
        roundedBox(16, 13, 13, 2.5, m.blackPlastic, {
          position: [43, 0, 0],
          segments: 1,
        }),
      );
      g.add(
        cylinderBetween([43, 3, 0], [69, 22, 0], 1.7, m.copper, { radial: 8 }),
      );
      glowPart.add(g);
      this.glowPlugs.push({ cylinder: c, group: g, material: mat });
    }
    // One glow harness trunk per bank.
    const harnessMat = m.rubber;
    const pts = [];
    for (const c of this.kinematics.cylinders) {
      if (c.bank !== bank) continue;
      pts.push([outboardSign * 128, 382, c.z]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      glowPart.add(tube([pts[i], [outboardSign * 136, 402, (pts[i][2] + pts[i + 1][2]) / 2], pts[i + 1]], 4.3, harnessMat, { segments: 16, radial: 8, castShadow: false }));
    }
  }

  _buildValveCover(coverPart, bank) {
    const m = this.mats;
    const cover = new THREE.Group();
    coverPart.add(cover);
    // A cast aluminum outer shell with a rounded top and gasket rail.
    cover.add(
      roundedBox(178, 22, 544, 8, m.coverShell, {
        position: [0, 510, 0],
        segments: 3,
      }),
    );
    for (const side of [-1, 1]) {
      cover.add(
        roundedBox(9, 102, 540, 3, m.coverShell, {
          position: [side * 85, 457, 0],
          segments: 2,
        }),
      );
    }
    cover.add(
      roundedBox(168, 96, 10, 4, m.coverShell, {
        position: [0, 455, 266],
        segments: 2,
      }),
    );
    cover.add(
      roundedBox(168, 96, 10, 4, m.coverShell, {
        position: [0, 455, -266],
        segments: 2,
      }),
    );
    cover.add(
      roundedBox(182, 9, 550, 4, m.castAluminum, {
        position: [0, 406, 0],
        segments: 1,
      }),
    );
    // Raised longitudinal rails in machined aluminium contrast the dark cover.
    for (const x of [-66, 66]) {
      cover.add(
        roundedBox(10, 4, 514, 1.8, m.castAluminum, {
          position: [x, 522, 0],
          segments: 1,
          castShadow: false,
        }),
      );
    }
    // Machined perimeter bead.
    cover.add(
      roundedBox(154, 3, 506, 1.5, m.machinedAluminum, {
        position: [0, 521.2, 0],
        segments: 1,
        castShadow: false,
      }),
    );
    // The LLY valve covers carry a long wordmark plaque running fore–aft.
    const plaque = roundedBox(66, 7, 306, 3.2, m.machinedAluminum, {
      position: [0, 524.2, 16],
      segments: 2,
      castShadow: false,
    });
    cover.add(plaque);
    cover.add(
      box(2.5, 1.6, 292, m.standYellow, {
        position: [29, 528.2, 16],
        castShadow: false,
      }),
    );
    const plaqueLabel = labelLines(
      [
        this.entry.look.decals.valveCover[0],
        this.entry.look.decals.valveCover[1],
      ],
      { width: 1600, height: 300, padding: 30, background: 'transparent' },
    );
    const labelGroup = new THREE.Group();
    labelGroup.position.set(0, 528.6, 16);
    labelGroup.rotation.y = Math.PI / 2;
    coverPart.add(labelGroup);
    const labelPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(282, 52.9),
      new THREE.MeshBasicMaterial({
        map: plaqueLabel,
        transparent: true,
        alphaTest: 0.02,
        depthWrite: false,
        toneMapped: true,
      }),
    );
    labelPlane.rotation.x = -Math.PI / 2;
    labelPlane.castShadow = false;
    labelPlane.receiveShadow = false;
    labelGroup.add(labelPlane);
    this.coverLabels = this.coverLabels || [];
    this.coverLabels.push(labelPlane);
    // Dark gasket rail separating the cast cover from the head.
    cover.add(
      roundedBox(185, 5.5, 554, 3, m.rubber, {
        position: [0, 404.5, 0],
        segments: 1,
        castShadow: false,
      }),
    );
    // Bank / cylinder identification plate on the front cover face.
    const bankTex = labelLines(
      [
        this.entry.look.bankLabels.bank[bank],
        this.entry.look.bankLabels.side[bank],
      ],
      { width: 1200, height: 230, padding: 20, background: 'transparent' },
    );
    const bankBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 27),
      new THREE.MeshBasicMaterial({
        map: bankTex,
        transparent: true,
        alphaTest: 0.02,
        depthWrite: false,
        toneMapped: true,
      }),
    );
    bankBadge.position.set(0, 467, 272.2);
    coverPart.add(bankBadge);
    this.coverLabels = this.coverLabels || [];
    this.coverLabels.push(bankBadge);
    cover.add(
      roundedBox(136, 34, 3, 2, m.machinedAluminum, {
        position: [0, 467, 270.4],
        segments: 1,
        castShadow: false,
      }),
    );
    // Oil filler, front inboard.
    const valleySign = bank === 'R' ? 1 : -1;
    cover.add(
      cylinder(26, 28, 17, m.coverShell, {
        radial: 28,
        position: [valleySign * 48, 526, 195],
      }),
    );
    cover.add(
      cylinder(21, 23, 9, m.blackOxide, {
        radial: 28,
        position: [valleySign * 48, 537, 195],
      }),
    );
    cover.add(
      torus(12, 2.5, m.blackOxide, {
        rotation: [Math.PI / 2, 0, 0],
        position: [valleySign * 48, 542, 195],
        tubularSeg: 24,
        radialSeg: 5,
        castShadow: false,
      }),
    );
    // PCV / breather fittings
    for (const z of [-202, 211]) {
      cover.add(
        cylinder(11, 12, 22, m.blackPlastic, {
          radial: 18,
          position: [valleySign * 54, 520, z],
        }),
      );
      cover.add(
        torus(10, 3, m.rubber, {
          rotation: [Math.PI / 2, 0, 0],
          position: [valleySign * 54, 532, z],
          tubularSeg: 20,
          radialSeg: 5,
        }),
      );
    }
    // perimeter shoulder bolts
    for (let i = 0; i < 7; i++) {
      const z = -238 + i * 79;
      for (const side of [-1, 1]) {
        addBoltAt(
          coverPart,
          [side * 90, 414, z],
          [0, 1, 0.02],
          6.8,
          m.boltSteel,
        );
      }
    }
    for (const z of [-252, 252]) {
      for (const x of [-58, 58]) {
        addBoltAt(coverPart, [x, 414, z], [0, 1, 0], 6.8, m.boltSteel);
      }
    }
    // cover sticker
    const caution = makeLabelTexture(
      [
        this.entry.look.decals.coverCaution[0],
        this.entry.look.decals.coverCaution[1],
      ],
      { width: 1000, height: 190, background: '#181a17', border: true, accent: '#c9a150', padding: 24 },
    );
    decal(coverPart, caution, 120, 22.8, [valleySign * 91, 466, -120], [0, valleySign > 0 ? Math.PI / 2 : -Math.PI / 2, 0], {
      roughness: 0.5,
    });
    this.coverRoots = this.coverRoots || [];
    this.coverRoots.push(coverPart);
  }

  /* -----------------------------------------------------------------------
     Lubrication / pan / filter
  ----------------------------------------------------------------------- */
  _buildOilPan() {
    const m = this.mats;
    const asm = this.makeAssembly('oil-pan', this.entry.explode.offsets['oil-pan']);
    const part = this.createPart(asm, 'oil-pan');
    const panMat = m.wrinkleBlack;
    part.add(
      roundedBox(320, 38, 570, 8, panMat, {
        position: [0, -276, 0],
        segments: 2,
      }),
    );
    part.add(
      roundedBox(290, 92, 530, 18, panMat, {
        position: [0, -337, -8],
        segments: 3,
      }),
    );
    part.add(
      roundedBox(230, 39, 420, 12, panMat, {
        position: [0, -397, -30],
        segments: 2,
      }),
    );
    // cast ribs
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        part.add(
          roundedBox(12, 64, 26, 3, panMat, {
            position: [side * 144, -342, -175 + i * 112],
            segments: 1,
            castShadow: false,
          }),
        );
      }
    }
    for (let i = 0; i < 15; i++) {
      const x = -230 + (i % 6) * 92;
      const z = -252 + Math.floor(i / 6) * 248;
      if (Math.abs(x) > 150) continue;
      addBoltAt(part, [x, -292, z], [0, 1, 0], 5.6, m.boltSteel);
    }
    // drain plug and oil-level sensor
    part.add(
      cylinder(11, 11, 12, m.brass, {
        radial: 6,
        position: [75, -419, -190],
        castShadow: false,
      }),
    );
    part.add(
      torus(10, 3.2, m.blackOxide, {
        rotation: [Math.PI / 2, 0, 0],
        position: [75, -426, -190],
        tubularSeg: 18,
        radialSeg: 5,
      }),
    );
    part.add(
      cylinder(14, 14, 46, m.blackPlastic, {
        radial: 18,
        position: [-82, -341, 255],
        rotation: [Math.PI / 2, 0, 0],
      }),
    );
    const panLabel = labelLines(
      [
        this.entry.look.decals.oilPan[0],
        this.entry.look.decals.oilPan[1],
      ],
      { width: 850, height: 240, padding: 30 },
    );
    decal(part, panLabel, 130, 36, [0, -390, 212], [-Math.PI / 2, 0, 0], {
      roughness: 0.75,
    });
  }

  _buildOilFilter() {
    const m = this.mats;
    const asm = this.makeAssembly('oil-filter', this.entry.explode.offsets['oil-filter']);
    const part = this.createPart(asm, 'oil-filter');
    // Driver-side (+X) spin-on filter mounted mid-block between the front and
    // rear engine mounts for unobstructed clearance and inspection.
    const filterZ = 10;
    const filterY = -196;
    const mount = new THREE.Group();
    mount.position.set(184, filterY, filterZ);
    part.add(mount);
    mount.add(
      roundedBox(38, 104, 110, 10, m.castAluminum, {
        position: [0, 0, 0],
        segments: 3,
      }),
    );
    mount.add(
      cylinder(19, 24, 42, m.machinedAluminum, {
        radial: 28,
        rotation: [0, 0, Math.PI / 2],
        position: [22, 0, 0],
      }),
    );
    mount.add(
      cylinder(12, 12, 16, m.brass, {
        radial: 16,
        rotation: [0, 0, Math.PI / 2],
        position: [46, 16, 16],
      }),
    );
    addBoltAt(part, [172, filterY + 46, filterZ], [1, 0, 0], 6.5, m.boltSteel);
    addBoltAt(part, [172, filterY - 46, filterZ], [1, 0, 0], 6.5, m.boltSteel);

    const filterLabel = makeLabelTexture(
      [
        this.entry.look.decals.oilFilter[0],
        this.entry.look.decals.oilFilter[1],
        this.entry.look.decals.oilFilter[2],
      ],
      { width: 1024, height: 256, background: '#174b70', padding: 48, border: true, accent: '#d8dcd9' },
    );
    const sideMat = new THREE.MeshPhysicalMaterial({
      map: filterLabel,
      metalness: 0.52,
      roughness: 0.31,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: this.entry.look.palette.oilFilterCap,
      metalness: 0.6,
      roughness: 0.3,
    });
    const canGeo = new THREE.CylinderGeometry(45, 45, 142, 40, 1, false);
    const can = mesh(canGeo, [sideMat, capMat, capMat], {
      rotation: [0, 0, Math.PI / 2],
      position: [276, filterY, filterZ],
    });
    can.castShadow = true;
    can.receiveShadow = true;
    part.add(can);
    part.add(
      cylinder(47, 47, 10, m.blackOxide, {
        radial: 38,
        rotation: [0, 0, Math.PI / 2],
        position: [212, filterY, filterZ],
        castShadow: true,
      }),
    );
    // Gasket-free paint band and service stamp on the nose.
    part.add(
      torus(46.2, 1.8, m.machinedAluminum, {
        rotation: [0, Math.PI / 2, 0],
        position: [224, filterY, filterZ],
        tubularSeg: 40,
        radialSeg: 5,
        castShadow: false,
      }),
    );
    // Filter hoses to the block and oil cooler.
    part.add(
      tube(
        [
          [198, filterY + 42, filterZ],
          [214, filterY + 68, filterZ + 28],
          [202, filterY + 95, filterZ + 66],
          [176, filterY + 112, filterZ + 96],
        ],
        6.5,
        m.rubber,
        { segments: 20, radial: 8, castShadow: false },
      ),
    );
    part.add(
      tube(
        [
          [198, filterY - 42, filterZ],
          [212, filterY - 56, filterZ - 28],
          [192, filterY - 58, filterZ - 68],
        ],
        6.5,
        m.braided,
        { segments: 20, radial: 8, castShadow: false },
      ),
    );
    const filterPlate = labelLines(
      [
        this.entry.look.decals.oilFilterPlate[0],
        this.entry.look.decals.oilFilterPlate[1],
      ],
      { width: 640, height: 240, background: '#171b18', border: true, accent: '#8e743b', padding: 18 },
    );
    decal(part, filterPlate, 76, 28.5, [203.2, filterY, filterZ + 55.6], [0, 0, 0], { roughness: 0.55 });
  }

  /* -----------------------------------------------------------------------
     Front drive
  ----------------------------------------------------------------------- */
  _buildFrontDrive() {
    const m = this.mats;
    const asm = this.makeAssembly('front-drive', this.entry.explode.offsets['front-drive']);
    const part = this.createPart(asm, 'front-drive');
    const frontCoverMat = m.castAluminum.clone();
    frontCoverMat.color.setHex(this.entry.look.palette.frontCover);
    frontCoverMat.roughness = 0.5;
    frontCoverMat.metalness = 0.72;
    // Cast gear cover with a contoured, lobed outline rather than a simple box.
    const outline = new THREE.Shape();
    outline.moveTo(-126, -174);
    outline.quadraticCurveTo(-160, -174, -166, -138);
    outline.lineTo(-169, -38);
    outline.quadraticCurveTo(-170, 28, -153, 74);
    outline.lineTo(-116, 150);
    outline.quadraticCurveTo(-103, 174, -72, 178);
    outline.lineTo(90, 178);
    outline.quadraticCurveTo(130, 178, 146, 142);
    outline.lineTo(169, 66);
    outline.quadraticCurveTo(176, 22, 170, -22);
    outline.lineTo(160, -136);
    outline.quadraticCurveTo(156, -164, 126, -170);
    outline.lineTo(-98, -176);
    outline.closePath();
    const outerCover = extrudeShape(outline, 42, frontCoverMat, {
      bevel: true,
      bevelSize: 2.6,
      bevelThickness: 2.6,
      bevelSegments: 2,
      castShadow: true,
      receiveShadow: true,
    });
    outerCover.position.set(0, 0, 326);
    part.add(outerCover);
    // Raised central casting around the gear train.
    const innerShape = new THREE.Shape();
    innerShape.moveTo(-104, -152);
    innerShape.quadraticCurveTo(-128, -152, -130, -124);
    innerShape.lineTo(-128, 26);
    innerShape.quadraticCurveTo(-127, 54, -104, 63);
    innerShape.lineTo(55, 117);
    innerShape.quadraticCurveTo(99, 127, 116, 91);
    innerShape.lineTo(126, -36);
    innerShape.quadraticCurveTo(130, -66, 102, -80);
    innerShape.lineTo(-61, -148);
    innerShape.closePath();
    const innerCover = extrudeShape(innerShape, 24, m.castAluminum, {
      bevel: true,
      bevelSize: 2,
      bevelThickness: 2,
      bevelSegments: 2,
      castShadow: true,
    });
    innerCover.position.set(4, -2, 351);
    part.add(innerCover);
    // Perimeter fasteners follow the casting contour.
    const coverBolts = [
      [-132, -146],
      [-154, -92],
      [-161, 4],
      [-146, 96],
      [-106, 152],
      [-45, 163],
      [38, 163],
      [99, 147],
      [138, 100],
      [158, 18],
      [159, -72],
      [143, -142],
      [74, -164],
      [-58, -164],
    ];
    for (const [x, y] of coverBolts) {
      addBoltAt(part, [x, y, 348], [0, 0, 1], 6.4, m.boltSteel);
    }

    // Water pump and pulley, high on the gear cover.
    part.add(
      roundedBox(126, 106, 52, 18, m.castAluminum, {
        position: [0, 156, 354],
        segments: 2,
      }),
    );
    const waterPulley = createPulley(50, 28, m.machinedAluminum, {
      spokes: 4,
      grooveMat: m.darkSteel,
    });
    waterPulley.position.set(0, 156, 386);
    this.markDynamic(waterPulley);
    this.accessoryPulleys.push({ group: waterPulley, ratio: -92 / 50 });
    part.add(waterPulley);
    const waterHub = cylinder(17, 17, 42, m.machinedAluminum, {
      radial: 18,
      rotation: [Math.PI / 2, 0, 0],
      position: [0, 156, 372],
    });
    part.add(waterHub);
    part.add(
      cylinder(22, 26, 38, m.castAluminum, {
        radial: 22,
        position: [44, 204, 356],
        rotation: [0, 0, -0.32],
      }),
    );
    // Idler and tensioner pulleys, animated with the serpentine belt.
    for (const [x, y, r, dir] of [
      [-108, 102, 30, -1],
      [114, 52, 32, 1],
      [-114, -68, 32, 1],
    ]) {
      const p = createPulley(r, 24, m.darkSteel, { spokes: 3 });
      p.position.set(x, y, 386);
      this.markDynamic(p);
      this.accessoryPulleys.push({ group: p, ratio: dir * (92 / r) });
      part.add(p);
      part.add(
        cylinder(15, 15, 22, m.machinedAluminum, {
          radial: 18,
          rotation: [Math.PI / 2, 0, 0],
          position: [x, y, 372],
        }),
      );
    }
    // Alternator, high on the passenger side (−X). Its pulley shares the front
    // accessory belt plane (z = 386) with the damper and water pump.
    const alt = new THREE.Group();
    alt.position.set(-197, 178, 302);
    part.add(alt);
    alt.add(
      roundedBox(125, 125, 128, 27, m.castAluminum, {
        position: [0, 0, 0],
        segments: 3,
      }),
    );
    alt.add(
      torus(38, 12, m.castAluminum, {
        position: [-28, 8, 60],
        tubularSeg: 36,
        radialSeg: 9,
      }),
    );
    alt.add(
      cylinder(28, 28, 38, m.darkSteel, {
        radial: 32,
        rotation: [Math.PI / 2, 0, 0],
        position: [-28, 8, 78],
      }),
    );
    const altPulley = createPulley(40, 26, m.machinedAluminum, {
      spokes: 4,
      grooveMat: m.darkSteel,
    });
    altPulley.position.set(-28, 8, 84);
    this.markDynamic(altPulley);
    this.accessoryPulleys.push({ group: altPulley, ratio: 92 / 40 });
    alt.add(altPulley);
    alt.add(
      roundedBox(18, 72, 56, 6, m.castIronBlock, {
        position: [55, -35, 0],
        segments: 1,
      }),
    );
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      alt.add(
        box(5, 14, 8, m.castAluminum, {
          position: [Math.cos(a) * 58, Math.sin(a) * 58, 65],
          rotation: [0, 0, a],
          castShadow: false,
        }),
      );
    }
    decal(alt, makeLabelTexture([this.entry.look.decals.alternator[0]], { width: 700, height: 140, padding: 20 }), 68, 14, [0, 20, 64.3], [0, 0, 0], { roughness: 0.8 });

    // Serpentine belt path: exact tangent loop around all 6 pulleys at z = 386.
    const beltCurve = new THREE.CatmullRomCurve3(
      [
        [-256, 160, 386],
        [-267, 186, 386],
        [-256, 212, 386],
        [-225, 228, 386],
        [-194, 212, 386],
        [-132, 82, 386],
        [-108, 70, 386],
        [-84, 82, 386],
        [-48, 170, 386],
        [-36, 194, 386],
        [0, 208, 386],
        [36, 194, 386],
        [50, 164, 386],
        [136, 76, 386],
        [148, 52, 386],
        [136, 28, 386],
        [84, -42, 386],
        [58, -74, 386],
        [0, -94, 386],
        [-52, -78, 386],
        [-114, -102, 386],
        [-140, -88, 386],
        [-148, -64, 386],
        [-140, -40, 386],
        [-198, 60, 386],
      ].map((p) => new THREE.Vector3(...p)),
      true,
      'catmullrom',
      0.22,
    );
    const beltMat = m.rubber.clone();
    beltMat.bumpMap = null;
    beltMat.roughness = 0.82;
    const belt = mesh(new THREE.TubeGeometry(beltCurve, 160, 6.2, 10, true), beltMat, {
      castShadow: false,
      receiveShadow: true,
    });
    belt.scale.z = 0.55;
    part.add(belt);
    // Raised ribs on the belt, offset across its face.
    for (const dz of [-2.8, 2.8]) {
      const ribCurve = new THREE.CatmullRomCurve3(
        beltCurve.points.map((p) => new THREE.Vector3(p.x, p.y, 386 + dz)),
        true,
        'catmullrom',
        0.22,
      );
      part.add(
        mesh(new THREE.TubeGeometry(ribCurve, 120, 1.8, 6, true), m.blackOxide, {
          castShadow: false,
          receiveShadow: false,
        }),
      );
    }
    // Accessory belt tensioner arm.
    part.add(
      cylinder(26, 26, 17, m.castAluminum, {
        radial: 28,
        rotation: [Math.PI / 2, 0, 0],
        position: [114, 52, 368],
      }),
    );
    // Cast ribs and service bosses across the gear cover face.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.2;
      part.add(
        roundedBox(24, 62, 16, 5, m.castAluminum, {
          position: [Math.cos(a) * 118, 94 + Math.sin(a) * 54, 347],
          rotation: [0, 0, a],
          segments: 1,
          castShadow: false,
        }),
      );
    }
    part.add(
      cylinder(123, 129, 8, m.castAluminum, {
        radial: 48,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, -14, 348],
      }),
    );
    // Identification plate on the lower-right face, clear of the accessory drive.
    part.add(
      roundedBox(158, 38, 5, 4, m.blackPlastic, {
        position: [96, -124, 363.6],
        segments: 2,
        castShadow: false,
      }),
    );
    const badgeLabel = labelLines(
      [
        this.entry.look.decals.exhaustManifold[0],
        this.entry.look.decals.exhaustManifold[1],
      ],
      { width: 1024, height: 250, padding: 26 },
    );
    const badge = decal(part, badgeLabel, 144, 34, [96, -124, 366.5], [0, 0, 0], {
      roughness: 0.58,
    });
    badge.material = new THREE.MeshBasicMaterial({
      map: badgeLabel,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      toneMapped: true,
    });
    part.add(
      roundedBox(162, 3.5, 2, 1, m.standYellow, {
        position: [96, -103.5, 366.3],
        segments: 1,
        castShadow: false,
      }),
    );
    // machined crank seal boss visible around the damper
    part.add(
      torus(60, 5, m.machinedAluminum, {
        position: [0, -14, 365],
        tubularSeg: 44,
        radialSeg: 8,
        castShadow: false,
      }),
    );
    addBoltAt(part, [0, 279, 347], [0, 1, 0], 7, m.boltSteel);
    addBoltAt(part, [-140, 155, 346], [0, 0, 1], 5.6, m.boltSteel);
    addBoltAt(part, [140, 155, 346], [0, 0, 1], 5.6, m.boltSteel);
  }

  /* -----------------------------------------------------------------------
     Exhaust manifolds and turbo
  ----------------------------------------------------------------------- */
  _buildExhaustManifolds() {
    const m = this.mats;
    this.exhaustEnds = {};
    for (const bank of ['R', 'L']) {
      const bankRotation = this.entry.layout.banks.find((bankSpec) => bankSpec.id === bank).rotationDeg;
      const rotation = bankRotation * DEG;
      const asm = this.makeAssembly(`exhaust-${bank}`, this.entry.explode.offsets[`exhaust-${bank}`], rotation);
      const id = bank === 'R' ? 'exhaust-manifold-right' : 'exhaust-manifold-left';
      const part = this.createPart(asm, id);
      const outboardSign = bank === 'R' ? -1 : 1;
      const manifold = new THREE.Group();
      part.add(manifold);
      // The external exhaust log becomes a ghost in cutaway so the valvetrain
      // and cylinder head beneath it are readable from every angle.
      const exhaustMat = m.castIronExhaust.clone();
      exhaustMat.userData.cutaway = true;
      const exhaustTint = m.castIronExhaustTint.clone();
      exhaustTint.userData.cutaway = true;
      const shieldMat = m.heatShield.clone();
      shieldMat.userData.cutaway = true;
      this.shellMaterials.push(
        { mat: exhaustMat, min: 0.1 },
        { mat: exhaustTint, min: 0.1 },
        { mat: shieldMat, min: 0.07 },
      );
      const logPoints = [];
      for (let i = 0; i < 5; i++) {
        const z = -260 + i * 130;
        logPoints.push([outboardSign * 134, 326, z]);
      }
      manifold.add(
        tube(logPoints, 27, exhaustMat, {
          segments: 48,
          radial: 14,
          castShadow: true,
          receiveShadow: true,
        }),
      );
      // Four runners from head ports into the log.
      const cylinders = this.kinematics.cylinders.filter((c) => c.bank === bank);
      for (let i = 0; i < cylinders.length; i++) {
        const c = cylinders[i];
        manifold.add(
          tube(
            [
              [outboardSign * 101, 354, c.z],
              [outboardSign * 141, 350, c.z],
              [outboardSign * 147, 329, c.z],
            ],
            20,
            exhaustMat,
            { segments: 16, radial: 11 },
          ),
        );
        manifold.add(
          roundedBox(10, 82, 82, 4, exhaustTint, {
            position: [outboardSign * 110, 354, c.z],
            segments: 1,
            castShadow: false,
          }),
        );
        for (const dz of [-31, 31]) {
          addBoltAt(
            manifold,
            [outboardSign * 113, 354, c.z + dz],
            [outboardSign, 0, 0],
            5.7,
            m.boltSteel,
          );
        }
      }
      // Rear collector and heat shield.
      const collector = new THREE.Group();
      collector.position.set(outboardSign * 158, 348, -280);
      manifold.add(collector);
      collector.add(
        cylinderBetween([0, 0, 0], [0, -42, -58], 27, exhaustTint, {
          radial: 14,
        }),
      );
      collector.add(
        torus(27, 5, m.darkSteel, {
          rotation: [Math.PI / 2, 0, 0],
          position: [0, -8, -12],
          tubularSeg: 24,
          radialSeg: 6,
        }),
      );
      // stamped heat shield
      const shield = new THREE.Group();
      shield.position.set(outboardSign * 182, 307, 0);
      manifold.add(shield);
      shield.add(
        roundedBox(8, 108, 390, 6, shieldMat, {
          position: [0, 23, 0],
          segments: 2,
        }),
      );
      for (let i = 0; i < 4; i++) {
        shield.add(
          cylinder(4, 4, 31, m.darkSteel, {
            radial: 8,
            position: [outboardSign * 6, 0, -160 + i * 108],
            rotation: [0, 0, Math.PI / 2],
            castShadow: false,
          }),
        );
      }
      const shieldLabel = decal(
        shield,
        makeLabelTexture(
          [
            this.entry.look.decals.exhaustShield[0],
            this.entry.look.decals.exhaustShield[1],
          ],
          { width: 700, height: 260, padding: 22 },
        ),
        70,
        26,
        [outboardSign * 4.2, 34, 20],
        [0, (outboardSign * Math.PI) / 2, 0],
        { roughness: 0.8 },
      );
      this.exhaustDetailMeshes.push(shieldLabel);
      const worldEnd = new THREE.Vector3(outboardSign * 158, 348, -280).applyAxisAngle(
        new THREE.Vector3(0, 0, 1),
        rotation,
      );
      this.exhaustEnds[bank] = worldEnd;
    }
  }

  _buildTurbo() {
    const m = this.mats;
    const asm = this.makeAssembly('turbo', this.entry.explode.offsets.turbo);
    const part = this.createPart(asm, 'turbo');
    const turbo = new THREE.Group();
    turbo.position.set(0, 376, -242);
    turbo.rotation.z = 0.04;
    part.add(turbo);

    // Mounting pedestal / oil drain.
    turbo.add(
      roundedBox(160, 62, 150, 12, m.castAluminum, {
        position: [0, -88, -12],
        segments: 2,
      }),
    );
    // Centre housing (CHRA).
    turbo.add(
      cylinder(40, 40, 108, m.castIronBlockDark, {
        radial: 36,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, 5],
      }),
    );
    for (const z of [-53, 53]) {
      turbo.add(
        cylinder(53, 49, 15, m.machinedAluminum, {
          radial: 32,
          rotation: [Math.PI / 2, 0, 0],
          position: [0, 0, z],
        }),
      );
    }
    // Garrett identification plate on the CHRA saddle.
    turbo.add(
      roundedBox(62, 4, 54, 2, m.blackPlastic, {
        position: [0, 41, 2],
        segments: 1,
        castShadow: false,
      }),
    );
    const gtLabel = labelLines(
      [
        this.entry.look.decals.turboPlaque[0],
        this.entry.look.decals.turboPlaque[1],
      ],
      { width: 800, height: 240, padding: 16 },
    );
    const gtMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(57, 17.1),
      new THREE.MeshBasicMaterial({ map: gtLabel, transparent: true, alphaTest: 0.02, depthWrite: false }),
    );
    gtMesh.rotation.x = -Math.PI / 2;
    gtMesh.position.set(0, 43.3, 2);
    turbo.add(gtMesh);
    // Wastegate / VVT actuator - black can with an adjustable arm.
    const actuator = new THREE.Group();
    actuator.position.set(66, 57, -23);
    turbo.add(actuator);
    actuator.add(
      cylinder(26, 26, 67, m.blackPlastic, {
        radial: 28,
        rotation: [Math.PI / 2, 0, 0],
      }),
    );
    actuator.add(
      cylinder(22, 26, 12, m.darkSteel, {
        radial: 28,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, 38],
      }),
    );
    const arm = new THREE.Group();
    this.markDynamic(arm);
    arm.position.set(-12, -10, 48);
    actuator.add(arm);
    arm.add(
      roundedBox(7, 66, 7, 2, m.machinedAluminum, {
        position: [0, -28, 0],
        segments: 1,
      }),
    );
    arm.add(
      cylinder(6, 6, 9, m.brass, {
        radial: 6,
        position: [0, -59, 0],
        rotation: [Math.PI / 2, 0, 0],
      }),
    );
    this.turboActuator = arm;
    // Solenoid connector.
    actuator.add(
      roundedBox(16, 15, 13, 2.5, m.rubberBlue, {
        position: [0, 25, 30],
        segments: 1,
        castShadow: false,
      }),
    );

    // Compressor side, pointing forward (+Z). Cold side.
    const comp = createScrollVolute({
      startRadius: 37,
      endRadius: 74,
      crossStart: 13,
      crossEnd: 21,
      turns: 1.22,
      segments: 64,
      ringSegments: 14,
      material: m.castAluminum,
      materialDark: m.alumDark,
      phase: 0.4,
    });
    comp.position.set(0, 0, 72);
    turbo.add(comp);
    const compWheel = this._makeTurboWheel(44, 11, m.machinedAluminum, 1);
    compWheel.position.set(0, 0, 110);
    compWheel.rotation.z = 0.2;
    turbo.add(compWheel);
    this.turboWheels.push({ group: compWheel, mult: 1 });
    // Compressor inlet mouthpiece, coaxial with the turbo and facing forward.
    const inlet = new THREE.Group();
    inlet.position.set(0, 0, 136);
    turbo.add(inlet);
    inlet.add(
      cylinder(48, 64, 32, m.castAluminum, {
        radial: 40,
        rotation: [Math.PI / 2, 0, 0],
      }),
    );
    inlet.add(
      torus(49, 3.8, m.machinedAluminum, {
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, 16],
        tubularSeg: 40,
        radialSeg: 6,
      }),
    );
    // Anti-ingestion screen and radial support bars.
    const screenMat = new THREE.MeshBasicMaterial({
      color: this.entry.look.palette.turboScreen,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    inlet.add(
      mesh(new THREE.CircleGeometry(45, 12), screenMat, {
        position: [0, 0, 4],
        castShadow: false,
        receiveShadow: false,
      }),
    );
    for (let i = 0; i < 4; i++) {
      inlet.add(
        box(90, 1.6, 1.6, m.darkSteel, {
          rotation: [0, 0, (i / 4) * Math.PI],
          position: [0, 0, 4.5],
          castShadow: false,
        }),
      );
    }
    // compressor outlet / charge pipe flange
    const compOutlet = new THREE.Group();
    compOutlet.position.set(-76, 15, 98);
    compOutlet.rotation.z = -0.5;
    turbo.add(compOutlet);
    compOutlet.add(
      cylinder(33, 33, 44, m.machinedAluminum, {
        radial: 34,
        rotation: [0, 0, Math.PI / 2],
      }),
    );
    compOutlet.add(
      cylinder(35, 35, 12, m.rubberBlue, {
        radial: 34,
        rotation: [0, 0, Math.PI / 2],
      }),
    );

    // Turbine side, pointing aft (−Z). Hot side.
    const turbine = createScrollVolute({
      startRadius: 41,
      endRadius: 73,
      crossStart: 17,
      crossEnd: 24,
      turns: 1.2,
      segments: 64,
      ringSegments: 14,
      material: m.castIronExhaust,
      materialDark: m.castIronExhaustTint,
      phase: -0.4,
    });
    turbine.position.set(0, 0, -58);
    turbo.add(turbine);
    const turbineWheel = this._makeTurboWheel(44, 13, m.heatShield, 0.9);
    turbineWheel.position.set(0, 0, -100);
    turbineWheel.rotation.z = 1.1;
    turbo.add(turbineWheel);
    this.turboWheels.push({ group: turbineWheel, mult: 0.92 });
    // turbine downpipe flange and short pipe
    const downpipe = new THREE.Group();
    downpipe.position.set(51, -42, -124);
    downpipe.rotation.z = -0.7;
    turbo.add(downpipe);
    downpipe.add(
      cylinder(37, 42, 54, m.castIronExhaustTint, {
        radial: 30,
        rotation: [0, 0, Math.PI / 2],
      }),
    );
    downpipe.add(
      torus(38, 4.5, m.darkSteel, {
        rotation: [0, 0, Math.PI / 2],
        position: [29, 0, 0],
        tubularSeg: 32,
        radialSeg: 6,
      }),
    );
    // Heat shield wrap around turbine upper half.
    turbo.add(
      mesh(
        new THREE.CylinderGeometry(69, 73, 66, 22, 1, true, 0, Math.PI),
        m.heatShield,
        {
          rotation: [0, 0, Math.PI / 2],
          position: [0, 14, -84],
          castShadow: false,
          receiveShadow: true,
        },
      ),
    );
    // Oil feed and water lines.
    turbo.add(
      tube(
        [
          [-20, 38, 50],
          [-49, 78, 18],
          [-85, 102, -22],
          [-108, 80, -70],
        ],
        4.2,
        m.copper,
        { segments: 24, radial: 8, castShadow: false },
      ),
    );
    turbo.add(
      tube(
        [
          [34, -30, 18],
          [80, -64, 5],
          [104, -94, -34],
        ],
        5,
        m.rubber,
        { segments: 20, radial: 8, castShadow: false },
      ),
    );
    // Identification plaque.
    const plaque = makeLabelTexture(
      [
        this.entry.look.decals.turboIdPlate[0],
        this.entry.look.decals.turboIdPlate[1],
      ],
      { width: 800, height: 240, padding: 24, background: '#bcbdb5', border: true, accent: '#70736d' },
    );
    decal(turbo, plaque, 92, 27.6, [0, 43, 84], [0, 0, 0], { roughness: 0.52 });
    decal(
      turbo,
      makeLabelTexture([this.entry.look.decals.turboBosch[0]], {
        width: 500,
        height: 130,
        background: '#272a28',
        padding: 14,
      }),
      55,
      14,
      [77, 72, 32],
      [0, 0, 0],
      { roughness: 0.5 },
    );

    // Up-pipes from both exhaust manifolds to the turbine inlet.
    const pipeGroup = this.createPart(asm, 'up-pipes');
    const ups = [
      [
        [-150, 325, -300],
        [-128, 345, -342],
        [-84, 365, -332],
        [-48, 376, -289],
      ],
      [
        [150, 325, -300],
        [128, 345, -342],
        [84, 365, -332],
        [48, 376, -289],
      ],
    ];
    for (const pts of ups) {
      pipeGroup.add(
        tube(pts, 19, m.castIronExhaustTint, {
          segments: 32,
          radial: 12,
          castShadow: true,
          receiveShadow: true,
        }),
      );
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Vector3(...pts[i]).lerp(new THREE.Vector3(...pts[i + 1]), 0.5);
        pipeGroup.add(
          torus(20, 3.2, m.darkSteel, {
            position: [p.x, p.y, p.z],
            rotation: [Math.PI / 2, 0, 0],
            tubularSeg: 20,
            radialSeg: 5,
            castShadow: false,
          }),
        );
      }
    }
    // Turbo support strut.
    part.add(
      tube(
        [
          [-58, 300, -218],
          [-90, 342, -235],
          [-91, 392, -240],
        ],
        7,
        m.darkSteel,
        { segments: 20, radial: 8, castShadow: false },
      ),
    );
    this.turboAsm = asm;
    this.turboGroup = turbo;
  }

  _makeTurboWheel(radius, blades, material, scale = 1) {
    const m = this.mats;
    const group = new THREE.Group();
    this.markDynamic(group);
    const hub = cylinder(radius * 0.19, radius * 0.33, radius * 0.4, material, {
      radial: 24,
      rotation: [Math.PI / 2, 0, 0],
    });
    group.add(hub);
    for (let i = 0; i < blades; i++) {
      const a = (i / blades) * TAU;
      const blade = new THREE.Group();
      blade.rotation.z = a;
      const b = mesh(
        new THREE.BoxGeometry(radius * 0.36, 2.0, radius * 0.68),
        material,
        {
          position: [radius * 0.37, 0, -radius * 0.15],
          rotation: [0.34, 0.2, 0],
          castShadow: true,
          receiveShadow: true,
        },
      );
      blade.add(b);
      const tip = mesh(
        new THREE.BoxGeometry(radius * 0.19, 1.6, radius * 0.43),
        material,
        {
          position: [radius * 0.57, 0, -radius * 0.32],
          rotation: [0.24, 0.24, -0.18],
          castShadow: false,
        },
      );
      blade.add(tip);
      group.add(blade);
    }
    group.add(
      cylinder(radius * 0.07, radius * 0.11, radius * 0.7, m.turboBlue, {
        radial: 18,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, -radius * 0.2],
      }),
    );
    group.scale.setScalar(scale);
    return group;
  }

  /* -----------------------------------------------------------------------
     Intake, charge air and EGR
  ----------------------------------------------------------------------- */
  _buildIntake() {
    const m = this.mats;
    const asm = this.makeAssembly('intake', this.entry.explode.offsets.intake);
    const part = this.createPart(asm, 'intake-manifold');
    const intakeAlum = m.castAluminum.clone();
    intakeAlum.color.setHex(this.entry.look.palette.intake);
    intakeAlum.roughness = 0.46;
    intakeAlum.metalness = 0.78;
    // Cast Y-bridge / valley intake manifold.
    const plenum = new THREE.Group();
    plenum.position.set(0, 348, 28);
    part.add(plenum);
    plenum.add(
      roundedBox(242, 86, 340, 24, intakeAlum, {
        position: [0, 0, 0],
        segments: 3,
      }),
    );
    plenum.add(
      roundedBox(204, 26, 305, 12, intakeAlum, {
        position: [0, 46, -4],
        segments: 2,
      }),
    );
    // Intake runners to both heads.
    for (const bank of ['R', 'L']) {
      const s = bank === 'R' ? -1 : 1;
      for (let i = 0; i < 4; i++) {
        const z = 88 - i * 58;
        const pts = [
          [s * 108, 28, z],
          [s * 150, 2, z - 5],
          [s * 182, -9, z - 7],
        ];
        plenum.add(
          tube(pts, 19, intakeAlum, {
            segments: 16,
            radial: 12,
            castShadow: true,
            receiveShadow: true,
          }),
        );
        plenum.add(
          cylinder(22, 22, 12, m.rubber, {
            radial: 22,
            position: [s * 187, -11, z - 7],
            rotation: [0, 0, Math.PI / 2],
          }),
        );
      }
    }
    // throttle/EGR inlet neck at rear top.
    plenum.add(
      cylinder(39, 33, 46, intakeAlum, {
        radial: 30,
        rotation: [Math.PI / 2, 0, 0],
        position: [70, 54, -166],
      }),
    );
    plenum.add(
      cylinder(35, 35, 14, m.rubber, {
        radial: 30,
        rotation: [Math.PI / 2, 0, 0],
        position: [70, 54, -194],
      }),
    );
    // sensor and cast ribs
    plenum.add(
      roundedBox(28, 18, 28, 4, m.blackPlastic, {
        position: [65, 55, 40],
        segments: 1,
      }),
    );
    for (let i = 0; i < 7; i++) {
      plenum.add(
        roundedBox(205, 5, 14, 2, intakeAlum, {
          position: [0, 49, -145 + i * 48],
          segments: 1,
          castShadow: false,
        }),
      );
    }
    plenum.add(
      roundedBox(196, 5, 92, 3, m.blackPlastic, {
        position: [0, 47.5, 20],
        segments: 1,
        castShadow: false,
      }),
    );
    const yLabel = labelLines(
      [
        this.entry.look.decals.intake[0],
        this.entry.look.decals.intake[1],
      ],
      { width: 1400, height: 300, padding: 26, background: 'transparent' },
    );
    const intakeDecal = new THREE.Mesh(
      new THREE.PlaneGeometry(178, 38),
      new THREE.MeshBasicMaterial({
        map: yLabel,
        transparent: true,
        alphaTest: 0.02,
        depthWrite: false,
      }),
    );
    intakeDecal.rotation.x = -Math.PI / 2;
    intakeDecal.position.set(0, 50.3, 20);
    plenum.add(intakeDecal);
    plenum.add(
      cylinder(22, 22, 44, m.blackPlastic, {
        radial: 18,
        position: [82, 76, -155],
        rotation: [0.15, 0, 0.28],
      }),
    );

    // Charge pipe, compressor to intake.
    const charges = this.createPart(asm, 'charge-pipes');
    const chargePts = [
      [-92, 390, -116],
      [-124, 370, -64],
      [-140, 353, -6],
      [-135, 343, 65],
      [-104, 339, 136],
    ];
    charges.add(
      tube(chargePts, 30, m.satinAluminum, {
        segments: 42,
        radial: 20,
        castShadow: true,
        receiveShadow: true,
      }),
    );
    // silicone couplers and constant-torque clamps
    for (let i = 0; i < 2; i++) {
      const p = new THREE.Vector3(...chargePts[i + 1]);
      const prev = new THREE.Vector3(...chargePts[i]);
      const next = new THREE.Vector3(...chargePts[i + 2]);
      const dir = next.clone().sub(prev).normalize();
      const a = p.clone().addScaledVector(dir, -13);
      const b = p.clone().addScaledVector(dir, 13);
      charges.add(
        cylinderBetween(a, b, 33, m.rubberBlue, { radial: 30, castShadow: true }),
      );
      for (const q of [a, b]) {
        const clamp = torus(34.5, 3.0, m.machinedAluminum, {
          position: [q.x, q.y, q.z],
          tubularSeg: 30,
          radialSeg: 6,
          castShadow: false,
        });
        clamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        charges.add(clamp);
      }
    }
    // small welded bung and charge-air sensor
    charges.add(
      cylinder(8, 8, 18, m.brass, {
        radial: 10,
        position: [-157, 379, 28],
        rotation: [0, 0, Math.PI / 2],
      }),
    );
    charges.add(
      decal(
        charges,
        makeLabelTexture([
          this.entry.look.decals.chargePipe[0],
          this.entry.look.decals.chargePipe[1],
        ], { width: 760, height: 170, background: '#1b201e', padding: 16 }),
        88,
        19.7,
        [-143.4, 378, 56],
        [0, Math.PI / 2, 0],
        { roughness: 0.5 },
      ),
    );
    this.intakePlenum = plenum;
  }

  _buildEGR() {
    const m = this.mats;
    const asm = this.makeAssembly('egr', this.entry.explode.offsets.egr);
    const part = this.createPart(asm, 'egr');
    const egr = new THREE.Group();
    egr.position.set(-132, 335, -142);
    part.add(egr);
    // Rectangular stainless cooler.
    egr.add(
      roundedBox(122, 83, 268, 18, m.heatShield, {
        position: [0, 0, 0],
        segments: 3,
      }),
    );
    for (let i = 0; i < 7; i++) {
      egr.add(
        roundedBox(132, 8, 17, 3, m.aluminumDuct, {
          position: [0, 0, -105 + i * 35],
          segments: 1,
          castShadow: false,
        }),
      );
    }
    egr.add(
      roundedBox(106, 96, 27, 13, m.castAluminum, {
        position: [0, 5, 145],
        segments: 2,
      }),
    );
    egr.add(
      roundedBox(102, 86, 24, 12, m.castAluminum, {
        position: [0, 5, -144],
        segments: 2,
      }),
    );
    // EGR valve and actuator.
    const valve = new THREE.Group();
    valve.position.set(0, 65, 103);
    egr.add(valve);
    valve.add(
      roundedBox(77, 55, 75, 15, m.castAluminum, {
        position: [0, 0, 0],
        segments: 2,
      }),
    );
    valve.add(
      cylinder(30, 30, 58, m.blackPlastic, {
        radial: 26,
        position: [0, 48, 0],
      }),
    );
    valve.add(
      roundedBox(18, 20, 14, 3, m.rubberBlue, {
        position: [0, 79, 18],
        segments: 1,
        castShadow: false,
      }),
    );
    decal(
      valve,
      makeLabelTexture([this.entry.look.decals.egr[0]], {
        width: 300,
        height: 140,
        background: '#262823',
        padding: 12,
      }),
      38,
      17.7,
      [0, 9, 38],
      [0, 0, 0],
      { roughness: 0.6 },
    );
    // coolant hoses
    egr.add(
      tube(
        [
          [42, -10, 158],
          [100, -4, 179],
          [124, 25, 216],
          [97, 66, 240],
        ],
        12,
        m.rubber,
        { segments: 22, radial: 9 },
      ),
    );
    egr.add(
      tube(
        [
          [-47, -2, 155],
          [-94, 16, 168],
          [-118, 68, 154],
          [-97, 106, 113],
        ],
        12,
        m.rubber,
        { segments: 22, radial: 9 },
      ),
    );
    // feed pipe from up-pipe Y
    egr.add(
      tube(
        [
          [-38, -40, -168],
          [-58, -70, -214],
          [-36, -84, -255],
          [25, -67, -270],
        ],
        15,
        m.castIronExhaustTint,
        { segments: 24, radial: 10 },
      ),
    );
    decal(
      egr,
      makeLabelTexture(
        [
          this.entry.look.decals.egrCooler[0],
          this.entry.look.decals.egrCooler[1],
        ],
        { width: 800, height: 220, padding: 22 },
      ),
      92,
      25,
      [0, 44.5, 0],
      [-Math.PI / 2, 0, 0],
      { roughness: 0.7 },
    );
  }

  /* -----------------------------------------------------------------------
     Fuel system: CP3, rails, high-pressure lines
  ----------------------------------------------------------------------- */
  _buildFuelSystem() {
    const m = this.mats;
    const asm = this.makeAssembly('fuel', this.entry.explode.offsets.fuel);
    const cp3 = this.createPart(asm, 'cp3');
    const rails = this.createPart(asm, 'fuel-rails');
    const lines = this.createPart(asm, 'high-pressure-lines');

    // CP3.3, front center low in the valley behind the timing cover.
    const pump = new THREE.Group();
    pump.position.set(-16, 238, 178);
    cp3.add(pump);
    pump.add(
      roundedBox(108, 92, 124, 16, m.castAluminum, {
        position: [0, 0, 0],
        segments: 3,
      }),
    );
    pump.add(
      cylinder(36, 36, 34, m.castAluminum, {
        radial: 30,
        rotation: [Math.PI / 2, 0, 0],
        position: [16, -8, 66],
      }),
    );
    pump.add(
      cylinder(28, 28, 12, m.blackOxide, {
        radial: 30,
        rotation: [Math.PI / 2, 0, 0],
        position: [16, -8, 86],
      }),
    );
    // three plunger heads across the top
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.2;
      pump.add(
        cylinder(15, 17, 28, m.machinedAluminum, {
          radial: 18,
          position: [Math.cos(a) * 36, 42, -6 + Math.sin(a) * 18],
        }),
      );
      pump.add(
        cylinder(6.5, 6.5, 14, m.brass, {
          radial: 10,
          position: [Math.cos(a) * 36, 60, -6 + Math.sin(a) * 18],
        }),
      );
    }
    pump.add(
      roundedBox(76, 20, 40, 5, m.darkSteel, {
        position: [0, 52, -38],
        segments: 1,
      }),
    );
    // metering valve
    pump.add(
      cylinder(19, 19, 38, m.blackPlastic, {
        radial: 22,
        position: [-56, 12, 12],
        rotation: [0, 0, Math.PI / 2],
      }),
    );
    pump.add(
      cylinder(7, 7, 16, m.brass, {
        radial: 8,
        position: [-80, 12, 12],
        rotation: [0, 0, Math.PI / 2],
      }),
    );
    decal(
      pump,
      makeLabelTexture(
        [
          this.entry.look.decals.cp3[0],
          this.entry.look.decals.cp3[1],
        ],
        { width: 950, height: 300, padding: 28 },
      ),
      84,
      26.5,
      [0, 0, 63.2],
      [0, 0, 0],
      { roughness: 0.55 },
    );
    // Top-mounted Bosch identification plate, visible in the valley.
    pump.add(
      roundedBox(76, 4, 24, 2, m.blackPlastic, {
        position: [0, 48, 34],
        segments: 1,
        castShadow: false,
      }),
    );
    const cp3Top = labelLines(
      [this.entry.look.decals.cp3Top[0]],
      { width: 950, height: 120, padding: 12 },
    );
    const cp3TopMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(72, 9.2),
      new THREE.MeshBasicMaterial({
        map: cp3Top,
        transparent: true,
        alphaTest: 0.02,
        depthWrite: false,
      }),
    );
    cp3TopMesh.rotation.x = -Math.PI / 2;
    cp3TopMesh.position.set(0, 50.2, 34);
    pump.add(cp3TopMesh);
    // HP outlets to both rails.
    cp3.add(
      tube(
        [
          [-20, 290, 195],
          [-68, 336, 182],
          [-112, 366, 158],
          [-134, 378, 136],
        ],
        5.0,
        m.fuelLine,
        { segments: 24, radial: 8, castShadow: false },
      ),
    );
    cp3.add(
      tube(
        [
          [8, 290, 195],
          [62, 336, 182],
          [110, 366, 154],
          [134, 378, 124],
        ],
        5.0,
        m.fuelLine,
        { segments: 24, radial: 8, castShadow: false },
      ),
    );
    // fuel feed/return braided lines
    cp3.add(
      tube(
        [
          [-48, 205, 224],
          [-72, 168, 235],
          [-84, 108, 228],
          [-64, 52, 204],
        ],
        3.6,
        m.braided,
        { segments: 24, radial: 7, castShadow: false },
      ),
    );
    cp3.add(
      tube(
        [
          [32, 205, 224],
          [66, 172, 232],
          [80, 112, 222],
          [68, 56, 198],
        ],
        3.6,
        m.rubber,
        { segments: 24, radial: 7, castShadow: false },
      ),
    );
    cp3.add(
      cylinder(9, 9, 20, m.copper, {
        radial: 6,
        position: [-48, 212, 226],
        castShadow: false,
      }),
    );
    cp3.add(
      cylinder(9, 9, 20, m.brass, {
        radial: 6,
        position: [32, 212, 226],
        castShadow: false,
      }),
    );

    // Common rails along the inboard upper heads; visible outside covers.
    const railSpecs = [
      { bank: 'R', x: -134, y: 377, z: 42, color: m.machinedAluminum },
      { bank: 'L', x: 134, y: 377, z: 42, color: m.machinedAluminum },
    ];
    for (const spec of railSpecs) {
      const g = new THREE.Group();
      g.position.set(spec.x, spec.y, spec.z);
      rails.add(g);
      g.add(
        cylinder(14, 14, 524, m.machinedAluminum, {
          radial: 22,
          rotation: [Math.PI / 2, 0, 0],
        }),
      );
      for (const z of [-238, -116, 6, 128, 250]) {
        g.add(
          cylinder(18, 18, 13, m.brass, {
            radial: 18,
            rotation: [Math.PI / 2, 0, 0],
            position: [0, 0, z],
          }),
        );
        g.add(
          roundedBox(24, 35, 13, 3, m.darkSteel, {
            position: [0, -24, z + 4],
            segments: 1,
            castShadow: false,
          }),
        );
      }
      // pressure sensor and relief valve
      g.add(
        cylinder(14, 14, 29, m.blackPlastic, {
          radial: 18,
          position: [0, 20, -208],
        }),
      );
      g.add(
        cylinder(13, 13, 34, m.brass, {
          radial: 6,
          position: [0, 21, 194],
        }),
      );
      const railLabel = makeLabelTexture(
        [
          this.entry.look.decals.fuelRail[0],
          this.entry.look.decals.fuelRail[1],
        ],
        { width: 900, height: 230, background: '#232521', padding: 20 },
      );
      decal(g, railLabel, 82, 21, [0, 7, 13], [0, 0, 0], { roughness: 0.6 });
    }

    // Injector feed lines from rail fittings to the exposed injector tops.
    for (const c of this.kinematics.cylinders) {
      const p = this.injectorPoints[c.number];
      if (!p) continue;
      const bankSign = c.bank === 'R' ? -1 : 1;
      const start = new THREE.Vector3(bankSign * 134, 382, c.z);
      const end = p.clone();
      // Short, tightly routed high-pressure line dropping from the rail to
      // the injector inlet, without an exaggerated service loop.
      const pts = [
        [start.x, start.y, start.z],
        [start.x + bankSign * 10, start.y - 10, start.z],
        [start.x + bankSign * 53, start.y - 57, start.z + (end.z - start.z) * 0.4],
        [end.x - bankSign * 14, end.y + 31, end.z],
        [end.x, end.y, end.z],
      ];
      lines.add(
        tube(pts, 2.8, m.fuelLine, {
          segments: 26,
          radial: 7,
          castShadow: false,
          receiveShadow: true,
        }),
      );
      // Vibration clamp at mid-span.
      lines.add(
        roundedBox(13, 9, 10, 2, m.rubber, {
          position: [pts[2][0], pts[2][1], pts[2][2]],
          segments: 1,
          castShadow: false,
        }),
      );
      for (const pt of [pts[0], pts[pts.length - 1]]) {
        lines.add(
          cylinder(7, 7, 13, m.brass, {
            radial: 6,
            position: [pt[0], pt[1], pt[2]],
            rotation: [Math.PI / 2, 0, 0],
            castShadow: false,
          }),
        );
      }
    }
    // Engine speed / rail pressure sensors wire bundle.
    const wires = new THREE.Group();
    asm.add(wires);
    for (const spec of railSpecs) {
      wires.add(
        tube(
          [
            [spec.x, 395, -200],
            [spec.x + (spec.x > 0 ? 25 : -25), 380, -240],
            [spec.x + (spec.x > 0 ? 48 : -48), 318, -286],
            [spec.x + (spec.x > 0 ? 54 : -54), 250, -312],
          ],
          3.3,
          m.rubber,
          { segments: 20, radial: 6, castShadow: false },
        ),
      );
    }
  }

  /* -----------------------------------------------------------------------
     Ancillaries: starter, harness, feed/drain lines
  ----------------------------------------------------------------------- */
  _buildAncillaries() {
    const m = this.mats;
    const asm = this.makeAssembly('ancillaries');
    const starter = this.createPart(asm, 'starter-motor');
    const s = new THREE.Group();
    s.position.set(-212, -132, -232);
    starter.add(s);
    // Starter motor body and gear-reduction nose (passenger side rear).
    s.add(
      cylinder(43, 43, 155, m.darkSteel, {
        radial: 28,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, 0],
      }),
    );
    for (let i = 0; i < 4; i++) {
      s.add(
        torus(44, 2.5, m.machinedAluminum, {
          rotation: [Math.PI / 2, 0, 0],
          position: [0, 0, -54 + i * 33],
          tubularSeg: 28,
          radialSeg: 5,
          castShadow: false,
        }),
      );
    }
    s.add(
      cylinder(50, 54, 36, m.castAluminum, {
        radial: 26,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, -94],
      }),
    );
    s.add(
      cylinder(26, 26, 24, m.darkSteel, {
        radial: 20,
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 0, -116],
      }),
    );
    // Solenoid and terminal stud.
    s.add(
      cylinder(21, 21, 86, m.blackPlastic, {
        radial: 20,
        rotation: [Math.PI / 2, 0, 0],
        position: [-40, 36, -16],
      }),
    );
    s.add(
      cylinder(8, 8, 16, m.brass, {
        radial: 10,
        position: [-40, 55, 22],
      }),
    );
    s.add(
      cylinderBetween([-40, 53, 22], [-66, 76, 82], 4.5, m.red, { radial: 10 }),
    );
    // Mounting flange and brace.
    s.add(
      roundedBox(80, 18, 46, 5, m.castIronBlockDark, {
        position: [28, 38, -20],
        segments: 2,
      }),
    );
    // Battery cable run and an earth strap.
    starter.add(
      tube(
        [
          [-278, -56, -150],
          [-258, -32, -45],
          [-248, -10, 62],
          [-230, 18, 148],
        ],
        5.5,
        m.red,
        { segments: 30, radial: 8, castShadow: false },
      ),
    );
    starter.add(
      tube(
        [
          [-204, -175, -245],
          [-192, -206, -278],
          [-202, -216, -308],
        ],
        3.2,
        m.braided,
        { segments: 16, radial: 7, castShadow: false },
      ),
    );

    const harness = this.createPart(asm, 'wiring-harness');
    // Main wiring trunk along the injection side of the engine.
    harness.add(
      tube(
        [
          [174, 80, 322],
          [205, 154, 280],
          [221, 230, 180],
          [210, 272, 30],
          [185, 282, -118],
          [148, 263, -245],
          [90, 226, -300],
        ],
        8.5,
        m.rubber,
        { segments: 54, radial: 10, castShadow: false },
      ),
    );
    // Branches to the rail, sensors and glow-plug harness.
    harness.add(
      tube(
        [
          [219, 238, 128],
          [204, 300, 111],
          [170, 336, 90],
        ],
        4.2,
        m.rubber,
        { segments: 20, radial: 7, castShadow: false },
      ),
    );
    harness.add(
      tube(
        [
          [219, 238, 128],
          [195, 308, 166],
          [164, 327, 168],
        ],
        4.2,
        m.rubber,
        { segments: 20, radial: 7, castShadow: false },
      ),
    );
    for (const z of [132, 8, -116, -238]) {
      harness.add(
        roundedBox(18, 15, 24, 3, m.blackPlastic, {
          position: [210, 273, z],
          segments: 1,
          castShadow: false,
        }),
      );
    }
    for (let i = 0; i < 6; i++) {
      harness.add(
        torus(10, 1.5, m.darkSteel, {
          rotation: [0, 0, Math.PI / 2],
          position: [208 + (i % 2) * 5, 260 + i * 2, 70 - i * 58],
          tubularSeg: 20,
          radialSeg: 5,
          castShadow: false,
        }),
      );
    }

    // Turbo oil drain and coolant feed lines.
    harness.add(
      tube(
        [
          [-54, 344, -270],
          [-98, 300, -244],
          [-135, 232, -188],
          [-169, 158, -112],
        ],
        7.5,
        m.braided,
        { segments: 28, radial: 8, castShadow: false },
      ),
    );
    harness.add(
      tube(
        [
          [68, 306, -265],
          [128, 290, -222],
          [172, 238, -140],
        ],
        6.5,
        m.rubber,
        { segments: 24, radial: 8, castShadow: false },
      ),
    );

    // Coolant transfer hoses on the front/lower side.
    harness.add(
      tube(
        [
          [-182, 156, 290],
          [-236, 128, 238],
          [-252, 28, 158],
          [-226, -74, 90],
        ],
        15,
        m.rubber,
        { segments: 28, radial: 10, castShadow: false },
      ),
    );
    harness.add(
      tube(
        [
          [151, 152, 282],
          [197, 124, 235],
          [219, 30, 162],
          [205, -66, 100],
        ],
        13,
        m.rubber,
        { segments: 26, radial: 9, castShadow: false },
      ),
    );
    for (const p of [
      [-250, 35, 165],
      [216, 38, 168],
    ]) {
      harness.add(
        torus(17, 3, m.machinedAluminum, {
          rotation: [0, 0, Math.PI / 2],
          position: p,
          tubularSeg: 24,
          radialSeg: 5,
          castShadow: false,
        }),
      );
    }

    // Exhaust downpipe heat wrap / lower turbo outlet.
    const exhaustPipe = this.createPart(asm, 'exhaust-downpipe');
    exhaustPipe.add(
      tube(
        [
          [76, 316, -350],
          [126, 235, -368],
          [158, 118, -389],
          [171, 12, -383],
        ],
        27,
        m.heatShield,
        { segments: 32, radial: 12, castShadow: true },
      ),
    );
    exhaustPipe.add(
      torus(28, 4, m.darkSteel, {
        rotation: [Math.PI / 2, 0, 0],
        position: [130, 228, -365],
        tubularSeg: 28,
        radialSeg: 5,
        castShadow: false,
      }),
    );
  }

  /* -----------------------------------------------------------------------
     Engine mounts
  ----------------------------------------------------------------------- */
  _buildEngineMounts() {
    const m = this.mats;
    const asm = this.makeAssembly('mounts');
    const part = this.createPart(asm, 'engine-mounts');
    for (const side of [-1, 1]) {
      for (const z of [-150, 156]) {
        const bracket = new THREE.Group();
        bracket.position.set(side * 174, -142, z);
        part.add(bracket);
        bracket.add(
          roundedBox(72, 44, 94, 8, m.castIronDark || m.castIronBlock, {
            position: [side * 20, 0, 0],
            segments: 2,
          }),
        );
        bracket.add(
          roundedBox(48, 23, 60, 6, m.standSteel, {
            position: [side * 77, -8, 0],
            segments: 1,
          }),
        );
        bracket.add(
          cylinder(32, 32, 77, m.rubber, {
            radial: 26,
            rotation: [0, 0, Math.PI / 2],
            position: [side * 62, -43, 0],
          }),
        );
        bracket.add(
          cylinder(17, 17, 90, m.boltSteel, {
            radial: 18,
            rotation: [0, 0, Math.PI / 2],
            position: [side * 76, -43, 0],
          }),
        );
        addBoltAt(bracket, [side * 13, 24, 26], [0, 1, 0], 6.5, m.boltSteel);
        addBoltAt(bracket, [side * 13, 24, -26], [0, 1, 0], 6.5, m.boltSteel);
      }
    }
    // A front steady bracket and lifting eye.
    part.add(
      roundedBox(176, 22, 30, 5, m.darkSteel, {
        position: [0, 288, 300],
        segments: 1,
      }),
    );
    part.add(
      torus(18, 4, m.darkSteel, {
        rotation: [Math.PI / 2, 0, 0],
        position: [0, 309, 300],
        tubularSeg: 24,
        radialSeg: 6,
      }),
    );
  }

  /* -----------------------------------------------------------------------
     Runtime animation
  ----------------------------------------------------------------------- */
  telemetry(rpm, calibrationId, firing) {
    return telemetryValues(this.entry, { rpm, calibration: calibrationId, firing });
  }

  setCutaway(on) {
    this.cutawayTarget = on ? 1 : 0;
  }

  setExploded(on) {
    this.explodeTarget = on ? 1 : 0;
  }

  // The exploded view also fades the castings, by this fraction of a full cutaway, so the crank, rods and
  // pistons stay legible inside the block.
  /** How faded the castings are: the cutaway, or the lesser fade the exploded view applies. */
  get effectiveCutaway() {
    return Math.max(this.cutawayAmount, this.explodeAmount * this.entry.explode.cutawayFraction);
  }

  /** True when the castings are faded enough that picking goes through them. */
  get isXrayed() {
    return this.effectiveCutaway > XRAY_PICK_THRESHOLD;
  }

  _applyCutaway(amount) {
    const sign = amount > 0.001 ? 1 : 0;
    if (sign !== this._lastCutawaySign) {
      this._lastCutawaySign = sign;
      for (const d of this.shellMaterials) {
        d.mat.transparent = sign === 1;
        d.mat.depthWrite = sign === 0;
        if (sign === 1) d.mat.side = THREE.DoubleSide;
        d.mat.needsUpdate = true;
      }
    }
    // Ghost castings must not keep casting hard shadows.
    const shellShadows = amount < 0.04;
    if (this.shellShadowState !== shellShadows) {
      this.shellShadowState = shellShadows;
      this.root.traverse((o) => {
        if (!o.isMesh) return;
        const material = o.material;
        const mats = Array.isArray(material) ? material : [material];
        if (mats.some((mat) => mat?.userData?.cutaway)) o.castShadow = shellShadows;
      });
    }
    for (const d of this.shellMaterials) {
      d.mat.opacity = 1 - (1 - d.min) * amount;
      d.mat.depthWrite = amount < 0.06;
    }
  }

  _applyExplode(amount, time = 0) {
    for (let i = 0; i < this.explodeGroups.length; i++) {
      const g = this.explodeGroups[i];
      // Slight per-assembly stagger makes the breakdown read as a sequence.
      const local = THREE.MathUtils.clamp((amount - i * 0.015) / (1 - i * 0.015), 0, 1);
      const eased = easeInOutCubic(local);
      const wobble = 0;
      g.object.position.set(
        g.base.x + g.offset.x * eased,
        g.base.y + g.offset.y * eased + wobble,
        g.base.z + g.offset.z * eased,
      );
    }
  }

  update(dt, frame) {
    this.elapsed += dt;
    const crankDeg = frame.crankAngleDeg ?? 0;
    const crankRad = -crankDeg * DEG;
    const camRad = crankDeg * 0.5 * DEG;
    const t = frame.runTime ?? this.elapsed;

    // Cutaway / explode transitions.
    this.cutawayAmount = THREE.MathUtils.damp(
      this.cutawayAmount,
      this.cutawayTarget,
      7.5,
      dt,
    );
    if (Math.abs(this.cutawayAmount - this.cutawayTarget) < 0.001) {
      this.cutawayAmount = this.cutawayTarget;
    }
    this.explodeAmount = THREE.MathUtils.damp(this.explodeAmount, this.explodeTarget, 3.6, dt);
    if (Math.abs(this.explodeAmount - this.explodeTarget) < 0.001) {
      this.explodeAmount = this.explodeTarget;
    }
    // Exploded presentation fades the block casting slightly more so the internal
    // crankshaft, rods, pistons, and cam remain legible inside the block.
    const effectiveCutaway = this.effectiveCutaway;
    this._applyCutaway(effectiveCutaway);
    this._applyExplode(this.explodeAmount, t);
    const showInternals = this.cutawayAmount > 0.02 || this.explodeAmount > 0.02;
    if (this.internalVisibility !== showInternals) {
      this.internalVisibility = showInternals;
      for (const g of this.internalGroups) g.visible = showInternals;
    }
    const showCoverHardware = this.cutawayAmount < 0.35;
    if (this.coverHardwareVisible !== showCoverHardware) {
      this.coverHardwareVisible = showCoverHardware;
      for (const m of this.coverDetailMeshes) m.visible = showCoverHardware;
    }
    const showExhaustDetails = effectiveCutaway < 0.06;
    if (this.exhaustDetailsVisible !== showExhaustDetails) {
      this.exhaustDetailsVisible = showExhaustDetails;
      for (const m of this.exhaustDetailMeshes) m.visible = showExhaustDetails;
    }

    if (this.crankSpin) this.crankSpin.rotation.z = crankRad;
    if (this.flywheel) this.flywheel.rotation.z = crankRad;
    if (this.camSpin) this.camSpin.rotation.z = camRad;
    for (const p of this.accessoryPulleys) {
      p.group.rotation.z = crankRad * p.ratio;
    }

    // Pistons and rods: exact crank-slider geometry.
    for (const item of this.pistons) {
      const c = item.cylinder;
      const s = this.kinematics.cylinderState(c, crankDeg);
      item.root.position.set(0, s.wristY, c.z);
      const rel = (s.pinAngle - c.bankAxisDeg * DEG);
      const xPin = -this.kinematics.crankRadiusMm * Math.sin(rel);
      const yPin = this.kinematics.crankRadiusMm * Math.cos(rel);
      const dy = s.wristY - yPin;
      item.root.rotation.y = 0;
      const rodItem = this.rods.find((r) => r.cylinder === c);
      if (rodItem) {
        rodItem.root.position.set(xPin, yPin, c.z);
        rodItem.root.rotation.z = Math.atan2(xPin, dy);
      }
    }
    for (const fw of [this.rotatingDynamics?.flywheel]) {
      if (fw) fw.rotation.z = crankRad;
    }

    // Cam/lifter/pushrod/rocker/valve chain.
    if (this.camSpin) {
      for (const row of this.valveRows) {
        const noseWorld = camRad + row.lobeRotation;
        let delta = row.bankAxisRad - noseWorld;
        while (delta > Math.PI) delta -= TAU;
        while (delta < -Math.PI) delta += TAU;
        const lift =
          Math.abs(delta) >= row.halfWidthCam
            ? 0
            : LOBE_LIFT * Math.cos((Math.PI * delta) / (2 * row.halfWidthCam)) ** 2;
        row.camContact = lift;
        const lifterBodyTop = 84;
        const valleySign = row.valleySign;
        row.lifter.position.y = CAM_Y / Math.SQRT2 + CAM_BASE_RADIUS + ROLLER_RADIUS + lift;
        const pushArm = Math.abs(row.xPush - row.xPivot);
        const valveArm = Math.abs(row.xValve - row.xPivot);
        const a = Math.asin(THREE.MathUtils.clamp(lift / pushArm, -0.85, 0.85));
        // A positive rocker angle raises the inboard pushrod side of each bank.
        // The mirrored bank reverses the angle while still opening its valves.
        const theta = valleySign * a;
        row.rocker.rotation.z = theta;
        const valveLift = valveArm * Math.sin(a);
        row.currentValveLift = valveLift;
        row.bridge.position.y = VALVE_TIP_Y - valveLift;
        for (const v of row.valves) {
          v.motion.position.y = VALVE_TIP_Y - valveLift;
          v.springGroup.scale.y = Math.max(0.3, (v.springBaseLength - valveLift) / v.springBaseLength);
        }
        // Solve the pushrod between the lifter cup and the moving rocker cup.
        const lower = new THREE.Vector3(
          valleySign * (CAM_Y / Math.SQRT2),
          row.lifter.position.y + lifterBodyTop + 2,
          row.z,
        );
        const dxPush = row.xPush - row.xPivot;
        const upper = new THREE.Vector3(
          row.xPivot + dxPush * Math.cos(theta),
          456 + dxPush * Math.sin(theta),
          row.z,
        );
        const dir = upper.clone().sub(lower);
        const dist = dir.length();
        row.pushrod.position.copy(lower);
        row.pushrod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        row.pushrod.scale.set(1, Math.max(0.3, dist / row.pushrodBaseLength), 1);
      }
    }

    // Turbo shaft speed is tied to RPM with a small exhaust-pulse shimmer.
    const rpm = frame.rpm || 0;
    const firingPulse = 0.5 + 0.5 * Math.sin((crankDeg * DEG * 4) + t * 9);
    const turboBase = rpm > 20 ? 3.2 + (rpm / this.kinematics.redlineRpm) * 145 : 0;
    const turboRate = turboBase * frame.timeScale;
    for (const w of this.turboWheels) {
      w.group.rotation.z += turboRate * w.mult * dt * (0.94 + 0.06 * firingPulse);
    }
    if (this.turboActuator) {
      const vane = vaneAtRpm(this.entry, rpm);
      this.turboActuator.rotation.z = THREE.MathUtils.lerp(-0.35, 0.75, vane / 100);
    }

    // Injection glow and combustion flashes.
    const combustionEnabled = frame.fuel !== false && (frame.rpm || 0) > 5;
    for (const f of this.combustionFlashes) {
      const s = this.kinematics.cylinderState(f.c, crankDeg);
      const plug = frame.glow ?? 0;
      const intensity = combustionEnabled ? s.combustion : 0;
      f.sprite.material.opacity = intensity * 0.95 + plug * 0.03;
      const scale = 20 + intensity * 55;
      f.sprite.scale.set(scale, scale, 1);
      f.coneMat.opacity = combustionEnabled ? s.injection * 0.9 : 0;
      f.cone.scale.setScalar(0.7 + s.injection * 0.7);
    }
    for (const inj of this.injectors) {
      const s = this.kinematics.cylinderState(inj.cylinder, crankDeg);
      const pulse = combustionEnabled ? s.injection : 0;
      inj.glowMat.opacity = 0.05 + pulse * 0.95;
      inj.nozzleMat.opacity = pulse * 0.85;
    }
    const glowLevel = frame.glow ?? 0;
    for (const gp of this.glowPlugs) {
      gp.material.emissiveIntensity = 0.04 + glowLevel * 3.4;
    }

    // Damped cover labels follow the shell opacity.
    for (const c of this.coverLabels) {
      c.material.opacity = Math.max(0.02, 1 - effectiveCutaway * 0.98);
    }
  }
}

function makeGlowSpriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.14, 'rgba(255,214,134,0.92)');
  g.addColorStop(0.4, 'rgba(255,107,35,0.38)');
  g.addColorStop(1, 'rgba(255,45,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Standard V8 part identifiers; construction reads the supplied entry layout.
export const PART_IDS = [
  'block',
  'crank',
  'flywheel',
  'main-caps',
  'camshaft',
  'timing-gears',
  'cylinder-head-right',
  'cylinder-head-left',
  'valves',
  'lifters',
  'pushrods',
  'rockers',
  'valve-bridges',
  'valve-covers',
  'injectors',
  'glow-plugs',
  'oil-pan',
  'oil-filter',
  'front-drive',
  'exhaust-manifold-right',
  'exhaust-manifold-left',
  'turbo',
  'up-pipes',
  'intake-manifold',
  'charge-pipes',
  'egr',
  'cp3',
  'fuel-rails',
  'high-pressure-lines',
  'starter-motor',
  'wiring-harness',
  'exhaust-downpipe',
  'engine-mounts',
  ...Array.from({ length: 8 }, (_, index) => [`piston-${index + 1}`, `rod-${index + 1}`]).flat(),
];

export function buildEngine(materials, entry) {
  const builder = new EngineBuilder(materials, entry);
  try { return builder.build(); }
  catch (error) { builder.dispose(); throw error; }
}

export {
  DECK_Y,
  VALVE_TIP_Y,
  CAM_Y,
  CAM_BASE_RADIUS,
  ROLLER_RADIUS,
  LOBE_LIFT,
  XRAY_PICK_THRESHOLD,
};
