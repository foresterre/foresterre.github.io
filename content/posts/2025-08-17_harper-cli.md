+++
title = "Grammar checking from the CLI with Harper"
date = 2025-08-17

[taxonomies]
tags = ["harper", "spell-check"]
+++

A few months ago I learned of the existence of [Harper](https://writewithharper.com), which describes itself as a lightweight, offline, grammar checker. Both the website and GitHub [repository](https://github.com/automattic/harper) are a bit sparse on how to use it, but they do link to all sorts of [integrations](https://writewithharper.com/docs/integrations/language-server), which I think all use the Harper language server. There is also [harper.js](https://writewithharper.com/docs/harperjs/introduction), mostly for web applications and browser extensions.

While the language server (or `harper.js`) is great for extensive editor use, I sometimes just want to quickly check a file for spelling and grammatical issues. As it turns out, this is already possible by using the `harper-cli` tool. 

This CLI is not documented on the documentation website, probably, as I found out later, because it is still listed as an [experimental](https://github.com/Automattic/harper/tree/c37fa1a437279ed8449f75a80178c55f29e4df80/harper-cli) frontend. I'm glad it exists though; it saved me from even considering how to use the LSP from the command line directly, and from installing and using one of the integrations.

## Installing it

Installing it is easy! If you have [Rust](https://www.rust-lang.org/) and [Cargo](https://doc.rust-lang.org/cargo/) installed, you can install it from source by running `cargo install --locked --git https://github.com/Automattic/harper.git harper-cli`. 

On Windows I also found out you can install it using [scoop](https://scoop.sh/). I was delighted to see that `scoop install harper` didn't just install the language server binary, but also `harper-cli`.

## Using it

The current version (`0.1.0`), shows the following help page when running `harper-cli --help`:

```
A debugging tool for the Harper grammar checker

Usage: harper-cli.exe <COMMAND>

Commands:
  lint                   Lint a provided document
  parse                  Parse a provided document and print the detected symbols
  spans                  Parse a provided document and show the spans of the detected tokens
  annotate-tokens        Parse a provided document and annotate its tokens
  metadata               Get the metadata associated with a particular word
  forms                  Get all the forms of a word using the affixes
  words                  Emit a decompressed, line-separated list of the words in Harper's dictionary
  summarize-lint-record  Summarize a lint record
  config                 Print the default config with descriptions
  mine-words             Print a list of all the words in a document, sorted by frequency
  core-version           Print harper-core version
  rename-flag            Rename a flag in the dictionary and affixes
  compounds              Emit a decompressed, line-separated list of the compounds in Harper's dictionary. As long as there's either an open or hyphenated spelling
  case-variants          Emit a decompressed, line-separated list of the words in Harper's dictionary which occur in more than one lettercase variant
  nominal-phrases        Provided a sentence or phrase, emit a list of each noun phrase contained within
  help                   Print this message or the help of the given subcommand(s)

Options:
  -h, --help     Print help
  -V, --version  Print version
```

For my use case, the most simple command sufficed: 

```
$ harper-cli lint .\content\posts\2025-05-15_thank_you_all_for_ten_years_of_stable_rust.md
```

That gave me the following result:

![Result of harper-cli output showing some grammatical errors](/img/harper-cli.png)

What a delightful way to check for flagrant spelling errors in markdown files. Thanks Harper authors!
