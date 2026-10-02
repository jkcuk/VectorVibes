import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
let gui;
let guiMesh;
let cameraControls;
let vrButton;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.xr.enabled = true;
renderer.xr.addEventListener('sessionstart', () => {
    cameraControls.enabled = false;
    if (guiMesh) { guiMesh.visible = true; }
});
renderer.xr.addEventListener('sessionend', () => {
    cameraControls.enabled = true;
    if (guiMesh) { guiMesh.visible = false; }
});
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );


// =====================================================
// Parameters
// =====================================================

let amplitudeX = 1.0;
let amplitudeY = 0;

let log10wavelength = Math.log10(1.0);
let frequency = 1;

let phaseDifference = 0;

let waveNumber = 2 * Math.PI / Math.pow(10, log10wavelength);
let omega = 2 * Math.PI * frequency;
let m = 0;

let numberOfVectorsX = 1;
let xMin = -2;
let xMax = 2; 
let numberOfVectorsY = 1;
let yMin = -2;
let yMax = 2; 
let numberOfVectorsZ = 100;
let zMin = -2;
let zMax = 2;

let origin = new THREE.Vector3(0, 0, 0);

let coordinateSystem = createCoordinateSystem(1);
coordinateSystem.position.set( origin.x, origin.y, origin.z );
let grid = new THREE.GridHelper(4, 4);
grid.position.set( origin .x, origin.y, origin.z );
let showCoordinateSystem = true;
let showGrid = true;

let showVRButton = true;

const arrows = [];

init();
renderer.setAnimationLoop( animate );

function init() {
    // CONTROLS
    cameraControls = new OrbitControls( camera, renderer.domElement );
    cameraControls.target.set( origin.x, origin.y, origin.z );
    // cameraControls.addEventListener( 'change', animate );

    vrButton = VRButton.createButton( renderer );
    let vrSupported = false;

    // add lights
    const ambient = new THREE.AmbientLight( 0xffffff, 2 );
    scene.add(ambient);
    const directional = new THREE.DirectionalLight( 0xffffff, 2 );
    directional.position.set(2,4,3);
    scene.add(directional);

    scene.add(grid);
    scene.add(coordinateSystem);    
    createArrows();

    gui = new GUI();

    gui.add( { amplitudeX }, 'amplitudeX', -2, 2, 0.01 ).onChange( ( value ) => {
        amplitudeX = value;
    } ).name('x amplitude, E<sub>x</sub>');

    gui.add( { amplitudeY }, 'amplitudeY', -2, 2, 0.01 ).onChange( ( value ) => {
        amplitudeY = value;
    } ).name('y amplitude, E<sub>y</sub>');

    addLogSlider(
        gui,
        { log10wavelength: log10wavelength },
		'log10wavelength',
		-1,
		2,
		(a) => { log10wavelength = a; waveNumber = 2 * Math.PI / Math.pow(10, log10wavelength); }
	).name('wavelength, λ');

    gui.add( { frequency }, 'frequency', 0, 10, 0.01 ).onChange( ( value ) => {
        frequency = value;
        omega = 2 * Math.PI * frequency;
    } ).name('frequency, <i>f</i>');

    gui.add( { phaseDifference: phaseDifference / Math.PI }, 'phaseDifference', -1, 1, 0.01 ).onChange( ( value ) => {
        phaseDifference = value*Math.PI;
    } ).name('phase difference, Δφ/π');

    gui.add( { m }, 'm', -10, 10, 1 ).onChange( ( value ) => {
        m = value;
    } ).name('azimuthal index, <i>m</i>');

    gui.add( { numberOfVectorsX }, 'numberOfVectorsX', 1, 100 ).step(1).onChange( ( value ) => {
        numberOfVectorsX = value;
        arrows.forEach( arrow => scene.remove( arrow ) );
        arrows.length = 0;
        createArrows();
    } ).name('No. of vectors (x)');
    gui.add( { numberOfVectorsY }, 'numberOfVectorsY', 1, 100 ).step(1).onChange( ( value ) => {
        numberOfVectorsY = value;
        arrows.forEach( arrow => scene.remove( arrow ) );
        arrows.length = 0;
        createArrows();
    } ).name('No. of vectors (y)');
    gui.add( { numberOfVectorsZ }, 'numberOfVectorsZ', 1, 500 ).step(1).onChange( ( value ) => {
        numberOfVectorsZ = value;
        arrows.forEach( arrow => scene.remove( arrow ) );
        arrows.length = 0;
        createArrows();
    } ).name('No. of vectors (z)');
    gui.add( { showCoordinateSystem }, 'showCoordinateSystem' ).onChange( ( value ) => {
        showCoordinateSystem = value;
        coordinateSystem.visible = showCoordinateSystem;
    } ).name('Show coordinates');
    gui.add( { showGrid }, 'showGrid' ).onChange( ( value ) => {
        showGrid = value;
        grid.visible = showGrid;
    } ).name('Show grid');

    if ( navigator.xr ) {
        navigator.xr.isSessionSupported( 'immersive-vr' ).then( ( supported ) => {
            vrSupported = supported;
            if ( vrSupported ) {
                document.body.appendChild( vrButton );
                gui.add( { showVRButton }, 'showVRButton' ).onChange( ( value ) => {
                    showVRButton = value;
                    vrButton.style.display = showVRButton ? 'block' : 'none';
                } ).name('Show VR button');
                addXRInteractivity();
            }
        } );
    }
}

