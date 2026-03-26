import { Injectable } from '@angular/core';
import Basemap from '@arcgis/core/Basemap';
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import Expand from '@arcgis/core/widgets/Expand';
import Fullscreen from '@arcgis/core/widgets/Fullscreen';
import Home from '@arcgis/core/widgets/Home';
import LayerList from '@arcgis/core/widgets/LayerList';
import Legend from '@arcgis/core/widgets/Legend';
import Search from '@arcgis/core/widgets/Search';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import MapView from '@arcgis/core/views/MapView';

import { MapComposition } from '../models/layer-config.model';

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];
const DEFAULT_ZOOM = 4;

type Destroyable = {
  destroy(): void;
};

export interface MapViewRuntimeHandle {
  view: MapView;
  destroy(): void;
}

@Injectable({
  providedIn: 'root'
})
export class MapViewRuntimeService {
  async initialize(
    viewContainer: HTMLDivElement,
    surfaceElement: HTMLDivElement,
    composition: MapComposition
  ): Promise<MapViewRuntimeHandle> {
    esriConfig.assetsPath = 'assets';

    const destroyables: Destroyable[] = [];

    try {
      const map = this.createMap();

      map.basemap = this.toBasemap(composition.basemap);

      if (composition.operationalLayers.length > 0) {
        map.addMany(composition.operationalLayers);
      }

      const homeTarget: __esri.GoToTarget2D = {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM
      };
      const view = this.createView(viewContainer, map, homeTarget);
      const home = this.createHome(view);
      const scaleBar = this.createScaleBar(view);
      const layerList = this.createLayerList(view);
      const layerTreePanel = this.createPanel(viewContainer.ownerDocument, 'layer-tree-panel');
      layerList.container = layerTreePanel;
      const layerListExpand = this.createLayerListExpand(view, layerTreePanel);
      const legend = this.createLegend(view);
      const legendPanel = this.createPanel(viewContainer.ownerDocument, 'legend-panel');
      legend.container = legendPanel;
      const legendExpand = this.createLegendExpand(view, legendPanel);
      const searchWidget = this.createSearch(view);
      const fullscreen = this.createFullscreen(view, surfaceElement);

      destroyables.push(fullscreen, searchWidget, layerListExpand, layerList, legendExpand, legend, home, scaleBar, view);

      view.ui.add(home, 'top-left');
      view.ui.add(searchWidget, 'top-right');
      view.ui.add(fullscreen, 'top-right');
      view.ui.add(layerListExpand, 'top-right');
      view.ui.add(legendExpand, 'top-right');
      view.ui.add(scaleBar, 'bottom-left');

      await view.when();

      let destroyed = false;

      return {
        view,
        destroy: () => {
          if (destroyed) {
            return;
          }

          destroyed = true;
          this.destroyAll(destroyables);
        }
      };
    } catch (error) {
      this.destroyAll(destroyables);
      throw error;
    }
  }

  protected createFullscreen(view: MapView, surfaceElement: HTMLElement): Fullscreen {
    return new Fullscreen({
      view,
      element: surfaceElement
    });
  }

  protected createHome(view: MapView): Home {
    return new Home({
      view
    });
  }

  protected createLayerList(view: MapView): LayerList {
    return new LayerList({
      view,
      listItemCreatedFunction: (event) => {
        event.item.open = true;
      }
    });
  }

  protected createLegend(view: MapView): Legend {
    return new Legend({
      view
    });
  }

  protected createLayerListExpand(view: MapView, content: HTMLElement): Expand {
    return new Expand({
      view,
      content,
      expandTooltip: 'Layer tree',
      expandIconClass: 'esri-icon-layers'
    });
  }

  protected createLegendExpand(view: MapView, content: HTMLElement): Expand {
    return new Expand({
      view,
      content,
      expandTooltip: 'Legend',
      expandIconClass: 'esri-icon-legend'
    });
  }

  protected createMap(): Map {
    return new Map();
  }

  protected createScaleBar(view: MapView): ScaleBar {
    return new ScaleBar({
      view,
      unit: 'dual'
    });
  }

  protected createSearch(view: MapView): Search {
    return new Search({
      view
    });
  }

  protected createView(
    viewContainer: HTMLDivElement,
    map: Map,
    homeTarget: __esri.GoToTarget2D
  ): MapView {
    return new MapView({
      container: viewContainer,
      map,
      center: homeTarget.center as [number, number],
      zoom: homeTarget.zoom as number
    });
  }

  protected createPanel(documentRef: Document, className: string): HTMLDivElement {
    const panel = documentRef.createElement('div');
    panel.className = className;
    return panel;
  }

  private destroyAll(destroyables: Destroyable[]): void {
    for (const destroyable of [...destroyables].reverse()) {
      destroyable.destroy();
    }
  }

  private toBasemap(basemap: string | Basemap): Basemap {
    return typeof basemap === 'string' ? Basemap.fromId(basemap) : basemap;
  }
}
