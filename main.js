import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { FancyArrow } from './FancyArrow';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
let gui;
let guiMesh;
let cameraControls;
let vrButton;
let dipoleMarker;

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true
});
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
installCanvasContextMenu();


// =====================================================
// Parameters
// =====================================================

let log10wavelength = Math.log10(1.0);
let frequency = 1;
let waveNumber = 2 * Math.PI / Math.pow(10, log10wavelength);
let omega = 2 * Math.PI * frequency;

let fieldTypes = ['Plane wave', 'Hertzian dipole']; // , 'Laguerre-Gaussian'];
let fieldType = 0;

let sourcePosition = new THREE.Vector3(0, 0, 0);

// plane wave
let amplitudeX = 1.0;
let amplitudeY = 0;
let phaseDifference = 0;
let m = 0;

// Hertzian dipole
let relativeDipoleMoment = 1.0;
let showSourcePosition = true;
let fancyArrows = true;

// visualisation
let numberOfVectorsX = 1;
let xMin = -2;
let xMax = 2; 
let numberOfVectorsY = 1;
let yMin = -2;
let yMax = 2; 
let numberOfVectorsZ = 100;
let zMin = -2;
let zMax = 2;
let maxFieldMagnitude = 1;
let colorByFieldStrength = false;
let samplingGrid = 'Cubic';
let sphereRadius = 2;
let cubicVectorCountX = 1;
let cubicVectorCountY = 1;
let sphericalVectorCountLongitude = 24;
let sphericalVectorCountLatitude = 13;
let polarVectorCountRings = 5;
let polarVectorCountAngles = 12;
let polarPlane = 'XY plane';

