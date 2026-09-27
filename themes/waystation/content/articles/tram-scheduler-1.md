+++
title = "A tiny tram scheduler, part 1: modelling stops"
date = 2026-03-21
description = "Newtypes for stop identifiers, and why a stop is not a station."

[taxonomies]
tags = ["rust"]
series = ["A tiny tram scheduler"]

[extra]
lobsters = "abc123"
+++

This series builds a small scheduler for an imaginary cable tram. The first step is to decide what a stop is.

## A stop is not a station

A station is a building. A stop is a place where a tram opens its doors. One station can have several stops.

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
struct StopId(u32);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
struct StationId(u32);
```

Two newtypes cost nothing at runtime, and the compiler now refuses to mix them up.
