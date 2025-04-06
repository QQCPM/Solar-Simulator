// main.js - Main entry point for the Solar System Simulation

import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';

// Import setup functions
import {
    createScene, createCamera, createRenderer, createControls,
    createLights, createStarryBackground
} from './sceneSetup.js';

// Import object creation functions
import {
    createSun, createPlanets, createSpacecraft, initTrajectoryLine
} from './simulationObjects.js';

// Import UI and interaction functions
import {
    setupEventListeners, updatePredictionPanelDOM, // Removed hideInfoPanels (internal now)
    getIsTransitioning, getInputState, getIsAiPilotActive,
    getSelectedPlanetForPrediction
    // Removed startFocusTransition (internal now)
} from './uiController.js';

// Import simulation update functions
import {
    updateCelestials, updateSpacecraft, updateTrajectoryLine, updateAiPilot
} from './simulationUpdate.js';

// Import constants
import { MAX_TRAJECTORY_POINTS } from './constants.js';


// --- Global State Variables (managed primarily in main.js) ---
let scene, camera, renderer, controls, clock, raycaster, mouse, stats;
let celestialBodies = []; // Combined list {mesh, pivot?, speed?, axialSpeed?, moons?:[]}
let spacecraft = null;    // Spacecraft object {mesh, velocity, ...}
let shipTrajectoryLine = null;
const shipTrajectoryPoints = []; // Points for trajectory
let aiTargetObject = null; // Target mesh for AI pilot
let isPaused = false; // Keep pause state accessible here for now

/**
 * Initializes the entire application.
 */
function initApp() {
    console.log("main.js: Initializing App");
    try {
        // --- Core Setup ---
        scene = createScene();
        camera = createCamera();
        renderer = createRenderer(); // Renderer is created and added to DOM
        controls = createControls(camera, renderer.domElement); // Pass renderer DOM element
        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        stats = new Stats();
        document.body.appendChild(stats.domElement);
        stats.domElement.id = 'statsPanel';

        // --- Lighting & Background ---
        createLights(scene);
        createStarryBackground(scene);

        // --- Create Objects ---
        const sun = createSun(scene);
        const planets = createPlanets(scene); // Returns array of planet objects
        celestialBodies = [sun, ...planets]; // Combine sun and planets

        // Find Earth to position spacecraft
        const earthObj = planets.find(p => p.mesh?.userData?.name === 'Earth');
        let initialShipPos = new THREE.Vector3(0, 2, 45); // Fallback
        if(earthObj?.mesh) {
             // Get world position accurately AFTER earth object is potentially added to scene/pivot
             earthObj.mesh.getWorldPosition(initialShipPos);
             initialShipPos.add(new THREE.Vector3(0, 2, 5)); // Adjust offset
        }
        spacecraft = createSpacecraft(scene, initialShipPos);
        shipTrajectoryLine = initTrajectoryLine(scene, spacecraft);

        // Find AI target (Mars)
        const marsBody = planets.find(b => b.mesh?.userData?.name === 'Mars');
        if (marsBody) { aiTargetObject = marsBody.mesh; }
        else { console.warn("Mars not found, AI Pilot target not set."); }


        // --- Setup UI & Event Listeners ---
        // Pass necessary state and objects to the UI controller setup
        setupEventListeners(
            camera, scene, raycaster, mouse,
            celestialBodies, // Pass all bodies for clicking
            spacecraft, controls, clock,
            renderer // <<< FIX: Pass renderer
        );

        // --- Finish ---
        document.getElementById('loadingIndicator').style.display = 'none';
        animate(); // Start the main loop
        console.log("main.js: Initialization complete.");

    } catch (error) {
        console.error("Fatal Error during Initialization:", error);
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = `<h2>Initialization Error</h2><p>${error.message}</p><button onclick="location.reload()">Reload</button>`;
            loadingIndicator.style.display = 'block';
            loadingIndicator.style.color = 'red';
        }
    }
}

/**
 * The main animation loop.
 */
function animate() {
    requestAnimationFrame(animate); // Loop

    // Ensure init is complete
    if (!clock || !renderer || !scene || !camera || !controls) return;

    if(stats) stats.begin(); // Start FPS counter

    const delta = clock.getDelta();

    // Get current state from UI controller (assuming these functions exist and are exported)
    const isTransitioning = getIsTransitioning();
    const inputState = getInputState();
    const isAiPilotActive = getIsAiPilotActive();
    const selectedPlanetForPrediction = getSelectedPlanetForPrediction();

    // Update AI Pilot (modifies inputState)
    updateAiPilot(spacecraft, aiTargetObject, inputState, delta, isAiPilotActive);

    // Update Camera Transition (managed within uiController's RAF loop)
    // No direct call needed here if uiController handles its own RAF

    // Update Controls only if NOT transitioning
    if (!isTransitioning) {
         controls.update();
    }

    // Update Spacecraft (uses inputState modified by user or AI)
    updateSpacecraft(spacecraft, inputState, delta);

    // Update Trajectory Line
    updateTrajectoryLine(spacecraft, shipTrajectoryLine, shipTrajectoryPoints, MAX_TRAJECTORY_POINTS);

    // Update Celestials (pass isPaused state if needed, currently global)
    updateCelestials(celestialBodies, delta, isPaused);

    // Update Prediction Panel DOM (call UI function)
    if (selectedPlanetForPrediction) {
        updatePredictionPanelDOM(selectedPlanetForPrediction, delta);
    }

    // Render
    renderer.render(scene, camera);

    if(stats) stats.end(); // End FPS counter
}

 // --- Global Error Handler ---
 window.onerror = function(message, source, lineno, colno, error) {
     console.error("Unhandled Error ->", message, "in", source, `(${lineno}:${colno})`, error);
     const loadingIndicator = document.getElementById('loadingIndicator');
     if (loadingIndicator) { // Check if element exists
        loadingIndicator.innerHTML = `<h2>Runtime Error</h2><p>${message}</p><button onclick="location.reload()">Reload</button>`;
        loadingIndicator.style.display = 'block'; loadingIndicator.style.color = 'red';
     }
     return true;
 };

// --- Start the application ---
initApp(); // Call the main initialization function
