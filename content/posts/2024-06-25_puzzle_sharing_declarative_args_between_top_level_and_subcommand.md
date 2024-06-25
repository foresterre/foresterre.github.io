+++
title = "Puzzle: Sharing declarative args between top level and subcommand using Clap"
date = 2024-06-25

[taxonomies]
tags = ["Rust", "cargo-msrv", "msrv", "clap", "side-quest"]
+++

Alternative title: _... And a short introduction to `cargo msrv`_


# The problem

In [cargo-msrv](https://github.com/foresterre/cargo-msrv) we have the following situation. The top level command is used when "finding the MSRV" of a Rust project, while a subcommand can be used to verify that a specific MSRV works for a given project.

The former can be done by running `cargo msrv` while the latter would be `cargo msrv verify`.

Once upon a time, an issue was reported that `cargo msrv --target x verify` worked, but `cargo msrv verify --target x` did not. Another Cargo tool used by the reporter, together with `cargo-msrv`, would always specify the latter form, so the former could not be used as a workaround.

While diving into this issue I figured, this should work:

  1. `cargo msrv --target x verify`
  2. `cargo msrv verify --target x` (equivalent to 2 for the user)

 But this should not: 
 
 * `cargo msrv --target x verify --target y` 

The latter form is confusing to a user. If you allow both, you have to consider which takes precedence. Or whether they define the same thing.

This should also not work (since the `list` subcommand currently doesn't use the `target` CLI argument at all):

* `cargo msrv --target x list`
* `cargo msrv list --target x`

This post describes a short journey into the search for a satisfying solution. 

`cargo-msrv` uses `clap`, the most commonly used CLI argument parser (in the Rust library landscape). For the remainder of this post I will assume some familiarity with Rust and `clap`.

## Background on cargo msrv

This section can be useful to better understand this post since I decided to keep the original problem, instead of describing a more minimal reproduction. But feel free to skip this section (I might refer back to it though 😜).

**A short history**

`cargo-msrv` was originally born out of a desire to find the MSRV for a Rust project (more specifically package). MSRV stands for "minimal supported Rust version" and is the earliest or oldest version supported by a Rust project. For different projects this may mean different things, but for this post I will consider "support" as "does compile with a Rust toolchain of a certain version".

Fast forward a few years, and the MSRV has become somewhat more ubiquitous which can also be seen by its inclusion into Cargo as the [rust-version](https://doc.rust-lang.org/cargo/reference/manifest.html#the-rust-version-field). Over time some additional tools were added to `cargo-msrv`. One of these was the `cargo msrv verify` subcommand.

This subcommand can be used to check whether a Rust project supports its defined MSRV (e.g. via this `rust-version` field in the Cargo manifest). For example, in a CI pipeline you can use this to check whether your project works for the version you promised to your users.

Originally, I kept the `cargo msrv` top level command aside from the subcommands for backwards compatibility reasons. In hindsight I probably shouldn't have done that, but as is, their coexistence at least provides me with the opportunity to write this blog post 😅.

**How cargo msrv works**

I described the "support" from "minimal supported Rust version" (MSRV) above as the somewhat simplified "does compile with a Rust toolchain of a certain version".

You may write that as a function like so:  `fn is_compatible(version) -> bool`. If you run this test for some Rust version, when the function produces the value `true`, then we consider the Rust version to be supported. If instead the function produces the value `false`, then the Rust version is not supported.

`cargo msrv` specifically searches for the _minimal_ Rust version which is supported by a given Rust project. While there are some caveats, we build upon Rust's [stability promise](https://blog.rust-lang.org/2014/10/30/Stability.html#committing-to-stability) . In our case that is the idea that Rust versions are backwards compatible.

For a simple example to determine an MSRV, you can linearly walk backwards from the most recent Rust version to the earliest. When your project doesn't compile for a specific Rust version, then the last version that did compile can be considered your MSRV.

Let's make it a bit more concrete with an example. For this example, we assume that Rust the following Rust versions exist: `1.0.0` up to and including `1.5.0`.

Consider a project which uses the [Duration](https://doc.rust-lang.org/std/time/struct.Duration.html#) API which was stabilised by [Rust 1.3.0](https://github.com/rust-lang/rust/blob/master/RELEASES.md#version-130-2015-09-17) (and nothing more recent 😉). 

Then, if you would compile this project with Rust version from most recent to least recent, you would expect the following to happen:

- `is_compatible(Rust 1.5.0)` returns `true` ✅
- `is_compatible(Rust 1.4.0)` returns `true` ✅
- `is_compatible(Rust 1.3.0)` returns `true` ✅
- `is_compatible(Rust 1.2.0)` returns `false` ❌ ("Duration is not stable")
- `is_compatible(Rust 1.1.0)` returns `false` ❌
- `is_compatible(Rust 1.0.0)` returns false ❌

Since we only care about the _minimal_ Rust version, you could have stopped searching after compiling Rust 1.2.0; Rust 1.3.0 was the earliest released Rust version which worked.

In reality doing a linear search is quite slow (at the time of writing, there are 79 minor versions), so we primarily use a binary search instead to incrementally reduce the search space. 

`cargo msrv verify` works quite similar to "finding the MSRV", but instead of running a search which produces as primary output the MSRV, in this case the MSRV is already known in advance. So given a `MSRV` of `1.3.0` we just run the `is_compatible(Rust 1.3.0)` function once. If it returns `true` we can say that the 1.3.0 is an acceptable MSRV (although not necessarily strictly so). More importantly, if it returns false, then the specified version is actually not supported, and thus can not be an MSRV).

Enough background, back to the post.
# Definition of the CLI

`cargo-msrv` uses `clap` as its CLI argument parser. It nowadays uses the `macro derive` based API. In the code blocks below, I have isolated the primary definition of the CLI which describes the `cargo msrv` top level command (a.k.a. `Find` in the code), and the `cargo msrv verify` subcommand.

I've taken the liberty to remove some unnecessary details, and added some arrows and comments for relevant items. Otherwise, this code is the copied directly from the actual source.

```rust
#[derive(Debug, Args)]  
#[command(version)]  
pub struct CargoMsrvOpts {  // <- The top level, i.e. `cargo msrv {...}`
    #[command(flatten)]  
    pub find_opts: FindOpts, // <- Options relevant for "find msrv"
  
    #[command(flatten)]  
    pub shared_opts: SharedOpts, 
  
    #[command(subcommand)]  
    pub subcommand: Option<SubCommand>, // <- Subcommands, like "verify" in "cargo msrv verify"
}

#[derive(Debug, Args)]  
#[command(next_help_heading = "Find MSRV options")]  
pub struct FindOpts {  
    #[arg(long, conflicts_with = "linear")]  
    pub bisect: bool,  
   
     #[arg(long, conflicts_with = "bisect")]  
    pub linear: bool,  
  
	// ... omitted some options for brevity
  
    #[command(flatten)]  
    pub runner_opts: RunnerOptsFind,  
}
```

`CargoMsrvOpts` is the top level CLI interface, i.e. `cargo msrv`.
The options relevant to "finding the MSRV" are specified on the top level (i.e. `FindOpts`).

`FindOpts` should not be used for other subcommands (ironic considering this post, I know, at least `cargo msrv verify --help` doesn't list them 😜).

```rust
#[derive(Debug, Subcommand)]  
#[command(propagate_version = true)]  
pub enum SubCommand {  
    List(ListOpts),    
    Set(SetOpts),  
    Show,  
    Verify(VerifyOpts), // <- The options for the verify subcommand
}

#[derive(Debug, Args)]  
#[command(next_help_heading = "Verify options")]
pub struct VerifyOpts {  
    #[command(flatten)]  
    pub runner_opts: RunnerOpts, // <- The options we want to share between the top level "find msrv" (i.e. 'cargo msrv') and "verify msrv" subcommand (i.e. 'cargo msrv verify')  
  
    #[arg(long, value_name = "rust-version")]  
    pub rust_version: Option<BareVersion>,  
}
```

Options supplied to the `verify` subcommand are specified by the `VerifyOpts` struct. As a user, you would interface with it like so: `cargo msrv verify {opts}`, e.g. `cargo msrv verify --target example`.


```rust
#[derive(Debug, Args)]  
pub struct RunnerOpts {  
    #[command(flatten)]  
    pub rust_releases_opts: RustReleasesOpts,  
  
    #[command(flatten)]  
    pub toolchain_opts: ToolchainOpts, // <- The examples will use this one
  
    #[command(flatten)]  
    pub cargo_check_opts: CheckCommandOpts,  
}

#[derive(Debug, Args)]  
#[command(next_help_heading = "Toolchain options")]  
pub struct ToolchainOpts {  
    #[arg(long, value_name = "TARGET")]  
    pub target: Option<String>,  
  
	#[arg(long, value_name = "COMPONENT")]  
    pub add_component: Vec<String>,  
}
```

`RunnerOpts` specifies options relevant to run the `is_compatible` test I introduced in the _How cargo msrv works_ section. What this actually entails is not relevant to this post. All you need to know is that each of these flattened commands define some arguments. I will use the arguments in `ToolchainOpts` for the examples:  `--target` (as my primary example) and `--add-component` (just to point out some edge cases). 

The last detail I will add is that for both the "find msrv" top level command and each of the subcommands, we produce a flattened context which contains the inputs for that command. Both the `FindContext` and `VerifyContext` contain a `pub toolchain: ToolchainContext` field. The context is currently created via the `TryFrom` trait from the `Opts` (or resolved from the environment) to the `Context`.

The fields in the `ToolchainContext` can be considered static for the duration of the program. 

# The goal

Let's make the problem a bit more concrete again. 

First lets be explicit: the problem is limited to "matching (in name and type) CLI arguments which can be provided to both `cargo msrv` and `cargo msrv verify`", and I'll mention that if no value is given for either, we use some default which we will assume just exists.

In the end, (1) __we want to end up with a CLI interface like `cargo msrv {top_level_arg} verify {subcommand_arg}` where a matching argument is provided to either the top level `xor` the subcommand `xor` use the default__.

In addition, (2) __the matching args should not be available to subcommands, other than `verify`__.

In the next section, I'm going to throw some ideas over the wall. To generate these ideas I primarily used the `clap` rustdoc documentation on [docs.rs](docs.rs/clap`) as a reference. 

Let me spoil it for you  in advance 🙄: None of these solutions really make me happy, so I will probably choose a pragmatic choice instead.

I mention this beforehand because I want to explicitly state that none of this is something I blame on `clap` (or anyone else). `clap's` documentation is extensive, and is very well written. If it is described, then I didn't look in the right places. It might just be a puzzle I haven't solved yet 🧩.

Also, this scenario where you have a top level CLI and some subcommands which have to share some things is most likely non standard, and honestly, discouraged for similar reasons as why I'm putting this effort in: user experience. 

# Idea 1: merging Opts

A first idea is to keep the current definition and simply merge its values.

You may see some obvious flaws with this: first, goal (2) will not be met, since one of the `RunnerOpts` is defined on `FindOpts` which is at the top level of the CLI, so subcommands other than `verify` will also have allow the arguments defined by `RunnerOpts` to be specified (even though they will be ignored). Second, goal (1) is dependent on custom merging logic. 

For this, let's quickly consider the output which we would get from `clap` after it parsed the CLI arguments like in this idea (in simplified Rust code), to consider what it would look like:

```rust
let opts = CargoMsrvOpts { ... }; // Output from Clap's parse method
let find_opts = opts.find_opts;
let Some(VerifyOpts(verify_opts)) = opts.subcommand else { todo!() };

let find_toolchain_opts = find_opts.runner_opts.toolchain_opts;
let verify_toolchain_opts = verify_opts.runner_opts.toolchain_opts;
```

If `opts.subcommand` is not `Some(VerifyOpts(_))` then we can simply take all arguments from the `find_toolchain_opts`. 

If `opts.subcommand` is `Some(VerifyOpts(_))`, then we would need to merge `find_toolchain_opts` and `verify_toolchain_opts`. 

Most of this merging code would likely be fairly trivial considering the limited common CLI input options and the XOR-or-default condition that `clap` would enforce if this concept worked.

> Values which are marked as optional, i.e. via the `Option<T>` type are trivial. If one is `Some`, then the other one must be `None` (by the  XOR-or-default condition).
> 
>  Values which instead use a default value, may not be so clear cut. There is the question: did the user provide this default value, or was it omitted. The first case is a choice, similar to `Some`, while the second case is a fallback to a default like `None`. This information is no longer known after argument parsing.
> 
> The good news however is that we only need to compare two values per field. Consider `enum Choice { #[default] A, B, C }`. Since we know that at most only one of the two values was provided, since if our idea works, the argument parser rejects if the user provides both. 
> 
> From an external point of view,  there are four options `A (default), A (provided), B and C`. However, we have to decide on a merged value for each pair just using their values `A, B and C`.  If values B or C, on both `find xor verify`, are given it is simple: by the XOR-or-default condition, B and C are always the user selected values. For A, we luckily do actually not need to care whether it was provided or not. If the other side provides B or C, it was the default (see previous), and if it is A, then we can simply use A.
>
> -> I feel the merging/selecting would likely be reasonably possible with this fairly simple scenario in mind, but haven't put much thought into searching counter arguments where it doesn't work (or proving that it always works for that matter). 

Yet, it would still all be a bit too hairy for my liking considering we use the `derive` API to get a nice declarative, clean looking argument parser.

Positives: 

- The code (likely) compiles
- The interface becomes no worse than it is today

Negatives:

- Custom merging logic on top of the declarative API

Currently my preferred choice, mostly because it won't worsen the current user experience.

# Idea 2: naming a command

If we could name one of these derived commands, then we might get away with saying to `clap`:  "the fields within this named command are incompatible with the fields in this other named command"; i.e. I'm trying to apply some constraint.

```rust
#[derive(Debug, Args)]  
#[command(next_help_heading = "Find MSRV options")]  
pub struct FindOpts {  
    #[arg(long, conflicts_with = "linear")]  
    pub bisect: bool,  
   
     #[arg(long, conflicts_with = "bisect")]  
    pub linear: bool,  
  
	// ... omitted some options for brevity
  
    #[command(flatten, id = "runner_opts_find", conflicts_with = ["runner_opts_verify"])]
    pub runner_opts: RunnerOptsFind,  
}

#[derive(Debug, Args)]  
#[command(next_help_heading = "Verify options")]
pub struct VerifyOpts {  
    #[command(flatten, id = "runner_opts_verify")]
    pub runner_opts: RunnerOpts, 
  
    #[arg(long, value_name = "rust-version")]  
    pub rust_version: Option<BareVersion>,  
}
```

Unfortunately, this idea doesn't quite cut it. Deriving `flatten` and supplying an `id` at the same time is not allowed:
  
```
error: methods are not allowed for flattened entry                                                                                                   
  --> src\cli\find_opts.rs:53:15
   |
53 |     #[command(flatten, id = "runner_opts_find", conflicts_with = ["runner_opts_verify"])]
   |               ^^^^^^^
```
--

If this idea would have worked, we also would still need to merge the `Opts` together, like in the last example. 

The other reason why this idea is doomed is that when you put the id on the whole group of arguments, I suspect that once you give any argument in either the top level or the subcommand, all other values in the group must also be from the same group; otherwise they would be considered in conflict.

Considering `cargo msrv {group_top_level} verify {group_subcommand}`,  then `cargo msrv --target x --add-component y verify` or `cargo msrv verify  --target x --add-component y` would be fine, but mixing it up like  `cargo msrv --target x verify --add-component y` would be in conflict. 


Positives: 

- I can dream about a declarative only solution
- Maybe this would work on an argument level?
	- I haven't tried that yet
 
Negatives:

- Doesn't compile
- Likely wouldn't work in the first place
- If it did, it would likely work per whole group, so I would have to use a group per argument

# Idea 3: Separate structs, groups and conflicts

 I also wanted to try a variation on the previous idea: this idea instead provides two 'separately' nameable things, which then  can be marked to be in conflict with one another. 
 
 We only let the top level variant be in conflict with the subcommand variant, since the latter cannot exist without the former.

```rust
#[derive(Debug, Args)]  
#[command(next_help_heading = "Find MSRV options")]  
pub struct FindOpts {
    #[command(flatten)]  
    pub runner_opts: RunnerOptsFind,  
}

#[derive(Debug, Args)]  
#[command(next_help_heading = "Verify options")]  
pub struct VerifyOpts {  
    #[command(flatten)]  
    pub runner_opts: RunnerOptsVerify,  
  
    // ... etc.
}

// NB: Should be kept in sync with `RunnerOptsVerify`!  
#[derive(Debug, Args)]  
#[group(id = "runner_opts_find", conflicts_with = "runner_opts_verify", multiple = true)]
pub struct RunnerOptsFind {  
    #[command(flatten)]  
    pub rust_releases_opts: RustReleasesOpts,  
  
    #[command(flatten)]  
    pub toolchain_opts: ToolchainOpts,  
  
    #[command(flatten)]  
    pub cargo_check_opts: CheckCommandOpts,  
}

// NB: Should be kept in sync with `RunnerOptsFind`!  
#[derive(Debug, Args)]  
#[group(id = "runner_opts_verify", multiple = true)]  
pub struct RunnerOptsVerify {  
    #[command(flatten)]  
    pub rust_releases_opts: RustReleasesOpts,  
  
    #[command(flatten)]  
    pub toolchain_opts: ToolchainOpts,  
  
    #[command(flatten)]  
    pub cargo_check_opts: CheckCommandOpts,  
}
```
However, running results in:

```
cargo run -- msrv verify --target x
   Compiling cargo-msrv v0.16.0-beta.22 (C:\ws\cargo-msrv)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 11.24s                                                                                                                                                      
     Running `target\debug\cargo-msrv.exe msrv verify --target x`
thread 'main' panicked at C:\Users\x\.cargo\registry\src\index.crates.io-6f17d22bba15001f\clap_builder-4.5.7\src\builder\debug_asserts.rs:314:13:
Command msrv: Argument group 'runner_opts_find' conflicts with non-existent 'runner_opts_verify' id
stack backtrace:
```

There's probably a logical explanation here why this doesn't work; I guess I don't properly understand how `ArgGroup` works...

Neutral:

- I don't seems to understand `ArgGroup` properly yet

# Idea 4: global = true

This was the first idea I had when I read the originally reported issue. It will again not satisfy goal (2), because marking a command as global, makes it, well, available to all subcommands.

This could however be a pragmatic choice, since in the current form they're already present via the top level `FindOpts`. 

```rust
#[derive(Debug, Args)]  
#[command(next_help_heading = "Toolchain options")]  
pub struct ToolchainOpts {  
    #[arg(long, value_name = "TARGET", global = true)]  
    pub target: Option<String>,  
  
	#[arg(long, value_name = "COMPONENT", global = true)]  
    pub add_component: Vec<String>,  
}
```

When I looked at this idea in more detail, I actually found that this may be considered slightly worse since `cargo msrv list --target x` would be valid when `global = true`, while the current form 'only' allows `cargo msrv --target x list` (the residue of having the `FindOpts` at the top level). Plus, the current form does, for better or worse, not show the `FindOpts` help text when providing `--help` on the subcommand: i.e. `cargo msrv verify --help`.

Now, it also doesn't really satisfy goal (1). For example: `cargo msrv --add-component a --add-component b --target x verify --add-component c --add-component d --target y` , produces:

```
toolchain: ToolchainContext {
        target: "y",
        components: [
            "c",
            "d",
        ],
    },
```

While,  `cargo msrv --target x --add-component a verify --add-component b --target y --target z` ,  does result in :

`error: the argument '--target <TARGET>' cannot be used multiple times`

Positives: 

- The code compiles
- Most simple scenarios work
- It doesn't need hairy merging code (on the surface)

Negatives:

- The interface will allow additional ignored arguments for subcommands other than verify
	- This list can grow large if all of `RunnerOpts` arguments are included
- Mixed usage does not limit the `num_args` for `Args` on a global level
- Mixed usage overwrites values specified on a deeper subcommand level
	- Behaviour can possibly be changed with `ArgAction` (?)
	- This wouldn't be a problem if on a global level  it is possible to enforce that arguments could be only provided to one level / for non collection types, that the `num_args` would be complied with on the global level 
- Mixed usage is unintuitive for a user

# Remarks on using Clap

_In this likely non-standard use case._

## Clap's API surface

`Clap` has grown quite the set of options. There's something for everyone. It may very well still be possible to fulfill the use case I described above. Just because I couldn't find it after searching for it for a while doesn't mean it doesn't exist. In the end, I  decided to choose pragmatic over pure.

## Skip

Many attributes define the magic `skip` option. It is available for `ArgGroup` and `Arg`. It is not available to `Command` in general (a variation with different behaviour is on `Subcommand`). 

At first it sounded like  logical name for the something I'm looking for, however it ignores fields and sets a provided expression (or Default::default if omitted), so this doesn't feel like it works. 

Aside: what kind of expression should I even put in, even if it fulfilled my use case; you would need to be able to refer to something which ought to be skipped. In my case that would be conditionally skipping if the subcommand is `Some(s) where S is not Verify`

## Command::args_conflicts_with_subcommands

For a second, I hoped that if a command could be marked with  `args_conflicts_with_subcommands`  we could then reject all  
 subcommands which are not `verify`, but this method `args_conflicts_with_subcommands(...)` takes a bool;  not a list of subcommands... 😭, and has another use case altogether...

## Shared value state

At some point I had a fleeting wish that there could be a `GroupArg` (or something else altogether) where values share their state.

I.e. given a group `G`, defined on the top level as `G_t` and on a subcommand as `G_s`, when setting a value  for `G_t` or `G_s`, their value state would be shared. Still just this would not solve the most prominent problem, i.e. for the user we want to explicitly allow just one of each argument for any `i` in `G_i` to be defined...

I suppose, this is not dissimilar to `global = true` on `Args`, except for some action override since `global = true` doesn't work intuitively by default for args defined on mixed levels.

## Derive and groups

 When using derive, it is not always straightforward to get an `Arg` from a group, since we have the derived structs; not `ArgMatches`. With `ArgMatches` you can, if I understand the documentation correctly, get the value of the group using one of the `get_{}` methods on `ArgMatches`.  

 Possibly I could hack this together by using `ArgAction::set` with `Command::args_override_self(true)` ..? 

I still think I don't really understand the true value of `ArgGroup`. The "a group of shared commands" I was looking for is probably something else entirely. 😉

# Conclusion

If you, dear reader, by any chance know how to solve the issue of this post, or have other ideas: I love [to learn](https://github.com/foresterre/cargo-msrv/issues/936) (about them). <sup>You also send me a mail, or contact me in another way, see my GitHub profile.</sup>

In the mean time, I suppose that this just isn't the way forward. To meet goal (2) in particular, having some shared arguments also at the top level makes solving the issue a lot harder. I tried to add constraints on how this definition could be used, but none of these really worked out.

Maybe it is finally time to sunset the `cargo msrv` top level command and introduce a dedicated subcommand for "find your msrv" instead.

p.s. I kind of wrote this all on a whim, so it may be full of mistakes 🫧.

# Thanks!

This post is based on an [issue](https://github.com/foresterre/cargo-msrv/issues/936) originally reported by [Finomnis](https://github.com/Finomnis) , thanks!