function addLogSlider(gui, params, property, minNumber, maxNumber, onChange) {
	const controller = gui.add(
		params,
		property,
		minNumber,
		maxNumber,
		0.001
	).onChange(onChange);
	const numberInput = controller.domElement.querySelector('input[type="number"]');
	const originalUpdateDisplay = controller.updateDisplay.bind(controller);

	function updateDisplay() {
		originalUpdateDisplay();
		if (numberInput) numberInput.value = Math.pow(10, params[property]).toFixed(2);// String(Math.tan(GUIParams[property]));
	}

	controller.updateDisplay = updateDisplay;

	if (numberInput) {
		numberInput.removeAttribute('min');
		numberInput.removeAttribute('max');
		numberInput.addEventListener('input', (event) => {
			event.stopImmediatePropagation();
			const x = Number(numberInput.value);
			if (Number.isFinite(x)) controller.setValue(Math.log10(x));
		}, true);
		numberInput.addEventListener('change', (event) => {
			event.stopImmediatePropagation();
			const x = Number(numberInput.value);
			if (Number.isFinite(x)) controller.setValue(Math.log10(x));
		}, true);
	}

	controller.updateDisplay();
	return controller;
}

function createArrows() {

    for (let i = 0; i < numberOfVectorsZ; i++) 
    for (let j = 0; j < numberOfVectorsX; j++) 
    for (let k = 0; k < numberOfVectorsY; k++)
    {
            const x = getX(j);
            const y = getY(k);
            const z = getZ(i);

            const startPoint = new THREE.Vector3(x, y, z).add(origin);

            const arrow = new THREE.ArrowHelper(
                new THREE.Vector3(1, 0, 0),
                startPoint,
                1,
                0x00aaff,
                0.3,
                0.2
            );
            
            scene.add(arrow);
            arrows.push(arrow);
    }
}

function createArrow(
    start,
    end,
    {
        shaftRadius = 0.05,
        headRadius = 0.15,
        headLengthFraction = 0.2,
        color = 0x00aaff
    } = {}
) {

    const group = new THREE.Group();

    const direction = new THREE.Vector3()
        .subVectors(end, start);

    const totalLength = direction.length();

    if (totalLength < 1e-9) {
        return group;
    }

    const headLength =
        totalLength * headLengthFraction;

    const shaftLength =
        totalLength - headLength;

    const material = new THREE.MeshPhongMaterial({
        color
    });

    // Shaft

    const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(
            shaftRadius,
            shaftRadius,
            shaftLength,
            16
        ),
        material
    );

    shaft.position.y = shaftLength / 2;

    group.add(shaft);

    // Head

    const head = new THREE.Mesh(
        new THREE.ConeGeometry(
            headRadius,
            headLength,
            16
        ),
        material
    );

    head.position.y =
        shaftLength + headLength / 2;

    group.add(head);

    // Place at start point

    group.position.copy(start);

    // Rotate from +Y into required direction

    direction.normalize();

    group.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction
    );

    return group;
}

function createAxisLabel(text, position, color) {

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;

    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.font = '180px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
    });

    const sprite = new THREE.Sprite(material);

    sprite.position.copy(position);
    sprite.scale.set(0.8, 0.8, 0.8);

    return sprite;
}

