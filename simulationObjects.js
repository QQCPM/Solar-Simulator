// simulationObjects.js - Functions for creating simulation objects

import * as THREE from 'three';
import { BASE_PLANET_RADIUS } from './constants.js'; // Import constants
import { generateGlowTexture } from './sceneSetup.js'; // Import shared helper

// --- Planet Data (Consider moving to data.js) ---
const planetData = [
    { name: 'Mercury', type: 'Planet (Terrestrial)', radius: 0.38, distance: 15, color: 0xaaaaaa, speed: 0.8, axialSpeed: 0.1, diameter: '4,880 km', orbit: '88 Earth days', rotation: '59 Earth days', avgDistance: '58 million km', features: ['Smallest planet', 'No moons'] },
    { name: 'Venus', type: 'Planet (Terrestrial)', radius: 0.95, distance: 25, color: 0xffe4b5, speed: 0.5, axialSpeed: 0.005, diameter: '12,104 km', orbit: '225 Earth days', rotation: '243 Earth days (Retrograde)', avgDistance: '108 million km', features: ['Hottest planet', 'Rotates backwards'] },
    { name: 'Earth', type: 'Planet (Terrestrial)', radius: 1.0, distance: 38, color: 0x6495ed, speed: 0.3, axialSpeed: 0.2, hasMoon: true, diameter: '12,742 km', orbit: '365.25 Earth days', rotation: '24 hours', avgDistance: '150 million km (1 AU)', features: ['Supports life', 'Liquid water'] },
    { name: 'Mars', type: 'Planet (Terrestrial)', radius: 0.53, distance: 55, color: 0xff4500, speed: 0.2, axialSpeed: 0.18, diameter: '6,779 km', orbit: '687 Earth days', rotation: '~24.6 hours', avgDistance: '228 million km', features: ['"Red Planet"', 'Olympus Mons'] },
    { name: 'Jupiter', type: 'Planet (Gas Giant)', radius: 4.0, distance: 100, color: 0xffa500, speed: 0.1, axialSpeed: 0.45, diameter: '139,820 km', orbit: '~12 Earth years', rotation: '~10 hours', avgDistance: '778 million km', features: ['Largest planet', 'Great Red Spot'] },
    { name: 'Saturn', type: 'Planet (Gas Giant)', radius: 3.5, distance: 150, color: 0xf4a460, speed: 0.06, axialSpeed: 0.38, hasRing: true, diameter: '116,460 km', orbit: '~29.5 Earth years', rotation: '~10.7 hours', avgDistance: '1.4 billion km', features: ['Prominent rings', 'Low density'] },
    { name: 'Uranus', type: 'Planet (Ice Giant)', radius: 2.0, distance: 200, color: 0xadd8e6, speed: 0.04, axialSpeed: 0.25, diameter: '50,724 km', orbit: '~84 Earth years', rotation: '~17 hours (Retrograde)', avgDistance: '2.9 billion km', features: ['Tilted on its side'] },
    { name: 'Neptune', type: 'Planet (Ice Giant)', radius: 1.9, distance: 250, color: 0x4682b4, speed: 0.03, axialSpeed: 0.26, diameter: '49,244 km', orbit: '~165 Earth years', rotation: '~16 hours', avgDistance: '4.5 billion km', features: ['Farthest planet'] }
];

/**
 * Creates the Sun object.
 * @param {THREE.Scene} scene - The scene to add the Sun to.
 * @returns {object} The Sun object containing mesh, speed, etc.
 */
export function createSun(scene) {
    const sunGeometry = new THREE.SphereGeometry(BASE_PLANET_RADIUS * 1.8, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunMesh.userData = { name: 'Sun', type: 'Star (G-type)', diameter: '1.39 million km', distance: 'N/A', orbit: 'N/A (Center)', rotation: '~27 Earth days', features: ['Provides light and heat', 'Center of the Solar System'] };
    const spriteMaterial = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(generateGlowTexture(128, 'rgba(255,220,0,0.5)', 'rgba(255,255,255,0.8)')), color: 0xffdd00, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const sunGlow = new THREE.Sprite(spriteMaterial);
    sunGlow.scale.set(BASE_PLANET_RADIUS * 10, BASE_PLANET_RADIUS * 10, 1.0);
    sunMesh.add(sunGlow);
    scene.add(sunMesh);
    console.log("Sun created.");
    return { mesh: sunMesh, pivot: null, speed: 0, axialSpeed: 0.02 };
}

/**
 * Creates all planets, moons, and rings based on planetData.
 * @param {THREE.Scene} scene - The scene to add objects to.
 * @returns {Array<object>} An array of created planet objects.
 */
export function createPlanets(scene) {
    const createdBodies = [];
    planetData.forEach(data => {
        const pivot = new THREE.Object3D(); scene.add(pivot);
        const geometry = new THREE.SphereGeometry(BASE_PLANET_RADIUS * data.radius, 32, 16);
        const material = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.8, metalness: 0.1 });
        const planetMesh = new THREE.Mesh(geometry, material);
        planetMesh.userData = { ...data, isPlanet: true };
        planetMesh.position.x = data.distance; pivot.add(planetMesh);
        createOrbitLine(scene, data.distance);
        const planetObj = { mesh: planetMesh, pivot: pivot, speed: data.speed, axialSpeed: data.axialSpeed, moons: [] };
        createdBodies.push(planetObj);
        if (data.hasRing) { createSaturnRing(planetMesh, data.radius); }
        if (data.hasMoon) { createEarthMoon(planetMesh, planetObj); } // Pass planetObj to store moon ref
    });
    console.log("Planets created.");
    return createdBodies;
}

