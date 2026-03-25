import type Basemap from '@arcgis/core/Basemap';
import type Layer from '@arcgis/core/layers/Layer';

export type PrimitiveValue = string | number | boolean;

export type LayerListMode = 'show' | 'hide' | 'hide-children';
export type LayerLoadStatus = 'loading' | 'loaded' | 'failed' | 'skipped';
export type LayerKind = 'feature' | 'map-image' | 'tile' | 'vector-tile' | 'graphics' | 'group';
export type LeafLayerKind = Exclude<LayerKind, 'group'>;
export type BasemapLayerKind = 'tile' | 'vector-tile' | 'map-image';
export type ResourceAuthMode = 'none' | 'identity-manager' | 'token';
export type ResourceAuthScope = 'layer' | 'resolver' | 'both';

export const DEFAULT_FALLBACK_BASEMAP = 'arcgis-navigation';
export const DEFAULT_LAYER_LIST_MODE: LayerListMode = 'show';
export const DEFAULT_GROUP_VISIBILITY_MODE = 'independent';

export interface DirectSourceConfig {
  mode?: 'direct';
}

export interface ResolvedSourceConfig {
  mode: 'resolved';
  resolverKey: string;
  endpoint: string;
  method?: 'GET' | 'POST';
  params?: Record<string, PrimitiveValue>;
  body?: unknown;
}

export type ResourceSourceConfig = DirectSourceConfig | ResolvedSourceConfig;

export interface ResourceAuthConfig {
  mode: ResourceAuthMode;
  appliesTo?: ResourceAuthScope;
  resourceUrl?: string;
  server?: string;
  tokenEndpoint?: string;
  token?: string;
  method?: 'GET' | 'POST';
  params?: Record<string, PrimitiveValue>;
  body?: unknown;
  headerName?: string;
  expiresAt?: number;
  ssl?: boolean;
  userId?: string;
}

export interface SharedResourceConfig {
  auth?: ResourceAuthConfig;
  source?: ResourceSourceConfig;
  url?: string;
  opacity?: number;
  metadata?: Record<string, unknown>;
}

export interface PointGeometryConfig {
  type: 'point';
  longitude: number;
  latitude: number;
}

export interface SimpleMarkerSymbolConfig {
  type: 'simple-marker';
  color?: string;
  size?: number;
  outline?: {
    color?: string;
    width?: number;
  };
}

export interface GraphicItemConfig {
  geometry: PointGeometryConfig;
  symbol?: SimpleMarkerSymbolConfig;
  attributes?: Record<string, unknown>;
  popupTemplate?: {
    title?: string;
    content?: string;
  };
}

export interface BaseLayerConfig extends SharedResourceConfig {
  id: string;
  title: string;
  kind: LayerKind;
  visible?: boolean;
  listMode?: LayerListMode;
  order?: number;
}

export interface GroupLayerConfig extends BaseLayerConfig {
  kind: 'group';
  visibilityMode?: 'independent' | 'inherited' | 'exclusive';
  children: LayerConfig[];
}

export interface UrlLeafLayerConfig extends BaseLayerConfig {
  kind: 'feature' | 'map-image' | 'tile' | 'vector-tile';
  layerProps?: Record<string, unknown>;
}

export interface GraphicsLayerConfig extends BaseLayerConfig {
  kind: 'graphics';
  layerProps?: Record<string, unknown>;
  graphics?: GraphicItemConfig[];
}

export type LeafLayerConfig = UrlLeafLayerConfig | GraphicsLayerConfig;
export type LayerConfig = GroupLayerConfig | LeafLayerConfig;

export interface BasemapLayerConfig extends SharedResourceConfig {
  id: string;
  kind: BasemapLayerKind;
  title?: string;
  order?: number;
  layerProps?: Record<string, unknown>;
}

export interface WellKnownBasemapConfig {
  mode: 'well-known';
  id: string;
}

export interface PortalItemBasemapConfig extends SharedResourceConfig {
  mode: 'portal-item';
  id: string;
  title?: string;
}

export interface CustomBasemapConfig {
  mode: 'custom';
  id: string;
  title: string;
  baseLayers: BasemapLayerConfig[];
  referenceLayers?: BasemapLayerConfig[];
  spatialReferenceWkid?: number;
}

export type BasemapConfig = WellKnownBasemapConfig | PortalItemBasemapConfig | CustomBasemapConfig;

export interface MapConfig {
  basemap: BasemapConfig;
  operationalLayers: LayerConfig[];
  fallbackBasemap?: string;
}

export interface PreparedAuthContext {
  token?: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  auth?: ResourceAuthConfig;
}

export interface ResolvedLayerDefinition {
  id: string;
  title?: string;
  url?: string;
  layerProps?: Record<string, unknown>;
  auth?: Partial<ResourceAuthConfig>;
  graphics?: GraphicItemConfig[];
}

export interface ResolvedBasemapDefinition {
  id: string;
  title?: string;
  portalItemId?: string;
  baseLayers?: BasemapLayerConfig[];
  referenceLayers?: BasemapLayerConfig[];
  spatialReferenceWkid?: number;
}

export interface MapComposition {
  basemap: Basemap | string;
  operationalLayers: Layer[];
}

export interface LayerRuntimeRecord {
  id: string;
  config: LayerConfig;
  layer?: Layer;
  status: LayerLoadStatus;
  error?: string;
  childIds: string[];
}