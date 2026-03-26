import type Basemap from '@arcgis/core/Basemap';
import type Map from '@arcgis/core/Map';
import type MapView from '@arcgis/core/views/MapView';
import type Expand from '@arcgis/core/widgets/Expand';
import type Fullscreen from '@arcgis/core/widgets/Fullscreen';
import type Home from '@arcgis/core/widgets/Home';
import type LayerList from '@arcgis/core/widgets/LayerList';
import type Legend from '@arcgis/core/widgets/Legend';
import type Search from '@arcgis/core/widgets/Search';
import type ScaleBar from '@arcgis/core/widgets/ScaleBar';

import { MapComposition } from '../models/layer-config.model';
import { MapViewRuntimeService } from './map-view-runtime.service';

describe('MapViewRuntimeService', () => {
  it('initializes the runtime with ArcGIS controls on the map', async () => {
    const service = new TestMapViewRuntimeService();
    const viewContainer = document.createElement('div');
    const surfaceElement = document.createElement('div');
    const basemap = {} as Basemap;
    const composition: MapComposition = {
      basemap,
      operationalLayers: [{} as __esri.Layer],
      config: {
        basemap: {
          mode: 'well-known',
          id: 'arcgis-navigation'
        },
        operationalLayers: []
      }
    };

    const handle = await service.initialize(viewContainer, surfaceElement, composition);

    expect(handle.view).toBe(service.fakeView as unknown as MapView);
    expect(service.fakeMap.basemap).toBe(basemap);
    expect(service.fakeMap.addMany).toHaveBeenCalledOnceWith(composition.operationalLayers);
    expect(service.fakeView.ui.add.calls.allArgs()).toEqual([
      [service.fakeHome, 'top-left'],
      [service.fakeSearch, 'top-right'],
      [service.fakeFullscreen, 'top-right'],
      [service.fakeLayerListExpand, 'top-right'],
      [service.fakeLegendExpand, 'top-right'],
      [service.fakeScaleBar, 'bottom-left']
    ]);

    expect(service.fakeLayerList.container).toEqual(jasmine.any(HTMLDivElement));
    expect(service.fakeLayerList.container?.classList.contains('layer-tree-panel')).toBeTrue();
    expect(service.fakeLayerListExpand.content).toBe(service.fakeLayerList.container);
    expect(service.fakeLegend.container).toEqual(jasmine.any(HTMLDivElement));
    expect(service.fakeLegend.container?.classList.contains('legend-panel')).toBeTrue();
    expect(service.fakeLegendExpand.content).toBe(service.fakeLegend.container);
  });

  it('destroys all created ArcGIS widgets and the view when the runtime handle is destroyed', async () => {
    const service = new TestMapViewRuntimeService();
    const handle = await service.initialize(document.createElement('div'), document.createElement('div'), createComposition());

    handle.destroy();
    handle.destroy();

    expect(service.fakeFullscreen.destroy).toHaveBeenCalledTimes(1);
    expect(service.fakeSearch.destroy).toHaveBeenCalledTimes(1);
    expect(service.fakeLayerListExpand.destroy).toHaveBeenCalledTimes(1);
    expect(service.fakeLayerList.destroy).toHaveBeenCalledTimes(1);
    expect(service.fakeLegendExpand.destroy).toHaveBeenCalledTimes(1);
    expect(service.fakeLegend.destroy).toHaveBeenCalledTimes(1);
    expect(service.fakeHome.destroy).toHaveBeenCalledTimes(1);
    expect(service.fakeScaleBar.destroy).toHaveBeenCalledTimes(1);
    expect(service.fakeView.destroy).toHaveBeenCalledTimes(1);
  });
});

class TestMapViewRuntimeService extends MapViewRuntimeService {
  readonly fakeFullscreen = {
    destroy: jasmine.createSpy('destroy')
  };
  readonly fakeHome = {
    destroy: jasmine.createSpy('destroy')
  };
  readonly fakeLayerList = {
    container: null as HTMLElement | null,
    destroy: jasmine.createSpy('destroy')
  };
  readonly fakeLayerListExpand = {
    content: null as HTMLElement | null,
    destroy: jasmine.createSpy('destroy')
  };
  readonly fakeLegend = {
    container: null as HTMLElement | null,
    destroy: jasmine.createSpy('destroy')
  };
  readonly fakeLegendExpand = {
    content: null as HTMLElement | null,
    destroy: jasmine.createSpy('destroy')
  };
  readonly fakeMap = {
    basemap: undefined as unknown,
    addMany: jasmine.createSpy('addMany')
  };
  readonly fakeScaleBar = {
    destroy: jasmine.createSpy('destroy')
  };
  readonly fakeSearch = {
    destroy: jasmine.createSpy('destroy')
  };
  readonly fakeView = {
    destroy: jasmine.createSpy('destroy'),
    ui: {
      add: jasmine.createSpy('add')
    },
    when: jasmine.createSpy('when').and.returnValue(Promise.resolve(undefined))
  };

  protected override createFullscreen(_view: MapView, _surfaceElement: HTMLElement): Fullscreen {
    return this.fakeFullscreen as unknown as Fullscreen;
  }

  protected override createHome(_view: MapView): Home {
    return this.fakeHome as unknown as Home;
  }

  protected override createLayerList(_view: MapView): LayerList {
    return this.fakeLayerList as unknown as LayerList;
  }

  protected override createLayerListExpand(_view: MapView, content: HTMLElement): Expand {
    this.fakeLayerListExpand.content = content;
    return this.fakeLayerListExpand as unknown as Expand;
  }

  protected override createLegend(_view: MapView): Legend {
    return this.fakeLegend as unknown as Legend;
  }

  protected override createLegendExpand(_view: MapView, content: HTMLElement): Expand {
    this.fakeLegendExpand.content = content;
    return this.fakeLegendExpand as unknown as Expand;
  }

  protected override createMap(): Map {
    return this.fakeMap as unknown as Map;
  }

  protected override createScaleBar(_view: MapView): ScaleBar {
    return this.fakeScaleBar as unknown as ScaleBar;
  }

  protected override createSearch(_view: MapView): Search {
    return this.fakeSearch as unknown as Search;
  }

  protected override createView(
    _viewContainer: HTMLDivElement,
    _map: Map,
    _homeTarget: __esri.GoToTarget2D
  ): MapView {
    return this.fakeView as unknown as MapView;
  }
}

function createComposition(): MapComposition {
  return {
    basemap: {} as Basemap,
    operationalLayers: [{} as __esri.Layer],
    config: {
      basemap: {
        mode: 'well-known',
        id: 'arcgis-navigation'
      },
      operationalLayers: []
    }
  };
}