let origin = new THREE.Vector3(0, 1, 0);    // so that this works in VR mode, where the user is standing on the floor at y=0
let scalefactor = 1.0;

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
    dipoleMarker = new THREE.Group();
    rebuildDipoleMarkerArrows();
    updateDipoleMarkerPosition();
    dipoleMarker.scale.setScalar(scalefactor);
    dipoleMarker.visible = fieldType === 1 && showSourcePosition;
    scene.add(dipoleMarker);
    createArrows();

    gui = new GUI();

    addLogSlider(
        gui,
        { log10wavelength: log10wavelength },
		'log10wavelength',
		-2,
		1,
		(a) => { log10wavelength = a; waveNumber = 2 * Math.PI / Math.pow(10, log10wavelength); }
	).name('wavelength, λ');

    gui.add( { frequency }, 'frequency', 0, 5, 0.01 ).onChange( ( value ) => {
        frequency = value;
        omega = 2 * Math.PI * frequency;
    } ).name('frequency, <i>f</i>');
    
    gui.add( { sourcePositionX: sourcePosition.x }, 'sourcePositionX', -10, 10, 0.01 
    ).onChange( (x) => {
        sourcePosition.x = x;
        updateDipoleMarkerPosition();
    } ).name('Source <i>x</i>');

    gui.add( { sourcePositionY: sourcePosition.y }, 'sourcePositionY', -10, 10, 0.01 
    ).onChange( (y) => {
        sourcePosition.y = y;
        updateDipoleMarkerPosition();
    } ).name('Source <i>y</i>');

    gui.add( { sourcePositionZ: sourcePosition.z }, 'sourcePositionZ', -10, 10, 0.01 
    ).onChange( (z) => {
        sourcePosition.z = z;
        updateDipoleMarkerPosition();
    } ).name('Source <i>z</i>');

	const planeWaveControllers = [];
	const dipoleControllers = [];

    gui.add( { fieldType }, 'fieldType',
                Object.fromEntries( fieldTypes.map((str, i) => [str, i]) )
			)
			.name('Field type')
            .onChange( (f) => {
                fieldType = f;
				updateSourceParameterVisibility(planeWaveControllers, dipoleControllers);
			} );

    // plane wave parameters
	planeWaveControllers.push(gui.add( { amplitudeX }, 'amplitudeX', -1, 1, 0.01 ).onChange( ( value ) => {
        amplitudeX = value;
    } ).name('x amplitude, E<sub>x</sub>'));

	planeWaveControllers.push(gui.add( { amplitudeY }, 'amplitudeY', -1, 1, 0.01 ).onChange( ( value ) => {
        amplitudeY = value;
    } ).name('y amplitude, E<sub>y</sub>'));

	planeWaveControllers.push(gui.add( { phaseDifference: phaseDifference / Math.PI }, 'phaseDifference', -1, 1, 0.01 ).onChange( ( value ) => {
        phaseDifference = value*Math.PI;
    } ).name('phase difference, Δφ/π'));

	planeWaveControllers.push(gui.add( { m }, 'm', -10, 10, 1 ).onChange( ( value ) => {
        m = value;
    } ).name('azimuthal index, <i>m</i>'));

    // Hertzian dipole parameters
	dipoleControllers.push(gui.add( { relativeDipoleMoment }, 'relativeDipoleMoment', -10, 10, 0.01 ).onChange( ( value ) => {
        relativeDipoleMoment = value;
    } ).name('relative dipole moment'));
    dipoleControllers.push(gui.add( { showSourcePosition }, 'showSourcePosition' ).onChange( ( value ) => {
        showSourcePosition = value;
        dipoleMarker.visible = Number(fieldType) === 1 && showSourcePosition;
    } ).name('Show source position'));
    updateSourceParameterVisibility(planeWaveControllers, dipoleControllers);
    const folderVisualisation = gui.addFolder( 'Visualisation' );

    folderVisualisation.add( { fancyArrows }, 'fancyArrows' )
        .onChange( ( value ) => {
            fancyArrows = value;
            rebuildArrows();

            const position = coordinateSystem.position.clone();
            const scale = coordinateSystem.scale.clone();
            scene.remove(coordinateSystem);
            coordinateSystem = createCoordinateSystem(1);
            coordinateSystem.position.copy(position);
            coordinateSystem.scale.copy(scale);
            coordinateSystem.visible = showCoordinateSystem;
            scene.add(coordinateSystem);

            rebuildDipoleMarkerArrows();
        } ).name('Fancy arrows');

    const radiusController = folderVisualisation.add( { sphereRadius }, 'sphereRadius', 0.1, 10, 0.1 )
        .onChange( ( value ) => {
            sphereRadius = value;
            rebuildArrows();
        } ).name('Sphere radius');
    const planeController = folderVisualisation.add( { polarPlane }, 'polarPlane', ['XY plane', 'XZ plane', 'YZ plane'] )
        .onChange( ( value ) => {
            polarPlane = value;
            rebuildArrows();
        } ).name('Polar plane');
    const xCountController = folderVisualisation.add( { numberOfVectorsX }, 'numberOfVectorsX', 1, 100 ).step(1).onChange( ( value ) => {
        numberOfVectorsX = value;
        rebuildArrows();
    } );
    const yCountController = folderVisualisation.add( { numberOfVectorsY }, 'numberOfVectorsY', 1, 100 ).step(1).onChange( ( value ) => {
        numberOfVectorsY = value;
        rebuildArrows();
    } );
    const zCountController = folderVisualisation.add( { numberOfVectorsZ }, 'numberOfVectorsZ', 1, 500 ).step(1).onChange( ( value ) => {
        numberOfVectorsZ = value;
        rebuildArrows();
    } ).name('No. of vectors (z)');
    folderVisualisation.add( { scalefactor }, 'scalefactor', 0.1, 10, 0.01 ).onChange( ( value ) => {
        scalefactor = value;
        dipoleMarker.scale.setScalar(scalefactor);
        rebuildArrows();
        coordinateSystem.scale.set(scalefactor, scalefactor, scalefactor);
        grid.scale.set(scalefactor, scalefactor, scalefactor);
    } ).name('Scale factor');
    addLogSlider(
        folderVisualisation,
        { log10MaxFieldMagnitude: Math.log10(maxFieldMagnitude) },
        'log10MaxFieldMagnitude',
        -2,
        2,
        ( value ) => { maxFieldMagnitude = Math.pow(10, value); }
    ).name('Max field magnitude');
    folderVisualisation.add( { colorByFieldStrength }, 'colorByFieldStrength' )
        .onChange( ( value ) => { colorByFieldStrength = value; } )
        .name('Colour by field strength');
    folderVisualisation.add( { showCoordinateSystem }, 'showCoordinateSystem' ).onChange( ( value ) => {
        showCoordinateSystem = value;
        coordinateSystem.visible = showCoordinateSystem;
    } ).name('Show coordinates');
    folderVisualisation.add( { showGrid }, 'showGrid' ).onChange( ( value ) => {
        showGrid = value;
        grid.visible = showGrid;
    } ).name('Show grid');

    const gridController = folderVisualisation.add( { samplingGrid }, 'samplingGrid', ['Cubic', 'Spherical', 'Polar'] )
        .onChange( ( value ) => {
            if (samplingGrid === 'Spherical') {
                sphericalVectorCountLongitude = numberOfVectorsX;
                sphericalVectorCountLatitude = numberOfVectorsY;
            } else if (samplingGrid === 'Polar') {
                polarVectorCountRings = numberOfVectorsX;
                polarVectorCountAngles = numberOfVectorsY;
            } else {
                cubicVectorCountX = numberOfVectorsX;
                cubicVectorCountY = numberOfVectorsY;
            }
            samplingGrid = value;
            if (samplingGrid === 'Spherical') {
                numberOfVectorsX = sphericalVectorCountLongitude;
                numberOfVectorsY = sphericalVectorCountLatitude;
                xCountController.setValue(sphericalVectorCountLongitude);
                yCountController.setValue(sphericalVectorCountLatitude);
            } else if (samplingGrid === 'Polar') {
                numberOfVectorsX = polarVectorCountRings;
                numberOfVectorsY = polarVectorCountAngles;
                xCountController.setValue(polarVectorCountRings);
                yCountController.setValue(polarVectorCountAngles);
            } else {
                numberOfVectorsX = cubicVectorCountX;
                numberOfVectorsY = cubicVectorCountY;
                xCountController.setValue(cubicVectorCountX);
                yCountController.setValue(cubicVectorCountY);
            }
            updateSamplingControls();
            rebuildArrows();
        } ).name('Sampling grid');
    function updateSamplingControls() {
        const spherical = samplingGrid === 'Spherical';
            const polar = samplingGrid === 'Polar';
            radiusController[spherical || polar ? 'show' : 'hide']();
            radiusController.name(polar ? 'Maximum radius' : 'Sphere radius');
            planeController[polar ? 'show' : 'hide']();
            zCountController[spherical || polar ? 'hide' : 'show']();
            xCountController.name(
                spherical ? 'No. of vectors (&phi;)'
                    : polar ? 'No. of circles'
                        : 'No. of vectors (x)'
            );
            yCountController.name(
                spherical ? 'No. of vectors (&theta;)'
                    : polar ? 'No. of azimuthal angles'
                        : 'No. of vectors (y)'
            );
    }
    updateSamplingControls();

    if ( navigator.xr ) {
        navigator.xr.isSessionSupported( 'immersive-vr' ).then( ( supported ) => {
            vrSupported = supported;
            if ( vrSupported ) {
                document.body.appendChild( vrButton );
                folderVisualisation.add( { showVRButton }, 'showVRButton' ).onChange( ( value ) => {
                    showVRButton = value;
                    vrButton.style.display = showVRButton ? 'block' : 'none';
                } ).name('Show VR button');
                addXRInteractivity();
            }
        } );
    }
}