function createCoordinateSystem(length = 2) {

    const axes = new THREE.Group();

    // X axis (red)

    axes.add(
        new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 0, 0),
            length,
            0xffffff,
            0.2 * length,
            0.1 * length
        )
    );

    // Y axis (green)

    axes.add(
        new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 0),
            length,
            0xffffff,
            0.2 * length,
            0.1 * length
        )
    );

    // Z axis (blue)

    axes.add(
        new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, 0),
            length,
            0xffffff,
            0.2 * length,
            0.1 * length
        )
    );

    // Labels

    axes.add(
        createAxisLabel(
            'x',
            new THREE.Vector3(length + 0.5, 0, 0),
            '#ffffff'
        )
    );

    axes.add(
        createAxisLabel(
            'y',
            new THREE.Vector3(0, length + 0.5, 0),
            '#ffffff'
        )
    );

    axes.add(
        createAxisLabel(
            'z',
            new THREE.Vector3(0, 0, length + 0.5),
            '#ffffff'
        )
    );

    return axes;
}

camera.position.set( -3 + origin.x, 3 + origin.y, -3 + origin.z );
camera.lookAt( origin.x, origin.y, origin.z );

let omegaT = 0;
let tLast = 0;

function animate(timeMS) {

    const t = timeMS * 0.001;
    omegaT += omega * (t - tLast);
    tLast = t;

    arrows.forEach((arrow, index) => {
        // console.log(`Animating arrow ${index}`);
        const z = arrow.position.z; // getZ(index);
        const phi = Math.atan2(arrow.position.y, arrow.position.x);

        const phase = waveNumber * z - omegaT + m * phi;

        const Ex = amplitudeX * Math.cos(phase);
        const Ey = amplitudeY * Math.cos( phase + phaseDifference );

        const field =
            new THREE.Vector3(
                Ex,
                Ey,
                0
            );

        const magnitude =
            Math.max(field.length(), 0.001);

        field.normalize();

        arrow.setDirection(field);
        arrow.setLength(
            magnitude,
            0.3*magnitude,
            0.2*magnitude
        );
    });

    renderer.render(scene, camera);
}

function getX(index) {
    return (
        numberOfVectorsX === 1
        ? 0
        : xMin + (xMax - xMin) * index / (numberOfVectorsX - 1)
    );
}

function getY(index) {
    return (
        numberOfVectorsY === 1
        ? 0
        : yMin + (yMax - yMin) * index / (numberOfVectorsY - 1)
    );
}

function getZ(index) {
    return (
        numberOfVectorsZ === 1
        ? 0
        : zMin + (zMax - zMin) * index / (numberOfVectorsZ - 1)
    );
}

function addXRInteractivity() {
	// see https://github.com/mrdoob/three.js/blob/master/examples/webxr_vr_sandbox.html

	// the two hand controllers

	const geometry = new THREE.BufferGeometry();
	geometry.setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 5 ) ] );

    const ray = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
            color: 0xffffff
        })
    );

	const controller1 = renderer.xr.getController( 0 );
	controller1.add(ray.clone());
	scene.add( controller1 );

	const controller2 = renderer.xr.getController( 1 );
    controller2.add(ray.clone());
	scene.add( controller2 );

	//

	const controllerModelFactory = new XRControllerModelFactory();

	const controllerGrip1 = renderer.xr.getControllerGrip( 0 );
	controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
	scene.add( controllerGrip1 );

	const controllerGrip2 = renderer.xr.getControllerGrip( 1 );
	controllerGrip2.add( controllerModelFactory.createControllerModel( controllerGrip2 ) );
	scene.add( controllerGrip2 );

	//

	const group = new InteractiveGroup( renderer, camera );
	group.listenToPointerEvents( renderer, camera );
	group.listenToXRControllerEvents( controller1 );
	group.listenToXRControllerEvents( controller2 );
	scene.add( group );

	guiMesh = new HTMLMesh( gui.domElement );
	guiMesh.position.set( - 0.75, 1.5, - 0.5 );
	guiMesh.rotation.y = Math.PI / 4;
	guiMesh.scale.setScalar( 2 );
    guiMesh.visible = false;
	group.add( guiMesh );	
}


window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});