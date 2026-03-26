import {
  BasemapLayerConfig,
  BasemapLayerFallbackConfig,
  OperationalLayerFallbackConfig,
  UrlLeafLayerConfig
} from '../models/layer-config.model';
import { hasOwn } from './map-object.utils';

export function buildOperationalLayerCandidates(config: UrlLeafLayerConfig): UrlLeafLayerConfig[] {
  return [config, ...(config.fallbackLayers ?? []).map((fallback) => mergeOperationalLayerFallback(config, fallback))];
}

export function buildBasemapLayerCandidates(config: BasemapLayerConfig): BasemapLayerConfig[] {
  return [config, ...(config.fallbackLayers ?? []).map((fallback) => mergeBasemapLayerFallback(config, fallback))];
}

function mergeOperationalLayerFallback(
  config: UrlLeafLayerConfig,
  fallback: OperationalLayerFallbackConfig
): UrlLeafLayerConfig {
  const { fallbackLayers, ...baseConfig } = config;

  return {
    ...baseConfig,
    type: readOverrideValue(fallback, 'type', config.type),
    url: readOverrideValue(fallback, 'url', config.url),
    source: readOverrideValue(fallback, 'source', config.source),
    auth: readOverrideValue(fallback, 'auth', config.auth),
    layerProps: readOverrideValue(fallback, 'layerProps', config.layerProps),
    opacity: readOverrideValue(fallback, 'opacity', config.opacity),
    metadata: readOverrideValue(fallback, 'metadata', config.metadata)
  };
}

function mergeBasemapLayerFallback(
  config: BasemapLayerConfig,
  fallback: BasemapLayerFallbackConfig
): BasemapLayerConfig {
  const { fallbackLayers, ...baseConfig } = config;

  return {
    ...baseConfig,
    type: readOverrideValue(fallback, 'type', config.type),
    url: readOverrideValue(fallback, 'url', config.url),
    source: readOverrideValue(fallback, 'source', config.source),
    auth: readOverrideValue(fallback, 'auth', config.auth),
    layerProps: readOverrideValue(fallback, 'layerProps', config.layerProps),
    opacity: readOverrideValue(fallback, 'opacity', config.opacity),
    metadata: readOverrideValue(fallback, 'metadata', config.metadata)
  };
}

function readOverrideValue<TValue>(
  override: unknown,
  key: string,
  fallbackValue: TValue
): TValue {
  const record = override as Record<string, unknown>;

  return hasOwn(record, key) ? record[key] as TValue : fallbackValue;
}
