+++
title = "Orphaned markdown [brackets]"
date = 2025-04-19

[taxonomies]
tags = ["keep-a-changelog", "markdown"]
+++

Every project needs a changelog. And let's be honest, the work [keep-a-changelog](https://keepachangelog.com/en/1.1.0/) did to make this a more common practice is awesome. But there is something many seem to forget: Did you ever notice [version numbers] in release titles within a `CHANGELOG.md`? These brackets were supposed to be [links](https://www.markdownguide.org/basic-syntax/#reference-style-links). But in reference style, you need to complete the reference elsewhere. Let's look at an example (also in the [wild](https://github.com/mullvad/mullvadvpn-app/blob/6d7b4ba7bdc497093dbd5861a8a6a4842574e6f7/CHANGELOG.md)):

```markdown
## [0.18.3] - 2025-04-19

- Lost: reference to the version number 0.18.3 somewhere
```

This snippet, produces the following output:

---

## [0.18.3] - 2025-04-19

- Lost: references to version numbers

---

However, if you scroll to the bottom of the keep-a-changelog [example](https://raw.githubusercontent.com/olivierlacan/keep-a-changelog/refs/heads/main/CHANGELOG.md), you can see that the version numbers in brackets, have their link completed at the bottom. And rendered, it looks like [this](https://github.com/olivierlacan/keep-a-changelog/blob/main/CHANGELOG.md).

So how do we fix our changelog? By adding reference style links:

```markdown
## [0.18.4] - 2025-04-19

- Found: references to version numbers

[0.18.4]: https://github.com/foresterre/cargo-msrv/compare/v0.18.3...v0.18.4
```

This produces the following output:

---

## [0.18.4] - 2025-04-19

- Found: references to version numbers

[0.18.4]: https://github.com/foresterre/cargo-msrv/compare/v0.18.3...v0.18.4

---

# Don't like linking to the diff?

Not a problem. Use an alternative like a [release](https://github.com/foresterre/cargo-msrv/releases/tag/v0.18.4) page or something else you like. Or just leave the brackets out:

---

## 0.18.5 - 2025-04-19

- Also good: This version number has no link

---


# Call to action

So next time you write a changelog, please keep these digital tumbleweeds out. Complete your links, fix your [brackets]!