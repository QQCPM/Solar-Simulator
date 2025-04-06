// sceneSetup.js - Functions for creating core Three.js components

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Creates the main Three.js scene.
 * @returns {THREE.Scene} The created scene.
 */
export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011); // Dark blue background
    console.log("Scene created.");
    return scene;
}

/**
 * Creates the perspective camera.
 * @returns {THREE.PerspectiveCamera} The created camera.
 */
export function createCamera() {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 80, 180); // Initial position
    console.log("Camera created.");
    return camera;
}

/**
 * Creates the WebGL renderer and appends it to the container.
 * @returns {THREE.WebGLRenderer} The created renderer.
 */
export function createRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('container').appendChild(renderer.domElement);
    console.log("Renderer created and added to DOM.");
    return renderer;
}

/**
 * Creates the OrbitControls.
 * @param {THREE.Camera} camera - The camera to control.
 * @param {HTMLElement} domElement - The renderer's DOM element.
 * @returns {OrbitControls} The created controls.
 */
export function createControls(camera, domElement) {
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 1000;
    controls.target.set(0, 0, 0);
    console.log("OrbitControls created.");
    return controls;
}

/**
 * Creates and adds lights to the scene.
 * @param {THREE.Scene} scene - The scene to add lights to.
 */
export function createLights(scene) {
    const ambientLight = new THREE.AmbientLight(0x606060, 1.0); // Brighter ambient grey
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 3, 0, 1.5); // Light at Sol's position
    scene.add(pointLight);
    console.log("Lights created.");
}

/**
 * Creates and adds a starry background to the scene.
 * @param {THREE.Scene} scene - The scene to add the background to.
 */
export function createStarryBackground(scene) {
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    const starCount = 10000; const range = 1000;
    for (let i = 0; i < starCount; i++) {
        const x = (Math.random() - 0.5) * 2 * range; const y = (Math.random() - 0.5) * 2 * range; const z = (Math.random() - 0.5) * 2 * range;
        const distSq = x*x + y*y + z*z; if (distSq > 100*100) { starVertices.push(x, y, z); }
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: true });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    console.log("Starry background created.");
}

/**
 * Generates a canvas texture for a radial gradient glow.
 * @param {number} size - The width and height of the canvas.
 * @param {string} colorInner - The inner color (e.g., 'rgba(255,220,0,0.5)').
 * @param {string} colorOuter - The outer color (center of gradient, e.g., 'rgba(255,255,255,0.8)').
 * @returns {HTMLCanvasElement} The canvas element with the gradient texture.
 */
 export function generateGlowTexture(size, colorInner, colorOuter) {
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0.1, colorOuter || 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.4, colorInner || 'rgba(255, 220, 0, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Transparent edge
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
}
