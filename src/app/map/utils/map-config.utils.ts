import {
  BasemapConfig,
  BasemapLayerType,
  GraphicItemConfig,
  LayerConfig,
  LeafLayerConfig,
  LeafLayerType,
  MapConfig,
  PrimitiveValue,
  ResourceAuthConfig,
  ResourceSourceConfig
} from '../models/layer-config.model';
import { isPlainObject } from './map-object.utils';

type OrderedItem = {
  order?: number;
};

export function sortByOrder<T extends OrderedItem>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => compareOrder(left.item.order, right.item.order) || left.index - right.index)
    .map(({ item }) => item);
}

export function validateMapConfig(config: MapConfig): void {
  assertPlainObject(config, 'Map config must be an object.');
  assertArray(config.operationalLayers, 'operationalLayers');

  if (config.fallbackBasemap !== undefined) {
    assertNonEmptyString(config.fallbackBasemap, 'fallbackBasemap');
  }

  const seenIds = new Set<string>();

  validateBasemapConfig(config.basemap, seenIds);

  for (const layer of config.operationalLayers) {
    validateLayerConfig(layer, seenIds, 'operationalLayers');
  }
}

function validateBasemapConfig(config: BasemapConfig, seenIds: Set<string>): void {
  assertPlainObject(config, 'Map config basemap must be an object.');

  const basemapId = readRequiredString(config, 'id', 'basemap.id');
  const basemapMode = readUnknown(config, 'mode');

  if (seenIds.has(basemapId)) {
    throw new Error(`Duplicate config id "${basemapId}" found in basemap configuration.`);
  }

  seenIds.add(basemapId);

  if (basemapMode === 'well-known') {
    return;
  }

  if (basemapMode === 'portal-item') {
    const portalItemConfig = config as Extract<BasemapConfig, { mode: 'portal-item' }>;

    validateSharedSource(portalItemConfig.source, `basemap("${basemapId}").source`);
    validateAuth(portalItemConfig.auth, `basemap("${basemapId}").auth`);
    return;
  }

  if (basemapMode === 'custom') {
    const customBasemap = config as Extract<BasemapConfig, { mode: 'custom' }>;

    assertNonEmptyString(customBasemap.title, `basemap("${basemapId}").title`);
    assertArray(customBasemap.baseLayers, `basemap("${basemapId}").baseLayers`);

    if (customBasemap.baseLayers.length === 0) {
      throw new Error(`Custom basemap "${basemapId}" must define at least one base layer.`);
    }

    for (const layer of customBasemap.baseLayers) {
      validateBasemapLayerConfig(layer, seenIds, `basemap("${basemapId}").baseLayers`);
    }

    if (customBasemap.referenceLayers !== undefined) {
      assertArray(customBasemap.referenceLayers, `basemap("${basemapId}").referenceLayers`);
    }

    for (const layer of customBasemap.referenceLayers ?? []) {
      validateBasemapLayerConfig(layer, seenIds, `basemap("${basemapId}").referenceLayers`);
    }

    return;
  }

  throw new Error(`Unsupported basemap mode "${String(basemapMode)}".`);
}

function validateBasemapLayerConfig(config: unknown, seenIds: Set<string>, path: string): void {
  assertPlainObject(config, `Expected an object at ${path}.`);

  const layerId = readRequiredString(config, 'id', `${path}.id`);
  const layerType = readUnknown(config, 'type');
  const source = readOptionalProperty<ResourceSourceConfig>(config, 'source');
  const auth = readOptionalProperty<ResourceAuthConfig>(config, 'auth');
  const url = readOptionalProperty<string>(config, 'url');

  if (!isBasemapLayerType(layerType)) {
    throw new Error(`Basemap layer "${layerId}" has unsupported type "${String(layerType)}".`);
  }

  if (seenIds.has(layerId)) {
    throw new Error(`Duplicate config id "${layerId}" found in ${path}.`);
  }

  seenIds.add(layerId);
  validateSharedSource(source, `${path}("${layerId}").source`);
  validateAuth(auth, `${path}("${layerId}").auth`);

  if (!url && source?.mode !== 'resolved') {
    throw new Error(`Basemap layer "${layerId}" requires a url or a resolved source.`);
  }
}

