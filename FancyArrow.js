import * as THREE from 'three';

export class FancyArrow extends THREE.Group {
    /**
     * Creates an instance of CustomArrow.
     * @param {THREE.Vector3} startPoint - The starting position of the arrow.
     * @param {THREE.Vector3} directionAndLength - A vector representing the direction and total length.
     * @param {THREE.Material} [material] - Optional custom material for the arrow.
     */
    constructor(startPoint, directionAndLength, material) {
        super();

        // Use a shared default material if none is provided
        this.material = material || new THREE.MeshStandardMaterial({ color: 0xffff00 });

        this.mesh = this;

        // Define proportions relative to a total default length of 1.0
        const totalLength = 1.0;
        const coneLength = 0.25;
        const cylinderLength = totalLength - coneLength;

        const cylinderRadius = 0.04;
        const coneRadius = 0.1;

        // 1. Create Cylinder (Shaft)
        // Default Three.js cylinders are centered at (0,0,0) extending along the Y-axis
        const cylinderGeo = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderLength, 12);
        // Shift geometry up so its bottom sits exactly at Y = 0
        cylinderGeo.translate(0, cylinderLength / 2, 0);
        this.cylinder = new THREE.Mesh(cylinderGeo, this.material);
        this.add(this.cylinder);

        // 2. Create Cone (Head)
        const coneGeo = new THREE.ConeGeometry(coneRadius, coneLength, 12);
        // Shift geometry up so its bottom sits at the top of the cylinder
        coneGeo.translate(0, cylinderLength + (coneLength / 2), 0);
        this.cone = new THREE.Mesh(coneGeo, this.material);
        this.add(this.cone);

        // Initialize the position, orientation, and scale
        this.set(startPoint, directionAndLength);
    }

    /**
     * Updates the arrow's position, direction, and scale without recreating geometries.
     * @param {THREE.Vector3} startPoint - The new starting position.
     * @param {THREE.Vector3} directionAndLength - The new direction and length vector.
     */
    set(startPoint, directionAndLength) {
        const length = directionAndLength.length();
        this.setPosition(startPoint);
        this.setLength(length);
        this.setDirection(directionAndLength);
    }

    /**
     * Returns a copy of the arrow's position.
     * @returns {THREE.Vector3}
     */
    getPosition() {
        return this.position.clone();
    }

    /**
     * Sets the arrow's position.
     * @param {THREE.Vector3} position
     */
    setPosition(position) {
        this.position.copy(position);
    }

    /**
     * Returns the arrow's unit direction vector.
     * @returns {THREE.Vector3}
     */
    getDirection() {
        return new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion);
    }

    /**
     * Sets the arrow's direction while preserving its length.
     * @param {THREE.Vector3} direction
     */
    setDirection(direction) {
        if (direction.lengthSq() === 0) return;

        this.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.clone().normalize()
        );
    }

    /**
     * Returns the arrow's length.
     * @returns {number}
     */
    getLength() {
        return this.scale.y;
    }

    /**
     * Sets the arrow's length.
     * @param {number} length
     */
    setLength(length) {
        this.scale.setScalar(length);
    }

    /**
     * Sets the arrow's material color.
     * @param {THREE.ColorRepresentation} color
     */
    setColor(color) {
        if (!('color' in this.material) || !(this.material.color instanceof THREE.Color)) {
            throw new TypeError('CustomArrow requires a material with a color property.');
        }

        this.material.color.set(color);
    }
}