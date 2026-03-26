import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import Graphic from '@arcgis/core/Graphic';
import Extent from '@arcgis/core/geometry/Extent';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Layer from '@arcgis/core/layers/Layer';
import type MapView from '@arcgis/core/views/MapView';
import { Subscription } from 'rxjs';

import {
  BasemapLayerRuntimeRecord,
  BasemapRuntimeState,
  LayerConfig,
  LayerFilterFieldConfig,
  LayerFilterOptionConfig,
  LayerRuntimeRecord,
  MapConfig
} from '../map/models/layer-config.model';
import { MapBasemapStatusService } from '../map/services/map-basemap-status.service';
import { MapCompositionLoaderService } from '../map/services/map-composition-loader.service';
import { MapLayerRegistryService } from '../map/services/map-layer-registry.service';
import { MapViewRuntimeHandle, MapViewRuntimeService } from '../map/services/map-view-runtime.service';
import {
  buildFeatureDetails,
  countActiveFilters,
  deserializeShareState,
  FeatureDetails,
  findLeafLayerConfig,
  flattenLeafLayers,
  MapFilterState,
  serializeShareState,
  ShareableMapState
} from '../map/utils/map-explorer.utils';

interface MapLoadError {
  title: string;
  message: string;
}

interface MapSummaryState {
  activeLayers: number;
  activeFilters: number;
  resultCount: number;
}

interface FilterFieldViewModel extends LayerFilterFieldConfig {
  options: LayerFilterOptionConfig[];
}

interface FilterPanelViewModel {
  id: string;
  title: string;
  fields: FilterFieldViewModel[];
}

interface SelectedFeatureState extends FeatureDetails {
  layerId: string;
  layerTitle: string;
}

type RemovableHandle = {
  remove(): void;
};

type FilterableGraphicsLayer = GraphicsLayer & {
  __sourceGraphics?: Graphic[];
};

