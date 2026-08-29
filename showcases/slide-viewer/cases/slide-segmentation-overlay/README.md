# Source-aligned spatial annotation overlay

![Source-aligned annotation summary](previews/segmentation-overlay.svg)

## Scientific question

Can a spatially compatible annotation artifact be produced from exact H5AD coordinates while retaining source association and scientific meaning?

## Source observations

- The public H5AD contains 684 Visium observations registered through obsm/spatial to its H&amp;E image.
- Observation indices 0, 1, and 2 have exact coordinates (1575, 98), (2538, 1774), and (1850, 98).

## Computed results

outputs/source-aligned-annotations.geojson contains three 16-segment circular polygons with a 55-pixel radius around those coordinates. Dataset hash, matrix revision, coordinate frame, observation identifiers, and construction method are retained with the artifact.

## Interpretation

The artifact demonstrates reproducible source-associated overlay geometry. It is an annotation example derived from spot coordinates and does not represent cell segmentation, anatomical regions, or biological classifications.

## Limitations

The viewer remained pending and did not expose an annotation import action during this run, so the GeoJSON was inspected structurally but was not rendered over the tissue image.
