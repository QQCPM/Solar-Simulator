// simulationUpdate.js - Functions for updating object states each frame

import * as THREE from 'three';
import { BASE_PLANET_RADIUS } from './constants.js'; // Import constants

// Reusable vectors for calculations within this 'module'
const _updateShipForward = new THREE.Vector3();
const _updateTempVec3 = new THREE.Vector3();
const _updateTargetDirection = new THREE.Vector3();

/**
 * Updates orbital and axial rotation for all celestial bodies.
 * @param {Array<object>} celestialBodies - Array of simulation objects.
 * @param {number} delta - Time delta since last frame.
 * @param {boolean} isPaused - Whether the simulation is paused.
 */
export function updateCelestials(celestialBodies, delta, isPaused) {
     if (isPaused) return;

     celestialBodies.forEach(body => {
        // Orbital Rotation
        if (body.pivot && typeof body.speed === 'number') {
            body.pivot.rotation.y += body.speed * delta;
        }
        // Axial Rotation
        if (body.mesh && typeof body.axialSpeed === 'number') {
            body.mesh.rotation.y += body.axialSpeed * delta;
        }
        // Moon Orbital Rotation
        if (body.moons) {
            body.moons.forEach(moon => {
                if (moon.pivot && typeof moon.speed === 'number') {
                    moon.pivot.rotation.y += moon.speed * delta;
                }
                if (moon.mesh && typeof moon.axialSpeed === 'number') {
                    moon.mesh.rotation.y += moon.axialSpeed * delta;
                }
            });
        }
    });
}

/**
 * Updates the spacecraft's position, velocity, and rotation based on input state.
 * @param {object} spacecraft - The spacecraft state object.
 * @param {object} inputState - The current state of user/AI inputs.
 * @param {number} delta - Time delta since last frame.
 */
export function updateSpacecraft(spacecraft, inputState, delta) {
    if (!spacecraft) return;

    // Turning
    let turnAmount = 0;
    if (inputState.turnLeft) turnAmount += spacecraft.turnSpeed * delta;
    if (inputState.turnRight) turnAmount -= spacecraft.turnSpeed * delta;
    spacecraft.mesh.rotateY(turnAmount); // Rotate around local Y

    // Thrust
    if (inputState.thrust) {
        _updateShipForward.set(0, 0, -1).applyQuaternion(spacecraft.mesh.quaternion);
        _updateTempVec3.copy(_updateShipForward).multiplyScalar(spacecraft.thrustPower * delta);
        spacecraft.velocity.add(_updateTempVec3);
    }

    // Drag & Speed Limit
    spacecraft.velocity.multiplyScalar(spacecraft.drag);
    if (spacecraft.velocity.lengthSq() > spacecraft.maxSpeed * spacecraft.maxSpeed) {
         spacecraft.velocity.normalize().multiplyScalar(spacecraft.maxSpeed);
    }

    // Update Position
    _updateTempVec3.copy(spacecraft.velocity).multiplyScalar(delta);
    spacecraft.mesh.position.add(_updateTempVec3);
}

/**
 * Updates the geometry of the spacecraft's trajectory line.
 * @param {object} spacecraft
 * @param {THREE.Line} trajectoryLine
 * @param {Array<THREE.Vector3>} trajectoryPoints
 * @param {number} maxPoints
 */
export function updateTrajectoryLine(spacecraft, trajectoryLine, trajectoryPoints, maxPoints) {
    if (!spacecraft || !trajectoryLine || !trajectoryPoints) return;
    const currentPosition = spacecraft.mesh.position.clone();
    // Avoid adding duplicate points if the ship hasn't moved
    if (trajectoryPoints.length === 0 || !trajectoryPoints[0].equals(currentPosition)) {
        trajectoryPoints.unshift(currentPosition); // Add to start
        while (trajectoryPoints.length > maxPoints) { trajectoryPoints.pop(); } // Remove from end
        trajectoryLine.geometry.setFromPoints(trajectoryPoints);
        trajectoryLine.geometry.computeBoundingSphere(); // Important
    }
}

/**
 * Updates the inputState based on simple AI logic if active.
 * @param {object} spacecraft
 * @param {THREE.Mesh} targetObject - The mesh the AI should target (e.g., Mars).
 * @param {object} inputState - The input state object to modify.
 * @param {number} delta - Time delta.
 * @param {boolean} isAiActive - Whether the AI pilot is active.
 */