function rebuildDipoleMarkerArrows() {
    dipoleMarker.clear();
    dipoleMarker.add(
        createArrow(
            new THREE.Vector3(),
            new THREE.Vector3(0, 0, 1),
            0.5,
            0xff0000
        ),
        createArrow(
            new THREE.Vector3(),
            new THREE.Vector3(0, 0, -1),
            0.5,
            0xff0000
        )
    );
    dipoleMarker.traverse((object) => {
        object.renderOrder = 10;
        if (object.material) {
            object.material.depthTest = false;
            object.material.depthWrite = false;
        }
    });
}

function installCanvasContextMenu() {
    const style = document.createElement('style');
    style.textContent = `
        #canvas-context-menu {
            position: fixed;
            z-index: 10000;
            display: none;
            min-width: 180px;
            padding: 5px;
            border: 1px solid #555;
            border-radius: 6px;
            background: #222;
            color: #fff;
            box-shadow: 0 4px 12px #0008;
            font: 14px sans-serif;
        }
        #canvas-context-menu button {
            display: block;
            width: 100%;
            padding: 8px 10px;
            border: 0;
            border-radius: 3px;
            background: transparent;
            color: inherit;
            text-align: left;
            font: inherit;
            cursor: pointer;
        }
        #canvas-context-menu button:hover,
        #canvas-context-menu button:focus-visible {
            outline: none;
            background: #444;
        }
        #canvas-context-menu-status {
            display: none;
            padding: 6px 10px;
            color: #ffb4ab;
            font-size: 12px;
        }
    `;
    document.head.appendChild(style);

    const menu = document.createElement('div');
    menu.id = 'canvas-context-menu';
    menu.setAttribute('role', 'menu');

    const saveButton = createMenuButton('Save image as PNG…');
    const copyButton = createMenuButton('Copy image');
    const status = document.createElement('div');
    status.id = 'canvas-context-menu-status';
    status.setAttribute('role', 'status');
    menu.append(saveButton, copyButton, status);
    document.body.appendChild(menu);

    renderer.domElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        status.style.display = 'none';
        menu.style.display = 'block';
        menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8))}px`;
        menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8))}px`;
        saveButton.focus();
    });

    document.addEventListener('pointerdown', (event) => {
        if (!menu.contains(event.target)) menu.style.display = 'none';
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') menu.style.display = 'none';
    });
    window.addEventListener('resize', () => {
        menu.style.display = 'none';
    });

    saveButton.addEventListener('click', () => {
        exportCanvasImage().then(() => {
            menu.style.display = 'none';
        }).catch((error) => {
            showMenuError('Could not save the image.');
            console.error('Could not save the canvas image:', error);
        });
    });
    copyButton.addEventListener('click', () => {
        copyCanvasImage().then(() => {
            menu.style.display = 'none';
        }).catch((error) => {
            showMenuError('Could not copy the image.');
            console.error('Could not copy the canvas image:', error);
        });
    });

    function showMenuError(message) {
        status.textContent = message;
        status.style.display = 'block';
    }
}

function createMenuButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('role', 'menuitem');
    return button;
}

function getCanvasImageBlob() {
    return new Promise((resolve, reject) => {
        renderer.domElement.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas image encoding returned no data.'));
        }, 'image/png');
    });
}

async function exportCanvasImage() {
    const blob = await getCanvasImageBlob();
    const imageUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'vector-vibes.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
}

async function copyCanvasImage() {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Image clipboard access is not supported by this browser.');
    }

    const blob = await getCanvasImageBlob();
    await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
    ]);
}

function updateSourceParameterVisibility(planeWaveControllers, dipoleControllers) {
    planeWaveControllers.forEach((controller) => {
        if (Number(fieldType) === 0) controller.show();
        else controller.hide();
    });
    dipoleControllers.forEach((controller) => {
        if (Number(fieldType) === 1) controller.show();
        else controller.hide();
    });
    dipoleMarker.visible = Number(fieldType) === 1 && showSourcePosition;
}

function updateDipoleMarkerPosition() {
    dipoleMarker.position.copy(origin).add(sourcePosition);
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

    if (samplingGrid === 'Polar') {
        for (let ringIndex = 0; ringIndex < numberOfVectorsX; ringIndex++) {
            const radius = sphereRadius * (ringIndex + 1) / numberOfVectorsX;
            for (let angleIndex = 0; angleIndex < numberOfVectorsY; angleIndex++) {
                const angle = 2 * Math.PI * angleIndex / numberOfVectorsY;
                const first = radius * Math.cos(angle);
                const second = radius * Math.sin(angle);
                const x = polarPlane === 'YZ plane' ? 0 : first;
                const y = polarPlane === 'XY plane' ? second : polarPlane === 'YZ plane' ? first : 0;
                const z = polarPlane === 'XZ plane' ? second : polarPlane === 'YZ plane' ? second : 0;
                addArrowAt(x, y, z);
            }
        }
        return;
    }

    if (samplingGrid === 'Spherical') {
        const latitudeCount = numberOfVectorsY;
        for (let latitudeIndex = 0; latitudeIndex < latitudeCount; latitudeIndex++) {
            const theta = latitudeCount === 1
                ? Math.PI / 2
                : Math.PI * latitudeIndex / (latitudeCount - 1);
            const isPole = latitudeIndex === 0 || latitudeIndex === latitudeCount - 1;
            const longitudeCount = isPole ? 1 : numberOfVectorsX;

            for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex++) {
                const phi = 2 * Math.PI * longitudeIndex / numberOfVectorsX;
                const x = sphereRadius * Math.sin(theta) * Math.cos(phi);
                const y = sphereRadius * Math.sin(theta) * Math.sin(phi);
                const z = sphereRadius * Math.cos(theta);
                addArrowAt(x, y, z);
            }
        }
        return;
    }

    for (let i = 0; i < numberOfVectorsZ; i++) 
    for (let j = 0; j < numberOfVectorsX; j++) 
    for (let k = 0; k < numberOfVectorsY; k++)
    {
            const x = scalefactor * getX(j);
            const y = scalefactor * getY(k);
            const z = scalefactor * getZ(i);

            addArrowAt(x / scalefactor, y / scalefactor, z / scalefactor);
    }
}

