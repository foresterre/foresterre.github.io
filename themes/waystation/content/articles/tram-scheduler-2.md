+++
title = "A tiny tram scheduler, part 2: the track graph"
date = 2026-05-02
description = "Stops are nodes, track is edges, and a tram is a walk through the graph."

[taxonomies]
tags = ["rust", "graphs"]
series = ["A tiny tram scheduler"]
+++

With the stops from [part one](@/articles/tram-scheduler-1.md) in place, we connect them with track.

## Edges with a travel time

Each edge carries the minutes a tram needs between two stops. A line is then a walk through the graph.

```rust
struct Track {
    from: StopId,
    to: StopId,
    minutes: u16,
}
```

A cable tram only runs back and forth on one piece of track, so its graph is a single path. That makes it the easiest case, and a good first test.
