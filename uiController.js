// uiController.js - Handles UI elements, event listeners, and interactions

import * as THREE from 'three';
import { calculateFuturePosition } from './simulationUpdate.js'; // <<< FIX: Added missing import
import { BASE_PLANET_RADIUS } from './constants.js'; // Needed for focus transition calculation

// --- State (managed within this module) ---
let inputState = { thrust: false, turnLeft: false, turnRight: false };
let isAiPilotActive = false;
let selectedPlanetForPrediction = null;
let anomalyCooldown = 0;
let isTransitioning = false;
let transitionStartTime, transitionDuration;
let startCamPos = new THREE.Vector3();
let endCamPos = new THREE.Vector3();
let startTargetPos = new THREE.Vector3();
let endTargetPos = new THREE.Vector3();
let transitionRequestId = null;

// --- DOM Element References ---
const infoPanel = document.getElementById('infoPanel');
const closeButton = document.getElementById('closeButton');
const infoNameEl = document.getElementById('infoName');
const infoTypeEl = document.getElementById('infoType');
const infoDiameterEl = document.getElementById('infoDiameter');
const infoDistanceEl = document.getElementById('infoDistance');
const infoOrbitEl = document.getElementById('infoOrbit');
const infoRotationEl = document.getElementById('infoRotation');
const infoFeaturesEl = document.getElementById('infoFeatures');
const predictionPanel = document.getElementById('predictionPanel');
const predictPlanetNameEl = document.getElementById('predictPlanetName');
const predictionStatusEl = document.getElementById('predictionStatus');
const predictSimPos10El = document.getElementById('predictSimPos10');
const predictAIPos10El = document.getElementById('predictAIPos10');
const predictSimPos30El = document.getElementById('predictSimPos30');
const predictAIPos30El = document.getElementById('predictAIPos30');
const thrustBtn = document.getElementById('thrustBtn');
const turnLeftBtn = document.getElementById('turnLeftBtn');
const turnRightBtn = document.getElementById('turnRightBtn');
const focusShipBtn = document.getElementById('focusShipBtn');
const aiPilotBtn = document.getElementById('aiPilotBtn');

// --- Reusable Vectors ---
const tempVector3 = new THREE.Vector3(); // Local temp vector

/**
 * Sets up all event listeners for UI interactions.
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.Scene} scene
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Vector2} mouse
 * @param {Array<object>} celestialBodies - Array of simulation objects
 * @param {object} spacecraft - The spacecraft object
 * @param {OrbitControls} controls
 * @param {THREE.Clock} clock
 * @param {THREE.WebGLRenderer} renderer // <<< FIX: Added renderer parameter
 */
export function setupEventListeners(camera, scene, raycaster, mouse, celestialBodies, spacecraft, controls, clock, renderer) { // <<< FIX: Added renderer parameter
    // Pass renderer to onWindowResize
    window.addEventListener('resize', () => onWindowResize(camera, renderer)); // <<< FIX: Pass renderer
    window.addEventListener('click', (event) => onMouseClick(event, camera, raycaster, mouse, scene, celestialBodies, spacecraft, clock, controls)); // Pass clock & controls

    closeButton.addEventListener('click', hideInfoPanels);

    // Ship Control Listeners (Mouse) - Modify global inputState
    thrustBtn.addEventListener('mousedown', () => { if (!isAiPilotActive) inputState.thrust = true; });
    thrustBtn.addEventListener('mouseup', () => { if (!isAiPilotActive) inputState.thrust = false; });
    thrustBtn.addEventListener('mouseleave', () => { if (!isAiPilotActive) inputState.thrust = false; });
    turnLeftBtn.addEventListener('mousedown', () => { if (!isAiPilotActive) inputState.turnLeft = true; });
    turnLeftBtn.addEventListener('mouseup', () => { if (!isAiPilotActive) inputState.turnLeft = false; });
    turnLeftBtn.addEventListener('mouseleave', () => { if (!isAiPilotActive) inputState.turnLeft = false; });
    turnRightBtn.addEventListener('mousedown', () => { if (!isAiPilotActive) inputState.turnRight = true; });
    turnRightBtn.addEventListener('mouseup', () => { if (!isAiPilotActive) inputState.turnRight = false; });
    turnRightBtn.addEventListener('mouseleave', () => { if (!isAiPilotActive) inputState.turnRight = false; });

    // Ship Control Listeners (Keyboard) - Modify global inputState
     window.addEventListener('keydown', (event) => {
         if (isAiPilotActive) return;
         switch(event.key.toLowerCase()) { case 'w': inputState.thrust = true; break; case 'a': inputState.turnLeft = true; break; case 'd': inputState.turnRight = true; break; }
     });
     window.addEventListener('keyup', (event) => {
         if (event.key.toLowerCase() === 'p') { toggleAiPilot(); return; }
         if (isAiPilotActive) return;
         switch(event.key.toLowerCase()) { case 'w': inputState.thrust = false; break; case 'a': inputState.turnLeft = false; break; case 'd': inputState.turnRight = false; break; }
     });

     // Focus Ship Button Listener
     focusShipBtn.addEventListener('click', () => {
         if (spacecraft?.mesh) {
             startFocusTransition(spacecraft.mesh, camera, controls, clock);
         }
     });

     // AI Pilot Toggle Button Listener
     aiPilotBtn.addEventListener('click', toggleAiPilot);
     console.log("UI Event listeners set up.");
}