function validateLayerConfig(config: LayerConfig, seenIds: Set<string>, path: string): void {
  assertPlainObject(config, `Expected an object at ${path}.`);

  const layerId = readRequiredString(config, 'id', `${path}.id`);
  readRequiredString(config, 'title', `${path}("${layerId}").title`);
  const layerType = readUnknown(config, 'type');
  const source = readOptionalProperty<ResourceSourceConfig>(config, 'source');
  const auth = readOptionalProperty<ResourceAuthConfig>(config, 'auth');

  if (seenIds.has(layerId)) {
    throw new Error(`Duplicate config id "${layerId}" found in ${path}.`);
  }

  seenIds.add(layerId);
  validateSharedSource(source, `${path}("${layerId}").source`);
  validateAuth(auth, `${path}("${layerId}").auth`);

  if (layerType === 'group') {
    const groupConfig = config as Extract<LayerConfig, { type: 'group' }>;

    assertArray(groupConfig.layers, `group("${layerId}").layers`);

    for (const child of groupConfig.layers) {
      validateLayerConfig(child, seenIds, `group("${layerId}").layers`);
    }

    return;
  }

  if (!isLeafLayerType(layerType)) {
    throw new Error(`Layer "${layerId}" has unsupported type "${String(layerType)}".`);
  }

  const leafLayer = config as LeafLayerConfig;

  if (layerType !== 'graphics' && !leafLayer.url && source?.mode !== 'resolved') {
    throw new Error(`Layer "${layerId}" requires a url or a resolved source.`);
  }

  if (layerType === 'graphics') {
    validateGraphicLayer(leafLayer as Extract<LeafLayerConfig, { type: 'graphics' }>, layerId);
  }
}

function validateGraphicLayer(config: Extract<LeafLayerConfig, { type: 'graphics' }>, layerId: string): void {
  if (config.graphics !== undefined) {
    assertArray(config.graphics, `graphic layer "${layerId}".graphics`);
  }

  for (const graphic of config.graphics ?? []) {
    validateGraphic(graphic, layerId);
  }
}

function validateGraphic(graphic: GraphicItemConfig, layerId: string): void {
  assertPlainObject(graphic, `Expected an object in graphic layer "${layerId}".`);

  const geometry = readOptionalProperty<unknown>(graphic, 'geometry');

  if (!isPlainObject(geometry) || readUnknown(geometry, 'type') !== 'point') {
    throw new Error(`Graphic layer "${layerId}" only supports point geometries in this implementation.`);
  }

  if (typeof readUnknown(geometry, 'longitude') !== 'number' || typeof readUnknown(geometry, 'latitude') !== 'number') {
    throw new Error(`Graphic layer "${layerId}" requires numeric longitude and latitude values.`);
  }
}

function validateSharedSource(source: ResourceSourceConfig | undefined, path: string): void {
  if (!source) {
    return;
  }

  assertPlainObject(source, `Expected an object at ${path}.`);

  const sourceMode = readUnknown(source, 'mode');

  if (sourceMode === undefined || sourceMode === 'direct') {
    return;
  }

  if (sourceMode !== 'resolved') {
    throw new Error(`${path}.mode must be either "direct" or "resolved".`);
  }

  assertNonEmptyString(readUnknown(source, 'resolverKey'), `${path}.resolverKey`);
  assertNonEmptyString(readUnknown(source, 'endpoint'), `${path}.endpoint`);
}

function validateAuth(auth: ResourceAuthConfig | undefined, path: string): void {
  if (!auth) {
    return;
  }

  assertPlainObject(auth, `Expected an object at ${path}.`);

  const authMode = readUnknown(auth, 'mode');

  if (authMode === 'none') {
    return;
  }

  if (authMode !== 'token' && authMode !== 'identity-manager') {
    throw new Error(`${path}.mode must be one of "none", "token", or "identity-manager".`);
  }

  if (authMode === 'token' && !readUnknown(auth, 'token') && !readUnknown(auth, 'tokenEndpoint')) {
    throw new Error(`${path} requires either a static token or a tokenEndpoint.`);
  }
}

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Expected a non-empty string at ${path}.`);
  }
}

function assertArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected an array at ${path}.`);
  }
}

function assertPlainObject(value: unknown, message: string): void {
  if (!isPlainObject(value)) {
    throw new Error(message);
  }
}

function compareOrder(left?: number, right?: number): number {
  return toSortableOrder(left) - toSortableOrder(right);
}

function toSortableOrder(value?: number): number {
  return typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER;
}

export function toStringRecord(input?: Record<string, PrimitiveValue>): Record<string, string> {
  if (!input) {
    return {};
  }

  return Object.entries(input).reduce<Record<string, string>>((record, [key, value]) => {
    record[key] = String(value);
    return record;
  }, {});
}

function readRequiredString(value: unknown, key: string, path: string): string {
  const property = readUnknown(value, key);

  assertNonEmptyString(property, path);
  return property;
}

function readUnknown(value: unknown, key: string): unknown {
  return isPlainObject(value) ? value[key] : undefined;
}

function readOptionalProperty<T>(value: unknown, key: string): T | undefined {
  return readUnknown(value, key) as T | undefined;
}

function isBasemapLayerType(type: unknown): type is BasemapLayerType {
  return type === 'tile' || type === 'vector-tile' || type === 'map-image';
}

function isLeafLayerType(type: unknown): type is LeafLayerType {
  return type === 'feature'
    || type === 'map-image'
    || type === 'tile'
    || type === 'vector-tile'
    || type === 'graphics';
}
