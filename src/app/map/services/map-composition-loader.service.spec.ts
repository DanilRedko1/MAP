import type Layer from '@arcgis/core/layers/Layer';
import { TestBed } from '@angular/core/testing';

import { MapConfig } from '../models/layer-config.model';
import { MapBasemapFactoryService } from './map-basemap-factory.service';
import { MapCompositionLoaderService } from './map-composition-loader.service';
import { MapConfigService } from './map-config.service';
import { MapLayerLoaderService } from './map-layer-loader.service';

describe('MapCompositionLoaderService', () => {
  let service: MapCompositionLoaderService;
  let configService: jasmine.SpyObj<MapConfigService>;
  let basemapFactory: jasmine.SpyObj<MapBasemapFactoryService>;
  let layerLoader: jasmine.SpyObj<MapLayerLoaderService>;

  beforeEach(() => {
    configService = jasmine.createSpyObj<MapConfigService>('MapConfigService', ['getConfig']);
    basemapFactory = jasmine.createSpyObj<MapBasemapFactoryService>('MapBasemapFactoryService', ['createBasemap']);
    layerLoader = jasmine.createSpyObj<MapLayerLoaderService>('MapLayerLoaderService', ['loadLayers']);

    TestBed.configureTestingModule({
      providers: [
        MapCompositionLoaderService,
        { provide: MapConfigService, useValue: configService },
        { provide: MapBasemapFactoryService, useValue: basemapFactory },
        { provide: MapLayerLoaderService, useValue: layerLoader }
      ]
    });

    service = TestBed.inject(MapCompositionLoaderService);
  });

  it('loads a composition from the async config service', async () => {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-navigation'
      },
      operationalLayers: [],
      fallbackBasemap: 'arcgis-topographic'
    };
    const layers = [{} as Layer];

    configService.getConfig.and.returnValue(Promise.resolve(config));
    basemapFactory.createBasemap.and.returnValue(Promise.resolve('arcgis-navigation'));
    layerLoader.loadLayers.and.returnValue(Promise.resolve(layers));

    const composition = await service.loadComposition();

    expect(configService.getConfig).toHaveBeenCalledTimes(1);
    expect(basemapFactory.createBasemap).toHaveBeenCalledOnceWith(config.basemap);
    expect(layerLoader.loadLayers).toHaveBeenCalledOnceWith(config.operationalLayers);
    expect(composition).toEqual({
      basemap: 'arcgis-navigation',
      operationalLayers: layers
    });
  });

  it('propagates config service failures before basemap and layer creation run', async () => {
    const error = new Error('Expected an array at group("group-a").layers.');

    configService.getConfig.and.returnValue(Promise.reject(error));

    await expectAsync(service.loadComposition()).toBeRejectedWith(error);
    expect(basemapFactory.createBasemap).not.toHaveBeenCalled();
    expect(layerLoader.loadLayers).not.toHaveBeenCalled();
  });

  it('falls back to the configured basemap when basemap loading fails', async () => {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-navigation'
      },
      operationalLayers: [],
      fallbackBasemap: 'arcgis-topographic'
    };

    configService.getConfig.and.returnValue(Promise.resolve(config));
    basemapFactory.createBasemap.and.returnValue(Promise.reject(new Error('Basemap unavailable')));
    layerLoader.loadLayers.and.returnValue(Promise.resolve([]));
    spyOn(console, 'warn');

    const composition = await service.loadComposition();

    expect(composition.basemap).toBe('arcgis-topographic');
    expect(composition.operationalLayers).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });
});
