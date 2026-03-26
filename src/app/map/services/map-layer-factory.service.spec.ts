import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import TileLayer from '@arcgis/core/layers/TileLayer';

import {
  BasemapLayerConfig,
  GraphicItemConfig,
  GraphicsLayerConfig,
  PreparedAuthContext
} from '../models/layer-config.model';
import { MapLayerFactoryService } from './map-layer-factory.service';

describe('MapLayerFactoryService', () => {
  let service: MapLayerFactoryService;

  beforeEach(() => {
    service = new MapLayerFactoryService();
  });

  it('creates operational URL layers with the correct ArcGIS type and operational props', () => {
    const layer = service.createLayer({
      id: 'feature-layer',
      title: 'Configured title',
      type: 'feature',
      url: 'https://example.com/FeatureServer/0',
      visible: false,
      listMode: 'hide',
      opacity: 0.4,
      layerProps: {
        minScale: 1000
      }
    });

    expect(layer instanceof FeatureLayer).toBeTrue();
    expect(layer.title).toBe('Configured title');
    expect(layer.visible).toBeFalse();
    expect(layer.listMode).toBe('hide');
    expect(layer.opacity).toBe(0.4);
    expect((layer as FeatureLayer).url).toContain('https://example.com/FeatureServer');
    expect((layer as FeatureLayer).minScale).toBe(1000);
  });

  it('creates basemap sublayers through the shared factory with basemap-specific title precedence', () => {
    const authContext: PreparedAuthContext = {
      headers: {},
      query: {
        token: 'abc123'
      },
      auth: {
        mode: 'token'
      }
    };
    const layer = service.createBasemapLayer(
      {
        id: 'basemap-layer',
        type: 'tile',
        title: 'Configured basemap title',
        url: 'https://example.com/tiles',
        opacity: 0.6
      },
      {
        id: 'basemap-layer',
        title: 'Resolved title',
        url: 'https://resolved.example.com/tiles'
      },
      authContext
    ) as TileLayer & { customParameters?: Record<string, string> };

    expect(layer instanceof TileLayer).toBeTrue();
    expect(layer.title).toBe('Configured basemap title');
    expect(layer.opacity).toBe(0.6);
    expect(layer.url).toBe('https://resolved.example.com/tiles');
    expect(layer.customParameters).toEqual({ token: 'abc123' });
  });

  it('does not apply layer custom parameters when token auth targets the resolver only', () => {
    const authContext: PreparedAuthContext = {
      headers: {},
      query: {
        token: 'resolver-token'
      },
      auth: {
        mode: 'token',
        appliesTo: 'resolver'
      }
    };
    const layer = service.createLayer(
      {
        id: 'tile-layer',
        title: 'Tile Layer',
        type: 'tile',
        url: 'https://example.com/tile'
      },
      undefined,
      authContext
    ) as TileLayer & { customParameters?: Record<string, string> };

    expect(layer.customParameters).toBeFalsy();
  });

  it('throws when a URL-backed operational or basemap layer has no resolved url', () => {
    expect(() => service.createLayer({
      id: 'feature-layer',
      title: 'Feature Layer',
      type: 'feature'
    } as Parameters<MapLayerFactoryService['createLayer']>[0])).toThrowError(
      'Layer "feature-layer" could not be created because no url was resolved.'
    );

    expect(() => service.createBasemapLayer({
      id: 'basemap-layer',
      type: 'map-image'
    } as BasemapLayerConfig)).toThrowError(
      'Basemap layer "basemap-layer" could not be created because no url was resolved.'
    );
  });

  it('preserves graphics layer behavior with resolved titles and graphics overrides', () => {
    const configGraphic: GraphicItemConfig = {
      geometry: {
        type: 'point',
        longitude: -74.006,
        latitude: 40.7128
      },
      attributes: {
        title: 'Config graphic'
      }
    };
    const resolvedGraphic: GraphicItemConfig = {
      geometry: {
        type: 'point',
        longitude: -122.4194,
        latitude: 37.7749
      },
      attributes: {
        title: 'Resolved graphic'
      }
    };
    const layer = service.createLayer(
      {
        id: 'graphics-layer',
        title: 'Configured title',
        type: 'graphics',
        graphics: [configGraphic]
      } as GraphicsLayerConfig,
      {
        id: 'graphics-layer',
        title: 'Resolved title',
        graphics: [resolvedGraphic]
      }
    ) as GraphicsLayer;

    expect(layer instanceof GraphicsLayer).toBeTrue();
    expect(layer.title).toBe('Resolved title');
    expect(layer.graphics.length).toBe(1);
    expect(layer.graphics.getItemAt(0).attributes?.['title']).toBe('Resolved graphic');
  });

  it('creates basemap layers with resolved titles when the config omits one', () => {
    const layer = service.createBasemapLayer(
      {
        id: 'basemap-layer',
        type: 'map-image',
        url: 'https://example.com/map-image'
      },
      {
        id: 'basemap-layer',
        title: 'Resolved basemap title'
      }
    );

    expect(layer instanceof MapImageLayer).toBeTrue();
    expect(layer.title).toBe('Resolved basemap title');
  });
});
