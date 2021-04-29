/**
 * app.js
 *
 * This is the first file loaded. It sets up the Renderer,
 * Scene and Camera. It also starts the render loop and
 * handles window resizes.
 *
 */
import { WebGLRenderer, WebGLRenderTarget, PerspectiveCamera, Vector3, Vector2, Texture } from 'three';
import { Group, LineBasicMaterial, Line, BufferGeometry, BufferAttribute } from 'three';

// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {PointerLockControls} from 'three/examples/jsm/controls/PointerLockControls.js';
import { MainScene } from 'scenes';
import {initPhysics} from './physics.js';
const Stats = require("stats.js");

class AppData {
    constructor() {
        // initialize physics
        this.cworld = initPhysics();

        // Initialize core ThreeJS components
        this.camera = new PerspectiveCamera();
        window.camera = this.camera
        this.renderer = new WebGLRenderer({ antialias: true });

        let screenSize = new Vector2()
        this.renderer.getSize(screenSize)
        const width = screenSize.x
        const height = screenSize.y
        this.portal1Target = new WebGLRenderTarget(width, height)
        this.portal2Target = new WebGLRenderTarget(width, height)
        this.portal1TargetTmp = new WebGLRenderTarget(width, height)
        this.portal2TargetTmp = new WebGLRenderTarget(width, height)
        this.controls = new PointerLockControls(this.camera, document.body);

        this.scene = new MainScene(this.cworld, this.controls);
    }
}

const appData = new AppData()

// Set up camera
appData.camera.position.set(0, 10, 0);
appData.camera.lookAt(new Vector3(0, 0, 0));


// Adapted from https://stackoverflow.com/questions/31655888/how-to-cast-a-visible-ray-threejs
var material = new LineBasicMaterial({ color: 0xAAFFAA });

// crosshair size
var x = 10, y = 10;

var geometry = new BufferGeometry();

const vertices = new Float32Array( [
    0, y, 0,
    0, -y, 0,
    0, 0, 0,
    x, 0, 0,
    -x, 0, 0,
] );

// itemSize = 3 because there are 3 values (components) per vertex
geometry.setAttribute( 'position', new BufferAttribute( vertices, 3 ) );

var crosshair = new Line( geometry, material );
// place it in the center
var crosshairPercentX = 50;
var crosshairPercentY = 50;
var crosshairPositionX = (crosshairPercentX / 100) * 2 - 1;
var crosshairPositionY = (crosshairPercentY / 100) * 2 - 1;

crosshair.position.x = crosshairPositionX * appData.camera.aspect;
crosshair.position.y = crosshairPositionY;
crosshair.position.z = -0.3;

appData.camera.add( crosshair );



// Set up renderer, canvas, and minor CSS adjustments
appData.renderer.setPixelRatio(window.devicePixelRatio);
const canvas = appData.renderer.domElement;
canvas.style.display = 'block'; // Removes padding below canvas
document.body.style.margin = 0; // Removes margin around page
document.body.style.overflow = 'hidden'; // Fix scrolling
document.body.appendChild(canvas);


// lock camera controls on mouseclick
window.addEventListener( 'click', function () {
    appData.controls.lock();
} );


// window.addEventListener("keydown", (event) => handleKeypress(event, appData), false)
let stats = new Stats();
document.body.appendChild(stats.dom);
// Render loop
const onAnimationFrameHandler = (timeStamp) => {
    // controls.update();
    let renderer = appData.renderer
    let portal1Camera = window.camera.clone()
    let portal2Camera = window.camera.clone()

    // ensure that uniforms and render target are correctly sized
    const { width, height } = appData.renderer.domElement;
    appData.scene.portal1.mesh.material.uniforms.ww.value = width
    appData.scene.portal1.mesh.material.uniforms.wh.value = height
    appData.scene.portal2.mesh.material.uniforms.ww.value = width
    appData.scene.portal2.mesh.material.uniforms.wh.value = height
    appData.portal1Target.setSize(width, height);
    appData.portal2Target.setSize(width, height);
    appData.portal1TargetTmp.setSize(width, height);
    appData.portal2TargetTmp.setSize(width, height);

    // stencil optimization - only render parts of scene multiple
    // times when it is going to be viewed by the portal

    // renderer.clearStencil()
    // renderer.autoClearStencil = false
    // renderer.render(appData.scene.portal1.mesh, window.camera)
    // renderer.render(appData.scene.portal2.mesh, window.camera)

    const levels = 7
    for (let i = 0; i < levels; i++) {
        appData.scene.portal1.teleportObject3D(portal1Camera)
        appData.scene.portal2.teleportObject3D(portal2Camera)
    }

    renderer.localClippingEnabled = true
    for (let level = 0; level < levels - 1; level++) {
        appData.scene.portal2.teleportObject3D(portal1Camera)
        // necessary so that we properly render recursion (otherwise the other portal might block)
        appData.scene.portal1.visible = true
        appData.scene.portal2.visible = false
        renderer.clippingPlanes = [appData.scene.portal2.plane.clone()]
        renderer.setRenderTarget(appData.portal1TargetTmp)
        renderer.render(appData.scene, portal1Camera)

        appData.scene.portal1.teleportObject3D(portal2Camera)
        // necessary so that we properly render recursion (otherwise the other portal might block)
        appData.scene.portal1.visible = false
        appData.scene.portal2.visible = true
        renderer.clippingPlanes = [appData.scene.portal1.plane.clone()]
        renderer.setRenderTarget(appData.portal2TargetTmp)
        renderer.render(appData.scene, portal2Camera)

        // need to do the swap operation:
        // https://stackoverflow.com/questions/54048816/how-to-switch-the-texture-of-render-target-in-three-js
        // cannot render to texture while also using texture, so have to create another temp render target
        let swap = appData.portal1Target
        appData.portal1Target = appData.portal1TargetTmp
        appData.portal1TargetTmp = swap
        appData.scene.portal1.mesh.material.uniforms.texture1.value = appData.portal1Target.texture
        appData.scene.portal1.mesh.material.needsUpdate = true

        swap = appData.portal2Target
        appData.portal2Target = appData.portal2TargetTmp
        appData.portal2TargetTmp = swap
        appData.scene.portal2.mesh.material.uniforms.texture1.value = appData.portal2Target.texture
        appData.scene.portal2.mesh.material.needsUpdate = true
    }

    appData.scene.portal1.visible = true
    appData.scene.portal2.visible = true

    // finally, render to screen
    renderer.setRenderTarget(null)
    renderer.localClippingEnabled = false
    renderer.clippingPlanes = []
    renderer.render(appData.scene, window.camera)

    // appData.renderer.render(appData.scene, appData.camera);
    stats.update();
    appData.scene.update && appData.scene.update(timeStamp);
    window.requestAnimationFrame(onAnimationFrameHandler);
};
window.requestAnimationFrame(onAnimationFrameHandler);

// Resize Handler
const windowResizeHandler = () => {
    const { innerWidth, innerHeight } = window;
    appData.renderer.setSize(innerWidth, innerHeight);
    appData.camera.aspect = innerWidth / innerHeight;
    appData.camera.updateProjectionMatrix();
};
windowResizeHandler();
window.addEventListener('resize', windowResizeHandler, false);