export function updateAiPilot(spacecraft, targetObject, inputState, delta, isAiActive) {
     if (!isAiActive || !spacecraft || !targetObject) {
         // Ensure inputs are off if AI is inactive or target missing
         inputState.thrust = false; inputState.turnLeft = false; inputState.turnRight = false;
         return;
     }

    const shipPos = spacecraft.mesh.position;
    const targetPos = targetObject.getWorldPosition(_updateTempVec3); // Use temp vector
    _updateTargetDirection.subVectors(targetPos, shipPos).normalize();
    // Get ship's forward direction (local Z is forward after initial rotation)
    _updateShipForward.set(0, 0, -1).applyQuaternion(spacecraft.mesh.quaternion);

    const angle = _updateShipForward.angleTo(_updateTargetDirection);

    // Determine turn direction using cross product relative to ship's up vector (local Y)
    const shipUp = new THREE.Vector3(0, 1, 0).applyQuaternion(spacecraft.mesh.quaternion);
    const cross = _updateTempVec3.crossVectors(_updateShipForward, _updateTargetDirection);
    // Project cross product onto ship's up vector to get turn direction sign
    const turnDirectionSign = Math.sign(cross.dot(shipUp));


    const angleThreshold = THREE.MathUtils.degToRad(5); // Smaller tolerance
    const distanceToTarget = shipPos.distanceTo(targetPos);

    // Reset inputs before AI sets them
    inputState.turnLeft = false; inputState.turnRight = false; inputState.thrust = false;

    if (angle > angleThreshold) {
        // Need to turn (use sign from cross product projection)
        if (turnDirectionSign > 0) { // Target is effectively to the 'left' relative to ship's up
            inputState.turnLeft = true;
        } else { // Target is effectively to the 'right'
            inputState.turnRight = true;
        }
        // Maybe apply less thrust while turning significantly?
        // inputState.thrust = distanceToTarget > objectRadius(targetObject) * 5; // Only thrust if far away and turning
    } else {
         // Facing target, apply thrust (unless very close)
         if (distanceToTarget > objectRadius(targetObject) * 2.0) { // Maintain slightly larger distance
             inputState.thrust = true;
         }
    }
}

/**
 * Helper to safely get an object's radius.
 * @param {THREE.Mesh} obj - The mesh object.
 * @returns {number} The radius or a default value.
 */
export function objectRadius(obj) {
    return obj?.geometry?.boundingSphere?.radius ?? (obj?.scale?.x * BASE_PLANET_RADIUS) ?? 1;
}

/**
 * Calculates the future position of a body based on its current orbit.
 * NOTE: This is a simplified calculation assuming circular orbits around origin.
 * @param {object} body - The celestial body object { mesh, pivot, speed }.
 * @param {number} timeAhead - Time in seconds to predict ahead.
 * @returns {THREE.Vector3} The predicted world position.
 */
export function calculateFuturePosition(body, timeAhead) {
     // Check if body and necessary properties exist
     if (!body || !body.pivot || typeof body.speed !== 'number' || !body.mesh) {
         console.warn("Invalid body data for prediction:", body);
         return new THREE.Vector3(); // Return origin or handle error appropriately
     }
     // Current angle of the pivot
     const currentAngle = body.pivot.rotation.y;
     // Future angle: current + speed * time
     // Note: body.speed is likely radians per *delta*, need to adjust if it represents radians per second
     // Assuming body.speed is scaled appropriately for delta time usage elsewhere,
     // we might need a base speed value if using timeAhead in seconds.
     // Let's assume body.speed is radians per second for this prediction.
     const futureAngle = currentAngle + body.speed * timeAhead; // Use timeAhead directly
     // Original distance from pivot center (stored in mesh x position relative to pivot)
     const distance = body.mesh.position.x;

     // Calculate future position relative to pivot's origin
     // Assumes pivot is at world origin (0,0,0) for planets orbiting the Sun
     const futureX = Math.cos(futureAngle) * distance;
     const futureZ = Math.sin(futureAngle) * distance;

     // Get pivot's world position (should be 0,0,0 for planets around Sun)
     const pivotPosition = new THREE.Vector3();
     body.pivot.getWorldPosition(pivotPosition); // Although likely 0,0,0

     // Return the calculated world position
     return new THREE.Vector3(pivotPosition.x + futureX, pivotPosition.y, pivotPosition.z + futureZ);
}