/**
 * Creates Saturn's rings and adds them to the parent mesh.
 * @param {THREE.Mesh} saturnMesh - The mesh of the Saturn planet.
 * @param {number} saturnRadius - The base radius factor for Saturn.
 */
function createSaturnRing(saturnMesh, saturnRadius) {
     const innerRadius = BASE_PLANET_RADIUS * saturnRadius * 1.2;
     const outerRadius = BASE_PLANET_RADIUS * saturnRadius * 2.0;
     const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);
     const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaa88, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
     const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
     ringMesh.rotation.x = Math.PI / 2;
     saturnMesh.add(ringMesh);
}

/**
 * Creates Earth's moon and adds it to the parent mesh and object data.
 * @param {THREE.Mesh} earthMesh - The mesh of the Earth planet.
 * @param {object} earthObject - The data object for Earth from celestialBodies.
 */
function createEarthMoon(earthMesh, earthObject) {
    const moonRadius = 0.27 * BASE_PLANET_RADIUS; const moonDistance = 5;
    const moonOrbitalSpeed = 1.5; const moonAxialSpeed = 0.05;
    const moonPivot = new THREE.Object3D(); earthMesh.add(moonPivot); // Pivot is child of Earth MESH
    const moonGeometry = new THREE.SphereGeometry(moonRadius, 16, 8);
    const moonMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 });
    const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    moonMesh.userData = { name: 'Moon', type: 'Natural Satellite', isMoon: true, diameter: '3,474 km', distance: 'Avg. 384,400 km (from Earth)', orbit: '~27.3 Earth days (around Earth)', rotation: '~27.3 Earth days (Synchronous)', features: ["Earth's only natural satellite", 'No atmosphere'] };
    moonMesh.position.x = moonDistance; moonPivot.add(moonMesh);
    // Add moon data to the parent Earth object's moon array
    earthObject.moons.push({ mesh: moonMesh, pivot: moonPivot, speed: moonOrbitalSpeed, axialSpeed: moonAxialSpeed });
}

/**
 * Creates a visual orbit line.
 * @param {THREE.Scene} scene - The scene to add the line to.
 * @param {number} distance - The radius of the orbit.
 */
function createOrbitLine(scene, distance) {
    const points = []; const segments = 128;
    for (let i = 0; i <= segments; i++) { const theta = (i / segments) * Math.PI * 2; points.push(new THREE.Vector3(Math.cos(theta) * distance, 0, Math.sin(theta) * distance)); }
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.4 });
    const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
    scene.add(orbitLine);
}

/**
 * Creates the spacecraft object.
 * @param {THREE.Scene} scene - The scene to add the spacecraft to.
 * @param {THREE.Vector3} initialPosition - The starting position.
 * @returns {object} The spacecraft state object.
 */
export function createSpacecraft(scene, initialPosition) {
    const shipSize = 2.5;
    const geometry = new THREE.ConeGeometry(shipSize * 0.5, shipSize * 1.5, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0x87ceeb, metalness: 0.5, roughness: 0.5 });
    const shipMesh = new THREE.Mesh(geometry, material);
    shipMesh.userData = { name: "Spacecraft", info: "Player/AI-controlled vessel." };
    shipMesh.position.copy(initialPosition);
    shipMesh.rotation.x = Math.PI / 2; // Orient cone
    scene.add(shipMesh);
    console.log("Spacecraft created.");
    return { mesh: shipMesh, velocity: new THREE.Vector3(0, 0, 0), turnSpeed: 2.5, thrustPower: 7.0, drag: 0.98, maxSpeed: 30.0 };
}

/**
 * Creates and adds the trajectory line object to the scene.
 * @param {THREE.Scene} scene - The scene to add the line to.
 * @param {object} spacecraft - The spacecraft object.
 * @returns {THREE.Line} The created line object.
 */
export function initTrajectoryLine(scene, spacecraft) {
     const trajectoryMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 1 });
     const initialPoints = spacecraft ? [spacecraft.mesh.position.clone()] : [];
     const trajectoryGeometry = new THREE.BufferGeometry().setFromPoints(initialPoints);
     const line = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
     scene.add(line);
     console.log("Trajectory line initialized.");
     return line;
}
