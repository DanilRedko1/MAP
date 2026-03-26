import type MapView from '@arcgis/core/views/MapView';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapComposition } from '../map/models/layer-config.model';
import { MapCompositionLoaderService } from '../map/services/map-composition-loader.service';
import { MapViewBootstrapHandle, MapViewBootstrapService } from '../map/services/map-view-bootstrap.service';
import { ArcgisMapComponent } from './arcgis-map.component';

describe('ArcgisMapComponent', () => {
  let fixture: ComponentFixture<ArcgisMapComponent>;
  let mapCompositionLoader: jasmine.SpyObj<MapCompositionLoaderService>;
  let mapViewBootstrap: jasmine.SpyObj<MapViewBootstrapService>;

  beforeEach(async () => {
    mapCompositionLoader = jasmine.createSpyObj<MapCompositionLoaderService>('MapCompositionLoaderService', ['loadComposition']);
    mapViewBootstrap = jasmine.createSpyObj<MapViewBootstrapService>('MapViewBootstrapService', ['bootstrap']);

    await TestBed.configureTestingModule({
      declarations: [ArcgisMapComponent],
      providers: [
        { provide: MapCompositionLoaderService, useValue: mapCompositionLoader },
        { provide: MapViewBootstrapService, useValue: mapViewBootstrap }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ArcgisMapComponent);
  });

  it('delegates successful map bootstrap without showing an error panel', async () => {
    const composition: MapComposition = {
      basemap: 'arcgis-navigation',
      operationalLayers: []
    };
    const bootstrapHandle: MapViewBootstrapHandle = {
      view: {} as MapView,
      destroy: jasmine.createSpy('destroy')
    };

    mapCompositionLoader.loadComposition.and.returnValue(Promise.resolve(composition));
    mapViewBootstrap.bootstrap.and.returnValue(Promise.resolve(bootstrapHandle));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const bootstrapArgs = mapViewBootstrap.bootstrap.calls.mostRecent().args;

    expect(host.querySelector('.map-error')).toBeNull();
    expect(mapViewBootstrap.bootstrap).toHaveBeenCalledTimes(1);
    expect(bootstrapArgs[0]).toBeInstanceOf(HTMLDivElement);
    expect(bootstrapArgs[1]).toBeInstanceOf(HTMLDivElement);
    expect(bootstrapArgs[2]).toBe(composition);
  });

  it('shows a config error when composition loading fails', async () => {
    mapCompositionLoader.loadComposition.and.returnValue(Promise.reject(new Error('Expected an array at operationalLayers.')));
    spyOn(console, 'error');

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(mapViewBootstrap.bootstrap).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Map configuration could not be loaded');
    expect(host.textContent).toContain('Expected an array at operationalLayers.');
  });

  it('shows a generic initialization error when bootstrap fails', async () => {
    mapCompositionLoader.loadComposition.and.returnValue(Promise.resolve({
      basemap: 'arcgis-navigation',
      operationalLayers: []
    }));
    mapViewBootstrap.bootstrap.and.returnValue(Promise.reject(new Error('ArcGIS runtime unavailable.')));
    spyOn(console, 'error');

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Map could not be initialized');
    expect(host.textContent).toContain('ArcGIS runtime unavailable.');
  });

  it('destroys the bootstrap handle when the component is destroyed', async () => {
    const bootstrapHandle: MapViewBootstrapHandle = {
      view: {} as MapView,
      destroy: jasmine.createSpy('destroy')
    };

    mapCompositionLoader.loadComposition.and.returnValue(Promise.resolve({
      basemap: 'arcgis-navigation',
      operationalLayers: []
    }));
    mapViewBootstrap.bootstrap.and.returnValue(Promise.resolve(bootstrapHandle));

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.destroy();

    expect(bootstrapHandle.destroy).toHaveBeenCalledTimes(1);
  });
});
