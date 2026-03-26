import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

import { MapCompositionLoaderService } from '../map/services/map-composition-loader.service';
import { MapViewBootstrapHandle, MapViewBootstrapService } from '../map/services/map-view-bootstrap.service';

interface MapLoadError {
  title: string;
  message: string;
}

@Component({
  selector: 'app-arcgis-map',
  templateUrl: './arcgis-map.component.html',
  styleUrls: ['./arcgis-map.component.css']
})
export class ArcgisMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapSurfaceNode', { static: true }) private mapSurfaceEl!: ElementRef<HTMLDivElement>;
  @ViewChild('mapViewNode', { static: true }) private mapViewEl!: ElementRef<HTMLDivElement>;

  loadError: MapLoadError | null = null;

  private bootstrapHandle: MapViewBootstrapHandle | null = null;

  constructor(
    private readonly mapCompositionLoader: MapCompositionLoaderService,
    private readonly mapViewBootstrap: MapViewBootstrapService
  ) {}

  async ngAfterViewInit(): Promise<void> {
    try {
      const composition = await this.mapCompositionLoader.loadComposition();

      try {
        this.bootstrapHandle = await this.mapViewBootstrap.bootstrap(
          this.mapViewEl.nativeElement,
          this.mapSurfaceEl.nativeElement,
          composition
        );
        this.loadError = null;
      } catch (error) {
        this.destroyBootstrapHandle();
        this.loadError = this.toBootstrapError(error);
        console.error('Map could not be initialized.', error);
      }
    } catch (error) {
      this.destroyBootstrapHandle();
      this.loadError = this.toConfigError(error);
      console.error('Map configuration could not be loaded.', error);
    }
  }

  ngOnDestroy(): void {
    this.destroyBootstrapHandle();
  }

  private destroyBootstrapHandle(): void {
    this.bootstrapHandle?.destroy();
    this.bootstrapHandle = null;
  }

  private toConfigError(error: unknown): MapLoadError {
    return {
      title: 'Map configuration could not be loaded',
      message: this.readErrorMessage(error, 'Check /assets/config/map-config.json and reload the app.')
    };
  }

  private toBootstrapError(error: unknown): MapLoadError {
    return {
      title: 'Map could not be initialized',
      message: this.readErrorMessage(error, 'Reload the app and try again.')
    };
  }

  private readErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallbackMessage;
  }
}