/**
 * Toggles the AI Pilot state and updates the button.
 */
export function toggleAiPilot() {
    isAiPilotActive = !isAiPilotActive;
    if (isAiPilotActive) {
        aiPilotBtn.textContent = "AI Pilot: ON";
        aiPilotBtn.classList.add('active');
        inputState = { thrust: false, turnLeft: false, turnRight: false }; // Reset manual input
    } else {
        aiPilotBtn.textContent = "AI Pilot: OFF";
        aiPilotBtn.classList.remove('active');
        inputState = { thrust: false, turnLeft: false, turnRight: false }; // Reset AI input
    }
    console.log(`AI Pilot Toggled: ${isAiPilotActive}`);
}

/**
 * Hides the Info and Prediction panels.
 */
export function hideInfoPanels() {
    infoPanel.style.display = 'none';
    predictionPanel.style.display = 'none';
    selectedPlanetForPrediction = null;
}

/**
 * Handles window resize events.
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer // <<< FIX: Added renderer parameter
 */
function onWindowResize(camera, renderer) { // <<< FIX: Added renderer parameter
     if (!camera || !renderer) return;
     camera.aspect = window.innerWidth / window.innerHeight;
     camera.updateProjectionMatrix();
     renderer.setSize(window.innerWidth, window.innerHeight); // <<< FIX: Use passed renderer
}

/**
 * Handles mouse clicks for object selection and info display.
 * @param {MouseEvent} event
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Vector2} mouse
 * @param {THREE.Scene} scene
 * @param {Array<object>} celestialBodies
 * @param {object} spacecraft
 * @param {THREE.Clock} clock
 * @param {OrbitControls} controls
 */
function onMouseClick(event, camera, raycaster, mouse, scene, celestialBodies, spacecraft, clock, controls) {
     if (!raycaster || !camera || !mouse || isTransitioning) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersectMeshes = [];
    celestialBodies.forEach(body => {
        if (body.mesh) intersectMeshes.push(body.mesh);
        if (body.moons) { body.moons.forEach(moon => { if (moon.mesh) intersectMeshes.push(moon.mesh); }); }
    });
    if (spacecraft?.mesh) intersectMeshes.push(spacecraft.mesh);

    const intersects = raycaster.intersectObjects(intersectMeshes);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        const data = clickedObject.userData;

        if (data && data.name) {
            updateInfoPanelDOM(data); // Call dedicated function
            infoPanel.style.display = 'block';

            if (data.isPlanet) {
                // Find the full planet object from celestialBodies to pass to prediction
                selectedPlanetForPrediction = celestialBodies.find(b => b.mesh === clickedObject);
                if (selectedPlanetForPrediction) {
                    predictPlanetNameEl.textContent = data.name;
                    predictionPanel.style.display = 'block';
                    updatePredictionPanelDOM(selectedPlanetForPrediction, 0); // Update immediately
                } else {
                    console.warn("Could not find planet object for prediction panel.");
                    predictionPanel.style.display = 'none';
                }
            } else {
                selectedPlanetForPrediction = null;
                predictionPanel.style.display = 'none';
            }
        } else if (clickedObject === spacecraft?.mesh) {
             updateInfoPanelDOM({ name: "Spacecraft", info: `Velocity: ${spacecraft.velocity.length().toFixed(2)} units/s` });
             infoPanel.style.display = 'block';
             selectedPlanetForPrediction = null;
             predictionPanel.style.display = 'none';
        }
    } else {
         hideInfoPanels();
    }
}

/**
 * Updates the main info panel DOM elements.
 * @param {object} data - The userData object from the clicked mesh.
 */
function updateInfoPanelDOM(data) {
    infoNameEl.textContent = data.name || '-';
    infoTypeEl.textContent = data.type || (data.info ? '' : 'Celestial Body');
    infoDiameterEl.textContent = data.diameter || '-';
    if (data.type?.includes('Star')) { infoDistanceEl.textContent = 'N/A (Center)'; }
    else if (data.type?.includes('Satellite')) { infoDistanceEl.textContent = data.distance || '-'; }
    else { infoDistanceEl.textContent = data.avgDistance || (data.distance ? `${data.distance} sim units` : '-'); }
    infoOrbitEl.textContent = data.orbit || '-';
    infoRotationEl.textContent = data.rotation || '-';
    infoFeaturesEl.innerHTML = '';
    if (data.features && data.features.length > 0) {
        data.features.forEach(feature => { const li = document.createElement('li'); li.textContent = feature; infoFeaturesEl.appendChild(li); });
    } else {
         if(data.info && !data.features) { const p = document.createElement('p'); p.textContent = data.info; infoFeaturesEl.appendChild(p); }
         else { infoFeaturesEl.innerHTML = '<li>-</li>'; }
    }
}


