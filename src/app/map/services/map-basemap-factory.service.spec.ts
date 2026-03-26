import Basemap from '@arcgis/core/Basemap';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import TileLayer from '@arcgis/core/layers/TileLayer';

import {
  BasemapConfig,
  PreparedAuthContext,
  ResolvedLayerDefinition,
  ResolvedBasemapDefinition
} from '../models/layer-config.model';
import { MapBasemapFactoryService } from './map-basemap-factory.service';
import { MapLayerFactoryService } from './map-layer-factory.service';
import { MapResourceAuthService } from './map-resource-auth.service';
import { MapResourceResolverService } from './map-resource-resolver.service';

describe('MapBasemapFactoryService', () => {
  let service: MapBasemapFactoryService;
  let authService: jasmine.SpyObj<MapResourceAuthService>;
  let resolverService: jasmine.SpyObj<MapResourceResolverService>;
  let layerFactory: jasmine.SpyObj<MapLayerFactoryService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<MapResourceAuthService>('MapResourceAuthService', ['prepare']);
    resolverService = jasmine.createSpyObj<MapResourceResolverService>(
      'MapResourceResolverService',
      ['resolveLayerDefinition', 'resolveBasemapDefinition']
    );
    layerFactory = jasmine.createSpyObj<MapLayerFactoryService>('MapLayerFactoryService', ['createBasemapLayer']);
    service = new MapBasemapFactoryService(authService, resolverService, layerFactory);
  });

  it('delegates custom basemap layer creation to MapLayerFactoryService', async () => {
    const customBasemap: Extract<BasemapConfig, { mode: 'custom' }> = {
      mode: 'custom',
      id: 'custom-basemap',
      title: 'Custom Basemap',
      baseLayers: [
        {
          id: 'base-layer',
          type: 'tile',
          url: 'https://example.com/base'
        }
      ],
      referenceLayers: [
        {
          id: 'reference-layer',
          type: 'map-image',
          url: 'https://example.com/reference'
        }
      ]
    };
    const baseAuthContext: PreparedAuthContext = {
      headers: {},
      query: {
        token: 'base-token'
      },
      auth: {
        mode: 'token'
      }
    };
    const baseResolved: ResolvedLayerDefinition = {
      id: 'base-layer',
      url: 'https://resolved.example.com/base'
    };
    const baseLayer = new TileLayer({
      url: 'https://resolved.example.com/base'
    });
    const referenceLayer = new MapImageLayer({
      url: 'https://example.com/reference'
    });

    authService.prepare.and.returnValues(Promise.resolve(baseAuthContext), Promise.resolve(undefined));
    resolverService.resolveLayerDefinition.and.returnValues(Promise.resolve(baseResolved), Promise.resolve(undefined));
    layerFactory.createBasemapLayer.and.returnValues(baseLayer, referenceLayer);

    const basemap = await service.createBasemap(customBasemap) as Basemap;

    expect(layerFactory.createBasemapLayer.calls.count()).toBe(2);
    expect(layerFactory.createBasemapLayer.calls.argsFor(0)).toEqual([customBasemap.baseLayers[0], baseResolved, baseAuthContext]);
    expect(layerFactory.createBasemapLayer.calls.argsFor(1)).toEqual([customBasemap.referenceLayers![0], undefined, undefined]);
    expect(basemap.baseLayers.getItemAt(0)).toBe(baseLayer);
    expect(basemap.referenceLayers.getItemAt(0)).toBe(referenceLayer);
  });

  it('returns well-known basemap ids without calling collaborators', async () => {
    const basemap = await service.createBasemap({
      mode: 'well-known',
      id: 'arcgis-navigation'
    });

    expect(basemap).toBe('arcgis-navigation');
    expect(authService.prepare).not.toHaveBeenCalled();
    expect(resolverService.resolveBasemapDefinition).not.toHaveBeenCalled();
    expect(layerFactory.createBasemapLayer).not.toHaveBeenCalled();
  });

  it('preserves portal-item basemap creation behavior', async () => {
    const authContext: PreparedAuthContext = {
      headers: {},
      query: {},
      auth: {
        mode: 'identity-manager'
      }
    };
    const resolvedBasemap: ResolvedBasemapDefinition = {
      id: 'portal-basemap',
      portalItemId: 'resolved-portal-item',
      title: 'Resolved Portal Title'
    };

    authService.prepare.and.returnValue(Promise.resolve(authContext));
    resolverService.resolveBasemapDefinition.and.returnValue(Promise.resolve(resolvedBasemap));

    const basemap = await service.createBasemap({
      mode: 'portal-item',
      id: 'portal-basemap',
      title: 'Configured Portal Title',
      source: {
        mode: 'resolved',
        resolverKey: 'basemap',
        endpoint: '/resolve/basemap'
      }
    });

    expect(basemap instanceof Basemap).toBeTrue();
    expect((basemap as Basemap).portalItem?.id).toBe('resolved-portal-item');
    expect((basemap as Basemap).title).toBe('Resolved Portal Title');
    expect(layerFactory.createBasemapLayer).not.toHaveBeenCalled();
  });
});
