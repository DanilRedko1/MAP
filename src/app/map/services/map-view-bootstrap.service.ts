import { Injectable } from '@angular/core';
import Basemap from '@arcgis/core/Basemap';
import esriConfig from '@arcgis/core/config';
import Map from '@arcgis/core/Map';
import Expand from '@arcgis/core/widgets/Expand';
import Fullscreen from '@arcgis/core/widgets/Fullscreen';
import Home from '@arcgis/core/widgets/Home';
import LayerList from '@arcgis/core/widgets/LayerList';
import Search from '@arcgis/core/widgets/Search';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import MapView from '@arcgis/core/views/MapView';

import { MapComposition } from '../models/layer-config.model';

export interface MapViewBootstrapHandle {
  view: MapView;
  destroy(): void;
}

type Destroyable = {
  destroy(): void;
};

@Injectable({
  providedIn: 'root'
})
export class MapViewBootstrapService {
  async bootstrap(
    viewContainer: HTMLDivElement,
    surfaceElement: HTMLDivElement,
    composition: MapComposition
  ): Promise<MapViewBootstrapHandle> {
    esriConfig.assetsPath = 'assets';

    const destroyables: Destroyable[] = [];

    try {
      const map = new Map();

      map.basemap = this.toBasemap(composition.basemap);

      if (composition.operationalLayers.length > 0) {
        map.addMany(composition.operationalLayers);
      }

      const view = new MapView({
        container: viewContainer,
        map,
        center: [-98.5795, 39.8283],
        zoom: 4
      });

      const search = new Search({
        view
      });
      const scaleBar = new ScaleBar({
        view,
        unit: 'dual'
      });
      const homeWidget = new Home({
        view
      });
      const fullscreenWidget = new Fullscreen({
        view,
        element: surfaceElement
      });
      const layerListContainer = document.createElement('div');

      layerListContainer.className = 'layer-tree-panel';

      const layerListWidget = new LayerList({
        view,
        container: layerListContainer,
        listItemCreatedFunction: (event) => {
          event.item.open = true;
        }
      });
      const layerListExpand = new Expand({
        view,
        content: layerListContainer,
        expandIconClass: 'esri-icon-layer-list',
        collapseIconClass: 'esri-icon-close',
        expandTooltip: 'Layer tree',
        collapseTooltip: 'Close layer tree',
        mode: 'floating'
      });

      destroyables.push(search, scaleBar, homeWidget, fullscreenWidget, layerListWidget, layerListExpand, view);

      view.ui.add(homeWidget, 'top-left');
      view.ui.add(fullscreenWidget, 'top-left');
      view.ui.add(layerListExpand, 'top-left');
      view.ui.add(search, 'top-right');
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

  private destroyAll(destroyables: Destroyable[]): void {
    for (const destroyable of [...destroyables].reverse()) {
      destroyable.destroy();
    }
  }

  private toBasemap(basemap: string | Basemap): Basemap {
    return typeof basemap === 'string' ? Basemap.fromId(basemap) : basemap;
  }
}
