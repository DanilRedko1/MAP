import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
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

import { MapCompositionLoaderService } from '../map/services/map-composition-loader.service';

@Component({
  selector: 'app-arcgis-map',
  templateUrl: './arcgis-map.component.html',
  styleUrls: ['./arcgis-map.component.css']
})
export class ArcgisMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapSurfaceNode', { static: true }) private mapSurfaceEl!: ElementRef<HTMLDivElement>;
  @ViewChild('mapViewNode', { static: true }) private mapViewEl!: ElementRef<HTMLDivElement>;

  private view: MapView | null = null;
  private homeWidget: Home | null = null;
  private fullscreenWidget: Fullscreen | null = null;
  private layerListWidget: LayerList | null = null;
  private layerListExpand: Expand | null = null;

  constructor(private readonly mapCompositionLoader: MapCompositionLoaderService) {}

  async ngAfterViewInit(): Promise<void> {
    esriConfig.assetsPath = 'assets';

    const composition = await this.mapCompositionLoader.loadComposition();
    const map = new Map();

    map.basemap = this.toBasemap(composition.basemap);

    if (composition.operationalLayers.length > 0) {
      map.addMany(composition.operationalLayers);
    }

    this.view = new MapView({
      container: this.mapViewEl.nativeElement,
      map,
      center: [-98.5795, 39.8283],
      zoom: 4
    });

    const search = new Search({
      view: this.view
    });

    const scaleBar = new ScaleBar({
      view: this.view,
      unit: 'dual'
    });

    this.homeWidget = new Home({
      view: this.view
    });

    this.fullscreenWidget = new Fullscreen({
      view: this.view,
      element: this.mapSurfaceEl.nativeElement
    });

    const layerListContainer = document.createElement('div');
    layerListContainer.className = 'layer-tree-panel';

    this.layerListWidget = new LayerList({
      view: this.view,
      container: layerListContainer,
      listItemCreatedFunction: (event) => {
        event.item.open = true;
      }
    });

    this.layerListExpand = new Expand({
      view: this.view,
      content: layerListContainer,
      expandIconClass: 'esri-icon-layer-list',
      collapseIconClass: 'esri-icon-close',
      expandTooltip: 'Layer tree',
      collapseTooltip: 'Close layer tree',
      mode: 'floating'
    });

    this.view.ui.add(this.homeWidget, 'top-left');
    this.view.ui.add(this.fullscreenWidget, 'top-left');
    this.view.ui.add(this.layerListExpand, 'top-left');
    this.view.ui.add(search, 'top-right');
    this.view.ui.add(scaleBar, 'bottom-left');

    await this.view.when();
  }

  ngOnDestroy(): void {
    this.layerListExpand?.destroy();
    this.layerListExpand = null;
    this.layerListWidget?.destroy();
    this.layerListWidget = null;
    this.fullscreenWidget?.destroy();
    this.fullscreenWidget = null;
    this.homeWidget?.destroy();
    this.homeWidget = null;

    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }

  private toBasemap(basemap: string | Basemap): Basemap {
    return typeof basemap === 'string' ? Basemap.fromId(basemap) : basemap;
  }
}