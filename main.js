import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// CONTROLS
const cameraControls = new OrbitControls( camera, renderer.domElement );
// cameraControls.addEventListener( 'change', animate );

// =====================================================
// Parameters
// =====================================================

let amplitudeX = 1.0;
let amplitudeY = 0;

let wavelength = 5.0;
let frequency = 1;

let phaseDifference = 0;

let waveNumber = 2 * Math.PI / wavelength;
let omega = 2 * Math.PI * frequency;

let numberOfVectors = 100;
let zMin = -10;
let zMax = 10;

const arrows = [];

init();
renderer.setAnimationLoop( animate );

function init() {
    const gui = new GUI();

    gui.add( { amplitudeX }, 'amplitudeX', -2, 2, 0.01 ).onChange( ( value ) => {
        amplitudeX = value;
    } ).name('x amplitude, E<sub>x</sub>');

    gui.add( { amplitudeY }, 'amplitudeY', -2, 2, 0.01 ).onChange( ( value ) => {
        amplitudeY = value;
    } ).name('y amplitude, E<sub>y</sub>');

    gui.add( { wavelength }, 'wavelength', 1, 10, 0.01 ).onChange( ( value ) => {
        wavelength = value;
        waveNumber = 2 * Math.PI / wavelength;
    } ).name('wavelength, λ');

    gui.add( { frequency }, 'frequency', 0, 10, 0.01 ).onChange( ( value ) => {
        frequency = value;
        omega = 2 * Math.PI * frequency;
    } ).name('frequency, <i>f</i>');

    gui.add( { phaseDifference }, 'phaseDifference', -Math.PI, Math.PI ).onChange( ( value ) => {
        phaseDifference = value;
    } ).name('phase difference, Δφ');

    gui.add( { numberOfVectors }, 'numberOfVectors', 1, 500 ).step(1).onChange( ( value ) => {
        numberOfVectors = value;
        arrows.forEach( arrow => scene.remove( arrow ) );
        arrows.length = 0;
        createArrows();
    } ).name('Number of vectors');

    scene.add(new THREE.GridHelper(20, 20));
    
    createArrows();
}


function createArrows() {

    for (let i = 0; i < numberOfVectors; i++) {
        const z = getZ(i);

        const origin = new THREE.Vector3(0, 0, z);

        const arrow = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            origin,
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

camera.position.x = -5;
camera.position.y = 5;
camera.position.z = -5;
camera.lookAt(0, 0, 0);

let omegaT = 0;
let tLast = 0;

function animate(timeMS) {

    const t = timeMS * 0.001;
    omegaT += omega * (t - tLast);
    tLast = t;

    arrows.forEach((arrow, index) => {

        const z = getZ(index);

        const phase =
            waveNumber * z -
            omegaT;

        const Ex =
            amplitudeX *
            Math.cos(phase);

        const Ey =
            amplitudeY *
            Math.cos(
                phase +
                phaseDifference
            );

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

function getZ(index) {
    return (
        numberOfVectors === 1
            ? zMin
            : zMin +
              (zMax - zMin) *
              index /
              (numberOfVectors - 1)
    );
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});