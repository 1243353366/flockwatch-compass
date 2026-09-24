# Satellite Imagery Layers

FlockWatch supports open-source satellite and aerial imagery for the full United States.

## Available Layers

### OpenStreetMap (OSM)
- **Type**: Vector base map
- **Source**: [OpenStreetMap](https://www.openstreetmap.org)
- **Coverage**: Global
- **License**: ODbL
- **Use**: `--imagery osm`

### Sentinel-2
- **Type**: True satellite imagery
- **Source**: Copernicus Programme (EU) / processed by Esri
- **Coverage**: Global, including full US
- **Resolution**: 10m per pixel
- **Update**: Every 5 days
- **License**: Copernicus open data
- **Use**: `--imagery sentinel2`

### Landsat 8/9
- **Type**: True satellite imagery
- **Source**: USGS / NASA
- **Coverage**: Global, including full US
- **Resolution**: 30m per pixel (panchromatic: 15m)
- **Update**: Every 16 days
- **License**: Public domain
- **Use**: `--imagery landsat`

### NAIP (National Agriculture Imagery Program)
- **Type**: Aerial photography (not satellite, but high resolution)
- **Source**: USDA / USGS
- **Coverage**: Full contiguous United States
- **Resolution**: 1m per pixel (some areas 60cm)
- **Update**: Every 3 years (varies by state)
- **License**: Public domain
- **Use**: `--imagery naip`

### USGS Topographic
- **Type**: Topographic map
- **Source**: USGS National Map
- **Coverage**: Full United States
- **Use**: `--imagery usgs_topo`

## Usage

```bash
# Use Sentinel-2 satellite imagery
flockwatch map --input scored.jsonl --output map.html --imagery sentinel2

# Use NAIP high-resolution aerial imagery
flockwatch map --input scored.jsonl --output map.html --imagery naip

# Use Landsat satellite imagery
flockwatch map --input scored.jsonl --output map.html --imagery landsat
```

All layers are toggleable in the generated map via the layer control panel.
