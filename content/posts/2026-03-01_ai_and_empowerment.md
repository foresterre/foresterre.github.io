+++
title = "Notes on AI and empowerment"
date = 2026-03-01

[taxonomies]
tags = ["ai", "llm"]
+++

Today, I came across the following post [Rust Project Perspectives on use of AI](https://github.com/nikomatsakis/rust-project-perspectives-on-ai/blob/f4ee1bef35c32d3f8691761054d0e15b925a6fe3/src/all-comments.md#nikomatsakis). I realize there are more opinions in this post, but I will only focus on Niko's opinion as it made me think about the different sides of empowerment. <sup>NB: I do not intend to pick on Niko's opinion here; there's no ill intent behind this reply. Consider it a post-dinner thought if you will.</sup>

In particular, Niko mentions:

> "If I had to pick one word for how I feel about using AI, it is empowered".

And goes on to state: 

> "Suddenly it feels like I can take on just about any problem -- it's not that the AI will do the work for me. It's that the AI will help me work through it and also tackle some of the drudgery. And certainly there are some areas (github actions, HTML/CSS) that would just stop me cold before, but which now are no issue -- I can build out those things and brings things to life."

And to highlight one more part (you can read the full opinion in the link above):

> "This is not to say AI doesn't have problems. It has huge ones, power usage chief among them, but also the way irresponsible usage is creating slop PRs (not to mention the way it's being inserted in places it doesn't belong, and the ways it will be abused by governments)."

The first thing I thought was; arguably especially with all the agentic programming going on, "it's not that the AI will do the work for me" sounds very much like the AI doing _the_ work, or at least, some of _the_ work. Is that good or bad? Hard to judge.

But this is a point which made me think, namely about _senders_ and _receivers_<sup>1</sup>. That is, _senders_ are the people writing the code and making PR's. The _receivers_ are the people reviewing the code. So far, I feel that AI could be empowering primarily for _senders_, but is relatively more likely to be disempowering for the _receivers_ (not for all of course).

Over the last few months I've been less active in open source because emotionally, programming no longer seemed to have much value. Being on the receiving end of AI slop made reviewing code a slog. For much code written by LLM's, it's time consuming to decide whether it is slop or genuine, because LLM's make it hard to see the difference without thorough reviews. It feels, I the reviewer am often the first to go thoroughly through the commits, while I would pose, you should always review your own code before asking for the opinion of a maintainer.

Emotionally, PR's made (largely) by AI feel different. Open source is not just about the product, but also about people. As a maintainer, I always try to make people feel welcome; them spending the time to contribute to a foreign code base, and helping them find their way, brought me a kind of joy. With the advent of LLM's this joy has been diminishing. I no longer know if I'm helping a human, or a computer. Being the _receiver_ feels tiresome; disempowering.

For the past few years, we've also rightfully seen many discussions about the mental health of Rust (and community) maintainers. It makes me wonder what the impact of LLM's have been on the mental health of Rust maintainers, the last few years.

As it often feels like there are two vocal camps in the online circles, one pro and one con, with little room for sincere discussion, I welcome [the discussion](https://nikomatsakis.github.io/rust-project-perspectives-on-ai/), and will be reading the other opinions too, for new insights.

<sup>1</sup> No, not [these](https://doc.rust-lang.org/std/sync/mpmc/index.html) senders and receivers. 