function addArrowAt(x, y, z) {
    const startPoint = new THREE.Vector3(
        scalefactor * x,
        scalefactor * y,
        scalefactor * z
    ).add(origin);
    const arrow = createArrow(
        startPoint,
        new THREE.Vector3(1, 0, 0),
        scalefactor,
        0x00aaff,
        0.1,
        0.1
    );
    scene.add(arrow);
    arrows.push(arrow);
}

function createArrow(startPoint, direction, length, color, headLength, headWidth) {
    if (fancyArrows) {
        const directionAndLength = direction.clone().normalize().multiplyScalar(length);
        const arrow = new FancyArrow(startPoint, directionAndLength);
        arrow.setColor(color);
        return arrow;
    }

    return new THREE.ArrowHelper(
        direction,
        startPoint,
        length,
        color,
        headLength,
        headWidth
    );
}

function rebuildArrows() {
    arrows.forEach( arrow => scene.remove( arrow ) );
    arrows.length = 0;
    createArrows();
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
    sprite.scale.set(scalefactor * 0.8, scalefactor * 0.8, scalefactor * 0.8);

    return sprite;
}

function createCoordinateSystem(length = 2) {

    const axes = new THREE.Group();

    // X axis (red)

    axes.add(createArrow(
        new THREE.Vector3(),
        new THREE.Vector3(scalefactor, 0, 0),
        length,
        0xffffff,
        0.2 * length,
        0.1 * length
    ));

    // Y axis (green)

    axes.add(createArrow(
        new THREE.Vector3(),
        new THREE.Vector3(0, scalefactor, 0),
        length,
        0xffffff,
        0.2 * length,
        0.1 * length
    ));

    // Z axis (blue)

    axes.add(createArrow(
        new THREE.Vector3(),
        new THREE.Vector3(0, 0, scalefactor),
        length,
        0xffffff,
        0.2 * length,
        0.1 * length
    ));

    // Labels

    axes.add(
        createAxisLabel(
            'x',
            new THREE.Vector3(scalefactor * (length + 0.5), 0, 0),
            '#ffffff'
        )
    );

    axes.add(
        createAxisLabel(
            'y',
            new THREE.Vector3(0, scalefactor * (length + 0.5), 0),
            '#ffffff'
        )
    );

    axes.add(
        createAxisLabel(
            'z',
            new THREE.Vector3(0, 0, scalefactor * (length + 0.5)),
            '#ffffff'
        )
    );

    return axes;
}

camera.position.set( -3*scalefactor + origin.x, 3*scalefactor + origin.y, -3*scalefactor + origin.z );
camera.lookAt( origin.x, origin.y, origin.z );

const heatPalette = [
    new THREE.Color(0x5b0a00),
    new THREE.Color(0xe23b00),
    new THREE.Color(0xff9b00),
    new THREE.Color(0xffee55),
    new THREE.Color(0xffffff)
];
const fieldColor = new THREE.Color();

