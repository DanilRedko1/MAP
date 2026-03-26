import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DEFAULT_FALLBACK_BASEMAP } from '../models/layer-config.model';
import { MAP_CONFIG_ASSET_PATH, MapConfigService } from './map-config.service';

describe('MapConfigService', () => {
  let service: MapConfigService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });

    service = TestBed.inject(MapConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads map config from the root assets path and applies the default fallback basemap', async () => {
    const configPromise = service.getConfig();
    const request = httpMock.expectOne(MAP_CONFIG_ASSET_PATH);

    expect(request.request.method).toBe('GET');

    request.flush({
      basemap: {
        mode: 'well-known',
        id: 'arcgis-navigation'
      },
      operationalLayers: []
    });

    const config = await configPromise;

    expect(config.fallbackBasemap).toBe(DEFAULT_FALLBACK_BASEMAP);
  });

  it('preserves an explicit fallback basemap from the payload', async () => {
    const configPromise = service.getConfig();
    const request = httpMock.expectOne(MAP_CONFIG_ASSET_PATH);

    request.flush({
      basemap: {
        mode: 'well-known',
        id: 'arcgis-navigation'
      },
      operationalLayers: [],
      fallbackBasemap: 'arcgis-topographic'
    });

    const config = await configPromise;

    expect(config.fallbackBasemap).toBe('arcgis-topographic');
  });

  it('rejects when the config request fails', async () => {
    const configPromise = service.getConfig();
    const request = httpMock.expectOne(MAP_CONFIG_ASSET_PATH);

    request.flush('missing', {
      status: 404,
      statusText: 'Not Found'
    });

    await expectAsync(configPromise).toBeRejected();
  });

  it('rejects malformed nested config by surfacing validator errors', async () => {
    const configPromise = service.getConfig();
    const request = httpMock.expectOne(MAP_CONFIG_ASSET_PATH);

    request.flush({
      basemap: {
        mode: 'well-known',
        id: 'arcgis-navigation'
      },
      operationalLayers: [
        {
          id: 'group-a',
          title: 'Group A',
          type: 'group',
          layers: {}
        }
      ]
    });

    await expectAsync(configPromise).toBeRejectedWithError(Error, 'Expected an array at group("group-a").layers.');
  });
});
