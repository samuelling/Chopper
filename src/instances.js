import * as THREE from 'three';

const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * All the instances of ONE model inside ONE world chunk.
 *
 *   near: detailed geometry (+ outline hull) up to `nearDist`
 *   far : cheap geometry (no outline) up to `farDist`
 *
 * The matrices/colours are one shared buffer for near, outline and far meshes,
 * so editing one instance (felling a tree) is a single buffer write.
 */
export class InstanceBatch {
  /**
   * @param parent  THREE.Group to add the meshes to
   * @param model   { geoNear, geoFar?, matFill, matOutline?, castShadow?, nearDist, farDist }
   * @param items   [{ matrix: Matrix4, color?: Color }]
   */
  constructor(parent, model, items) {
    this.parent = parent;
    this.model = model;
    this.items = items;
    const n = items.length;
    this.count = n;

    const near = new THREE.InstancedMesh(model.geoNear, model.matFill, n);
    for (let i = 0; i < n; i++) {
      near.setMatrixAt(i, items[i].matrix);
      if (items[i].color) near.setColorAt(i, items[i].color);
      items[i].index = i;
      items[i].batch = this;
    }
    near.castShadow = model.castShadow ?? false;
    if (model.matDepth) near.customDepthMaterial = model.matDepth;
    near.receiveShadow = true;
    near.computeBoundingSphere();
    this.near = near;
    parent.add(near);

    this.outline = null;
    if (model.matOutline) {
      const ol = new THREE.InstancedMesh(model.geoNear, model.matOutline, n);
      ol.instanceMatrix = near.instanceMatrix;
      if (near.instanceColor) ol.instanceColor = near.instanceColor;
      ol.count = n;
      ol.computeBoundingSphere();
      this.outline = ol;
      parent.add(ol);
    }
    this.far = null;
    if (model.geoFar) {
      const far = new THREE.InstancedMesh(model.geoFar, model.matFill, n);
      far.instanceMatrix = near.instanceMatrix;
      if (near.instanceColor) far.instanceColor = near.instanceColor;
      far.count = n;
      far.receiveShadow = false;
      far.castShadow = false;
      far.computeBoundingSphere();
      this.far = far;
      parent.add(far);
    }
  }

  setMatrix(item, m) {
    item.matrix.copy(m);
    this.near.setMatrixAt(item.index, m);
    this.near.instanceMatrix.needsUpdate = true;
  }

  remove(item) { this.setMatrix(item, _zero); }

  /** d = distance from the camera to the chunk (already reduced by its radius) */
  setLOD(d) {
    const m = this.model;
    const show = d < m.farDist;
    const useNear = d < m.nearDist || !this.far;
    this.near.visible = show && useNear;
    if (this.outline) this.outline.visible = show && useNear;
    if (this.far) this.far.visible = show && !useNear;
  }

  dispose() {
    for (const m of [this.near, this.outline, this.far]) {
      if (!m) continue;
      this.parent.remove(m);
    }
    // the shared instance buffers belong to this batch alone
    this.near.dispose();
    if (this.outline) this.outline.dispose();
    if (this.far) this.far.dispose();
    this.near.instanceMatrix?.dispose?.();
  }
}
