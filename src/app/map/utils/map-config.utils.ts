import {
  BasemapConfig,
  BasemapLayerConfig,
  DEFAULT_FALLBACK_BASEMAP,
  LayerConfig,
  MapConfig,
  PrimitiveValue,
  ResourceAuthConfig,
  ResourceSourceConfig
} from '../models/layer-config.model';

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
  const seenIds = new Set<string>();

  if (!config.fallbackBasemap) {
    config.fallbackBasemap = DEFAULT_FALLBACK_BASEMAP;
  }

  validateBasemapConfig(config.basemap, seenIds);

  for (const layer of config.operationalLayers) {
    validateLayerConfig(layer, seenIds, 'operationalLayers');
  }
}

function validateBasemapConfig(config: BasemapConfig, seenIds: Set<string>): void {
  assertNonEmptyString(config.id, 'basemap.id');

  if (seenIds.has(config.id)) {
    throw new Error(`Duplicate config id "${config.id}" found in basemap configuration.`);
  }

  seenIds.add(config.id);

  if (config.mode === 'portal-item') {
    validateSharedSource(config.source, `basemap("${config.id}").source`);
    validateAuth(config.auth, `basemap("${config.id}").auth`);
    return;
  }

  if (config.mode === 'custom') {
    if (config.baseLayers.length === 0) {
      throw new Error(`Custom basemap "${config.id}" must define at least one base layer.`);
    }

    for (const layer of config.baseLayers) {
      validateBasemapLayerConfig(layer, seenIds, `basemap("${config.id}").baseLayers`);
    }

    for (const layer of config.referenceLayers ?? []) {
      validateBasemapLayerConfig(layer, seenIds, `basemap("${config.id}").referenceLayers`);
    }
  }
}

function validateBasemapLayerConfig(config: BasemapLayerConfig, seenIds: Set<string>, path: string): void {
  assertNonEmptyString(config.id, `${path}.id`);

  if (seenIds.has(config.id)) {
    throw new Error(`Duplicate config id "${config.id}" found in ${path}.`);
  }

  seenIds.add(config.id);
  validateSharedSource(config.source, `${path}("${config.id}").source`);
  validateAuth(config.auth, `${path}("${config.id}").auth`);
}

function validateLayerConfig(config: LayerConfig, seenIds: Set<string>, path: string): void {
  assertNonEmptyString(config.id, `${path}.id`);
  assertNonEmptyString(config.title, `${path}("${config.id}").title`);

  if (seenIds.has(config.id)) {
    throw new Error(`Duplicate config id "${config.id}" found in ${path}.`);
  }

  seenIds.add(config.id);
  validateSharedSource(config.source, `${path}("${config.id}").source`);
  validateAuth(config.auth, `${path}("${config.id}").auth`);

  if (config.kind === 'group') {
    for (const child of config.children) {
      validateLayerConfig(child, seenIds, `group("${config.id}").children`);
    }

    return;
  }

  if (config.kind !== 'graphics' && !config.url && config.source?.mode !== 'resolved') {
    throw new Error(`Layer "${config.id}" requires a url or a resolved source.`);
  }

  if (config.kind === 'graphics') {
    for (const graphic of config.graphics ?? []) {
      if (graphic.geometry.type !== 'point') {
        throw new Error(`Graphic layer "${config.id}" only supports point geometries in this implementation.`);
      }
    }
  }
}

function validateSharedSource(source: ResourceSourceConfig | undefined, path: string): void {
  if (!source || source.mode !== 'resolved') {
    return;
  }

  assertNonEmptyString(source.resolverKey, `${path}.resolverKey`);
  assertNonEmptyString(source.endpoint, `${path}.endpoint`);
}

function validateAuth(auth: ResourceAuthConfig | undefined, path: string): void {
  if (!auth || auth.mode === 'none') {
    return;
  }

  if (auth.mode === 'token' && !auth.token && !auth.tokenEndpoint) {
    throw new Error(`${path} requires either a static token or a tokenEndpoint.`);
  }
}

function assertNonEmptyString(value: string, path: string): void {
  if (!value.trim()) {
    throw new Error(`Expected a non-empty string at ${path}.`);
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