/**
 * Updates the prediction panel DOM elements.
 * @param {object} body - The celestial body object to predict for.
 * @param {number} delta - Time delta for anomaly cooldown.
 */
export function updatePredictionPanelDOM(body, delta) { // Export for use in main loop
    if (!body || !predictionPanel || predictionPanel.style.display === 'none') return;

    // Anomaly Simulation
    anomalyCooldown -= delta;
    let currentStatus = predictionStatusEl.textContent;
    if (anomalyCooldown <= 0) {
         if (Math.random() < 0.005) { currentStatus = "Anomaly Detected!"; predictionStatusEl.className = 'anomaly'; anomalyCooldown = 5.0; }
         else { if (currentStatus === "Anomaly Detected!") { currentStatus = "Nominal"; predictionStatusEl.className = 'nominal'; } }
    }
    predictionStatusEl.textContent = currentStatus;

    // Position Prediction (using imported logic)
    const timeStep1 = 10; const timeStep2 = 30;
    const simPos10 = calculateFuturePosition(body, timeStep1); // Assumes calculateFuturePosition is imported
    const simPos30 = calculateFuturePosition(body, timeStep2);
    const aiPos10 = simPos10.clone().add(new THREE.Vector3((Math.random()-0.5)*0.5, 0, (Math.random()-0.5)*0.5));
    const aiPos30 = simPos30.clone().add(new THREE.Vector3((Math.random()-0.5)*1.0, 0, (Math.random()-0.5)*1.0));
    const formatVec = (v) => `(X:${v.x.toFixed(1)}, Z:${v.z.toFixed(1)})`;

    predictSimPos10El.textContent = formatVec(simPos10);
    predictAIPos10El.textContent = formatVec(aiPos10);
    predictSimPos30El.textContent = formatVec(simPos30);
    predictAIPos30El.textContent = formatVec(aiPos30);
}

// --- Camera Focus Transition Logic ---
/**
 * Starts the smooth camera focus transition.
 * @param {THREE.Mesh} targetObject
 * @param {THREE.PerspectiveCamera} camera
 * @param {OrbitControls} controls
 * @param {THREE.Clock} clock
 */
export function startFocusTransition(targetObject, camera, controls, clock) {
    if (!targetObject || isTransitioning) return;
     // Use helper function for radius
    const objectRadius = objectRadiusHelper(targetObject);
    if (transitionRequestId) { cancelAnimationFrame(transitionRequestId); }

    targetObject.getWorldPosition(tempVector3);
    const targetPosition = tempVector3.clone();
    const cameraDistance = objectRadius * 5 + 15;
    const cameraHeight = objectRadius * 1.5 + 10;

    isTransitioning = true;
    transitionStartTime = clock.elapsedTime;
    transitionDuration = 1.2;
    startCamPos.copy(camera.position);
    startTargetPos.copy(controls.target);
    endTargetPos.copy(targetPosition);
    endCamPos.set( targetPosition.x + cameraDistance * 0.5, targetPosition.y + cameraHeight, targetPosition.z + cameraDistance * 0.866 );

    console.log(`Starting transition to ${targetObject.userData.name || 'object'}`);
    // Start the RAF loop for the transition
    updateCameraTransition(camera, controls, clock); // Pass dependencies
}

/**
 * Updates the camera position and target during transition.
 * Called recursively via requestAnimationFrame.
 * @param {THREE.PerspectiveCamera} camera
 * @param {OrbitControls} controls
 * @param {THREE.Clock} clock
 */
function updateCameraTransition(camera, controls, clock) {
    if (!isTransitioning) return;

    // Use clock's delta if available, otherwise estimate (less accurate)
    const delta = clock ? clock.getDelta() : 0.016;
    const elapsedTime = (clock ? clock.elapsedTime : Date.now()/1000) - transitionStartTime; // Use elapsed time
    let progress = elapsedTime / transitionDuration;
    progress = Math.min(progress, 1);
    const t = easeInOutCubic(progress);

    camera.position.lerpVectors(startCamPos, endCamPos, t);
    controls.target.lerpVectors(startTargetPos, endTargetPos, t);
    controls.update(); // Still needed

    if (progress >= 1) {
        isTransitioning = false;
        transitionRequestId = null;
        camera.position.copy(endCamPos); // Snap to final
        controls.target.copy(endTargetPos);
        controls.update(); // Final update
        console.log("Transition complete.");
    } else {
         // Continue transition on next frame
         transitionRequestId = requestAnimationFrame(() => updateCameraTransition(camera, controls, clock));
    }
}

/** Easing function */
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

// Helper to get object radius safely
function objectRadiusHelper(obj) {
    return obj?.geometry?.boundingSphere?.radius ?? (obj?.scale?.x * BASE_PLANET_RADIUS) ?? 1;
}


// Export necessary state or functions if needed by main.js
export function getIsTransitioning() { return isTransitioning; }
export function getInputState() { return inputState; }
export function getIsAiPilotActive() { return isAiPilotActive; }
export function getSelectedPlanetForPrediction() { return selectedPlanetForPrediction; }