function getHeatColor(normalizedStrength) {
    const palettePosition = THREE.MathUtils.clamp(normalizedStrength, 0, 1) * (heatPalette.length - 1);
    const lowerIndex = Math.floor(palettePosition);
    const upperIndex = Math.min(lowerIndex + 1, heatPalette.length - 1);
    return fieldColor.copy(heatPalette[lowerIndex]).lerp(
        heatPalette[upperIndex],
        palettePosition - lowerIndex
    );
}

let omegaT = 0;
let tLast = 0;

function animate(timeMS) {

    const t = timeMS * 0.001;
    omegaT += omega * (t - tLast);
    tLast = t;

    arrows.forEach((arrow, index) => {
        // console.log(`Animating arrow ${index}`);
        const x = (arrow.position.x - origin.x - sourcePosition.x) / scalefactor; // getX(index);
        const y = (arrow.position.y - origin.y - sourcePosition.y) / scalefactor; // getY(index);
        const z = (arrow.position.z - origin.z - sourcePosition.z) / scalefactor; // getZ(index);

        let field;

        if (fieldType === 0) {
            // (twisted) plane wave
            const phi = Math.atan2(y, x);

            const phase = waveNumber * z - omegaT + m * phi;

            const Ex = amplitudeX * Math.cos(phase);
            const Ey = amplitudeY * Math.cos( phase + phaseDifference );

            field =
                new THREE.Vector3(
                    Ex,
                    Ey,
                    0
                );
        } else if (fieldType === 1) {
            // Hertzian dipole
            const r = Math.sqrt(x*x + y*y + z*z);
            const theta = Math.acos(z/r);
            const phi = Math.atan2(y, x);

            const phase = waveNumber * r - omegaT;
            const cosPhase = Math.cos(phase);

            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            // A = p_0 / (4 pi epsilon_0)
            // E_r = 2 A cos(theta) Re(exp(i (k r - omega t)) (1/r^3 - i k / r^2))
            //     = 2 A cos(theta) ((1/r^3) cos(k r - omega t) + k / r^2 sin(k r - omega t))
            const Er = 2 * relativeDipoleMoment / waveNumber / waveNumber * cosTheta * ((1/(r*r*r)) * cosPhase + waveNumber/(r*r) * Math.sin(phase));

            // E_theta = A sin(theta) Re(exp(i (k r - omega t)) (1/r^3 - i k / r^2 - k^2 / r))
            //         = A sin(theta) ((1/r^3 - k^2/r) cos(k r - omega t) + k / r^2 sin(k r - omega t))
            const Etheta = relativeDipoleMoment / waveNumber / waveNumber * sinTheta * ((1/(r*r*r) - waveNumber*waveNumber/r) * cosPhase + waveNumber/(r*r) * Math.sin(phase));
            const Ephi = 0;

            // console.log(`Er: ${Er}, Etheta: ${Etheta}, Ephi: ${Ephi}`);

            field =
                new THREE.Vector3(
                    Er * sinTheta * cosPhi + Etheta * cosTheta * cosPhi - Ephi * sinPhi,
                    Er * sinTheta * sinPhi + Etheta * cosTheta * sinPhi + Ephi * cosPhi,
                    Er * cosTheta - Etheta * sinTheta
                );
        };

        const fieldMagnitude = field.length();
        const isClipped = fieldMagnitude > maxFieldMagnitude;
        const magnitude = scalefactor * Math.max(
            Math.min(fieldMagnitude, maxFieldMagnitude),
            0.001
        );

        field.normalize();

        arrow.setDirection(field);
        if (colorByFieldStrength) {
            arrow.setColor(getHeatColor(fieldMagnitude / maxFieldMagnitude));
            arrow.userData.colorByFieldStrength = true;
        } else if (
            arrow.userData.isClipped !== isClipped
            || arrow.userData.colorByFieldStrength
        ) {
            arrow.setColor(isClipped ? 0xffffff : 0x00aaff);
            arrow.userData.isClipped = isClipped;
            arrow.userData.colorByFieldStrength = false;
        }
        arrow.setLength(
            magnitude,
            0.1*magnitude,
            0.1*magnitude
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