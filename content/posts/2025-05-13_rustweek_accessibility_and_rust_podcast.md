+++
title = "Accessibility and Rust podcast at RustWeek"
date = 2025-05-13

[taxonomies]
tags = ["accessibility", "accesskit", "rust", "rustweek25"]
+++

Just hours ago, the first full conference day of [RustWeek 2025](https://rustweek.org/) ended. Everything went smoothly, so big props to the organisers, volunteers\*, the audio and video crew, and staff at the venue. Also shoutout to the people who designed and organized the stickers, they're really really great, and also to the excellent barista coffee ☕.

![A small sample of stickers at RustWeek](/img/stickers_rustweek.jpg)

The day ended for me by attending the live recording of the [Rust in Production](https://corrode.dev/podcast) podcast in which Matthias Endler interviewed Niko Matsakis about his experiences of building Rust over the past 10 years, and by attending the live recording of another podcast titled 'Accessibility and Rust' (which if I recall correctly will be published on the [Rustacean Station](https://rustacean-station.org)). In this podcast [Luuk van der Duim](https://github.com/luukvanderduim) was joined by [Matt Campbell](https://github.com/mwcampbell) and [Arnold Loubriat](https://github.com/DataTriny) to talk about their experience of working on libraries and tooling to make graphical user interfaces (GUI's) more accessible. Both sessions were excellent. I wanted to take a moment to say a few words about the second one, which really spoke to me.

During the podcast Matt and Arnold give some insight into how they "see" graphical computer programs, and also how they often can't because of shortcomings or lack of accessibility in programs. From a software engineering point of view, I have a feeling, we often shove accessibility features under the rug because of a perceived lack of business need, cost or complexity, so I'm happy there are people working on lowering the barrier.

This talk also addressed another possible reason (amplified by the audience after the recording session), that for many developers who don't use assistive technologies like screenreaders, it's opaque how to build software that is accessible. On top of that, there is also the question of how to test whether you did it right, given you're not a regular user of assistive technologies.

[AccessKit](https://github.com/AccessKit/accesskit) tries to help solve the first question, and has amongst others, been used to improve accessibility support for [Slint](https://github.com/slint-ui/slint/blob/9b176ffb17fcdd33b2e16c70f07d7083228bdab2/internal/backends/winit/accesskit.rs#L97), a GUI toolkit\*\*.

For the second question, I hope people will support their work and perhaps provide funding to them (or others) to develop a general test suite or framework which can be used by implementers of accessibility libraries\*\*\*. In the mean time, I found that there is an [introduction](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility) on the topic over at MDN, which has a particular focus on accessibility for webpages, but also includes a more general introduction.

Matt will give a talk about [AccessKit](AccessKit) tomorrow at [10:25](https://time.is/compare/1025_14_May_2025_in_Utrecht) local time (main track). RustWeek has a [livestream](https://rustweek.org/live/wednesday/) if you want to follow along online. Recordings of talks will be published online at a later moment.

_\* Disclaimer: I also volunteered, props go to the other volunteers 😉._ <br>
_\*\* I'm not involved with Slint in any way_ <br>
_\*\*\* I may be ignorant of the existence of such a test suite; sorry!_
