import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import type MapView from '@arcgis/core/views/MapView';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AppMaterialModule } from '../app-material.module';
import { BasemapLayerConfig, MapComposition, MapConfig } from '../map/models/layer-config.model';
import { MapBasemapStatusService } from '../map/services/map-basemap-status.service';
import { MapCompositionLoaderService } from '../map/services/map-composition-loader.service';
import { MapLayerRegistryService } from '../map/services/map-layer-registry.service';
import { MapViewRuntimeHandle, MapViewRuntimeService } from '../map/services/map-view-runtime.service';
import { ArcgisMapComponent } from './arcgis-map.component';

describe('ArcgisMapComponent', () => {
  let fixture: ComponentFixture<ArcgisMapComponent>;
  let mapCompositionLoader: jasmine.SpyObj<MapCompositionLoaderService>;
  let mapViewRuntime: jasmine.SpyObj<MapViewRuntimeService>;

  beforeEach(async () => {
    mapCompositionLoader = jasmine.createSpyObj<MapCompositionLoaderService>('MapCompositionLoaderService', ['loadComposition']);
    mapViewRuntime = jasmine.createSpyObj<MapViewRuntimeService>('MapViewRuntimeService', ['initialize']);

    await TestBed.configureTestingModule({
      declarations: [ArcgisMapComponent],
      imports: [
        AppMaterialModule,
        NoopAnimationsModule
      ],
      providers: [
        MapLayerRegistryService,
        { provide: MapCompositionLoaderService, useValue: mapCompositionLoader },
        { provide: MapViewRuntimeService, useValue: mapViewRuntime }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ArcgisMapComponent);
  });

  it('delegates successful map runtime initialization and renders Material exploration panels', async () => {
    const composition = createComposition();
    const runtimeHandle = createRuntimeHandle();

    mapCompositionLoader.loadComposition.and.returnValue(Promise.resolve(composition));
    mapViewRuntime.initialize.and.returnValue(Promise.resolve(runtimeHandle));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const initializeArgs = mapViewRuntime.initialize.calls.mostRecent().args;

    expect(host.querySelector('.map-error')).toBeNull();
    expect(host.querySelector('mat-card')).not.toBeNull();
    expect(host.querySelector('.map-toolbar')).toBeNull();
    expect(host.querySelector('mat-accordion')).toBeNull();
    expect(host.textContent).toContain('Map summary');
    expect(host.textContent).toContain('Filters');
    expect(host.textContent).not.toContain('Layer tree');
    expect(host.textContent).not.toContain('Legend');
    expect(mapViewRuntime.initialize).toHaveBeenCalledTimes(1);
    expect(initializeArgs[0]).toBeInstanceOf(HTMLDivElement);
    expect(initializeArgs[1]).toBeInstanceOf(HTMLDivElement);
    expect(initializeArgs[2]).toBe(composition);
  });

  it('shows a config error when composition loading fails', async () => {
    mapCompositionLoader.loadComposition.and.returnValue(Promise.reject(new Error('Expected an array at operationalLayers.')));
    spyOn(console, 'error');

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(mapViewRuntime.initialize).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Map configuration could not be loaded');
    expect(host.textContent).toContain('Expected an array at operationalLayers.');
  });

  it('shows a generic initialization error when runtime setup fails', async () => {
    mapCompositionLoader.loadComposition.and.returnValue(Promise.resolve(createComposition()));
    mapViewRuntime.initialize.and.returnValue(Promise.reject(new Error('ArcGIS runtime unavailable.')));
    spyOn(console, 'error');

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Map could not be initialized');
    expect(host.textContent).toContain('ArcGIS runtime unavailable.');
  });

  it('destroys the runtime handle when the component is destroyed', async () => {
    const runtimeHandle = createRuntimeHandle();

    mapCompositionLoader.loadComposition.and.returnValue(Promise.resolve(createComposition()));
    mapViewRuntime.initialize.and.returnValue(Promise.resolve(runtimeHandle));

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.destroy();

    expect(runtimeHandle.destroy).toHaveBeenCalledTimes(1);
  });

  it('shows when a layer is running on a backup source', async () => {
    const composition = createComposition();
    const basemapStatus = TestBed.inject(MapBasemapStatusService);
    const registry = TestBed.inject(MapLayerRegistryService);
    const runtimeHandle = createRuntimeHandle();
    const layerConfig = composition.config.operationalLayers[0];
    const basemapLayerConfig: BasemapLayerConfig = {
      id: 'world-imagery',
      title: 'World Imagery',
      type: 'tile',
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
    };

    mapCompositionLoader.loadComposition.and.returnValue(Promise.resolve(composition));
    mapViewRuntime.initialize.and.returnValue(Promise.resolve(runtimeHandle));

    fixture.detectChanges();
    await fixture.whenStable();

    registry.start(layerConfig);
    registry.markLoaded(layerConfig, new GraphicsLayer({
      id: layerConfig.id,
      title: layerConfig.title
    }), {
      loadedViaFallback: true,
      fallbackIndex: 0,
      attemptErrors: ['Primary source unavailable']
    });
    basemapStatus.start(basemapLayerConfig, 'base');
    basemapStatus.markLoaded(basemapLayerConfig, 'base', {
      loadedViaFallback: true,
      fallbackIndex: 0,
      attemptErrors: ['Primary basemap layer unavailable']
    });
    basemapStatus.markFallbackBasemap('arcgis-navigation', new Error('Custom basemap exhausted all candidates.'));

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Backup source in use');
    expect(host.textContent).toContain('Recovered after 1 failed attempt');
    expect(host.textContent).toContain('Basemap');
    expect(host.textContent).toContain('World Imagery (Base layer)');
    expect(host.textContent).toContain('Default fallback basemap in use: arcgis-navigation');
    expect(host.textContent).toContain('Sample Locations');
  });

  function createComposition(): MapComposition {
    const config: MapConfig = {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-navigation'
      },
      operationalLayers: [
        {
          id: 'sample-locations',
          title: 'Sample Locations',
          type: 'graphics',
          ui: {
            filterableFields: [
              {
                field: 'region',
                label: 'Region',
                type: 'select',
                options: [
                  {
                    label: 'West',
                    value: 'West'
                  }
                ]
              }
            ]
          }
        }
      ]
    };

    return {
      basemap: 'arcgis-navigation',
      operationalLayers: [],
      config
    };
  }

  function createRuntimeHandle(): MapViewRuntimeHandle {
    const view = {
      on: () => ({ remove: () => undefined }),
      watch: () => ({ remove: () => undefined }),
      hitTest: async () => ({ results: [] }),
      goTo: async () => undefined,
      extent: {
        intersects: () => true,
        toJSON: () => ({
          xmin: 0,
          ymin: 0,
          xmax: 1,
          ymax: 1
        })
      }
    } as unknown as MapView;

    return {
      view,
      destroy: jasmine.createSpy('destroy')
    };
  }
});
