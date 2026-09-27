+++
title = "A tiny tram scheduler, part 3: timetables"
date = 2026-06-14
description = "Turning a track graph into a timetable that a person can read."

[taxonomies]
tags = ["rust", "scheduling"]
series = ["A tiny tram scheduler"]

[extra]
hackernews = "https://news.ycombinator.com/item?id=41000001"
+++

In the [previous part](@/articles/tram-scheduler-2.md) we built a graph of the track. Now the graph has to become a timetable.

## One departure at a time

A timetable is a list of departures, sorted by time. Each departure knows its stop and the tram that serves it.

```rust
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct Departure {
    at: Minutes,
    stop: StopId,
    tram: TramId,
}

fn timetable(runs: &[Run]) -> Vec<Departure> {
    let mut out: Vec<Departure> = runs.iter().flat_map(Run::departures).collect();
    out.sort();
    out
}
```

Deriving `Ord` on the struct gives us sorting by time first, because `at` is the first field. It is a small trick, but it keeps the code honest: the order of the fields is now part of the meaning.

## Printing it

The printed table is what people actually use. The code for it is boring on purpose.