@Component({
  selector: 'app-arcgis-map',
  templateUrl: './arcgis-map.component.html',
  styleUrls: ['./arcgis-map.component.css']
})
export class ArcgisMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapSurfaceNode', { static: true }) private mapSurfaceEl!: ElementRef<HTMLDivElement>;
  @ViewChild('mapViewNode', { static: true }) private mapViewEl!: ElementRef<HTMLDivElement>;

  basemapLayerRecords: BasemapLayerRuntimeRecord[] = [];
  basemapRuntimeState: BasemapRuntimeState = {
    fallbackBasemapActive: false
  };
  extentFilterEnabled = false;
  filterPanels: FilterPanelViewModel[] = [];
  filterState: MapFilterState = {};
  isInitializing = true;
  layerRecords: LayerRuntimeRecord[] = [];
  loadError: MapLoadError | null = null;
  selectedFeature: SelectedFeatureState | null = null;
  shareUrl = '';
  summary: MapSummaryState = {
    activeLayers: 0,
    activeFilters: 0,
    resultCount: 0
  };

  private currentConfig: MapConfig | null = null;
  private readonly filteredCounts = new Map<string, number>();
  private basemapRecordsSubscription: Subscription | null = null;
  private basemapStateSubscription: Subscription | null = null;
  private layerVisibilityHandles: RemovableHandle[] = [];
  private registrySubscription: Subscription | null = null;
  private restoredShareState: ShareableMapState | null = null;
  private runtimeHandle: MapViewRuntimeHandle | null = null;
  private viewHandles: RemovableHandle[] = [];

  constructor(
    private readonly basemapStatus: MapBasemapStatusService,
    private readonly mapCompositionLoader: MapCompositionLoaderService,
    private readonly mapViewRuntime: MapViewRuntimeService,
    private readonly layerRegistry: MapLayerRegistryService
  ) {}

  async ngAfterViewInit(): Promise<void> {
    this.restoredShareState = this.readShareState();
    this.registrySubscription = this.layerRegistry.records$.subscribe((records) => {
      this.layerRecords = records;
      this.attachLayerVisibilityHandles();
      this.rebuildFilterPanels();
      this.updateSummary();
    });
    this.basemapRecordsSubscription = this.basemapStatus.records$.subscribe((records) => {
      this.basemapLayerRecords = records;
    });
    this.basemapStateSubscription = this.basemapStatus.state$.subscribe((state) => {
      this.basemapRuntimeState = state;
    });

    try {
      const composition = await this.mapCompositionLoader.loadComposition();

      try {
        this.currentConfig = composition.config;
        this.filterState = this.buildInitialFilterState(composition.config, this.restoredShareState?.filters);
        this.extentFilterEnabled = this.restoredShareState?.extentFilterEnabled === true && this.hasExtentFilterSupport();
        this.rebuildFilterPanels();
        this.runtimeHandle = await this.mapViewRuntime.initialize(
          this.mapViewEl.nativeElement,
          this.mapSurfaceEl.nativeElement,
          composition
        );
        this.attachViewInteractions();
        this.restoreShareState();
        this.applyAllFilters(false);
        this.updateSummary();
        this.refreshShareUrl();
        this.loadError = null;
      } catch (error) {
        this.destroyRuntimeHandle();
        this.loadError = this.toRuntimeError(error);
        console.error('Map could not be initialized.', error);
      }
    } catch (error) {
      this.destroyRuntimeHandle();
      this.loadError = this.toConfigError(error);
      console.error('Map configuration could not be loaded.', error);
    } finally {
      this.isInitializing = false;
    }
  }

  ngOnDestroy(): void {
    this.basemapRecordsSubscription?.unsubscribe();
    this.basemapStateSubscription?.unsubscribe();
    this.registrySubscription?.unsubscribe();
    this.destroyViewHandles();
    this.destroyLayerVisibilityHandles();
    this.destroyRuntimeHandle();
  }

  get hasExtentFilterPanels(): boolean {
    return this.hasExtentFilterSupport();
  }

  get hasFilterPanels(): boolean {
    return this.filterPanels.length > 0;
  }

  get visibleLayerRecords(): LayerRuntimeRecord[] {
    return this.layerRecords.filter((record) => record.config.type !== 'group');
  }

  get hasLayerHealth(): boolean {
    return this.visibleLayerRecords.length > 0 || this.basemapLayerRecords.length > 0 || this.basemapRuntimeState.fallbackBasemapActive;
  }

  clearFilters(): void {
    if (!this.currentConfig) {
      return;
    }

    this.filterState = this.buildInitialFilterState(this.currentConfig);
    this.extentFilterEnabled = false;
    this.applyAllFilters();
  }

  async copyShareUrl(): Promise<void> {
    if (!this.shareUrl || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    await navigator.clipboard.writeText(this.shareUrl);
  }

  closeDetails(): void {
    this.selectedFeature = null;
  }

  layerStatusClass(record: LayerRuntimeRecord): string {
    if (record.status === 'failed') {
      return 'map-chip map-chip--failed';
    }

    if (record.status === 'loading') {
      return 'map-chip map-chip--loading';
    }

    if (record.status === 'loaded' && this.readLayerResultCount(record) === 0) {
      return 'map-chip map-chip--empty';
    }

    return 'map-chip map-chip--loaded';
  }

  layerStatusLabel(record: LayerRuntimeRecord): string {
    if (record.status === 'failed') {
      return 'Failed';
    }

    if (record.status === 'loading') {
      return 'Loading';
    }

    if (record.status === 'loaded' && this.readLayerResultCount(record) === 0) {
      return 'Empty';
    }

    return 'Loaded';
  }

  layerStatusNote(record: LayerRuntimeRecord): string | null {
    if (record.status === 'loaded' && record.loadedViaFallback) {
      return 'Backup source in use';
    }

    return null;
  }

  layerRecoveryNote(record: LayerRuntimeRecord): string | null {
    if (record.status === 'loaded' && record.loadedViaFallback) {
      return this.buildRecoveryNote(record.attemptErrors);
    }

    return null;
  }

  basemapStatusClass(record: BasemapLayerRuntimeRecord): string {
    if (record.status === 'failed') {
      return 'map-chip map-chip--failed';
    }

    if (record.status === 'loading') {
      return 'map-chip map-chip--loading';
    }

    return 'map-chip map-chip--loaded';
  }

  basemapStatusLabel(record: BasemapLayerRuntimeRecord): string {
    if (record.status === 'failed') {
      return 'Failed';
    }

    if (record.status === 'loading') {
      return 'Loading';
    }

    return 'Loaded';
  }

  basemapStatusTitle(record: BasemapLayerRuntimeRecord): string {
    return `${record.title} (${record.slot === 'base' ? 'Base layer' : 'Reference layer'})`;
  }

  basemapStatusNote(record: BasemapLayerRuntimeRecord): string | null {
    if (record.status === 'loaded' && record.loadedViaFallback) {
      return 'Backup source in use';
    }

    return null;
  }

  basemapRecoveryNote(record: BasemapLayerRuntimeRecord): string | null {
    if (record.status === 'loaded' && record.loadedViaFallback) {
      return this.buildRecoveryNote(record.attemptErrors);
    }

    return null;
  }

  onExtentFilterToggle(enabled: boolean): void {
    this.extentFilterEnabled = enabled;
    this.applyAllFilters();
  }

  onFilterValueChange(layerId: string, field: string, value: string): void {
    if (!this.filterState[layerId]) {
      this.filterState[layerId] = {};
    }

    this.filterState[layerId][field] = value;
    this.applyAllFilters();
  }

  readLayerResultCount(record: LayerRuntimeRecord): number | null {
    if (this.filteredCounts.has(record.id)) {
      return this.filteredCounts.get(record.id) ?? 0;
    }

    return typeof record.itemCount === 'number' ? record.itemCount : null;
  }

  resetLayerVisibility(): void {
    for (const record of this.visibleLayerRecords) {
      if (record.status === 'loaded' && record.layer) {
        record.layer.visible = record.config.visible ?? true;
      }
    }

    this.updateSummary();
    this.refreshShareUrl();
  }

  toggleLayerVisibility(record: LayerRuntimeRecord): void {
    if (record.status !== 'loaded' || !record.layer) {
      return;
    }

    record.layer.visible = !record.layer.visible;
    this.updateSummary();
    this.refreshShareUrl();
  }

  async zoomToLayer(record: LayerRuntimeRecord): Promise<void> {
    if (record.status !== 'loaded' || !record.layer || !this.runtimeHandle) {
      return;
    }

    const view = this.runtimeHandle.view as MapView & {
      goTo?(target: unknown): Promise<unknown>;
    };

    if (typeof view.goTo !== 'function') {
      return;
    }

    const target = this.readLayerZoomTarget(record.layer);

    if (!target) {
      return;
    }

    try {
      await view.goTo(target);
    } catch (error) {
      console.warn(`Layer "${record.id}" could not be zoomed to.`, error);
    }
  }

  private applyAllFilters(refreshShareState = true): void {
    this.filteredCounts.clear();

    for (const record of this.visibleLayerRecords) {
      if (record.status !== 'loaded' || !record.layer || record.config.type !== 'graphics' || !(record.layer instanceof GraphicsLayer)) {
        continue;
      }

      const sourceGraphics = this.readSourceGraphics(record.layer);
      const filteredGraphics = sourceGraphics.filter((graphic) => this.matchesLayerFilters(record.config, record.id, graphic));

      record.layer.removeAll();

      if (filteredGraphics.length > 0) {
        record.layer.addMany(filteredGraphics.map((graphic) => graphic.clone()));
      }

      this.filteredCounts.set(record.id, filteredGraphics.length);
    }

    this.updateSummary();

    if (refreshShareState) {
      this.refreshShareUrl();
    }
  }

  private attachLayerVisibilityHandles(): void {
    this.destroyLayerVisibilityHandles();

    for (const record of this.visibleLayerRecords) {
      if (record.status !== 'loaded' || !record.layer) {
        continue;
      }

      const layer = record.layer as Layer & {
        watch?(propertyName: 'visible', handler: () => void): RemovableHandle;
      };

      if (typeof layer.watch !== 'function') {
        continue;
      }

      this.layerVisibilityHandles.push(layer.watch('visible', () => {
        this.updateSummary();
        this.refreshShareUrl();
      }));
    }
  }

  private attachViewInteractions(): void {
    this.destroyViewHandles();

    const view = this.runtimeHandle?.view as MapView & {
      hitTest?(event: unknown): Promise<{ results: Array<{ graphic?: Graphic }> }>;
      on?(eventName: 'click', handler: (event: unknown) => void | Promise<void>): RemovableHandle;
      watch?(propertyName: 'stationary', handler: (value: boolean) => void): RemovableHandle;
    } | undefined;

    if (!view) {
      return;
    }

    if (typeof view.on === 'function') {
      this.viewHandles.push(view.on('click', async (event) => {
        await this.inspectFeatureAtEvent(event);
      }));
    }

    if (typeof view.watch === 'function') {
      this.viewHandles.push(view.watch('stationary', (stationary) => {
        if (!stationary) {
          return;
        }

        if (this.extentFilterEnabled) {
          this.applyAllFilters(false);
        }

        this.refreshShareUrl();
      }));
    }
  }

  private buildDerivedFilterOptions(layerId: string, field: string): LayerFilterOptionConfig[] {
    const record = this.visibleLayerRecords.find((candidate) => candidate.id === layerId);

    if (!record?.layer || !(record.layer instanceof GraphicsLayer)) {
      return [];
    }

    const uniqueValues = Array.from(
      new Set(
        this.readSourceGraphics(record.layer)
          .map((graphic) => graphic.attributes?.[field])
          .filter((value): value is string | number | boolean => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
          .map((value) => String(value))
      )
    );

    return uniqueValues.map((value) => ({
      label: value,
      value
    }));
  }

  private buildInitialFilterState(config: MapConfig, restored?: MapFilterState): MapFilterState {
    return flattenLeafLayers(config.operationalLayers)
      .filter((layer) => (layer.ui?.filterableFields?.length ?? 0) > 0)
      .reduce<MapFilterState>((filters, layer) => {
        filters[layer.id] = (layer.ui?.filterableFields ?? []).reduce<Record<string, string>>((fieldFilters, field) => {
          fieldFilters[field.field] = restored?.[layer.id]?.[field.field] ?? '';
          return fieldFilters;
        }, {});
        return filters;
      }, {});
  }

  private destroyLayerVisibilityHandles(): void {
    for (const handle of this.layerVisibilityHandles.splice(0)) {
      handle.remove();
    }
  }

  private destroyRuntimeHandle(): void {
    this.runtimeHandle?.destroy();
    this.runtimeHandle = null;
  }

  private destroyViewHandles(): void {
    for (const handle of this.viewHandles.splice(0)) {
      handle.remove();
    }
  }

  private async inspectFeatureAtEvent(event: unknown): Promise<void> {
    const view = this.runtimeHandle?.view as MapView & {
      hitTest?(viewEvent: unknown): Promise<{ results: Array<{ graphic?: Graphic }> }>;
    } | undefined;

    if (!view || typeof view.hitTest !== 'function' || !this.currentConfig) {
      return;
    }

    const hit = await view.hitTest(event);
    const match = hit.results.find((result) => {
      const layerId = result.graphic?.layer?.id;
      return typeof layerId === 'string' && !!findLeafLayerConfig(this.currentConfig!.operationalLayers, layerId);
    });

    if (!match?.graphic) {
      this.selectedFeature = null;
      return;
    }

    const layerId = match.graphic.layer?.id;
    const config = layerId ? findLeafLayerConfig(this.currentConfig.operationalLayers, layerId) : undefined;

    if (!config) {
      this.selectedFeature = null;
      return;
    }

    const details = buildFeatureDetails(config, match.graphic.attributes as Record<string, unknown> | undefined);

    this.selectedFeature = {
      layerId: config.id,
      layerTitle: config.title,
      ...details
    };
  }

  private hasExtentFilterSupport(): boolean {
    if (!this.currentConfig) {
      return false;
    }

    return flattenLeafLayers(this.currentConfig.operationalLayers).some((layer) => layer.ui?.enableExtentFilter !== false);
  }

  private matchesLayerFilters(config: LayerConfig, layerId: string, graphic: Graphic): boolean {
    const layerFilters = this.filterState[layerId] ?? {};

    for (const [field, value] of Object.entries(layerFilters)) {
      if (!value.trim()) {
        continue;
      }

      const attributeValue = graphic.attributes?.[field];

      if (typeof attributeValue === 'boolean' || typeof attributeValue === 'number') {
        if (String(attributeValue) !== value) {
          return false;
        }

        continue;
      }

      if (String(attributeValue ?? '').toLowerCase().includes(value.trim().toLowerCase())) {
        continue;
      }

      return false;
    }

    if (!this.extentFilterEnabled || config.type === 'group' || config.ui?.enableExtentFilter === false) {
      return true;
    }

    const viewExtent = this.runtimeHandle?.view?.extent;

    if (!viewExtent || !graphic.geometry) {
      return true;
    }

    return viewExtent.intersects(graphic.geometry);
  }

  private readErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallbackMessage;
  }

  private buildRecoveryNote(attemptErrors?: string[]): string | null {
    const failedAttempts = attemptErrors?.length ?? 0;

    if (failedAttempts === 0) {
      return null;
    }

    return `Recovered after ${failedAttempts} failed attempt${failedAttempts === 1 ? '' : 's'}`;
  }

  private readLayerZoomTarget(layer: Layer): unknown {
    if (layer instanceof GraphicsLayer && layer.graphics.length > 0) {
      return layer.graphics.toArray();
    }

    const fullExtent = (layer as Layer & { fullExtent?: unknown }).fullExtent;

    return fullExtent ?? layer;
  }

  private readShareState(): ShareableMapState | null {
    return typeof window === 'undefined' ? null : deserializeShareState(window.location.hash);
  }

  private readSourceGraphics(layer: GraphicsLayer): Graphic[] {
    const filterableLayer = layer as FilterableGraphicsLayer;

    if (!filterableLayer.__sourceGraphics) {
      filterableLayer.__sourceGraphics = layer.graphics.toArray().map((graphic) => graphic.clone());
    }

    return filterableLayer.__sourceGraphics;
  }

  private rebuildFilterPanels(): void {
    if (!this.currentConfig) {
      this.filterPanels = [];
      return;
    }

    this.filterPanels = flattenLeafLayers(this.currentConfig.operationalLayers)
      .filter((layer) => (layer.ui?.filterableFields?.length ?? 0) > 0)
      .map((layer) => ({
        id: layer.id,
        title: layer.ui?.legendTitle ?? layer.title,
        fields: (layer.ui?.filterableFields ?? []).map((field) => ({
          ...field,
          type: field.type ?? (field.options && field.options.length > 0 ? 'select' : 'text'),
          options: field.options ?? this.buildDerivedFilterOptions(layer.id, field.field)
        }))
      }));
  }

  private refreshShareUrl(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const hash = serializeShareState({
      extent: this.runtimeHandle?.view?.extent?.toJSON() as Record<string, unknown> | undefined,
      visibleLayerIds: this.layerRecords
        .filter((record) => record.status === 'loaded' && record.layer?.visible)
        .map((record) => record.id),
      filters: this.filterState,
      extentFilterEnabled: this.extentFilterEnabled
    });

    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    this.shareUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
  }

  private restoreShareState(): void {
    if (!this.restoredShareState) {
      return;
    }

    if (this.restoredShareState.visibleLayerIds.length > 0) {
      const visibleIds = new Set(this.restoredShareState.visibleLayerIds);

      for (const record of this.layerRecords) {
        if (record.status === 'loaded' && record.layer) {
          record.layer.visible = visibleIds.has(record.id);
        }
      }
    }

    const extentJson = this.restoredShareState.extent;
    const view = this.runtimeHandle?.view as MapView & {
      goTo?(target: unknown): Promise<unknown>;
    } | undefined;

    if (extentJson && view && typeof view.goTo === 'function') {
      void view.goTo(Extent.fromJSON(extentJson as __esri.ExtentProperties)).catch(() => undefined);
    }
  }

  private toConfigError(error: unknown): MapLoadError {
    return {
      title: 'Map configuration could not be loaded',
      message: this.readErrorMessage(error, 'Check /assets/config/map-config.json and reload the app.')
    };
  }

  private toRuntimeError(error: unknown): MapLoadError {
    return {
      title: 'Map could not be initialized',
      message: this.readErrorMessage(error, 'Reload the app and try again.')
    };
  }

  private updateSummary(): void {
    const visibleLeafLayers = this.visibleLayerRecords.filter((record) => record.status === 'loaded' && record.layer?.visible);
    const resultCount = visibleLeafLayers.reduce((count, record) => {
      const layerCount = this.readLayerResultCount(record);
      return count + (layerCount ?? 0);
    }, 0);

    this.summary = {
      activeLayers: visibleLeafLayers.length,
      activeFilters: countActiveFilters(this.filterState, this.extentFilterEnabled),
      resultCount
    };
  }
}
