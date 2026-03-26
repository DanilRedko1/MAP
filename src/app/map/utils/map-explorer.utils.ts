import {
  LayerConfig,
  LayerDisplayFieldConfig,
  LeafLayerConfig
} from '../models/layer-config.model';
import {
  isPlainObject,
  readOptionalArray,
  readOptionalPlainObject,
  readString
} from './map-object.utils';

export interface MapFilterState {
  [layerId: string]: {
    [field: string]: string;
  };
}

export interface ShareableMapState {
  extent?: Record<string, unknown>;
  visibleLayerIds: string[];
  filters: MapFilterState;
  extentFilterEnabled: boolean;
}

export interface FeatureDetailEntry {
  label: string;
  value: string;
}

export interface FeatureDetails {
  title: string;
  entries: FeatureDetailEntry[];
}

const SHARE_STATE_PREFIX = '#map=';

export function flattenLeafLayers(configs: LayerConfig[]): LeafLayerConfig[] {
  return configs.reduce<LeafLayerConfig[]>((layers, config) => {
    if (config.type === 'group') {
      layers.push(...flattenLeafLayers(config.layers));
      return layers;
    }

    layers.push(config);
    return layers;
  }, []);
}

export function findLeafLayerConfig(configs: LayerConfig[], layerId: string): LeafLayerConfig | undefined {
  return flattenLeafLayers(configs).find((config) => config.id === layerId);
}

export function countActiveFilters(filters: MapFilterState, extentFilterEnabled: boolean): number {
  const fieldFilterCount = Object.values(filters).reduce((count, layerFilters) => {
    return count + Object.values(layerFilters).filter((value) => value.trim().length > 0).length;
  }, 0);

  return fieldFilterCount + (extentFilterEnabled ? 1 : 0);
}

export function serializeShareState(state: ShareableMapState): string {
  return `${SHARE_STATE_PREFIX}${encodeURIComponent(JSON.stringify(state))}`;
}

export function deserializeShareState(hash: string): ShareableMapState | null {
  if (!hash.startsWith(SHARE_STATE_PREFIX)) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(hash.slice(SHARE_STATE_PREFIX.length));
    const parsed = JSON.parse(decoded);

    if (!isPlainObject(parsed)) {
      return null;
    }

    return {
      extent: readOptionalPlainObject(parsed['extent']),
      visibleLayerIds: readStringArray(parsed['visibleLayerIds']),
      filters: readFilterState(parsed['filters']),
      extentFilterEnabled: parsed['extentFilterEnabled'] === true
    };
  } catch {
    return null;
  }
}

export function buildFeatureDetails(
  config: LeafLayerConfig,
  attributes?: Record<string, unknown>
): FeatureDetails {
  const safeAttributes = attributes ?? {};
  const displayFields = config.ui?.displayFields;
  const entries = displayFields && displayFields.length > 0
    ? displayFields.map((field) => buildDetailEntry(field, safeAttributes[field.field]))
    : Object.entries(safeAttributes).map(([field, value]) => ({
      label: toStartCase(field),
      value: toDisplayValue(value)
    }));

  return {
    title: readString(safeAttributes['title']) ?? config.title,
    entries
  };
}

function buildDetailEntry(field: LayerDisplayFieldConfig, value: unknown): FeatureDetailEntry {
  return {
    label: field.label,
    value: toDisplayValue(value)
  };
}

function toDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Not available';
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(', ');
  }

  return String(value);
}

function readStringArray(value: unknown): string[] {
  return (readOptionalArray(value) ?? []).filter((item): item is string => typeof item === 'string');
}

function readFilterState(value: unknown): MapFilterState {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.entries(value).reduce<MapFilterState>((filters, [layerId, layerFilters]) => {
    if (!isPlainObject(layerFilters)) {
      return filters;
    }

    filters[layerId] = Object.entries(layerFilters).reduce<Record<string, string>>((record, [field, filterValue]) => {
      if (typeof filterValue === 'string') {
        record[field] = filterValue;
      }

      return record;
    }, {});

    return filters;
  }, {});
}

function toStartCase(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (character) => character.toUpperCase());
}
