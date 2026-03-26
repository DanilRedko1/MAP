# Angular 13 ArcGIS 4.23 Starter

This project is an Angular 13 application that embeds an ArcGIS JavaScript 4.23 map using the `@arcgis/core` package. The map is configuration-driven: basemap and operational layers are loaded from a JSON asset and then composed through the services under `src/app/map/`.

## Features

- Angular 13 application structure
- ArcGIS 4.23 `MapView`
- Search widget
- Scale bar
- Config-driven basemap and operational layer loading
- Graphics layer with sample locations and popups

## Prerequisites

Install a Node.js version compatible with Angular 13, then run:

```bash
npm install
npm start
```

The app will be served at `http://localhost:4200/`.
The `start` script uses polling so edits to `src/assets/config/map-config.json` trigger a dev-server reload more reliably.

## Layer Config JSON

The map composition lives in `src/assets/config/map-config.json`.

- Use `type` to describe the layer implementation, for example `group`, `graphics`, `feature`, `map-image`, `tile`, or `vector-tile`.
- Use `layers` for nested group-layer contents.
- `basemap` and `operationalLayers` come from the JSON file.
- `fallbackBasemap` is still code-owned and is injected by `MapConfigService` when the JSON omits it.
- While `npm start` is running, saving this JSON file should trigger an automatic browser reload.

Example:

```json
{
  "basemap": {
    "mode": "well-known",
    "id": "arcgis-navigation"
  },
  "operationalLayers": [
    {
      "id": "demo-operational-layers",
      "title": "Demo Operational Layers",
      "type": "group",
      "layers": [
        {
          "id": "sample-locations",
          "title": "Sample Locations",
          "type": "graphics"
        }
      ]
    }
  ]
}
```
