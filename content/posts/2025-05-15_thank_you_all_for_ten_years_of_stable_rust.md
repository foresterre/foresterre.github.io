+++
title = "Thank you all for 10 years of (stable) Rust"
date = 2025-05-15

[taxonomies]
tags = ["rust", "rust-10-years", "rustweek25", "🦀"]
+++

Today marks the 10th anniversary of [Rust 1.0](https://blog.rust-lang.org/2015/05/15/Rust-1.0/). [Rust 1.87](https://internals.rust-lang.org/t/rust-1-87-0-pre-release-testing/22896) will be released live on stage at the [10 years of Rust celebration](https://rustweek.org/celebration/) this afternoon (hosted by RustWeek, there are still tickets I heard). I've been a user of Rust for about that long\*. Over these past 10 years, Rust had a major positive impact on my life in various ways, and I'm extremely grateful for that. **Thanks to all Rust contributors and to our community, it has been a blast 🎉**.

A anniversary is usually a good moment to look forward, but it also marks a good moment to take a step back, and reflect a bit on the past. Yesterday I scrolled back through the [release notes](https://github.com/rust-lang/rust/blob/master/RELEASES.md) for a bit, and reflected on some improvements which I've been taking more and more for granted.

The one which pops out of that list the most (for me) is probably the `?` operator. It was stabilized in [Rust 1.13.0](https://blog.rust-lang.org/2016/11/10/Rust-1.13/), but prototyped via the `try!` macro some time before that. I can truthfully say that every time I write in another language, I miss that `?` and the associated [`Try`](https://doc.rust-lang.org/std/ops/trait.Try.html) trait (I kind of wish the trait was marked stable 😅).

The other big ones which made Rust less cumbersome to write were of course [non lexical lifetimes](https://blog.rust-lang.org/2018/12/06/Rust-1.31-and-rust-2018/#non-lexical-lifetimes), lifetime elision improvements, the deref improvements (no more `&***`) and a boat load of library improvements. <sup>And then there is of course the documentation. And the tools. And the always helpful community. And the transparent in the open development. And so much more.</sup>

The time where a large portion of the community was on nightly by default is now far in the past. With the vision doc for Rust taking shape, and likely hundreds of other [improvements](https://rust-lang.github.io/rust-project-goals/2025h1/index.html), I can't wait for the next 10 years of stable Rust.

_\* I couldn't tell you exactly when I started using Rust, but I recall vividly some of the pre-1.0 releases and their breaking changes, so I guess somewhere around 2014? It doesn't really matter 🙃. Rust rocks 🦀!_